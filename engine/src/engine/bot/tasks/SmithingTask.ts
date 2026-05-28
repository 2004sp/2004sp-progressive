/**
 * SmithingTask.ts — Withdraw ores/bars from bank, smelt on furnace or smith on anvil, deposit results, repeat.
 *
 * Two modes based on level:
 *   - Furnace (smelt): 100% until level 18, then 75% — ore → bar
 *   - Anvil (smith): Starts at level 18, 25% — 5 bars → platebody
 *
 * Anvil mode uses bars from bank (bank smelted bars first, then use them on anvil).
 */

import {
    BotTask,
    Player,
    Loc,
    InvType,
    walkTo,
    interactUseLocOp,
    findLocByName,
    findLocByPrefix,
    hasItem,
    countItem,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    getProgressionStep,
    teleportNear,
    randInt,
    bankInvId,
    StuckDetector,
    ProgressWatchdog,
    openNearbyGate,
    botJitter,
    advanceBankWalk
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';

const MIN_MATERIALS = 1;

const SMELT_COOLDOWN_MIN = 6;
const SMELT_COOLDOWN_MAX = 10;

const SMITH_FAIL_LIMIT = 6;

const ANVIL_MIN_LEVEL = 18;
const ANVIL_CHANCE = 0.25;

export class SmithingTask extends BotTask {
    private step: SkillStep;

    private state: 'bank_walk' | 'withdraw' | 'work_walk' | 'work' | 'bank_return' = 'bank_walk';

    private lastXp = 0;
    private workFailTicks = 0;
    private done = false;

    private useAnvil = false;
    private consecutiveAnvilFails = 0;
    private viaLocation?: [number, number, number];

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Smith');
        this.step = step;
        this.viaLocation = step.via;
        this.watchdog.destination = step.location;
    }

    private debug(player: Player, message: string): void {
        console.log(`[SmithingTask][${player.username}][${this.state}] ${message}`);
    }

    // ── Task lifecycle ────────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        const level = getBaseLevel(player, PlayerStat.SMITHING);

        const hasOres = this._hasOresInBankOrInv(player);
        const hasBars = this._hasBarsInBankOrInv(player);
        const hasHammer = hasItem(player, Items.HAMMER);

        this.debug(player, `shouldRun check: level=${level}, hasOres=${hasOres}, hasBars=${hasBars}, hasHammer=${hasHammer}, anvilLevel=${level >= ANVIL_MIN_LEVEL}`);

        if (level >= ANVIL_MIN_LEVEL && hasHammer && hasBars) {
            return true;
        }

        if (hasOres) {
            return true;
        }

        return false;
    }

    isComplete(_player: Player): boolean {
        return this.done;
    }

    tick(player: Player): void {
        if (this.interrupted) {
            this.debug(player, 'Tick skipped because task is interrupted');
            return;
        }

        const banking = this.state === 'bank_walk' || this.state === 'withdraw' || this.state === 'bank_return';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.debug(player, 'Watchdog triggered; teleported to destination, resuming');
            this.stuck.reset();
            this.state = 'work_walk';
            this.workFailTicks = 0;
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ── Progression upgrade ─────────────────────────────────────────────
        const level = getBaseLevel(player, PlayerStat.SMITHING);
        const actionFilter = this.useAnvil ? 'smith' : 'smelt';
        const allSteps = getProgressionStep('SMITHING', level);
        const newStep = allSteps ? allSteps : null;

        if (newStep && newStep.minLevel > this.step.minLevel) {
            this.debug(player, `Progression upgrade detected: level=${level}, newMinLevel=${newStep.minLevel}`);
            this.step = newStep;

            if (this.state === 'work' || this.state === 'work_walk') {
                this.debug(player, 'Switching to bank_return because current material tier changed');
                this.state = 'bank_return';
            }
        }

        // ── Determine mode ────────────────────────────────────────────────────
        if (this.state === 'bank_walk' || this.state === 'bank_return') {
            const shouldUseAnvil = this._shouldUseAnvilMode(player);

            if (shouldUseAnvil !== this.useAnvil) {
                this.debug(player, `Switching mode: anvil=${shouldUseAnvil}, was=${this.useAnvil}`);
                this.useAnvil = shouldUseAnvil;
            }
        }

        // ── Bank walk ────────────────────────────────────────────────────────────
        if (this.state === 'bank_walk' || this.state === 'bank_return') {
            const result = advanceBankWalk(player, this.stuck, this.step.location);

            if (result === 'walk') {
                return;
            }

            this.debug(player, `advanceBankWalk returned ${result}`);
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'withdraw';

            return;
        }

        // ── Withdraw materials ────────────────────────────────────────────────
        if (this.state === 'withdraw') {
            this._depositResults(player);

            // Open bank exit door before walking to furnace/anvil — bots
            // teleported inside the bank find it closed and can't exit.
            openNearbyGate(player, 5);

            const hasMaterial = this.useAnvil ? this._withdrawBars(player) : this._withdrawOres(player);

            if (!hasMaterial) {
                this.debug(player, `No materials for mode: anvil=${this.useAnvil}; marking task complete`);
                this.done = true;
                this.interrupt();
                return;
            }

            this.state = 'work_walk';
            this.cooldown = 1;
            return;
        }

        // ── Walk to work location ─────────────────────────────────────────
        if (this.state === 'work_walk') {
            const [lx, lz, ll] = this.step.location;

            // Via waypoint handling - route through intermediate coord
            const via = this.viaLocation;
            if (via) {
                const viaX = via[0];
                const viaZ = via[1];
                if (!isNear(player, viaX, viaZ, 5)) {
                    const [jx, jz] = botJitter(player, viaX, viaZ, 3);
                    this._stuckWalk(player, jx, jz);
                    return;
                }
                // Reached via waypoint - clear it and proceed to location
                this.viaLocation = undefined;
            }

            if (!isNear(player, lx, lz, 1, ll)) {
                this._stuckWalk(player, lx, lz);
                return;
            }

            this.state = 'work';
            this.workFailTicks = 0;
            this.lastXp = player.stats[PlayerStat.SMITHING];
            this.debug(player, `Reached work location; state changed to work, lastXp=${this.lastXp}`);
            return;
        }

        // ── Work (smelt or smith) ───────────────────────────────────────────────
        if (this.state === 'work') {
            const hasMaterial = this.useAnvil ? this._hasBarsInInventory(player) : this._hasOresInInventory(player);

            if (!hasMaterial) {
                this.debug(player, `No materials left; switching to bank_return`);
                this.state = 'bank_return';
                return;
            }

            const workLoc = this._findWorkLocation(player);
            if (!workLoc) {
                const [lx, lz] = this.step.location;
                this.debug(player, `No work location found nearby; walking toward step location ${lx}, ${lz}`);
                this._stuckWalk(player, lx, lz);
                return;
            }

            const itemId = this.step.itemConsumed!;
            const slot = this._getItemSlot(player, itemId);

            if (slot === null) {
                this.debug(player, `Could not find material ${itemId} in inventory slot list; switching to bank_return`);
                this.state = 'bank_return';
                return;
            }

            this.debug(player, `Attempting ${this.useAnvil ? 'smith' : 'smelt'} interaction on ${workLoc.type} at ${workLoc.x}, ${workLoc.z}, item=${itemId}, slot=${slot}`);
            const ok = interactUseLocOp(player, workLoc, itemId, slot);

            if (ok) {
                // Manual XP since server-side may not give XP (matches FiremakingTask architecture)
                const oldLevel = getBaseLevel(player, PlayerStat.SMITHING);
                player.stats[PlayerStat.SMITHING] += this.step.xpPerAction;
                const newLevel = getBaseLevel(player, PlayerStat.SMITHING);
                if (newLevel > oldLevel) {
                    this.rescanTimer = 0; // Force rescan on level change
                }
                const currentXp = player.stats[PlayerStat.SMITHING];
                const gained = currentXp - this.lastXp;
                this.lastXp = currentXp;

                this.workFailTicks = 0;

                if (this.useAnvil) {
                    this.consecutiveAnvilFails = 0;
                }

                this.cooldown = randInt(SMELT_COOLDOWN_MIN, SMELT_COOLDOWN_MAX);

                if (gained > 0) {
                    this.watchdog.notifyActivity();
                }

                this.debug(player, `Work action sent successfully; xpGain=${gained}, cooldown=${this.cooldown}`);
            } else {
                this.workFailTicks++;
                this.debug(player, `Work interaction failed; workFailTicks=${this.workFailTicks}/${SMITH_FAIL_LIMIT}`);

                if (this.workFailTicks >= SMITH_FAIL_LIMIT) {
                    if (this.useAnvil) {
                        this.consecutiveAnvilFails++;
                        this.debug(player, `Too many anvil fails; falling back to furnace mode`);
                        this.useAnvil = false;
                        this.consecutiveAnvilFails = 0;
                    }

                    if (!isNear(player, workLoc.x, workLoc.z, 5)) {
                        this.debug(player, `Failed too many times; opening nearby gate/curtain and walking to ${workLoc.x}, ${workLoc.z}`);
                        openNearbyGate(player, 8);
                        walkTo(player, workLoc.x, workLoc.z);
                    } else {
                        this.debug(player, `Already near work location, waiting and retrying`);
                    }
                    this.workFailTicks = 0;
                } else {
                    this.cooldown = 1;
                }
            }
            return;
        }
    }

    override reset(): void {
        super.reset();
        this.state = 'bank_walk';
        this.lastXp = 0;
        this.workFailTicks = 0;
        this.done = false;
        this.useAnvil = false;
        this.consecutiveAnvilFails = 0;
        this.viaLocation = this.step.via;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _shouldUseAnvilMode(player: Player): boolean {
        const level = getBaseLevel(player, PlayerStat.SMITHING);

        if (level < ANVIL_MIN_LEVEL) {
            return false;
        }

        if (!hasItem(player, Items.HAMMER)) {
            this.debug(player, 'No hammer; using furnace mode');
            return false;
        }

        if (this.consecutiveAnvilFails >= 3) {
            this.debug(player, 'Too many anvil fails; using furnace mode');
            return false;
        }

        const hasBars = this._hasBarsInBankOrInv(player);
        if (!hasBars) {
            return false;
        }

        return Math.random() < ANVIL_CHANCE;
    }

    private _findWorkLocation(player: Player): Loc | null {
        if (this.useAnvil) {
            const anvil = findLocByName(player.x, player.z, player.level, 'anvil', 2);
            if (anvil) {
                this.debug(player, `Found anvil at ${anvil.x}, ${anvil.z}`);
                return anvil;
            }
            return null;
        }

        const furnace = findLocByPrefix(player.x, player.z, player.level, 'furnace', 15);
        if (furnace) {
            this.debug(player, `Found furnace at ${furnace.x}, ${furnace.z}`);
            return furnace;
        }

        return null;
    }

    private _getItemSlot(player: Player, itemId: number): number | null {
        const inv = player.getInventory(InvType.INV);
        if (!inv) {
            return null;
        }

        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)?.id === itemId) return i;
        }

        return null;
    }

    private _hasOresInBankOrInv(player: Player): boolean {
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item) continue;
                    if (item.id === Items.COPPER_ORE || item.id === Items.TIN_ORE || item.id === Items.IRON_ORE || item.id === Items.COAL || item.id === Items.GOLD_ORE) {
                        return true;
                    }
                }
            }
        }

        return countItem(player, Items.COPPER_ORE) > 0 || countItem(player, Items.TIN_ORE) > 0 || countItem(player, Items.IRON_ORE) > 0 || countItem(player, Items.COAL) > 0 || countItem(player, Items.GOLD_ORE) > 0;
    }

    private _hasBarsInBankOrInv(player: Player): boolean {
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item) continue;
                    if (item.id === Items.BRONZE_BAR || item.id === Items.IRON_BAR || item.id === Items.STEEL_BAR || item.id === Items.GOLD_BAR) {
                        return true;
                    }
                }
            }
        }

        return countItem(player, Items.BRONZE_BAR) > 0 || countItem(player, Items.IRON_BAR) > 0 || countItem(player, Items.STEEL_BAR) > 0 || countItem(player, Items.GOLD_BAR) > 0;
    }

    private _hasOresInInventory(player: Player): boolean {
        return countItem(player, Items.COPPER_ORE) > 0 || countItem(player, Items.TIN_ORE) > 0 || countItem(player, Items.IRON_ORE) > 0 || countItem(player, Items.COAL) > 0 || countItem(player, Items.GOLD_ORE) > 0;
    }

    private _hasBarsInInventory(player: Player): boolean {
        this.debug(player, `Checking bars in inventory: bronze=${countItem(player, Items.BRONZE_BAR)}, iron=${countItem(player, Items.IRON_BAR)}, steel=${countItem(player, Items.STEEL_BAR)}, gold=${countItem(player, Items.GOLD_BAR)}`);
        return countItem(player, Items.BRONZE_BAR) > 0 || countItem(player, Items.IRON_BAR) > 0 || countItem(player, Items.STEEL_BAR) > 0 || countItem(player, Items.GOLD_BAR) > 0;
    }

    private _withdrawOres(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return false;

        let withdrawn = false;

        const oreItemIds = [Items.COPPER_ORE, Items.TIN_ORE, Items.IRON_ORE, Items.COAL, Items.GOLD_ORE];
        for (const oreId of oreItemIds) {
            for (let i = 0; i < bank.capacity; i++) {
                const item = bank.get(i);
                if (!item || item.id !== oreId) continue;

                const toWithdraw = Math.min(item.count, 28);
                const moved = bank.remove(oreId, toWithdraw);
                if (moved.completed > 0) {
                    inv.add(oreId, moved.completed);
                    withdrawn = true;
                }
                break;
            }
        }

        const invOres = countItem(player, Items.COPPER_ORE) + countItem(player, Items.TIN_ORE) + countItem(player, Items.IRON_ORE) + countItem(player, Items.COAL);
        this.debug(player, `Withdrew ores: total=${invOres}`);
        return withdrawn || invOres > 0;
    }

    private _withdrawBars(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return false;

        let withdrawn = false;

        const level = getBaseLevel(player, PlayerStat.SMITHING);
        let barIds: number[];

        if (level >= 48) {
            barIds = [Items.STEEL_BAR, Items.IRON_BAR, Items.BRONZE_BAR, Items.GOLD_BAR];
        } else if (level >= 40) {
            barIds = [Items.GOLD_BAR, Items.IRON_BAR, Items.BRONZE_BAR];
        } else if (level >= 33) {
            barIds = [Items.IRON_BAR, Items.BRONZE_BAR];
        } else {
            barIds = [Items.BRONZE_BAR];
        }

        const barsNeeded = 5;

        for (const barId of barIds) {
            const bankCount = countItemInBank(player, barId);
            if (bankCount >= barsNeeded) {
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item || item.id !== barId) continue;

                    const toWithdraw = Math.min(item.count, 28);
                    const moved = bank.remove(barId, toWithdraw);
                    if (moved.completed > 0) {
                        inv.add(barId, moved.completed);
                        withdrawn = true;
                    }
                    break;
                }
                break;
            }
        }

        const invBars = countItem(player, Items.BRONZE_BAR) + countItem(player, Items.IRON_BAR) + countItem(player, Items.STEEL_BAR) + countItem(player, Items.GOLD_BAR);
        this.debug(player, `Withdrew bars: total=${invBars}`);
        return withdrawn || invBars > 0;
    }

    private _depositResults(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        const itemsToKeep: Set<number> = new Set([Items.COPPER_ORE, Items.TIN_ORE, Items.IRON_ORE, Items.COAL, Items.GOLD_ORE, Items.BRONZE_BAR, Items.IRON_BAR, Items.STEEL_BAR, Items.GOLD_BAR, Items.COINS, Items.HAMMER]);

        let deposited = 0;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (itemsToKeep.has(item.id)) continue;

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
                deposited += moved.completed;
            }
        }

        this.debug(player, `Deposit results complete; deposited=${deposited}`);
    }

    private _stuckWalk(player: Player, lx: number, lz: number): void {
        if (!this.stuck.check(player, lx, lz)) {
            this.debug(player, `Walking to target ${lx}, ${lz}`);
            walkTo(player, lx, lz);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            this.debug(player, `Desperately stuck; teleporting near ${lx}, ${lz}`);
            teleportNear(player, lx, lz);
            this.stuck.reset();
            return;
        }

        if (openNearbyGate(player, 8)) {
            this.debug(player, 'Opened nearby gate/curtain while stuck');
            return;
        }

        const wx = player.x + randInt(-10, 10);
        const wz = player.z + randInt(-10, 10);
        this.debug(player, `Stuck fallback walk to ${wx}, ${wz}`);
        player.clearWaypoints();
        walkTo(player, wx, wz);
    }
}

function countItemInBank(player: Player, itemId: number): number {
    const bid = bankInvId();
    if (bid === -1) return 0;

    const bank = player.getInventory(bid);
    if (!bank) return 0;

    let count = 0;
    for (let i = 0; i < bank.capacity; i++) {
        const item = bank.get(i);
        if (item?.id === itemId) count += item.count;
    }
    return count;
}

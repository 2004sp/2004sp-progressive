import {
    BotTask,
    Player,
    walkTo,
    removeItem,
    addItem,
    countItem,
    hasItem,
    isNear,
    getBaseLevel,
    getProgressionStep,
    PlayerStat,
    Items,
    Locations,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    InvType,
    bankInvId,
    openNearbyGate,
    teleportNear,
    nearestBank,
    findNpcByName,
    interactNpcOp,
} from '#/engine/bot/tasks/BotTaskBase.js';

import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import Loc from '#/engine/entity/Loc.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { interactHeldOpU } from '#/engine/bot/BotAction.js';

/** Tinderbox price + shopkeeper at Lumbridge General Store (BotKnowledge.Shops.LUMBRIDGE_GENERAL). */
const TINDERBOX_COST = 13;
const GENERAL_STORE_NPC = 'generalshopkeeper1';

export class FiremakingTask extends BotTask {
    private step: SkillStep;

    private state: 'walk' | 'burn' | 'wait_burn' | 'move' | 'bank_walk' | 'bank' | 'shop_walk' | 'shop_buy' = 'walk';

    private lastXp = 0;
    private bankLocked = false;
    private shopWaitTicks = 0;
    private xpBeforeBurn = 0;
    private burnWaitTicks = 0;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Firemaking');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        const logId = this.step.itemConsumed;
        if (!logId || logId === -1) return false;
        if (!hasItem(player, logId) && !this._inBank(player, logId)) return false;
        // No tinderbox in hand or bank — still fine as long as there's enough
        // coin (inv + bank) to buy one; the 'bank' state routes to 'shop_walk'
        // for that. Only block if the bot genuinely can't get one at all.
        if (!hasItem(player, Items.TINDERBOX) && !this._inBank(player, Items.TINDERBOX)) {
            const coins = countItem(player, Items.COINS) + this._bankCount(player, Items.COINS);
            if (coins < TINDERBOX_COST) return false;
        }
        return true;
    }

    // ───────────────── LOG HELPERS ─────────────────

    private getItemSlot(player: Player, itemId: number): number | null {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return null;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === itemId) return i;
        }
        return null;
    }

    /** Returns the step's required log ID if the bot has one in inventory, else null. */
    private getFirstLog(player: Player): number | null {
        const logId = this.step.itemConsumed;
        if (!logId || logId === -1) return null;
        return this.getItemSlot(player, logId) !== null ? logId : null;
    }

    private hasLogs(player: Player): boolean {
        return this.getFirstLog(player) !== null;
    }

    private _inBank(player: Player, itemId: number): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === itemId) return true;
        }
        return false;
    }

    private _bankCount(player: Player, itemId: number): number {
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

    private static FIRE_ID = 2732;
    private static FIRE_DURATION = 100; // ticks

private spawnFire(player: Player): void {
    try {
        const fire = new Loc(
            player.level,                      // level
            player.x,                          // x
            player.z,                          // z
            1,                                 // width
            1,                                 // length
            EntityLifeCycle.DESPAWN,           // lifecycle
            FiremakingTask.FIRE_ID,            // type (2732)
            10,                                // shape
            0                                  // angle
        );

        World.addLoc(fire, FiremakingTask.FIRE_DURATION);

        console.log(`[Firemaking] 🔥 spawned REAL fire at ${player.x},${player.z}`);
    } catch (err) {
        console.log('[Firemaking] ❌ failed to spawn fire', err);
    }
}

    // ───────────────── MAIN LOOP ─────────────────

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank' || this.state === 'shop_walk' || this.state === 'shop_buy';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            this.state = 'walk';
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        const level = getBaseLevel(player, PlayerStat.FIREMAKING);
        const newStep = getProgressionStep('FIREMAKING', level);

        if (newStep && newStep.minLevel > this.step.minLevel) {
            console.log(`[Firemaking] 📈 Step upgrade`);
            this.step = newStep;
            this.resetLoop();
        }

        // ───────────────── FORCE BANK FIX ─────────────────
        // Also checks for a tinderbox in hand — without this, a bot that has
        // logs but only has its tinderbox in the bank (or nowhere at all)
        // would walk straight out to 'burn' and silently stall forever there
        // (see the o_slot === null guard below).
        if ((!this.hasLogs(player) || !hasItem(player, Items.TINDERBOX)) && !banking) {
            console.log(`[Firemaking] 📦 No logs or no tinderbox → bank`);
            this.state = 'bank_walk';
        }

        // ───────────────── BANK WALK ─────────────────

        if (this.state === 'bank_walk') {
            const [bx, bz] = nearestBank(player);

            if (!isNear(player, bx, bz, 8)) {
                this._stuckWalk(player, bx, bz);
                return;
            }

            console.log(`[Firemaking] 🏦 Arrived bank`);
            this.state = 'bank';
            return;
        }

        // ───────────────── BANK ─────────────────

        if (this.state === 'bank') {
            const bid = bankInvId();
            const bank = bid !== -1 ? player.getInventory(bid) : null;
            const inv = player.getInventory(InvType.INV);
            if (!bank || !inv) return;

            const logId = this.step.itemConsumed;
            if (!logId || logId === -1) { this.interrupt(); return; }

            // 1. Deposit everything that isn't the correct log or tinderbox.
            for (let i = 0; i < inv.capacity; i++) {
                const item = inv.get(i);
                if (!item) continue;
                if (item.id === logId || item.id === Items.TINDERBOX) continue;
                const moved = inv.remove(item.id, item.count);
                if (moved.completed > 0) bank.add(item.id, moved.completed);
            }

            // 2. Ensure tinderbox is in inventory; withdraw from bank if needed.
            if (!hasItem(player, Items.TINDERBOX)) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id !== Items.TINDERBOX) continue;
                    const removed = bank.remove(Items.TINDERBOX, 1);
                    if (removed.completed > 0) inv.add(Items.TINDERBOX, 1);
                    break;
                }
                if (!hasItem(player, Items.TINDERBOX)) {
                    console.log(`[Firemaking] 🛒 No tinderbox in bank → shop trip to Lumbridge General`);
                    this.state = 'shop_walk';
                    this.shopWaitTicks = 0;
                    return;
                }
            }

            // 3. Withdraw correct logs (fill remaining inventory space).
            if (!hasItem(player, logId)) {
                let withdrew = false;
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item || item.id !== logId) continue;
                    const moved = bank.remove(logId, item.count);
                    if (moved.completed > 0) {
                        inv.add(logId, moved.completed);
                        withdrew = true;
                    }
                    break;
                }
                if (!withdrew) {
                    console.log(`[Firemaking] ❌ No correct logs in bank → STOP`);
                    this.interrupt();
                    return;
                }
            }

            this.bankLocked = false;
            this.state = 'walk';
            return;
        }

        // ───────────────── SHOP: buy a tinderbox from Lumbridge General ─────────────────

        if (this.state === 'shop_walk') {
            const [sx, sz, sl] = Locations.LUMBRIDGE_GENERAL;

            if (!isNear(player, sx, sz, 8, sl)) {
                this._stuckWalk(player, sx, sz);
                return;
            }

            const shopNpc = findNpcByName(player.x, player.z, player.level, GENERAL_STORE_NPC, 10);
            if (!shopNpc) return;

            interactNpcOp(player, shopNpc, 3); // op3 = Trade
            this.state = 'shop_buy';
            this.shopWaitTicks = 0;
            this.cooldown = 2;
            return;
        }

        if (this.state === 'shop_buy') {
            // Give the shop interface a couple of ticks to open before buying.
            if (this.shopWaitTicks < 2) {
                this.shopWaitTicks++;
                return;
            }

            if (countItem(player, Items.COINS) < TINDERBOX_COST) {
                console.log(`[Firemaking] ❌ Can't afford a tinderbox (need ${TINDERBOX_COST}gp) → STOP`);
                this.interrupt();
                return;
            }

            removeItem(player, Items.COINS, TINDERBOX_COST);
            if (!addItem(player, Items.TINDERBOX, 1)) {
                // Inventory full — refund and let the FORCE BANK FIX route us
                // back through a normal bank trip to free space.
                addItem(player, Items.COINS, TINDERBOX_COST);
                this.state = 'bank_walk';
                return;
            }

            console.log(`[Firemaking] 🛒 Bought a tinderbox`);
            // Route back through 'bank_walk' (not straight to 'bank') — the
            // bot is standing at Lumbridge General here, not at a bank, and
            // 'bank_walk' is what actually walks it to the nearest one before
            // 'bank' re-verifies everything (deposits stray items, tops up logs).
            this.state = 'bank_walk';
            return;
        }

        // ───────────────── WALK TO FIRE AREA ─────────────────

        if (this.state === 'walk') {
            const [lx, lz] = Locations.FIRE_LUMBRIDGE_ROAD;

            if (!isNear(player, lx, lz, 8)) {
                this._stuckWalk(player, lx, lz);
                return;
            }

            console.log(`[Firemaking] 🔥 Arrived fire area`);
            this.state = 'burn';
            return;
        }

             // ───────────────── BURN ─────────────────

        if (this.state === 'burn') {
            const logId = this.getFirstLog(player);
            const inv = player.getInventory(InvType.INV);
            if (!logId) {
                console.log('[Firemaking] 📦 out of logs');
                this.state = 'bank_walk';
                return;
            }
            if (!inv) {
                return;
            }
            const slot = this.getItemSlot(player, logId);
            if (slot === null) return;
            const o_slot = this.getItemSlot(player, Items.TINDERBOX);
            if (o_slot === null) {
                // Defense in depth — the FORCE BANK FIX above should already
                // catch a missing tinderbox before we ever get here, but if a
                // tinderbox is somehow lost mid-task, don't silently stall
                // forever: go get another instead.
                console.log('[Firemaking] 🔥❌ no tinderbox in hand → bank');
                this.state = 'bank_walk';
                return;
            }

            // firemaking.rs2's [opheldu,tinderbox] -> light_logs_inv already
            // grants XP itself via stat_advance(firemaking, ...) inside
            // firemaking_success() once the ignite roll succeeds — do not
            // also credit it here (see wait_burn below).
            interactHeldOpU(player, inv, logId, slot, Items.TINDERBOX, o_slot);
            this.xpBeforeBurn = player.stats[PlayerStat.FIREMAKING];
            this.burnWaitTicks = 0;
            this.state = 'wait_burn';
            return;
        }

        // ───────────────── WAIT FOR BURN RESULT ─────────────────
        // The real script rolls for success on a delay (~3-4 ticks) and keeps
        // retrying itself automatically (p_opobj(4)) if it misses, so this
        // polls for real XP instead of crediting immediately.
        if (this.state === 'wait_burn') {
            if (player.stats[PlayerStat.FIREMAKING] > this.xpBeforeBurn) {
                this.lastXp = player.stats[PlayerStat.FIREMAKING];
                this.watchdog.notifyActivity();
                console.log(`[Firemaking] 🔥 log burned (real XP confirmed, total=${this.lastXp})`);
                this.cooldown = randInt(2, 12);
                this.state = 'move';
                return;
            }

            this.burnWaitTicks++;
            if (this.burnWaitTicks > 8) {
                // Real stat_advance never landed in time (e.g. the ignite roll
                // kept failing, or the interaction never queued). No manual
                // credit — trust the real script the same way a real player
                // would get nothing for a failed/incomplete attempt. The log
                // was already dropped by light_logs_inv regardless, so just
                // move on and try the next one.
                console.log('[Firemaking] 🔥 no XP confirmed in time — moving on');
                this.cooldown = randInt(2, 12);
                this.state = 'move';
            }
            return;
        }

        // ───────────────── MOVE ─────────────────

        if (this.state === 'move') {
            walkTo(
                player,
                player.x + randInt(-1, 1),
                player.z + randInt(-1, 1)
            );

            this.state = 'burn';
            return;
        }
    }

    // ───────────────── RESET ─────────────────

    private resetLoop(): void {
        this.state = 'walk';
        this.cooldown = 0;
        this.lastXp = 0;
        this.bankLocked = false;
        this.shopWaitTicks = 0;
        this.xpBeforeBurn = 0;
        this.burnWaitTicks = 0;

        this.stuck.reset();
        this.watchdog.reset();
    }

    override reset(): void {
        super.reset();
        this.resetLoop();
    }

    // ───────────────── STUCK HANDLER ─────────────────

    private _stuckWalk(player: Player, x: number, z: number): void {
        if (!this.stuck.check(player, x, z)) {
            walkTo(player, x, z);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            console.log(`[Firemaking] 🌀 teleport escape`);
            teleportNear(player, x, z);
            this.stuck.reset();
            return;
        }

        if (openNearbyGate(player, 5)) return;

        walkTo(
            player,
            player.x + randInt(-10, 10),
            player.z + randInt(-10, 10)
        );
    }

    isComplete(): boolean {
        return false;
    }
}

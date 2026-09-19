/**
 * CookingTask.ts — Withdraw raw fish from bank, cook on range, deposit cooked fish, repeat.
 *
 * Only starts when the bank holds at least MIN_FISH raw fish for the current
 * progression step. Once started, it cooks until the bank is empty, then
 * signals isComplete() so the planner can pick a new task (e.g. FishingTask
 * to replenish supplies).
 */

import {
    BotTask, Player, Loc, InvType,
    walkTo, interactUseLocOp,
    findLocByName, findLocByPrefix,
    hasItem, countItem, isNear,
    getBaseLevel, PlayerStat,
    Items, getProgressionStep,
    teleportNear, randInt, bankInvId,
    StuckDetector, ProgressWatchdog,
    openNearbyGate, botJitter, advanceBankWalk,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';

/** Minimum raw fish in bank required to start a cooking session. */
const MIN_FISH = 1;

/**
 * Ticks to wait after firing each cook action before retrying.
 * Must exceed: walk-to-adjacent (0–2) + OPLOCU fire (1) + cooking delay (4 ticks for shrimp).
 * Total worst case ≈ 7 ticks.  Use 6–10 to be safe without being unnecessarily slow.
 */
const COOK_COOLDOWN_MIN = 6;
const COOK_COOLDOWN_MAX = 10;

/** Consecutive failed cook attempts before walking closer to the range. */
const COOK_FAIL_LIMIT = 6;

export class CookingTask extends BotTask {
    private step: SkillStep;

    private state: 'bank_walk' | 'withdraw' | 'cook_walk' | 'cook' | 'bank_return' = 'bank_walk';

    private lastXp = 0;
    private cookFailTicks = 0;
    private done = false; // set true when bank runs out of fish

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Cook');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    private debug(player: Player, message: string): void {
        console.log(`[CookingTask][${player.username}][${this.state}] ${message}`);
    }

    // ── Task lifecycle ────────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        const fishId = this.step.itemConsumed;
        if (!fishId) {
            
            return false;
        }

        // Count fish in bank AND in carried inventory — the task banks everything
        // on its first step (bank_walk), so fish in the backpack are just as good.
        const bankCount = this._bankFishCount(player, fishId);
        const invCount  = countItem(player, fishId);
        const count     = bankCount + invCount;
        const should    = count >= MIN_FISH;

        this.debug(player, `shouldRun check: fishId=${fishId}, bankCount=${bankCount}, invCount=${invCount}, total=${count}, min=${MIN_FISH}, result=${should}`);
        return should;
    }

    isComplete(_player: Player): boolean {
        // Planner will pick next task when fish runs out or task was interrupted.
        return this.done;
    }

    tick(player: Player): void {
        if (this.interrupted) {
            this.debug(player, 'Tick skipped because task is interrupted');
            return;
        }

        const banking =
            this.state === 'bank_walk' ||
            this.state === 'withdraw' ||
            this.state === 'bank_return';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.debug(player, 'Watchdog triggered; teleported to destination, resuming');
            this.stuck.reset();
            this.state = 'cook_walk';
            this.cookFailTicks = 0;
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ── Progression upgrade ───────────────────────────────────────────────
        const level = getBaseLevel(player, PlayerStat.COOKING);
        const newStep = getProgressionStep('COOKING', level);
        if (newStep && newStep.minLevel > this.step.minLevel) {
            this.debug(player, `Progression upgrade detected: level=${level}, newMinLevel=${newStep.minLevel}`);
            this.step = newStep;

            // Wrong fish tier might be in inventory — go back to bank
            if (this.state === 'cook' || this.state === 'cook_walk') {
                this.debug(player, 'Switching to bank_return because current fish tier changed');
                this.state = 'bank_return';
            }
        }

        // ── Bank walk (initial deposit run + after each inventory) ─────────────
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

        // ── Withdraw raw fish from bank ────────────────────────────────────────
        if (this.state === 'withdraw') {
            const fishId = this.step.itemConsumed;
            if (!fishId) {
                this.debug(player, 'No fishId found on step during withdraw; interrupting');
                this.interrupt();
                return;
            }

            // Deposit cooked / burnt fish (raw fish are kept by _depositCooked)

            this._depositCooked(player);

            // Open the bank exit door before transitioning to cook_walk.
            // Bots teleported inside the bank find the door closed and can't
            // exit — this ensures the door is open when we start walking out.
            openNearbyGate(player, 5);

            // If raw fish are already in inventory (bot just arrived from fishing without
            // banking first), skip the bank-withdrawal step entirely — go cook what we have.
            const invFish = countItem(player, fishId);
            if (invFish > 0) {
                this.state = 'cook_walk';
                this.cooldown = 1;
                
                return;
            }

            // No fish in inventory — try to pull from bank
            const bankCount = this._bankFishCount(player, fishId);
            this.debug(player, `Bank fish count for item ${fishId}: ${bankCount}`);
            if (bankCount === 0) {
                this.debug(player, 'Bank is out of fish; marking task complete');
                this.done = true;
                this.interrupt();
                return;
            }

            this._withdrawFish(player, fishId);
            this.state = 'cook_walk';
            this.cooldown = 1;
            
            return;
        }

        // ── Walk to range ──────────────────────────────────────────────────────
        if (this.state === 'cook_walk') {
            const [lx, lz, ll] = this.step.location;
            if (!isNear(player, lx, lz, 1, ll)) {
                // Radius 1: bot must be truly adjacent to the range before we try to cook.
                // This ensures the bot is on the correct side of any curtain/door — it can't
                // "see" the range through a wall and prematurely enter cook state.
                // _stuckWalk → StuckDetector fires after 30 ticks → openNearbyGate → curtain
                // opens → bot navigates inside and reaches radius 1.
                // No jitter — must reach the exact tile in front of the range.
                // Jitter would scatter the bot to adjacent tiles where the range
                // interaction doesn't fire (wrong side / not directly in front).
                const [jx, jz] = botJitter(player, lx, lz, 0);
                
                this._stuckWalk(player, jx, jz);
                return;
            }

            this.state = 'cook';
            this.cookFailTicks = 0;
            this.lastXp = player.stats[PlayerStat.COOKING];
            this.debug(player, `Reached range area; state changed to cook, lastXp=${this.lastXp}`);
            return;
        }

        // ── Cook ──────────────────────────────────────────────────────────────
        if (this.state === 'cook') {
            const fishId = this.step.itemConsumed;
            if (!fishId) {
                this.debug(player, 'No fishId found on step during cook; switching to bank_return');
                this.state = 'bank_return';
                return;
            }

            // All raw fish cooked/burnt — return to bank for more
            if (!hasItem(player, fishId)) {
                this.debug(player, `Player no longer has fish ${fishId}; switching to bank_return`);
                this.state = 'bank_return';
                return;
            }

            // Find nearby range (or fire)
            const range = this._findRange(player);
            if (!range) {
                const [lx, lz] = this.step.location;
                this.debug(player, `No range found nearby; walking toward step location ${lx}, ${lz}`);
                this._stuckWalk(player, lx, lz);
                return;
            }

            const slot = this._getItemSlot(player, fishId);
            if (slot === null) {
                this.debug(player, `Could not find fish ${fishId} in inventory slot list; switching to bank_return`);
                this.state = 'bank_return';
                return;
            }

            this.debug(player, `Attempting cook interaction on range at ${range.x}, ${range.z}, item=${fishId}, slot=${slot}`);
            const ok = interactUseLocOp(player, range, fishId, slot);

            if (ok) {
                const currentXp = player.stats[PlayerStat.COOKING];
                const gained = currentXp - this.lastXp;
                this.lastXp = currentXp;

                this.cookFailTicks = 0;
                this.cooldown = randInt(COOK_COOLDOWN_MIN, COOK_COOLDOWN_MAX);

                // Only reset the stall watchdog when XP actually arrives.
                // Calling notifyActivity() on every sent interaction (xpGain=0) would
                // prevent the watchdog from ever rescuing a bot that is stuck outside
                // the range (e.g. blocked by a curtain) firing interactions that the
                // server silently rejects.
                if (gained > 0) {
                    this.watchdog.notifyActivity();
                }

                this.debug(player, `Cook action sent successfully; xpGain=${gained}, cooldown=${this.cooldown}`);
            } else {
                // Player delayed or out of range — retry shortly
                this.cookFailTicks++;
                this.debug(player, `Cook interaction failed; cookFailTicks=${this.cookFailTicks}/${COOK_FAIL_LIMIT}`);

                if (this.cookFailTicks >= COOK_FAIL_LIMIT) {
                    // Try to open any blocking curtain or gate, then walk directly to range.
                    // Curtains (loc_1528 "Open" op) are handled by openNearbyGate's keyword logic.
                    this.debug(player, `Failed too many times; opening nearby gate/curtain and walking to range ${range.x}, ${range.z}`);
                    openNearbyGate(player, 8);
                    walkTo(player, range.x, range.z);
                    this.cookFailTicks = 0;
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
        this.cookFailTicks = 0;
        this.done = false;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Find any cooking range or fire within 2 tiles.
     * Small radius ensures the bot is truly adjacent before attempting the interaction —
     * a 10-tile search would find the palace range through a wall, letting the bot
     * "cook" from outside the curtain without the server ever accepting the action.
     */
    private _findRange(player: Player): Loc | null {
        // Lumbridge Cook-o-matic (cooksquestrange) — special named range
        const named = findLocByName(player.x, player.z, player.level, 'cooksquestrange', 2);
        if (named) {
            this.debug(player, `Found named range at ${named.x}, ${named.z}, level=${named.level}`);
            return named;
        }

        // Generic ranges (loc_2728 – loc_2731) and fireplaces (loc_2724 – loc_2727)
        const generic = findLocByPrefix(player.x, player.z, player.level, 'loc_272', 2);
        if (generic) {
            this.debug(player, `Found generic cooking loc at ${generic.x}, ${generic.z}, level=${generic.level}`);
            return generic;
        }

        this.debug(player, 'No cooking range/fire found within 2 tiles');
        return null;
    }

    /** Returns the inventory slot of the given item, or null if not found. */
    private _getItemSlot(player: Player, itemId: number): number | null {
        const inv = player.getInventory(InvType.INV);
        if (!inv) {
            this.debug(player, 'Inventory not available while resolving item slot');
            return null;
        }

        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)?.id === itemId) return i;
        }

        this.debug(player, `Item ${itemId} not found in inventory`);
        return null;
    }

    /** Total stack of fishId in the bank. */
    private _bankFishCount(player: Player, fishId: number): number {
        const bid = bankInvId();
        if (bid === -1) return 0;

        const bank = player.getInventory(bid);
        if (!bank) return 0;

        let count = 0;
        for (let i = 0; i < bank.capacity; i++) {
            const item = bank.get(i);
            if (item?.id === fishId) count += item.count;
        }
        return count;
    }

    /**
     * Withdraw up to one full inventory of raw fish from the bank.
     * Assumes the bot is already at the bank (inventory access is direct).
     */
    private _withdrawFish(player: Player, fishId: number): void {
        const bid = bankInvId();
        if (bid === -1) {
            this.debug(player, 'Cannot withdraw fish: bankInvId() returned -1');
            return;
        }

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) {
            this.debug(player, 'Cannot withdraw fish: bank or inventory is unavailable');
            return;
        }

        // Find fish in bank and withdraw up to 28
        for (let i = 0; i < bank.capacity; i++) {
            const item = bank.get(i);
            if (!item || item.id !== fishId) continue;

            const toWithdraw = Math.min(item.count, 28);
            const moved = bank.remove(fishId, toWithdraw);
            if (moved.completed > 0) {
                inv.add(fishId, moved.completed);
                this.debug(player, `Withdrew ${moved.completed}/${toWithdraw} fish ${fishId} from bank slot ${i}`);
            } else {
                this.debug(player, `Attempted to withdraw fish ${fishId} but nothing moved`);
            }
            break;
        }
    }

    /**
     * Deposit everything in inventory except raw fish and coins back to bank.
     * Called on each return trip — clears cooked fish, burnt fish, etc.
     */
    private _depositCooked(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) {
            this.debug(player, 'Cannot deposit cooked items: bankInvId() returned -1');
            return;
        }

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) {
            this.debug(player, 'Cannot deposit cooked items: bank or inventory is unavailable');
            return;
        }

        const rawFishId = this.step.itemConsumed;
        let deposited = 0;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (rawFishId && item.id === rawFishId) continue; // keep raw fish
            if (item.id === Items.COINS) continue; // keep coins

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
                deposited += moved.completed;
                this.debug(player, `Deposited ${moved.completed} of item ${item.id} from inventory slot ${slot}`);
            }
        }

        this.debug(player, `Deposit sweep complete; total deposited=${deposited}`);
    }

    /** Stuck-aware walk with gate opening and teleport escape. */
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
            // Handles standard gates, toll gates, AND curtains (loc_1528 "Open" op).
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

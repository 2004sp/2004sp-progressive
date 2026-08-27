/**
 * BowStringingTask.ts
 *
 * Strings unstrung bows (from FletchingTask's log cutting) with bow strings
 * (from CraftingTask's spin_flax) into finished bows.
 *
 * Real content script: skill_fletching/scripts/bows.rs2 —
 *   [opheldu,_unstrung_bow] / [opheldu,bow_string] — a plain item-on-item
 *   interaction with NO dialog/interface involved (unlike log cutting's
 *   makeX dialog), so the real inv_del/inv_add/stat_advance() always fires
 *   for a headless bot. No manual XP or item simulation needed here.
 *
 * State machine:
 *   bank_walk → withdraw (bank finished bows, pull unstrung bows + bow
 *   strings) → string (use item-on-item until either material runs out)
 *   → back to bank_walk. Completes (isComplete) once neither material is
 *   available anywhere, so BotGoalPlanner is re-consulted instead of the
 *   task idling forever on an empty bank.
 */

import {
    BotTask,
    Player,
    InvType,
    hasItem,
    countItem,
    bankInvId,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    advanceBankWalk,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { interactHeldOpU } from '#/engine/bot/BotAction.js';
import { Items } from '#/engine/bot/BotKnowledge.js';

/** Withdraw/string this many of each material per bank trip. */
const WITHDRAW_BATCH = 27;
/** Consecutive failed interaction attempts before giving up on a bank trip. */
const FAIL_LIMIT = 6;

type StringState = 'bank_walk' | 'withdraw' | 'string';

export class BowStringingTask extends BotTask {
    private readonly step: SkillStep;
    private readonly unstrungId: number;
    private readonly stringId: number;

    private state: StringState = 'bank_walk';
    private failTicks = 0;
    private lastCount = 0;
    private done = false;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('BowStringing');
        this.step = step;
        this.unstrungId = step.itemConsumed!;
        this.stringId = (step.extra?.stringItem as number | undefined) ?? Items.BOW_STRING;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        return hasItem(player, this.unstrungId) || this._bankHas(player, this.unstrungId);
    }

    isComplete(_player: Player): boolean {
        return this.done;
    }

    override reset(): void {
        super.reset();
        this.state = 'bank_walk';
        this.failTicks = 0;
        this.lastCount = 0;
        this.done = false;
        this.stuck.reset();
        this.watchdog.reset();
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'withdraw';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        switch (this.state) {
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.state = 'withdraw';
                return;
            }

            case 'withdraw': {
                this._withdraw(player);

                if (!hasItem(player, this.unstrungId) || !hasItem(player, this.stringId)) {
                    // Out of one of the two materials anywhere — nothing left
                    // to string. Stop so the planner re-checks what to do next
                    // (more log cutting, more flax spinning, or something else).
                    this.done = true;
                    this.interrupt();
                    return;
                }

                this.lastCount = countItem(player, this.step.itemGained!);
                this.state = 'string';
                return;
            }

            case 'string': {
                if (!hasItem(player, this.unstrungId) || !hasItem(player, this.stringId)) {
                    this.state = 'bank_walk';
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const unstrungSlot = this._findSlot(player, this.unstrungId);
                const stringSlot = this._findSlot(player, this.stringId);
                if (unstrungSlot === -1 || stringSlot === -1) {
                    this.state = 'bank_walk';
                    return;
                }

                const ok = interactHeldOpU(player, inv, this.stringId, stringSlot, this.unstrungId, unstrungSlot);

                const current = countItem(player, this.step.itemGained!);
                if (current > this.lastCount) {
                    // bows.rs2 grants Fletching XP via stat_advance() server-side
                    // with no interface involved — do not also credit it here.
                    this.watchdog.notifyActivity();
                    this.lastCount = current;
                    this.failTicks = 0;
                    this.cooldown = randInt(2, 3);
                    return;
                }

                if (ok) {
                    this.cooldown = 1;
                    return;
                }

                this.failTicks++;
                if (this.failTicks >= FAIL_LIMIT) {
                    this.state = 'bank_walk';
                    this.failTicks = 0;
                }
                return;
            }
        }
    }

    private _withdraw(player: Player): void {
        const bid = bankInvId();
        const inv = player.getInventory(InvType.INV);
        const bank = bid !== -1 ? player.getInventory(bid) : null;
        if (!inv || !bank) return;

        // Bank finished bows from the previous cycle before withdrawing more.
        const finishedId = this.step.itemGained!;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item?.id === finishedId) {
                const moved = inv.remove(item.id, item.count);
                if (moved.completed > 0) bank.add(item.id, moved.completed);
            }
        }

        if (!hasItem(player, this.unstrungId)) {
            for (let i = 0; i < bank.capacity; i++) {
                if (bank.get(i)?.id === this.unstrungId) {
                    const moved = bank.remove(this.unstrungId, WITHDRAW_BATCH);
                    inv.add(this.unstrungId, moved.completed);
                    break;
                }
            }
        }
        if (!hasItem(player, this.stringId)) {
            for (let i = 0; i < bank.capacity; i++) {
                if (bank.get(i)?.id === this.stringId) {
                    const moved = bank.remove(this.stringId, WITHDRAW_BATCH);
                    inv.add(this.stringId, moved.completed);
                    break;
                }
            }
        }
    }

    private _bankHas(player: Player, itemId: number): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === itemId) return true;
        }
        return false;
    }

    private _findSlot(player: Player, itemId: number): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)?.id === itemId) return i;
        }
        return -1;
    }
}

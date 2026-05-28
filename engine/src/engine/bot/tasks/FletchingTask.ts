/**
 * FletchingTask.ts
 *
 * Fletching task: use knife on logs to create arrow shafts or unstrung bows.
 * Runs near the bank (outside) for easy deposit of finished products.
 *
 * State flow:
 *   bank_walk → withdraw_logs → fletch → bank_deposit → repeat
 *
 * Uses interactHeldOpU to use knife (held item) on logs (used item).
 */

import {
    BotTask,
    Player,
    walkTo,
    removeItem,
    hasItem,
    countItem,
    addItem,
    addXp,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    InvType,
    bankInvId,
    teleportNear,
    nearestBank,
    advanceBankWalk
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/BotKnowledge.js';
import { interactHeldOpU, interactIfButtonByName } from '#/engine/bot/BotAction.js';

type FletchState = 'bank_walk' | 'withdraw_logs' | 'fletch' | 'fletch_dialog' | 'bank_deposit' | 'withdraw_unstrung' | 'perform_stringing';

const FAIL_LIMIT = 6;
const BATCH_SIZE = 27;

export class FletchingTask extends BotTask {
    private readonly step: SkillStep;
    private state: FletchState = 'bank_walk';

    private failTicks = 0;
    private lastCount = 0;
    private bankLocked = false;
    /** Ticks spent waiting for the dialog to open after interactHeldOpU. */
    private dialogWaitTicks = 0;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Fletching');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        // Knife must be accessible (inventory or bank — withdrawn during bank step).
        // The 50-log minimum is enforced by the planner before this task is created,
        // so we don't re-check it here to avoid spurious shouldRun failures mid-run.
        if (!hasItem(player, Items.KNIFE) && !this._knifeInBank(player)) return false;
        return true;
    }

    isComplete(_player: Player): boolean {
        return false;
    }

    reset(): void {
        super.reset();
        this.state = 'bank_walk';
        this.failTicks = 0;
        this.lastCount = 0;
        this.bankLocked = false;
        this.dialogWaitTicks = 0;
        this.stuck.reset();
        this.watchdog.reset();
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'withdraw_logs' || this.state === 'bank_deposit';

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

        this._tick(player);
    }

    private _tick(player: Player): void {
        switch (this.state) {
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.state = 'withdraw_logs';
                return;
            }

            case 'withdraw_logs': {
                // Withdraw knife from bank if it somehow ended up there
                if (!hasItem(player, Items.KNIFE)) {
                    this._withdrawKnife(player);
                }

                if (this.step.action.startsWith('string_')) {
                    this.state = 'withdraw_unstrung';
                    return;
                }

                const logId = this.step.itemConsumed!;
                const withdrawn = this._withdrawLogs(player, logId);
                if (!withdrawn) {
                    console.log(`[FletchingTask][${player.username}] No logs to withdraw — done`);
                    this.interrupt();
                    return;
                }
                this.state = 'fletch';
                this.lastCount = 0;
                return;
            }

            case 'withdraw_unstrung': {
                const unstrungId = this.step.itemConsumed!;
                const stringId = (this.step.extra?.stringItem as number) ?? Items.BOW_STRING;

                const bid = bankInvId();
                if (bid === -1) { this.interrupt(); return; }
                const bank = player.getInventory(bid);
                const inv = player.getInventory(InvType.INV);
                if (!bank || !inv) { this.interrupt(); return; }

                // Withdraw strings (14) and unstrung bows (14)
                let stringsWithdrawn = countItem(player, stringId);
                let unstrungWithdrawn = countItem(player, unstrungId);

                if (stringsWithdrawn < 14) {
                    const moved = bank.remove(stringId, 14 - stringsWithdrawn);
                    inv.add(stringId, moved.completed);
                    stringsWithdrawn += moved.completed;
                }

                if (unstrungWithdrawn < 14) {
                    const moved = bank.remove(unstrungId, 14 - unstrungWithdrawn);
                    inv.add(unstrungId, moved.completed);
                    unstrungWithdrawn += moved.completed;
                }

                if (stringsWithdrawn === 0 || unstrungWithdrawn === 0) {
                    this.interrupt();
                    return;
                }

                this.state = 'perform_stringing';
                return;
            }

            case 'perform_stringing': {
                const unstrungId = this.step.itemConsumed!;
                const stringId = (this.step.extra?.stringItem as number) ?? Items.BOW_STRING;

                if (countItem(player, unstrungId) === 0 || countItem(player, stringId) === 0) {
                    this.state = 'bank_deposit';
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const unstrungSlot = this._findItemSlot(player, unstrungId);
                const stringSlot = this._findItemSlot(player, stringId);

                if (unstrungSlot === -1 || stringSlot === -1) {
                    this.state = 'bank_deposit';
                    return;
                }

                const ok = interactHeldOpU(player, inv, unstrungId, unstrungSlot, stringId, stringSlot);
                if (ok) {
                    this.watchdog.notifyActivity();
                    this.cooldown = randInt(2, 4);
                }
                return;
            }

            case 'fletch': {
                if (!this.hasLogs(player)) {
                    this.state = 'bank_deposit';
                    return;
                }

                const [bx, bz, bl] = nearestBank(player);
                if (!isNear(player, bx, bz, 8, bl)) {
                    this._stuckWalk(player, bx, bz);
                    return;
                }

                const logId = this.step.itemConsumed!;
                const knifeSlot = this._findKnifeSlot(player);
                if (knifeSlot === -1) {
                    console.log(`[FletchingTask][${player.username}] No knife found — done`);
                    this.interrupt();
                    return;
                }

                const logSlot = this._findLogSlot(player, logId);
                if (logSlot === -1) {
                    this.state = 'bank_deposit';
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const ok = interactHeldOpU(player, inv, logId, logSlot, Items.KNIFE, knifeSlot);
                if (ok) {
                    // Server will suspend on p_pausebutton waiting for a menu choice.
                    // Give it 1 tick to process, then click the right dialog button.
                    this.dialogWaitTicks = 0;
                    this.state = 'fletch_dialog';
                    this.cooldown = 1;
                } else {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        const [nx, nz] = this._nearbyTile(player, bx, bz);
                        walkTo(player, nx, nz);
                        this.failTicks = 0;
                    }
                }
                return;
            }

            case 'fletch_dialog': {
                // The server opened a multiobj choice dialog and is paused waiting
                // for the player to click which product to make.  We find the correct
                // resume-button component for this step and simulate the click.
                const comName = this._dialogComponent();
                const clicked = comName ? interactIfButtonByName(player, comName) : false;

                if (clicked) {
                    // Script resumed — log removed, product added, XP granted.
                    const current = countItem(player, this.step.itemGained!);
                    if (current > this.lastCount) {
                        this.watchdog.notifyActivity();
                        this.failTicks = 0;
                    }
                    this.lastCount = current;
                    this.failTicks = 0;
                    this.dialogWaitTicks = 0;
                    this.state = 'fletch';
                    this.cooldown = randInt(2, 4);
                } else {
                    // Dialog not open yet or component lookup failed.
                    this.dialogWaitTicks++;
                    if (this.dialogWaitTicks >= 5) {
                        // Server has no handler or dialog never opened — simulate manually.
                        console.log(`[FletchingTask][${player.username}] dialog timeout, simulating manually`);
                        this._fletchManually(player);
                        this.dialogWaitTicks = 0;
                        this.state = 'fletch';
                        this.cooldown = randInt(2, 4);
                    }
                    // else wait another tick
                }
                return;
            }

            case 'bank_deposit': {
                this._depositProducts(player);
                this.state = 'bank_walk';
                return;
            }
        }
    }

    private _withdrawLogs(player: Player, logId: number): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return false;

        let withdrawn = false;
        for (let i = 0; i < bank.capacity; i++) {
            const item = bank.get(i);
            if (!item || item.id !== logId) continue;

            let space = 0;
            for (let j = 0; j < inv.capacity; j++) {
                if (inv.get(j) === null) space++;
            }

            const toTake = Math.min(item.count, BATCH_SIZE);
            if (space <= 0) break;

            const actual = Math.min(toTake, space);
            if (actual <= 0) break;

            const removed = bank.remove(logId, actual);
            if (removed.completed > 0) {
                inv.add(logId, removed.completed);
                withdrawn = true;
            }
            if (removed.completed >= BATCH_SIZE) break;
        }

        return withdrawn;
    }

    private _depositProducts(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        const keepIds = new Set<number>([Items.COINS, Items.KNIFE]);
        // Keep logs if we are fletching them
        if (this.step.itemConsumed && !this.step.action.startsWith('string_')) {
            keepIds.add(this.step.itemConsumed);
        }
        // Keep strings and unstrung bows if we are stringing
        if (this.step.action.startsWith('string_')) {
            if (this.step.itemConsumed) keepIds.add(this.step.itemConsumed);
            if (this.step.extra?.stringItem) keepIds.add(this.step.extra.stringItem as number);
        }

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || keepIds.has(item.id)) continue;

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
            }
        }
    }

    private hasLogs(player: Player): boolean {
        const logId = this.step.itemConsumed!;
        return countItem(player, logId) > 0;
    }

    private _findKnifeSlot(player: Player): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;

        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === Items.KNIFE) return i;
        }
        return -1;
    }

    private _findLogSlot(player: Player, logId: number): number {
        return this._findItemSlot(player, logId);
    }

    private _findItemSlot(player: Player, itemId: number): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;

        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === itemId) return i;
        }
        return -1;
    }

    /** Total logs of given type across inventory + bank. */
    private _totalLogs(player: Player, logId: number): number {
        let total = countItem(player, logId);
        const bid = bankInvId();
        if (bid === -1) return total;
        const bank = player.getInventory(bid);
        if (!bank) return total;
        for (let i = 0; i < bank.capacity; i++) {
            const it = bank.get(i);
            if (it?.id === logId) total += it.count;
        }
        return total;
    }

    /** True if a knife exists in the bank (inventory checked separately via hasItem). */
    private _knifeInBank(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === Items.KNIFE) return true;
        }
        return false;
    }

    /** Withdraw one knife from the bank into inventory. */
    private _withdrawKnife(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        const inv  = player.getInventory(InvType.INV);
        if (!bank || !inv) return;
        for (let i = 0; i < bank.capacity; i++) {
            const it = bank.get(i);
            if (it?.id !== Items.KNIFE) continue;
            const removed = bank.remove(Items.KNIFE, 1);
            if (removed.completed > 0) addItem(player, Items.KNIFE, 1);
            break;
        }
    }

    /**
     * Maps the current step action to the resume-button component name that the
     * server's multiobj dialog registers via if_addresumebutton.
     *
     * Regular logs  → multiobj3_close  (3 options: shafts / shortbow / longbow)
     * Oak/Willow    → multiobj2        (2 options: shortbow / longbow)
     */
    private _dialogComponent(): string {
        switch (this.step.action) {
            case 'fletch_shaft':           return 'multiobj3_close:com_1'; // arrow shafts (option 1)
            case 'fletch_shortbow':        return 'multiobj3_close:com_2'; // shortbow     (option 2)
            case 'fletch_longbow':         return 'multiobj3_close:com_3'; // longbow      (option 3)
            case 'fletch_oak_shortbow':    return 'multiobj2:objtext1';    // shortbow     (option 1)
            case 'fletch_oak_longbow':     return 'multiobj2:objtext2';    // longbow      (option 2)
            case 'fletch_willow_shortbow': return 'multiobj2:objtext1';    // shortbow     (option 1)
            case 'fletch_willow_longbow':  return 'multiobj2:objtext2';    // longbow      (option 2)
            case 'fletch_maple_shortbow':  return 'multiobj2:objtext1';    // shortbow     (option 1)
            case 'fletch_maple_longbow':   return 'multiobj2:objtext2';    // longbow      (option 2)
            case 'fletch_yew_shortbow':    return 'multiobj2:objtext1';    // shortbow     (option 1)
            case 'fletch_yew_longbow':     return 'multiobj2:objtext2';    // longbow      (option 2)
            case 'fletch_magic_shortbow':  return 'multiobj2:objtext1';    // shortbow     (option 1)
            case 'fletch_magic_longbow':   return 'multiobj2:objtext2';    // longbow      (option 2)
            default: return '';
        }
    }

    /**
     * Manual fallback: remove one log and add the product directly, with XP.
     * Used when the server has no fletching handler or the dialog never opened.
     */
    private _fletchManually(player: Player): void {
        const logId     = this.step.itemConsumed!;
        const productId = this.step.itemGained!;
        // Arrow shafts yield multiple per log (stored in step.extra.productCount)
        const count = (this.step.extra?.productCount as number | undefined) ?? 1;

        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        if (this._findLogSlot(player, logId) === -1) return;

        removeItem(player, logId, 1);
        addItem(player, productId, count);
        addXp(player, PlayerStat.FLETCHING, this.step.xpPerAction);

        this.watchdog.notifyActivity();
        this.failTicks = 0;
        this.lastCount = countItem(player, productId);
    }

    private _nearbyTile(player: Player, bx: number, bz: number): [number, number] {
        const dx = player.x - bx;
        const dz = player.z - bz;

        if (Math.abs(dx) > Math.abs(dz)) {
            return [player.x + (dx > 0 ? 5 : -5), player.z];
        } else {
            return [player.x, player.z + (dz > 0 ? 5 : -5)];
        }
    }

    private _stuckWalk(player: Player, lx: number, lz: number): void {
        if (!this.stuck.check(player, lx, lz)) {
            walkTo(player, lx, lz);
            return;
        }
        if (this.stuck.desperatelyStuck) {
            teleportNear(player, lx, lz);
            this.stuck.reset();
            return;
        }
        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }
}

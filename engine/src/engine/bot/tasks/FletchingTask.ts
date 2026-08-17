/**
 * FletchingTask.ts
 *
 * Self-contained fletching loop — no bank visit required before starting:
 *
 *   woodcut_walk     walk to the correct tree area for this log type
 *   woodcut_approach find a tree, walk adjacent
 *   woodcut_chop     chop until inventory is full of logs
 *   fletch           use knife on logs in place (no need to be at a bank)
 *   fletch_dialog    click the real make-x dialog (multiobj3_fletch / multiobj2_fletch)
 *   bank_walk        walk to nearest bank
 *   bank_deposit     deposit fletched products; keep logs, knife, hatchet
 *   (repeat)
 *
 * The server registers fletching as [opheldu,_category_22] (logs' category) but
 * cutting_fruit.rs2 also registers an exact-match [opheldu,knife] script whose
 * default case forwards to the same @fletch_log label when oc_category matches
 * category_22 — so the real script always fires correctly for knife-on-logs.
 * The dialog it opens depends on NODE_FEATURE_MAKEX (see .env, default true):
 * `multiobj3_fletch`/`multiobj2_fletch` when enabled, or plain `multiobj3`/
 * `multiobj2` when disabled — each with different resume-button component
 * names (see _dialogComponent). The bot reads the same env flag at runtime
 * (_makexEnabled) so it always predicts the interface actually opened.
 *
 * Bow stringing (unstrung bow + bow string → finished bow) is a separate
 * workflow that doesn't involve log acquisition — see BowStringingTask.ts,
 * routed to by BotGoalPlanner._findStringingTask().
 */

import LocType from '#/cache/config/LocType.js';
import {
    BotTask, Player, Loc, InvType,
    walkTo, interactLoc, findLocByPrefix, findLocByPrefixWhere,
    claimLoc, releaseLoc, isLocClaimed,
    hasItem, countItem, addItem, removeItem, addXp,
    isInventoryFull, isNear, isAdjacentToLoc,
    getBaseLevel, PlayerStat,
    Items, Locations, randInt,
    bankInvId, teleportNear, advanceBankWalk,
    INTERACT_TIMEOUT, StuckDetector, ProgressWatchdog, botJitter, hasStrayItems,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/BotKnowledge.js';
import { getWoodcuttingStepForLog, bestLogForWoodcutting, getBestFletchStepForLog } from '#/engine/bot/BotKnowledge.js';
import { getCombatLevel, getNpcCombatLevel, findAggressorNpc, interactHeldOpU, interactIfButtonByName } from '#/engine/bot/BotAction.js';
import { tryParseBoolean } from '#/util/TryParse.js';

const FAIL_LIMIT = 6;

/** Draynor village woodcutting spots — aggressive Dark Wizards patrol here, minimum combat 15. */
const DRAYNOR_WC_LOCATIONS: Array<[number, number, number]> = [
    Locations.WILLOWS_DRAYNOR,
];

type FletchState =
    | 'woodcut_walk'
    | 'woodcut_approach'
    | 'woodcut_chop'
    | 'fletch'
    | 'fletch_dialog'
    | 'bank_walk'
    | 'bank_deposit';

export class FletchingTask extends BotTask {
    private step: SkillStep;

    private state: FletchState = 'woodcut_walk';

    // woodcut sub-state
    private wcStep: SkillStep | null = null;
    private currentTree: Loc | null = null;
    private approachTicks = 0;
    private woodcutTicks = 0;
    private lastWcXp = 0;
    private scanFailTicks = 0;
    private fleeTicks      = 0;
    private readonly FLEE_TICKS = 12;

    // fletch sub-state
    private dialogWaitTicks = 0;
    private failTicks = 0;
    private lastCount = 0;

    private readonly stuck    = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Fletching');
        this.step = step;
    }

    shouldRun(player: Player): boolean {
        const hasHatchetInv  = this.step.toolItemIds.some(id => hasItem(player, id));
        const hasHatchetBank = !hasHatchetInv && this._hatchetInBank(player);
        if (!hasHatchetInv && !hasHatchetBank) return false;

        if (!hasItem(player, Items.KNIFE) && !this._knifeInBank(player)) {
            console.log(`[Fletch:${player.username}] shouldRun=false: no knife`);
            return false;
        }

        // Draynor village has aggressive Dark Wizards — require combat level 15
        const [sx, sz, sl] = this.step.location;
        const isDraynor = DRAYNOR_WC_LOCATIONS.some(([lx, lz, ll]) => lx === sx && lz === sz && ll === sl);
        if (isDraynor && getCombatLevel(player) < 15) return false;

        return true;
    }

    private _hatchetInBank(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (this.step.toolItemIds.includes(bank.get(i)?.id ?? -1)) return true;
        }
        return false;
    }

    isComplete(_player: Player): boolean {
        return false;
    }

    reset(): void {
        super.reset();
        this.state = 'woodcut_walk';
        this._resetWcState();
        this._resetFletchState();
        this.stuck.reset();
        this.watchdog.reset();
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_deposit';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            return;
        }

        if (this.cooldown > 0) { this.cooldown--; return; }

        // ── Hatchet recovery ─────────────────────────────────────────────────
        // If the hatchet was banked by another task, go retrieve it before chopping.
        if (!this.step.toolItemIds.some(id => hasItem(player, id)) && this._hatchetInBank(player)) {
            this.state = 'bank_walk';
        }

        // ── Aggressor detection ───────────────────────────────────────────────
        if (this.state !== 'bank_walk' && this.state !== 'bank_deposit' && this.state !== 'flee') {
            const aggressor = findAggressorNpc(player, 8);
            if (aggressor) {
                const npcLvl = getNpcCombatLevel(aggressor);
                if (npcLvl > player.combatLevel) {
                    this.state = 'flee';
                    this.fleeTicks = 0;
                    this._releaseTree();
                    return;
                }
            }
        }

        this._tick(player);
    }

    private _tick(player: Player): void {
        switch (this.state) {

            // ── Woodcutting phase ──────────────────────────────────────────────

            case 'woodcut_walk': {
                if (this._hasLogsInInv(player)) {
                    this.state = 'fletch';
                    return;
                }
                // Carrying leftovers from a previous task (e.g. ore, loot) — bank them
                // before heading out to the tree so the trip starts with a clean slate.
                if (hasStrayItems(player, [...this.step.toolItemIds, Items.COINS, Items.KNIFE])) {
                    this.state = 'bank_walk';
                    return;
                }
                this._reconcileStep(player);
                const wcLevel = getBaseLevel(player, PlayerStat.WOODCUTTING);
                this.wcStep = getWoodcuttingStepForLog(this.step.itemConsumed!, wcLevel);
                if (!this.wcStep) {
                    console.log(`[Fletch:${player.username}] no WC step for log ${this.step.itemConsumed} at wc=${wcLevel}`);
                    this.cooldown = 10;
                    return;
                }
                this.watchdog.destination = this.wcStep.location;
                const [lx, lz, ll] = this.wcStep.location;
                if (isNear(player, lx, lz, 15, ll)) {
                    this.state = 'woodcut_approach';
                    return;
                }
                const [jx, jz] = botJitter(player, lx, lz, 5);
                this._stuckWalk(player, jx, jz);
                return;
            }

            case 'woodcut_approach': {
                if (isInventoryFull(player)) {
                    this.state = 'fletch';
                    this._resetWcState();
                    return;
                }
                if (this.currentTree && !this._isTreeValid(this.currentTree)) {
                    this._releaseTree();
                    this.approachTicks = 0;
                }
                const tree = this.currentTree ?? this._findTree(player);
                if (!tree) {
                    this.scanFailTicks++;
                    if (this.scanFailTicks === 1) {
                        console.log(`[Fletch:${player.username}] No '${this._treePrefix()}' tree near (${player.x},${player.z})`);
                    }
                    if (this.scanFailTicks > 10) {
                        const [lx, lz] = this.wcStep!.location;
                        walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                        this.scanFailTicks = 0;
                    }
                    return;
                }
                this.scanFailTicks = 0;
                this.currentTree   = tree;
                claimLoc(tree);

                if (isAdjacentToLoc(player, tree)) {
                    interactLoc(player, tree);
                    this.state        = 'woodcut_chop';
                    this.woodcutTicks = 0;
                    this.lastWcXp     = player.stats[PlayerStat.WOODCUTTING];
                    this.approachTicks = 0;
                    this.watchdog.notifyActivity();
                } else {
                    const [tx, tz] = this._approachTile(player, tree);
                    walkTo(player, tx, tz);
                    this.approachTicks++;
                    if (this.approachTicks > 30) {
                        console.log(`[Fletch:${player.username}] Can't reach tree at (${tree.x},${tree.z}), retrying`);
                        this._releaseTree();
                        this.approachTicks = 0;
                    }
                }
                return;
            }

            case 'woodcut_chop': {
                if (isInventoryFull(player)) {
                    this.state = 'fletch';
                    this._resetWcState();
                    return;
                }
                if (this.currentTree && !this._isTreeValid(this.currentTree)) {
                    this.state        = 'woodcut_approach';
                    this._releaseTree();
                    this.woodcutTicks = 0;
                    return;
                }
                this.woodcutTicks++;
                if (player.stats[PlayerStat.WOODCUTTING] > this.lastWcXp) {
                    this.lastWcXp     = player.stats[PlayerStat.WOODCUTTING];
                    this.woodcutTicks = 0;
                    this.watchdog.notifyActivity();
                    if (this.currentTree) interactLoc(player, this.currentTree);
                    return;
                }
                if (this.woodcutTicks >= INTERACT_TIMEOUT) {
                    this.state        = 'woodcut_approach';
                    this._releaseTree();
                    this.woodcutTicks = 0;
                }
                return;
            }

            // ── Fletching phase ────────────────────────────────────────────────

            case 'fletch': {
                if (!this._hasLogsInInv(player)) {
                    this.state = 'bank_walk';
                    return;
                }
                if (!hasItem(player, Items.KNIFE)) {
                    // Knife is in bank — deposit trip will withdraw it
                    this.state = 'bank_walk';
                    return;
                }
                const logId    = this.step.itemConsumed!;
                const logSlot  = this._findSlot(player, logId);
                const knifeSlot = this._findSlot(player, Items.KNIFE);
                if (logSlot === -1 || knifeSlot === -1) { this.state = 'bank_walk'; return; }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                this.lastCount = countItem(player, this.step.itemGained!);
                const ok = interactHeldOpU(player, inv, logId, logSlot, Items.KNIFE, knifeSlot);
                if (ok) {
                    this.dialogWaitTicks = 0;
                    this.failTicks       = 0;
                    this.state           = 'fletch_dialog';
                    this.cooldown        = 1;
                } else {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this._fletchManually(player);
                        this.failTicks = 0;
                    }
                }
                return;
            }

            case 'fletch_dialog': {
                const comName = this._dialogComponent();
                if (comName) interactIfButtonByName(player, comName);

                const current = countItem(player, this.step.itemGained!);
                if (current > this.lastCount) {
                    // Real progress — the server script actually resumed and produced items.
                    this.watchdog.notifyActivity();
                    this.lastCount       = current;
                    this.failTicks       = 0;
                    this.dialogWaitTicks = 0;
                    this.state           = 'fletch';
                    this.cooldown        = randInt(2, 4);
                    return;
                }

                this.dialogWaitTicks++;
                if (this.dialogWaitTicks >= 5) {
                    // Dialog click didn't land (button not in resumeButtons, or no
                    // dialog was open) — fall back to a manual conversion so bots
                    // don't stall forever, but log it since it means the real
                    // server-side path is broken and needs another look.
                    console.log(`[Fletch:${player.username}] fletch_dialog timeout (comName=${comName}) — manual fallback`);
                    this._fletchManually(player);
                    this.dialogWaitTicks = 0;
                    this.state           = 'fletch';
                    this.cooldown        = randInt(2, 4);
                }
                return;
            }

            // ── Banking phase ──────────────────────────────────────────────────

            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.state    = 'bank_deposit';
                return;
            }

            case 'bank_deposit': {
                this._depositProducts(player);
                this._withdrawKnifeIfMissing(player);
                this._resetFletchState();
                this.state = 'woodcut_walk';
                return;
            }

            // ── Flee ──────────────────────────────────────────────────────────────
            case 'flee': {
                this.fleeTicks++;
                const [lx, lz] = this.step.location;
                this._stuckWalk(player, lx, lz);
                if (this.fleeTicks >= this.FLEE_TICKS || isNear(player, lx, lz, 12)) {
                    this.state = 'woodcut_walk';
                    this.fleeTicks = 0;
                }
                return;
            }
        }
    }

    // ── Woodcut helpers ──────────────────────────────────────────────────────────

    /**
     * The planner assigns this.step purely by Fletching level, but the log it
     * consumes also needs a matching Woodcutting level the bot may not have
     * yet (e.g. Fletching 90 qualifies for magic logs, but Woodcutting 20 can
     * only chop oak). Left alone, woodcut_walk would stall forever waiting
     * for a log the bot can't cut. Instead, re-target onto the best fletch_
     * step for the highest log tier the bot's Woodcutting can currently
     * obtain — still capped by Fletching level, so this never jumps ahead to
     * a bow tier the bot can't actually fletch yet. Also re-upgrades once
     * Woodcutting catches back up, mirroring WoodcuttingTask's own
     * level-up step reroll. No-op (and cheap) when nothing needs to change.
     */
    private _reconcileStep(player: Player): void {
        const wcLevel = getBaseLevel(player, PlayerStat.WOODCUTTING);
        const bestLog = bestLogForWoodcutting(wcLevel);
        if (bestLog === this.step.itemConsumed) return;

        const fletchLevel = getBaseLevel(player, PlayerStat.FLETCHING);
        const better = getBestFletchStepForLog(bestLog, fletchLevel);
        if (!better || better.action === this.step.action) return;

        console.log(`[Fletch:${player.username}] retargeting ${this.step.action} -> ${better.action} (wc=${wcLevel}, fletch=${fletchLevel})`);
        this.step = better;
        this._resetWcState();
    }

    private _hasLogsInInv(player: Player): boolean {
        return countItem(player, this.step.itemConsumed!) > 0;
    }

    private _findTree(player: Player): Loc | null {
        // Prefer a tree nobody else is on, so nearby bots spread across the
        // grove instead of all converging on the single nearest tree. But if
        // every tree in range is already claimed (small grove, lots of bots),
        // fall back to the closest one regardless — better to share a tree
        // than to sit scanning forever finding nothing.
        const unclaimed = findLocByPrefixWhere(player.x, player.z, player.level, this._treePrefix(), 15, loc => !isLocClaimed(loc), 'stump');
        if (unclaimed) return unclaimed;
        return findLocByPrefix(player.x, player.z, player.level, this._treePrefix(), 15, 'stump');
    }

    /** Release the currently claimed tree (if any) so other bots can target it. */
    private _releaseTree(): void {
        releaseLoc(this.currentTree);
        this.currentTree = null;
    }

    private _isTreeValid(tree: Loc): boolean {
        const name = LocType.get(tree.type).debugname ?? '';
        return name.startsWith(this._treePrefix()) && !name.includes('stump');
    }

    private _treePrefix(): string {
        switch (this.step.itemConsumed) {
            case Items.OAK_LOGS:    return 'oaktree';
            case Items.WILLOW_LOGS: return 'willowtree';
            case Items.MAPLE_LOGS:  return 'mapletree';
            case Items.YEW_LOGS:    return 'yewtree';
            case Items.MAGIC_LOGS:  return 'magictree';
            default:                return 'tree';
        }
    }

    private _approachTile(player: Player, tree: Loc): [number, number] {
        const w = 2; const l = 2;
        const closestX = Math.max(tree.x, Math.min(player.x, tree.x + w - 1));
        const closestZ = Math.max(tree.z, Math.min(player.z, tree.z + l - 1));
        const dx = player.x - closestX;
        const dz = player.z - closestZ;
        return Math.abs(dx) >= Math.abs(dz)
            ? [closestX + Math.sign(dx), closestZ]
            : [closestX, closestZ + Math.sign(dz)];
    }

    private _resetWcState(): void {
        this._releaseTree();
        this.approachTicks = 0;
        this.woodcutTicks  = 0;
        this.lastWcXp      = 0;
        this.scanFailTicks = 0;
        this.fleeTicks     = 0;
        this.wcStep        = null;
    }

    // ── Fletch helpers ───────────────────────────────────────────────────────────

    private _depositProducts(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        const inv  = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        // Keep knife, hatchet, and any unprocessed logs — deposit everything else.
        const keepIds = new Set<number>([
            Items.COINS, Items.KNIFE,
            ...this.step.toolItemIds,
            this.step.itemConsumed!,
        ]);
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || keepIds.has(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
        // Withdraw hatchet if it was banked by another task
        if (!this.step.toolItemIds.some(id => hasItem(player, id))) {
            for (const id of this.step.toolItemIds) {
                const removed = bank.remove(id, 1);
                if (removed.completed > 0) {
                    addItem(player, id, 1);
                    break;
                }
            }
        }
    }

    private _withdrawKnifeIfMissing(player: Player): void {
        if (hasItem(player, Items.KNIFE)) return;
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;
        const removed = bank.remove(Items.KNIFE, 1);
        if (removed.completed > 0) addItem(player, Items.KNIFE, 1);
    }

    private _resetFletchState(): void {
        this.dialogWaitTicks = 0;
        this.failTicks       = 0;
        this.lastCount       = 0;
    }

    private _findSlot(player: Player, itemId: number): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)?.id === itemId) return i;
        }
        return -1;
    }

    private _fletchManually(player: Player): void {
        const logId     = this.step.itemConsumed!;
        const productId = this.step.itemGained!;
        const count     = (this.step.extra?.productCount as number | undefined) ?? 1;
        if (this._findSlot(player, logId) === -1) return;
        removeItem(player, logId, 1);
        addItem(player, productId, count);
        addXp(player, PlayerStat.FLETCHING, this.step.xpPerAction);
        console.log(`[Fletch:${player.username}] _fletchManually: +${this.step.xpPerAction} XP product=${productId}x${count}`);
        this.watchdog.notifyActivity();
        this.lastCount = countItem(player, productId);
    }

    /**
     * Mirrors the server's `map_feature("makex")` opcode (ServerOps.ts MAP_FEATURE:
     * reads NODE_FEATURE_MAKEX from env, defaults true) so the bot always predicts
     * which dialog cut_logs.rs2 actually opened, instead of hardcoding one.
     */
    private _makexEnabled(): boolean {
        return tryParseBoolean(process.env.NODE_FEATURE_MAKEX, true);
    }

    /**
     * Resume-button component for the dialog cut_logs.rs2 opens via @fletch_log.
     *
     * makex enabled (default): regular logs (shaft_count >= 1) use `multiobj3_fletch`
     * — com_1/com_4 (shafts), com_2/com_5 (shortbow), com_3/com_6 (longbow), any of
     * which return quantity=1 (a single "make 1" conversion). Oak+ (shaft_count < 1)
     * use `multiobj2_fletch` — obj1/objtext1 (shortbow), obj2/objtext2 (longbow).
     *
     * makex disabled: cut_logs.rs2 falls back to the plain `multiobj3`/`multiobj2`
     * procs instead, which wire up different component names: multiobj3:com_2
     * (shafts), com_3 (shortbow), com_4 (longbow); multiobj2:objtext1 (shortbow),
     * objtext2 (longbow) — obj1/obj2 icons are NOT resume buttons on the plain variant.
     */
    private _dialogComponent(): string {
        const makex = this._makexEnabled();
        switch (this.step.action) {
            case 'fletch_shaft':           return makex ? 'multiobj3_fletch:com_4' : 'multiobj3:com_2';
            case 'fletch_shortbow':        return makex ? 'multiobj3_fletch:com_5' : 'multiobj3:com_3';
            case 'fletch_longbow':         return makex ? 'multiobj3_fletch:com_6' : 'multiobj3:com_4';
            case 'fletch_oak_shortbow':    return makex ? 'multiobj2_fletch:objtext1' : 'multiobj2:objtext1';
            case 'fletch_oak_longbow':     return makex ? 'multiobj2_fletch:objtext2' : 'multiobj2:objtext2';
            case 'fletch_willow_shortbow': return makex ? 'multiobj2_fletch:objtext1' : 'multiobj2:objtext1';
            case 'fletch_willow_longbow':  return makex ? 'multiobj2_fletch:objtext2' : 'multiobj2:objtext2';
            case 'fletch_maple_shortbow':  return makex ? 'multiobj2_fletch:objtext1' : 'multiobj2:objtext1';
            case 'fletch_maple_longbow':   return makex ? 'multiobj2_fletch:objtext2' : 'multiobj2:objtext2';
            case 'fletch_yew_shortbow':    return makex ? 'multiobj2_fletch:objtext1' : 'multiobj2:objtext1';
            case 'fletch_yew_longbow':     return makex ? 'multiobj2_fletch:objtext2' : 'multiobj2:objtext2';
            case 'fletch_magic_shortbow':  return makex ? 'multiobj2_fletch:objtext1' : 'multiobj2:objtext1';
            case 'fletch_magic_longbow':   return makex ? 'multiobj2_fletch:objtext2' : 'multiobj2:objtext2';
            default:                       return '';
        }
    }

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

/**
 * WoodcuttingTask.ts
 *
 * Chops trees using real engine loc interactions (APLOC1 = Chop down).
 * Progression: normal trees (level 1) → oaks (15) → willows (30) → yews (60).
 * Sells logs at Lumbridge General Store for coins to fund axe upgrades.
 *
 * Key behaviours:
 *   - PRE-WALKS adjacent to the tree before calling interactLoc().
 *     The engine clears interaction silently if the bot is not operable distance,
 *     so we must be touching the tree face before triggering it.
 *   - Excludes stumps ('treestump'.startsWith('tree') = true — no op1 script).
 *   - StuckDetector catches oscillation as well as stationary stuck.
 *   - Opens nearby fence gates automatically when stuck.
 *   - Level-up upgrades step and re-walks to new area.
 */

import LocType from '#/cache/config/LocType.js';
import {
    BotTask, Player, Loc, InvType,
    walkTo, interactLoc,
    findLocByPrefix, findNpcByName,
    hasItem, addItem, isInventoryFull, isNear,
    getBaseLevel, PlayerStat,
    Items, Locations, getProgressionStep,
    teleportToSafety, teleportNear, randInt, bankInvId, INTERACT_TIMEOUT, StuckDetector, ProgressWatchdog,
    isAdjacentToLoc, openNearbyGate, botJitter, advanceBankWalk,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { getCombatLevel, getNpcCombatLevel, findAggressorNpc } from '#/engine/bot/BotAction.js';

/** Draynor village woodcutting spots — aggressive Dark Wizards patrol here, minimum combat 16. */
const DRAYNOR_WC_LOCATIONS: Array<[number, number, number]> = [
    Locations.WILLOWS_DRAYNOR,
];

export class WoodcuttingTask extends BotTask {
    private step: SkillStep;

    /**
     * State machine:
     *   walk      → walking to tree area
     *   approach  → found a tree, walking adjacent to it
     *   interact  → adjacent, interaction queued, waiting for XP
     *   bank_walk → walking to sell logs
     *   bank_done → logs sold, return to walk
     */
    private state: 'walk' | 'approach' | 'interact' | 'flee' | 'bank_walk' | 'bank_done' = 'walk';
    private interactTicks  = 0;
    private lastXp         = 0;
    private scanFailTicks  = 0;
    private approachTicks  = 0;   // ticks spent approaching a tree
    private fleeTicks      = 0;
    private readonly FLEE_TICKS = 12;
    private currentTree:  Loc | null = null;
    private readonly stuck    = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Woodcut');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        if (!this.step.toolItemIds.every(id => hasItem(player, id))) return false;

        // Draynor village has aggressive Dark Wizards — require combat level 16
        const [sx, sz, sl] = this.step.location;
        const isDraynor = DRAYNOR_WC_LOCATIONS.some(([lx, lz, ll]) => lx === sx && lz === sz && ll === sl);
        if (isDraynor && getCombatLevel(player) < 16) return false;

        return true;
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        const banking = this.state === 'bank_walk' || this.state === 'bank_done';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            this.state = 'approach';
            this.currentTree = null;
            this.interactTicks = 0;
            this.scanFailTicks = 0;
            this.approachTicks = 0;
            this.cooldown = 3;
            return;
        }
        if (this.cooldown > 0) { this.cooldown--; return; }

        // ── Aggressor detection ───────────────────────────────────────────────
        if (this.state !== 'bank_walk' && this.state !== 'bank_done' && this.state !== 'flee') {
            const aggressor = findAggressorNpc(player, 8);
            if (aggressor) {
                const npcLvl = getNpcCombatLevel(aggressor);
                if (npcLvl > player.combatLevel) {
                    this.state = 'flee';
                    this.fleeTicks = 0;
                    this.currentTree = null;
                    return;
                }
            }
        }

        // Upgrade step when level-up unlocks a better tree tier
        const level   = getBaseLevel(player, PlayerStat.WOODCUTTING);
        const newStep = getProgressionStep('WOODCUTTING', level);
        if (newStep && newStep.minLevel > this.step.minLevel) {
            this.step         = newStep;
            this.state        = 'walk';
            this.currentTree  = null;
        }

        // ── Bank logs ─────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            // 'ready' = interaction queued; 'direct' = deposit without UI
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_done';
            return;
        }

        if (this.state === 'bank_done') {
            this._depositLoot(player);
            this._rerollStep(player); // re-randomise tree location for the next run
            this.state = 'walk'; this.cooldown = 3; return;
        }

        if (isInventoryFull(player)) { this.state = 'bank_walk'; return; }

        // ── Flee ──────────────────────────────────────────────────────────────
        if (this.state === 'flee') {
            this.fleeTicks++;
            const [lx, lz] = this.step.location;
            this._stuckWalk(player, lx, lz);
            if (this.fleeTicks >= this.FLEE_TICKS || isNear(player, lx, lz, 12)) {
                this.state = 'walk';
                this.fleeTicks = 0;
            }
            return;
        }

        // ── Walk to tree area ─────────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;
            if (!isNear(player, lx, lz, 15, ll)) {
                // Via waypoint: route through intermediate coord before destination.
                // Used to steer around obstacles (e.g. Draynor Mansion for Barbarian
                // Village willows).  Only apply when the bot hasn't yet passed it —
                // check player.z so a bot already north of the waypoint skips it.
                const via = this.step.via;
                if (via && player.level === via[2] && player.z < via[1] && !isNear(player, via[0], via[1], 5)) {
                    const [jx, jz] = botJitter(player, via[0], via[1], 3);
                    this._stuckWalk(player, jx, jz);
                    return;
                }
                const [jx, jz] = botJitter(player, lx, lz, 5);
                this._stuckWalk(player, jx, jz);
                return;
            }
            this.state = 'approach'; // arrived — now find and approach a tree
            return;
        }

        // ── Find tree and walk adjacent ───────────────────────────────────────
        if (this.state === 'approach') {
            // If we just became full, bank first
            if (isInventoryFull(player)) { this.state = 'bank_walk'; return; }

            // Drop stale reference if another player felled the tree
            if (this.currentTree && !this._isTreeStillValid(this.currentTree)) {
                this.currentTree   = null;
                this.approachTicks = 0;
            }

            const tree = this.currentTree ?? this._findTree(player);
            if (!tree) {
                this.scanFailTicks++;
                if (this.scanFailTicks === 1) {
                    console.log(`[WC:${player.username}] No '${this._treePrefix()}' tree near (${player.x},${player.z})`);
                }
                if (this.scanFailTicks > 10) {
                    // Wander within tree area and try again
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                    this.scanFailTicks = 0;
                }
                return;
            }
            this.scanFailTicks = 0;
            this.currentTree   = tree;

            if (isAdjacentToLoc(player, tree)) {
                // Already adjacent — interact immediately
                console.log(`[WC:${player.username}] Adjacent to '${this._treePrefix()}' at (${tree.x},${tree.z}), interacting`);
                interactLoc(player, tree);
                this.state         = 'interact';
                this.interactTicks = 0;
                this.lastXp        = player.stats[PlayerStat.WOODCUTTING];
                this.approachTicks = 0;
            } else {
                // Walk to the tile directly adjacent to the tree's nearest face
                const [tx, tz] = this._approachTile(player, tree);
                walkTo(player, tx, tz);
                this.approachTicks++;
                if (this.approachTicks > 30) {
                    // Can't reach this tree — try another
                    console.log(`[WC:${player.username}] Can't reach tree at (${tree.x},${tree.z}), retrying`);
                    this.currentTree   = null;
                    this.approachTicks = 0;
                }
            }
            return;
        }

        // ── Chopping ──────────────────────────────────────────────────────────
        if (this.state === 'interact') {
            // Tree was felled mid-chop by another player — rescan immediately
            if (this.currentTree && !this._isTreeStillValid(this.currentTree)) {
                this.state        = 'approach';
                this.currentTree  = null;
                this.interactTicks = 0;
                return;
            }
            this.interactTicks++;

            if (player.stats[PlayerStat.WOODCUTTING] > this.lastXp) {
                console.log(`[WC:${player.username}] XP gained! total=${player.stats[PlayerStat.WOODCUTTING]}`);
                this.lastXp        = player.stats[PlayerStat.WOODCUTTING];
                this.interactTicks = 0;
                this.watchdog.notifyActivity();
                if (this.currentTree) interactLoc(player, this.currentTree);
                return;
            }

            if (this.interactTicks >= INTERACT_TIMEOUT) {
                // Tree depleted or interaction was cleared — find another
                console.log(`[WC:${player.username}] Interact timeout, rescanning`);
                this.state        = 'approach';
                this.currentTree  = null;
                this.interactTicks = 0;
            }
        }
    }

    isComplete(_p: Player): boolean { return false; }

    override reset(): void {
        super.reset();
        this.state         = 'walk';
        this.interactTicks = 0;
        this.scanFailTicks = 0;
        this.approachTicks = 0;
        this.lastXp        = 0;
        this.fleeTicks     = 0;
        this.currentTree   = null;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Tree search ───────────────────────────────────────────────────────────

    private _findTree(player: Player): Loc | null {
        // 'treestump'.startsWith('tree') = true — must exclude stumps.
        // Stumps have no [oploc1] script so the woodcutting script silently fails.
        return findLocByPrefix(player.x, player.z, player.level, this._treePrefix(), 15, 'stump');
    }

    /**
     * Returns false if the stored tree reference has been replaced by a stump
     * (another player felled it while this bot was approaching or chopping).
     */
    private _isTreeStillValid(tree: Loc): boolean {
        const name = LocType.get(tree.type).debugname ?? '';
        return name.startsWith(this._treePrefix()) && !name.includes('stump');
    }

    private _treePrefix(): string {
        switch (this.step.itemGained) {
            case Items.OAK_LOGS:    return 'oaktree';
            case Items.WILLOW_LOGS: return 'willow_tree';
            case Items.MAPLE_LOGS:  return 'maple_tree';
            case Items.YEW_LOGS:    return 'yew_tree';
            default:                return 'tree';
        }
    }

    /**
     * Returns the tile the bot should walk to in order to be adjacent to the tree.
     * Picks the nearest face of the loc's bounding box, offset by 1 tile outward.
     */
    private _approachTile(player: Player, tree: Loc): [number, number] {
        // Tree occupies [tree.x .. tree.x+width-1] x [tree.z .. tree.z+length-1]
        const w = 2; const l = 2; // normal trees are always 2x2

        // Find closest point on the bounding box to the player
        const closestX = Math.max(tree.x, Math.min(player.x, tree.x + w - 1));
        const closestZ = Math.max(tree.z, Math.min(player.z, tree.z + l - 1));

        // Step 1 tile away from that point toward the player
        const dx = player.x - closestX;
        const dz = player.z - closestZ;

        if (Math.abs(dx) >= Math.abs(dz)) {
            return [closestX + Math.sign(dx), closestZ];
        } else {
            return [closestX, closestZ + Math.sign(dz)];
        }
    }


    // ── Step re-roll ─────────────────────────────────────────────────────────

    /** Pick a fresh random step matching the bot's current level and owned tools. */
    private _rerollStep(player: Player): void {
        const level = getBaseLevel(player, PlayerStat.WOODCUTTING);
        const newStep = getProgressionStep(
            'WOODCUTTING', level,
            ids => ids.every(id => hasItem(player, id)),
        );
        if (newStep) {
            this.step = newStep;
            this.currentTree = null;
        }
    }

        private _depositLoot(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (this.step.toolItemIds.includes(item.id)) continue;
            if (item.id === Items.COINS) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
            console.log(`[WC:${player.username}] Deposited logs into the bank.`);
    }


    // ── Stuck walk with gate opener ───────────────────────────────────────────

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
        if (openNearbyGate(player, 5)) return;

        const dx   = lx - player.x;
        const dz   = lz - player.z;
        const escX = player.x + (Math.abs(dz) > Math.abs(dx) ? randInt(-10, 10) : (dz > 0 ? 10 : -10));
        const escZ = player.z + (Math.abs(dx) > Math.abs(dz) ? randInt(-10, 10) : (dx > 0 ? 10 : -10));
        walkTo(player, escX, escZ);
    }
}

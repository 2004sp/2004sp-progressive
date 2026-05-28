/**
 * FishingTask.ts — Fish at spots, bank when full, progression-aware fishing loop.
 */

import {
    BotTask, Player, Npc, InvType,
    walkTo, interactNpc, interactNpcOp,
    findNpcBySuffix,
    hasItem, countItem, isInventoryFull, isNear,
    getBaseLevel, PlayerStat,
    Items, Locations, getProgressionStep,
    teleportToSafety, teleportNear, randInt, bankInvId, INTERACT_TIMEOUT,
    StuckDetector, ProgressWatchdog,
    openNearbyGate, botJitter, advanceBankWalk,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { getCombatLevel, getNpcCombatLevel, findAggressorNpc } from '#/engine/bot/BotAction.js';

/** Draynor village fishing spots — aggressive Dark Wizards patrol here, minimum combat 16. */
const DRAYNOR_FISH_LOCATIONS: Array<[number, number, number]> = [
    Locations.FISH_DRAYNOR,
    Locations.FISH_ALKHARID
];

export class FishingTask extends BotTask {
    private step: SkillStep;

    private state: 'walk' | 'approach' | 'scan' | 'interact' | 'flee' | 'bank_walk' | 'bank_done' = 'walk';

    private interactTicks = 0;
    private lastXp = 0;
    private scanFailTicks = 0;
    private approachTicks = 0;
    private fleeTicks = 0;
    private readonly FLEE_TICKS = 12;

    private currentSpot: Npc | null = null;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Fish');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        if (!this.step.toolItemIds.every(id => hasItem(player, id))) return false;

        // Draynor village has aggressive Dark Wizards — require combat level 16
        const [sx, sz, sl] = this.step.location;
        const isDraynor = DRAYNOR_FISH_LOCATIONS.some(([lx, lz, ll]) => lx === sx && lz === sz && ll === sl);
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
            this.currentSpot = null;
            this.interactTicks = 0;
            this.scanFailTicks = 0;
            this.approachTicks = 0;
            this.cooldown = 3;
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ── Aggressor detection ─────────────────────────────────────────────
        if (this.state !== 'bank_walk' && this.state !== 'bank_done' && this.state !== 'flee') {
            const aggressor = findAggressorNpc(player, 8);
            if (aggressor) {
                const npcLvl = getNpcCombatLevel(aggressor);
                if (npcLvl > player.combatLevel) {
                    this.state = 'flee';
                    this.fleeTicks = 0;
                    this.currentSpot = null;
                    return;
                }
            }
        }

        // ── Progression upgrade ─────────────────────────────────────────────
        const level = getBaseLevel(player, PlayerStat.FISHING);
        const newStep = getProgressionStep('FISHING', level);

        if (newStep && newStep.minLevel > this.step.minLevel) {
            this.step = newStep;
            this.state = 'walk';
            this.currentSpot = null;
        }

        // ── Bank flow ────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_done';
            return;
        }

        if (this.state === 'bank_done') {
            this._depositFish(player);
            this._rerollStep(player); // re-randomise fishing spot for the next run
            this.state = 'walk';
            this.cooldown = 3;
            return;
        }

        if (isInventoryFull(player)) {
            this.state = 'bank_walk';
            return;
        }

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

        // ── Consumable check ────────────────────────────────────────────────
        if (this.step.itemConsumed && !hasItem(player, this.step.itemConsumed)) {
            this.state = 'bank_walk';
            return;
        }

        // ── Walk to fishing zone ─────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;

            if (!isNear(player, lx, lz, 15, ll)) {
                // Via waypoint: route through intermediate coord before destination.
                // Used to steer around obstacles (e.g. Draynor Mansion for Barbarian
                // Village fishing spots).  Only apply when the bot hasn't yet passed it.
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

            this.state = 'approach';
            return;
        }

        // ── Approach fishing spot ────────────────────────────────────────────
        if (this.state === 'approach') {
            const spot = this._findFishSpot(player);

            if (!spot) {
                this.scanFailTicks++;

                if (this.scanFailTicks > 3) {
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                    this.scanFailTicks = 0;
                }
                return;
            }

            this.scanFailTicks = 0;
            this.currentSpot = spot;

            // move into range before interacting (important stability fix)
            if (!isNear(player, spot.x, spot.z, 2)) {
                this.approachTicks++;
                walkTo(player, spot.x, spot.z);

                if (this.approachTicks > 25) {
                    // Can't reach this spot — reposition near the activity center
                    // so the bot gets a better angle instead of retrying the same path.
                    this.currentSpot = null;
                    this.approachTicks = 0;
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                }
                return;
            }

            this.state = 'scan';
            this.approachTicks = 0;
            return;
        }

        // ── Scan / engage spot ───────────────────────────────────────────────
        if (this.state === 'scan') {
            if (!this.currentSpot) {
                this.state = 'approach';
                return;
            }

            this._interact(player, this.currentSpot);
            this.state = 'interact';
            this.interactTicks = 0;
            this.lastXp = player.stats[PlayerStat.FISHING];
            return;
        }

        // ── Fishing loop ─────────────────────────────────────────────────────
        if (this.state === 'interact') {
            this.interactTicks++;

            if (player.stats[PlayerStat.FISHING] > this.lastXp) {
                this.lastXp = player.stats[PlayerStat.FISHING];
                this.interactTicks = 0;
                this.watchdog.notifyActivity();
                // Re-validate the spot — if it moved or despawned, go to approach.
                const nextSpot = this._findFishSpot(player);
                if (nextSpot && isNear(player, nextSpot.x, nextSpot.z, 2)) {
                    this.currentSpot = nextSpot;
                    this._interact(player, nextSpot);
                } else {
                    this.currentSpot = null;
                    this.state = 'approach';
                }
                return;
            }

            if (this.interactTicks >= 8) {
                this.state = 'approach';
                this.currentSpot = null;
                this.interactTicks = 0;
            }

            // mid-fish depletion
            if (this.step.itemConsumed && !hasItem(player, this.step.itemConsumed)) {
                this.state = 'bank_walk';
            }
        }
    }

    isComplete(_p: Player): boolean {
        return false;
    }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.interactTicks = 0;
        this.scanFailTicks = 0;
        this.approachTicks = 0;
        this.lastXp = 0;
        this.fleeTicks = 0;
        this.currentSpot = null;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Step re-roll ─────────────────────────────────────────────────────────

    /** Pick a fresh random step matching the bot's current level and owned tools. */
    private _rerollStep(player: Player): void {
        const level = getBaseLevel(player, PlayerStat.FISHING);
        const newStep = getProgressionStep(
            'FISHING', level,
            ids => ids.every(id => hasItem(player, id)),
        );
        if (newStep) this.step = newStep;
    }

    // ── Spot detection ───────────────────────────────────────────────────────

    private _findFishSpot(player: Player): Npc | null {
        // Cage/harpoon spots on Karamja use the _rarefish suffix.
        // Fly-rod fresh-water spots use _freshfish.
        // Net/bait salt-water spots use _saltfish.
        const isRarefish =
            this.step.itemGained === Items.RAW_LOBSTER ||
            this.step.itemGained === Items.RAW_SWORDFISH;

        const isFreshwater =
            this.step.itemGained === Items.RAW_TROUT ||
            this.step.itemGained === Items.RAW_SALMON;

        const suffix = isRarefish ? '_rarefish' : isFreshwater ? '_freshfish' : '_saltfish';

        return findNpcBySuffix(player.x, player.z, player.level, suffix, 20);
    }

    private _interact(player: Player, spot: Npc): void {
        // op3 = harpoon (swordfish/tuna) or bait rod.
        // op1 = cage (lobster) or net — handled by default interactNpc().
        const useOp3 =
            this.step.itemConsumed === Items.FISHING_BAIT ||
            this.step.itemGained === Items.RAW_SWORDFISH;

        if (useOp3) interactNpcOp(player, spot, 3);
        else interactNpc(player, spot);
    }

    // ── Banking ──────────────────────────────────────────────────────────────

    private _depositFish(player: Player): void {
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
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
            }
             console.log(`[FSH:${player.username}] Deposited fish into the bank.`);
        }

    }

    // ── Stuck handling (WC-style upgrade) ────────────────────────────────────

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

        const dx = lx - player.x;
        const dz = lz - player.z;

        const escX =
            player.x +
            (Math.abs(dz) > Math.abs(dx)
                ? randInt(-10, 10)
                : dz > 0
                    ? 10
                    : -10);

        const escZ =
            player.z +
            (Math.abs(dx) > Math.abs(dz)
                ? randInt(-10, 10)
                : dx > 0
                    ? 10
                    : -10);

        // Clear existing (bad) waypoints so the hasWaypoints guard in
        // walkTo() doesn't block this escape recalculation.
        player.clearWaypoints();
        walkTo(player, escX, escZ);
    }
}

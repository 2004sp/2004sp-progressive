/**
 * MiningTask.ts — Mine rocks, bank ore, progress through tiers.
 */

import {
    BotTask,
    Player,
    Loc,
    InvType,
    walkTo,
    interactLoc,
    findLocByPrefix,
    hasItem,
    isInventoryFull,
    isNear,
    isAdjacentToLoc,
    getBaseLevel,
    PlayerStat,
    Items,
    Locations,
    getProgressionStep,
    teleportToSafety,
    teleportNear,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    openNearbyGate,
    botJitter,
    advanceBankWalk
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { getNpcCombatLevel, findAggressorNpc } from '#/engine/bot/BotAction.js';

export class MiningTask extends BotTask {
    private step: SkillStep;

    private state: 'walk' | 'approach' | 'scan' | 'interact' | 'flee' | 'bank_walk' | 'bank_done' = 'walk';

    private interactTicks = 0;
    private lastXp = 0;
    private scanFailTicks = 0;
    private approachTicks = 0;
    private fleeTicks = 0;
    private readonly FLEE_TICKS = 12;

    private currentRock: Loc | null = null;
    private viaLocation?: [number, number, number];

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Mine');
        this.step = step;
        this.viaLocation = step.via;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        return this.step.toolItemIds.every(id => hasItem(player, id));
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_done';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            this.state = 'approach';
            this.currentRock = null;
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
                    this.currentRock = null;
                    return;
                }
            }
        }

        // ── Progression upgrade ─────────────────────────────────────────────
        const level = getBaseLevel(player, PlayerStat.MINING);
        const newStep = getProgressionStep('MINING', level);

        if (newStep && newStep.minLevel > this.step.minLevel) {
            this.step = newStep;
            this.state = 'walk';
            this.currentRock = null;
        }

        // ── Banking ──────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_done';
            return;
        }

        if (this.state === 'bank_done') {
            this._depositOre(player);
            this._rerollStep(player); // re-randomise rock location for the next run
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

        // ── Walk to mining area ─────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;

            if (!isNear(player, lx, lz, 15, ll)) {
                // Via waypoint: route through intermediate coord before destination.
                // Used to steer around obstacles (e.g. Draynor Mansion for Barbarian
                // Village mine). Only apply when the bot hasn't reached the via yet.
                const via = this.viaLocation;
                if (via) {
                    const viaX = via[0];
                    const viaZ = via[1];
                    if (!isNear(player, viaX, viaZ, 5)) {
                        const [jx, jz] = botJitter(player, viaX, viaZ, 3);
                        this._stuckWalk(player, jx, jz);
                        return;
                    }
                    // Reached via waypoint - clear it and proceed to rock
                    this.viaLocation = undefined;
                }

                const [jx, jz] = botJitter(player, lx, lz, 5);
                this._stuckWalk(player, jx, jz);
                return;
            }

            // Reached mining area - clear via if not already cleared
            this.viaLocation = undefined;
            this.state = 'approach';
            return;
        }

        // ── Approach rock ────────────────────────────────────────────────────
        if (this.state === 'approach') {
            const rock = this._findRock(player);

            if (!rock) {
                this.scanFailTicks++;

                if (this.scanFailTicks > 3) {
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                    this.scanFailTicks = 0;
                }
                return;
            }

            this.scanFailTicks = 0;
            this.currentRock = rock;

            if (!isAdjacentToLoc(player, rock)) {
                this.approachTicks++;
                walkTo(player, rock.x, rock.z);

                if (this.approachTicks > 25) {
                    // Can't reach this rock — reposition near the activity center.
                    this.currentRock = null;
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

        // ── Start mining ─────────────────────────────────────────────────────
        if (this.state === 'scan') {
            if (!this.currentRock) {
                this.state = 'approach';
                return;
            }

            interactLoc(player, this.currentRock);

            this.state = 'interact';
            this.interactTicks = 0;
            this.lastXp = player.stats[PlayerStat.MINING];
            return;
        }

        // ── Mining loop ──────────────────────────────────────────────────────
        if (this.state === 'interact') {
            this.interactTicks++;

            if (player.stats[PlayerStat.MINING] > this.lastXp) {
                this.lastXp = player.stats[PlayerStat.MINING];
                this.interactTicks = 0;
                this.watchdog.notifyActivity();
                // Find next valid (non-empty) rock — may be the same one or a
                // closer one that just spawned. Avoids re-queueing on depleted rock.
                const nextRock = this._findRock(player);
                if (nextRock && isNear(player, nextRock.x, nextRock.z, 2)) {
                    this.currentRock = nextRock;
                    interactLoc(player, nextRock);
                } else {
                    this.currentRock = null;
                    this.state = 'approach';
                }
                return;
            }

            if (this.interactTicks >= 8) {
                this.state = 'approach';
                this.currentRock = null;
                this.interactTicks = 0;
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
        this.currentRock = null;
        this.viaLocation = this.step.via;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Step re-roll ────────────────────────────────────────────────────────

    /** Pick a fresh random step matching the bot's current level and owned tools. */
    private _rerollStep(player: Player): void {
        const level = getBaseLevel(player, PlayerStat.MINING);
        const newStep = getProgressionStep('MINING', level, ids => ids.every(id => hasItem(player, id)));
        if (newStep) this.step = newStep;
    }

    // ── Rock search ────────────────────────────────────────────────────────

    private _findRock(player: Player): Loc | null {
        const prefixes = this._getAvailableOrePrefixes(player);

        if (prefixes.length === 0) return null;

        const allRocks: Loc[] = [];
        for (const prefix of prefixes) {
            const rock = findLocByPrefix(player.x, player.z, player.level, prefix, 15, 'empty');
            if (rock) allRocks.push(rock);
        }

        if (allRocks.length === 0) return null;

        return allRocks[Math.floor(Math.random() * allRocks.length)];
    }

    private _getAvailableOrePrefixes(player: Player): string[] {
        const prefixes: string[] = [];

        // Special case: if we are at Rimmington mine, always prioritize clay if that's what we are there for
        if (this.step.location === Locations.MINE_RIMMINGTON) {
            prefixes.push('clayrock');
            return prefixes;
        }

        // Get player's actual mining level using base level
        const miningLevel = getBaseLevel(player, PlayerStat.MINING);

        // Level 1-14: copper and tin available
        if (miningLevel <= 14) {
            prefixes.push('copperrock', 'tinrock');
        }
        // Level 15-29: iron available
        else if (miningLevel <= 29) {
            prefixes.push('ironrock');
        }
        // Level 30+: coal (and iron for some mines)
        else if (miningLevel <= 54) {
            prefixes.push('coalrock', 'ironrock');
        }
        // Level 55+: Mithril
        else if (miningLevel <= 69) {
            prefixes.push('mithrilrock', 'coalrock');
        }
        // Level 70+: Adamant
        else if (miningLevel <= 84) {
            prefixes.push('adamantrock', 'mithrilrock');
        }
        // Level 85+: Runite
        else {
            prefixes.push('runiterock', 'adamantrock');
        }

        return prefixes;
    }

    // ── Banking ─────────────────────────────────────────────────────────────

    private _depositOre(player: Player): void {
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
        console.log(`[MG:${player.username}] Deposited ORES into the bank.`);
    }

    // ── Stuck handling (WC-style upgrade) ──────────────────────────────────

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

        const escX = player.x + (Math.abs(dz) > Math.abs(dx) ? randInt(-10, 10) : dz > 0 ? 10 : -10);

        const escZ = player.z + (Math.abs(dx) > Math.abs(dz) ? randInt(-10, 10) : dx > 0 ? 10 : -10);

        walkTo(player, escX, escZ);
    }
}

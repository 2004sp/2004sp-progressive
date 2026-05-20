/**
 * AgilityTask.ts — Walk agility courses (Gnome, Barbarian, Wilderness).
 *
 * XP flows entirely through the server RuneScript:
 *   interactLocOp → queues the obstacle interaction → next tick the script
 *   fires stat_advance(agility, X) → Player.addXp() applies the progressive
 *   multiplier.  No manual addXp() is needed here.
 *
 * Failure handling (Barbarian / Wilderness obstacles have fail rates):
 *   On a failed obstacle the RuneScript teleports the player back to the
 *   course start.  We detect completion via position change (≥3 tile movement),
 *   since most obstacles give no XP individually — the lap bonus fires at the
 *   end.  If no movement is detected within MAX_WAIT ticks, assume failure,
 *   reset the obstacle index and walk back to the course.
 */

import {
    BotTask, Player,
    walkTo, interactLocOp, findLocByName,
    isNear, getBaseLevel, getProgressionStep,
    PlayerStat, Locations, randInt,
    StuckDetector, ProgressWatchdog,
    teleportNear, openNearbyGate,
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { AgilityCourses } from '#/engine/bot/BotKnowledge.js';

export class AgilityTask extends BotTask {
    private step: SkillStep;

    private state: 'walk' | 'obstacle' | 'wait' = 'walk';

    private obstacleIndex = 0;
    private waitTicks     = 0;
    private lastX         = 0;
    private lastZ         = 0;
    private lastLevel     = 0;
    private complete      = false;
    private lapsCompleted = 0;
    private static readonly LAPS_PER_TASK = 10;

    /** Ticks to wait for movement before assuming the obstacle failed. */
    private static readonly MAX_WAIT = 25;

    /**
     * Ticks to ignore after queueing an interaction.
     * p_arrivedelay walks the player up to ~3 tiles to reach the obstacle,
     * which would otherwise trigger false completion. Skipping 5 ticks lets
     * p_arrivedelay + p_delay(0) finish so only the actual teleport is detected.
     */
    private static readonly MIN_WAIT = 5;

    /**
     * Minimum tile movement to consider an obstacle completed.
     * Must be 2: both gnome nets only displace the player by 2 tiles
     * (net_1: dz=-2 + level change; net_2: dz=+2 same level).
     */
    private static readonly MOVE_THRESHOLD = 2;

    private readonly stuck    = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Agility');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(_p: Player): boolean {
        return true; // no tools or consumables required
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        // Watchdog resets the state to walk if the bot goes idle too long
        if (this.watchdog.check(player, false)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            this.obstacleIndex = 0;
            this.state = 'walk';
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ── Progression upgrade ─────────────────────────────────────────────
        const level   = getBaseLevel(player, PlayerStat.AGILITY);
        const newStep = getProgressionStep('AGILITY', level);

        if (newStep && newStep.minLevel > this.step.minLevel) {
            console.log(`[Agility] 📈 Upgrading course (now level ${level})`);
            this.step          = newStep;
            this.obstacleIndex = 0;
            this.state         = 'walk';
            this.stuck.reset();
            this.watchdog.reset();
        }

        // ── Walk to course start ─────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;

            if (!isNear(player, lx, lz, 15, ll)) {
                this._stuckWalk(player, lx, lz);
                return;
            }

            console.log(`[Agility] 🏃 Arrived at course`);
            this.obstacleIndex = 0;
            this.state         = 'obstacle';
            return;
        }

        // ── Find and click the next obstacle ─────────────────────────────────
        if (this.state === 'obstacle') {
            const courseKey = (this.step.extra?.course as string | undefined) ?? 'GNOME';
            const obstacles = AgilityCourses[courseKey];

            if (!obstacles || obstacles.length === 0) {
                console.log(`[Agility] ❌ No obstacles defined for course: ${courseKey}`);
                this.interrupt();
                return;
            }

            if (this.obstacleIndex >= obstacles.length) {
                // Completed a full lap — restart from the first obstacle
                this.obstacleIndex = 0;
                console.log(`[Agility] 🏁 Lap complete, restarting`);
            }

            const obstacle = obstacles[this.obstacleIndex];

            // Search in a generous radius — obstacle locs can be spread out.
            // Also try adjacent levels: some course transitions (e.g. net → level 1,
            // then tree branch at level 0) leave the player on a different level than
            // the next obstacle loc.
            let loc = findLocByName(player.x, player.z, player.level, obstacle.name, 25);
            if (!loc) {
                const altLevel = player.level === 0 ? 1 : 0;
                loc = findLocByName(player.x, player.z, altLevel, obstacle.name, 25);
            }

            if (!loc) {
                // Obstacle not visible yet — wander toward the course centre and retry
                const [lx, lz] = this.step.location;
                walkTo(player, lx + randInt(-4, 4), lz + randInt(-4, 4));
                this.cooldown = 2;
                return;
            }

            // Walk into range before interacting. Some obstacles have a directional
            // guard (e.g. net_2 requires the player to be south of the loc), so we
            // apply approachDz to target the correct approach tile.
            const targetZ = loc.z + (obstacle.approachDz ?? 0);
            if (!isNear(player, loc.x, targetZ, 1, loc.level)) {
                walkTo(player, loc.x, targetZ);
                return;
            }

            // Queue the obstacle interaction (RuneScript fires on next tick)
            this.lastX     = player.x;
            this.lastZ     = player.z;
            this.lastLevel = player.level;
            interactLocOp(player, loc, obstacle.op);

            this.state     = 'wait';
            this.waitTicks = 0;
            this.cooldown  = 1;
            return;
        }

        // ── Wait for player movement to confirm obstacle completion ───────────
        if (this.state === 'wait') {
            this.waitTicks++;

            // Skip the first MIN_WAIT ticks so that p_arrivedelay (which walks the
            // player up to 3 tiles toward the obstacle) does not trigger a false
            // completion before the actual p_telejump fires.
            if (this.waitTicks < AgilityTask.MIN_WAIT) return;

            const moved        = Math.abs(player.x - this.lastX) + Math.abs(player.z - this.lastZ);
            const levelChanged = player.level !== this.lastLevel;
            if (moved >= AgilityTask.MOVE_THRESHOLD || levelChanged) {
                // Player moved — obstacle completed successfully
                this.lastX = player.x;
                this.lastZ = player.z;
                this.watchdog.notifyActivity();

                const courseKey = (this.step.extra?.course as string | undefined) ?? 'GNOME';
                const obstacles = AgilityCourses[courseKey];
                this.obstacleIndex++;

                const lapDone = this.obstacleIndex >= obstacles.length;
                console.log(
                    `[Agility] ⚡ Obstacle ${this.obstacleIndex}/${obstacles.length} done` +
                    (lapDone ? ' — lap complete!' : '')
                );

                if (lapDone) {
                    this.lapsCompleted++;
                    console.log(`[Agility] 🏁 Lap ${this.lapsCompleted}/${AgilityTask.LAPS_PER_TASK} complete`);
                    if (this.lapsCompleted >= AgilityTask.LAPS_PER_TASK) {
                        this.complete = true;
                        return;
                    }
                    this.obstacleIndex = 0;
                }

                this.state    = 'obstacle';
                this.cooldown = randInt(1, 3);
                return;
            }

            if (this.waitTicks >= AgilityTask.MAX_WAIT) {
                // Timed out — obstacle likely failed; reset and re-navigate to course
                console.log(`[Agility] ⚠️ Obstacle timeout — resetting lap`);
                this.obstacleIndex = 0;
                this.waitTicks     = 0;
                this.state         = 'walk';
                this.stuck.reset();
            }
        }
    }

    isComplete(_p: Player): boolean {
        return this.complete;
    }

    override reset(): void {
        super.reset();
        this.state         = 'walk';
        this.obstacleIndex = 0;
        this.waitTicks     = 0;
        this.lastX         = 0;
        this.lastZ         = 0;
        this.lastLevel     = 0;
        this.stuck.reset();
        this.watchdog.reset();
        this.complete      = false;
        this.lapsCompleted = 0;
    }

    // ── Stuck-walk helper ────────────────────────────────────────────────────

    private _stuckWalk(player: Player, x: number, z: number): void {
        if (!this.stuck.check(player, x, z)) {
            walkTo(player, x, z);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            console.log(`[Agility] 🌀 Teleport escape`);
            teleportNear(player, x, z);
            this.stuck.reset();
            return;
        }

        if (openNearbyGate(player, 5)) return;

        walkTo(
            player,
            player.x + randInt(-10, 10),
            player.z + randInt(-10, 10),
        );
    }
}

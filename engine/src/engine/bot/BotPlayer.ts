/**
 * BotPlayer.ts
 *
 * Wraps a real engine Player with bot AI.
 */

import fs from 'fs';
import path from 'path';
import Player from '#/engine/entity/Player.js';
import InvType from '#/cache/config/InvType.js';
import { BotTask } from '#/engine/bot/tasks/Index.js';
import { BotGoalPlanner } from '#/engine/bot/BotGoalPlanner.js';
import { addXp, getBaseLevel, PlayerStat, openNearbyGate } from '#/engine/bot/BotAction.js';
import { PlayerStatNameMap } from '#/engine/entity/PlayerStat.js';

const RESCAN_TICKS = 600;

const NO_INTERRUPT_TASKS = new Set(['ShopTrip', 'Bank', 'Walk', 'Init', 'Idle', 'Prayer']);

// ── Phrase lists loaded from data/bot/bot_phrases.json ───────────────────────
// Falls back to a minimal built-in list if the file is missing.
let IDLE_PHRASES: string[] = ['nice', 'gz', 'good spot', 'banking brb', 'almost there', 'good xp here', 'gg', 'brb'];
let LEVELUP_PHRASES: string[] = ['gz me', 'finally!', 'level up!', 'yes!', 'grind never stops', 'getting there'];

try {
    const raw = fs.readFileSync(path.join('data', 'bot', 'bot_phrases.json'), 'utf8');
    const data = JSON.parse(raw) as { idle?: string[]; levelup?: string[] };
    if (Array.isArray(data.idle) && data.idle.length > 0) IDLE_PHRASES = data.idle;
    if (Array.isArray(data.levelup) && data.levelup.length > 0) LEVELUP_PHRASES = data.levelup;
} catch {
    // File not found or malformed — keep the built-in defaults silently.
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p: number): boolean {
    return Math.random() < p;
}

export class BotPlayer {
    readonly player: Player;
    readonly planner: BotGoalPlanner;
    readonly name: string;

    currentTask: BotTask | null = null;
    taskHistory: string[] = [];

    private ticksAlive = 0;
    private rescanTimer = 0;
    private planFailCount = 0;
    /** Counts ticks between universal gate sweeps (fires every 5 ticks). */
    private gateCheckTimer = 0;

    // ── Sub-task system (for bury bones, eating, etc.) ───────────────────────
    private subTask: BotTask | null = null;

    // ── Deferred teleport ─────────────────────────────────────────────────────
    // botTeleport() stores the destination here and sets player.delayed for 2
    // ticks so the magic cast animation plays at the SOURCE tile before the
    // position jumps.  Mirrors the real [proc,player_teleport_normal] sequence:
    //   anim(human_castteleport) → p_delay(2) → p_telejump → anim(null)
    private pendingTeleport: { x: number; z: number; level: number } | null = null;

    constructor(player: Player, planner: BotGoalPlanner) {
        this.player = player;
        this.planner = planner;
        this.name = player.username;

        // link player → bot (so tasks/BotAction can access this)
        (player as any)._bot = this;
    }

    /** Called by botTeleport() to queue a deferred position jump. */
    setPendingTeleport(x: number, z: number, level: number): void {
        this.pendingTeleport = { x, z, level };
    }

    // ── Sub-task API ─────────────────────────────────────────────────────────
    setSubTask(task: BotTask): void {
        task.reset();
        this.subTask = task;
    }

    tick(): void {
        this.ticksAlive++;
        this.player.afkEventReady = false;

        // Always refresh appearance
        this.player.buildAppearance(InvType.WORN);

        if (this.ticksAlive === 1) {
            this.log(`Online at (${this.player.x}, ${this.player.z}, ${this.player.level}) slot=${this.player.slot}`);
        }

        // ── DEFERRED TELEPORT ────────────────────────────────────────────────
        // botTeleport() plays the cast animation and sets player.delayed for 2
        // ticks, then stores the destination here.  While delayed we hold the
        // bot idle so the animation visibly plays at the source tile.  Once the
        // engine clears player.delayed we fire teleJump and reset the animation.
        if (this.pendingTeleport !== null) {
            if (this.player.delayed) {
                // Still in the 2-tick cast window — let the animation play.
                return;
            }
            // Delay expired — jump to the destination and clear the cast anim.
            const { x, z, level } = this.pendingTeleport;
            this.pendingTeleport = null;
            this.player.playAnimation(-1, 0); // anim(null) — stops the cast loop
            this.player.teleJump(x, z, level);
            return; // let the task pick up normally next tick
        }

        if (chance(0.003)) this._say(pick(IDLE_PHRASES));

        // ── SUB TASK (HIGH PRIORITY) ─────────────────────────────
        if (this.subTask) {
            if (this.subTask.isComplete(this.player) || !this.subTask.shouldRun(this.player)) {
                this.subTask = null;
            } else {
                try {
                    this.subTask.tick(this.player);
                } catch (err) {
                    console.error(`[Bot:${this.name}] SubTask error:`, err);
                    this.subTask = null;
                }
                return; // ⛔ block main task while subtask runs
            }
        }

        // ── RESCAN ───────────────────────────────────────────────
        this.rescanTimer++;
        if (this.rescanTimer >= RESCAN_TICKS) {
            this.rescanTimer = 0;

            if (this.currentTask && !NO_INTERRUPT_TASKS.has(this.currentTask.name)) {
                const candidate = this.planner.pickTask(this.player);

                if (candidate && candidate.name !== this.currentTask.name) {
                    this.log(`Rescan: ${this.currentTask.name} → ${candidate.name}`);
                    this.currentTask.interrupt();
                    this._switchTask(candidate);
                    this.currentTask.reset();
                    this.planFailCount = 0;
                    return;
                }
            }
        }

        // ── NORMAL TASK LOOP ─────────────────────────────────────

        if (!this.currentTask) {
            const next = this._pickTask();
            if (!next) return;
            this._switchTask(next);
        }

        if (this.currentTask!.isComplete(this.player)) {
            this._recordComplete();
            const next = this._pickTask();
            if (!next) return;
            this._switchTask(next);
        }

        if (this.currentTask!.interrupted) {
            const next = this._pickTask();
            if (!next) return;
            this._switchTask(next);
        }

        if (!this.currentTask!.shouldRun(this.player)) {
            this.planFailCount++;
            this.log(`${this.currentTask!.name} can't run (fail #${this.planFailCount})`);

            if (this.planFailCount >= 5) {
                this.planFailCount = 0;
                this.rescanTimer = RESCAN_TICKS;
            }

            const next = this._pickTask();
            if (!next) return;
            this._switchTask(next);
            return;
        }

        this.planFailCount = 0;

        const activeTask = this.currentTask;
        if (!activeTask) return;

        // ── UNIVERSAL GATE SWEEP ─────────────────────────────────────────────
        // Every 5 ticks, open any closed door or gate within 10 tiles regardless
        // of which task is running or which state it is in.  This covers the
        // "targeting an NPC behind a fence" case where walkTo is not being called
        // (e.g. a combat bot re-engaging its target every 12 ticks while a gate
        // sits between them unopened).  Skip if the player is already mid-script
        // (delayed) or already has a pending interaction (e.g. attacking an NPC).
        //if (++this.gateCheckTimer >= 5) {
            //this.gateCheckTimer = 0;
            //if (!this.player.delayed && !this.player.hasInteraction()) {
            //    openNearbyGate(this.player, 5);
          //  }
        //}

        try {
            activeTask.tick(this.player);
        } catch (err) {
            console.error(`[Bot:${this.name}] Task error in ${activeTask.name}:`, err);
            this.currentTask = null;
        }
    }

    onLevelUp(stat: PlayerStat, newLevel: number): void {
        const statName = PlayerStatNameMap.get(stat) ?? `stat${stat}`;
        this.log(`LEVEL UP: ${statName} → ${newLevel}`);

        if (chance(0.6)) {
            this._say(pick(LEVELUP_PHRASES) + ` (${statName.toLowerCase()} ${newLevel})`);
        }

        this.rescanTimer = RESCAN_TICKS;
    }

    snapshot() {
        const p = this.player;

        return {
            name: this.name,
            x: p.x,
            z: p.z,
            level: p.level,
            task: this.currentTask?.name ?? 'idle',
            wc: getBaseLevel(p, PlayerStat.WOODCUTTING),
            fishing: getBaseLevel(p, PlayerStat.FISHING),
            mining: getBaseLevel(p, PlayerStat.MINING),
            attack: getBaseLevel(p, PlayerStat.ATTACK),
            strength: getBaseLevel(p, PlayerStat.STRENGTH),
            defence: getBaseLevel(p, PlayerStat.DEFENCE),
            hitpoints: getBaseLevel(p, PlayerStat.HITPOINTS),
            prayer: getBaseLevel(p, PlayerStat.PRAYER),
            ticksAlive: this.ticksAlive
        };
    }

    log(msg: string): void {
        console.log(`[Bot:${this.name}][t${this.ticksAlive}] ${msg}`);
    }

    private _pickTask(): BotTask | null {
        const task = this.planner.pickTask(this.player);

        if (task) {
            task.reset();
            this.log(`→ ${task.name}`);
        }

        return task;
    }

    /**
     * Switches to a new task. Awards 5 Agility XP whenever the task name
     * actually changes (i.e. a different skill/activity was picked).
     *
     * XP is passed as tenths (the engine's internal format): 50 = 5.0 displayed XP.
     * (Level 2 threshold is 830 internally = 83.0 displayed XP.)
     */
    private _switchTask(next: BotTask): void {
        if (this.currentTask) {
            if (this.currentTask.name !== next.name) {
                addXp(this.player, PlayerStat.AGILITY, 10); // 50 internal = 5.0 XP displayed
            }
            this.currentTask.reset(); // allow outgoing task to clean up (e.g. CombatTask unequips armor)
        }
        this.currentTask = next;
    }

    private _recordComplete(): void {
        if (!this.currentTask) return;

        this.log(`✓ ${this.currentTask.name}`);
        this.taskHistory.push(this.currentTask.name);

        if (this.taskHistory.length > 10) {
            this.taskHistory.shift();
        }
    }

    private _say(message: string): void {
        this.player.say(message);
    }
}

/**
 * BotDebugService.ts
 *
 * Central registry for the bot debugger. Owns:
 *   - per-bot BotDebugTracker instances
 *   - a global (all-bots) event ring buffer
 *   - global performance metrics
 *   - JSON-safe snapshot builders consumed by BotDebugServer (REST/WS)
 *
 * Design constraints (see spec):
 *   - Every public method fails safe: a thrown error inside this service must
 *     never propagate into game logic. Callers (BotPlayer/BotAction/etc) call
 *     these methods directly; wrapping happens INSIDE this module so callers
 *     don't need their own try/catch at every call site.
 *   - When Environment.BOT_DEBUG_ENABLED is false, every method is a cheap
 *     no-op (single boolean check, no allocation).
 *   - Only normalized primitives are retained — never live Player/Npc/Loc
 *     references inside trackers. The live Player/BotPlayer map here mirrors
 *     BotManager's own bot lifetime, so it does not extend memory retention.
 */

import type Player from '#/engine/entity/Player.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import { PlayerStatNameMap, PlayerStatEnabled } from '#/engine/entity/PlayerStat.js';
import Environment from '#/util/Environment.js';
import { BotDebugTracker } from '#/engine/bot/debug/BotDebugTracker.js';
import type {
    BotActionStatus,
    BotDebugActionTarget,
    BotDebugEvent,
    BotDebugEventCategory,
    BotDebugAction,
    BotSummary,
    BotDetail,
    BotSkillSnapshot,
    BotInventorySnapshot,
    BotMovementSnapshot,
    BotStuckSnapshot,
    BotScriptSnapshot,
    BotDebugMetrics,
    BotDebugConfigInfo,
    BotPlannerDecision,
    BotTaskDebugInfo
} from '#/engine/bot/debug/BotDebugTypes.js';

// ── Minimal structural type for whatever BotPlayer exposes to the debugger ────
// Using a structural interface (not `import type { BotPlayer }`) avoids any
// coupling to BotPlayer's internals beyond this shape, and keeps this file
// import-order independent.
export interface DebuggableBot {
    readonly player: Player;
    readonly name: string;
    readonly planner: { personality: { name: string } };
    currentTask: {
        name: string;
        interrupted: boolean;
        getDebugInfo?: (player: Player) => BotTaskDebugInfo;
    } | null;
    ticksAliveValue: number;
    movementMonitorInfo: () => { isStuck: boolean; isOscillating: boolean; stuckTicks: number };
    plannerRescanCountdown: number;
    plannerFailCount: number;
}

// ── Internal xp-threshold table (mirrors Player.ts's level curve exactly) ─────
// Internal xp is stored in tenths; levelExperience[i] is the tenths-xp
// threshold for level (i+2). Duplicated here (read-only, tiny) rather than
// exported from Player.ts to avoid touching gameplay code for a debug-only need.
const LEVEL_EXPERIENCE = new Int32Array(99);
{
    let acc = 0;
    for (let i = 0; i < 99; i++) {
        const level = i + 1;
        const delta = Math.floor(level + Math.pow(2.0, level / 7.0) * 300.0);
        acc += delta;
        LEVEL_EXPERIENCE[i] = Math.floor(acc / 4) * 10;
    }
}

function internalXpForLevel(level: number): number | null {
    if (level >= 99) return null;
    if (level < 1) level = 1;
    return LEVEL_EXPERIENCE[level - 1]; // threshold for level (level+1)
}

function safeName(fn: () => string | null | undefined, fallback: string): string {
    try {
        return fn() || fallback;
    } catch {
        return fallback;
    }
}

export function itemName(id: number): string {
    return safeName(() => ObjType.get(id)?.debugname ?? ObjType.get(id)?.name, `item_${id}`);
}
export function npcDebugName(id: number): string {
    return safeName(() => NpcType.get(id)?.debugname, `npc_${id}`);
}
export function locDebugName(id: number): string {
    return safeName(() => LocType.get(id)?.debugname, `loc_${id}`);
}

class BotDebugServiceClass {
    enabled = false;
    level: 'off' | 'basic' | 'detailed' | 'trace' = 'detailed';
    eventHistory = 500;
    snapshotIntervalMs = 750;

    private trackers = new Map<string, BotDebugTracker>();
    private bots = new Map<string, DebuggableBot>();
    private globalEvents: BotDebugEvent[] = [];
    private globalEventCap = 2000;

    private currentTick = 0;
    private tickDurations: number[] = [];
    private totalTicksObserved = 0;
    private startedAtMs = Date.now();
    private eventsThisSecond = 0;
    private eventsPerSecond = 0;
    private lastEpsResetMs = Date.now();
    dashboardClients = 0;

    // cumulative session stats for the shutdown summary (#34)
    private sessionActionTotals = { success: 0, timeout: 0, failed: 0 };
    private sessionFailuresByTask = new Map<string, number>();
    private sessionStuckByBot = new Map<string, number>();

    // ── Config / lifecycle ────────────────────────────────────────────────────

    configure(): void {
        this.enabled = Environment.BOT_DEBUG_ENABLED;
        this.level = (Environment.BOT_DEBUG_LEVEL as typeof this.level) || 'detailed';
        this.eventHistory = Environment.BOT_DEBUG_EVENT_HISTORY;
        this.snapshotIntervalMs = Environment.BOT_DEBUG_SNAPSHOT_INTERVAL;
    }

    getConfig(): BotDebugConfigInfo {
        return { enabled: this.enabled, level: this.level, eventHistory: this.eventHistory, snapshotIntervalMs: this.snapshotIntervalMs };
    }

    setTick(tick: number): void {
        this.currentTick = tick;
    }

    // ── Registration ──────────────────────────────────────────────────────────

    registerBot(bot: DebuggableBot): void {
        if (!this.enabled) return;
        try {
            if (!this.trackers.has(bot.name)) {
                this.trackers.set(bot.name, new BotDebugTracker(bot.name, this.eventHistory));
            }
            this.bots.set(bot.name, bot);
            this.trackers.get(bot.name)!.registeredAtTick = this.currentTick;
        } catch {
            // never let debugger failures affect bot spawning
        }
    }

    unregisterBot(name: string): void {
        try {
            const t = this.trackers.get(name);
            if (t) t.online = false;
            this.bots.delete(name);
        } catch {
            /* noop */
        }
    }

    private tracker(name: string): BotDebugTracker | undefined {
        return this.trackers.get(name);
    }

    // ── Tick timing (perf metrics) ────────────────────────────────────────────

    recordBotTickDuration(name: string, ms: number): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(name);
            if (!t) return;
            t.lastTickDurationMs = ms;
            if (ms > t.maxTickDurationMs) t.maxTickDurationMs = ms;
        } catch {
            /* noop */
        }
    }

    recordGlobalTickDuration(ms: number): void {
        if (!this.enabled) return;
        try {
            this.tickDurations.push(ms);
            if (this.tickDurations.length > 200) this.tickDurations.shift();
            this.totalTicksObserved++;
        } catch {
            /* noop */
        }
    }

    // ── Events ────────────────────────────────────────────────────────────────

    event(botName: string, category: BotDebugEventCategory, message: string, data?: Record<string, unknown>): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            const evt = t.recordEvent(this.currentTick, category, message, data);
            this.globalEvents.push(evt);
            if (this.globalEvents.length > this.globalEventCap) this.globalEvents.shift();
            this._bumpEps();
        } catch {
            /* noop */
        }
    }

    warning(botName: string, kind: string, message: string): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            const w = t.recordWarning(this.currentTick, kind, message);
            this.globalEvents.push({ id: w.id, tick: w.tick, time: w.time, bot: botName, category: 'warning', message: w.message, data: { kind } });
            if (this.globalEvents.length > this.globalEventCap) this.globalEvents.shift();
        } catch {
            /* noop */
        }
    }

    error(botName: string, player: Player | null, message: string, stack?: string): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            t.recordError(this.currentTick, player?.x ?? -1, player?.z ?? -1, player?.level ?? -1, message, stack);
            const task = t.currentTaskName ?? 'unknown';
            this.sessionFailuresByTask.set(task, (this.sessionFailuresByTask.get(task) ?? 0) + 1);
        } catch {
            /* noop */
        }
    }

    private _bumpEps(): void {
        this.eventsThisSecond++;
        const now = Date.now();
        if (now - this.lastEpsResetMs >= 1000) {
            this.eventsPerSecond = this.eventsThisSecond;
            this.eventsThisSecond = 0;
            this.lastEpsResetMs = now;
        }
    }

    // ── Task / state transitions ─────────────────────────────────────────────

    noteTaskChange(botName: string, taskName: string | null): void {
        if (!this.enabled) return;
        try {
            this.tracker(botName)?.noteTaskChange(this.currentTick, taskName);
        } catch {
            /* noop */
        }
    }

    noteStateChange(botName: string, state: string | null): void {
        if (!this.enabled) return;
        try {
            this.tracker(botName)?.noteStateChange(this.currentTick, state);
        } catch {
            /* noop */
        }
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    startAction(botName: string, type: string, description: string, target?: BotDebugActionTarget): BotDebugAction | null {
        if (!this.enabled) return null;
        try {
            const t = this.tracker(botName);
            if (!t) return null;
            const action = t.startAction(this.currentTick, type, description, target);
            this.event(botName, this._categoryForActionType(type), description, { actionId: action.id, target });
            return action;
        } catch {
            return null;
        }
    }

    endAction(botName: string, action: BotDebugAction | null, status: BotActionStatus, result?: string, failureReason?: string): void {
        if (!this.enabled || !action) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            t.endAction(action, this.currentTick, status, result, failureReason);
            if (status === 'success') this.sessionActionTotals.success++;
            else if (status === 'timeout') this.sessionActionTotals.timeout++;
            else if (status === 'failed') this.sessionActionTotals.failed++;
            if (status === 'failed' || status === 'timeout') {
                this.event(botName, 'warning', `${action.type} ${status}: ${failureReason ?? action.description}`, { actionId: action.id });
            }
        } catch {
            /* noop */
        }
    }

    private _categoryForActionType(type: string): BotDebugEventCategory {
        if (type === 'walk') return 'movement';
        if (type.startsWith('interactNpc')) return 'npc';
        if (type.startsWith('interactLoc') || type.startsWith('interactUseLoc')) return 'loc';
        if (type === 'addXp') return 'xp';
        if (type === 'addItem' || type === 'removeItem') return 'inventory';
        return 'interaction';
    }

    // ── XP ────────────────────────────────────────────────────────────────────

    noteXpGain(botName: string, stat: number, currentInternalXp: number): void {
        if (!this.enabled) return;
        try {
            this.tracker(botName)?.noteXpGain(this.currentTick, stat, currentInternalXp);
        } catch {
            /* noop */
        }
    }

    // ── Generic action resolution ─────────────────────────────────────────────
    // BotPlayer calls these once per tick per bot to close out whatever
    // interaction is currently in flight, by observing real evidence of
    // progress (XP gained, inventory changed) rather than trusting that the
    // click itself succeeded. This is what lets the debugger tell "issued"
    // apart from "actually worked" per spec section 7.

    /** Marks the bot's in-flight action successful. Call when XP or inventory evidence appears. */
    resolveActionSuccess(botName: string, result?: string): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t || !t.currentAction || t.currentAction.status !== 'running') return;
            this.endAction(botName, t.currentAction, 'success', result);
        } catch {
            /* noop */
        }
    }

    /** Marks the bot's in-flight action timed out if it has been running too long with no resolution. */
    resolveStaleAction(botName: string, timeoutTicks = 30): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t || !t.currentAction) return;
            const age = this.currentTick - t.currentAction.startedTick;
            if (age > timeoutTicks) {
                this.endAction(botName, t.currentAction, 'timeout', undefined, `no resolution after ${age} ticks`);
            }
        } catch {
            /* noop */
        }
    }

    // ── Destinations / targets / recovery ────────────────────────────────────

    noteDestination(botName: string, x: number, z: number, level: number): void {
        if (!this.enabled) return;
        try {
            this.tracker(botName)?.noteDestination(x, z, level);
        } catch {
            /* noop */
        }
    }

    noteTarget(botName: string, name: string): void {
        if (!this.enabled) return;
        try {
            this.tracker(botName)?.noteTarget(name);
        } catch {
            /* noop */
        }
    }

    noteRecovery(botName: string, type: 'detour' | 'teleport' | 'gate' | 'reroute'): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            t.noteRecovery(this.currentTick, type);
            this.event(botName, 'recovery', `${type} recovery triggered`);
            if (type === 'teleport') {
                this.sessionStuckByBot.set(botName, (this.sessionStuckByBot.get(botName) ?? 0) + 1);
            }
        } catch {
            /* noop */
        }
    }

    // ── Planner ───────────────────────────────────────────────────────────────

    recordPlannerDecision(botName: string, chosen: string | null, reason: string, candidates: BotPlannerDecision['candidates']): void {
        if (!this.enabled) return;
        try {
            const decision: BotPlannerDecision = { tick: this.currentTick, time: Date.now(), candidates, chosen, reason };
            this.tracker(botName)?.recordPlannerDecision(decision);
            this.event(botName, 'planner', `Planner chose ${chosen ?? 'nothing'}: ${reason}`);
        } catch {
            /* noop */
        }
    }

    // ── Combat ────────────────────────────────────────────────────────────────

    noteCombatDamage(botName: string, dealt: number | null, received: number | null): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (!t) return;
            if (dealt !== null) t.lastDamageDealt = dealt;
            if (received !== null) t.lastDamageReceived = received;
        } catch {
            /* noop */
        }
    }

    noteTargetSwitch(botName: string): void {
        if (!this.enabled) return;
        try {
            const t = this.tracker(botName);
            if (t) t.targetSwitches++;
        } catch {
            /* noop */
        }
    }

    // ── Snapshot builders ─────────────────────────────────────────────────────

    listSummaries(): BotSummary[] {
        if (!this.enabled) return [];
        const out: BotSummary[] = [];
        for (const [name, bot] of this.bots) {
            try {
                const s = this._buildSummary(name, bot);
                if (s) out.push(s);
            } catch {
                /* skip this bot's snapshot on failure */
            }
        }
        return out;
    }

    getDetail(name: string): BotDetail | null {
        if (!this.enabled) return null;
        try {
            const bot = this.bots.get(name);
            if (!bot) return null;
            return this._buildDetail(name, bot);
        } catch {
            return null;
        }
    }

    getEvents(botName?: string, category?: string, limit = 300): BotDebugEvent[] {
        if (!this.enabled) return [];
        try {
            let events = botName ? (this.tracker(botName)?.allEvents() ?? []) : this.globalEvents;
            if (category) events = events.filter(e => e.category === category);
            return events.slice(Math.max(0, events.length - limit));
        } catch {
            return [];
        }
    }

    getMetrics(): BotDebugMetrics {
        const summaries = this.listSummaries();
        let slowestBot: string | null = null;
        let slowestMs = -1;
        let slowestTask: string | null = null;
        for (const [name, t] of this.trackers) {
            if (t.lastTickDurationMs > slowestMs) {
                slowestMs = t.lastTickDurationMs;
                slowestBot = name;
                slowestTask = t.currentTaskName;
            }
        }
        const avg = this.tickDurations.length > 0 ? this.tickDurations.reduce((a, b) => a + b, 0) / this.tickDurations.length : 0;
        const max = this.tickDurations.length > 0 ? Math.max(...this.tickDurations) : 0;

        return {
            activeBots: summaries.filter(s => s.online).length,
            movingBots: summaries.filter(s => s.moving).length,
            idleBots: summaries.filter(s => s.task === null || s.task === 'idle').length,
            combatBots: summaries.filter(s => s.task?.startsWith('Combat')).length,
            stuckBots: summaries.filter(s => s.stuck).length,
            warningBots: summaries.filter(s => s.warningCount > 0).length,
            errorBots: summaries.filter(s => s.errorCount > 0).length,
            avgTickDurationMs: Math.round(avg * 100) / 100,
            maxTickDurationMs: Math.round(max * 100) / 100,
            slowestBot,
            slowestTask,
            eventsPerSecond: this.eventsPerSecond,
            dashboardClients: this.dashboardClients,
            lastTickAt: Date.now()
        };
    }

    /** Printed/returned on graceful shutdown — see spec #34. */
    sessionSummary(): string {
        const runtimeMs = Date.now() - this.startedAtMs;
        const mins = Math.floor(runtimeMs / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const lines: string[] = [];
        lines.push('Bot Debug Session');
        lines.push('');
        lines.push(`Runtime: ${h}h ${m}m`);
        lines.push(`Bots observed: ${this.trackers.size}`);
        lines.push('');
        lines.push('Actions:');
        lines.push(`${this.sessionActionTotals.success} success`);
        lines.push(`${this.sessionActionTotals.timeout} timeout`);
        lines.push(`${this.sessionActionTotals.failed} failed`);
        lines.push('');
        const topFailures = [...this.sessionFailuresByTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topFailures.length > 0) {
            lines.push('Most failures:');
            for (const [task, count] of topFailures) lines.push(`${task.padEnd(18)}${count}`);
            lines.push('');
        }
        const topStuck = [...this.sessionStuckByBot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topStuck.length > 0) {
            lines.push('Most stuck (teleport recoveries):');
            for (const [bot, count] of topStuck) lines.push(`${bot.padEnd(18)}${count} events`);
        }
        return lines.join('\n');
    }

    // ── Internal snapshot construction ───────────────────────────────────────

    private _buildSummary(name: string, bot: DebuggableBot): BotSummary | null {
        const t = this.tracker(name);
        if (!t) return null;
        const p = bot.player;
        const task = bot.currentTask;
        const mv = bot.movementMonitorInfo();
        const inv = p.getInventory(InvType.INV);
        const hp = p.levels?.[3] ?? 0; // PlayerStat.HITPOINTS = 3
        const maxHp = p.baseLevels?.[3] ?? 0;

        return {
            name,
            online: p.slot !== -1,
            planner: bot.planner.personality.name,
            x: p.x,
            z: p.z,
            level: p.level,
            task: task?.name ?? null,
            taskState: t.currentTaskState,
            subTask: null,
            action: t.currentAction?.description ?? null,
            actionTarget: t.currentAction?.target?.name ?? null,
            actionStatus: t.currentAction?.status ?? null,
            ticksInTask: this.currentTick - t.taskEnteredTick,
            ticksInState: this.currentTick - t.stateEnteredTick,
            ticksInAction: t.currentAction ? this.currentTick - t.actionEnteredTick : 0,
            hp,
            maxHp,
            combatLevel: p.combatLevel,
            invUsed: inv ? inv.capacity - inv.freeSlotCount : 0,
            invFree: inv ? inv.freeSlotCount : 0,
            moving: p.hasWaypoints(),
            delayed: p.delayed,
            scriptActive: p.activeScript !== null,
            interactionPending: p.hasInteraction(),
            hasWaypoints: p.hasWaypoints(),
            stuck: mv.isStuck || mv.isOscillating,
            lastEvent: t.lastEventMessage,
            lastError: t.lastError?.message ?? null,
            warningCount: t.recentWarnings(1000).length,
            errorCount: t.errorCount
        };
    }

    private _buildDetail(name: string, bot: DebuggableBot): BotDetail | null {
        const summary = this._buildSummary(name, bot);
        if (!summary) return null;
        const t = this.tracker(name)!;
        const p = bot.player;
        const task = bot.currentTask;
        const mv = bot.movementMonitorInfo();

        const movement: BotMovementSnapshot = {
            x: p.x,
            z: p.z,
            level: p.level,
            destination: null,
            distanceToDestination: null,
            moving: p.hasWaypoints(),
            delayed: p.delayed,
            waypointCount: 0,
            prevX: p.x,
            prevZ: p.z,
            tilesMovedRecently: 0
        };
        const lastDest = t.recentDestinations().slice(-1)[0];
        if (lastDest) {
            movement.destination = { x: lastDest.x, z: lastDest.z };
            movement.distanceToDestination = Math.abs(p.x - lastDest.x) + Math.abs(p.z - lastDest.z);
        }

        const stuckInfo: BotStuckSnapshot = {
            isStuck: mv.isStuck,
            isOscillating: mv.isOscillating,
            ticksWithoutProgress: mv.stuckTicks,
            desperatelyStuck: t.teleportRecoveries > 0 && t.lastRecoveryType === 'teleport',
            escapeAttempts: t.escapeAttempts,
            lastRecoveryTick: t.lastRecoveryTick,
            lastRecoveryType: t.lastRecoveryType,
            detourAttempts: t.detourAttempts,
            teleportRecoveries: t.teleportRecoveries
        };

        const script: BotScriptSnapshot = {
            active: p.activeScript !== null,
            execution: p.activeScript?.execution ?? null,
            executionName: p.activeScript ? this._executionName(p.activeScript.execution) : null,
            delayed: p.delayed,
            scriptFile: p.activeScript?.script?.info?.scriptName ?? null,
            ticksActive: 0
        };

        let taskDebug: BotTaskDebugInfo | null = null;
        if (task) {
            try {
                if (typeof task.getDebugInfo === 'function') {
                    taskDebug = task.getDebugInfo(p);
                } else {
                    // Safe generic fallback: most tasks keep a private `state` field.
                    const anyTask = task as unknown as Record<string, unknown>;
                    taskDebug = {
                        task: task.name,
                        state: typeof anyTask.state === 'string' ? (anyTask.state as string) : undefined
                    };
                }
            } catch {
                taskDebug = { task: task.name };
            }
        }

        const detail: BotDetail = {
            ...summary,
            accountId: null,
            slot: p.slot,
            ticksAlive: bot.ticksAliveValue,
            onlineTicks: bot.ticksAliveValue,
            movement,
            stuckInfo,
            taskDebug,
            script,
            skills: this._buildSkills(name, p),
            inventory: this._buildInventory(p),
            combat: null,
            plannerDetail: {
                personality: bot.planner.personality.name,
                lastDecision: t.lastPlannerDecision(),
                recentDecisions: t.recentPlannerDecisions(),
                rescanCountdown: bot.plannerRescanCountdown,
                planFailCount: bot.plannerFailCount
            },
            recentActions: t.recentActions(50),
            actionStats: t.actionStats,
            recentDestinations: t.recentDestinations(),
            recentTargets: t.recentTargets(),
            warnings: t.recentWarnings(20),
            lastErrorDetail: t.lastError
        };
        return detail;
    }

    private _executionName(execution: number): string {
        switch (execution) {
            case -1: return 'ABORTED';
            case 0: return 'RUNNING';
            case 1: return 'FINISHED';
            case 2: return 'SUSPENDED';
            case 3: return 'PAUSEBUTTON';
            case 4: return 'COUNTDIALOG';
            case 5: return 'NPC_SUSPENDED';
            case 6: return 'WORLD_SUSPENDED';
            case 7: return 'NAMEDIALOG';
            default: return `UNKNOWN(${execution})`;
        }
    }

    private _buildSkills(botName: string, p: Player): BotSkillSnapshot[] {
        const t = this.tracker(botName)!;
        const out: BotSkillSnapshot[] = [];
        const sessionMs = Date.now() - t.sessionStartedAtMs;
        for (let stat = 0; stat < 21; stat++) {
            if (!PlayerStatEnabled[stat]) continue;
            const internalXp = p.stats?.[stat] ?? 0;
            t.noteXpBaseline(stat, internalXp);
            const level = p.baseLevels?.[stat] ?? 1;
            const currentLevel = p.levels?.[stat] ?? level;
            const displayXp = internalXp / 10;
            const nextThreshold = internalXpForLevel(level);
            const sessionStart = t.xpSessionStart.get(stat) ?? internalXp;
            const taskStart = t.xpTaskStart.get(stat) ?? internalXp;
            const gainedSession = (internalXp - sessionStart) / 10;
            const gainedTask = (internalXp - taskStart) / 10;
            const lastGainTick = t.xpLastGainTick.get(stat);

            let xpPerHour: number | null = null;
            if (sessionMs > 30000 && gainedSession > 0) {
                xpPerHour = Math.round(gainedSession * (3600000 / sessionMs));
            }

            out.push({
                stat,
                name: PlayerStatNameMap.get(stat) ?? `STAT${stat}`,
                level: currentLevel,
                baseLevel: level,
                xp: Math.round(displayXp * 10) / 10,
                xpForNextLevel: nextThreshold !== null ? nextThreshold / 10 : null,
                xpToNextLevel: nextThreshold !== null ? Math.round((nextThreshold - internalXp) / 10 * 10) / 10 : null,
                xpGainedSession: Math.round(gainedSession * 10) / 10,
                xpGainedTask: Math.round(gainedTask * 10) / 10,
                xpPerHour,
                recentlyGained: lastGainTick !== undefined && this.currentTick - lastGainTick < 20
            });
        }
        return out;
    }

    private _buildInventory(p: Player): BotInventorySnapshot {
        const inv = p.getInventory(InvType.INV);
        const slots: BotInventorySnapshot['slots'] = [];
        let coins = 0;
        if (inv) {
            for (let i = 0; i < inv.capacity; i++) {
                const item = inv.get(i);
                if (!item) continue;
                slots.push({ slot: i, id: item.id, name: itemName(item.id), count: item.count });
                if (item.id === 995) coins += item.count; // COINS
            }
        }
        return {
            slots,
            freeSlots: inv ? inv.freeSlotCount : 0,
            usedSlots: inv ? inv.capacity - inv.freeSlotCount : 0,
            coins
        };
    }
}

export const BotDebugService = new BotDebugServiceClass();

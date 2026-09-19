/**
 * BotDebugTracker.ts
 *
 * One instance per bot. Holds bounded, JSON-safe diagnostic state:
 * event ring buffer, action history, XP/inventory deltas, planner decisions,
 * stuck/recovery counters, and recent destinations/targets.
 *
 * Never stores references to live engine objects (Player/Npc/Loc) — only
 * normalized primitives — so nothing here pins engine memory or grows
 * unbounded.
 */

import type {
    BotDebugAction,
    BotActionStatus,
    BotActionTypeStats,
    BotActionStatsByType,
    BotDebugActionTarget,
    BotDebugEvent,
    BotDebugEventCategory,
    BotWarning,
    BotDebugError,
    BotPlannerDecision
} from '#/engine/bot/debug/BotDebugTypes.js';

/** Simple bounded ring buffer — push evicts the oldest entry once full. */
class RingBuffer<T> {
    private readonly items: T[] = [];
    constructor(private capacity: number) {}

    push(item: T): void {
        this.items.push(item);
        if (this.items.length > this.capacity) this.items.shift();
    }

    setCapacity(cap: number): void {
        this.capacity = cap;
        while (this.items.length > this.capacity) this.items.shift();
    }

    toArray(): T[] {
        return this.items.slice();
    }

    last(n = 1): T[] {
        return this.items.slice(Math.max(0, this.items.length - n));
    }

    get length(): number {
        return this.items.length;
    }

    find(pred: (item: T) => boolean): T | undefined {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (pred(this.items[i])) return this.items[i];
        }
        return undefined;
    }
}

const DEFAULT_ACTION_HISTORY = 200;
const DESTINATION_HISTORY = 10;
const TARGET_HISTORY = 10;
const PLANNER_HISTORY = 20;
const WARNING_HISTORY = 50;

let nextEventId = 1;
let nextActionId = 1;
let nextWarningId = 1;
let nextErrorId = 1;

export class BotDebugTracker {
    readonly botName: string;

    // ── Identity / lifecycle ────────────────────────────────────────────────
    registeredAtTick = 0;
    online = true;

    // ── Task / state timers ─────────────────────────────────────────────────
    currentTaskName: string | null = null;
    taskEnteredTick = 0;
    currentTaskState: string | null = null;
    stateEnteredTick = 0;
    lastTransition: string | null = null;

    // ── Current action ───────────────────────────────────────────────────────
    currentAction: BotDebugAction | null = null;
    actionEnteredTick = 0;

    // ── Events ────────────────────────────────────────────────────────────────
    private events: RingBuffer<BotDebugEvent>;
    lastEventMessage: string | null = null;

    // ── Actions ───────────────────────────────────────────────────────────────
    private actions = new RingBuffer<BotDebugAction>(DEFAULT_ACTION_HISTORY);
    actionStats: BotActionStatsByType = {};

    // ── Warnings / errors ────────────────────────────────────────────────────
    private warnings = new RingBuffer<BotWarning>(WARNING_HISTORY);
    lastError: BotDebugError | null = null;
    errorCount = 0;

    // ── Planner ───────────────────────────────────────────────────────────────
    private plannerDecisions = new RingBuffer<BotPlannerDecision>(PLANNER_HISTORY);

    // ── XP tracking (all values in DISPLAY xp, i.e. internal/10) ─────────────
    readonly xpSessionStart = new Map<number, number>();
    readonly xpTaskStart = new Map<number, number>();
    readonly xpLastGainTick = new Map<number, number>();
    sessionStartedAtMs = Date.now();

    // ── Destinations / targets ───────────────────────────────────────────────
    private destinations = new RingBuffer<{ x: number; z: number; level: number; time: number }>(DESTINATION_HISTORY);
    private targets = new RingBuffer<{ name: string; time: number }>(TARGET_HISTORY);

    // ── Stuck / recovery ──────────────────────────────────────────────────────
    escapeAttempts = 0;
    detourAttempts = 0;
    teleportRecoveries = 0;
    lastRecoveryTick: number | null = null;
    lastRecoveryType: string | null = null;

    // ── Combat ────────────────────────────────────────────────────────────────
    targetSwitches = 0;
    lastDamageDealt: number | null = null;
    lastDamageReceived: number | null = null;

    // ── Perf ──────────────────────────────────────────────────────────────────
    lastTickDurationMs = 0;
    maxTickDurationMs = 0;

    constructor(botName: string, eventHistory: number) {
        this.botName = botName;
        this.events = new RingBuffer<BotDebugEvent>(eventHistory);
    }

    setEventHistoryCapacity(n: number): void {
        this.events.setCapacity(n);
    }

    // ── Events ────────────────────────────────────────────────────────────────

    recordEvent(tick: number, category: BotDebugEventCategory, message: string, data?: Record<string, unknown>): BotDebugEvent {
        const evt: BotDebugEvent = { id: nextEventId++, tick, time: Date.now(), bot: this.botName, category, message, data };
        this.events.push(evt);
        this.lastEventMessage = message;
        return evt;
    }

    recentEvents(n = 100): BotDebugEvent[] {
        return this.events.last(n);
    }

    allEvents(): BotDebugEvent[] {
        return this.events.toArray();
    }

    // ── Warnings / errors ────────────────────────────────────────────────────

    recordWarning(tick: number, kind: string, message: string): BotWarning {
        const w: BotWarning = { id: nextWarningId++, time: Date.now(), tick, bot: this.botName, message, kind };
        this.warnings.push(w);
        this.recordEvent(tick, 'warning', message, { kind });
        return w;
    }

    recentWarnings(n = 20): BotWarning[] {
        return this.warnings.last(n);
    }

    recordError(tick: number, x: number, z: number, level: number, message: string, stack?: string): BotDebugError {
        this.errorCount++;
        const err: BotDebugError = {
            id: nextErrorId++,
            time: Date.now(),
            tick,
            bot: this.botName,
            task: this.currentTaskName,
            taskState: this.currentTaskState,
            x, z, level,
            message,
            stack,
            precedingEvents: this.events.last(10)
        };
        this.lastError = err;
        this.recordEvent(tick, 'error', message);
        return err;
    }

    // ── Task / state transitions ─────────────────────────────────────────────

    noteTaskChange(tick: number, taskName: string | null): void {
        if (this.currentTaskName === taskName) return;
        const from = this.currentTaskName;
        this.currentTaskName = taskName;
        this.taskEnteredTick = tick;
        this.currentTaskState = null;
        this.stateEnteredTick = tick;
        this.lastTransition = `${from ?? 'none'} -> ${taskName ?? 'none'}`;
        this.xpTaskStart.clear();
        this.recordEvent(tick, 'task', `${taskName ?? 'idle'} selected`, { from });
    }

    noteStateChange(tick: number, state: string | null): void {
        if (this.currentTaskState === state) return;
        const from = this.currentTaskState;
        this.currentTaskState = state;
        this.stateEnteredTick = tick;
        this.lastTransition = `${from ?? 'none'} -> ${state ?? 'none'}`;
        this.recordEvent(tick, 'state', `${from ?? 'start'} -> ${state ?? 'none'}`);
    }

    // ── Actions ───────────────────────────────────────────────────────────────

    startAction(tick: number, type: string, description: string, target?: BotDebugActionTarget): BotDebugAction {
        const action: BotDebugAction = {
            id: nextActionId++,
            type,
            description,
            startedTick: tick,
            status: 'running',
            target
        };
        this.currentAction = action;
        this.actionEnteredTick = tick;
        this.actions.push(action);

        if (!this.actionStats[type]) this.actionStats[type] = { attempts: 0, success: 0, failed: 0, timeout: 0 };
        this.actionStats[type].attempts++;

        return action;
    }

    endAction(action: BotDebugAction, tick: number, status: BotActionStatus, result?: string, failureReason?: string): void {
        action.endedTick = tick;
        action.status = status;
        if (result) action.result = result;
        if (failureReason) action.failureReason = failureReason;
        if (this.currentAction === action) this.currentAction = null;

        const stats = this.actionStats[action.type];
        if (stats) {
            if (status === 'success') stats.success++;
            else if (status === 'timeout') stats.timeout++;
            else if (status === 'failed') stats.failed++;
        }
    }

    recentActions(n = 50): BotDebugAction[] {
        return this.actions.last(n);
    }

    // ── Planner ───────────────────────────────────────────────────────────────

    recordPlannerDecision(decision: BotPlannerDecision): void {
        this.plannerDecisions.push(decision);
    }

    lastPlannerDecision(): BotPlannerDecision | null {
        const arr = this.plannerDecisions.last(1);
        return arr.length > 0 ? arr[0] : null;
    }

    recentPlannerDecisions(n = 10): BotPlannerDecision[] {
        return this.plannerDecisions.last(n);
    }

    // ── XP ────────────────────────────────────────────────────────────────────

    noteXpBaseline(stat: number, currentXp: number): void {
        if (!this.xpSessionStart.has(stat)) this.xpSessionStart.set(stat, currentXp);
        if (!this.xpTaskStart.has(stat)) this.xpTaskStart.set(stat, currentXp);
    }

    noteXpGain(tick: number, stat: number, currentXp: number): void {
        this.noteXpBaseline(stat, currentXp);
        this.xpLastGainTick.set(stat, tick);
    }

    // ── Destinations / targets ───────────────────────────────────────────────

    noteDestination(x: number, z: number, level: number): void {
        const last = this.destinations.last(1)[0];
        if (last && last.x === x && last.z === z && last.level === level) return;
        this.destinations.push({ x, z, level, time: Date.now() });
    }

    recentDestinations(): { x: number; z: number; level: number; time: number }[] {
        return this.destinations.toArray();
    }

    noteTarget(name: string): void {
        const last = this.targets.last(1)[0];
        if (last && last.name === name) return;
        this.targets.push({ name, time: Date.now() });
    }

    recentTargets(): { name: string; time: number }[] {
        return this.targets.toArray();
    }

    // ── Stuck / recovery ──────────────────────────────────────────────────────

    noteRecovery(tick: number, type: 'detour' | 'teleport' | 'gate' | 'reroute'): void {
        this.lastRecoveryTick = tick;
        this.lastRecoveryType = type;
        if (type === 'teleport') this.teleportRecoveries++;
        else this.detourAttempts++;
    }
}

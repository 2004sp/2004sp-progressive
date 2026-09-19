/**
 * BotDebugTypes.ts
 *
 * Shared, JSON-safe type definitions for the bot debugger.
 *
 * Nothing in this file references live engine objects (Player/Npc/Loc/etc).
 * Everything here is a normalized primitive snapshot so it can be sent to a
 * browser and retained in bounded ring buffers without pinning engine memory.
 */

// ── Task debug info (opt-in, non-invasive) ─────────────────────────────────────

/**
 * A task may optionally implement `getDebugInfo(player)` on BotTask to expose
 * structured diagnostic state. If a task does not implement it, BotDebugService
 * falls back to reading `.state` off the task instance (present on almost every
 * task already) via a safe try/catch.
 */
export interface BotTaskDebugInfo {
    task: string;
    state?: string;
    target?: string;
    destination?: {
        x: number;
        z: number;
        level: number;
    };
    details?: Record<string, unknown>;
}

// ── Actions ──────────────────────────────────────────────────────────────────

export type BotActionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';

export type BotActionTargetType = 'npc' | 'loc' | 'obj' | 'tile' | 'player' | 'script' | 'item';

export interface BotDebugActionTarget {
    type: BotActionTargetType;
    id?: number;
    name?: string;
    x?: number;
    z?: number;
    level?: number;
}

export interface BotDebugAction {
    id: number;
    type: string; // e.g. 'walk', 'interactNpc', 'interactLoc', 'addXp', 'addItem', 'removeItem'
    description: string;
    startedTick: number;
    endedTick?: number;
    status: BotActionStatus;
    target?: BotDebugActionTarget;
    result?: string;
    failureReason?: string;
}

// ── Events (rolling timeline) ───────────────────────────────────────────────

export type BotDebugEventCategory =
    | 'task'
    | 'state'
    | 'planner'
    | 'movement'
    | 'path'
    | 'interaction'
    | 'npc'
    | 'loc'
    | 'object'
    | 'inventory'
    | 'xp'
    | 'combat'
    | 'script'
    | 'banking'
    | 'shop'
    | 'stuck'
    | 'recovery'
    | 'warning'
    | 'error';

export interface BotDebugEvent {
    id: number;
    tick: number;
    time: number; // Date.now()
    bot: string;
    category: BotDebugEventCategory;
    message: string;
    data?: Record<string, unknown>;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export interface BotDebugError {
    id: number;
    time: number;
    tick: number;
    bot: string;
    task: string | null;
    taskState: string | null;
    x: number;
    z: number;
    level: number;
    message: string;
    stack?: string;
    precedingEvents: BotDebugEvent[];
}

// ── Planner reasoning ────────────────────────────────────────────────────────

export interface BotPlannerCandidate {
    name: string;
    weight?: number;
    shouldRun: boolean;
    reason?: string;
}

export interface BotPlannerDecision {
    tick: number;
    time: number;
    candidates: BotPlannerCandidate[];
    chosen: string | null;
    reason: string;
}

// ── Skills / XP ──────────────────────────────────────────────────────────────

export interface BotSkillSnapshot {
    stat: number;
    name: string;
    level: number;
    baseLevel: number;
    xp: number; // display xp (already divided by 10)
    xpForNextLevel: number | null;
    xpToNextLevel: number | null;
    xpGainedSession: number;
    xpGainedTask: number;
    xpPerHour: number | null;
    recentlyGained: boolean;
}

// ── Inventory ────────────────────────────────────────────────────────────────

export interface BotInventorySlot {
    slot: number;
    id: number;
    name: string;
    count: number;
}

export interface BotInventorySnapshot {
    slots: BotInventorySlot[];
    freeSlots: number;
    usedSlots: number;
    coins: number;
}

// ── Movement ─────────────────────────────────────────────────────────────────

export interface BotMovementSnapshot {
    x: number;
    z: number;
    level: number;
    destination: { x: number; z: number } | null;
    distanceToDestination: number | null;
    moving: boolean;
    delayed: boolean;
    waypointCount: number;
    prevX: number;
    prevZ: number;
    tilesMovedRecently: number;
}

// ── Stuck detection ──────────────────────────────────────────────────────────

export interface BotStuckSnapshot {
    isStuck: boolean;
    isOscillating: boolean;
    ticksWithoutProgress: number;
    desperatelyStuck: boolean;
    escapeAttempts: number;
    lastRecoveryTick: number | null;
    lastRecoveryType: string | null;
    detourAttempts: number;
    teleportRecoveries: number;
}

// ── Script inspector ─────────────────────────────────────────────────────────

export interface BotScriptSnapshot {
    active: boolean;
    execution: number | null;
    executionName: string | null;
    delayed: boolean;
    scriptFile: string | null;
    ticksActive: number;
}

// ── Combat ───────────────────────────────────────────────────────────────────

export interface BotCombatSnapshot {
    inCombat: boolean;
    targetId: number | null;
    targetName: string | null;
    targetX: number | null;
    targetZ: number | null;
    distance: number | null;
    style: number | null;
    weapon: string | null;
    lastDamageDealt: number | null;
    lastDamageReceived: number | null;
    foodCount: number;
    targetSwitches: number;
}

// ── Action statistics ────────────────────────────────────────────────────────

export interface BotActionTypeStats {
    attempts: number;
    success: number;
    failed: number;
    timeout: number;
}

export type BotActionStatsByType = Record<string, BotActionTypeStats>;

// ── Warnings ─────────────────────────────────────────────────────────────────

export interface BotWarning {
    id: number;
    time: number;
    tick: number;
    bot: string;
    message: string;
    kind: string;
}

// ── Bot summary (list view) ──────────────────────────────────────────────────

export interface BotSummary {
    name: string;
    online: boolean;
    planner: string;
    x: number;
    z: number;
    level: number;
    task: string | null;
    taskState: string | null;
    subTask: string | null;
    action: string | null;
    actionTarget: string | null;
    actionStatus: BotActionStatus | null;
    ticksInTask: number;
    ticksInState: number;
    ticksInAction: number;
    hp: number;
    maxHp: number;
    combatLevel: number;
    invUsed: number;
    invFree: number;
    moving: boolean;
    delayed: boolean;
    scriptActive: boolean;
    interactionPending: boolean;
    hasWaypoints: boolean;
    stuck: boolean;
    lastEvent: string | null;
    lastError: string | null;
    warningCount: number;
    errorCount: number;
}

// ── Full bot detail (inspector view) ─────────────────────────────────────────

export interface BotDetail extends BotSummary {
    accountId: number | null;
    slot: number;
    ticksAlive: number;
    onlineTicks: number;
    movement: BotMovementSnapshot;
    stuckInfo: BotStuckSnapshot;
    taskDebug: BotTaskDebugInfo | null;
    script: BotScriptSnapshot;
    skills: BotSkillSnapshot[];
    inventory: BotInventorySnapshot;
    combat: BotCombatSnapshot | null;
    plannerDetail: {
        personality: string;
        lastDecision: BotPlannerDecision | null;
        recentDecisions: BotPlannerDecision[];
        rescanCountdown: number;
        planFailCount: number;
    };
    recentActions: BotDebugAction[];
    actionStats: BotActionStatsByType;
    recentDestinations: { x: number; z: number; level: number; time: number }[];
    recentTargets: { name: string; time: number }[];
    warnings: BotWarning[];
    lastErrorDetail: BotDebugError | null;
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export interface BotDebugMetrics {
    activeBots: number;
    movingBots: number;
    idleBots: number;
    combatBots: number;
    stuckBots: number;
    warningBots: number;
    errorBots: number;
    avgTickDurationMs: number;
    maxTickDurationMs: number;
    slowestBot: string | null;
    slowestTask: string | null;
    eventsPerSecond: number;
    dashboardClients: number;
    lastTickAt: number;
}

// ── Config exposed to dashboard ──────────────────────────────────────────────

export interface BotDebugConfigInfo {
    enabled: boolean;
    level: string;
    eventHistory: number;
    snapshotIntervalMs: number;
}

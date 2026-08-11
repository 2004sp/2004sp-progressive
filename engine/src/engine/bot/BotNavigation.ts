/**
 * BotNavigation.ts
 *
 * Central navigation layer for bot movement.  All bot path generation and
 * movement validation goes through here so tasks benefit automatically.
 *
 * Architecture:
 *
 *   BotTask / BotAction.walkTo()
 *          ↓
 *     BotNavigation          ← this file
 *       canBotStep()         — engine canTravel + CSV check
 *       trimPathAtCsvBlock() — strip CSV-blocked steps from rsmod path
 *       findNearestWalkableTile() — fallback when destination is blocked
 *          ↓
 *   rsmod pathfinder (botWalkPath / canTravel)
 *   +
 *   BotCollisionMap.isCsvBlocked()
 *
 * Directional wall/fence collision is handled entirely by the rsmod pathfinder
 * via canTravel() and botWalkPath().  The CSV is a supplementary rejection layer
 * only — it cannot and does not express directional collision.
 *
 * BotMovementMonitor (per-bot instance):
 *   - Tracks position history each tick
 *   - Detects stuck (waypoints active but no position change for N ticks)
 *   - Detects oscillation (A→B→A→B or A→B→C→A→B→C cycles)
 *   - Maintains a short-lived failed-edge cache
 */

import { CollisionType } from '@2004scape/rsmod-pathfinder';
import { canTravel, isMapBlocked, botWalkPath } from '#/engine/GameMap.js';
import { BotCollisionMap } from '#/engine/bot/BotCollisionMap.js';

// ── canBotStep ────────────────────────────────────────────────────────────────

/**
 * Returns true if a bot can step from (x, z) to (nx, nz) on the given level.
 *
 * Combines TWO independent checks:
 *   1. Engine collision via canTravel() — handles directional walls, fences,
 *      blocked tiles, and diagonal corner-cutting correctly.
 *   2. CSV supplementary check — rejects destinations in unwalkable_tiles.csv.
 *
 * This is the ground-truth for "can a bot physically take this step?"
 * It is exposed as a debug helper and used by trimPathAtCsvBlock.
 */
export function canBotStep(level: number, x: number, z: number, nx: number, nz: number): boolean {
    const dx = nx - x;
    const dz = nz - z;
    if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) return false;
    if (BotCollisionMap.isCsvBlocked(level, nx, nz)) return false;
    return true;
}

/** Convenience: is a tile blocked by the CSV alone? */
export function isBotTileBlocked(level: number, x: number, z: number): boolean {
    return BotCollisionMap.isCsvBlocked(level, x, z) || isMapBlocked(x, z, level);
}

// ── Path trimming ─────────────────────────────────────────────────────────────

/**
 * Remove CSV-blocked destinations from the tail of an rsmod path.
 *
 * rsmod returns paths as Uint32Array where:
 *   path[path.length-1] = first step to execute (closest to src)
 *   path[0]             = destination (furthest from src)
 *
 * We iterate in execution order (length-1 → 0) and truncate the path just
 * before the first CSV-blocked step, returning a path that stops at the
 * last safe destination.
 *
 * The engine's directional collision is already baked into the rsmod path so
 * we only need to apply the CSV layer here.
 */
export function trimPathAtCsvBlock(level: number, path: Uint32Array): Uint32Array {
    if (path.length === 0 || !BotCollisionMap.isLoaded) return path;

    // Iterate in execution order: from path[path.length-1] towards path[0]
    for (let i = path.length - 1; i >= 0; i--) {
        const coord = path[i];
        const z = coord & 0x3fff;
        const x = (coord >> 14) & 0x3fff;
        // level bits in packed coord: (coord >> 28) & 0x3
        // but rsmod may pack level differently — use the level param instead
        if (BotCollisionMap.isCsvBlocked(level, x, z)) {
            // path[i] is blocked — keep only path[i+1 .. path.length-1]
            if (i + 1 >= path.length) return new Uint32Array(0); // first step blocked
            return path.slice(i + 1);
        }
    }
    return path; // no CSV-blocked steps found
}

// ── Destination validation ────────────────────────────────────────────────────

/**
 * Find the nearest tile to (destX, destZ) that is not CSV-blocked and not
 * WALK_BLOCKED according to rsmod.  Searches outward from radius 0 to maxRadius.
 *
 * Returns the original destination if it is already walkable, or the nearest
 * alternative, or null if no walkable tile is found within maxRadius.
 *
 * Does NOT run full pathfinding for each candidate — it only checks static
 * tile flags.  If the found tile is unreachable due to walls, stuck detection
 * in BotMovementMonitor will catch it.
 */
export function findNearestWalkableTile(
    level: number,
    destX: number,
    destZ: number,
    maxRadius: number = 5
): { x: number; z: number } | null {
    // Radius 0: dest itself
    if (!BotCollisionMap.isCsvBlocked(level, destX, destZ) && !isMapBlocked(destX, destZ, level)) {
        return { x: destX, z: destZ };
    }

    for (let r = 1; r <= maxRadius; r++) {
        let best: { x: number; z: number } | null = null;
        let bestDistSq = Infinity;

        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // border of ring only
                const cx = destX + dx;
                const cz = destZ + dz;
                if (BotCollisionMap.isCsvBlocked(level, cx, cz)) continue;
                if (isMapBlocked(cx, cz, level)) continue;
                const dSq = dx * dx + dz * dz;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    best = { x: cx, z: cz };
                }
            }
        }

        if (best) return best;
    }

    return null;
}

// ── Debug helpers ─────────────────────────────────────────────────────────────

/**
 * Explain why a step from (x,z) → (nx,nz) is blocked.
 * Returns a short reason string for logging.
 */
export function explainBlockedStep(level: number, x: number, z: number, nx: number, nz: number): string {
    if (BotCollisionMap.isCsvBlocked(level, nx, nz)) return `csv_blocked(${nx},${nz})`;
    if (isMapBlocked(nx, nz, level)) return `WALK_BLOCKED(${nx},${nz})`;
    const dx = nx - x;
    const dz = nz - z;
    if (!canTravel(level, x, z, dx, dz, 1, 0, CollisionType.NORMAL)) return `edge_blocked(${x},${z})->(${nx},${nz})`;
    return 'no_issue';
}

/**
 * Validate a bot path step-by-step, returning a human-readable report string.
 * Useful in debug scenarios to diagnose exactly which step in a generated path is bad.
 */
export function validateBotPath(level: number, srcX: number, srcZ: number, path: Uint32Array): string {
    if (path.length === 0) return 'empty_path';

    let cx = srcX;
    let cz = srcZ;

    // Iterate in execution order: path[length-1] → path[0]
    for (let i = path.length - 1; i >= 0; i--) {
        const coord = path[i];
        const nx = (coord >> 14) & 0x3fff;
        const nz = coord & 0x3fff;

        const reason = explainBlockedStep(level, cx, cz, nx, nz);
        if (reason !== 'no_issue') {
            const stepNum = path.length - i;
            return `step${stepNum}:(${cx},${cz})->(${nx},${nz}) ${reason}`;
        }

        cx = nx;
        cz = nz;
    }

    return 'ok';
}

/**
 * Check whether there is any reachable path from src to dest.
 * Runs a full botWalkPath — use sparingly, not every tick.
 */
export function canBotTravel(level: number, srcX: number, srcZ: number, destX: number, destZ: number): boolean {
    const path = botWalkPath(level, srcX, srcZ, destX, destZ);
    return path.length > 0;
}

// ── BotMovementMonitor ────────────────────────────────────────────────────────

const HISTORY_SIZE = 16;
const STUCK_THRESHOLD = 10;      // ticks without movement while waypoints active
const OSCILLATION_MATCH = 3;     // how many consecutive repeated positions = oscillation
const EDGE_EXPIRY_TICKS = 100;   // ~60 s before a failed edge is reconsidered

/**
 * Per-bot movement state tracker.  One instance per BotPlayer.
 *
 * Call update() once per tick (at the top of BotPlayer.tick()).
 * Check isStuck() / isOscillating() and call clearWaypoints() + resetStuck()
 * when recovery is needed.
 */
export class BotMovementMonitor {
    // Rolling position history — each entry is (x<<14)|z (2D, level ignored for cycle detection)
    private readonly posHistory: number[] = [];

    // How many consecutive ticks the bot had waypoints but didn't move
    private stuckTicks = 0;

    // Failed edges: key = `${level}_${x}_${z}_${nx}_${nz}`, value = expiry tick
    private readonly failedEdges: Map<string, number> = new Map();

    /**
     * Call at the TOP of each BotPlayer.tick() with the bot's current position.
     *
     * @param x           Current x (already updated by engine movement this tick)
     * @param z           Current z
     * @param hadWaypoints Whether the bot had waypoints at the END of the previous tick
     * @param moved       True if x/z differs from the previous tick
     */
    update(x: number, z: number, hadWaypoints: boolean, moved: boolean): void {
        // Update position history
        const packed = (x << 14) | (z & 0x3fff);
        if (this.posHistory.length >= HISTORY_SIZE) this.posHistory.shift();
        this.posHistory.push(packed);

        // Stuck tracking: only count when the bot is actively trying to walk
        if (hadWaypoints) {
            if (moved) {
                this.stuckTicks = 0;
            } else {
                this.stuckTicks++;
            }
        } else {
            this.stuckTicks = 0;
        }
    }

    /** True if the bot has been trying to walk without making progress for too long. */
    isStuck(): boolean {
        return this.stuckTicks >= STUCK_THRESHOLD;
    }

    /**
     * True if the recent position history shows a repeating cycle.
     * Detects A→B→A→B (period 2) and A→B→C→A→B→C (period 3) patterns.
     */
    isOscillating(): boolean {
        const h = this.posHistory;
        const len = h.length;
        if (len < 6) return false;

        // Period-2 check: h[n] == h[n-2] for OSCILLATION_MATCH consecutive pairs
        let p2 = 0;
        for (let i = len - 1; i >= 2; i--) {
            if (h[i] === h[i - 2]) {
                p2++;
                if (p2 >= OSCILLATION_MATCH) return true;
            } else {
                break;
            }
        }

        // Period-3 check: h[n] == h[n-3] for OSCILLATION_MATCH consecutive
        let p3 = 0;
        for (let i = len - 1; i >= 3; i--) {
            if (h[i] === h[i - 3]) {
                p3++;
                if (p3 >= OSCILLATION_MATCH) return true;
            } else {
                break;
            }
        }

        return false;
    }

    /** Reset the stuck counter after applying recovery. */
    resetStuck(): void {
        this.stuckTicks = 0;
    }

    /** Reset the position history after applying oscillation recovery. */
    resetOscillation(): void {
        this.posHistory.length = 0;
        this.stuckTicks = 0;
    }

    // ── Failed-edge cache ─────────────────────────────────────────────────────

    /**
     * Record that a step from (x,z) → (nx,nz) failed at currentTick.
     * The edge is remembered for EDGE_EXPIRY_TICKS before being reconsidered
     * (so dynamic objects like doors can reopen).
     */
    addFailedEdge(level: number, x: number, z: number, nx: number, nz: number, currentTick: number): void {
        const key = `${level}_${x}_${z}_${nx}_${nz}`;
        this.failedEdges.set(key, currentTick + EDGE_EXPIRY_TICKS);

        // Prune expired entries to keep the map bounded
        if (this.failedEdges.size > 64) {
            for (const [k, expiry] of this.failedEdges) {
                if (currentTick >= expiry) this.failedEdges.delete(k);
            }
        }
    }

    /** True if this edge was recently recorded as failed and hasn't expired. */
    isEdgeFailed(level: number, x: number, z: number, nx: number, nz: number, currentTick: number): boolean {
        const key = `${level}_${x}_${z}_${nx}_${nz}`;
        const expiry = this.failedEdges.get(key);
        if (expiry === undefined) return false;
        if (currentTick >= expiry) {
            this.failedEdges.delete(key);
            return false;
        }
        return true;
    }

    /** Full reset — call when the bot changes destination or task. */
    reset(): void {
        this.posHistory.length = 0;
        this.stuckTicks = 0;
        this.failedEdges.clear();
    }
}

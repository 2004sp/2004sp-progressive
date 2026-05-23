/**
 * BotTaskBase.ts
 *
 * Shared imports, helpers, constants, and the abstract BotTask base class.
 * All task files import from here.
 */

import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';
import InvType from '#/cache/config/InvType.js';
import { Inventory } from '#/engine/Inventory.js';
import {
    walkTo,
    interactNpc,
    interactNpcOp,
    interactLoc,
    interactLocOp,
    interactUseLocOp,
    interactUseObjNpcOp,
    botInteractUseObjNpc,
    findNpcByName,
    findNpcByNameExcluding,
    findNpcByPrefix,
    findNpcBySuffix,
    findLocByPrefix,
    findLocByName,
    findLocByNameWhere,
    hasItem,
    countItem,
    addItem,
    removeItem,
    isInventoryFull,
    getBaseLevel,
    PlayerStat,
    hasWaypoints,
    addXp,
    setCombatStyle,
    setAutocastWindStrike,
    openNearbyGate,
    isAdjacentToLoc,
    botTeleport
} from '#/engine/bot/BotAction.js';
import { Items, Shops, Locations, getProgressionStep, GRIMY_HERB_MAP, FOOD_IDS } from '#/engine/bot/BotKnowledge.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import type { SkillStep } from '#/engine/bot/BotKnowledge.js';
import { getMissingPurchases, STARTING_COINS } from '#/engine/bot/BotNeeds.js';
import type { Purchase } from '#/engine/bot/BotNeeds.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Ticks before assuming an interaction failed (no XP / no response). */
export const INTERACT_TIMEOUT = 20;

/** Teleport destination when a bot is hopelessly stuck. */
const SAFE_SPAWN: [number, number, number] = Locations.LUMBRIDGE_SPAWN;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function isNear(player: Player, x: number, z: number, dist: number, level = 0): boolean {
    return player.level === level && Math.abs(player.x - x) <= dist && Math.abs(player.z - z) <= dist;
}

/** Returns the bank inventory ID, or -1 if not loaded. */
export function bankInvId(): number {
    try {
        return InvType.getId('bank');
    } catch {
        return -1;
    }
}

/**
 * Teleport bot to Lumbridge spawn — used when stuck with no path forward.
 * Plays the magic teleport animation so other players see the cast effect.
 */
export function teleportToSafety(player: Player): void {
    const [x, z, level] = SAFE_SPAWN;
    botTeleport(player, x, z, level);
}

/**
 * Teleport bot to (x, z, level). Defaults to level 0 (ground floor) because
 * all bot skill destinations and banks are on the ground floor — using
 * player.level caused bots on floor 2 to land inside roofs.
 */
export function teleportNear(player: Player, x: number, z: number, level = 0): void {
    botTeleport(player, x, z, level);
}

/**
 * Return a stable per-bot jitter offset so different bots spread around a
 * shared destination instead of all walking to the exact same tile.
 *
 * Uses the player's slot number as a deterministic seed so the offset is
 * consistent for each bot across ticks (no per-tick re-randomisation).
 *
 * @param radius  Maximum tile offset in each axis (default 5).
 */
// ── Nearest-bank helper ───────────────────────────────────────────────────────

/**
 * All bot-accessible banks on the ground floor.
 * Lumbridge castle 2nd-floor bank is intentionally excluded — bots don't
 * climb stairs.  Al Kharid bank is included; the GATEWAY_REGIONS routing in
 * walkTo handles the gate automatically.
 */
const BOT_BANKS: ReadonlyArray<[number, number, number]> = [
    Locations.DRAYNOR_BANK,
    Locations.VARROCK_WEST_BANK,
    Locations.VARROCK_EAST_BANK,
    Locations.AL_KHARID_BANK,
    Locations.FALADOR_WEST_BANK,
    Locations.FALADOR_EAST_BANK,
    Locations.SEERS_BANK,
    Locations.EDGEVILLE_BANK,
    Locations.YANILLE_BANK,
    Locations.CATHERBY_BANK,
    Locations.ARDOUGNE_NORTH_BANK,
    Locations.ARDOUGNE_SOUTH_BANK
];

/**
 * Returns the [x, z, level] tuple of the bank closest to the player's
 * current tile, using Chebyshev distance.  Tasks should call this once
 * per banking state entry rather than hard-coding a single bank.
 */
export function nearestBank(player: Player): [number, number, number] {
    return nearestBankTo(player.x, player.z);
}

/**
 * Returns the bank closest to an arbitrary coordinate — use this when the
 * relevant reference point is the skill activity location rather than where
 * the player currently stands (e.g. cooking range, furnace).
 */
export function nearestBankTo(x: number, z: number): [number, number, number] {
    let best = BOT_BANKS[0];
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (const bank of BOT_BANKS) {
        const dist = Math.max(Math.abs(x - bank[0]), Math.abs(z - bank[1]));
        if (dist < bestDist) {
            bestDist = dist;
            best = bank;
        }
    }
    return best;
}

// ── botJitter ─────────────────────────────────────────────────────────────────

/**
 * Prime-pair seeds used by botJitter's fallback sequence.
 * Each entry produces a different (jx, jz) spread for the same slot number.
 * Keeping them here as a constant avoids re-allocating the array every tick.
 */
const JITTER_SEEDS: ReadonlyArray<[mx: number, mz: number, bx: number, bz: number]> = [
    [7, 13, 3, 7],
    [11, 17, 5, 11],
    [19, 23, 7, 13],
    [29, 31, 11, 17],
    [37, 41, 13, 19]
];

export function botJitter(player: Player, x: number, z: number, radius = 5): [number, number] {
    const slot = (player as any).slot ?? 0;
    const level = player.level;
    const span = radius * 2 + 1;

    // Try each deterministic seed in order until we land on a walkable tile.
    // Using the slot as the hash input keeps the result stable across ticks
    // (same bot always gets the same jittered destination for a given area).
    for (const [mx, mz, bx, bz] of JITTER_SEEDS) {
        const tx = x + ((slot * mx + bx) % span) - radius;
        const tz = z + ((slot * mz + bz) % span) - radius;
        if (isZoneAllocated(level, tx, tz) && !isMapBlocked(tx, tz, level)) {
            return [tx, tz];
        }
    }

    // All offsets are blocked — return the base tile unchanged
    return [x, z];
}

// ── Abstract base ─────────────────────────────────────────────────────────────

export abstract class BotTask {
    readonly name: string;
    interrupted = false;
    protected cooldown = 0;
    protected rescanTimer = 0;

    protected constructor(name: string) {
        this.name = name;
    }

    abstract shouldRun(player: Player): boolean;
    abstract tick(player: Player): void;
    abstract isComplete(player: Player): boolean;

    interrupt(): void {
        this.interrupted = true;
    }
    reset(): void {
        this.interrupted = false;
        this.cooldown = 0;
        this.rescanTimer = 0;
    }
}

// Re-export everything tasks need so they only import from this one file
export type { SkillStep } from '#/engine/bot/BotKnowledge.js';
export {
    Player,
    Npc,
    Loc,
    InvType,
    Inventory,
    walkTo,
    interactNpc,
    interactNpcOp,
    interactLoc,
    interactLocOp,
    interactUseLocOp,
    findNpcByName,
    findNpcByPrefix,
    findNpcBySuffix,
    findLocByPrefix,
    findLocByName,
    findLocByNameWhere,
    hasItem,
    countItem,
    addItem,
    removeItem,
    isInventoryFull,
    getBaseLevel,
    PlayerStat,
    hasWaypoints,
    addXp,
    setCombatStyle,
    setAutocastWindStrike,
    Items,
    Shops,
    Locations,
    getProgressionStep,
    FOOD_IDS,
    getMissingPurchases,
    STARTING_COINS,
    openNearbyGate,
    isAdjacentToLoc,
    interactUseObjNpcOp,
    botInteractUseObjNpc,
    findNpcByNameExcluding,
    botTeleport
};

// ── Shared banking helper ─────────────────────────────────────────────────────

/**
 * Drives the 'bank_walk' state for any gathering task.
 *
 * Priority order:
 *   1. Bank booth (bankbooth loc, op2 = Use-quickly → @openbank immediately, no dialog).
 *      Works at ALL banks.  Avoids NPC name ambiguity entirely.
 *   2. Banker NPC by prefix 'banker' (Lumbridge 2nd floor, Draynor, Varrock…).
 *   3. Banker NPC by prefix 'kharidbanker' (Al Kharid — debug name starts with 'kharid').
 *   4. Direct fallback: no interactive entity found but bot is already at the bank
 *      tile — proceed to deposit anyway (deposit functions work directly on
 *      inventory objects and do NOT require the bank UI to be open).
 *
 * Returns:
 *   'walk'   — still navigating, caller should return for this tick
 *   'ready'  — interaction queued (or fallback triggered), set cooldown + state
 *   'direct' — fallback: skip interaction, deposit immediately
 */
export function advanceBankWalk(
    player: Player,
    stuckDetector: StuckDetector,
    activityCoord?: [number, number, number],
): 'walk' | 'ready' | 'direct' {
    const [bx, bz, bl] = activityCoord
        ? nearestBankTo(activityCoord[0], activityCoord[1])
        : nearestBank(player);

    if (!isNear(player, bx, bz, 3)) {
        // Still walking — drive bot all the way to the bank coord (which should be
        // inside the building) before the booth search activates.



        if (!stuckDetector.check(player, bx, bz)) {
            walkTo(player, bx, bz);
        } else if (stuckDetector.desperatelyStuck) {
            teleportNear(player, bx, bz, bl);
            stuckDetector.reset();
        } else {
            // Clear existing (bad) waypoints so the hasWaypoints guard in
            // walkTo() doesn't block the detour recalculation.
            player.clearWaypoints();
            walkTo(player, bx + randInt(-4, 4), bz + randInt(-4, 4));
        }
        return 'walk';
    }

    // ── At bank (inside): try booth first ────────────────────────────────────
    // Search radius 6 — large enough to find booths across the floor but small
    // enough not to reach through the walls of the building from outside.
    // The bot is already at the interior coord so no wall-pierce is possible.
    const booth = findLocByName(player.x, player.z, player.level, 'bankbooth', 6);
    if (booth) {
        if (!isNear(player, booth.x, booth.z, 1)) {
            walkTo(player, booth.x, booth.z);
            return 'walk';
        }
        interactLocOp(player, booth, 2); // op2 = Use-quickly → @openbank, no dialog
        return 'ready';
    }

    // ── Fallback: banker NPC ──────────────────────────────────────────────────
    // Al Kharid bankers have debug names starting with 'kharidbanker', not 'banker'.
    const banker = findNpcByPrefix(player.x, player.z, player.level, 'banker', 10) ?? findNpcByPrefix(player.x, player.z, player.level, 'kharidbanker', 10);
    if (banker) {
        if (!isNear(player, banker.x, banker.z, 3)) {
            walkTo(player, banker.x, banker.z);
            return 'walk';
        }
        interactNpcOp(player, banker, 3); // op3 = Bank on standard bankers
        return 'ready';
    }

    // ── Ultimate fallback: deposit without UI interaction ─────────────────────
    // Deposit functions use player.getInventory(bankInvId()) directly — no open
    // bank UI required.  Only reached if no booth or NPC is visible.
    return 'direct';
}

// ── StuckDetector ─────────────────────────────────────────────────────────────

/**
 * Detects both stationary AND oscillating bots.
 *
 * Every WINDOW ticks, compares current distance-to-destination against the
 * snapshot taken WINDOW ticks ago. If the bot hasn't closed the gap by at
 * least MIN_PROGRESS tiles, it's considered stuck — regardless of whether it
 * was stationary or bouncing back and forth.
 */
export class StuckDetector {
    private readonly window: number;
    private readonly minProgress: number;
    private readonly freezeRadius: number;

    private ticks = 0;
    private snapshotDist = -1;
    private snapshotX = -1;
    private snapshotZ = -1;
    private escapeCount = 0;

    private readonly escapeLimit: number;

    /**
     * @param windowTicks       How many ticks between progress checks
     * @param minProgressTiles  Minimum tiles of progress required per window
     * @param escapeLimit       Consecutive failed escape attempts before desperatelyStuck (default 3)
     * @param freezeRadius      If the bot hasn't moved more than this many tiles from its
     *                          snapshot position, skip straight to desperatelyStuck (default 3)
     */
    constructor(windowTicks = 40, minProgressTiles = 5, escapeLimit = 3, freezeRadius = 3) {
        this.window = windowTicks;
        this.minProgress = minProgressTiles;
        this.escapeLimit = escapeLimit;
        this.freezeRadius = freezeRadius;
    }

    /**
     * Call once per walk tick. Returns true when the bot is stuck.
     * If the bot hasn't moved more than freezeRadius tiles from its snapshot
     * position (oscillating or stationary), desperatelyStuck is set immediately
     * so the caller teleports without wasting ticks on detour attempts.
     */
    check(player: { x: number; z: number }, destX: number, destZ: number): boolean {
        if (this.snapshotDist < 0) {
            // Seed snapshot on very first call so the window starts immediately.
            this.snapshotDist = Math.abs(player.x - destX) + Math.abs(player.z - destZ);
            this.snapshotX = player.x;
            this.snapshotZ = player.z;
        }

        if (++this.ticks < this.window) return false;
        this.ticks = 0;

        const dist = Math.abs(player.x - destX) + Math.abs(player.z - destZ);
        const progress = this.snapshotDist - dist;
        const moved = Math.max(Math.abs(player.x - this.snapshotX), Math.abs(player.z - this.snapshotZ));

        this.snapshotDist = dist;
        this.snapshotX = player.x;
        this.snapshotZ = player.z;

        // Bot hasn't left a 3-tile area — oscillating or frozen. Skip detours.
        if (moved <= this.freezeRadius) {
            this.escapeCount = this.escapeLimit;
            return true;
        }

        if (progress < this.minProgress) {
            this.escapeCount++;
            return true;
        }
        this.escapeCount = 0;
        return false;
    }

    /** True after escapeLimit+ failed escapes — teleport rather than detour. */
    get desperatelyStuck(): boolean {
        return this.escapeCount >= this.escapeLimit;
    }

    reset(): void {
        this.ticks = 0;
        this.snapshotDist = -1;
        this.snapshotX = -1;
        this.snapshotZ = -1;
        this.escapeCount = 0;
    }
}

// ── ProgressWatchdog ──────────────────────────────────────────────────────────

/**
 * XP-stall watchdog — measures real progress by XP gain, not by position.
 *
 * Counts ticks without a `notifyActivity()` call. If the stall exceeds the
 * limit the bot is teleported to safety. Banking states can be paused so a
 * legitimate bank trip doesn't trigger a false rescue.
 *
 * Usage in a task's tick():
 *   const banking = this.state === 'bank_walk' || this.state === 'bank_done';
 *   if (this.watchdog.check(player, banking)) { this.stuck.reset(); return; }
 *
 * When XP is gained:
 *   this.watchdog.notifyActivity();
 *
 * Why position-based detection doesn't work:
 *   A bot oscillating between (3210,3198) and (3230,3194) moves ~24 tiles
 *   every window, always appearing to make progress.
 */
export class ProgressWatchdog {
    private readonly limit: number;
    private stallTicks = 0;

    /**
     * When set, the watchdog teleports here instead of Lumbridge on stall.
     * Set to the task's activity location so a rescued bot lands near its target.
     */
    destination?: [number, number, number];

    /**
     * @param stallTickLimit  Ticks without XP before teleport (default 100 ≈ 1 min).
     *                        Short enough to rescue stuck bots quickly, but long enough
     *                        to cover legitimate bank trips and mid-walk delays.
     */
    constructor(stallTickLimit = 100) {
        this.limit = stallTickLimit;
    }

    /** Call when XP was gained. Resets the stall counter. */
    notifyActivity(): void {
        this.stallTicks = 0;
    }

    /**
     * Call every tick. Pass `paused=true` when the task is in a banking state
     * to avoid triggering during legitimate bank trips.
     *
     * Returns true if the bot was teleported (task should call reset() and return).
     */
    check(player: Player, paused = false): boolean {
        if (paused) return false;
        if (++this.stallTicks < this.limit) return false;
        if (this.destination) {
            const [x, z, level] = this.destination;
            botTeleport(player, x, z, level);
        } else {
            teleportToSafety(player);
        }
        this.reset();
        return true;
    }

    reset(): void {
        this.stallTicks = 0;
    }
}

/**
 * Cleans any grimy herbs in the player's inventory and awards Herblore XP.
 * Call this just before banking so cleaned herbs are banked instead of grimy ones.
 */
export function cleanGrimyHerbs(player: Player): void {
    const inv = player.getInventory(InvType.INV);
    if (!inv) return;
    for (let slot = 0; slot < inv.capacity; slot++) {
        const item = inv.get(slot);
        if (!item) continue;
        const entry = GRIMY_HERB_MAP[item.id];
        if (!entry) continue;
        const [cleanId, xp] = entry;
        const removed = inv.remove(item.id, item.count);
        if (removed.completed > 0) {
            inv.add(cleanId, removed.completed);
            addXp(player, PlayerStat.HERBLORE, xp * removed.completed);
        }
    }
}

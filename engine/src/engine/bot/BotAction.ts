/**
 * BotAction.ts
 *
 * Low-level primitives that drive a real Player using the actual engine APIs.
 * Nothing here teleports. Every movement goes through the pathfinder.
 * Every interaction goes through setInteraction(). The engine's processInteraction()
 * client click does.
 *
 * Three categories of action:
 *
 *   WALK     — queueWaypoints via botWalkPath (accurate=true, range=104)
 *   INTERACT — setInteraction(Interaction.ENGINE, target, triggerType)
 *              The engine then walks the player to the target and fires the
 *              script trigger once in range. One call = one click.
 *   WORLD    — helpers to find NPCs and Locs near a coordinate so tasks
 *              can look up their targets before interacting.
 *
 * Import surface exposed to tasks:
 *   walkTo(player, x, z)
 *   isNear(player, x, z, dist)
 *   hasWaypoints(player)
 *   isMoving(player)
 *
 *   interactNpc(player, npc)          — op1 on an NPC (open shop, talk, etc.)
 *   interactLoc(player, loc)          — op1 on a Loc (chop tree, mine rock, etc.)
 *   interactLocOp(player, loc, op)    — opN on a Loc (specific option number)
 *   interactNpcOp(player, npc, op)    — opN on an NPC
 *
 *   findNpcNear(x, z, level, npcTypeId, radius)   — search for a live NPC
 *   findLocNear(x, z, level, locTypeId, radius)   — search for a live Loc
 *   findNpcByName(x, z, level, npcName, radius)   — search by debug name
 *   findLocByName(x, z, level, locName, radius)   — search by debug name
 *
 *   getLevel / getBaseLevel / getXp / addXp
 *   getBackpack / isInventoryFull / freeSlots
 *   countItem / addItem / removeItem / hasItem / clearBackpack
 *   getCombatLevel
 */

import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import InvType from '#/cache/config/InvType.js';
import { getWorld } from '#/engine/bot/BotWorld.js';
import { botWalkPath, botFindPath } from '#/engine/GameMap.js';
import { MoveSpeed } from '#/engine/entity/MoveSpeed.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import Obj from '#/engine/entity/Obj.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import CategoryType from '#/cache/config/CategoryType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import { Inventory } from '#/engine/Inventory.js';
import { Items } from '#/engine/bot/BotKnowledge.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';
import Environment from '#/util/Environment.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import World from '#/engine/World.js';
import * as rsbuf from '@2004scape/rsbuf';

export { PlayerStat };

// ── Teleport helper ───────────────────────────────────────────────────────────

/**
 * Plays the magic teleport animation and spotanim on a bot and then teleports
 * it to (x, z, level).  Mirrors the [proc,player_teleport_normal] RS2 script:
 *
 *   anim(human_castteleport, 0);
 *   spotanim_pl(teleport_casting, 92, 0);
 *   p_telejump($coord);
 *
 * Other players in the zone will see the cast animation on their client for
 * that tick before the bot's position jumps.  IDs are resolved from config
 * names so they remain correct across cache versions.
 *
 * Use this everywhere a bot needs to teleport instead of calling
 * player.teleJump() directly.
 */
export function botTeleport(player: Player, x: number, z: number, level: number): void {
    const animId = SeqType.getId('human_castteleport');
    const spotId = SpotanimType.getId('teleport_casting');
    if (animId !== -1) player.playAnimation(animId, 0);
    if (spotId !== -1) player.spotanim(spotId, 92, 0);

    // Defer the position jump by 2 ticks so the cast animation plays at the
    // SOURCE tile first — mirrors the real [proc,player_teleport_normal] which
    // does anim(...) → p_delay(2) → p_telejump.  BotPlayer.tick() fires the
    // actual teleJump once player.delayed is cleared by the engine.
    player.delayed = true;
    player.delayedUntil = World.currentTick + 2;

    const bot = (player as any)._bot;
    if (bot?.setPendingTeleport) {
        bot.setPendingTeleport(x, z, level);
    } else {
        // Safety fallback if somehow no BotPlayer is attached.
        player.teleJump(x, z, level);
    }
}

// ── Walking ───────────────────────────────────────────────────────────────────

/**
 * Gateway regions — fenced or walled areas that require routing through a
 * specific approach tile / gate before reaching the interior destination.
 *
 * When walkTo() is called with a destination inside one of these regions and
 * the bot is currently outside, it walks to `approachX/Z` first, then tries
 * to open the gate before continuing.  Once the bot is inside the region
 * (playerInRegion = true) normal pathfinding resumes.
 *
 * Coordinate bounds are conservative on purpose — when in doubt keep them tight
 * so ordinary nearby destinations are never accidentally re-routed.
 */
type GatewayRegion = {
    readonly name: string;
    /** Destination is in the gated area. */
    readonly destInRegion: (x: number, z: number) => boolean;
    /** Bot is already inside — skip gateway routing. */
    readonly playerInRegion: (x: number, z: number) => boolean;
    /** Tile to walk to so the bot faces the gate from the correct side. */
    readonly approachX: number;
    readonly approachZ: number;
    /** How close (Chebyshev) to the approach tile before trying to open the gate. */
    readonly arrivalRadius: number;
    /**
     * If set, the bot is teleported to this tile instead of interacting with the
     * gate.  Use for gates that require a toll or complex dialog that bots cannot
     * handle (e.g. the Al Kharid toll gate).
     */
    readonly teleportDestX?: number;
    readonly teleportDestZ?: number;
};

const GATEWAY_REGIONS: GatewayRegion[] = [
    {
        // ── Al Kharid south ───────────────────────────────────────────────────
        // The Lumbridge-AlKharid wall runs at x ≈ 3268, z ≈ 3197..3244.
        // Gate tile: ~[3268, 3227].  Destinations inside: warriors, bank,
        // scimitar shop, furnace, etc.  Bots must approach from the west side
        // (Lumbridge) to open the gate — NOT from the south where the wall has
        // no opening.  Without this routing a bot walking to [3294, 3172] hits
        // the wall 55 tiles south of the gate and can never open it.
        //
        // The gate charges a 10-coin toll and opens a dialog that bots cannot
        // handle.  Once the bot reaches the approach tile it is teleported
        // directly to the inside (3269, 3227) — the first open tile past the wall.
        //
        // Bug fix: approach tile must be at x=3264 (west of the wall), NOT x=3267.
        // playerInRegion used x >= 3267 which matched the old approach tile itself,
        // so the bot arrived at the approach, was immediately classified as "already
        // inside", and the teleport never fired.
        name: 'AlKharid',
        destInRegion: (x, z) => x >= 3269 && z >= 3155 && z <= 3242,
        playerInRegion: (x, _z) => x >= 3269,
        approachX: 3265,
        approachZ: 3227,
        arrivalRadius: 3,
        teleportDestX: 3275,
        teleportDestZ: 3227
    },
    {
        // ── Al Kharid exit (inside → Lumbridge) ──────────────────────────────
        // Reverse of AlKharid: bots inside Al Kharid (x >= 3269) heading west
        // back toward Lumbridge or Draynor hit the same toll wall.  Approach
        // the inside gate tile (3270, 3227) and teleport to the Lumbridge side
        // (3264, 3227) — four tiles west of the wall.
        //
        // No z-range constraint on destInRegion: a bot heading to any destination
        // with x < 3269 (e.g. Barbarian Village via waypoint z=3340, Draynor bank
        // z=3245) must still exit through the west gate regardless of how far
        // north the final destination is.
        name: 'AlKharidExit',
        destInRegion: (x, _z) => x <= 3267,
        playerInRegion: (x, _z) => x <= 3267,
        approachX: 3270,
        approachZ: 3227,
        arrivalRadius: 4,
        teleportDestX: 3261,
        teleportDestZ: 3227
    },
    {
        // ── Port Sarim → Karamja (boat) ───────────────────────────────────────
        // Bots heading to Karamja fishing spots (x < 2970) walk to the Port
        // Sarim docks (~3030, 3218) and are teleported to the Karamja landing
        // (2956, 3143).  The boat costs 30 coins and triggers a dialog that
        // bots cannot handle natively, so teleport is used instead.
        name: 'PortSarimToKaramja',
        destInRegion: (x, z) => x < 2970 && z < 3250,
        playerInRegion: (x, z) => x < 2970 && z < 3250,
        approachX: 3031,
        approachZ: 3217,
        arrivalRadius: 5,
        teleportDestX: 2956,
        teleportDestZ: 3147
    },
    {
        // ── Karamja → Port Sarim (boat return) ───────────────────────────────
        // Bots on Karamja (x < 2970) heading back to the mainland (x >= 2990,
        // e.g. to bank) walk to the Karamja dock (2956, 3145) and are
        // teleported to the Port Sarim arrival tile (3047, 3235).
        name: 'KaramjaToPortSarim',
        destInRegion: (x, _z) => x >= 2990,
        playerInRegion: (x, z) => x >= 2990 || z > 3250,
        approachX: 2956,
        approachZ: 3145,
        arrivalRadius: 5,
        teleportDestX: 3047,
        teleportDestZ: 3235
    },
    {
        // ── Port Sarim → Entrana (boat) ───────────────────────────────────────
        // Bots heading to Entrana (gathering herblore supplies or woodcutting)
        // walk to the Port Sarim northern docks and teleport to Entrana.
        name: 'PortSarimToEntrana',
        destInRegion: (x, z) => x >= 2800 && x <= 2870 && z >= 3320 && z <= 3390,
        playerInRegion: (x, z) => x >= 2800 && x <= 2870 && z >= 3320 && z <= 3390,
        approachX: 3048,
        approachZ: 3234,
        arrivalRadius: 5,
        teleportDestX: 2834,
        teleportDestZ: 3335
    },
    {
        // ── Entrana → Port Sarim (boat return) ────────────────────────────────
        name: 'EntranaToPortSarim',
        destInRegion: (x, z) => x > 2870 || x < 2800 || z > 3390 || z < 3320,
        playerInRegion: (x, z) => x > 2870 || x < 2800 || z > 3390 || z < 3320,
        approachX: 2834,
        approachZ: 3335,
        arrivalRadius: 5,
        teleportDestX: 3048,
        teleportDestZ: 3234
    },
    {
        // ── Shantay Pass (Mainland → Desert) ──────────────────────────────────
        // Access to the Kharidian desert via Shantay Pass.  Requires a toll/pass
        // so bots teleport through the gate.
        name: 'ShantayPass',
        destInRegion: (x, z) => x >= 3200 && x <= 3400 && z <= 3115,
        playerInRegion: (x, z) => z <= 3115,
        approachX: 3303,
        approachZ: 3123,
        arrivalRadius: 4,
        teleportDestX: 3303,
        teleportDestZ: 3115
    },
    {
        // ── Shantay Pass Exit (Desert → Mainland) ─────────────────────────────
        name: 'ShantayPassExit',
        destInRegion: (x, z) => z >= 3117,
        playerInRegion: (x, z) => z >= 3117,
        approachX: 3303,
        approachZ: 3116,
        arrivalRadius: 4,
        teleportDestX: 3303,
        teleportDestZ: 3123
    },
    {
        // ── Taverley Gate (Falador → Taverley) ────────────────────────────────
        // The long wall between Falador and Taverley.
        name: 'TaverleyGate',
        destInRegion: (x, z) => x < 2933 && z > 3250,
        playerInRegion: (x, z) => x < 2933 && z > 3250,
        approachX: 2936,
        approachZ: 3450,
        arrivalRadius: 4
    },
    {
        // ── Taverley Gate Exit (Taverley → Falador) ───────────────────────────
        name: 'TaverleyGateExit',
        destInRegion: (x, _z) => x >= 2933,
        playerInRegion: (x, _z) => x >= 2933,
        approachX: 2932,
        approachZ: 3450,
        arrivalRadius: 4
    },
    {
        // ── Ardougne North Gate (East → West) ─────────────────────────────────
        name: 'ArdougneNorthGate',
        destInRegion: (x, z) => x < 2634 && x > 2551 && z > 3250,
        playerInRegion: (x, z) => x < 2634 && x > 2551 && z > 3250,
        approachX: 2636,
        approachZ: 3333,
        arrivalRadius: 4
    },
    {
        // ── Ardougne North Gate Exit (West → East) ────────────────────────────
        name: 'ArdougneNorthGateExit',
        destInRegion: (x, _z) => x >= 2634,
        playerInRegion: (x, _z) => x >= 2634,
        approachX: 2633,
        approachZ: 3333,
        arrivalRadius: 4
    },
    {
        // ── West Ardougne Gate (East → West) ──────────────────────────────────
        // Gate between East and West Ardougne.
        name: 'WestArdougneGate',
        destInRegion: (x, z) => x < 2551 && z >= 3260 && z <= 3350,
        playerInRegion: (x, z) => x < 2551 && z >= 3260 && z <= 3350,
        approachX: 2555,
        approachZ: 3320,
        arrivalRadius: 4
    },
    {
        // ── West Ardougne Exit (West → East) ──────────────────────────────────
        name: 'WestArdougneExit',
        destInRegion: (x, z) => x >= 2551,
        playerInRegion: (x, z) => x >= 2551,
        approachX: 2551,
        approachZ: 3320,
        arrivalRadius: 4
    },
    {
        // ── Draynor Manor (Mainland → Manor) ──────────────────────────────────
        // Fenced grounds of Draynor Manor.
        name: 'DraynorManor',
        destInRegion: (x, z) => x >= 3070 && x <= 3130 && z >= 3330 && z <= 3385,
        playerInRegion: (x, z) => x >= 3070 && x <= 3130 && z >= 3330 && z <= 3385,
        approachX: 3108,
        approachZ: 3329,
        arrivalRadius: 4
    },
    {
        // ── Hemenster (Mainland → Hemenster) ──────────────────────────────────
        // Fenced fishing village.
        name: 'Hemenster',
        destInRegion: (x, z) => x >= 2625 && x <= 2650 && z >= 3435 && z <= 3450,
        playerInRegion: (x, z) => x >= 2625 && x <= 2650 && z >= 3435 && z <= 3450,
        approachX: 2643,
        approachZ: 3433,
        arrivalRadius: 4
    },
    {
        // ── Lumbridge sheep pen ───────────────────────────────────────────────
        // Fenced enclosure NE of Lumbridge castle.  East gate at ~[3199, 3282].
        // Bots walking directly to the interior hit the east fence unless they
        // approach from the east side and open the gate.
        name: 'SheepPen',
        destInRegion: (x, z) => x >= 3182 && x <= 3199 && z >= 3267 && z <= 3291,
        playerInRegion: (x, z) => x >= 3182 && x <= 3199 && z >= 3267 && z <= 3291,
        approachX: 3202,
        approachZ: 3282,
        arrivalRadius: 3
    },
    {
        // ── Lumbridge cow pen ─────────────────────────────────────────────────
        // Fenced enclosure north of Lumbridge castle.  South gate at ~[3253, 3265].
        // Bots walking directly to the interior ([3255, 3276]) hit the south
        // fence unless they approach through the gate tile.
        name: 'CowPen',
        destInRegion: (x, z) => x >= 3248 && x <= 3265 && z >= 3266 && z <= 3296,
        playerInRegion: (x, z) => x >= 3248 && x <= 3265 && z >= 3266 && z <= 3296,
        approachX: 3253,
        approachZ: 3263,
        arrivalRadius: 4
    },
    {
        // ── Varrock north (yew trees behind palace) ───────────────────────────
        // The yews at [3204, 3499] are north of Varrock palace and reachable
        // only by navigating through the city.  Routing through the Varrock
        // south road entry gives the pathfinder a clear corridor to follow.
        name: 'VarrockNorth',
        destInRegion: (x, z) => x >= 3180 && x <= 3240 && z >= 3470,
        playerInRegion: (x, z) => x >= 3180 && x <= 3240 && z >= 3430,
        approachX: 3212,
        approachZ: 3432,
        arrivalRadius: 10
    }
];

// ── Route corridors ───────────────────────────────────────────────────────────

/**
 * Terrain corridors — solid obstacles (buildings, castle walls) that the BFS
 * pathfinder can technically route around, but where the obstacle is large
 * enough that long-distance midpoint calculations consistently land on the
 * wrong side of the wall and leave the bot looping.
 *
 * When walkTo() detects the player is in a source zone heading to a destination
 * beyond the obstacle, it first steers toward `viaX/Z` — a known-clear
 * intermediate tile on the correct side of the obstacle.  Once the bot reaches
 * or passes the obstacle (`playerCleared` = true) normal pathfinding resumes.
 *
 * Only active on the ground floor (level 0).
 */
type RouteCorridor = {
    readonly name: string;
    /** Bot is stuck on the near side of the obstacle. */
    readonly playerInZone: (x: number, z: number) => boolean;
    /** Destination is on the far side — corridor routing is needed. */
    readonly destBeyond: (x: number, z: number) => boolean;
    /** Bot has cleared the obstacle — resume normal pathfinding. */
    readonly playerCleared: (x: number, z: number) => boolean;
    /** Safe intermediate tile on the near side of the obstacle. */
    readonly viaX: number;
    readonly viaZ: number;
};

const ROUTE_CORRIDORS: RouteCorridor[] = [
    {
        // ── Lumbridge castle — westbound bypass ───────────────────────────────
        // Bots anywhere in the castle band (x > 3200, including Lumbridge spawn
        // at 3222,3219) heading west toward Draynor village (x < 3185) have the
        // castle walls across their straight-line path.  The BFS can route
        // around the castle, but the 90-tile midpoint often lands on the wrong
        // side of the walls and returns empty, leaving the bot looping on the
        // compass fallback.
        //
        // Fix: redirect to (3194, 3226) — the open field west of the castle —
        // first.  From there any Draynor destination is ≤ 110 tiles with a
        // completely clear westward run.  Previously capped at x > 3226 which
        // missed bots spawning at Lumbridge (3222, 3219).
        name: 'LumbridgeCastleWest',
        playerInZone: (x, z) => x > 3200 && z >= 3200 && z <= 3260,
        destBeyond: (x, _z) => x < 3185,
        playerCleared: (x, _z) => x <= 3200,
        viaX: 3194,
        viaZ: 3226
    },
    {
        // ── Draynor market fence — northbound bypass ──────────────────────────
        // The Draynor market has a fence on its east side (x ≈ 3083, z ≈ 3248–
        // 3261). Bots leaving the Draynor bank (3092, 3245) heading northwest
        // toward Falador furnace, Falador range, or Barbarian Village willows
        // find the fence blocking the direct westward path through z ≈ 3248–
        // 3261. Via (3090, 3263) — just north of the fence top — the bot rounds
        // the corner and then has a clear westward run.
        name: 'DraynorMarketFence',
        playerInZone: (x, z) => x >= 3083 && x <= 3097 && z >= 3243 && z <= 3262,
        destBeyond: (x, z) => x <= 3082 && z >= 3258,
        playerCleared: (_x, z) => z >= 3262,
        viaX: 3090,
        viaZ: 3263,
    },
    {
        // ── White Wolf Mountain — westbound bypass ────────────────────────────
        // Bots heading from Taverley/Falador (x > 2870) toward Catherby/Seers
        // (x < 2800) must route through the mountain pass at (2848, 3497).
        // The BFS often gets lost in the mountain crags.
        name: 'WhiteWolfMountainWest',
        playerInZone: (x, z) => x > 2860 && x < 3000 && z > 3400 && z < 3550,
        destBeyond: (x, _z) => x < 2810,
        playerCleared: (x, _z) => x <= 2850,
        viaX: 2848,
        viaZ: 3497
    },
    {
        // ── White Wolf Mountain — eastbound bypass ────────────────────────────
        name: 'WhiteWolfMountainEast',
        playerInZone: (x, z) => x < 2830 && x > 2700 && z > 3400 && z < 3550,
        destBeyond: (x, _z) => x > 2880,
        playerCleared: (x, _z) => x >= 2845,
        viaX: 2848,
        viaZ: 3497
    }
];

/**
 * Raw pathfinding toward a single tile: accurate → relaxed → swept-angle → naive.
 * Does NOT do gateway or corridor pre-routing.  Call walkTo() for normal movement.
 *
 * Long-distance fallback strategy (dist > 100):
 *   1. Try the direct 90-tile midpoint (existing behaviour).
 *   2. If that fails, sweep ±20 °, ±40 °, ±60 ° around the direct heading at
 *      the same 90-tile distance.  A modest angle offset finds a reachable tile
 *      around a large building without straying far off course.
 *   3. If still failing, repeat the sweep at shorter (60-tile) segments.
 *
 * Final compass fallback (all midpoints failed):
 *   Try 8 compass directions at step sizes 50 → 25 → 15 tiles.
 *   Larger steps are necessary to actually clear a wide obstacle like a castle.
 */
function _pathTowards(player: Player, destX: number, destZ: number): void {
    const dx = destX - player.x;
    const dz = destZ - player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1) return;

    const baseAngle = Math.atan2(dz, dx);

    if (dist <= 100) {
        // Short hop — try direct path first
        let path = botWalkPath(player.level, player.x, player.z, destX, destZ);
        if (path.length === 0) path = botFindPath(player.level, player.x, player.z, destX, destZ);
        if (path.length > 0) {
            player.queueWaypoints(path);
            return;
        }
        // Path is completely blocked — a door or gate is likely in the way.
        // Try opening one within 8 tiles before falling back to the compass sweep.
        // openNearbyGate only matches CLOSED doors (locs with Open/Walk-through ops
        // but without Close ops), so an already-open gate is never double-interacted.
        if (openNearbyGate(player, 8)) return;
    } else {
        // Long distance — try midpoints at the direct heading then sweep outward
        // so the pathfinder can find a clear intermediate tile around any obstacle
        const segDist = Math.min(90, dist - 1);
        for (const deg of [0, 20, -20, 40, -40, 60, -60]) {
            const angle = baseAngle + (deg * Math.PI) / 180;
            const midX = Math.round(player.x + Math.cos(angle) * segDist);
            const midZ = Math.round(player.z + Math.sin(angle) * segDist);
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                player.queueWaypoints(path);
                return;
            }
        }
        // Retry with shorter segments in case the 90-tile target is unreachable
        for (const deg of [0, 20, -20, 40, -40, 60, -60]) {
            const angle = baseAngle + (deg * Math.PI) / 180;
            const midX = Math.round(player.x + Math.cos(angle) * 60);
            const midZ = Math.round(player.z + Math.sin(angle) * 60);
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                player.queueWaypoints(path);
                return;
            }
        }
    }

    // All directed midpoints failed — sweep 8 compass directions at increasing
    // step sizes so the bot can escape wide obstacles, not just doorway-width ones
    for (const step of [50, 25, 15]) {
        for (const deg of [0, 45, -45, 90, -90, 135, -135, 180]) {
            const angle = baseAngle + (deg * Math.PI) / 180;
            const midX = Math.round(player.x + Math.cos(angle) * step);
            const midZ = Math.round(player.z + Math.sin(angle) * step);
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                player.queueWaypoints(path);
                return;
            }
        }
    }

    // Absolute last resort: 1-tile naive step
    player.queueWaypoint(player.x + Math.sign(dx), player.z + Math.sign(dz));
}

/**
 * Walk toward (destX, destZ) using accurate collision-respecting pathfinding.
 *
 * Automatically routes through known gateway regions (Al Kharid gate, cow pen,
 * Varrock north) so bots always approach gates from the correct side, and
 * through terrain corridors (Lumbridge castle west bypass, etc.) so bots
 * are never trapped looping against a large solid obstacle.
 *
 * For destinations beyond 100 tiles, walks in 90-tile segments — each call
 * advances the bot and the next tick continues toward the final goal.
 *
 * Must set moveSpeed=WALK first — updateMovement() skips its reset when
 * moveSpeed is INSTANT, permanently blocking headless player movement.
 */
export function walkTo(player: Player, destX: number, destZ: number): void {
    // If a gate/door interaction is already pending (queued by openNearbyGate on
    // the previous tick), preserve it rather than wiping it here.  The engine's
    // processInteraction will walk the bot to the gate and fire APLOC1; calling
    // clearPendingAction before that happens is the root cause of the "sometimes
    // opens, sometimes doesn't" inconsistency — the interaction races against the
    // next bot tick and only survives when the engine processes it first.
    if (_hasGateInteractionPending(player)) return;

    // If the bot already has waypoints queued from a previous call, let the
    // existing path play out rather than recalculating every tick.  Without this
    // guard, the compass-sweep fallback picks a direction, then the very next
    // tick recalculates and picks a different direction, producing the
    // back-and-forth oscillation seen especially around Draynor Village.
    // Run/speed are still updated so the bot can toggle run while walking.
    if (player.hasWaypoints()) {
        player.run = player.runenergy >= 3000 ? 1 : 0;
        player.moveSpeed = MoveSpeed.WALK;
        return;
    }

    // Cancel any active engine interaction (setInteraction target) before setting
    // new waypoints.  Without this, processInteraction() re-routes the player back
    // toward the old target every tick, overriding the walkTo waypoints and causing
    // the "moving backwards" symptom when transitioning between task states
    // (e.g. fishing spot → bank, or woodcutting → bank).
    player.clearPendingAction();

    // Toggle persistent run based on current energy.
    // Enable at 30 % (3 000/10 000); disable below 30 % so energy recovers.
    // runanim must be non-(-1) for this to take effect — set in BotAppearance.randomize.
    player.run = player.runenergy >= 3000 ? 1 : 0;

    player.moveSpeed = MoveSpeed.WALK; // guard against INSTANT; processMovement overrides via defaultMoveSpeed()

    if (Math.abs(player.x - destX) < 1 && Math.abs(player.z - destZ) < 1) return;

    // ── Gateway routing ─────────────────────────────────────────────────────
    // If the destination is inside a gated region and the bot is outside,
    // walk to the approach tile first, then open the gate, then proceed.
    for (const gw of GATEWAY_REGIONS) {
        if (!gw.destInRegion(destX, destZ)) continue; // dest not in this region
        if (gw.playerInRegion(player.x, player.z)) continue; // already inside

        const gwDist = Math.max(Math.abs(player.x - gw.approachX), Math.abs(player.z - gw.approachZ)); // Chebyshev distance

        if (gwDist > gw.arrivalRadius) {
            // Not yet at the approach tile — walk toward it first.
            _pathTowards(player, gw.approachX, gw.approachZ);
            return;
        }

        // Close to approach tile — cross the gate.
        if (gw.teleportDestX !== undefined && gw.teleportDestZ !== undefined) {
            // Toll/dialog gate that bots can't interact with — teleport through.
            botTeleport(player, gw.teleportDestX, gw.teleportDestZ, player.level);
            return;
        }
        if (openNearbyGate(player, 8)) return; // gate interaction queued, wait
        // Gate is open (or no gate found) — fall through to normal pathfinding.
        break;
    }

    // ── Terrain corridor routing ─────────────────────────────────────────────
    // For large solid obstacles (castle walls, etc.) the straight-line midpoint
    // often lands behind the wall and the pathfinder returns empty.  Corridors
    // redirect the bot through a known-clear intermediate tile on the near side
    // of the obstacle so the BFS always has a viable segment to walk.
    if (player.level === 0) {
        for (const corridor of ROUTE_CORRIDORS) {
            if (corridor.playerCleared(player.x, player.z)) continue; // already past it
            if (!corridor.playerInZone(player.x, player.z)) continue; // not in this zone
            if (!corridor.destBeyond(destX, destZ)) continue; // dest doesn't cross it

            _pathTowards(player, corridor.viaX, corridor.viaZ);
            return;
        }
    }

    // ── Normal pathfinding ──────────────────────────────────────────────────
    _pathTowards(player, destX, destZ);
}




/**
 * Items we wish the bots to sell to real players, namely materials such as logs, ores, bars, etc... In their noted forms.
 */
export const viableItemIds:    number[] = [
    2349, //bronze_bar
    2350, //cert_bronze_bar
    2351, //iron_bar
    2352, //cert_iron_bar
    2353, //steel_bar
    2354, //cert_steel_bar
    2355, //silver_bar
    2356, //cert_silver_bar
    2357, //gold_bar
    2358, //cert_gold_bar
    2359, //mithril_bar
    2360, //cert_mithril_bar
    2361, //adamantite_bar
    2362, //cert_adamantite_bar
    2363, //runite_bar
    2364, //cert_runite_bar
    39, //bronze_arrowheads
    40, //iron_arrowheads
    41, //steel_arrowheads
    42, //mithril_arrowheads
    43, //adamant_arrowheads
    44, //rune_arrowheads
    221, //eye_of_newt
    223, //red_spiders_eggs
    225, //limpwurt_root
    227, //vial_water
    229, //vial_empty
    231, //snape_grass
    314, //feather
    317, //raw_shrimp
    321, //raw_anchovies
    327, //raw_sardine
    331, //raw_salmon
    335, //raw_trout
    341, //raw_cod
    345, //raw_herring
    349, //raw_pike
    353, //raw_mackerel
    359, //raw_tuna
    363, //raw_bass
    371, //raw_swordfish
    377, //raw_lobster
    383, //raw_shark
    389, //raw_mantaray
    395, //raw_seaturtle
    401, //seaweed
    434, //clay
    526, //bones
    530, //bat_bones
    532, //big_bones
    534, //babydragon_bones
    536, //dragon_bones
    1617, //uncut_diamond
    1619, //uncut_ruby
    1621, //uncut_emerald
    1623, //uncut_sapphire
    1625, //uncut_opal
    1627, //uncut_jade
    1629, //uncut_red_topaz
    1631, //uncut_dragonstone
    434, //clay
    435, //cert_clay
    436, //copper_ore
    437, //cert_copper_ore
    438, //tin_ore
    439, //cert_tin_ore
    440, //iron_ore
    441, //cert_iron_ore
    442, //silver_ore
    443, //cert_silver_ore
    444, //gold_ore
    445, //cert_gold_ore
    446, //perfect_gold_ore
    447, //mithril_ore
    448, //cert_mithril_ore
    449, //adamantite_ore
    450, //cert_adamantite_ore
    451, //runite_ore
    452, //cert_runite_ore
    453, //coal
    454, //cert_coal
    1511, //logs
    1512, //cert_logs
    1513, //magic_logs
    1514, //cert_magic_logs
    1515, //yew_logs
    1516, //cert_yew_logs
    1517, //maple_logs
    1518, //cert_maple_logs
    1519, //willow_logs
    1520, //cert_willow_logs
    1521, //oak_logs
    1522 //cert_oak_logs
];




/**
 * interface interface use operation: 1 - 4
 * interfaceId, itemId, itemSlot, operation
 */
export function interactIF_UseOp(player: Player, intrfce: number, item: number, slot: number, op: number, invId:number = -1): boolean {
    // jagex has if_button1-5
    const com = Component.get(intrfce);
    if (typeof com === 'undefined') {
        console.log('Component undefined');
        return false;
    }
    if(!com.iop || !com.iop.length) {
        console.log('Cannot find com.inventoryOptions');
        return false;
    }

    if (!com.iop[op - 1]) {
        return false;
    }
    let inv = null;

    if(invId == -1) {
        const listener = player.invListeners.find(l => l.com === intrfce);
        if (!listener) {
            console.log('No listener active');
            return false;
        }

        inv = player.getInventoryFromListener(listener);
    } else {
        inv = player.getInventory(invId);
    }

    if (!inv || !inv.validSlot(slot) || !inv.hasAt(slot, item)) {
        console.log('inv or invslot invalid');
        return false;
    }

    if (player.delayed) {
        console.log('Player is busy...');
        return false;
    }

    player.lastItem = item;
    player.lastSlot = slot;

    let trigger: ServerTriggerType;
    if (op === 1) {
        trigger = ServerTriggerType.INV_BUTTON1;
    } else if (op === 2) {
        trigger = ServerTriggerType.INV_BUTTON2;
    } else if (op === 3) {
        trigger = ServerTriggerType.INV_BUTTON3;
    } else if (op === 4) {
        trigger = ServerTriggerType.INV_BUTTON4;
    } else {
        trigger = ServerTriggerType.INV_BUTTON5;
    }

    const script = ScriptProvider.getByTrigger(trigger, intrfce, -1);
    if (script) {
        const root = Component.get(com.rootLayer);

        player.executeScript(ScriptRunner.init(script, player), root.overlay == false);
    } else if (Environment.NODE_DEBUG) {
        player.messageGame(`No trigger for [${ServerTriggerType.toString(trigger)},${com.comName}]`);
    }

    return true;
}
export function interactHeldOp(player: Player, inv: Inventory, itemId: number, slot: number, op: 1 | 2 | 3 | 4 | 5 | 6): boolean {
    const trigger = (ServerTriggerType.OPHELD1 + (op - 1)) as ServerTriggerType;
    if (!inv || !inv.validSlot(slot) || !inv.hasAt(slot, itemId)) {
        player.clearPendingAction();
        return false;
    }
    const type = ObjType.get(itemId);
    if (player.delayed) {
        return false;
    }

    player.lastItem = itemId;
    player.lastSlot = slot;
    player.moveClickRequest = false;
    player.faceEntity = -1;
    player.masks |= player.entitymask;

    const script = ScriptProvider.getByTrigger(trigger, type.id, type.category);
    if (script) {
        player.executeScript(ScriptRunner.init(script, player), true);
    }

    if (op === 1 && itemId === Items.BONES) {
        console.log('BOT burying bone traditionally:', itemId);
        return true;
    }
    return true;
}

/**
 * oplocu handler converted -- useful for cooking, smithing,
 */
export function interactUseLocOp(player: Player, loc: Loc, item: number, slot: number): boolean {
    if (player.delayed) {
        player.write(new UnsetMapFlag());
        return false;
    }
    const inv = player.getInventory(InvType.INV);
    if (!inv || !inv.validSlot(slot) || !inv.hasAt(slot, item)) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }
    if (!loc) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }
    player.clearPendingAction();
    if (ObjType.get(item).members && !Environment.NODE_MEMBERS) {
        player.messageGame("To use this item please login to a members' server.");
        player.write(new UnsetMapFlag());
        return false;
    }
    player.lastUseItem = item;
    player.lastUseSlot = slot;
    player.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    //player.opcalled = true; //<- This is in NetworkPlayer not sure if its needed
    return true;
}

export function interactHeldOpU(player: Player, inv: Inventory, itemId: number, slot: number, useItem: number, useSlot: number): boolean {
    if (player.delayed) {
        return false;
    }
    player.lastItem = itemId;
    player.lastSlot = slot;
    player.lastUseItem = useItem;
    player.lastUseSlot = useSlot;
    if (inv.get(slot)?.id !== itemId || inv.get(useSlot)?.id !== useItem) {
        console.log('Useitem data does not match!', itemId, useItem);
        return false;
    }
    const objType = ObjType.get(player.lastItem);
    const useObjType = ObjType.get(player.lastUseItem);

    player.clearPendingAction();
    player.faceEntity = -1;
    player.masks |= player.entitymask;

    // [opheldu,b]
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, objType.id, -1);

    // [opheldu,a]
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, useObjType.id, -1);
        [player.lastItem, player.lastUseItem] = [player.lastUseItem, player.lastItem];
        [player.lastSlot, player.lastUseSlot] = [player.lastUseSlot, player.lastSlot];
    }

    // [opheld,b_category]
    const objCategory = objType.category !== -1 ? CategoryType.get(objType.category) : null;
    if (!script && objCategory) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, objCategory.id);
    }

    // [opheld,a_category]
    const useObjCategory = useObjType.category !== -1 ? CategoryType.get(useObjType.category) : null;
    if (!script && useObjCategory) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, useObjCategory.id);
        [player.lastItem, player.lastUseItem] = [player.lastUseItem, player.lastItem];
        [player.lastSlot, player.lastUseSlot] = [player.lastUseSlot, player.lastSlot];
    }

    if (script) {
        player.executeScript(ScriptRunner.init(script, player), true);
    }
    return true;
}

/**
 * Convenience wrapper: resolve a component name string to its numeric ID and
 * delegate to interactIfButton.  Returns false if the name is unknown.
 *
 * Usage:
 *   interactIfButtonByName(player, 'multiobj3_close:com_1')
 *   interactIfButtonByName(player, 'multiobj2:objtext1')
 */
export function interactIfButtonByName(player: Player, comName: string): boolean {
    const comId = Component.getId(comName);
    if (comId === -1) return false;
    return interactIfButton(player, comId);
}

//Interface buttons
export function interactIfButton(player: Player, comId: number): boolean {
    const com = Component.get(comId);
    if (typeof com === 'undefined') { // || !player.isComponentVisible(com)) {
        return false;
    }

    player.lastCom = comId;

    if (player.resumeButtons.indexOf(player.lastCom) !== -1) {
        if (player.activeScript && player.activeScript.execution === ScriptState.PAUSEBUTTON) {
            player.executeScript(player.activeScript, true, true);
        }
    } else {
        const root = Component.get(com.rootLayer);

        const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.IF_BUTTON, comId, -1);
        if (script) {
            player.executeScript(ScriptRunner.init(script, player), root.overlay == false);
        } else if (Environment.NODE_DEBUG) {
            player.messageGame(`No trigger for [if_button,${com.comName}]`);
        }
    }

    return true;
}



//Player op
/**
 * Usage:
 * @param player - Player from botPlayer
 * @param slot - Target Player PID (Maybe slot in 254?)
 * @param op  - op 1-4
 * op 1 duel
 * op 2 attack
 * op 3 follow
 * op 4 trade
 */
export function interactPlayerOp(player: Player, slot: number, op: number): boolean {
    const other = World.getPlayer(slot);
    if (!other) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    let mode: ServerTriggerType;
    if (op === 1) {
        mode = ServerTriggerType.APPLAYER1;
    } else if (op === 2) {
        mode = ServerTriggerType.APPLAYER2;
    } else if (op === 3) {
        mode = ServerTriggerType.APPLAYER3;
    } else {
        mode = ServerTriggerType.APPLAYER4;
    }

    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, other, mode);
    return true;
}

/** True if the bot has queued walk steps remaining. */
export function hasWaypoints(player: Player): boolean {
    return player.hasWaypoints();
}

/** True if the bot is currently mid-walk (has waypoints). */
export function isMoving(player: Player): boolean {
    return player.hasWaypoints();
}

/** True if the bot is within `dist` tiles of (x, z) on the same floor. */
export function isNear(player: Player, x: number, z: number, dist: number, level = 0): boolean {
    return player.level === level && Math.abs(player.x - x) <= dist && Math.abs(player.z - z) <= dist;
}

// ── Interactions ──────────────────────────────────────────────────────────────

/**
 * Interact with an NPC using op 1 (e.g. "Talk-to", "Attack").
 * The engine will path the bot to the NPC and fire [opnpc1,npcName].
 */
export function interactNpc(player: Player, npc: Npc): void {
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1);
}

/**
 * Interact with an NPC using a specific option number (1-5).
 * op=2 is typically "Trade" for shops.
 */
export function interactNpcOp(player: Player, npc: Npc, op: 1 | 2 | 3 | 4 | 5): void {
    const trigger = (ServerTriggerType.APNPC1 + (op - 1)) as ServerTriggerType;
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, npc, trigger);
}

export function interactObjOp(player: Player, obj: Obj, op: 1 | 2 | 3 | 4 | 5): void {
    const trigger = (ServerTriggerType.APOBJ1 + (op - 1)) as ServerTriggerType;

    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, obj, trigger);

    if (op === 1) {
        // could later add anti-misclick, loot priority, etc.
    }
}

//Ground items
//Ground items
function _findObj(player: Player, cx: number, cz: number, level: number, radius: number, predicate: (obj: Obj) => boolean): Obj | null {
    let best: Obj | null = null;
    let bestDist = Infinity;
    const zoneRadius = Math.ceil(radius / 8) + 1;
    for (let dz = -zoneRadius; dz <= zoneRadius; dz++) {
        for (let dx = -zoneRadius; dx <= zoneRadius; dx++) {
            const zx = cx + dx * 8;
            const zz = cz + dz * 8;
            const zone = getWorld().gameMap.getZone(zx, zz, level);
            if (!zone) continue;
            for (const obj of zone.getAllObjsSafe()) {
                if (!predicate(obj)) continue;
                if (obj.receiver64 === Obj.NO_RECEIVER || obj.receiver64 === player.hash64) {
                    //<- added this
                    const dist = Math.abs(obj.x - cx) + Math.abs(obj.z - cz);
                    if (dist <= radius * 2 && dist < bestDist) {
                        bestDist = dist;
                        best = obj;
                    }
                }
            }
        }
    }
    return best;
}
export function findObjByPrefix(player: Player, cx: number, cz: number, level: number, prefix: string, radius = 20): Obj | null {
    return _findObj(player, cx, cz, level, radius, obj => {
        const t = ObjType.get(obj.type);
        return !!t.debugname?.startsWith(prefix);
    });
}
export function findObjNear(player: Player, cx: number, cz: number, level: number, objTypeId: number, radius = 10): Obj | null {
    return _findObj(player, cx, cz, level, radius, obj => obj.type === objTypeId);
}
export function findObjByName(player: Player, cx: number, cz: number, level: number, objName: string, radius = 10): Obj | null {
    const typeId = ObjType.getId(objName);
    if (typeId === -1) return null;
    return findObjNear(player, cx, cz, level, typeId, radius);
}

export function findAnyObj(player: Player, cx: number, cz: number, level: number, radius = 1): Obj | null {
    return _findObj(player, cx, cz, level, radius, () => true);
}

/**
 * Find lootable ground objects (monster drops, items that will despawn).
 * Excludes static/world items that have FOREVER lifecycle.
 */
export function findLootObj(player: Player, cx: number, cz: number, level: number, radius = 1): Obj | null {
    return _findObj(player, cx, cz, level, radius, obj => {
        return obj.lifecycle === EntityLifeCycle.DESPAWN;
    });
}

/**
 * Interact with a Loc using op 1 (e.g. "Chop", "Mine", "Fish").
 * The engine will path the bot adjacent to the Loc and fire [oploc1,locName].
 */
export function interactLoc(player: Player, loc: Loc): void {
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1);
}

/**
 * Interact with a Loc using a specific option number (1-5).
 */
export function interactLocOp(player: Player, loc: Loc, op: 1 | 2 | 3 | 4 | 5): void {
    const trigger = (ServerTriggerType.APLOC1 + (op - 1)) as ServerTriggerType;
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, loc, trigger);
}

// ── World search ──────────────────────────────────────────────────────────────

/**
 * Search zones around (cx, cz) for a live NPC matching npcTypeId.
 * Returns the closest one found within `radius` tiles, or null.
 */
export function findNpcNear(cx: number, cz: number, level: number, npcTypeId: number, radius = 10): Npc | null {
    return _findNpc(cx, cz, level, radius, npc => npc.type === npcTypeId);
}

/**
 * Search zones around (cx, cz) for a live NPC whose debug name matches.
 */
export function findNpcByName(cx: number, cz: number, level: number, npcName: string, radius = 10): Npc | null {
    const typeId = NpcType.getId(npcName);
    if (typeId === -1) return null;
    return findNpcNear(cx, cz, level, typeId, radius);
}

/**
 * Like findNpcByName but skips a specific NPC (by nid) so the bot can cycle
 * through multiple targets instead of always locking onto the same one.
 * Falls back to any matching NPC if no alternative is found.
 */
export function findNpcByNameExcluding(cx: number, cz: number, level: number, npcName: string, excludeNid: number, radius = 10): Npc | null {
    const typeId = NpcType.getId(npcName);
    if (typeId === -1) return null;
    const alt = findNpcFiltered(cx, cz, level, npc => npc.type === typeId && npc.nid !== excludeNid, radius);
    return alt ?? findNpcNear(cx, cz, level, typeId, radius);
}

/**
 * Search zones around (cx, cz) for a live Loc (object in the world) matching locTypeId.
 * Returns the closest one found within `radius` tiles, or null.
 */
export function findLocNear(cx: number, cz: number, level: number, locTypeId: number, radius = 10): Loc | null {
    return _findLoc(cx, cz, level, radius, loc => loc.type === locTypeId);
}

/**
 * Search zones around (cx, cz) for a live Loc whose debug name matches.
 */
export function findLocByName(cx: number, cz: number, level: number, locName: string, radius = 10): Loc | null {
    const typeId = LocType.getId(locName);
    if (typeId === -1) return null;
    return findLocNear(cx, cz, level, typeId, radius);
}

/**
 * Search for any Loc whose type name starts with a prefix.
 * Optional exclude: substring that must NOT appear in the debugname.
 */
export function findLocByPrefix(cx: number, cz: number, level: number, prefix: string, radius = 10, exclude?: string): Loc | null {
    return _findLoc(cx, cz, level, radius, loc => {
        const name = LocType.get(loc.type).debugname;
        if (!name?.startsWith(prefix)) return false;
        if (exclude && name.includes(exclude)) return false;
        return true;
    });
}

/**
 * Search for any NPC whose type name starts with a prefix.
 */
export function findNpcByPrefix(cx: number, cz: number, level: number, prefix: string, radius = 20): Npc | null {
    return _findNpc(cx, cz, level, radius, npc => {
        const t = NpcType.get(npc.type);
        return !!t.debugname?.startsWith(prefix);
    });
}

/**
 * Raw NPC search with a caller-supplied predicate.
 * Use this when you need combined type + combat-state + exclusion-set filtering
 * that the named helpers cannot express in a single call.
 */
export function findNpcFiltered(cx: number, cz: number, level: number, predicate: (npc: Npc) => boolean, radius = 22): Npc | null {
    return _findNpc(cx, cz, level, radius, predicate);
}

/**
 * Returns true if the NPC's debug name matches the given string by exact type
 * name first, then by prefix — the same two-step check used inside the combat
 * target search routines.
 */
export function npcMatchesName(npc: Npc, name: string): boolean {
    const typeId = NpcType.getId(name);
    if (typeId !== -1 && npc.type === typeId) return true;
    return !!NpcType.get(npc.type).debugname?.startsWith(name);
}

// ── Internal zone search ──────────────────────────────────────────────────────

function _findNpc(cx: number, cz: number, level: number, radius: number, predicate: (npc: Npc) => boolean): Npc | null {
    let best: Npc | null = null;
    let bestDist = Infinity;

    const zoneRadius = Math.ceil(radius / 8) + 1;
    for (let dz = -zoneRadius; dz <= zoneRadius; dz++) {
        for (let dx = -zoneRadius; dx <= zoneRadius; dx++) {
            const zx = cx + dx * 8;
            const zz = cz + dz * 8;
            const zone = getWorld().gameMap.getZone(zx, zz, level);
            if (!zone) continue;
            for (const npc of zone.getAllNpcsSafe()) {
                if (!predicate(npc)) continue;
                const dist = Math.abs(npc.x - cx) + Math.abs(npc.z - cz);
                if (dist <= radius * 2 && dist < bestDist) {
                    bestDist = dist;
                    best = npc;
                }
            }
        }
    }
    return best;
}

function _findLoc(cx: number, cz: number, level: number, radius: number, predicate: (loc: Loc) => boolean): Loc | null {
    let best: Loc | null = null;
    let bestDist = Infinity;

    const zoneRadius = Math.ceil(radius / 8) + 1;
    for (let dz = -zoneRadius; dz <= zoneRadius; dz++) {
        for (let dx = -zoneRadius; dx <= zoneRadius; dx++) {
            const zx = cx + dx * 8;
            const zz = cz + dz * 8;
            const zone = getWorld().gameMap.getZone(zx, zz, level);
            if (!zone) continue;
            for (const loc of zone.getAllLocsSafe()) {
                if (!predicate(loc)) continue;
                const dist = Math.abs(loc.x - cx) + Math.abs(loc.z - cz);
                if (dist <= radius * 2 && dist < bestDist) {
                    bestDist = dist;
                    best = loc;
                }
            }
        }
    }
    return best;
}

// ── Skills ────────────────────────────────────────────────────────────────────

export function getLevel(player: Player, stat: PlayerStat): number {
    return player.levels[stat];
}

export function getBaseLevel(player: Player, stat: PlayerStat): number {
    return player.baseLevels[stat];
}

export function getXp(player: Player, stat: PlayerStat): number {
    return player.stats[stat];
}

export function addXp(player: Player, stat: PlayerStat, xp: number): void {
    player.addXp(stat, xp);
}

/**
 * Sets the player's melee combat mode (com_mode varp).
 */
export function setCombatStyle(player: Player, style: 0 | 1 | 2 | 3): void {
    const varp = VarPlayerType.getByName('com_mode');
    if (varp) player.setVar(varp.id, style);
}

/**
 * Enables autocast wind strike for bots in magic mode.
 * Sets autocast_spell = 51 (^wind_strike) and attackstyle_magic = 3 (autocast toggle on).
 */
export function setAutocastWindStrike(player: Player): void {
    const spellVarp = VarPlayerType.getByName('autocast_spell');
    if (spellVarp) player.setVar(spellVarp.id, 51); // 51 = ^wind_strike

    const styleVarp = VarPlayerType.getByName('attackstyle_magic');
    if (styleVarp) player.setVar(styleVarp.id, 3); // 3 = spell chosen + autocast enabled
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function getBackpack(player: Player) {
    return player.getInventory(InvType.INV);
}

export function isInventoryFull(player: Player): boolean {
    const inv = getBackpack(player);
    return inv ? inv.isFull : false;
}

export function freeSlots(player: Player): number {
    const inv = getBackpack(player);
    return inv ? inv.freeSlotCount : 0;
}

export function countItem(player: Player, itemId: number): number {
    const inv = getBackpack(player);
    if (!inv) return 0;
    let total = 0;
    for (const item of inv.items) {
        if (item && item.id === itemId) total += item.count;
    }
    return total;
}

export function addItem(player: Player, itemId: number, count = 1): boolean {
    const inv = getBackpack(player);
    if (!inv) return false;
    return inv.add(itemId, count).hasSucceeded();
}

export function removeItem(player: Player, itemId: number, count = 1): boolean {
    const inv = getBackpack(player);
    if (!inv) return false;
    return inv.remove(itemId, count).completed >= count;
}

export function clearBackpack(player: Player): void {
    getBackpack(player)?.removeAll();
}

/**
 * Directly picks up a ground object into the player's backpack,
 * bypassing the engine interaction / script system entirely.
 * Returns true if the item was added and the obj removed from the world.
 */
export function pickupGroundItem(player: Player, obj: Obj): boolean {
    if (!obj.isValid()) return false;

    const inv = getBackpack(player);
    if (!inv) return false;

    const added = inv.add(obj.type, obj.count);
    if (!added.hasSucceeded()) return false;

    getWorld().removeObj(obj, -1);
    return true;
}

export function hasItem(player: Player, itemId: number, count = 1): boolean {
    return countItem(player, itemId) >= count;
}

export function getCombatLevel(player: Player): number {
    return player.combatLevel;
}

export function interactUseObjNpcOp(player: Player, npcu: Npc, item: number, slot: number): boolean {
    const nid = npcu?.nid;

    if (player.delayed) {
        player.write(new UnsetMapFlag());
        return false;
    }

    const inv = player.getInventory(InvType.INV);
    if (!inv || !inv.validSlot(slot) || !inv.hasAt(slot, item)) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    const npc = World.getNpc(nid);
    if (!npc || npc.delayed) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    if (!rsbuf.hasNpc(player.slot, npc.nid)) {
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    player.clearPendingAction();
    if (ObjType.get(item).members && !Environment.NODE_MEMBERS) {
        player.messageGame("To use this item please login to a members' server.");
        player.write(new UnsetMapFlag());
        return false;
    }

    player.lastUseItem = item;
    player.lastUseSlot = slot;

    player.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    return true;
}

/**
 * Bot-safe variant of interactUseObjNpcOp.
 *
 * Identical to interactUseObjNpcOp except the rsbuf.hasNpc() check is omitted.
 * Bots are server-side entities with no client zone-send buffer, so hasNpc()
 * always returns false for them and would silently block every interaction.
 * All other guards (player.delayed, valid slot, npc exists, members check)
 * are preserved.
 */
export function botInteractUseObjNpc(player: Player, npc: Npc, item: number, slot: number): boolean {
    const inv = player.getInventory(InvType.INV);
    if (!npc || !inv || !inv.validSlot(slot) || !inv.hasAt(slot, item)) {
        //Add a console.log to check?
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    const live = World.getNpc(npc.nid);
    if (!live) {
        //Add a console.log to check?
        player.write(new UnsetMapFlag());
        player.clearPendingAction();
        return false;
    }

    player.clearPendingAction();
    if (ObjType.get(item).members && !Environment.NODE_MEMBERS) {
        player.messageGame("To use this item please login to a members' server.");
        player.write(new UnsetMapFlag());
        return false;
    }

    player.lastUseItem = item;
    player.lastUseSlot = slot;
    player.setInteraction(Interaction.ENGINE, live, ServerTriggerType.APNPCU);
    return true;
}

/**
 * Compute the combat level of an NPC from its stat block.
 * Formula mirrors the RS2 visible combat level:
 *   floor((defence + hitpoints) * 0.25 + (attack + strength) * 0.325)
 */
export function getNpcCombatLevel(npc: Npc): number {
    const t = NpcType.get(npc.type);
    const atk = t.stats[0]; // NpcStat.ATTACK
    const def = t.stats[1]; // NpcStat.DEFENCE
    const str = t.stats[2]; // NpcStat.STRENGTH
    const hp = t.stats[3]; // NpcStat.HITPOINTS
    return Math.max(1, Math.floor((def + hp) * 0.25 + (atk + str) * 0.325));
}

/**
 * Find any NPC within `radius` tiles that is currently targeting `player`.
 * Used by CombatTask to detect aggressive NPCs the bot did not initiate combat with.
 */
export function findAggressorNpc(player: Player, radius = 10): Npc | null {
    return _findNpc(player.x, player.z, player.level, radius, npc => (npc as any).target === player);
}

/**
 * Search for any NPC whose debugname ends with a given suffix.
 */
export function findNpcBySuffix(cx: number, cz: number, level: number, suffix: string, radius = 20): Npc | null {
    return _findNpc(cx, cz, level, radius, npc => {
        const t = NpcType.get(npc.type);
        return !!t.debugname?.endsWith(suffix);
    });
}

/**
 * Has item equipped (itemId)
 * @param player
 * @param itemId
 * @private
 */
export function _wornContains(player: Player, itemId: number): boolean {
    const equip = player.getInventory(InvType.WORN);
    if (!equip) return false;

    for (let slot = 0; slot < equip.capacity; slot++) {
        const item = equip.get(slot);
        if (!item) continue;
        if (item.id === itemId) return true;
    }

    return false;
}

function _getWearSlot(oType: ObjType): number | null {
    return oType.wearpos ?? oType.wearpos2 ?? oType.wearpos3 ?? null;
}
function _getEquippedItem(player: Player, slotId: number) {
    const equip = player.getInventory(InvType.WORN);
    if (!equip) return null;

    return equip.get(slotId);
}

function _getTier(name?: string | null): number {
    if (!name) return 0;

    name = name.toLowerCase();

    if (name.includes('dragon')) return 6;
    if (name.includes('rune') || name.includes('giant')) return 5; //<- remove giant for something else, its a custom easter weapon
    if (name.includes('adamant')) return 4;
    if (name.includes('mithril')) return 3;
    if (name.includes('black')) return 2;
    if (name.includes('steel')) return 1;
    if (name.includes('iron')) return 0;
    if (name.includes('bronze')) return 0;
    return -1;
}

export function _isUpgrade(newItem: ObjType, currentItem: ObjType | null): boolean {
    if (!currentItem) return true;

    const newTier = _getTier(newItem.name);
    const currentTier = _getTier(currentItem.name);

    return newTier > currentTier;
}

export function _equipLoot(player: Player): void {
    const inv = player.getInventory(InvType.INV);
    if (!inv) return;

    for (let slot = 0; slot < inv.capacity; slot++) {
        const item = inv.get(slot);
        if (!item) continue;
        const oType = ObjType.get(item.id);
        const wearSlot = _getWearSlot(oType);
        if (wearSlot === null) continue;

        const equipped = _getEquippedItem(player, wearSlot);
        const equippedType = equipped ? ObjType.get(equipped.id) : null;

        if (wearSlot === 3) {
            // weapon (attack req)
            if (_getTier(oType.name) === 6 && player.baseLevels[0] < 60) continue;
            if (_getTier(oType.name) === 5 && !oType.name?.toLowerCase().includes('giant') && player.baseLevels[0] < 40) continue; //<- remove giant for something else?
            if (_getTier(oType.name) === 4 && player.baseLevels[0] < 30) continue;
            if (_getTier(oType.name) === 3 && player.baseLevels[0] < 20) continue;
            if (_getTier(oType.name) === 2 && player.baseLevels[0] < 10) continue;
            if (_getTier(oType.name) === 1 && player.baseLevels[0] < 5) continue;
        } else if (
            wearSlot === 0 || //hat
            //|| wearSlot === 8 //head <- this isn't a real slot
            wearSlot === 4 || //torso <- These all require defence
            wearSlot === 7 || //legs
            wearSlot === 5
        ) {
            //shield
            if (_getTier(oType.name) === 6 && player.baseLevels[1] < 60) continue;
            if (_getTier(oType.name) === 5 && player.baseLevels[1] < 40) continue;
            if (_getTier(oType.name) === 4 && player.baseLevels[1] < 30) continue;
            if (_getTier(oType.name) === 3 && player.baseLevels[1] < 20) continue;
            if (_getTier(oType.name) === 2 && player.baseLevels[1] < 10) continue;
            if (_getTier(oType.name) === 1 && player.baseLevels[1] < 5) continue;
        } else if (wearSlot === 1) {
            //Cape
            //We can add different tier systems in each of these.
        } else if (wearSlot === 2) {
            //Amulet
            //For example, tier 1 could be a strength / magic amulet
            //Tier 2 could be a power amulet
            //Tier 3 a glory
        } else if (wearSlot === 9) {
            //Hands
            //Not sure if theres much options for 04
        } else if (wearSlot === 10) {
            //Feet
            //Same ->
        } else if (wearSlot === 12) {
            //Ring
            //Same ->
        } else if (wearSlot === 13) {
            //Ammo
            //Bronze - Rune can be tiered
        } else {
            //Invalid slot continue;
            continue;
        }

        if (!_isUpgrade(oType, equippedType)) continue;

        if (_getTier(oType.name) != -1 && !_wornContains(player, item.id)) {
            if (interactHeldOp(player, inv, item.id, slot, 2)) {
                //item equipped
            }
        }
    }
}

//Simple varp getting using both id and name as a fallback if they don't match
export function setVarp(player: Player, varpName: string, varpId: number, varpValue: number) {
    const varp = VarPlayerType.get(varpId);
    const varpN = VarPlayerType.getByName(varpName);
    if (varp) {
        if (varpN) {
            if (varpId != varpN.id) {
                //varpId doesn't match use name preferably
                player.setVar(varpN.id, varpValue);
                return;
            }
        } else {
            console.log("Warning: can't find varp name: " + varpName);
        }
        player.setVar(varp.id, varpValue);
    } else {
        console.log("Error: can't find varp id: " + varpId);
    }
}

// ── Gate handling ─────────────────────────────────────────────────────────────

/**
 * Returns true if the bot is standing adjacent (within 1 tile of any face)
 * of the given loc, accounting for the loc's width and length.
 */
export function isAdjacentToLoc(player: Player, loc: { x: number; z: number; type: number }): boolean {
    const t = LocType.get(loc.type);
    const w = t.width ?? 1;
    const l = t.length ?? 1;
    const dx = Math.max(0, Math.max(loc.x - player.x, player.x - (loc.x + w - 1)));
    const dz = Math.max(0, Math.max(loc.z - player.z, player.z - (loc.z + l - 1)));
    return dx <= 1 && dz <= 1 && dx + dz <= 1;
}

/**
 * Open-action keywords (lowercased) that indicate a closed/passable door or gate.
 * Covers standard "Open", toll gates ("Pay-toll(10gp)"), walk-through doors,
 * and Al Kharid palace curtains (loc_1528: op1="Open").
 */
const GATE_OPEN_KEYWORDS = ['open', 'pay', 'pay-toll', 'walk-through', 'pass-through', 'enter'];
const GATE_CLOSE_KEYWORDS = ['close', 'shut'];

/** Loc debug-name prefixes that represent closeable barriers (curtains, etc.). */
const BARRIER_NAME_PREFIXES = ['loc_1528']; // Al Kharid palace curtain (closed state)

/** Big door prefixes - large double doors that also need opening */
const BIG_DOOR_PREFIXES = ['big door', 'large door', 'double door'];

/**
 * Substrings of loc debugnames that are NEVER gates — purely decorative objects.
 * These are excluded so bots don't try to "open" or interact with them while
 * navigating past them (e.g. picking flowers at Varrock West Bank).
 */
const DECORATIVE_LOC_FRAGMENTS = ['flower', 'fern', 'plant', 'bush', 'thistle', 'nettle', 'cabbage', 'tulip', 'daisy', 'sunflower', 'chest', 'open chest', 'closed chest'];

/**
 * Directly executes the OPLOC1 script for a gate/door Loc.
 *
 * This bypasses processInteraction, which fails for Locs because:
 *   - pathToPathingTarget() is a no-op for non-PathingEntity targets (Locs)
 *   - tryInteract(false) fires first and hits the "default approach" branch,
 *     setting apRange=-1 and returning false without moving the player
 *   - With no waypoints and no steps taken, "I can't reach that!" fires and
 *     clears the interaction before tryInteract(true) ever gets a chance to run
 *
 * This replicates exactly what tryInteract(true) does when inOperableDistance:
 *   getOpTrigger() → ScriptProvider.getByTrigger(targetOp + 7, ...) i.e. OPLOC1
 *   executeScript(ScriptRunner.init(script, player, gate), true)
 *
 * Returns true if an OPLOC1 script was found and executed.
 */
function _executeGateScript(player: Player, gate: Loc): boolean {
    const locType = LocType.get(gate.type);
    const script = ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, gate.type, locType.category);
    if (!script) return false;
    player.clearPendingAction();
    player.executeScript(ScriptRunner.init(script, player, gate), true);
    return true;
}

/**
 * Walks toward a gate/door using plain waypoints (botWalkPath / botFindPath).
 * Does NOT call _pathTowards — that function calls openNearbyGate internally
 * which would create mutual recursion.
 */
function _walkToGate(player: Player, gate: Loc): void {
    let path = botWalkPath(player.level, player.x, player.z, gate.x, gate.z);
    if (path.length === 0) path = botFindPath(player.level, player.x, player.z, gate.x, gate.z);
    if (path.length > 0) {
        player.clearPendingAction();
        player.queueWaypoints(path);
    }
}

/**
 * Scan within `radius` tiles for any closed door, gate, toll gate, or curtain.
 * Handles:
 *   - Standard "Open" ops (doors, gates)
 *   - "Pay-toll(10gp)" variants (Al Kharid gate)
 *   - Walk-through / pass-through doors
 *   - Al Kharid palace curtains (loc_1528 — op1="Open", blockwalk=yes while closed)
 *
 * Behaviour:
 *   - If already adjacent to the gate: directly executes the OPLOC1 script,
 *     bypassing the broken processInteraction path (see _executeGateScript).
 *   - If not yet adjacent: queues plain walk-waypoints toward the gate.
 *     Next call (BotPlayer universal sweep fires every 5 ticks) will execute.
 *
 * Returns true if an obstruction was found (interaction queued or walk started).
 */
export function openNearbyGate(player: Player, radius = 30): boolean {
    const gate = _findLoc(player.x, player.z, player.level, radius, _isClosedGate);
    if (!gate) return false;

    if (isAdjacentToLoc(player, gate)) {
        // Adjacent — fire the OPLOC1 script directly.
        if (_executeGateScript(player, gate)) return true;
        // No OPLOC1 script found (unusual) — fall back to setInteraction.
        interactLoc(player, gate as any);
        return true;
    }

    // Not adjacent — walk toward the gate tile with plain waypoints.
    // _pathTowards is intentionally NOT used here to avoid mutual recursion
    // (_pathTowards calls openNearbyGate when the path is fully blocked).
    _walkToGate(player, gate);
    return true;
}

/**
 * Returns true if the player already has a pending gate/door interaction
 * queued (APLOC1 on a loc whose ops include an open keyword or that matches
 * a known barrier name prefix).
 *
 * walkTo calls this before clearPendingAction to avoid cancelling a gate
 * interaction that was set on the previous tick before the engine could
 * execute it — the root cause of the "sometimes opens, sometimes doesn't"
 * inconsistency.
 */
function _hasGateInteractionPending(player: Player): boolean {
    const target = player.target;
    if (!target || !(target instanceof Loc)) return false;
    if (player.targetOp !== ServerTriggerType.APLOC1) return false;
    const t = LocType.get((target as Loc).type);
    // Explicit barrier types (e.g. Al Kharid curtains)
    if (BARRIER_NAME_PREFIXES.some(p => t.debugname?.startsWith(p))) return true;
    const ops = (t.op ?? []).filter((o): o is string => typeof o === 'string').map(o => o.toLowerCase());
    return ops.some(op => GATE_OPEN_KEYWORDS.some(kw => op.startsWith(kw)));
}

// Toll gates that bots must never try to open — crossing is handled by the
// GATEWAY_REGIONS teleport in walkTo instead.
const TOLL_GATE_TYPE_IDS = new Set([2882, 2883, 1298, 1299, 1300, 1173, 375]); // border_gate_toll_left/right

/** Internal: returns true if `loc` passes the closed-gate predicate. */
function _isClosedGate(loc: Loc): boolean {
    if (TOLL_GATE_TYPE_IDS.has(loc.type)) return false;
    const t = LocType.get(loc.type);
    // Decorative vegetation — never a gate regardless of any ops.
    const debugLower = t.debugname?.toLowerCase() ?? '';
    const nameLower  = (t.name ?? '').toLowerCase();
    if (DECORATIVE_LOC_FRAGMENTS.some(f => debugLower.includes(f) || nameLower.includes(f))) return false;
    if (BARRIER_NAME_PREFIXES.some(p => t.debugname?.startsWith(p))) return true;
    if (BIG_DOOR_PREFIXES.some(p => debugLower.includes(p))) return true;
    const ops = (t.op ?? []).filter((o): o is string => typeof o === 'string').map(o => o.toLowerCase());
    const hasOpenOp = ops.some(op => GATE_OPEN_KEYWORDS.some(kw => op.startsWith(kw)));
    const hasCloseOp = ops.some(op => GATE_CLOSE_KEYWORDS.some(kw => op === kw));
    return hasOpenOp && !hasCloseOp;
}

/**
 * Directional variant of openNearbyGate.
 *
 * Scans up to `radius` tiles (default 10) for any closed door or gate that
 * lies roughly BETWEEN the player and (destX, destZ) — defined as a positive
 * dot product between the player→gate vector and the player→destination
 * heading.  Gates that are directly behind or perpendicular to the heading
 * are ignored, preventing the bot from opening unrelated doors while walking.
 *
 * Used by walkTo so that every movement call automatically clears gates along
 * the route rather than only reacting after the bot gets stuck.
 *
 * Returns true if a qualifying gate was found and an Open interaction was queued.
 */
export function openGateToward(player: Player, destX: number, destZ: number, radius = 10): boolean {
    const dx = destX - player.x;
    const dz = destZ - player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1) return false;

    const headX = dx / dist;
    const headZ = dz / dist;
    // Cap scan radius at (dist + 2) so we don't open gates beyond the destination.
    const scanRadius = Math.min(radius, dist + 2);

    const gate = _findLoc(player.x, player.z, player.level, scanRadius, loc => {
        if (!_isClosedGate(loc)) return false;
        // Directional filter: gate must be in the forward hemisphere (dot > 0).
        const dot = (loc.x - player.x) * headX + (loc.z - player.z) * headZ;
        return dot > 0;
    });

    if (!gate) return false;

    if (isAdjacentToLoc(player, gate)) {
        // Adjacent — fire the OPLOC1 script directly (same fix as openNearbyGate).
        if (_executeGateScript(player, gate)) return true;
        interactLoc(player, gate as any);
        return true;
    }

    // Not adjacent — walk toward the gate tile with plain waypoints.
    _walkToGate(player, gate);
    return true;
}

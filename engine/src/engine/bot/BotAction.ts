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
 *   findLocByNameWhere(...)                       — search by debug name + predicate
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
import { BotCollisionMap } from '#/engine/bot/BotCollisionMap.js';
import { trimPathAtCsvBlock, findNearestWalkableTile } from '#/engine/bot/BotNavigation.js';
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
import { BotDebugService, itemName, npcDebugName, locDebugName } from '#/engine/bot/debug/BotDebugService.js';

/** Debug-only: resolves the BotPlayer wrapper's name off a Player, or null for real (non-bot) players. */
function _debugBotName(player: Player): string | null {
    return (player as any)._bot?.name ?? null;
}

/**
 * Debug-only: records the start of an NPC/Loc interaction as an in-flight
 * BotDebugAction. Resolution (success/failed/timeout) happens generically in
 * BotPlayer's per-tick debug hook by observing XP/inventory deltas and an
 * age-based timeout — this function only ever records that the click happened.
 * No-op (and zero-cost beyond one map lookup) for real players / when disabled.
 */
function _debugStartInteraction(
    player: Player,
    type: string,
    targetType: 'npc' | 'loc',
    targetId: number,
    targetName: string,
    x: number,
    z: number,
    op: number
): void {
    try {
        const botName = _debugBotName(player);
        if (!botName) return;
        BotDebugService.startAction(botName, type, `${type === 'interactLoc' || type === 'interactLocOp' ? 'oploc' : 'opnpc'}${op} ${targetName}`, {
            type: targetType,
            id: targetId,
            name: targetName,
            x, z,
            level: player.level
        });
        BotDebugService.noteTarget(botName, targetName);
    } catch {
        // debug hook must never affect gameplay
    }
}

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
    try {
        const botName = _debugBotName(player);
        if (botName) BotDebugService.event(botName, 'movement', `teleport to (${x},${z},${level})`, { x, z, level });
    } catch {
        // debug hook must never affect gameplay
    }

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
 * the bot is currently outside, it walks to `approach` first, then tries
 * to open the gate before walking to `exit`. Once the bot is inside
 * the region normal pathfinding resumes. When leaving the region,
 * the bot will instead first go to `exit` and then to `approach`.
 * So only one gateway needs to be defined to handle both entry and exit.
 *
 * When adding a gateway to a region, bots will no longer enter/exit that
 * region through other means so make sure to also add a gateway to other
 * entrances even if they are open-ended and would otherwise not be required.
 * For readability, gateways are grouped by the region they are part of.
 *
 * Coordinate bounds are conservative on purpose — when in doubt keep them tight
 * so ordinary nearby destinations are never accidentally re-routed.
 */
type GatewayRegion = {
    readonly name: string;
    /** Destination is in the gated area. */
    readonly destInRegion: (x: number, z: number, l: number) => boolean;
    /**
     * Tile outside the region to approach from so the bot faces the gate from
     * the correct side. A second tile can be provided to create an area.
     * Keep the area small, for example a line that is one tile wide.
     */
    readonly approach: number[][];
    /**
     * Tile inside the region to exit from so the bot faces the gate from
     * the correct side. A second tile can be provided to create an area.
     * Keep the area small, for example a line that is one tile wide.
     */
    readonly exit: number[][];
    /**
     * If set, floor of the approach. Defaults to 0 (ground floor).
     */
    readonly approachLevel?: number;
    /**
     * If set, floor of the exit. Defaults to 0 (ground floor).
     */
    readonly exitLevel?: number;
    /**
     * If set, the bot is teleported instead of interacting with the gate.
     * Use for gates that require a toll or complex dialog that bots cannot
     * handle (e.g. the Al Kharid toll gate). Teleport location is
     * a random tile in the exit area (or approach area when leaving).
     */
    readonly teleport?: boolean;
};

const GATEWAY_REGIONS: GatewayRegion[] = [
    {
        // ── Lumbridge castle ──────────────────────────────────────────────────
        // Bots anywhere in the castle band (x > 3200, including Lumbridge spawn
        // at 3222,3219) heading west toward Draynor village (x < 3185) have the
        // castle walls across their straight-line path.  The BFS can route
        // around the castle, but the 90-tile midpoint often lands on the wrong
        // side of the walls and returns empty, leaving the bot looping on the
        // compass fallback.
        //
        // Fix: Force bots to enter and leave through the north of the castle.
        // If they head for Draynor, they automatically pick the west most tile.
        name: 'Lumbridge',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Lumbridge',
            'MisthalinEast',
            'Desert']),
        approach: [[3200, 3238], [3228, 3238]],
        exit: [[3201, 3237], [3228, 3237]]
    },
    {
        // ── Lumbridge sheep pen (gate) ────────────────────────────────────────
        // Fenced enclosure NE of Lumbridge castle. East gate at ~[3213, 3261].
        // Bots walking directly to the interior hit the fence unless they
        // approach from the east side and open the gate.
        name: 'LumbridgeSheep',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'LumbridgeSheep']),
        approach: [[3213, 3261], [3213, 3262]],
        exit: [[3212, 3261], [3212, 3262]]
    },
    {
        // ── Lumbridge ↔ Toll Gate ─────────────────────────────────────────────
        // South bridge over River Lum.
        name: 'RiverLumSouth',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'MisthalinEast',
            'Desert',
            'Wilderness',
            'Morytania']),
        approach: [[3244, 3225], [3244, 3226]],
        exit: [[3245, 3225], [3245, 3226]]
    },
    {
        // ── Lumbridge ↔ Varrock ───────────────────────────────────────────────
        // Second south bridge over River Lum near furnace.
        name: 'RiverLumSouth2',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'MisthalinEast',
            'Desert',
            'Wilderness',
            'Morytania']),
        approach: [[3234, 3261], [3234, 3262]],
        exit: [[3235, 3261], [3235, 3262]]
    },
    {
        // ── Barbarian Village ↔ Varrock ───────────────────────────────────────
        // Bridge over River Lum near Barbarian Village.
        name: 'RiverLumBarb',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'MisthalinEast',
            'Desert',
            'Morytania']),
        approach: [[3104, 3420], [3104, 3421]],
        exit: [[3105, 3420], [3105, 3421]]
    },
    {
        // ── Edgeville ↔ Varrock North ─────────────────────────────────────────
        // North bridge over River Lum near Wilderness.
        name: 'RiverLumNorth',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'MisthalinEast',
            'Wilderness',
            'Morytania']),
        approach: [[3131, 3516], [3131, 3518]],
        exit: [[3132, 3516], [3132, 3518]]
    },
    {
        // ── Lumbridge cow pen (gate) ──────────────────────────────────────────
        // Fenced enclosure north of Lumbridge castle.  South gate at ~[3253, 3265].
        // Bots walking directly to the interior ([3255, 3276]) hit the south
        // fence unless they approach through the gate tile.
        name: 'LumbridgeCow',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'LumbridgeCow']),
        approach: [[3252, 3266], [3252, 3267]],
        exit: [[3253, 3266], [3253, 3267]]
    },
    {
        // ── Varrock Square ↔ Varrock Palace ───────────────────────────────────
        // The yews at [3204, 3499] are north of Varrock palace and reachable
        // only by navigating through the city. Routing through the Varrock
        // south road entry gives the pathfinder a clear corridor to follow.
        name: 'VarrockPalace',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'VarrockPalace']),
        approach: [[3212, 3438], [3213, 3438]],
        exit: [[3212, 3439], [3213, 3439]]
    },
    {
        // ── Varrock East ↔ Varrock Palace ─────────────────────────────────────
        // East entrance to Varrock Palace.
        name: 'VarrockPalaceEast',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'VarrockPalace']),
        approach: [[3235, 3464], [3235, 3467]],
        exit: [[3234, 3465], [3234, 3466]]
    },
    {
        // ── Lumbridge ↔ Al Kharid (gate) ──────────────────────────────────────
        // The Lumbridge-AlKharid wall runs at x ≈ 3268, z ≈ 3197..3244.
        // Gate tile: ~[3268, 3227].  Destinations inside: warriors, bank,
        // scimitar shop, furnace, etc.  Bots must approach from the west side
        // (Lumbridge) to open the gate — NOT from the south where the wall has
        // no opening.  Without this routing a bot walking to [3294, 3172] hits
        // the wall 55 tiles south of the gate and can never open it.
        //
        // The gate charges a 10-coin toll and opens a dialog that bots cannot
        // handle.  Once the bot reaches the approach tile it is teleported
        // directly to the inside (3268, 3227) — the first open tile past the wall.
        name: 'AlKharid',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Desert']),
        approach: [[3267, 3227], [3267, 3228]],
        exit:     [[3268, 3227], [3268, 3228]],
        teleport: true
    },
    {
        // ── Varrock ↔ Al Kharid ───────────────────────────────────────────────
        // Bots from Varrock should go through the opening in the fence to
        // the north instead of going to the south gate.
        name: 'AlKharidNorth',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Desert']),
        approach: [[3279, 3330], [3285, 3330]],
        exit: [[3279, 3329], [3285, 3329]]
    },
    {
        // ── Al Kharid ↔ Desert (gate) ─────────────────────────────────────────
        // Access to the Kharidian desert via Shantay Pass. Requires a toll/pass
        // so bots teleport through the gate.
        name: 'ShantayPass',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'DesertSouth']),
        approach: [[3303, 3118], [3304, 3118]],
        exit: [[3303, 3115], [3304, 3115]],
        teleport: true
    },
    {
        // ── Port Sarim ↔ Draynor ──────────────────────────────────────────────
        // The Draynor market has a fence on its east side (x ≈ 3083, z ≈ 3248–
        // 3261). Bots leaving the Draynor bank (3092, 3245) heading northwest
        // toward Falador furnace, Falador range, or Barbarian Village willows
        // find the fence blocking the direct westward path through z ≈ 3248–
        // 3261. Via (3070, 3277) — just north of the fence top — the bot rounds
        // the corner and then has a clear westward run.
        name: 'DraynorFence',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Misthalin',
            'Desert',
            'Wilderness',
            'Morytania']),
        approach: [[3069, 3276], [3069, 3278]],
        exit: [[3070, 3276], [3070, 3278]]
    },
    {
        // ── Falador ↔ Barbarian Village ───────────────────────────────────────
        // The fence gets largely removed in revision 360. By checking the
        // current revision we can ensure better compatilibty between revisions.
        // This gateway automatically gets disabled after that.
        name: 'BarbFence',
        destInRegion: (x, z, l) => Environment.ENGINE_REVISION < 360 && checkRegion(x, z, l, [
            'Misthalin',
            'Desert',
            'Wilderness',
            'Morytania']),
        approach: [[3068, 3417], [3068, 3418]],
        exit: [[3069, 3416], [3069, 3418]]
    },
    {
        // ── Falador ↔ Barbarian Village ───────────────────────────────────────
        // Only enabled after revision 360. We still need a gateway otherwise
        // the bots walk all the way to the Draynor gateway.
        name: 'BarbFenceRemoved',
        destInRegion: (x, z, l) => Environment.ENGINE_REVISION >= 360 && checkRegion(x, z, l, [
            'Misthalin',
            'Desert',
            'Wilderness',
            'Morytania']),
        approach: [[3068, 3327], [3068, 3446]],
        exit: [[3069, 3328], [3069, 3445]]
    },
    {
        // ── Port Sarim ↔ Entrana (boat) ───────────────────────────────────────
        // Bots heading to Entrana (gathering herblore supplies or woodcutting)
        // walk to the Port Sarim northern docks and teleport to Entrana.
        name: 'Entrana',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Entrana']),
        approach: [[3048, 3234]],
        exit: [[2834, 3335]],
        teleport: true
    },
    {
        // ── Falador ↔ Taverley (gate) ─────────────────────────────────────────
        // The long wall between Falador and Taverley.
        name: 'Taverley',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Taverley',
            'Kandarin',
            'Feldip',
            'Troll',
            'Tirannwn',
            'Fremennik']),
        approach: [[2936, 3450], [2936, 3451]],
        exit: [[2935, 3450], [2935, 3451]]
    },
    {
        // ── Port Sarim ↔ Taverley (gate) ──────────────────────────────────────
        // Taverley south gate near Dark Wizards' Tower.
        name: 'TaverleySouth',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Taverley',
            'Kandarin',
            'Feldip',
            'Troll',
            'Tirannwn',
            'Fremennik']),
        approach: [[2933, 3319], [2934, 3319]],
        exit: [[2933, 3320], [2934, 3320]]
    },
    {
        // ── Taverley ↔ White Wolf Mountain ────────────────────────────────────
        // Bots heading from Taverley/Falador (x > 2870) toward Catherby/Seers
        // (x < 2800) must route through the mountain pass.
        // The BFS often gets lost in the mountain crags.
        name: 'WhiteWolf',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'WhiteWolf',
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']),
        approach: [[2864, 3441], [2868, 3441]],
        exit: [[2864, 3442], [2868, 3442]]
    },
    {
        // ── White Wolf Mountain East ↔ White Wolf Mountain West ────────────────
        // Top of the mountain near the gnome glider.
        name: 'WhiteWolfWest',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'WhiteWolfWest',
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']),
        approach: [[2853, 3508], [2853, 3510]],
        exit: [[2852, 3508], [2852, 3510]]
    },
    {
        // ── Port Sarim ↔ Karamja (boat) ───────────────────────────────────────
        // Bots heading to Karamja fishing spots (x < 2970) walk to the Port
        // Sarim docks (~3029, 3217) and are teleported to the Karamja landing
        // (2956, 3146). The boat costs 30 coins and triggers a dialog that
        // bots cannot handle natively, so teleport is used instead.
        name: 'MusaPointBoat',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Karamja',
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']),
        approach: [[3029, 3217]],
        exit: [[2956, 3146]],
        teleport: true
    },
    {
        // ── Musa Point ↔ Brimhaven (gate) ─────────────────────────────────────
        // Fence between Musa Point and Brimhaven.
        name: 'BrimhavenFence',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Karamja',
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']) &&
            !checkRegion(x, z, l, [
                'MusaPoint']),
        approach: [[2816, 3182], [2816, 3183]],
        exit: [[2815, 3182], [2815, 3183]]
    },
    {
        // ── Varrock ↔ Wilderness ──────────────────────────────────────────────
        // Longest stretch of the Wilderness border. This is compatible until
        // revision 456 where the Ditch is added. Coordinates will still be
        // correct but interaction would need to be added.
        name: 'WildernessVarrock',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Wilderness']),
        approach: [[3135, 3520], [3327, 3520]],
        exit: [[3135, 3523], [3327, 3523]]
    },
    {
        // ── Edgeville ↔ Wilderness ────────────────────────────────────────────
        // Also includes the stretch with the Monastery.
        name: 'WildernessEdgeville',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Wilderness']),
        approach: [[3042, 3520], [3123, 3520]],
        exit: [[3041, 3523], [3122, 3523]]
    },
    {
        // ── Ice Mountain ↔ Wilderness ─────────────────────────────────────────
        // Small passage connecting Ice Mountain with the Wilderness.
        name: 'WildernessIceMountain',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Wilderness']),
        approach: [[2998, 3529], [2998, 3533]],
        exit: [[2995, 3529], [2995, 3534]]
    },
    {
        // ── Mind Altar ↔ Wilderness ───────────────────────────────────────────
        // Only enabled prior to revision 249 for backwards compatiblity.
        // After that it opens up to include the Chaos Temple.
        name: 'WildernessWestOld',
        destInRegion: (x, z, l) => Environment.ENGINE_REVISION < 249 && checkRegion(x, z, l, [
            'Wilderness']),
        approach: [[2967, 3520], [2992, 3520]],
        exit: [[2967, 3523], [2992, 3523]]
    },
    {
        // ── Mind Altar ↔ Wilderness ───────────────────────────────────────────
        // Also connected to the new stretch with the Chaos Temple.
        name: 'WildernessWest',
        destInRegion: (x, z, l) => Environment.ENGINE_REVISION >= 249 && checkRegion(x, z, l, [
            'Wilderness']),
        approach: [[2945, 3520], [2992, 3520]],
        exit: [[2945, 3523], [2992, 3523]]
    },
    {
        // ── White Wolf Mountain ↔ Catherby ────────────────────────────────────
        // West exit from the mountain connecting to Kandarin.
        name: 'Catherby',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']),
        approach: [[2855, 3441]],
        exit: [[2855, 3440]]
    },
    {
        // ── Ardougne ↔ Tree Gnome Stronghold (gate) ───────────────────────────
        // Gate to the Tree Gnome Stronghold. Bots should have auto completed to
        // help Femi (var 152) so they can open the gate without dialog.
        name: 'GnomeStronghold',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GnomeStronghold']),
        approach: [[2460, 3382], [2462, 3382]],
        exit: [[2460, 3385], [2462, 3385]]
    },
    {
        // ── Tree Gnome Stronghold ↔ Gnome Stronghold South Bank (stairs) ──────
        // South stairs.
        // Bots need to interact with the stairs to get inside the bank.
        name: 'GnomeSouthBankS',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GnomeSouthBank']),
        approach: [[2446, 3415]],
        exit: [[2445, 3416]],
        exitLevel: 1
    },
    {
        // ── Tree Gnome Stronghold ↔ Gnome Stronghold South Bank (stairs) ──────
        // North stairs.
        // Bots need to interact with the stairs to get inside the bank.
        name: 'GnomeSouthBankN',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GnomeSouthBank']),
        approach: [[2444, 3434]],
        exit: [[2445, 3433]],
        exitLevel: 1
    },
    {
        // ── Tree Gnome Stronghold ↔ Grand Tree entrance (gate) ────────────────
        // Bots first need to open the gate to get into the Grand Tree.
        name: 'GrandTree',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GrandTree',
            'GrandTree1']),
        approach: [[2465, 3491], [2466, 3491]],
        exit: [[2465, 3493], [2466, 3493]]
    },
    {
        // ── Grand Tree entrance ↔ Grand Tree 1st floor (stairs) ───────────────
        // Stairs to the 1st floor of the Grand Tree.
        name: 'GrandTree1',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GrandTree1']),
        approach: [[2466, 3494]],
        exit: [[2466, 3494]],
        exitLevel: 1
    },
    {
        // ── Grand Tree 1st floor ↔ Grand Tree 2nd floor (stairs) ──────────────
        // Stairs to the 2nd floor of the Grand Tree.
        name: 'GrandTree2',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GrandTree2']),
        approach: [[2466, 3494]],
        exit: [[2466, 3494]],
        approachLevel: 1,
        exitLevel: 2
    },
    {
        // ── Grand Tree 2nd floor ↔ Grand Tree 3nd floor (stairs) ──────────────
        // Stairs to the 3nd floor of the Grand Tree.
        name: 'GrandTree3',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'GrandTree3']),
        approach: [[2466, 3494]],
        exit: [[2466, 3494]],
        approachLevel: 2,
        exitLevel: 3
    },
    {
        // ── Brimhaven ↔ Ardougne (boat) ───────────────────────────────────────
        // Bots heading to Ardougne can take the boat from Karamja.
        // The boat costs 30 coins and triggers a dialog that
        // bots cannot handle natively, so teleport is used instead.
        name: 'BrimhavenBoat',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Kandarin',
            'Feldip',
            'Tirannwn',
            'Fremennik']),
        approach: [[2772, 3234]],
        exit: [[2683, 3271]],
        teleport: true
    },
    {
        // ── Legends' Guild ↔ Ardougne Docks ───────────────────────────────────
        // Docks entrance to Ardougne.
        name: 'ArdougneDocks',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2688, 3275], [2688, 3276]],
        exit: [[2687, 3275], [2687, 3276]]
    },
    {
        // ── Legends' Guild ↔ Ardougne Market ──────────────────────────────────
        // East entrance to Ardougne.
        name: 'ArdougneMarket',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2688, 3304], [2688, 3306]],
        exit: [[2687, 3303], [2687, 3306]]
    },
    {
        // ── Hemenster ↔ Ardougne ──────────────────────────────────────────────
        // Main north entrance to Ardougne.
        name: 'ArdougneNorth',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2635, 3340], [2637, 3340]],
        exit: [[2635, 3339], [2637, 3339]]
    },
    {
        // ── Fishing Guild ↔ Ardougne ──────────────────────────────────────────
        // Entrance to Ardougne closest to north bank.
        name: 'ArdougneNorthBank',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2612, 3342], [2613, 3342]],
        exit: [[2612, 3341], [2613, 3341]]
    },
    {
        // ── Fishing Guild ↔ Ardougne ──────────────────────────────────────────
        // Entrance to Ardougne, north of castle.
        name: 'ArdougneNorthCastle',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2587, 3342], [2588, 3342]],
        exit: [[2587, 3341], [2588, 3341]]
    },
    {
        // ── Tree Gnome Stronghold ↔ Ardougne ──────────────────────────────────
        // Small entrance to Ardougne, northwest corner.
        name: 'ArdougneNorthWest',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'Ardougne',
            'KandarinSouth',
            'Feldip']),
        approach: [[2559, 3337]],
        exit: [[2559, 3336]]
    },
    {
        // ── Ardougne ↔ Battlefield ────────────────────────────────────────────
        // Southwest exit from Ardougne.
        name: 'ArdougneSouthWest',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'KandarinSouth',
            'Feldip']),
        approach: [[2559, 3264], [2663, 3264]],
        exit: [[2558, 3263], [2662, 3263]]
    },
    {
        // ── Ardougne zoo ↔ Monastery ──────────────────────────────────────────
        // Main south exit from Ardougne.
        name: 'ArdougneZoo',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'KandarinSouth',
            'Feldip']),
        approach: [[2602, 3264], [2603, 3264]],
        exit: [[2602, 3263], [2603, 3263]]
    },
    {
        // ── Ardougne ↔ Monastery ──────────────────────────────────────────────
        // Southeast exit from Ardougne closest to south bank.
        name: 'ArdougneSouthEast',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'KandarinSouth',
            'Feldip']),
        approach: [[2640, 3264], [2641, 3264]],
        exit: [[2639, 3263], [2640, 3263]]
    },
    {
        // ── Ardougne Market ↔ Ardougne Castle ─────────────────────────────────
        // Bridge to Ardougne Castle.
        name: 'ArdougneRiverWest',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'ArdougneRiverWest']),
        approach: [[2599, 3295], [2599, 3297]],
        exit: [[2598, 3295], [2598, 3297]]
    },
    {
        // ── East Ardougne ↔ West Ardougne (gate) ──────────────────────────────
        // Gate to West Ardougne, requires completion of Plague City which
        // the bots should have auto completed.
        name: 'WestArdougne',
        destInRegion: (x, z, l) => checkRegion(x, z, l, [
            'WestArdougne']),
        approach: [[2559, 3299], [2559, 3300]],
        exit: [[2556, 3299], [2556, 3300]]
    }
];

/**
 * Regions used as destination for gateways. Defined separately so they
 * can be used for multiple gateways. For readability, regions are grouped
 * under a bigger region that they are part of. The westernmost coordinate
 * is listed first and then drawn clockwise.
 */
type Region = {
    readonly name: string;
    /** 
     * Each [x, z] tile creates a line to the next tile.
     * A triangle is created with 3 tiles and more tiles can
     * be provided to precisely define a region as a polygon.
     */
    readonly coords: number[][];
    /**
     * If set, this region only applies to this floor and those above it.
     * Otherwise all floors are inside the region.
     */
    readonly level?: number;
    /**
     * If set, names of regions that should also be part of this region
     * but could not be included in `coords`.
     * This applies to dungeons and other separated regions.
     */
    readonly contains?: string[];
};

const REGIONS: Region[] = [
    // ── Kingdom of Misthalin ──────────────────────────────────────────────────
    {
        name: 'Misthalin',
        coords: [
            [3025, 3071],
            [3070, 3273],
            [3070, 3285],
            [3069, 3327],
            [3069, 3453],
            [3066, 3453],
            [3066, 3520],
            [3408, 3520],
            [3408, 3505],
            [3418, 3496],
            [3418, 3484],
            [3423, 3479],
            [3423, 3475],
            [3403, 3451],
            [3394, 3330],
            [3274, 3330],
            [3267, 3323],
            [3267, 3209],
            [3252, 3179],
            [3250, 3140],
            [3197, 3131],
            [3130, 3045]]
    },
    {
        name: 'Lumbridge',
        coords: [
            [3201, 3199],
            [3201, 3237],
            [3238, 3237],
            [3238, 3234],
            [3244, 3227],
            [3244, 3223],
            [3258, 3213],
            [3260, 3197],
            [3256, 3191],
            [3238, 3191],
            [3218, 3199]]
    },
    {
        name: 'LumbridgeSheep',
        coords: [
            [3193, 3257],
            [3193, 3276],
            [3204, 3276],
            [3210, 3275],
            [3212, 3269],
            [3212, 3257]]
    },
    {
        name: 'MisthalinEast',
        coords: [
            [3102, 3473],
            [3108, 3487],
            [3114, 3493],
            [3124, 3498],
            [3132, 3514],
            [3132, 3520],
            [3408, 3520],
            [3408, 3505],
            [3418, 3496],
            [3418, 3484],
            [3423, 3479],
            [3423, 3475],
            [3403, 3451],
            [3394, 3330],
            [3274, 3330],
            [3267, 3323],
            [3267, 3209],
            [3261, 3197],
            [3259, 3214],
            [3245, 3224],
            [3245, 3228],
            [3239, 3235],
            [3235, 3259],
            [3235, 3267],
            [3220, 3287],
            [3213, 3320],
            [3197, 3341],
            [3179, 3349],
            [3157, 3349],
            [3142, 3388],
            [3118, 3389],
            [3105, 3417],
            [3105, 3424],
            [3113, 3432],
            [3103, 3446]]
    },
    {
        name: 'LumbridgeCow',
        coords: [
            [3242, 3282],
            [3242, 3298],
            [3265, 3298],
            [3265, 3255],
            [3253, 3255],
            [3253, 3271]]
    },
    {
        name: 'VarrockPalace',
        coords: [
            [3186, 3458],
            [3186, 3461],
            [3188, 3463],
            [3188, 3475],
            [3191, 3478],
            [3191, 3496],
            [3200, 3507],
            [3228, 3507],
            [3234, 3501],
            [3234, 3454],
            [3219, 3439],
            [3208, 3439],
            [3189, 3458]]
    },
    // ── Kharidian Desert ──────────────────────────────────────────────────────
    {
        name: 'Desert',
        coords: [
            [2980, 2794],
            [3198, 3130],
            [3251, 3139],
            [3253, 3178],
            [3268, 3208],
            [3268, 3322],
            [3275, 3329],
            [3394, 3329],
            [3432, 3178],
            [3619, 3077],
            [3377, 2465]]
    },
    {
        name: 'DesertSouth',
        coords: [
            [2980, 2794],
            [3198, 3130],
            [3251, 3139],
            [3296, 3131],
            [3296, 3116],
            [3314, 3116],
            [3314, 3135],
            [3333, 3135],
            [3333, 3158],
            [3354, 3157],
            [3357, 3143],
            [3374, 3133],
            [3380, 3125],
            [3395, 3149],
            [3393, 3165],
            [3409, 3161],
            [3421, 3188],
            [3432, 3178],
            [3619, 3077],
            [3377, 2465]]
    },
    // ── Kingdom of Asgarnia ───────────────────────────────────────────────────
    {
        name: 'Asgarnia',
        coords: [
            [2784, 3326],
            [2800, 3398],
            [2837, 3429],
            [2846, 3428],
            [2859, 3415],
            [2864, 3420],
            [2864, 3436],
            [2857, 3441],
            [2854, 3441],
            [2840, 3449],
            [2843, 3458],
            [2834, 3466],
            [2829, 3491],
            [2815, 3496],
            [2796, 3488],
            [2788, 3502],
            [2802, 3551],
            [2833, 3551],
            [2840, 3577],
            [2879, 3577],
            [2892, 3585],
            [2940, 3583],
            [2940, 3520],
            [2992, 3520],
            [2998, 3526],
            [2998, 3534],
            [3006, 3543],
            [3023, 3543],
            [3040, 3520],
            [3065, 3520],
            [3065, 3452],
            [3068, 3452],
            [3068, 3326],
            [3069, 3284],
            [3069, 3274],
            [3024, 3071],
            [2962, 3114],
            [2963, 3177],
            [2883, 3218],
            [2886, 3324]]
    },
    {
        name: 'Entrana',
        coords: [
            [2784, 3326],
            [2800, 3398],
            [2870, 3396],
            [2886, 3324]]
    },
    {
        name: 'Taverley',
        coords: [
            [2788, 3502],
            [2802, 3551],
            [2833, 3551],
            [2840, 3577],
            [2879, 3577],
            [2892, 3585],
            [2940, 3583],
            [2940, 3520],
            [2929, 3520],
            [2929, 3509],
            [2936, 3509],
            [2936, 3475],
            [2940, 3471],
            [2940, 3454],
            [2935, 3454],
            [2935, 3448],
            [2940, 3448],
            [2944, 3444],
            [2944, 3413],
            [2936, 3387],
            [2936, 3320],
            [2928, 3320],
            [2928, 3328],
            [2911, 3328],
            [2911, 3320],
            [2887, 3324],
            [2871, 3397],
            [2800, 3399],
            [2837, 3429],
            [2846, 3428],
            [2859, 3415],
            [2864, 3420],
            [2864, 3436],
            [2857, 3441],
            [2854, 3441],
            [2840, 3449],
            [2843, 3458],
            [2834, 3466],
            [2829, 3491],
            [2815, 3496],
            [2796, 3488]]
    },
    {
        name: 'WhiteWolf',
        coords: [
            [2788, 3502],
            [2802, 3551],
            [2852, 3528],
            [2868, 3531],
            [2879, 3524],
            [2879, 3497],
            [2871, 3484],
            [2877, 3458],
            [2877, 3442],
            [2862, 3442],
            [2864, 3436],
            [2857, 3441],
            [2854, 3441],
            [2840, 3449],
            [2843, 3458],
            [2834, 3466],
            [2829, 3491],
            [2815, 3496],
            [2796, 3488]]
    },
    {
        name: 'WhiteWolfWest',
        coords: [
            [2788, 3502],
            [2802, 3551],
            [2852, 3528],
            [2852, 3507],
            [2858, 3501],
            [2858, 3492],
            [2852, 3484],
            [2852, 3451],
            [2862, 3442],
            [2864, 3436],
            [2857, 3441],
            [2854, 3441],
            [2840, 3449],
            [2843, 3458],
            [2834, 3466],
            [2829, 3491],
            [2815, 3496],
            [2796, 3488]]
    },
    // ── Karamja ───────────────────────────────────────────────────────────────
    {
        name: 'Karamja',
        coords: [
            [2672, 3205],
            [2709, 3246],
            [2807, 3257],
            [2784, 3325],
            [2885, 3323],
            [2882, 3217],
            [2962, 3176],
            [2961, 3113],
            [3024, 3070],
            [3008, 2857],
            [2729, 2852],
            [2727, 3103]]
    },
    {
        name: 'MusaPoint',
        coords: [
            [2816, 3144],
            [2816, 3217],
            [2882, 3217],
            [2962, 3176],
            [2961, 3113]]
    },
    // ── Wilderness ────────────────────────────────────────────────────────────
    {
        name: 'Wilderness',
        coords: [
            [2941, 3521],
            [2941, 3663],
            [2950, 3678],
            [2941, 3687],
            [2941, 4003],
            [3384, 4001],
            [3700, 3584],
            [3391, 3584],
            [3391, 3534],
            [3408, 3521],
            [3041, 3521],
            [3024, 3544],
            [3005, 3544],
            [2997, 3535],
            [2997, 3527],
            [2991, 3521]]
    },
    // ── Kingdom of Kandarin ───────────────────────────────────────────────────
    {
        name: 'Kandarin',
        coords: [
            [2176, 3636],
            [2331, 3741],
            [2490, 3596],
            [2532, 3596],
            [2567, 3583],
            [2651, 3597],
            [2657, 3597],
            [2662, 3600],
            [2668, 3597],
            [2676, 3599],
            [2681, 3604],
            [2686, 3600],
            [2717, 3594],
            [2728, 3594],
            [2744, 3587],
            [2754, 3590],
            [2801, 3551],
            [2787, 3502],
            [2796, 3487],
            [2816, 3495],
            [2828, 3490],
            [2833, 3465],
            [2842, 3457],
            [2839, 3448],
            [2853, 3440],
            [2856, 3440],
            [2863, 3435],
            [2863, 3421],
            [2858, 3416],
            [2847, 3429],
            [2836, 3430],
            [2799, 3399],
            [2783, 3326],
            [2806, 3257],
            [2708, 3247],
            [2671, 3206],
            [2726, 3102],
            [2680, 3066],
            [2516, 3066],
            [2455, 3060],
            [2455, 3009],
            [2305, 3021],
            [2326, 3078],
            [2365, 3080],
            [2365, 3142],
            [2408, 3335],
            [2346, 3335],
            [2334, 3392],
            [2178, 3392]]
    },
    {
        name: 'KandarinNorth',
        coords: [
            [2176, 3636],
            [2331, 3741],
            [2490, 3596],
            [2532, 3596],
            [2567, 3583],
            [2651, 3597],
            [2657, 3597],
            [2662, 3600],
            [2668, 3597],
            [2676, 3599],
            [2681, 3604],
            [2686, 3600],
            [2717, 3594],
            [2728, 3594],
            [2744, 3587],
            [2754, 3590],
            [2801, 3551],
            [2787, 3502],
            [2796, 3487],
            [2816, 3495],
            [2828, 3490],
            [2833, 3465],
            [2842, 3457],
            [2839, 3448],
            [2853, 3440],
            [2856, 3440],
            [2863, 3435],
            [2863, 3421],
            [2858, 3416],
            [2847, 3429],
            [2836, 3430],
            [2799, 3399],
            [2783, 3326],
            [2806, 3257],
            [2688, 3264],
            [2688, 3328],
            [2681, 3335],
            [2674, 3335],
            [2669, 3340],
            [2617, 3340],
            [2615, 3342],
            [2563, 3342],
            [2559, 3337],
            [2461, 3337],
            [2461, 3325],
            [2433, 3325],
            [2408, 3335],
            [2346, 3335],
            [2334, 3392],
            [2178, 3392]]
    },
    {
        name: 'GnomeStronghold',
        coords: [
            [2369, 3423],
            [2369, 3431],
            [2371, 3433],
            [2371, 3442],
            [2375, 3446],
            [2375, 3457],
            [2381, 3464],
            [2381, 3473],
            [2374, 3486],
            [2374, 3532],
            [2472, 3532],
            [2495, 3511],
            [2495, 3430],
            [2497, 3428],
            [2497, 3418],
            [2493, 3403],
            [2505, 3391],
            [2467, 3391],
            [2465, 3389],
            [2465, 3384],
            [2457, 3384],
            [2457, 3389],
            [2455, 3391],
            [2442, 3391],
            [2438, 3388],
            [2435, 3388],
            [2427, 3393],
            [2421, 3393],
            [2414, 3400],
            [2414, 3408],
            [2410, 3412],
            [2392, 3412],
            [2386, 3407],
            [2380, 3408],
            [2376, 3411],
            [2375, 3417]]
    },
    {
        name: 'GnomeSouthBank',
        coords: [
            [2443, 3415],
            [2443, 3434],
            [2448, 3434],
            [2448, 3415]],
        level: 1
    },
    {
        name: 'GrandTree',
        coords: [
            [2463, 3493],
            [2463, 3498],
            [2468, 3498],
            [2468, 3493]]
    },
    {
        name: 'GrandTree1',
        coords: [
            [2438, 3478],
            [2438, 3520],
            [2500, 3520],
            [2500, 3478]],
        level: 1
    },
    {
        name: 'GrandTree2',
        coords: [
            [2438, 3478],
            [2438, 3520],
            [2500, 3520],
            [2500, 3478]],
        level: 2
    },
    {
        name: 'GrandTree3',
        coords: [
            [2438, 3478],
            [2438, 3520],
            [2500, 3520],
            [2500, 3478]],
        level: 3
    },
    {
        name: 'Ardougne',
        coords: [
            [2433, 3305],
            [2433, 3324],
            [2462, 3324],
            [2462, 3336],
            [2560, 3336],
            [2564, 3341],
            [2614, 3341],
            [2616, 3339],
            [2668, 3339],
            [2673, 3334],
            [2680, 3334],
            [2687, 3327],
            [2687, 3264],
            [2509, 3264],
            [2509, 3279],
            [2459, 3279],
            [2459, 3305]]
    },
    {
        name: 'ArdougneRiverWest',
        coords: [
            [2433, 3305],
            [2433, 3324],
            [2462, 3324],
            [2462, 3336],
            [2560, 3336],
            [2564, 3341],
            [2600, 3341],
            [2600, 3320],
            [2592, 3312],
            [2598, 3302],
            [2598, 3290],
            [2586, 3264],
            [2509, 3264],
            [2509, 3279],
            [2459, 3279],
            [2459, 3305]]
    },
    {
        name: 'WestArdougne',
        coords: [
            [2433, 3305],
            [2433, 3324],
            [2462, 3324],
            [2462, 3336],
            [2558, 3336],
            [2558, 3264],
            [2509, 3264],
            [2509, 3279],
            [2459, 3279],
            [2459, 3305]]
    },
    {
        name: 'KandarinSouth',
        coords: [
            [2305, 3021],
            [2326, 3078],
            [2365, 3080],
            [2365, 3142],
            [2408, 3334],
            [2432, 3324],
            [2432, 3304],
            [2458, 3304],
            [2458, 3278],
            [2508, 3278],
            [2508, 3263],
            [2686, 3263],
            [2805, 3256],
            [2708, 3247],
            [2671, 3206],
            [2726, 3102],
            [2680, 3066],
            [2516, 3066],
            [2455, 3060],
            [2455, 3009]]
    },
    // ── Feldip Hills ──────────────────────────────────────────────────────────
    {
        name: 'Feldip',
        coords: [
            [2456, 3008],
            [2456, 3059],
            [2516, 3065],
            [2680, 3065],
            [2640, 2793],
            [2289, 2798]]
    },
    // ── Morytania ─────────────────────────────────────────────────────────────
    {
        name: 'Morytania',
        coords: [
            [3392, 3535],
            [3392, 3583],
            [3900, 3583],
            [3900, 2800],
            [3619, 2800],
            [3620, 3078],
            [3433, 3179],
            [3395, 3330],
            [3404, 3450],
            [3424, 3474],
            [3424, 3480],
            [3419, 3485],
            [3419, 3497],
            [3409, 3506],
            [3409, 3522]]
    },
    // ── Troll Country ─────────────────────────────────────────────────────────
    {
        name: 'Troll',
        coords: [
            [2750, 3712],
            [2750, 3911],
            [2940, 4003],
            [2940, 3686],
            [2949, 3678],
            [2940, 3664],
            [2940, 3584],
            [2891, 3586],
            [2878, 3578],
            [2839, 3578],
            [2832, 3552],
            [2802, 3552],
            [2802, 3637],
            [2822, 3650],
            [2822, 3712]]
    },
    // ── Tirannwn ──────────────────────────────────────────────────────────────
    {
        name: 'Tirannwn',
        coords: [
            [2038, 3019],
            [2179, 3391],
            [2333, 3391],
            [2345, 3334],
            [2407, 3334],
            [2364, 3143],
            [2364, 3081],
            [2326, 3079],
            [2304, 3021]]
    },
    // ── Fremennik Province ────────────────────────────────────────────────────
    {
        name: 'Fremennik',
        coords: [
            [2052, 3809],
            [2052, 3957],
            [2779, 4145],
            [2749, 3912],
            [2749, 3711],
            [2821, 3711],
            [2821, 3651],
            [2801, 3638],
            [2801, 3552],
            [2754, 3591],
            [2744, 3588],
            [2729, 3595],
            [2718, 3595],
            [2687, 3601],
            [2681, 3605],
            [2675, 3600],
            [2668, 3598],
            [2662, 3601],
            [2656, 3598],
            [2652, 3598],
            [2567, 3584],
            [2533, 3597],
            [2491, 3597],
            [2331, 3742]]
    }
];

/**
 * For each region, check if point (x, z) is inside.
 * Return true if the point is in any of the regions.
 * If the region contains more regions, check if the point is in any of those.
 * But don't further check if those regions contain even more regions,
 * they can be added to the `contains` field of the main region if desired.
 * If the point was not found in any of the regions, return false.
 */
function checkRegion(x: number, z: number, level: number, names: string[]): boolean {
    for (const name of names) {
        const region = REGIONS.find(r => r.name === name);
        if (!region) continue;
        if (region.level && region.level > level) continue;
        if (isInside(region.coords, x, z)) return true;
        if (!region.contains) continue;
        for (const i of region.contains) {
            const contained = REGIONS.find(r => r.name === i);
            if (!contained) continue;
            if (contained.level && contained.level > level) continue;
            if (isInside(contained.coords, x, z)) return true;
        }
    }
    return false;
}

/**
 * Given a point (x, z) and a polygon represented by its vertices,
 * determine whether the point lies inside the polygon.
 * The polygon is represented by an array arr[][],
 * where arr[i] = [xi, zi] denotes the coordinates of the i-th vertex.
 * Return true if the point lies inside the polygon; otherwise, return false.
 * Note: A point lying on the boundary (edge or vertex) of the polygon
 * is also considered inside the polygon.
 */
function isInside(arr: number[][], x: number, z: number): boolean {
    const n = arr.length;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [x1, z1] = arr[i];
        const [x2, z2] = arr[j];

        // Point lies on the current edge
        if (onSegment(x1, z1, x2, z2, x, z)) return true;

        // Check whether the horizontal ray from (x, z)
        // intersects the current edge
        const intersect =
            ((z1 > z) !== (z2 > z)) &&
            (x < (x2 - x1) * (z - z1) / (z2 - z1) + x1);

        if (intersect) inside = !inside;
    }
    return inside;
}

function onSegment(x1: number, z1: number, x2: number, z2: number, x: number, z: number): boolean {
    const c = (x - x1) * (z2 - z1) - (z - z1) * (x2 - x1);
    if (c !== 0) return false;

    return Math.min(x1, x2) <= x && x <= Math.max(x1, x2) &&
        Math.min(z1, z2) <= z && z <= Math.max(z1, z2);
}

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
            const safe = trimPathAtCsvBlock(player.level, path);
            if (safe.length > 0) {
                player.queueWaypoints(safe);
                return;
            }
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
            if (BotCollisionMap.isCsvBlocked(player.level, midX, midZ)) continue;
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                const safe = trimPathAtCsvBlock(player.level, path);
                if (safe.length > 0) {
                    player.queueWaypoints(safe);
                    return;
                }
            }
        }
        // Retry with shorter segments in case the 90-tile target is unreachable
        for (const deg of [0, 20, -20, 40, -40, 60, -60]) {
            const angle = baseAngle + (deg * Math.PI) / 180;
            const midX = Math.round(player.x + Math.cos(angle) * 60);
            const midZ = Math.round(player.z + Math.sin(angle) * 60);
            if (BotCollisionMap.isCsvBlocked(player.level, midX, midZ)) continue;
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                const safe = trimPathAtCsvBlock(player.level, path);
                if (safe.length > 0) {
                    player.queueWaypoints(safe);
                    return;
                }
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
            if (BotCollisionMap.isCsvBlocked(player.level, midX, midZ)) continue;
            let path = botWalkPath(player.level, player.x, player.z, midX, midZ);
            if (path.length === 0) path = botFindPath(player.level, player.x, player.z, midX, midZ);
            if (path.length > 0) {
                const safe = trimPathAtCsvBlock(player.level, path);
                if (safe.length > 0) {
                    player.queueWaypoints(safe);
                    return;
                }
            }
        }
    }

    // Absolute last resort: 1-tile naive step (skip if CSV-blocked)
    const naiveX = player.x + Math.sign(dx);
    const naiveZ = player.z + Math.sign(dz);
    if (!BotCollisionMap.isCsvBlocked(player.level, naiveX, naiveZ)) {
        player.queueWaypoint(naiveX, naiveZ);
    }
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
export function walkTo(player: Player, destX: number, destZ: number, level = 0): void {
    try {
        const botName = _debugBotName(player);
        if (botName) BotDebugService.noteDestination(botName, destX, destZ, level);
    } catch {
        // debug hook must never affect gameplay
    }

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

    if (Math.abs(player.x - destX) < 1 && Math.abs(player.z - destZ) < 1 && player.level === level) return;

    // ── Gateway routing ─────────────────────────────────────────────────────
    // If the destination is inside a gated region and the bot is outside,
    // walk to the approach area first, then open the gate, then proceed
    // to the exit area. If there are multiple gateways to the destination,
    // try to find the most optimal route before selecting the next gateway.
    // Working backwards through the gateways from destination to the bot,
    // find the optimal gateway and set it as new destination.
    // Repeat until no gateways are left so we know our first destination.
    let gw: GatewayRegion | null = null;
    let gwExit: number[][] | null = null;
    let next = [destX, destZ, level];
    let nextExit = next;
    const currRegions = [...GATEWAY_REGIONS];
    for (const _i of GATEWAY_REGIONS) {
        let bestgw: GatewayRegion | null = null;
        let bestDist = Infinity;
        let bestDist2 = Infinity;
        let best = next;

        // Check whether the destination requires more diagonal or
        // vertical/horizontal movement. For use later.
        let diagonal = true;
        const dx = next[0] - player.x;
        const dz = next[1] - player.z;
        if (dx > 2 * dz || dz > 2 * dx) diagonal = false;

        for (const curr of currRegions) {
            let approach = curr.approach;
            let exit = curr.exit;
            // Approach or exit not properly defined.
            if (approach.length < 1 || exit.length < 1) continue;
            if (approach[0].length < 2 || exit[0].length < 2) continue;
            let approachLevel = curr.approachLevel ?? 0;
            let exitLevel = curr.exitLevel ?? 0;

            // Only consider gateways where the destination
            // is in the region and the bot is outside.
            // Or the destination is outside but the bot inside.
            if (curr.destInRegion(next[0], next[1], next[2])) {
                if (curr.destInRegion(player.x, player.z, player.level)) {
                    continue;
                }
            } else {
                if (!curr.destInRegion(player.x, player.z, player.level)) {
                    continue;
                } else {
                    // Swap values when exiting for easier calculation.
                    approach = curr.exit;
                    exit = curr.approach;
                    approachLevel = curr.exitLevel ?? 0;
                    exitLevel = curr.approachLevel ?? 0;
                }
            }

            // If an approach/exit area is defined, check for the optimal tile.
            const bestApproach = closestBetween(approach, [player.x, player.z], [next[0], next[1]]);
            let bestExit = [exit[0][0], exit[0][1]];
            if (exit.length > 1) {
                // If teleport area is defined, use the average.
                if (curr.teleport) {
                    bestExit[0] = (exit[0][0] + exit[1][0]) / 2;
                    bestExit[1] = (exit[0][1] + exit[1][1]) / 2;
                } else {
                    bestExit = closestBetween(exit, bestApproach, [next[0], next[1]]);
                }
            }

            // Combine distance from bot to gateway and distance from
            // gateway to destination. If no teleport, also add distance from
            // approach to exit. The best gateway has the least total distance.
            // Use Chebyshev distance if the destination requires more
            // vertical/horizontal movement and Manhattan distance for diagonal.
            // This better ensures that we don't pick a gateway behind the bot.
            // If this results in gateways having the same distance,
            // use Euclidean distance to find the one closest to our path.
            const dx1 = Math.abs(bestApproach[0] - player.x);
            const dz1 = Math.abs(bestApproach[1] - player.z);
            const dx2 = Math.abs(next[0] - bestExit[0]);
            const dz2 = Math.abs(next[1] - bestExit[1]);
            let dx3 = 0;
            let dz3 = 0;
            if (!curr.teleport) {
                dx3 = Math.abs(bestExit[0] - bestApproach[0]);
                dz3 = Math.abs(bestExit[1] - bestApproach[1]);
            }

            let currDist = 0;
            if (diagonal) {
                currDist = dx1 + dz1 + dx2 + dz2 + dx3 + dz3;
            } else {
                currDist = Math.max(dx1 + dz1) + Math.max(dx2 + dz2) + Math.max(dx3 + dz3);
            }
            const currDist2 =
                Math.sqrt(dx1 * dx1 + dz1 * dz1) +
                Math.sqrt(dx2 * dx2 + dz2 * dz2) +
                Math.sqrt(dx3 * dx3 + dz3 * dz3);
            if (currDist < bestDist || (currDist === bestDist && currDist2 < bestDist2)) {
                bestgw    = curr;
                bestDist  = currDist;
                bestDist2 = currDist2;
                best      = [bestApproach[0], bestApproach[1], approachLevel];
                nextExit  = [bestExit[0], bestExit[1], exitLevel];
                gwExit    = exit;
            }
        }

        // Found gateway is set as new destination so we go back and find
        // a route to it first until there are no more prior gateways.
        // In which case we can finally path to this gateway.
        if (bestgw) {
            gw = bestgw;
            next = best;

            // Ensure each gateway is only used once in the calculated route.
            const index = currRegions.indexOf(bestgw);
            if (index > -1) {
                currRegions.splice(index, 1);
            }
        } else {
            break;
        }
    }

    // If a gateway was found, one of 4 things will happen.
    // 1. If not near approach tile, walk to it first.
    // 2. If teleport is set, teleport to exit area.
    // 3. If changing floor, interact with stairs.
    // 4. Otherwise walk to exit area.
    if (gw && gwExit) {
        const gwDist = Math.max(Math.abs(player.x - next[0]), Math.abs(player.z - next[1])); // Chebyshev distance

        if (gwDist > 5) {
            // Not yet at the approach tile — walk toward it first.
            // If the requested destination is CSV-blocked or WALK_BLOCKED,
            // find the nearest walkable tile.
            if (BotCollisionMap.isCsvBlocked(next[2], next[0], next[1])) {
                const alt = findNearestWalkableTile(next[2], next[0], next[1], 5);
                if (!alt) return; // nowhere reachable near this destination
                next[0] = alt.x;
                next[1] = alt.z;
            }
            _pathTowards(player, next[0], next[1]);

            try {
                const botName = _debugBotName(player);
                if (botName) BotDebugService.event(botName, 'movement', `approach gateway ${gw.name} (${next[0]},${next[1]},${next[2]})`);
            } catch {
                // debug hook must never affect gameplay
            }
            return;
        }

        // Close to approach tile — cross the gate.
        if (gw.teleport) {
            let teleportDestX = gwExit[0][0];
            let teleportDestZ = gwExit[0][1];
            // Toll/dialog gate that bots can't interact with — teleport through.
            // If teleport area is defined, use random tile in area.
            if (gwExit.length > 1) {
                const xMin = Math.min(gwExit[0][0], gwExit[1][0]);
                const zMin = Math.min(gwExit[0][1], gwExit[1][1]);
                const xMax = Math.max(gwExit[0][0], gwExit[1][0]);
                const zMax = Math.max(gwExit[0][1], gwExit[1][1]);
                teleportDestX = xMin + Math.floor(Math.random() * (xMax - xMin + 1));
                teleportDestZ = zMin + Math.floor(Math.random() * (zMax - zMin + 1));
            }
            // If the requested destination is CSV-blocked or WALK_BLOCKED,
            // find the nearest walkable tile before teleporting.
            if (BotCollisionMap.isCsvBlocked(nextExit[2], teleportDestX, teleportDestZ)) {
                const alt = findNearestWalkableTile(nextExit[2], teleportDestX, teleportDestZ, 5);
                if (!alt) return; // nowhere reachable near this destination
                teleportDestX = alt.x;
                teleportDestZ = alt.z;
            }
            botTeleport(player, teleportDestX, teleportDestZ, nextExit[2]);
            return;
        }

        // Changing floor, interact with stairs.
        if (next[2] < nextExit[2] || (next[1] > 4100 && nextExit[1] <= 4100)) {
            interactNearbyLocByOps(player, 'climb-up', 8);
            return;
        } else if (next[2] > nextExit[2] || (next[1] <= 4100 && nextExit[1] > 4100)) {
            interactNearbyLocByOps(player, 'climb-down', 8);
            return;
        }

        // Walk inside the exit area as we may need to get through
        // more gateways before the last destination is reachable.
        // Make sure we actually get a walkable tile in the exit area.
        if (BotCollisionMap.isCsvBlocked(nextExit[2], nextExit[0], nextExit[1])) {
            nextExit = closestBetween(gwExit, [player.x, player.z], [destX, destZ], nextExit[2]);
        }
        _pathTowards(player, nextExit[0], nextExit[1]);

        try {
            const botName = _debugBotName(player);
            if (botName) BotDebugService.event(botName, 'movement', `exiting gateway ${gw.name} (${nextExit[0]},${nextExit[1]},${nextExit[2]})`);
        } catch {
            // debug hook must never affect gameplay
        }
        return;
    }
    // No more gateways found, path directly to destination.

    // ── Destination validation ───────────────────────────────────────────────
    // If the requested destination is CSV-blocked or WALK_BLOCKED
    // find the nearest walkable tile.
    if (BotCollisionMap.isCsvBlocked(level, destX, destZ)) {
        const alt = findNearestWalkableTile(level, destX, destZ, 5);
        if (!alt) return; // nowhere reachable near this destination
        destX = alt.x;
        destZ = alt.z;
    }

    // ── Normal pathfinding ──────────────────────────────────────────────────
    _pathTowards(player, destX, destZ);
}

/**
 * Find the point in an area closest between 2 points.
 * This is done by combining the distance from point `a` to a point in the area
 * and from point `b` to that point in the area.
 * Returning the point in the area with the least distance.
 */
function closestBetween(area: number[][], a: number[], b: number[], csvLevel?: number): number[] {
    let best = [area[0][0], area[0][1]];
    // Only caculate if area actually consists of more than one tile.
    if (area.length > 1) {
        let bestDist = Infinity;
        const xMin = Math.min(area[0][0], area[1][0]);
        const zMin = Math.min(area[0][1], area[1][1]);
        const xMax = Math.max(area[0][0], area[1][0]);
        const zMax = Math.max(area[0][1], area[1][1]);
        for (let x = xMin; x <= xMax; x++) {
            for (let z = zMin; z <= zMax; z++) {
                // If set, make sure we get in the area on a walkable tile.
                if (csvLevel && BotCollisionMap.isCsvBlocked(csvLevel, x, z)) continue;
                const dxa = x - a[0];
                const dza = z - a[1];
                const dxb = x - b[0];
                const dzb = z - b[1];
                const dist =
                    Math.sqrt(dxa * dxa + dza * dza) +
                    Math.sqrt(dxb * dxb + dzb * dzb);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = [x, z];
                }
            }
        }
    }
    return best;
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
    _debugStartInteraction(player, 'interactUseLocOp', 'loc', loc.type, `${locDebugName(loc.type)} <- ${itemName(item)}`, loc.x, loc.z, 0);
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
    _debugStartInteraction(player, 'interactNpc', 'npc', npc.type, npcDebugName(npc.type), npc.x, npc.z, 1);
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1);
}

/**
 * Interact with an NPC using a specific option number (1-5).
 * op=2 is typically "Trade" for shops.
 */
export function interactNpcOp(player: Player, npc: Npc, op: 1 | 2 | 3 | 4 | 5): void {
    const trigger = (ServerTriggerType.APNPC1 + (op - 1)) as ServerTriggerType;
    _debugStartInteraction(player, 'interactNpcOp', 'npc', npc.type, npcDebugName(npc.type), npc.x, npc.z, op);
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
    _debugStartInteraction(player, 'interactLoc', 'loc', loc.type, locDebugName(loc.type), loc.x, loc.z, 1);
    player.clearPendingAction();
    player.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1);
}

/**
 * Interact with a Loc using a specific option number (1-5).
 */
export function interactLocOp(player: Player, loc: Loc, op: 1 | 2 | 3 | 4 | 5): void {
    const trigger = (ServerTriggerType.APLOC1 + (op - 1)) as ServerTriggerType;
    _debugStartInteraction(player, 'interactLocOp', 'loc', loc.type, locDebugName(loc.type), loc.x, loc.z, op);
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
 * Search for a live Loc whose debug name matches and satisfies a caller predicate.
 */
export function findLocByNameWhere(
    cx: number,
    cz: number,
    level: number,
    locName: string,
    radius: number,
    predicate: (loc: Loc) => boolean
): Loc | null {
    const typeId = LocType.getId(locName);
    if (typeId === -1) return null;
    return _findLoc(cx, cz, level, radius, loc => loc.type === typeId && predicate(loc));
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
 * Same as findLocByPrefix, but also requires a caller predicate to pass —
 * e.g. "not already claimed by another bot" (see claimLoc/isLocClaimed in
 * BotTaskBase.ts) so multiple bots searching from nearby tiles don't all
 * deterministically land on the exact same nearest resource node.
 */
export function findLocByPrefixWhere(cx: number, cz: number, level: number, prefix: string, radius: number, predicate: (loc: Loc) => boolean, exclude?: string): Loc | null {
    return _findLoc(cx, cz, level, radius, loc => {
        const name = LocType.get(loc.type).debugname;
        if (!name?.startsWith(prefix)) return false;
        if (exclude && name.includes(exclude)) return false;
        return predicate(loc);
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
    try {
        const botName = _debugBotName(player);
        if (botName) BotDebugService.noteXpGain(botName, stat, player.stats[stat]);
    } catch {
        // debug hook must never affect gameplay
    }
}

/**
 * Sets the player's melee combat mode (com_mode varp).
 */
export function setCombatStyle(player: Player, style: 0 | 1 | 2 | 3): void {
    const varp = VarPlayerType.getByName('com_mode');
    if (varp) player.setVar(varp.id, style);
}

/**
 * Enables autocast for an arbitrary combat spell.
 * Sets autocast_spell = the spell's varp value (see
 * content/scripts/skill_combat/configs/magic/spells.constant, e.g. 51 =
 * ^wind_strike, 4 = ^wind_bolt, 8 = ^wind_blast, 12 = ^wind_wave) and
 * attackstyle_magic = 3 (autocast toggle on).
 */
export function setAutocastSpell(player: Player, autocastVarp: number): void {
    const spellVarp = VarPlayerType.getByName('autocast_spell');
    if (spellVarp) player.setVar(spellVarp.id, autocastVarp);

    const styleVarp = VarPlayerType.getByName('attackstyle_magic');
    if (styleVarp) player.setVar(styleVarp.id, 3); // 3 = spell chosen + autocast enabled
}

/** Enables autocast wind strike specifically — kept for callers that only ever need the base spell. */
export function setAutocastWindStrike(player: Player): void {
    setAutocastSpell(player, 51); // 51 = ^wind_strike
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
    const before = countItem(player, itemId);
    const success = inv.add(itemId, count).hasSucceeded();
    try {
        const botName = _debugBotName(player);
        if (botName) {
            const after = countItem(player, itemId);
            BotDebugService.event(botName, 'inventory', `addItem ${itemName(itemId)} x${count}: ${success ? 'ok' : 'FAILED'} (${before} -> ${after})`, { itemId, count, before, after, success });
        }
    } catch {
        // debug hook must never affect gameplay
    }
    return success;
}

export function removeItem(player: Player, itemId: number, count = 1): boolean {
    const inv = getBackpack(player);
    if (!inv) return false;
    const before = countItem(player, itemId);
    const success = inv.remove(itemId, count).completed >= count;
    try {
        const botName = _debugBotName(player);
        if (botName) {
            const after = countItem(player, itemId);
            BotDebugService.event(botName, 'inventory', `removeItem ${itemName(itemId)} x${count}: ${success ? 'ok' : 'FAILED'} (${before} -> ${after})`, { itemId, count, before, after, success });
        }
    } catch {
        // debug hook must never affect gameplay
    }
    return success;
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

/**
 * Scan within `radius` tiles for any loc with an option that matches keyword.
 * If already adjacent to the loc, find which specific option number matches
 * the keyword and interact with it. If not yet adjacent, path to the loc.
 *
 * Returns true if an obstruction was found (interaction queued or walk started).
 */
function interactNearbyLocByOps(player: Player, keyword: string, radius = 30): boolean {
    const loc = _findLoc(player.x, player.z, player.level, radius, loc => {
        const t = LocType.get(loc.type);
        const ops = (t.op ?? []).filter((o): o is string => typeof o === 'string').map(o => o.toLowerCase());
        return ops.some(op => op === keyword);
    });
    if (!loc) return false;

    if (isAdjacentToLoc(player, loc)) {
        const t = LocType.get(loc.type);
        const ops = (t.op ?? []).filter((o): o is string => typeof o === 'string').map(o => o.toLowerCase());
        let op = 1 + ops.findIndex(i => i === keyword);
        if (op < 1) op = 1;
        interactLocOp(player, loc, op as 1 | 2 | 3 | 4 | 5);
        return true;
    }

    // Not adjacent — path toward the loc tile.
    _pathTowards(player, loc.x, loc.z);
    return true;
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

    try {
        const botName = _debugBotName(player);
        if (botName) BotDebugService.noteRecovery(botName, 'gate');
    } catch {
        // debug hook must never affect gameplay
    }

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

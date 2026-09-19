/**
 * BotWorld.ts
 *
 * Breaks the circular import cycle:
 *   World → BotManager → BotAction → World  (circular!)
 *
 * Instead of importing World directly, bot files import getWorld() from here.
 * BotManager.init(world) sets the World instance before any ticks run,
 * so getWorld() is always valid by the time any bot code actually calls it.
 *
 * World.ts patch:
 *   BotManager.init(World)   ← pass the instance, not imported at module level
 */

import Obj from '#/engine/entity/Obj.js';
import type GameMap from '#/engine/GameMap.js';

// World interface — only the fields bot code actually needs
export interface BotWorldHandle {
    gameMap: GameMap;
    newPlayers: Set<any>;
    shutdown: boolean;
    shutdownSoon: boolean;
    removeObj: (obj: Obj, duration: number) => void;
}

let _world: BotWorldHandle | null = null;

/** Called once by BotManager.init(world) before the first tick. */
export function setWorld(world: BotWorldHandle): void {
    _world = world;
}

/** Returns the World instance. Throws if called before setWorld(). */
export function getWorld(): BotWorldHandle {
    if (!_world) throw new Error('[BotWorld] getWorld() called before setWorld() — BotManager.init() not called yet');
    return _world;
}

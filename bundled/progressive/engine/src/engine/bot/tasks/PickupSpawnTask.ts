import {
    BotTask, Player,
    walkTo, hasItem, isNear,
    teleportNear, randInt, StuckDetector,
    openNearbyGate,
} from '#/engine/bot/tasks/BotTaskBase.js';
import { findObjNear, interactObjOp } from '#/engine/bot/BotAction.js';

export interface SpawnEntry {
    coords: [number, number, number];
    /** Optional intermediate waypoint to route around obstacles before the final coords. */
    via?: [number, number, number];
}

/**
 * Walks the bot to the nearest known floor-item spawn for a given item type,
 * waits for it to appear, then picks it up via interactObjOp(player, obj, 3).
 *
 * Used for items that don't exist in any shop (e.g. knives) but spawn
 * persistently on the ground at fixed locations in the game world.
 */
export class PickupSpawnTask extends BotTask {
    private readonly itemId: number;
    private readonly spawns: SpawnEntry[];

    private target: SpawnEntry;
    private state: 'walk' | 'find' | 'pickup' | 'done' = 'walk';
    private waitTicks = 0;
    private readonly stuck = new StuckDetector(30, 4, 2);

    constructor(itemId: number, spawns: SpawnEntry[]) {
        super('PickupSpawn');
        this.itemId = itemId;
        this.spawns = spawns;
        this.target = spawns[0];
    }

    shouldRun(player: Player): boolean {
        return !hasItem(player, this.itemId) && this.state !== 'done';
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        if (hasItem(player, this.itemId)) {
            this.state = 'done';
            return;
        }

        if (this.state === 'walk') {
            this.target = this._nearestSpawn(player);
            const [tx, tz, tl] = this.target.coords;

            // Route through via point first if not already near the destination,
            // to navigate around obstacles (e.g. castle walls in Lumbridge).
            if (this.target.via && !isNear(player, tx, tz, 5, tl)) {
                const [vx, vz] = this.target.via;
                if (!isNear(player, vx, vz, 5)) {
                    this._stuckWalk(player, vx, vz);
                    return;
                }
            }

            if (!isNear(player, tx, tz, 5, tl)) {
                this._stuckWalk(player, tx, tz);
                return;
            }
            this.state = 'find';
            this.waitTicks = 0;
            return;
        }

        if (this.state === 'find') {
            const [tx, tz, tl] = this.target.coords;
            const obj = findObjNear(player, tx, tz, tl, this.itemId, 5);
            if (obj) {
                interactObjOp(player, obj, 3);
                this.state = 'pickup';
                this.waitTicks = 0;
                return;
            }
            this.waitTicks++;
            if (this.waitTicks > 60) {
                // Item not spawned at this location; try the next spawn
                this.target = this._nextSpawn(this.target);
                this.state = 'walk';
                this.waitTicks = 0;
            }
            return;
        }

        if (this.state === 'pickup') {
            this.waitTicks++;
            if (hasItem(player, this.itemId)) {
                this.state = 'done';
                return;
            }
            if (this.waitTicks > 10) {
                // Interaction didn't land — rescan
                this.state = 'find';
                this.waitTicks = 0;
            }
        }
    }

    isComplete(_p: Player): boolean { return this.state === 'done'; }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.waitTicks = 0;
        this.stuck.reset();
    }

    private _nearestSpawn(player: Player): SpawnEntry {
        let best = this.spawns[0];
        let bestDist = Infinity;
        for (const s of this.spawns) {
            const [sx, sz] = s.coords;
            const dx = sx - player.x;
            const dz = sz - player.z;
            const d = dx * dx + dz * dz;
            if (d < bestDist) { bestDist = d; best = s; }
        }
        return best;
    }

    private _nextSpawn(current: SpawnEntry): SpawnEntry {
        const i = this.spawns.indexOf(current);
        return this.spawns[(i + 1) % this.spawns.length];
    }

    private _stuckWalk(player: Player, lx: number, lz: number): void {
        if (!this.stuck.check(player, lx, lz)) {
            walkTo(player, lx, lz);
            return;
        }
        if (this.stuck.desperatelyStuck) {
            teleportNear(player, lx, lz);
            this.stuck.reset();
            return;
        }
        if (openNearbyGate(player, 5)) return;
        const dx = lx - player.x;
        const dz = lz - player.z;
        const escX = player.x + (Math.abs(dz) > Math.abs(dx) ? randInt(-10, 10) : (dz > 0 ? 10 : -10));
        const escZ = player.z + (Math.abs(dx) > Math.abs(dz) ? randInt(-10, 10) : (dx > 0 ? 10 : -10));
        walkTo(player, escX, escZ);
    }
}

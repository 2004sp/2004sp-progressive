/**
 * BotCollisionMap.ts
 *
 * Loads data/bot/unwalkable_tiles.csv once at startup and exposes an O(1)
 * lookup so bot pathfinding can reject known-bad tile destinations.
 *
 * The CSV is NOT a complete collision map — it is supplementary safety data.
 * The engine's rsmod collision (via canTravel / botWalkPath) remains the
 * primary authority.  The CSV rejects tiles that may appear walkable to rsmod
 * but are known problematic for bots (deep water, special terrain, etc.).
 *
 * Coordinate packing matches CoordGrid.packCoord so values are compatible with
 * the Uint32Array returned by rsmod pathfinding functions.
 */

import fs from 'fs';

// Pack (level, x, z) into a single 30-bit integer.
// Matches CoordGrid.packCoord so we can decode rsmod path entries with the same scheme.
function packCoord(level: number, x: number, z: number): number {
    return (z & 0x3fff) | ((x & 0x3fff) << 14) | ((level & 0x3) << 28);
}

class BotCollisionMapClass {
    private readonly blocked: Set<number> = new Set();
    private loaded = false;

    /**
     * Load the CSV file.  Safe to call multiple times — only runs once.
     * Call from BotManager.init() before any bots are spawned.
     */
    init(csvPath: string): void {
        if (this.loaded) return;
        this.loaded = true;

        if (!fs.existsSync(csvPath)) {
            console.warn(`[BotCollisionMap] CSV not found at ${csvPath} — CSV blocking disabled`);
            return;
        }

        const raw = fs.readFileSync(csvPath, 'ascii');
        const lines = raw.split(/\r?\n/);
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line || line.charCodeAt(0) === 47) continue; // skip empty / "//" comments

            const c1 = line.indexOf(',');
            if (c1 === -1) continue;
            const c2 = line.indexOf(',', c1 + 1);
            if (c2 === -1) continue;

            const level = parseInt(line, 10);
            const x = parseInt(line.slice(c1 + 1), 10);
            const z = parseInt(line.slice(c2 + 1), 10);

            if (isNaN(level) || isNaN(x) || isNaN(z)) continue;

            this.blocked.add(packCoord(level, x, z));
            count++;
        }

        console.log(`[BotCollisionMap] Loaded ${count.toLocaleString()} unwalkable tiles from ${csvPath}`);
    }

    /** O(1) check — is this tile listed as unwalkable in the CSV? */
    isCsvBlocked(level: number, x: number, z: number): boolean {
        return this.blocked.has(packCoord(level, x, z));
    }

    get size(): number {
        return this.blocked.size;
    }

    /** True if the CSV was found and loaded (even if it contained 0 entries). */
    get isLoaded(): boolean {
        return this.loaded;
    }
}

export const BotCollisionMap = new BotCollisionMapClass();

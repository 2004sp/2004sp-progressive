/**
 * BotManager.ts
 *
 * Spawns and ticks all bots.
 *
 * World.ts integration (3 changes):
 *
 *   1. Import at top of World.ts:
 *        import { BotManager } from '#/engine/bot/BotManager.js';
 *
 *   2. In start(), before this.cycle():
 *        BotManager.init(this);   // ← pass `this` (the World instance)
 *
 *   3. In cycle(), after this.processPlayers():
 *        BotManager.tick();
 *
 *   4. In processLogouts() — protect bots from timeout (see INSTALL.md)
 *
 * NOTE: BotManager does NOT import World. Instead it receives the World
 * instance via init(world) to avoid a circular import cycle:
 *   World → BotManager → [BotAction/BotTask] → World  (would be circular)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import Player from '#/engine/entity/Player.js';
import { PlayerStat, getBaseLevel } from '#/engine/bot/BotAction.js';
import { BotPlayer } from '#/engine/bot/BotPlayer.js';
import { setWorld, BotWorldHandle } from '#/engine/bot/BotWorld.js';
import { ensureBotAccount } from '#/engine/bot/BotDatabase.js';
import { BotGoalPlanner, makeSkiller, makeFighter, makeBalanced, makeRandom, makeAgilityTester, makeExtrasSocial, makeExtrasVendor, makeExtrasPKer } from '#/engine/bot/BotGoalPlanner.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import { Locations } from '#/engine/bot/BotKnowledge.js';
import { isMapBlocked, isZoneAllocated } from '#/engine/GameMap.js';
import { BotAppearance } from '#/engine/bot/BotAppearance.js';
import InvType from '#/cache/config/InvType.js';
import Environment from '#/util/Environment.js';
import { toBase37, fromBase37 } from '#/util/JString.js';
import { ChatModePrivate } from '#/engine/entity/ChatModes.js';

/** Normalize a bot username the same way PlayerLoading does.
 *  RS2 base37 maps underscores → spaces and strips unsupported chars,
 *  so "araxxor_prime" becomes "araxxor prime", etc. */
function normalizeBotUsername(raw: string): string {
    return fromBase37(toBase37(raw));
}

const PLANNER_MAP = {
    skiller: makeSkiller,
    fighter: makeFighter,
    balanced: makeBalanced,
    random: makeRandom,
    agility_test: makeAgilityTester,
    extras_social: makeExtrasSocial,
    extras_vendor: makeExtrasVendor,
    extras_pker: makeExtrasPKer,
} as const;

type PlannerKey = keyof typeof PLANNER_MAP;

function loadBotConfigs(): BotConfig[] {
    const filePath = path.join(__dirname, 'bots.config.json');

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(raw);

        if (!Array.isArray(json)) {
            throw new Error('bots.config.json must be an array');
        }

        return json.map((b: any) => {
            const plannerKey = b.planner as PlannerKey;

            if (!PLANNER_MAP[plannerKey]) {
                throw new Error(`Invalid planner: ${b.planner}`);
            }

            return {
                username: b.username,
                description: b.description,
                planner: plannerKey,
                makePlanner: PLANNER_MAP[plannerKey]
            };
        });
    } catch (err) {
        console.error('[BotManager] Failed to load bots.config.json:', err);

        // fallback so server still boots
        return [];
    }
}

// ── Bot definitions ───────────────────────────────────────────────────────────

interface BotConfig {
    username: string;
    planner: PlannerKey;
    makePlanner: () => BotGoalPlanner;
    description: string;
}

const BOT_CONFIGS: BotConfig[] = loadBotConfigs();
const CONFIGURED_BOT_USERNAMES = new Set(BOT_CONFIGS.map(cfg => normalizeBotUsername(cfg.username)));

const STATUS_EVERY_TICKS = 100;

// ── BotManager singleton ──────────────────────────────────────────────────────

class BotManagerClass {
    private world: BotWorldHandle | null = null;
    private bots: Map<string, BotPlayer> = new Map();
    private prevLevels: Map<string, Uint8Array> = new Map();
    /** account_id for each bot — populated async after spawn via ensureBotAccount. */
    private accountIds: Map<string, number> = new Map();
    private spawned = false;
    private tickCount = 0;

    /**
     * Call from World.ts start() before this.cycle():
     *   BotManager.init(this);
     */
    init(world: BotWorldHandle): void {
        if (this.spawned) return;
        this.spawned = true;
        this.world = world;
        setWorld(world); // makes World available to BotAction/BotTask without import cycle
        console.log(`[BotManager] Spawning ${BOT_CONFIGS.length} bots from Lumbridge...`);
        for (const cfg of BOT_CONFIGS) this._spawnBot(cfg);
    }

    /** Call from World.ts cycle() after processPlayers(). */
    tick(): void {
        if (!this.world) return;

        // During shutdown the engine handles each bot's logout via the normal
        // removePlayer() → flushPlayer() → loginThread → LoginServer path.
        // LoginServer calls updateHiscores() and writes the .sav file there.
        // Stop ticking bots early so they don't take new actions while being
        // force-logged-out.
        if (this.world.shutdownSoon || this.world.shutdown) {
            return;
        }

        this.tickCount++;

        for (const bot of this.bots.values()) {
            if (bot.player.slot === -1) continue;

            bot.tick();
        }

        if (this.tickCount % STATUS_EVERY_TICKS === 0) {
            this._printStatus();
        }
    }

    isConfiguredBot(username: string): boolean {
        return CONFIGURED_BOT_USERNAMES.has(normalizeBotUsername(username));
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private _spawnBot(cfg: BotConfig): void {
        if (!this.world) return;

        // Normalize username the same way PlayerLoading does:
        // base37 converts underscores to spaces, strips unsupported chars, lowercases.
        // e.g. "araxxor_prime" → "araxxor prime", "liluzivault" → "liluzivault"
        const normalizedUsername = normalizeBotUsername(cfg.username);
        const profile = Environment.NODE_PROFILE ?? 'main';

        let packet: Packet;
        let saveExists = false;

        try {
            const savePath = `data/players/${profile}/${normalizedUsername}.sav`;
            saveExists = fs.existsSync(savePath);

            let save: Buffer;

            if (fs.existsSync(savePath)) {
                save = fs.readFileSync(savePath);

                if (!save || save.length === 0) {
                    save = Buffer.alloc(0);
                }
            } else {
                save = Buffer.alloc(0);
            }

            packet = new Packet(save);
        } catch (err) {
            console.error(`[BotManager] Failed loading save for ${normalizedUsername}:`, err);
            packet = new Packet(new Uint8Array(0));
        }

        let player: Player;

        try {
            player = PlayerLoading.load(normalizedUsername, packet, null);
        } catch (err) {
            console.error(`[BotManager] Corrupt PlayerLoading data for ${normalizedUsername}, spawning fresh`, err);
            player = PlayerLoading.load(normalizedUsername, new Packet(new Uint8Array(0)), null);
        }

        // ─────────────────────────────────────────────
        // spawn fallback position
        // ─────────────────────────────────────────────
        const [x, z, l] = Locations.LUMBRIDGE_SPAWN;

        // Scatter new bots (no saved position) across walkable tiles near spawn.
        // Each candidate is validated against the collision map so bots never land
        // in water, inside walls, or on any other blocked tile.
        // Falls back to the exact spawn tile if all 20 attempts find no clear tile.
        if (player.x == null || player.z == null) {
            let spawnX = x;
            let spawnZ = z;
            for (let attempt = 0; attempt < 20; attempt++) {
                const tx = x + Math.floor(Math.random() * 11) - 5;
                const tz = z + Math.floor(Math.random() * 11) - 5;
                if (isZoneAllocated(l, tx, tz) && !isMapBlocked(tx, tz, l)) {
                    spawnX = tx;
                    spawnZ = tz;
                    break;
                }
            }
            player.x = spawnX;
            player.z = spawnZ;
        }
        player.level = player.level ?? l;
        // prevent tutorial island logic from interfering
        (player as any).inTutorialIsland = false;
        (player as any).tutorialStage = 0;

        // ─────────────────────────────────────────────
        // ensure base stats
        // ─────────────────────────────────────────────
        if (!player.baseLevels || player.baseLevels.length !== 21) {
            player.baseLevels = new Uint8Array(21);
        }

        // ─────────────────────────────────────────────
        // 🔥 IMPORTANT: APPLY BOT APPEARANCE HERE
        // Refresh body/clothes for every bot so old default-looking saves do not stay default.
        // ─────────────────────────────────────────────
        if (!saveExists) {
            try {
                BotAppearance.randomize(player);
                console.log(`[BotManager] Randomized appearance for new bot: ${normalizedUsername}`);
            } catch (err) {
                console.error(`[BotManager] BotAppearance failed for ${normalizedUsername}:`, err);
            }
        } else {
            try {
                BotAppearance.randomizeBody(player);
                console.log(`[BotManager] Refreshed appearance for existing bot: ${normalizedUsername}`);
            } catch (err) {
                console.error(`[BotManager] BotAppearance refresh failed for ${normalizedUsername}:`, err);
            }
        }

        // ─────────────────────────────────────────────
        // store XP baseline  (key = player.username so _checkLevelUps lookup matches)
        // ─────────────────────────────────────────────
        this.prevLevels.set(normalizedUsername, new Uint8Array(player.baseLevels));

        // ─────────────────────────────────────────────
        // spawn bot
        // ─────────────────────────────────────────────
        const bot = new BotPlayer(player, cfg.makePlanner());
        this.bots.set(normalizedUsername, bot);
        player.is_bot = true; // mark as headless bot
        player.botPlanner = cfg.planner;
        player.privateChat = ChatModePrivate.ON;
        this.world.newPlayers.add(player);

        // ─────────────────────────────────────────────
        // ensure client sees correct appearance
        // ─────────────────────────────────────────────
        player.buildAppearance(InvType.WORN);

        console.log(`[BotManager] Loaded bot: ${normalizedUsername}`);

        // Ensure a DB account row exists so LoginServer can find this bot during
        // the player_logout flow (by player.username = normalizedUsername), and
        // store the id for periodic hiscore updates.
        // NOTE: must use normalizedUsername — LoginServer looks up accounts by
        // player.username (spaces), so the DB row must also use the normalized form.
        ensureBotAccount(normalizedUsername)
            .then(id => {
                if (id !== null) this.accountIds.set(normalizedUsername, id);
            })
            .catch(err => console.error(`[BotManager] ensureBotAccount failed for ${normalizedUsername}:`, err));
    }

    private static readonly STAT_LABELS: string[] = ['Atk', 'Str', 'Def', 'HP', 'Rng', 'Pray', 'Mag', 'Cook', 'WC', 'Flet', 'Fish', 'FM', 'Craft', 'Smith', 'Mine', 'Herb', 'Agi', 'Thiev', 'Slay', 'Farm', 'RC'];

    private _printStatus(): void {
        const activeBots = [...this.bots.values()].filter(bot => bot.player.slot !== -1);
        const now = new Date().toLocaleTimeString();

        console.log('');
        console.log('┌──────────────────── BotManager Status ────────────────────┐');
        console.log(`│ Time: ${now.padEnd(50)}│`);
        console.log(`│ Bots: ${String(activeBots.length).padEnd(5)} active / ${String(this.bots.size).padEnd(5)} total${' '.repeat(25)}│`);
        console.log('└───────────────────────────────────────────────────────────┘');
        console.log('');

        for (const bot of activeBots) {
            const s = bot.snapshot();
            const levels = this._getAllSkillLevels(bot.player);

            const width = 98;
            const inner = width - 2;

            console.log(`┌${'─'.repeat(inner)}┐`);
            console.log(`│ ${`${s.name} • ${s.task ?? 'idle'}`.padEnd(inner - 1)}│`);
            console.log(`│ ${`Pos: (${s.x}, ${s.z}, ${s.level})`.padEnd(inner - 1)}│`);
            console.log(`│ ${this._skillRow(levels, 0, 7).padEnd(inner - 1)}│`);
            console.log(`│ ${this._skillRow(levels, 7, 7).padEnd(inner - 1)}│`);
            console.log(`│ ${this._skillRow(levels, 14, 7).padEnd(inner - 1)}│`);
            console.log(`└${'─'.repeat(inner)}┘`);
        }

        console.log('');
    }

    private _getAllSkillLevels(player: Player): number[] {
        const levels: number[] = [];
        for (let stat = 0; stat < 21; stat++) {
            levels.push(getBaseLevel(player, stat as PlayerStat));
        }
        return levels;
    }

    private _skillRow(levels: number[], start: number, count: number): string {
        const parts: string[] = [];

        for (let i = 0; i < count; i++) {
            const idx = start + i;
            const label = BotManagerClass.STAT_LABELS[idx] ?? `S${idx}`;
            const value = levels[idx] ?? 0;
            parts.push(`${label}:${String(value).padStart(2)}`);
        }

        return parts.join('  ');
    }
}

export const BotManager = new BotManagerClass();

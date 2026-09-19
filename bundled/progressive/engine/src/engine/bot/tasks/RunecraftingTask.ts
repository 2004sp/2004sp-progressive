/**
 * RunecraftingTask.ts
 *
 * Mines rune essence at the essence mine, then crafts runes at the best
 * available altar based on the bot's Runecrafting level and owned talismans.
 *
 * Unlock condition:
 *   Any runecrafting talisman in bank or inventory  +  any pickaxe.
 *   (Air talisman is the entry-level drop from various combat NPCs.)
 *
 * Progression (highest qualifying altar wins):
 *   Law 54 → Nature 44 → Chaos 35 → Cosmic 27 → Body 20 → Fire 14
 *   → Earth 9 → Water 5 → Mind 2 → Air 1
 *
 * Cycle per run:
 *   check_altar → bank_walk → bank_deposit
 *   → mine_teleport → mine (fill inventory with essence)
 *   → altar_teleport → craft (convert essence → runes, award XP)
 *   → check_altar  (re-evaluate after potential level-up)
 *
 * Both mine and craft are simulated manually so the task works regardless
 * of whether server-side handlers exist for the essence mine / altars.
 * The interactLoc call is still made first for animation/visual fidelity.
 */

import {
    BotTask,
    Loc,
    Player,
    InvType,
    interactLoc,
    findLocByPrefix,
    findLocByName,
    hasItem,
    countItem,
    addItem,
    removeItem,
    isInventoryFull,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    Locations,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    advanceBankWalk,
    addXp,
    botTeleport,
} from '#/engine/bot/tasks/BotTaskBase.js';

// ── Altar definitions — highest level first for progression lookup ─────────────

interface AltarDef {
    name: string;
    talismanId: number;
    runeId: number;
    levelReq: number;
    /** Herblore-style XP storage: actual XP × 10 (e.g. 50 = 5.0 XP). */
    xpPerEssence: number;
    location: [number, number, number];
}

const ALTARS: readonly AltarDef[] = [
    { name: 'Law',    talismanId: Items.LAW_TALISMAN,    runeId: Items.LAW_RUNE,    levelReq: 54, xpPerEssence: 95,  location: [...Locations.LAW_ALTAR]    as [number, number, number] },
    { name: 'Nature', talismanId: Items.NATURE_TALISMAN, runeId: Items.NATURE_RUNE, levelReq: 44, xpPerEssence: 90,  location: [...Locations.NATURE_ALTAR]  as [number, number, number] },
    { name: 'Chaos',  talismanId: Items.CHAOS_TALISMAN,  runeId: Items.CHAOS_RUNE,  levelReq: 35, xpPerEssence: 85,  location: [...Locations.CHAOS_ALTAR]   as [number, number, number] },
    { name: 'Cosmic', talismanId: Items.COSMIC_TALISMAN, runeId: Items.COSMIC_RUNE, levelReq: 27, xpPerEssence: 80,  location: [...Locations.COSMIC_ALTAR]  as [number, number, number] },
    { name: 'Body',   talismanId: Items.BODY_TALISMAN,   runeId: Items.BODY_RUNE,   levelReq: 20, xpPerEssence: 75,  location: [...Locations.BODY_ALTAR]    as [number, number, number] },
    { name: 'Fire',   talismanId: Items.FIRE_TALISMAN,   runeId: Items.FIRE_RUNE,   levelReq: 14, xpPerEssence: 70,  location: [...Locations.FIRE_ALTAR]    as [number, number, number] },
    { name: 'Earth',  talismanId: Items.EARTH_TALISMAN,  runeId: Items.EARTH_RUNE,  levelReq:  9, xpPerEssence: 65,  location: [...Locations.EARTH_ALTAR]   as [number, number, number] },
    { name: 'Water',  talismanId: Items.WATER_TALISMAN,  runeId: Items.WATER_RUNE,  levelReq:  5, xpPerEssence: 60,  location: [...Locations.WATER_ALTAR]   as [number, number, number] },
    { name: 'Mind',   talismanId: Items.MIND_TALISMAN,   runeId: Items.MIND_RUNE,   levelReq:  2, xpPerEssence: 55,  location: [...Locations.MIND_ALTAR]    as [number, number, number] },
    { name: 'Air',    talismanId: Items.AIR_TALISMAN,    runeId: Items.AIR_RUNE,    levelReq:  1, xpPerEssence: 50,  location: [...Locations.AIR_ALTAR]     as [number, number, number] },
] as const;

// ── Pickaxe priority list (best first) ────────────────────────────────────────

const PICKAXE_IDS: readonly number[] = [
    Items.RUNE_PICKAXE,
    Items.ADAMANT_PICKAXE,
    Items.MITHRIL_PICKAXE,
    Items.STEEL_PICKAXE,
    Items.IRON_PICKAXE,
    Items.BRONZE_PICKAXE,
];

// ── Rune multiplier (more runes per essence at higher levels) ─────────────────
// Breakpoints: each entry is the level at which output increases by 1 extra rune.

const RUNE_BREAKPOINTS: Partial<Record<number, readonly number[]>> = {
    [Items.AIR_RUNE]:    [11, 22, 33, 44, 55, 66, 77, 88, 99],
    [Items.MIND_RUNE]:   [14, 28, 42, 56, 70, 84, 98],
    [Items.WATER_RUNE]:  [19, 38, 57, 76, 95],
    [Items.EARTH_RUNE]:  [26, 52, 78],
    [Items.FIRE_RUNE]:   [35, 70],
    [Items.BODY_RUNE]:   [46, 92],
    [Items.COSMIC_RUNE]: [59],
    [Items.CHAOS_RUNE]:  [74],
    [Items.NATURE_RUNE]: [91],
    // Law runes — breakpoint is level 108, never reached in RS2
};

function runeMultiplier(runeId: number, level: number): number {
    const bps = RUNE_BREAKPOINTS[runeId] ?? [];
    return 1 + bps.filter(bp => level >= bp).length;
}

// ── Task ──────────────────────────────────────────────────────────────────────

type RCState =
    | 'check_altar'
    | 'bank_walk'
    | 'bank_deposit'
    | 'mine_teleport'
    | 'mine_approach'   // find rock, teleJump adjacent (mirrors MiningTask 'approach')
    | 'mine_scan'       // send interactLoc once (mirrors MiningTask 'scan')
    | 'mine_interact'   // wait for essence gain, no re-clicks (mirrors MiningTask 'interact')
    | 'mine_manual'     // server has no handler — simulate all remaining essence manually
    | 'altar_teleport'
    | 'craft';

export class RunecraftingTask extends BotTask {

    private state: RCState = 'check_altar';

    private currentAltar: AltarDef | null = null;
    private pickaxeId: number = Items.BRONZE_PICKAXE;

    // ── Mining tracking (mirrors MiningTask field layout) ────────────────────
    private currentRock: Loc | null = null;
    private lastEssenceCount = 0;
    /** Ticks spent in mine_interact waiting for essence — resets on each gain. */
    private interactTicks = 0;
    /** Ticks in mine_approach without finding a rock. */
    private scanFailTicks = 0;
    /** Ticks spent trying to walk adjacent to the rock. */
    private approachTicks = 0;
    /** How many INTERACT_TIMEOUTs have fired without any essence — after 2 we go manual. */
    private mineTimeouts = 0;

    // ── Craft tracking ────────────────────────────────────────────────────────
    /** Whether the craft interactLoc has been sent for this altar visit. */
    private craftInteracted = false;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog(200);

    private lastLogKey = '';
    private lastLogTime = 0;

    constructor() {
        super('Runecrafting');
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        // Need any pickaxe AND at least one altar we can use
        if (!this._hasPickaxe(player)) return false;
        return this._pickBestAltar(player) !== null;
    }

    isComplete(_player: Player): boolean {
        return false; // infinite loop — planner interrupts via shouldRun
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_deposit';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this._log(player, 'watchdog reset → check_altar', 'watchdog');
            this.state = 'check_altar';
            return;
        }

        if (this.cooldown > 0) { this.cooldown--; return; }

        // ── CHECK ALTAR ───────────────────────────────────────────────────────
        if (this.state === 'check_altar') {
            const altar = this._pickBestAltar(player);
            if (!altar) {
                this._log(player, 'no altar available → interrupt', 'no_altar');
                this.interrupt();
                return;
            }
            if (altar !== this.currentAltar) {
                this._log(player, `selected ${altar.name} altar (RC level ${getBaseLevel(player, PlayerStat.RUNECRAFT)})`, 'altar_sel');
            }
            this.currentAltar = altar;
            this.pickaxeId    = this._bestPickaxe(player);
            this.state        = 'bank_walk';
            return;
        }

        // ── BANK WALK ─────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state    = 'bank_deposit';
            return;
        }

        // ── BANK DEPOSIT + SETUP ──────────────────────────────────────────────
        if (this.state === 'bank_deposit') {
            this._bankDeposit(player);
            this.lastEssenceCount = 0;
            this.currentRock      = null;
            this.state            = 'mine_teleport';
            this.cooldown         = 2;
            return;
        }

        // ── TELEPORT TO ESSENCE MINE ──────────────────────────────────────────
        if (this.state === 'mine_teleport') {
            const [mx, mz, ml] = Locations.ESSENCE_MINE;
            botTeleport(player, mx, mz, ml);
            this.currentRock      = null;
            this.lastEssenceCount = countItem(player, Items.RUNE_ESSENCE);
            this.interactTicks    = 0;
            this.scanFailTicks    = 0;
            this.approachTicks    = 0;
            this.mineTimeouts     = 0;
            this.state            = 'mine_approach';
            this._log(player, 'teleported to essence mine', 'mine_tp');
            return;
        }

        // ── MINE: APPROACH — find a rock and teleJump adjacent ────────────────
        // Mirrors MiningTask 'approach' state exactly, but uses teleJump instead
        // of walkTo because the mine is an instanced area with no pathfinding data.
        if (this.state === 'mine_approach') {
            if (isInventoryFull(player)) {
                this._log(player, `inv full → altar`, 'mine_done');
                this.craftInteracted = false;
                this.state = 'altar_teleport';
                return;
            }

            const rock = this._findEssenceRock(player);

            if (!rock) {
                this.scanFailTicks++;
                // Snap back to mine cluster if we drifted
                const [mx, mz] = Locations.ESSENCE_MINE;
                if (!isNear(player, mx, mz, 3)) {
                    botTeleport(player, mx, mz, player.level);
                }
                if (this.scanFailTicks >= 6) {
                    // No rocks found at all — server may have no locs, go manual
                    this.state = 'mine_manual';
                    this.scanFailTicks = 0;
                }
                this.cooldown = 2;
                return;
            }

            this.scanFailTicks = 0;
            this.currentRock   = rock;

            if (!isNear(player, rock.x, rock.z, 1)) {
                this.approachTicks++;
                // Use teleJump — walkTo is a no-op in the instanced mine area
                botTeleport(player, rock.x, rock.z, player.level);
                this.cooldown = 1;
                if (this.approachTicks > 10) {
                    // Rock seems unreachable, pick another
                    this.currentRock   = null;
                    this.approachTicks = 0;
                }
                return;
            }

            // Adjacent to rock — ready to click
            this.approachTicks = 0;
            this.state         = 'mine_scan';
            return;
        }

        // ── MINE: SCAN — send interactLoc exactly once ────────────────────────
        // Mirrors MiningTask 'scan' state.  ONE click, then immediately wait.
        if (this.state === 'mine_scan') {
            if (isInventoryFull(player)) {
                this._log(player, `inv full → altar`, 'mine_done');
                this.craftInteracted = false;
                this.state = 'altar_teleport';
                return;
            }
            if (!this.currentRock) {
                this.state = 'mine_approach';
                return;
            }

            interactLoc(player, this.currentRock);
            this.lastEssenceCount = countItem(player, Items.RUNE_ESSENCE);
            this.interactTicks    = 0;
            this.state            = 'mine_interact';
            this._log(player, `clicked rock at (${this.currentRock.x},${this.currentRock.z})`, 'mine_click');
            return;
        }

        // ── MINE: INTERACT — wait for essence, never re-click ─────────────────
        // Mirrors MiningTask 'interact' state.  Just watches for essence arriving.
        // If INTERACT_TIMEOUT ticks pass without gain, go back to approach.
        // After 2 timeouts in a row, the server has no handler → switch to manual.
        if (this.state === 'mine_interact') {
            if (isInventoryFull(player)) {
                this._log(player, `inv full → altar`, 'mine_done');
                this.craftInteracted = false;
                this.state = 'altar_teleport';
                return;
            }

            this.interactTicks++;
            const essNow = countItem(player, Items.RUNE_ESSENCE);

            if (essNow > this.lastEssenceCount) {
                const gained = essNow - this.lastEssenceCount;
                addXp(player, PlayerStat.MINING, 50 * gained); // 5 XP × 10 per essence
                this.lastEssenceCount = essNow;
                this.interactTicks    = 0;
                this.mineTimeouts     = 0;
                this.watchdog.notifyActivity();
                this._log(player, `mined ${gained} essence (server) → ${essNow} total`, 'mine_srv');
                // Stay in interact — server will keep delivering until rock depletes
                return;
            }

            if (this.interactTicks >= INTERACT_TIMEOUT) {
                this.mineTimeouts++;
                this.interactTicks = 0;
                this.currentRock   = null;
                this._log(player, `interact timeout (${this.mineTimeouts})`, 'mine_timeout');

                if (this.mineTimeouts >= 2) {
                    // Server has no essence-mine handler — switch to full manual mode
                    this._log(player, 'no server handler detected → mine_manual', 'mine_manual');
                    this.state = 'mine_manual';
                } else {
                    this.state = 'mine_approach';
                }
            }
            return;
        }

        // ── MINE: MANUAL — simulate essence directly (no server handler) ───────
        if (this.state === 'mine_manual') {
            if (isInventoryFull(player)) {
                this._log(player, `inv full (manual) → altar`, 'mine_done');
                this.craftInteracted = false;
                this.state = 'altar_teleport';
                return;
            }
            this._mineEssenceManually(player);
            this.cooldown = randInt(3, 5); // simulate realistic mining speed
            return;
        }

        // ── TELEPORT TO ALTAR ─────────────────────────────────────────────────
        if (this.state === 'altar_teleport') {
            if (!this.currentAltar) { this.state = 'check_altar'; return; }
            const [ax, az, al] = this.currentAltar.location;
            botTeleport(player, ax, az, al);
            this.craftInteracted = false;
            this.state = 'craft';
            this._log(player, `teleported to ${this.currentAltar.name} altar`, 'altar_tp');
            return;
        }

        // ── CRAFT RUNES ───────────────────────────────────────────────────────
        if (this.state === 'craft') {
            if (!this.currentAltar) { this.state = 'check_altar'; return; }

            if (!this.craftInteracted) {
                // Trigger altar interaction (animation + possible server conversion)
                const altarLoc: Loc | null =
                    findLocByPrefix(player.x, player.z, player.level, 'altar', 8) ??
                    findLocByName(player.x, player.z, player.level, 'altar', 8);

                if (altarLoc) {
                    interactLoc(player, altarLoc);
                }

                this.craftInteracted = true;
                this.cooldown = 4; // crafting animation
                return;
            }

            // Convert essence to runes (works whether server handled it or not)
            const essenceCount = countItem(player, Items.RUNE_ESSENCE);
            if (essenceCount > 0) {
                const level      = getBaseLevel(player, PlayerStat.RUNECRAFT);
                const multiplier = runeMultiplier(this.currentAltar.runeId, level);
                const runesGiven = essenceCount * multiplier;
                const xpGained   = essenceCount * this.currentAltar.xpPerEssence;

                removeItem(player, Items.RUNE_ESSENCE, essenceCount);
                addItem(player, this.currentAltar.runeId, runesGiven);
                addXp(player, PlayerStat.RUNECRAFT, xpGained);

                this._log(
                    player,
                    `crafted ${runesGiven} ${this.currentAltar.name} runes ` +
                    `(${essenceCount} ess ×${multiplier}) +${(xpGained / 10).toFixed(1)} RC XP`,
                    'crafted'
                );
                this.watchdog.notifyActivity();
            }

            this.craftInteracted = false;

            // Re-evaluate altar for level-ups.
            // If we unlocked a better altar we need a new talisman → bank first.
            // Otherwise skip the bank trip and teleport straight back to the mine —
            // runes stack so they stay in a single inventory slot indefinitely.
            const nextAltar = this._pickBestAltar(player);
            if (nextAltar && nextAltar !== this.currentAltar) {
                this._log(player, `altar upgrade: ${this.currentAltar?.name} → ${nextAltar.name} — banking`, 'altar_up');
                this.currentAltar = nextAltar;
                this.pickaxeId    = this._bestPickaxe(player);
                this.state        = 'bank_walk';
            } else {
                // Same altar — go straight back to the mine, no bank stop needed
                this.state = 'mine_teleport';
            }
            this.cooldown = 2;
            return;
        }
    }

    override reset(): void {
        super.reset();
        this.state            = 'check_altar';
        this.currentAltar     = null;
        this.currentRock      = null;
        this.lastEssenceCount = 0;
        this.interactTicks    = 0;
        this.scanFailTicks    = 0;
        this.approachTicks    = 0;
        this.mineTimeouts     = 0;
        this.craftInteracted  = false;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _log(player: Player | null, msg: string, key?: string): void {
        const now    = Date.now();
        const logKey = key ?? msg;
        if (this.lastLogKey === logKey && now - this.lastLogTime < 750) return;
        this.lastLogKey  = logKey;
        this.lastLogTime = now;
        const prefix = player ? `[P:${player.x},${player.z}]` : '[BOT]';
        console.log(`${prefix} [RunecraftingTask] ${msg}`);
    }

    /**
     * Selects the highest-tier altar the bot qualifies for:
     *   1. RC level meets the altar's minimum requirement.
     *   2. The matching talisman exists in inventory OR bank.
     */
    private _pickBestAltar(player: Player): AltarDef | null {
        const level  = getBaseLevel(player, PlayerStat.RUNECRAFT);
        const bid    = bankInvId();
        const bank   = bid !== -1 ? player.getInventory(bid) : null;

        for (const altar of ALTARS) {
            if (level < altar.levelReq) continue;

            if (hasItem(player, altar.talismanId)) return altar;

            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    if (bank.get(i)?.id === altar.talismanId) return altar;
                }
            }
        }
        return null;
    }

    private _hasPickaxe(player: Player): boolean {
        for (const id of PICKAXE_IDS) {
            if (hasItem(player, id)) return true;
        }
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (const id of PICKAXE_IDS) {
                    for (let i = 0; i < bank.capacity; i++) {
                        if (bank.get(i)?.id === id) return true;
                    }
                }
            }
        }
        return false;
    }

    private _bestPickaxe(player: Player): number {
        for (const id of PICKAXE_IDS) {
            if (hasItem(player, id)) return id;
        }
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (const id of PICKAXE_IDS) {
                    for (let i = 0; i < bank.capacity; i++) {
                        if (bank.get(i)?.id === id) return id;
                    }
                }
            }
        }
        return Items.BRONZE_PICKAXE;
    }

    /**
     * Deposits everything except the current talisman and best pickaxe,
     * then withdraws those two items from the bank if not already in inventory.
     */
    private _bankDeposit(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;

        const inv  = player.getInventory(InvType.INV);
        const bank = player.getInventory(bid);
        if (!inv || !bank) return;

        const talismanId = this.currentAltar?.talismanId ?? -1;
        const keep       = new Set<number>();
        if (talismanId !== -1) keep.add(talismanId);
        keep.add(this.pickaxeId);

        // ── Deposit everything not in keep set ────────────────────────────────
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || keep.has(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }

        // ── Withdraw talisman if not in inventory ─────────────────────────────
        if (talismanId !== -1 && !hasItem(player, talismanId)) {
            for (let i = 0; i < bank.capacity; i++) {
                const it = bank.get(i);
                if (it?.id === talismanId) {
                    bank.remove(talismanId, 1);
                    addItem(player, talismanId, 1);
                    this._log(null, `withdrew ${this.currentAltar?.name} talisman from bank`, 'talis_out');
                    break;
                }
            }
        }

        // ── Withdraw pickaxe if not in inventory ──────────────────────────────
        if (!hasItem(player, this.pickaxeId)) {
            outer: for (const id of PICKAXE_IDS) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === id) {
                        bank.remove(id, 1);
                        addItem(player, id, 1);
                        this.pickaxeId = id;
                        this._log(null, `withdrew pickaxe (${id}) from bank`, 'pick_out');
                        break outer;
                    }
                }
            }
        }

        this._log(null, `bank deposit done — keeping talisman ${talismanId} + pickaxe ${this.pickaxeId}`, 'deposit_done');
    }

    /**
     * Finds the nearest Rune Essence rock.
     * Tries display name first, then internal name variants (mirrors _findRock in MiningTask).
     */
    private _findEssenceRock(player: Player): Loc | null {
        return (
            findLocByName(player.x, player.z, player.level, 'blankrunestone', 15) ??
            findLocByName(player.x, player.z, player.level, 'blankrunestone', 15) ??
            findLocByPrefix(player.x, player.z, player.level, 'blankrunestone', 15) ??
            findLocByPrefix(player.x, player.z, player.level, 'blankrunestone', 15) 
            
        );
    }

    /**
     * Fallback: manually add one rune essence when the server has no handler.
     * Called only after INTERACT_TIMEOUT fires twice with no server response.
     */
    private _mineEssenceManually(player: Player): void {
        if (isInventoryFull(player)) return;
        const added = addItem(player, Items.RUNE_ESSENCE, 1);
        if (added) {
            addXp(player, PlayerStat.MINING, 50); // 5 Mining XP × 10
            this.lastEssenceCount = countItem(player, Items.RUNE_ESSENCE);
            this.watchdog.notifyActivity();
            this._log(null, 'manually added rune essence (no server handler)', 'manual_ess');
        }
    }
}

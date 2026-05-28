/**
 * RangedMagicTask.ts
 *
 * Combined Ranged + Magic combat task.
 *
 * Initiation conditions (checked by shouldRun / BotGoalPlanner):
 *   • Has a bow (shortbow/oak shortbow) + any arrows  →  ranged mode
 *   • Has staff_of_air + mind runes                   →  magic mode
 *   • Neither: task only starts once the bot has ≥ 5 000 coins to buy equipment.
 *
 * Shopping (when equipment is missing):
 *   Varrock Archery  — shortbow (100gp) + bronze arrows (7gp each × 200)
 *   Zaff's Staffs    — staff_of_air (1 000gp)
 *   Aubury's Runes   — mind runes (4gp each × 200)
 *
 * After equipping, the bot follows the same NPC progression as melee CombatTask:
 *   1–19  chickens / goblins (Lumbridge)
 *   20+   barbarians / chaos druids (Taverley Dungeon via teleJump)
 *   40+   Al Kharid warriors
 *
 * Dungeon navigation for chaos druids mirrors CombatTask:
 *   Walk to TAVERLY_DUNGEON_ENTRANCE → teleJump to TAVERLY_DUNGEON_FLOOR
 *   Exit: teleJump back to TAVERLY_DUNGEON_ENTRANCE before banking.
 */

import {
    BotTask,
    Player,
    Npc,
    InvType,
    walkTo,
    interactNpcOp,
    findNpcByName,
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
    getProgressionStep,
    teleportNear,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    setCombatStyle,
    setAutocastWindStrike,
    openNearbyGate,
    botJitter,
    advanceBankWalk,
    cleanGrimyHerbs,
    botTeleport
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { findNpcFiltered, npcMatchesName, interactHeldOp, _wornContains, _equipLoot } from '#/engine/bot/BotAction.js';
import NpcType from '#/cache/config/NpcType.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum coins needed to go buy ranged/magic equipment from Varrock. */
export const MIN_COINS_TO_SHOP = 3000;

/** Arrows to buy per trip. */
const ARROW_BUY_QTY = 500;

/** Mind runes to buy per trip. */
const RUNE_BUY_QTY = 500;

/** Arrows to restock when supply drops below this level. */
const ARROW_LOW_THRESHOLD = 1;

/** Runes to restock when supply drops below this level. */
const RUNE_LOW_THRESHOLD = 1;

// ── NPC claim registry (shared with CombatTask) ───────────────────────────────
const CLAIMED_NPCS_RM = new Set<number>();

function _npcKey(npc: Npc): number {
    const idx = (npc as any).index;
    if (typeof idx === 'number') return idx;
    return npc.x * 100003 + npc.z * 1009 + npc.type;
}

type RangedMagicExtra = {
    npcType?: string;
    npcTypes?: string[];
    spell?: string;
    dungeon?: boolean;
};

/** Which combat mode is active for this fight session. */
type Mode = 'ranged' | 'magic';

// ── Shop step descriptor ──────────────────────────────────────────────────────
interface ShopBuy {
    shopKey: keyof typeof Locations;
    npcName: string;
    itemId: number;
    qty: number;
    cost: number;
    op: 1 | 2 | 3 | 4 | 5; // NPC interact op (3 = Trade for most shops)
}

export class RangedMagicTask extends BotTask {
    private mode: Mode | null = null;
    private step: SkillStep;
    private primaryStat: PlayerStat; // RANGED or MAGIC

    private state: 'check_equip' | 'shop_walk' | 'shop_open' | 'shop_buy' | 'equip' | 'walk' | 'patrol' | 'scan' | 'interact' | 'flee' | 'bank_walk' | 'bank_deposit' = 'check_equip';

    private shopQueue: ShopBuy[] = [];
    private currentShop: ShopBuy | null = null;
    private shopNpc: Npc | null = null;

    private currentNpc: Npc | null = null;
    private claimedNpcKey = -1;

    private interactTicks = 0;
    private approachTicks = 0;
    private lastXp = 0;
    private scanFail = 0;
    private fleeTicks = 0;
    private readonly FLEE_TICKS = 12;

    private patrolTarget: [number, number] | null = null;
    private patrolTicks = 0;

    private hasFoughtInArea = false;

    /** Cooldown ticks before the next gate-open attempt (avoids spamming). */
    private intentCooldown = 0;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog(150);

    private lastLogKey = '';
    private lastLogTime = 0;

    constructor(step: SkillStep, stat: PlayerStat) {
        super('RangedMagic');
        this.step = step;
        this.primaryStat = stat;
        this.watchdog.destination = step.location;
    }

    // ── Logging ───────────────────────────────────────────────────────────────

    private _log(player: Player | null, msg: string, key?: string): void {
        const now = Date.now();
        const logKey = key ?? msg;
        if (this.lastLogKey === logKey && now - this.lastLogTime < 750) return;
        this.lastLogKey = logKey;
        this.lastLogTime = now;
        const prefix = player ? `[P:${player.x},${player.z}]` : '[BOT]';
        console.log(`${prefix} [RangedMagicTask] ${msg}`);
    }

    // ── shouldRun ─────────────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        // Can run if mode is already determined, or equipment exists, or has coins to shop
        if (this._pickMode(player) !== null) return true;
        return this._totalCoins(player) >= MIN_COINS_TO_SHOP;
    }

    // ── Main tick ─────────────────────────────────────────────────────────────

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_deposit';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this._log(player, 'watchdog reset → check_equip', 'watchdog');
            this.state = 'check_equip';
            this._releaseNpc();
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        if (this.intentCooldown > 0) this.intentCooldown--;

        // ── Dungeon exit gate ──────────────────────────────────────────────────
        // If bot is underground and needs to bank/shop, surface first.
        if ((this.state === 'bank_walk' || this.state === 'shop_walk') && player.z > 6000) {
            const [ex, ez, el] = Locations.TAVERLY_DUNGEON_ENTRANCE;
            botTeleport(player, ex, ez, el);
            return;
        }

        // ── CHECK / EQUIP ─────────────────────────────────────────────────────
        if (this.state === 'check_equip') {
            const mode = this._pickMode(player);
            if (mode !== null) {
                this.mode = mode;
                // Equip the right weapon before walking to combat
                this._equipWeapons(player);
                this._refreshStep(player);
                this.state = 'walk';
                this._log(player, `mode=${mode}, step=${this.step.location}`, 'equip_ok');
                return;
            }

            // No equipment — build a shopping list and go buy
            const coins = this._totalCoins(player);
            if (coins < MIN_COINS_TO_SHOP) {
                this._log(player, `need ${MIN_COINS_TO_SHOP} coins, have ${coins} → idle`, 'no_coins');
                this.interrupted = true; // give up; planner will re-evaluate
                return;
            }

            this.shopQueue = this._buildShopQueue(player);
            if (this.shopQueue.length === 0) {
                // Somehow have enough but nothing to buy (edge case)
                this.state = 'check_equip';
                return;
            }
            this._nextShop();
            this.state = 'shop_walk';
            return;
        }

        // ── SHOP ──────────────────────────────────────────────────────────────
        if (this.state === 'shop_walk') {
            if (!this.currentShop) {
                this.state = 'check_equip';
                return;
            }
            const [sx, sz] = Locations[this.currentShop.shopKey as keyof typeof Locations] as [number, number, number];
            if (!isNear(player, sx, sz, 8)) {
                this._stuckWalk(player, sx, sz);
                return;
            }
            // Find the shopkeeper NPC
            const npc = findNpcByName(player.x, player.z, player.level, this.currentShop.npcName, 10);
            if (!npc) return;
            interactNpcOp(player, npc, this.currentShop.op);
            this.shopNpc = npc;
            this.state = 'shop_open';
            this.cooldown = 2;
            return;
        }

        if (this.state === 'shop_open') {
            this.cooldown = 2;
            this.state = 'shop_buy';
            return;
        }

        if (this.state === 'shop_buy') {
            if (!this.currentShop || !this.shopNpc) {
                this._nextShop();
                if (!this.currentShop) {
                    this.state = 'check_equip';
                    return;
                }
                this.state = 'shop_walk';
                return;
            }

            // Check if we already have enough of this item
            const have = countItem(player, this.currentShop.itemId);
            if (have >= this.currentShop.qty) {
                this._log(player, `already have ${this.currentShop.itemId} × ${have}`, 'shop_skip');
                this._nextShop();
                if (!this.currentShop) {
                    this.state = 'check_equip';
                    return;
                }
                this.state = 'shop_walk';
                return;
            }

            // Check affordability
            const coins = countItem(player, Items.COINS);
            if (coins < this.currentShop.cost) {
                this._log(player, `can't afford ${this.currentShop.itemId}`, 'shop_broke');
                this._nextShop();
                if (!this.currentShop) {
                    this.state = 'check_equip';
                    return;
                }
                this.state = 'shop_walk';
                return;
            }

            // Buy as many as we can afford up to the desired qty
            const canBuy = Math.min(this.currentShop.qty - have, Math.floor(coins / this.currentShop.cost));
            if (canBuy > 0) {
                removeItem(player, Items.COINS, canBuy * this.currentShop.cost);
                const added = addItem(player, this.currentShop.itemId, canBuy);
                if (!added) {
                    // Inventory full — refund and bank first
                    addItem(player, Items.COINS, canBuy * this.currentShop.cost);
                    this.state = 'bank_walk';
                    return;
                }
                this._log(player, `bought ${this.currentShop.itemId} × ${canBuy}`, 'shop_bought');
            }

            // Move to next shop in queue
            this._nextShop();
            if (!this.currentShop) {
                // All done shopping — check if should teleport to combat location
                const [lx, lz, ll] = this.step.location;
                if (this._shouldTeleportAfterShop(player, lx, lz)) {
                    botTeleport(player, lx, lz, ll);
                    this._log(player, `teleporting to combat at ${lx},${lz}`, 'shop_teleport');
                }
                this.state = 'check_equip';
            } else {
                this.state = 'shop_walk';
            }
            return;
        }

        // ── EQUIP ─────────────────────────────────────────────────────────────
        if (this.state === 'equip') {
            this._equipWeapons(player);
            this._refreshStep(player);
            this.state = 'walk';
            return;
        }

        // ── LEVEL PROGRESSION UPDATE ──────────────────────────────────────────
        const skillName = this.primaryStat === PlayerStat.RANGED ? 'RANGED' : 'MAGIC';
        const level = getBaseLevel(player, this.primaryStat);
        const newStep = getProgressionStep(skillName, level);
        if (newStep && newStep.minLevel > this.step.minLevel) {
            this._log(player, `LEVEL UP → ${this.step.minLevel} → ${newStep.minLevel}`, 'level_up');
            this.step = newStep;
            this.state = 'walk';
            this.currentNpc = null;
            this.scanFail = 0;
            this.patrolTarget = null;
            this.patrolTicks = 0;
        }

        // ── INVENTORY FULL ────────────────────────────────────────────────────
        if (isInventoryFull(player) && !['bank_walk', 'bank_deposit', 'shop_walk', 'shop_open', 'shop_buy'].includes(this.state)) {
            this._log(player, 'INVENTORY FULL → bank_walk', 'inv_full');
            this.state = 'bank_walk';
            this.currentNpc = null;
            return;
        }

        // ── LOW AMMO / RUNES → bank to restock ───────────────────────────────
        if (this.mode === 'ranged' && this.step.itemConsumed) {
            if (countItem(player, this.step.itemConsumed) < ARROW_LOW_THRESHOLD) {
                const bid = bankInvId();
                if (bid !== -1) {
                    const bank = player.getInventory(bid);
                    if (bank) {
                        let bankCount = 0;
                        for (let i = 0; i < bank.capacity; i++) {
                            const it = bank.get(i);
                            if (it?.id === this.step.itemConsumed) bankCount += it.count;
                        }
                        if (bankCount > 0) {
                            this._log(player, 'low arrows → bank_walk', 'low_ammo');
                            this.state = 'bank_walk';
                            this.currentNpc = null;
                            return;
                        }
                        // No arrows in bank either — buy more
                        if (this._totalCoins(player) >= 200 * 7) {
                            this.shopQueue = [{ shopKey: 'VARROCK_ARCHERY', npcName: 'lowe', itemId: Items.BRONZE_ARROW, qty: ARROW_BUY_QTY, cost: 7, op: 3 }];
                            this._nextShop();
                            this.state = 'shop_walk';
                            return;
                        }
                    }
                }
            }
        }
        if (this.mode === 'magic' && this.step.itemConsumed) {
            if (countItem(player, this.step.itemConsumed) < RUNE_LOW_THRESHOLD) {
                const bid = bankInvId();
                if (bid !== -1) {
                    const bank = player.getInventory(bid);
                    if (bank) {
                        let bankCount = 0;
                        for (let i = 0; i < bank.capacity; i++) {
                            const it = bank.get(i);
                            if (it?.id === this.step.itemConsumed) bankCount += it.count;
                        }
                        if (bankCount > 0) {
                            this._log(player, 'low runes → bank_walk', 'low_runes');
                            this.state = 'bank_walk';
                            this.currentNpc = null;
                            return;
                        }
                        if (this._totalCoins(player) >= RUNE_BUY_QTY * 4) {
                            this.shopQueue = [{ shopKey: 'VARROCK_RUNES', npcName: 'aubury', itemId: Items.MIND_RUNE, qty: RUNE_BUY_QTY, cost: 4, op: 3 }];
                            this._nextShop();
                            this.state = 'shop_walk';
                            return;
                        }
                    }
                }
            }
        }

        // ── BANK ──────────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_deposit';
            return;
        }

        if (this.state === 'bank_deposit') {
            _equipLoot(player);
            cleanGrimyHerbs(player);
            this._depositLoot(player);
            this._withdrawAmmo(player);
            this.state = 'check_equip';
            this.cooldown = 3;
            return;
        }

        // ── WALK ──────────────────────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;

            if (!isNear(player, lx, lz, 15, ll)) {
                // Dungeon entrance handling
                const extra = this.step.extra as RangedMagicExtra | undefined;
                if (extra?.dungeon && lz > 6000 && player.z < 6000) {
                    const [ex, ez] = Locations.TAVERLY_DUNGEON_ENTRANCE;
                    if (!isNear(player, ex, ez, 6)) {
                        this._stuckWalk(player, ex, ez);
                        return;
                    }
                    const [fx, fz, fl] = Locations.TAVERLY_DUNGEON_FLOOR;
                    botTeleport(player, fx, fz, fl);
                    return;
                }

                // Via waypoint
                const via = this.step.via;
                if (via && player.level === via[2] && player.z < via[1] && !isNear(player, via[0], via[1], 5)) {
                    const [jx, jz] = botJitter(player, via[0], via[1], 3);
                    this._stuckWalk(player, jx, jz);
                    return;
                }

                const [jx, jz] = botJitter(player, lx, lz, 6);
                this._stuckWalk(player, jx, jz);
                return;
            }

            this.state = 'patrol';
            this.patrolTicks = 0;
            this.patrolTarget = null;
            return;
        }

        // ── FLEE ──────────────────────────────────────────────────────────────
        if (this.state === 'flee') {
            this.fleeTicks++;
            const [lx, lz] = this.step.location;
            this._stuckWalk(player, lx, lz);
            if (this.fleeTicks >= this.FLEE_TICKS || isNear(player, lx, lz, 12)) {
                this.state = 'scan';
                this.fleeTicks = 0;
                this.scanFail = 0;
            }
            return;
        }

        // ── PATROL ────────────────────────────────────────────────────────────
        if (this.state === 'patrol') {
            const [cx, cz] = this.step.location;
            const [jcx, jcz] = botJitter(player, cx, cz, 8);

            // Try to open nearby gates while patrolling (handles fenced areas)
            if (this.intentCooldown === 0 && openNearbyGate(player, 8)) {
                this.intentCooldown = 4;
            }

            if (!this.patrolTarget || this.patrolTicks % randInt(3, 6) === 0) {
                this.patrolTarget = [jcx + randInt(-8, 8), jcz + randInt(-8, 8)];
            }

            this.patrolTicks++;
            const [tx, tz] = this.patrolTarget;
            walkTo(player, tx, tz);

            if (this.patrolTicks % 2 === 0) {
                let npc = this._findTarget(player);
                if (!npc) npc = this._findTargetWider(player);

                if (npc) {
                    this._log(player, `found NPC → ${NpcType.get(npc.type).name ?? npc.type}`, 'patrol_found');
                    if (!isNear(player, npc.x, npc.z, 5)) {
                        walkTo(player, npc.x, npc.z);
                        return;
                    }
                    this._claimNpc(npc);
                    this.currentNpc = npc;
                    this._setAttackStyle(player);
                    interactNpcOp(player, npc, 2);
                    this.state = 'interact';
                    this.interactTicks = 0;
                    this.approachTicks = 0;
                    this.lastXp = player.stats[this.primaryStat];
                    this.scanFail = 0;
                    this.hasFoughtInArea = true;
                    return;
                }

                if (this.patrolTicks > randInt(6, 12)) {
                    this.state = 'scan';
                    this.patrolTicks = 0;
                    this.patrolTarget = null;
                }
            }
            return;
        }

        // ── SCAN ──────────────────────────────────────────────────────────────
        if (this.state === 'scan') {
            // Try to open nearby gates while scanning (handles fenced combat areas)
            if (this.intentCooldown === 0) {
                if (openNearbyGate(player, 30)) {
                    this.intentCooldown = 4;
                }
            }

            let npc = this._findTarget(player);
            if (!npc) npc = this._findTargetWider(player);

            if (npc) {
                this._claimNpc(npc);
                this.currentNpc = npc;
                this._setAttackStyle(player);
                interactNpcOp(player, npc, 2);
                this.state = 'interact';
                this.interactTicks = 0;
                this.approachTicks = 0;
                this.lastXp = player.stats[this.primaryStat];
                this.scanFail = 0;
                this.hasFoughtInArea = true;
                return;
            }

            this.scanFail++;
            if (this.scanFail >= 10) {
                this.scanFail = 0;
                this.state = 'walk';
            } else {
                const [lx, lz] = this.step.location;
                const [jx, jz] = botJitter(player, lx, lz, 6);
                walkTo(player, jx, jz);
            }
            return;
        }

        // ── INTERACT ──────────────────────────────────────────────────────────
        if (this.state === 'interact') {
            if (!this.currentNpc) {
                this.state = 'scan';
                return;
            }

            this.interactTicks++;
            this.approachTicks++;

            const xpNow = player.stats[this.primaryStat];
            const xpGained = xpNow - this.lastXp;
            if (xpGained > 0) {
                this.lastXp = xpNow;
                this.approachTicks = 0;
            }

            // NPC dead — scan for next target
            if (!this._isNpcAlive(player, this.currentNpc)) {
                this._releaseNpc();
                this.currentNpc = null;
                this.state = 'scan';
                this.interactTicks = 0;
                return;
            }

            // Approach timeout — re-engage
            if (this.approachTicks >= INTERACT_TIMEOUT) {
                this.approachTicks = 0;
                interactNpcOp(player, this.currentNpc, 2);
                return;
            }

            // Overall interact timeout — give up
            if (this.interactTicks >= INTERACT_TIMEOUT * 3) {
                this._log(player, 'interact timeout → scan', 'timeout');
                this._releaseNpc();
                this.currentNpc = null;
                this.state = 'scan';
                this.interactTicks = 0;
                return;
            }
        }
    }

    // ── Mode detection ─────────────────────────────────────────────────────────

    private _pickMode(player: Player): Mode | null {
        const bid = bankInvId();
        const bank = bid !== -1 ? player.getInventory(bid) : null;

        /** Count item across inventory + bank. */
        const countAll = (id: number): number => {
            let n = countItem(player, id);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === id) n += it.count;
                }
            }
            return n;
        };

        const hasBow = countAll(Items.OAK_SHORTBOW) > 0 || countAll(Items.SHORTBOW) > 0;
        const hasArrows = countAll(Items.BRONZE_ARROW) > 0 || countAll(Items.IRON_ARROW) > 0 || countAll(Items.STEEL_ARROW) > 0;
        const hasStaff = countAll(Items.STAFF_OF_AIR) > 0;
        const hasMindRune = countAll(Items.MIND_RUNE) > 0;

        const canDoMagic = hasStaff && hasMindRune;
        const canDoRanged = hasBow && hasArrows;

        // 50/50 random chance when both are available
        if (canDoMagic && canDoRanged) {
            return Math.random() < 0.5 ? 'magic' : 'ranged';
        }
        if (canDoMagic) return 'magic';
        if (canDoRanged) return 'ranged';
        return null;
    }

    // ── Equipment helpers ─────────────────────────────────────────────────────

    private _equipWeapons(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        if (this.mode === 'magic') {
            // Equip staff_of_air if in inventory and not already worn
            if (!_wornContains(player, Items.STAFF_OF_AIR)) {
                for (let slot = 0; slot < inv.capacity; slot++) {
                    const it = inv.get(slot);
                    if (it?.id === Items.STAFF_OF_AIR) {
                        interactHeldOp(player, inv, it.id, slot, 2);
                        break;
                    }
                }
            }
        } else if (this.mode === 'ranged') {
            // Equip oak shortbow (preferred) or shortbow
            const bowIds = [Items.OAK_SHORTBOW, Items.SHORTBOW];
            for (const bowId of bowIds) {
                if (!_wornContains(player, bowId) && hasItem(player, bowId)) {
                    for (let slot = 0; slot < inv.capacity; slot++) {
                        const it = inv.get(slot);
                        if (it?.id === bowId) {
                            interactHeldOp(player, inv, it.id, slot, 2);
                            break;
                        }
                    }
                    break;
                }
            }

            // Equip arrows into ammo slot (best available: steel > iron > bronze)
            const arrowIds = [Items.STEEL_ARROW, Items.IRON_ARROW, Items.BRONZE_ARROW];
            for (const arrowId of arrowIds) {
                if (!_wornContains(player, arrowId) && hasItem(player, arrowId)) {
                    for (let slot = 0; slot < inv.capacity; slot++) {
                        const it = inv.get(slot);
                        if (it?.id === arrowId) {
                            interactHeldOp(player, inv, it.id, slot, 2);
                            break;
                        }
                    }
                    break;
                }
            }
        }
    }

    private _setAttackStyle(player: Player): void {
        if (this.mode === 'magic') {
            // Enable autocast wind strike with staff_of_air
            setAutocastWindStrike(player);
        } else {
            // Ranged: style 0 (accurate) → ranged XP
            setCombatStyle(player, 0);
        }
    }

    // ── Step selection ────────────────────────────────────────────────────────

    private _refreshStep(player: Player): void {
        if (!this.mode) return;
        const skillName = this.mode === 'ranged' ? 'RANGED' : 'MAGIC';
        const level = getBaseLevel(player, this.primaryStat);
        const s = getProgressionStep(skillName, level);
        if (s) this.step = s;
    }

    // ── Shopping helpers ──────────────────────────────────────────────────────

    private _totalCoins(player: Player): number {
        let total = countItem(player, Items.COINS);
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === Items.COINS) total += it.count;
                }
            }
        }
        return total;
    }

    private _buildShopQueue(player: Player): ShopBuy[] {
        const queue: ShopBuy[] = [];
        const coins = this._totalCoins(player);

        // Staff of air (1 000gp) — must be bought from Zaff
        if (!hasItem(player, Items.STAFF_OF_AIR) && coins >= 1000) {
            queue.push({ shopKey: 'VARROCK_STAFFS', npcName: 'zaff', itemId: Items.STAFF_OF_AIR, qty: 1, cost: 1000, op: 3 });
        }

        // Shortbow (100gp) from Lowe's Archery
        if (!hasItem(player, Items.SHORTBOW) && !hasItem(player, Items.OAK_SHORTBOW) && coins >= 100) {
            queue.push({ shopKey: 'VARROCK_ARCHERY', npcName: 'lowe', itemId: Items.SHORTBOW, qty: 1, cost: 100, op: 3 });
        }

        // Bronze arrows (7gp each × 200)
        const arrowCount = countItem(player, Items.BRONZE_ARROW);
        if (arrowCount < ARROW_BUY_QTY && coins >= 7 * (ARROW_BUY_QTY - arrowCount)) {
            queue.push({ shopKey: 'VARROCK_ARCHERY', npcName: 'lowe', itemId: Items.BRONZE_ARROW, qty: ARROW_BUY_QTY - arrowCount, cost: 7, op: 3 });
        }

        // Mind runes (4gp each × 200)
        const runeCount = countItem(player, Items.MIND_RUNE);
        if (runeCount < RUNE_BUY_QTY && coins >= 4 * (RUNE_BUY_QTY - runeCount)) {
            queue.push({ shopKey: 'VARROCK_RUNES', npcName: 'aubury', itemId: Items.MIND_RUNE, qty: RUNE_BUY_QTY - runeCount, cost: 4, op: 3 });
        }

        return queue;
    }

    private _nextShop(): void {
        this.currentShop = this.shopQueue.shift() ?? null;
        this.shopNpc = null;
    }

    // ── Teleport after shopping helper ──────────────────────────────────────
    private _shouldTeleportAfterShop(player: Player, targetX: number, targetZ: number): boolean {
        // Only teleport if:
        // 1. Shopping was done in Varrock area (currentShop is null)
        // 2. Target is far from Varrock (more than 50 tiles away)
        // 3. No special routing needed (no dungeon, no via waypoint)
        const isFar = Math.abs(player.x - targetX) > 50 || Math.abs(player.z - targetZ) > 50;
        const extra = this.step.extra as RangedMagicExtra | undefined;
        const needDungeon = extra?.dungeon;
        const hasVia = this.step.via !== undefined;

        return isFar && !needDungeon && !hasVia;
    }

    // ── Banking helpers ───────────────────────────────────────────────────────

    private _depositLoot(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;
        const inv = player.getInventory(InvType.INV);
        const bank = player.getInventory(bid);
        if (!inv || !bank) return;

        const keep = new Set<number>([Items.COINS, Items.STAFF_OF_AIR, Items.SHORTBOW, Items.OAK_SHORTBOW, Items.BRONZE_ARROW, Items.IRON_ARROW, Items.STEEL_ARROW, Items.MIND_RUNE]);

        for (let slot = 0; slot < inv.capacity; slot++) {
            const it = inv.get(slot);
            if (!it || keep.has(it.id)) continue;
            const moved = inv.remove(it.id, it.count);
            if (moved.completed > 0) bank.add(it.id, moved.completed);
        }
    }

    private _withdrawAmmo(player: Player): void {
        // Withdraw arrows or runes from bank for the current mode
        if (!this.mode || !this.step.itemConsumed) return;
        const bid = bankInvId();
        if (bid === -1) return;
        const inv = player.getInventory(InvType.INV);
        const bank = player.getInventory(bid);
        if (!inv || !bank) return;

        const target = this.step.itemConsumed;
        const inInv = countItem(player, target);
        if (inInv >= ARROW_BUY_QTY) return; // already have plenty

        // Find how many we have in bank
        for (let i = 0; i < bank.capacity; i++) {
            const it = bank.get(i);
            if (!it || it.id !== target) continue;
            const need = Math.min(it.count, ARROW_BUY_QTY - inInv);
            if (need <= 0) break;
            const moved = bank.remove(target, need);
            if (moved.completed > 0) inv.add(target, moved.completed);
            break;
        }
    }

    // ── NPC targeting ─────────────────────────────────────────────────────────

    private _findTarget(player: Player): Npc | null {
        const extra = this.step.extra as RangedMagicExtra | undefined;
        if (!extra) return null;
        const names: string[] = [];
        if (extra.npcTypes?.length) names.push(...extra.npcTypes);
        if (extra.npcType) names.push(extra.npcType);
        for (const name of names.sort(() => Math.random() - 0.5)) {
            const npc = findNpcFiltered(player.x, player.z, player.level, n => npcMatchesName(n, name) && this._isAvailable(n), 22);
            if (npc) return npc;
        }
        return null;
    }

    private _findTargetWider(player: Player): Npc | null {
        const extra = this.step.extra as RangedMagicExtra | undefined;
        if (!extra) return null;
        const names: string[] = [];
        if (extra.npcTypes?.length) names.push(...extra.npcTypes);
        if (extra.npcType) names.push(extra.npcType);
        for (const name of names.sort(() => Math.random() - 0.5)) {
            const npc = findNpcFiltered(player.x, player.z, player.level, n => npcMatchesName(n, name) && this._isAvailable(n), 35);
            if (npc) return npc;
        }
        return null;
    }

    private _isAvailable(npc: Npc): boolean {
        return !CLAIMED_NPCS_RM.has(_npcKey(npc));
    }

    private _isNpcAlive(player: Player, npc: Npc): boolean {
        return findNpcFiltered(player.x, player.z, player.level, n => n === npc, 30) !== null;
    }

    // ── NPC claim ─────────────────────────────────────────────────────────────

    private _claimNpc(npc: Npc): void {
        this._releaseNpc();
        this.claimedNpcKey = _npcKey(npc);
        CLAIMED_NPCS_RM.add(this.claimedNpcKey);
    }

    private _releaseNpc(): void {
        if (this.claimedNpcKey !== -1) {
            CLAIMED_NPCS_RM.delete(this.claimedNpcKey);
            this.claimedNpcKey = -1;
        }
    }

    // ── Stuck walk ────────────────────────────────────────────────────────────

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
        // Try to open a gate/door blocking the path before giving up
        if (openNearbyGate(player, 30)) {
            this.intentCooldown = 3;
            return;
        }
        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }

    // ── Task lifecycle ────────────────────────────────────────────────────────

    isComplete(): boolean {
        return false; // runs until planner re-evaluates (rescans on timer)
    }

    override reset(): void {
        super.reset();
        this._releaseNpc();
        this.state = 'check_equip';
        this.currentNpc = null;
        this.patrolTarget = null;
        this.patrolTicks = 0;
        this.scanFail = 0;
        this.intentCooldown = 0;
        this.stuck.reset();
    }
}

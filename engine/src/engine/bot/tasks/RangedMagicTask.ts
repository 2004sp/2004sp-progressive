/**
 * RangedMagicTask.ts
 *
 * Combined Ranged + Magic combat task.
 *
 * Initiation conditions (checked by shouldRun / BotGoalPlanner):
 *   • Has a bow (any tier in RangedBowsByLevel) + any arrows  →  ranged mode
 *   • Has staff_of_air + any wind-line catalyst rune          →  magic mode
 *   • Neither: task only starts once the bot has ≥ 3 000 coins to buy equipment.
 *
 * Gear/spell tier is fully dynamic, recomputed from the bot's live level AND
 * coin budget (inventory + bank) every time it banks — see _refreshGearAndSpell():
 *   Magic:  wind_strike(mind, lvl1) → wind_bolt(chaos, lvl17) →
 *           wind_blast(death, lvl41) → wind_wave(blood, lvl62, members-only,
 *           never shop-bought — only usable if the bot already owns blood runes).
 *           A staff_of_air supplies air runes for free, so only the catalyst
 *           rune needs buying. If the bot can't afford death runes it drops
 *           back to chaos, then mind — see BotKnowledge.pickBestWindSpell().
 *   Ranged: prefers the best bow the bot already owns (fletched — see
 *           FletchingTask/BowStringingTask for willow/maple/yew/magic tiers,
 *           none of which are shop-purchasable), else buys the best it can
 *           (shortbow/oak_shortbow, the only tiers Lowe's Archery stocks).
 *           Arrow tier (bronze/iron/steel) is chosen purely by coin budget —
 *           see BotKnowledge.bestRangedBow()/bestAffordableArrow().
 *
 * Shopping (dynamic, built fresh each time from the picked tiers):
 *   Varrock Archery  — bow (100-200gp) + arrows (10-20gp each × 500)
 *   Zaff's Staffs    — staff_of_air (1 000gp)
 *   Aubury's Runes   — mind/chaos/death runes (10/100/150gp each × 250)
 *
 * NPC progression location comes from BotKnowledge's RANGED/MAGIC
 * SkillProgression tables, same as before — this task only controls WHICH
 * spell/gear tier is used at whatever location the planner already picked.
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
    Inventory,
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
    Shops,
    Locations,
    getProgressionStep,
    teleportNear,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    setCombatStyle,
    setAutocastSpell,
    openNearbyGate,
    botJitter,
    advanceBankWalk,
    cleanGrimyHerbs,
    botTeleport,
    FOOD_IDS,
    WIND_SPELLS,
    pickBestWindSpell,
    RangedBowsByLevel,
    bestRangedBow,
    RangedArrowsByCost,
    bestAffordableArrow
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep, WindSpellTier } from '#/engine/bot/tasks/BotTaskBase.js';
import { findNpcFiltered, npcMatchesName, interactHeldOp, _wornContains, _equipLoot } from '#/engine/bot/BotAction.js';
import NpcType from '#/cache/config/NpcType.js';
import Environment from '#/util/Environment.js';

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

/** Sharks to maintain in inventory during combat (mirrors CombatTask). */
const COMBAT_SHARKS = 15;

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

    private state: 'check_equip' | 'shop_walk' | 'shop_open' | 'shop_buy' | 'equip' | 'walk' | 'patrol' | 'scan' | 'interact' | 'flee' | 'eat' | 'bank_walk' | 'bank_deposit' = 'check_equip';

    private shopQueue: ShopBuy[] = [];
    private currentShop: ShopBuy | null = null;
    private shopNpc: Npc | null = null;

    // ── Dynamic gear/spell tier — recomputed by _refreshGearAndSpell() whenever
    // the bot banks, so it always reflects the current level + coin budget. ──
    private currentSpell: WindSpellTier = WIND_SPELLS[0];
    private currentBowId: number = Items.SHORTBOW;
    private currentArrowId: number = Items.BRONZE_ARROW;
    private currentArrowCost: number = RangedArrowsByCost[0].cost;

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

        // ── HP CHECK & HEALING ───────────────────────────────────────────────────
        // Mirrors CombatTask — this task previously had no food/HP handling at
        // all, so bots would keep fighting (and dying) at any HP.
        const hp = player.stats[PlayerStat.HITPOINTS];
        const maxHp = player.baseLevels[PlayerStat.HITPOINTS];
        const hpSafeStates = ['bank_walk', 'bank_deposit', 'shop_walk', 'shop_open', 'shop_buy', 'check_equip', 'flee', 'eat'];
        if (hp < maxHp * 0.4 && !hpSafeStates.includes(this.state)) {
            if (this._hasFood(player)) {
                this._log(player, `HP low (${hp}/${maxHp}), eating...`, 'heal_trigger');
                this.state = 'eat';
                return;
            }
            this._log(player, `HP low (${hp}/${maxHp}) and NO FOOD, fleeing!`, 'flee_low_hp');
            this._releaseNpc();
            this.currentNpc = null;
            this.state = 'flee';
            this.fleeTicks = 0;
            return;
        }

        // ── CHECK / EQUIP ─────────────────────────────────────────────────────
        if (this.state === 'check_equip') {
            const mode = this._pickMode(player);
            if (mode !== null) {
                this.mode = mode;
                // Pick the best sustainable spell/gear tier, then equip it, before walking to combat
                this._refreshGearAndSpell(player);
                this._equipWeapons(player);

                // _pickMode()/_refreshGearAndSpell() only check ownership across
                // inventory + bank — the gear may still be sitting in the bank,
                // in which case _equipWeapons() (inventory-only) silently does
                // nothing. Without this check the bot would walk off to combat
                // and swing bare-handed while carrying arrows it can't use.
                if (!this._isFullyEquipped(player)) {
                    this._log(player, 'gear owned but not in hand → bank_walk to withdraw', 'need_withdraw');
                    this.state = 'bank_walk';
                    return;
                }

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
            this._refreshGearAndSpell(player);
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
        // Uses the currently-picked tier (this.currentArrowId / this.currentSpell),
        // not a fixed item — so restocking always chases whatever tier the bot
        // has actually settled into.
        if (this.mode === 'ranged') {
            if (countItem(player, this.currentArrowId) < ARROW_LOW_THRESHOLD) {
                const bankCount = this._countAll(player, this.currentArrowId) - countItem(player, this.currentArrowId);
                if (bankCount > 0) {
                    this._log(player, 'low arrows → bank_walk', 'low_ammo');
                    this.state = 'bank_walk';
                    this.currentNpc = null;
                    return;
                }
                // None in bank either — buy more of whatever tier is currently affordable.
                if (this._totalCoins(player) >= ARROW_BUY_QTY * this.currentArrowCost) {
                    this.shopQueue = [{ shopKey: 'VARROCK_ARCHERY', npcName: 'lowe', itemId: this.currentArrowId, qty: ARROW_BUY_QTY, cost: this.currentArrowCost, op: 3 }];
                    this._nextShop();
                    this.state = 'shop_walk';
                    return;
                }
            }
        }
        if (this.mode === 'magic') {
            const catalyst = this.currentSpell.catalystRune;
            if (countItem(player, catalyst) < RUNE_LOW_THRESHOLD) {
                const bankCount = this._countAll(player, catalyst) - countItem(player, catalyst);
                if (bankCount > 0) {
                    this._log(player, 'low runes → bank_walk', 'low_runes');
                    this.state = 'bank_walk';
                    this.currentNpc = null;
                    return;
                }
                if (this.currentSpell.catalystCost >= 0 && this._totalCoins(player) >= RUNE_BUY_QTY * this.currentSpell.catalystCost) {
                    this.shopQueue = [{ shopKey: 'VARROCK_RUNES', npcName: 'aubury', itemId: catalyst, qty: RUNE_BUY_QTY, cost: this.currentSpell.catalystCost, op: 3 }];
                    this._nextShop();
                    this.state = 'shop_walk';
                    return;
                }
                // Out of runes, can't shop-buy this tier (e.g. blood runes) or
                // can't afford it — drop back down to a sustainable tier now
                // rather than standing idle waiting for runes that won't come.
                this.state = 'check_equip';
                return;
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
            // _equipLoot() is a generic "wear anything better than what's worn"
            // sweep meant for armor/jewellery drops. Its tier heuristic only
            // recognizes melee weapon material names (bronze/iron/.../rune) —
            // a bow resolves to tier -1 (unrecognized), so ANY tiered melee
            // weapon sitting in inventory (e.g. a leftover woodcutting axe)
            // always looks like an "upgrade" and gets auto-equipped over the
            // bow. Left uncorrected this fights _equipWeapons() every single
            // bank visit — check_equip immediately fails _isFullyEquipped()
            // again and loops straight back to bank_walk forever.
            _equipLoot(player);
            cleanGrimyHerbs(player);
            // Re-pick the best sustainable tier from the coin balance right
            // after depositing loot (most accurate coin count), then deposit
            // any stale lower-tier gear and withdraw the new tier.
            this._refreshGearAndSpell(player);
            this._depositLoot(player);
            this._withdrawAmmo(player);
            // Re-assert the correct weapon now that it's guaranteed to be in
            // hand (undoes whatever _equipLoot() wrongly equipped above), then
            // deposit again so the displaced item (the axe) actually leaves
            // the inventory instead of sitting there to be re-grabbed next trip.
            this._equipWeapons(player);
            this._depositLoot(player);
            this._withdrawSharks(player);
            this._withdrawFood(player);
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

        // ── EAT ───────────────────────────────────────────────────────────────
        if (this.state === 'eat') {
            this._eatFood(player);
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

    /** Count an item across inventory + bank. */
    private _countAll(player: Player, id: number): number {
        let n = countItem(player, id);
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === id) n += it.count;
                }
            }
        }
        return n;
    }

    private _pickMode(player: Player): Mode | null {
        const hasBow = RangedBowsByLevel.some(t => this._countAll(player, t.itemId) > 0);
        const hasArrows = RangedArrowsByCost.some(a => this._countAll(player, a.itemId) > 0);
        const hasStaff = this._countAll(player, Items.STAFF_OF_AIR) > 0;
        // Any wind-line catalyst rune is enough to start — pickBestWindSpell()
        // will settle on the tier the bot can actually sustain.
        const hasCatalyst = WIND_SPELLS.some(t => this._countAll(player, t.catalystRune) > 0);

        const canDoMagic = hasStaff && hasCatalyst;
        const canDoRanged = hasBow && hasArrows;

        // 50/50 random chance when both are available
        if (canDoMagic && canDoRanged) {
            return Math.random() < 0.5 ? 'magic' : 'ranged';
        }
        if (canDoMagic) return 'magic';
        if (canDoRanged) return 'ranged';
        return null;
    }

    // ── Dynamic tier selection ────────────────────────────────────────────────

    /**
     * Recomputes the best sustainable spell (magic) or bow+arrow (ranged) tier
     * from the bot's current level and coin budget (inventory + bank). Called
     * whenever the bot banks/re-equips, so upgrades — or graceful downgrades,
     * e.g. running out of death runes and dropping back to chaos — happen
     * naturally over time instead of the tier being fixed forever.
     */
    private _refreshGearAndSpell(player: Player): void {
        const coins = this._totalCoins(player);

        if (this.mode === 'magic') {
            const magicLevel = getBaseLevel(player, PlayerStat.MAGIC);
            this.currentSpell = pickBestWindSpell(magicLevel, coins, runeId => this._countAll(player, runeId), Environment.NODE_MEMBERS);
        } else if (this.mode === 'ranged') {
            const rangedLevel = getBaseLevel(player, PlayerStat.RANGED);
            const bowTier = bestRangedBow(rangedLevel, id => this._countAll(player, id) > 0);
            this.currentBowId = bowTier.itemId;
            const arrowTier = bestAffordableArrow(coins, id => this._countAll(player, id));
            this.currentArrowId = arrowTier.itemId;
            this.currentArrowCost = arrowTier.cost;
        }
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
            // Equip the bow/arrow tier _refreshGearAndSpell() picked.
            if (!_wornContains(player, this.currentBowId) && hasItem(player, this.currentBowId)) {
                for (let slot = 0; slot < inv.capacity; slot++) {
                    const it = inv.get(slot);
                    if (it?.id === this.currentBowId) {
                        interactHeldOp(player, inv, it.id, slot, 2);
                        break;
                    }
                }
            }
            if (!_wornContains(player, this.currentArrowId) && hasItem(player, this.currentArrowId)) {
                for (let slot = 0; slot < inv.capacity; slot++) {
                    const it = inv.get(slot);
                    if (it?.id === this.currentArrowId) {
                        interactHeldOp(player, inv, it.id, slot, 2);
                        break;
                    }
                }
            }
        }
    }

    private _setAttackStyle(player: Player): void {
        if (this.mode === 'magic') {
            // Autocast whichever wind-line spell _refreshGearAndSpell() picked.
            setAutocastSpell(player, this.currentSpell.autocastVarp);
        } else {
            // Ranged: style 0 (accurate) → ranged XP
            setCombatStyle(player, 0);
        }
    }

    /**
     * True only if the weapon (and ammo/runes) needed for the current mode is
     * actually in hand, not just owned somewhere across inventory + bank.
     * _pickMode()/_refreshGearAndSpell() are ownership checks (inv+bank) — this
     * is the "can the bot swing right now" check that gates leaving check_equip.
     */
    private _isFullyEquipped(player: Player): boolean {
        if (this.mode === 'magic') {
            return _wornContains(player, Items.STAFF_OF_AIR) && countItem(player, this.currentSpell.catalystRune) > 0;
        }
        if (this.mode === 'ranged') {
            return _wornContains(player, this.currentBowId) && countItem(player, this.currentArrowId) > 0;
        }
        return false;
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
        return this._countAll(player, Items.COINS);
    }

    private _buildShopQueue(player: Player): ShopBuy[] {
        const queue: ShopBuy[] = [];
        const coins = this._totalCoins(player);

        // Staff of air (1 000gp) — always needed to unlock magic mode at all,
        // regardless of which wind spell tier ends up affordable.
        if (this._countAll(player, Items.STAFF_OF_AIR) === 0 && coins >= 1000) {
            queue.push({ shopKey: 'VARROCK_STAFFS', npcName: 'zaff', itemId: Items.STAFF_OF_AIR, qty: 1, cost: 1000, op: 3 });
        }

        // Bow — buy the tier bestRangedBow() picked, but only if it's actually
        // shop-sold (willow+ come from Fletching, never purchased here) and not
        // already owned.
        const rangedLevel = getBaseLevel(player, PlayerStat.RANGED);
        const bowTier = bestRangedBow(rangedLevel, id => this._countAll(player, id) > 0);
        const bowConfig = RangedBowsByLevel.find(t => t.itemId === bowTier.itemId);
        const bowCost = bowConfig?.shopKey ? Shops[bowConfig.shopKey]?.stock.find(s => s.itemId === bowTier.itemId)?.cost : undefined;
        if (bowConfig && bowConfig.shopKey && bowCost !== undefined && this._countAll(player, bowTier.itemId) === 0 && coins >= bowCost) {
            queue.push({ shopKey: bowConfig.shopKey as keyof typeof Locations, npcName: 'lowe', itemId: bowTier.itemId, qty: 1, cost: bowCost, op: 3 });
        }

        // Arrows — buy the coin-affordable tier bestAffordableArrow() picked.
        const arrowTier = bestAffordableArrow(coins, id => this._countAll(player, id));
        const arrowCount = countItem(player, arrowTier.itemId);
        if (arrowCount < ARROW_BUY_QTY && coins >= arrowTier.cost * (ARROW_BUY_QTY - arrowCount)) {
            queue.push({ shopKey: 'VARROCK_ARCHERY', npcName: 'lowe', itemId: arrowTier.itemId, qty: ARROW_BUY_QTY - arrowCount, cost: arrowTier.cost, op: 3 });
        }

        // Catalyst rune — buy the tier pickBestWindSpell() picked (mind/chaos/
        // death — never blood, that spell only activates if already owned).
        const magicLevel = getBaseLevel(player, PlayerStat.MAGIC);
        const spellTier = pickBestWindSpell(magicLevel, coins, runeId => this._countAll(player, runeId), Environment.NODE_MEMBERS);
        if (spellTier.catalystCost >= 0) {
            const runeCount = countItem(player, spellTier.catalystRune);
            if (runeCount < RUNE_BUY_QTY && coins >= spellTier.catalystCost * (RUNE_BUY_QTY - runeCount)) {
                queue.push({ shopKey: 'VARROCK_RUNES', npcName: 'aubury', itemId: spellTier.catalystRune, qty: RUNE_BUY_QTY - runeCount, cost: spellTier.catalystCost, op: 3 });
            }
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

        // Only the CURRENT tier's gear is protected from being banked — any
        // stale lower tier left over from before a level-up/coin windfall
        // (e.g. old bronze arrows once on iron, or mind runes once on chaos)
        // gets deposited normally instead of cluttering the inventory forever.
        // It isn't lost: still sitting in the bank if the bot ever needs to
        // drop back down a tier.
        const keep = new Set<number>([Items.COINS, Items.STAFF_OF_AIR, this.currentBowId, this.currentArrowId, this.currentSpell.catalystRune]);

        for (let slot = 0; slot < inv.capacity; slot++) {
            const it = inv.get(slot);
            if (!it || keep.has(it.id) || FOOD_IDS.includes(it.id)) continue;
            const moved = inv.remove(it.id, it.count);
            if (moved.completed > 0) bank.add(it.id, moved.completed);
        }
    }

    private _hasFood(player: Player): boolean {
        for (const id of FOOD_IDS) {
            if (hasItem(player, id)) return true;
        }
        return false;
    }

    private _eatFood(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) {
            this.state = 'walk';
            return;
        }

        for (const foodId of FOOD_IDS) {
            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item || item.id !== foodId) continue;

                interactHeldOp(player, inv, foodId, slot, 1);
                this._log(player, `ate ${foodId} to heal`, 'ate_food');
                this.cooldown = 3;

                const hp = player.stats[PlayerStat.HITPOINTS];
                const maxHp = player.baseLevels[PlayerStat.HITPOINTS];
                if (hp < maxHp * 0.8 && this._hasFood(player)) {
                    this.state = 'eat';
                } else {
                    this.state = 'walk';
                }
                return;
            }
        }

        // Out of food
        this.state = 'walk';
    }

    /** Top up inventory with cooked sharks from the bank (up to COMBAT_SHARKS). */
    private _withdrawSharks(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        const current = countItem(player, Items.SHARK);
        const needed = COMBAT_SHARKS - current;
        if (needed <= 0) return;

        for (let i = 0; i < bank.capacity; i++) {
            const it = bank.get(i);
            if (!it || it.id !== Items.SHARK) continue;
            const amount = Math.min(needed, it.count);
            const moved = bank.remove(Items.SHARK, amount);
            if (moved.completed > 0) inv.add(Items.SHARK, moved.completed);
            break;
        }
    }

    /** Fallback food (any FOOD_IDS type) if the bank has no sharks. */
    private _withdrawFood(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        let currentFoodCount = 0;
        for (const foodId of FOOD_IDS) {
            currentFoodCount += countItem(player, foodId);
        }
        if (currentFoodCount >= 5) return;

        const toWithdraw = 8 - currentFoodCount;
        let withdrawn = 0;

        for (const foodId of FOOD_IDS) {
            if (withdrawn >= toWithdraw) break;
            for (let i = 0; i < bank.capacity; i++) {
                const it = bank.get(i);
                if (it && it.id === foodId) {
                    const amount = Math.min(toWithdraw - withdrawn, it.count);
                    const moved = bank.remove(foodId, amount);
                    if (moved.completed > 0) {
                        inv.add(foodId, moved.completed);
                        withdrawn += moved.completed;
                    }
                    break;
                }
            }
        }
    }

    /** Withdraws a single non-stackable item (bow, staff) from the bank into inventory, if not already held. */
    private _withdrawSingle(player: Player, bank: Inventory, inv: Inventory, itemId: number): void {
        if (hasItem(player, itemId)) return;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === itemId) {
                const moved = bank.remove(itemId, 1);
                if (moved.completed > 0) inv.add(itemId, moved.completed);
                break;
            }
        }
    }

    private _withdrawAmmo(player: Player): void {
        if (!this.mode) return;
        const bid = bankInvId();
        if (bid === -1) return;
        const inv = player.getInventory(InvType.INV);
        const bank = player.getInventory(bid);
        if (!inv || !bank) return;

        // The weapon itself is checked independent of ammo/rune supply — a bot
        // that already has 500 arrows but no bow (e.g. after a fresh tier
        // upgrade banked the old bow) must still get the bow withdrawn here,
        // not skipped because "ammo is fine".
        if (this.mode === 'ranged') {
            this._withdrawSingle(player, bank, inv, this.currentBowId);
        } else {
            this._withdrawSingle(player, bank, inv, Items.STAFF_OF_AIR);
        }

        // Withdraw the current tier's arrows or catalyst runes from the bank.
        const target = this.mode === 'ranged' ? this.currentArrowId : this.currentSpell.catalystRune;
        const inInv = countItem(player, target);
        if (inInv >= ARROW_BUY_QTY) return; // already have plenty

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

/**
 * BotTask.ts
 *
 * All tasks use real engine interactions — no teleporting.
 *
 * Movement:   walkTo()       — real pathfinder, real collision
 * Shops:      interactNpcOp(npc, 3)  — op3 = Trade on all shop NPCs
 * Banking:    interactNpcOp(npc, 3)  — op3 = Bank on banker NPCs,
 *             then directly move items into bank inventory
 * Woodcut:    interactLoc(tree)      — op1 = Chop down
 * Mining:     interactLoc(rock)      — op1 = Mine
 * Fishing:    interactNpc(spot)      — op1 = Net/Lure/Cage
 *             interactNpcOp(spot,3)  — op3 = Bait/Harpoon
 * Combat:     interactNpcOp(npc, 2)  — op2 = Attack
 *
 * Cooking and Firemaking are stubbed — they require "use item on item/loc"
 * which maps to opheldu/oplocu and will be wired up separately.
 *
 * Task state machine per task:
 *   'walk'     → walking to area
 *   'scan'     → looking for target (tree/rock/npc)
 *   'interact' → interaction queued, waiting for engine
 *   'bank'     → banking trip in progress
 *   'done'     → task complete (one-shot tasks only)
 */

import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';
import InvType from '#/cache/config/InvType.js';
import { Inventory } from '#/engine/Inventory.js';

import {
    PlayerStat,
    walkTo, isNear, hasWaypoints,
    interactNpc, interactNpcOp, interactLoc,
    findNpcNear, findNpcByName, findNpcByPrefix, findNpcBySuffix,
    findLocNear, findLocByName, findLocByPrefix,
    getBaseLevel, hasItem, isInventoryFull, freeSlots,
    countItem, addItem, removeItem, clearBackpack,
} from '#/engine/bot/BotAction.js';

import {
    Items, Locations, Shops, SkillStep, getProgressionStep,
} from '#/engine/bot/BotKnowledge.js';
import { getMissingPurchases, STARTING_COINS } from '#/engine/bot/BotNeeds.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(prob: number): boolean { return Math.random() < prob; }

// How many ticks between re-issuing an interaction if we're already doing it
const REINTERACT_TICKS = 5;
// Max ticks we'll wait for an interaction to produce XP before giving up
const INTERACT_TIMEOUT = 20;

// Helper: lazily resolve bank inv ID (InvType must be loaded first)
function bankInvId(): number {
    const id = InvType.getId('bank');
    return id !== -1 ? id : 95; // 95 = bank from pack/inv.pack, fallback if not loaded
}

// ── Abstract base ─────────────────────────────────────────────────────────────

export abstract class BotTask {
    readonly name: string;
    interrupted = false;
    protected cooldown = 0;

    constructor(name: string) { this.name = name; }

    abstract shouldRun(player: Player): boolean;
    abstract tick(player: Player): void;
    abstract isComplete(player: Player): boolean;

    interrupt(): void { this.interrupted = true; }
    reset(): void     { this.interrupted = false; this.cooldown = 0; }
}

// ── InitTask — first spawn ────────────────────────────────────────────────────

export class InitTask extends BotTask {
    private done = false;
    private readonly starterItems: number[];

    /**
     * @param starterItems Item IDs to grant at spawn (e.g. bronze axe, bronze sword).
     *   These replace shop trips for basic tools so bots can skill immediately.
     *   Provided by BotGoalPlanner._starterItems() based on personality.
     */
    constructor(starterItems: number[] = []) {
        super('Init');
        this.starterItems = starterItems;
    }

    shouldRun(_p: Player): boolean { return !this.done; }

    tick(player: Player): void {
        addItem(player, Items.COINS, STARTING_COINS);
        // Grant starter tools/weapons so bot can skill from tick 1
        // without walking to distant shops
        for (const itemId of this.starterItems) {
            if (!hasItem(player, itemId)) {
                addItem(player, itemId, 1);
            }
        }
        this.done = true;
    }

    isComplete(_p: Player): boolean { return this.done; }
    override reset(): void { super.reset(); this.done = false; }
}

// ── WalkTask — travel to a destination ───────────────────────────────────────
// Used as a precursor task before skill tasks that need to be in a specific area.

export class WalkTask extends BotTask {
    private readonly destX: number;
    private readonly destZ: number;
    private readonly level: number;
    private readonly arrivalDist: number;
    private started = false;

    constructor(x: number, z: number, level = 0, arrivalDist = 5) {
        super('Walk');
        this.destX       = x;
        this.destZ       = z;
        this.level       = level;
        this.arrivalDist = arrivalDist;
    }

    shouldRun(player: Player): boolean {
        return !isNear(player, this.destX, this.destZ, this.arrivalDist, this.level);
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (!this.started || !hasWaypoints(player)) {
            walkTo(player, this.destX, this.destZ);
            this.started = true;
        }
    }

    isComplete(player: Player): boolean {
        return isNear(player, this.destX, this.destZ, this.arrivalDist, this.level);
    }

    override reset(): void { super.reset(); this.started = false; }
}

// ── BankTask — walk to banker, open bank, deposit everything ─────────────────

export class BankTask extends BotTask {
    private state: 'walk' | 'find' | 'interact' | 'deposit' | 'done' = 'walk';
    private readonly bankCoord: [number, number, number];
    private readonly keepItems: number[];   // item IDs to keep (tools)
    private waitTicks = 0;

    constructor(
        bankCoord: [number, number, number] = Locations.DRAYNOR_BANK,
        keepItems: number[] = []
    ) {
        super('Bank');
        this.bankCoord = bankCoord;
        this.keepItems = keepItems;
    }

    shouldRun(_p: Player): boolean { return this.state !== 'done'; }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        const [bx, bz, bl] = this.bankCoord;

        if (this.state === 'walk') {
            if (!isNear(player, bx, bz, 8, bl)) {
                walkTo(player, bx, bz);
                return;
            }
            this.state = 'find';
            return;
        }

        if (this.state === 'find') {
            // Look for a banker NPC in range
            const banker = findNpcByPrefix(player.x, player.z, player.level, 'banker', 8)
                        ?? findNpcByPrefix(player.x, player.z, player.level, 'kharidbanker', 8);
            if (!banker) {
                // Keep walking closer
                walkTo(player, bx, bz);
                return;
            }
            interactNpcOp(player, banker, 3); // op3 = Bank
            this.state    = 'interact';
            this.waitTicks = 0;
            return;
        }

        if (this.state === 'interact') {
            this.waitTicks++;
            // After a few ticks the bank script runs and opens the bank interface
            // For headless bots the interface doesn't render but the bank inv is accessible
            if (this.waitTicks >= 3) {
                this.state = 'deposit';
            }
            return;
        }

        if (this.state === 'deposit') {
            this._deposit(player);
            this.state = 'done';
        }
    }

    isComplete(_p: Player): boolean { return this.state === 'done'; }

    override reset(): void {
        super.reset();
        this.state     = 'walk';
        this.waitTicks = 0;
    }

    private _deposit(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        // Move everything except kept tools into the bank
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (this.keepItems.includes(item.id)) continue;
            // Move to bank
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
            }
        }
    }
}

// ── ShopTripTask — walk to a shop NPC and buy a specific item ─────────────────

export class ShopTripTask extends BotTask {
    private readonly shopKey:  string;
    private readonly itemId:   number;
    private readonly quantity: number;
    private readonly costEach: number;
    private readonly npcName:  string;
    private state: 'walk' | 'find' | 'interact' | 'buy' | 'done' | 'abort' = 'walk';
    private waitTicks  = 0;
    private stuckTicks = 0;  // ticks spent at same position
    private lastX      = -1;
    private lastZ      = -1;

    // Map shop key → NPC debug name
    private static NPC_NAMES: Record<string, string> = {
        BOB_AXES:            'bob',
        GERRANTS_FISHING:    'gerrant',
        VARROCK_SWORDS:      'swordshop1',
        VARROCK_ARCHERY:     'lowe',
        VARROCK_RUNES:       'aubury',
        AL_KHARID_SCIMITARS: 'zeke',
        LUMBRIDGE_GENERAL:   'generalshopkeeper1',
    };

    constructor(shopKey: string, itemId: number, quantity: number, costEach: number) {
        super('ShopTrip');
        this.shopKey  = shopKey;
        this.itemId   = itemId;
        this.quantity = quantity;
        this.costEach = costEach;
        this.npcName  = ShopTripTask.NPC_NAMES[shopKey] ?? shopKey;
    }

    shouldRun(player: Player): boolean {
        if (this.state === 'abort') return false;
        // Abort immediately if we can no longer afford even 1 item
        if (countItem(player, Items.COINS) < this.costEach) {
            this.state = 'abort';
            return false;
        }
        return !this.isComplete(player);
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        const shop = Shops[this.shopKey];
        if (!shop) { this.state = 'done'; return; }
        const [sx, sz, sl] = shop.location;

        if (this.state === 'walk') {
            if (!isNear(player, sx, sz, 8, sl)) {
                // Stuck detection: if position unchanged for 10 ticks, jitter destination
                if (player.x === this.lastX && player.z === this.lastZ) {
                    this.stuckTicks++;
                    if (this.stuckTicks >= 10) {
                        // Try random offset around destination to route around obstacle
                        walkTo(player, sx + randInt(-5, 5), sz + randInt(-5, 5));
                        this.stuckTicks = 0;
                        return;
                    }
                } else {
                    this.stuckTicks = 0;
                }
                this.lastX = player.x;
                this.lastZ = player.z;
                walkTo(player, sx, sz);
                return;
            }
            this.state = 'find';
            return;
        }

        if (this.state === 'find') {
            const npc = findNpcByName(player.x, player.z, player.level, this.npcName, 10);
            if (!npc) {
                walkTo(player, sx, sz);
                return;
            }
            interactNpcOp(player, npc, 3); // op3 = Trade on all shops
            this.state     = 'interact';
            this.waitTicks = 0;
            return;
        }

        if (this.state === 'interact') {
            this.waitTicks++;
            if (this.waitTicks >= 3) {
                this.state = 'buy';
            }
            return;
        }

        if (this.state === 'buy') {
            const bought = this._buy(player);
            // If we couldn't buy anything (lost coins in transit), abort cleanly
            this.state = bought > 0 ? 'done' : 'abort';
        }
    }

    isComplete(_p: Player): boolean { return this.state === 'done'; }

    override reset(): void {
        super.reset();
        this.state      = 'walk';
        this.waitTicks  = 0;
        this.stuckTicks = 0;
        this.lastX      = -1;
        this.lastZ      = -1;
    }

    private _buy(player: Player): number {
        const coins    = countItem(player, Items.COINS);
        const canBuy   = Math.min(this.quantity, Math.floor(coins / this.costEach));
        if (canBuy <= 0) return 0;
        removeItem(player, Items.COINS, canBuy * this.costEach);
        addItem(player, this.itemId, canBuy);
        return canBuy;
    }
}

// ── SkillTask — woodcutting, mining, fishing via real loc/npc interactions ────

export class SkillTask extends BotTask {
    private readonly step:    SkillStep;
    private readonly stat:    PlayerStat;

    // State machine
    private state: 'walk' | 'scan' | 'interact' | 'bank_walk' | 'bank_done' = 'walk';
    private interactTicks  = 0;   // ticks since last interaction issued
    private lastXp         = 0;   // detect XP gain to know engine processed our click
    private scanFailTicks  = 0;   // how long we've been unable to find a target
    private walkStuckTicks = 0;   // stuck detection for walk state
    private walkLastX      = -1;
    private walkLastZ      = -1;

    constructor(step: SkillStep, stat: PlayerStat) {
        super(step.action.charAt(0).toUpperCase() + step.action.slice(1));
        this.step = step;
        this.stat = stat;
    }

    shouldRun(player: Player): boolean {
        // Need all tools in inventory
        return this.step.toolItemIds.every(id => hasItem(player, id));
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        // ── Banking ───────────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const [bx, bz] = Locations.DRAYNOR_BANK;
            if (!isNear(player, bx, bz, 8)) {
                walkTo(player, bx, bz);
                return;
            }
            // Find banker and bank
            const banker = findNpcByPrefix(player.x, player.z, player.level, 'banker', 10);
            if (!banker) { walkTo(player, bx, bz); return; }

            interactNpcOp(player, banker, 3);
            this.cooldown = 4; // wait for bank to open
            this.state    = 'bank_done';
            return;
        }

        if (this.state === 'bank_done') {
            // Deposit everything, keeping tools
            this._depositKeepingTools(player);
            // Re-stock consumables (feathers, bait)
            if (this.step.itemConsumed && this.step.itemConsumed !== -1) {
                const bid = bankInvId();
                if (bid !== -1) {
                    const bank = player.getInventory(bid);
                    const inv  = player.getInventory(InvType.INV);
                    if (bank && inv) {
                        const need = 200;
                        const have = countItem(player, this.step.itemConsumed);
                        const pull = Math.min(need - have, bank.getItemCount(this.step.itemConsumed));
                        if (pull > 0) {
                            bank.remove(this.step.itemConsumed, pull);
                            inv.add(this.step.itemConsumed, pull);
                        }
                    }
                }
            }
            this.state    = 'walk';
            this.cooldown = 3;
            return;
        }

        // ── Bank if full ──────────────────────────────────────────────────────
        if (isInventoryFull(player)) {
            this.state = 'bank_walk';
            return;
        }

        // ── Walk to skill area ────────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;
            if (!isNear(player, lx, lz, 15, ll)) {
                // Stuck detection: if position unchanged for 10 ticks, jitter destination
                if (player.x === this.walkLastX && player.z === this.walkLastZ) {
                    this.walkStuckTicks++;
                    if (this.walkStuckTicks >= 10) {
                        const ddx = lx - player.x;
                        const ddz = lz - player.z;
                        const perpX = player.x + (Math.abs(ddz) > Math.abs(ddx) ? randInt(-8, 8) : (ddz > 0 ? 8 : -8));
                        const perpZ = player.z + (Math.abs(ddx) > Math.abs(ddz) ? randInt(-8, 8) : (ddx > 0 ? 8 : -8));
                        walkTo(player, perpX, perpZ);
                        this.walkStuckTicks = 0;
                    }
                } else {
                    this.walkStuckTicks = 0;
                }
                this.walkLastX = player.x;
                this.walkLastZ = player.z;
                walkTo(player, lx, lz);
                return;
            }
            this.state = 'scan';
            return;
        }

        // ── Scan for target ───────────────────────────────────────────────────
        if (this.state === 'scan') {
            const target = this._findTarget(player);

            if (!target) {
                this.scanFailTicks++;
                // If we can't find a target for a while, re-walk into the area
                if (this.scanFailTicks > 10) {
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-3, 3), lz + randInt(-3, 3));
                    this.scanFailTicks = 0;
                }
                return;
            }

            this.scanFailTicks = 0;
            this._interact(player, target);
            this.state        = 'interact';
            this.interactTicks = 0;
            this.lastXp        = player.stats[this.stat];
            return;
        }

        // ── Waiting for interaction to fire ───────────────────────────────────
        if (this.state === 'interact') {
            this.interactTicks++;

            // XP received = engine processed the interaction successfully
            if (player.stats[this.stat] > this.lastXp) {
                this.lastXp = player.stats[this.stat];
                // Stay in interact state — the engine re-fires the script
                // (woodcutting/mining/fishing all loop via p_opnpc/p_oploc calls)
                this.interactTicks = 0;
                return;
            }

            // Timeout — target may have depleted (tree fell, rock mined out, fish moved)
            if (this.interactTicks >= INTERACT_TIMEOUT) {
                this.state = 'scan'; // find a new target
                return;
            }

            // Also check: if we ran out of consumables mid-fishing
            if (this.step.itemConsumed && this.step.itemConsumed !== -1) {
                if (!hasItem(player, this.step.itemConsumed)) {
                    this.state = 'bank_walk'; // go restock
                    return;
                }
            }
        }
    }

    isComplete(_p: Player): boolean { return false; } // GoalPlanner decides

    override reset(): void {
        super.reset();
        this.state          = 'walk';
        this.interactTicks  = 0;
        this.scanFailTicks  = 0;
        this.lastXp         = 0;
        this.walkStuckTicks = 0;
        this.walkLastX      = -1;
        this.walkLastZ      = -1;
    }

    // ── Find the right target based on skill action ───────────────────────────

    private _findTarget(player: Player): Npc | Loc | null {
        const [cx, cz, cl] = this.step.location;

        switch (this.step.action) {
            case 'woodcut': return this._findTree(player);
            case 'mine':    return this._findRock(cx, cz, cl);
            case 'fish':    return this._findFishSpot(player);
            default:        return null;
        }
    }

    private _findTree(player: Player): Loc | null {
        // Find nearest tree of the right type
        const tool = this.step.toolItemIds[0]; // axe
        const prefix = this._treeLocPrefix();
        return findLocByPrefix(player.x, player.z, player.level, prefix, 15);
    }

    private _treeLocPrefix(): string {
        const item = this.step.itemGained;
        if (item === Items.LOGS)         return 'tree';
        if (item === Items.OAK_LOGS)     return 'oaktree';
        if (item === Items.WILLOW_LOGS)  return 'willow_tree';
        if (item === Items.MAPLE_LOGS)   return 'maple_tree';
        if (item === Items.YEW_LOGS)     return 'yew_tree';
        return 'tree';
    }

    private _findRock(cx: number, cz: number, cl: number): Loc | null {
        const ore = this.step.itemGained;
        let prefix = 'copperrock';
        if (ore === Items.TIN_ORE)        prefix = 'tinrock';
        else if (ore === Items.IRON_ORE)  prefix = 'ironrock';
        else if (ore === Items.COAL)      prefix = 'coalrock';
        else if (ore === Items.MITHRIL_ORE) prefix = 'mithrilrock';
        return findLocByPrefix(cx, cz, cl, prefix, 15);
    }

    private _findFishSpot(player: Player): Npc | null {
        const item = this.step.itemGained;
        // Shrimp/sardine/lobster/swordfish → saltfish spot  (op1=Net/Cage, op3=Bait/Harpoon)
        // Trout/salmon                     → freshfish spot (op1=Lure,     op3=Bait)
        const suffix = (
            item === Items.RAW_TROUT || item === Items.RAW_SALMON
        ) ? '_freshfish' : '_saltfish';
        return findNpcBySuffix(player.x, player.z, player.level, suffix, 20);
    }

    // ── Issue the correct interaction ─────────────────────────────────────────

    private _interact(player: Player, target: Npc | Loc): void {
        if (target instanceof Loc) {
            interactLoc(player, target); // op1 = Chop/Mine
            return;
        }

        // NPC (fishing spot) — pick op based on method
        const item = this.step.itemGained;
        if (item === Items.RAW_SHRIMP || item === Items.RAW_LOBSTER) {
            interactNpc(player, target); // op1 = Net / Cage
        } else if (item === Items.RAW_SARDINE) {
            interactNpcOp(player, target, 3); // op3 = Bait rod
        } else if (item === Items.RAW_TROUT || item === Items.RAW_SALMON) {
            interactNpc(player, target); // op1 = Lure (fly rod)
        } else if (item === Items.RAW_SWORDFISH) {
            interactNpcOp(player, target, 3); // op3 = Harpoon
        } else {
            interactNpc(player, target); // default op1
        }
    }

    private _depositKeepingTools(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (this.step.toolItemIds.includes(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
    }
}

// ── CombatTask — walk to spawn, find NPC, op2=Attack ─────────────────────────

export class CombatTask extends BotTask {
    private readonly step:    SkillStep;
    private readonly stat:    PlayerStat;
    private state: 'walk' | 'scan' | 'interact' | 'bank_walk' | 'bank_done' = 'walk';
    private interactTicks = 0;
    private lastXp        = 0;
    private scanFail      = 0;

    constructor(step: SkillStep, stat: PlayerStat) {
        super('Combat');
        this.step = step;
        this.stat = stat;
    }

    shouldRun(player: Player): boolean {
        return this.step.toolItemIds.every(id => hasItem(player, id));
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        if (this.state === 'bank_walk') {
            const [bx, bz] = Locations.DRAYNOR_BANK;
            if (!isNear(player, bx, bz, 8)) { walkTo(player, bx, bz); return; }
            const banker = findNpcByPrefix(player.x, player.z, player.level, 'banker', 10);
            if (!banker) { walkTo(player, bx, bz); return; }
            interactNpcOp(player, banker, 3);
            this.cooldown = 4;
            this.state    = 'bank_done';
            return;
        }

        if (this.state === 'bank_done') {
            // Deposit everything except weapon
            const inv = player.getInventory(InvType.INV);
            const bid = bankInvId();
            if (inv && bid !== -1) {
                const bank = player.getInventory(bid);
                if (bank) {
                    for (let slot = 0; slot < inv.capacity; slot++) {
                        const item = inv.get(slot);
                        if (!item) continue;
                        if (this.step.toolItemIds.includes(item.id)) continue;
                        if (item.id === Items.COINS) continue;
                        const moved = inv.remove(item.id, item.count);
                        if (moved.completed > 0) bank.add(item.id, moved.completed);
                    }
                }
            }
            this.state    = 'walk';
            this.cooldown = 3;
            return;
        }

        if (freeSlots(player) < 3) {
            this.state = 'bank_walk';
            return;
        }

        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;
            if (!isNear(player, lx, lz, 12, ll)) {
                walkTo(player, lx, lz);
                return;
            }
            this.state = 'scan';
            return;
        }

        if (this.state === 'scan') {
            const npcType = (this.step.extra?.npcType as string) ?? 'cow';
            const npc = findNpcByName(player.x, player.z, player.level, npcType, 15);
            if (!npc) {
                this.scanFail++;
                if (this.scanFail > 8) {
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-4, 4), lz + randInt(-4, 4));
                    this.scanFail = 0;
                }
                return;
            }
            this.scanFail      = 0;
            interactNpcOp(player, npc, 2); // op2 = Attack on combat NPCs
            this.state         = 'interact';
            this.interactTicks = 0;
            this.lastXp        = player.stats[this.stat];
            return;
        }

        if (this.state === 'interact') {
            this.interactTicks++;

            if (player.stats[this.stat] > this.lastXp) {
                this.lastXp        = player.stats[this.stat];
                this.interactTicks = 0;
                return;
            }

            if (this.interactTicks >= INTERACT_TIMEOUT * 2) {
                // NPC may be dead — scan for next one
                this.state = 'scan';
            }
        }
    }

    isComplete(_p: Player): boolean { return false; }

    override reset(): void {
        super.reset();
        this.state         = 'walk';
        this.interactTicks = 0;
        this.scanFail      = 0;
        this.lastXp        = 0;
    }
}

// ── BuryBonesTask — use bones from inventory for prayer XP ───────────────────
// Bones bury via inventory, no interaction needed — just remove from inv and grant XP.
// Real RS triggers [opheldu,bones] which is "use item" — for bots we simulate the outcome.

export class BuryBonesTask extends BotTask {
    constructor() { super('Prayer'); }

    shouldRun(player: Player): boolean {
        return hasItem(player, Items.BONES) || hasItem(player, Items.BIG_BONES);
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        if (hasItem(player, Items.BIG_BONES)) {
            removeItem(player, Items.BIG_BONES, 1);
            player.addXp(PlayerStat.PRAYER, 150); // 15.0 xp
        } else if (hasItem(player, Items.BONES)) {
            removeItem(player, Items.BONES, 1);
            player.addXp(PlayerStat.PRAYER, 45);  // 4.5 xp
        }
        this.cooldown = 3;
    }

    isComplete(player: Player): boolean {
        return !hasItem(player, Items.BONES) && !hasItem(player, Items.BIG_BONES);
    }
}

// ── IdleTask ──────────────────────────────────────────────────────────────────

export class IdleTask extends BotTask {
    private readonly ticks: number;
    private elapsed = 0;
    constructor(ticks: number) { super('Idle'); this.ticks = ticks; }
    shouldRun(_p: Player): boolean  { return this.elapsed < this.ticks; }
    tick(_p: Player): void          { this.elapsed++; }
    isComplete(_p: Player): boolean { return this.elapsed >= this.ticks; }
    override reset(): void { super.reset(); this.elapsed = 0; }
}
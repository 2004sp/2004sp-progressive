/**
 * UtilTasks.ts — InitTask, WalkTask, BankTask, BuryBonesTask, IdleTask, SellTask
 */

import {
    BotTask, Player, InvType,
    walkTo, interactNpcOp, findNpcByPrefix, findNpcByName, isNear,
    hasItem, addItem, removeItem,
    Items, Locations, STARTING_COINS,
    teleportToSafety, teleportNear, randInt, bankInvId, StuckDetector,
    openNearbyGate, advanceBankWalk,
    PlayerStat, FOOD_IDS,
    countItem,
} from '#/engine/bot/tasks/BotTaskBase.js';
import { GRIMY_HERB_MAP } from '#/engine/bot/BotKnowledge.js';

// ── InitTask ──────────────────────────────────────────────────────────────────

export class InitTask extends BotTask {
    private done = false;
    private readonly starterItems: number[];

    constructor(starterItems: number[] = []) {
        super('Init');
        this.starterItems = starterItems;
    }

    shouldRun(_p: Player): boolean { return !this.done; }

    tick(player: Player): void {
        addItem(player, Items.COINS, STARTING_COINS);
        for (const id of this.starterItems) {
            if (!hasItem(player, id)) addItem(player, id, 1);
        }

        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                const BANK_SEED: [number, number][] = [
                    // Scimitars (iron → rune)
                    [Items.IRON_SCIMITAR,      1],
                    [Items.STEEL_SCIMITAR,     1],
                    [Items.BLACK_SCIMITAR,     1],
                    [Items.MITHRIL_SCIMITAR,   1],
                    [Items.ADAMANT_SCIMITAR,   1],
                    [Items.RUNE_SCIMITAR,      1],
                    // Iron armor set
                    [Items.IRON_FULL_HELM,     1],
                    [Items.IRON_PLATEBODY,     1],
                    [Items.IRON_PLATELEGS,     1],
                    [Items.IRON_KITESHIELD,    1],
                    // Steel armor set
                    [Items.STEEL_FULL_HELM,    1],
                    [Items.STEEL_PLATEBODY,    1],
                    [Items.STEEL_PLATELEGS,    1],
                    [Items.STEEL_KITESHIELD,   1],
                    // Black armor set
                    [Items.BLACK_FULL_HELM,    1],
                    [Items.BLACK_PLATEBODY,    1],
                    [Items.BLACK_PLATELEGS,    1],
                    [Items.BLACK_KITESHIELD,   1],
                    // Mithril armor set
                    [Items.MITHRIL_FULL_HELM,  1],
                    [Items.MITHRIL_PLATEBODY,  1],
                    [Items.MITHRIL_PLATELEGS,  1],
                    [Items.MITHRIL_KITESHIELD, 1],
                    // Adamant armor set
                    [Items.ADAMANT_FULL_HELM,  1],
                    [Items.ADAMANT_PLATEBODY,  1],
                    [Items.ADAMANT_PLATELEGS,  1],
                    [Items.ADAMANT_KITESHIELD, 1],
                    // Rune armor set
                    [Items.RUNE_FULL_HELM,     1],
                    [Items.RUNE_PLATEBODY,     1],
                    [Items.RUNE_PLATELEGS,     1],
                    [Items.RUNE_KITESHIELD,    1],
                    // Food supply
                    [Items.SHARK,              999999999],
                ];
                for (const [itemId, count] of BANK_SEED) {
                    let found = false;
                    for (let i = 0; i < bank.capacity; i++) {
                        if (bank.get(i)?.id === itemId) { found = true; break; }
                    }
                    if (!found) bank.add(itemId, count);
                }
            }
        }

        this.done = true;
    }

    isComplete(_p: Player): boolean { return this.done; }
    override reset(): void { super.reset(); this.done = false; }
}

// ── WalkTask ──────────────────────────────────────────────────────────────────

export class WalkTask extends BotTask {
    private readonly destX: number;
    private readonly destZ: number;
    private readonly level: number;
    private readonly arrivalDist: number;
    private readonly stuck = new StuckDetector(30, 4, 2);

    constructor(x: number, z: number, level = 0, arrivalDist = 3) {
        super('Walk');
        this.destX = x;
        this.destZ = z;
        this.level = level;
        this.arrivalDist = arrivalDist;
    }

    shouldRun(player: Player): boolean {
        return !isNear(player, this.destX, this.destZ, this.arrivalDist, this.level);
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        if (this.stuck.check(player, this.destX, this.destZ)) {
            if (this.stuck.desperatelyStuck) {
                teleportNear(player, this.destX, this.destZ);
                this.stuck.reset();
                return;
            }
            if (openNearbyGate(player, 5)) return;
            const dx = this.destX - player.x, dz = this.destZ - player.z;
            // Clear existing (bad) waypoints so the hasWaypoints guard in
            // walkTo() doesn't block the detour recalculation.
            player.clearWaypoints();
            walkTo(
                player,
                player.x + (Math.abs(dz) > Math.abs(dx) ? randInt(-10, 10) : (dz > 0 ? 10 : -10)),
                player.z + (Math.abs(dx) > Math.abs(dz) ? randInt(-10, 10) : (dx > 0 ? 10 : -10)),
            );
            return;
        }

        walkTo(player, this.destX, this.destZ);
    }

    isComplete(player: Player): boolean {
        return isNear(player, this.destX, this.destZ, this.arrivalDist, this.level);
    }

    override reset(): void { super.reset(); this.stuck.reset(); }
}

// ── BankTask ──────────────────────────────────────────────────────────────────

export class BankTask extends BotTask {
    private state: 'walk' | 'deposit' | 'done' = 'walk';
    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly keepItems: number[];

    constructor(keepItems: number[] = []) {
        super('Bank');
        this.keepItems = keepItems;
    }

    shouldRun(_p: Player): boolean { return this.state !== 'done'; }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        if (this.state === 'walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            // 'ready' = interaction queued (booth op2 or banker op3); wait 3 ticks
            // 'direct' = no entity found — deposit directly (inventory APIs work without open UI)
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'deposit';
            return;
        }

        if (this.state === 'deposit') {
            this._deposit(player);
            this.state = 'done';
            this.cooldown = 2;
        }
    }

    isComplete(_p: Player): boolean { return this.state === 'done'; }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.stuck.reset();
    }

    private _deposit(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (this.keepItems.includes(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
        this._withdrawFood(player);
    }

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
}

// ── BuryBonesTask ─────────────────────────────────────────────────────────────

export class BuryBonesTask extends BotTask {
    private buryCount = 0;

    private state: 'bury' | 'done' = 'bury';

    constructor() {
        super('Prayer');
    }

    shouldRun(player: Player): boolean {
        return hasItem(player, Items.BONES) ||
               hasItem(player, Items.BIG_BONES);
    }

    tick(player: Player): void {
        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ───────────────── BURY ─────────────────
        if (this.state === 'bury') {

            const before = player.stats[PlayerStat.PRAYER];

            // ── BIG BONES FIRST ─────────────────
            if (hasItem(player, Items.BIG_BONES)) {
                const removed = removeItem(player, Items.BIG_BONES, 1);

                if (!removed) {
                    console.log(`[Prayer] ❌ failed to remove BIG_BONES`);
                    return;
                }

                player.stats[PlayerStat.PRAYER] = before + 150;
                this.buryCount++;

                console.log(
                    `[Prayer] 🦴 buried BIG BONES +150 XP (total=${player.stats[PlayerStat.PRAYER]})`
                );

                this.cooldown = randInt(2, 4);
                return;
            }

            // ── NORMAL BONES ─────────────────
            if (hasItem(player, Items.BONES)) {
                const removed = removeItem(player, Items.BONES, 1);

                if (!removed) {
                    console.log(`[Prayer] ❌ failed to remove BONES`);
                    return;
                }

                player.stats[PlayerStat.PRAYER] = before + 45;
                this.buryCount++;

                console.log(
                    `[Prayer] 🦴 buried bones +45 XP (total=${player.stats[PlayerStat.PRAYER]})`
                );

                this.cooldown = randInt(2, 4);
                return;
            }

            // ── DONE ─────────────────
            console.log(`[Prayer] ✅ finished burying (${this.buryCount} bones)`);
            this.state = 'done';
            return;
        }
    }

    isComplete(_player: Player): boolean {
        return this.state === 'done';
    }

    override reset(): void {
        super.reset();
        this.buryCount = 0;
        this.state = 'bury';
    }
}

// ── IdleTask ──────────────────────────────────────────────────────────────────

export class IdleTask extends BotTask {
    private readonly ticks: number;
    private elapsed = 0;

    constructor(ticks = 10) {
        super('Idle');
        this.ticks = ticks;
    }

    shouldRun(_p: Player): boolean { return this.elapsed < this.ticks; }
    tick(_p: Player): void { this.elapsed++; }
    isComplete(_p: Player): boolean { return this.elapsed >= this.ticks; }
    override reset(): void { super.reset(); this.elapsed = 0; }
}

// ── SellTask — sell resources at Lumbridge General Store ──────────────────────

// Items never sold at shops — always banked.
const BANK_ONLY_IDS: ReadonlySet<number> = new Set([
    ...Object.keys(GRIMY_HERB_MAP).map(Number),          // grimy herbs
    ...Object.values(GRIMY_HERB_MAP).map(([id]) => id),  // clean herbs
    Items.AIR_TALISMAN,                                   // talismans
]);

const SELL_PRICES: Record<number, number> = {
    [Items.LOGS]:        3,
    [Items.OAK_LOGS]:    6,
    [Items.WILLOW_LOGS]: 14,
    [Items.COPPER_ORE]:  4,
    [Items.TIN_ORE]:     4,
    [Items.IRON_ORE]:    9,
    [Items.COAL]:        22,
    [Items.RAW_SHRIMP]:  3,
    [Items.RAW_SARDINE]: 4,
    [Items.RAW_TROUT]:   9,
    [Items.RAW_SALMON]:  14,
    [Items.BONES]:       2,
    [Items.BIG_BONES]:   5,
};

export class SellTask extends BotTask {
    private state: 'walk' | 'find' | 'sell' | 'done' = 'walk';
    private findFailTicks = 0;
    private readonly keepItems: number[];
    private readonly stuck = new StuckDetector(30, 4, 2);

    constructor(keepItems: number[] = []) {
        super('Sell');
        this.keepItems = keepItems;
    }

    shouldRun(_p: Player): boolean { return this.state !== 'done'; }

    tick(player: Player): void {
        if (this.interrupted) return;
        if (this.cooldown > 0) { this.cooldown--; return; }

        const [sx, sz, sl] = Locations.LUMBRIDGE_GENERAL;

        if (this.state === 'walk') {
            if (!isNear(player, sx, sz, 8, sl)) {
                if (this.stuck.check(player, sx, sz)) {
                    if (this.stuck.desperatelyStuck) {
                        teleportNear(player, sx, sz);
                        this.stuck.reset();
                        return;
                    }
                    if (openNearbyGate(player, 5)) return;
                    const dx = sx - player.x, dz = sz - player.z;
                    walkTo(
                        player,
                        player.x + (Math.abs(dz) > Math.abs(dx) ? randInt(-10, 10) : (dz > 0 ? 10 : -10)),
                        player.z + (Math.abs(dx) > Math.abs(dz) ? randInt(-10, 10) : (dx > 0 ? 10 : -10)),
                    );
                    return;
                }
                walkTo(player, sx, sz);
                return;
            }
            this.state = 'find';
            return;
        }

        if (this.state === 'find') {
            const npc = findNpcByName(player.x, player.z, player.level, 'generalshopkeeper1', 10);
            if (!npc) {
                this.findFailTicks++;
                if (this.findFailTicks > 6) {
                    this.state = 'walk';
                    this.findFailTicks = 0;
                }
                walkTo(player, sx + randInt(-4, 4), sz + randInt(-4, 4));
                return;
            }
            this.findFailTicks = 0;
            interactNpcOp(player, npc, 3);
            this.cooldown = 3;
            this.state = 'sell';
            return;
        }

        if (this.state === 'sell') {
            this._sell(player);
            this.state = 'done';
            this.cooldown = 2;
        }
    }

    isComplete(_p: Player): boolean { return this.state === 'done'; }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.findFailTicks = 0;
        this.stuck.reset();
    }

    private _sell(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;
        let coins = 0;
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (this.keepItems.includes(item.id)) continue;
            if (item.id === Items.COINS) continue;
            if (BANK_ONLY_IDS.has(item.id)) continue;
            coins += item.count * (SELL_PRICES[item.id] ?? 1);
            inv.remove(item.id, item.count);
        }
        if (coins > 0) addItem(player, Items.COINS, coins);
    }
}

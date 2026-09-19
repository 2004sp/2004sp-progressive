/**
 * BotNeeds.ts
 *
 * Answers "what does this bot need before it can do X?" and
 * "can it afford what it needs?"
 *
 * Import chain: Player → BotAction → BotWorld (no cycle with World.ts)
 *
 * Key fixes vs original:
 *   - STARTING_COINS raised to 1000 (fighters need sword + scimitar upgrade)
 *   - getMissingPurchases now checks affordability per item
 *   - canAffordStep accounts for quantity × cost on bulk consumables
 *   - Added totalCostOfPurchases helper used by BotGoalPlanner
 */

import Player from '#/engine/entity/Player.js';
import { countItem } from '#/engine/bot/BotAction.js';
import { Items, Shops, SkillStep } from '#/engine/bot/BotKnowledge.js';

// ── Starting coins ────────────────────────────────────────────────────────────

/**
 * Coins granted to a brand-new bot on their first tick.
 * Must cover the most expensive first-purchase across all personalities:
 *   Skiller:  bronze axe (16) + net (5)                           =   21gp
 *   Fighter:  bronze sword (32) + iron scimitar later (200)       =  232gp
 *   Ranged:   oak shortbow (200) + 100 bronze arrows (100 × 7gp)  =  900gp
 *   Magic:    staff of air (unknown) + 100 mind runes (100 × 4gp) =  400gp+
 * 1000gp covers all starting gear with a comfortable buffer.
 */
export const STARTING_COINS = 200;

// ── Inventory checks ──────────────────────────────────────────────────────────

/** Does the bot have at least one of this tool in their backpack? */
export function hasTool(player: Player, toolItemId: number): boolean {
    return countItem(player, toolItemId) > 0;
}

/** Does the bot have every tool required for this skill step? */
export function hasAllTools(player: Player, step: SkillStep): boolean {
    return step.toolItemIds.every(id => hasTool(player, id));
}

/** Does the bot have enough coins for the given amount? */
export function hasCoins(player: Player, amount: number): boolean {
    return countItem(player, Items.COINS) >= amount;
}

/** Does the bot have the raw material this step consumes (bait, feathers, logs, etc.)? */
export function hasRawMaterial(player: Player, step: SkillStep): boolean {
    if (!step.itemConsumed || step.itemConsumed === -1) return true;
    return countItem(player, step.itemConsumed) > 0;
}

// ── Purchase planning ─────────────────────────────────────────────────────────

export interface Purchase {
    shopKey:  string;
    itemId:   number;
    quantity: number;  // how many to buy
    cost:     number;  // cost per item (base shop price, sell_multiplier=1000)
    total:    number;  // quantity × cost — pre-computed for convenience
}

/**
 * Returns the list of items this bot still needs to buy before
 * it can perform the given skill step, filtered to only items
 * the bot can currently afford.
 *
 * Items the bot can't afford are omitted — the planner should
 * notice the bot keeps failing shouldRun() and eventually try
 * a different skill that earns coins (combat drops, etc.)
 *
 * Empty list means: bot has all tools and can start the skill now.
 */
export function getMissingPurchases(player: Player, step: SkillStep): Purchase[] {
    const missing: Purchase[] = [];
    let coinsRemaining = countItem(player, Items.COINS);

    for (const toolId of step.toolItemIds) {
        if (hasTool(player, toolId)) continue;

        // Find which shop sells this tool
        let found = false;
            for (const shopKey in Shops) {
            const shop = Shops[shopKey];
            const shopItem = shop.stock.find(s => s.itemId === toolId);
            if (!shopItem) continue;

            // Bulk consumables: buy 200 at a time (feathers, bait, arrows)
            const isBulk = (
                toolId === Items.FISHING_BAIT ||
                toolId === Items.FEATHER       ||
                toolId === Items.BRONZE_ARROW
            );
            const quantity = isBulk ? 200 : 1;
            const total    = shopItem.cost * quantity;

            // Skip if can't afford even one
            if (coinsRemaining < shopItem.cost) {
                found = true; // found the shop but can't afford — don't add to missing
                break;
            }

            // Buy as many as affordable (up to quantity)
            const affordable = Math.min(quantity, Math.floor(coinsRemaining / shopItem.cost));
            coinsRemaining  -= affordable * shopItem.cost;

            missing.push({
                shopKey,
                itemId:   toolId,
                quantity: affordable,
                cost:     shopItem.cost,
                total:    affordable * shopItem.cost,
            });
            found = true;
            break;
        }

        // If no shop sells this tool (e.g. rune axe from drops only), skip
        if (!found) continue;
    }

    return missing;
}

/**
 * Total coins needed to buy all missing tools for this step.
 * Used by BotGoalPlanner to decide if the bot should try a
 * cheaper skill first and earn more coins via combat.
 */
export function totalCostOfMissing(player: Player, step: SkillStep): number {
    // Don't use getMissingPurchases (which filters by affordability) —
    // we want the theoretical total even if the bot can't afford it yet
    let total = 0;
    for (const toolId of step.toolItemIds) {
        if (hasTool(player, toolId)) continue;
        for (const shopKey in Shops) {
            const shop = Shops[shopKey];
            const item = shop.stock.find(s => s.itemId === toolId);
            if (!item) continue;
            const isBulk = toolId === Items.FISHING_BAIT || toolId === Items.FEATHER || toolId === Items.BRONZE_ARROW;
            total += item.cost * (isBulk ? 200 : 1);
            break;
        }
    }
    return total;
}

/**
 * True if the bot can afford everything it needs for this step right now.
 */
export function canAffordStep(player: Player, step: SkillStep): boolean {
    return totalCostOfMissing(player, step) <= countItem(player, Items.COINS);
}

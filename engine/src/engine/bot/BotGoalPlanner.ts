/**
 * BotGoalPlanner.ts
 *
 * Picks the next task given the bot's personality and current state.
 *
 * Decision order each call:
 *   1. First ever call → InitTask
 *   2. Has bones + wants prayer → BuryBonesTask
 *   3. Weighted skill pick (filtered to skills with content)
 *   4a. Bot can't afford the tools → try a cheaper skill or combat for coins
 *   4b. Bot has tools → WoodcuttingTask/MiningTask/FishingTask/CombatTask
 *
 * Skill rotation is managed by BotPlayer's rescan timer (150 ticks),
 * not here. The planner is stateless about which skill was last chosen.
 */

import Player from '#/engine/entity/Player.js';
import { PlayerStat, getBaseLevel, hasItem, countItem, isInventoryFull } from '#/engine/bot/BotAction.js';
import { Items, SkillProgression, getProgressionStep } from '#/engine/bot/BotKnowledge.js';
import { getMissingPurchases, canAffordStep, totalCostOfMissing } from '#/engine/bot/BotNeeds.js';
import type { Purchase } from '#/engine/bot/BotNeeds.js';
import { bankInvId, BotTask } from '#/engine/bot/tasks/BotTaskBase.js';
import { InitTask, BuryBonesTask, IdleTask, BankTask } from '#/engine/bot/tasks/UtilTasks.js';
import { ShopTripTask } from '#/engine/bot/tasks/ShopTripTask.js';
import { WoodcuttingTask } from '#/engine/bot/tasks/WoodcuttingTask.js';
import { MiningTask } from '#/engine/bot/tasks/MiningTask.js';
import { FishingTask } from '#/engine/bot/tasks/FishingTask.js';
import { CombatTask } from '#/engine/bot/tasks/CombatTask.js';
import { FiremakingTask } from '#/engine/bot/tasks/FiremakingTask.js';
import { CookingTask } from '#/engine/bot/tasks/CookingTask.js';
import { SmithingTask } from '#/engine/bot/tasks/SmithingTask.js';
import { ThievingTask } from '#/engine/bot/tasks/ThievingTask.js';
import { CraftingTask } from '#/engine/bot/tasks/CraftingTask.js';
import { RangedMagicTask, MIN_COINS_TO_SHOP as RM_MIN_COINS } from '#/engine/bot/tasks/RangedMagicTask.js';
import { RunecraftingTask } from '#/engine/bot/tasks/RunecraftingTask.js';
import { FletchingTask } from '#/engine/bot/tasks/FletchingTask.js';
import { HerbloreTask } from '#/engine/bot/tasks/HerbloreTask.js';
import { BankstandTask } from '#/engine/bot/tasks/BankstandTask.js';
import { FlaxPickingTask } from '#/engine/bot/tasks/FlaxPickingTask.js';
import { WaterFillingTask } from '#/engine/bot/tasks/WaterFillingTask.js';
import { SocialTask } from '#/engine/bot/tasks/SocialTask.js';
import { VendorTask } from '#/engine/bot/tasks/VendorTask.js';
import { PKerTask } from '#/engine/bot/tasks/PKerTask.js';
import { AgilityTask } from '#/engine/bot/tasks/AgilityTask.js';

// ── Personality ───────────────────────────────────────────────────────────────

export interface BotPersonality {
    name: string;
    weights: Partial<Record<string, number>>;
}

export const Personalities: Record<string, BotPersonality> = {
    SKILLER: {
        name: 'Skiller',
        weights: {
            WOODCUTTING: 15,
            FISHING: 20,
            MINING: 15,
            COOKING: 15,
            SMITHING: 15,
            THIEVING: 15,
            PRAYER: 10,
            FIREMAKING: 9,   // 35% share of the fletch/FM pair (9:17 ≈ 35:65)
            CRAFTING: 12,
            FLETCHING: 17,   // 65% share of the fletch/FM pair
            RUNECRAFT: 5,    // unlocks once a talisman drops
            HERBLORE: 8,     // requires guams (chaos druid drops) + coins for vials/newts
            AGILITY: 10,
        }
    },
    FIGHTER: {
        name: 'Fighter',
        weights: {
            ATTACK: 30,
            STRENGTH: 30,
            DEFENCE: 20,
            RANGED: 10,
            MAGIC: 5,
            PRAYER: 5
        }
    },
    BALANCED: {
        name: 'Balanced',
        weights: {
            ATTACK: 10,
            STRENGTH: 10,
            DEFENCE: 8,
            WOODCUTTING: 12,
            FISHING: 10,
            MINING: 8,
            COOKING: 8,
            SMITHING: 5,
            PRAYER: 5,
            RANGED: 4,
            MAGIC: 4,
            FIREMAKING: 13,  // 35% share of the fletch/FM pair (13:24 ≈ 35:65)
            CRAFTING: 6,
            FLETCHING: 24,   // 65% share of the fletch/FM pair
            RUNECRAFT: 8,    // unlocks once a talisman drops
            HERBLORE: 6,     // requires guams (chaos druid drops) + coins
            AGILITY: 8,
        }
    }
};

// Skill name → PlayerStat
const SKILL_STAT: Record<string, PlayerStat> = {
    ATTACK: PlayerStat.ATTACK,
    STRENGTH: PlayerStat.STRENGTH,
    DEFENCE: PlayerStat.DEFENCE,
    HITPOINTS: PlayerStat.HITPOINTS,
    RANGED: PlayerStat.RANGED,
    PRAYER: PlayerStat.PRAYER,
    MAGIC: PlayerStat.MAGIC,
    COOKING: PlayerStat.COOKING,
    WOODCUTTING: PlayerStat.WOODCUTTING,
    FLETCHING: PlayerStat.FLETCHING,
    FISHING: PlayerStat.FISHING,
    FIREMAKING: PlayerStat.FIREMAKING,
    CRAFTING: PlayerStat.CRAFTING,
    SMITHING: PlayerStat.SMITHING,
    MINING: PlayerStat.MINING,
    THIEVING: PlayerStat.THIEVING,
    RUNECRAFT: PlayerStat.RUNECRAFT,
    HERBLORE: PlayerStat.HERBLORE,
    AGILITY: PlayerStat.AGILITY,
};

// Only skills with content implemented in BotKnowledge.ts
const SKILLS_WITH_CONTENT = new Set(
    Object.entries(SkillProgression)
        .filter(([, steps]) => steps.length > 0)
        .map(([name]) => name)
);

// Shops close enough to Lumbridge spawn that bots can reach without getting stuck.
// Bots will ONLY go to these shops automatically. Starter weapons/tools are given
// via InitTask so bots never need to walk to Varrock or Port Sarim just to begin.
const NEARBY_SHOPS = new Set(['BOB_AXES', 'LUMBRIDGE_GENERAL', 'AL_KHARID_SCIMITARS', 'AL_KHARID_CRAFTING', 'VARROCK_ARCHERY', 'VARROCK_RUNES', 'VARROCK_STAFFS']);

// ── Planner ───────────────────────────────────────────────────────────────────

export class BotGoalPlanner {
    readonly personality: BotPersonality;
    private initialised = false;
    // Counts pickTask calls remaining before bankstand is eligible again.
    // Initialised with a random offset so bots don't all bankstand at once.
    private bankstandCooldown = Math.floor(Math.random() * 20) + 10;

    constructor(personality: BotPersonality = Personalities.BALANCED) {
        this.personality = personality;
    }

    pickTask(player: Player): BotTask | null {
        // ── 1. Init ───────────────────────────────────────────────────────────
        if (!this.initialised) {
            this.initialised = true;
            return new InitTask(this._starterItems());
        }

        // ── 2. Passive prayer ─────────────────────────────────────────────────
        if ((this.personality.weights['PRAYER'] ?? 0) > 0) {
            if (hasItem(player, Items.BONES) || hasItem(player, Items.BIG_BONES)) {
                return new BuryBonesTask();
            }
        }

        // ── 3 + 4. Pick skill, handle affordability ───────────────────────────
        return this._pickBestTask(player);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _pickBestTask(player: Player): BotTask | null {
        // ── Full inventory: bank gathered resources before anything else ──────
        // When the inventory is full, ShopTripTask.shouldRun will refuse to run
        // (no slot for the purchased item) and gathering tasks can't proceed
        // either. The only way out is to bank first.
        //
        // We keep coins and every tool ID appearing in any progression step so
        // the bot doesn't accidentally bank its axe/pickaxe/weapon alongside the
        // logs/ores/fish that actually caused the overflow.
        if (isInventoryFull(player)) {
            const keepIds = new Set<number>([Items.COINS]);
            for (const steps of Object.values(SkillProgression)) {
                for (const step of steps) {
                    for (const id of step.toolItemIds) keepIds.add(id);
                }
            }
            return new BankTask([...keepIds]);
        }

        // ── BANKSTAND: periodic sell session at Varrock West Bank ────────────
        // Triggered every ~20-40 planner calls (roughly once every 30-60 min at
        // the default 150-tick rescan interval). Skipped when inventory is full
        // so the bot banks first.
        if (this.bankstandCooldown <= 0) {
            this.bankstandCooldown = Math.floor(Math.random() * 20) + 20;
            return new BankstandTask();
        }
        this.bankstandCooldown--;

        // ── COOKING priority: cook whenever any fish are available ───────────
        // Without this, FISHING (weight 25) almost always beats COOKING (weight 15)
        // in the weighted shuffle, so bots accumulate fish forever and never cook.
        // If the bot has ≥ 5 fish (bank or inventory) and cooking is in their
        // personality, cook immediately regardless of the weighted skill order.
        if ((this.personality.weights['COOKING'] ?? 0) > 0) {
            const cookTask = this._findCookingTask(player);
            if (cookTask) return cookTask;
        }

        // ── SMITHING priority: smith whenever any ores/bars are available ────
        // Similar priority to cooking — smith whenever materials are available.
        // This ensures smelting takes priority over other skills when bot has ores/bars.
        if ((this.personality.weights['SMITHING'] ?? 0) > 0) {
            const smithTask = this._findSmithingTask(player);
            if (smithTask) return smithTask;
            console.log(`[Planner] ${player.username} SMITHING skipped: no smithTask (ores/bars?)`);
        }

        // ── CRAFTING priority (Phase 2 only) ─────────────────────────────────
        // Only runs when Mining >= 40 AND Smithing >= 40 — i.e. the gold pipeline
        // is active and the bot should prioritise ringing gold bars into rings.
        // Phase 1 (wool spinning) goes through the normal weighted rotation below
        // so it doesn't starve every other skill.
        if ((this.personality.weights['CRAFTING'] ?? 0) > 0) {
            const mineLevel = getBaseLevel(player, PlayerStat.MINING);
            const smithLevel = getBaseLevel(player, PlayerStat.SMITHING);
            if (mineLevel >= 40 && smithLevel >= 40) {
                const craftTask = this._findCraftingTask(player);
                if (craftTask) return craftTask;
            }
        }

        // Build candidate list ordered by weight (highest first after shuffle)
        const candidates = this._buildCandidates(player);
        if (candidates.length === 0) return new IdleTask(30);

        for (const skillName of candidates) {
            const stat = SKILL_STAT[skillName];
            const level = getBaseLevel(player, stat);

            // ── COOKING: scan all matching steps for one whose fish is in bank ─
            // getProgressionStep picks randomly, but multiple steps share the same
            // level (e.g. RAW_SHRIMP step and RAW_SARDINE step both start at lv 1).
            // We must find the step whose consumed item the bot actually has ≥ 28 of,
            // rather than hoping the random pick matches.
            if (skillName === 'COOKING') {
                const cookTask2 = this._findCookingTask(player);
                if (cookTask2) return cookTask2;
                continue; // no matching fish found — try next skill
            }

            if (skillName === 'CRAFTING') {
                const craftTask2 = this._findCraftingTask(player);
                if (craftTask2) return craftTask2;
                continue; // no viable crafting step right now — try next skill
            }

            // ── RANGED / MAGIC: both use RangedMagicTask ─────────────────────
            // The task handles its own equipment purchasing logic (bow + arrows for
            // ranged, staff + mind runes for magic). It only initiates when the bot
            // has the required gear OR has ≥ 5 000 coins to buy it.
            if (skillName === 'RANGED' || skillName === 'MAGIC') {
                const rmTask = this._findRangedMagicTask(player, stat);
                if (rmTask) return rmTask;
                continue;
            }

            // ── RUNECRAFT: unlocked by owning any talisman (combat drop) ─────
            // RunecraftingTask manages its own progression and altar selection.
            // shouldRun() returns false until a talisman is in bank/inventory,
            // so this candidate is silently skipped until that condition is met.
            if (skillName === 'RUNECRAFT') {
                const rcTask = this._findRunecraftingTask(player);
                if (rcTask) return rcTask;
                continue;
            }

            const step = getProgressionStep(skillName, level);
            if (!step) continue;

            const missing = getMissingPurchases(player, step);

            if (missing.length === 0) {
                // Double-check: getMissingPurchases omits unaffordable items (returns empty list
                // even if tools are missing), so we must verify the bot actually owns every tool.
                if (!step.toolItemIds.every(id => hasItem(player, id))) continue;

                // Check consumable availability (bait, feathers, raw fish for cooking, logs for FM)
                // If the step consumes an item that isn't purchasable (e.g. raw fish, logs),
                // the bot must first produce it via a different skill step.
                if (step.itemConsumed && step.itemConsumed !== -1) {
                    const hasInv = hasItem(player, step.itemConsumed, 1);

                    // Check bank for consumable (count for cooking minimum-batch check)
                    const bid = bankInvId();
                    let bankConsumeCount = 0;

                    if (bid !== -1) {
                        const bank = player.getInventory(bid);
                        if (bank) {
                            for (let i = 0; i < bank.capacity; i++) {
                                const item = bank.get(i);
                                if (!item) continue;
                                if (item.id === step.itemConsumed) bankConsumeCount += item.count;
                            }
                        }
                    }

                    const hasBank = bankConsumeCount > 0;
                    if (!hasInv && !hasBank) {
                        // 🔥 fallback to woodcutting ONLY if no logs anywhere
                        if (skillName === 'FIREMAKING') {
                            const wcLevel = getBaseLevel(player, PlayerStat.WOODCUTTING);
                            const wcStep = getProgressionStep('WOODCUTTING', wcLevel);

                            if (wcStep) {
                                return new WoodcuttingTask(wcStep);
                            }
                        }

                        continue;
                    }

                    const alsoConsumes = step.extra?.alsoConsumes as number | undefined;
                    if (alsoConsumes && !hasItem(player, alsoConsumes, 1)) {
                        continue;
                    }
                }
                // Has everything — go do the skill
                if (step.action === 'combat') return new CombatTask(step, stat);
                if (step.action === 'woodcut') return new WoodcuttingTask(step);
                if (step.action === 'mine') return new MiningTask(step);
                if (step.action === 'fish') return new FishingTask(step);
                if (step.action === 'firemaking') return new FiremakingTask(step);
                if (step.action === 'smelt' || step.action === 'smith') return new SmithingTask(step);
                if (step.action === 'agility') return new AgilityTask(step);
                if (step.action === 'thieve') return new ThievingTask(step);
                if (step.action === 'herblore_attack') {
                    // Require guams (chaos druid drops) — no guams, no herblore.
                    const herblBid = bankInvId();
                    let guamCount = countItem(player, step.itemConsumed!);
                    if (herblBid !== -1) {
                        const bankInv = player.getInventory(herblBid);
                        if (bankInv) {
                            for (let i = 0; i < bankInv.capacity; i++) {
                                const it = bankInv.get(i);
                                if (it && it.id === step.itemConsumed) guamCount += it.count;
                            }
                        }
                    }
                    if (guamCount < 5) continue; // not enough guams yet
                    return new HerbloreTask(step);
                }
                if (step.action.startsWith('fletch_')) {
                    // Don't start with fewer than 50 logs — let the bot accumulate
                    // a worthwhile batch from woodcutting first.
                    if (step.itemConsumed) {
                        let totalLogs = countItem(player, step.itemConsumed);
                        const fletchBid = bankInvId();
                        if (fletchBid !== -1) {
                            const bankInv = player.getInventory(fletchBid);
                            if (bankInv) {
                                for (let i = 0; i < bankInv.capacity; i++) {
                                    const it = bankInv.get(i);
                                    if (it?.id === step.itemConsumed) totalLogs += it.count;
                                }
                            }
                        }
                        if (totalLogs < 10) continue; //this is where to adjust threshold 
                    }
                    // Knife is a starter item but can be lost.  If it's not in
                    // inventory or bank, buy one from the Lumbridge General Store.
                    if (!this._hasKnifeAccessible(player)) {
                        return new ShopTripTask('LUMBRIDGE_GENERAL', Items.KNIFE, 1, 6);
                    }
                    return new FletchingTask(step);
                }
                continue;
            }

            if (canAffordStep(player, step)) {
                // Only go to nearby shops — distant shops cause bots to get stuck.
                // Starter gear is provided by InitTask so basics are always available.
                const first = missing[0];
                if (NEARBY_SHOPS.has(first.shopKey)) {
                    return new ShopTripTask(first.shopKey, first.itemId, first.quantity, first.cost);
                }
                // Distant shop needed — skip this skill for now
            }

            // Can't afford this skill's tools — try the next candidate
            // (lower-weight skills may be cheaper or tool-free)
        }

        // All skills need tools the bot can't afford.
        // Fall back to combat to earn coins — chickens/goblins need only a sword (32gp)
        // If even that's too expensive, idle briefly and hope for drops
        const combatFallback = this._cheapestCombatTask(player);
        return combatFallback ?? new IdleTask(30);
    }

    /**
     * If the bot has any cookable fish (in bank OR carried inventory) for their
     * current cooking level, return a CookingTask for that fish.  Otherwise null.
     *
     * We count both locations because bots often switch tasks before filling their
     * inventory, so fish may never reach the bank.  CookingTask always does a
     * bank_walk first, depositing the carried fish before withdrawing a full load.
     *
     * Threshold is 1 — matching CookingTask.MIN_FISH — so cooking starts as soon
     * as the bot has caught anything.
     */
    private _findCookingTask(player: Player): CookingTask | null {
        const bid = bankInvId();
        const bank = bid !== -1 ? player.getInventory(bid) : null;
        const level = getBaseLevel(player, PlayerStat.COOKING);
        const steps = SkillProgression['COOKING'].filter(s => level >= s.minLevel && level <= s.maxLevel);

        // Collect ALL viable steps (correct fish type + enough quantity).
        // Then pick randomly so bots spread across all cooking locations
        // instead of every bot always choosing the first (Al Kharid) entry.
        const candidates: typeof steps = [];
        for (const cs of steps) {
            const fishId = cs.itemConsumed;
            if (!fishId) continue;

            // Count fish in bank
            let count = 0;
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === fishId) count += it.count;
                }
            }
            // Also count fish currently in carried inventory (not yet banked)
            count += countItem(player, fishId);

            if (count >= 5) candidates.push(cs);
        }

        if (candidates.length === 0) return null;
        // Random pick spreads bots across Al Kharid, Varrock, Falador ranges
        return new CookingTask(candidates[Math.floor(Math.random() * candidates.length)]);
    }

    /**
     * If the bot has any ores (in bank OR carried inventory) OR bars for their
     * current smithing level, return a SmithingTask.  Otherwise null.
     *
     * Anvil mode (smith action) requires level >= 18 and bars in inventory.
     * Furnace mode (smelt action) requires ores in inventory.
     */
    private _findSmithingTask(player: Player): SmithingTask | null {
        const bid = bankInvId();
        const bank = bid !== -1 ? player.getInventory(bid) : null;
        const level = getBaseLevel(player, PlayerStat.SMITHING);
        const steps = SkillProgression['SMITHING'].filter(s => level >= s.minLevel && level <= s.maxLevel);

        const candidates: typeof steps = [];
        for (const ss of steps) {
            const consumedId = ss.itemConsumed;
            if (!consumedId) continue;

            // Count item in bank
            let count = 0;
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === consumedId) count += it.count;
                }
            }
            // Also count in carried inventory
            count += countItem(player, consumedId);

            // For bronze bars, also need tin ore
            if (ss.extra?.alsoConsumes) {
                const alsoConsumesId = ss.extra.alsoConsumes as number;
                let tinCount = 0;
                if (bank) {
                    for (let i = 0; i < bank.capacity; i++) {
                        const it = bank.get(i);
                        if (it?.id === alsoConsumesId) tinCount += it.count;
                    }
                }
                tinCount += countItem(player, alsoConsumesId);
                if (tinCount < 1) continue; // need tin too for bronze
            }

            if (count >= 5) candidates.push(ss);
        }

        if (candidates.length === 0) return null;
        return new SmithingTask(candidates[Math.floor(Math.random() * candidates.length)]);
    }

    /**
     * Returns the appropriate CraftingTask for the player's current state:
     *
     *   Phase 1 (craft_wool): while Mining < 40 OR Smithing < 40.
     *     Requires shears in inventory.  If missing, returns a ShopTripTask.
     *
     *   Phase 2 (craft_ring): once Mining >= 40 AND Smithing >= 40.
     *     Requires ring_mould in inventory and gold bars in bank/inv.
     *     If ring_mould missing, returns a ShopTripTask.
     *
     * Returns null when neither phase can run right now.
     */
    private _findCraftingTask(player: Player): BotTask | null {
        const mineLevel = getBaseLevel(player, PlayerStat.MINING);
        const smithLevel = getBaseLevel(player, PlayerStat.SMITHING);
        const phase2Unlocked = mineLevel >= 40 && smithLevel >= 40;

        const steps = SkillProgression['CRAFTING'];
        if (!steps || steps.length === 0) return null;

        const craftLevel = getBaseLevel(player, PlayerStat.CRAFTING);

        // ── Flax picking: runs when crafting level qualifies ──────────────────
        const flaxStep = steps.find(s => s.action === 'pick_flax' && craftLevel >= Math.max(s.minLevel, 10) && craftLevel <= s.maxLevel);
        if (flaxStep) {
            return new FlaxPickingTask(flaxStep);
        }

        // ── Soften clay: if bot has buckets but no bucket-of-water ────────────
        const softenStep = steps.find(s => s.action === 'soften_clay' && craftLevel >= s.minLevel && craftLevel <= s.maxLevel);
        if (softenStep && hasItem(player, Items.BUCKET) && !hasItem(player, Items.BUCKET_OF_WATER)) {
            return new WaterFillingTask(Items.BUCKET, Items.BUCKET_OF_WATER);
        }

        if (!phase2Unlocked) {
            // ── Phase 1: wool spinning ────────────────────────────────────────
            const step = steps.find(s => s.action === 'craft_wool');
            if (!step) return null;

            if (!hasItem(player, Items.SHEARS)) {
                // Shears are given as a starter item, but if somehow lost, buy from
                // the Lumbridge General Store (1gp, always in NEARBY_SHOPS).
                return new ShopTripTask('LUMBRIDGE_GENERAL', Items.SHEARS, 1, 1);
            }

            return new CraftingTask(step);
        }

        // ── Phase 2: gold rings ───────────────────────────────────────────────
        const step = steps.find(s => s.action === 'craft_ring');
        if (!step) return null;

        if (!hasItem(player, Items.RING_MOULD)) {
            // Buy ring mould from Al Kharid crafting shop if affordable
            if (canAffordStep(player, step) && NEARBY_SHOPS.has('AL_KHARID_CRAFTING')) {
                return new ShopTripTask('AL_KHARID_CRAFTING', Items.RING_MOULD, 1, 25);
            }
            return null;
        }

        // Need gold bars to be available
        const bid = bankInvId();
        const hasGoldInInv = countItem(player, Items.GOLD_BAR) > 0;
        let hasGoldInBank = false;
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    if (bank.get(i)?.id === Items.GOLD_BAR) {
                        hasGoldInBank = true;
                        break;
                    }
                }
            }
        }

        if (!hasGoldInInv && !hasGoldInBank) return null;

        return new CraftingTask(step);
    }

    /**
     * Returns a RangedMagicTask if the bot can do ranged or magic right now.
     *
     * Conditions:
     *   • Has bow + arrows (ranged mode) OR staff_of_air + mind runes (magic mode), OR
     *   • Has ≥ 5 000 coins total (inv + bank) to buy equipment at Varrock.
     *
     * Returns null if neither condition is met (bot can't afford gear yet).
     */
    private _findRangedMagicTask(player: Player, stat: PlayerStat): RangedMagicTask | null {
        // Determine appropriate progression step for the stat
        const skillName = stat === PlayerStat.RANGED ? 'RANGED' : 'MAGIC';
        const level = getBaseLevel(player, stat);
        const step = getProgressionStep(skillName, level);
        if (!step) return null;

        // Check if bot has ranged gear
        const hasBow = hasItem(player, Items.SHORTBOW) || hasItem(player, Items.OAK_SHORTBOW);
        const hasArrows = [Items.BRONZE_ARROW, Items.IRON_ARROW, Items.STEEL_ARROW].some(id => hasItem(player, id));

        // Check if bot has magic gear
        const hasStaff = hasItem(player, Items.STAFF_OF_AIR);
        const hasMindRunes = hasItem(player, Items.MIND_RUNE);

        if ((hasBow && hasArrows) || (hasStaff && hasMindRunes)) {
            return new RangedMagicTask(step, stat);
        }

        // No equipment — only start if bot has enough coins to buy
        const coins = countItem(player, Items.COINS);
        let bankCoins = 0;
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id === Items.COINS) bankCoins += it.count;
                }
            }
        }
        if (coins + bankCoins >= RM_MIN_COINS) {
            return new RangedMagicTask(step, stat);
        }

        return null;
    }

    /**
     * Returns a RunecraftingTask if the bot has a talisman (any tier) and a
     * pickaxe.  The task itself picks the highest qualifying altar internally.
     */
    private _findRunecraftingTask(player: Player): RunecraftingTask | null {
        const task = new RunecraftingTask();
        return task.shouldRun(player) ? task : null;
    }

    /**
     * Returns skill names in weighted-random order.
     * Skills the bot can't afford (and has no free fallback) sink to the bottom.
     */
    private _buildCandidates(player: Player): string[] {
        const affordable: string[] = [];
        const unaffordable: string[] = [];

        const entries = Object.entries(this.personality.weights).filter(
            ([skill, w]) =>
                w &&
                w > 0 &&
                SKILLS_WITH_CONTENT.has(skill) &&
                (() => {
                    const stat = SKILL_STAT[skill];
                    return stat !== undefined && getBaseLevel(player, stat) < 99;
                })()
        );

        // Weighted shuffle into two buckets
        let remaining = entries.slice();
        while (remaining.length > 0) {
            const total = remaining.reduce((s, [, w]) => s + (w ?? 0), 0);
            let roll = Math.random() * total;
            let chosen = remaining[remaining.length - 1];
            for (const entry of remaining) {
                roll -= entry[1] ?? 0;
                if (roll <= 0) {
                    chosen = entry;
                    break;
                }
            }
            remaining = remaining.filter(e => e !== chosen);

            const [skill] = chosen;
            const stat = SKILL_STAT[skill];
            const level = stat !== undefined ? getBaseLevel(player, stat) : 0;
            const step = getProgressionStep(skill, level);
            if (!step) continue;

            if (canAffordStep(player, step)) {
                affordable.push(skill);
            } else {
                unaffordable.push(skill);
            }
        }

        // Affordable skills first, then unaffordable (so we try them but won't
        // issue an unaffordable shop trip — _pickBestTask skips those)
        return [...affordable, ...unaffordable];
    }

    /**
     * Fallback: find the cheapest combat progression step the bot can afford.
     * Used when all other skills are too expensive to get started.
     */
    private _cheapestCombatTask(player: Player): BotTask | null {
        for (const skillName of ['ATTACK', 'STRENGTH', 'DEFENCE']) {
            const stat = SKILL_STAT[skillName];
            if (!stat) continue;
            const level = getBaseLevel(player, stat);
            const step = getProgressionStep(skillName, level);
            if (!step) continue;

            const missing = getMissingPurchases(player, step);
            if (missing.length === 0) {
                // getMissingPurchases silently drops unaffordable items, so verify ownership
                if (!step.toolItemIds.every(id => hasItem(player, id))) continue;
                // Has all tools — can fight
                return new CombatTask(step, stat); // has weapon
            }
            if (canAffordStep(player, step) && NEARBY_SHOPS.has(missing[0].shopKey)) {
                // Tools available at a nearby shop — go buy them
                return new ShopTripTask(missing[0].shopKey, missing[0].itemId, missing[0].quantity, missing[0].cost);
            }
            // Weapon only available at distant shop — skip combat for now
            // (bot should have received starter weapon from InitTask)
        }
        return null;
    }

    /**
     * All bots get a full starter kit so they can attempt any beginning skill
     * without a shop trip. This avoids long walks on the very first session.
     *
     * Given to every bot regardless of personality:
     *   bronze_axe      — woodcutting from level 1
     *   bronze_sword    — combat from level 1
     *   bronze_pickaxe  — mining from level 1
     *   small_net       — fishing (shrimp) from level 1
     *
     * As bots level up and earn coins from selling resources, they upgrade
     * to better equipment via shop trips.
     */
    private _starterItems(): number[] {
        return [Items.BRONZE_AXE, Items.KNIFE, Items.IRON_SCIMITAR, Items.BRONZE_PICKAXE, Items.SMALL_FISHING_NET, Items.TINDERBOX, Items.HAMMER, Items.SHEARS];
    }

    /** True if knife is in inventory or bank — used to avoid a shop trip when it just needs withdrawing. */
    private _hasKnifeAccessible(player: Player): boolean {
        if (hasItem(player, Items.KNIFE)) return true;
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === Items.KNIFE) return true;
        }
        return false;
    }
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function makeSkiller(): BotGoalPlanner {
    return new BotGoalPlanner(Personalities.SKILLER);
}
export function makeFighter(): BotGoalPlanner {
    return new BotGoalPlanner(Personalities.FIGHTER);
}
export function makeBalanced(): BotGoalPlanner {
    return new BotGoalPlanner(Personalities.BALANCED);
}

export function makeRandom(): BotGoalPlanner {
    const allSkills = Object.keys(SKILL_STAT).filter(s => SKILLS_WITH_CONTENT.has(s));
    const weights: Record<string, number> = {};
    for (const s of allSkills) weights[s] = Math.floor(Math.random() * 20) + 1;
    return new BotGoalPlanner({ name: 'Random', weights });
}

// ── Extras personalities ───────────────────────────────────────────────────────

export type ExtrasType = 'social' | 'vendor' | 'pker';

/**
 * Goal planner for "extras" bots — social, vendor, and wilderness PKer.
 * These bots skip all skilling logic and run a single specialised task.
 */
export class ExtrasGoalPlanner extends BotGoalPlanner {
    private readonly extrasType: ExtrasType;
    private extrasInit = false;

    constructor(type: ExtrasType) {
        super({ name: `Extras-${type}`, weights: {} });
        this.extrasType = type;
    }

    override pickTask(_player: Player): BotTask | null {
        if (!this.extrasInit) {
            this.extrasInit = true;
            // Extras bots skip the normal InitTask — their tasks self-initialise.
        }
        switch (this.extrasType) {
            case 'social': return new SocialTask();
            case 'vendor': return new VendorTask();
            case 'pker':   return new PKerTask();
        }
    }
}

export function makeExtrasSocial(): ExtrasGoalPlanner {
    return new ExtrasGoalPlanner('social');
}
export function makeExtrasVendor(): ExtrasGoalPlanner {
    return new ExtrasGoalPlanner('vendor');
}
export function makeExtrasPKer(): ExtrasGoalPlanner {
    return new ExtrasGoalPlanner('pker');
}

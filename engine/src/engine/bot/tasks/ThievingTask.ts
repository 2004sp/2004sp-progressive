/**
 * ThievingTask.ts — Pickpocket NPCs (Man/Woman), bank loot, handle stun/damage.
 *
 * NPCs: Man/Woman in Lumbridge and Varrock
 * Failure: NPC attacks player, player takes damage (stun)
 * Stop condition: HP too low → switch to other task or heal
 */

import {
    BotTask,
    Player,
    Npc,
    InvType,
    walkTo,
    interactNpcOp,
    findNpcByName,
    findNpcByPrefix,
    hasItem,
    countItem,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    getProgressionStep,
    teleportNear,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    advanceBankWalk
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import { getNpcCombatLevel, findAggressorNpc, interactHeldOp } from '#/engine/bot/BotAction.js';

const THIEVE_COOLDOWN_MIN = 8;
const THIEVE_COOLDOWN_MAX = 12;
const THIEF_STUN_DAMAGE = 3;
/** Absolute danger floor — interrupt immediately at or below this HP regardless of state or cooldown. */
const HP_DANGER_THRESHOLD = 5;
/** Soft threshold — stop pickpocketing and bank/heal when HP drops this low. */
const HP_SAFE_THRESHOLD = 15;
/** Pre-emptive heal threshold — eat BEFORE pickpocket if HP is below this */
const HP_PREEMPTIVE_THRESHOLD = 30;
const HEAL_IF_HP_BELOW = 20;
const MAX_TICKETS = 5;

export class ThievingTask extends BotTask {
    private step: SkillStep;

    private state: string = 'walk';

    private lastXp = 0;
    private lastHp = 0;
    private interactTicks = 0;
    private stunTicks = 0;
    private currentNpc: Npc | null = null;
    private done = false;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Thieve');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    private debug(player: Player, message: string): void {
        console.log(`[ThievingTask][${player.username}][${this.state}] ${message}`);
    }

    // ── Task lifecycle ───────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        const level = getBaseLevel(player, PlayerStat.THIEVING);

        // Must have level to start
        if (level < 1) return false;

        // Don't restart while HP is still in the danger zone or hasn't recovered
        // above the safe threshold — give the planner time to pick a healing task.
        const hp = player.stats[PlayerStat.HITPOINTS];
        if (hp <= HP_DANGER_THRESHOLD) {
            this.debug(player, `not starting: HP critically low (${hp})`);
            return false;
        }
        if (hp < HP_SAFE_THRESHOLD) {
            this.debug(player, `not starting: HP too low (${hp})`);
            return false;
        }

        return true;
    }

    isComplete(_player: Player): boolean {
        return this.done;
    }

    tick(player: Player): void {
        if (this.interrupted) {
            this.debug(player, 'Tick skipped because task is interrupted');
            return;
        }

        // ── DANGER HP CHECK — runs every tick, even during cooldown ──────────
        // If HP hits the absolute floor, interrupt immediately so the planner
        // can switch to a safer task before the bot takes one more hit and dies.
        {
            const hp = player.stats[PlayerStat.HITPOINTS];
            if (hp <= HP_DANGER_THRESHOLD) {
                this.debug(player, `DANGER: HP critically low (${hp}/${HP_DANGER_THRESHOLD}); switching task`);
                this.interrupt();
                return;
            }
        }

        const banking = this.state === 'bank_walk' || this.state === 'bank_done' || this.state === 'eat';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.debug(player, 'Watchdog triggered; teleported to destination, resuming');
            this.stuck.reset();
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        // ── Soft HP check: stop pickpocketing and bank/heal if HP is low ────
        if (this.state !== 'flee' && this.state !== 'bank_walk' && this.state !== 'bank_done' && this.state !== 'eat') {
            const hp = player.stats[PlayerStat.HITPOINTS];
            if (hp < HP_SAFE_THRESHOLD) {
                this.debug(player, `HP low (${hp}); banking to recover`);
                this.state = 'bank_walk';
                this.currentNpc = null;
                return;
            }
        }

        // ── Aggressor detection (same flee pattern as CombatTask) ──────────
        if (this.state !== 'bank_walk' && this.state !== 'bank_done' && this.state !== 'flee' && this.state !== 'eat') {
            const aggressor = findAggressorNpc(player, 8);
            if (aggressor && aggressor !== this.currentNpc) {
                const npcLvl = getNpcCombatLevel(aggressor);
                if (npcLvl > player.combatLevel) {
                    this.debug(player, 'aggressor attacking; fleeing');
                    this.state = 'flee';
                    this.stunTicks = 0;
                    return;
                }
            }
        }

        // ── Flee state: move away from NPCs ────────────────────────────────
        if (this.state === 'flee') {
            const [lx, lz] = [player.x - 10, player.z];
            walkTo(player, lx, lz);
            this.stunTicks++;
            if (this.stunTicks > 10) {
                this.state = 'bank_walk';
            }
            return;
        }

        // ── Eat state: heal with food ───────────────────────────────────
        if (this.state === 'eat') {
            this._eatFood(player);
            return;
        }

        // ── Bank walk ────────────────────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.debug(player, `advanceBankWalk returned ${result}`);
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_done';
            return;
        }

        // ── Bank deposit ─────────────────────────────────────────────
        if (this.state === 'bank_done') {
            this._depositLoot(player);
            this.state = 'walk';
            return;
        }

        // ── Walk to NPC ─────────────────────────────────────────────────
        if (this.state === 'walk') {
            const [lx, lz, ll] = this.step.location;
            if (!isNear(player, lx, lz, 10, ll)) {
                this._stuckWalk(player, lx, lz);
                return;
            }
            this.state = 'approach';
            return;
        }

        // ── Approach and find NPC ────────────────────────────────────────
        if (this.state === 'approach') {
            const npc = this._findNpc(player);
            if (!npc) {
                this.debug(player, `no npc found`);
                this._stuckWalk(player, this.step.location[0], this.step.location[1]);
                return;
            }
            this.currentNpc = npc;
            if (!isNear(player, npc.x, npc.z, 1)) {
                walkTo(player, npc.x, npc.z);
                return;
            }
            this.state = 'pickpocket';
            this.interactTicks = 0;
            return;
        }

        // ── Pickpocket loop ──────────────────────────────────────────
        if (this.state === 'pickpocket') {
            // If no NPC, find one
            if (!this.currentNpc) {
                this.state = 'approach';
                return;
            }

            // If not close enough, walk to NPC
            if (!isNear(player, this.currentNpc.x, this.currentNpc.z, 3)) {
                walkTo(player, this.currentNpc.x, this.currentNpc.z);
                return;
            }

            // Solution A: Pre-emptive HP check - eat BEFORE pickpocket if HP is low
            const hpBeforePickpocket = player.stats[PlayerStat.HITPOINTS];
            if (hpBeforePickpocket < HP_PREEMPTIVE_THRESHOLD) {
                const hasFood = this._hasFoodInInventory(player);
                if (hasFood) {
                    this.debug(player, `HP pre-emptively low (${hpBeforePickpocket}), eating first`);
                    this.state = 'eat';
                    return;
                }
                // No food, bank to get food or switch task
                this.debug(player, `HP pre-emptively low (${hpBeforePickpocket}), no food, banking`);
                this.state = 'bank_walk';
                return;
            }

            // Check if need to heal first (for lower HP)
            if (this._shouldHeal(player)) {
                // Check if we have food in inventory
                const hasFood = this._hasFoodInInventory(player);
                if (hasFood) {
                    this.debug(player, `HP low, eating to heal`);
                    this.state = 'eat';
                    return;
                }
                // No food, try to bank and get food or switch task
                this.debug(player, `HP low and no food, banking`);
                this.state = 'bank_walk';
                return;
            }

            // Track HP before attempting pickpocket (Solution C)
            this.lastHp = player.stats[PlayerStat.HITPOINTS];

            this.interactTicks++;
            interactNpcOp(player, this.currentNpc, 3); // op 3 = pickpocket

            // Save XP before cooldown - we'll check this after cooldown
            this.lastXp = player.stats[PlayerStat.THIEVING];

            this.watchdog.notifyActivity();
            this.cooldown = randInt(THIEVE_COOLDOWN_MIN, THIEVE_COOLDOWN_MAX);
            this.debug(player, `pickpocket sent`);

            return;
        }

        // ── Solution C: Check for unexpected HP drop after cooldown ────────
        // After cooldown just finished (cooldown was 1, now 0), if HP dropped
        // significantly without XP gain, the pickpocket failed and NPC retaliated
        if (this.state === 'pickpocket' && this.cooldown === 0 && this.lastHp > 0) {
            const currentHp = player.stats[PlayerStat.HITPOINTS];
            const hpDrop = this.lastHp - currentHp;
            if (hpDrop > 0 && this.lastXp === player.stats[PlayerStat.THIEVING]) {
                // XP didn't change but HP dropped - pickpocket failed, NPC hit us
                this.debug(player, `HP dropped by ${hpDrop} without XP gain - failed pickpocket, fleeing`);
                this.state = 'flee';
                this.stunTicks = 0;
                this.lastHp = 0; // Reset so we don't check again
                return;
            }
            // Reset lastHp after checking so we don't keep checking old value
            this.lastHp = 0;
        }

        // ── Check XP gain for success ─────────────────────────────────
        // Only check for XP gain in pickpocket state (after cooldown)
        if (this.state === 'pickpocket') {
            const currentXp = player.stats[PlayerStat.THIEVING];
            if (currentXp > this.lastXp) {
                // Success! XP gained
                const gained = currentXp - this.lastXp;
                this.debug(player, `XP gained: ${gained}, total ${currentXp}`);
                this.watchdog.notifyActivity();
            }
            // Update lastXp for next attempt (both success and failure)
            this.lastXp = currentXp;
        }

        this.interactTicks = 0;
    }

    reset(): void {
        super.reset();
        this.state = 'walk';
        this.lastXp = 0;
        this.lastHp = 0;
        this.interactTicks = 0;
        this.stunTicks = 0;
        this.currentNpc = null;
        this.done = false;
        this.stuck.reset();
        this.watchdog.reset();
    }

    // ── Private helpers ───────────────────────────────────────────

    private _findNpc(player: Player): Npc | null {
        // Try to find the npc based on step's extra data
        const npcName = (this.step.extra?.npcName as string) ?? 'man';

        // First try exact name
        let npc = findNpcByName(player.x, player.z, player.level, npcName, 15);
        if (npc) return npc;

        // Try prefix (e.g., "man" as prefix for "man", "farmer", etc.)
        npc = findNpcByPrefix(player.x, player.z, player.level, npcName, 15);
        return npc;
    }

    private _shouldHeal(player: Player): boolean {
        const hp = player.stats[PlayerStat.HITPOINTS];
        return hp < HEAL_IF_HP_BELOW;
    }

    private _hasFoodInInventory(player: Player): boolean {
        // Check for cooked fish that can heal - use raw numbers to avoid type errors
        const foodIds = [315, 325, 333, 329, 379, 373];

        for (const foodId of foodIds) {
            if (countItem(player, foodId) > 0) {
                return true;
            }
        }

        // Check bank for cooked fish
        const bid = bankInvId();
        if (bid !== -1) {
            const bank = player.getInventory(bid);
            if (bank) {
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item) continue;
                    if (foodIds.includes(item.id)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private _eatFood(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        // Find food in inventory — higher healing items first.
        // op 1 = eat, which fires the server-side opheld1 script and properly heals.
        const foodIds = [373, 379, 329, 333, 325, 315];

        for (const foodId of foodIds) {
            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item || item.id !== foodId) continue;

                interactHeldOp(player, inv, foodId, slot, 1);
                this.debug(player, `ate ${item.id} (slot ${slot}) to heal`);

                this.cooldown = 3;
                this.state = 'pickpocket';
                return;
            }
        }

        // No food found — go to bank.
        this.debug(player, `no food to eat`);
        this.state = 'bank_walk';
    }

    private _depositLoot(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;

        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        const lootableIds = [995]; // coins stay, everything else goes to bank

        let deposited = 0;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (lootableIds.includes(item.id)) continue;

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
                deposited += moved.completed;
            }
        }

        this.debug(player, `deposited ${deposited} items`);
    }

    private _stuckWalk(player: Player, lx: number, lz: number): void {
        if (!this.stuck.check(player, lx, lz)) {
            walkTo(player, lx, lz);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            this.debug(player, `desperately stuck; teleporting`);
            teleportNear(player, lx, lz);
            this.stuck.reset();
            return;
        }

        const wx = player.x + randInt(-5, 5);
        const wz = player.z + randInt(-5, 5);
        this.debug(player, `stuck fallback to ${wx}, ${wz}`);
        walkTo(player, wx, wz);
    }
}

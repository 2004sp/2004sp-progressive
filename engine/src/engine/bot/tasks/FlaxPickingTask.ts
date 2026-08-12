/**
 * FlaxPickingTask.ts
 *
 * Picks flax in the Seers' Village flax field.
 * Banking: Seers' Village bank.
 */

import {
    BotTask,
    Player,
    InvType,
    walkTo,
    interactLocOp,
    findLocByName,
    countItem,
    isInventoryFull,
    isNear,
    Items,
    bankInvId,
    StuckDetector,
    ProgressWatchdog,
    openNearbyGate,
    teleportNear,
    advanceBankWalk,
    randInt,
    hasStrayItems
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';

export class FlaxPickingTask extends BotTask {
    private readonly step: SkillStep;

    /**
     * State machine:
     *   walk      → walking to flax field
     *   pick      → at field, interacting with flax
     *   bank_walk → walking to bank
     *   bank_done → banking finished
     */
    private state: 'walk' | 'pick' | 'bank_walk' | 'bank_done' = 'walk';
    private lastFlaxCount = 0;
    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    /**
     * Completes after a single gather-and-bank cycle so the planner is
     * re-consulted rather than gathering flax forever. Without this, the
     * planner would keep re-selecting FlaxPickingTask indefinitely (same
     * task name never changes candidate.name at rescan), starving
     * CraftingTask of the chance to spin the flax that's already banked.
     * See _findCraftingTask() in BotGoalPlanner for the producer/consumer
     * threshold that decides whether to gather more or switch to spinning.
     */
    private bankedOnce = false;

    constructor(step: SkillStep) {
        super('Pick Flax');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(_player: Player): boolean {
        return !this.bankedOnce;
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_done';
        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        if (isInventoryFull(player) && this.state !== 'bank_walk' && this.state !== 'bank_done') {
            this.state = 'bank_walk';
        }

        // Carrying leftovers from a previous task — bank them before heading
        // out to the flax field so the trip starts with a clean slate.
        if (this.state === 'walk' && hasStrayItems(player, [...this.step.toolItemIds, Items.COINS])) {
            this.state = 'bank_walk';
        }

        switch (this.state) {
            case 'walk': {
                const [lx, lz, ll] = this.step.location;
                if (!isNear(player, lx, lz, 10, ll)) {
                    teleportNear(player, lx, lz);
                    return;
                }
                this.state = 'pick';
                this.lastFlaxCount = countItem(player, Items.FLAX);
                return;
            }

            case 'pick': {
                const flaxCount = countItem(player, Items.FLAX);
                if (flaxCount > this.lastFlaxCount) {
                    this.watchdog.notifyActivity();
                }
                this.lastFlaxCount = flaxCount;

                if (isInventoryFull(player)) {
                    this.state = 'bank_walk';
                    return;
                }

                const flax = findLocByName(player.x, player.z, player.level, 'flax_ground', 15);
                if (!flax) {
                    // Wander slightly if no flax found
                    const [lx, lz] = this.step.location;
                    walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
                    return;
                }

                if (!isNear(player, flax.x, flax.z, 1)) {
                    walkTo(player, flax.x, flax.z);
                    return;
                }

                interactLocOp(player, flax, 2);
                this.cooldown = randInt(2, 4);
                return;
            }

            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.state = 'bank_done';
                return;
            }

            case 'bank_done': {
                this._depositFlax(player);
                this.bankedOnce = true;
                this.state = 'walk';
                this.cooldown = 2;
                return;
            }
        }
    }

    isComplete(_player: Player): boolean {
        return this.bankedOnce;
    }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.lastFlaxCount = 0;
        this.bankedOnce = false;
        this.stuck.reset();
        this.watchdog.reset();
    }

    private _depositFlax(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (item.id === Items.COINS) continue;
            // Keep any tool items (though flax picking has none)
            if (this.step.toolItemIds.includes(item.id)) continue;

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
    }

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
        if (openNearbyGate(player, 5)) return;
        walkTo(player, lx + randInt(-5, 5), lz + randInt(-5, 5));
    }
}

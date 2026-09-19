/**
 * WaterFillingTask.ts
 *
 * Fills empty containers (buckets, jugs) at a water source.
 */

import {
    BotTask,
    Player,
    InvType,
    walkTo,
    findLocByName,
    findLocByPrefix,
    hasItem,
    countItem,
    isNear,
    Items,
    Locations,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    botTeleport,
    interactUseLocOp,
    addItem,
    removeItem,
    addXp
} from '#/engine/bot/tasks/BotTaskBase.js';

export class WaterFillingTask extends BotTask {
    private state: 'walk' | 'fill' | 'wait' = 'walk';
    private containerId: number;
    private filledId: number;
    private lastContainerCount = 0;
    private waitTicks = 0;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(containerId: number, filledId: number) {
        super('WaterFilling');
        this.containerId = containerId;
        this.filledId = filledId;
    }

    shouldRun(player: Player): boolean {
        return hasItem(player, this.containerId);
    }

    isComplete(player: Player): boolean {
        return !hasItem(player, this.containerId);
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        if (this.watchdog.check(player)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.interrupt();
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        if (this.state === 'walk') {
            const [fx, fz, fl] = Locations.FALADOR_FOUNTAIN;
            if (!isNear(player, fx, fz, 3, fl)) {
                if (!this.stuck.check(player, fx, fz)) {
                    walkTo(player, fx, fz);
                } else {
                    botTeleport(player, fx, fz, fl);
                    this.stuck.reset();
                }
                return;
            }
            this.state = 'fill';
            return;
        }

        if (this.state === 'fill') {
            const fountain =
                findLocByName(player.x, player.z, player.level, 'fountain', 10)
                ?? findLocByPrefix(player.x, player.z, player.level, 'fountain', 10)
                ?? findLocByName(player.x, player.z, player.level, 'pump', 10)
                ?? findLocByName(player.x, player.z, player.level, 'sink', 10);

            if (!fountain) {
                // If no fountain found, the bot is stuck or the map is wrong
                this.interrupt();
                return;
            }

            if (!isNear(player, fountain.x, fountain.z, 1)) {
                walkTo(player, fountain.x, fountain.z);
                return;
            }

            const inv = player.getInventory(InvType.INV);
            if (!inv) return;

            let slot = -1;
            for (let i = 0; i < inv.capacity; i++) {
                if (inv.get(i)?.id === this.containerId) {
                    slot = i;
                    break;
                }
            }

            if (slot === -1) {
                return; // handled by isComplete
            }

            this.lastContainerCount = countItem(player, this.containerId);
            const ok = interactUseLocOp(player, fountain, this.containerId, slot);
            if (ok) {
                this.state = 'wait';
                this.waitTicks = 0;
                this.cooldown = 2;
            } else {
                this.cooldown = 1;
            }
            return;
        }

        if (this.state === 'wait') {
            const currentCount = countItem(player, this.containerId);
            if (currentCount < this.lastContainerCount) {
                // Success!
                this.watchdog.notifyActivity();
                this.state = 'fill';
                return;
            }

            this.waitTicks++;
            if (this.waitTicks > 5) {
                // Timeout, try again or use manual fallback if absolutely necessary
                // For now, just try again
                this.state = 'fill';
            }
        }
    }

    override reset(): void {
        super.reset();
        this.state = 'walk';
        this.waitTicks = 0;
        this.lastContainerCount = 0;
        this.stuck.reset();
        this.watchdog.reset();
    }
}

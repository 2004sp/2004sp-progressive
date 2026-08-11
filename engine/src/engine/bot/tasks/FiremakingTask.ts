import {
    BotTask,
    Player,
    walkTo,
    removeItem,
    hasItem,
    isNear,
    getBaseLevel,
    getProgressionStep,
    PlayerStat,
    Items,
    Locations,
    randInt,
    StuckDetector,
    ProgressWatchdog,
    InvType,
    bankInvId,
    openNearbyGate,
    teleportNear,
    nearestBank,
} from '#/engine/bot/tasks/BotTaskBase.js';

import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import Loc from '#/engine/entity/Loc.js';
import World from '#/engine/World.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { interactHeldOpU } from '#/engine/bot/BotAction.js';


export class FiremakingTask extends BotTask {
    private step: SkillStep;

    private state: 'walk' | 'burn' | 'move' | 'bank_walk' | 'bank' = 'walk';

    private lastXp = 0;
    private bankLocked = false;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Firemaking');
        this.step = step;
        this.watchdog.destination = step.location;
    }

    shouldRun(player: Player): boolean {
        const logId = this.step.itemConsumed;
        if (!logId || logId === -1) return false;
        if (!hasItem(player, logId) && !this._inBank(player, logId)) return false;
        if (!hasItem(player, Items.TINDERBOX) && !this._inBank(player, Items.TINDERBOX)) return false;
        return true;
    }

    // ───────────────── LOG HELPERS ─────────────────

    private getItemSlot(player: Player, itemId: number): number | null {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return null;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === itemId) return i;
        }
        return null;
    }

    /** Returns the step's required log ID if the bot has one in inventory, else null. */
    private getFirstLog(player: Player): number | null {
        const logId = this.step.itemConsumed;
        if (!logId || logId === -1) return null;
        return this.getItemSlot(player, logId) !== null ? logId : null;
    }

    private hasLogs(player: Player): boolean {
        return this.getFirstLog(player) !== null;
    }

    private _inBank(player: Player, itemId: number): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === itemId) return true;
        }
        return false;
    }

    private static FIRE_ID = 2732;
    private static FIRE_DURATION = 100; // ticks

private spawnFire(player: Player): void {
    try {
        const fire = new Loc(
            player.level,                      // level
            player.x,                          // x
            player.z,                          // z
            1,                                 // width
            1,                                 // length
            EntityLifeCycle.DESPAWN,           // lifecycle
            FiremakingTask.FIRE_ID,            // type (2732)
            10,                                // shape
            0                                  // angle
        );

        World.addLoc(fire, FiremakingTask.FIRE_DURATION);

        console.log(`[Firemaking] 🔥 spawned REAL fire at ${player.x},${player.z}`);
    } catch (err) {
        console.log('[Firemaking] ❌ failed to spawn fire', err);
    }
}

    // ───────────────── MAIN LOOP ─────────────────

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.stuck.reset();
            this.state = 'walk';
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        const level = getBaseLevel(player, PlayerStat.FIREMAKING);
        const newStep = getProgressionStep('FIREMAKING', level);

        if (newStep && newStep.minLevel > this.step.minLevel) {
            console.log(`[Firemaking] 📈 Step upgrade`);
            this.step = newStep;
            this.resetLoop();
        }

        // ───────────────── FORCE BANK FIX ─────────────────
        if (!this.hasLogs(player)) {
            if (!banking) {
                console.log(`[Firemaking] 📦 No logs → bank`);
                this.state = 'bank_walk';
            }
        }

        // ───────────────── BANK WALK ─────────────────

        if (this.state === 'bank_walk') {
            const [bx, bz] = nearestBank(player);

            if (!isNear(player, bx, bz, 8)) {
                this._stuckWalk(player, bx, bz);
                return;
            }

            console.log(`[Firemaking] 🏦 Arrived bank`);
            this.state = 'bank';
            return;
        }

        // ───────────────── BANK ─────────────────

        if (this.state === 'bank') {
            const bid = bankInvId();
            const bank = bid !== -1 ? player.getInventory(bid) : null;
            const inv = player.getInventory(InvType.INV);
            if (!bank || !inv) return;

            const logId = this.step.itemConsumed;
            if (!logId || logId === -1) { this.interrupt(); return; }

            // 1. Deposit everything that isn't the correct log or tinderbox.
            for (let i = 0; i < inv.capacity; i++) {
                const item = inv.get(i);
                if (!item) continue;
                if (item.id === logId || item.id === Items.TINDERBOX) continue;
                const moved = inv.remove(item.id, item.count);
                if (moved.completed > 0) bank.add(item.id, moved.completed);
            }

            // 2. Ensure tinderbox is in inventory; withdraw from bank if needed.
            if (!hasItem(player, Items.TINDERBOX)) {
                for (let i = 0; i < bank.capacity; i++) {
                    const it = bank.get(i);
                    if (it?.id !== Items.TINDERBOX) continue;
                    const removed = bank.remove(Items.TINDERBOX, 1);
                    if (removed.completed > 0) inv.add(Items.TINDERBOX, 1);
                    break;
                }
                if (!hasItem(player, Items.TINDERBOX)) {
                    console.log(`[Firemaking] ❌ No tinderbox anywhere → STOP`);
                    this.interrupt();
                    return;
                }
            }

            // 3. Withdraw correct logs (fill remaining inventory space).
            if (!hasItem(player, logId)) {
                let withdrew = false;
                for (let i = 0; i < bank.capacity; i++) {
                    const item = bank.get(i);
                    if (!item || item.id !== logId) continue;
                    const moved = bank.remove(logId, item.count);
                    if (moved.completed > 0) {
                        inv.add(logId, moved.completed);
                        withdrew = true;
                    }
                    break;
                }
                if (!withdrew) {
                    console.log(`[Firemaking] ❌ No correct logs in bank → STOP`);
                    this.interrupt();
                    return;
                }
            }

            this.bankLocked = false;
            this.state = 'walk';
            return;
        }

        // ───────────────── WALK TO FIRE AREA ─────────────────

        if (this.state === 'walk') {
            const [lx, lz] = Locations.FIRE_LUMBRIDGE_ROAD;

            if (!isNear(player, lx, lz, 8)) {
                this._stuckWalk(player, lx, lz);
                return;
            }

            console.log(`[Firemaking] 🔥 Arrived fire area`);
            this.state = 'burn';
            return;
        }

             // ───────────────── BURN ─────────────────

        if (this.state === 'burn') {
            const logId = this.getFirstLog(player);
            const inv = player.getInventory(InvType.INV);
            if (!logId) {
                console.log('[Firemaking] 📦 out of logs');
                this.state = 'bank_walk';
                return;
            }
            if(!inv) {
                return;
            }
            const before = player.stats[PlayerStat.FIREMAKING];
            const slot = this.getItemSlot(player, logId);
            if (slot === null) return;
            const o_slot = this.getItemSlot(player, Items.TINDERBOX);
            if (o_slot === null) return;
            const success: boolean = interactHeldOpU(player, inv, logId, slot, Items.TINDERBOX, o_slot); //Simulate a real use item on item action
            if(success) {
                const xp = this.getXp(logId);
                //this.spawnFire(player); <- no longer needed
                player.stats[PlayerStat.FIREMAKING] = before + xp;

                this.lastXp = player.stats[PlayerStat.FIREMAKING];

                this.watchdog.notifyActivity();
                //Delay this, or may not even need it?
                console.log(
                    '[Firemaking] 🔥 burned log +${xp} XP (total=${this.lastXp})'
                );
            }
            this.cooldown = randInt(2, 12);
            this.state = 'move';
            return;
        }

        // ───────────────── MOVE ─────────────────

        if (this.state === 'move') {
            walkTo(
                player,
                player.x + randInt(-1, 1),
                player.z + randInt(-1, 1)
            );

            this.state = 'burn';
            return;
        }
    }

    // ───────────────── RESET ─────────────────

    private resetLoop(): void {
        this.state = 'walk';
        this.cooldown = 0;
        this.lastXp = 0;
        this.bankLocked = false;

        this.stuck.reset();
        this.watchdog.reset();
    }

    override reset(): void {
        super.reset();
        this.resetLoop();
    }

    // ───────────────── STUCK HANDLER ─────────────────

    private _stuckWalk(player: Player, x: number, z: number): void {
        if (!this.stuck.check(player, x, z)) {
            walkTo(player, x, z);
            return;
        }

        if (this.stuck.desperatelyStuck) {
            console.log(`[Firemaking] 🌀 teleport escape`);
            teleportNear(player, x, z);
            this.stuck.reset();
            return;
        }

        if (openNearbyGate(player, 5)) return;

        walkTo(
            player,
            player.x + randInt(-10, 10),
            player.z + randInt(-10, 10)
        );
    }

    isComplete(): boolean {
        return false;
    }

    // ───────────────── XP TABLE ─────────────────

    private getXp(log: number): number {
        switch (log) {
            case Items.LOGS: return 40;
            case Items.OAK_LOGS: return 60;
            case Items.WILLOW_LOGS: return 90;
            case Items.MAPLE_LOGS: return 135;
            case Items.YEW_LOGS: return 202;
            default: return 40;
        }
    }
}

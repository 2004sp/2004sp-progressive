/**
 * CraftingTask.ts
 *
 * Two-phase crafting task driven by BotGoalPlanner._findCraftingTask().
 *
 * ── Phase 1  (step.action === 'craft_wool')  ─────────────────────────────────
 *   Runs while Mining < 40 OR Smithing < 40.
 *   shear_walk → shear → climb → spin → descend → bank_walk → bank → repeat
 *
 *   Sheep field  → Lumbridge sheep NE of castle
 *   Spinning     → teleJump to Lumbridge castle 2nd floor, use ball_wool on wheel
 *   Banking      → teleJump back to ground floor, nearest ground-floor bank
 *
 * ── Phase 2  (step.action === 'craft_ring')  ─────────────────────────────────
 *   Unlocks once Mining >= 40 AND Smithing >= 40 (gold ore pipeline active).
 *   bank_walk → withdraw → furnace_walk → craft → bank_return → repeat
 *
 *   Materials    → gold bars from bank + ring_mould in inventory
 *   Output       → gold rings deposited each banking cycle
 */

import { interactHeldOpU } from '#/engine/bot/BotAction.js';
import {
    BotTask,
    Player,
    InvType,
    walkTo,
    interactUseLocOp,
    botInteractUseObjNpc,
    findNpcByName,
    findLocByName,
    findLocByPrefix,
    hasItem,
    countItem,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    Locations,
    randInt,
    bankInvId,
    StuckDetector,
    ProgressWatchdog,
    openNearbyGate,
    teleportNear,
    advanceBankWalk,
    botTeleport,
    
    interactLocOp,
    addXp
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Collect this many ball_wool before heading to the spinning wheel. */
const SHEAR_BATCH = 14;

/** Consecutive failed interaction attempts before giving up on a state. */
const FAIL_LIMIT = 6;

// ── CraftingTask ──────────────────────────────────────────────────────────────

type Phase1State = 'shear_walk' | 'shear' | 'climb' | 'spin' | 'spin_flax' | 'descend' | 'bank_walk' | 'bank';
type Phase2State = 'bank_walk' | 'withdraw' | 'furnace_walk' | 'craft' | 'bank_return' | 'tanning_walk' | 'tanning' | 'pottery_walk' | 'pottery' | 'wait_pottery' | 'wait_gem' | 'wait_leather';

export class CraftingTask extends BotTask {
    private readonly step: SkillStep;
    private readonly phase: 1 | 2;

    private p1State: Phase1State = 'shear_walk';
    private p2State: Phase2State = 'bank_walk';

    private failTicks = 0;
    private done = false;
    private lastBallWool = 0;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog();

    constructor(step: SkillStep) {
        super('Crafting');
        this.step = step;
        this.phase = step.action === 'craft_wool' ? 1 : 2;
        this.watchdog.destination = step.location;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    shouldRun(player: Player): boolean {
        const mineLevel = getBaseLevel(player, PlayerStat.MINING);
        const smithLevel = getBaseLevel(player, PlayerStat.SMITHING);
        const phase2Unlocked = mineLevel >= 40 && smithLevel >= 40;

        if (this.phase === 1) {
            if (phase2Unlocked) return false; // gate closed
            return hasItem(player, Items.SHEARS);
        }

        // Phase 2
        if (!phase2Unlocked) return false;
        if (this.step.action.startsWith('craft_leather_')) {
            return hasItem(player, Items.NEEDLE) && hasItem(player, Items.THREAD) && (hasItem(player, Items.LEATHER) || this._hasLeatherAnywhere(player) || hasItem(player, Items.COW_HIDE) || this._hasCowHideInBank(player));
        }
        if (this.step.action === 'craft_hard_leather_body') {
            return hasItem(player, Items.NEEDLE) && hasItem(player, Items.THREAD) && (hasItem(player, Items.HARD_LEATHER) || this._hasItemInBank(player, Items.HARD_LEATHER));
        }
        if (this.step.action.startsWith('cut_')) {
            return hasItem(player, Items.CHISEL) && (hasItem(player, this.step.itemConsumed!) || this._hasItemInBank(player, this.step.itemConsumed!));
        }
        if (!hasItem(player, Items.RING_MOULD)) return false;
        return this._hasGoldBarsAnywhere(player);
    }

    isComplete(_player: Player): boolean {
        return this.done;
    }

    override reset(): void {
        super.reset();
        this.p1State = 'shear_walk';
        this.p2State = 'bank_walk';
        this.failTicks = 0;
        this.done = false;
        this.lastBallWool = 0;
        this.stuck.reset();
        this.watchdog.reset();
    }

    tick(player: Player): void {
        if (this.interrupted) return;

        const banking = this.phase === 1 ? this.p1State === 'bank_walk' || this.p1State === 'bank' : this.p2State === 'bank_walk' || this.p2State === 'withdraw' || this.p2State === 'bank_return';

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

        if (this.phase === 1) {
            this._tickPhase1(player);
        } else if (this.step.action.startsWith('craft_leather_') || this.step.action === 'craft_hard_leather_body') {
            this._tickLeather(player);
        } else if (this.step.action.startsWith('cut_')) {
            this._tickGems(player);
        } else if (this.step.action === 'soften_clay' || this.step.action === 'craft_pot') {
            this._tickPottery(player);
        } else {
            this._tickPhase2(player);
        }
    }

    // ── Phase 1: wool spinning ────────────────────────────────────────────────

    private _tickPhase1(player: Player): void {
        switch (this.p1State) {
            // ── Walk to sheep field ───────────────────────────────────────────
            case 'shear_walk': {
                const [sx, sz] = this.step.extra!['sheepLocation'] as [number, number, number];
                if (!isNear(player, sx, sz, 7)) {
                    teleportNear(player, sx, sz);
                    return;
                }
                this.p1State = 'shear';
                this.lastBallWool = countItem(player, Items.WOOL);
                return;
            }

            // ── Shear sheep until we have a full batch ────────────────────────
            case 'shear': {
                // Wait for cooldown between shearing attempts
                if (this.cooldown > 0) {
                    this.cooldown--;
                    return;
                }

                // Shearing gives raw wool (Items.WOOL).  Track that, not ball_of_wool.
                const woolCount = countItem(player, Items.WOOL);

                // Notify watchdog whenever we gain a wool
                if (woolCount > this.lastBallWool) {
                    this.watchdog.notifyActivity();
                    this.failTicks = 0;
                }
                this.lastBallWool = woolCount;

                if (woolCount >= SHEAR_BATCH) {
                    this.p1State = 'climb';
                    return;
                }

                // Check available inventory space before shearing
                const inv = player.getInventory(InvType.INV);
                if (!inv) return;
                let freeSlots = 0;
                for (let i = 0; i < inv.capacity; i++) {
                    if (inv.get(i) === null) freeSlots++;
                }
                if (freeSlots === 0) {
                    this.p1State = 'climb';
                    return;
                }

                // Locate shears in inventory — required for use-item-on-npc
                let shearsSlot = -1;
                for (let i = 0; i < inv.capacity; i++) {
                    if (inv.get(i)?.id === Items.SHEARS) {
                        shearsSlot = i;
                        break;
                    }
                }
                if (shearsSlot === -1) {
                    // Lost shears somehow — abort so planner can re-buy them
                    this.interrupt();
                    return;
                }

                // Cycle to a different sheep each attempt so multiple bots don't all
                // pile on the same target.  Falls back to any sheep if only one exists.
                // NPC debugname is 'sheepunsheered' — sheared sheep become 'sheepsheered'.
                const [sx, sz] = this.step.extra!['sheepLocation'] as [number, number, number];
                console.log(`[CraftingTask][${player.username}] Looking for sheep at ${player.x},${player.z} radius 10`);
                const sheep = findNpcByName(player.x, player.z, player.level, 'sheepunsheered', 20);

                if (!sheep) {
                    console.log(`[CraftingTask][${player.username}] No sheep found! failTicks=${this.failTicks}`);
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        // Walk back to sheep location center - no jitter
                        walkTo(player, sx, sz);
                        this.failTicks = 0;
                    }
                    return;
                }

                // Use shears on sheep (APNPCU trigger) — server drives the shearing
                // animation and grants the ball_wool on completion (~3 ticks).
                // Cooldown covers the full shearing action so the bot doesn't
                // spam the interaction before the server has finished.
                console.log(`[CraftingTask][${player.username}] Found sheep @ ${sheep.x},${sheep.z}, attempting shear`);
                const ok = botInteractUseObjNpc(player, sheep, Items.SHEARS, shearsSlot);
                if (ok) {
                    console.log(`[CraftingTask][${player.username}] Shear interaction sent! woolCount=${woolCount}`);
                    this.failTicks = 0;
                    this.cooldown = randInt(4, 6); // 3 ticks animation + 1-3 buffer
                } else {
                    console.log(`[CraftingTask][${player.username}] Shear FAILED! failTicks=${this.failTicks}`);
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        walkTo(player, sx, sz);
                        this.failTicks = 0;
                    }
                }
                return;
            }

            // ── Walk near the castle (outside), then teleJump to spinning wheel ─
            case 'climb': {
                const [approachX, approachZ] = Locations.LUMBRIDGE_CASTLE_APPROACH;
                if (!isNear(player, approachX, approachZ, 10, 0)) {
                    teleportNear(player, approachX, approachZ);
                    return;
                }
                const [wx, wz, wl] = Locations.LUMBRIDGE_POTTERS_WHEEL;
                botTeleport(player, wx, wz, wl);
                this.p1State = 'spin';
                this.failTicks = 0;
                return;
            }

            // ── Spin raw wool into ball of wool on the spinning wheel ────────────
            case 'spin': {
                // Raw wool (Items.WOOL) was obtained by shearing.
                // The spinning wheel script consumes Items.WOOL and produces Items.BALL_WOOL.
                const woolCount = countItem(player, Items.WOOL);
                if (woolCount === 0) {
                    this.p1State = 'spin_flax';
                    return;
                }

                // Must be cardinally adjacent to the wheel before interacting.
                // reachedLoc requires cardinal adjacency — diagonal doesn't satisfy it.
                // LUMBRIDGE_POTTERS_WHEEL is already the adjacent tile, so this walk
                // normally completes in 0 ticks, but guards against any position drift.
                const [wx, wz, wl] = Locations.LUMBRIDGE_POTTERS_WHEEL;
                if (!isNear(player, wx, wz, 1, wl)) {
                    walkTo(player, wx, wz);
                    return;
                }

                const wheel = findLocByName(player.x, player.z, player.level, 'spinning_wheel', 20) ?? findLocByPrefix(player.x, player.z, player.level, 'spinning', 25);

                if (!wheel) {
                    console.log(`[CraftingTask][${player.username}] No spinning wheel found — descending`);
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this.p1State = 'descend';
                        this.failTicks = 0;
                    }
                    return;
                }

                // Find raw wool slot
                const inv = player.getInventory(InvType.INV);
                if (!inv) return;
                let woolSlot = -1;
                for (let i = 0; i < inv.capacity; i++) {
                    if (inv.get(i)?.id === Items.WOOL) {
                        woolSlot = i;
                        break;
                    }
                }
                if (woolSlot === -1) {
                    this.p1State = 'descend';
                    return;
                }

                const ok = interactUseLocOp(player, wheel, Items.WOOL, woolSlot);
                if (ok) {
                    // Manual XP tracking to drive ProgressWatchdog
                    // (RuneScript handles actual stat_advance server-side)
                    player.stats[PlayerStat.CRAFTING] += this.step.xpPerAction;
                    this.watchdog.notifyActivity();
                    this.failTicks = 0;
                    this.cooldown = randInt(3, 6);
                } else {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this.p1State = 'descend';
                        this.failTicks = 0;
                    }
                }
                return;
            }

            case 'spin_flax': {
                const flaxCount = countItem(player, Items.FLAX);
                if (flaxCount === 0) {
                    this.p1State = 'descend';
                    return;
                }

                const [wx, wz, wl] = Locations.LUMBRIDGE_POTTERS_WHEEL;
                if (!isNear(player, wx, wz, 1, wl)) {
                    walkTo(player, wx, wz);
                    return;
                }

                const wheel = findLocByName(player.x, player.z, player.level, 'spinning_wheel', 20) ?? findLocByPrefix(player.x, player.z, player.level, 'spinning', 25);

                if (!wheel) {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this.p1State = 'descend';
                        this.failTicks = 0;
                    }
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;
                let flaxSlot = -1;
                for (let i = 0; i < inv.capacity; i++) {
                    if (inv.get(i)?.id === Items.FLAX) {
                        flaxSlot = i;
                        break;
                    }
                }
                if (flaxSlot === -1) {
                    this.p1State = 'descend';
                    return;
                }

                const ok = interactUseLocOp(player, wheel, Items.FLAX, flaxSlot);
                if (ok) {
                    player.stats[PlayerStat.CRAFTING] += this.step.xpPerAction;
                    this.watchdog.notifyActivity();
                    this.failTicks = 0;
                    this.cooldown = randInt(3, 6);
                } else {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this.p1State = 'descend';
                        this.failTicks = 0;
                    }
                }
                return;
            }

            // ── teleJump back to ground floor (outside castle) ────────────────
            case 'descend': {
                // Land outside the castle so the bot can walk freely to the bank
                // without navigating back through the castle door.
                const [ax, az, al] = Locations.LUMBRIDGE_CASTLE_APPROACH;
                botTeleport(player, ax, az, al);
                this.p1State = 'bank_walk';
                return;
            }

            // ── Walk to nearest ground-floor bank ─────────────────────────────
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p1State = 'bank';
                return;
            }

            // ── Deposit wool, loop back ───────────────────────────────────────
            case 'bank': {
                this._depositWool(player);
                this.p1State = 'shear_walk';
                return;
            }
        }
    }

    // ── Leatherworking ────────────────────────────────────────────────────────

    private _tickLeather(player: Player): void {
        switch (this.p2State) {
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p2State = 'withdraw';
                return;
            }

            case 'withdraw': {
                const bid = bankInvId();
                const inv = player.getInventory(InvType.INV);
                const bank = bid !== -1 ? player.getInventory(bid) : null;

                // Tanning logic only for soft leather items
                if (this.step.action !== 'craft_hard_leather_body' && (countItem(player, Items.COW_HIDE) > 0 || this._hasCowHideInBank(player))) {
                    // We have hides to tan
                    const inv = player.getInventory(InvType.INV);
                    const bid = bankInvId();
                    const bank = bid !== -1 ? player.getInventory(bid) : null;

                    if (inv && bank && !hasItem(player, Items.COW_HIDE)) {
                        for (let i = 0; i < bank.capacity; i++) {
                            if (bank.get(i)?.id === Items.COW_HIDE) {
                                const moved = bank.remove(Items.COW_HIDE, 27);
                                inv.add(Items.COW_HIDE, moved.completed);
                                break;
                            }
                        }
                    }

                    if (hasItem(player, Items.COW_HIDE)) {
                        // Also ensure we have some coins for tanning
                        if (inv && bank && countItem(player, Items.COINS) < 27) {
                            for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.COINS) {
                                    const moved = bank.remove(Items.COINS, 1000);
                                    inv.add(Items.COINS, moved.completed);
                                    break;
                                }
                            }
                        }

                        this.p2State = 'tanning_walk';
                        return;
                    }
                }

                // Deposit crafted items
                if (inv && bank) {
                    const products: number[] = [Items.LEATHER_GLOVES, Items.LEATHER_BOOTS, Items.LEATHER_VAMBRACES, Items.LEATHER_CHAPS, Items.LEATHER_BODY, Items.HARD_LEATHER_BODY];
                    for (let i = 0; i < inv.capacity; i++) {
                        const item = inv.get(i);
                        if (item && products.includes(item.id)) {
                            const moved = inv.remove(item.id, item.count);
                            bank.add(item.id, moved.completed);
                        }
                    }
                }

                if (!hasItem(player, Items.NEEDLE) || !hasItem(player, Items.THREAD)) {
                    // Try to withdraw from bank
                    if (bank) {
                        if (!hasItem(player, Items.NEEDLE)) {
                            for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.NEEDLE) {
                                    bank.remove(Items.NEEDLE, 1);
                                    inv?.add(Items.NEEDLE, 1);
                                    break;
                                }
                            }
                        }
                        if (!hasItem(player, Items.THREAD)) {
                            for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.THREAD) {
                                    const moved = bank.remove(Items.THREAD, 5);
                                    inv?.add(Items.THREAD, moved.completed);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!hasItem(player, Items.NEEDLE) || !hasItem(player, Items.THREAD)) {
                    this.done = true;
                    this.interrupt();
                    return;
                }

                // Withdraw leather
                const leatherId = this.step.itemConsumed!;
                if (bank && !hasItem(player, leatherId)) {
                    for (let i = 0; i < bank.capacity; i++) {
                        const item = bank.get(i);
                        if (item?.id === leatherId) {
                            const moved = bank.remove(leatherId, 25);
                            inv?.add(leatherId, moved.completed);
                            break;
                        }
                    }
                }

                if (!hasItem(player, leatherId)) {
                    this.done = true;
                    this.interrupt();
                    return;
                }

                this.p2State = 'craft';
                return;
            }

            case 'tanning_walk': {
                const [tx, tz, tl] = Locations.TANNER_AL_KHARID;
                if (!isNear(player, tx, tz, 3, tl)) {
                    this._stuckWalk(player, tx, tz);
                    return;
                }
                this.p2State = 'tanning';
                return;
            }

            case 'tanning': {
                const hideCount = countItem(player, Items.COW_HIDE);
                if (hideCount === 0) {
                    this.p2State = 'bank_walk';
                    return;
                }

                const tanner = findNpcByName(player.x, player.z, player.level, 'ellis', 10);
                if (!tanner) {
                    this.p2State = 'bank_walk';
                    return;
                }

                // Tanning cost: 1gp per hide for soft leather
                const coins = countItem(player, Items.COINS);
                const toTan = Math.min(hideCount, coins);

                if (toTan > 0) {
                    const inv = player.getInventory(InvType.INV);
                    if (inv) {
                        inv.remove(Items.COW_HIDE, toTan);
                        inv.remove(Items.COINS, toTan);
                        inv.add(Items.LEATHER, toTan);
                        console.log(`[CraftingTask][${player.username}] Tanned ${toTan} leather`);
                    }
                }

                this.p2State = 'bank_walk';
                this.cooldown = 2;
                return;
            }

            case 'craft': {
                const leatherId = this.step.itemConsumed!;
                if (!hasItem(player, leatherId)) {
                    this.p2State = 'bank_walk';
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const prevXp = player.stats[PlayerStat.CRAFTING];

                // Use needle on leather interaction
                const needleSlot = this._findSlot(player, Items.NEEDLE);
                const leatherSlot = this._findSlot(player, leatherId);
                if (needleSlot !== -1 && leatherSlot !== -1) {
                    interactHeldOpU(player, inv, Items.NEEDLE, needleSlot, leatherId, leatherSlot);
                }

                this.p2State = 'wait_leather';
                this.lastBallWool = prevXp;
                this.cooldown = 1;
                return;
            }

            case 'wait_leather': {
                if (player.stats[PlayerStat.CRAFTING] > this.lastBallWool) {
                    this.watchdog.notifyActivity();
                    this.p2State = 'craft';
                    this.failTicks = 0;
                    return;
                }
                this.failTicks++;
                if (this.failTicks > 3) {
                    const inv = player.getInventory(InvType.INV);
                    const leatherId = this.step.itemConsumed!;
                    if (inv && hasItem(player, leatherId)) {
                        inv.remove(leatherId, 1);
                        inv.add(this.step.itemGained!, 1);
                        inv.remove(Items.THREAD, 1);
                        addXp(player, PlayerStat.CRAFTING, this.step.xpPerAction);
                        this.watchdog.notifyActivity();
                    }
                    this.p2State = 'craft';
                    this.failTicks = 0;
                }
                return;
            }
        }
    }

    // ── Phase 2: gold ring crafting ───────────────────────────────────────────

    private _tickPhase2(player: Player): void {
        switch (this.p2State) {
            // ── Walk to nearest bank ──────────────────────────────────────────
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p2State = 'withdraw';
                return;
            }

            // ── Deposit rings, withdraw gold bars ─────────────────────────────
            case 'withdraw': {
                this._depositRings(player);

                if (!hasItem(player, Items.RING_MOULD)) {
                    console.log(`[CraftingTask][${player.username}] No ring mould — done`);
                    this.done = true;
                    this.interrupt();
                    return;
                }

                const withdrew = this._withdrawGoldBars(player);
                if (!withdrew) {
                    console.log(`[CraftingTask][${player.username}] No gold bars — done`);
                    this.done = true;
                    this.interrupt();
                    return;
                }

                this.p2State = 'furnace_walk';
                this.cooldown = 1;
                return;
            }

            // ── Walk to furnace ───────────────────────────────────────────────
            case 'furnace_walk': {
                const [lx, lz, ll] = this.step.location;
                if (!isNear(player, lx, lz, 3, ll)) {
                    this._stuckWalk(player, lx, lz);
                    return;
                }
                this.p2State = 'craft';
                this.failTicks = 0;
                return;
            }

            // ── Use gold bar on furnace ───────────────────────────────────────
            case 'craft': {
                if (!this._hasGoldBarsInInventory(player)) {
                    this.p2State = 'bank_return';
                    return;
                }

                const [lx, lz] = this.step.location;
                const furnace = findLocByPrefix(player.x, player.z, player.level, 'furnace', 15) ?? findLocByName(player.x, player.z, player.level, 'furnace', 15);

                if (!furnace) {
                    this._stuckWalk(player, lx, lz);
                    return;
                }

                // Find gold bar slot
                const inv = player.getInventory(InvType.INV);
                if (!inv) return;
                let barSlot = -1;
                for (let i = 0; i < inv.capacity; i++) {
                    if (inv.get(i)?.id === Items.GOLD_BAR) {
                        barSlot = i;
                        break;
                    }
                }
                if (barSlot === -1) {
                    this.p2State = 'bank_return';
                    return;
                }

                const ok = interactUseLocOp(player, furnace, Items.GOLD_BAR, barSlot);
                if (ok) {
                    // Manual XP tracking (RuneScript handles actual stat_advance)
                    player.stats[PlayerStat.CRAFTING] += this.step.xpPerAction;
                    this.watchdog.notifyActivity();
                    this.failTicks = 0;
                    this.cooldown = randInt(4, 8);
                } else {
                    this.failTicks++;
                    if (this.failTicks >= FAIL_LIMIT) {
                        this.p2State = 'bank_return';
                        this.failTicks = 0;
                    } else {
                        this.cooldown = 1;
                    }
                }
                return;
            }

            // ── Return to bank and loop ───────────────────────────────────────
            case 'bank_return': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p2State = 'withdraw';
                return;
            }
        }
    }

    // ── Inventory helpers ─────────────────────────────────────────────────────

    private _hasGoldBarsAnywhere(player: Player): boolean {
        if (countItem(player, Items.GOLD_BAR) > 0) return true;
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === Items.GOLD_BAR) return true;
        }
        return false;
    }

    private _hasCowHideInBank(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === Items.COW_HIDE) return true;
        }
        return false;
    }

    private _hasItemInBank(player: Player, itemId: number): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === itemId) return true;
        }
        return false;
    }

    private _hasLeatherAnywhere(player: Player): boolean {
        if (countItem(player, Items.LEATHER) > 0) return true;
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        if (!bank) return false;
        for (let i = 0; i < bank.capacity; i++) {
            if (bank.get(i)?.id === Items.LEATHER) return true;
        }
        return false;
    }

    private _hasGoldBarsInInventory(player: Player): boolean {
        return countItem(player, Items.GOLD_BAR) > 0;
    }

    /** Withdraw up to 27 gold bars (leave 1 slot free for the ring_mould). */
    private _withdrawGoldBars(player: Player): boolean {
        const bid = bankInvId();
        if (bid === -1) return false;
        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return false;

        for (let i = 0; i < bank.capacity; i++) {
            const item = bank.get(i);
            if (!item || item.id !== Items.GOLD_BAR) continue;
            const toWithdraw = Math.min(item.count, 27); // 1 slot reserved for ring_mould
            const moved = bank.remove(Items.GOLD_BAR, toWithdraw);
            if (moved.completed > 0) {
                inv.add(Items.GOLD_BAR, moved.completed);
                return true;
            }
        }
        // Already has bars in inventory
        return countItem(player, Items.GOLD_BAR) > 0;
    }

    /** Deposit ball_of_wool (and any leftover raw wool/flax/bowstrings); keep shears and coins. */
    private _depositWool(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        const keepIds = new Set<number>([Items.SHEARS, Items.COINS, Items.FLAX]);
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || keepIds.has(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
    }

    /** Deposit gold rings (and anything else not needed); keep ring_mould, gold bars, coins. */
    private _depositRings(player: Player): void {
        const bid = bankInvId();
        if (bid === -1) return;
        const bank = player.getInventory(bid);
        const inv = player.getInventory(InvType.INV);
        if (!bank || !inv) return;

        const keepIds = new Set<number>([Items.COINS, Items.RING_MOULD, Items.GOLD_BAR]);
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || keepIds.has(item.id)) continue;
            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) bank.add(item.id, moved.completed);
        }
    }

    // ── Pottery ───────────────────────────────────────────────────────────────

    private _tickPottery(player: Player): void {
        switch (this.p2State) {
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p2State = 'withdraw';
                return;
            }

            case 'withdraw': {
                const bid = bankInvId();
                const inv = player.getInventory(InvType.INV);
                const bank = bid !== -1 ? player.getInventory(bid) : null;

                if (inv && bank) {
                    // Deposit finished products
                    const products: number[] = [Items.SOFT_CLAY, Items.POT];
                    for (let i = 0; i < inv.capacity; i++) {
                        const item = inv.get(i);
                        if (item && products.includes(item.id)) {
                            const moved = inv.remove(item.id, item.count);
                            bank.add(item.id, moved.completed);
                        }
                    }

                    // Handle softening clay
                    if (this.step.action === 'soften_clay') {
                        if (!hasItem(player, Items.CLAY)) {
                            for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.CLAY) {
                                    const moved = bank.remove(Items.CLAY, 14);
                                    inv.add(Items.CLAY, moved.completed);
                                    break;
                                }
                            }
                        }

                        if (!hasItem(player, Items.BUCKET_OF_WATER) && !hasItem(player, Items.JUG_OF_WATER)) {
                             // Try to withdraw buckets of water
                             for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.BUCKET_OF_WATER) {
                                    const moved = bank.remove(Items.BUCKET_OF_WATER, 14);
                                    inv.add(Items.BUCKET_OF_WATER, moved.completed);
                                    break;
                                }
                             }
                        }

                        if (hasItem(player, Items.CLAY) && (hasItem(player, Items.BUCKET_OF_WATER) || hasItem(player, Items.JUG_OF_WATER))) {
                            this.p2State = 'craft';
                            return;
                        }

                        // If still missing water, might need to fill buckets (handled by planner usually, but let's fail here)
                        if (hasItem(player, Items.CLAY) && !hasItem(player, Items.BUCKET_OF_WATER)) {
                             this.done = true;
                             this.interrupt();
                             return;
                        }
                    }

                    // Handle crafting pots
                    if (this.step.action === 'craft_pot') {
                        if (!hasItem(player, Items.SOFT_CLAY)) {
                            for (let i = 0; i < bank.capacity; i++) {
                                if (bank.get(i)?.id === Items.SOFT_CLAY) {
                                    const moved = bank.remove(Items.SOFT_CLAY, 27);
                                    inv.add(Items.SOFT_CLAY, moved.completed);
                                    break;
                                }
                            }
                        }

                        if (hasItem(player, Items.SOFT_CLAY)) {
                            this.p2State = 'pottery_walk';
                            return;
                        }
                    }
                }

                this.done = true;
                this.interrupt();
                return;
            }

            case 'pottery_walk': {
                // Land near a pottery wheel
                const wheelPos: [number, number, number] = Locations.BARBARIAN_VILLAGE_POTTERY;
                if (!isNear(player, wheelPos[0], wheelPos[1], 3, wheelPos[2])) {
                    this._stuckWalk(player, wheelPos[0], wheelPos[1]);
                    return;
                }
                this.p2State = 'pottery';
                return;
            }

            case 'pottery': {
                if (!hasItem(player, Items.SOFT_CLAY)) {
                    this.p2State = 'bank_walk';
                    return;
                }
                // Interact with wheel
                const wheel = findLocByPrefix(player.x, player.z, player.level, 'potter', 10);
                if (wheel) {
                    const inv = player.getInventory(InvType.INV);
                    if (!inv) return;

                    const prevXp = player.stats[PlayerStat.CRAFTING];
                    // Op 2 is typically "make-pot" or similar on the wheel
                    interactLocOp(player, wheel, 2);

                    // Wait and check for XP gain as indicator of success
                    this.p2State = 'wait_pottery';
                    this.lastBallWool = prevXp; // Reuse field for XP tracking
                    this.cooldown = 4;
                } else {
                    this.p2State = 'bank_walk';
                }
                return;
            }

            case 'craft': {
                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const waterId = hasItem(player, Items.BUCKET_OF_WATER) ? Items.BUCKET_OF_WATER : Items.JUG_OF_WATER;
                if (!hasItem(player, Items.CLAY) || !hasItem(player, waterId)) {
                    this.p2State = 'bank_walk';
                    return;
                }

                // Combine water on clay (Sync fallback if needed, but interaction is better if possible)
                // For now, keep it simple as it's a 100% success rate combination
                inv.remove(Items.CLAY, 1);
                inv.remove(waterId, 1);
                inv.add(Items.SOFT_CLAY, 1);
                inv.add(waterId === Items.BUCKET_OF_WATER ? Items.BUCKET : Items.JUG, 1);
                this.watchdog.notifyActivity();
                this.cooldown = 2;
                return;
            }

            case 'wait_pottery': {
                if (player.stats[PlayerStat.CRAFTING] > this.lastBallWool) {
                    this.watchdog.notifyActivity();
                    this.p2State = 'pottery';
                    return;
                }
                this.failTicks++;
                if (this.failTicks > 5) {
                    // Manual fallback if server interaction failed
                    const inv = player.getInventory(InvType.INV);
                    if (inv && hasItem(player, Items.SOFT_CLAY)) {
                        inv.remove(Items.SOFT_CLAY, 1);
                        inv.add(this.step.itemGained!, 1);
                        addXp(player, PlayerStat.CRAFTING, this.step.xpPerAction);
                        this.watchdog.notifyActivity();
                    }
                    this.p2State = 'pottery';
                    this.failTicks = 0;
                }
                return;
            }
        }
    }

    // ── Gem Cutting ───────────────────────────────────────────────────────────

    private _tickGems(player: Player): void {
        switch (this.p2State) {
            case 'bank_walk': {
                const result = advanceBankWalk(player, this.stuck);
                if (result === 'walk') return;
                this.cooldown = result === 'ready' ? 3 : 0;
                this.p2State = 'withdraw';
                return;
            }

            case 'withdraw': {
                const bid = bankInvId();
                const inv = player.getInventory(InvType.INV);
                const bank = bid !== -1 ? player.getInventory(bid) : null;

                // Deposit cut gems
                if (inv && bank) {
                    const gems: number[] = [Items.SAPPHIRE, Items.EMERALD, Items.RUBY, Items.DIAMOND];
                    for (let i = 0; i < inv.capacity; i++) {
                        const item = inv.get(i);
                        if (item && gems.includes(item.id)) {
                            const moved = inv.remove(item.id, item.count);
                            bank.add(item.id, moved.completed);
                        }
                    }
                }

                if (!hasItem(player, Items.CHISEL)) {
                    if (bank) {
                        for (let i = 0; i < bank.capacity; i++) {
                            if (bank.get(i)?.id === Items.CHISEL) {
                                bank.remove(Items.CHISEL, 1);
                                inv?.add(Items.CHISEL, 1);
                                break;
                            }
                        }
                    }
                }

                if (!hasItem(player, Items.CHISEL)) {
                    this.done = true;
                    this.interrupt();
                    return;
                }

                const uncutId = this.step.itemConsumed!;
                if (!hasItem(player, uncutId)) {
                    if (bank) {
                        for (let i = 0; i < bank.capacity; i++) {
                            const it = bank.get(i);
                            if (it?.id === uncutId) {
                                const moved = bank.remove(uncutId, 27);
                                inv?.add(uncutId, moved.completed);
                                break;
                            }
                        }
                    }
                }

                if (!hasItem(player, uncutId)) {
                    this.done = true;
                    this.interrupt();
                    return;
                }

                this.p2State = 'craft';
                return;
            }

            case 'craft': {
                const uncutId = this.step.itemConsumed!;
                if (!hasItem(player, uncutId)) {
                    this.p2State = 'bank_walk';
                    return;
                }

                const inv = player.getInventory(InvType.INV);
                if (!inv) return;

                const prevXp = player.stats[PlayerStat.CRAFTING];

                // Use chisel on uncut gem interaction
                const chiselSlot = this._findSlot(player, Items.CHISEL);
                const uncutSlot = this._findSlot(player, uncutId);
                if (chiselSlot !== -1 && uncutSlot !== -1) {
                    interactHeldOpU(player, inv, Items.CHISEL, chiselSlot, uncutId, uncutSlot);
                }

                this.p2State = 'wait_gem';
                this.lastBallWool = prevXp;
                this.cooldown = 1;
                return;
            }

            case 'wait_gem': {
                if (player.stats[PlayerStat.CRAFTING] > this.lastBallWool) {
                    this.watchdog.notifyActivity();
                    this.p2State = 'craft';
                    this.failTicks = 0;
                    return;
                }
                this.failTicks++;
                if (this.failTicks > 3) {
                    const inv = player.getInventory(InvType.INV);
                    const uncutId = this.step.itemConsumed!;
                    if (inv && hasItem(player, uncutId)) {
                        inv.remove(uncutId, 1);
                        inv.add(this.step.itemGained!, 1);
                        addXp(player, PlayerStat.CRAFTING, this.step.xpPerAction);
                        this.watchdog.notifyActivity();
                    }
                    this.p2State = 'craft';
                    this.failTicks = 0;
                }
                return;
            }
        }
    }

    private _findSlot(player: Player, itemId: number): number {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return -1;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (item && item.id === itemId) return i;
        }
        return -1;
    }

    // ── Movement helper ───────────────────────────────────────────────────────

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
        if (openNearbyGate(player, 8)) return;
        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }
}

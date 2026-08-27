import {
    BotTask,
    Player,
    Npc,
    InvType,
    walkTo,
    interactNpcOp,
    findNpcByName,
    findNpcByPrefix,
    findNpcBySuffix,
    hasItem,
    isInventoryFull,
    isNear,
    getBaseLevel,
    PlayerStat,
    Items,
    Locations,
    getProgressionStep,
    teleportNear,
    randInt,
    bankInvId,
    INTERACT_TIMEOUT,
    StuckDetector,
    ProgressWatchdog,
    openNearbyGate,
    addXp,
    setCombatStyle,
    botJitter,
    advanceBankWalk,
    cleanGrimyHerbs,
    botTeleport,
    FOOD_IDS
} from '#/engine/bot/tasks/BotTaskBase.js';
import type { SkillStep } from '#/engine/bot/tasks/BotTaskBase.js';
import {
    findObjByName,
    findObjByPrefix,
    findObjNear,
    findLootObj,
    interactHeldOp,
    pickupGroundItem,
    removeItem,
    findNpcFiltered,
    npcMatchesName,
    getNpcCombatLevel,
    findAggressorNpc,
    interactIF_UseOp,
    interactObjOp,
    _equipLoot,
    countItem
} from '#/engine/bot/BotAction.js';
import NpcType from '#/cache/config/NpcType.js';
import { Interfaces, GRIMY_HERB_MAP } from '#/engine/bot/BotKnowledge.js';
import ObjType from '#/cache/config/ObjType.js';
import type { BotTaskDebugInfo } from '#/engine/bot/debug/BotDebugTypes.js';
import { PlayerStatNameMap } from '#/engine/entity/PlayerStat.js';

// ── Shared NPC claim registry ─────────────────────────────────────────────────
// Module-level set of NPC keys currently targeted by any CombatTask instance.
// Bots skip NPCs in this set so they don't pile onto the same target.
// Key: NPC index when available, otherwise a position+type composite.
const CLAIMED_NPCS = new Set<number>();

function _npcKey(npc: Npc): number {
    const idx = (npc as any).index;
    if (typeof idx === 'number') return idx;
    // Fallback composite — unique enough for the brief duration of a claim
    return npc.x * 100003 + npc.z * 1009 + npc.type;
}

type CombatExtra = {
    npcType?: string;
    npcTypes?: string[];
    hitsToKill?: number;
    itemsGained?: string[];
    npcName?: string;
    npcPrefix?: string;
    npcSuffix?: string;
};

// Melee style rotation: accurate(0)→attack, aggressive(1)→strength, defensive(3)→defence
const TRAIN_CYCLE: Array<{ stat: PlayerStat; style: 0 | 1 | 3 }> = [
    { stat: PlayerStat.ATTACK, style: 0 },
    { stat: PlayerStat.STRENGTH, style: 1 },
    { stat: PlayerStat.DEFENCE, style: 3 }
];

// Worn slots that are considered armor (helm, torso, shield, legs). Does not include weapon (3) or ammo (13).
const ARMOR_WORN_SLOTS = new Set([0, 4, 5, 7]);

// Scimitar tiers ordered best-first; the first entry whose minAtk ≤ player's Attack level is used.
const SCIMITAR_TIERS: Array<{ minAtk: number; itemId: number }> = [
    { minAtk: 40, itemId: Items.RUNE_SCIMITAR    },
    { minAtk: 30, itemId: Items.ADAMANT_SCIMITAR },
    { minAtk: 20, itemId: Items.MITHRIL_SCIMITAR },
    { minAtk: 10, itemId: Items.BLACK_SCIMITAR   },
    { minAtk: 5,  itemId: Items.STEEL_SCIMITAR   },
    { minAtk: 1,  itemId: Items.IRON_SCIMITAR    },
];

// Sharks to maintain in inventory during combat.
const COMBAT_SHARKS = 15;

// Armor sets ordered best-first; the first entry whose minDef ≤ player's Defence level is used.
const ARMOR_SETS: Array<{ minDef: number; pieces: number[] }> = [
    { minDef: 40, pieces: [Items.RUNE_FULL_HELM,    Items.RUNE_PLATEBODY,    Items.RUNE_PLATELEGS,    Items.RUNE_KITESHIELD    ] },
    { minDef: 30, pieces: [Items.ADAMANT_FULL_HELM,  Items.ADAMANT_PLATEBODY,  Items.ADAMANT_PLATELEGS,  Items.ADAMANT_KITESHIELD  ] },
    { minDef: 20, pieces: [Items.MITHRIL_FULL_HELM,  Items.MITHRIL_PLATEBODY,  Items.MITHRIL_PLATELEGS,  Items.MITHRIL_KITESHIELD  ] },
    { minDef: 10, pieces: [Items.BLACK_FULL_HELM,    Items.BLACK_PLATEBODY,    Items.BLACK_PLATELEGS,    Items.BLACK_KITESHIELD    ] },
    { minDef: 5,  pieces: [Items.STEEL_FULL_HELM,    Items.STEEL_PLATEBODY,    Items.STEEL_PLATELEGS,    Items.STEEL_KITESHIELD    ] },
    { minDef: 1,  pieces: [Items.IRON_FULL_HELM,     Items.IRON_PLATEBODY,     Items.IRON_PLATELEGS,     Items.IRON_KITESHIELD     ] },
];

export class CombatTask extends BotTask {
    private step: SkillStep;
    private readonly primaryStat: PlayerStat; // governs location/progression
    private stat: PlayerStat; // current training stat (rotates per kill)
    private trainIndex = 0;
    private readonly noAttackTimeoutTicks = 12; // RS2 rounds are 5-6 ticks; allow ~2 full rounds before timeout

    private state: 'walk' | 'patrol' | 'scan' | 'interact' | 'flee' | 'shop_walk' | 'shop_open' | 'shop_sell' | 'bank_walk' | 'bank_deposit' | 'loot' | 'bury' | 'eat' = 'walk';

    private interactTicks = 0;
    private approachTicks = 0;
    private lastXp = 0;
    private scanFail = 0;
    private fleeTicks = 0;
    private readonly FLEE_TICKS = 12; // run for ~12 ticks before resuming combat

    private lastBuryTime = Date.now();
    private readonly BURY_INTERVAL = 0.1 * 60 * 1000;
    private buryCount = 0;
    private buryWaitTicks = 0;

    private currentNpc: Npc | null = null;
    /** Key of the NPC this instance has claimed in CLAIMED_NPCS, or -1 if none. */
    private claimedNpcKey = -1;

    private readonly stuck = new StuckDetector(30, 4, 2);
    private readonly watchdog = new ProgressWatchdog(150);

    private intentCooldown = 0;

    private patrolTarget: [number, number] | null = null;
    private patrolTicks = 0;

    private hasFoughtInArea = false;

    /** True once we've done the initial weapon equip-from-inventory on first walk. */
    private _startEquipDone = false;

    /** Cached from the last tick so reset() can unequip armor without a player parameter. */
    private _lastPlayer: Player | null = null;

    constructor(step: SkillStep, stat: PlayerStat) {
        super('Combat');
        this.step = step;
        this.primaryStat = stat;
        this.stat = TRAIN_CYCLE[0].stat; // always start on attack
        this.watchdog.destination = step.location;
    }

    // ─────────────────────────────────────────────
    // LOGGING
    // ─────────────────────────────────────────────
    private lastLogKey = '';
    private lastLogTime = 0;

    private _log(player: Player | null, msg: string, key?: string): void {
        const now = Date.now();
        const logKey = key ?? msg;

        if (this.lastLogKey === logKey && now - this.lastLogTime < 750) return;

        this.lastLogKey = logKey;
        this.lastLogTime = now;

        const prefix = player ? `[P:${player.x},${player.z}]` : '[BOT]';
        console.log(`${prefix} [CombatTask] ${msg}`);
    }

    shouldRun(player: Player): boolean {
        return this.step.toolItemIds.every(id => hasItem(player, id));
    }

    tick(player: Player): void {
        const now = Date.now();
        this._lastPlayer = player;

        if (this.interrupted) return;

        const banking = this.state === 'bank_walk' || this.state === 'bank_deposit';

        if (this.watchdog.check(player, banking)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this._log(player, 'WATCHDOG TRIGGERED → teleported to destination, restarting scan', 'watchdog');
            this.stuck.reset();
            this._releaseNpc();
            this.currentNpc = null;
            this.scanFail = 0;
            this.fleeTicks = 0;
            this.cooldown = 0;
            this.state = 'walk';
            return;
        }

        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }

        if (this.intentCooldown > 0) this.intentCooldown--;

        // ── HP CHECK & HEALING ───────────────────────────────────────────────────
        const hp = player.stats[PlayerStat.HITPOINTS];
        const maxHp = player.baseLevels[PlayerStat.HITPOINTS];

        // Low HP check
        if (hp < maxHp * 0.4 && this.state !== 'bank_walk' && this.state !== 'bank_deposit' && this.state !== 'flee' && this.state !== 'eat') {
             if (this._hasFood(player)) {
                 this._log(player, `HP low (${hp}/${maxHp}), eating...`, 'heal_trigger');
                 this.state = 'eat';
                 return;
             } else {
                 this._log(player, `HP low (${hp}/${maxHp}) and NO FOOD, fleeing!`, 'flee_low_hp');
                 this._releaseNpc();
                 this.currentNpc = null;
                 this.state = 'flee';
                 this.fleeTicks = 0;
                 return;
             }
        }

        // ── AGGRESSOR DETECTION ──────────────────────────────────────────────────
        // If an NPC that we did not initiate combat with starts chasing the bot
        // and its combat level exceeds the bot's, retreat to the spawn area.
        // Skip this check while banking/shopping — the bot is already leaving.
        const safeStates = ['bank_walk', 'bank_deposit', 'flee', 'bury', 'eat', 'interact'];
        if (!safeStates.includes(this.state)) {
            const aggressor = findAggressorNpc(player, 8);
            if (aggressor && aggressor !== this.currentNpc) {
                const npcLvl = getNpcCombatLevel(aggressor);
                if (npcLvl > player.combatLevel) {
                    this._log(player, `fleeing from lvl-${npcLvl} ${this._npcLabel(aggressor)}`, 'flee_trigger');
                    this._releaseNpc();
                    this.currentNpc = null;
                    this.state = 'flee';
                    this.fleeTicks = 0;
                    return;
                }
            }
        }

        const hasBones = hasItem(player, Items.BONES) || hasItem(player, Items.BIG_BONES);

        const inventoryFull = isInventoryFull(player);
        const timeReady = now - this.lastBuryTime >= this.BURY_INTERVAL;
        const shouldBury = hasBones && timeReady;

        if (this.state !== 'bury' && shouldBury) {
            this.state = 'bury';
            this._log(player, '→ bury bones', 'bury_bones');
            return;
        }

        if (this.state === 'bury') {
            const inv = player.getInventory(InvType.INV);
            if (!inv) {
                this.state = 'scan';
                return;
            }

            // BIG BONES FIRST
            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item) continue;

                if (item.id === Items.BIG_BONES) {
                    const moved = inv.remove(item.id, 1);

                    if (moved.completed > 0) {
                        addXp(player, PlayerStat.PRAYER, 150);
                        this._log(player, 'buried big bones +150 XP', 'bury_big');
                        this.cooldown = randInt(2, 4);
                    }

                    return;
                }
            }

            // NORMAL BONES
            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item) continue;

                if (item.id === Items.BONES) {
                    interactHeldOp(player, inv, item.id, slot, 1);
                    this._log(player, 'buried bones +45 XP', 'bury_small');
                    this.cooldown = randInt(2, 4);
                    return;
                }
            }

            // but wait 1 extra tick as a safety net before giving up.
            this.buryWaitTicks++;
            if (this.buryWaitTicks < 2) {
                return;
            }

            // All bones buried or server never delivered
            this._log(player, 'finished burying', 'bury_done');
            this.lastBuryTime = now;
            this.buryCount = 0;
            this.buryWaitTicks = 0;
            this.state = 'scan';
            return;
        }

        // ── LEVEL UPDATE ─────────────────────────────
        const level = getBaseLevel(player, this.primaryStat);
        const skillName = this.primaryStat === PlayerStat.ATTACK ? 'ATTACK' : this.primaryStat === PlayerStat.STRENGTH ? 'STRENGTH' : 'DEFENCE';

        const newStep = getProgressionStep(skillName, level);
        if (newStep && newStep.minLevel > this.step.minLevel) {
            this._log(player, `LEVEL UP → ${this.step.minLevel} → ${newStep.minLevel}`, 'level_up');
            this.step = newStep;
            this.watchdog.destination = newStep.location;
            this.state = 'walk';
            this.currentNpc = null;
            this.scanFail = 0;
            this.patrolTarget = null;
            this.patrolTicks = 0;
        }

        // ── INVENTORY FULL ───────────────────────────
        if (isInventoryFull(player) && !['bank_walk', 'bank_deposit', 'shop_walk', 'shop_open', 'shop_sell'].includes(this.state)) {
            // Check if we have junk to sell - prefer shop over banking
            if (this._hasJunkToSell(player)) {
                this._log(player, 'INVENTORY FULL → shop_walk (selling junk)', 'inv_full');
                this.state = 'shop_walk';
            } else {
                this._log(player, 'INVENTORY FULL → bank_walk', 'inv_full');
                this.state = 'bank_walk';
            }
            this.currentNpc = null;
            return;
        }

        // ── DUNGEON EXIT ──────────────────────────────
        // If the bot is underground (z > 6000) and needs to bank or shop,
        // teleJump back to the surface dungeon entrance first so the surface
        // pathfinder can take over.
        if ((this.state === 'bank_walk' || this.state === 'shop_walk') && player.z > 6000) {
            const [ex, ez, el] = Locations.TAVERLY_DUNGEON_ENTRANCE;
            botTeleport(player, ex, ez, el);
            return;
        }

        // ── SHOP ──────────────────────────────────────
        if (this.state === 'shop_walk') {
            const [sx, sz, sl] = Locations.LUMBRIDGE_GENERAL;

            if (!isNear(player, sx, sz, 8, sl)) {
                this._stuckWalk(player, sx, sz);
                return;
            }

            const shopNpc = findNpcByName(player.x, player.z, player.level, 'generalshopkeeper1', 10);
            if (!shopNpc) return;

            interactNpcOp(player, shopNpc, 3);
            this.currentNpc = shopNpc;
            this.state = 'shop_open';
            this.cooldown = 2;
            return;
        }

        if (this.state === 'shop_open') {
            this.cooldown = 2;
            this.state = 'shop_sell';
            return;
        }

        if (this.state === 'shop_sell') {
            if (!this.currentNpc) {
                this.state = 'bank_walk';
                return;
            }

            this._sellJunk(player, this.currentNpc);

            if (!isInventoryFull(player)) {
                this.state = 'bank_walk';
                this.currentNpc = null;
            }

            return;
        }

        // ── BANK ──────────────────────────────────────
        if (this.state === 'bank_walk') {
            const result = advanceBankWalk(player, this.stuck);
            if (result === 'walk') return;
            this.cooldown = result === 'ready' ? 3 : 0;
            this.state = 'bank_deposit';
            return;
        }

        if (this.state === 'bank_deposit') {
            this._unequipArmor(player);    // WORN armor → INV so it can be banked
            _equipLoot(player);
            cleanGrimyHerbs(player);
            this._depositGold(player);
            this._depositLoot(player);     // deposits unequipped armor too
            this._withdrawSharks(player);        // top up to COMBAT_SHARKS sharks
            this._withdrawFood(player);          // fallback food if no sharks in bank
            this._withdrawAndEquipArmor(player); // withdraw + equip best armor for defence level
            this._withdrawAndEquipWeapon(player); // withdraw + equip best scimitar for attack level
            this._rerollStep(player); // re-randomise location for the next run

            this.state = 'walk';
            this.cooldown = 3;
            return;
        }

        // ── WALK ──────────────────────────────────────
        if (this.state === 'walk') {
            // On first entry to walk (task just started or re-assigned after another task),
            // equip any weapon that accumulated in inventory (e.g. sword drops from a
            // previous RangedMagicTask run).  _equipLoot is also called after banking, so
            // this only matters for the very first walk before the first bank trip.
            if (!this._startEquipDone) {
                _equipLoot(player);
                this._startEquipDone = true;
            }

            // Check for loot only if:
            // 1. Bot is near the combat area (within 20 tiles)
            // 2. Has fought in this area before
            const [lx, lz, ll] = this.step.location;
            const inCombatArea = isNear(player, lx, lz, 20, ll);

            if (inCombatArea && this.hasFoughtInArea) {
                const lootObj = findLootObj(player, player.x, player.z, player.level, 1);
                if (lootObj) {
                    this.state = 'loot';
                    return;
                }
            }

            if (!isNear(player, lx, lz, 15, ll)) {
                // ── Dungeon navigation ─────────────────────────────────────────
                // Combat steps with extra.dungeon=true target underground areas
                // (z > 6000). The pathfinder cannot route across the surface/dungeon
                // boundary, so we walk the bot to the entrance then teleJump inside.
                const extra = this.step.extra as { dungeon?: boolean } | undefined;
                if (extra?.dungeon && lz > 6000 && player.z < 6000) {
                    const [ex, ez] = Locations.TAVERLY_DUNGEON_ENTRANCE;
                    if (!isNear(player, ex, ez, 6)) {
                        this._stuckWalk(player, ex, ez);
                        return;
                    }
                    // At entrance — teleJump to dungeon floor just inside
                    const [fx, fz, fl] = Locations.TAVERLY_DUNGEON_FLOOR;
                    botTeleport(player, fx, fz, fl);
                    return;
                }

                // Via waypoint: route through intermediate coord before destination.
                // Used to steer around obstacles (e.g. Draynor Mansion for Barbarian
                // Village combat area).  Only apply when the bot hasn't yet passed it.
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

        // ── EAT ──────────────────────────────────────
        if (this.state === 'eat') {
            this._eatFood(player);
            return;
        }

        // ── FLEE ──────────────────────────────────────
        // Run back toward the spawn area until clear of the aggressor.
        // walkTo automatically uses MoveSpeed.RUN when runenergy >= 30 %.
        if (this.state === 'flee') {
            // Check for loot only if near combat area and has fought before
            const [flx, flz] = this.step.location;
            const inCombatArea = isNear(player, flx, flz, 20);
            if (inCombatArea && this.hasFoughtInArea) {
                const lootObj = findLootObj(player, player.x, player.z, player.level, 5);
                if (lootObj) {
                    this.state = 'loot';
                    return;
                }
            }

            this.fleeTicks++;
            const [lx, lz] = this.step.location;
            this._stuckWalk(player, lx, lz);

            if (this.fleeTicks >= this.FLEE_TICKS || isNear(player, lx, lz, 12)) {
                this._log(player, 'fled to safety → scan', 'flee_done');
                this.state = 'scan';
                this.fleeTicks = 0;
                this.scanFail = 0;
            }
            return;
        }

        // ── PATROL ────────────────────────────────────
        if (this.state === 'patrol') {
            // Check for loot only if near combat area and has fought before
            const [lx, lz] = this.step.location;
            const inCombatArea = isNear(player, lx, lz, 20);
            if (inCombatArea && this.hasFoughtInArea) {
                const lootObj = findLootObj(player, player.x, player.z, player.level, 5);
                if (lootObj) {
                    this.state = 'loot';
                    return;
                }
            }

            const [cx, cz] = this.step.location;
            const [jcx, jcz] = botJitter(player, cx, cz, 8);

            // Try to open nearby gates while patrolling — handles cases where
            // the combat area is behind a fence the bot hasn't opened yet.
            if (this.intentCooldown === 0 && openNearbyGate(player, 8)) {
                this.intentCooldown = 4;
            }

            this.patrolTicks++;

            if (!this.patrolTarget || this.patrolTicks % randInt(3, 6) === 0) {
                this.patrolTarget = [jcx + randInt(-8, 8), jcz + randInt(-8, 8)];
            }

            const [tx, tz] = this.patrolTarget;
            walkTo(player, tx, tz);

            if (this.patrolTicks % 2 === 0) {
                let npc = this._findTargetNpc(player);

                if (!npc) {
                    npc = this._findTargetNpcWider(player);
                }

                if (npc) {
                    this._log(player, `patrol found NPC → ${this._npcLabel(npc)}`, 'patrol_found');

                    // Walk into melee range before engaging — prevents the engine
                    // routing backward when the NPC is partially obstructed.
                    if (!isNear(player, npc.x, npc.z, 5)) {
                        walkTo(player, npc.x, npc.z);
                        return;
                    }

                    this._claimNpc(npc);
                    this.currentNpc = npc;
                    setCombatStyle(player, TRAIN_CYCLE[this.trainIndex].style);
                    interactNpcOp(player, npc, 2);

                    this.state = 'interact';
                    this.interactTicks = 0;
                    this.approachTicks = 0;
                    this.lastXp = player.stats[this.stat];
                    this.scanFail = 0;
                    this.hasFoughtInArea = true;
                    return;
                }
            }

            if (this.patrolTicks > randInt(6, 12)) {
                this.state = 'scan';
                this.patrolTicks = 0;
                this.patrolTarget = null;
            }

            return;
        }

        // ── SCAN ──────────────────────────────────────
        if (this.state === 'scan') {
            // Check for loot only if near combat area and has fought before
            const [lx, lz] = this.step.location;
            const inCombatArea = isNear(player, lx, lz, 20);
            if (inCombatArea && this.hasFoughtInArea) {
                const lootObj = findLootObj(player, player.x, player.z, player.level, 5);
                if (lootObj) {
                    this.state = 'loot';
                    return;
                }
            }

            if (this.intentCooldown === 0) {
                if (openNearbyGate(player, 30)) {
                    this._log(player, 'opened gate during scan', 'gate_open_scan');
                    this.intentCooldown = 4;
                    return;
                }
            }

            let npc = this._findTargetNpc(player);

            if (!npc) {
                this.scanFail++;

                if (this.scanFail <= 2) {
                    this._log(player, `scan fail ${this.scanFail}`, 'scan_fail');
                }

                if (this.scanFail === 2) {
                    npc = this._findTargetNpcWider(player);
                }

                if (this.scanFail === 3) {
                    this._stuckWalk(player, player.x + randInt(-4, 4), player.z + randInt(-4, 4));
                    return;
                }

                if (this.scanFail >= 4) {
                    this.scanFail = 0;
                    this.state = 'patrol';
                }

                return;
            }

            this._log(player, `found NPC → ${this._npcLabel(npc)}`, 'npc_found');

            // Walk into melee range before engaging — prevents the engine
            // routing backward when the NPC is partially obstructed.
            if (!isNear(player, npc.x, npc.z, 5)) {
                walkTo(player, npc.x, npc.z);
                return;
            }

            this._claimNpc(npc);
            this.currentNpc = npc;
            setCombatStyle(player, TRAIN_CYCLE[this.trainIndex].style);
            interactNpcOp(player, npc, 2);

            this.state = 'interact';
            this.interactTicks = 0;
            this.approachTicks = 0;
            this.lastXp = player.stats[this.stat];
            this.scanFail = 0;
            this.hasFoughtInArea = true;
            return;
        }

        // ── LOOT ──────────────────────────────────────
        if (this.state === 'loot') {
            // Blocklist: items to skip picking up
            const BLOCKLIST = [288]; // goblin mail

            // Find any ground object - picks up everything
            let obj = findLootObj(player, player.x, player.z, player.level, 5);

            // Skip blocked items
            if (obj && BLOCKLIST.includes(obj.type)) {
                obj = null;
            }

            if (!obj) {
                this.state = 'interact';
                return;
            }

            this._log(player, `looting ${obj.type} @ ${obj.x},${obj.z}`, 'loot_found');

            if (!isNear(player, obj.x, obj.z, 1)) {
                walkTo(player, obj.x, obj.z);
                return;
            }

            interactObjOp(player, obj, 3);
            this.cooldown = randInt(1, 2);
            this.state = 'scan';
            return;
        }

        // ── COMBAT ───────────────────────────────────
        if (this.state === 'interact') {
            this.interactTicks++;
            this.approachTicks++;

            if (player.stats[this.stat] > this.lastXp) {
                // Hit landed — award bonus XP to a random melee stat.
                const roll = randInt(0, 2);
                let stat: PlayerStat;
                if (roll === 0) stat = PlayerStat.ATTACK;
                else if (roll === 1) stat = PlayerStat.STRENGTH;
                else stat = PlayerStat.DEFENCE;
                addXp(player, stat, 20);
                this._log(player, `hit landed → ${stat}`, 'xp_gain_random');
                this.lastXp = player.stats[this.stat];
                this.interactTicks = 0;
                this.approachTicks = 0; // hit confirmed — NPC is reachable, reset approach timeout
                this.watchdog.notifyActivity();

                // Only move to loot when the NPC is actually gone from the world.
                if (this.currentNpc && this._isNpcAlive(player, this.currentNpc)) {
                    // Still alive — keep fighting; engine interaction persists.
                    return;
                }

                // NPC is dead / despawned — free the claim and go loot.
                this._releaseNpc();
                this.trainIndex = (this.trainIndex + 1) % TRAIN_CYCLE.length;
                this.stat = TRAIN_CYCLE[this.trainIndex].stat;
                this.state = 'loot';
                this.interactTicks = 0;
                this.approachTicks = 0;
                return;
            }

            if (this.interactTicks >= this.noAttackTimeoutTicks) {
                if (this.currentNpc && this._isNpcAlive(player, this.currentNpc)) {
                    // NPC is alive but we haven't landed a hit — a gate or door may be
                    // blocking the approach.  Check for one close-range (12 tiles) before
                    // re-engaging.  openNearbyGate only matches CLOSED doors, so an
                    // already-open gate is transparently skipped and we fall through to
                    // the normal re-engage below.
                    if (openNearbyGate(player, 12)) {
                        this._log(player, 'gate blocking approach to NPC — opened', 'gate_block_npc');
                        this.interactTicks = 0;
                        this.cooldown = 3;
                        return;
                    }

                    // No gate in the way — NPC still alive but interaction dropped, re-engage.
                    this._log(player, 're-engage NPC', 'reengage');
                    setCombatStyle(player, TRAIN_CYCLE[this.trainIndex].style);
                    interactNpcOp(player, this.currentNpc, 2);
                    this.interactTicks = 0;
                    this.approachTicks = 0;
                    return;
                }
                // NPC is gone — stop waiting and scan for another target.
                this._log(player, 'no attack after timeout → NPC gone → loot/scan', 'no_attack_timeout');
                this._releaseNpc();
                this.currentNpc = null;
                this.state = 'loot'; // check for dropped loot first
                this.approachTicks = 0;
                this.interactTicks = 0;
                this.scanFail = 0;
                return;
            }

            if (this.approachTicks >= INTERACT_TIMEOUT) {
                if (openNearbyGate(player, 30)) {
                    this.approachTicks = 0;
                    this.cooldown = 4;
                    return;
                }

                this._releaseNpc();
                this.currentNpc = null;
                this.state = 'scan';
                this.approachTicks = 0;
                this.interactTicks = 0;
                return;
            }

            if (this.interactTicks >= INTERACT_TIMEOUT * 2) {
                this._releaseNpc(); // was missing — ensure claim is freed
                this.currentNpc = null;
                this.state = 'scan';
                this.approachTicks = 0;
                this.interactTicks = 0;
            }
        }
    }

    isComplete(): boolean {
        return false;
    }

    override getDebugInfo(player: Player): BotTaskDebugInfo {
        const [lx, lz, ll] = this.step.location;
        const hp = player.stats[PlayerStat.HITPOINTS];
        const maxHp = player.baseLevels[PlayerStat.HITPOINTS];
        return {
            task: this.name,
            state: this.state,
            target: this.currentNpc ? `${NpcType.get(this.currentNpc.type).debugname ?? 'npc'}@(${this.currentNpc.x},${this.currentNpc.z})` : undefined,
            destination: { x: lx, z: lz, level: ll },
            details: {
                trainingStat: PlayerStatNameMap.get(this.stat) ?? `stat${this.stat}`,
                hp, maxHp,
                interactTicks: this.interactTicks,
                approachTicks: this.approachTicks,
                scanFail: this.scanFail,
                fleeTicks: this.fleeTicks,
                buryCount: this.buryCount,
                stuck: this.stuck.getDebugSnapshot()
            }
        };
    }

    override reset(): void {
        super.reset();

        if (this._lastPlayer) {
            this._unequipArmor(this._lastPlayer);
            this._unequipWeapon(this._lastPlayer);
            this._lastPlayer = null;
        }

        this._releaseNpc(); // ensure any held claim is freed on task reassignment

        this.state = 'walk';
        this.interactTicks = 0;
        this.approachTicks = 0;
        this.lastXp = 0;
        this.scanFail = 0;
        this.currentNpc = null;
        this.intentCooldown = 0;

        this.trainIndex = 0;
        this.stat = TRAIN_CYCLE[0].stat;

        this.patrolTarget = null;
        this.patrolTicks = 0;
        this.fleeTicks = 0;

        this.hasFoughtInArea = false;

        this.lastBuryTime = 0; // expire immediately so timer-fallback fires on first tick with bones
        this.buryCount = 0;
        this.buryWaitTicks = 0;

        this.stuck.reset();
        this.watchdog.reset();
    }

    private _npcLabel(npc: Npc): string {
        const anyNpc = npc as any;
        return anyNpc.type ?? anyNpc.name ?? anyNpc.index ?? 'unknown';
    }

    // ─────────────────────────────────────────────
    // NPC SEARCH
    // ─────────────────────────────────────────────

    /**
     * Returns true if the NPC is available to be targeted:
     *   - not currently in combat (target not set)
     *   - not already claimed by another CombatTask bot
     */
    private _isNpcAvailable(npc: Npc): boolean {
        // Skip NPCs that already have a combat target (being fought by someone else)
        if ((npc as any).target !== null && (npc as any).target !== undefined) return false;
        // Skip NPCs already claimed by another bot this tick
        if (CLAIMED_NPCS.has(_npcKey(npc))) return false;
        return true;
    }

    private _findTargetNpc(player: Player): Npc | null {
        const extra = this.step.extra as CombatExtra | undefined;
        const radius = 22;
        if (!extra) return null;

        const names: string[] = [];
        if (extra.npcTypes?.length) names.push(...extra.npcTypes);
        if (extra.npcType) names.push(extra.npcType);
        if (extra.npcName) names.push(extra.npcName);

        for (const name of names.sort(() => Math.random() - 0.5)) {
            const npc = findNpcFiltered(player.x, player.z, player.level, npc => npcMatchesName(npc, name) && this._isNpcAvailable(npc), radius);
            if (npc) return npc;
        }

        if (extra.npcPrefix) {
            return findNpcFiltered(player.x, player.z, player.level, npc => !!NpcType.get(npc.type).debugname?.startsWith(extra.npcPrefix!) && this._isNpcAvailable(npc), radius);
        }

        if (extra.npcSuffix) {
            return findNpcFiltered(player.x, player.z, player.level, npc => !!NpcType.get(npc.type).debugname?.endsWith(extra.npcSuffix!) && this._isNpcAvailable(npc), radius);
        }

        return null;
    }

    private _findTargetNpcWider(player: Player): Npc | null {
        const extra = this.step.extra as CombatExtra | undefined;
        const radius = 30;
        if (!extra) return null;

        const names: string[] = [];
        if (extra.npcTypes?.length) names.push(...extra.npcTypes);
        if (extra.npcType) names.push(extra.npcType);
        if (extra.npcName) names.push(extra.npcName);

        for (const name of names.sort(() => Math.random() - 0.5)) {
            const npc = findNpcFiltered(player.x, player.z, player.level, npc => npcMatchesName(npc, name) && this._isNpcAvailable(npc), radius);
            if (npc) return npc;
        }

        return null;
    }

    // ─────────────────────────────────────────────
    // NPC ALIVE CHECK
    // ─────────────────────────────────────────────

    /**
     * Returns true if the NPC object still exists in the world near the player.
     * Uses an object-reference comparison so we never confuse a respawned NPC
     * of the same type with the original target.
     */
    private _isNpcAlive(player: Player, npc: Npc): boolean {
        return findNpcFiltered(player.x, player.z, player.level, n => n === npc, 30) !== null;
    }

    // ─────────────────────────────────────────────
    // NPC CLAIM REGISTRY
    // ─────────────────────────────────────────────

    /** Register this bot's current target so other bots skip it. */
    private _claimNpc(npc: Npc): void {
        this._releaseNpc();
        this.claimedNpcKey = _npcKey(npc);
        CLAIMED_NPCS.add(this.claimedNpcKey);
    }

    /** Release the current claim (NPC died, timed out, or task reset). */
    private _releaseNpc(): void {
        if (this.claimedNpcKey !== -1) {
            CLAIMED_NPCS.delete(this.claimedNpcKey);
            this.claimedNpcKey = -1;
        }
    }

    // ─────────────────────────────────────────────
    // STUCK SYSTEM
    // ─────────────────────────────────────────────
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

        if (openNearbyGate(player, 30)) {
            this.intentCooldown = 3;
            return;
        }

        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }

    // ─────────────────────────────────────────────
    // STEP RE-ROLL
    // ─────────────────────────────────────────────

    /**
     * After each bank trip, pick a fresh random step from all tiers the bot
     * qualifies for (level + tool ownership).  This spreads bots across
     * locations every inventory cycle instead of every level-up.
     */
    private _rerollStep(player: Player): void {
        const level = getBaseLevel(player, this.primaryStat);
        const skillName = this.primaryStat === PlayerStat.ATTACK ? 'ATTACK' : this.primaryStat === PlayerStat.STRENGTH ? 'STRENGTH' : 'DEFENCE';
        const newStep = getProgressionStep(skillName, level, ids => ids.every(id => hasItem(player, id)));
        if (newStep) {
            this.step = newStep;
            this.watchdog.destination = newStep.location;
            this.patrolTarget = null;
        }
    }

    // ─────────────────────────────────────────────
    // SHOP + BANK
    // ─────────────────────────────────────────────
    // ─────────────────────────────────────────────
    // SHOP + BANK
    // ─────────────────────────────────────────────
    private _hasJunkToSell(player: Player): boolean {
        const inv = player.getInventory(InvType.INV);
        if (!inv) return false;

        const protectedItems = new Set(this.step.toolItemIds);

        // Check if any item can be sold (not a tool item, not coins, not a banked herb/talisman)
        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;
            if (protectedItems.has(item.id)) continue;
            if (item.id === Items.COINS) continue;
            if (GRIMY_HERB_MAP[item.id] !== undefined) continue; // grimy herb → bank
            if (item.id === Items.AIR_TALISMAN) continue; // talisman → bank
            return true;
        }

        return false;
    }

    private _sellJunk(player: Player, shopNpc: Npc): void {
        //<- shopNpc isn't needed anymore
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        const protectedItems = new Set(this.step.toolItemIds);

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;

            if (protectedItems.has(item.id)) continue;
            if (item.id === Items.COINS) continue; //<- also not needed anymore.
            if (GRIMY_HERB_MAP[item.id] !== undefined) continue; // grimy herb → bank
            if (item.id === Items.AIR_TALISMAN) continue; // talisman → bank

            if (interactIF_UseOp(player, Interfaces.SHOP_SIDE_INV, item.id, slot, 4)) {
                //info: Op 4 is sell 10 (Op1 value, op2 sell 1, op3 sell 5, op4 sell 10)(for SHOP_SIDE) Interfaces.SHOP_INV for buy
                console.log('(' + player.displayName + ') successfully sold item to shop: ' + item.id);
            } else {
                console.log('Could not sell item to shop! (' + item.id + ') for (' + player.displayName + ')');
            }
            //todo: check if more than 10 and repeat interfaceIF_UseOp
        }
    }

    private _depositGold(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;

        const bank = player.getInventory(bid);
        if (!bank) return;

        // Keep 200gp in inventory — enough for ~20 Al Kharid gate passes (10gp each)
        // so the bot can exit after banking and reach its next task location.
        // Depositing every coin leaves the bot stranded inside gated areas.
        const KEEP_COINS = 200;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item || item.id !== Items.COINS) continue;

            const toDeposit = Math.max(0, item.count - KEEP_COINS);
            if (toDeposit > 0) {
                const moved = inv.remove(item.id, toDeposit);
                if (moved.completed > 0) bank.add(Items.COINS, moved.completed);
            }
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

                // Use the food
                interactHeldOp(player, inv, foodId, slot, 1);
                this._log(player, `ate ${foodId} to heal`, 'ate_food');
                this.cooldown = 3;

                // After eating, if HP is still relatively low and we have more food,
                // stay in eat state. Otherwise return to previous activity.
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

    /** Move equipped armor (helm, torso, shield, legs) from WORN back to INV. */
    private _unequipArmor(player: Player): void {
        const equip = player.getInventory(InvType.WORN);
        const inv   = player.getInventory(InvType.INV);
        if (!equip || !inv) return;

        for (let slot = 0; slot < equip.capacity; slot++) {
            if (!ARMOR_WORN_SLOTS.has(slot)) continue;
            const item = equip.get(slot);
            if (!item) continue;
            const moved = equip.remove(item.id, 1);
            if (moved.completed > 0) inv.add(item.id, 1);
        }
    }

    /** Move the equipped scimitar from WORN slot 3 back to INV (used on task end). */
    private _unequipWeapon(player: Player): void {
        const equip = player.getInventory(InvType.WORN);
        const inv   = player.getInventory(InvType.INV);
        if (!equip || !inv) return;

        const wornWeapon = equip.get(3);
        if (!wornWeapon) return;
        // Only unequip if it's a scimitar from our managed set.
        if (!SCIMITAR_TIERS.some(s => s.itemId === wornWeapon.id)) return;

        const moved = equip.remove(wornWeapon.id, 1);
        if (moved.completed > 0) inv.add(wornWeapon.id, 1);
    }

    /** Withdraw the best armor set the bot qualifies for (based on Defence) and equip it. */
    private _withdrawAndEquipArmor(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        const defLevel = getBaseLevel(player, PlayerStat.DEFENCE);
        const set = ARMOR_SETS.find(s => defLevel >= s.minDef);
        if (!set) return;

        for (const pieceId of set.pieces) {
            if (hasItem(player, pieceId)) continue; // already in inv (shouldn't happen after deposit)
            for (let i = 0; i < bank.capacity; i++) {
                const it = bank.get(i);
                if (!it || it.id !== pieceId) continue;
                const moved = bank.remove(pieceId, 1);
                if (moved.completed > 0) inv.add(pieceId, 1);
                break;
            }
        }

        _equipLoot(player); // equip whatever we just withdrew
    }

    /**
     * Equip the best scimitar the bot qualifies for based on Attack level.
     * Unequips and banks the current weapon first if it needs upgrading.
     */
    private _withdrawAndEquipWeapon(player: Player): void {
        const inv   = player.getInventory(InvType.INV);
        const equip = player.getInventory(InvType.WORN);
        const bid   = bankInvId();
        if (!inv || !equip || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        const atkLevel  = getBaseLevel(player, PlayerStat.ATTACK);
        const targetIdx = SCIMITAR_TIERS.findIndex(s => atkLevel >= s.minAtk);
        if (targetIdx === -1) return;
        const targetId = SCIMITAR_TIERS[targetIdx].itemId;

        // Check weapon slot (3) — skip if already wearing equal or better scimitar.
        const wornWeapon = equip.get(3);
        if (wornWeapon) {
            const wornIdx = SCIMITAR_TIERS.findIndex(s => s.itemId === wornWeapon.id);
            if (wornIdx !== -1 && wornIdx <= targetIdx) return; // already at correct tier or better
            // Unequip old weapon → INV, then bank it.
            const unequipped = equip.remove(wornWeapon.id, 1);
            if (unequipped.completed > 0) {
                inv.add(wornWeapon.id, 1);
                for (let i = 0; i < inv.capacity; i++) {
                    const it = inv.get(i);
                    if (!it || it.id !== wornWeapon.id) continue;
                    const dm = inv.remove(wornWeapon.id, 1);
                    if (dm.completed > 0) bank.add(wornWeapon.id, 1);
                    break;
                }
            }
        }

        // Withdraw target scimitar from bank if not already in inventory.
        if (!hasItem(player, targetId)) {
            for (let i = 0; i < bank.capacity; i++) {
                const it = bank.get(i);
                if (!it || it.id !== targetId) continue;
                const moved = bank.remove(targetId, 1);
                if (moved.completed > 0) inv.add(targetId, 1);
                break;
            }
        }

        _equipLoot(player);
    }

    /** Top up inventory with cooked sharks from the bank (up to COMBAT_SHARKS). */
    private _withdrawSharks(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;
        const bank = player.getInventory(bid);
        if (!bank) return;

        const current = countItem(player, Items.SHARK);
        const needed  = COMBAT_SHARKS - current;
        if (needed <= 0) return;

        for (let i = 0; i < bank.capacity; i++) {
            const it = bank.get(i);
            if (!it || it.id !== Items.SHARK) continue;
            const amount = Math.min(needed, it.count);
            const moved  = bank.remove(Items.SHARK, amount);
            if (moved.completed > 0) inv.add(Items.SHARK, moved.completed);
            break;
        }
    }

    private _depositLoot(player: Player): void {
        const inv = player.getInventory(InvType.INV);
        const bid = bankInvId();
        if (!inv || bid === -1) return;

        const bank = player.getInventory(bid);
        if (!bank) return;

        for (let slot = 0; slot < inv.capacity; slot++) {
            const item = inv.get(slot);
            if (!item) continue;

            if (this.step.toolItemIds.includes(item.id)) continue;
            if (item.id === Items.COINS) continue;
            if (FOOD_IDS.includes(item.id)) continue;

            const moved = inv.remove(item.id, item.count);
            if (moved.completed > 0) {
                bank.add(item.id, moved.completed);
            }
        }
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

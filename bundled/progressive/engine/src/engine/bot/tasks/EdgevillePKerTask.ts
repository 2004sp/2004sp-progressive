import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import ObjType from '#/cache/config/ObjType.js';
import {
    BotTask,
    walkTo,
    isNear,
    randInt,
    PlayerStat,
    hasItem,
    addItem,
    removeItem,
    countItem,
    isInventoryFull,
    teleportNear,
    StuckDetector,
    ProgressWatchdog,
    Items,
    FOOD_IDS,
} from '#/engine/bot/tasks/BotTaskBase.js';
import {
    interactPlayerOp,
    interactHeldOp,
    interactIfButtonByName,
    setVarp,
    _wornContains,
} from '#/engine/bot/BotAction.js';
import World from '#/engine/World.js';
import InvType from '#/cache/config/InvType.js';
import { botWalkPath } from '#/engine/GameMap.js';

const I = {
    RUNE_SCIMITAR: 1333,
    DRAGON_DAGGER: 1215,
    DRAGON_DAGGER_P: 1231,
    DRAGON_LONGSWORD: 1305,
    DRAGON_BATTLEAXE: 1377,
    MAGIC_SHORTBOW: 861,
    RUNE_ARROW: 892,
    COIF: 1169,
    MONK_ROBE_TOP: 544,
    GREEN_DHIDE_BODY: 1135,
    BLUE_DHIDE_BODY: 2499,
    RED_DHIDE_BODY: 2501,
    BLACK_DHIDE_BODY: 2503,
    GREEN_DHIDE_CHAPS: 1099,
    BLUE_DHIDE_CHAPS: 2493,
    RED_DHIDE_CHAPS: 2495,
    BLACK_DHIDE_CHAPS: 2497,
    RUNE_FULL_HELM: 1163,
    DRAGON_MED_HELM: 1149,
    RUNE_PLATEBODY: 1127,
    RUNE_PLATELEGS: 1079,
    RUNE_KITESHIELD: 1201,
    AMULET_OF_GLORY: 1704,
    AMULET_OF_STRENGTH: 1725,
    LEATHER_BOOTS: 1061,
    GREEN_DHIDE_VAMBRACES: 1065,
    BLUE_DHIDE_VAMBRACES: 2487,
    RED_DHIDE_VAMBRACES: 2489,
    BLACK_DHIDE_VAMBRACES: 2491,
    LOBSTER: 379,
    SWORDFISH: 373,
    SHARK: 385,
    SUPER_ATTACK4: 2436,
    SUPER_STRENGTH4: 2440,
    SUPER_DEFENCE4: 2442,
    PRAYER_POTION4: 2434,
    SUPER_RESTORE4: 3024,
    BLACK_CAPE: 1019,
    BLUE_CAPE: 1021,
    YELLOW_CAPE: 1023,
    GREEN_CAPE: 1027,
    PURPLE_CAPE: 1029,
    ORANGE_CAPE: 1031,
    LEGENDS_CAPE: 1052,
    SARADOMIN_CAPE: 2412,
    GUTHIX_CAPE: 2413,
    ZAMORAK_CAPE: 2414,
};

const COMMON_CAPES = [I.BLACK_CAPE, I.BLUE_CAPE, I.YELLOW_CAPE, I.GREEN_CAPE, I.PURPLE_CAPE, I.ORANGE_CAPE, I.SARADOMIN_CAPE, I.GUTHIX_CAPE, I.ZAMORAK_CAPE];
const PURE_HATS = [1169, 2633, 2635, 2637, 2639, 2641, 2643, 2645, 2647, 2649, 979];
const DHIDE_BODIES: [number, number, number][] = [
    [I.GREEN_DHIDE_BODY, 40, 1],
    [I.BLUE_DHIDE_BODY, 50, 1],
    [I.RED_DHIDE_BODY, 60, 1],
    [I.BLACK_DHIDE_BODY, 70, 1],
];
const DHIDE_CHAPS: [number, number, number][] = [
    [I.GREEN_DHIDE_CHAPS, 40, 1],
    [I.BLUE_DHIDE_CHAPS, 50, 1],
    [I.RED_DHIDE_CHAPS, 60, 1],
    [I.BLACK_DHIDE_CHAPS, 70, 1],
];
const DHIDE_VAMBS: [number, number, number][] = [
    [I.GREEN_DHIDE_VAMBRACES, 40, 1],
    [I.BLUE_DHIDE_VAMBRACES, 50, 1],
    [I.RED_DHIDE_VAMBRACES, 60, 1],
    [I.BLACK_DHIDE_VAMBRACES, 70, 1],
];

const GL_PHRASES = ['Gl', 'Gl noob', 'Attack is a newb so ill take my anger out on you'];

interface PkerProfile {
    name: string;
    atk: number; str: number; def: number; hp: number; range: number; pray: number;
    weapon: number;
    specWeapon: number;
    rangeWeapon: number;
    ammo: number;
    helm: number;
    body: number;
    legs: number;
    shield: number;
    neck: number;
    cape: number;
    boots: number;
    gloves: number;
    food: number;
    pots: number[];
}

function bestByLevel(items: [number, number, number][], level: number): number {
    let best = items[0]![0];
    for (const [id, req] of items) {
        if (level >= req) best = id;
    }
    return best;
}

function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateProfiles(): PkerProfile[] {
    const profiles: PkerProfile[] = [];

    const strOpts = [60, 65, 70, 75, 80, 85, 90, 95, 99];
    const rangeOpts = [61, 65, 70, 75, 80, 85, 90, 99];
    const prayOpts = [1, 15, 31, 44, 52, 70];

    for (let i = 0; i < 30; i++) {
        const str = strOpts[i % strOpts.length]!;
        const range = rangeOpts[Math.floor(i / 3) % rangeOpts.length]!;
        const pray = prayOpts[Math.floor(i / 7) % prayOpts.length]!;
        const hp = Math.max(40, Math.min(99, 25 + Math.floor(str * 0.65)));

        const body = bestByLevel(DHIDE_BODIES, range);
        const legs = bestByLevel(DHIDE_CHAPS, range);
        const gloves = bestByLevel(DHIDE_VAMBS, range);

        profiles.push({
            name: `pure-${i}`,
            atk: 60, str, def: 1, hp, range, pray,
            weapon: I.RUNE_SCIMITAR,
            specWeapon: pick([I.DRAGON_DAGGER_P, I.DRAGON_LONGSWORD, I.MAGIC_SHORTBOW]),
            rangeWeapon: I.MAGIC_SHORTBOW,
            ammo: I.RUNE_ARROW,
            helm: pick(PURE_HATS),
            body: i % 3 === 0 ? I.MONK_ROBE_TOP : body,
            legs,
            shield: -1,
            neck: pick([I.AMULET_OF_STRENGTH, I.AMULET_OF_GLORY]),
            cape: pick(COMMON_CAPES),
            boots: I.LEATHER_BOOTS,
            gloves,
            food: pick([I.SWORDFISH, I.SHARK]),
            pots: [I.SUPER_ATTACK4, I.SUPER_STRENGTH4].concat(pray > 31 ? [I.PRAYER_POTION4] : []),
        });
    }

    const mainStrOpts = [65, 70, 75, 80, 85, 90, 95, 99];
    const mainDefOpts = [30, 40, 45, 50, 60, 65, 70, 80];
    const mainAtkOpts = [60, 65, 70, 75, 80, 85, 90, 99];

    for (let i = 0; i < 30; i++) {
        const atk = mainAtkOpts[i % mainAtkOpts.length]!;
        const str = mainStrOpts[Math.floor(i / 2) % mainStrOpts.length]!;
        const def = mainDefOpts[Math.floor(i / 3) % mainDefOpts.length]!;
        const hp = Math.max(50, Math.min(99, 35 + Math.floor((str + def) * 0.4)));
        const range = Math.max(50, Math.min(99, 40 + Math.floor(str * 0.5)));
        const pray = pick([31, 44, 52, 60, 70]);

        const hasDragon = atk >= 60;
        const mainWeapon = hasDragon && i % 2 === 0 ? I.DRAGON_LONGSWORD : I.RUNE_SCIMITAR;

        let specWeapon = -1;
        if (hasDragon) {
            specWeapon = mainWeapon === I.DRAGON_LONGSWORD ? I.DRAGON_BATTLEAXE : pick([I.DRAGON_DAGGER_P, I.DRAGON_LONGSWORD, I.MAGIC_SHORTBOW]);
        }

        profiles.push({
            name: `main-${i}`,
            atk, str, def, hp, range, pray,
            weapon: mainWeapon,
            specWeapon,
            rangeWeapon: I.MAGIC_SHORTBOW,
            ammo: I.RUNE_ARROW,
            helm: def >= 60 && i % 3 === 0 ? I.DRAGON_MED_HELM : I.RUNE_FULL_HELM,
            body: I.RUNE_PLATEBODY,
            legs: I.RUNE_PLATELEGS,
            shield: I.RUNE_KITESHIELD,
            neck: I.AMULET_OF_GLORY,
            cape: pick(def >= 60 ? [...COMMON_CAPES, I.LEGENDS_CAPE] : COMMON_CAPES),
            boots: I.LEATHER_BOOTS,
            gloves: I.GREEN_DHIDE_VAMBRACES,
            food: I.SHARK,
            pots: [I.SUPER_ATTACK4, I.SUPER_STRENGTH4].concat(
                str >= 80 ? [I.PRAYER_POTION4] : [],
                def >= 60 ? [I.SUPER_DEFENCE4] : [],
            ),
        });
    }

    return profiles;
}

const PROFILES = generateProfiles();

const EDGEVILLE_CENTER: [number, number, number] = [3093, 3491, 0];
const WILD_ZONE_CX = 3093;
const WILD_Z_MIN = 3526;
const WILD_Z_MAX = 3559;
const WILD_X_RADIUS = 14;
const SCAN_RADIUS = 22;
const DISENGAGE_DIST = 40;
const DIESPAWN_DIST = 120;
const BANK_DIST = 5;
const WILD_Z_START = 3520;

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function wildLevel(z: number): number {
    if (z < WILD_Z_START) return 0;
    return Math.max(1, Math.floor((z - WILD_Z_START) / 8) + 1);
}

function inCombatRange(wildLvl: number, myCb: number, theirCb: number): boolean {
    if (wildLvl <= 0) return false;
    return Math.abs(myCb - theirCb) <= wildLvl;
}

function isFightingAnother(target: Player, self: Player): boolean {
    return target.target != null && 'slot' in target.target && target.target !== self;
}

function getAttacker(player: Player): Player | null {
    for (const p of (World as any).playerLoop.all() as Iterable<Player>) {
        if (p === player || p.slot === -1) continue;
        if (p.target && 'slot' in p.target && (p.target as Player) === player) return p;
    }
    return null;
}

function isTargetClaimed(target: Player, excludeBot: Player): boolean {
    for (const p of (World as any).playerLoop.all() as Iterable<Player>) {
        if (p === target || p === excludeBot) continue;
        if (p.slot === -1) continue;
        const bot = (p as any)._bot;
        if (bot && bot.task instanceof EdgevillePKerTask && bot.task.target === target) return true;
    }
    return false;
}

function findNearbyTarget(bot: Player, radius: number, blacklist?: Map<string, number>): Player | null {
    let best: Player | null = null;
    let bestDist = radius + 1;
    for (const p of (World as any).playerLoop.all() as Iterable<Player>) {
        if (p === bot) continue;
        if (p.level !== bot.level) continue;
        if (p.slot === -1) continue;
        if (isTargetClaimed(p, bot)) continue;
        if (blacklist?.has(p.username)) continue;
        const d = chebyshev(bot.x, bot.z, p.x, p.z);
        if (d < bestDist) { best = p; bestDist = d; }
    }
    return best;
}

function findSlot(inv: { get: (s: number) => { id: number } | null; capacity: number }, itemId: number): number {
    for (let s = 0; s < inv.capacity; s++) {
        const it = inv.get(s);
        if (it && it.id === itemId) return s;
    }
    return -1;
}

function equipItem(player: Player, itemId: number): void {
    if (itemId === -1) return;
    if (_wornContains(player, itemId)) return;
    const inv = player.getInventory(InvType.INV);
    if (!inv) return;
    const slot = findSlot(inv, itemId);
    if (slot === -1) return;
    const oType = ObjType.get(itemId);
    if ((oType.wearpos ?? oType.wearpos2 ?? oType.wearpos3) === 3) {
        setVarp(player, 'com_mode', 43, 0);
        if (!player.delayed && interactHeldOp(player, inv, itemId, slot, 2)) {
            return;
        }
    }
    const worn = player.getInventory(InvType.WORN);
    if (!worn) return;
    const wearSlot = oType.wearpos ?? oType.wearpos2 ?? oType.wearpos3;
    if (wearSlot === null) return;
    const count = inv.get(slot)?.count ?? 1;
    inv.set(slot, null);
    const existing = worn.get(wearSlot);
    if (existing && existing.id !== -1) {
        inv.add(existing.id, existing.count);
    }
    worn.set(wearSlot, { id: itemId, count });
}

function regear(player: Player, p: PkerProfile): void {
    for (const id of [p.weapon, p.helm, p.body, p.legs, p.shield, p.neck, p.cape, p.boots, p.gloves, p.ammo]) {
        if (id === -1) continue;
        if (_wornContains(player, id)) continue;
        if (hasItem(player, id)) {
            equipItem(player, id);
        } else {
            addItem(player, id, 1);
            equipItem(player, id);
        }
    }
}

function tryEquipFromInventory(player: Player, weaponId: number): boolean {
    if (_wornContains(player, weaponId)) return true;
    const inv = player.getInventory(InvType.INV);
    if (!inv) return false;
    const slot = findSlot(inv, weaponId);
    if (slot === -1) return false;
    equipItem(player, weaponId);
    return true;
}

export class EdgevillePKerTask extends BotTask {
    private state: 'init' | 'walk_to_wild' | 'banking' | 'idle' | 'engage' = 'init';
    private profile: PkerProfile | null = null;
    private target: Player | null = null;
    private engageTicks = 0;
    private potsDrunk = 0;
    private wildTargetX = 0;
    private wildTargetZ = 0;
    private specUsesRemaining = 0;
    private stackFixed = false;
    private stackAttempts = 0;
    private stackWalkCooldown = 0;
    private wanderTimer = 0;
    private respawnTimer = 0;
    private gearVersion = 0;
    private static readonly GEAR_VERSION = 1;

    private readonly blacklist = new Map<string, number>();
    private readonly stuck = new StuckDetector(25, 4, 2);
    private readonly watchdog = new ProgressWatchdog(300);

    constructor() {
        super('EdgevillePKer');
    }

    shouldRun(_player: Player): boolean {
        return true;
    }

    tick(player: Player): void {
        if (this.interrupted) return;
        for (const [k, v] of this.blacklist) {
            if (v <= 1) this.blacklist.delete(k);
            else this.blacklist.set(k, v - 1);
        }
        if (this.watchdog.check(player, false)) {
            player.clearWaypoints();
            player.clearPendingAction();
            this.interrupt();
            return;
        }
        if (this.cooldown > 0) {
            this.cooldown--;
            return;
        }
        if (!this.profile) {
            this.profile = PROFILES[Math.floor(Math.random() * PROFILES.length)]!;
        }

        if (this.gearVersion < EdgevillePKerTask.GEAR_VERSION) {
            this.gearVersion = EdgevillePKerTask.GEAR_VERSION;
            this.target = null;
            this.state = 'init';
            this.potsDrunk = 0;
            this.specUsesRemaining = 0;
            this.stackFixed = false;
            this.respawnTimer = randInt(10, 40);
            this.watchdog.notifyActivity();
            return;
        }

        const [ex, ez] = EDGEVILLE_CENTER;
        const dist = chebyshev(player.x, player.z, ex, ez);
        if (this.state !== 'init' && (dist > DIESPAWN_DIST || (dist < 10 && (this.state === 'idle' || this.state === 'engage')))) {
            this.target = null;
            this.state = 'init';
            this.potsDrunk = 0;
            this.specUsesRemaining = 0;
            this.stackFixed = false;
            this.respawnTimer = randInt(10, 40);
            this.watchdog.notifyActivity();
            return;
        }

        const hp = player.levels[PlayerStat.HITPOINTS] ?? 0;
        const maxHp = player.baseLevels[PlayerStat.HITPOINTS] ?? 10;

        if (this.state === 'engage' && hp < maxHp * 0.5) {
            this.eatFood(player);
        }

        switch (this.state) {
            case 'init': return this.handleInit(player);
            case 'walk_to_wild': return this.handleWalkToWild(player);
            case 'banking': return this.handleBanking(player);
            case 'idle': return this.handleIdle(player);
            case 'engage': return this.handleEngage(player);
        }
    }

    isComplete(): boolean {
        return false;
    }

    override reset(): void {
        super.reset();
        this.state = 'init';
        this.target = null;
        this.engageTicks = 0;
        this.potsDrunk = 0;
        this.specUsesRemaining = 0;
        this.stackFixed = false;
        this.stackAttempts = 0;
        this.stackWalkCooldown = 0;
        this.wanderTimer = 0;
        this.respawnTimer = 0;
        this.blacklist.clear();
        this.stuck.reset();
        this.watchdog.reset();
    }

    private handleInit(player: Player): void {
        const p = this.profile!;

        if (player.baseLevels[PlayerStat.ATTACK] !== p.atk) {
            const xp = getExpByLevel(p.atk);
            player.baseLevels[PlayerStat.ATTACK] = p.atk;
            player.levels[PlayerStat.ATTACK] = p.atk;
            player.stats[PlayerStat.ATTACK] = xp;
            player.baseLevels[PlayerStat.STRENGTH] = p.str;
            player.levels[PlayerStat.STRENGTH] = p.str;
            player.stats[PlayerStat.STRENGTH] = getExpByLevel(p.str);
            player.baseLevels[PlayerStat.DEFENCE] = p.def;
            player.levels[PlayerStat.DEFENCE] = p.def;
            player.stats[PlayerStat.DEFENCE] = getExpByLevel(p.def);
            player.baseLevels[PlayerStat.HITPOINTS] = p.hp;
            player.levels[PlayerStat.HITPOINTS] = p.hp;
            player.stats[PlayerStat.HITPOINTS] = getExpByLevel(p.hp);
            player.baseLevels[PlayerStat.RANGED] = p.range;
            player.levels[PlayerStat.RANGED] = p.range;
            player.stats[PlayerStat.RANGED] = getExpByLevel(p.range);
            player.baseLevels[PlayerStat.PRAYER] = p.pray;
            player.levels[PlayerStat.PRAYER] = p.pray;
            player.stats[PlayerStat.PRAYER] = getExpByLevel(p.pray);
            player.combatLevel = player.getCombatLevel();
        }

        if (this.respawnTimer > 0) {
            this.respawnTimer--;
            return;
        }

        this.replenish(player);

        const [wx, wz] = this.getWildernessSpot(player);
        this.wildTargetX = wx;
        this.wildTargetZ = wz;
        console.log(`[EdgevillePKer] ${player.displayName} profile=${p.name} cb=${player.combatLevel} spot=${wx},${wz}`);
        this.state = 'walk_to_wild';
        this.cooldown = randInt(2, 4);
        teleportNear(player, EDGEVILLE_CENTER[0], EDGEVILLE_CENTER[1]);
    }

    private replenish(player: Player): void {
        const p = this.profile!;
        player.getInventory(InvType.INV)?.removeAll();

        for (const id of [p.weapon, p.helm, p.body, p.legs, p.shield, p.neck, p.cape, p.boots, p.gloves, p.ammo]) {
            if (id === -1) continue;
            if (!_wornContains(player, id) && !hasItem(player, id)) {
                addItem(player, id, 1);
            }
        }
        regear(player, p);
        setVarp(player, 'sa_energy', 300, 1000);

        if (p.ammo !== -1) {
            const worn = player.getInventory(InvType.WORN);
            if (worn) {
                const oType = ObjType.get(p.ammo);
                const ammoWearSlot = oType.wearpos ?? oType.wearpos2 ?? oType.wearpos3;
                if (ammoWearSlot !== null) {
                    const existing = worn.get(ammoWearSlot);
                    if (existing && existing.id === p.ammo) {
                        worn.set(ammoWearSlot, { id: p.ammo, count: 25 });
                    }
                }
            }
        }

        if (p.specWeapon !== -1 && !hasItem(player, p.specWeapon)) {
            addItem(player, p.specWeapon, 1);
        }
        if (p.rangeWeapon !== -1 && !hasItem(player, p.rangeWeapon)) {
            addItem(player, p.rangeWeapon, 1);
        }
        for (const potId of p.pots) {
            if (!hasItem(player, potId)) {
                addItem(player, potId, 1);
            }
        }
        const foodCount = countItem(player, p.food);
        for (let i = 0; i < 20 - foodCount && !isInventoryFull(player); i++) {
            addItem(player, p.food, 1);
        }
    }

    private handleBanking(player: Player): void {
        if (player.target && 'slot' in player.target) {
            this.target = player.target as Player;
            this.engageTicks = 0;
            this.potsDrunk = 0;
            this.specUsesRemaining = randInt(1, 2);
            this.state = 'engage';
            this.drinkPots(player);
            this.watchdog.notifyActivity();
            return;
        }
        const [bx, bz] = EDGEVILLE_CENTER;
        this.stuckWalk(player, bx, bz);
        if (isNear(player, bx, bz, BANK_DIST)) {
            this.replenish(player);
            const [wx, wz] = this.getWildernessSpot(player);
            this.wildTargetX = wx;
            this.wildTargetZ = wz;
            this.state = 'walk_to_wild';
            this.cooldown = randInt(2, 4);
        }
        this.watchdog.notifyActivity();
    }

    private handleWalkToWild(player: Player): void {
        this.stuckWalk(player, this.wildTargetX, this.wildTargetZ);
        if (isNear(player, this.wildTargetX, this.wildTargetZ, 5)) {
            this.state = 'idle';
            this.cooldown = randInt(2, 4);
            return;
        }
        this.watchdog.notifyActivity();
        if (this.state !== 'init') {
            this.cooldown = 1;
        }
    }

    private handleIdle(player: Player): void {
        if (player.target && 'slot' in player.target) {
            this.target = player.target as Player;
            this.engageTicks = 0;
            this.potsDrunk = 0;
            this.specUsesRemaining = randInt(1, 2);
            this.state = 'engage';
            this.drinkPots(player);
            this.watchdog.notifyActivity();
            return;
        }
        if (this.rescanTimer <= 0) {
            const found = findNearbyTarget(player, SCAN_RADIUS, this.blacklist);
            if (found) {
                const wildLvl = wildLevel(player.z);
                if (inCombatRange(wildLvl, player.combatLevel, found.combatLevel)) {
                    this.target = found;
                    this.engageTicks = 0;
                    this.potsDrunk = 0;
                    this.specUsesRemaining = randInt(1, 2);
                    this.state = 'engage';
                    this.drinkPots(player);
                    player.say(GL_PHRASES[Math.floor(Math.random() * GL_PHRASES.length)]);
                    interactPlayerOp(player, found.slot, 2);
                    walkTo(player, found.x, found.z);
                    this.watchdog.notifyActivity();
                    return;
                }
            }
            this.rescanTimer = randInt(3, 6);
        } else {
            this.rescanTimer--;
        }
        if (--this.wanderTimer <= 0) {
            const wx = player.x + randInt(-4, 4);
            const wz = player.z + randInt(-4, 4);
            walkTo(player, wx, wz);
            this.wanderTimer = randInt(150, 300);
            this.watchdog.notifyActivity();
        }
        this.cooldown = 1;
    }

    private handleEngage(player: Player): void {
        const t = this.target;
        if (!t || t.slot === -1) {
            this.target = null;
            this.state = 'banking';
            return;
        }

        this.engageTicks++;

        if (this.engageTicks === 1 && isFightingAnother(t, player)) {
            this.blacklist.set(t.username, 1000);
            this.target = null;
            player.say("Woops, sorry!");
            walkTo(player, player.x + randInt(-6, 6), player.z + randInt(-6, 6));
            this.state = 'idle';
            this.cooldown = randInt(3, 6);
            this.watchdog.notifyActivity();
            return;
        }

        if (this.engageTicks > 3) {
            const hitsMe = t.target && 'slot' in t.target && t.target === player;
            if (!hitsMe) {
                const attacker = getAttacker(player);
                if (attacker && attacker !== t) {
                    this.target = attacker;
                    this.engageTicks = 0;
                    this.potsDrunk = 0;
                    this.specUsesRemaining = randInt(1, 2);
                    this.watchdog.notifyActivity();
                    return;
                }
            }
        }

        if (chebyshev(player.x, player.z, t.x, t.z) > DISENGAGE_DIST) {
            this.target = null;
            this.state = 'banking';
            return;
        }

        const wildLvl = wildLevel(player.z);
        if (!inCombatRange(wildLvl, player.combatLevel, t.combatLevel)) {
            this.target = null;
            this.state = 'banking';
            return;
        }

        if (this.specUsesRemaining === 0 && this.profile && this.profile.specWeapon !== -1 && this.profile.specWeapon !== this.profile.weapon) {
            const worn = player.getInventory(InvType.WORN);
            if (worn) {
                const curWepId = (worn.get(3)?.id) ?? -1;
                if (curWepId === this.profile.specWeapon) {
                    tryEquipFromInventory(player, this.profile.weapon);
                    if (this.profile.shield !== -1) {
                        tryEquipFromInventory(player, this.profile.shield);
                    }
                }
            }
        }

        const stackedWith = this.isStackedWith(player);
        if (stackedWith) {
            this.stackAttempts++;
            const allDirs: [number, number][] = [[1,0], [-1,0], [0,1], [0,-1]];
            const dirIndex = (this.stackAttempts - 1) % 4;
            const isMover = player.slot > (stackedWith as any).slot;

            if (this.stackWalkCooldown <= 0) {
                let dx: number, dz: number;
                if (isMover) {
                    [dx, dz] = allDirs[dirIndex]!;
                } else {
                    const [mx, mz] = allDirs[dirIndex]!;
                    dx = -mx;
                    dz = -mz;
                }
                const tx = player.x + dx;
                const tz = player.z + dz;
                const path = botWalkPath(player.level, player.x, player.z, tx, tz);
                if (path.length > 0) {
                    walkTo(player, tx, tz);
                }
                this.stackWalkCooldown = 6;
            } else {
                this.stackWalkCooldown--;
                if (this.engageTicks % 5 === 0) {
                    interactPlayerOp(player, t.slot, 2);
                    this.watchdog.notifyActivity();
                }
            }
        } else {
            this.stackWalkCooldown = 0;
            if (this.stackAttempts > 0) {
                this.stackFixed = true;
            }
            this.stackAttempts = 0;
            if (!this.stackFixed) {
                if (chebyshev(player.x, player.z, t.x, t.z) > 1) {
                    walkTo(player, t.x, t.z);
                }
            }
            if (this.engageTicks % 5 === 0) {
                interactPlayerOp(player, t.slot, 2);
                this.watchdog.notifyActivity();
            }
        }

        const hp = player.levels[PlayerStat.HITPOINTS] ?? 0;
        const maxHp = player.baseLevels[PlayerStat.HITPOINTS] ?? 10;

        if (hp < maxHp * 0.5) {
            this.eatFood(player);
        }

        if (this.profile && this.profile.specWeapon !== -1 && hp > maxHp * 0.3 && this.specUsesRemaining > 0) {
            const targetHp = t.levels[PlayerStat.HITPOINTS] ?? 0;
            const targetMaxHp = t.baseLevels[PlayerStat.HITPOINTS] ?? 10;
            if (targetHp < targetMaxHp * 0.65) {
                const saWeapon = ObjType.get(this.profile.specWeapon);
                const requiredEnergy = (saWeapon.params?.get(110) ?? 1000) as number;
                const playerEnergy = player.getVar(300) as number;
                if (playerEnergy >= requiredEnergy && this.useSpecial(player, t)) {
                    this.specUsesRemaining--;
                }
            }
        }

        this.cooldown = 1;
    }

    private eatFood(player: Player): void {
        const p = this.profile;
        if (!p) return;
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;

        const preferred = [p.food, I.SHARK, I.SWORDFISH, I.LOBSTER];
        for (const foodId of preferred) {
            const slot = findSlot(inv, foodId);
            if (slot !== -1) {
                interactHeldOp(player, inv, foodId, slot, 1);
                this.cooldown = 3;
                this.watchdog.notifyActivity();
                return;
            }
        }
    }

    private drinkPots(player: Player): void {
        const p = this.profile;
        if (!p) return;
        const inv = player.getInventory(InvType.INV);
        if (!inv) return;
        const potStats: Record<number, PlayerStat> = {
            [I.SUPER_ATTACK4]: PlayerStat.ATTACK,
            [I.SUPER_STRENGTH4]: PlayerStat.STRENGTH,
            [I.SUPER_DEFENCE4]: PlayerStat.DEFENCE,
            [I.PRAYER_POTION4]: PlayerStat.PRAYER,
            [I.SUPER_RESTORE4]: PlayerStat.PRAYER,
        };
        const potBoosts: Record<number, number> = {
            [I.SUPER_ATTACK4]: 3,
            [I.SUPER_STRENGTH4]: 3,
            [I.SUPER_DEFENCE4]: 3,
            [I.PRAYER_POTION4]: 7,
            [I.SUPER_RESTORE4]: 8,
        };

        for (const potId of p.pots) {
            const stat = potStats[potId];
            if (stat === undefined) continue;
            const boost = potBoosts[potId] ?? 3;
            const current = player.levels[stat] ?? 0;
            const base = player.baseLevels[stat] ?? 1;
            if (current <= base + 1) {
                const slot = findSlot(inv, potId);
                if (slot !== -1) {
                    inv.set(slot, null);
                    player.levels[stat] = base + boost + Math.floor(base * 0.1);
                    this.potsDrunk++;
                    this.watchdog.notifyActivity();
                }
            }
        }
    }

    private useSpecial(player: Player, target: Player): boolean {
        const p = this.profile;
        if (!p || p.specWeapon === -1) return false;
        const worn = player.getInventory(InvType.WORN);
        if (!worn) return false;

        const curWepId = (worn.get(3)?.id) ?? -1;

        if (curWepId !== p.specWeapon) {
            if (!tryEquipFromInventory(player, p.specWeapon)) return false;
            const specType = ObjType.get(p.specWeapon);
            if (specType.wearpos === 3 && specType.wearpos2 >= 0) {
                const existing = worn.get(specType.wearpos2);
                if (existing && existing.id !== -1) {
                    const inv = player.getInventory(InvType.INV);
                    if (inv) {
                        inv.add(existing.id, existing.count);
                    }
                    worn.set(specType.wearpos2, null);
                }
            }
            if (curWepId !== -1 && curWepId !== p.specWeapon && _wornContains(player, p.specWeapon)) {
                const inv = player.getInventory(InvType.INV);
                if (!inv) return false;
                if (!inv.add(curWepId, 1).hasSucceeded()) {
                    tryEquipFromInventory(player, curWepId);
                    return false;
                }
            }
        }

        if (p.specWeapon === I.DRAGON_BATTLEAXE) {
            interactIfButtonByName(player, 'combat_axe:specbar');
        } else {
            setVarp(player, 'sa_attack', 301, 1);
            interactPlayerOp(player, target.slot, 2);
        }

        this.watchdog.notifyActivity();
        return true;
    }

    private isStackedWith(player: Player): Player | null {
        for (const p of (World as any).playerLoop.all() as Iterable<Player>) {
            if (p === player || p.slot === -1) continue;
            if (p.x === player.x && p.z === player.z && p.level === player.level) return p;
        }
        return null;
    }

    private getWildernessSpot(_player: Player): [number, number] {
        return [WILD_ZONE_CX + randInt(-WILD_X_RADIUS, WILD_X_RADIUS), randInt(WILD_Z_MIN, WILD_Z_MAX)];
    }

    private stuckWalk(player: Player, tx: number, tz: number): void {
        if (!this.stuck.check(player, tx, tz)) {
            walkTo(player, tx, tz);
            return;
        }
        if (this.stuck.desperatelyStuck) {
            this.respawnTimer = randInt(10, 40);
            this.state = 'init';
            this.target = null;
            this.potsDrunk = 0;
            this.specUsesRemaining = 0;
            this.stackFixed = false;
            this.stuck.reset();
            this.watchdog.notifyActivity();
            return;
        }
        walkTo(player, player.x + randInt(-10, 10), player.z + randInt(-10, 10));
    }
}

/**
 * SocialTask.ts
 *
 * "Extras" personality — social bot.
 * Approaches real players, chats, then leads them on a short walking tour.
 *
 * Pathfinding strategy:
 *  - All destination coordinates come from BotKnowledge.Locations (verified ✅).
 *  - Destinations with tricky approach routes use a `via` waypoint (same pattern
 *    as SkillProgression) — the bot walks the via point first, then the destination.
 *    e.g. Barbarian Village uses Locations.WILLOWS_BARBARIAN_VIA to route south-west
 *    of Varrock before heading north, avoiding the wall cluster on the east road.
 *  - Movement during lead uses _stuckWalk (StuckDetector + walkTo) — the same
 *    proven path stack every other bot task uses.
 *  - Floor-level 0 is enforced every tick so bots never end up upstairs.
 *  - 5% of tours are wilderness lures — bot leads player to Edgeville, crosses the
 *    ditch, reveals its true nature and attacks if the player follows.
 */

import {
    BotTask,
    Player,
    walkTo,
    isNear,
    randInt,
    InvType,
    Items,
    StuckDetector,
    teleportNear,
    Locations,
} from '#/engine/bot/tasks/BotTaskBase.js';
import { Interfaces } from '#/engine/bot/BotKnowledge.js';
import {
    addItem,
    countItem,
    removeItem,
    interactPlayerOp,
    interactIF_UseOp,
    interactIfButtonByName,
} from '#/engine/bot/BotAction.js';
import World from '#/engine/World.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOCIAL_STARTING_COINS = 100_000;

const SCAN_RADIUS   = 20;
const FOLLOW_RADIUS = 14;
const DEST_MIN_DIST = 15;
const DEST_MAX_DIST = 140;
const ARRIVE_LINGER = 120;
const MISS_LIMIT    = 4;

// ── Scan areas ────────────────────────────────────────────────────────────────
// spawnX/Z are guaranteed outdoor coords used for the one-time init teleport.
// x/z is the centre used for the isNear proximity check.
// wanderPoints keep the bot on the road — never inside buildings.

interface ScanArea {
    x: number; z: number;
    spawnX: number; spawnZ: number;
    wanderPoints: [number, number][];
}

const SCAN_AREAS: ScanArea[] = [
    {
        // Varrock West Bank — road south of the building
        x: 3185, z: 3436,
        spawnX: 3185, spawnZ: 3433,
        wanderPoints: [
            [3185, 3433], [3178, 3434], [3192, 3434],
            [3173, 3436], [3197, 3432], [3182, 3428], [3190, 3430],
        ],
    },
    {
        // Varrock East Bank — road south of the building
        x: 3253, z: 3417,
        spawnX: 3253, spawnZ: 3415,
        wanderPoints: [
            [3253, 3415], [3259, 3417], [3246, 3416],
            [3255, 3411], [3262, 3413], [3248, 3412], [3257, 3419],
        ],
    },
    {
        // Lumbridge — road south of the castle (LUMBRIDGE_SPAWN area)
        x: 3222, z: 3218,
        spawnX: 3222, spawnZ: 3218,
        wanderPoints: [
            [3222, 3218], [3228, 3219], [3216, 3217],
            [3225, 3213], [3219, 3213], [3232, 3215], [3212, 3220],
        ],
    },
    {
        // Barbarian Village — road through the village (BARBARIANS_VILLAGE)
        x: 3083, z: 3428,
        spawnX: 3083, spawnZ: 3420,
        wanderPoints: [
            [3083, 3420], [3077, 3421], [3089, 3419],
            [3081, 3426], [3087, 3415], [3075, 3417], [3092, 3423],
        ],
    },
    {
        // Draynor Village — road south of the bank (DRAYNOR_BANK area)
        x: 3092, z: 3242,
        spawnX: 3092, spawnZ: 3240,
        wanderPoints: [
            [3092, 3240], [3087, 3242], [3097, 3241],
            [3085, 3237], [3100, 3238], [3090, 3234], [3095, 3244],
        ],
    },
    {
        // Falador East Bank — road outside the bank (FALADOR_EAST_BANK)
        x: 3012, z: 3360,
        spawnX: 3012, spawnZ: 3360,
        wanderPoints: [
            [3013, 3354], [3007, 3355], [3019, 3353],
            [3011, 3349], [3016, 3360], [3005, 3351], [3021, 3357],
        ],
    },
    {
        // Port Sarim — road near the docks (GERRANTS_FISHING area)
        x: 3028, z: 3222,
        spawnX: 3028, spawnZ: 3220,
        wanderPoints: [
            [3028, 3220], [3022, 3221], [3034, 3219],
            [3026, 3215], [3031, 3226], [3018, 3217], [3038, 3222],
        ],
    },
];

// ── Destinations ──────────────────────────────────────────────────────────────
// All coordinates come from BotKnowledge.Locations (verified ✅).
// `via` mirrors the SkillProgression pattern — bot walks the via coord first,
// then the final location. This is what keeps routing predictable across regions.

interface Destination {
    name: string;
    location: [number, number, number];
    via?: [number, number, number];
    radius: number;
    approachPhrases: string[];
    arrivalPhrases:  string[];
    idlePhrases:     string[];
}

const DESTINATIONS: Destination[] = [
    // ── Varrock area ──────────────────────────────────────────────────────────
    {
        name: 'Varrock Smithy',
        location: Locations.VARROCK_ANVIL,   // [3188, 3422, 0] ✅
        radius: 5,
        approachPhrases: ['come see the smithy', 'follow me east', 'smithy is just here', 'good spot for smithing'],
        arrivalPhrases:  ['the smithy!', 'loads of anvils here', 'good spot to train smithing'],
        idlePhrases:     ['u train smithing?', 'need a lot of ore for this', 'good xp if u got the bars', 'classic training spot', 'u use the ge for bars?'],
    },
    {
        name: 'Varrock Sword Shop',
        location: Locations.VARROCK_SWORD_SHOP,  // [3205, 3420, 0] ✅
        radius: 5,
        approachPhrases: ['come check the sword shop', 'follow me east', 'good weapons here', 'swords just up here'],
        arrivalPhrases:  ['varrock sword shop!', 'decent selection here', 'good early weapons'],
        idlePhrases:     ['u use a sword or scimitar?', 'swords are solid for training', 'cheap iron here', 'u been to al kharid? better scimitars there', 'good starter shop'],
    },
    {
        name: 'Varrock Rune Shop',
        location: Locations.VARROCK_RUNES,  // [3253, 3400, 0] ✅
        radius: 5,
        approachPhrases: ['come see the rune shop', 'follow me south-east', 'auburys is just here', 'magic supplies down here'],
        arrivalPhrases:  ['auburys rune shop!', 'good for magic supplies', 'loads of runes here'],
        idlePhrases:     ['u do magic?', 'cheap runes here', 'air runes are handy', 'good stock always', 'come here a lot tbh'],
    },
    {
        name: 'Varrock Archery',
        location: Locations.VARROCK_ARCHERY,  // [3233, 3425, 0] ✅
        radius: 5,
        approachPhrases: ['come see lowes archery', 'follow me east', 'good range gear here', 'archery shop is just here'],
        arrivalPhrases:  ['lowes archery!', 'bows and arrows here', 'good for rangers'],
        idlePhrases:     ['u train range?', 'decent bow selection', 'bronze arrows are cheap', 'range is a solid skill', 'useful for safespotting'],
    },
    {
        name: 'Barbarian Village',
        location: Locations.BARBARIANS_VILLAGE,  // [3082, 3434, 0] ✅
        via:      Locations.WILLOWS_BARBARIAN_VIA, // [3045, 3340, 0] routes south-west of Varrock
        radius: 8,
        approachPhrases: ['ever been to barb village?', 'follow me west', 'come to barb village with me', 'barb village is west of here'],
        arrivalPhrases:  ['barbarian village!', 'bit sketchy but cool', 'wild spot'],
        idlePhrases:     ['barbarians everywhere lol', 'good fishing on the river', 'stronghold is near here', 'u like combat stuff?', 'classic rs area'],
    },
    {
        name: 'Varrock West Mine',
        location: Locations.MINE_VARROCK_WEST,  // [3177, 3368, 0] ✅
        radius: 6,
        approachPhrases: ['come see the mine', 'follow me south', 'mining spot just down here', 'good ore south of varrock'],
        arrivalPhrases:  ['varrock west mine!', 'tin and iron here', 'solid early mining spot'],
        idlePhrases:     ['u train mining?', 'good iron here', 'close to the bank', 'easy xp if u got a pick', 'nice open area'],
    },
    {
        name: 'Varrock East Mine',
        location: Locations.MINE_VARROCK_EAST,     // [3285, 3365, 0] ✅
        via:      Locations.MINE_VARROCK_EAST_VIA, // [3302, 3342, 0] ✅
        radius: 6,
        approachPhrases: ['come see the east mine', 'follow me east', 'iron mine is just here', 'good mining east of varrock'],
        arrivalPhrases:  ['varrock east mine!', 'good iron deposits here', 'popular mining spot'],
        idlePhrases:     ['u mine here much?', 'iron is worth banking', 'can sell it or smelt it', 'gets busy sometimes', 'good spot to train'],
    },

    // ── Draynor / south area ──────────────────────────────────────────────────
    {
        name: 'Draynor Riverside',
        location: Locations.FISH_DRAYNOR,  // [3088, 3228, 0] ✅
        radius: 6,
        approachPhrases: ['come see the riverside', 'follow me south', 'good fishing spot down here', 'draynor river is just south'],
        arrivalPhrases:  ['draynor riverside!', 'good fishing here', 'people train here a lot'],
        idlePhrases:     ['u train fishing?', 'shrimp and sardine here', 'nice and peaceful', 'good spot to afk', 'the river is right there'],
    },
    {
        name: 'Lumbridge Goblins',
        location: Locations.GOBLINS_LUMBRIDGE,  // [3258, 3236, 0] ✅
        radius: 7,
        approachPhrases: ['come this way toward lumbridge', 'follow me east', 'good walk this way', 'lumbridge is just east'],
        arrivalPhrases:  ['lumbridge area!', 'goblins everywhere here', 'classic starter spot'],
        idlePhrases:     ['lumbridge is not far', 'good road to know', 'cows just north of here', 'u been to lumbridge much?', 'classic starter area'],
    },
    {
        name: 'Port Sarim Docks',
        location: Locations.GERRANTS_FISHING,  // [3014, 3224, 0] ✅
        radius: 8,
        approachPhrases: ['ever been to port sarim?', 'follow me to the docks', 'port sarim is just west', 'ships are just down here'],
        arrivalPhrases:  ['port sarim!', 'u can get a boat from here', 'love the docks area'],
        idlePhrases:     ['u can sail to karamja from here', 'fishing is good near the docks', 'pirates lol', 'nice view of the sea', 'u done pirates quest?'],
    },

    // ── Falador area ─────────────────────────────────────────────────────────
    {
        name: 'Falador Park',
        location: Locations.FALADOR_FOUNTAIN,  // [2997, 3373, 0] ✅
        radius: 7,
        approachPhrases: ['come see falador park', 'follow me to the park', 'this way, falador!', 'falador park is just here'],
        arrivalPhrases:  ['falador park!', 'nice open area right', 'love it here'],
        idlePhrases:     ['white knights castle is nearby', 'one of the bigger cities', 'u done falador quest?', 'clean city vibes', 'good place to chill'],
    },
    {
        name: 'Falador East Bank',
        location: Locations.FALADOR_EAST_BANK,  // [3013, 3355, 0] ✅
        radius: 5,
        approachPhrases: ['follow me to falador bank', 'falador bank is just here', 'come this way', 'heading to the bank'],
        arrivalPhrases:  ['falador east bank!', 'handy bank', 'solid spot'],
        idlePhrases:     ['decent bank location', 'mining guild is nearby', 'u mine at all?', 'good central bank', 'falador is underrated tbh'],
    },
];

// ── Wilderness lure destination (used only on 5% rolls) ──────────────────────
// Edgeville yews are a verified ✅ outdoor coord just south of the wilderness ditch.

const WILDERNESS_LURE_DEST: Destination = {
    name: 'Edgeville',
    location: Locations.YEWS_EDGEVILLE,  // [3087, 3476, 0] ✅ — just south of ditch
    via:      Locations.BARBARIANS_VILLAGE, // [3082, 3434, 0] — route through barb village first
    radius: 5,
    approachPhrases: ['edgeville is nice, follow me', 'good spot up north, come see', 'follow me north a sec', 'theres something cool up here'],
    arrivalPhrases:  ['nearly there...', 'just up here...', 'this way...'],
    idlePhrases:     [],
};

// ── Phrase banks ──────────────────────────────────────────────────────────────

const BETRAY_PHRASES   = ['lol gotcha', 'enjoy the respawn :)', 'pk time lmao', 'shouldnt have followed', 'surprise!'];
const GREET_PHRASES    = ['hey', 'hi', 'yo', 'hiya', 'sup', 'ello', 'heya', 'wagwan'];
const CHAT_LINES       = ['nice to meet u!', 'how long u been playing?', 'ur levels look decent', 'what quest r u doing?', 'this game is addictive ngl'];
const FOLLOW_PROMPTS   = ['follow me ill show u something cool', 'wanna see a good spot? follow me!', 'come with me, I know somewhere', 'follow me real quick', "let's go exploring, follow!"];
const WAIT_PHRASES     = ['u coming?', 'this way!', 'come on lol', 'follow follow', "u lost? I'm over here", 'catch up!'];
const MOVING_LINES     = ['almost there', 'not far now', 'just up here', 'good spot ahead', "u'll like this place", 'nearly there'];
const FAREWELL_PHRASES = ['nice chatting! gl with ur gains', 'cya around!', 'gotta go, laters!', 'good luck on ur adventures', 'see u round!'];
const REWARD_PHRASES   = ['here, take this for following me :)', 'a lil reward for the walk!', 'cheers for coming, enjoy!', 'small tip for the tour lol'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function chebyshev(ax: number, az: number, bx: number, bz: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function findNearbyRealPlayer(bot: Player, radius: number): Player | null {
    let best: Player | null = null;
    let bestDist = radius + 1;
    for (const p of (World as any).playerLoop.all() as Iterable<Player>) {
        if (p === bot) continue;
        if ((p as any).is_bot) continue;
        if (p.level !== bot.level) continue;
        const d = chebyshev(bot.x, bot.z, p.x, p.z);
        if (d <= radius && d < bestDist) { best = p; bestDist = d; }
    }
    return best;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export class SocialTask extends BotTask {
    private static readonly activePids = new Set<number>();

    private state: 'scan' | 'approach' | 'chat' | 'lead' | 'arrived' | 'reward' | 'move_area' | 'wilderness_trap' = 'scan';

    private target:      Player | null = null;
    private destination: Destination | null = null;

    private areaIndex:      number;
    private areaInitialized = false;
    private scanFail  = 0;
    private chatPhase = 0;
    private wanderIdx = 0;

    // Approach state
    private approachTicks = 0;

    // Lead state
    private leadTicks          = 0;
    private leadCommentTick    = 0;
    private missedFollowChecks = 0;
    private viaReached         = false;  // true once the via waypoint has been passed

    // Arrived / reward state
    private arrivedTicks    = 0;
    private idleCommentTick = 0;
    private rewardGiven     = false;
    private rewardStage     = 0;
    private rewardCoins     = 0;

    private coinsInitialized = false;
    private wildernessLure   = false;
    private wildernessPhase  = 0;

    private readonly stuck     = new StuckDetector(12, 3, 1);
    private readonly leadStuck = new StuckDetector(20, 4, 2);

    constructor() {
        super('Social');
        this.areaIndex = Math.floor(Math.random() * SCAN_AREAS.length);
    }

    shouldRun(_player: Player): boolean { return true; }

    tick(player: Player): void {
        if (this.interrupted) return;

        if (!this.coinsInitialized) {
            this.coinsInitialized = true;
            const have = countItem(player, Items.COINS);
            if (have < SOCIAL_STARTING_COINS) {
                addItem(player, Items.COINS, SOCIAL_STARTING_COINS - have);
            }
        }

        if (player.level !== 0 && this.state !== 'wilderness_trap') {
            const area = SCAN_AREAS[this.areaIndex]!;
            teleportNear(player, area.spawnX, area.spawnZ);
            this._resetTarget();
            this.cooldown = 3;
            return;
        }

        if (this.cooldown > 0) { this.cooldown--; return; }

        switch (this.state) {
            case 'scan':            return this.handleScan(player);
            case 'approach':        return this.handleApproach(player);
            case 'chat':            return this.handleChat(player);
            case 'lead':            return this.handleLead(player);
            case 'arrived':         return this.handleArrived(player);
            case 'reward':          return this.handleReward(player);
            case 'move_area':       return this.handleMoveArea(player);
            case 'wilderness_trap': return this.handleWildernessTrap(player);
        }
    }

    isComplete(): boolean { return false; }

    override reset(): void {
        super.reset();
        this._resetTarget();
        this.areaIndex        = Math.floor(Math.random() * SCAN_AREAS.length);
        this.areaInitialized  = false;
        this.scanFail         = 0;
        this.wanderIdx        = 0;
        this.coinsInitialized = false;
    }

    // ── States ────────────────────────────────────────────────────────────────

    private handleScan(player: Player): void {
        const area = SCAN_AREAS[this.areaIndex]!;

        if (!this.areaInitialized) {
            this.areaInitialized = true;
            teleportNear(player, area.spawnX, area.spawnZ);
            this.cooldown = randInt(4, 8);
            return;
        }

        if (!isNear(player, area.x, area.z, 14)) {
            this._stuckWalk(player, area.spawnX, area.spawnZ);
            this.cooldown = 2;
            return;
        }

        if (Math.random() < 0.3) {
            const wp = area.wanderPoints[this.wanderIdx % area.wanderPoints.length]!;
            this.wanderIdx++;
            walkTo(player, wp[0], wp[1]);
        }

        const found = findNearbyRealPlayer(player, SCAN_RADIUS);
        if (found && !SocialTask.activePids.has(found.uid)) {
            this.target    = found;
            this.chatPhase = 0;
            this.scanFail  = 0;
            SocialTask.activePids.add(found.uid);
            this.state     = 'approach';
            return;
        }

        this.scanFail++;
        if (this.scanFail >= 6) { this.scanFail = 0; this.state = 'move_area'; }
        this.cooldown = randInt(6, 12);
    }

    private handleApproach(player: Player): void {
        const t = this.target;
        if (!t || (t as any).is_bot) { this._resetTarget(); return; }
        if (chebyshev(player.x, player.z, t.x, t.z) > 45) { this._resetTarget(); return; }

        this.approachTicks++;
        if (this.approachTicks > 25) {
            // Player kept moving — give up so another bot can try.
            this._resetTarget();
            return;
        }

        if (!isNear(player, t.x, t.z, 2)) {
            this._stuckWalk(player, t.x + randInt(-1, 1), t.z + randInt(-1, 1));
            this.cooldown = 1;
            return;
        }

        const greet = pickRandom(GREET_PHRASES);
        player.say(Math.random() < 0.5 ? `${greet} ${t.displayName}!` : greet);
        this.state     = 'chat';
        this.chatPhase = 0;
        this.cooldown  = randInt(5, 9);
    }

    private handleChat(player: Player): void {
        const t = this.target;
        if (!t || chebyshev(player.x, player.z, t.x, t.z) > 25) { this._resetTarget(); return; }

        if (!isNear(player, t.x, t.z, 3)) {
            walkTo(player, t.x + randInt(-1, 1), t.z + randInt(-1, 1));
        }

        this.chatPhase++;
        if (this.chatPhase <= 2) {
            player.say(pickRandom(CHAT_LINES));
            this.cooldown = randInt(8, 16);
            return;
        }

        this.destination    = this._pickNearbyDest(player);
        this.wildernessLure = false;
        if (Math.random() < 0.05) {
            this.destination    = WILDERNESS_LURE_DEST;
            this.wildernessLure = true;
        }
        this.leadTicks          = 0;
        this.leadCommentTick    = 0;
        this.missedFollowChecks = 0;
        this.viaReached         = false;
        this.leadStuck.reset();

        player.say(pickRandom(FOLLOW_PROMPTS));
        this.state    = 'lead';
        this.cooldown = randInt(5, 8);
    }

    /**
     * Lead state — walks toward destination using the via→location pattern from
     * SkillProgression. All coordinates come from verified BotKnowledge.Locations.
     *
     * Navigation:
     *  1. If destination has a `via` and it hasn't been reached, walk to via first.
     *  2. Once via is reached (or no via), walk directly to the final location.
     *  3. Movement uses _stuckWalk (StuckDetector + walkTo) — same as every other task.
     */
    private handleLead(player: Player): void {
        const t    = this.target;
        const dest = this.destination;
        if (!t || !dest) { this._resetTarget(); return; }

        if (chebyshev(player.x, player.z, t.x, t.z) > 100) {
            player.say(pickRandom(FAREWELL_PHRASES));
            this._resetTarget();
            return;
        }

        this.leadTicks++;

        const [dx, dz] = dest.location;

        // Arrived at destination?
        if (isNear(player, dx, dz, dest.radius)) {
            player.say(pickRandom(dest.arrivalPhrases));
            this.arrivedTicks    = 0;
            this.idleCommentTick = 0;
            this.state    = 'arrived';
            this.cooldown = randInt(4, 8);
            return;
        }

        // Determine navigation target: via first, then final destination.
        let navX = dx;
        let navZ = dz;
        if (dest.via && !this.viaReached) {
            const [vx, vz] = dest.via;
            if (isNear(player, vx, vz, 10)) {
                this.viaReached = true;
                this.leadStuck.reset();
            } else {
                navX = vx;
                navZ = vz;
            }
        }

        // Follower check every 10 ticks.
        const playerDist      = chebyshev(player.x, player.z, t.x, t.z);
        const playerFollowing = playerDist <= FOLLOW_RADIUS;

        if (this.leadTicks % 10 === 0) {
            if (!playerFollowing) {
                this.missedFollowChecks++;
                if (this.missedFollowChecks >= MISS_LIMIT) {
                    player.say(pickRandom(FAREWELL_PHRASES));
                    this._resetTarget();
                    return;
                }
                player.say(pickRandom(WAIT_PHRASES));
            } else {
                this.missedFollowChecks = Math.max(0, this.missedFollowChecks - 1);
            }
        }

        // Periodic moving commentary.
        this.leadCommentTick++;
        if (this.leadCommentTick >= randInt(22, 35)) {
            if (playerFollowing && Math.random() < 0.6) {
                player.say(pickRandom(dest.approachPhrases.concat(MOVING_LINES)));
            }
            this.leadCommentTick = 0;
        }

        // Pause if the player has fallen behind.
        if (!playerFollowing && this.missedFollowChecks >= 2) {
            this.cooldown = 3;
            return;
        }

        // Walk using the proven StuckDetector-backed walker.
        this._leadStuckWalk(player, navX, navZ);
        this.cooldown = 1;
    }

    private handleArrived(player: Player): void {
        const dest = this.destination;
        if (!dest) { this._resetTarget(); return; }

        this.arrivedTicks++;

        const t            = this.target;
        const playerNearby = t && chebyshev(player.x, player.z, t.x, t.z) <= 20;

        if (this.wildernessLure && !this.rewardGiven) {
            this.rewardGiven     = true;
            this.wildernessPhase = 0;
            this.state           = 'wilderness_trap';
            this.cooldown        = 2;
            return;
        }

        if (playerNearby && t && !this.rewardGiven) {
            this.rewardGiven = true;
            this.rewardStage = 0;
            player.say(pickRandom(REWARD_PHRASES));
            this.state    = 'reward';
            this.cooldown = randInt(3, 5);
            return;
        }

        const [dx, dz] = dest.location;
        if (Math.random() < 0.35) {
            const r = dest.radius + 3;
            walkTo(player, dx + randInt(-r, r), dz + randInt(-r, r));
        }

        this.idleCommentTick++;
        if (this.idleCommentTick >= randInt(14, 22) && playerNearby) {
            player.say(pickRandom(dest.idlePhrases));
            this.idleCommentTick = 0;
        }

        if (this.arrivedTicks >= ARRIVE_LINGER) {
            if (playerNearby && t) player.say(pickRandom(FAREWELL_PHRASES));
            this._resetTarget();
            return;
        }

        this.cooldown = randInt(8, 14);
    }

    private handleReward(player: Player): void {
        const t = this.target;
        if (!t || chebyshev(player.x, player.z, t.x, t.z) > 25) {
            this._clearTrade(player);
            this.state = 'arrived';
            return;
        }

        switch (this.rewardStage) {
            case 0: {
                // Pick amount, trim bot's coins to exactly that value (VendorTask pattern).
                this.rewardCoins = randInt(500, 10000);
                const have = countItem(player, Items.COINS);
                if (have > this.rewardCoins) {
                    removeItem(player, Items.COINS, have - this.rewardCoins);
                } else if (have < this.rewardCoins) {
                    addItem(player, Items.COINS, this.rewardCoins - have);
                }
                interactPlayerOp(player, t.slot, 4);
                player.botTradeTargetPid   = t.uid;
                player.botTradeTargetStage = 0;
                this.rewardStage = 1;
                this.cooldown    = randInt(3, 5);
                break;
            }
            case 1: {
                // op 4 = "Offer All" — mirrors VendorTask._offerInventoryItem exactly.
                const inv = player.getInventory(InvType.INV);
                if (inv) {
                    for (let slot = 0; slot < inv.capacity; slot++) {
                        const item = inv.get(slot);
                        if (item && item.id === Items.COINS) {
                            interactIF_UseOp(player, Interfaces.TRADE_SIDE_INV, Items.COINS, slot, 4, InvType.INV);
                            break;
                        }
                    }
                }
                this.rewardStage = 2;
                this.cooldown    = randInt(3, 5);
                break;
            }
            case 2: {
                interactIfButtonByName(player, 'trademain:accept');
                this.rewardStage = 3;
                this.cooldown    = randInt(2, 4);
                break;
            }
            case 3: {
                interactIfButtonByName(player, 'tradeconfirm:accept');
                // Replenish so future tours can also reward.
                addItem(player, Items.COINS, SOCIAL_STARTING_COINS - countItem(player, Items.COINS));
                this._clearTrade(player);
                this.rewardStage = 0;
                this.state       = 'arrived';
                this.cooldown    = randInt(5, 10);
                break;
            }
        }
    }

    private handleWildernessTrap(player: Player): void {
        const t = this.target;
        if (!t || chebyshev(player.x, player.z, t.x, t.z) > 60) {
            this._resetTarget();
            return;
        }

        this.wildernessPhase++;

        const inWild = player.z >= 3520;

        if (!inWild) {
            walkTo(player, 3087, 3526);
            this.cooldown = 1;
            if (this.wildernessPhase > 30) { this._resetTarget(); }
            return;
        }

        if (this.wildernessPhase === 1 || (inWild && this.wildernessPhase <= 3)) {
            player.say(pickRandom(BETRAY_PHRASES));
        }

        const playerInWild = t.z >= 3520;
        if (playerInWild) {
            interactPlayerOp(player, t.slot, 2);
            this.cooldown = 3;
        } else {
            if (this.wildernessPhase % 10 === 0) {
                player.say('come in if u dare lol');
            }
            this.cooldown = 2;
        }

        if (this.wildernessPhase > 50) {
            if (playerInWild) player.say(pickRandom(FAREWELL_PHRASES));
            this._resetTarget();
        }
    }

    private handleMoveArea(player: Player): void {
        const next = (this.areaIndex + 1 + Math.floor(Math.random() * (SCAN_AREAS.length - 1))) % SCAN_AREAS.length;
        this.areaIndex       = next;
        this.areaInitialized = false;
        this.state    = 'scan';
        this.cooldown = randInt(8, 16);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _pickNearbyDest(player: Player): Destination {
        const nearby = DESTINATIONS.filter(d => {
            const dist = chebyshev(player.x, player.z, d.location[0], d.location[1]);
            return dist >= DEST_MIN_DIST && dist <= DEST_MAX_DIST;
        });
        return pickRandom(nearby.length >= 1 ? nearby : DESTINATIONS);
    }

    // Separate StuckDetector for the lead phase with longer patience before
    // escalating — we don't want to teleport mid-tour, just recover naturally.
    private _leadStuckWalk(player: Player, tx: number, tz: number): void {
        if (!this.leadStuck.check(player, tx, tz)) { walkTo(player, tx, tz); return; }
        if (this.leadStuck.desperatelyStuck) { teleportNear(player, tx, tz); this.leadStuck.reset(); return; }
        walkTo(player, player.x + randInt(-5, 5), player.z + randInt(-5, 5));
    }

    private _resetTarget(): void {
        if (this.target) {
            SocialTask.activePids.delete(this.target.uid);
            this._clearTrade(this.target);
        }
        this.target      = null;
        this.destination = null;
        this.approachTicks      = 0;
        this.chatPhase          = 0;
        this.leadTicks          = 0;
        this.leadCommentTick    = 0;
        this.missedFollowChecks = 0;
        this.viaReached         = false;
        this.arrivedTicks       = 0;
        this.idleCommentTick    = 0;
        this.rewardGiven        = false;
        this.rewardStage        = 0;
        this.rewardCoins        = 0;
        this.wildernessLure     = false;
        this.wildernessPhase    = 0;
        this.stuck.reset();
        this.leadStuck.reset();
        this.state    = 'scan';
        this.cooldown = randInt(5, 10);
    }

    private _clearTrade(player: Player | null): void {
        if (!player) return;
        player.botTradeTargetPid   = -1;
        player.botTradeTargetStage = -1;
    }

    private _stuckWalk(player: Player, tx: number, tz: number): void {
        if (!this.stuck.check(player, tx, tz)) { walkTo(player, tx, tz); return; }
        if (this.stuck.desperatelyStuck) { teleportNear(player, tx, tz); this.stuck.reset(); return; }
        walkTo(player, player.x + randInt(-6, 6), player.z + randInt(-6, 6));
    }
}

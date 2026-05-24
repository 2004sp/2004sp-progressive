import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import { PlayerStat, setVarp } from '#/engine/bot/BotAction.js';
import { Items, randInt } from '#/engine/bot/tasks/BotTaskBase.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { check, IDKTypeValid, GenderValid } from '#/engine/script/ScriptValidators.js';

const SKIN_TONES = [0, 1, 2, 3, 4, 5];
const HAIR_COLOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MAN_HAIR_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const MAN_JAW_IDS = [10, 11, 12, 13, 14, 15, 16, 17];
const MAN_TORSO_IDS = [18, 19, 20, 21, 22, 23, 24, 25];
const MAN_ARMS_IDS = [26, 27, 28, 29, 30, 31];
const MAN_HANDS_IDS = [33, 34];
const MAN_LEGS_IDS = [36, 37, 38, 39, 40];
const MAN_FEET_IDS = [42, 43];
const WOMAN_HAIR_IDS = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54];
const WOMAN_TORSO_IDS = [56, 57, 58, 59, 60];
const WOMAN_ARMS_IDS = [61, 62, 63, 64, 65];
const WOMAN_HANDS_IDS = [67, 68];
const WOMAN_FEET_IDS = [79, 80];
const WOMAN_LEGS_IDS = [70, 71, 72, 73, 74, 75, 76, 77];

const GENDERS = {
    MALE: 0,
    FEMALE: 1
};

const STARTER_WEAPONS = [Items.BRONZE_AXE, Items.BRONZE_PICKAXE, Items.BRONZE_SWORD, Items.BRONZE_SCIMITAR, Items.IRON_AXE, Items.IRON_SCIMITAR];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickIdkit(ids: number[], type: number): number {
    const valid = ids.filter(id => {
        const idk = IdkType.get(id);
        return idk && !idk.disable && idk.type === type;
    });

    if (valid.length === 0) {
        throw new Error(`No valid idkits for type ${type}`);
    }

    return pick(valid);
}

function item(id: number, player:Player) {
    return { id, count: 1, owner: player?.username };
}

export class BotAppearance {

     static set_gender(player:Player, gender1:number) {
        const gender = check(gender1, GenderValid);
        if(!player) return;
        for (let i = 0; i < 7; i++) {
            if (gender === 1) {
                player.body[i] = Player.MALE_FEMALE_MAP.get(player.body[i]) ?? -1;
            } else {
                if (i == 1) {
                    player.body[i] = 14;
                    continue;
                }
                player.body[i] = Player.FEMALE_MALE_MAP.get(player.body[i]) ?? -1;
            }
        }
        player.gender = gender;
    }

    static set_appearance(player:Player, idkit:number, color:number) {
        const idkType: IdkType = check(idkit, IDKTypeValid);
        let slot = idkType.type;
        if (player.gender === 1) {
            slot -= 7;
        }
        player.body[slot] = idkType.id;
        // 0 - hair/jaw
        // 1 - torso
        // 2 - legs
        // 3 - boots
        // 4 - skin
        let type = idkType.type;
        if (player.gender === 1) {
            type -= 7;
        }
        let colorSlot = -1;
        if (type === 0 || type === 1) {
            colorSlot = 0;
        } else if (type === 2 || type === 3) {
            colorSlot = 1;
        } else if (type === 4) {
            /* no-op (no hand recoloring) */
        } else if (type === 5) {
            colorSlot = 2;
        } else if (type === 6) {
            colorSlot = 3;
        }
        if (colorSlot !== -1) {
            player.colors[colorSlot] = color;
        }
    }

    static randomizeBody(player: Player): void {
        const gender = Math.random() < 0.51 ? GENDERS.MALE : GENDERS.FEMALE;
        player.gender = gender;
        player.body.fill(-1);

        const hairColour = pick(HAIR_COLOURS);
        const torsoColour = pick(HAIR_COLOURS);
        const legColour = pick(HAIR_COLOURS);
        const feetColour = pick(HAIR_COLOURS);

        if (gender === GENDERS.MALE) {
            BotAppearance.set_appearance(player, pickIdkit(MAN_HAIR_IDS, 0), hairColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_JAW_IDS, 1), hairColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_TORSO_IDS, 2), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_ARMS_IDS, 3), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_HANDS_IDS, 4), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_LEGS_IDS, 5), legColour);
            BotAppearance.set_appearance(player, pickIdkit(MAN_FEET_IDS, 6), feetColour);
        } else {
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_HAIR_IDS, 7), hairColour);
            player.body[1] = -1;
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_TORSO_IDS, 9), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_ARMS_IDS, 10), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_HANDS_IDS, 11), torsoColour);
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_LEGS_IDS, 12), legColour);
            BotAppearance.set_appearance(player, pickIdkit(WOMAN_FEET_IDS, 13), feetColour);
        }

        player.colors[4] = pick(SKIN_TONES);
        player.buildAppearance(InvType.WORN);
    }

    static randomize(player: Player): void {

        const worn = player.getInventory(InvType.WORN);
        if (!worn) throw new Error('WORN inventory missing');
        const inv = player.getInventory(InvType.INV);
        if (!inv) throw new Error('Invalid inv');

        BotAppearance.randomizeBody(player);

        worn.set(3, item(pick(STARTER_WEAPONS), player)); // weapon
        //^ I believe the login script already does this ^

        // Set movement animations so the run-toggle in walkTo works.
        // Without a valid runanim the engine hard-forces MoveSpeed.WALK
        // regardless of player.run, so bots can never run.
        player.readyanim  = 808; // human_ready
        player.walkanim   = 819; // human_walk_f
        player.walkanim_b = 820; // human_walk_b
        player.walkanim_l = 821; // human_walk_l
        player.walkanim_r = 822; // human_walk_r
        player.runanim    = 824; // human_running

        // Set Herblore to 3 (requires Druidic Ritual quest)
        player.baseLevels[PlayerStat.HERBLORE] = 3;
        player.stats[PlayerStat.HERBLORE] = getExpByLevel(3);
        //Essential quest varps (completions)
        setVarp(player, 'cook_progress', 29, 2);
        setVarp(player, 'runemysteries_progress', 63, 6);
        setVarp(player, 'druid_progress', 80, 4);
        setVarp(player, 'tree_progress', 111, 9);
        setVarp(player, 'legends_progress', 139, 75);
        setVarp(player, 'zanaris_progress', 147, 6);
        setVarp(player, 'grandtree_progres', 150, 160);
        setVarp(player, 'dragon_progress', 176, 10);
        setVarp(player, 'hero_progress', 188, 15);

        player.buildAppearance(InvType.WORN);
    }
}

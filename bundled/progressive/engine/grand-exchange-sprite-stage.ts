import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const SPRITE_ASSETS_PATH = path.join(PLUGIN_DIR, 'sprite-assets.json');

const IN_SCOPE_INTERFACE_GROUPS = [105, 106, 107, 108, 109, 110, 643] as const;
const EXCLUDED_INTERFACE_GROUPS = [645, 646] as const;
const EXPECTED_SOURCE_SPRITE_IDS = [
    297,
    820,
    821,
    822,
    823,
    824,
    825,
    826,
    827,
    828,
    829,
    830,
    831,
    841,
    846,
    847,
    848,
    849,
    851,
    852,
    954,
    955,
    956,
    957,
    958,
    959,
    960,
    961,
    962,
    963,
    964,
    1074,
    1075,
    1136,
    1137,
    1138,
    1140,
    1146,
    1147,
    1150,
    1151,
    1152,
    1153,
    1154,
    1157,
    1158,
    1161,
    1162,
    1163,
    1164,
    1165,
    1167,
    1168,
    1170,
    1174,
] as const;

type SpriteAssetManifest = {
    source: {
        cache: string;
        revision_family: number;
        provided_timestamp: string;
        archive_sha256: string;
    };
    scope: {
        in_scope_interface_groups: number[];
        excluded_interface_groups: number[];
        item_source_boundary: string;
        source_sprite_ids: number[];
    };
    sprites: Array<[sourceId: number, width: number, height: number, sha256: string]>;
};

function readAndValidateManifest() {
    const manifest = JSON.parse(fs.readFileSync(SPRITE_ASSETS_PATH, 'utf8')) as SpriteAssetManifest;
    const sourceIds = manifest.sprites.map(([sourceId]) => sourceId);
    const uniqueSourceIds = new Set(sourceIds);

    if (
        manifest.source.cache !== 'runescape/568' ||
        manifest.source.revision_family !== 481 ||
        manifest.scope.in_scope_interface_groups.join(',') !== IN_SCOPE_INTERFACE_GROUPS.join(',') ||
        manifest.scope.excluded_interface_groups.join(',') !== EXCLUDED_INTERFACE_GROUPS.join(',') ||
        manifest.scope.item_source_boundary !== 'native-r254-only' ||
        manifest.scope.source_sprite_ids.join(',') !== EXPECTED_SOURCE_SPRITE_IDS.join(',') ||
        sourceIds.join(',') !== EXPECTED_SOURCE_SPRITE_IDS.join(',') ||
        uniqueSourceIds.size !== EXPECTED_SOURCE_SPRITE_IDS.length
    ) {
        throw new Error('Grand Exchange source-sprite manifest no longer matches the frozen in-scope r481 interface dependency set');
    }

    return manifest;
}

export async function prepareGrandExchangeSpriteStage(stagedContentDir: string) {
    if (!fs.existsSync(SPRITE_ASSETS_PATH)) {
        throw new Error(`Grand Exchange source-sprite manifest is missing: ${SPRITE_ASSETS_PATH}`);
    }

    const manifest = readAndValidateManifest();
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const [sourceId, width, height, sha256] of manifest.sprites) {
        const sourcePath = path.join(PLUGIN_DIR, 'assets', 'sprites', `${sourceId}.png`);
        const bytes = fs.readFileSync(sourcePath);
        const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actualHash !== sha256) {
            throw new Error(
                `Grand Exchange source sprite ${sourceId} hash mismatch: expected ${sha256}, got ${actualHash}`
            );
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== width || image.bitmap.height !== height) {
            throw new Error(
                `Grand Exchange source sprite ${sourceId} dimensions changed: expected ${width}x${height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }

        // The native r254 PixPack uses RGB magenta rather than PNG alpha for
        // transparency. Keep the frozen source files byte-for-byte intact and
        // convert only the temporary option-2 staging copies.
        for (let offset = 0; offset < image.bitmap.data.length; offset += 4) {
            if (image.bitmap.data[offset + 3] < 128) {
                image.bitmap.data[offset + 0] = 0xff;
                image.bitmap.data[offset + 1] = 0x00;
                image.bitmap.data[offset + 2] = 0xff;
            }
            image.bitmap.data[offset + 3] = 0xff;
        }

        await image.write(path.join(spriteDir, `r481_ge_sprite_${sourceId}.png`));
    }
}

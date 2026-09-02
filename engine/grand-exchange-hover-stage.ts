import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GE_INTERFACE_NAME = 'grand_exchange_overview';
const CLOSE_COMPONENT = 13;
const BACK_COMPONENT = 127;
const CONFIRM_COMPONENT = 190;
const BUY_ICON_COMPONENTS = [29, 45, 61, 80, 99, 118] as const;
const SELL_ICON_COMPONENTS = [28, 44, 60, 79, 98, 117] as const;
const HOVER_SPRITES = [
    { sourceId: 832, width: 16, height: 16, sha256: 'f5f1d74c9003f10501aca772505e51b65bd48c89e600c810dd93be0d63344c5e' },
    { sourceId: 1149, width: 35, height: 35, sha256: '1bcb8476118c21cadd9360f83d8d06ed48bd754c2ea45591ab783f0b313518f5' },
    { sourceId: 1169, width: 26, height: 35, sha256: '1bd65a47cc0357655147acc0d4271b750b6ca905a45c9a425a0862fae2aaa32e' },
    { sourceId: 1171, width: 26, height: 35, sha256: '222024851fc80411219330f3b51d3d56a326d1fd928a56ca0bacd1ca32a155cb' },
] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange hover stage is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function patchHoverGraphic(source: string, componentId: number, normalGraphic: string, hoverGraphic: string) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    if (!block.includes('type=graphic') || !block.includes(`graphic=${normalGraphic}`)) {
        throw new Error(`Grand Exchange hover ${marker} no longer uses ${normalGraphic}`);
    }

    let patched = block;
    const activeGraphic = `activegraphic=${hoverGraphic}`;
    if (patched.includes('activegraphic=')) {
        patched = patched.replace(/^activegraphic=.*$/m, activeGraphic);
    } else {
        patched = patched.replace(`graphic=${normalGraphic}`, `graphic=${normalGraphic}\n${activeGraphic}`);
    }

    return source.slice(0, start) + patched + source.slice(end);
}

async function stageHoverSprites(stagedContentDir: string) {
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const sprite of HOVER_SPRITES) {
        const sourcePath = path.join(PLUGIN_DIR, 'assets', 'sprites', `${sprite.sourceId}.png`);
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Grand Exchange hover sprite source is missing: ${sourcePath}`);
        }

        const actualHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
        if (actualHash !== sprite.sha256) {
            throw new Error(
                `Grand Exchange hover sprite ${sprite.sourceId} hash mismatch: expected ${sprite.sha256}, got ${actualHash}`
            );
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== sprite.width || image.bitmap.height !== sprite.height) {
            throw new Error(
                `Grand Exchange hover sprite ${sprite.sourceId} dimensions changed: expected ${sprite.width}x${sprite.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }

        // r254 media uses opaque magenta as its transparent palette entry.
        for (let offset = 0; offset < image.bitmap.data.length; offset += 4) {
            if (image.bitmap.data[offset + 3] < 128) {
                image.bitmap.data[offset + 0] = 0xff;
                image.bitmap.data[offset + 1] = 0x00;
                image.bitmap.data[offset + 2] = 0xff;
            }
            image.bitmap.data[offset + 3] = 0xff;
        }

        await image.write(path.join(spriteDir, `r481_ge_sprite_${sprite.sourceId}.png`));
    }
}

export async function prepareGrandExchangeHoverStage(stagedContentDir: string) {
    await stageHoverSprites(stagedContentDir);

    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange hover interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    source = patchHoverGraphic(source, CLOSE_COMPONENT, 'r481_ge_sprite_831,0', 'r481_ge_sprite_832,0');
    source = patchHoverGraphic(source, BACK_COMPONENT, 'r481_ge_sprite_200127,0', 'r481_ge_sprite_1149,0');
    source = patchHoverGraphic(
        source,
        CONFIRM_COMPONENT,
        'r481_ge_confirm_offer_button,0',
        'r481_ge_confirm_offer_button_hover,0'
    );

    for (const componentId of BUY_ICON_COMPONENTS) {
        source = patchHoverGraphic(source, componentId, 'r481_ge_sprite_1170,0', 'r481_ge_sprite_1171,0');
    }
    for (const componentId of SELL_ICON_COMPONENTS) {
        source = patchHoverGraphic(source, componentId, 'r481_ge_sprite_1168,0', 'r481_ge_sprite_1169,0');
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

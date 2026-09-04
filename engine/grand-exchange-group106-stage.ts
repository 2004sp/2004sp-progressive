import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GROUP106_ASSETS_PATH = path.join(PLUGIN_DIR, 'group106-assets.json');

const GROUP106_INTERFACE_NAME = 'grand_exchange_group_106';
const GROUP106_INTERFACE_ROOT = 8991;
const GROUP106_COMPONENT_BASE = 9256;
const GROUP106_COMPONENT_MAX_SOURCE_ID = 145;

type Group106AssetManifest = {
    interface: {
        source_group_id: number;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
    };
    sprites: Array<{
        source_id: number;
        file: string;
        width: number;
        height: number;
        sha256: string;
    }>;
};

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const line of content.split('\n')) {
        if (!line) {
            continue;
        }
        const equals = line.indexOf('=');
        if (equals === -1) {
            continue;
        }
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) {
            values.set(id, line.slice(equals + 1));
        }
    }

    return { content, values };
}

function injectGroup106InterfaceMappings(stagedContentDir: string) {
    const manifest = JSON.parse(fs.readFileSync(GROUP106_ASSETS_PATH, 'utf8')) as Group106AssetManifest;
    if (
        manifest.interface.source_group_id !== 106 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP106_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP106_COMPONENT_BASE ||
        manifest.interface.source_component_count !== 146
    ) {
        throw new Error('Grand Exchange group-106 asset manifest no longer matches the frozen ID reservation');
    }

    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GROUP106_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange group-106 IF1 source was not staged: ${interfacePath}`);
    }

    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const sourceComponentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match =>
        Number.parseInt(match[1], 10)
    );

    if (sourceComponentIds.length !== 146) {
        throw new Error(`Grand Exchange group 106 expected 146 components, found ${sourceComponentIds.length}`);
    }

    for (let sourceId = 0; sourceId <= GROUP106_COMPONENT_MAX_SOURCE_ID; sourceId++) {
        if (sourceComponentIds[sourceId] !== sourceId) {
            throw new Error(`Grand Exchange group 106 component mapping is not contiguous at source component ${sourceId}`);
        }
    }

    const { content: originalPack, values } = readPack(packPath);
    const mappings = new Map<number, string>();
    mappings.set(GROUP106_INTERFACE_ROOT, GROUP106_INTERFACE_NAME);
    for (const sourceId of sourceComponentIds) {
        mappings.set(GROUP106_COMPONENT_BASE + sourceId, `${GROUP106_INTERFACE_NAME}:com_${sourceId}`);
    }

    const names = new Map<string, number>();
    for (const [id, name] of values) {
        names.set(name, id);
    }

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`Reserved Grand Exchange group-106 interface ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`Grand Exchange interface name ${name} is already mapped to ${existingId}`);
        }

        if (!existingName) {
            additions.push(`${id}=${name}`);
        }
    }

    const normalizedPack = originalPack.endsWith('\n') ? originalPack : `${originalPack}\n`;
    fs.writeFileSync(packPath, normalizedPack + additions.join('\n') + (additions.length ? '\n' : ''), 'utf8');

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [
        GROUP106_INTERFACE_ROOT,
        ...sourceComponentIds.map(sourceId => GROUP106_COMPONENT_BASE + sourceId),
    ]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectGroup106ScriptMapping(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const triggerName = '[debugproc,ge106]';

    for (const value of values.values()) {
        if (value === triggerName) {
            return;
        }
    }

    let maxId = -1;
    for (const id of values.keys()) {
        maxId = Math.max(maxId, id);
    }

    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

async function stageGroup106Sprites(stagedContentDir: string) {
    const manifest = JSON.parse(fs.readFileSync(GROUP106_ASSETS_PATH, 'utf8')) as Group106AssetManifest;
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const sprite of manifest.sprites) {
        const sourcePath = path.join(PLUGIN_DIR, sprite.file);
        const bytes = fs.readFileSync(sourcePath);
        const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actualHash !== sprite.sha256) {
            throw new Error(
                `Grand Exchange group-106 sprite ${sprite.source_id} hash mismatch: expected ${sprite.sha256}, got ${actualHash}`
            );
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== sprite.width || image.bitmap.height !== sprite.height) {
            throw new Error(
                `Grand Exchange group-106 sprite ${sprite.source_id} dimensions changed: expected ${sprite.width}x${sprite.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }

        // Keep the r481 source PNGs pristine in the plugin tree. Only the
        // option-2 staging copy is converted to r254's magenta transparency.
        for (let offset = 0; offset < image.bitmap.data.length; offset += 4) {
            const alpha = image.bitmap.data[offset + 3];
            if (alpha < 128) {
                image.bitmap.data[offset + 0] = 0xff;
                image.bitmap.data[offset + 1] = 0x00;
                image.bitmap.data[offset + 2] = 0xff;
            }
            image.bitmap.data[offset + 3] = 0xff;
        }

        await image.write(path.join(spriteDir, `r481_ge_sprite_${sprite.source_id}.png`));
    }
}

export async function prepareGrandExchangeGroup106Stage(stagedContentDir: string) {
    if (!fs.existsSync(GROUP106_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-106 asset manifest is missing: ${GROUP106_ASSETS_PATH}`);
    }

    injectGroup106InterfaceMappings(stagedContentDir);
    injectGroup106ScriptMapping(stagedContentDir);
    await stageGroup106Sprites(stagedContentDir);
}

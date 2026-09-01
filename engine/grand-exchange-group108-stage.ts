import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GROUP108_ASSETS_PATH = path.join(PLUGIN_DIR, 'group108-assets.json');

const GROUP108_INTERFACE_NAME = 'grand_exchange_group_108';
const GROUP108_INTERFACE_ROOT = 8993;
const GROUP108_COMPONENT_BASE = 9768;
const GROUP108_COMPONENT_MAX_SOURCE_ID = 97;

type Group108AssetManifest = {
    interface: {
        source_group_id: number;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
        source_component_ids: number[];
        source_font_ids: number[];
        source_model_ids: number[];
    };
    reused_staged_media: Array<{
        name: string;
        width: number;
        height: number;
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

function readAndValidateManifest() {
    const manifest = JSON.parse(fs.readFileSync(GROUP108_ASSETS_PATH, 'utf8')) as Group108AssetManifest;
    const expectedSourceIds = Array.from({ length: GROUP108_COMPONENT_MAX_SOURCE_ID + 1 }, (_, index) => index);

    if (
        manifest.interface.source_group_id !== 108 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP108_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP108_COMPONENT_BASE ||
        manifest.interface.source_component_count !== expectedSourceIds.length ||
        manifest.interface.source_component_ids.join(',') !== expectedSourceIds.join(',') ||
        manifest.interface.source_font_ids.join(',') !== '494,495,496' ||
        manifest.interface.source_model_ids.join(',') !== '2810'
    ) {
        throw new Error('Grand Exchange group-108 asset manifest no longer matches the frozen offer-state export');
    }

    return manifest;
}

function injectGroup108InterfaceMappings(stagedContentDir: string, manifest: Group108AssetManifest) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GROUP108_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange group-108 IF1 source was not staged: ${interfacePath}`);
    }

    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const sourceComponentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match =>
        Number.parseInt(match[1], 10)
    );

    if (sourceComponentIds.length !== manifest.interface.source_component_count) {
        throw new Error(
            `Grand Exchange group 108 expected ${manifest.interface.source_component_count} components, found ${sourceComponentIds.length}`
        );
    }

    for (let sourceId = 0; sourceId <= GROUP108_COMPONENT_MAX_SOURCE_ID; sourceId++) {
        if (sourceComponentIds[sourceId] !== sourceId) {
            throw new Error(`Grand Exchange group 108 component mapping is not contiguous at source component ${sourceId}`);
        }
    }

    const { content: originalPack, values } = readPack(packPath);
    const mappings = new Map<number, string>();
    mappings.set(GROUP108_INTERFACE_ROOT, GROUP108_INTERFACE_NAME);
    for (const sourceId of sourceComponentIds) {
        mappings.set(GROUP108_COMPONENT_BASE + sourceId, `${GROUP108_INTERFACE_NAME}:com_${sourceId}`);
    }

    const names = new Map<string, number>();
    for (const [id, name] of values) {
        names.set(name, id);
    }

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`Reserved Grand Exchange group-108 interface ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`Grand Exchange group-108 interface name ${name} is already mapped to ${existingId}`);
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
        GROUP108_INTERFACE_ROOT,
        ...sourceComponentIds.map(sourceId => GROUP108_COMPONENT_BASE + sourceId),
    ]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectGroup108ScriptMapping(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const triggerName = '[debugproc,ge108]';

    if (Array.from(values.values()).includes(triggerName)) {
        return;
    }

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

async function verifyGroup108Media(stagedContentDir: string, manifest: Group108AssetManifest) {
    const spriteDir = path.join(stagedContentDir, 'sprites');

    for (const media of manifest.reused_staged_media) {
        const file = path.join(spriteDir, `${media.name}.png`);
        if (!fs.existsSync(file)) {
            throw new Error(`Grand Exchange group-108 required staged media is missing: ${media.name}.png`);
        }

        const image = await Jimp.read(file);
        if (image.bitmap.width !== media.width || image.bitmap.height !== media.height) {
            throw new Error(
                `Grand Exchange group-108 staged media ${media.name} dimensions changed: expected ${media.width}x${media.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }
    }
}

export async function prepareGrandExchangeGroup108Stage(stagedContentDir: string) {
    if (!fs.existsSync(GROUP108_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-108 asset manifest is missing: ${GROUP108_ASSETS_PATH}`);
    }

    const manifest = readAndValidateManifest();
    injectGroup108InterfaceMappings(stagedContentDir, manifest);
    injectGroup108ScriptMapping(stagedContentDir);
    await verifyGroup108Media(stagedContentDir, manifest);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GROUP109_ASSETS_PATH = path.join(PLUGIN_DIR, 'group109-assets.json');

const GROUP109_INTERFACE_NAME = 'grand_exchange_group_109';
const GROUP109_INTERFACE_ROOT = 8994;
const GROUP109_COMPONENT_BASE = 10024;
const GROUP109_COMPONENT_MAX_SOURCE_ID = 57;
const GROUP109_COLLECTION_COMPONENT_IDS = [19, 23, 27, 32, 37, 42] as const;

type Group109AssetManifest = {
    interface: {
        source_group_id: number;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
        source_component_ids: number[];
        source_font_ids: number[];
        historical_collection_inventory_component_ids: number[];
        historical_collection_slot_count: number;
        outputs_per_offer: number;
    };
    containers: Array<{
        id: number;
        name: string;
        size: number;
        scope: string;
        component_id: number;
    }>;
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
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) values.set(id, line.slice(equals + 1));
    }
    return { content, values };
}

function readAndValidateManifest() {
    const manifest = JSON.parse(fs.readFileSync(GROUP109_ASSETS_PATH, 'utf8')) as Group109AssetManifest;
    const expectedSourceIds = Array.from({ length: GROUP109_COMPONENT_MAX_SOURCE_ID + 1 }, (_, index) => index);
    const expectedContainerIds = [158, 159, 160, 161, 162, 163];
    const expectedContainerNames = expectedContainerIds.map((_, index) => `ge_collection_offer_${index}`);

    if (
        manifest.interface.source_group_id !== 109 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP109_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP109_COMPONENT_BASE ||
        manifest.interface.source_component_count !== expectedSourceIds.length ||
        manifest.interface.source_component_ids.join(',') !== expectedSourceIds.join(',') ||
        manifest.interface.source_font_ids.join(',') !== '494,495,496' ||
        manifest.interface.historical_collection_inventory_component_ids.join(',') !== GROUP109_COLLECTION_COMPONENT_IDS.join(',') ||
        manifest.interface.historical_collection_slot_count !== 6 ||
        manifest.interface.outputs_per_offer !== 2 ||
        manifest.containers.length !== 6 ||
        manifest.containers.map(container => container.id).join(',') !== expectedContainerIds.join(',') ||
        manifest.containers.map(container => container.name).join(',') !== expectedContainerNames.join(',') ||
        manifest.containers.some((container, index) =>
            container.size !== 2 ||
            container.scope !== 'temp' ||
            container.component_id !== GROUP109_COLLECTION_COMPONENT_IDS[index]
        )
    ) {
        throw new Error('Grand Exchange group-109 asset manifest no longer matches the frozen collection-box mapping');
    }

    return manifest;
}

function validateCollectionHosts(interfaceSource: string) {
    const blockFor = (componentId: number) => {
        const marker = `[com_${componentId}]`;
        const start = interfaceSource.indexOf(marker);
        if (start === -1) throw new Error(`Grand Exchange group 109 is missing ${marker}`);
        const next = interfaceSource.indexOf('\n[com_', start + marker.length);
        return interfaceSource.slice(start, next === -1 ? interfaceSource.length : next);
    };

    for (const componentId of GROUP109_COLLECTION_COMPONENT_IDS) {
        const block = blockFor(componentId);
        for (const required of ['type=inv', 'width=2', 'height=1', 'option1=Collect']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange group 109 collection host com_${componentId} is missing ${required}`);
            }
        }
    }
}

function injectGroup109InterfaceMappings(stagedContentDir: string, manifest: Group109AssetManifest) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GROUP109_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange group-109 IF1 source was not staged: ${interfacePath}`);
    }

    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const sourceComponentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match =>
        Number.parseInt(match[1], 10)
    );

    if (sourceComponentIds.length !== manifest.interface.source_component_count) {
        throw new Error(
            `Grand Exchange group 109 expected ${manifest.interface.source_component_count} components, found ${sourceComponentIds.length}`
        );
    }

    for (let sourceId = 0; sourceId <= GROUP109_COMPONENT_MAX_SOURCE_ID; sourceId++) {
        if (sourceComponentIds[sourceId] !== sourceId) {
            throw new Error(`Grand Exchange group 109 component mapping is not contiguous at source component ${sourceId}`);
        }
    }

    validateCollectionHosts(interfaceSource);

    const { content: originalPack, values } = readPack(packPath);
    const mappings = new Map<number, string>();
    mappings.set(GROUP109_INTERFACE_ROOT, GROUP109_INTERFACE_NAME);
    for (const sourceId of sourceComponentIds) {
        mappings.set(GROUP109_COMPONENT_BASE + sourceId, `${GROUP109_INTERFACE_NAME}:com_${sourceId}`);
    }

    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`Reserved Grand Exchange group-109 interface ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`Grand Exchange group-109 interface name ${name} is already mapped to ${existingId}`);
        }

        if (!existingName) additions.push(`${id}=${name}`);
    }

    const normalizedPack = originalPack.endsWith('\n') ? originalPack : `${originalPack}\n`;
    fs.writeFileSync(packPath, normalizedPack + additions.join('\n') + (additions.length ? '\n' : ''), 'utf8');

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [
        GROUP109_INTERFACE_ROOT,
        ...sourceComponentIds.map(sourceId => GROUP109_COMPONENT_BASE + sourceId),
    ]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function validateCollectionConfig(stagedContentDir: string, manifest: Group109AssetManifest) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_collection.inv'
    );
    if (!fs.existsSync(configPath)) {
        throw new Error(`Grand Exchange group-109 collection inventory config was not staged: ${configPath}`);
    }

    const source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
    for (const container of manifest.containers) {
        const marker = `[${container.name}]`;
        const start = source.indexOf(marker);
        if (start === -1) throw new Error(`Grand Exchange group 109 collection config is missing ${marker}`);
        const next = source.indexOf('\n[', start + marker.length);
        const block = source.slice(start, next === -1 ? source.length : next);
        if (!block.includes(`scope=${container.scope}`) || !block.includes(`size=${container.size}`)) {
            throw new Error(`Grand Exchange group 109 collection config ${marker} no longer matches its manifest`);
        }
    }
}

function injectGroup109InventoryMappings(stagedContentDir: string, manifest: Group109AssetManifest) {
    const packPath = path.join(stagedContentDir, 'pack', 'inv.pack');
    const { content: originalPack, values } = readPack(packPath);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (const container of manifest.containers) {
        const existingName = values.get(container.id);
        if (existingName && existingName !== container.name) {
            throw new Error(`Reserved Grand Exchange collection inv ID ${container.id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(container.name);
        if (typeof existingId === 'number' && existingId !== container.id) {
            throw new Error(`Grand Exchange collection inv ${container.name} is already mapped to ${existingId}`);
        }

        if (!existingName) additions.push(`${container.id}=${container.name}`);
    }

    const normalizedPack = originalPack.endsWith('\n') ? originalPack : `${originalPack}\n`;
    fs.writeFileSync(packPath, normalizedPack + additions.join('\n') + (additions.length ? '\n' : ''), 'utf8');
}

function injectGroup109ScriptMapping(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const triggerName = '[debugproc,ge109]';

    if (Array.from(values.values()).includes(triggerName)) return;

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

async function verifyGroup109Media(stagedContentDir: string, manifest: Group109AssetManifest) {
    const spriteDir = path.join(stagedContentDir, 'sprites');

    for (const media of manifest.reused_staged_media) {
        const file = path.join(spriteDir, `${media.name}.png`);
        if (!fs.existsSync(file)) {
            throw new Error(`Grand Exchange group-109 required staged media is missing: ${media.name}.png`);
        }

        const image = await Jimp.read(file);
        if (image.bitmap.width !== media.width || image.bitmap.height !== media.height) {
            throw new Error(
                `Grand Exchange group-109 staged media ${media.name} dimensions changed: expected ${media.width}x${media.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }
    }
}

export async function prepareGrandExchangeGroup109Stage(stagedContentDir: string) {
    if (!fs.existsSync(GROUP109_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-109 asset manifest is missing: ${GROUP109_ASSETS_PATH}`);
    }

    const manifest = readAndValidateManifest();
    validateCollectionConfig(stagedContentDir, manifest);
    injectGroup109InventoryMappings(stagedContentDir, manifest);
    injectGroup109InterfaceMappings(stagedContentDir, manifest);
    injectGroup109ScriptMapping(stagedContentDir);
    await verifyGroup109Media(stagedContentDir, manifest);
}

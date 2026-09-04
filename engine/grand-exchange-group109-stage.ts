import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
const GROUP109_COMPONENT_MAX_HELPER_ID = 81;
const GROUP109_SLOT_HOSTS = [17, 22, 27, 35, 43, 51] as const;
const GROUP109_SLOT_INVS = [59, 63, 67, 71, 75, 79] as const;
const GROUP109_COLLECT_BUTTONS = [61, 65, 69, 73, 77, 81] as const;

const GROUP109_SCRIPT_TRIGGERS = [
    '[debugproc,ge109]',
    '[debugproc,ge109empty]',
    ...GROUP109_SLOT_INVS.map(componentId => `[inv_button1,grand_exchange_group_109:com_${componentId}]`),
    ...GROUP109_COLLECT_BUTTONS.map(componentId => `[if_button,grand_exchange_group_109:com_${componentId}]`),
] as const;

type Group109AssetManifest = {
    interface: {
        source_group_id: number;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
        source_component_ids: number[];
        if1_helper_component_ids: number[];
        reserved_component_block_end: number;
        source_sprite_ids: number[];
        source_font_ids: number[];
        source_model_ids: number[];
    };
    inventory_hooks: Array<{
        source_inv_id: number;
        local_inv_id: number;
        local_name: string;
        slot: number;
        host_component_id: number;
        size: number;
        scope: string;
    }>;
    sprites: Array<{
        source_id: number;
        file: string;
        width: number;
        height: number;
        sha256: string;
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
    const expectedHelperIds = Array.from(
        { length: GROUP109_COMPONENT_MAX_HELPER_ID - GROUP109_COMPONENT_MAX_SOURCE_ID },
        (_, index) => GROUP109_COMPONENT_MAX_SOURCE_ID + 1 + index
    );
    const expectedInvIds = [523, 524, 525, 526, 527, 528];
    const expectedLocalInvIds = [158, 159, 160, 161, 162, 163];

    if (
        manifest.interface.source_group_id !== 109 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP109_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP109_COMPONENT_BASE ||
        manifest.interface.source_component_count !== expectedSourceIds.length ||
        manifest.interface.source_component_ids.join(',') !== expectedSourceIds.join(',') ||
        manifest.interface.if1_helper_component_ids.join(',') !== expectedHelperIds.join(',') ||
        manifest.interface.reserved_component_block_end !== 10279 ||
        manifest.interface.source_sprite_ids.join(',') !== '297,831,954,955,956,957,958,959,960,961,962,963,964,1164,1167' ||
        manifest.interface.source_font_ids.join(',') !== '496' ||
        manifest.interface.source_model_ids.length !== 0 ||
        manifest.inventory_hooks.length !== 6 ||
        manifest.inventory_hooks.map(hook => hook.source_inv_id).join(',') !== expectedInvIds.join(',') ||
        manifest.inventory_hooks.map(hook => hook.local_inv_id).join(',') !== expectedLocalInvIds.join(',') ||
        manifest.inventory_hooks.map(hook => hook.host_component_id).join(',') !== GROUP109_SLOT_HOSTS.join(',') ||
        manifest.inventory_hooks.some((hook, index) =>
            hook.slot !== index ||
            hook.local_name !== `ge_collection_offer_${index}` ||
            hook.size !== 2 ||
            hook.scope !== 'temp'
        )
    ) {
        throw new Error('Grand Exchange group-109 asset manifest no longer matches the frozen Collection Box export');
    }

    return manifest;
}

function appendPackMappings(file: string, mappings: Map<number, string>, label: string) {
    const { content, values } = readPack(file);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`${label} reserved ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`${label} name ${name} is already mapped to ${existingId}`);
        }

        if (!existingName) additions.push(`${id}=${name}`);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(file, normalized + additions.join('\n') + '\n', 'utf8');
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
    for (const hook of manifest.inventory_hooks) {
        const marker = `[${hook.local_name}]`;
        const start = source.indexOf(marker);
        if (start === -1) throw new Error(`Grand Exchange group 109 collection config is missing ${marker}`);
        const next = source.indexOf('\n[', start + marker.length);
        const block = source.slice(start, next === -1 ? source.length : next);
        if (!block.includes(`scope=${hook.scope}`) || !block.includes(`size=${hook.size}`)) {
            throw new Error(`Grand Exchange group 109 collection config ${marker} no longer matches its manifest`);
        }
    }
}

function injectGroup109InventoryMappings(stagedContentDir: string, manifest: Group109AssetManifest) {
    const mappings = new Map<number, string>();
    for (const hook of manifest.inventory_hooks) mappings.set(hook.local_inv_id, hook.local_name);
    appendPackMappings(path.join(stagedContentDir, 'pack', 'inv.pack'), mappings, 'Grand Exchange group-109 inventory');
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
    const componentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match => Number.parseInt(match[1], 10));
    const expectedIds = [...manifest.interface.source_component_ids, ...manifest.interface.if1_helper_component_ids];

    if (componentIds.length !== expectedIds.length) {
        throw new Error(`Grand Exchange group 109 expected ${expectedIds.length} source/helper components, found ${componentIds.length}`);
    }
    for (let index = 0; index < expectedIds.length; index++) {
        if (componentIds[index] !== expectedIds[index]) {
            throw new Error(`Grand Exchange group 109 component mapping is not contiguous at component ${expectedIds[index]}`);
        }
    }

    for (const componentId of GROUP109_SLOT_INVS) {
        const marker = `[com_${componentId}]`;
        const start = interfaceSource.indexOf(marker);
        const next = interfaceSource.indexOf('\n[com_', start + marker.length);
        const block = interfaceSource.slice(start, next === -1 ? interfaceSource.length : next);
        for (const required of ['type=inv', 'width=2', 'height=1', 'option1=Collect']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange group 109 helper ${marker} is missing ${required}`);
            }
        }
    }

    const mappings = new Map<number, string>();
    mappings.set(GROUP109_INTERFACE_ROOT, GROUP109_INTERFACE_NAME);
    for (const componentId of componentIds) {
        const localId = GROUP109_COMPONENT_BASE + componentId;
        if (localId > manifest.interface.reserved_component_block_end) {
            throw new Error(`Grand Exchange group-109 helper component ${componentId} exceeds the reserved interface block`);
        }
        mappings.set(localId, `${GROUP109_INTERFACE_NAME}:com_${componentId}`);
    }
    appendPackMappings(packPath, mappings, 'Grand Exchange group-109 interface');

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [GROUP109_INTERFACE_ROOT, ...componentIds.map(componentId => GROUP109_COMPONENT_BASE + componentId)]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectGroup109ScriptMappings(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const existingNames = new Set(values.values());
    const additions: string[] = [];
    let maxId = Math.max(-1, ...values.keys());

    for (const triggerName of GROUP109_SCRIPT_TRIGGERS) {
        if (existingNames.has(triggerName)) continue;
        maxId++;
        additions.push(`${maxId}=${triggerName}`);
        existingNames.add(triggerName);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
}

async function stageGroup109Sprites(stagedContentDir: string, manifest: Group109AssetManifest) {
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const sprite of manifest.sprites) {
        const sourcePath = path.join(PLUGIN_DIR, sprite.file);
        const bytes = fs.readFileSync(sourcePath);
        const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actualHash !== sprite.sha256) {
            throw new Error(
                `Grand Exchange group-109 sprite ${sprite.source_id} hash mismatch: expected ${sprite.sha256}, got ${actualHash}`
            );
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== sprite.width || image.bitmap.height !== sprite.height) {
            throw new Error(
                `Grand Exchange group-109 sprite ${sprite.source_id} dimensions changed: expected ${sprite.width}x${sprite.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }

        for (let offset = 0; offset < image.bitmap.data.length; offset += 4) {
            if (image.bitmap.data[offset + 3] < 128) {
                image.bitmap.data[offset + 0] = 0xff;
                image.bitmap.data[offset + 1] = 0x00;
                image.bitmap.data[offset + 2] = 0xff;
            }
            image.bitmap.data[offset + 3] = 0xff;
        }

        await image.write(path.join(spriteDir, `r481_ge_sprite_${sprite.source_id}.png`));
    }
}

async function verifyGroup109ReusedMedia(stagedContentDir: string, manifest: Group109AssetManifest) {
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
    injectGroup109ScriptMappings(stagedContentDir);
    await stageGroup109Sprites(stagedContentDir, manifest);
    await verifyGroup109ReusedMedia(stagedContentDir, manifest);
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

import {
    GRAND_EXCHANGE_HISTORY_PLACEHOLDER_ENTRIES,
    GRAND_EXCHANGE_HISTORY_ROWS,
} from './grand-exchange-history-contract.js';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GROUP643_ASSETS_PATH = path.join(PLUGIN_DIR, 'group643-assets.json');

const GROUP643_INTERFACE_NAME = 'grand_exchange_group_643';
const GROUP643_INTERFACE_ROOT = 8996;
const GROUP643_COMPONENT_BASE = 10536;
const GROUP643_COMPONENT_MAX_SOURCE_ID = 50;
const GROUP643_COMPONENT_MAX_HELPER_ID = 65;
const GROUP643_RESERVED_BLOCK_END = 10791;
const GROUP643_SOURCE_SPRITE_IDS = [
    297, 820, 821, 822, 823, 824, 825, 826, 827, 828, 829, 830, 831, 851, 852, 1074, 1164,
] as const;
const GROUP643_SCRIPT_TRIGGERS = ['[debugproc,ge643]', '[debugproc,ge643test]'] as const;

type Group643AssetManifest = {
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
        source_zero_model_host_component_id: number;
        scrolling: {
            source_scrollable_component_ids: number[];
            status: string;
        };
        dynamic_history_compatibility: {
            if1_helper_item_model_component_ids: number[];
            if1_helper_status_component_ids: number[];
            if1_helper_timestamp_component_ids: number[];
            item_source_boundary: string;
            status: string;
        };
    };
    history_contract: {
        row_count: number;
        shell_default: string;
        placeholder_debug_trigger: string;
        item_source: string;
    };
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

function readAndValidateManifest() {
    const manifest = JSON.parse(fs.readFileSync(GROUP643_ASSETS_PATH, 'utf8')) as Group643AssetManifest;
    const expectedSourceIds = Array.from({ length: GROUP643_COMPONENT_MAX_SOURCE_ID + 1 }, (_, index) => index);
    const expectedHelperIds = Array.from(
        { length: GROUP643_COMPONENT_MAX_HELPER_ID - GROUP643_COMPONENT_MAX_SOURCE_ID },
        (_, index) => GROUP643_COMPONENT_MAX_SOURCE_ID + 1 + index
    );
    const compatibility = manifest.interface.dynamic_history_compatibility;

    if (
        manifest.interface.source_group_id !== 643 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP643_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP643_COMPONENT_BASE ||
        manifest.interface.source_component_count !== expectedSourceIds.length ||
        manifest.interface.source_component_ids.join(',') !== expectedSourceIds.join(',') ||
        manifest.interface.if1_helper_component_ids.join(',') !== expectedHelperIds.join(',') ||
        manifest.interface.reserved_component_block_end !== GROUP643_RESERVED_BLOCK_END ||
        manifest.interface.source_sprite_ids.join(',') !== GROUP643_SOURCE_SPRITE_IDS.join(',') ||
        manifest.interface.source_font_ids.join(',') !== '494,496' ||
        manifest.interface.source_model_ids.length !== 0 ||
        manifest.interface.source_zero_model_host_component_id !== 14 ||
        manifest.interface.scrolling.source_scrollable_component_ids.length !== 0 ||
        manifest.interface.scrolling.status !== 'not-present-in-frozen-group-643' ||
        compatibility.if1_helper_item_model_component_ids.join(',') !== '51,52,53,54,55' ||
        compatibility.if1_helper_status_component_ids.join(',') !== '56,57,58,59,60' ||
        compatibility.if1_helper_timestamp_component_ids.join(',') !== '61,62,63,64,65' ||
        compatibility.item_source_boundary !== 'native-r254-only' ||
        compatibility.status !== 'renderable-shell-with-server-population-contract' ||
        manifest.history_contract.row_count !== 5 ||
        manifest.history_contract.shell_default !== 'empty' ||
        manifest.history_contract.placeholder_debug_trigger !== '[debugproc,ge643test]' ||
        manifest.history_contract.item_source !== 'native r254 obj IDs/names/models only'
    ) {
        throw new Error('Grand Exchange group-643 asset manifest no longer matches the frozen history export');
    }

    return manifest;
}

function validateHistoryContract() {
    if (GRAND_EXCHANGE_HISTORY_ROWS.length !== 5 || GRAND_EXCHANGE_HISTORY_PLACEHOLDER_ENTRIES.length !== 5) {
        throw new Error('Grand Exchange group-643 history contract must contain exactly five rows');
    }

    for (let row = 0; row < 5; row++) {
        const binding = GRAND_EXCHANGE_HISTORY_ROWS[row];
        if (
            binding.row !== row ||
            binding.offerTypeComponentId !== 25 + row ||
            binding.quantityComponentId !== 30 + row ||
            binding.itemNameComponentId !== 35 + row ||
            binding.priceComponentId !== 40 + row ||
            binding.separatorComponentId !== 45 + row ||
            binding.itemModelHelperComponentId !== 51 + row ||
            binding.statusHelperComponentId !== 56 + row ||
            binding.timestampHelperComponentId !== 61 + row
        ) {
            throw new Error(`Grand Exchange group-643 history row ${row} binding drifted from its reserved components`);
        }
    }

    const fixture = GRAND_EXCHANGE_HISTORY_PLACEHOLDER_ENTRIES;
    if (
        fixture.map(entry => entry.nativeItemId).join(',') !== '379,1303,379,1303,379' ||
        fixture.map(entry => entry.offerType).join(',') !== 'buy,sell,buy,sell,buy' ||
        fixture.map(entry => entry.status).join(',') !== 'completed,partial,cancelled,completed,pending'
    ) {
        throw new Error('Grand Exchange group-643 deterministic placeholder fixture changed unexpectedly');
    }
}

function injectGroup643InterfaceMappings(stagedContentDir: string, manifest: Group643AssetManifest) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GROUP643_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange group-643 IF1 source was not staged: ${interfacePath}`);
    }

    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const componentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match => Number.parseInt(match[1], 10));
    const expectedIds = [...manifest.interface.source_component_ids, ...manifest.interface.if1_helper_component_ids];

    if (componentIds.length !== expectedIds.length) {
        throw new Error(
            `Grand Exchange group 643 expected ${expectedIds.length} source/helper components, found ${componentIds.length}`
        );
    }

    for (let index = 0; index < expectedIds.length; index++) {
        if (componentIds[index] !== expectedIds[index]) {
            throw new Error(`Grand Exchange group 643 component mapping is not contiguous at component ${expectedIds[index]}`);
        }

        const localId = GROUP643_COMPONENT_BASE + componentIds[index];
        if (localId > GROUP643_RESERVED_BLOCK_END) {
            throw new Error(`Grand Exchange group-643 component ${componentIds[index]} exceeds the reserved interface block`);
        }
    }

    const mappings = new Map<number, string>();
    mappings.set(GROUP643_INTERFACE_ROOT, GROUP643_INTERFACE_NAME);
    for (const componentId of componentIds) {
        mappings.set(GROUP643_COMPONENT_BASE + componentId, `${GROUP643_INTERFACE_NAME}:com_${componentId}`);
    }
    appendPackMappings(packPath, mappings, 'Grand Exchange group-643 interface');

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [GROUP643_INTERFACE_ROOT, ...componentIds.map(componentId => GROUP643_COMPONENT_BASE + componentId)]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectGroup643ScriptMappings(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const existingNames = new Set(values.values());
    const additions: string[] = [];
    let maxId = Math.max(-1, ...values.keys());

    for (const triggerName of GROUP643_SCRIPT_TRIGGERS) {
        if (existingNames.has(triggerName)) continue;
        maxId++;
        additions.push(`${maxId}=${triggerName}`);
        existingNames.add(triggerName);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
}

async function stageGroup643Sprites(stagedContentDir: string, manifest: Group643AssetManifest) {
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const sprite of manifest.sprites) {
        const sourcePath = path.join(PLUGIN_DIR, sprite.file);
        const bytes = fs.readFileSync(sourcePath);
        const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
        if (actualHash !== sprite.sha256) {
            throw new Error(
                `Grand Exchange group-643 sprite ${sprite.source_id} hash mismatch: expected ${sprite.sha256}, got ${actualHash}`
            );
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== sprite.width || image.bitmap.height !== sprite.height) {
            throw new Error(
                `Grand Exchange group-643 sprite ${sprite.source_id} dimensions changed: expected ${sprite.width}x${sprite.height}, got ${image.bitmap.width}x${image.bitmap.height}`
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

async function verifyGroup643ReusedMedia(stagedContentDir: string, manifest: Group643AssetManifest) {
    const spriteDir = path.join(stagedContentDir, 'sprites');

    for (const media of manifest.reused_staged_media) {
        const file = path.join(spriteDir, `${media.name}.png`);
        if (!fs.existsSync(file)) {
            throw new Error(`Grand Exchange group-643 required staged media is missing: ${media.name}.png`);
        }

        const image = await Jimp.read(file);
        if (image.bitmap.width !== media.width || image.bitmap.height !== media.height) {
            throw new Error(
                `Grand Exchange group-643 staged media ${media.name} dimensions changed: expected ${media.width}x${media.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }
    }
}

export async function prepareGrandExchangeGroup643Stage(stagedContentDir: string) {
    if (!fs.existsSync(GROUP643_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-643 asset manifest is missing: ${GROUP643_ASSETS_PATH}`);
    }

    const manifest = readAndValidateManifest();
    validateHistoryContract();
    injectGroup643InterfaceMappings(stagedContentDir, manifest);
    injectGroup643ScriptMappings(stagedContentDir);
    await stageGroup643Sprites(stagedContentDir, manifest);
    await verifyGroup643ReusedMedia(stagedContentDir, manifest);
}

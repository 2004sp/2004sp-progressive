import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const GROUP107_ASSETS_PATH = path.join(PLUGIN_DIR, 'group107-assets.json');

const GROUP107_INTERFACE_NAME = 'grand_exchange_group_107';
const GROUP107_INTERFACE_ROOT = 8992;
const GROUP107_COMPONENT_BASE = 9512;
const GROUP107_COMPONENT_MAX_SOURCE_ID = 18;

type Group107AssetManifest = {
    interface: {
        source_group_id: number;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
        source_component_ids: number[];
        initial_hidden_components: number[];
        direct_text: string[];
        direct_sprite_ids: number[];
    };
    sprites: unknown[];
};

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const line of content.split('\n')) {
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

function injectGroup107InterfaceMappings(stagedContentDir: string) {
    const manifest = JSON.parse(fs.readFileSync(GROUP107_ASSETS_PATH, 'utf8')) as Group107AssetManifest;
    const expectedSourceIds = Array.from({ length: GROUP107_COMPONENT_MAX_SOURCE_ID + 1 }, (_, index) => index);
    if (
        manifest.interface.source_group_id !== 107 ||
        manifest.interface.synthetic_if1_root_local_id !== GROUP107_INTERFACE_ROOT ||
        manifest.interface.source_component_block_base !== GROUP107_COMPONENT_BASE ||
        manifest.interface.source_component_count !== expectedSourceIds.length ||
        manifest.interface.source_component_ids.join(',') !== expectedSourceIds.join(',') ||
        manifest.interface.initial_hidden_components.length !== 0 ||
        manifest.interface.direct_text.length !== 0 ||
        manifest.interface.direct_sprite_ids.length !== 0 ||
        manifest.sprites.length !== 0
    ) {
        throw new Error('Grand Exchange group-107 asset manifest no longer matches the frozen helper-overlay export');
    }

    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const interfacePath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GROUP107_INTERFACE_NAME}.if`);

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange group-107 IF1 source was not staged: ${interfacePath}`);
    }

    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const sourceComponentIds = Array.from(interfaceSource.matchAll(/^\[com_(\d+)\]$/gm), match => Number.parseInt(match[1], 10));
    if (sourceComponentIds.length !== expectedSourceIds.length) {
        throw new Error(`Grand Exchange group 107 expected 19 components, found ${sourceComponentIds.length}`);
    }
    for (const sourceId of expectedSourceIds) {
        if (sourceComponentIds[sourceId] !== sourceId) {
            throw new Error(`Grand Exchange group 107 component mapping is not contiguous at source component ${sourceId}`);
        }
    }

    const { content: originalPack, values } = readPack(packPath);
    const mappings = new Map<number, string>();
    mappings.set(GROUP107_INTERFACE_ROOT, GROUP107_INTERFACE_NAME);
    for (const sourceId of sourceComponentIds) {
        mappings.set(GROUP107_COMPONENT_BASE + sourceId, `${GROUP107_INTERFACE_NAME}:com_${sourceId}`);
    }

    const names = new Map<string, number>();
    for (const [id, name] of values) {
        names.set(name, id);
    }

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`Reserved Grand Exchange group-107 interface ID ${id} is already mapped to ${existingName}`);
        }
        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`Grand Exchange group-107 interface name ${name} is already mapped to ${existingId}`);
        }
        if (!existingName) {
            additions.push(`${id}=${name}`);
        }
    }

    const normalizedPack = originalPack.endsWith('\n') ? originalPack : `${originalPack}\n`;
    fs.writeFileSync(packPath, normalizedPack + additions.join('\n') + (additions.length ? '\n' : ''), 'utf8');

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [GROUP107_INTERFACE_ROOT, ...sourceComponentIds.map(sourceId => GROUP107_COMPONENT_BASE + sourceId)]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectGroup107ScriptMapping(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const triggerName = '[debugproc,ge107]';
    if (Array.from(values.values()).includes(triggerName)) {
        return;
    }

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

export async function prepareGrandExchangeGroup107Stage(stagedContentDir: string) {
    if (!fs.existsSync(GROUP107_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-107 asset manifest is missing: ${GROUP107_ASSETS_PATH}`);
    }

    injectGroup107InterfaceMappings(stagedContentDir);
    injectGroup107ScriptMapping(stagedContentDir);
}


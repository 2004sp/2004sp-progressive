import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const WIDGET_COMPATIBILITY_PATH = path.join(PLUGIN_DIR, 'widget-compatibility.json');

const CLIENT_CACHE_OUTPUTS = [
    path.join(ENGINE_DIR, 'data', 'pack', 'client', 'interface'),
    path.join(ENGINE_DIR, 'data', 'pack', 'client', 'media'),
] as const;

const EXPECTED_SOURCE_GROUPS = [105, 106, 107, 108, 109, 110, 643] as const;
const EXPECTED_EXCLUDED_GROUPS = [645, 646] as const;
const MAX_IF1_INTERFACE_ID = 0xffff;

type InterfaceGroupContract = {
    source_group_id: number;
    interface_name: string;
    synthetic_if1_root_local_id: number;
    source_component_block_base: number;
    source_component_count: number;
};

type WidgetCompatibilityManifest = {
    version: number;
    scope: {
        in_scope_interface_groups: number[];
        excluded_interface_groups: number[];
    };
    groups: InterfaceGroupContract[];
};

type PackEntry = {
    id: number;
    name: string;
};

function sameNumbers(actual: readonly number[], expected: readonly number[]) {
    return actual.join(',') === expected.join(',');
}

function readInterfaceContracts() {
    if (!fs.existsSync(WIDGET_COMPATIBILITY_PATH)) {
        throw new Error(`Grand Exchange widget compatibility manifest is missing: ${WIDGET_COMPATIBILITY_PATH}`);
    }

    const manifest = JSON.parse(fs.readFileSync(WIDGET_COMPATIBILITY_PATH, 'utf8')) as WidgetCompatibilityManifest;
    if (
        manifest.version !== 1 ||
        !sameNumbers(manifest.scope.in_scope_interface_groups, EXPECTED_SOURCE_GROUPS) ||
        !sameNumbers(manifest.scope.excluded_interface_groups, EXPECTED_EXCLUDED_GROUPS) ||
        manifest.groups.length !== EXPECTED_SOURCE_GROUPS.length
    ) {
        throw new Error('Grand Exchange interface/cache adapter scope no longer matches the frozen r481 contract');
    }

    for (let index = 0; index < EXPECTED_SOURCE_GROUPS.length; index++) {
        if (manifest.groups[index]?.source_group_id !== EXPECTED_SOURCE_GROUPS[index]) {
            throw new Error(`Grand Exchange interface/cache adapter group order drifted at index ${index}`);
        }
    }

    return manifest.groups;
}

function validateReservedIdRanges(groups: readonly InterfaceGroupContract[]) {
    const reservedIds = new Map<number, string>();

    const reserve = (id: number, label: string) => {
        if (!Number.isInteger(id) || id < 0 || id > MAX_IF1_INTERFACE_ID) {
            throw new Error(`Grand Exchange ${label} uses invalid r254 interface ID ${id}`);
        }

        const previous = reservedIds.get(id);
        if (previous) {
            throw new Error(`Grand Exchange interface ID ${id} is reserved by both ${previous} and ${label}`);
        }
        reservedIds.set(id, label);
    };

    for (const group of groups) {
        if (
            !Number.isInteger(group.source_component_count) ||
            group.source_component_count <= 0 ||
            group.source_component_count > 256
        ) {
            throw new Error(`Grand Exchange group ${group.source_group_id} has invalid source component count ${group.source_component_count}`);
        }

        reserve(group.synthetic_if1_root_local_id, `group ${group.source_group_id} synthetic root`);
        for (let offset = 0; offset < 256; offset++) {
            reserve(group.source_component_block_base + offset, `group ${group.source_group_id} component block`);
        }
    }
}

function readPackEntries(file: string) {
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange interface/cache adapter could not find ${file}`);
    }

    const entries: PackEntry[] = [];
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    for (const [lineIndex, rawLine] of content.split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }

        const equals = line.indexOf('=');
        if (equals <= 0 || equals === line.length - 1) {
            throw new Error(`Grand Exchange interface/cache adapter found malformed pack line ${lineIndex + 1} in ${file}`);
        }

        const id = Number.parseInt(line.slice(0, equals), 10);
        if (!Number.isInteger(id)) {
            throw new Error(`Grand Exchange interface/cache adapter found invalid pack ID on line ${lineIndex + 1} in ${file}`);
        }
        entries.push({ id, name: line.slice(equals + 1) });
    }
    return entries;
}

function readOrder(file: string) {
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange interface/cache adapter could not find ${file}`);
    }

    const ids: number[] = [];
    for (const [lineIndex, rawLine] of fs.readFileSync(file, 'utf8').replace(/\r/g, '').split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }
        if (!/^\d+$/.test(line)) {
            throw new Error(`Grand Exchange interface/cache adapter found malformed interface.order line ${lineIndex + 1}`);
        }
        ids.push(Number.parseInt(line, 10));
    }
    return ids;
}

function parseInterfaceSource(file: string) {
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange IF1 source was not staged: ${file}`);
    }

    const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const matches = [...source.matchAll(/^\[com_(\d+)\]$/gm)];
    const componentIds: number[] = [];
    const graphicNames = new Set<string>();
    const seen = new Set<number>();

    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const componentId = Number.parseInt(match[1], 10);
        if (seen.has(componentId)) {
            throw new Error(`Grand Exchange IF1 source ${path.basename(file)} repeats com_${componentId}`);
        }
        if (componentId < 0 || componentId > 255) {
            throw new Error(`Grand Exchange IF1 source ${path.basename(file)} uses com_${componentId} outside its reserved 256-ID block`);
        }
        seen.add(componentId);
        componentIds.push(componentId);

        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length;
        for (const rawLine of source.slice(start, end).split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//')) {
                continue;
            }

            const equals = line.indexOf('=');
            if (equals === -1) {
                continue;
            }

            const field = line.slice(0, equals).trim().toLowerCase();
            if (field !== 'graphic' && field !== 'activegraphic') {
                continue;
            }

            const value = line.slice(equals + 1).trim();
            const graphicMatch = /^([^,]+),(\d+)$/.exec(value);
            if (!graphicMatch) {
                throw new Error(`Grand Exchange IF1 source ${path.basename(file)} has invalid ${field}=${value}`);
            }
            if (graphicMatch[1].startsWith('r481_ge_')) {
                const frame = Number.parseInt(graphicMatch[2], 10);
                if (frame !== 0) {
                    throw new Error(
                        `Grand Exchange IF1 source ${path.basename(file)} references ${graphicMatch[1]} frame ${frame}; staged r481 GE media is single-frame`
                    );
                }
                graphicNames.add(graphicMatch[1]);
            }
        }
    }

    return { componentIds, graphicNames };
}

function requireSinglePackMapping(entries: readonly PackEntry[], id: number, expectedName: string) {
    const byId = entries.filter(entry => entry.id === id);
    if (byId.length !== 1 || byId[0].name !== expectedName) {
        const actual = byId.length === 0 ? 'missing' : byId.map(entry => entry.name).join(', ');
        throw new Error(`Grand Exchange interface/cache mapping ${id} expected ${expectedName}, found ${actual}`);
    }

    const byName = entries.filter(entry => entry.name === expectedName);
    if (byName.length !== 1 || byName[0].id !== id) {
        throw new Error(`Grand Exchange interface/cache name ${expectedName} is not uniquely mapped to ${id}`);
    }
}

function requireSingleOrderEntry(order: readonly number[], id: number, label: string) {
    let count = 0;
    for (const value of order) {
        if (value === id) {
            count++;
        }
    }
    if (count !== 1) {
        throw new Error(`Grand Exchange ${label} ID ${id} must appear exactly once in interface.order (found ${count})`);
    }
}

function validateStagedInterfaceCacheInputs(stagedContentDir: string, groups: readonly InterfaceGroupContract[]) {
    const interfacePack = readPackEntries(path.join(stagedContentDir, 'pack', 'interface.pack'));
    const interfaceOrder = readOrder(path.join(stagedContentDir, 'pack', 'interface.order'));
    const spriteDir = path.join(stagedContentDir, 'sprites');

    for (const excluded of EXPECTED_EXCLUDED_GROUPS) {
        const excludedPath = path.join(
            stagedContentDir,
            'scripts',
            'grand_exchange',
            'interfaces',
            `grand_exchange_group_${excluded}.if`
        );
        if (fs.existsSync(excludedPath)) {
            throw new Error(`Grand Exchange excluded r481 interface group ${excluded} leaked into the staged r254 cache source`);
        }
    }

    for (const group of groups) {
        const interfacePath = path.join(
            stagedContentDir,
            'scripts',
            'grand_exchange',
            'interfaces',
            `${group.interface_name}.if`
        );
        const { componentIds, graphicNames } = parseInterfaceSource(interfacePath);

        for (let sourceId = 0; sourceId < group.source_component_count; sourceId++) {
            if (!componentIds.includes(sourceId)) {
                throw new Error(`Grand Exchange group ${group.source_group_id} is missing frozen source component com_${sourceId}`);
            }
        }

        requireSinglePackMapping(interfacePack, group.synthetic_if1_root_local_id, group.interface_name);
        requireSingleOrderEntry(interfaceOrder, group.synthetic_if1_root_local_id, `group ${group.source_group_id} root`);

        for (const componentId of componentIds) {
            const localId = group.source_component_block_base + componentId;
            requireSinglePackMapping(interfacePack, localId, `${group.interface_name}:com_${componentId}`);
            requireSingleOrderEntry(interfaceOrder, localId, `group ${group.source_group_id} component`);
        }

        for (const graphicName of graphicNames) {
            const pngPath = path.join(spriteDir, `${graphicName}.png`);
            if (!fs.existsSync(pngPath) || !fs.statSync(pngPath).isFile() || fs.statSync(pngPath).size === 0) {
                throw new Error(`Grand Exchange interface ${group.interface_name} references missing staged r254 media ${graphicName}`);
            }
        }
    }
}

function invalidateNativeClientCacheOutputs() {
    // The existing 2004 packer is incremental. Plugin files are copied with
    // their checkout timestamps, so a pre-existing native interface/media pack
    // can look newer and be incorrectly reused. The base GE stage snapshots
    // both outputs before this adapter runs; deleting only these generated
    // client packs forces the normal r254 Build.ts path to rebuild them from
    // BUILD_SRC_DIR, and restoreGrandExchangeStage() puts the native copies back
    // after option 2 exits or when staging/building fails.
    for (const output of CLIENT_CACHE_OUTPUTS) {
        fs.rmSync(output, { recursive: true, force: true });
    }
}

export function prepareGrandExchangeInterfaceCacheAdapter(stagedContentDir: string) {
    const groups = readInterfaceContracts();
    validateReservedIdRanges(groups);
    validateStagedInterfaceCacheInputs(stagedContentDir, groups);
    invalidateNativeClientCacheOutputs();
}

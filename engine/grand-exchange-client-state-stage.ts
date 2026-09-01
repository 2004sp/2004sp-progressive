import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const CLIENT_STATE_ASSETS_PATH = path.join(PLUGIN_DIR, 'client-state-assets.json');
const GROUP109_ASSETS_PATH = path.join(PLUGIN_DIR, 'group109-assets.json');

const EXPECTED_SOURCE_GROUPS = [105, 106, 107, 108, 109, 110, 643] as const;
const EXPECTED_EXCLUDED_GROUPS = [645, 646] as const;
const EXPECTED_SOURCE_INVS = [523, 524, 525, 526, 527, 528] as const;
const EXPECTED_LOCAL_INVS = [158, 159, 160, 161, 162, 163] as const;

type ClientScriptMapping = {
    source_script_id: number;
    source_component_ids: number[];
    source_inventory_triggers?: number[];
    local_inventory_ids?: number[];
    replacement: string;
    local_script: string;
};

type ClientStateManifest = {
    version: number;
    source: {
        cache: string;
        revision_family: number;
        provided_timestamp: string;
        archive_sha256: string;
    };
    scope: {
        in_scope_interface_groups: number[];
        excluded_interface_groups: number[];
    };
    variable_mapping: {
        strategy: string;
        source_varp_ids: number[];
        source_varbit_ids: number[];
        local_varp_configs: number[];
        local_varbit_configs: number[];
    };
    client_script_mappings: ClientScriptMapping[];
    server_state_substitutions: Array<{
        groups: number[];
        mechanism: string;
        local_script: string;
    }>;
    deferred_server_authoritative_state: string[];
    guardrails: string[];
};

type Group109Manifest = {
    interface: {
        source_listener_hooks: Array<{
            source_component_id?: number;
            source_component_ids?: number[];
            source_onload_script?: number;
            source_oninvtransmit_script?: number;
            source_inventory_triggers?: number[];
        }>;
    };
    inventory_hooks: Array<{
        source_inv_id: number;
        local_inv_id: number;
    }>;
};

function sameNumbers(actual: readonly number[], expected: readonly number[]) {
    return actual.join(',') === expected.join(',');
}

function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function validateClientStateManifest() {
    if (!fs.existsSync(CLIENT_STATE_ASSETS_PATH)) {
        throw new Error(`Grand Exchange client-state manifest is missing: ${CLIENT_STATE_ASSETS_PATH}`);
    }

    const manifest = readJson<ClientStateManifest>(CLIENT_STATE_ASSETS_PATH);
    if (
        manifest.version !== 1 ||
        manifest.source.cache !== 'runescape/568' ||
        manifest.source.revision_family !== 481 ||
        manifest.source.provided_timestamp !== '2007-12-12' ||
        manifest.source.archive_sha256 !== '868027c9ccf770b8bbb60c89aeeb9603796b40dcd501f32610176ffbf5bf1495' ||
        !sameNumbers(manifest.scope.in_scope_interface_groups, EXPECTED_SOURCE_GROUPS) ||
        !sameNumbers(manifest.scope.excluded_interface_groups, EXPECTED_EXCLUDED_GROUPS) ||
        manifest.variable_mapping.strategy !== 'server-authoritative-if1-substitution' ||
        manifest.variable_mapping.source_varp_ids.length !== 0 ||
        manifest.variable_mapping.source_varbit_ids.length !== 0 ||
        manifest.variable_mapping.local_varp_configs.length !== 0 ||
        manifest.variable_mapping.local_varbit_configs.length !== 0
    ) {
        throw new Error('Grand Exchange client-state manifest no longer matches the frozen r481/r254 compatibility contract');
    }

    const mappings = new Map<number, ClientScriptMapping>(
        manifest.client_script_mappings.map(mapping => [mapping.source_script_id, mapping] as const)
    );
    if (mappings.size !== 3 || !mappings.has(581) || !mappings.has(654) || !mappings.has(656)) {
        throw new Error('Grand Exchange client-state manifest must map exactly source client scripts 581, 654 and 656');
    }

    const slotOnload = mappings.get(581)!;
    const collectionOnload = mappings.get(654)!;
    const collectionTransmit = mappings.get(656)!;
    if (
        !sameNumbers(slotOnload.source_component_ids, [17, 22, 27, 35, 43, 51]) ||
        !sameNumbers(collectionOnload.source_component_ids, [15]) ||
        !sameNumbers(collectionTransmit.source_component_ids, [15]) ||
        !sameNumbers(collectionTransmit.source_inventory_triggers ?? [], EXPECTED_SOURCE_INVS) ||
        !sameNumbers(collectionTransmit.local_inventory_ids ?? [], EXPECTED_LOCAL_INVS) ||
        manifest.client_script_mappings.some(mapping => mapping.local_script !== 'grand_exchange_collection.rs2')
    ) {
        throw new Error('Grand Exchange client-state source-script mapping drifted from the frozen group-109 listener contract');
    }

    if (manifest.server_state_substitutions.length !== 5 || manifest.deferred_server_authoritative_state.length === 0) {
        throw new Error('Grand Exchange client-state server substitution/deferred-state contract is incomplete');
    }

    return manifest;
}

function validateFrozenGroup109Hooks() {
    if (!fs.existsSync(GROUP109_ASSETS_PATH)) {
        throw new Error(`Grand Exchange group-109 asset manifest is missing: ${GROUP109_ASSETS_PATH}`);
    }

    const manifest = readJson<Group109Manifest>(GROUP109_ASSETS_PATH);
    const hook15 = manifest.interface.source_listener_hooks.find(hook => hook.source_component_id === 15);
    const slotHook = manifest.interface.source_listener_hooks.find(hook => hook.source_onload_script === 581);

    if (
        hook15?.source_onload_script !== 654 ||
        hook15.source_oninvtransmit_script !== 656 ||
        !sameNumbers(hook15.source_inventory_triggers ?? [], EXPECTED_SOURCE_INVS) ||
        !sameNumbers(slotHook?.source_component_ids ?? [], [17, 22, 27, 35, 43, 51]) ||
        !sameNumbers(manifest.inventory_hooks.map(hook => hook.source_inv_id), EXPECTED_SOURCE_INVS) ||
        !sameNumbers(manifest.inventory_hooks.map(hook => hook.local_inv_id), EXPECTED_LOCAL_INVS)
    ) {
        throw new Error('Grand Exchange group-109 listener/container mapping no longer matches the client-state contract');
    }
}

function findForbiddenVariableConfigs(directory: string) {
    const forbidden: string[] = [];
    if (!fs.existsSync(directory)) return forbidden;

    const directories = [directory];
    while (directories.length > 0) {
        const current = directories.pop()!;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                directories.push(fullPath);
                continue;
            }

            const lower = entry.name.toLowerCase();
            if (entry.isFile() && (lower.endsWith('.varp') || lower.endsWith('.varbit'))) {
                forbidden.push(path.relative(REPO_DIR, fullPath).replace(/\\/g, '/'));
            }
        }
    }

    return forbidden;
}

function requireTokens(file: string, tokens: readonly string[]) {
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange client-state replacement script was not staged: ${file}`);
    }

    const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    for (const token of tokens) {
        if (!source.includes(token)) {
            throw new Error(`Grand Exchange client-state replacement is missing required token ${JSON.stringify(token)} in ${file}`);
        }
    }
}

function validateServerDrivenSubstitutions(stagedContentDir: string) {
    const scriptDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts');
    requireTokens(path.join(scriptDir, 'grand_exchange.rs2'), [
        'if_sethide(grand_exchange_overview:com_19, false);',
        'if_sethide(grand_exchange_group_106:com_16, false);',
        'if_openmain(grand_exchange_group_108);',
        'if_openmain(grand_exchange_group_110);'
    ]);

    requireTokens(path.join(scriptDir, 'grand_exchange_collection.rs2'), [
        'inv_transmit(ge_collection_offer_0, grand_exchange_group_109:com_59);',
        'inv_transmit(ge_collection_offer_1, grand_exchange_group_109:com_63);',
        'inv_transmit(ge_collection_offer_2, grand_exchange_group_109:com_67);',
        'inv_transmit(ge_collection_offer_3, grand_exchange_group_109:com_71);',
        'inv_transmit(ge_collection_offer_4, grand_exchange_group_109:com_75);',
        'inv_transmit(ge_collection_offer_5, grand_exchange_group_109:com_79);'
    ]);
}

export function prepareGrandExchangeClientStateStage(stagedContentDir: string) {
    validateClientStateManifest();
    validateFrozenGroup109Hooks();

    const forbiddenVariableConfigs = findForbiddenVariableConfigs(path.join(PLUGIN_DIR, 'content', 'scripts'));
    if (forbiddenVariableConfigs.length > 0) {
        throw new Error(
            `Grand Exchange client-state boundary violation: manifest declares no r481 varp/varbit imports, but config sources were found (${forbiddenVariableConfigs.join(', ')})`
        );
    }

    validateServerDrivenSubstitutions(stagedContentDir);
}

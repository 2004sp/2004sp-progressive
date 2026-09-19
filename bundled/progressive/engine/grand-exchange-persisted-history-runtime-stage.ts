import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const STAGE_ROOT = path.join(ENGINE_DIR, '.custom-content-stage', 'grand-exchange');
const BACKUP_DIR = path.join(STAGE_ROOT, 'persisted-history-runtime-backup');
const BACKUP_MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const SCRIPT_OPCODE_PATH = path.join(ENGINE_DIR, 'src', 'engine', 'script', 'ScriptOpcode.ts');
const SERVER_OPS_PATH = path.join(ENGINE_DIR, 'src', 'engine', 'script', 'handlers', 'ServerOps.ts');
const HISTORY_RUNTIME_PATH = path.join(ENGINE_DIR, 'src', 'engine', 'grandexchange', 'GrandExchangeHistory.ts');
const HISTORY_RUNTIME_TEMPLATE = path.join(REPO_DIR, 'plugins', 'grand-exchange', 'runtime', 'GrandExchangeHistory.ts');

const OPCODE = { RECORD: 1900, SET_STATUS: 1901, EXISTS: 1902, ITEM: 1903, INT_FIELD: 1904, TIMESTAMP: 1905 } as const;

type BackupManifest = { version: 1; files: Array<{ path: string; existed: boolean }> };

function ensureParent(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
}

function snapshotRuntimeBridge() {
    if (fs.existsSync(BACKUP_MANIFEST)) throw new Error('GE history runtime backup already exists');
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = [SCRIPT_OPCODE_PATH, SERVER_OPS_PATH, HISTORY_RUNTIME_PATH].map(file => {
        const relative = path.relative(ENGINE_DIR, file).replace(/\\/g, '/');
        const existed = fs.existsSync(file);
        if (existed) {
            const backup = path.join(BACKUP_DIR, relative);
            ensureParent(backup);
            fs.copyFileSync(file, backup);
        }
        return { path: relative, existed };
    });
    fs.writeFileSync(BACKUP_MANIFEST, JSON.stringify({ version: 1, files } satisfies BackupManifest, null, 2) + '\n', 'utf8');
}

export function restoreGrandExchangePersistedHistoryRuntime() {
    if (!fs.existsSync(BACKUP_MANIFEST)) return false;
    const manifest = JSON.parse(fs.readFileSync(BACKUP_MANIFEST, 'utf8')) as BackupManifest;
    if (manifest.version !== 1) throw new Error(`Unsupported GE history runtime backup version ${manifest.version}`);
    for (const file of manifest.files) {
        const live = path.join(ENGINE_DIR, file.path);
        fs.rmSync(live, { recursive: true, force: true });
        if (file.existed) {
            const backup = path.join(BACKUP_DIR, file.path);
            if (!fs.existsSync(backup)) throw new Error(`Incomplete GE history runtime backup: ${file.path}`);
            ensureParent(live);
            fs.copyFileSync(backup, live);
        }
    }
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
    return true;
}

function installService() {
    if (!fs.existsSync(HISTORY_RUNTIME_TEMPLATE)) throw new Error(`Missing GE history runtime template: ${HISTORY_RUNTIME_TEMPLATE}`);
    // Some workspaces keep the option-2 bridge as a normal source change rather
    // than installing it only for the duration of a staged build. Preserve that
    // valid runtime instead of overwriting user-owned source on every launch.
    if (fs.existsSync(HISTORY_RUNTIME_PATH)) return;
    ensureParent(HISTORY_RUNTIME_PATH);
    fs.copyFileSync(HISTORY_RUNTIME_TEMPLATE, HISTORY_RUNTIME_PATH);
}

function patchOpcodes() {
    let source = fs.readFileSync(SCRIPT_OPCODE_PATH, 'utf8').replace(/\r/g, '');
    const enumMembers = [
        `    GE_HISTORY_RECORD = ${OPCODE.RECORD}, // custom: option-2-only persisted GE history`,
        `    GE_HISTORY_SET_STATUS = ${OPCODE.SET_STATUS},`,
        `    GE_HISTORY_EXISTS = ${OPCODE.EXISTS},`,
        `    GE_HISTORY_ITEM = ${OPCODE.ITEM},`,
        `    GE_HISTORY_INT = ${OPCODE.INT_FIELD},`,
        `    GE_HISTORY_TIMESTAMP = ${OPCODE.TIMESTAMP},`
    ].join('\n');
    const mappings = [
        "    ['GE_HISTORY_RECORD', ScriptOpcode.GE_HISTORY_RECORD],",
        "    ['GE_HISTORY_SET_STATUS', ScriptOpcode.GE_HISTORY_SET_STATUS],",
        "    ['GE_HISTORY_EXISTS', ScriptOpcode.GE_HISTORY_EXISTS],",
        "    ['GE_HISTORY_ITEM', ScriptOpcode.GE_HISTORY_ITEM],",
        "    ['GE_HISTORY_INT', ScriptOpcode.GE_HISTORY_INT],",
        "    ['GE_HISTORY_TIMESTAMP', ScriptOpcode.GE_HISTORY_TIMESTAMP],"
    ].join('\n');

    const opcodeNames = ['RECORD', 'SET_STATUS', 'EXISTS', 'ITEM', 'INT', 'TIMESTAMP'] as const;
    const hasAnyOpcode = opcodeNames.some(name => source.includes(`GE_HISTORY_${name}`));
    const hasCompleteBridge = source.includes(enumMembers) && source.includes(mappings);
    if (hasCompleteBridge) return;
    if (hasAnyOpcode) throw new Error('GE history opcode bridge is only partially installed');

    const enumMarker = '    MIDI_LENGTH,\n\n    // Player ops (2000-2499)';
    if (!source.includes(enumMarker)) throw new Error('Cannot find server opcode enum insertion point');
    source = source.replace(enumMarker, `    MIDI_LENGTH,\n\n${enumMembers}\n\n    // Player ops (2000-2499)`);

    const mapMarker = "    ['MIDI_LENGTH', ScriptOpcode.MIDI_LENGTH],";
    if (!source.includes(mapMarker)) throw new Error('Cannot find server opcode map insertion point');
    fs.writeFileSync(SCRIPT_OPCODE_PATH, source.replace(mapMarker, `${mapMarker}\n${mappings}`), 'utf8');
}

function patchServerOps() {
    let source = fs.readFileSync(SERVER_OPS_PATH, 'utf8').replace(/\r/g, '');
    const entityImport = "import { MapFindSquareType } from '#/engine/entity/MapFindSquareType.js';";
    const mapImport = "import { isIndoors, isLineOfSight, isLineOfWalk, isMapBlocked } from '#/engine/GameMap.js';";
    const helper = 'function geHistoryPlayer(state: ScriptState) {\n    return state.self instanceof Player ? state.self : null;\n}\n\n';
    const feature =
        "    [ScriptOpcode.MAP_FEATURE]: state => {\n        const name = state.popString();\n        const key = 'NODE_FEATURE_' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');\n        state.pushInt(tryParseBoolean(process.env[key], true) ? 1 : 0);\n    },";
    const handlers =
        "\n\n    [ScriptOpcode.GE_HISTORY_RECORD]: state => {\n        const [slot, item, type, quantity, price] = state.popInts(5);\n        const player = geHistoryPlayer(state);\n        state.pushInt(player && GrandExchangeHistory.recordSubmission(player, slot, item, type, quantity, price) ? 1 : 0);\n    },\n\n    [ScriptOpcode.GE_HISTORY_SET_STATUS]: state => {\n        const [slot, status] = state.popInts(2);\n        const player = geHistoryPlayer(state);\n        state.pushInt(player && GrandExchangeHistory.setStatus(player, slot, status) ? 1 : 0);\n    },\n\n    [ScriptOpcode.GE_HISTORY_EXISTS]: state => {\n        const row = state.popInt();\n        const player = geHistoryPlayer(state);\n        state.pushInt(player && GrandExchangeHistory.exists(player, row) ? 1 : 0);\n    },\n\n    [ScriptOpcode.GE_HISTORY_ITEM]: state => {\n        const row = state.popInt();\n        const player = geHistoryPlayer(state);\n        state.pushInt(player ? GrandExchangeHistory.item(player, row) : -1);\n    },\n\n    [ScriptOpcode.GE_HISTORY_INT]: state => {\n        const [row, field] = state.popInts(2);\n        const player = geHistoryPlayer(state);\n        state.pushInt(player ? GrandExchangeHistory.intField(player, row, field) : 0);\n    },\n\n    [ScriptOpcode.GE_HISTORY_TIMESTAMP]: state => {\n        const row = state.popInt();\n        const player = geHistoryPlayer(state);\n        state.pushString(player ? GrandExchangeHistory.timestamp(player, row) : '');\n    },";

    const handlerNames = ['RECORD', 'SET_STATUS', 'EXISTS', 'ITEM', 'INT', 'TIMESTAMP'] as const;
    const hasAnyHandler = handlerNames.some(name => source.includes(`[ScriptOpcode.GE_HISTORY_${name}]`));
    const hasCompleteBridge =
        source.includes("import Player from '#/engine/entity/Player.js';") && source.includes("import GrandExchangeHistory from '#/engine/grandexchange/GrandExchangeHistory.js';") && source.includes(helper.trimEnd()) && source.includes(handlers);
    if (hasCompleteBridge) return;
    if (hasAnyHandler) throw new Error('GE history server-op bridge is only partially installed');

    if (!source.includes(entityImport) || !source.includes(mapImport)) throw new Error('Cannot find ServerOps import insertion points');
    source = source.replace(entityImport, `${entityImport}\nimport Player from '#/engine/entity/Player.js';`);
    source = source.replace(mapImport, `${mapImport}\nimport GrandExchangeHistory from '#/engine/grandexchange/GrandExchangeHistory.js';`);

    const mapStart = 'const ServerOps: CommandHandlers = {';
    if (!source.includes(mapStart)) throw new Error('Cannot find ServerOps handler map');
    source = source.replace(mapStart, `${helper}${mapStart}`);

    if (!source.includes(feature)) throw new Error('Cannot find MAP_FEATURE handler');
    fs.writeFileSync(SERVER_OPS_PATH, source.replace(feature, `${feature}${handlers}`), 'utf8');
}

function appendCommandDeclarations(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'engine.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    if (source.includes('[command,ge_history_record]')) throw new Error('GE history commands already declared');
    source +=
        '\n// Option-2-only Grand Exchange persisted-history bridge.\n[command,ge_history_record](int $offer_slot, obj $item, int $offer_type, int $quantity, int $price_each)(boolean)\n[command,ge_history_set_status](int $offer_slot, int $status)(boolean)\n[command,ge_history_exists](int $row)(boolean)\n[command,ge_history_item](int $row)(obj)\n[command,ge_history_int](int $row, int $field)(int)\n[command,ge_history_timestamp](int $row)(string)\n';
    fs.writeFileSync(file, source, 'utf8');
}

function validateRuntimeBridge() {
    const opcodes = fs.readFileSync(SCRIPT_OPCODE_PATH, 'utf8');
    const handlers = fs.readFileSync(SERVER_OPS_PATH, 'utf8');
    for (const [name, value] of Object.entries({
        GE_HISTORY_RECORD: OPCODE.RECORD,
        GE_HISTORY_SET_STATUS: OPCODE.SET_STATUS,
        GE_HISTORY_EXISTS: OPCODE.EXISTS,
        GE_HISTORY_ITEM: OPCODE.ITEM,
        GE_HISTORY_INT: OPCODE.INT_FIELD,
        GE_HISTORY_TIMESTAMP: OPCODE.TIMESTAMP
    })) {
        if (!opcodes.includes(`${name} = ${value}`)) throw new Error(`Missing staged opcode enum ${name}`);
        if (!opcodes.includes(`['${name}', ScriptOpcode.${name}]`)) throw new Error(`Missing staged opcode map ${name}`);
        if (!handlers.includes(`[ScriptOpcode.${name}]`)) throw new Error(`Missing staged GE history handler ${name}`);
    }
    if (!fs.existsSync(HISTORY_RUNTIME_PATH)) throw new Error('GE history runtime service was not staged');
}

export function prepareGrandExchangePersistedHistoryRuntime(stagedContentDir: string) {
    snapshotRuntimeBridge();
    try {
        installService();
        patchOpcodes();
        patchServerOps();
        appendCommandDeclarations(stagedContentDir);
        validateRuntimeBridge();
    } catch (error) {
        restoreGrandExchangePersistedHistoryRuntime();
        throw error;
    }
}

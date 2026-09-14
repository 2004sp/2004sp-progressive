import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const MANIFEST_PATH = path.join(PLUGIN_DIR, 'npc-assets.json');

type NpcModelAsset = {
    source_id: number;
    local_id: number;
    name: string;
    file: string;
    format: 'r481-new' | 'r254-old';
    sha256: string;
};

type NpcAssetManifest = {
    source_npc_id: number;
    local_npc_id: number;
    name: string;
    spawn: { x: number; z: number; level: number };
    models: NpcModelAsset[];
};

function sha256(data: Uint8Array) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function g2(data: Uint8Array, offset: number) {
    return (data[offset]! << 8) | data[offset + 1]!;
}

function p2(data: Uint8Array, offset: number, value: number) {
    data[offset] = value >> 8;
    data[offset + 1] = value;
}

// The selected r481 clerk meshes use the post-377 model container, but do not
// use textures, alpha, priorities or render types. Their vertex/face streams
// are consequently byte-for-byte compatible with the r254 decoder; only the
// optional-extension byte and 23-byte footer need to be replaced by the old
// 18-byte footer. Reject any asset that grows beyond that lossless subset.
export function convertSimpleR481ModelToR254(source: Uint8Array) {
    if (source.length < 24 || source[source.length - 2] !== 0xff || source[source.length - 1] !== 0xff) {
        throw new Error('Expected an r481 new-format model ending in 0xffff');
    }

    const footer = source.length - 23;
    const vertexCount = g2(source, footer);
    const faceCount = g2(source, footer + 2);
    const textureCount = source[footer + 4]!;
    const hasRenderTypes = source[footer + 5]!;
    const priority = source[footer + 6]!;
    const hasAlpha = source[footer + 7]!;
    const hasFaceLabels = source[footer + 8]!;
    const hasFaceTextures = source[footer + 9]!;
    const hasVertexLabels = source[footer + 10]!;
    const xLength = g2(source, footer + 11);
    const yLength = g2(source, footer + 13);
    const zLength = g2(source, footer + 15);
    const faceIndexLength = g2(source, footer + 17);
    const textureCoordinateLength = g2(source, footer + 19);

    if (textureCount !== 0 || hasRenderTypes !== 0 || priority !== 0 || hasAlpha !== 0 || hasFaceLabels !== 1 || hasFaceTextures !== 0 || hasVertexLabels !== 1 || textureCoordinateLength !== 0) {
        throw new Error('The r481 clerk model is no longer in the lossless r254-compatible subset');
    }

    const streamLength = vertexCount * 2 + faceCount * 2 + faceIndexLength + faceCount * 2 + xLength + yLength + zLength;
    if (streamLength !== footer - 1 || source[streamLength] !== 0) {
        throw new Error(`Unexpected r481 clerk model stream length: expected ${footer - 1}, found ${streamLength}`);
    }

    const oldFooter = new Uint8Array(18);
    p2(oldFooter, 0, vertexCount);
    p2(oldFooter, 2, faceCount);
    oldFooter[4] = 0;
    oldFooter[5] = 0;
    oldFooter[6] = 0;
    oldFooter[7] = 0;
    oldFooter[8] = 1;
    oldFooter[9] = 1;
    p2(oldFooter, 10, xLength);
    p2(oldFooter, 12, yLength);
    p2(oldFooter, 14, zLength);
    p2(oldFooter, 16, faceIndexLength);

    const converted = new Uint8Array(streamLength + oldFooter.length);
    converted.set(source.subarray(0, streamLength));
    converted.set(oldFooter, streamLength);
    return converted;
}

function injectPackEntry(packPath: string, id: number, name: string) {
    const lines = fs.readFileSync(packPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const idPrefix = `${id}=`;
    const existingById = lines.find(line => line.startsWith(idPrefix));
    const existingByName = lines.find(line => line.endsWith(`=${name}`));
    if (existingById && existingById !== `${id}=${name}`) {
        throw new Error(`Grand Exchange NPC pack ID ${id} is already assigned by ${existingById}`);
    }
    if (existingByName && existingByName !== `${id}=${name}`) {
        throw new Error(`Grand Exchange NPC pack name ${name} is already assigned by ${existingByName}`);
    }
    if (!existingById) lines.push(`${id}=${name}`);
    lines.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
    fs.writeFileSync(packPath, lines.join('\n') + '\n', 'utf8');
}

function injectBankCollectionScriptTriggers(packPath: string) {
    const lines = fs.readFileSync(packPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const names = new Set<string>();
    let maxId = -1;

    for (const line of lines) {
        const equals = line.indexOf('=');
        if (equals < 1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) maxId = Math.max(maxId, id);
        names.add(line.slice(equals + 1));
    }

    // These native triggers establish that bankbooth is the shared booth type
    // used by normal banks, while newbiebankbooth covers Tutorial Island.
    for (const required of ['[oploc1,bankbooth]', '[oploc2,bankbooth]', '[oploc1,newbiebankbooth]']) {
        if (!names.has(required)) {
            throw new Error(`Grand Exchange bank collection expected native trigger ${required}`);
        }
    }

    for (const trigger of ['[oploc3,bankbooth]', '[oploc3,newbiebankbooth]']) {
        if (names.has(trigger)) continue;
        maxId++;
        lines.push(`${maxId}=${trigger}`);
        names.add(trigger);
    }

    lines.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
    fs.writeFileSync(packPath, lines.join('\n') + '\n', 'utf8');
}

function injectSpawn(mapPath: string, npcId: number, x: number, z: number, level: number) {
    const mapX = Math.floor(x / 64);
    const mapZ = Math.floor(z / 64);
    const expectedName = `m${mapX}_${mapZ}.jm2`;
    if (path.basename(mapPath) !== expectedName) throw new Error(`GE clerk spawn map mismatch: expected ${expectedName}`);

    const spawn = `${level} ${x & 0x3f} ${z & 0x3f}: ${npcId}`;
    let source = fs.readFileSync(mapPath, 'utf8').replace(/\r/g, '');
    if (source.includes(`\n${spawn}\n`)) return;
    const marker = '\n==== OBJ ====';
    const npcSection = source.indexOf('\n==== NPC ====');
    const insert = source.indexOf(marker);
    if (npcSection < 0 || insert < npcSection) throw new Error(`Could not find NPC/OBJ sections in ${mapPath}`);
    source = source.slice(0, insert).replace(/\n+$/, '') + `\n${spawn}\n` + source.slice(insert);
    fs.writeFileSync(mapPath, source, 'utf8');
}

function shareDebugBodyWithProcedure(scriptPath: string, debugName: string, procedureName: string) {
    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = `[debugproc,${debugName}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Grand Exchange NPC stage is missing ${marker}`);
    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next + 1;
    const body = source.slice(start + marker.length, end).trim();
    const replacement = `${marker}\n~${procedureName};\n\n[proc,${procedureName}]\n${body}\n\n`;
    source = source.slice(0, start) + replacement + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

export function prepareGrandExchangeNpcStage(stagedContentDir: string) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as NpcAssetManifest;
    if (manifest.source_npc_id !== 6528 || manifest.local_npc_id !== 1200 || manifest.name !== 'Grand Exchange clerk') {
        throw new Error('Grand Exchange clerk manifest identity changed unexpectedly');
    }
    if (manifest.spawn.x !== 3180 || manifest.spawn.z !== 3440 || manifest.spawn.level !== 0) {
        throw new Error('Grand Exchange clerk manifest spawn changed unexpectedly');
    }

    const modelDir = path.join(stagedContentDir, 'models', 'npc');
    fs.mkdirSync(modelDir, { recursive: true });
    for (const asset of manifest.models) {
        const sourcePath = path.join(PLUGIN_DIR, asset.file);
        const source = fs.readFileSync(sourcePath);
        if (sha256(source) !== asset.sha256) throw new Error(`Grand Exchange NPC asset hash mismatch: ${asset.file}`);
        const output = asset.format === 'r481-new' ? convertSimpleR481ModelToR254(source) : source;
        fs.writeFileSync(path.join(modelDir, `${asset.name}.ob2`), output);
        injectPackEntry(path.join(stagedContentDir, 'pack', 'model.pack'), asset.local_id, asset.name);
    }

    injectPackEntry(path.join(stagedContentDir, 'pack', 'npc.pack'), manifest.local_npc_id, 'grand_exchange_clerk');
    injectSpawn(path.join(stagedContentDir, 'maps', `m${Math.floor(manifest.spawn.x / 64)}_${Math.floor(manifest.spawn.z / 64)}.jm2`), manifest.local_npc_id, manifest.spawn.x, manifest.spawn.z, manifest.spawn.level);

    // Earlier GE stages augment these debug bodies with the latest overview
    // and persisted-history state. Split the final bodies only after those
    // stages run, so both debug commands and the clerk use the same behavior.
    const scriptDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts');
    shareDebugBodyWithProcedure(path.join(scriptDir, 'grand_exchange.rs2'), 'ge', 'ge_open_overview');
    shareDebugBodyWithProcedure(path.join(scriptDir, 'grand_exchange_history.rs2'), 'ge643', 'ge_open_history');

    injectBankCollectionScriptTriggers(path.join(stagedContentDir, 'pack', 'script.pack'));
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { Jimp } from 'jimp';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const NATIVE_CONTENT_DIR = path.join(REPO_DIR, 'content');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const PLUGIN_CONTENT_DIR = path.join(PLUGIN_DIR, 'content');
const OVERVIEW_ASSETS_PATH = path.join(PLUGIN_DIR, 'overview-assets.json');

const STAGE_ROOT = path.join(ENGINE_DIR, '.custom-content-stage', 'grand-exchange');
const STAGED_CONTENT_DIR = path.join(STAGE_ROOT, 'content');
const BACKUP_DIR = path.join(STAGE_ROOT, 'native-pack-backup');
const BACKUP_MANIFEST = path.join(BACKUP_DIR, 'manifest.json');

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const GE_INTERFACE_ROOT = 8990;
const GE_COMPONENT_BASE = 9000;
const GE_COMPONENT_MAX_SOURCE_ID = 213;

// Only outputs/runtime sources touched by adding .if/.rs2/sprite sources need
// to be restored. The whole server pack is backed up because the RuneScript
// compiler owns its exact output set and can change more than script.dat.
const MANAGED_NATIVE_OUTPUTS = [
    'data/pack/client/interface',
    'data/pack/client/media',
    'data/pack/server',
    'data/symbols',
    'tools/pack/Compiler.ts',
] as const;

type BackupManifest = {
    version: 1;
    outputs: Array<{ path: string; existed: boolean }>;
};

type OverviewAssetManifest = {
    sprites: Array<{
        source_id: number;
        file: string;
        width: number;
        height: number;
        sha256: string;
    }>;
};

function ensureParent(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
}

function copyPath(source: string, destination: string) {
    ensureParent(destination);
    fs.cpSync(source, destination, {
        recursive: fs.statSync(source).isDirectory(),
        force: true,
        preserveTimestamps: true,
    });
}

function snapshotNativeOutputs() {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const manifest: BackupManifest = {
        version: 1,
        outputs: MANAGED_NATIVE_OUTPUTS.map(relativePath => {
            const source = path.join(ENGINE_DIR, relativePath);
            const existed = fs.existsSync(source);
            if (existed) {
                copyPath(source, path.join(BACKUP_DIR, relativePath));
            }
            return { path: relativePath, existed };
        }),
    };

    fs.writeFileSync(BACKUP_MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

export function restoreGrandExchangeStage() {
    let restored = false;

    if (fs.existsSync(BACKUP_MANIFEST)) {
        const manifest = JSON.parse(fs.readFileSync(BACKUP_MANIFEST, 'utf8')) as BackupManifest;
        if (manifest.version !== 1) {
            throw new Error(`Unsupported Grand Exchange backup manifest version: ${manifest.version}`);
        }

        for (const output of manifest.outputs) {
            const livePath = path.join(ENGINE_DIR, output.path);
            fs.rmSync(livePath, { recursive: true, force: true });

            if (output.existed) {
                const backupPath = path.join(BACKUP_DIR, output.path);
                if (!fs.existsSync(backupPath)) {
                    throw new Error(`Grand Exchange native-pack backup is incomplete: ${output.path}`);
                }
                copyPath(backupPath, livePath);
            }
        }
        restored = true;
    }

    fs.rmSync(STAGE_ROOT, { recursive: true, force: true });
    return restored;
}

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

function injectInterfaceMappings() {
    const packPath = path.join(STAGED_CONTENT_DIR, 'pack', 'interface.pack');
    const orderPath = path.join(STAGED_CONTENT_DIR, 'pack', 'interface.order');
    const interfacePath = path.join(STAGED_CONTENT_DIR, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    const sourceComponentIds: number[] = [];
    for (const match of interfaceSource.matchAll(/^\[com_(\d+)\]$/gm)) {
        const sourceId = Number.parseInt(match[1], 10);
        if (sourceId < 0 || sourceId > GE_COMPONENT_MAX_SOURCE_ID) {
            throw new Error(`Grand Exchange overview component com_${sourceId} is outside the reserved group-105 block`);
        }
        sourceComponentIds.push(sourceId);
    }

    const { content: originalPack, values } = readPack(packPath);
    const mappings = new Map<number, string>();
    mappings.set(GE_INTERFACE_ROOT, GE_INTERFACE_NAME);
    for (const sourceId of sourceComponentIds) {
        mappings.set(GE_COMPONENT_BASE + sourceId, `${GE_INTERFACE_NAME}:com_${sourceId}`);
    }

    const names = new Map<string, number>();
    for (const [id, name] of values) {
        names.set(name, id);
    }

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`Reserved Grand Exchange interface ID ${id} is already mapped to ${existingName}`);
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
    for (const id of [GE_INTERFACE_ROOT, ...sourceComponentIds.map(sourceId => GE_COMPONENT_BASE + sourceId)]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectScriptMapping() {
    const packPath = path.join(STAGED_CONTENT_DIR, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const triggerName = '[debugproc,ge]';

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

function pointRuneScriptCompilerAtStage() {
    // This progressive base uses @lostcityrs/runescript. Its engine wrapper
    // loads symbols from BUILD_SRC_DIR but, unless sourcePaths is supplied,
    // the package itself defaults to ../content/scripts. Temporarily teach the
    // installed wrapper to read the same staged scripts as the rest of option 2.
    const compilerPath = path.join(ENGINE_DIR, 'tools', 'pack', 'Compiler.ts');
    if (!fs.existsSync(compilerPath)) {
        throw new Error(`RuneScript compiler wrapper was not found at ${compilerPath}`);
    }

    const content = fs.readFileSync(compilerPath, 'utf8');
    const marker = 'CompileServerScript({';
    const callStart = content.indexOf(marker);
    if (callStart === -1) {
        throw new Error('Could not find CompileServerScript({ in tools/pack/Compiler.ts');
    }

    const callEnd = content.indexOf('});', callStart);
    const callPreview = content.slice(callStart, callEnd === -1 ? callStart + 4000 : callEnd);
    if (/\bsourcePaths\s*:/.test(callPreview)) {
        return;
    }

    const afterMarker = content.slice(callStart + marker.length);
    const newline = afterMarker.startsWith('\r\n') ? '\r\n' : afterMarker.startsWith('\n') ? '\n' : '';
    if (!newline) {
        throw new Error('Unexpected CompileServerScript formatting in tools/pack/Compiler.ts');
    }

    const indentMatch = afterMarker.match(/^\r?\n([ \t]*)/);
    const indent = indentMatch?.[1] ?? '        ';
    const insertAt = callStart + marker.length + newline.length;
    const sourcePathsLine = `${indent}sourcePaths: [process.env.BUILD_SRC_DIR ? process.env.BUILD_SRC_DIR + '/scripts' : '../content/scripts'],${newline}`;
    const patched = content.slice(0, insertAt) + sourcePathsLine + content.slice(insertAt);
    fs.writeFileSync(compilerPath, patched, 'utf8');
}

async function stageSprites() {
    const manifest = JSON.parse(fs.readFileSync(OVERVIEW_ASSETS_PATH, 'utf8')) as OverviewAssetManifest;
    const spriteDir = path.join(STAGED_CONTENT_DIR, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    for (const sprite of manifest.sprites) {
        const sourcePath = path.join(PLUGIN_DIR, sprite.file);
        const actualHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
        if (actualHash !== sprite.sha256) {
            throw new Error(`Grand Exchange sprite ${sprite.source_id} hash mismatch: expected ${sprite.sha256}, got ${actualHash}`);
        }

        const image = await Jimp.read(sourcePath);
        if (image.bitmap.width !== sprite.width || image.bitmap.height !== sprite.height) {
            throw new Error(
                `Grand Exchange sprite ${sprite.source_id} dimensions changed: expected ${sprite.width}x${sprite.height}, got ${image.bitmap.width}x${image.bitmap.height}`
            );
        }

        // r254 PixPack uses #ff00ff as transparent palette entry and ignores
        // PNG alpha. Convert the r481 RGBA exports only in the temporary stage.
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

export async function prepareGrandExchangeStage() {
    // Recover from an interrupted previous option-2 run before taking a fresh
    // native snapshot. This makes the next launcher start self-healing.
    restoreGrandExchangeStage();

    if (!fs.existsSync(NATIVE_CONTENT_DIR)) {
        throw new Error(`Native content directory not found: ${NATIVE_CONTENT_DIR}`);
    }
    if (!fs.existsSync(PLUGIN_CONTENT_DIR) || !fs.existsSync(OVERVIEW_ASSETS_PATH)) {
        throw new Error(`Grand Exchange plugin staging files are incomplete under ${PLUGIN_DIR}`);
    }

    snapshotNativeOutputs();

    try {
        fs.mkdirSync(path.dirname(STAGED_CONTENT_DIR), { recursive: true });
        fs.cpSync(NATIVE_CONTENT_DIR, STAGED_CONTENT_DIR, {
            recursive: true,
            force: true,
            preserveTimestamps: true,
        });
        fs.cpSync(PLUGIN_CONTENT_DIR, STAGED_CONTENT_DIR, {
            recursive: true,
            force: true,
            preserveTimestamps: true,
        });

        injectInterfaceMappings();
        injectScriptMapping();
        pointRuneScriptCompilerAtStage();
        await stageSprites();
        return STAGED_CONTENT_DIR;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

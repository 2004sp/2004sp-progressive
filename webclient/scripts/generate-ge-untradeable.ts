import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const WEBCLIENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.resolve(WEBCLIENT_DIR, '..', 'content');
const OBJ_PACK = path.join(CONTENT_DIR, 'pack', 'obj.pack');
const SCRIPTS_DIR = path.join(CONTENT_DIR, 'scripts');
const OUTPUT = path.join(WEBCLIENT_DIR, 'src', 'generated', 'GrandExchangeUntradeable.ts');

function readObjectIds() {
    const ids = new Map<string, number>();
    const source = fs.readFileSync(OBJ_PACK, 'utf8').replace(/\r/g, '');
    for (const line of source.split('\n')) {
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        const symbol = line.slice(equals + 1).trim();
        if (Number.isInteger(id) && symbol.length > 0) ids.set(symbol, id);
    }
    return ids;
}

function walkObjFiles(directory: string, output: string[]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walkObjFiles(fullPath, output);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.obj')) {
            output.push(fullPath);
        }
    }
}

function collectExplicitlyUntradeableSymbols() {
    const symbols = new Set<string>();
    const files: string[] = [];
    walkObjFiles(SCRIPTS_DIR, files);

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
        let current: string | null = null;
        let untradeable = false;

        const finish = () => {
            if (current && untradeable) symbols.add(current);
        };

        for (const rawLine of source.split('\n')) {
            const line = rawLine.trim();
            const section = line.match(/^\[([^\]]+)\]$/);
            if (section) {
                finish();
                current = section[1].trim();
                untradeable = false;
                continue;
            }
            if (current && /^tradeable\s*=\s*no$/i.test(line)) {
                untradeable = true;
            }
            // The server's ObjType loader forcibly marks every non-zero dummyitem
            // (inv_only / graphic_only) as untradeable after decoding.
            if (current && /^dummyitem\s*=\s*(?!0\s*$|none\s*$).+/i.test(line)) {
                untradeable = true;
            }
        }
        finish();
    }

    return symbols;
}

const objectIds = readObjectIds();
const explicitlyUntradeable = collectExplicitlyUntradeableSymbols();
const ids = [...explicitlyUntradeable]
    .map(symbol => objectIds.get(symbol))
    .filter((id): id is number => typeof id === 'number')
    .sort((a, b) => a - b);

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(
    OUTPUT,
    `// Generated from the native r254 Content object sources. Do not hand-edit.\n` +
    `// Items listed here are server-untradeable via tradeable=no or dummyitem.\n` +
    `export const GRAND_EXCHANGE_UNTRADEABLE_ITEM_IDS = new Set<number>([${ids.join(', ')}]);\n`,
    'utf8'
);

console.log(`Generated ${ids.length} native r254 Grand Exchange untradeable item ids.`);

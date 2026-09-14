import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const WEBCLIENT_DIR = path.join(REPO_DIR, 'webclient');
const CLIENT_ENTRY_PATH = path.join(WEBCLIENT_DIR, 'src', 'client', 'ClientEntry.ts');
const BUILD_OUTPUT_PATH = path.join(WEBCLIENT_DIR, 'out', 'client.js');
const PUBLIC_CLIENT_PATH = path.join(ENGINE_DIR, 'public', 'client', 'client.js');

function runCommand(command: string, args: string[]) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: WEBCLIENT_DIR,
            stdio: 'inherit',
            shell: true,
        });

        child.once('error', error => {
            reject(new Error(`Grand Exchange webclient build could not start ${command}: ${error.message}`));
        });
        child.once('exit', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Grand Exchange webclient build failed: ${command} ${args.join(' ')} exited with ${code ?? 'unknown'}`));
            }
        });
    });
}

function validateCollectHook(source: string, label: string) {
    for (const required of [
        "loc.name?.toLowerCase() === GRAND_EXCHANGE_BANK_BOOTH_NAME",
        '!loc.op[2]',
        "loc.op[2] = 'Collect';",
    ]) {
        if (!source.includes(required)) {
            throw new Error(`Grand Exchange ${label} is missing Bank booth Collect hook token: ${required}`);
        }
    }
}

// The Grand Exchange adds an OPLOC3 server trigger for Bank booth collection,
// but that trigger is unreachable unless the browser client also exposes the
// otherwise-unused third location option. ClientEntry owns that narrow native
// loc-config adapter. Build and publish it whenever option-2 GE staging runs so
// a stale engine/public/client/client.js cannot silently omit the Collect menu.
export async function prepareGrandExchangeWebClientStage() {
    if (!fs.existsSync(CLIENT_ENTRY_PATH)) {
        throw new Error(`Grand Exchange webclient source is missing: ${CLIENT_ENTRY_PATH}`);
    }

    const clientEntry = fs.readFileSync(CLIENT_ENTRY_PATH, 'utf8').replace(/\r/g, '');
    validateCollectHook(clientEntry, 'webclient source');

    if (!fs.existsSync(path.join(WEBCLIENT_DIR, 'node_modules', 'terser'))) {
        await runCommand('bun', ['install']);
    }

    await runCommand('bun', ['run', 'build']);

    if (!fs.existsSync(BUILD_OUTPUT_PATH)) {
        throw new Error(`Grand Exchange webclient build output is missing: ${BUILD_OUTPUT_PATH}`);
    }

    const builtClient = fs.readFileSync(BUILD_OUTPUT_PATH, 'utf8');
    if (!builtClient.includes('Collect')) {
        throw new Error('Grand Exchange webclient bundle does not contain the Bank booth Collect action');
    }

    fs.mkdirSync(path.dirname(PUBLIC_CLIENT_PATH), { recursive: true });
    fs.copyFileSync(BUILD_OUTPUT_PATH, PUBLIC_CLIENT_PATH);

    const publishedClient = fs.readFileSync(PUBLIC_CLIENT_PATH, 'utf8');
    if (!publishedClient.includes('Collect')) {
        throw new Error('Grand Exchange published webclient lost the Bank booth Collect action');
    }
}

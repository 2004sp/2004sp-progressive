import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const WEBCLIENT_DIR = path.join(REPO_DIR, 'webclient');
const CLIENT_ENTRY_PATH = path.join(WEBCLIENT_DIR, 'src', 'client', 'ClientEntry.ts');
const CLIENT_SOURCE_PATH = path.join(WEBCLIENT_DIR, 'src', 'client', 'Client.ts');
const BUILD_OUTPUT_PATH = path.join(WEBCLIENT_DIR, 'out', 'client.js');
const PUBLIC_CLIENT_PATH = path.join(ENGINE_DIR, 'public', 'client', 'client.js');
const GRAND_EXCHANGE_CHATBOX_SELECTION_PREFIX = '__ge_select__:';

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

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first < 0) {
        throw new Error(`Grand Exchange webclient stage cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange webclient stage found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
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

function validateChatboxSelectionHook(source: string, label: string) {
    for (const required of [
        GRAND_EXCHANGE_CHATBOX_SELECTION_PREFIX,
        'submitGrandExchangeItemSearchResult',
        'originalSubmitGrandExchangeItemSearchResult.call',
    ]) {
        if (!source.includes(required)) {
            throw new Error(`Grand Exchange ${label} is missing chatbox selection hook token: ${required}`);
        }
    }
}

function patchGrandExchangeSidebarRedraws(source: string) {
    // The Sell flow first populates a hidden replacement inventory component,
    // then swaps that component into the inventory tab, then activates the tab.
    // Native r254 redraws the sidebar for every one of those packets, which can
    // expose one frame of the old inventory between updates. While the GE main
    // interface is mounted, repaint inventory packets only when their component
    // is already visible and suppress redundant tab/interface redraws.
    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.UPDATE_INV_FULL) {\n                this.redrawSidebar = true;\n\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];`,
        `            if (this.ptype === ServerProt.UPDATE_INV_FULL) {\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    inv.layerId === this.sideOverlayId[this.sideTab]\n                ) {\n                    this.redrawSidebar = true;\n                }`,
        'GE full-inventory redraw path'
    );

    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.UPDATE_INV_PARTIAL) {\n                this.redrawSidebar = true;\n\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];`,
        `            if (this.ptype === ServerProt.UPDATE_INV_PARTIAL) {\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    inv.layerId === this.sideOverlayId[this.sideTab]\n                ) {\n                    this.redrawSidebar = true;\n                }`,
        'GE partial-inventory redraw path'
    );

    source = replaceExactlyOnce(
        source,
        `                this.sideOverlayId[tab] = com;\n                this.redrawSidebar = true;\n                this.redrawSideicons = true;`,
        `                const previousTabInterface = this.sideOverlayId[tab];\n                this.sideOverlayId[tab] = com;\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    previousTabInterface !== com\n                ) {\n                    if (\n                        this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                        tab === this.sideTab\n                    ) {\n                        this.redrawSidebar = true;\n                    }\n                    this.redrawSideicons = true;\n                }`,
        'GE inventory-tab replacement redraw path'
    );

    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.IF_SETTAB_ACTIVE) {\n                this.sideTab = this.in.g1();\n\n                this.redrawSidebar = true;\n                this.redrawSideicons = true;`,
        `            if (this.ptype === ServerProt.IF_SETTAB_ACTIVE) {\n                const tab = this.in.g1();\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    this.sideTab !== tab\n                ) {\n                    this.sideTab = tab;\n                    this.redrawSidebar = true;\n                    this.redrawSideicons = true;\n                }`,
        'GE active-tab redraw path'
    );

    return source;
}

function validateSidebarRedrawPatch(source: string) {
    for (const required of [
        'previousTabInterface !== com',
        'inv.layerId === this.sideOverlayId[this.sideTab]',
        'this.sideTab !== tab',
    ]) {
        if (!source.includes(required)) {
            throw new Error(`Grand Exchange webclient source is missing sell-flicker guard: ${required}`);
        }
    }
}

// The Grand Exchange adds client-side adapters for native r254 UI/config data:
// Bank booths need their otherwise-unused OPLOC3 label, live chatbox result
// clicks need to be distinguishable from an Enter-key p_namedialog response,
// and the Sell inventory tab needs its staged packets coalesced into one visible
// redraw. Build and publish the webclient whenever option-2 GE staging runs so a
// stale engine/public/client/client.js cannot silently omit those adapters.
export async function prepareGrandExchangeWebClientStage() {
    if (!fs.existsSync(CLIENT_ENTRY_PATH)) {
        throw new Error(`Grand Exchange webclient source is missing: ${CLIENT_ENTRY_PATH}`);
    }
    if (!fs.existsSync(CLIENT_SOURCE_PATH)) {
        throw new Error(`Grand Exchange webclient core source is missing: ${CLIENT_SOURCE_PATH}`);
    }

    const clientEntry = fs.readFileSync(CLIENT_ENTRY_PATH, 'utf8').replace(/\r/g, '');
    validateCollectHook(clientEntry, 'webclient source');
    validateChatboxSelectionHook(clientEntry, 'webclient source');

    if (!fs.existsSync(path.join(WEBCLIENT_DIR, 'node_modules', 'terser'))) {
        await runCommand('bun', ['install']);
    }

    // Keep the generic r254 client source pristine in the checkout. Option 2
    // temporarily applies the GE-only redraw guards for its bundle, then restores
    // the source even if the build fails.
    const originalClientSource = fs.readFileSync(CLIENT_SOURCE_PATH, 'utf8');
    const patchedClientSource = patchGrandExchangeSidebarRedraws(originalClientSource.replace(/\r/g, ''));
    validateSidebarRedrawPatch(patchedClientSource);

    try {
        fs.writeFileSync(CLIENT_SOURCE_PATH, patchedClientSource, 'utf8');
        await runCommand('bun', ['run', 'build']);
    } finally {
        fs.writeFileSync(CLIENT_SOURCE_PATH, originalClientSource, 'utf8');
    }

    if (!fs.existsSync(BUILD_OUTPUT_PATH)) {
        throw new Error(`Grand Exchange webclient build output is missing: ${BUILD_OUTPUT_PATH}`);
    }

    const builtClient = fs.readFileSync(BUILD_OUTPUT_PATH, 'utf8');
    if (!builtClient.includes('Collect')) {
        throw new Error('Grand Exchange webclient bundle does not contain the Bank booth Collect action');
    }
    if (!builtClient.includes(GRAND_EXCHANGE_CHATBOX_SELECTION_PREFIX)) {
        throw new Error('Grand Exchange webclient bundle does not contain the chatbox-selection routing marker');
    }

    fs.mkdirSync(path.dirname(PUBLIC_CLIENT_PATH), { recursive: true });
    fs.copyFileSync(BUILD_OUTPUT_PATH, PUBLIC_CLIENT_PATH);

    const publishedClient = fs.readFileSync(PUBLIC_CLIENT_PATH, 'utf8');
    if (!publishedClient.includes('Collect')) {
        throw new Error('Grand Exchange published webclient lost the Bank booth Collect action');
    }
    if (!publishedClient.includes(GRAND_EXCHANGE_CHATBOX_SELECTION_PREFIX)) {
        throw new Error('Grand Exchange published webclient lost the chatbox-selection routing marker');
    }
}

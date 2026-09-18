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
const GRAND_EXCHANGE_NATIVE_SELL_ACTION_TEXT = 'Offer @lre@';

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
        'const GRAND_EXCHANGE_ENABLED = CUSTOM_CONTENT?.grandExchange === true;',
        'if (GRAND_EXCHANGE_ENABLED) {',
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

function patchGrandExchangeNativeSellInventory(source: string) {
    // The server keeps the synthetic side inventory as a compatibility fallback
    // for the Java client. In the browser, keep native inventory:inv mounted and
    // consume those Sell-tab packets without swapping the visible component.
    // A temporary Offer menu entry routes its INV_BUTTON1 packet to the existing
    // synthetic component ID, so the authoritative server handler is unchanged.
    source = replaceExactlyOnce(
        source,
        'const GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID = 8990;',
        [
            'const GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID = 8990;',
            'const GRAND_EXCHANGE_NATIVE_INVENTORY_COMPONENT_ID = 3214;',
            'const GRAND_EXCHANGE_SELL_INVENTORY_ROOT_ID = 8988;',
            'const GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID = 11393;',
            'const GRAND_EXCHANGE_OFFER_TITLE_COMPONENT_ID = 9133;',
            'const GRAND_EXCHANGE_SELECTED_SETUP_ROOT_COMPONENT_ID = 9156;',
            'const GRAND_EXCHANGE_SELL_PROMPT_ROOT_COMPONENT_ID = 9197;',
            'const GRAND_EXCHANGE_DETAIL_ROOT_COMPONENT_ID = 9200;',
        ].join('\n'),
        'GE overview client constant anchor'
    );

    // The synthetic inventory is populated before the server asks to mount it.
    // Process its item data so protocol state stays coherent, but do not repaint
    // the currently visible native inventory for an off-screen component update.
    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.UPDATE_INV_FULL) {\n                this.redrawSidebar = true;\n\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];`,
        `            if (this.ptype === ServerProt.UPDATE_INV_FULL) {\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    component !== GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID\n                ) {\n                    this.redrawSidebar = true;\n                }`,
        'GE full sell-inventory update redraw'
    );

    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.UPDATE_INV_PARTIAL) {\n                this.redrawSidebar = true;\n\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];`,
        `            if (this.ptype === ServerProt.UPDATE_INV_PARTIAL) {\n                const component: number = this.in.g2();\n                const inv: IfType = IfType.list[component];\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    component !== GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID\n                ) {\n                    this.redrawSidebar = true;\n                }`,
        'GE partial sell-inventory update redraw'
    );

    // IF_SETTAB is the packet that caused the remaining visible icon flash: the
    // old native inventory was actually replaced by a second, visually identical
    // inventory component. Ignore only that GE Sell replacement in the browser.
    // Restoring inventory on Back becomes a no-op because it never left.
    source = replaceExactlyOnce(
        source,
        `                this.sideOverlayId[tab] = com;\n                this.redrawSidebar = true;\n                this.redrawSideicons = true;`,
        `                const suppressGrandExchangeSellTabSwap =\n                    this.mainModalId === GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID &&\n                    tab === 3 &&\n                    com === GRAND_EXCHANGE_SELL_INVENTORY_ROOT_ID;\n\n                if (!suppressGrandExchangeSellTabSwap) {\n                    const previousTabInterface = this.sideOverlayId[tab];\n                    this.sideOverlayId[tab] = com;\n                    if (\n                        this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                        previousTabInterface !== com\n                    ) {\n                        this.redrawSidebar = true;\n                        this.redrawSideicons = true;\n                    }\n                }`,
        'GE sell inventory-tab swap'
    );

    // The Sell proc also asks to activate the inventory tab. Preserve that when
    // the player is on another tab, but avoid repainting an already-active native
    // inventory tab just because the server repeated the same tab index.
    source = replaceExactlyOnce(
        source,
        `            if (this.ptype === ServerProt.IF_SETTAB_ACTIVE) {\n                this.sideTab = this.in.g1();\n\n                this.redrawSidebar = true;\n                this.redrawSideicons = true;`,
        `            if (this.ptype === ServerProt.IF_SETTAB_ACTIVE) {\n                const tab = this.in.g1();\n                if (\n                    this.mainModalId !== GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID ||\n                    this.sideTab !== tab\n                ) {\n                    this.sideTab = tab;\n                    this.redrawSidebar = true;\n                    this.redrawSideicons = true;\n                }`,
        'GE sell active-tab refresh'
    );

    const inventoryOptionAnchor = '                            if (child.iop) {';
    const nativeSellOffer = [
        '                            if (',
        '                                child.id === GRAND_EXCHANGE_NATIVE_INVENTORY_COMPONENT_ID &&',
        '                                this.mainModalId === GRAND_EXCHANGE_OVERVIEW_ROOT_COMPONENT_ID &&',
        "                                IfType.list[GRAND_EXCHANGE_OFFER_TITLE_COMPONENT_ID]?.text === 'Sell Offer' &&",
        '                                IfType.list[GRAND_EXCHANGE_DETAIL_ROOT_COMPONENT_ID]?.hide !== false &&',
        '                                (',
        '                                    IfType.list[GRAND_EXCHANGE_SELECTED_SETUP_ROOT_COMPONENT_ID]?.hide === false ||',
        '                                    IfType.list[GRAND_EXCHANGE_SELL_PROMPT_ROOT_COMPONENT_ID]?.hide === false',
        '                                )',
        '                            ) {',
        `                                this.menuOption[this.menuNumEntries] = '${GRAND_EXCHANGE_NATIVE_SELL_ACTION_TEXT}' + obj.name;`,
        '                                this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON1;',
        '                                this.menuParamA[this.menuNumEntries] = obj.id;',
        '                                this.menuParamB[this.menuNumEntries] = slot;',
        '                                this.menuParamC[this.menuNumEntries] = GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID;',
        '                                this.menuNumEntries++;',
        '                            }',
        '',
        inventoryOptionAnchor,
    ].join('\n');

    source = replaceExactlyOnce(
        source,
        inventoryOptionAnchor,
        nativeSellOffer,
        'native inventory option insertion point'
    );

    return source;
}

function validateNativeSellInventoryPatch(source: string) {
    for (const required of [
        'GRAND_EXCHANGE_NATIVE_INVENTORY_COMPONENT_ID = 3214',
        'GRAND_EXCHANGE_SELL_INVENTORY_ROOT_ID = 8988',
        'GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID = 11393',
        'component !== GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID',
        'suppressGrandExchangeSellTabSwap',
        'previousTabInterface !== com',
        'this.sideTab !== tab',
        "IfType.list[GRAND_EXCHANGE_OFFER_TITLE_COMPONENT_ID]?.text === 'Sell Offer'",
        'IfType.list[GRAND_EXCHANGE_SELECTED_SETUP_ROOT_COMPONENT_ID]?.hide === false',
        'IfType.list[GRAND_EXCHANGE_SELL_PROMPT_ROOT_COMPONENT_ID]?.hide === false',
        'IfType.list[GRAND_EXCHANGE_DETAIL_ROOT_COMPONENT_ID]?.hide !== false',
        `this.menuOption[this.menuNumEntries] = '${GRAND_EXCHANGE_NATIVE_SELL_ACTION_TEXT}' + obj.name;`,
        'this.menuAction[this.menuNumEntries] = MiniMenuAction.INV_BUTTON1;',
        'this.menuParamC[this.menuNumEntries] = GRAND_EXCHANGE_SELL_INVENTORY_COMPONENT_ID;',
    ]) {
        if (!source.includes(required)) {
            throw new Error(`Grand Exchange webclient source is missing native Sell bridge token: ${required}`);
        }
    }
}

// The Grand Exchange adds client-side adapters for native r254 UI/config data:
// Bank booths need their otherwise-unused OPLOC3 label, live chatbox result
// clicks need to be distinguishable from an Enter-key p_namedialog response,
// and Sell must reuse the already-mounted native inventory to avoid icon flicker.
// Build and publish the webclient whenever option-2 GE staging runs so a stale
// engine/public/client/client.js cannot silently omit those adapters.
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
    // temporarily adds the GE-only native-inventory routing for its browser
    // bundle, then restores Client.ts even when the build fails.
    const originalClientSource = fs.readFileSync(CLIENT_SOURCE_PATH, 'utf8');
    const patchedClientSource = patchGrandExchangeNativeSellInventory(originalClientSource.replace(/\r/g, ''));
    validateNativeSellInventoryPatch(patchedClientSource);

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
    // The bundle is minified and may mangle property names, so validate the
    // runtime GE gate in ClientEntry.ts before building rather than looking for
    // the literal "grandExchange" token in generated output.
    if (!builtClient.includes(GRAND_EXCHANGE_CHATBOX_SELECTION_PREFIX)) {
        throw new Error('Grand Exchange webclient bundle does not contain the chatbox-selection routing marker');
    }
    if (!builtClient.includes(GRAND_EXCHANGE_NATIVE_SELL_ACTION_TEXT)) {
        throw new Error('Grand Exchange webclient bundle does not contain the native-inventory Sell action');
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
    if (!publishedClient.includes(GRAND_EXCHANGE_NATIVE_SELL_ACTION_TEXT)) {
        throw new Error('Grand Exchange published webclient lost the native-inventory Sell action');
    }
}

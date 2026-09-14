import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_INTERFACE_NAME = 'grand_exchange_sell_inventory';

function scriptBlock(source: string, marker: string, label: string) {
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) {
        throw new Error(`Grand Exchange native-sell stage is missing ${label}: ${marker}`);
    }
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first < 0) {
        throw new Error(`Grand Exchange native-sell stage cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange native-sell stage found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function replaceScriptBlock(source: string, marker: string, label: string, patch: (block: string) => string) {
    const current = scriptBlock(source, marker, label);
    const next = patch(current.block);
    return source.slice(0, current.start) + next + source.slice(current.end);
}

function patchOverview(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    source = replaceScriptBlock(source, '[proc,ge_open_sell_offer_setup]', 'sell setup', block => {
        // Do not replace the inventory tab just to change its click action. The
        // option-2 webclient keeps native inventory:inv mounted and supplies an
        // Offer action whose packet is routed to the existing synthetic GE sell
        // component. This removes every sidebar packet from the Sell transition.
        const sidebarSetup = [
            `inv_transmit(inv, ${SELL_INTERFACE_NAME}:inv);`,
            `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);`,
            'if_settabactive(^tab_inventory);',
        ].join('\n');
        return replaceExactlyOnce(
            block,
            sidebarSetup,
            '// Native inventory remains mounted; the webclient supplies the GE Offer action.',
            'sell setup inventory-tab replacement'
        );
    });

    source = replaceScriptBlock(source, '[proc,ge_return_to_offer_summary]', 'sell Back flow', block => {
        let patched = replaceExactlyOnce(
            block,
            `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);\n`,
            '',
            'sell Back inventory transmit cleanup'
        );
        patched = replaceExactlyOnce(
            patched,
            'if_settab(inventory, ^tab_inventory);\nif_settabactive(^tab_inventory);\n',
            '',
            'sell Back inventory-tab restore'
        );
        return patched;
    });

    const setup = scriptBlock(source, '[proc,ge_open_sell_offer_setup]', 'sell setup validation').block;
    const back = scriptBlock(source, '[proc,ge_return_to_offer_summary]', 'sell Back validation').block;
    for (const forbidden of [
        `inv_transmit(inv, ${SELL_INTERFACE_NAME}:inv);`,
        `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);`,
        'if_settabactive(^tab_inventory);',
        `if_openmain_side(${GE_INTERFACE_NAME}, ${SELL_INTERFACE_NAME});`,
    ]) {
        if (setup.includes(forbidden)) {
            throw new Error(`Grand Exchange Sell setup still changes the sidebar: ${forbidden}`);
        }
    }
    for (const forbidden of [
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
        'if_settab(inventory, ^tab_inventory);',
        'if_settabactive(^tab_inventory);',
        `if_openmain(${GE_INTERFACE_NAME});`,
    ]) {
        if (back.includes(forbidden)) {
            throw new Error(`Grand Exchange Sell Back still changes/reopens an interface: ${forbidden}`);
        }
    }

    fs.writeFileSync(file, source, 'utf8');
}

function patchSellSelection(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_sell_item_selection.rs2'
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    source = replaceScriptBlock(source, '[proc,ge_sell_apply_selection]', 'sell item selection', block =>
        replaceExactlyOnce(
            block,
            `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);\nif_settabactive(^tab_inventory);\n`,
            '',
            'sell selection inventory-tab keepalive'
        )
    );

    // Earlier stages needed this close hook solely to stop/restore the synthetic
    // sell inventory tab. The final flow never starts that transmit or mounts the
    // component, so retaining the hook would itself create unnecessary sidebar
    // work when the GE closes.
    const close = scriptBlock(source, `[if_close,${GE_INTERFACE_NAME}]`, 'sell close cleanup');
    for (const required of [
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
        'if_settab(inventory, ^tab_inventory);',
    ]) {
        if (!close.block.includes(required)) {
            throw new Error(`Grand Exchange native-sell close cleanup no longer contains ${required}`);
        }
    }
    source = source.slice(0, close.start) + source.slice(close.end);

    const selection = scriptBlock(source, '[proc,ge_sell_apply_selection]', 'sell item selection validation').block;
    for (const forbidden of [
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
        `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);`,
        'if_settabactive(^tab_inventory);',
        `if_openmain(${GE_INTERFACE_NAME});`,
    ]) {
        if (selection.includes(forbidden)) {
            throw new Error(`Grand Exchange Sell selection still changes/reopens an interface: ${forbidden}`);
        }
    }
    if (source.includes(`[if_close,${GE_INTERFACE_NAME}]`)) {
        throw new Error('Grand Exchange Sell selection still contains obsolete sidebar close cleanup');
    }
    if (!source.includes(`[inv_button1,${SELL_INTERFACE_NAME}:inv]`)) {
        throw new Error('Grand Exchange native inventory bridge lost the authoritative sell click trigger');
    }

    fs.writeFileSync(file, source, 'utf8');
}

export function prepareGrandExchangeSellNativeInventoryStage(stagedContentDir: string) {
    // Run after the compatibility/persistence stages have validated their older
    // side-inventory representation. The final staged scripts deliberately keep
    // native inventory:inv mounted and use the synthetic component only as the
    // INV_BUTTON1 trigger identity supplied by the option-2 webclient.
    patchOverview(stagedContentDir);
    patchSellSelection(stagedContentDir);
}

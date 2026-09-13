import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_INTERFACE_NAME = 'grand_exchange_sell_inventory';
const HIDDEN_ITEM_MODEL_OFFSET_X = 600;

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange offer-selection state is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange offer-selection state could not find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange offer-selection state found multiple ${label} occurrences`);
    }

    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchOfferSetupReset(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange offer-selection overview script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const [procName, title] of [
        ['ge_open_buy_offer_setup', 'Buy Offer'],
        ['ge_open_sell_offer_setup', 'Sell Offer'],
    ] as const) {
        const marker = `[proc,${procName}]`;
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        const titleSetter = `if_settext(${GE_INTERFACE_NAME}:com_133, "${title}");`;
        if (!block.includes(titleSetter)) {
            throw new Error(`Grand Exchange ${title} setup no longer contains its title setter`);
        }

        // IF1 retains the last object payload on a model component. This engine
        // rejects -1/null for if_setmodel, so keep the cached payload harmlessly
        // off-canvas until a fresh Buy/Sell selection restores the authored offset.
        const resetLines = [
            `if_setposition(${GE_INTERFACE_NAME}:com_138, ${HIDDEN_ITEM_MODEL_OFFSET_X}, 0);`,
            `if_sethide(${GE_INTERFACE_NAME}:com_138, true);`,
            `if_settext(${GE_INTERFACE_NAME}:com_141, "Choose an item to exchange");`,
            `if_settext(${GE_INTERFACE_NAME}:com_142, "");`,
        ];
        const missing = resetLines.filter(line => !block.includes(line));
        if (missing.length > 0) {
            block = block.replace(titleSetter, `${titleSetter}\n${missing.join('\n')}`);
        }

        source = source.slice(0, start) + block + source.slice(end);
    }

    // The Sell selector only needs a selectable version of the inventory tab.
    // Using IF_OPENMAIN_SIDE turns the selector into a side modal, which means
    // Back can only remove it by closing/reopening the GE main interface. Swap
    // the normal inventory tab instead so the main GE remains mounted in place.
    source = replaceExactlyOnce(
        source,
        `if_openmain_side(${GE_INTERFACE_NAME}, ${SELL_INTERFACE_NAME});`,
        `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);\nif_settabactive(^tab_inventory);`,
        'sell inventory side-modal open'
    );

    const backCleanup = [
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
        'inv_clear(ge_selected_item);',
        `if_openmain(${GE_INTERFACE_NAME});`,
    ].join('\n');
    const inPlaceBackCleanup = [
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
        'inv_clear(ge_selected_item);',
        'if_settab(inventory, ^tab_inventory);',
        'if_settabactive(^tab_inventory);',
        `if_setposition(${GE_INTERFACE_NAME}:com_138, ${HIDDEN_ITEM_MODEL_OFFSET_X}, 0);`,
        `if_sethide(${GE_INTERFACE_NAME}:com_138, true);`,
        `if_settext(${GE_INTERFACE_NAME}:com_141, "Choose an item to exchange");`,
        `if_settext(${GE_INTERFACE_NAME}:com_142, "");`,
    ].join('\n');
    source = replaceExactlyOnce(
        source,
        backCleanup,
        inPlaceBackCleanup,
        'offer-summary Back close/reopen sequence'
    );

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function patchSellSelectionInPlace(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_sell_item_selection.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange sell-selection script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    // The GE main interface is already open. Keep the selectable GE inventory
    // tab mounted after choosing an item so a later click replaces the offer
    // item instead of falling through to Equip/Use on the normal inventory.
    source = replaceExactlyOnce(
        source,
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);\nif_openmain(${GE_INTERFACE_NAME});\n`,
        `if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);\nif_settabactive(^tab_inventory);\n`,
        'sell-selection stop/reopen sequence'
    );

    const selectionBlock = getScriptBlock(source, '[proc,ge_sell_apply_selection]').block;
    if (selectionBlock.includes(`inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`)) {
        throw new Error('Grand Exchange sell selection still disables item replacement after the first choice');
    }
    if (!selectionBlock.includes(`if_settab(${SELL_INTERFACE_NAME}, ^tab_inventory);`)) {
        throw new Error('Grand Exchange sell selection no longer keeps the selectable inventory tab active');
    }

    const itemSetter = `if_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);`;
    source = replaceExactlyOnce(
        source,
        itemSetter,
        `if_setposition(${GE_INTERFACE_NAME}:com_138, 0, 0);\nif_sethide(${GE_INTERFACE_NAME}:com_138, false);\n${itemSetter}`,
        'sell selected-item model setter'
    );

    const closeMarker = `[if_close,${GE_INTERFACE_NAME}]`;
    const { start, end, block: originalCloseBlock } = getScriptBlock(source, closeMarker);
    let closeBlock = originalCloseBlock;
    const stopTransmit = `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`;
    const restoreInventory = 'if_settab(inventory, ^tab_inventory);';
    if (!closeBlock.includes(stopTransmit)) {
        throw new Error('Grand Exchange sell-selection close handler no longer stops the sell inventory transmit');
    }
    if (!closeBlock.includes(restoreInventory)) {
        closeBlock = closeBlock.replace(stopTransmit, `${stopTransmit}\n${restoreInventory}`);
    }
    source = source.slice(0, start) + closeBlock + source.slice(end);

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function patchBuySelectionReveal(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange buy-selection script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const itemSetter = `if_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);`;
    source = replaceExactlyOnce(
        source,
        itemSetter,
        `if_setposition(${GE_INTERFACE_NAME}:com_138, 0, 0);\nif_sethide(${GE_INTERFACE_NAME}:com_138, false);\n${itemSetter}`,
        'buy selected-item model setter'
    );
    fs.writeFileSync(scriptPath, source, 'utf8');
}

export function prepareGrandExchangeOfferSelectionStateStage(stagedContentDir: string) {
    patchOfferSetupReset(stagedContentDir);
    patchSellSelectionInPlace(stagedContentDir);
    patchBuySelectionReveal(stagedContentDir);
}

import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_INTERFACE_NAME = 'grand_exchange_sell_inventory';

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

        const resetLines = [
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

    // The main GE is already open as the main half of IF_OPENMAIN_SIDE. Reopening
    // it here closes both modals and immediately recreates the main interface,
    // producing a visible flash and restoring source-default layers long enough
    // for the sell prompt to cover the selected item's examine text. Keep the
    // existing main + side pair alive and update the offer components in place.
    source = replaceExactlyOnce(
        source,
        `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);\nif_openmain(${GE_INTERFACE_NAME});\n`,
        '',
        'sell-selection stop/reopen sequence'
    );

    const itemSetter = `if_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);`;
    source = replaceExactlyOnce(
        source,
        itemSetter,
        `if_sethide(${GE_INTERFACE_NAME}:com_138, false);\n${itemSetter}`,
        'sell selected-item model setter'
    );

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
        `if_sethide(${GE_INTERFACE_NAME}:com_138, false);\n${itemSetter}`,
        'buy selected-item model setter'
    );
    fs.writeFileSync(scriptPath, source, 'utf8');
}

export function prepareGrandExchangeOfferSelectionStateStage(stagedContentDir: string) {
    patchOfferSetupReset(stagedContentDir);
    patchSellSelectionInPlace(stagedContentDir);
    patchBuySelectionReveal(stagedContentDir);
}

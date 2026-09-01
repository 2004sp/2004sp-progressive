import fs from 'fs';
import path from 'path';

const SEARCH_SCRIPT_NAME = 'grand_exchange_item_search.rs2';
const SEARCH_INVENTORY_CONFIG_NAME = 'grand_exchange_item_search.inv';
const SEARCH_RESULTS_INV = 'ge_search_results';
const SELECTED_ITEM_INV = 'ge_selected_item';

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange RuneScript type compatibility could not find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange RuneScript type compatibility found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchItemSearchScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        SEARCH_SCRIPT_NAME
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange generated item-search script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    // inv_setslot requires namedobj, while runtime inventory reads return obj.
    // Search catalogue rows are emitted from static native obj.pack symbols, so
    // keep those as namedobj all the way into the result container.
    source = replaceExactlyOnce(
        source,
        '[proc,ge_item_search_store_result](int $slot, obj $item)',
        '[proc,ge_item_search_store_result](int $slot, namedobj $item)',
        'item-search store-result proc signature'
    );

    // A clicked result is a runtime obj. Move that object between the two temp
    // inventories instead of trying to feed it back into namedobj-only setslot.
    source = replaceExactlyOnce(
        source,
        `inv_setslot(${SELECTED_ITEM_INV}, 0, $item, 1);`,
        `inv_moveitem(${SEARCH_RESULTS_INV}, ${SELECTED_ITEM_INV}, $item, 1);`,
        'selected-item runtime write'
    );

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function expandSelectedItemState(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        SEARCH_INVENTORY_CONFIG_NAME
    );
    if (!fs.existsSync(configPath)) {
        throw new Error(`Grand Exchange generated item-search inventory config is missing: ${configPath}`);
    }

    let source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
    const oldBlock = `[${SELECTED_ITEM_INV}]\nscope=temp\nsize=1\nstackall=yes`;
    const newBlock = `[${SELECTED_ITEM_INV}]\nscope=temp\nsize=2\nstackall=yes`;
    source = replaceExactlyOnce(source, oldBlock, newBlock, 'selected-item temp inventory definition');
    fs.writeFileSync(configPath, source, 'utf8');
}

export function prepareGrandExchangeRuneScriptTypeCompatibilityStage(stagedContentDir: string) {
    patchItemSearchScript(stagedContentDir);
    expandSelectedItemState(stagedContentDir);
}

import fs from 'fs';
import path from 'path';

const OVERVIEW_INTERFACE = 'grand_exchange_overview';
const SEARCH_INTERFACE = 'grand_exchange_item_search';

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange item-search QoL stage is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange item-search QoL stage cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange item-search QoL stage found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchBlock(source: string, marker: string, patch: (block: string) => string) {
    const { start, end, block } = getScriptBlock(source, marker);
    return source.slice(0, start) + patch(block) + source.slice(end);
}

function patchSearchScript(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange item-search QoL script is missing: ${file}`);
    }

    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    source = patchBlock(source, '[proc,ge_item_search_apply_selection]', block => {
        // Keep the transparent Search hitbox alive after an item is selected.
        // The selected native item model occupies the same visual box, so hide
        // only the magnifier/prompt chrome rather than hiding their parent layer.
        block = replaceExactlyOnce(
            block,
            `if_sethide(${OVERVIEW_INTERFACE}:com_192, true);`,
            [
                `if_sethide(${OVERVIEW_INTERFACE}:com_192, false);`,
                `if_sethide(${OVERVIEW_INTERFACE}:com_195, true);`,
                `if_sethide(${OVERVIEW_INTERFACE}:com_196, true);`,
            ].join('\n'),
            'selected-item search-layer hide'
        );
        return block;
    });

    source = patchBlock(source, `[if_button,${OVERVIEW_INTERFACE}:com_194]`, block => {
        // Re-searching and then cancelling must preserve the currently selected
        // item. ge_item_search_apply_selection replaces this inventory only once
        // the player actually chooses a new result.
        block = replaceExactlyOnce(
            block,
            'inv_clear(ge_selected_item);\n',
            '',
            'search-button selected-item clear'
        );

        // The generated compatibility script historically ran the search and
        // immediately selected result zero. That made broad searches feel like
        // the click had ignored the player and left the fully built 80-row IF1
        // result browser unused. Open that browser and let the player choose.
        const autoSelectTail = [
            'p_namedialog;',
            'def_string $query = last_string;',
            'if (string_length($query) < 1) return;',
            '~ge_item_search_run($query);',
            'if (inv_getnum(ge_search_results, 0) <= 0) return;',
            'def_obj $item = inv_getobj(ge_search_results, 0);',
            'if (oc_uncert($item) ! $item) return;',
            '~ge_item_search_apply_selection($item);',
        ].join('\n');
        const browseTail = [
            'p_namedialog;',
            'def_string $query = last_string;',
            'if (string_length($query) < 1) return;',
            `if_openmain(${SEARCH_INTERFACE});`,
            '~ge_item_search_run($query);',
        ].join('\n');
        return replaceExactlyOnce(block, autoSelectTail, browseTail, 'overview search auto-selection tail');
    });

    fs.writeFileSync(file, source, 'utf8');
}

function patchBuySetup(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(file)) {
        throw new Error(`Grand Exchange item-search QoL overview script is missing: ${file}`);
    }

    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    source = patchBlock(source, '[proc,ge_open_buy_offer_setup]', block => {
        const searchVisible = `if_sethide(${OVERVIEW_INTERFACE}:com_192, false);`;
        return replaceExactlyOnce(
            block,
            searchVisible,
            [
                searchVisible,
                `if_sethide(${OVERVIEW_INTERFACE}:com_195, false);`,
                `if_sethide(${OVERVIEW_INTERFACE}:com_196, false);`,
            ].join('\n'),
            'buy-setup search-layer show'
        );
    });

    fs.writeFileSync(file, source, 'utf8');
}

function validate(stagedContentDir: string) {
    const searchSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_item_search.rs2'),
        'utf8'
    ).replace(/\r/g, '');
    const selection = getScriptBlock(searchSource, '[proc,ge_item_search_apply_selection]').block;
    for (const required of [
        `if_sethide(${OVERVIEW_INTERFACE}:com_192, false);`,
        `if_sethide(${OVERVIEW_INTERFACE}:com_195, true);`,
        `if_sethide(${OVERVIEW_INTERFACE}:com_196, true);`,
    ]) {
        if (!selection.includes(required)) {
            throw new Error(`Grand Exchange selected-item re-search control lost ${required}`);
        }
    }

    const searchButton = getScriptBlock(searchSource, `[if_button,${OVERVIEW_INTERFACE}:com_194]`).block;
    if (searchButton.includes('inv_clear(ge_selected_item);')) {
        throw new Error('Grand Exchange re-search button still clears the selected item before replacement');
    }
    for (const required of [
        `if_openmain(${SEARCH_INTERFACE});`,
        '~ge_item_search_run($query);',
    ]) {
        if (!searchButton.includes(required)) {
            throw new Error(`Grand Exchange overview search browser lost ${required}`);
        }
    }
    for (const forbidden of [
        'inv_getobj(ge_search_results, 0)',
        '~ge_item_search_apply_selection($item);',
    ]) {
        if (searchButton.includes(forbidden)) {
            throw new Error(`Grand Exchange overview search still auto-selects its first result via ${forbidden}`);
        }
    }

    const overviewSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2'),
        'utf8'
    ).replace(/\r/g, '');
    const buySetup = getScriptBlock(overviewSource, '[proc,ge_open_buy_offer_setup]').block;
    for (const required of [
        `if_sethide(${OVERVIEW_INTERFACE}:com_195, false);`,
        `if_sethide(${OVERVIEW_INTERFACE}:com_196, false);`,
    ]) {
        if (!buySetup.includes(required)) {
            throw new Error(`Grand Exchange fresh Buy search chrome lost ${required}`);
        }
    }
}

export function prepareGrandExchangeItemSearchQolStage(stagedContentDir: string) {
    patchSearchScript(stagedContentDir);
    patchBuySetup(stagedContentDir);
    validate(stagedContentDir);
}

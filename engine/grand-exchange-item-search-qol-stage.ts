import fs from 'fs';
import path from 'path';

const OVERVIEW_INTERFACE = 'grand_exchange_overview';
const SEARCH_INTERFACE = 'grand_exchange_item_search';
const CHATBOX_SELECTION_PREFIX = '__ge_select__:';
const EXACT_SELECTION_CHUNK_SIZE = 128;

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

function extractCatalogueSymbols(source: string) {
    const symbols: string[] = [];
    const pattern = /if \(oc_uncert\(([^)\n]+)\) = ([^)\n]+)\) \{/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null) {
        const left = match[1].trim();
        const right = match[2].trim();
        if (left !== right) {
            throw new Error(`Grand Exchange item-search catalogue guard drifted: ${left} != ${right}`);
        }
        symbols.push(left);
    }

    const unique = [...new Set(symbols)];
    if (!unique.length) {
        throw new Error('Grand Exchange item-search QoL stage could not recover the generated native catalogue');
    }
    return unique;
}

function buildExactSelectionScripts(symbols: string[]) {
    const chunks: string[][] = [];
    for (let index = 0; index < symbols.length; index += EXACT_SELECTION_CHUNK_SIZE) {
        chunks.push(symbols.slice(index, index + EXACT_SELECTION_CHUNK_SIZE));
    }

    const chunkScripts = chunks.map((chunk, chunkIndex) => {
        const checks = chunk.map(symbol => [
            `if (oc_uncert(${symbol}) = ${symbol}) {`,
            `    if (compare(lowercase(oc_name(${symbol})), $needle) = 0) {`,
            `        ~ge_item_search_apply_selection(${symbol});`,
            '        return (true);',
            '    }',
            '}',
        ].join('\n')).join('\n');

        return [
            `[proc,ge_item_search_select_exact_${chunkIndex}](string $needle)(boolean)`,
            checks,
            'return (false);',
        ].join('\n');
    });

    const dispatcher = [
        '[proc,ge_item_search_select_exact](string $needle)(boolean)',
        ...chunks.map((_, chunkIndex) =>
            `if (~ge_item_search_select_exact_${chunkIndex}($needle) = true) return (true);`
        ),
        'return (false);',
    ].join('\n');

    return {
        source: `${chunkScripts.join('\n\n')}\n\n${dispatcher}\n`,
        triggerNames: [
            ...chunks.map((_, chunkIndex) => `[proc,ge_item_search_select_exact_${chunkIndex}]`),
            '[proc,ge_item_search_select_exact]',
        ],
    };
}

function appendScriptMappings(stagedContentDir: string, triggerNames: string[]) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const content = fs.readFileSync(packPath, 'utf8').replace(/\r/g, '');
    const existingNames = new Set<string>();
    let maxId = -1;

    for (const line of content.split('\n')) {
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) maxId = Math.max(maxId, id);
        existingNames.add(line.slice(equals + 1));
    }

    const additions: string[] = [];
    for (const triggerName of triggerNames) {
        if (existingNames.has(triggerName)) continue;
        maxId++;
        additions.push(`${maxId}=${triggerName}`);
        existingNames.add(triggerName);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
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
    const catalogueSymbols = extractCatalogueSymbols(source);
    const exactSelection = buildExactSelectionScripts(catalogueSymbols);

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

        // A live chatbox result click and the Enter key both resume p_namedialog.
        // ClientEntry prefixes only a clicked result. Resolve that exact display
        // name directly against the full generated native catalogue; otherwise
        // the unmarked Enter path opens the 80-result advanced browser. The exact
        // selector deliberately uses compare() because RuneScript '=' cannot
        // compare strings.
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
            `if (string_indexof_string("${CHATBOX_SELECTION_PREFIX}", $query) = 0) {`,
            `    $query = substring($query, ${CHATBOX_SELECTION_PREFIX.length}, string_length($query));`,
            '    if (string_length($query) < 1) return;',
            '    if (~ge_item_search_select_exact(lowercase($query)) = true) return;',
            '    return;',
            '}',
            `if_openmain(${SEARCH_INTERFACE});`,
            '~ge_item_search_run($query);',
        ].join('\n');
        return replaceExactlyOnce(block, autoSelectTail, browseTail, 'overview search auto-selection tail');
    });

    if (source.includes('[proc,ge_item_search_select_exact]')) {
        throw new Error('Grand Exchange exact chatbox-selection scripts were already staged');
    }
    source = `${source.trimEnd()}\n\n${exactSelection.source}`;

    fs.writeFileSync(file, source, 'utf8');
    appendScriptMappings(stagedContentDir, exactSelection.triggerNames);
    return exactSelection.triggerNames;
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

function validate(stagedContentDir: string, exactTriggerNames: string[]) {
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
        `string_indexof_string("${CHATBOX_SELECTION_PREFIX}", $query) = 0`,
        `substring($query, ${CHATBOX_SELECTION_PREFIX.length}, string_length($query))`,
        '~ge_item_search_select_exact(lowercase($query))',
        `if_openmain(${SEARCH_INTERFACE});`,
        '~ge_item_search_run($query);',
    ]) {
        if (!searchButton.includes(required)) {
            throw new Error(`Grand Exchange overview search routing lost ${required}`);
        }
    }
    if (
        searchButton.indexOf('~ge_item_search_select_exact(lowercase($query))') >
        searchButton.indexOf(`if_openmain(${SEARCH_INTERFACE});`)
    ) {
        throw new Error('Grand Exchange advanced browser opens before chatbox result selection is handled');
    }
    for (const forbidden of [
        'inv_getobj(ge_search_results, 0)',
        '~ge_item_search_apply_selection($item);',
    ]) {
        if (searchButton.includes(forbidden)) {
            throw new Error(`Grand Exchange overview search still auto-selects its first result via ${forbidden}`);
        }
    }

    for (const triggerName of exactTriggerNames) {
        if (!searchSource.includes(triggerName)) {
            throw new Error(`Grand Exchange exact chatbox selector lost ${triggerName}`);
        }
    }
    const exactDispatcher = getScriptBlock(searchSource, '[proc,ge_item_search_select_exact]').block;
    if (!exactDispatcher.includes('return (false);')) {
        throw new Error('Grand Exchange exact chatbox selector lost its no-match return');
    }
    if (!searchSource.includes('compare(lowercase(oc_name(') || !searchSource.includes('), $needle) = 0')) {
        throw new Error('Grand Exchange exact chatbox selector lost compare()-based string equality');
    }
    if (/lowercase\(oc_name\([^\n]+\)\) = \$needle/.test(searchSource)) {
        throw new Error('Grand Exchange exact chatbox selector still compares RuneScript strings with =');
    }

    const scriptPack = fs.readFileSync(path.join(stagedContentDir, 'pack', 'script.pack'), 'utf8').replace(/\r/g, '');
    for (const triggerName of exactTriggerNames) {
        if (!scriptPack.split('\n').some(line => line.endsWith(`=${triggerName}`))) {
            throw new Error(`Grand Exchange exact chatbox selector is missing script.pack mapping ${triggerName}`);
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
    const exactTriggerNames = patchSearchScript(stagedContentDir);
    patchBuySetup(stagedContentDir);
    validate(stagedContentDir, exactTriggerNames);
}

import fs from 'fs';
import path from 'path';

const SEARCH_INTERFACE_NAME = 'grand_exchange_item_search';
const SEARCH_INTERFACE_ROOT = 8989;
const SEARCH_COMPONENT_BASE = 11304;
const SEARCH_RESULT_CAP = 80;
const SEARCH_RESULT_ROW_HEIGHT = 38;
const SEARCH_RESULT_NAME_BASE_COMPONENT = 9;
const SEARCH_RESULT_INV_COMPONENT = 8;
const SEARCH_SCROLL_COMPONENT = 7;
const SEARCH_AGAIN_COMPONENT = 5;
const SEARCH_BACK_COMPONENT = 6;
const SEARCH_RESULTS_INV_ID = 164;
const SEARCH_SELECTED_INV_ID = 165;
const SEARCH_RESULTS_INV_NAME = 'ge_search_results';
const SEARCH_SELECTED_INV_NAME = 'ge_selected_item';
const CATALOGUE_CHUNK_SIZE = 128;

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const line of content.split('\n')) {
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) values.set(id, line.slice(equals + 1));
    }

    return { content, values };
}

function appendPackMappings(file: string, mappings: Map<number, string>, label: string) {
    const { content, values } = readPack(file);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`${label} reserved ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`${label} name ${name} is already mapped to ${existingId}`);
        }

        if (!existingName) additions.push(`${id}=${name}`);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(file, normalized + additions.join('\n') + '\n', 'utf8');
}

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) throw new Error(`Grand Exchange item search is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function enableOverviewSearchAction(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        'grand_exchange_overview.if'
    );
    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const { start, end, block } = getComponentBlock(source, 194);

    for (const required of ['type=layer', 'x=102', 'y=94', 'width=40', 'height=36']) {
        if (!block.includes(required)) {
            throw new Error(`Grand Exchange buy-search action com_194 no longer contains ${required}`);
        }
    }

    if (!block.includes('buttontype=')) {
        const patched = block.trimEnd() + '\nbuttontype=normal\noption=Search\n';
        source = source.slice(0, start) + patched + source.slice(end);
    } else if (!block.includes('buttontype=normal') || !block.includes('option=Search')) {
        throw new Error('Grand Exchange buy-search action com_194 already has incompatible IF1 action metadata');
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchOverviewBuySetupReset(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = '[proc,ge_open_buy_offer_setup]';
    const start = source.indexOf(marker);
    if (start === -1) throw new Error('Grand Exchange buy-offer setup proc is missing');
    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    const block = source.slice(start, end);

    const reset = `inv_clear(${SEARCH_RESULTS_INV_NAME});\ninv_clear(${SEARCH_SELECTED_INV_NAME});`;
    if (!block.includes(reset)) {
        const needle = 'if_settext(grand_exchange_overview:com_133, "Buy Offer");';
        if (!block.includes(needle)) {
            throw new Error('Grand Exchange buy-offer setup no longer contains the Buy Offer title setter');
        }
        const patched = block.replace(needle, `${reset}\n\n${needle}`);
        source = source.slice(0, start) + patched + source.slice(end);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildSearchInterfaceSource() {
    const rows = Array.from({ length: SEARCH_RESULT_CAP }, (_, row) => {
        const componentId = SEARCH_RESULT_NAME_BASE_COMPONENT + row;
        const y = row * SEARCH_RESULT_ROW_HEIGHT + 9;
        return `[com_${componentId}]\nlayer=com_${SEARCH_SCROLL_COMPONENT}\ntype=text\nx=44\ny=${y}\nwidth=374\nheight=14\nfont=p12\nshadowed=yes\ntext=\ncolour=0xFFFFFF`;
    }).join('\n\n');

    return `// Option-2-only IF1 result browser generated by the GE compatibility stage.\n// Item graphics are populated through a native r254 inventory component; no\n// r481 item icon or item model is referenced by this interface.\n\n[com_0]\ntype=rect\nx=14\ny=25\nwidth=485\nheight=300\nfill=yes\ncolour=0x332C24\n\n[com_1]\ntype=text\nx=24\ny=34\nwidth=465\nheight=16\ncenter=yes\nfont=b12\nshadowed=yes\ntext=Grand Exchange Item Search\ncolour=0xFF981F\n\n[com_2]\ntype=text\nx=30\ny=54\nwidth=330\nheight=14\nfont=p11\nshadowed=yes\ntext=Search:\ncolour=0xFFFFFF\n\n[com_3]\ntype=text\nx=30\ny=68\nwidth=330\nheight=14\nfont=p11\nshadowed=yes\ntext=Results: 0\ncolour=0xFFFF00\n\n[com_4]\ntype=text\nx=30\ny=275\nwidth=450\nheight=14\ncenter=yes\nfont=p11\nshadowed=yes\ntext=Select an item icon. Scroll the result list for more matches.\ncolour=0xFFFFFF\n\n[com_${SEARCH_AGAIN_COMPONENT}]\ntype=text\nx=325\ny=54\nwidth=80\nheight=16\ncenter=yes\nbuttontype=normal\noption=Search\nfont=p12\nshadowed=yes\ntext=Search again\ncolour=0xFFFF00\novercolour=0xFFFFFF\n\n[com_${SEARCH_BACK_COMPONENT}]\ntype=text\nx=413\ny=54\nwidth=65\nheight=16\ncenter=yes\nbuttontype=normal\noption=Back\nfont=p12\nshadowed=yes\ntext=Back\ncolour=0xFFFF00\novercolour=0xFFFFFF\n\n[com_${SEARCH_SCROLL_COMPONENT}]\ntype=layer\nx=30\ny=84\nwidth=448\nheight=188\nscroll=${SEARCH_RESULT_CAP * SEARCH_RESULT_ROW_HEIGHT}\n\n[com_${SEARCH_RESULT_INV_COMPONENT}]\nlayer=com_${SEARCH_SCROLL_COMPONENT}\ntype=inv\nx=4\ny=0\nwidth=1\nheight=${SEARCH_RESULT_CAP}\nmargin=0,6\noption1=Select\n\n${rows}\n`;
}

function writeSearchInventoryConfig(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_item_search.inv'
    );
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
        configPath,
        `// Option-2-only server-authoritative state for the native r254 item search.\n\n[${SEARCH_RESULTS_INV_NAME}]\nscope=temp\nsize=${SEARCH_RESULT_CAP}\nstackall=yes\n\n[${SEARCH_SELECTED_INV_NAME}]\nscope=temp\nsize=1\nstackall=yes\n`,
        'utf8'
    );
}

function readNativeObjectSymbols(stagedContentDir: string) {
    const { values } = readPack(path.join(stagedContentDir, 'pack', 'obj.pack'));
    const symbols = [...values.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, symbol]) => symbol)
        .filter(symbol => symbol.length > 0);

    for (const symbol of symbols) {
        if (!/^[A-Za-z0-9_]+$/.test(symbol)) {
            throw new Error(`Native r254 object symbol cannot be emitted safely into RuneScript: ${symbol}`);
        }
    }
    if (!symbols.length) throw new Error('Native r254 object catalogue is empty');
    return symbols;
}

function buildStoreResultProc() {
    const setters = Array.from({ length: SEARCH_RESULT_CAP }, (_, row) => {
        const componentId = SEARCH_RESULT_NAME_BASE_COMPONENT + row;
        return `if ($slot = ${row}) {\n    if_settext(${SEARCH_INTERFACE_NAME}:com_${componentId}, oc_name($item));\n    return;\n}`;
    }).join('\n');

    return `[proc,ge_item_search_store_result](int $slot, obj $item)\ninv_setslot(${SEARCH_RESULTS_INV_NAME}, $slot, $item, 1);\n${setters}\n`;
}

function buildCatalogueScripts(symbols: string[]) {
    const chunks: string[][] = [];
    for (let index = 0; index < symbols.length; index += CATALOGUE_CHUNK_SIZE) {
        chunks.push(symbols.slice(index, index + CATALOGUE_CHUNK_SIZE));
    }

    const chunkScripts = chunks.map((chunk, chunkIndex) => {
        const checks = chunk.map(symbol => `if ($count < ${SEARCH_RESULT_CAP}) {\n    if (oc_tradeable(${symbol}) = true) {\n        if (oc_uncert(${symbol}) = ${symbol}) {\n            if (string_indexof_string($needle, lowercase(oc_name(${symbol}))) ! -1) {\n                ~ge_item_search_store_result($count, ${symbol});\n                $count = add($count, 1);\n            }\n        }\n    }\n}`).join('\n');
        return `[proc,ge_item_search_catalogue_${chunkIndex}](string $needle, int $count)(int)\n${checks}\nreturn ($count);\n`;
    });

    const dispatcherCalls = chunks.map((_, chunkIndex) => `$count = ~ge_item_search_catalogue_${chunkIndex}($needle, $count);\nif ($count >= ${SEARCH_RESULT_CAP}) return ($count);`).join('\n');
    const dispatcher = `[proc,ge_item_search_catalogue](string $needle)(int)\ndef_int $count = 0;\n${dispatcherCalls}\nreturn ($count);\n`;

    return { chunks, source: `${chunkScripts.join('\n')}\n${dispatcher}` };
}

function buildSearchScript(symbols: string[]) {
    const clearNames = Array.from({ length: SEARCH_RESULT_CAP }, (_, row) =>
        `if_settext(${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_NAME_BASE_COMPONENT + row}, "");`
    ).join('\n');
    const { chunks, source: catalogueSource } = buildCatalogueScripts(symbols);

    const source = `// Option-2-only native r254 item search. The catalogue procs at the end of\n// this generated source are emitted from the staged native obj.pack. Runtime\n// filtering and presentation use only native oc_* definitions and inv rendering.\n\n${buildStoreResultProc()}\n\n[proc,ge_item_search_run](string $query)\ndef_string $needle = lowercase($query);\ninv_clear(${SEARCH_RESULTS_INV_NAME});\n${clearNames}\nif_settext(${SEARCH_INTERFACE_NAME}:com_2, append("Search: ", $query));\nif_settext(${SEARCH_INTERFACE_NAME}:com_3, "Searching...");\nif_setscrollpos(${SEARCH_INTERFACE_NAME}:com_${SEARCH_SCROLL_COMPONENT}, 0);\ndef_int $count = ~ge_item_search_catalogue($needle);\nif ($count = 0) {\n    if_settext(${SEARCH_INTERFACE_NAME}:com_3, "No matching tradeable items.");\n} else if ($count >= ${SEARCH_RESULT_CAP}) {\n    if_settext(${SEARCH_INTERFACE_NAME}:com_3, "Showing the first ${SEARCH_RESULT_CAP} matching tradeable items.");\n} else {\n    if_settext(${SEARCH_INTERFACE_NAME}:com_3, append_num("Results: ", $count));\n}\ninv_transmit(${SEARCH_RESULTS_INV_NAME}, ${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT});\n\n[proc,ge_item_search_apply_selection](obj $item)\ninv_clear(${SEARCH_SELECTED_INV_NAME});\ninv_setslot(${SEARCH_SELECTED_INV_NAME}, 0, $item, 1);\nif_openmain(grand_exchange_overview);\nif_settext(grand_exchange_overview:com_133, "Buy Offer");\nif_sethide(grand_exchange_overview:com_16, true);\nif_sethide(grand_exchange_overview:com_126, false);\nif_sethide(grand_exchange_overview:com_156, false);\nif_sethide(grand_exchange_overview:com_192, true);\nif_sethide(grand_exchange_overview:com_197, true);\nif_sethide(grand_exchange_overview:com_200, true);\nif_setobject(grand_exchange_overview:com_138, $item, 250);\nif_settext(grand_exchange_overview:com_140, oc_name($item));\nif_settext(grand_exchange_overview:com_141, oc_name($item));\nif_settext(grand_exchange_overview:com_142, oc_desc($item));\nif_settext(grand_exchange_overview:com_145, "");\n\n[if_button,grand_exchange_overview:com_194]\nif (map_feature("grandexchange") = false) return;\ninv_clear(${SEARCH_RESULTS_INV_NAME});\ninv_clear(${SEARCH_SELECTED_INV_NAME});\np_namedialog;\ndef_string $query = last_string;\nif (string_length($query) < 1) return;\nif_openmain(${SEARCH_INTERFACE_NAME});\n~ge_item_search_run($query);\n\n[if_button,${SEARCH_INTERFACE_NAME}:com_${SEARCH_AGAIN_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\np_namedialog;\ndef_string $query = last_string;\nif (string_length($query) < 1) return;\n~ge_item_search_run($query);\n\n[if_button,${SEARCH_INTERFACE_NAME}:com_${SEARCH_BACK_COMPONENT}]\ninv_stoptransmit(${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT});\nif_openmain(grand_exchange_overview);\n~ge_open_buy_offer_setup;\n\n[inv_button1,${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT}]\ndef_int $slot = last_slot;\nif ($slot < 0 | $slot >= ${SEARCH_RESULT_CAP}) return;\nif (inv_getnum(${SEARCH_RESULTS_INV_NAME}, $slot) <= 0) return;\ndef_obj $item = inv_getobj(${SEARCH_RESULTS_INV_NAME}, $slot);\nif (oc_tradeable($item) = false) return;\nif (oc_uncert($item) ! $item) return;\ninv_stoptransmit(${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT});\n~ge_item_search_apply_selection($item);\n\n[if_close,${SEARCH_INTERFACE_NAME}]\ninv_stoptransmit(${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT});\n\n${catalogueSource}\n`;

    const triggerNames = [
        '[proc,ge_item_search_store_result]',
        '[proc,ge_item_search_run]',
        '[proc,ge_item_search_apply_selection]',
        `[if_button,grand_exchange_overview:com_194]`,
        `[if_button,${SEARCH_INTERFACE_NAME}:com_${SEARCH_AGAIN_COMPONENT}]`,
        `[if_button,${SEARCH_INTERFACE_NAME}:com_${SEARCH_BACK_COMPONENT}]`,
        `[inv_button1,${SEARCH_INTERFACE_NAME}:com_${SEARCH_RESULT_INV_COMPONENT}]`,
        `[if_close,${SEARCH_INTERFACE_NAME}]`,
        ...chunks.map((_, index) => `[proc,ge_item_search_catalogue_${index}]`),
        '[proc,ge_item_search_catalogue]',
    ];

    return { source, triggerNames };
}

function writeSearchSources(stagedContentDir: string, symbols: string[]) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${SEARCH_INTERFACE_NAME}.if`
    );
    fs.mkdirSync(path.dirname(interfacePath), { recursive: true });
    fs.writeFileSync(interfacePath, buildSearchInterfaceSource(), 'utf8');

    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    const generated = buildSearchScript(symbols);
    fs.writeFileSync(scriptPath, generated.source, 'utf8');
    return generated.triggerNames;
}

function injectSearchInterfaceMappings(stagedContentDir: string) {
    const componentIds = Array.from({ length: SEARCH_RESULT_NAME_BASE_COMPONENT + SEARCH_RESULT_CAP }, (_, id) => id);
    const mappings = new Map<number, string>();
    mappings.set(SEARCH_INTERFACE_ROOT, SEARCH_INTERFACE_NAME);
    for (const componentId of componentIds) {
        mappings.set(SEARCH_COMPONENT_BASE + componentId, `${SEARCH_INTERFACE_NAME}:com_${componentId}`);
    }
    appendPackMappings(path.join(stagedContentDir, 'pack', 'interface.pack'), mappings, 'Grand Exchange item-search interface');

    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [SEARCH_INTERFACE_ROOT, ...componentIds.map(componentId => SEARCH_COMPONENT_BASE + componentId)]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function injectSearchInventoryMappings(stagedContentDir: string) {
    appendPackMappings(
        path.join(stagedContentDir, 'pack', 'inv.pack'),
        new Map([
            [SEARCH_RESULTS_INV_ID, SEARCH_RESULTS_INV_NAME],
            [SEARCH_SELECTED_INV_ID, SEARCH_SELECTED_INV_NAME],
        ]),
        'Grand Exchange item-search inventory'
    );
}

function injectSearchScriptMappings(stagedContentDir: string, triggerNames: string[]) {
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const existingNames = new Set(values.values());
    const additions: string[] = [];
    let maxId = Math.max(-1, ...values.keys());

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

export function prepareGrandExchangeItemSearchStage(stagedContentDir: string) {
    enableOverviewSearchAction(stagedContentDir);
    writeSearchInventoryConfig(stagedContentDir);
    injectSearchInventoryMappings(stagedContentDir);
    patchOverviewBuySetupReset(stagedContentDir);

    const symbols = readNativeObjectSymbols(stagedContentDir);
    const triggerNames = writeSearchSources(stagedContentDir, symbols);
    injectSearchInterfaceMappings(stagedContentDir);
    injectSearchScriptMappings(stagedContentDir, triggerNames);
}

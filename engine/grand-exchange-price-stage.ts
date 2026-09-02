import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELECTED_ITEM_INV = 'ge_selected_item';
const SELECTED_ITEM_SLOT = 0;
const QUANTITY_STATE_SLOT = 1;
const PRICE_STATE_SLOT = 2;
const PRICE_STATE_OBJECT = 'coins';
const MARKET_TEXT_COMPONENT = 140;
const RANGE_TEXT_COMPONENT = 145;
const QUANTITY_TEXT_COMPONENT = 150;
const PRICE_TEXT_COMPONENT = 155;
const TOTAL_TEXT_COMPONENT = 189;
const DECREASE_COMPONENT = 171;
const INCREASE_COMPONENT = 173;
const MINIMUM_COMPONENT = 177;
const MARKET_COMPONENT = 180;
const MAXIMUM_COMPONENT = 183;
const EDIT_COMPONENT = 185;
const QUANTITY_DECREASE_COMPONENT = 157;
const QUANTITY_INCREASE_COMPONENT = 159;
const MAX_PRICE = 2147483647;
const NOSTALGIA_PRICE_CHUNK_SIZE = 128;

type NostalgiaPrice = {
    id: number;
    symbol: string;
    price: number;
};

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

function readNostalgiaPrices(stagedContentDir: string): NostalgiaPrice[] {
    const progressiveRoot = path.resolve(stagedContentDir, '..', '..', '..', '..');
    const nostalgiaRoot = process.env.NOSTALGIA_ROOT?.trim() || path.resolve(progressiveRoot, '..', 'Nostalgia');
    const databasePath = path.join(nostalgiaRoot, '2009scape', 'Server', 'data', 'eco', 'grandexchange.db');
    if (!fs.existsSync(databasePath)) {
        throw new Error(`Nostalgia Grand Exchange price database is missing: ${databasePath}`);
    }

    const { values: nativeObjects } = readPack(path.join(stagedContentDir, 'pack', 'obj.pack'));
    let sqlite: typeof import('node:sqlite');
    try {
        sqlite = require('node:sqlite') as typeof import('node:sqlite');
    } catch {
        throw new Error('Nostalgia Grand Exchange prices require a Node.js runtime with node:sqlite support.');
    }
    const database = new sqlite.DatabaseSync(databasePath, { readOnly: true });
    let rows: Array<Record<string, string | number | bigint | Uint8Array | null>>;
    try {
        rows = database.prepare('SELECT item_id, value FROM price_index').all() as Array<Record<string, string | number | bigint | Uint8Array | null>>;
    } finally {
        database.close();
    }

    const prices = new Map<number, NostalgiaPrice>();
    for (const row of rows) {
        const id = Number(row.item_id);
        const price = Number(row.value);
        const symbol = nativeObjects.get(id);
        if (!Number.isInteger(id) || !Number.isSafeInteger(price) || price < 1 || !symbol) {
            continue;
        }
        if (!/^[A-Za-z0-9_+.:]+$/.test(symbol)) {
            throw new Error(`Native r254 object symbol cannot be emitted safely into the Nostalgia price lookup: ${symbol}`);
        }
        prices.set(id, { id, symbol, price: Math.min(price, MAX_PRICE) });
    }

    const result = [...prices.values()].sort((a, b) => a.id - b.id);
    if (!result.length) {
        throw new Error(`Nostalgia Grand Exchange price_index has no overlap with the native r254 item catalogue: ${databasePath}`);
    }
    return result;
}

function buildNostalgiaPriceLookup(prices: NostalgiaPrice[]) {
    const chunks: NostalgiaPrice[][] = [];
    for (let index = 0; index < prices.length; index += NOSTALGIA_PRICE_CHUNK_SIZE) {
        chunks.push(prices.slice(index, index + NOSTALGIA_PRICE_CHUNK_SIZE));
    }

    const chunkSources = chunks.map((chunk, chunkIndex) => {
        const checks = chunk.map(entry => `if ($item = ${entry.symbol}) return (${entry.price});`).join('\n');
        return `[proc,ge_offer_nostalgia_price_${chunkIndex}](obj $item)(int)\n${checks}\nreturn (0);`;
    });
    const dispatcherCalls = chunks.map((_, chunkIndex) => `def_int $price_${chunkIndex} = ~ge_offer_nostalgia_price_${chunkIndex}($item);\nif ($price_${chunkIndex} > 0) return ($price_${chunkIndex});`).join('\n');
    const dispatcher = `[proc,ge_offer_nostalgia_price](obj $item)(int)\n${dispatcherCalls}\nreturn (0);`;

    return {
        source: `${chunkSources.join('\n\n')}\n\n${dispatcher}\n`,
        triggerNames: [
            ...chunks.map((_, chunkIndex) => `[proc,ge_offer_nostalgia_price_${chunkIndex}]`),
            '[proc,ge_offer_nostalgia_price]',
        ],
    };
}

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange price controls are missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange price controls are missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function enableLayerAction(source: string, componentId: number, option: string) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    for (const required of ['type=layer', 'width=13', 'height=13', 'scroll=13']) {
        if (!block.includes(required)) {
            throw new Error(`Grand Exchange price action ${marker} no longer contains ${required}`);
        }
    }

    const hasButtonType = block.includes('buttontype=');
    const hasOption = block.includes('option=');
    if (hasButtonType || hasOption) {
        if (block.includes('buttontype=normal') && block.includes(`option=${option}`)) {
            return source;
        }
        throw new Error(`Grand Exchange price action ${marker} already has incompatible IF1 action metadata`);
    }

    const patched = block.replace('scroll=13', `scroll=13\nbuttontype=normal\noption=${option}`);
    return source.slice(0, start) + patched + source.slice(end);
}

function convertArrowActionToIf1Button(source: string, componentId: number, option: string) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);

    if (block.includes('type=text')) {
        if (
            block.includes('buttontype=normal') &&
            block.includes(`option=${option}`) &&
            block.includes('font=p11') &&
            block.includes('text=') &&
            block.includes('colour=0x000000')
        ) {
            return source;
        }
        throw new Error(`Grand Exchange arrow action ${marker} already has incompatible IF1 text-button metadata`);
    }

    for (const required of [
        'type=layer',
        'width=13',
        'height=13',
        'scroll=13',
        'buttontype=normal',
        `option=${option}`,
    ]) {
        if (!block.includes(required)) {
            throw new Error(`Grand Exchange arrow action ${marker} is missing ${required}`);
        }
    }

    const patched = block
        .replace('type=layer', 'type=text')
        .replace('scroll=13\n', '')
        .replace(`option=${option}`, `option=${option}\nfont=p11\ntext=\ncolour=0x000000`);
    return source.slice(0, start) + patched + source.slice(end);
}

function patchPriceActions(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange price interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    source = enableLayerAction(source, DECREASE_COMPONENT, 'Decrease Price');
    source = enableLayerAction(source, INCREASE_COMPONENT, 'Increase Price');

    const priceText = getComponentBlock(source, PRICE_TEXT_COMPONENT).block;
    if (!priceText.includes('type=text') || !priceText.includes('text=1 gp')) {
        throw new Error('Grand Exchange price display com_155 no longer matches the frozen group-105 default');
    }

    const totalText = getComponentBlock(source, TOTAL_TEXT_COMPONENT).block;
    if (!totalText.includes('type=text')) {
        throw new Error('Grand Exchange total-price display com_189 is no longer an IF1 text component');
    }

    const expectedButtons = [
        { componentId: MINIMUM_COMPONENT, option: 'Offer Minimum Price' },
        { componentId: MARKET_COMPONENT, option: 'Offer Market Price' },
        { componentId: MAXIMUM_COMPONENT, option: 'Offer Maximum Price' },
        { componentId: EDIT_COMPONENT, option: 'Edit Price' },
    ] as const;

    for (const expected of expectedButtons) {
        const block = getComponentBlock(source, expected.componentId).block;
        if (!block.includes('buttontype=normal') || !block.includes(`option=${expected.option}`)) {
            throw new Error(`Grand Exchange price action com_${expected.componentId} no longer exposes ${expected.option}`);
        }
    }

    // r254 IF1 containers do not take the normal button packet path. Preserve
    // the visible source arrow graphics as their sibling components, but turn
    // the four 13x13 action overlays into invisible IF1 text hitboxes.
    source = convertArrowActionToIf1Button(source, QUANTITY_DECREASE_COMPONENT, 'Decrease Quantity');
    source = convertArrowActionToIf1Button(source, QUANTITY_INCREASE_COMPONENT, 'Increase Quantity');
    source = convertArrowActionToIf1Button(source, DECREASE_COMPONENT, 'Decrease Price');
    source = convertArrowActionToIf1Button(source, INCREASE_COMPONENT, 'Increase Price');

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchOfferSetupPresentation(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange price controls require the overview script: ${scriptPath}`);
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

        const hiddenControls = `if_sethide(${GE_INTERFACE_NAME}:com_156, true);`;
        const visibleControls = `if_sethide(${GE_INTERFACE_NAME}:com_156, false);`;
        if (block.includes(hiddenControls)) {
            block = block.replace(hiddenControls, visibleControls);
        } else if (!block.includes(visibleControls)) {
            throw new Error(`Grand Exchange ${title} setup no longer controls the group-105 quantity/price layer`);
        }

        const initialState = [
            `if_settext(${GE_INTERFACE_NAME}:com_${MARKET_TEXT_COMPONENT}, "0 gp");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, "");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${QUANTITY_TEXT_COMPONENT}, "0");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${PRICE_TEXT_COMPONENT}, "0 gp");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${TOTAL_TEXT_COMPONENT}, "0 gp");`,
        ].join('\n');
        if (!block.includes(`if_settext(${GE_INTERFACE_NAME}:com_${TOTAL_TEXT_COMPONENT}, "0 gp");`)) {
            block = block.replace(titleSetter, `${titleSetter}\n${initialState}`);
        }

        source = source.slice(0, start) + block + source.slice(end);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function widenSelectedItemState(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_item_search.inv'
    );
    if (!fs.existsSync(configPath)) {
        throw new Error(`Grand Exchange price state requires the selected-item inventory config: ${configPath}`);
    }

    let source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
    const marker = `[${SELECTED_ITEM_INV}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error('Grand Exchange price state cannot find ge_selected_item inventory config');
    }
    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    const block = source.slice(start, end);

    const sizeMatch = block.match(/^size=(\d+)$/m);
    if (!sizeMatch) {
        throw new Error('Grand Exchange selected-item state no longer exposes a staging size');
    }

    const currentSize = Number.parseInt(sizeMatch[1], 10);
    if (currentSize >= 3) return;

    const patched = block.replace(/^size=\d+$/m, 'size=3');
    source = source.slice(0, start) + patched + source.slice(end);
    fs.writeFileSync(configPath, source, 'utf8');
}

function patchQuantityTotalRefresh(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_quantity.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange total price requires the generated quantity script: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const quantityTextUpdate = `if_settext(${GE_INTERFACE_NAME}:com_${QUANTITY_TEXT_COMPONENT}, append_num("", $clamped));`;
    if (!source.includes(quantityTextUpdate)) {
        throw new Error('Grand Exchange total price cannot find the quantity display update');
    }
    if (!source.includes(`${quantityTextUpdate}\n~ge_offer_total_refresh;`)) {
        source = source.replace(quantityTextUpdate, `${quantityTextUpdate}\n~ge_offer_total_refresh;`);
    }
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function patchSelectedItemPriceReset(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange price state requires the generated item-search script: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const selectionMarker = '[proc,ge_item_search_apply_selection]';
    const start = source.indexOf(selectionMarker);
    if (start === -1) {
        throw new Error('Grand Exchange price state cannot find the item-search selection proc');
    }
    const next = source.indexOf('\n[', start + selectionMarker.length);
    const end = next === -1 ? source.length : next;
    let block = source.slice(start, end);

    const quantityTextReset = `if_settext(${GE_INTERFACE_NAME}:com_${QUANTITY_TEXT_COMPONENT}, "1");`;
    if (!block.includes(quantityTextReset)) {
        throw new Error('Grand Exchange price state requires the quantity-stage selected-item reset');
    }

    const priceReset = `def_int $guide_price = ~ge_offer_nostalgia_price($item);\nif ($guide_price < 1) {\n    $guide_price = oc_cost($item);\n}\nif ($guide_price < 1) {\n    $guide_price = 1;\n}\ndef_int $minimum_delta = calc($guide_price / 20);\nif (calc($guide_price % 20) ! 0) {\n    $minimum_delta = add($minimum_delta, 1);\n}\ndef_int $minimum_price = sub($guide_price, $minimum_delta);\nif ($minimum_price < 1) {\n    $minimum_price = 1;\n}\ndef_int $maximum_delta = calc($guide_price / 20);\ndef_int $maximum_price = ${MAX_PRICE};\nif ($guide_price <= sub(${MAX_PRICE}, $maximum_delta)) {\n    $maximum_price = add($guide_price, $maximum_delta);\n}\ninv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $guide_price);\nif_settext(${GE_INTERFACE_NAME}:com_${MARKET_TEXT_COMPONENT}, append(append_num("", $guide_price), " gp"));\ndef_string $minimum_text = append(append_num("", $minimum_price), " gp");\ndef_string $maximum_text = append(append_num("", $maximum_price), " gp");\nif_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, append(append($minimum_text, " - "), $maximum_text));\nif_settext(${GE_INTERFACE_NAME}:com_${PRICE_TEXT_COMPONENT}, append(append_num("", $guide_price), " gp"));\n~ge_offer_total_refresh;`;

    if (!block.includes(`inv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $guide_price);`)) {
        block = block.replace(quantityTextReset, `${quantityTextReset}\n${priceReset}`);
    } else if (!block.includes(`if_settext(${GE_INTERFACE_NAME}:com_${TOTAL_TEXT_COMPONENT}`) && !block.includes('~ge_offer_total_refresh;')) {
        throw new Error('Grand Exchange selected-item price reset already exists in an incompatible form');
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildPriceScript() {
    return `// Option-2-only server-authoritative price state for group 105.\n// ge_selected_item slot 0 stores the selected native-r254 item, slot 1 stores\n// quantity, and slot 2 uses a private coins stack only as an integer price token.\n// Guide prices come from Nostalgia/2009scape's price_index for item IDs that\n// also exist in native r254. oc_cost is used only when that index has no row.\n\n[proc,ge_offer_total_refresh]\nif (map_feature("grandexchange") = false) return;\ndef_int $quantity = inv_getnum(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT});\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($quantity <= 0 | $price <= 0) {\n    if_settext(${GE_INTERFACE_NAME}:com_${TOTAL_TEXT_COMPONENT}, "0 gp");\n    return;\n}\ndef_int $total = ${MAX_PRICE};\nif ($price <= calc(${MAX_PRICE} / $quantity)) {\n    $total = calc($quantity * $price);\n}\nif_settext(${GE_INTERFACE_NAME}:com_${TOTAL_TEXT_COMPONENT}, append(append_num("", $total), " gp"));\n\n[proc,ge_offer_guide_price]()(int)\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return (1);\ndef_obj $item = inv_getobj(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT});\ndef_int $guide = ~ge_offer_nostalgia_price($item);\nif ($guide < 1) {\n    $guide = oc_cost($item);\n}\nif ($guide < 1) {\n    $guide = 1;\n}\nreturn ($guide);\n\n[proc,ge_offer_price_set](int $price)\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $clamped = $price;\nif ($clamped < 1) {\n    $clamped = 1;\n}\ninv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $clamped);\nif_settext(${GE_INTERFACE_NAME}:com_${PRICE_TEXT_COMPONENT}, append(append_num("", $clamped), " gp"));\n~ge_offer_total_refresh;\n\n[if_button,${GE_INTERFACE_NAME}:com_${DECREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($price <= 1) return;\n~ge_offer_price_set(sub($price, 1));\n\n[if_button,${GE_INTERFACE_NAME}:com_${INCREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($price <= 0) {\n    $price = ~ge_offer_guide_price;\n}\nif ($price >= ${MAX_PRICE}) return;\n~ge_offer_price_set(add($price, 1));\n\n[if_button,${GE_INTERFACE_NAME}:com_${MINIMUM_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $guide = ~ge_offer_guide_price;\ndef_int $delta = calc($guide / 20);\nif (calc($guide % 20) ! 0) {\n    $delta = add($delta, 1);\n}\ndef_int $minimum = sub($guide, $delta);\nif ($minimum < 1) {\n    $minimum = 1;\n}\n~ge_offer_price_set($minimum);\n\n[if_button,${GE_INTERFACE_NAME}:com_${MARKET_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\n~ge_offer_price_set(~ge_offer_guide_price);\n\n[if_button,${GE_INTERFACE_NAME}:com_${MAXIMUM_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $guide = ~ge_offer_guide_price;\ndef_int $delta = calc($guide / 20);\nif ($guide > sub(${MAX_PRICE}, $delta)) {\n    ~ge_offer_price_set(${MAX_PRICE});\n    return;\n}\n~ge_offer_price_set(add($guide, $delta));\n\n[if_button,${GE_INTERFACE_NAME}:com_${EDIT_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\np_countdialog;\ndef_int $price = last_int;\nif ($price <= 0) return;\n~ge_offer_price_set($price);\n`;
}

function writePriceScript(stagedContentDir: string, prices: NostalgiaPrice[]) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_price.rs2'
    );
    const priceLookup = buildNostalgiaPriceLookup(prices);
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, priceLookup.source + '\n' + buildPriceScript(), 'utf8');
    return priceLookup.triggerNames;
}

function injectPriceScriptMappings(stagedContentDir: string, nostalgiaTriggerNames: string[]) {
    const triggerNames = [
        ...nostalgiaTriggerNames,
        '[proc,ge_offer_total_refresh]',
        '[proc,ge_offer_guide_price]',
        '[proc,ge_offer_price_set]',
        `[if_button,${GE_INTERFACE_NAME}:com_${DECREASE_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${INCREASE_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${MINIMUM_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${MARKET_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${MAXIMUM_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${EDIT_COMPONENT}]`,
    ];

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

export function prepareGrandExchangePriceStage(stagedContentDir: string) {
    const nostalgiaPrices = readNostalgiaPrices(stagedContentDir);
    patchPriceActions(stagedContentDir);
    patchOfferSetupPresentation(stagedContentDir);
    widenSelectedItemState(stagedContentDir);
    patchQuantityTotalRefresh(stagedContentDir);
    patchSelectedItemPriceReset(stagedContentDir);
    const nostalgiaTriggerNames = writePriceScript(stagedContentDir, nostalgiaPrices);
    injectPriceScriptMappings(stagedContentDir, nostalgiaTriggerNames);
    console.log(`Grand Exchange: loaded ${nostalgiaPrices.length} Nostalgia guide prices that exist in native r254.`);
}

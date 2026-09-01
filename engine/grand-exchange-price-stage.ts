import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELECTED_ITEM_INV = 'ge_selected_item';
const SELECTED_ITEM_SLOT = 0;
const PRICE_STATE_SLOT = 2;
const PRICE_STATE_OBJECT = 'coins';
const PRICE_TEXT_COMPONENT = 155;
const DECREASE_COMPONENT = 171;
const INCREASE_COMPONENT = 173;
const MINIMUM_COMPONENT = 177;
const MARKET_COMPONENT = 180;
const MAXIMUM_COMPONENT = 183;
const EDIT_COMPONENT = 185;
const MAX_PRICE = 2147483647;

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

    fs.writeFileSync(interfacePath, source, 'utf8');
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

    const quantityTextReset = `if_settext(${GE_INTERFACE_NAME}:com_150, "1");`;
    if (!block.includes(quantityTextReset)) {
        throw new Error('Grand Exchange price state requires the quantity-stage selected-item reset');
    }

    const priceReset = `def_int $guide_price = oc_cost($item);\nif ($guide_price < 1) {\n    $guide_price = 1;\n}\ninv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $guide_price);\nif_settext(${GE_INTERFACE_NAME}:com_${PRICE_TEXT_COMPONENT}, append(append_num("", $guide_price), " gp"));`;
    if (!block.includes(`inv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $guide_price);`)) {
        block = block.replace(quantityTextReset, `${quantityTextReset}\n${priceReset}`);
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildPriceScript() {
    return `// Option-2-only server-authoritative price state for group 105.\n// ge_selected_item slot 0 stores the selected native-r254 item, slot 1 stores\n// quantity, and slot 2 uses a private coins stack only as an integer price token.\n// oc_cost is an interim native-r254 guide-price baseline for Phase 4 controls;\n// the authoritative 2009Scape price source remains a Phase 5 integration task.\n\n[proc,ge_offer_guide_price]()(int)\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return (1);\ndef_obj $item = inv_getobj(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT});\ndef_int $guide = oc_cost($item);\nif ($guide < 1) {\n    $guide = 1;\n}\nreturn ($guide);\n\n[proc,ge_offer_price_set](int $price)\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $clamped = $price;\nif ($clamped < 1) {\n    $clamped = 1;\n}\ninv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $clamped);\nif_settext(${GE_INTERFACE_NAME}:com_${PRICE_TEXT_COMPONENT}, append(append_num("", $clamped), " gp"));\n\n[if_button,${GE_INTERFACE_NAME}:com_${DECREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($price <= 1) return;\n~ge_offer_price_set(sub($price, 1));\n\n[if_button,${GE_INTERFACE_NAME}:com_${INCREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($price <= 0) {\n    $price = ~ge_offer_guide_price;\n}\nif ($price >= ${MAX_PRICE}) return;\n~ge_offer_price_set(add($price, 1));\n\n[if_button,${GE_INTERFACE_NAME}:com_${MINIMUM_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $guide = ~ge_offer_guide_price;\ndef_int $delta = max(1, calc($guide / 20));\ndef_int $minimum = sub($guide, $delta);\nif ($minimum < 1) {\n    $minimum = 1;\n}\n~ge_offer_price_set($minimum);\n\n[if_button,${GE_INTERFACE_NAME}:com_${MARKET_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\n~ge_offer_price_set(~ge_offer_guide_price);\n\n[if_button,${GE_INTERFACE_NAME}:com_${MAXIMUM_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $guide = ~ge_offer_guide_price;\ndef_int $delta = max(1, calc($guide / 20));\nif ($guide > sub(${MAX_PRICE}, $delta)) {\n    ~ge_offer_price_set(${MAX_PRICE});\n    return;\n}\n~ge_offer_price_set(add($guide, $delta));\n\n[if_button,${GE_INTERFACE_NAME}:com_${EDIT_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\np_countdialog;\ndef_int $price = last_int;\nif ($price <= 0) return;\n~ge_offer_price_set($price);\n`;
}

function writePriceScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_price.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildPriceScript(), 'utf8');
}

function injectPriceScriptMappings(stagedContentDir: string) {
    const triggerNames = [
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
    patchPriceActions(stagedContentDir);
    widenSelectedItemState(stagedContentDir);
    patchSelectedItemPriceReset(stagedContentDir);
    writePriceScript(stagedContentDir);
    injectPriceScriptMappings(stagedContentDir);
}

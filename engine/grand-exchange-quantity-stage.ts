import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SEARCH_RESULTS_INV = 'ge_search_results';
const SELECTED_ITEM_INV = 'ge_selected_item';
const SELECTED_ITEM_SLOT = 0;
const QUANTITY_STATE_SLOT = 1;
const QUANTITY_STATE_OBJECT = 'coins';
const QUANTITY_TEXT_COMPONENT = 150;
const DECREASE_COMPONENT = 157;
const INCREASE_COMPONENT = 159;
const QUANTITY_PRESETS = [
    { componentId: 162, option: 'Offer 1', quantity: 1 },
    { componentId: 164, option: 'Offer 10', quantity: 10 },
    { componentId: 166, option: 'Offer 100', quantity: 100 },
    { componentId: 168, option: 'Offer 500', quantity: 500 },
] as const;
const EDIT_COMPONENT = 170;
const QUANTITY_BUTTON_TEXT_Y = 212;
const MAX_QUANTITY = 2147483647;

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
        throw new Error(`Grand Exchange quantity controls are missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function enableLayerAction(source: string, componentId: number, option: string) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    for (const required of ['type=layer', 'width=13', 'height=13', 'scroll=13']) {
        if (!block.includes(required)) {
            throw new Error(`Grand Exchange quantity action ${marker} no longer contains ${required}`);
        }
    }

    const hasButtonType = block.includes('buttontype=');
    const hasOption = block.includes('option=');
    if (hasButtonType || hasOption) {
        if (block.includes('buttontype=normal') && block.includes(`option=${option}`)) {
            return source;
        }
        throw new Error(`Grand Exchange quantity action ${marker} already has incompatible IF1 action metadata`);
    }

    const patched = block.replace('scroll=13', `scroll=13\nbuttontype=normal\noption=${option}`);
    return source.slice(0, start) + patched + source.slice(end);
}

function setButtonTextY(source: string, componentId: number) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    if (!block.includes('type=text')) {
        throw new Error(`Grand Exchange quantity button ${marker} is no longer an IF1 text component`);
    }

    const yMatch = block.match(/^y=(\d+)$/m);
    if (!yMatch) {
        throw new Error(`Grand Exchange quantity button ${marker} no longer exposes a y position`);
    }

    const currentY = Number.parseInt(yMatch[1], 10);
    if (currentY === QUANTITY_BUTTON_TEXT_Y) return source;
    if (currentY !== 205) {
        throw new Error(`Grand Exchange quantity button ${marker} expected frozen y=205, found y=${currentY}`);
    }

    const patched = block.replace(/^y=\d+$/m, `y=${QUANTITY_BUTTON_TEXT_Y}`);
    return source.slice(0, start) + patched + source.slice(end);
}

function patchQuantityActions(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange quantity interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    source = enableLayerAction(source, DECREASE_COMPONENT, 'Decrease Quantity');
    source = enableLayerAction(source, INCREASE_COMPONENT, 'Increase Quantity');

    const quantityText = getComponentBlock(source, QUANTITY_TEXT_COMPONENT).block;
    if (!quantityText.includes('type=text') || !quantityText.includes('text=1')) {
        throw new Error('Grand Exchange quantity display com_150 no longer matches the frozen group-105 default');
    }

    for (const preset of QUANTITY_PRESETS) {
        const block = getComponentBlock(source, preset.componentId).block;
        if (!block.includes('buttontype=normal') || !block.includes(`option=${preset.option}`)) {
            throw new Error(`Grand Exchange quantity preset com_${preset.componentId} no longer exposes ${preset.option}`);
        }
        source = setButtonTextY(source, preset.componentId);
    }

    const edit = getComponentBlock(source, EDIT_COMPONENT).block;
    if (!edit.includes('buttontype=normal') || !edit.includes('option=Edit Quantity')) {
        throw new Error('Grand Exchange quantity numeric-input action com_170 no longer exposes Edit Quantity');
    }
    source = setButtonTextY(source, EDIT_COMPONENT);

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchSelectedItemReset(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange quantity state requires the generated item-search script: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const selectionMarker = '[proc,ge_item_search_apply_selection]';
    const start = source.indexOf(selectionMarker);
    if (start === -1) {
        throw new Error('Grand Exchange quantity state cannot find the item-search selection proc');
    }
    const next = source.indexOf('\n[', start + selectionMarker.length);
    const end = next === -1 ? source.length : next;
    let block = source.slice(start, end);

    const selectedItemMove = `inv_moveitem(${SEARCH_RESULTS_INV}, ${SELECTED_ITEM_INV}, $item, 1);`;
    if (!block.includes(selectedItemMove)) {
        throw new Error('Grand Exchange quantity state requires the selected runtime item to be moved into ge_selected_item');
    }

    const quantityReset = `inv_setslot(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT}, ${QUANTITY_STATE_OBJECT}, 1);`;
    if (!block.includes(quantityReset)) {
        block = block.replace(selectedItemMove, `${selectedItemMove}\n${quantityReset}`);
    }

    const textReset = `if_settext(${GE_INTERFACE_NAME}:com_${QUANTITY_TEXT_COMPONENT}, "1");`;
    if (!block.includes(textReset)) {
        block = block.replace(quantityReset, `${quantityReset}\n${textReset}`);
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildQuantityScript() {
    const presetHandlers = QUANTITY_PRESETS.map(preset => `[if_button,${GE_INTERFACE_NAME}:com_${preset.componentId}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\n~ge_offer_quantity_set(${preset.quantity});\n`).join('\n');

    return `// Option-2-only server-authoritative quantity state for group 105.\n// ge_selected_item slot 0 stores the selected native-r254 item. Slot 1 uses a\n// private coins stack only as an integer quantity token; this temp inventory is\n// never transmitted as player wealth and no player inventory is mutated here.\n\n[proc,ge_offer_quantity_set](int $quantity)\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $clamped = $quantity;\nif ($clamped < 1) {\n    $clamped = 1;\n}\ninv_setslot(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT}, ${QUANTITY_STATE_OBJECT}, $clamped);\nif_settext(${GE_INTERFACE_NAME}:com_${QUANTITY_TEXT_COMPONENT}, append_num("", $clamped));\n\n[if_button,${GE_INTERFACE_NAME}:com_${DECREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $quantity = inv_getnum(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT});\nif ($quantity <= 1) return;\n~ge_offer_quantity_set(sub($quantity, 1));\n\n[if_button,${GE_INTERFACE_NAME}:com_${INCREASE_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\ndef_int $quantity = inv_getnum(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT});\nif ($quantity <= 0 | $quantity >= ${MAX_QUANTITY}) return;\n~ge_offer_quantity_set(add($quantity, 1));\n\n${presetHandlers}\n[if_button,${GE_INTERFACE_NAME}:com_${EDIT_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) return;\np_countdialog;\ndef_int $quantity = last_int;\nif ($quantity <= 0) return;\n~ge_offer_quantity_set($quantity);\n`;
}

function writeQuantityScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_quantity.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildQuantityScript(), 'utf8');
}

function injectQuantityScriptMappings(stagedContentDir: string) {
    const triggerNames = [
        '[proc,ge_offer_quantity_set]',
        `[if_button,${GE_INTERFACE_NAME}:com_${DECREASE_COMPONENT}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${INCREASE_COMPONENT}]`,
        ...QUANTITY_PRESETS.map(preset => `[if_button,${GE_INTERFACE_NAME}:com_${preset.componentId}]`),
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

export function prepareGrandExchangeQuantityStage(stagedContentDir: string) {
    patchQuantityActions(stagedContentDir);
    patchSelectedItemReset(stagedContentDir);
    writeQuantityScript(stagedContentDir);
    injectQuantityScriptMappings(stagedContentDir);
}

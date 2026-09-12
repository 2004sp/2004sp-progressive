import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_INTERFACE_NAME = 'grand_exchange_sell_inventory';
const SELECTED_ITEM_INV = 'ge_selected_item';
const OFFER_CONTEXT_INV = 'ge_offer_context';
const OFFER_SUBMISSION_INV = 'ge_offer_submission';
const OFFER_CONTEXT_INV_ID = 166;
const OFFER_SUBMISSION_INV_ID = 167;
const SELECTED_ITEM_SLOT = 0;
const QUANTITY_STATE_SLOT = 1;
const PRICE_STATE_SLOT = 2;
const CONTEXT_MODE_SLOT = 0;
const CONTEXT_OFFER_SLOT = 1;
const CONTEXT_SOURCE_ITEM_SLOT = 2;
const SUBMISSION_ITEM_SLOT = 0;
const SUBMISSION_PRICE_SLOT = 1;
const SUBMISSION_TOTAL_SLOT = 2;
const BUY_MODE = 1;
const SELL_MODE = 2;
const CONFIRM_COMPONENT = 191;
const MAX_INT = 2147483647;

const BUY_ACTIONS = [
    { componentId: 30, slot: 1 },
    { componentId: 46, slot: 2 },
    { componentId: 62, slot: 3 },
    { componentId: 81, slot: 4 },
    { componentId: 100, slot: 5 },
    { componentId: 119, slot: 6 },
] as const;

const SELL_ACTIONS = [
    { componentId: 31, slot: 1 },
    { componentId: 47, slot: 2 },
    { componentId: 63, slot: 3 },
    { componentId: 82, slot: 4 },
    { componentId: 101, slot: 5 },
    { componentId: 120, slot: 6 },
] as const;

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
    if (start === -1) {
        throw new Error(`Grand Exchange offer submission is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange offer submission is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchConfirmButton(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange offer submission interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const { start, end, block } = getComponentBlock(source, CONFIRM_COMPONENT);

    for (const required of [
        'layer=com_156',
        'type=text',
        'x=200',
        'y=270',
        'width=120',
        'height=43',
        'text=Confirm Offer',
    ]) {
        if (!block.includes(required)) {
            throw new Error(`Grand Exchange Confirm Offer ${required} no longer matches frozen group 105`);
        }
    }

    if (!block.includes('buttontype=')) {
        const patched = block.replace('type=text', 'buttontype=normal\noption=Confirm Offer\ntype=text');
        source = source.slice(0, start) + patched + source.slice(end);
    } else if (!block.includes('buttontype=normal') || !block.includes('option=Confirm Offer')) {
        throw new Error('Grand Exchange Confirm Offer already has incompatible IF1 action metadata');
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function writeOfferStateInventoryConfig(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_offer_submission.inv'
    );
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
        configPath,
        `// Option-2-only session state for Confirm Offer. These containers are\n// deliberately temporary: the authoritative persistent GE economy remains a\n// later phase, so confirmation must not move or reserve player wealth yet.\n\n[${OFFER_CONTEXT_INV}]\nscope=temp\nsize=3\nstackall=yes\n\n[${OFFER_SUBMISSION_INV}]\nscope=temp\nsize=3\nstackall=yes\n`,
        'utf8'
    );
}

function injectOfferStateInventoryMappings(stagedContentDir: string) {
    appendPackMappings(
        path.join(stagedContentDir, 'pack', 'inv.pack'),
        new Map([
            [OFFER_CONTEXT_INV_ID, OFFER_CONTEXT_INV],
            [OFFER_SUBMISSION_INV_ID, OFFER_SUBMISSION_INV],
        ]),
        'Grand Exchange offer-submission inventory'
    );
}

function patchOfferContext(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange offer submission overview script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const action of BUY_ACTIONS) {
        const marker = `[if_button,${GE_INTERFACE_NAME}:com_${action.componentId}]`;
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        const open = '~ge_open_buy_offer_setup;';
        if (!block.includes(open)) {
            throw new Error(`Grand Exchange Buy com_${action.componentId} no longer opens the Buy Offer setup`);
        }

        const context = [
            `inv_clear(${OFFER_CONTEXT_INV});`,
            `inv_clear(${OFFER_SUBMISSION_INV});`,
            `inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_MODE_SLOT}, coins, ${BUY_MODE});`,
            `inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_OFFER_SLOT}, coins, ${action.slot});`,
        ].join('\n');
        if (!block.includes(`inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_OFFER_SLOT}, coins, ${action.slot});`)) {
            block = block.replace(open, `${context}\n${open}`);
        }
        source = source.slice(0, start) + block + source.slice(end);
    }

    for (const action of SELL_ACTIONS) {
        const marker = `[if_button,${GE_INTERFACE_NAME}:com_${action.componentId}]`;
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        const open = '~ge_open_sell_offer_setup;';
        if (!block.includes(open)) {
            throw new Error(`Grand Exchange Sell com_${action.componentId} no longer opens the Sell Offer setup`);
        }

        const context = [
            `inv_clear(${OFFER_CONTEXT_INV});`,
            `inv_clear(${OFFER_SUBMISSION_INV});`,
            `inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_MODE_SLOT}, coins, ${SELL_MODE});`,
            `inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_OFFER_SLOT}, coins, ${action.slot});`,
        ].join('\n');
        if (!block.includes(`inv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_OFFER_SLOT}, coins, ${action.slot});`)) {
            block = block.replace(open, `${context}\n${open}`);
        }
        source = source.slice(0, start) + block + source.slice(end);
    }

    {
        const marker = '[proc,ge_return_to_offer_summary]';
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        const selectedClear = `inv_clear(${SELECTED_ITEM_INV});`;
        const cleanup = `${selectedClear}\ninv_clear(${OFFER_CONTEXT_INV});\ninv_clear(${OFFER_SUBMISSION_INV});`;
        if (block.includes(selectedClear) && !block.includes(`inv_clear(${OFFER_CONTEXT_INV});`)) {
            block = block.replace(selectedClear, cleanup);
        } else if (!block.includes(selectedClear)) {
            throw new Error('Grand Exchange Back flow no longer clears selected-item state');
        }
        source = source.slice(0, start) + block + source.slice(end);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function patchSellSourceItemContext(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_sell_item_selection.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange offer submission sell-selection script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = `[inv_button1,${SELL_INTERFACE_NAME}:inv]`;
    const { start, end, block: originalBlock } = getScriptBlock(source, marker);
    let block = originalBlock;
    const oldSelection = `def_obj $item = oc_uncert(inv_getobj(inv, $slot));\n~ge_sell_apply_selection($item, $quantity);`;
    const newSelection = `def_obj $source_item = inv_getobj(inv, $slot);\ndef_obj $item = oc_uncert($source_item);\ninv_setslot(${OFFER_CONTEXT_INV}, ${CONTEXT_SOURCE_ITEM_SLOT}, $source_item, 1);\n~ge_sell_apply_selection($item, $quantity);`;

    if (!block.includes(newSelection)) {
        if (!block.includes(oldSelection)) {
            throw new Error('Grand Exchange sell-item selection no longer matches the expected source-item normalization flow');
        }
        block = block.replace(oldSelection, newSelection);
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildOfferSubmissionScript() {
    return `// Option-2-only Confirm Offer transaction boundary. This milestone\n// validates and snapshots the submission intent server-side, but deliberately\n// does not reserve wealth, match offers or persist state. Those operations need\n// the later authoritative GE service so logout/restart paths cannot lose wealth.\n\n[if_button,${GE_INTERFACE_NAME}:com_${CONFIRM_COMPONENT}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${OFFER_SUBMISSION_INV}, ${SUBMISSION_ITEM_SLOT}) > 0) return;\ndef_int $mode = inv_getnum(${OFFER_CONTEXT_INV}, ${CONTEXT_MODE_SLOT});\ndef_int $offer_slot = inv_getnum(${OFFER_CONTEXT_INV}, ${CONTEXT_OFFER_SLOT});\nif (($mode ! ${BUY_MODE} & $mode ! ${SELL_MODE}) | $offer_slot < 1 | $offer_slot > 6) return;\nif (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) {\n    mes("Choose an item before confirming your offer.");\n    return;\n}\ndef_obj $item = inv_getobj(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT});\ndef_int $quantity = inv_getnum(${SELECTED_ITEM_INV}, ${QUANTITY_STATE_SLOT});\ndef_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});\nif ($item = coins | oc_uncert($item) ! $item | oc_tradeable($item) = false) {\n    mes("You can't exchange this item on the Grand Exchange.");\n    return;\n}\nif (map_members = ^false & oc_members($item) = true) {\n    mes("You can't exchange this item on a free world.");\n    return;\n}\nif ($quantity <= 0 | $price <= 0) {\n    mes("Set a quantity and price before confirming your offer.");\n    return;\n}\nif ($price > calc(${MAX_INT} / $quantity)) {\n    mes("The total value of this offer is too large.");\n    return;\n}\ndef_int $total = calc($quantity * $price);\nif ($mode = ${BUY_MODE}) {\n    if (inv_total(inv, coins) < $total) {\n        mes("You do not have enough coins for this offer.");\n        return;\n    }\n} else {\n    def_obj $source_item = $item;\n    if (inv_getnum(${OFFER_CONTEXT_INV}, ${CONTEXT_SOURCE_ITEM_SLOT}) > 0) {\n        $source_item = inv_getobj(${OFFER_CONTEXT_INV}, ${CONTEXT_SOURCE_ITEM_SLOT});\n    }\n    if (oc_uncert($source_item) ! $item | inv_total(inv, $source_item) < $quantity) {\n        mes("You do not have enough of this item for this offer.");\n        return;\n    }\n}\ninv_clear(${OFFER_SUBMISSION_INV});\ninv_setslot(${OFFER_SUBMISSION_INV}, ${SUBMISSION_ITEM_SLOT}, $item, $quantity);\ninv_setslot(${OFFER_SUBMISSION_INV}, ${SUBMISSION_PRICE_SLOT}, coins, $price);\ninv_setslot(${OFFER_SUBMISSION_INV}, ${SUBMISSION_TOTAL_SLOT}, coins, $total);\nif_settext(${GE_INTERFACE_NAME}:com_133, "Offer Submitted");\nif_settext(${GE_INTERFACE_NAME}:com_142, "Your offer passed validation. Matching is not enabled yet.");\nif_sethide(${GE_INTERFACE_NAME}:com_156, true);\n`;
}

function writeOfferSubmissionScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_offer_submission.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildOfferSubmissionScript(), 'utf8');
}

function injectOfferSubmissionScriptMapping(stagedContentDir: string) {
    const triggerName = `[if_button,${GE_INTERFACE_NAME}:com_${CONFIRM_COMPONENT}]`;
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    if ([...values.values()].includes(triggerName)) return;

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

export function prepareGrandExchangeOfferSubmitStage(stagedContentDir: string) {
    patchConfirmButton(stagedContentDir);
    writeOfferStateInventoryConfig(stagedContentDir);
    injectOfferStateInventoryMappings(stagedContentDir);
    patchOfferContext(stagedContentDir);
    patchSellSourceItemContext(stagedContentDir);
    writeOfferSubmissionScript(stagedContentDir);
    injectOfferSubmissionScriptMapping(stagedContentDir);
}

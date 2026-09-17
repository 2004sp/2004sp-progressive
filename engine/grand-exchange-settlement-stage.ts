import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const OFFER_SUBMISSION_INV = 'ge_offer_submission';
const OFFER_CONTEXT_INV = 'ge_offer_context';
const ACTIVE_VIEW_INV = 'ge_active_offer_view';
const ACTIVE_MODE_SLOT = 1;
const ACTIVE_QUANTITY_SLOT = 2;
const ACTIVE_PRICE_SLOT = 3;
const ACTIVE_TOTAL_SLOT = 4;
const ACTIVE_STATE_SLOT = 5;
const ACTIVE_FILLED_SLOT = 6;
const CONTEXT_SOURCE_INV_SLOT = 2;
const INVENTORY_SIZE = 28;
const BUY_MODE = 1;
const SELL_MODE = 2;
const ACTIVE_STATE = 1;
const COMPLETED_STATE = 3;
const COLLECTION_ITEM_COMPONENT = 209;
const COLLECTION_COIN_COMPONENT = 211;
const MAX_INT = 2147483647;

const OFFERS = [
    { active: 'ge_active_offer_1', collection: 'ge_collection_offer_0', slot: 1 },
    { active: 'ge_active_offer_2', collection: 'ge_collection_offer_1', slot: 2 },
    { active: 'ge_active_offer_3', collection: 'ge_collection_offer_2', slot: 3 },
    { active: 'ge_active_offer_4', collection: 'ge_collection_offer_3', slot: 4 },
    { active: 'ge_active_offer_5', collection: 'ge_collection_offer_4', slot: 5 },
    { active: 'ge_active_offer_6', collection: 'ge_collection_offer_5', slot: 6 }
] as const;

function scriptBlock(source: string, marker: string) {
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) throw new Error(`Grand Exchange settlement is missing trigger ${marker}`);
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchRuntimeObjectInventoryWrites(stagedContentDir: string) {
    const enginePath = path.join(stagedContentDir, 'scripts', 'engine.rs2');
    let source = fs.readFileSync(enginePath, 'utf8').replace(/\r/g, '');
    const declaration = '[command,inv_add](inv $inv, namedobj $obj, int $count)';
    const runtimeDeclaration = '[command,inv_add](inv $inv, obj $obj, int $count)';
    if (!source.includes(runtimeDeclaration)) {
        if (!source.includes(declaration)) {
            throw new Error('Grand Exchange settlement cannot find the inv_add command declaration');
        }
        source = source.replace(declaration, runtimeDeclaration);
    }
    fs.writeFileSync(enginePath, source, 'utf8');
}

function settlementBranch(offer: (typeof OFFERS)[number], index: number) {
    const prefix = index === 0 ? 'if' : 'else if';
    return `${prefix} ($offer_slot = ${offer.slot}) {
    if (inv_getobj(${offer.collection}, 0) ! null | inv_getobj(${offer.collection}, 1) ! null) {
        mes("Collect your previous offer before using this slot again.");
        return;
    }
    if ($price = $execution_price) {
        if (ge_history_set_status(${offer.slot}, ${COMPLETED_STATE}) = false) {
            mes("Your Grand Exchange offer could not be completed. Please try again.");
            return;
        }
        inv_clear(${offer.active});
        inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.active}, $item, 1);
        inv_setslot(${offer.active}, ${ACTIVE_MODE_SLOT}, coins, $mode);
        inv_setslot(${offer.active}, ${ACTIVE_QUANTITY_SLOT}, coins, $quantity);
        inv_setslot(${offer.active}, ${ACTIVE_PRICE_SLOT}, coins, $price);
        inv_setslot(${offer.active}, ${ACTIVE_TOTAL_SLOT}, coins, $total);
        inv_setslot(${offer.active}, ${ACTIVE_STATE_SLOT}, coins, ${COMPLETED_STATE});
        inv_setslot(${offer.active}, ${ACTIVE_FILLED_SLOT}, coins, $quantity);
        if ($mode = ${BUY_MODE}) {
            inv_del(inv, coins, $total);
            inv_add(${offer.collection}, $item, $quantity);
        } else {
            inv_del(inv, $settlement_item, $quantity);
            inv_add(${offer.collection}, coins, $total);
        }
    } else {
        // Synthetic liquidity exists only at the exact guide/default price.
        // Any lower or higher limit remains a normal pending offer forever
        // (until the player cancels it) and does not reserve or move wealth.
        inv_clear(${offer.active});
        inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.active}, $item, 1);
        inv_setslot(${offer.active}, ${ACTIVE_MODE_SLOT}, coins, $mode);
        inv_setslot(${offer.active}, ${ACTIVE_QUANTITY_SLOT}, coins, $quantity);
        inv_setslot(${offer.active}, ${ACTIVE_PRICE_SLOT}, coins, $price);
        inv_setslot(${offer.active}, ${ACTIVE_TOTAL_SLOT}, coins, $total);
        inv_setslot(${offer.active}, ${ACTIVE_STATE_SLOT}, coins, ${ACTIVE_STATE});
    }
}`;
}

function patchSubmission(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_offer_submission.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const current = scriptBlock(source, `[if_button,${GE_INTERFACE_NAME}:com_190]`);
    let block = current.block;

    // There is not yet a persisted player-to-player order book in the backport.
    // The server-side guide/default price is therefore the only synthetic
    // liquidity point. Prices above or below it are valid limit offers, but they
    // remain pending rather than manufacturing items or coins without a match.
    const historyRecord = 'if (ge_history_record($offer_slot, $item, $mode, $quantity, $price) = false) {';
    const sellSourceGuard = `def_obj $settlement_item = $item;
if ($mode = ${SELL_MODE}) {
    def_int $settlement_source_slot_token = inv_getnum(${OFFER_CONTEXT_INV}, ${CONTEXT_SOURCE_INV_SLOT});
    if ($settlement_source_slot_token <= 0) {
        mes("Select the item from your inventory again before confirming.");
        return;
    }
    def_int $settlement_source_slot = sub($settlement_source_slot_token, 1);
    if ($settlement_source_slot < 0 | $settlement_source_slot >= ${INVENTORY_SIZE} | inv_getnum(inv, $settlement_source_slot) <= 0) {
        mes("Select the item from your inventory again before confirming.");
        return;
    }
    $settlement_item = inv_getobj(inv, $settlement_source_slot);
    if (oc_uncert($settlement_item) ! $item | inv_total(inv, $settlement_item) < $quantity) {
        mes("You do not have enough of this item for this offer.");
        return;
    }
}`;
    const guidePriceGuard = `def_int $execution_price = ~ge_offer_nostalgia_price($item);
if ($execution_price < 1) {
    $execution_price = oc_cost($item);
}
if ($execution_price < 1) {
    $execution_price = 1;
}
if ($execution_price > calc(${MAX_INT} / $quantity)) {
    mes("The default-price total for this offer is too large.");
    return;
}`;
    if (!block.includes(guidePriceGuard)) {
        if (!block.includes(historyRecord)) {
            throw new Error('Grand Exchange settlement cannot find the persisted-history commit boundary');
        }
        block = block.replace(historyRecord, `${guidePriceGuard}\n${historyRecord}`);
    }
    if (!block.includes(sellSourceGuard)) {
        if (!block.includes(historyRecord)) {
            throw new Error('Grand Exchange settlement cannot find the sell-source commit boundary');
        }
        block = block.replace(historyRecord, `${sellSourceGuard}\n${historyRecord}`);
    }

    const oldBranches = OFFERS.map(
        (offer, index) =>
            `${index === 0 ? 'if' : 'else if'} ($offer_slot = ${offer.slot}) {\n    inv_clear(${offer.active});\n    inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.active}, $item, 1);\n    inv_setslot(${offer.active}, 1, coins, $mode);\n    inv_setslot(${offer.active}, 2, coins, $quantity);\n    inv_setslot(${offer.active}, 3, coins, $price);\n    inv_setslot(${offer.active}, 4, coins, $total);\n    inv_setslot(${offer.active}, 5, coins, 1);\n}`
    ).join('\n');
    if (!block.includes(oldBranches)) {
        throw new Error('Grand Exchange settlement cannot find the active-offer commit branches');
    }

    block = block.replace(oldBranches, OFFERS.map(settlementBranch).join('\n'));
    source = source.slice(0, current.start) + block + source.slice(current.end);
    fs.writeFileSync(file, source, 'utf8');
}

function patchCollectionCleanup(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_collection.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const offer of OFFERS) {
        const marker = `[proc,ge_collection_refresh_offer_${offer.slot - 1}]`;
        const current = scriptBlock(source, marker);
        const empty = `if (inv_getobj(${offer.collection}, 0) = null & inv_getobj(${offer.collection}, 1) = null) {`;
        const clear = `    if (inv_getnum(${offer.active}, ${ACTIVE_STATE_SLOT}) = ${COMPLETED_STATE}) {\n        inv_clear(${offer.active});\n    }`;
        if (!current.block.includes(empty)) {
            throw new Error(`Grand Exchange settlement cannot find the collection empty check for slot ${offer.slot}`);
        }
        const block = current.block.includes(clear) ? current.block : current.block.replace(empty, `${empty}\n${clear}`);
        source = source.slice(0, current.start) + block + source.slice(current.end);
    }

    fs.writeFileSync(file, source, 'utf8');
}

function componentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Grand Exchange settlement is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchDetailCollectionButtons(stagedContentDir: string) {
    const interfaceFile = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    let interfaceSource = fs.readFileSync(interfaceFile, 'utf8').replace(/\r/g, '');
    for (const componentId of [COLLECTION_ITEM_COMPONENT, COLLECTION_COIN_COMPONENT]) {
        const current = componentBlock(interfaceSource, componentId);
        let block = current.block;
        if (!block.includes('type=model')) {
            throw new Error(`Grand Exchange settlement collection com_${componentId} is no longer a model`);
        }
        if (!block.includes('buttontype=normal')) {
            block = block.replace('type=model\n', 'type=model\nbuttontype=normal\noption=Collect\n');
        }
        interfaceSource = interfaceSource.slice(0, current.start) + block + interfaceSource.slice(current.end);
    }
    fs.writeFileSync(interfaceFile, interfaceSource, 'utf8');

    const scriptFile = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2');
    let scriptSource = fs.readFileSync(scriptFile, 'utf8').replace(/\r/g, '');
    const buildHandler = (componentId: number, mode: number) => {
        const branches = OFFERS.map(
            (offer, index) => `${index === 0 ? 'if' : 'else if'} ($offer_slot = ${offer.slot}) {
    if (inv_getnum(${offer.active}, ${ACTIVE_MODE_SLOT}) ! ${mode}) return;
    ~ge_collection_collect_slot(${offer.collection}, 0);
    if (inv_getobj(${offer.collection}, 0) ! null) {
        mes("You don't have enough inventory space.");
    }
    ~ge_collection_refresh_offer_${offer.slot - 1};
    ~ge_open_active_offer_${offer.slot};
}`
        ).join('\n');
        return `[if_button,${GE_INTERFACE_NAME}:com_${componentId}]
if (map_feature("grandexchange") = false) return;
def_int $offer_slot = inv_getnum(${ACTIVE_VIEW_INV}, 0);
if ($offer_slot < 1 | $offer_slot > 6) return;
${branches}
`;
    };
    if (!scriptSource.includes(`[if_button,${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_COMPONENT}]`)) {
        scriptSource = scriptSource.trimEnd() + '\n\n' + buildHandler(COLLECTION_ITEM_COMPONENT, BUY_MODE) + '\n' + buildHandler(COLLECTION_COIN_COMPONENT, SELL_MODE);
    }
    fs.writeFileSync(scriptFile, scriptSource, 'utf8');

    const packFile = path.join(stagedContentDir, 'pack', 'script.pack');
    let packSource = fs.readFileSync(packFile, 'utf8').replace(/\r/g, '');
    const lines = packSource.split('\n').filter(Boolean);
    const names = new Set(lines.map(line => line.slice(line.indexOf('=') + 1)));
    let maxId = Math.max(-1, ...lines.map(line => Number.parseInt(line.slice(0, line.indexOf('=')), 10)).filter(Number.isInteger));
    const triggers = [
        ...[COLLECTION_ITEM_COMPONENT, COLLECTION_COIN_COMPONENT].map(componentId => `[if_button,${GE_INTERFACE_NAME}:com_${componentId}]`),
        '[proc,ge_open_collection_box]',
        '[if_close,grand_exchange_group_109]',
        '[opnpc2,grand_exchange_clerk]'
    ];
    for (const trigger of triggers) {
        if (!names.has(trigger)) {
            lines.push(`${++maxId}=${trigger}`);
            names.add(trigger);
        }
    }
    packSource = lines.join('\n') + '\n';
    fs.writeFileSync(packFile, packSource, 'utf8');
}

function validate(stagedContentDir: string) {
    const submission = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_offer_submission.rs2'), 'utf8').replace(/\r/g, '');
    const collection = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_collection.rs2'), 'utf8').replace(/\r/g, '');
    const overview = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2'), 'utf8').replace(/\r/g, '');

    for (const required of [
        'def_int $execution_price = ~ge_offer_nostalgia_price($item);',
        `if ($execution_price > calc(${MAX_INT} / $quantity)) {`,
        'if ($price = $execution_price) {',
        `def_obj $settlement_item = $item;`,
        `$settlement_item = inv_getobj(inv, $settlement_source_slot);`,
        `inv_setslot(${OFFERS[0].active}, ${ACTIVE_STATE_SLOT}, coins, ${ACTIVE_STATE});`,
        `inv_setslot(${OFFERS[0].active}, ${ACTIVE_STATE_SLOT}, coins, ${COMPLETED_STATE});`,
    ]) {
        if (!submission.includes(required)) {
            throw new Error(`Grand Exchange settlement pricing is missing ${required}`);
        }
    }
    for (const forbidden of [
        `if ($mode = ${BUY_MODE} & $price < $execution_price) {`,
        `if ($mode = ${SELL_MODE} & $price > $execution_price) {`,
        '$price = $execution_price;',
    ]) {
        if (submission.includes(forbidden)) {
            throw new Error(`Grand Exchange settlement must not reject or rewrite non-default limit prices: ${forbidden}`);
        }
    }

    for (const offer of OFFERS) {
        for (const required of [
            'inv_del(inv, coins, $total);',
            `inv_add(${offer.collection}, $item, $quantity);`,
            'inv_del(inv, $settlement_item, $quantity);',
            `inv_add(${offer.collection}, coins, $total);`,
            `inv_setslot(${offer.active}, ${ACTIVE_STATE_SLOT}, coins, ${COMPLETED_STATE});`,
            `inv_setslot(${offer.active}, ${ACTIVE_STATE_SLOT}, coins, ${ACTIVE_STATE});`,
            `inv_setslot(${offer.active}, ${ACTIVE_FILLED_SLOT}, coins, $quantity);`
        ]) {
            if (!submission.includes(required)) {
                throw new Error(`Grand Exchange settlement for slot ${offer.slot} is missing ${required}`);
            }
        }
        if (!collection.includes(`inv_clear(${offer.active});`)) {
            throw new Error(`Grand Exchange collection cleanup for slot ${offer.slot} is missing`);
        }
    }
    if (!collection.includes('mes("You don't have enough inventory space.");')) {
        throw new Error('Grand Exchange Collection Box is missing the inventory-space warning');
    }
    if (!collection.includes('[if_close,grand_exchange_group_109]')) {
        throw new Error('Grand Exchange Collection Box is missing its inventory-listener cleanup trigger');
    }
    for (const componentId of [COLLECTION_ITEM_COMPONENT, COLLECTION_COIN_COMPONENT]) {
        if (!overview.includes(`[if_button,${GE_INTERFACE_NAME}:com_${componentId}]`)) {
            throw new Error(`Grand Exchange detail collection handler com_${componentId} is missing`);
        }
    }
}

export function prepareGrandExchangeSettlementStage(stagedContentDir: string) {
    patchRuntimeObjectInventoryWrites(stagedContentDir);
    patchSubmission(stagedContentDir);
    patchCollectionCleanup(stagedContentDir);
    patchDetailCollectionButtons(stagedContentDir);
    validate(stagedContentDir);
}

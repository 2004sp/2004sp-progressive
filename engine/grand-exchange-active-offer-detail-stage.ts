import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const VIEW_INV = 'ge_active_offer_view';
const VIEW_INV_ID = 174;
const ACTIVE_ITEM_SLOT = 0;
const ACTIVE_MODE_SLOT = 1;
const ACTIVE_QUANTITY_SLOT = 2;
const ACTIVE_PRICE_SLOT = 3;
const ACTIVE_TOTAL_SLOT = 4;
const ACTIVE_STATE_SLOT = 5;
const ACTIVE_FILLED_SLOT = 6;
const BUY_MODE = 1;
const ACTIVE_STATE = 1;
const PARTIAL_STATE = 2;
const COMPLETED_STATE = 3;
const CANCELLED_STATE = 4;
const DETAIL_ROOT = 200;
const DETAIL_TEXT = 201;
const PROGRESS_BACKGROUND = 202;
const ABORT_BUTTON = 203;
const PROGRESS_CLIP = 212;
const PROGRESS_FILL = 213;
const COLLECTION_FRAME_COMPONENTS = [204, 205, 206, 207, 208, 210] as const;
const COLLECTION_ITEM_MODEL = 209;
const COLLECTION_COIN_MODEL = 211;
const COLLECTION_ITEM_AMOUNT = 304;
const COLLECTION_COIN_AMOUNT = 305;
const PROGRESS_EMPTY_COLOUR = '0x302520';
const PROGRESS_EMPTY_TRANSPARENCY = 100;
const PROGRESS_ACTIVE_COLOUR = '0xC68B01';
const PROGRESS_COMPLETE_COLOUR = '0x3F821E';
const PROGRESS_ABORTED_COLOUR = '0x8A0010';

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, view: 280 },
    { name: 'ge_active_offer_2', slot: 2, view: 281 },
    { name: 'ge_active_offer_3', slot: 3, view: 282 },
    { name: 'ge_active_offer_4', slot: 4, view: 283 },
    { name: 'ge_active_offer_5', slot: 5, view: 284 },
    { name: 'ge_active_offer_6', slot: 6, view: 285 },
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

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) throw new Error(`Grand Exchange active-offer detail is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function replaceComponent(source: string, componentId: number, replacement: string) {
    const { start, end } = getComponentBlock(source, componentId);
    return source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

function getScriptBlock(source: string, marker: string) {
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) throw new Error(`Grand Exchange active-offer detail is missing trigger ${marker}`);
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchAction(source: string, componentId: number, type: 'model' | 'text') {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    if (!block.includes(`type=${type}`)) {
        throw new Error(`Grand Exchange active-offer view action ${marker} no longer has type=${type}`);
    }
    if (block.includes('buttontype=') || block.includes('option=')) {
        if (block.includes('buttontype=normal') && block.includes('option=View Offer')) return source;
        throw new Error(`Grand Exchange active-offer view action ${marker} already has incompatible button metadata`);
    }
    const patched = block.replace(`type=${type}`, `buttontype=normal\noption=View Offer\ntype=${type}`);
    return source.slice(0, start) + patched + source.slice(end);
}

function patchDetailInterface(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        // The whole occupied 140x110 slot owns View Offer input; small child widgets stay presentation-only.
        void offer;
    }

    const progress = getComponentBlock(source, PROGRESS_BACKGROUND);
    for (const required of [
        `layer=com_${DETAIL_ROOT}`,
        'type=layer',
        'x=70',
        'y=299',
        'width=300',
        'height=15',
        'scroll=15',
    ]) {
        if (!progress.block.includes(required)) {
            throw new Error(`Grand Exchange active-offer progress host com_${PROGRESS_BACKGROUND} no longer contains ${required}`);
        }
    }
    source = replaceComponent(
        source,
        PROGRESS_BACKGROUND,
        `[com_${PROGRESS_BACKGROUND}]\nlayer=com_${DETAIL_ROOT}\ntype=rect\nx=70\ny=299\nwidth=300\nheight=15\ntrans=${PROGRESS_EMPTY_TRANSPARENCY}\nfill=yes\ncolour=${PROGRESS_EMPTY_COLOUR}\n`
    );

    const clip = getComponentBlock(source, PROGRESS_CLIP).block;
    const fill = getComponentBlock(source, PROGRESS_FILL).block;
    if (!clip.includes('type=layer') || !clip.includes('width=512') || !clip.includes('height=334')) {
        throw new Error(`Grand Exchange active-offer progress clip com_${PROGRESS_CLIP} no longer matches the unused frozen helper root`);
    }
    if (!fill.includes(`layer=com_${PROGRESS_CLIP}`) || !fill.includes('type=layer')) {
        throw new Error(`Grand Exchange active-offer progress fill com_${PROGRESS_FILL} no longer matches the unused frozen helper child`);
    }
    source = replaceComponent(
        source,
        PROGRESS_CLIP,
        `[com_${PROGRESS_CLIP}]\nlayer=com_${DETAIL_ROOT}\ntype=layer\nx=70\ny=299\nwidth=300\nheight=15\nscroll=15\n`
    );
    source = replaceComponent(
        source,
        PROGRESS_FILL,
        `[com_${PROGRESS_FILL}]\nlayer=com_${PROGRESS_CLIP}\ntype=rect\nx=0\ny=1\nwidth=300\nheight=13\nfill=yes\ncolour=${PROGRESS_ACTIVE_COLOUR}\n`
    );

    const status = getComponentBlock(source, DETAIL_TEXT).block;
    if (!status.includes(`layer=com_${DETAIL_ROOT}`) || !status.includes('type=text')) {
        throw new Error(`Grand Exchange active-offer status com_${DETAIL_TEXT} no longer matches the frozen submitted-detail text host`);
    }

    const abort = getComponentBlock(source, ABORT_BUTTON).block;
    if (!abort.includes('buttontype=normal') || !abort.includes('option=Abort Offer')) {
        throw new Error('Grand Exchange active-offer detail requires the frozen Abort Offer action');
    }

    // The frozen collection models are authored as clickable Collect buttons,
    // but this option-2 milestone does not yet reserve/move player wealth. Keep
    // the two output boxes presentation-only so clicking the displayed item or
    // coins cannot emit an unhandled if_button trigger (or manufacture wealth).
    // Preserve the interface-authored position and dimensions; only remove the
    // inactive action metadata and normalize the oversized model zoom.
    for (const componentId of [COLLECTION_ITEM_MODEL, COLLECTION_COIN_MODEL] as const) {
        const collection = getComponentBlock(source, componentId).block;
        for (const required of [
            `layer=com_${DETAIL_ROOT}`,
            'buttontype=normal',
            'option=Collect',
            'type=model',
            'width=36',
            'height=32',
            'zoom=600',
        ]) {
            if (!collection.includes(required)) {
                throw new Error(`Grand Exchange collection model com_${componentId} no longer contains ${required}`);
            }
        }
        const patchedCollection = collection
            .replace('buttontype=normal\n', '')
            .replace('option=Collect\n', '')
            .replace('zoom=600', 'zoom=100');
        source = replaceComponent(source, componentId, patchedCollection);
    }

    fs.writeFileSync(file, source, 'utf8');
}

function patchViewInventory(stagedContentDir: string) {
    const config = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'configs', 'grand_exchange_active_offer.inv');
    let source = fs.readFileSync(config, 'utf8').replace(/\r/g, '');
    if (!source.includes(`[${VIEW_INV}]`)) {
        source = source.trimEnd() + `\n\n// Currently inspected active offer; server-owned option-2 UI context only.\n[${VIEW_INV}]\nscope=temp\nsize=1\nstackall=yes\n`;
        fs.writeFileSync(config, source, 'utf8');
    }

    const pack = path.join(stagedContentDir, 'pack', 'inv.pack');
    const { content, values } = readPack(pack);
    const existingName = values.get(VIEW_INV_ID);
    if (existingName && existingName !== VIEW_INV) {
        throw new Error(`Grand Exchange active-offer view inventory ID ${VIEW_INV_ID} is already mapped to ${existingName}`);
    }
    for (const [id, name] of values) {
        if (name === VIEW_INV && id !== VIEW_INV_ID) {
            throw new Error(`Grand Exchange active-offer view inventory ${VIEW_INV} is already mapped to ${id}`);
        }
    }
    if (!existingName) {
        const normalized = content.endsWith('\n') ? content : `${content}\n`;
        fs.writeFileSync(pack, `${normalized}${VIEW_INV_ID}=${VIEW_INV}\n`, 'utf8');
    }
}

function buildOpenProc(offer: (typeof ACTIVE_OFFERS)[number]) {
    const showCollectionFrame = COLLECTION_FRAME_COMPONENTS.map(component => `if_sethide(${GE_INTERFACE_NAME}:com_${component}, false);`).join('\n');

    return `[proc,ge_open_active_offer_${offer.slot}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) <= 0) {\n    ~ge_return_to_offer_summary;\n    return;\n}\ninv_clear(${VIEW_INV});\ninv_setslot(${VIEW_INV}, 0, coins, ${offer.slot});\ndef_obj $item = inv_getobj(${offer.name}, ${ACTIVE_ITEM_SLOT});\ndef_int $mode = inv_getnum(${offer.name}, ${ACTIVE_MODE_SLOT});\ndef_int $quantity = inv_getnum(${offer.name}, ${ACTIVE_QUANTITY_SLOT});\ndef_int $price = inv_getnum(${offer.name}, ${ACTIVE_PRICE_SLOT});\ndef_int $total = inv_getnum(${offer.name}, ${ACTIVE_TOTAL_SLOT});\ndef_int $state = inv_getnum(${offer.name}, ${ACTIVE_STATE_SLOT});\ndef_int $filled = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});\ndef_int $remaining = calc($quantity - $filled);\ndef_int $filled_value = calc($filled * $price);\ndef_int $refund = calc($total - $filled_value);\nif ($remaining < 0) {\n    $remaining = 0;\n}\nif ($refund < 0) {\n    $refund = 0;\n}\ndef_int $progress_offset = -300;\nif ($quantity > 0 & $filled >= 0) {\n    $progress_offset = interpolate(-300, 0, 0, $quantity, $filled);\n}\nif_sethide(${GE_INTERFACE_NAME}:com_16, true);\n// Keep the shared setup/detail parent hidden until every dynamic field below\n// has been replaced. This prevents one rendered frame of the previously viewed\n// offer (description, item model, coins, etc.) leaking into the new offer.\nif_sethide(${GE_INTERFACE_NAME}:com_126, true);\n// com_200 is an independent root rather than a child of com_126, so hide it\n// immediately too. Putting both hides at the front keeps them inside the same\n// client packet-processing slice and prevents the previous collection icon from\n// surviving for one frame while the new offer is prepared.\nif_sethide(${GE_INTERFACE_NAME}:com_${DETAIL_ROOT}, true);\nif_sethide(${GE_INTERFACE_NAME}:com_156, true);\nif_sethide(${GE_INTERFACE_NAME}:com_192, true);\nif_sethide(${GE_INTERFACE_NAME}:com_197, true);\nif_sethide(${GE_INTERFACE_NAME}:com_${PROGRESS_CLIP}, false);\nif_sethide(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, false);\nif_setposition(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, $progress_offset, 0);\nif_setposition(${GE_INTERFACE_NAME}:com_138, 0, 0);\nif_sethide(${GE_INTERFACE_NAME}:com_138, false);\nif_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);\nif_settext(${GE_INTERFACE_NAME}:com_141, oc_name($item));\nif_settext(${GE_INTERFACE_NAME}:com_140, "<tostring($price)> gp");\nif_settext(${GE_INTERFACE_NAME}:com_145, "");\nif_settext(${GE_INTERFACE_NAME}:com_150, tostring($quantity));\n~ge_offer_price_value_render($price);\n~ge_offer_total_value_render($total);\n${showCollectionFrame}\nif_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, true);\nif_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, true);\nif_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, true);\nif_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, true);\nif_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, "");\nif_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, "");\nif ($mode = ${BUY_MODE}) {\n    if_settext(${GE_INTERFACE_NAME}:com_133, "Buy Offer");\n} else {\n    if_settext(${GE_INTERFACE_NAME}:com_133, "Sell Offer");\n}\nif ($state = ${ACTIVE_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, false);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, 0xB28A2E);\n    if ($mode = ${BUY_MODE}) {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Waiting for a seller to match your offer.");\n        if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Waiting to buy: <tostring($filled)>/<tostring($quantity)> filled");\n    } else {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Waiting for a buyer to match your offer.");\n        if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Waiting to sell: <tostring($filled)>/<tostring($quantity)> filled");\n    }\n} else if ($state = ${PARTIAL_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, false);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, 0xC69A28);\n    if ($mode = ${BUY_MODE}) {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Your buy offer has partially completed.");\n    } else {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Your sell offer has partially completed.");\n    }\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Progress: <tostring($filled)>/<tostring($quantity)> filled");\n} else if ($state = ${COMPLETED_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, 0x4A8A43);\n${showCollectionFrame}\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, true);\n    if ($mode = ${BUY_MODE}) {\n        if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, false);\n        if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, $item, 100);\n        if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, false);\n        if ($quantity > 1) {\n            if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, tostring($quantity));\n        } else {\n            if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, "");\n        }\n    } else {\n        if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, false);\n        if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, coins, 100);\n        if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, false);\n        if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, tostring($total));\n    }\n    if_settext(${GE_INTERFACE_NAME}:com_142, "Your offer has completed.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Complete: <tostring($quantity)>/<tostring($quantity)> filled");\n} else if ($state = ${CANCELLED_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, 0x8A403A);\n${showCollectionFrame}\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, true);\n    if ($mode = ${BUY_MODE}) {\n        if ($filled > 0) {\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, false);\n            if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, $item, 100);\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, false);\n            if ($filled > 1) {\n                if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, tostring($filled));\n            } else {\n                if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, "");\n            }\n        }\n        if ($refund > 0) {\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, false);\n            if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, coins, 100);\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, false);\n            if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, tostring($refund));\n        }\n    } else {\n        if ($remaining > 0) {\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, false);\n            if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, $item, 100);\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, false);\n            if ($remaining > 1) {\n                if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, tostring($remaining));\n            } else {\n                if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, "");\n            }\n        }\n        if ($filled_value > 0) {\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, false);\n            if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, coins, 100);\n            if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, false);\n            if_settext(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, tostring($filled_value));\n        }\n    }\n    if_settext(${GE_INTERFACE_NAME}:com_142, "Your offer has been cancelled.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Cancelled: <tostring($filled)>/<tostring($quantity)> filled");\n} else {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, 0x3B352C);\n    if_settext(${GE_INTERFACE_NAME}:com_142, "This offer is not in a displayable state.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "");\n}\n// Publish the fully prepared offer atomically. Both layers stayed hidden while\n// the new text/models/collection state were written, so no previous-offer frame\n// can be drawn while switching between Buy and Sell offers.\nif_sethide(${GE_INTERFACE_NAME}:com_126, false);\nif_sethide(${GE_INTERFACE_NAME}:com_${DETAIL_ROOT}, false);\n`;
}

function patchOverviewScript(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    const back = getScriptBlock(source, '[proc,ge_return_to_offer_summary]');
    if (!back.block.includes(`inv_clear(${VIEW_INV});`)) {
        const patched = back.block.trimEnd() + `\ninv_clear(${VIEW_INV});\n`;
        source = source.slice(0, back.start) + patched + source.slice(back.end);
    }

    if (!source.includes('[proc,ge_open_active_offer_1]')) {
        const procs = ACTIVE_OFFERS.map(buildOpenProc)
            .join('\n')
            .replaceAll('0xB28A2E', PROGRESS_ACTIVE_COLOUR)
            .replaceAll('0xC69A28', PROGRESS_ACTIVE_COLOUR)
            .replaceAll('0x4A8A43', PROGRESS_COMPLETE_COLOUR)
            .replaceAll('0x8A403A', PROGRESS_ABORTED_COLOUR)
            .replaceAll('0x3B352C', PROGRESS_EMPTY_COLOUR);
        const viewHandlers = ACTIVE_OFFERS.flatMap(offer => [offer.view].map(component => `[if_button,${GE_INTERFACE_NAME}:com_${component}]\n~ge_open_active_offer_${offer.slot};\n`)).join('\n');
        const abortBranches = ACTIVE_OFFERS.map((offer, index) => `${index === 0 ? 'if' : 'else if'} ($offer_slot = ${offer.slot}) {\n    ~ge_active_offer_apply_cancelled(${offer.slot});\n    ~ge_open_active_offer_${offer.slot};\n}`).join('\n');
        const abortHandler = `[if_button,${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}]\nif (map_feature("grandexchange") = false) return;\ndef_int $offer_slot = inv_getnum(${VIEW_INV}, 0);\nif ($offer_slot < 1 | $offer_slot > 6) return;\n${abortBranches}\n`;
        source = source.trimEnd() + `\n\n// r481-style submitted-offer detail. Occupied overview slots open the existing\n// group-105 submitted/collect layer; pending and partial offers expose Abort,\n// with the two authentic collection boxes always visible; models/amounts appear only when output exists.\n${procs}\n${viewHandlers}\n${abortHandler}`;
    }

    fs.writeFileSync(file, source, 'utf8');
}

function injectScriptMappings(stagedContentDir: string) {
    const triggers = [
        ...ACTIVE_OFFERS.map(offer => `[proc,ge_open_active_offer_${offer.slot}]`),
        ...ACTIVE_OFFERS.flatMap(offer => [offer.view].map(component => `[if_button,${GE_INTERFACE_NAME}:com_${component}]`)),
        `[if_button,${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}]`,
    ];
    const pack = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(pack);
    const existing = new Set(values.values());
    const additions: string[] = [];
    let maxId = Math.max(-1, ...values.keys());
    for (const trigger of triggers) {
        if (existing.has(trigger)) continue;
        maxId++;
        additions.push(`${maxId}=${trigger}`);
        existing.add(trigger);
    }
    if (additions.length) {
        const normalized = content.endsWith('\n') ? content : `${content}\n`;
        fs.writeFileSync(pack, normalized + additions.join('\n') + '\n', 'utf8');
    }
}

function validate(stagedContentDir: string) {
    const interfaceSource = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`), 'utf8').replace(/\r/g, '');
    const background = getComponentBlock(interfaceSource, PROGRESS_BACKGROUND).block;
    for (const required of ['type=rect', `trans=${PROGRESS_EMPTY_TRANSPARENCY}`, 'fill=yes', `colour=${PROGRESS_EMPTY_COLOUR}`]) {
        if (!background.includes(required)) throw new Error(`Grand Exchange active-offer progress background is missing ${required}`);
    }
    const clip = getComponentBlock(interfaceSource, PROGRESS_CLIP).block;
    for (const required of [`layer=com_${DETAIL_ROOT}`, 'type=layer', 'width=300', 'height=15', 'scroll=15']) {
        if (!clip.includes(required)) throw new Error(`Grand Exchange active-offer progress clip is missing ${required}`);
    }
    const fill = getComponentBlock(interfaceSource, PROGRESS_FILL).block;
    for (const required of [`layer=com_${PROGRESS_CLIP}`, 'type=rect', 'width=300', 'height=13', 'fill=yes']) {
        if (!fill.includes(required)) throw new Error(`Grand Exchange active-offer progress fill is missing ${required}`);
    }
    for (const offer of ACTIVE_OFFERS) {
        for (const component of [] as const) {
            const block = getComponentBlock(interfaceSource, component).block;
            if (!block.includes('buttontype=normal') || !block.includes('option=View Offer')) {
                throw new Error(`Grand Exchange active-offer slot ${offer.slot} view action is missing on com_${component}`);
            }
        }
    }

    const script = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2'), 'utf8').replace(/\r/g, '');
    for (const required of [
        '[proc,ge_open_active_offer_1]',
        `[if_button,${GE_INTERFACE_NAME}:com_${ACTIVE_OFFERS[0].view}]`,

        `[if_button,${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}]`,
        `if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_MODEL}, $item, 100);`,
        `if_setobject(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_MODEL}, coins, 100);`,
        `if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_ITEM_AMOUNT}, false);`,
        `if_sethide(${GE_INTERFACE_NAME}:com_${COLLECTION_COIN_AMOUNT}, false);`,
        'Waiting for a seller to match your offer.',
        'Waiting for a buyer to match your offer.',
        'interpolate(-300, 0, 0, $quantity, $filled)',
        `if_setposition(${GE_INTERFACE_NAME}:com_${PROGRESS_FILL}, $progress_offset, 0);`,
        `~ge_active_offer_apply_cancelled(1);`,
        `inv_clear(${VIEW_INV});`,
    ]) {
        if (!script.includes(required)) throw new Error(`Grand Exchange active-offer detail script is missing ${required}`);
    }

    const config = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'configs', 'grand_exchange_active_offer.inv'), 'utf8');
    if (!config.includes(`[${VIEW_INV}]`) || !config.includes('size=1')) {
        throw new Error('Grand Exchange active-offer view context inventory was not staged');
    }
}

export function prepareGrandExchangeActiveOfferDetailStage(stagedContentDir: string) {
    patchDetailInterface(stagedContentDir);
    patchViewInventory(stagedContentDir);
    patchOverviewScript(stagedContentDir);
    injectScriptMappings(stagedContentDir);
    validate(stagedContentDir);
}

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
const PROGRESS_BAR = 202;
const ABORT_BUTTON = 203;
const COLLECTION_COMPONENTS = [204, 205, 206, 207, 208, 209, 210, 211] as const;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, model: 33, detail: 250 },
    { name: 'ge_active_offer_2', slot: 2, model: 49, detail: 251 },
    { name: 'ge_active_offer_3', slot: 3, model: 65, detail: 252 },
    { name: 'ge_active_offer_4', slot: 4, model: 84, detail: 253 },
    { name: 'ge_active_offer_5', slot: 5, model: 103, detail: 254 },
    { name: 'ge_active_offer_6', slot: 6, model: 122, detail: 255 },
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
        source = patchAction(source, offer.model, 'model');
        source = patchAction(source, offer.detail, 'text');
    }

    const progress = getComponentBlock(source, PROGRESS_BAR);
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
            throw new Error(`Grand Exchange active-offer progress host com_${PROGRESS_BAR} no longer contains ${required}`);
        }
    }
    const progressRect = `[com_${PROGRESS_BAR}]\nlayer=com_${DETAIL_ROOT}\ntype=rect\nx=70\ny=299\nwidth=300\nheight=15\nfill=yes\ncolour=0x3B352C\n`;
    source = source.slice(0, progress.start) + progressRect.trimEnd() + source.slice(progress.end);

    const status = getComponentBlock(source, DETAIL_TEXT).block;
    if (!status.includes(`layer=com_${DETAIL_ROOT}`) || !status.includes('type=text')) {
        throw new Error(`Grand Exchange active-offer status com_${DETAIL_TEXT} no longer matches the frozen submitted-detail text host`);
    }

    const abort = getComponentBlock(source, ABORT_BUTTON).block;
    if (!abort.includes('buttontype=normal') || !abort.includes('option=Abort Offer')) {
        throw new Error('Grand Exchange active-offer detail requires the frozen Abort Offer action');
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
    const hideCollection = COLLECTION_COMPONENTS.map(component => `if_sethide(${GE_INTERFACE_NAME}:com_${component}, true);`).join('\n');
    return `[proc,ge_open_active_offer_${offer.slot}]\nif (map_feature("grandexchange") = false) return;\nif (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) <= 0) {\n    ~ge_return_to_offer_summary;\n    return;\n}\ninv_clear(${VIEW_INV});\ninv_setslot(${VIEW_INV}, 0, coins, ${offer.slot});\ndef_obj $item = inv_getobj(${offer.name}, ${ACTIVE_ITEM_SLOT});\ndef_int $mode = inv_getnum(${offer.name}, ${ACTIVE_MODE_SLOT});\ndef_int $quantity = inv_getnum(${offer.name}, ${ACTIVE_QUANTITY_SLOT});\ndef_int $price = inv_getnum(${offer.name}, ${ACTIVE_PRICE_SLOT});\ndef_int $total = inv_getnum(${offer.name}, ${ACTIVE_TOTAL_SLOT});\ndef_int $state = inv_getnum(${offer.name}, ${ACTIVE_STATE_SLOT});\ndef_int $filled = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});\nif_sethide(${GE_INTERFACE_NAME}:com_16, true);\nif_sethide(${GE_INTERFACE_NAME}:com_126, false);\nif_sethide(${GE_INTERFACE_NAME}:com_156, true);\nif_sethide(${GE_INTERFACE_NAME}:com_192, true);\nif_sethide(${GE_INTERFACE_NAME}:com_197, true);\nif_sethide(${GE_INTERFACE_NAME}:com_${DETAIL_ROOT}, false);\nif_setposition(${GE_INTERFACE_NAME}:com_138, 0, 0);\nif_sethide(${GE_INTERFACE_NAME}:com_138, false);\nif_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);\nif_settext(${GE_INTERFACE_NAME}:com_141, oc_name($item));\nif_settext(${GE_INTERFACE_NAME}:com_140, "<tostring($price)> gp");\nif_settext(${GE_INTERFACE_NAME}:com_145, "");\nif_settext(${GE_INTERFACE_NAME}:com_150, tostring($quantity));\n~ge_offer_price_value_render($price);\n~ge_offer_total_value_render($total);\n${hideCollection}\nif ($mode = ${BUY_MODE}) {\n    if_settext(${GE_INTERFACE_NAME}:com_133, "Buy Offer");\n} else {\n    if_settext(${GE_INTERFACE_NAME}:com_133, "Sell Offer");\n}\nif ($state = ${ACTIVE_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, false);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_BAR}, 0x5A4A22);\n    if ($mode = ${BUY_MODE}) {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Waiting for a seller to match your offer.");\n        if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Waiting to buy: <tostring($filled)>/<tostring($quantity)> filled");\n    } else {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Waiting for a buyer to match your offer.");\n        if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Waiting to sell: <tostring($filled)>/<tostring($quantity)> filled");\n    }\n} else if ($state = ${PARTIAL_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, false);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_BAR}, 0x8A6A18);\n    if ($mode = ${BUY_MODE}) {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Your buy offer has partially completed.");\n    } else {\n        if_settext(${GE_INTERFACE_NAME}:com_142, "Your sell offer has partially completed.");\n    }\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Progress: <tostring($filled)>/<tostring($quantity)> filled");\n} else if ($state = ${COMPLETED_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_BAR}, 0x376B32);\n    if_settext(${GE_INTERFACE_NAME}:com_142, "Your offer has completed.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Complete: <tostring($quantity)>/<tostring($quantity)> filled");\n} else if ($state = ${CANCELLED_STATE}) {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_BAR}, 0x6B3430);\n    if_settext(${GE_INTERFACE_NAME}:com_142, "Your offer has been cancelled.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "Cancelled: <tostring($filled)>/<tostring($quantity)> filled");\n} else {\n    if_sethide(${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}, true);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${PROGRESS_BAR}, 0x3B352C);\n    if_settext(${GE_INTERFACE_NAME}:com_142, "This offer is not in a displayable state.");\n    if_settext(${GE_INTERFACE_NAME}:com_${DETAIL_TEXT}, "");\n}\n`;
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
        const procs = ACTIVE_OFFERS.map(buildOpenProc).join('\n');
        const viewHandlers = ACTIVE_OFFERS.flatMap(offer => [offer.model, offer.detail].map(component => `[if_button,${GE_INTERFACE_NAME}:com_${component}]\n~ge_open_active_offer_${offer.slot};\n`)).join('\n');
        const abortBranches = ACTIVE_OFFERS.map((offer, index) => `${index === 0 ? 'if' : 'else if'} ($offer_slot = ${offer.slot}) {\n    ~ge_active_offer_apply_cancelled(${offer.slot});\n    ~ge_open_active_offer_${offer.slot};\n}`).join('\n');
        const abortHandler = `[if_button,${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}]\nif (map_feature("grandexchange") = false) return;\ndef_int $offer_slot = inv_getnum(${VIEW_INV}, 0);\nif ($offer_slot < 1 | $offer_slot > 6) return;\n${abortBranches}\n`;
        source = source.trimEnd() + `\n\n// r481-style submitted-offer detail. Occupied overview slots open the existing\n// group-105 submitted/collect layer; pending and partial offers expose Abort,\n// while collection remains hidden until the real settlement phase exists.\n${procs}\n${viewHandlers}\n${abortHandler}`;
    }

    fs.writeFileSync(file, source, 'utf8');
}

function injectScriptMappings(stagedContentDir: string) {
    const triggers = [
        ...ACTIVE_OFFERS.map(offer => `[proc,ge_open_active_offer_${offer.slot}]`),
        ...ACTIVE_OFFERS.flatMap(offer => [offer.model, offer.detail].map(component => `[if_button,${GE_INTERFACE_NAME}:com_${component}]`)),
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
    const progress = getComponentBlock(interfaceSource, PROGRESS_BAR).block;
    for (const required of ['type=rect', 'fill=yes', 'colour=0x3B352C']) {
        if (!progress.includes(required)) throw new Error(`Grand Exchange active-offer progress bar is missing ${required}`);
    }
    for (const offer of ACTIVE_OFFERS) {
        for (const component of [offer.model, offer.detail]) {
            const block = getComponentBlock(interfaceSource, component).block;
            if (!block.includes('buttontype=normal') || !block.includes('option=View Offer')) {
                throw new Error(`Grand Exchange active-offer slot ${offer.slot} view action is missing on com_${component}`);
            }
        }
    }

    const script = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange.rs2'), 'utf8').replace(/\r/g, '');
    for (const required of [
        '[proc,ge_open_active_offer_1]',
        `[if_button,${GE_INTERFACE_NAME}:com_${ACTIVE_OFFERS[0].model}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${ACTIVE_OFFERS[0].detail}]`,
        `[if_button,${GE_INTERFACE_NAME}:com_${ABORT_BUTTON}]`,
        'Waiting for a seller to match your offer.',
        'Waiting for a buyer to match your offer.',
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

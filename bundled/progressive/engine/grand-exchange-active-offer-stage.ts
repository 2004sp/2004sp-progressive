import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELECTED_ITEM_INV = 'ge_selected_item';
const OFFER_SUBMISSION_INV = 'ge_offer_submission';
const SELECTED_ITEM_SLOT = 0;
const ACTIVE_ITEM_SLOT = 0;
const ACTIVE_MODE_SLOT = 1;
const ACTIVE_QUANTITY_SLOT = 2;
const ACTIVE_PRICE_SLOT = 3;
const ACTIVE_TOTAL_SLOT = 4;
const ACTIVE_STATE_SLOT = 5;
const ACTIVE_STATE = 1;
const BUY_MODE = 1;
const CONFIRM_COMPONENT = 190;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', id: 168, slot: 1, empty: 19, activeContent: 32, model: 33, title: 216, detail: 250, controls: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31] },
    { name: 'ge_active_offer_2', id: 169, slot: 2, empty: 35, activeContent: 48, model: 49, title: 221, detail: 251, controls: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47] },
    { name: 'ge_active_offer_3', id: 170, slot: 3, empty: 51, activeContent: 64, model: 65, title: 226, detail: 252, controls: [52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63] },
    { name: 'ge_active_offer_4', id: 171, slot: 4, empty: 70, activeContent: 83, model: 84, title: 231, detail: 253, controls: [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82] },
    { name: 'ge_active_offer_5', id: 172, slot: 5, empty: 89, activeContent: 102, model: 103, title: 236, detail: 254, controls: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101] },
    { name: 'ge_active_offer_6', id: 173, slot: 6, empty: 108, activeContent: 121, model: 122, title: 241, detail: 255, controls: [109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120] },
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

function appendPackMappings(file: string, mappings: ReadonlyMap<number, string>, label: string) {
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
        throw new Error(`Grand Exchange active-offer state is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange active-offer state is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceComponent(source: string, componentId: number, replacement: string) {
    const { start, end } = getComponentBlock(source, componentId);
    return source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

function writeActiveOfferInventoryConfig(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_active_offer.inv'
    );
    fs.mkdirSync(path.dirname(configPath), { recursive: true });

    const configs = ACTIVE_OFFERS.map(offer => `[${offer.name}]\nscope=temp\nsize=6\nstackall=yes`).join('\n\n');
    fs.writeFileSync(
        configPath,
        `// Option-2-only authoritative active-offer state for the current login.\n// Each GE slot owns one server-side container: item, mode, requested quantity,\n// price, total and status. scope=temp is intentional for this milestone. The\n// later persistent GE model must remain safe when option 1/3 load native configs\n// that do not contain these option-2-only inventory definitions.\n\n${configs}\n`,
        'utf8'
    );
}

function injectActiveOfferInventoryMappings(stagedContentDir: string) {
    const mappings = new Map<number, string>();
    for (const offer of ACTIVE_OFFERS) {
        mappings.set(offer.id, offer.name);
    }
    appendPackMappings(
        path.join(stagedContentDir, 'pack', 'inv.pack'),
        mappings,
        'Grand Exchange active-offer inventory'
    );
}

function patchActiveOfferInterface(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange active-offer interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const modelBlock = getComponentBlock(source, offer.model).block;
        for (const required of [
            `layer=com_${offer.activeContent}`,
            'type=layer',
            'x=0',
            'y=0',
            'width=10',
            'height=10',
            'scroll=10',
        ]) {
            if (!modelBlock.includes(required)) {
                throw new Error(`Grand Exchange active-offer model placeholder com_${offer.model} no longer contains ${required}`);
            }
        }
        source = replaceComponent(
            source,
            offer.model,
            `[com_${offer.model}]\nlayer=com_${offer.activeContent}\ntype=model\nx=7\ny=38\nwidth=40\nheight=36\nzoom=100\n`
        );

        const detailBlock = getComponentBlock(source, offer.detail).block;
        for (const required of [
            `layer=com_${offer.empty}`,
            'type=rect',
            'x=1',
            'width=138',
            'height=1',
            'fill=yes',
            'colour=0x3B352C',
        ]) {
            if (!detailBlock.includes(required)) {
                throw new Error(`Grand Exchange active-offer helper com_${offer.detail} no longer contains ${required}`);
            }
        }
        source = replaceComponent(
            source,
            offer.detail,
            `[com_${offer.detail}]\nlayer=com_${offer.empty}\ntype=text\nx=50\ny=34\nwidth=84\nheight=68\nfont=p11\nshadowed=yes\ntext=\ncolour=0xC1A875\n`
        );
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchOverviewStateRefresh(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange active-offer overview script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const marker of ['[debugproc,ge]', '[proc,ge_return_to_offer_summary]']) {
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        if (!block.includes('~ge_active_offer_refresh;')) {
            block = `${block.trimEnd()}\n~ge_active_offer_refresh;\n`;
        }
        source = source.slice(0, start) + block + source.slice(end);
    }

    for (const offer of ACTIVE_OFFERS) {
        for (const componentId of [offer.controls[10], offer.controls[11]]) {
            const marker = `[if_button,${GE_INTERFACE_NAME}:com_${componentId}]`;
            const { start, end, block: originalBlock } = getScriptBlock(source, marker);
            let block = originalBlock;
            const guard = `if (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) > 0) return;`;
            if (!block.includes(guard)) {
                block = block.replace(`${marker}\n`, `${marker}\n${guard}\n`);
            }
            source = source.slice(0, start) + block + source.slice(end);
        }
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildActiveOfferRefreshScript() {
    const slotRefresh = ACTIVE_OFFERS.map(offer => {
        const hideControls = offer.controls.map(componentId => `    if_sethide(${GE_INTERFACE_NAME}:com_${componentId}, true);`).join('\n');
        const showControls = offer.controls.map(componentId => `    if_sethide(${GE_INTERFACE_NAME}:com_${componentId}, false);`).join('\n');

        return `if (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) > 0) {\n    def_obj $item_${offer.slot} = inv_getobj(${offer.name}, ${ACTIVE_ITEM_SLOT});\n    def_int $mode_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_MODE_SLOT});\n    def_int $quantity_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_QUANTITY_SLOT});\n    def_int $price_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_PRICE_SLOT});\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.empty}, false);\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.activeContent}, false);\n${hideControls}\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.detail}, false);\n    if_setobject(${GE_INTERFACE_NAME}:com_${offer.model}, $item_${offer.slot}, 100);\n    if ($mode_${offer.slot} = ${BUY_MODE}) {\n        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buying\");\n    } else {\n        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Selling\");\n    }\n    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");\n} else {\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.activeContent}, true);\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.empty}, false);\n${showControls}\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.detail}, true);\n    if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Empty\");\n}`;
    }).join('\n\n');

    return `// Option-2-only server-authoritative six-slot active-offer view.\n// Presence and all display values are read from server-owned temp inventories;\n// the client never decides whether a slot is occupied. Matching, partial fills,\n// cancellation, collection, wealth reservation and restart persistence remain\n// later authoritative-economy phases.\n\n[proc,ge_active_offer_refresh]\nif (map_feature(\"grandexchange\") = false) return;\n${slotRefresh}\n`;
}

function writeActiveOfferRefreshScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_active_offer.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildActiveOfferRefreshScript(), 'utf8');
}

function patchOfferSubmission(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_offer_submission.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange active-offer submission script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = `[if_button,${GE_INTERFACE_NAME}:com_${CONFIRM_COMPONENT}]`;
    const { start, end, block: originalBlock } = getScriptBlock(source, marker);
    let block = originalBlock;

    const selectedCheck = `if (inv_getnum(${SELECTED_ITEM_INV}, ${SELECTED_ITEM_SLOT}) <= 0) {`;
    if (!block.includes(selectedCheck)) {
        throw new Error('Grand Exchange active-offer state cannot find the Confirm Offer selected-item validation');
    }

    const occupiedGuards = ACTIVE_OFFERS.map(
        offer => `if ($offer_slot = ${offer.slot} & inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) > 0) {\n    mes(\"That Grand Exchange offer slot is already in use.\");\n    return;\n}`
    ).join('\n');
    if (!block.includes(`inv_getnum(${ACTIVE_OFFERS[0].name}, ${ACTIVE_ITEM_SLOT})`)) {
        block = block.replace(selectedCheck, `${occupiedGuards}\n${selectedCheck}`);
    }

    const snapshotTail = [
        `inv_clear(${OFFER_SUBMISSION_INV});`,
        `inv_moveitem(${SELECTED_ITEM_INV}, ${OFFER_SUBMISSION_INV}, $item, 1);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 1, coins, $quantity);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 2, coins, $price);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 3, coins, $total);`,
        `if_settext(${GE_INTERFACE_NAME}:com_133, \"Offer Submitted\");`,
        `if_settext(${GE_INTERFACE_NAME}:com_142, \"Your offer passed validation. Matching is not enabled yet.\");`,
        `if_sethide(${GE_INTERFACE_NAME}:com_156, true);`,
    ].join('\n');

    if (!block.includes(snapshotTail)) {
        throw new Error('Grand Exchange active-offer state cannot find the validated submission snapshot tail');
    }

    const commitBranches = ACTIVE_OFFERS.map((offer, index) => `${index === 0 ? 'if' : 'else if'} ($offer_slot = ${offer.slot}) {\n    inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.name}, $item, 1);\n    inv_setslot(${offer.name}, ${ACTIVE_MODE_SLOT}, coins, $mode);\n    inv_setslot(${offer.name}, ${ACTIVE_QUANTITY_SLOT}, coins, $quantity);\n    inv_setslot(${offer.name}, ${ACTIVE_PRICE_SLOT}, coins, $price);\n    inv_setslot(${offer.name}, ${ACTIVE_TOTAL_SLOT}, coins, $total);\n    inv_setslot(${offer.name}, ${ACTIVE_STATE_SLOT}, coins, ${ACTIVE_STATE});\n}`).join('\n');

    const activeTail = [
        `inv_clear(${OFFER_SUBMISSION_INV});`,
        `inv_moveitem(${SELECTED_ITEM_INV}, ${OFFER_SUBMISSION_INV}, $item, 1);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 1, coins, $quantity);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 2, coins, $price);`,
        `inv_setslot(${OFFER_SUBMISSION_INV}, 3, coins, $total);`,
        commitBranches,
        '~ge_return_to_offer_summary;',
    ].join('\n');

    block = block.replace(snapshotTail, activeTail);
    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function injectActiveOfferScriptMapping(stagedContentDir: string) {
    const triggerName = '[proc,ge_active_offer_refresh]';
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    if ([...values.values()].includes(triggerName)) return;

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

export function prepareGrandExchangeActiveOfferStage(stagedContentDir: string) {
    writeActiveOfferInventoryConfig(stagedContentDir);
    injectActiveOfferInventoryMappings(stagedContentDir);
    patchActiveOfferInterface(stagedContentDir);
    patchOverviewStateRefresh(stagedContentDir);
    writeActiveOfferRefreshScript(stagedContentDir);
    patchOfferSubmission(stagedContentDir);
    injectActiveOfferScriptMapping(stagedContentDir);
}

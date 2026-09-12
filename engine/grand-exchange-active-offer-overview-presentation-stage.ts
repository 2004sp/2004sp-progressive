import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const BUY_MODE = 1;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, layer: 19, model: 33, title: 216, detail: 250, quantity: 30, sellAction: 31, progress: 244 },
    { name: 'ge_active_offer_2', slot: 2, layer: 35, model: 49, title: 221, detail: 251, quantity: 46, sellAction: 47, progress: 245 },
    { name: 'ge_active_offer_3', slot: 3, layer: 51, model: 65, title: 226, detail: 252, quantity: 62, sellAction: 63, progress: 246 },
    { name: 'ge_active_offer_4', slot: 4, layer: 70, model: 84, title: 231, detail: 253, quantity: 81, sellAction: 82, progress: 247 },
    { name: 'ge_active_offer_5', slot: 5, layer: 89, model: 103, title: 236, detail: 254, quantity: 100, sellAction: 101, progress: 248 },
    { name: 'ge_active_offer_6', slot: 6, layer: 108, model: 122, title: 241, detail: 255, quantity: 119, sellAction: 120, progress: 249 },
] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange waiting-offer presentation is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function replaceComponent(source: string, componentId: number, replacement: string) {
    const { start, end } = getComponentBlock(source, componentId);
    return source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange waiting-offer presentation is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange waiting-offer presentation cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange waiting-offer presentation found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchOverviewInterface(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange waiting-offer interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const detail = getComponentBlock(source, offer.detail).block;
        for (const required of [
            `layer=com_${offer.layer}`,
            'type=text',
            'font=p11',
            'shadowed=yes',
        ]) {
            if (!detail.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer detail com_${offer.detail} no longer contains ${required}`);
            }
        }
        source = replaceComponent(
            source,
            offer.detail,
            `[com_${offer.detail}]\nlayer=com_${offer.layer}\ntype=text\nx=46\ny=32\nwidth=88\nheight=42\nfont=p11\nshadowed=yes\ntext=\ncolour=0xCC9800\n`
        );

        const progress = getComponentBlock(source, offer.progress).block;
        for (const required of [
            `layer=com_${offer.layer}`,
            'type=rect',
            'x=1',
            'y=1',
            'width=138',
            'height=108',
            'colour=0x3B352C',
        ]) {
            if (!progress.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer progress helper com_${offer.progress} no longer contains ${required}`);
            }
        }
        source = replaceComponent(
            source,
            offer.progress,
            `[com_${offer.progress}]\nlayer=com_${offer.layer}\ntype=rect\nx=7\ny=82\nwidth=126\nheight=14\nfill=yes\ncolour=0x000000\n`
        );
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchActiveOfferRefresh(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_active_offer.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange waiting-offer refresh script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const hideQuantity = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.quantity}, true);`;
        const showQuantity = [
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.quantity}, false);`,
            `    if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, -6, -12);`,
            `    if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0xFFFF00);`,
            `    if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, tostring($quantity_${offer.slot}));`,
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, false);`,
        ].join('\n');
        source = replaceExactlyOnce(source, hideQuantity, showQuantity, `slot ${offer.slot} occupied quantity control`);

        const emptyQuantityShow = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.quantity}, false);`;
        const emptyReset = [
            emptyQuantityShow,
            `    if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0, 0);`,
            `    if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0x000000);`,
            `    if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, \"\");`,
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, true);`,
        ].join('\n');

        // There are two occurrences after the occupied replacement above: the
        // newly inserted occupied show and the original empty-state show. Patch
        // the final one only so the real empty Buy action is restored in-place.
        const lastEmptyShow = source.lastIndexOf(emptyQuantityShow);
        if (lastEmptyShow === -1) {
            throw new Error(`Grand Exchange waiting-offer presentation cannot find slot ${offer.slot} empty Buy action`);
        }
        source = source.slice(0, lastEmptyShow) + emptyReset + source.slice(lastEmptyShow + emptyQuantityShow.length);

        source = source.replaceAll(
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buying\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buy\");`
        );
        source = source.replaceAll(
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Selling\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sell\");`
        );

        const pendingDetail = `    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`;
        const partialDetail = `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`;
        const completedDetail = `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Complete: <oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`;
        const cancelledDetail = `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Cancelled: <oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`;
        const compactDetail = `if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})><br><col=FFFF00><tostring($price_${offer.slot})> gp</col>\");`;

        for (const [needle, indent, label] of [
            [pendingDetail, '    ', 'pending'],
            [partialDetail, '        ', 'partial'],
            [completedDetail, '        ', 'completed'],
            [cancelledDetail, '        ', 'cancelled'],
        ] as const) {
            if (!source.includes(needle)) {
                throw new Error(`Grand Exchange waiting-offer presentation cannot find slot ${offer.slot} ${label} detail renderer`);
            }
            source = source.replace(needle, `${indent}${compactDetail}`);
        }
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function validateSellButtons(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    const scriptSource = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const sell = getComponentBlock(interfaceSource, offer.sellAction).block;
        for (const required of ['type=text', 'buttontype=normal', 'option=Sell', 'font=p11', 'text=', 'colour=0x000000']) {
            if (!sell.includes(required)) {
                throw new Error(`Grand Exchange empty-slot Sell action com_${offer.sellAction} lost ${required}`);
            }
        }

        const marker = `[if_button,${GE_INTERFACE_NAME}:com_${offer.sellAction}]`;
        const { block } = getScriptBlock(scriptSource, marker);
        for (const required of [
            `if (inv_getnum(${offer.name}, 0) > 0) return;`,
            '~ge_open_sell_offer_setup;',
        ]) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange empty-slot Sell handler ${marker} lost ${required}`);
            }
        }
    }
}

function validateWaitingPresentation(stagedContentDir: string) {
    const interfaceSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`),
        'utf8'
    ).replace(/\r/g, '');
    const refreshSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2'),
        'utf8'
    ).replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const progress = getComponentBlock(interfaceSource, offer.progress).block;
        for (const required of ['type=rect', 'x=7', 'y=82', 'width=126', 'height=14', 'fill=yes', 'colour=0x000000']) {
            if (!progress.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer progress bar com_${offer.progress} lost ${required}`);
            }
        }

        for (const required of [
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buy\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sell\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, tostring($quantity_${offer.slot}));`,
            `<oc_name($item_${offer.slot})><br><col=FFFF00><tostring($price_${offer.slot})> gp</col>`,
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, false);`,
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, true);`,
        ]) {
            if (!refreshSource.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer slot ${offer.slot} lost ${required}`);
            }
        }
    }
}

export function prepareGrandExchangeActiveOfferOverviewPresentationStage(stagedContentDir: string) {
    patchOverviewInterface(stagedContentDir);
    patchActiveOfferRefresh(stagedContentDir);
    validateSellButtons(stagedContentDir);
    validateWaitingPresentation(stagedContentDir);
}

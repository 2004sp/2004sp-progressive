import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
// The 28 November 2007 overview uses an inset, near-black brown for the
// unfilled portion of an occupied offer's progress meter. Pure black makes the
// meter look like a missing sprite and is visibly harsher than the source UI.
const PENDING_PROGRESS_COLOUR = '0x211D19';

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, layer: 19, activeContent: 32, model: 33, title: 216, detail: 250, quantity: 30, price: 31, sellAction: 31, progress: 244 },
    { name: 'ge_active_offer_2', slot: 2, layer: 35, activeContent: 48, model: 49, title: 221, detail: 251, quantity: 46, price: 47, sellAction: 47, progress: 245 },
    { name: 'ge_active_offer_3', slot: 3, layer: 51, activeContent: 64, model: 65, title: 226, detail: 252, quantity: 62, price: 63, sellAction: 63, progress: 246 },
    { name: 'ge_active_offer_4', slot: 4, layer: 70, activeContent: 83, model: 84, title: 231, detail: 253, quantity: 81, price: 82, sellAction: 82, progress: 247 },
    { name: 'ge_active_offer_5', slot: 5, layer: 89, activeContent: 102, model: 103, title: 236, detail: 254, quantity: 100, price: 101, sellAction: 101, progress: 248 },
    { name: 'ge_active_offer_6', slot: 6, layer: 108, activeContent: 121, model: 122, title: 241, detail: 255, quantity: 119, price: 120, sellAction: 120, progress: 249 },
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

function getComponentPosition(source: string, componentId: number) {
    const { marker, block } = getComponentBlock(source, componentId);
    const xMatch = block.match(/^x=(-?\d+)$/m);
    const yMatch = block.match(/^y=(-?\d+)$/m);
    if (!xMatch || !yMatch) {
        throw new Error(`Grand Exchange waiting-offer presentation cannot read ${marker} position`);
    }
    return {
        x: Number.parseInt(xMatch[1], 10),
        y: Number.parseInt(yMatch[1], 10),
    };
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
        for (const required of [`layer=com_${offer.layer}`, 'type=text', 'font=p11', 'shadowed=yes']) {
            if (!detail.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer detail com_${offer.detail} no longer contains ${required}`);
            }
        }
        // Active-only text belongs under the occupied-content layer. This keeps
        // it out of an empty slot without touching the original Buy/Sell chrome.
        source = replaceComponent(
            source,
            offer.detail,
            `[com_${offer.detail}]\nlayer=com_${offer.activeContent}\ntype=text\nx=46\ny=32\nwidth=88\nheight=16\nfont=p11\nshadowed=yes\ntext=\ncolour=0xCC9800\n`
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
        // Parent the meter background to the occupied-content layer instead of
        // moving/hiding the source Buy/Sell graphics. The latter are authored
        // relative to the empty-slot layer and must keep their original layout.
        source = replaceComponent(
            source,
            offer.progress,
            `[com_${offer.progress}]\nlayer=com_${offer.activeContent}\ntype=rect\nx=7\ny=82\nwidth=126\nheight=14\nfill=yes\ncolour=${PENDING_PROGRESS_COLOUR}\n`
        );
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchVisualControl(
    source: string,
    componentId: number,
    occupiedLines: readonly string[],
    emptyLines: readonly string[],
    label: string
) {
    const hidden = `    if_sethide(${GE_INTERFACE_NAME}:com_${componentId}, true);`;
    const occupied = [
        `    if_sethide(${GE_INTERFACE_NAME}:com_${componentId}, false);`,
        ...occupiedLines.map(line => `    ${line}`),
    ].join('\n');
    source = replaceExactlyOnce(source, hidden, occupied, `${label} occupied control`);

    const visible = `    if_sethide(${GE_INTERFACE_NAME}:com_${componentId}, false);`;
    const lastVisible = source.lastIndexOf(visible);
    if (lastVisible === -1) {
        throw new Error(`Grand Exchange waiting-offer presentation cannot find ${label} empty control`);
    }
    const empty = [visible, ...emptyLines.map(line => `    ${line}`)].join('\n');
    return source.slice(0, lastVisible) + empty + source.slice(lastVisible + visible.length);
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

    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        // com_quantity/com_price are the invisible Buy/Sell action widgets in an
        // empty slot and are reused as text while occupied. Only those two need
        // runtime position changes; the visible button frames/icons stay at the
        // exact source positions and are controlled solely by IF_SETHIDE.
        const quantityEmptyPosition = getComponentPosition(interfaceSource, offer.quantity);
        const priceEmptyPosition = getComponentPosition(interfaceSource, offer.price);

        source = patchVisualControl(
            source,
            offer.quantity,
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, -6, -12);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0xFFFF00);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, tostring($quantity_${offer.slot}));`,
                `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, false);`,
            ],
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, ${quantityEmptyPosition.x}, ${quantityEmptyPosition.y});`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0x000000);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, \"\");`,
                `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, true);`,
            ],
            `slot ${offer.slot} quantity/Buy`
        );

        source = patchVisualControl(
            source,
            offer.price,
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, -24, 10);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0xFFFF00);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, \"<tostring($price_${offer.slot})> gp\");`,
            ],
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, ${priceEmptyPosition.x}, ${priceEmptyPosition.y});`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0x000000);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, \"\");`,
            ],
            `slot ${offer.slot} price/Sell`
        );

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
        const compactDetail = `if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, oc_name($item_${offer.slot}));`;

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
        const detail = getComponentBlock(interfaceSource, offer.detail).block;
        if (!detail.includes(`layer=com_${offer.activeContent}`)) {
            throw new Error(`Grand Exchange waiting-offer detail com_${offer.detail} is not parented to active content`);
        }

        const progress = getComponentBlock(interfaceSource, offer.progress).block;
        for (const required of [
            `layer=com_${offer.activeContent}`,
            'type=rect',
            'x=7',
            'y=82',
            'width=126',
            'height=14',
            'fill=yes',
            `colour=${PENDING_PROGRESS_COLOUR}`,
        ]) {
            if (!progress.includes(required)) {
                throw new Error(`Grand Exchange waiting-offer progress bar com_${offer.progress} lost ${required}`);
            }
        }

        const quantityEmptyPosition = getComponentPosition(interfaceSource, offer.quantity);
        const priceEmptyPosition = getComponentPosition(interfaceSource, offer.price);
        for (const required of [
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buy\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sell\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, tostring($quantity_${offer.slot}));`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, ${quantityEmptyPosition.x}, ${quantityEmptyPosition.y});`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, \"<tostring($price_${offer.slot})> gp\");`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, ${priceEmptyPosition.x}, ${priceEmptyPosition.y});`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, oc_name($item_${offer.slot}));`,
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

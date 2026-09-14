import fs from 'fs';
import path from 'path';

import { Jimp } from 'jimp';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const PROGRESS_FRAME_X = 7;
const PROGRESS_FRAME_Y = 80;
const PROGRESS_FRAME_WIDTH = 126;
const PROGRESS_FRAME_HEIGHT = 15;
const PROGRESS_INSET = 1;
const PROGRESS_WIDTH = PROGRESS_FRAME_WIDTH - PROGRESS_INSET * 2;
const PROGRESS_HEIGHT = PROGRESS_FRAME_HEIGHT - PROGRESS_INSET * 2;
// Exact period GE meter palette from the client-side progress renderer. Buy and
// Sell share these colours: a translucent brown-grey inset at zero progress,
// amber for transferred progress, green when complete and red when aborted.
const EMPTY_PROGRESS_COLOUR = '0x302520';
const EMPTY_PROGRESS_TRANSPARENCY = 100;
const ACTIVE_PROGRESS_COLOUR = '0xC68B01';
const PARTIAL_PROGRESS_COLOUR = '0xC68B01';
const COMPLETED_PROGRESS_COLOUR = '0x3F821E';
const CANCELLED_PROGRESS_COLOUR = '0x8A0010';
const ACTIVE_STATE = 1;
const PARTIAL_STATE = 2;
const COMPLETED_STATE = 3;
const CANCELLED_STATE = 4;
const PROGRESS_HELPER_COMPONENT_MIN = 256;
const PROGRESS_HELPER_COMPONENT_MAX = 305;
const PROGRESS_HELPER_LOCAL_ID_BASE = 10792;
const COLLECTION_AMOUNT_ONE = 304;
const COLLECTION_AMOUNT_TWO = 305;
const ACTIVE_OFFER_VIEW_CLEAR_GRAPHIC = 'ge_active_offer_view_clear,0';
const ACTIVE_OFFER_VIEW_HOVER_GRAPHIC = 'ge_active_offer_view_hover,0';
const ACTIVE_OFFER_VIEW_WIDTH = 140;
const ACTIVE_OFFER_VIEW_HEIGHT = 110;

// These IF1-only helpers deliberately live outside the seven reserved 256-ID
// GE component blocks. The generic compatibility/cache validators run before
// this stage; this stage then owns collision checks and exact mappings for this
// narrow extension instead of weakening those validators for unrelated widgets.
const ACTIVE_OFFERS = [
    { slot: 1, activeContent: 32, background: 244, clip: 256, fill: 262, emptyFill: 268, amount: 274, view: 280, hoverLayer: 286, hoverGraphic: 292, priceLabel: 298 },
    { slot: 2, activeContent: 48, background: 245, clip: 257, fill: 263, emptyFill: 269, amount: 275, view: 281, hoverLayer: 287, hoverGraphic: 293, priceLabel: 299 },
    { slot: 3, activeContent: 64, background: 246, clip: 258, fill: 264, emptyFill: 270, amount: 276, view: 282, hoverLayer: 288, hoverGraphic: 294, priceLabel: 300 },
    { slot: 4, activeContent: 83, background: 247, clip: 259, fill: 265, emptyFill: 271, amount: 277, view: 283, hoverLayer: 289, hoverGraphic: 295, priceLabel: 301 },
    { slot: 5, activeContent: 102, background: 248, clip: 260, fill: 266, emptyFill: 272, amount: 278, view: 284, hoverLayer: 290, hoverGraphic: 296, priceLabel: 302 },
    { slot: 6, activeContent: 121, background: 249, clip: 261, fill: 267, emptyFill: 273, amount: 279, view: 285, hoverLayer: 291, hoverGraphic: 297, priceLabel: 303 }
] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange live progress is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return source.slice(start, end);
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange live progress cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange live progress found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const [lineIndex, rawLine] of content.split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals <= 0 || equals === line.length - 1) {
            throw new Error(`Grand Exchange live progress found malformed pack line ${lineIndex + 1} in ${file}`);
        }
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (!Number.isInteger(id)) {
            throw new Error(`Grand Exchange live progress found invalid pack ID on line ${lineIndex + 1} in ${file}`);
        }
        values.set(id, line.slice(equals + 1));
    }

    return { content, values };
}

function helperLocalId(componentId: number) {
    if (componentId < PROGRESS_HELPER_COMPONENT_MIN || componentId > PROGRESS_HELPER_COMPONENT_MAX) {
        throw new Error(`Grand Exchange live progress helper com_${componentId} is outside its owned range`);
    }
    return PROGRESS_HELPER_LOCAL_ID_BASE + componentId - PROGRESS_HELPER_COMPONENT_MIN;
}

async function stageActiveOfferViewSprites(stagedContentDir: string) {
    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });

    // IF1's media pack treats opaque #ff00ff as transparent. The idle image is
    // therefore a genuine invisible 140x110 click surface, while the hover image
    // keeps the interior transparent and only brightens the complete offer frame.
    const transparent = 0xff00ffff;
    const clear = new Jimp({ width: ACTIVE_OFFER_VIEW_WIDTH, height: ACTIVE_OFFER_VIEW_HEIGHT, color: transparent });
    const hover = new Jimp({ width: ACTIVE_OFFER_VIEW_WIDTH, height: ACTIVE_OFFER_VIEW_HEIGHT, color: transparent });
    const outer = 0xc1a875ff;
    const inner = 0x817765ff;

    for (let x = 0; x < ACTIVE_OFFER_VIEW_WIDTH; x++) {
        hover.setPixelColor(outer, x, 0);
        hover.setPixelColor(outer, x, ACTIVE_OFFER_VIEW_HEIGHT - 1);
        hover.setPixelColor(inner, x, 1);
        hover.setPixelColor(inner, x, ACTIVE_OFFER_VIEW_HEIGHT - 2);
    }
    for (let y = 0; y < ACTIVE_OFFER_VIEW_HEIGHT; y++) {
        hover.setPixelColor(outer, 0, y);
        hover.setPixelColor(outer, ACTIVE_OFFER_VIEW_WIDTH - 1, y);
        hover.setPixelColor(inner, 1, y);
        hover.setPixelColor(inner, ACTIVE_OFFER_VIEW_WIDTH - 2, y);
    }

    await clear.write(path.join(spriteDir, 'ge_active_offer_view_clear.png'));
    await hover.write(path.join(spriteDir, 'ge_active_offer_view_hover.png'));
}

function appendProgressHelpers(stagedContentDir: string) {
    const interfacePath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange live progress interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        if (source.includes(`[com_${componentId}]`)) {
            throw new Error(`Grand Exchange live progress helper com_${componentId} is already in use`);
        }
    }

    const clipHelpers: string[] = [];
    const emptyFillHelpers: string[] = [];
    const fillHelpers: string[] = [];
    const amountHelpers: string[] = [];
    const priceHelpers: string[] = [];
    const viewHelpers: string[] = [];
    const hoverLayerHelpers: string[] = [];
    const hoverGraphicHelpers: string[] = [];
    for (const offer of ACTIVE_OFFERS) {
        const background = getComponentBlock(source, offer.background);
        for (const required of [`layer=com_${offer.activeContent}`, 'type=rect', `x=${PROGRESS_FRAME_X}`, `y=${PROGRESS_FRAME_Y}`, `width=${PROGRESS_FRAME_WIDTH}`, `height=${PROGRESS_FRAME_HEIGHT}`, 'colour=0x000000']) {
            if (!background.includes(required)) {
                throw new Error(`Grand Exchange live progress background com_${offer.background} lost ${required}`);
            }
        }
        if (background.includes('fill=yes')) {
            throw new Error(`Grand Exchange live progress background com_${offer.background} must remain an outline`);
        }

        // Keep every piece of the meter under the occupied-slot layer. The
        // native r254 client has always honoured hidden layers, whereas older
        // paths can ignore IF_SETHIDE on individual rect/graphic leaves.
        clipHelpers.push(
            `[com_${offer.clip}]\n` +
                `layer=com_${offer.activeContent}\n` +
                'type=layer\n' +
                `x=${PROGRESS_FRAME_X + PROGRESS_INSET}\n` +
                `y=${PROGRESS_FRAME_Y + PROGRESS_INSET}\n` +
                `width=${PROGRESS_WIDTH}\n` +
                `height=${PROGRESS_HEIGHT}\n` +
                `scroll=${PROGRESS_HEIGHT}`
        );
        emptyFillHelpers.push(
            `[com_${offer.emptyFill}]\n` +
                `layer=com_${offer.clip}\n` +
                'type=rect\n' +
                'x=0\n' +
                'y=0\n' +
                `width=${PROGRESS_WIDTH}\n` +
                `height=${PROGRESS_HEIGHT}\n` +
                'fill=yes\n' +
                `colour=${EMPTY_PROGRESS_COLOUR}\n` +
                `trans=${EMPTY_PROGRESS_TRANSPARENCY}`
        );
        fillHelpers.push(`[com_${offer.fill}]\n` + `layer=com_${offer.clip}\n` + 'type=rect\n' + 'x=0\n' + 'y=0\n' + `width=${PROGRESS_WIDTH}\n` + `height=${PROGRESS_HEIGHT}\n` + 'fill=yes\n' + `colour=${ACTIVE_PROGRESS_COLOUR}`);
        // Draw the quantity after the item model/progress helpers so it remains
        // readable on top of the icon. One-pixel inset keeps it inside the
        // authentic 40x36 item-box border (box origin is 7,38).
        amountHelpers.push(
            `[com_${offer.amount}]\n` +
                `layer=com_${offer.activeContent}\n` +
                'type=text\n' +
                'x=8\n' +
                'y=39\n' +
                'width=38\n' +
                'height=12\n' +
                'font=p11\n' +
                'shadowed=yes\n' +
                'text=\n' +
                'colour=0xFFFF00'
        );
        priceHelpers.push(
            `[com_${offer.priceLabel}]\n` +
                `layer=com_${offer.activeContent}\n` +
                'type=text\n' +
                'x=52\n' +
                'y=53\n' +
                'width=78\n' +
                'height=12\n' +
                'font=p11\n' +
                'shadowed=yes\n' +
                'text=\n' +
                'colour=0xFFFF00'
        );
    }

    for (const offer of ACTIVE_OFFERS) {
        viewHelpers.push(
            `[com_${offer.view}]\n` +
                `layer=com_${offer.activeContent}\n` +
                'buttontype=normal\n' +
                'option=View Offer\n' +
                'type=graphic\n' +
                'x=0\n' +
                'y=0\n' +
                `width=${ACTIVE_OFFER_VIEW_WIDTH}\n` +
                `height=${ACTIVE_OFFER_VIEW_HEIGHT}\n` +
                `graphic=${ACTIVE_OFFER_VIEW_CLEAR_GRAPHIC}\n` +
                `overlayer=com_${offer.hoverLayer}`
        );
        hoverLayerHelpers.push(
            `[com_${offer.hoverLayer}]\n` +
                `layer=com_${offer.activeContent}\n` +
                'type=layer\n' +
                'x=0\n' +
                'y=0\n' +
                `width=${ACTIVE_OFFER_VIEW_WIDTH}\n` +
                `height=${ACTIVE_OFFER_VIEW_HEIGHT}\n` +
                `scroll=${ACTIVE_OFFER_VIEW_HEIGHT}\n` +
                'hide=yes'
        );
        hoverGraphicHelpers.push(
            `[com_${offer.hoverGraphic}]\n` +
                `layer=com_${offer.hoverLayer}\n` +
                'type=graphic\n' +
                'x=0\n' +
                'y=0\n' +
                `width=${ACTIVE_OFFER_VIEW_WIDTH}\n` +
                `height=${ACTIVE_OFFER_VIEW_HEIGHT}\n` +
                `graphic=${ACTIVE_OFFER_VIEW_HOVER_GRAPHIC}`
        );
    }

    const collectionAmountHelpers = [
        `[com_${COLLECTION_AMOUNT_ONE}]\nlayer=com_200\ntype=text\nx=396\ny=277\nwidth=38\nheight=12\nfont=p11\nshadowed=yes\ntext=\ncolour=0xFFFF00`,
        `[com_${COLLECTION_AMOUNT_TWO}]\nlayer=com_200\ntype=text\nx=445\ny=277\nwidth=38\nheight=12\nfont=p11\nshadowed=yes\ntext=\ncolour=0xFFFF00`
    ];

    source = source.trimEnd() + '\n\n' + [...clipHelpers, ...emptyFillHelpers, ...fillHelpers, ...amountHelpers, ...priceHelpers, ...viewHelpers, ...hoverLayerHelpers, ...hoverGraphicHelpers, ...collectionAmountHelpers].join('\n\n') + '\n';
    fs.writeFileSync(interfacePath, source, 'utf8');
}

function injectProgressHelperMappings(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const { content, values } = readPack(packPath);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        const localId = helperLocalId(componentId);
        const expectedName = `${GE_INTERFACE_NAME}:com_${componentId}`;
        const existingName = values.get(localId);
        if (existingName && existingName !== expectedName) {
            throw new Error(`Grand Exchange live progress local interface ID ${localId} is already mapped to ${existingName}`);
        }

        const existingId = names.get(expectedName);
        if (typeof existingId === 'number' && existingId !== localId) {
            throw new Error(`Grand Exchange live progress name ${expectedName} is already mapped to ${existingId}`);
        }

        if (!existingName) {
            additions.push(`${localId}=${expectedName}`);
            values.set(localId, expectedName);
            names.set(expectedName, localId);
        }
    }

    if (additions.length > 0) {
        const normalized = content.endsWith('\n') ? content : `${content}\n`;
        fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
    }

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        const localId = helperLocalId(componentId);
        const count = orderLines.filter(value => Number.parseInt(value, 10) === localId).length;
        if (count > 1) {
            throw new Error(`Grand Exchange live progress local interface ID ${localId} appears ${count} times in interface.order`);
        }
        if (count === 0) orderLines.push(String(localId));
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function patchActiveOfferRefresh(stagedContentDir: string) {
    const scriptPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange live progress refresh script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const showBackground = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.background}, false);`;
        const renderer = [
            showBackground,
            `    if_settext(${GE_INTERFACE_NAME}:com_${offer.amount}, tostring($quantity_${offer.slot}));`,
            `    if_settext(${GE_INTERFACE_NAME}:com_${offer.priceLabel}, "<tostring($price_${offer.slot})> gp");`,
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, false);`,
            `    if ($state_${offer.slot} = ${COMPLETED_STATE}) {`,
            `        if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${COMPLETED_PROGRESS_COLOUR});`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, 0, 0);`,
            `    } else if ($state_${offer.slot} = ${CANCELLED_STATE}) {`,
            `        if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${CANCELLED_PROGRESS_COLOUR});`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, 0, 0);`,
            `    } else if ($state_${offer.slot} = ${PARTIAL_STATE} & $quantity_${offer.slot} > 0 & $filled_${offer.slot} > 0) {`,
            `        if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${PARTIAL_PROGRESS_COLOUR});`,
            `        def_int $progress_scaled_${offer.slot} = multiply($filled_${offer.slot}, ${PROGRESS_WIDTH});`,
            `        def_int $progress_pixels_${offer.slot} = divide($progress_scaled_${offer.slot}, $quantity_${offer.slot});`,
            `        def_int $progress_offset_${offer.slot} = sub($progress_pixels_${offer.slot}, ${PROGRESS_WIDTH});`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, $progress_offset_${offer.slot}, 0);`,
            `    } else if ($state_${offer.slot} = ${ACTIVE_STATE}) {`,
            `        if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${ACTIVE_PROGRESS_COLOUR});`,
            // A newly submitted offer has transferred zero items, so the
            // amber fill is fully clipped and only the dark inset is visible.
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
            '    } else {',
            `        if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${ACTIVE_PROGRESS_COLOUR});`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
            '    }'
        ].join('\n');
        source = replaceExactlyOnce(source, showBackground, renderer, `slot ${offer.slot} occupied progress renderer`);

        const hideBackground = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.background}, true);`;
        const hidden = [hideBackground, `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, true);`, `    if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`].join('\n');
        source = replaceExactlyOnce(source, hideBackground, hidden, `slot ${offer.slot} empty progress reset`);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function validateLiveProgress(stagedContentDir: string) {
    const interfacePath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const refreshPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    const refreshSource = fs.readFileSync(refreshPath, 'utf8').replace(/\r/g, '');

    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const { values } = readPack(packPath);
    const order = fs
        .readFileSync(path.join(stagedContentDir, 'pack', 'interface.order'), 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean)
        .map(value => Number.parseInt(value, 10));

    for (const offer of ACTIVE_OFFERS) {
        const clip = getComponentBlock(interfaceSource, offer.clip);
        for (const required of [
            `layer=com_${offer.activeContent}`,
            'type=layer',
            `x=${PROGRESS_FRAME_X + PROGRESS_INSET}`,
            `y=${PROGRESS_FRAME_Y + PROGRESS_INSET}`,
            `width=${PROGRESS_WIDTH}`,
            `height=${PROGRESS_HEIGHT}`,
            `scroll=${PROGRESS_HEIGHT}`
        ]) {
            if (!clip.includes(required)) {
                throw new Error(`Grand Exchange live progress clip com_${offer.clip} lost ${required}`);
            }
        }

        const emptyFill = getComponentBlock(interfaceSource, offer.emptyFill);
        for (const required of [`layer=com_${offer.clip}`, 'type=rect', 'x=0', 'y=0', `width=${PROGRESS_WIDTH}`, `height=${PROGRESS_HEIGHT}`, 'fill=yes', `colour=${EMPTY_PROGRESS_COLOUR}`, `trans=${EMPTY_PROGRESS_TRANSPARENCY}`]) {
            if (!emptyFill.includes(required)) {
                throw new Error(`Grand Exchange live progress empty fill com_${offer.emptyFill} lost ${required}`);
            }
        }

        const fill = getComponentBlock(interfaceSource, offer.fill);
        for (const required of [`layer=com_${offer.clip}`, 'type=rect', 'x=0', 'y=0', `width=${PROGRESS_WIDTH}`, `height=${PROGRESS_HEIGHT}`, 'fill=yes', `colour=${ACTIVE_PROGRESS_COLOUR}`]) {
            if (!fill.includes(required)) {
                throw new Error(`Grand Exchange live progress fill com_${offer.fill} lost ${required}`);
            }
        }

        const amount = getComponentBlock(interfaceSource, offer.amount);
        for (const required of [`layer=com_${offer.activeContent}`, 'type=text', 'x=8', 'y=39', 'width=38', 'height=12', 'font=p11', 'shadowed=yes', 'colour=0xFFFF00']) {
            if (!amount.includes(required)) {
                throw new Error(`Grand Exchange quantity overlay com_${offer.amount} lost ${required}`);
            }
        }

        const priceLabel = getComponentBlock(interfaceSource, offer.priceLabel);
        for (const required of [`layer=com_${offer.activeContent}`, 'type=text', 'x=52', 'y=53', 'width=78', 'height=12', 'font=p11', 'shadowed=yes', 'colour=0xFFFF00']) {
            if (!priceLabel.includes(required)) {
                throw new Error(`Grand Exchange occupied price label com_${offer.priceLabel} lost ${required}`);
            }
        }

        const view = getComponentBlock(interfaceSource, offer.view);
        for (const required of [
            `layer=com_${offer.activeContent}`,
            'buttontype=normal',
            'option=View Offer',
            'type=graphic',
            'x=0',
            'y=0',
            `width=${ACTIVE_OFFER_VIEW_WIDTH}`,
            `height=${ACTIVE_OFFER_VIEW_HEIGHT}`,
            `graphic=${ACTIVE_OFFER_VIEW_CLEAR_GRAPHIC}`,
            `overlayer=com_${offer.hoverLayer}`
        ]) {
            if (!view.includes(required)) {
                throw new Error(`Grand Exchange full-slot View Offer helper com_${offer.view} lost ${required}`);
            }
        }

        const hoverLayer = getComponentBlock(interfaceSource, offer.hoverLayer);
        for (const required of [
            `layer=com_${offer.activeContent}`,
            'type=layer',
            'x=0',
            'y=0',
            `width=${ACTIVE_OFFER_VIEW_WIDTH}`,
            `height=${ACTIVE_OFFER_VIEW_HEIGHT}`,
            `scroll=${ACTIVE_OFFER_VIEW_HEIGHT}`,
            'hide=yes'
        ]) {
            if (!hoverLayer.includes(required)) {
                throw new Error(`Grand Exchange View Offer hover layer com_${offer.hoverLayer} lost ${required}`);
            }
        }

        const hoverGraphic = getComponentBlock(interfaceSource, offer.hoverGraphic);
        for (const required of [
            `layer=com_${offer.hoverLayer}`,
            'type=graphic',
            'x=0',
            'y=0',
            `width=${ACTIVE_OFFER_VIEW_WIDTH}`,
            `height=${ACTIVE_OFFER_VIEW_HEIGHT}`,
            `graphic=${ACTIVE_OFFER_VIEW_HOVER_GRAPHIC}`
        ]) {
            if (!hoverGraphic.includes(required)) {
                throw new Error(`Grand Exchange View Offer hover graphic com_${offer.hoverGraphic} lost ${required}`);
            }
        }

        for (const componentId of [offer.clip, offer.fill, offer.emptyFill, offer.amount, offer.view, offer.hoverLayer, offer.hoverGraphic, offer.priceLabel]) {
            const localId = helperLocalId(componentId);
            const expectedName = `${GE_INTERFACE_NAME}:com_${componentId}`;
            if (values.get(localId) !== expectedName) {
                throw new Error(`Grand Exchange live progress mapping ${localId} != ${expectedName}`);
            }
            if (order.filter(id => id === localId).length !== 1) {
                throw new Error(`Grand Exchange live progress mapping ${localId} must appear exactly once in interface.order`);
            }
        }

        for (const required of [
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.amount}, tostring($quantity_${offer.slot}));`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.priceLabel}, "<tostring($price_${offer.slot})> gp");`,
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, false);`,
            `if ($state_${offer.slot} = ${COMPLETED_STATE}) {`,
            `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${COMPLETED_PROGRESS_COLOUR});`,
            `} else if ($state_${offer.slot} = ${CANCELLED_STATE}) {`,
            `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${CANCELLED_PROGRESS_COLOUR});`,
            `} else if ($state_${offer.slot} = ${PARTIAL_STATE} & $quantity_${offer.slot} > 0 & $filled_${offer.slot} > 0) {`,
            `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${PARTIAL_PROGRESS_COLOUR});`,
            `def_int $progress_scaled_${offer.slot} = multiply($filled_${offer.slot}, ${PROGRESS_WIDTH});`,
            `def_int $progress_pixels_${offer.slot} = divide($progress_scaled_${offer.slot}, $quantity_${offer.slot});`,
            `def_int $progress_offset_${offer.slot} = sub($progress_pixels_${offer.slot}, ${PROGRESS_WIDTH});`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, $progress_offset_${offer.slot}, 0);`,
            `} else if ($state_${offer.slot} = ${ACTIVE_STATE}) {`,
            `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.fill}, ${ACTIVE_PROGRESS_COLOUR});`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, true);`
        ]) {
            if (!refreshSource.includes(required)) {
                throw new Error(`Grand Exchange live progress slot ${offer.slot} is missing ${required}`);
            }
        }
    }

    for (const [componentId, x] of [[COLLECTION_AMOUNT_ONE, 396], [COLLECTION_AMOUNT_TWO, 445]] as const) {
        const amount = getComponentBlock(interfaceSource, componentId);
        for (const required of ['layer=com_200', 'type=text', `x=${x}`, 'y=277', 'width=38', 'height=12', 'font=p11', 'shadowed=yes', 'colour=0xFFFF00']) {
            if (!amount.includes(required)) {
                throw new Error(`Grand Exchange collection amount overlay com_${componentId} lost ${required}`);
            }
        }
        const localId = helperLocalId(componentId);
        const expectedName = `${GE_INTERFACE_NAME}:com_${componentId}`;
        if (values.get(localId) !== expectedName || order.filter(id => id === localId).length !== 1) {
            throw new Error(`Grand Exchange collection amount mapping ${localId} != ${expectedName}`);
        }
    }
}

export async function prepareGrandExchangeLiveProgressStage(stagedContentDir: string) {
    await stageActiveOfferViewSprites(stagedContentDir);
    appendProgressHelpers(stagedContentDir);
    injectProgressHelperMappings(stagedContentDir);
    patchActiveOfferRefresh(stagedContentDir);
    validateLiveProgress(stagedContentDir);
}

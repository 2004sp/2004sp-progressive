import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
// The original r481/r578 GE meter uses a true black one-pixel outline. The
// brown-grey visible at zero progress is the translucent inset added later by
// grand-exchange-live-progress-stage, not the frame itself.
const PROGRESS_FRAME_COLOUR = '0x000000';
// Reuse the exact IF1-compatible render already shown behind the Buy Offer
// search item. It is derived byte-for-byte from r481 sprite 1137.
const ITEM_BOX_GRAPHIC = 'r481_ge_sprite_200136,0';
const PARKED_CONTROL_X = -200;
const PARKED_CONTROL_Y = -200;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, layer: 19, backdrop: 18, backdropX: 37, backdropY: 118, activeContent: 32, model: 33, title: 216, detail: 250, quantity: 30, price: 31, progress: 244, emptyVisuals: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
    {
        name: 'ge_active_offer_2',
        slot: 2,
        layer: 35,
        backdrop: 34,
        backdropX: 193,
        backdropY: 118,
        activeContent: 48,
        model: 49,
        title: 221,
        detail: 251,
        quantity: 46,
        price: 47,
        progress: 245,
        emptyVisuals: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
    },
    {
        name: 'ge_active_offer_3',
        slot: 3,
        layer: 51,
        backdrop: 50,
        backdropX: 349,
        backdropY: 118,
        activeContent: 64,
        model: 65,
        title: 226,
        detail: 252,
        quantity: 62,
        price: 63,
        progress: 246,
        emptyVisuals: [52, 53, 54, 55, 56, 57, 58, 59, 60, 61]
    },
    { name: 'ge_active_offer_4', slot: 4, layer: 70, backdrop: 69, backdropX: 37, backdropY: 238, activeContent: 83, model: 84, title: 231, detail: 253, quantity: 81, price: 82, progress: 247, emptyVisuals: [71, 72, 73, 74, 75, 76, 77, 78, 79, 80] },
    {
        name: 'ge_active_offer_5',
        slot: 5,
        layer: 89,
        backdrop: 88,
        backdropX: 193,
        backdropY: 238,
        activeContent: 102,
        model: 103,
        title: 236,
        detail: 254,
        quantity: 100,
        price: 101,
        progress: 248,
        emptyVisuals: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99]
    },
    {
        name: 'ge_active_offer_6',
        slot: 6,
        layer: 108,
        backdrop: 107,
        backdropX: 349,
        backdropY: 238,
        activeContent: 121,
        model: 122,
        title: 241,
        detail: 255,
        quantity: 119,
        price: 120,
        progress: 249,
        emptyVisuals: [109, 110, 111, 112, 113, 114, 115, 116, 117, 118]
    }
] as const;

function block(source: string, id: number) {
    const marker = `[com_${id}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`GE overview presentation missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, text: source.slice(start, end) };
}

function replaceComponent(source: string, id: number, replacement: string) {
    const { start, end } = block(source, id);
    return source.slice(0, start) + replacement.trimEnd() + source.slice(end);
}

function replaceOnce(source: string, needle: string, replacement: string, label: string) {
    const at = source.indexOf(needle);
    if (at < 0) throw new Error(`GE overview presentation cannot find ${label}`);
    if (source.indexOf(needle, at + needle.length) >= 0) throw new Error(`GE overview presentation found duplicate ${label}`);
    return source.slice(0, at) + replacement + source.slice(at + needle.length);
}

function patchInterface(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const backdrop = block(source, offer.backdrop);
        for (const required of ['layer=com_16', 'type=layer', `x=${offer.backdropX - 7}`, `y=${offer.backdropY - 38}`, 'width=140', 'height=110', 'scroll=110']) {
            if (!backdrop.text.includes(required)) {
                throw new Error(`GE item-box host com_${offer.backdrop} no longer contains ${required}`);
            }
        }

        // These six source layers are empty-state placeholders. Reuse them as
        // the authentic 40x36 sprite-1137 item boxes. The original r481 Buy
        // Offer layout authors its box and item model as ordered siblings under
        // the same layer (com_136 before com_138); mirror that arrangement here.
        // Lost City's IF1 packer preserves child declaration order, so inserting
        // immediately before the model guarantees the box paints behind it.
        source = source.slice(0, backdrop.start) + source.slice(backdrop.end);
        const modelMarker = `[com_${offer.model}]`;
        const modelAt = source.indexOf(modelMarker);
        if (modelAt < 0) {
            throw new Error(`GE item-box host cannot find ${modelMarker}`);
        }
        const itemBox = `[com_${offer.backdrop}]\nlayer=com_${offer.activeContent}\ntype=graphic\nx=7\ny=38\nwidth=40\nheight=36\ngraphic=${ITEM_BOX_GRAPHIC}\n\n`;
        source = source.slice(0, modelAt) + itemBox + source.slice(modelAt);

        const detail = block(source, offer.detail).text;
        if (!detail.includes(`layer=com_${offer.layer}`) || !detail.includes('type=text')) {
            throw new Error(`GE detail com_${offer.detail} source shape changed`);
        }
        source = replaceComponent(source, offer.detail, `[com_${offer.detail}]\nlayer=com_${offer.activeContent}\ntype=text\nx=46\ny=32\nwidth=88\nheight=16\nfont=p11\nshadowed=yes\ntext=\ncolour=0xCC9800\n`);

        const progress = block(source, offer.progress).text;
        if (!progress.includes(`layer=com_${offer.layer}`) || !progress.includes('type=rect')) {
            throw new Error(`GE progress com_${offer.progress} source shape changed`);
        }
        // Keep this rectangle unfilled: the original client draws a one-pixel
        // black outline here. If it is filled, the translucent empty-progress
        // inset composites against solid black and appears almost black too.
        source = replaceComponent(source, offer.progress, `[com_${offer.progress}]\nlayer=com_${offer.activeContent}\ntype=rect\nx=7\ny=80\nwidth=126\nheight=15\ncolour=${PROGRESS_FRAME_COLOUR}\n`);
    }
    fs.writeFileSync(file, source, 'utf8');
}

function patchRefresh(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const activeVisible = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.activeContent}, false);`;
        source = replaceOnce(source, activeVisible, `${activeVisible}\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.backdrop}, false);`, `slot ${offer.slot} occupied item box`);

        const activeHidden = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.activeContent}, true);`;
        source = replaceOnce(source, activeHidden, `${activeHidden}\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.backdrop}, true);`, `slot ${offer.slot} empty item box`);

        // IF_SETPOSITION is an offset from the IF1-authored child position, not
        // an absolute coordinate. Reset to 0,0 or the authored position is added
        // twice (the cause of the hitboxes appearing below the Buy/Sell icons).
        for (const id of offer.emptyVisuals) {
            const hidden = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, true);`;
            source = replaceOnce(source, hidden, `${hidden}\n    if_setposition(${GE_INTERFACE_NAME}:com_${id}, ${PARKED_CONTROL_X}, ${PARKED_CONTROL_Y});`, `slot ${offer.slot} occupied empty visual com_${id}`);

            const visible = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, false);`;
            source = replaceOnce(source, visible, `${visible}\n    if_setposition(${GE_INTERFACE_NAME}:com_${id}, 0, 0);`, `slot ${offer.slot} empty visual com_${id}`);
        }

        // Keep the original Buy action hidden while a slot is occupied. The
        // quantity is rendered by a dedicated active-content overlay later in
        // the live-progress stage so it can sit above the item model inside the
        // top-left corner of the item box without being covered by that model.
        const occupiedQuantity = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.quantity}, true);`;
        source = replaceOnce(source, occupiedQuantity, `${occupiedQuantity}\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, false);`, `slot ${offer.slot} occupied quantity control`);

        const emptyQuantity = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.quantity}, false);`;
        source = replaceOnce(source, emptyQuantity, `${emptyQuantity}\n    if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0, 0);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0x000000);\n    if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, "");\n    if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, true);`, `slot ${offer.slot} empty quantity control`);

        // Keep the original Sell hitbox a real Sell button only while the slot is
        // empty. Reusing it as the occupied price label leaks "Sell" into the
        // context menu, even though its text has been changed to the price.
        const occupiedPrice = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.price}, true);`;
        source = replaceOnce(
            source,
            occupiedPrice,
            `${occupiedPrice}\n    if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, ${PARKED_CONTROL_X}, ${PARKED_CONTROL_Y});\n    if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0x000000);\n    if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, "");`,
            `slot ${offer.slot} occupied Sell action`
        );

        const emptyPrice = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.price}, false);`;
        source = replaceOnce(
            source,
            emptyPrice,
            `${emptyPrice}\n    if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, 0, 0);\n    if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0x000000);\n    if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, "");`,
            `slot ${offer.slot} empty Sell action`
        );

        source = source.replaceAll(`if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, "Buying");`, `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, "Buy");`);
        source = source.replaceAll(`if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, "Selling");`, `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, "Sell");`);

        const compact = `if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, oc_name($item_${offer.slot}));`;
        const renderers = [
            [`    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, "<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp");`, '    '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, "<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp");`, '        '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, "Complete: <oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp");`, '        '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, "Cancelled: <oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp");`, '        ']
        ] as const;
        for (const [needle, indent] of renderers) {
            if (!source.includes(needle)) throw new Error(`GE slot ${offer.slot} detail renderer changed`);
            source = source.replace(needle, `${indent}${compact}`);
        }
    }

    fs.writeFileSync(file, source, 'utf8');
}

function validate(stagedContentDir: string) {
    const interfaceSource = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`), 'utf8').replace(/\r/g, '');
    const refreshSource = fs.readFileSync(path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2'), 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const itemBox = block(interfaceSource, offer.backdrop).text;
        const activeContentAt = interfaceSource.indexOf(`[com_${offer.activeContent}]`);
        const itemBoxAt = interfaceSource.indexOf(`[com_${offer.backdrop}]`);
        const itemModelAt = interfaceSource.indexOf(`[com_${offer.model}]`);
        if (
            !itemBox.includes(`layer=com_${offer.activeContent}`) ||
            !itemBox.includes('type=graphic') ||
            !itemBox.includes('x=7') ||
            !itemBox.includes('y=38') ||
            !itemBox.includes(`graphic=${ITEM_BOX_GRAPHIC}`) ||
            !(activeContentAt < itemBoxAt && itemBoxAt < itemModelAt)
        ) {
            throw new Error(`GE slot ${offer.slot} item box is not an ordered sibling behind its active item model`);
        }
        const itemModel = block(interfaceSource, offer.model).text;
        for (const required of [`layer=com_${offer.activeContent}`, 'type=model', 'x=9', 'y=40', 'width=36', 'height=32']) {
            if (!itemModel.includes(required)) {
                throw new Error(`GE slot ${offer.slot} item model is not inset inside its item box`);
            }
        }
        for (const hidden of ['false', 'true']) {
            if (!refreshSource.includes(`if_sethide(${GE_INTERFACE_NAME}:com_${offer.backdrop}, ${hidden});`)) {
                throw new Error(`GE slot ${offer.slot} item box does not handle ${hidden === 'false' ? 'occupied' : 'empty'} visibility`);
            }
        }
        if (!block(interfaceSource, offer.progress).text.includes(`layer=com_${offer.activeContent}`)) {
            throw new Error(`GE progress com_${offer.progress} is not active-only`);
        }
        for (const id of offer.emptyVisuals) {
            if (!refreshSource.includes(`if_setposition(${GE_INTERFACE_NAME}:com_${id}, ${PARKED_CONTROL_X}, ${PARKED_CONTROL_Y});`) || !refreshSource.includes(`if_setposition(${GE_INTERFACE_NAME}:com_${id}, 0, 0);`)) {
                throw new Error(`GE slot ${offer.slot} empty visual com_${id} offset handling missing`);
            }
        }
        for (const id of [offer.quantity, offer.price]) {
            if (!refreshSource.includes(`if_setposition(${GE_INTERFACE_NAME}:com_${id}, 0, 0);`)) {
                throw new Error(`GE slot ${offer.slot} action com_${id} does not reset to authored position`);
            }
        }
    }
}

export function prepareGrandExchangeActiveOfferOverviewPresentationStage(stagedContentDir: string) {
    patchInterface(stagedContentDir);
    patchRefresh(stagedContentDir);
    validate(stagedContentDir);
}

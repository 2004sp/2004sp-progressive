import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const PENDING_PROGRESS_COLOUR = '0x211D19';
const PARKED_CONTROL_X = -200;
const PARKED_CONTROL_Y = -200;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, layer: 19, activeContent: 32, title: 216, detail: 250, quantity: 30, price: 31, progress: 244, emptyVisuals: [20,21,22,23,24,25,26,27,28,29] },
    { name: 'ge_active_offer_2', slot: 2, layer: 35, activeContent: 48, title: 221, detail: 251, quantity: 46, price: 47, progress: 245, emptyVisuals: [36,37,38,39,40,41,42,43,44,45] },
    { name: 'ge_active_offer_3', slot: 3, layer: 51, activeContent: 64, title: 226, detail: 252, quantity: 62, price: 63, progress: 246, emptyVisuals: [52,53,54,55,56,57,58,59,60,61] },
    { name: 'ge_active_offer_4', slot: 4, layer: 70, activeContent: 83, title: 231, detail: 253, quantity: 81, price: 82, progress: 247, emptyVisuals: [71,72,73,74,75,76,77,78,79,80] },
    { name: 'ge_active_offer_5', slot: 5, layer: 89, activeContent: 102, title: 236, detail: 254, quantity: 100, price: 101, progress: 248, emptyVisuals: [90,91,92,93,94,95,96,97,98,99] },
    { name: 'ge_active_offer_6', slot: 6, layer: 108, activeContent: 121, title: 241, detail: 255, quantity: 119, price: 120, progress: 249, emptyVisuals: [109,110,111,112,113,114,115,116,117,118] },
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
        const detail = block(source, offer.detail).text;
        if (!detail.includes(`layer=com_${offer.layer}`) || !detail.includes('type=text')) {
            throw new Error(`GE detail com_${offer.detail} source shape changed`);
        }
        source = replaceComponent(
            source,
            offer.detail,
            `[com_${offer.detail}]\nlayer=com_${offer.activeContent}\ntype=text\nx=46\ny=32\nwidth=88\nheight=16\nfont=p11\nshadowed=yes\ntext=\ncolour=0xCC9800\n`
        );

        const progress = block(source, offer.progress).text;
        if (!progress.includes(`layer=com_${offer.layer}`) || !progress.includes('type=rect')) {
            throw new Error(`GE progress com_${offer.progress} source shape changed`);
        }
        source = replaceComponent(
            source,
            offer.progress,
            `[com_${offer.progress}]\nlayer=com_${offer.activeContent}\ntype=rect\nx=7\ny=82\nwidth=126\nheight=14\nfill=yes\ncolour=${PENDING_PROGRESS_COLOUR}\n`
        );
    }
    fs.writeFileSync(file, source, 'utf8');
}

function reuseActionWidget(
    source: string,
    id: number,
    occupied: readonly string[],
    empty: readonly string[],
    label: string
) {
    const hidden = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, true);`;
    source = replaceOnce(
        source,
        hidden,
        [`    if_sethide(${GE_INTERFACE_NAME}:com_${id}, false);`, ...occupied.map(line => `    ${line}`)].join('\n'),
        `${label} occupied`
    );
    const visible = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, false);`;
    const at = source.lastIndexOf(visible);
    if (at < 0) throw new Error(`GE overview presentation cannot find ${label} empty`);
    const replacement = [visible, ...empty.map(line => `    ${line}`)].join('\n');
    return source.slice(0, at) + replacement + source.slice(at + visible.length);
}

function patchRefresh(stagedContentDir: string) {
    const file = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        // IF_SETPOSITION is an offset from the IF1-authored child position, not
        // an absolute coordinate. Reset to 0,0 or the authored position is added
        // twice (the cause of the hitboxes appearing below the Buy/Sell icons).
        for (const id of offer.emptyVisuals) {
            const hidden = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, true);`;
            source = replaceOnce(
                source,
                hidden,
                `${hidden}\n    if_setposition(${GE_INTERFACE_NAME}:com_${id}, ${PARKED_CONTROL_X}, ${PARKED_CONTROL_Y});`,
                `slot ${offer.slot} occupied empty visual com_${id}`
            );

            const visible = `    if_sethide(${GE_INTERFACE_NAME}:com_${id}, false);`;
            source = replaceOnce(
                source,
                visible,
                `${visible}\n    if_setposition(${GE_INTERFACE_NAME}:com_${id}, 0, 0);`,
                `slot ${offer.slot} empty visual com_${id}`
            );
        }

        source = reuseActionWidget(
            source,
            offer.quantity,
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, -6, -12);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0xFFFF00);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, tostring($quantity_${offer.slot}));`,
                `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, false);`,
            ],
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0, 0);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.quantity}, 0x000000);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.quantity}, \"\");`,
                `if_sethide(${GE_INTERFACE_NAME}:com_${offer.progress}, true);`,
            ],
            `slot ${offer.slot} Buy action`
        );

        source = reuseActionWidget(
            source,
            offer.price,
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, -24, 10);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0xFFFF00);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, \"<tostring($price_${offer.slot})> gp\");`,
            ],
            [
                `if_setposition(${GE_INTERFACE_NAME}:com_${offer.price}, 0, 0);`,
                `if_setcolour(${GE_INTERFACE_NAME}:com_${offer.price}, 0x000000);`,
                `if_settext(${GE_INTERFACE_NAME}:com_${offer.price}, \"\");`,
            ],
            `slot ${offer.slot} Sell action`
        );

        source = source.replaceAll(
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buying\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buy\");`
        );
        source = source.replaceAll(
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Selling\");`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sell\");`
        );

        const compact = `if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, oc_name($item_${offer.slot}));`;
        const renderers = [
            [`    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`, '    '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`, '        '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Complete: <oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`, '        '],
            [`        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Cancelled: <oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`, '        '],
        ] as const;
        for (const [needle, indent] of renderers) {
            if (!source.includes(needle)) throw new Error(`GE slot ${offer.slot} detail renderer changed`);
            source = source.replace(needle, `${indent}${compact}`);
        }
    }

    fs.writeFileSync(file, source, 'utf8');
}

function validate(stagedContentDir: string) {
    const interfaceSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`),
        'utf8'
    ).replace(/\r/g, '');
    const refreshSource = fs.readFileSync(
        path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2'),
        'utf8'
    ).replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        if (!block(interfaceSource, offer.progress).text.includes(`layer=com_${offer.activeContent}`)) {
            throw new Error(`GE progress com_${offer.progress} is not active-only`);
        }
        for (const id of offer.emptyVisuals) {
            if (!refreshSource.includes(`if_setposition(${GE_INTERFACE_NAME}:com_${id}, ${PARKED_CONTROL_X}, ${PARKED_CONTROL_Y});`) ||
                !refreshSource.includes(`if_setposition(${GE_INTERFACE_NAME}:com_${id}, 0, 0);`)) {
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

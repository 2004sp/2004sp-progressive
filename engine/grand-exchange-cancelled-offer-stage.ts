import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const ACTIVE_ITEM_SLOT = 0;
const ACTIVE_QUANTITY_SLOT = 2;
const ACTIVE_STATE_SLOT = 5;
const ACTIVE_FILLED_SLOT = 6;
const ACTIVE_STATE = 1;
const PARTIAL_STATE = 2;
const COMPLETED_STATE = 3;
const CANCELLED_STATE = 4;
const BUY_MODE = 1;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, title: 216, detail: 250 },
    { name: 'ge_active_offer_2', slot: 2, title: 221, detail: 251 },
    { name: 'ge_active_offer_3', slot: 3, title: 226, detail: 252 },
    { name: 'ge_active_offer_4', slot: 4, title: 231, detail: 253 },
    { name: 'ge_active_offer_5', slot: 5, title: 236, detail: 254 },
    { name: 'ge_active_offer_6', slot: 6, title: 241, detail: 255 },
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

function patchActiveOfferRefresh(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_active_offer.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange cancelled-offer refresh script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    for (const offer of ACTIVE_OFFERS) {
        const completedTitleBlock = [
            `    if ($state_${offer.slot} = ${COMPLETED_STATE} & $filled_${offer.slot} = $quantity_${offer.slot}) {`,
            `        if ($mode_${offer.slot} = ${BUY_MODE}) {`,
            `            if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Bought\");`,
            '        } else {',
            `            if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sold\");`,
            '        }',
            `    } else if ($mode_${offer.slot} = ${BUY_MODE}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buying\");`,
            '    } else {',
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Selling\");`,
            '    }',
        ].join('\n');
        const cancelledTitleBlock = [
            `    if ($state_${offer.slot} = ${CANCELLED_STATE} & $filled_${offer.slot} >= 0 & $filled_${offer.slot} < $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Cancelled\");`,
            `    } else if ($state_${offer.slot} = ${COMPLETED_STATE} & $filled_${offer.slot} = $quantity_${offer.slot}) {`,
            `        if ($mode_${offer.slot} = ${BUY_MODE}) {`,
            `            if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Bought\");`,
            '        } else {',
            `            if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Sold\");`,
            '        }',
            `    } else if ($mode_${offer.slot} = ${BUY_MODE}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Buying\");`,
            '    } else {',
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Selling\");`,
            '    }',
        ].join('\n');
        if (!source.includes(completedTitleBlock)) {
            throw new Error(`Grand Exchange cancelled-offer state cannot find the completed title renderer for slot ${offer.slot}`);
        }
        source = source.replace(completedTitleBlock, cancelledTitleBlock);

        const activeDetail = `    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`;
        const completedDetailBlock = [
            `    if ($state_${offer.slot} = ${COMPLETED_STATE} & $filled_${offer.slot} = $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Complete: <oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`,
            `    } else if ($state_${offer.slot} = ${PARTIAL_STATE} & $filled_${offer.slot} > 0 & $filled_${offer.slot} < $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`,
            '    } else {',
            activeDetail,
            '    }',
        ].join('\n');
        const cancelledDetailBlock = [
            `    if ($state_${offer.slot} = ${CANCELLED_STATE} & $filled_${offer.slot} >= 0 & $filled_${offer.slot} < $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Cancelled: <oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`,
            `    } else if ($state_${offer.slot} = ${COMPLETED_STATE} & $filled_${offer.slot} = $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"Complete: <oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`,
            `    } else if ($state_${offer.slot} = ${PARTIAL_STATE} & $filled_${offer.slot} > 0 & $filled_${offer.slot} < $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`,
            '    } else {',
            activeDetail,
            '    }',
        ].join('\n');
        if (!source.includes(completedDetailBlock)) {
            throw new Error(`Grand Exchange cancelled-offer state cannot find the completed detail renderer for slot ${offer.slot}`);
        }
        source = source.replace(completedDetailBlock, cancelledDetailBlock);
    }

    source = source.replace(
        '// the client never decides whether a slot is occupied, partially filled or completed.\n// Matching, cancellation, collection, wealth reservation and restart persistence remain',
        '// the client never decides whether a slot is occupied, partially filled, completed or cancelled.\n// Matching, collection, wealth reservation and restart persistence remain'
    );
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildCancelledOfferScript() {
    const branches = ACTIVE_OFFERS.map((offer, index) => {
        const prefix = index === 0 ? 'if' : 'else if';
        return `${prefix} ($offer_slot = ${offer.slot}) {\n    if (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) <= 0) return;\n    def_int $requested_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_QUANTITY_SLOT});\n    def_int $state_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_STATE_SLOT});\n    def_int $filled_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});\n    if ($requested_${offer.slot} <= 0) return;\n    if ($state_${offer.slot} != ${ACTIVE_STATE} & $state_${offer.slot} != ${PARTIAL_STATE}) return;\n    if ($filled_${offer.slot} < 0 | $filled_${offer.slot} >= $requested_${offer.slot}) return;\n    // Cancellation preserves all authoritative fill progress. The later economy\n    // phase will derive collectible bought items/proceeds and recover only the\n    // unfilled reservation; this milestone must not manufacture that output.\n    inv_setslot(${offer.name}, ${ACTIVE_STATE_SLOT}, coins, ${CANCELLED_STATE});\n}`;
    }).join('\n');

    return `// Option-2-only authoritative cancelled/aborted-offer transition.\n// The r481 flow allows an outstanding offer to be aborted while retaining any\n// already-filled portion for collection. This server procedure owns that state\n// transition, keeps the slot occupied, and deliberately does not refund/move\n// wealth until the persistent reservation/collection economy exists.\n\n[proc,ge_active_offer_apply_cancelled](int $offer_slot)\nif (map_feature(\"grandexchange\") = false) return;\nif ($offer_slot < 1 | $offer_slot > 6) return;\n${branches}\n~ge_active_offer_refresh;\n`;
}

function writeCancelledOfferScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_cancelled_offer.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildCancelledOfferScript(), 'utf8');
}

function injectCancelledOfferScriptMapping(stagedContentDir: string) {
    const triggerName = '[proc,ge_active_offer_apply_cancelled]';
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    if ([...values.values()].includes(triggerName)) return;

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

function validateCancelledOfferStage(stagedContentDir: string) {
    const refreshPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    const refresh = fs.readFileSync(refreshPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        for (const required of [
            `$state_${offer.slot} = ${CANCELLED_STATE} & $filled_${offer.slot} >= 0 & $filled_${offer.slot} < $quantity_${offer.slot}`,
            `if_settext(${GE_INTERFACE_NAME}:com_${offer.title}, \"Cancelled\");`,
            `Cancelled: <oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp`,
        ]) {
            if (!refresh.includes(required)) {
                throw new Error(`Grand Exchange cancelled-offer refresh for slot ${offer.slot} is missing ${required}`);
            }
        }
    }

    const completedScriptPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_completed_offer.rs2');
    const completedScript = fs.readFileSync(completedScriptPath, 'utf8').replace(/\r/g, '');
    if (!completedScript.includes(`if ($state_1 < ${ACTIVE_STATE} | $state_1 > ${PARTIAL_STATE}) return;`)) {
        throw new Error('Grand Exchange cancelled-offer state requires completion to reject cancelled offers');
    }

    const cancelledScriptPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_cancelled_offer.rs2');
    const cancelledScript = fs.readFileSync(cancelledScriptPath, 'utf8').replace(/\r/g, '');
    for (const required of [
        '[proc,ge_active_offer_apply_cancelled](int $offer_slot)',
        `if ($state_1 != ${ACTIVE_STATE} & $state_1 != ${PARTIAL_STATE}) return;`,
        'if ($filled_1 < 0 | $filled_1 >= $requested_1) return;',
        `inv_setslot(${ACTIVE_OFFERS[0].name}, ${ACTIVE_STATE_SLOT}, coins, ${CANCELLED_STATE});`,
        '~ge_active_offer_refresh;',
    ]) {
        if (!cancelledScript.includes(required)) {
            throw new Error(`Grand Exchange cancelled-offer transition is missing ${required}`);
        }
    }
    if (cancelledScript.includes(`inv_setslot(${ACTIVE_OFFERS[0].name}, ${ACTIVE_FILLED_SLOT}`)) {
        throw new Error('Grand Exchange cancellation must preserve the authoritative filled quantity');
    }
    if (cancelledScript.includes(`inv_clear(${ACTIVE_OFFERS[0].name})`)) {
        throw new Error('Grand Exchange cancellation must keep the offer slot occupied for later collection');
    }
}

export function prepareGrandExchangeCancelledOfferStage(stagedContentDir: string) {
    patchActiveOfferRefresh(stagedContentDir);
    writeCancelledOfferScript(stagedContentDir);
    injectCancelledOfferScriptMapping(stagedContentDir);
    validateCancelledOfferStage(stagedContentDir);
}

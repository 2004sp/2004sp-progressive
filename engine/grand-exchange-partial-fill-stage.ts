import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const OFFER_SUBMISSION_INV = 'ge_offer_submission';
const ACTIVE_ITEM_SLOT = 0;
const ACTIVE_QUANTITY_SLOT = 2;
const ACTIVE_STATE_SLOT = 5;
const ACTIVE_FILLED_SLOT = 6;
const PARTIAL_STATE = 2;

const ACTIVE_OFFERS = [
    { name: 'ge_active_offer_1', slot: 1, detail: 250 },
    { name: 'ge_active_offer_2', slot: 2, detail: 251 },
    { name: 'ge_active_offer_3', slot: 3, detail: 252 },
    { name: 'ge_active_offer_4', slot: 4, detail: 253 },
    { name: 'ge_active_offer_5', slot: 5, detail: 254 },
    { name: 'ge_active_offer_6', slot: 6, detail: 255 },
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

function getConfigBlock(source: string, name: string) {
    const marker = `[${name}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange partial-fill state is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchActiveOfferInventoryConfig(stagedContentDir: string) {
    const configPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'configs',
        'grand_exchange_active_offer.inv'
    );
    if (!fs.existsSync(configPath)) {
        throw new Error(`Grand Exchange partial-fill inventory config is missing: ${configPath}`);
    }

    let source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const { start, end, block } = getConfigBlock(source, offer.name);
        if (!block.includes('size=6')) {
            throw new Error(`Grand Exchange partial-fill state expected ${offer.name} to have size=6 before extension`);
        }
        const replacement = block.replace('size=6', 'size=7');
        source = source.slice(0, start) + replacement + source.slice(end);
    }

    source = source.replace(
        '// price, total and status. scope=temp is intentional for this milestone.',
        '// price, total, status and authoritative filled quantity. scope=temp is intentional for this milestone.'
    );
    fs.writeFileSync(configPath, source, 'utf8');
}

function patchFreshSubmissionInitialization(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_offer_submission.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange partial-fill submission script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const move = `inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.name}, $item, 1);`;
        const reset = `inv_clear(${offer.name});\n    ${move}`;
        if (!source.includes(move)) {
            throw new Error(`Grand Exchange partial-fill state cannot find the commit move for ${offer.name}`);
        }
        if (!source.includes(`inv_clear(${offer.name});`)) {
            source = source.replace(move, reset);
        }
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
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
        throw new Error(`Grand Exchange partial-fill refresh script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const priceLine = `    def_int $price_${offer.slot} = inv_getnum(${offer.name}, 3);`;
        const stateLines = [
            priceLine,
            `    def_int $state_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_STATE_SLOT});`,
            `    def_int $filled_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});`,
        ].join('\n');
        if (!source.includes(priceLine)) {
            throw new Error(`Grand Exchange partial-fill state cannot find the price read for slot ${offer.slot}`);
        }
        if (!source.includes(`def_int $filled_${offer.slot}`)) {
            source = source.replace(priceLine, stateLines);
        }

        const detailLine = `    if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> x<tostring($quantity_${offer.slot})> @ <tostring($price_${offer.slot})> gp\");`;
        const partialDetail = [
            `    if ($state_${offer.slot} = ${PARTIAL_STATE} & $filled_${offer.slot} > 0 & $filled_${offer.slot} < $quantity_${offer.slot}) {`,
            `        if_settext(${GE_INTERFACE_NAME}:com_${offer.detail}, \"<oc_name($item_${offer.slot})> <tostring($filled_${offer.slot})>/<tostring($quantity_${offer.slot})> filled @ <tostring($price_${offer.slot})> gp\");`,
            '    } else {',
            detailLine,
            '    }',
        ].join('\n');
        if (!source.includes(detailLine)) {
            throw new Error(`Grand Exchange partial-fill state cannot find the detail renderer for slot ${offer.slot}`);
        }
        if (!source.includes(`$state_${offer.slot} = ${PARTIAL_STATE}`)) {
            source = source.replace(detailLine, partialDetail);
        }
    }

    source = source.replace(
        '// the client never decides whether a slot is occupied. Matching, partial fills,\n// cancellation, collection, wealth reservation and restart persistence remain',
        '// the client never decides whether a slot is occupied or partially filled.\n// Matching, completion, cancellation, collection, wealth reservation and restart persistence remain'
    );
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function buildPartialFillScript() {
    const branches = ACTIVE_OFFERS.map((offer, index) => {
        const prefix = index === 0 ? 'if' : 'else if';
        return `${prefix} ($offer_slot = ${offer.slot}) {\n    if (inv_getnum(${offer.name}, ${ACTIVE_ITEM_SLOT}) <= 0) return;\n    def_int $requested_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_QUANTITY_SLOT});\n    def_int $filled_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});\n    def_int $remaining_${offer.slot} = $requested_${offer.slot} - $filled_${offer.slot};\n    if ($requested_${offer.slot} <= 0) return;\n    if ($filled_${offer.slot} < 0 | $filled_${offer.slot} >= $requested_${offer.slot}) return;\n    // This milestone owns only the strictly-partial transition. A fill that\n    // consumes the exact remainder belongs to the completed-offer milestone.\n    if ($fill_quantity >= $remaining_${offer.slot}) return;\n    def_int $next_filled_${offer.slot} = $filled_${offer.slot} + $fill_quantity;\n    inv_setslot(${offer.name}, ${ACTIVE_FILLED_SLOT}, coins, $next_filled_${offer.slot});\n    inv_setslot(${offer.name}, ${ACTIVE_STATE_SLOT}, coins, ${PARTIAL_STATE});\n}`;
    }).join('\n');

    return `// Option-2-only authoritative partial-fill transition.\n// Future matching code must report fills through this server procedure instead of\n// asking the client to infer progress. This phase does not reserve/move wealth or\n// manufacture collection output; it only records strictly-partial progress.\n\n[proc,ge_active_offer_apply_partial_fill](int $offer_slot, int $fill_quantity)\nif (map_feature(\"grandexchange\") = false) return;\nif ($offer_slot < 1 | $offer_slot > 6) return;\nif ($fill_quantity <= 0) return;\n${branches}\n~ge_active_offer_refresh;\n`;
}

function writePartialFillScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_partial_fill.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, buildPartialFillScript(), 'utf8');
}

function injectPartialFillScriptMapping(stagedContentDir: string) {
    const triggerName = '[proc,ge_active_offer_apply_partial_fill]';
    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    if ([...values.values()].includes(triggerName)) return;

    const maxId = Math.max(-1, ...values.keys());
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, `${normalized}${maxId + 1}=${triggerName}\n`, 'utf8');
}

function validatePartialFillStage(stagedContentDir: string) {
    const configPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'configs', 'grand_exchange_active_offer.inv');
    const config = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const { block } = getConfigBlock(config, offer.name);
        if (!block.includes('size=7')) {
            throw new Error(`Grand Exchange partial-fill state did not extend ${offer.name} to seven fields`);
        }
    }

    const submissionPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_offer_submission.rs2');
    const submission = fs.readFileSync(submissionPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        if (!submission.includes(`inv_clear(${offer.name});\n    inv_moveitem(${OFFER_SUBMISSION_INV}, ${offer.name}, $item, 1);`)) {
            throw new Error(`Grand Exchange partial-fill state did not make slot ${offer.slot} submission start from a clean container`);
        }
    }

    const refreshPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    const refresh = fs.readFileSync(refreshPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        for (const required of [
            `def_int $state_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_STATE_SLOT});`,
            `def_int $filled_${offer.slot} = inv_getnum(${offer.name}, ${ACTIVE_FILLED_SLOT});`,
            `$state_${offer.slot} = ${PARTIAL_STATE} & $filled_${offer.slot} > 0 & $filled_${offer.slot} < $quantity_${offer.slot}`,
        ]) {
            if (!refresh.includes(required)) {
                throw new Error(`Grand Exchange partial-fill refresh for slot ${offer.slot} is missing ${required}`);
            }
        }
    }

    const partialScriptPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_partial_fill.rs2');
    const partialScript = fs.readFileSync(partialScriptPath, 'utf8').replace(/\r/g, '');
    for (const required of [
        '[proc,ge_active_offer_apply_partial_fill](int $offer_slot, int $fill_quantity)',
        'if ($fill_quantity <= 0) return;',
        'if ($fill_quantity >= $remaining_1) return;',
        `inv_setslot(${ACTIVE_OFFERS[0].name}, ${ACTIVE_FILLED_SLOT}, coins, $next_filled_1);`,
        `inv_setslot(${ACTIVE_OFFERS[0].name}, ${ACTIVE_STATE_SLOT}, coins, ${PARTIAL_STATE});`,
        '~ge_active_offer_refresh;',
    ]) {
        if (!partialScript.includes(required)) {
            throw new Error(`Grand Exchange partial-fill transition is missing ${required}`);
        }
    }
}

export function prepareGrandExchangePartialFillStage(stagedContentDir: string) {
    patchActiveOfferInventoryConfig(stagedContentDir);
    patchFreshSubmissionInitialization(stagedContentDir);
    patchActiveOfferRefresh(stagedContentDir);
    writePartialFillScript(stagedContentDir);
    injectPartialFillScriptMapping(stagedContentDir);
    validatePartialFillStage(stagedContentDir);
}

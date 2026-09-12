import fs from 'fs';
import path from 'path';

import { prepareGrandExchangePersistedHistoryRuntime, restoreGrandExchangePersistedHistoryRuntime } from './grand-exchange-persisted-history-runtime-stage.js';

const OFFER_SUBMISSION = path.join('scripts', 'grand_exchange', 'scripts', 'grand_exchange_offer_submission.rs2');
const PARTIAL = path.join('scripts', 'grand_exchange', 'scripts', 'grand_exchange_partial_fill.rs2');
const COMPLETED = path.join('scripts', 'grand_exchange', 'scripts', 'grand_exchange_completed_offer.rs2');
const CANCELLED = path.join('scripts', 'grand_exchange', 'scripts', 'grand_exchange_cancelled_offer.rs2');
const HISTORY = path.join('scripts', 'grand_exchange', 'scripts', 'grand_exchange_history.rs2');

const OFFERS = [
    { name: 'ge_active_offer_1', slot: 1 }, { name: 'ge_active_offer_2', slot: 2 },
    { name: 'ge_active_offer_3', slot: 3 }, { name: 'ge_active_offer_4', slot: 4 },
    { name: 'ge_active_offer_5', slot: 5 }, { name: 'ge_active_offer_6', slot: 6 },
] as const;

const ROWS = [
    { row: 0, type: 25, quantity: 30, name: 35, price: 40, model: 51, status: 56, timestamp: 61 },
    { row: 1, type: 26, quantity: 31, name: 36, price: 41, model: 52, status: 57, timestamp: 62 },
    { row: 2, type: 27, quantity: 32, name: 37, price: 42, model: 53, status: 58, timestamp: 63 },
    { row: 3, type: 28, quantity: 33, name: 38, price: 43, model: 54, status: 59, timestamp: 64 },
    { row: 4, type: 29, quantity: 34, name: 39, price: 44, model: 55, status: 60, timestamp: 65 },
] as const;

export { restoreGrandExchangePersistedHistoryRuntime };

function scriptBlock(source: string, marker: string) {
    // RuneScript trigger names can also appear in comments. Only match a trigger
    // when the marker occupies an actual source line, never a prose substring.
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) throw new Error(`GE persisted history is missing trigger ${marker}`);
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    return { start, end: next < 0 ? source.length : next, block: source.slice(start, next < 0 ? source.length : next) };
}

function patchRuneScriptArithmetic(root: string) {
    const partialFile = path.join(root, PARTIAL);
    let partial = fs.readFileSync(partialFile, 'utf8').replace(/\r/g, '');
    for (const offer of OFFERS) {
        const remainingInline = `def_int $remaining_${offer.slot} = $requested_${offer.slot} - $filled_${offer.slot};`;
        const remainingCommand = `def_int $remaining_${offer.slot} = sub($requested_${offer.slot}, $filled_${offer.slot});`;
        const nextInline = `def_int $next_filled_${offer.slot} = $filled_${offer.slot} + $fill_quantity;`;
        const nextCommand = `def_int $next_filled_${offer.slot} = add($filled_${offer.slot}, $fill_quantity);`;
        if (!partial.includes(remainingInline)) throw new Error(`Cannot find GE partial remaining arithmetic for slot ${offer.slot}`);
        if (!partial.includes(nextInline)) throw new Error(`Cannot find GE partial next-filled arithmetic for slot ${offer.slot}`);
        partial = partial.replace(remainingInline, remainingCommand).replace(nextInline, nextCommand);
    }
    fs.writeFileSync(partialFile, partial, 'utf8');

    const completedFile = path.join(root, COMPLETED);
    let completed = fs.readFileSync(completedFile, 'utf8').replace(/\r/g, '');
    for (const offer of OFFERS) {
        const remainingInline = `def_int $remaining_${offer.slot} = $requested_${offer.slot} - $filled_${offer.slot};`;
        const remainingCommand = `def_int $remaining_${offer.slot} = sub($requested_${offer.slot}, $filled_${offer.slot});`;
        if (!completed.includes(remainingInline)) throw new Error(`Cannot find GE completed remaining arithmetic for slot ${offer.slot}`);
        completed = completed.replace(remainingInline, remainingCommand);
    }
    fs.writeFileSync(completedFile, completed, 'utf8');
}

function patchSubmission(root: string) {
    const file = path.join(root, OFFER_SUBMISSION);
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const marker = '[if_button,grand_exchange_overview:com_190]';
    const current = scriptBlock(source, marker);
    const commit = 'inv_clear(ge_offer_submission);\ninv_moveitem(ge_selected_item, ge_offer_submission, $item, 1);';
    if (!current.block.includes(commit)) throw new Error('Cannot find GE Confirm Offer commit boundary');
    const guard = `if (ge_history_record($offer_slot, $item, $mode, $quantity, $price) = false) {\n    mes("Your Grand Exchange offer could not be persisted. Please try again.");\n    return;\n}\n`;
    const block = current.block.replace(commit, `${guard}${commit}`);
    source = source.slice(0, current.start) + block + source.slice(current.end);
    fs.writeFileSync(file, source, 'utf8');
}

function patchTransition(root: string, relative: string, status: number, mutation: (name: string, slot: number) => string) {
    const file = path.join(root, relative);
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    for (const offer of OFFERS) {
        const target = mutation(offer.name, offer.slot);
        if (!source.includes(target)) throw new Error(`Cannot find GE slot ${offer.slot} mutation in ${path.basename(file)}`);
        source = source.replace(target, `if (ge_history_set_status(${offer.slot}, ${status}) = false) return;\n    ${target}`);
    }
    fs.writeFileSync(file, source, 'utf8');
}

function liveHistoryDebugproc() {
    const rows = ROWS.map(r => `if (ge_history_exists(${r.row}) = true) {\n    def_obj $history_item_${r.row} = ge_history_item(${r.row});\n    def_int $history_type_${r.row} = ge_history_int(${r.row}, 0);\n    def_int $history_status_${r.row} = ge_history_int(${r.row}, 1);\n    def_int $history_quantity_${r.row} = ge_history_int(${r.row}, 2);\n    def_int $history_price_${r.row} = ge_history_int(${r.row}, 3);\n    if ($history_type_${r.row} = 1) {\n        if_settext(grand_exchange_group_643:com_${r.type}, "Buy");\n    } else {\n        if_settext(grand_exchange_group_643:com_${r.type}, "Sell");\n    }\n    if_settext(grand_exchange_group_643:com_${r.quantity}, tostring($history_quantity_${r.row}));\n    if_settext(grand_exchange_group_643:com_${r.name}, oc_name($history_item_${r.row}));\n    if_settext(grand_exchange_group_643:com_${r.price}, "<tostring($history_price_${r.row})> gp");\n    if_setobject(grand_exchange_group_643:com_${r.model}, $history_item_${r.row}, 250);\n    if ($history_status_${r.row} = 1) {\n        if_settext(grand_exchange_group_643:com_${r.status}, "Pending");\n    } else if ($history_status_${r.row} = 2) {\n        if_settext(grand_exchange_group_643:com_${r.status}, "Partial");\n    } else if ($history_status_${r.row} = 3) {\n        if_settext(grand_exchange_group_643:com_${r.status}, "Complete");\n    } else {\n        if_settext(grand_exchange_group_643:com_${r.status}, "Cancelled");\n    }\n    if_settext(grand_exchange_group_643:com_${r.timestamp}, ge_history_timestamp(${r.row}));\n    if_sethide(grand_exchange_group_643:com_${r.model}, false);\n    if_sethide(grand_exchange_group_643:com_${r.status}, false);\n    if_sethide(grand_exchange_group_643:com_${r.timestamp}, false);\n} else {\n    if_settext(grand_exchange_group_643:com_${r.type}, "");\n    if_settext(grand_exchange_group_643:com_${r.quantity}, "");\n    if_settext(grand_exchange_group_643:com_${r.name}, "");\n    if_settext(grand_exchange_group_643:com_${r.price}, "");\n    if_sethide(grand_exchange_group_643:com_${r.model}, true);\n    if_sethide(grand_exchange_group_643:com_${r.status}, true);\n    if_sethide(grand_exchange_group_643:com_${r.timestamp}, true);\n}`).join('\n\n');
    return `[debugproc,ge643]\nif (map_feature("grandexchange") = false) {\n    mes("Grand Exchange custom content is disabled.");\n    return;\n}\n\nif_openmain(grand_exchange_group_643);\n\n// Live rows come only from the option-2 persisted server history.\n${rows}\n`;
}

function patchHistory(root: string) {
    const file = path.join(root, HISTORY);
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const current = scriptBlock(source, '[debugproc,ge643]');
    source = source.slice(0, current.start) + liveHistoryDebugproc() + source.slice(current.end);
    source = source.replace(
        '// Source rows are intentionally opened empty by [debugproc,ge643]. The later\n// authoritative server-side GE system can populate the same stable component\n// contract with if_settext/if_setobject.',
        '// The ge643 debug procedure renders the latest persisted rows from the authoritative\n// option-2 server history. [debugproc,ge643test] remains the visual regression fixture.'
    );
    fs.writeFileSync(file, source, 'utf8');
}

function validate(root: string) {
    const partial = fs.readFileSync(path.join(root, PARTIAL), 'utf8').replace(/\r/g, '');
    const completed = fs.readFileSync(path.join(root, COMPLETED), 'utf8').replace(/\r/g, '');
    for (const offer of OFFERS) {
        for (const forbidden of [
            `def_int $remaining_${offer.slot} = $requested_${offer.slot} - $filled_${offer.slot};`,
            `def_int $next_filled_${offer.slot} = $filled_${offer.slot} + $fill_quantity;`,
        ]) {
            if (partial.includes(forbidden)) throw new Error(`GE partial script still contains unsupported inline arithmetic: ${forbidden}`);
        }
        if (!partial.includes(`def_int $remaining_${offer.slot} = sub($requested_${offer.slot}, $filled_${offer.slot});`)) {
            throw new Error(`GE partial script is missing sub() arithmetic for slot ${offer.slot}`);
        }
        if (!partial.includes(`def_int $next_filled_${offer.slot} = add($filled_${offer.slot}, $fill_quantity);`)) {
            throw new Error(`GE partial script is missing add() arithmetic for slot ${offer.slot}`);
        }
        const completedInline = `def_int $remaining_${offer.slot} = $requested_${offer.slot} - $filled_${offer.slot};`;
        if (completed.includes(completedInline)) throw new Error(`GE completed script still contains unsupported inline arithmetic: ${completedInline}`);
        if (!completed.includes(`def_int $remaining_${offer.slot} = sub($requested_${offer.slot}, $filled_${offer.slot});`)) {
            throw new Error(`GE completed script is missing sub() arithmetic for slot ${offer.slot}`);
        }
    }

    const submission = fs.readFileSync(path.join(root, OFFER_SUBMISSION), 'utf8');
    if (!submission.includes('ge_history_record($offer_slot, $item, $mode, $quantity, $price)')) throw new Error('GE history submission hook missing');
    for (const [file, hook] of [[PARTIAL, 'ge_history_set_status(1, 2)'], [COMPLETED, 'ge_history_set_status(1, 3)'], [CANCELLED, 'ge_history_set_status(1, 4)']] as const) {
        if (!fs.readFileSync(path.join(root, file), 'utf8').includes(hook)) throw new Error(`GE history hook ${hook} missing`);
    }
    const history = fs.readFileSync(path.join(root, HISTORY), 'utf8').replace(/\r/g, '');
    const liveTriggerCount = history.split('\n').filter(line => line === '[debugproc,ge643]').length;
    if (liveTriggerCount !== 1) throw new Error(`GE live history renderer must contain exactly one [debugproc,ge643] trigger line; found ${liveTriggerCount}`);
    if (!history.includes('[debugproc,ge643]\nif (map_feature("grandexchange") = false) {')) throw new Error('GE live history trigger header was not preserved');
    for (const row of ROWS) {
        const unary = `if (ge_history_exists(${row.row})) {`;
        const binary = `if (ge_history_exists(${row.row}) = true) {`;
        if (history.includes(unary)) throw new Error(`GE history row ${row.row} still uses an unsupported unary condition`);
        if (!history.includes(binary)) throw new Error(`GE history row ${row.row} is missing its explicit boolean comparison`);
    }
    for (const required of ['ge_history_item(0)', 'ge_history_int(0, 1)', 'ge_history_timestamp(0)', 'oc_name($history_item_0)']) {
        if (!history.includes(required)) throw new Error(`GE live history renderer missing ${required}`);
    }
}

export function prepareGrandExchangePersistedHistoryStage(stagedContentDir: string) {
    prepareGrandExchangePersistedHistoryRuntime(stagedContentDir);
    try {
        patchRuneScriptArithmetic(stagedContentDir);
        patchSubmission(stagedContentDir);
        patchTransition(stagedContentDir, PARTIAL, 2, (name, slot) => `inv_setslot(${name}, 6, coins, $next_filled_${slot});`);
        patchTransition(stagedContentDir, COMPLETED, 3, (name, slot) => `inv_setslot(${name}, 6, coins, $requested_${slot});`);
        patchTransition(stagedContentDir, CANCELLED, 4, name => `inv_setslot(${name}, 5, coins, 4);`);
        patchHistory(stagedContentDir);
        validate(stagedContentDir);
    } catch (error) {
        restoreGrandExchangePersistedHistoryRuntime();
        throw error;
    }
}

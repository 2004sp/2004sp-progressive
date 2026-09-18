import fs from 'fs';
import path from 'path';

const HISTORY_SCRIPT = path.join(
    'scripts',
    'grand_exchange',
    'scripts',
    'grand_exchange_history.rs2'
);

const ROWS = [
    { row: 0, type: 25, quantity: 30, price: 40, model: 51, status: 56, timestamp: 61 },
    { row: 1, type: 26, quantity: 31, price: 41, model: 52, status: 57, timestamp: 62 },
    { row: 2, type: 27, quantity: 32, price: 42, model: 53, status: 58, timestamp: 63 },
    { row: 3, type: 28, quantity: 33, price: 43, model: 54, status: 59, timestamp: 64 },
    { row: 4, type: 29, quantity: 34, price: 44, model: 55, status: 60, timestamp: 65 },
] as const;

function scriptBlock(source: string, marker: string) {
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) {
        throw new Error(`Grand Exchange history presentation is missing ${marker}`);
    }
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first < 0) {
        throw new Error(`Grand Exchange history presentation cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange history presentation found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function patchLiveHistory(source: string) {
    const current = scriptBlock(source, '[debugproc,ge643]');
    let block = current.block;

    for (const row of ROWS) {
        const originalType = [
            `    if ($history_type_${row.row} = 1) {`,
            `        if_settext(grand_exchange_group_643:com_${row.type}, "Buy");`,
            '    } else {',
            `        if_settext(grand_exchange_group_643:com_${row.type}, "Sell");`,
            '    }',
        ].join('\n');
        const historicalType = [
            `    if ($history_type_${row.row} = 1) {`,
            `        if_settext(grand_exchange_group_643:com_${row.type}, "You bought");`,
            '    } else {',
            `        if_settext(grand_exchange_group_643:com_${row.type}, "You sold");`,
            '    }',
        ].join('\n');
        block = replaceExactlyOnce(
            block,
            originalType,
            historicalType,
            `row ${row.row} offer-type wording`
        );

        const originalPrice = `    if_settext(grand_exchange_group_643:com_${row.price}, "<tostring($history_price_${row.row})> gp");`;
        const historicalPrice = [
            `    def_int $history_total_${row.row} = multiply($history_quantity_${row.row}, $history_price_${row.row});`,
            `    if ($history_type_${row.row} = 1) {`,
            `        if_settext(grand_exchange_group_643:com_${row.price}, "It cost you <tostring($history_total_${row.row})> gp");`,
            '    } else {',
            `        if_settext(grand_exchange_group_643:com_${row.price}, "You got <tostring($history_total_${row.row})> gp");`,
            '    }',
        ].join('\n');
        block = replaceExactlyOnce(
            block,
            originalPrice,
            historicalPrice,
            `row ${row.row} historical total-price wording`
        );

        // The frozen r481 group ends at component 50. Components 51-65 are
        // backport-only helpers that added an item model, status line and
        // timestamp to each row. Period references show a four-column text-only
        // history table, so keep those helpers hidden in the live presentation.
        for (const component of [row.model, row.status, row.timestamp]) {
            block = replaceExactlyOnce(
                block,
                `    if_sethide(grand_exchange_group_643:com_${component}, false);`,
                `    if_sethide(grand_exchange_group_643:com_${component}, true);`,
                `row ${row.row} helper component ${component} visibility`
            );
        }
    }

    return source.slice(0, current.start) + block + source.slice(current.end);
}

function patchVisualFixture(source: string) {
    const current = scriptBlock(source, '[debugproc,ge643test]');
    let block = current.block;

    const fixtures = [
        { row: 0, type: 25, offer: 'Buy', wording: 'You bought', price: 40, total: '3,000', model: 51, status: 56, timestamp: 61 },
        { row: 1, type: 26, offer: 'Sell', wording: 'You sold', price: 41, total: '32,000', model: 52, status: 57, timestamp: 62 },
        { row: 2, type: 27, offer: 'Buy', wording: 'You bought', price: 42, total: '11,000', model: 53, status: 58, timestamp: 63 },
        { row: 3, type: 28, offer: 'Sell', wording: 'You sold', price: 43, total: '63,000', model: 54, status: 59, timestamp: 64 },
        { row: 4, type: 29, offer: 'Buy', wording: 'You bought', price: 44, total: '6,250', model: 55, status: 60, timestamp: 65 },
    ] as const;

    for (const fixture of fixtures) {
        block = replaceExactlyOnce(
            block,
            `if_settext(grand_exchange_group_643:com_${fixture.type}, "${fixture.offer}");`,
            `if_settext(grand_exchange_group_643:com_${fixture.type}, "${fixture.wording}");`,
            `fixture row ${fixture.row} offer wording`
        );

        const priceSuffix = fixture.offer === 'Buy'
            ? `It cost you ${fixture.total} gp`
            : `You got ${fixture.total} gp`;
        const pricePattern = new RegExp(
            `if_settext\\(grand_exchange_group_643:com_${fixture.price}, "[0-9,]+ gp"\\);`
        );
        const matches = block.match(pricePattern);
        if (!matches || matches.length !== 1) {
            throw new Error(`Grand Exchange history presentation cannot find fixture row ${fixture.row} price`);
        }
        block = block.replace(
            pricePattern,
            `if_settext(grand_exchange_group_643:com_${fixture.price}, "${priceSuffix}");`
        );

        for (const component of [fixture.model, fixture.status, fixture.timestamp]) {
            block = replaceExactlyOnce(
                block,
                `if_sethide(grand_exchange_group_643:com_${component}, false);`,
                `if_sethide(grand_exchange_group_643:com_${component}, true);`,
                `fixture row ${fixture.row} helper component ${component} visibility`
            );
        }
    }

    return source.slice(0, current.start) + block + source.slice(current.end);
}

function validate(source: string) {
    const live = scriptBlock(source, '[debugproc,ge643]').block;

    for (const row of ROWS) {
        for (const required of [
            `if_settext(grand_exchange_group_643:com_${row.type}, "You bought");`,
            `if_settext(grand_exchange_group_643:com_${row.type}, "You sold");`,
            `def_int $history_total_${row.row} = multiply($history_quantity_${row.row}, $history_price_${row.row});`,
            `if_settext(grand_exchange_group_643:com_${row.price}, "It cost you <tostring($history_total_${row.row})> gp");`,
            `if_settext(grand_exchange_group_643:com_${row.price}, "You got <tostring($history_total_${row.row})> gp");`,
        ]) {
            if (!live.includes(required)) {
                throw new Error(`Grand Exchange historical history row ${row.row} is missing ${required}`);
            }
        }

        for (const component of [row.model, row.status, row.timestamp]) {
            if (live.includes(`if_sethide(grand_exchange_group_643:com_${component}, false);`)) {
                throw new Error(`Grand Exchange historical history row ${row.row} still exposes helper component ${component}`);
            }
        }
    }
}

export function prepareGrandExchangeHistoryPresentationStage(stagedContentDir: string) {
    const historyPath = path.join(stagedContentDir, HISTORY_SCRIPT);
    let source = fs.readFileSync(historyPath, 'utf8').replace(/\r/g, '');

    source = patchLiveHistory(source);
    source = patchVisualFixture(source);
    validate(source);

    fs.writeFileSync(historyPath, source, 'utf8');
}

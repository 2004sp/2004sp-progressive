import fs from 'fs';
import path from 'path';

type PersistentInventoryGroup = {
    file: string;
    names: string[];
    size: number;
};

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELECTED_ITEM_INV = 'ge_selected_item';
const PRICE_STATE_SLOT = 2;
const PRICE_STATE_OBJECT = 'coins';
const RANGE_TEXT_COMPONENT = 145;

const PERSISTENT_INVENTORIES: PersistentInventoryGroup[] = [
    {
        file: 'grand_exchange_collection.inv',
        names: Array.from({ length: 6 }, (_, index) => `ge_collection_offer_${index}`),
        size: 2,
    },
    {
        file: 'grand_exchange_active_offer.inv',
        names: Array.from({ length: 6 }, (_, index) => `ge_active_offer_${index + 1}`),
        size: 7,
    },
];

function promoteInventoryBlock(source: string, name: string, expectedSize: number) {
    const marker = `[${name}]`;
    const start = source.indexOf(marker);
    if (start < 0) {
        throw new Error(`Grand Exchange persistent state is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    const block = source.slice(start, end);

    if (!block.includes('scope=temp')) {
        throw new Error(`Grand Exchange persistent state expected ${name} to be temporary before final staging`);
    }
    if (!block.includes(`size=${expectedSize}`)) {
        throw new Error(`Grand Exchange persistent state expected ${name} to have size ${expectedSize}`);
    }

    return source.slice(0, start) + block.replace('scope=temp', 'scope=perm') + source.slice(end);
}

function scriptBlock(source: string, marker: string, label: string) {
    let start = source.startsWith(marker) ? 0 : source.indexOf(`\n${marker}`);
    if (start < 0) {
        throw new Error(`Grand Exchange ${label} is missing ${marker}`);
    }
    if (start !== 0) start++;
    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first < 0) {
        throw new Error(`Grand Exchange fixed-price stage cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange fixed-price stage found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function enforceDefaultOfferPrice(stagedContentDir: string) {
    const scriptDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts');

    // The backport currently has synthetic liquidity only at the guide/default
    // price. Keep every visible price control wired, but make all of them resolve
    // back to that same price so the player cannot create an offer that has no
    // possible matcher and therefore remains pending forever.
    const pricePath = path.join(scriptDir, 'grand_exchange_price.rs2');
    let priceSource = fs.readFileSync(pricePath, 'utf8').replace(/\r/g, '');
    const priceSet = scriptBlock(priceSource, '[proc,ge_offer_price_set]', 'price state');
    const mutablePriceState = [
        'def_int $clamped = $price;',
        'if ($clamped < 1) {',
        '    $clamped = 1;',
        '}',
        `inv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $clamped);`,
        '~ge_offer_price_value_render($clamped);',
    ].join('\n');
    const fixedPriceState = [
        'def_int $default_price = ~ge_offer_guide_price;',
        `inv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $default_price);`,
        '~ge_offer_price_value_render($default_price);',
    ].join('\n');
    const patchedPriceBlock = replaceExactlyOnce(
        priceSet.block,
        mutablePriceState,
        fixedPriceState,
        'mutable offer-price state'
    );
    priceSource = priceSource.slice(0, priceSet.start) + patchedPriceBlock + priceSource.slice(priceSet.end);
    fs.writeFileSync(pricePath, priceSource, 'utf8');

    // Do not advertise the old +/-5% range once off-guide prices are disabled.
    const searchPath = path.join(scriptDir, 'grand_exchange_item_search.rs2');
    let searchSource = fs.readFileSync(searchPath, 'utf8').replace(/\r/g, '');
    searchSource = replaceExactlyOnce(
        searchSource,
        `if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, append(append($minimum_text, " - "), $maximum_text));`,
        `if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, "Fixed guide price");`,
        'selected-item price range presentation'
    );
    fs.writeFileSync(searchPath, searchSource, 'utf8');

    // Server-side backstop: ignore any stale/tampered price token at Confirm
    // Offer and derive the price again from the selected item. This makes total
    // validation, history, settlement and wealth movement all use the same
    // default price even if an older client state somehow survives.
    const submissionPath = path.join(scriptDir, 'grand_exchange_offer_submission.rs2');
    let submissionSource = fs.readFileSync(submissionPath, 'utf8').replace(/\r/g, '');
    const submission = scriptBlock(
        submissionSource,
        `[if_button,${GE_INTERFACE_NAME}:com_190]`,
        'offer submission'
    );
    const patchedSubmissionBlock = replaceExactlyOnce(
        submission.block,
        `def_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});`,
        'def_int $price = ~ge_offer_guide_price;',
        'submitted custom price read'
    );
    submissionSource = submissionSource.slice(0, submission.start) + patchedSubmissionBlock + submissionSource.slice(submission.end);
    fs.writeFileSync(submissionPath, submissionSource, 'utf8');

    const finalPriceSet = scriptBlock(priceSource, '[proc,ge_offer_price_set]', 'price-state validation').block;
    for (const required of [
        'def_int $default_price = ~ge_offer_guide_price;',
        `inv_setslot(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT}, ${PRICE_STATE_OBJECT}, $default_price);`,
        '~ge_offer_price_value_render($default_price);',
    ]) {
        if (!finalPriceSet.includes(required)) {
            throw new Error(`Grand Exchange fixed-price state is missing ${required}`);
        }
    }
    if (finalPriceSet.includes('$clamped')) {
        throw new Error('Grand Exchange price controls can still retain a non-default clamped price');
    }
    if (!searchSource.includes(`if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, "Fixed guide price");`)) {
        throw new Error('Grand Exchange selected-item view still advertises a variable price range');
    }

    const finalSubmission = scriptBlock(
        submissionSource,
        `[if_button,${GE_INTERFACE_NAME}:com_190]`,
        'offer-submission validation'
    ).block;
    for (const required of [
        'def_int $price = ~ge_offer_guide_price;',
        'if ($price = $execution_price) {',
    ]) {
        if (!finalSubmission.includes(required)) {
            throw new Error(`Grand Exchange fixed-price submission is missing ${required}`);
        }
    }
    if (finalSubmission.includes(`def_int $price = inv_getnum(${SELECTED_ITEM_INV}, ${PRICE_STATE_SLOT});`)) {
        throw new Error('Grand Exchange offer submission can still use a non-default client price token');
    }
}

// Earlier compatibility stages intentionally validate the frozen r481-derived
// inventories while they are temporary. Promote only the final staged copies,
// after all offer/collection stages have finished shaping them, so the native
// player save format serializes both outstanding offer metadata and uncollected
// item/coin outputs across logout and graceful server shutdown.
export function prepareGrandExchangePersistenceStage(stagedContentDir: string) {
    const configDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'configs');

    for (const group of PERSISTENT_INVENTORIES) {
        const configPath = path.join(configDir, group.file);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Grand Exchange persistent state config is missing: ${configPath}`);
        }

        let source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
        for (const name of group.names) {
            source = promoteInventoryBlock(source, name, group.size);
        }
        fs.writeFileSync(configPath, source, 'utf8');
    }

    // This is intentionally the final GE staging step. Settlement's internal
    // validation still proves the legacy limit-offer path before we narrow the
    // finished staged scripts to the only price the synthetic matcher supports.
    enforceDefaultOfferPrice(stagedContentDir);
}

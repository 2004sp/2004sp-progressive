import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const MARKET_ICON_COMPONENT = 139;
const MARKET_TEXT_COMPONENT = 140;
const RANGE_DOWN_COMPONENT = 143;
const RANGE_UP_COMPONENT = 144;
const RANGE_TEXT_COMPONENT = 145;
const SEARCH_BASE_COMPONENT = 136;
const SEARCH_GLOW_COMPONENT = 137;
const CONFIRM_BACKGROUND_COMPONENT = 190;
const CONFIRM_TEXT_COMPONENT = 191;

const INITIAL_MARKET_ICON_X = 100;
const INITIAL_RANGE_DOWN_X = 306;
const INITIAL_RANGE_UP_X = 348;
const PRICE_ROW_Y = 132;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange offer presentation is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function replaceComponentBlock(source: string, componentId: number, patch: (block: string) => string) {
    const { start, end, block } = getComponentBlock(source, componentId);
    return source.slice(0, start) + patch(block) + source.slice(end);
}

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange offer presentation is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function patchOfferInterface(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange offer presentation interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    source = replaceComponentBlock(source, SEARCH_BASE_COMPONENT, block => {
        for (const required of ['type=graphic', 'x=102', 'y=92', 'width=40', 'height=36']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange search highlight com_${SEARCH_BASE_COMPONENT} no longer contains ${required}`);
            }
        }

        if (block.includes('graphic=r481_ge_sprite_200137,0')) {
            return block;
        }
        if (!block.includes('graphic=r481_ge_sprite_200136,0')) {
            throw new Error('Grand Exchange search highlight base graphic no longer matches the frozen group-105 search box');
        }
        return block.replace('graphic=r481_ge_sprite_200136,0', 'graphic=r481_ge_sprite_200137,0');
    });

    const glow = getComponentBlock(source, SEARCH_GLOW_COMPONENT).block;
    if (!glow.includes('type=graphic') || !glow.includes('graphic=r481_ge_sprite_200137,0')) {
        throw new Error('Grand Exchange search highlight glow graphic no longer matches the frozen yellow state');
    }

    source = replaceComponentBlock(source, CONFIRM_BACKGROUND_COMPONENT, block => {
        for (const required of ['x=200', 'y=270', 'width=120', 'height=43']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange Confirm Offer background no longer contains ${required}`);
            }
        }

        if (block.includes('type=rect')) {
            if (!block.includes('fill=yes') || !block.includes('colour=0x332C24')) {
                throw new Error('Grand Exchange Confirm Offer background already has incompatible IF1 rectangle metadata');
            }
            return block;
        }
        if (!block.includes('type=layer') || !block.includes('scroll=43')) {
            throw new Error('Grand Exchange Confirm Offer background no longer matches the frozen group-105 action layer');
        }

        return block
            .replace('type=layer', 'type=rect')
            .replace('scroll=43', 'fill=yes\ncolour=0x332C24');
    });

    source = replaceComponentBlock(source, CONFIRM_TEXT_COMPONENT, block => {
        for (const required of ['type=text', 'x=200', 'y=270', 'width=120', 'height=43', 'text=Confirm Offer']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange Confirm Offer label no longer contains ${required}`);
            }
        }

        if (block.includes('buttontype=')) {
            if (!block.includes('buttontype=normal') || !block.includes('option=Confirm Offer')) {
                throw new Error('Grand Exchange Confirm Offer label already has incompatible IF1 action metadata');
            }
            return block;
        }

        return block.replace('type=text', 'buttontype=normal\noption=Confirm Offer\ntype=text');
    });

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function patchBuyOfferInitialState(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange offer presentation script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = '[proc,ge_open_buy_offer_setup]';
    const { start, end, block: originalBlock } = getScriptBlock(source, marker);
    let block = originalBlock;

    const marketZero = `if_settext(${GE_INTERFACE_NAME}:com_${MARKET_TEXT_COMPONENT}, "0 gp");`;
    const marketNa = `if_settext(${GE_INTERFACE_NAME}:com_${MARKET_TEXT_COMPONENT}, "N/A");`;
    if (block.includes(marketZero)) {
        block = block.replace(marketZero, marketNa);
    } else if (!block.includes(marketNa)) {
        throw new Error('Grand Exchange buy setup no longer exposes the expected initial market-price text');
    }

    const rangeEmpty = `if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, "");`;
    const rangeNa = `if_settext(${GE_INTERFACE_NAME}:com_${RANGE_TEXT_COMPONENT}, "N/A");`;
    if (block.includes(rangeEmpty)) {
        block = block.replace(rangeEmpty, rangeNa);
    } else if (!block.includes(rangeNa)) {
        throw new Error('Grand Exchange buy setup no longer exposes the expected initial price-range text');
    }

    const initialPositions = [
        `if_setposition(${GE_INTERFACE_NAME}:com_${MARKET_ICON_COMPONENT}, ${INITIAL_MARKET_ICON_X}, ${PRICE_ROW_Y});`,
        `if_setposition(${GE_INTERFACE_NAME}:com_${RANGE_DOWN_COMPONENT}, ${INITIAL_RANGE_DOWN_X}, ${PRICE_ROW_Y});`,
        `if_setposition(${GE_INTERFACE_NAME}:com_${RANGE_UP_COMPONENT}, ${INITIAL_RANGE_UP_X}, ${PRICE_ROW_Y});`,
    ].join('\n');

    if (!block.includes(initialPositions)) {
        if (!block.includes(marketNa)) {
            throw new Error('Grand Exchange buy setup cannot place the N/A price chrome before its market-price text is initialised');
        }
        block = block.replace(marketNa, `${marketNa}\n${initialPositions}`);
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

function patchSelectedItemLayoutRestore(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_item_search.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange selected-item presentation script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    const marker = '[proc,ge_item_search_apply_selection]';
    const { start, end, block: originalBlock } = getScriptBlock(source, marker);
    let block = originalBlock;

    const restorePositions = [
        `if_setposition(${GE_INTERFACE_NAME}:com_${MARKET_ICON_COMPONENT}, 53, ${PRICE_ROW_Y});`,
        `if_setposition(${GE_INTERFACE_NAME}:com_${RANGE_DOWN_COMPONENT}, 211, ${PRICE_ROW_Y});`,
        `if_setposition(${GE_INTERFACE_NAME}:com_${RANGE_UP_COMPONENT}, 443, ${PRICE_ROW_Y});`,
    ].join('\n');

    if (!block.includes(restorePositions)) {
        const selectionObject = `if_setobject(${GE_INTERFACE_NAME}:com_138, $item, 250);`;
        if (!block.includes(selectionObject)) {
            throw new Error('Grand Exchange selected-item presentation can no longer find the group-105 selected item model setter');
        }
        block = block.replace(selectionObject, `${selectionObject}\n${restorePositions}`);
    }

    source = source.slice(0, start) + block + source.slice(end);
    fs.writeFileSync(scriptPath, source, 'utf8');
}

export function prepareGrandExchangeOfferPresentationStage(stagedContentDir: string) {
    patchOfferInterface(stagedContentDir);
    patchBuyOfferInitialState(stagedContentDir);
    patchSelectedItemLayoutRestore(stagedContentDir);
}

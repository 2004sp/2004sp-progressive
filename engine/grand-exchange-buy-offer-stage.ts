import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const BUY_ACTION_COMPONENTS = [30, 46, 62, 81, 100, 119] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange buy-offer setup is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function enableBuyAction(source: string, componentId: number) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);

    if (!block.includes('type=layer') || !block.includes('scroll=46')) {
        throw new Error(`Grand Exchange buy-offer setup ${marker} no longer matches the frozen r481 buy-action layer`);
    }

    const hasButtonType = block.includes('buttontype=');
    const hasOption = block.includes('option=');
    if (hasButtonType || hasOption) {
        if (block.includes('buttontype=normal') && block.includes('option=Buy')) {
            return source;
        }
        throw new Error(`Grand Exchange buy-offer setup ${marker} already has an incompatible IF1 action`);
    }

    const patchedBlock = block.replace('scroll=46', 'scroll=46\nbuttontype=normal\noption=Buy');
    return source.slice(0, start) + patchedBlock + source.slice(end);
}

export function prepareGrandExchangeBuyOfferSetupStage(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange buy-offer setup interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    for (const componentId of BUY_ACTION_COMPONENTS) {
        source = enableBuyAction(source, componentId);
    }

    const back = getComponentBlock(source, 127).block;
    if (!back.includes('buttontype=normal') || !back.includes('option=Back')) {
        throw new Error('Grand Exchange buy-offer setup requires the frozen group-105 Back action on com_127');
    }

    for (const requiredLayer of [16, 126, 156, 192, 197, 200] as const) {
        const block = getComponentBlock(source, requiredLayer).block;
        if (!block.includes('type=layer')) {
            throw new Error(`Grand Exchange buy-offer setup com_${requiredLayer} is no longer an IF1 layer`);
        }
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

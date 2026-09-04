import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_ACTION_COMPONENTS = [31, 47, 63, 82, 101, 120] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange sell-offer setup is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function enableSellAction(source: string, componentId: number) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);

    if (!block.includes('type=layer') || !block.includes('scroll=46')) {
        throw new Error(`Grand Exchange sell-offer setup ${marker} no longer matches the frozen r481 sell-action layer`);
    }

    const hasButtonType = block.includes('buttontype=');
    const hasOption = block.includes('option=');
    if (hasButtonType || hasOption) {
        if (block.includes('buttontype=normal') && block.includes('option=Sell')) {
            return source;
        }
        throw new Error(`Grand Exchange sell-offer setup ${marker} already has an incompatible IF1 action`);
    }

    const patchedBlock = block.replace('scroll=46', 'scroll=46\nbuttontype=normal\noption=Sell');
    return source.slice(0, start) + patchedBlock + source.slice(end);
}

export function prepareGrandExchangeSellOfferSetupStage(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );

    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange sell-offer setup interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    for (const componentId of SELL_ACTION_COMPONENTS) {
        source = enableSellAction(source, componentId);
    }

    const title = getComponentBlock(source, 133).block;
    if (!title.includes('type=text') || !title.includes('text=Buy Offer')) {
        throw new Error('Grand Exchange sell-offer setup requires the frozen group-105 offer title on com_133');
    }

    const sellPrompt = getComponentBlock(source, 199).block;
    if (!sellPrompt.includes('type=text') || !sellPrompt.includes('text=Select an item in your inventory to sell.')) {
        throw new Error('Grand Exchange sell-offer setup requires the frozen group-105 sell prompt on com_199');
    }

    for (const requiredLayer of [16, 126, 156, 192, 197, 198, 200] as const) {
        const block = getComponentBlock(source, requiredLayer).block;
        if (!block.includes('type=layer')) {
            throw new Error(`Grand Exchange sell-offer setup com_${requiredLayer} is no longer an IF1 layer`);
        }
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

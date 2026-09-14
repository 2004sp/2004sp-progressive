import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const ACTIVE_OFFER_HOVER_COMPONENTS = [292, 293, 294, 295, 296, 297] as const;
const ACTIVE_OFFER_HOVER_COLOUR = '0xC0C0C0';
const ACTIVE_OFFER_HOVER_TRANSPARENCY = 220;

function componentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Grand Exchange active-offer hover presentation is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

export function prepareGrandExchangeActiveOfferHoverPresentationStage(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const componentId of ACTIVE_OFFER_HOVER_COMPONENTS) {
        const current = componentBlock(source, componentId);
        for (const required of [
            'type=graphic',
            'x=0',
            'y=0',
            'width=140',
            'height=110',
            'graphic=ge_active_offer_view_hover,0',
        ]) {
            if (!current.block.includes(required)) {
                throw new Error(`Grand Exchange active-offer hover com_${componentId} no longer contains ${required}`);
            }
        }

        const layer = current.block.match(/^layer=(com_\d+)$/m)?.[1];
        if (!layer) {
            throw new Error(`Grand Exchange active-offer hover com_${componentId} lost its hover-layer parent`);
        }

        const replacement = [
            `[com_${componentId}]`,
            `layer=${layer}`,
            'type=rect',
            'x=0',
            'y=0',
            'width=140',
            'height=110',
            'fill=yes',
            `colour=${ACTIVE_OFFER_HOVER_COLOUR}`,
            `trans=${ACTIVE_OFFER_HOVER_TRANSPARENCY}`,
        ].join('\n');
        source = source.slice(0, current.start) + replacement + source.slice(current.end);
    }

    fs.writeFileSync(file, source, 'utf8');
}

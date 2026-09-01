import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const BUY_ACTION_COMPONENTS = [30, 46, 62, 81, 100, 119] as const;
const SELL_ACTION_COMPONENTS = [31, 47, 63, 82, 101, 120] as const;
const BUY_ICON_COMPONENTS = [29, 45, 61, 80, 99, 118] as const;
const SELL_ICON_COMPONENTS = [28, 44, 60, 79, 98, 117] as const;
const BUY_ICON_GRAPHIC = 'r481_ge_sprite_1170,0';
const SELL_ICON_GRAPHIC = 'r481_ge_sprite_1168,0';
const BACK_COMPONENT = 127;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange overview interaction stage is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { marker, start, end, block: source.slice(start, end) };
}

function patchIconX(
    source: string,
    componentId: number,
    expectedX: number,
    correctedX: number,
    expectedGraphic: string
) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    if (!block.includes('type=graphic') || !block.includes(`graphic=${expectedGraphic}`)) {
        throw new Error(`Grand Exchange overview interaction ${marker} no longer matches the expected offer icon`);
    }

    const expected = `x=${expectedX}`;
    const corrected = `x=${correctedX}`;
    if (!block.includes(expected)) {
        if (block.includes(corrected)) {
            return source;
        }
        throw new Error(`Grand Exchange overview interaction ${marker} no longer has ${expected}`);
    }

    const patchedBlock = block.replace(expected, corrected);
    return source.slice(0, start) + patchedBlock + source.slice(end);
}

function requireButtonAction(source: string, componentId: number, option: 'Buy' | 'Sell') {
    const { marker, block } = getComponentBlock(source, componentId);
    if (
        !block.includes('type=layer') ||
        !block.includes('buttontype=normal') ||
        !block.includes(`option=${option}`)
    ) {
        throw new Error(`Grand Exchange overview interaction ${marker} is not wired as an IF1 ${option} action`);
    }
}

function patchOfferIconAlignment(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange overview interaction interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    for (const componentId of BUY_ACTION_COMPONENTS) {
        requireButtonAction(source, componentId, 'Buy');
    }
    for (const componentId of SELL_ACTION_COMPONENTS) {
        requireButtonAction(source, componentId, 'Sell');
    }

    // The raw r481 crate art is 26px wide inside a 35px IF3 component canvas.
    // The option-2 stage pads that media for IF1, but the older renderer still
    // reads the visible artwork slightly left-heavy. Apply a one-pixel optical
    // correction to both icons while leaving the 51x46 click hitboxes unchanged.
    for (const componentId of BUY_ICON_COMPONENTS) {
        source = patchIconX(source, componentId, 20, 21, BUY_ICON_GRAPHIC);
    }
    for (const componentId of SELL_ICON_COMPONENTS) {
        source = patchIconX(source, componentId, 83, 84, SELL_ICON_GRAPHIC);
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const line of content.split('\n')) {
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) {
            values.set(id, line.slice(equals + 1));
        }
    }

    return { content, values };
}

function injectOverviewInteractionMappings(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange overview interaction script is missing: ${scriptPath}`);
    }

    const triggerNames = [
        '[proc,ge_open_buy_offer_setup]',
        '[proc,ge_open_sell_offer_setup]',
        '[proc,ge_return_to_offer_summary]',
        ...BUY_ACTION_COMPONENTS.map(componentId => `[if_button,${GE_INTERFACE_NAME}:com_${componentId}]`),
        ...SELL_ACTION_COMPONENTS.map(componentId => `[if_button,${GE_INTERFACE_NAME}:com_${componentId}]`),
        `[if_button,${GE_INTERFACE_NAME}:com_${BACK_COMPONENT}]`,
    ];

    const scriptSource = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    for (const triggerName of triggerNames) {
        if (!scriptSource.includes(triggerName)) {
            throw new Error(`Grand Exchange overview interaction script is missing ${triggerName}`);
        }
    }

    const packPath = path.join(stagedContentDir, 'pack', 'script.pack');
    const { content, values } = readPack(packPath);
    const existingNames = new Set(values.values());
    const additions: string[] = [];
    let maxId = Math.max(-1, ...values.keys());

    for (const triggerName of triggerNames) {
        if (existingNames.has(triggerName)) continue;
        maxId++;
        additions.push(`${maxId}=${triggerName}`);
        existingNames.add(triggerName);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
}

export function prepareGrandExchangeOverviewInteractionStage(stagedContentDir: string) {
    patchOfferIconAlignment(stagedContentDir);
    injectOverviewInteractionMappings(stagedContentDir);
}

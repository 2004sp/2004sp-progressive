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

const BUTTON_FRAME_GROUPS = [
    [20, 21, 22, 23, 24, 25, 26, 27],
    [36, 37, 38, 39, 40, 41, 42, 43],
    [52, 53, 54, 55, 56, 57, 58, 59],
    [71, 72, 73, 74, 75, 76, 77, 78],
    [90, 91, 92, 93, 94, 95, 96, 97],
    [109, 110, 111, 112, 113, 114, 115, 116],
] as const;

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

function patchComponentX(
    source: string,
    componentId: number,
    expectedX: number,
    correctedX: number,
    expectedType: string
) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    if (!block.includes(`type=${expectedType}`)) {
        throw new Error(`Grand Exchange overview interaction ${marker} no longer has type=${expectedType}`);
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

function patchIconX(
    source: string,
    componentId: number,
    expectedX: number,
    correctedX: number,
    expectedGraphic: string
) {
    const { marker, block } = getComponentBlock(source, componentId);
    if (!block.includes(`graphic=${expectedGraphic}`)) {
        throw new Error(`Grand Exchange overview interaction ${marker} no longer matches the expected offer icon`);
    }
    return patchComponentX(source, componentId, expectedX, correctedX, 'graphic');
}

function patchActionHitbox(
    source: string,
    componentId: number,
    option: 'Buy' | 'Sell',
    expectedX: number,
    correctedX: number
) {
    const { marker, start, end, block } = getComponentBlock(source, componentId);
    const required = [
        'type=layer',
        `x=${expectedX}`,
        'y=43',
        'width=51',
        'height=46',
        'scroll=46',
        'buttontype=normal',
        `option=${option}`,
    ];

    for (const token of required) {
        if (!block.includes(token)) {
            throw new Error(`Grand Exchange overview interaction ${marker} is missing ${token}`);
        }
    }

    // r254 treats IF1 type=layer as a container: input handling recurses into
    // its children and skips the normal button branch for the layer itself.
    // Replace the empty source hitbox layer with an invisible text component so
    // buttontype=normal reaches the client's button packet path while keeping
    // the full frozen 51x46 clickable area. Text widgets require a colour field
    // in this IF1 compiler even when their text is empty.
    const patchedBlock = block
        .replace('type=layer', 'type=text')
        .replace(`x=${expectedX}`, `x=${correctedX}`)
        .replace('scroll=46\n', '')
        .replace(`option=${option}`, `option=${option}\nfont=p11\ntext=\ncolour=0x000000`);

    return source.slice(0, start) + patchedBlock + source.slice(end);
}

function patchOfferControls(stagedContentDir: string) {
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

    // The two 51px offer buttons occupy x=12..125 in a 140px slot, leaving the
    // pair one pixel left of true centre. Shift the complete button chrome and
    // click targets together by one pixel so both outer margins are 13.
    for (const group of BUTTON_FRAME_GROUPS) {
        const [buyTop, buyBottom, buyLeft, buyRight, sellTop, sellBottom, sellLeft, sellRight] = group;
        for (const componentId of [buyTop, buyBottom, buyLeft] as const) {
            source = patchComponentX(source, componentId, 12, 13, 'graphic');
        }
        source = patchComponentX(source, buyRight, 61, 62, 'graphic');

        for (const componentId of [sellTop, sellBottom, sellLeft] as const) {
            source = patchComponentX(source, componentId, 75, 76, 'graphic');
        }
        source = patchComponentX(source, sellRight, 124, 125, 'graphic');
    }

    // Final in-game alignment values for the visible crate artwork. Keep the
    // frame and click-target geometry unchanged and move only the icon graphics.
    for (const componentId of BUY_ICON_COMPONENTS) {
        source = patchIconX(source, componentId, 20, 25, BUY_ICON_GRAPHIC);
    }
    for (const componentId of SELL_ICON_COMPONENTS) {
        source = patchIconX(source, componentId, 83, 88, SELL_ICON_GRAPHIC);
    }

    for (const componentId of BUY_ACTION_COMPONENTS) {
        source = patchActionHitbox(source, componentId, 'Buy', 12, 13);
    }
    for (const componentId of SELL_ACTION_COMPONENTS) {
        source = patchActionHitbox(source, componentId, 'Sell', 75, 76);
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
    patchOfferControls(stagedContentDir);
    injectOverviewInteractionMappings(stagedContentDir);
}

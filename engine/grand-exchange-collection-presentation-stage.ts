import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const SLOT_FRAME_SOURCE = path.join(
    REPO_DIR,
    'plugins',
    'grand-exchange',
    'assets',
    'derived',
    'group109',
    'collection_slot_frame.png'
);
const SLOT_FRAME_SHA256 = 'd9344569a73d36e211a421dcada9ba6f39d0691e0729c6d52ef27202e56e0fae';
const SLOT_FRAME_SPRITE = 'r481_ge_collection_slot_frame';
const GROUP109_INTERFACE_NAME = 'grand_exchange_group_109';
const GROUP109_COMPONENT_BASE = 10024;
const COLLECTION_HOVER_COMPONENT_MIN = 82;
const COLLECTION_HOVER_COMPONENT_MAX = 117;
const COLLECTION_HOVER_COLOUR = '0xC8B432';
const COLLECTION_HOVER_TRANSPARENCY = 100;

const SLOT_BACKGROUNDS = [
    { component: 16, sourceX: 93, sourceY: 100, x: 88, y: 95 },
    { component: 21, sourceX: 209, sourceY: 100, x: 204, y: 95 },
    { component: 26, sourceX: 325, sourceY: 100, x: 320, y: 95 },
    { component: 34, sourceX: 93, sourceY: 190, x: 88, y: 185 },
    { component: 42, sourceX: 209, sourceY: 190, x: 204, y: 185 },
    { component: 50, sourceX: 325, sourceY: 190, x: 320, y: 185 },
] as const;

const COLLECTION_SLOTS = [
    { slot: 0, host: 17, status: 58, inv: 59, detail: 60, legacyCollect: 61 },
    { slot: 1, host: 22, status: 62, inv: 63, detail: 64, legacyCollect: 65 },
    { slot: 2, host: 27, status: 66, inv: 67, detail: 68, legacyCollect: 69 },
    { slot: 3, host: 35, status: 70, inv: 71, detail: 72, legacyCollect: 73 },
    { slot: 4, host: 43, status: 74, inv: 75, detail: 76, legacyCollect: 77 },
    { slot: 5, host: 51, status: 78, inv: 79, detail: 80, legacyCollect: 81 },
] as const;

function collectionOutputs() {
    return COLLECTION_SLOTS.flatMap(slot => [0, 1].map(output => ({
        ...slot,
        output,
        hoverSensor: 82 + slot.slot * 2 + output,
        hoverLayer: 94 + slot.slot * 2 + output,
        hoverRect: 106 + slot.slot * 2 + output,
        x: output === 0 ? 10 : 55,
    })));
}

function componentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Grand Exchange collection presentation is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
}

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    for (const line of content.split('\n')) {
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals < 1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) values.set(id, line.slice(equals + 1));
    }
    return { content, values };
}

function stageSlotFrame(stagedContentDir: string) {
    if (!fs.existsSync(SLOT_FRAME_SOURCE)) {
        throw new Error(`Grand Exchange collection slot frame asset is missing: ${SLOT_FRAME_SOURCE}`);
    }

    const bytes = fs.readFileSync(SLOT_FRAME_SOURCE);
    const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== SLOT_FRAME_SHA256) {
        throw new Error(
            `Grand Exchange collection slot frame hash mismatch: expected ${SLOT_FRAME_SHA256}, got ${actualHash}`
        );
    }

    const spriteDir = path.join(stagedContentDir, 'sprites');
    fs.mkdirSync(spriteDir, { recursive: true });
    fs.copyFileSync(SLOT_FRAME_SOURCE, path.join(spriteDir, `${SLOT_FRAME_SPRITE}.png`));
}

function patchCollectionInterface(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GROUP109_INTERFACE_NAME}.if`
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const slot of SLOT_BACKGROUNDS) {
        const current = componentBlock(source, slot.component);
        for (const required of [
            'type=rect',
            `x=${slot.sourceX}`,
            `y=${slot.sourceY}`,
            'width=106',
            'height=80',
            'trans=200',
            'fill=yes',
            'colour=0x000000',
        ]) {
            if (!current.block.includes(required)) {
                throw new Error(`Grand Exchange collection slot ${slot.component} no longer contains ${required}`);
            }
        }

        const replacement = [
            `[com_${slot.component}]`,
            'type=graphic',
            `x=${slot.x}`,
            `y=${slot.y}`,
            'width=106',
            'height=80',
            `graphic=${SLOT_FRAME_SPRITE},0`,
        ].join('\n');
        source = source.slice(0, current.start) + replacement + source.slice(current.end);
    }

    for (const slot of COLLECTION_SLOTS) {
        const status = componentBlock(source, slot.status);
        if (!status.block.includes('\ntext=Empty\n')) {
            throw new Error(`Grand Exchange collection empty status com_${slot.status} no longer contains text=Empty`);
        }
        source = source.slice(0, status.start) + status.block.replace('\ntext=Empty\n', '\ntext=\n') + source.slice(status.end);

        const inv = componentBlock(source, slot.inv);
        for (const required of ['type=inv', 'x=16', 'y=15', 'width=2', 'height=1', 'margin=10,0', 'option1=Collect']) {
            if (!inv.block.includes(required)) {
                throw new Error(`Grand Exchange collection inventory com_${slot.inv} no longer contains ${required}`);
            }
        }
        const movedInv = inv.block
            .replace('\nx=16\n', '\nx=14\n')
            .replace('\ny=15\n', '\ny=32\n')
            .replace('\nmargin=10,0\n', '\nmargin=13,0\n');
        source = source.slice(0, inv.start) + movedInv + source.slice(inv.end);

        for (const componentId of [slot.detail, slot.legacyCollect]) {
            const helper = componentBlock(source, componentId);
            if (!helper.block.includes('type=text')) {
                throw new Error(`Grand Exchange collection helper com_${componentId} is no longer text`);
            }
            const hidden = helper.block.includes('\nhide=yes\n')
                ? helper.block
                : helper.block.replace('\ntype=text\n', '\ntype=text\nhide=yes\n');
            source = source.slice(0, helper.start) + hidden + source.slice(helper.end);
        }
    }

    for (let componentId = COLLECTION_HOVER_COMPONENT_MIN; componentId <= COLLECTION_HOVER_COMPONENT_MAX; componentId++) {
        if (source.includes(`[com_${componentId}]`)) {
            throw new Error(`Grand Exchange collection hover helper com_${componentId} is already in use`);
        }
    }

    const hoverSensors: string[] = [];
    const hoverLayers: string[] = [];
    const hoverRects: string[] = [];
    for (const output of collectionOutputs()) {
        // IF1 hover tracking checks overlayer independently of buttonType. Keep
        // this sensor non-interactive so the inventory underneath contributes
        // the only menu entry: "Collect <item name>".
        hoverSensors.push(
            `[com_${output.hoverSensor}]\n` +
                `layer=com_${output.host}\n` +
                'type=text\n' +
                `x=${output.x}\n` +
                'y=31\n' +
                'width=40\n' +
                'height=35\n' +
                'font=p11\n' +
                'text=\n' +
                'colour=0x000000\n' +
                `overlayer=com_${output.hoverLayer}`
        );
        hoverLayers.push(
            `[com_${output.hoverLayer}]\n` +
                `layer=com_${output.host}\n` +
                'type=layer\n' +
                `x=${output.x}\n` +
                'y=31\n' +
                'width=40\n' +
                'height=35\n' +
                'scroll=35\n' +
                'hide=yes'
        );
        hoverRects.push(
            `[com_${output.hoverRect}]\n` +
                `layer=com_${output.hoverLayer}\n` +
                'type=rect\n' +
                'x=0\n' +
                'y=0\n' +
                'width=40\n' +
                'height=35\n' +
                'fill=yes\n' +
                `colour=${COLLECTION_HOVER_COLOUR}\n` +
                `trans=${COLLECTION_HOVER_TRANSPARENCY}`
        );
    }

    source = source.trimEnd() + '\n\n' + [...hoverSensors, ...hoverLayers, ...hoverRects].join('\n\n') + '\n';
    fs.writeFileSync(file, source, 'utf8');
}

function blankComponentText(source: string, componentId: number) {
    const pattern = new RegExp(`if_settext\\(${GROUP109_INTERFACE_NAME}:com_${componentId}, "[^"\\n]*"\\);`, 'g');
    const count = source.match(pattern)?.length ?? 0;
    if (count === 0) {
        throw new Error(`Grand Exchange collection runtime has no text assignment for com_${componentId}`);
    }
    return source.replace(pattern, `if_settext(${GROUP109_INTERFACE_NAME}:com_${componentId}, "");`);
}

function patchCollectionRuntime(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_collection.rs2'
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const slot of COLLECTION_SLOTS) {
        source = blankComponentText(source, slot.status);
        source = blankComponentText(source, slot.detail);
        source = blankComponentText(source, slot.legacyCollect);

        for (const componentId of [slot.detail, slot.legacyCollect]) {
            source = source.replaceAll(
                `if_sethide(${GROUP109_INTERFACE_NAME}:com_${componentId}, false);`,
                `if_sethide(${GROUP109_INTERFACE_NAME}:com_${componentId}, true);`
            );
        }
    }

    fs.writeFileSync(file, source.trimEnd() + '\n', 'utf8');
}

function injectCollectionHoverInterfaceMappings(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const { content, values } = readPack(packPath);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (let componentId = COLLECTION_HOVER_COMPONENT_MIN; componentId <= COLLECTION_HOVER_COMPONENT_MAX; componentId++) {
        const localId = GROUP109_COMPONENT_BASE + componentId;
        const expectedName = `${GROUP109_INTERFACE_NAME}:com_${componentId}`;
        const existingName = values.get(localId);
        if (existingName && existingName !== expectedName) {
            throw new Error(`Grand Exchange collection hover local interface ID ${localId} is already mapped to ${existingName}`);
        }
        const existingId = names.get(expectedName);
        if (typeof existingId === 'number' && existingId !== localId) {
            throw new Error(`Grand Exchange collection hover name ${expectedName} is already mapped to ${existingId}`);
        }
        if (!existingName) {
            additions.push(`${localId}=${expectedName}`);
            values.set(localId, expectedName);
            names.set(expectedName, localId);
        }
    }

    if (additions.length > 0) {
        const normalized = content.endsWith('\n') ? content : `${content}\n`;
        fs.writeFileSync(packPath, normalized + additions.join('\n') + '\n', 'utf8');
    }

    const order = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    for (let componentId = COLLECTION_HOVER_COMPONENT_MIN; componentId <= COLLECTION_HOVER_COMPONENT_MAX; componentId++) {
        const localId = GROUP109_COMPONENT_BASE + componentId;
        const count = order.filter(value => Number.parseInt(value, 10) === localId).length;
        if (count > 1) throw new Error(`Grand Exchange collection hover local interface ID ${localId} appears ${count} times`);
        if (count === 0) order.push(String(localId));
    }
    fs.writeFileSync(orderPath, order.join('\n') + '\n', 'utf8');
}

export function prepareGrandExchangeCollectionPresentationStage(stagedContentDir: string) {
    stageSlotFrame(stagedContentDir);
    patchCollectionInterface(stagedContentDir);
    patchCollectionRuntime(stagedContentDir);
    injectCollectionHoverInterfaceMappings(stagedContentDir);
}

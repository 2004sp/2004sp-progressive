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

const SLOT_BACKGROUNDS = [
    { component: 16, sourceX: 93, sourceY: 100, x: 88, y: 95 },
    { component: 21, sourceX: 209, sourceY: 100, x: 204, y: 95 },
    { component: 26, sourceX: 325, sourceY: 100, x: 320, y: 95 },
    { component: 34, sourceX: 93, sourceY: 190, x: 88, y: 185 },
    { component: 42, sourceX: 209, sourceY: 190, x: 204, y: 185 },
    { component: 50, sourceX: 325, sourceY: 190, x: 320, y: 185 },
] as const;

const EMPTY_STATUS_COMPONENTS = [58, 62, 66, 70, 74, 78] as const;

function componentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Grand Exchange collection presentation is missing ${marker}`);
    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next < 0 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
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
        'grand_exchange_group_109.if'
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

    for (const componentId of EMPTY_STATUS_COMPONENTS) {
        const current = componentBlock(source, componentId);
        if (!current.block.includes('\ntext=Empty\n')) {
            throw new Error(`Grand Exchange collection empty status com_${componentId} no longer contains text=Empty`);
        }
        const replacement = current.block.replace('\ntext=Empty\n', '\ntext=\n');
        source = source.slice(0, current.start) + replacement + source.slice(current.end);
    }

    fs.writeFileSync(file, source, 'utf8');
}

function patchCollectionRuntimeText(stagedContentDir: string) {
    const file = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_collection.rs2'
    );
    let source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const componentId of EMPTY_STATUS_COMPONENTS) {
        const from = `if_settext(grand_exchange_group_109:com_${componentId}, "Empty");`;
        const to = `if_settext(grand_exchange_group_109:com_${componentId}, "");`;
        let replacements = 0;
        while (source.includes(from)) {
            source = source.replace(from, to);
            replacements++;
        }
        if (replacements === 0) {
            throw new Error(`Grand Exchange collection runtime has no empty-state text for com_${componentId}`);
        }
    }

    fs.writeFileSync(file, source, 'utf8');
}

export function prepareGrandExchangeCollectionPresentationStage(stagedContentDir: string) {
    stageSlotFrame(stagedContentDir);
    patchCollectionInterface(stagedContentDir);
    patchCollectionRuntimeText(stagedContentDir);
}

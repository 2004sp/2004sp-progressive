import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const PROGRESS_WIDTH = 126;
const PROGRESS_HEIGHT = 14;
const FILLED_PROGRESS_COLOUR = '0xCC9800';
const PROGRESS_HELPER_COMPONENT_MIN = 256;
const PROGRESS_HELPER_COMPONENT_MAX = 267;
const PROGRESS_HELPER_LOCAL_ID_BASE = 10792;

// These IF1-only helpers deliberately live outside the seven reserved 256-ID
// GE component blocks. The generic compatibility/cache validators run before
// this stage; this stage then owns collision checks and exact mappings for this
// narrow extension instead of weakening those validators for unrelated widgets.
const ACTIVE_OFFERS = [
    { slot: 1, layer: 19, background: 244, clip: 256, fill: 262 },
    { slot: 2, layer: 35, background: 245, clip: 257, fill: 263 },
    { slot: 3, layer: 51, background: 246, clip: 258, fill: 264 },
    { slot: 4, layer: 70, background: 247, clip: 259, fill: 265 },
    { slot: 5, layer: 89, background: 248, clip: 260, fill: 266 },
    { slot: 6, layer: 108, background: 249, clip: 261, fill: 267 },
] as const;

function getComponentBlock(source: string, componentId: number) {
    const marker = `[com_${componentId}]`;
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange live progress is missing ${marker}`);
    }

    const next = source.indexOf('\n[com_', start + marker.length);
    const end = next === -1 ? source.length : next;
    return source.slice(start, end);
}

function replaceExactlyOnce(source: string, needle: string, replacement: string, label: string) {
    const first = source.indexOf(needle);
    if (first === -1) {
        throw new Error(`Grand Exchange live progress cannot find ${label}`);
    }
    if (source.indexOf(needle, first + needle.length) !== -1) {
        throw new Error(`Grand Exchange live progress found multiple ${label} occurrences`);
    }
    return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const [lineIndex, rawLine] of content.split('\n').entries()) {
        const line = rawLine.trim();
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals <= 0 || equals === line.length - 1) {
            throw new Error(`Grand Exchange live progress found malformed pack line ${lineIndex + 1} in ${file}`);
        }
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (!Number.isInteger(id)) {
            throw new Error(`Grand Exchange live progress found invalid pack ID on line ${lineIndex + 1} in ${file}`);
        }
        values.set(id, line.slice(equals + 1));
    }

    return { content, values };
}

function helperLocalId(componentId: number) {
    if (componentId < PROGRESS_HELPER_COMPONENT_MIN || componentId > PROGRESS_HELPER_COMPONENT_MAX) {
        throw new Error(`Grand Exchange live progress helper com_${componentId} is outside its owned range`);
    }
    return PROGRESS_HELPER_LOCAL_ID_BASE + componentId - PROGRESS_HELPER_COMPONENT_MIN;
}

function appendProgressHelpers(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${GE_INTERFACE_NAME}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange live progress interface is missing: ${interfacePath}`);
    }

    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        if (source.includes(`[com_${componentId}]`)) {
            throw new Error(`Grand Exchange live progress helper com_${componentId} is already in use`);
        }
    }

    const clipHelpers: string[] = [];
    const fillHelpers: string[] = [];
    for (const offer of ACTIVE_OFFERS) {
        const background = getComponentBlock(source, offer.background);
        for (const required of [
            `layer=com_${offer.layer}`,
            'type=rect',
            'x=7',
            'y=82',
            `width=${PROGRESS_WIDTH}`,
            `height=${PROGRESS_HEIGHT}`,
            'fill=yes',
            'colour=0x211D19',
        ]) {
            if (!background.includes(required)) {
                throw new Error(`Grand Exchange live progress background com_${offer.background} lost ${required}`);
            }
        }

        clipHelpers.push(
            `[com_${offer.clip}]\n` +
            `layer=com_${offer.layer}\n` +
            `type=layer\n` +
            `x=7\n` +
            `y=82\n` +
            `width=${PROGRESS_WIDTH}\n` +
            `height=${PROGRESS_HEIGHT}\n` +
            `scroll=${PROGRESS_HEIGHT}`
        );
        fillHelpers.push(
            `[com_${offer.fill}]\n` +
            `layer=com_${offer.clip}\n` +
            `type=rect\n` +
            `x=0\n` +
            `y=0\n` +
            `width=${PROGRESS_WIDTH}\n` +
            `height=${PROGRESS_HEIGHT}\n` +
            `fill=yes\n` +
            `colour=${FILLED_PROGRESS_COLOUR}`
        );
    }

    source = source.trimEnd() + '\n\n' + [...clipHelpers, ...fillHelpers].join('\n\n') + '\n';
    fs.writeFileSync(interfacePath, source, 'utf8');
}

function injectProgressHelperMappings(stagedContentDir: string) {
    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const { content, values } = readPack(packPath);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        const localId = helperLocalId(componentId);
        const expectedName = `${GE_INTERFACE_NAME}:com_${componentId}`;
        const existingName = values.get(localId);
        if (existingName && existingName !== expectedName) {
            throw new Error(`Grand Exchange live progress local interface ID ${localId} is already mapped to ${existingName}`);
        }

        const existingId = names.get(expectedName);
        if (typeof existingId === 'number' && existingId !== localId) {
            throw new Error(`Grand Exchange live progress name ${expectedName} is already mapped to ${existingId}`);
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

    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    for (let componentId = PROGRESS_HELPER_COMPONENT_MIN; componentId <= PROGRESS_HELPER_COMPONENT_MAX; componentId++) {
        const localId = helperLocalId(componentId);
        const count = orderLines.filter(value => Number.parseInt(value, 10) === localId).length;
        if (count > 1) {
            throw new Error(`Grand Exchange live progress local interface ID ${localId} appears ${count} times in interface.order`);
        }
        if (count === 0) orderLines.push(String(localId));
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function patchActiveOfferRefresh(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_active_offer.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange live progress refresh script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');
    for (const offer of ACTIVE_OFFERS) {
        const showBackground = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.background}, false);`;
        const renderer = [
            showBackground,
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, false);`,
            `    if ($quantity_${offer.slot} <= 0 | $filled_${offer.slot} <= 0) {`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
            `    } else if ($filled_${offer.slot} >= $quantity_${offer.slot}) {`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, 0, 0);`,
            '    } else {',
            `        def_int $progress_scaled_${offer.slot} = multiply($filled_${offer.slot}, ${PROGRESS_WIDTH});`,
            `        def_int $progress_pixels_${offer.slot} = divide($progress_scaled_${offer.slot}, $quantity_${offer.slot});`,
            `        def_int $progress_offset_${offer.slot} = sub($progress_pixels_${offer.slot}, ${PROGRESS_WIDTH});`,
            `        if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, $progress_offset_${offer.slot}, 0);`,
            '    }',
        ].join('\n');
        source = replaceExactlyOnce(source, showBackground, renderer, `slot ${offer.slot} occupied progress renderer`);

        const hideBackground = `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.background}, true);`;
        const hidden = [
            hideBackground,
            `    if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, true);`,
            `    if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
        ].join('\n');
        source = replaceExactlyOnce(source, hideBackground, hidden, `slot ${offer.slot} empty progress reset`);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function validateLiveProgress(stagedContentDir: string) {
    const interfacePath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces', `${GE_INTERFACE_NAME}.if`);
    const interfaceSource = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const refreshPath = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'scripts', 'grand_exchange_active_offer.rs2');
    const refreshSource = fs.readFileSync(refreshPath, 'utf8').replace(/\r/g, '');

    const packPath = path.join(stagedContentDir, 'pack', 'interface.pack');
    const { values } = readPack(packPath);
    const order = fs.readFileSync(path.join(stagedContentDir, 'pack', 'interface.order'), 'utf8')
        .replace(/\r/g, '')
        .split('\n')
        .filter(Boolean)
        .map(value => Number.parseInt(value, 10));

    for (const offer of ACTIVE_OFFERS) {
        const clip = getComponentBlock(interfaceSource, offer.clip);
        for (const required of [
            `layer=com_${offer.layer}`,
            'type=layer',
            'x=7',
            'y=82',
            `width=${PROGRESS_WIDTH}`,
            `height=${PROGRESS_HEIGHT}`,
            `scroll=${PROGRESS_HEIGHT}`,
        ]) {
            if (!clip.includes(required)) {
                throw new Error(`Grand Exchange live progress clip com_${offer.clip} lost ${required}`);
            }
        }

        const fill = getComponentBlock(interfaceSource, offer.fill);
        for (const required of [
            `layer=com_${offer.clip}`,
            'type=rect',
            'x=0',
            'y=0',
            `width=${PROGRESS_WIDTH}`,
            `height=${PROGRESS_HEIGHT}`,
            'fill=yes',
            `colour=${FILLED_PROGRESS_COLOUR}`,
        ]) {
            if (!fill.includes(required)) {
                throw new Error(`Grand Exchange live progress fill com_${offer.fill} lost ${required}`);
            }
        }

        for (const componentId of [offer.clip, offer.fill]) {
            const localId = helperLocalId(componentId);
            const expectedName = `${GE_INTERFACE_NAME}:com_${componentId}`;
            if (values.get(localId) !== expectedName) {
                throw new Error(`Grand Exchange live progress mapping ${localId} != ${expectedName}`);
            }
            if (order.filter(id => id === localId).length !== 1) {
                throw new Error(`Grand Exchange live progress mapping ${localId} must appear exactly once in interface.order`);
            }
        }

        for (const required of [
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, false);`,
            `if ($quantity_${offer.slot} <= 0 | $filled_${offer.slot} <= 0) {`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, -${PROGRESS_WIDTH}, 0);`,
            `} else if ($filled_${offer.slot} >= $quantity_${offer.slot}) {`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, 0, 0);`,
            `def_int $progress_scaled_${offer.slot} = multiply($filled_${offer.slot}, ${PROGRESS_WIDTH});`,
            `def_int $progress_pixels_${offer.slot} = divide($progress_scaled_${offer.slot}, $quantity_${offer.slot});`,
            `def_int $progress_offset_${offer.slot} = sub($progress_pixels_${offer.slot}, ${PROGRESS_WIDTH});`,
            `if_setposition(${GE_INTERFACE_NAME}:com_${offer.fill}, $progress_offset_${offer.slot}, 0);`,
            `if_sethide(${GE_INTERFACE_NAME}:com_${offer.clip}, true);`,
        ]) {
            if (!refreshSource.includes(required)) {
                throw new Error(`Grand Exchange live progress slot ${offer.slot} is missing ${required}`);
            }
        }
    }
}

export function prepareGrandExchangeLiveProgressStage(stagedContentDir: string) {
    appendProgressHelpers(stagedContentDir);
    injectProgressHelperMappings(stagedContentDir);
    patchActiveOfferRefresh(stagedContentDir);
    validateLiveProgress(stagedContentDir);
}

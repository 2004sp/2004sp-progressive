import fs from 'fs';
import path from 'path';

const GE_INTERFACE_NAME = 'grand_exchange_overview';
const SELL_INTERFACE_NAME = 'grand_exchange_sell_inventory';
const SELL_INTERFACE_ROOT = 8988;
const SELL_INTERFACE_INV_COMPONENT = 11393;
const SELL_INVENTORY_SIZE = 28;
const SELL_CATALOGUE_CHUNK_SIZE = 128;
const SELECTED_ITEM_INV = 'ge_selected_item';
const MAX_PRICE = 2147483647;
const SELL_ACTION_COMPONENTS = [31, 47, 63, 82, 101, 120] as const;

function readPack(file: string) {
    const values = new Map<number, string>();
    const content = fs.readFileSync(file, 'utf8').replace(/\r/g, '');

    for (const line of content.split('\n')) {
        if (!line) continue;
        const equals = line.indexOf('=');
        if (equals === -1) continue;
        const id = Number.parseInt(line.slice(0, equals), 10);
        if (Number.isInteger(id)) values.set(id, line.slice(equals + 1));
    }

    return { content, values };
}

function appendPackMappings(file: string, mappings: Map<number, string>, label: string) {
    const { content, values } = readPack(file);
    const names = new Map<string, number>();
    for (const [id, name] of values) names.set(name, id);

    const additions: string[] = [];
    for (const [id, name] of mappings) {
        const existingName = values.get(id);
        if (existingName && existingName !== name) {
            throw new Error(`${label} reserved ID ${id} is already mapped to ${existingName}`);
        }

        const existingId = names.get(name);
        if (typeof existingId === 'number' && existingId !== id) {
            throw new Error(`${label} name ${name} is already mapped to ${existingId}`);
        }

        if (!existingName) additions.push(`${id}=${name}`);
    }

    if (!additions.length) return;
    const normalized = content.endsWith('\n') ? content : `${content}\n`;
    fs.writeFileSync(file, normalized + additions.join('\n') + '\n', 'utf8');
}

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

function getScriptBlock(source: string, marker: string) {
    const start = source.indexOf(marker);
    if (start === -1) {
        throw new Error(`Grand Exchange sell-item selection is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next === -1 ? source.length : next;
    return { start, end, block: source.slice(start, end) };
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

function walkNativeObjectSources(directory: string, output: string[]) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            walkNativeObjectSources(fullPath, output);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.obj')) {
            output.push(fullPath);
        }
    }
}

function collectExplicitlyUntradeableSymbols(stagedContentDir: string) {
    const symbols = new Set<string>();
    const files: string[] = [];
    walkNativeObjectSources(path.join(stagedContentDir, 'scripts'), files);

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
        let current: string | null = null;
        let untradeable = false;

        const finish = () => {
            if (current && untradeable) symbols.add(current);
        };

        for (const rawLine of source.split('\n')) {
            const line = rawLine.trim();
            const section = line.match(/^\[([^\]]+)\]$/);
            if (section) {
                finish();
                current = section[1].trim();
                untradeable = false;
                continue;
            }
            if (current && /^tradeable\s*=\s*no$/i.test(line)) {
                untradeable = true;
            }
            if (current && /^dummyitem\s*=\s*(?!0\s*$|none\s*$).+/i.test(line)) {
                untradeable = true;
            }
        }
        finish();
    }

    return symbols;
}

function readNativeSellableObjectSymbols(stagedContentDir: string) {
    const explicitlyUntradeable = collectExplicitlyUntradeableSymbols(stagedContentDir);
    const { values } = readPack(path.join(stagedContentDir, 'pack', 'obj.pack'));
    const symbols = [...values.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, symbol]) => symbol)
        .filter(symbol =>
            symbol.length > 0 &&
            symbol !== 'coins' &&
            !symbol.toLowerCase().startsWith('cert_') &&
            !explicitlyUntradeable.has(symbol)
        );

    for (const symbol of symbols) {
        if (!/^[A-Za-z0-9_+.:]+$/.test(symbol)) {
            throw new Error(`Native r254 object symbol cannot be emitted safely into RuneScript: ${symbol}`);
        }
    }
    if (!symbols.length) throw new Error('Native r254 sellable object catalogue is empty');
    return symbols;
}

function patchSellSetupScript(stagedContentDir: string) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange.rs2'
    );
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Grand Exchange sell-item selection overview script is missing: ${scriptPath}`);
    }

    let source = fs.readFileSync(scriptPath, 'utf8').replace(/\r/g, '');

    {
        const marker = '[proc,ge_open_sell_offer_setup]';
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;

        const titleSetter = `if_settext(${GE_INTERFACE_NAME}:com_133, "Sell Offer");`;
        if (!block.includes(titleSetter)) {
            throw new Error('Grand Exchange sell setup no longer contains its Sell Offer title setter');
        }

        const setup = [
            `inv_clear(${SELECTED_ITEM_INV});`,
            `inv_transmit(inv, ${SELL_INTERFACE_NAME}:inv);`,
            `if_openmain_side(${GE_INTERFACE_NAME}, ${SELL_INTERFACE_NAME});`,
        ].join('\n');

        if (!block.includes(setup)) {
            block = block.replace(titleSetter, `${setup}\n${titleSetter}`);
        }

        source = source.slice(0, start) + block + source.slice(end);
    }

    {
        const marker = '[proc,ge_return_to_offer_summary]';
        const { start, end, block: originalBlock } = getScriptBlock(source, marker);
        let block = originalBlock;
        const gate = `if (map_feature("grandexchange") = false) {\n    return;\n}`;
        if (!block.includes(gate)) {
            throw new Error('Grand Exchange Back flow no longer contains its feature gate');
        }

        const cleanup = [
            `inv_stoptransmit(${SELL_INTERFACE_NAME}:inv);`,
            `inv_clear(${SELECTED_ITEM_INV});`,
            `if_openmain(${GE_INTERFACE_NAME});`,
        ].join('\n');

        if (!block.includes(cleanup)) {
            block = block.replace(gate, `${gate}\n${cleanup}`);
        }

        source = source.slice(0, start) + block + source.slice(end);
    }

    fs.writeFileSync(scriptPath, source, 'utf8');
}

function writeSellInventoryInterface(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${SELL_INTERFACE_NAME}.if`
    );
    fs.mkdirSync(path.dirname(interfacePath), { recursive: true });
    fs.writeFileSync(
        interfacePath,
        `[inv]\ntype=inv\nx=16\ny=8\nwidth=4\nheight=7\nmargin=10,4\noption1=Offer\n`,
        'utf8'
    );
}

function injectSellInterfaceMappings(stagedContentDir: string) {
    appendPackMappings(
        path.join(stagedContentDir, 'pack', 'interface.pack'),
        new Map([
            [SELL_INTERFACE_ROOT, SELL_INTERFACE_NAME],
            [SELL_INTERFACE_INV_COMPONENT, `${SELL_INTERFACE_NAME}:inv`],
        ]),
        'Grand Exchange sell-inventory interface'
    );

    const orderPath = path.join(stagedContentDir, 'pack', 'interface.order');
    const orderLines = fs.readFileSync(orderPath, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
    const existingOrder = new Set(orderLines.map(value => Number.parseInt(value, 10)));
    for (const id of [SELL_INTERFACE_ROOT, SELL_INTERFACE_INV_COMPONENT]) {
        if (!existingOrder.has(id)) {
            orderLines.push(String(id));
            existingOrder.add(id);
        }
    }
    fs.writeFileSync(orderPath, orderLines.join('\n') + '\n', 'utf8');
}

function buildSellCatalogueScripts(symbols: string[]) {
    const chunks: string[][] = [];
    for (let index = 0; index < symbols.length; index += SELL_CATALOGUE_CHUNK_SIZE) {
        chunks.push(symbols.slice(index, index + SELL_CATALOGUE_CHUNK_SIZE));
    }

    const chunkSources = chunks.map((chunk, chunkIndex) => {
        const checks = chunk.map(symbol =>
            `if ($item = ${symbol}) {\n    inv_setslot(${SELECTED_ITEM_INV}, 0, ${symbol}, 1);\n    return (true);\n}`
        ).join('\n');
        return `[proc,ge_sell_store_selected_item_${chunkIndex}](obj $item)(boolean)\n${checks}\nreturn (false);\n`;
    });

    const dispatcherCalls = chunks.map((_, chunkIndex) =>
        `if (~ge_sell_store_selected_item_${chunkIndex}($item) = true) return (true);`
    ).join('\n');
    const dispatcher = `[proc,ge_sell_store_selected_item](obj $item)(boolean)\n${dispatcherCalls}\nreturn (false);\n`;

    return {
        source: `${chunkSources.join('\n')}\n${dispatcher}`,
        triggerNames: [
            ...chunks.map((_, chunkIndex) => `[proc,ge_sell_store_selected_item_${chunkIndex}]`),
            '[proc,ge_sell_store_selected_item]',
        ],
    };
}

function buildSellSelectionScript(symbols: string[]) {
    const catalogue = buildSellCatalogueScripts(symbols);
    const source = `// Option-2-only native r254 sell-item selection. The side inventory is a\n// read-only transmit of the player's real inventory: selecting an item only\n// records offer setup state and does not reserve or move player wealth.\n\n[proc,ge_sell_apply_selection](obj $item, int $quantity)\nif (map_feature("grandexchange") = false) return;\nif ($quantity <= 0) return;\nif ($item = coins) {\n    mes("You can't sell coins on the Grand Exchange.");\n    return;\n}\nif (oc_uncert($item) ! $item | oc_tradeable($item) = false) {\n    mes("You can't sell this item on the Grand Exchange.");\n    return;\n}\nif (map_members = ^false & oc_members($item) = true) {\n    mes("You can't sell this item on a free world.");\n    return;\n}\ninv_clear(${SELECTED_ITEM_INV});\nif (~ge_sell_store_selected_item($item) = false) {\n    mes("You can't sell this item on the Grand Exchange.");\n    return;\n}\ninv_stoptransmit(${SELL_INTERFACE_NAME}:inv);\nif_openmain(${GE_INTERFACE_NAME});\nif_settext(${GE_INTERFACE_NAME}:com_133, "Sell Offer");\nif_sethide(${GE_INTERFACE_NAME}:com_16, true);\nif_sethide(${GE_INTERFACE_NAME}:com_126, false);\nif_sethide(${GE_INTERFACE_NAME}:com_156, false);\nif_sethide(${GE_INTERFACE_NAME}:com_192, true);\nif_sethide(${GE_INTERFACE_NAME}:com_197, true);\nif_sethide(${GE_INTERFACE_NAME}:com_200, true);\nif_setobject(${GE_INTERFACE_NAME}:com_138, $item, 100);\nif_setposition(${GE_INTERFACE_NAME}:com_139, 0, 0);\nif_setposition(${GE_INTERFACE_NAME}:com_143, 0, 0);\nif_setposition(${GE_INTERFACE_NAME}:com_144, 0, 0);\nif_settext(${GE_INTERFACE_NAME}:com_141, oc_name($item));\nif_settext(${GE_INTERFACE_NAME}:com_142, oc_desc($item));\n~ge_offer_quantity_set($quantity);\ndef_int $guide_price = ~ge_offer_guide_price();\ndef_int $minimum_delta = calc($guide_price / 20);\nif (calc($guide_price % 20) ! 0) {\n    $minimum_delta = add($minimum_delta, 1);\n}\ndef_int $minimum_price = sub($guide_price, $minimum_delta);\nif ($minimum_price < 1) {\n    $minimum_price = 1;\n}\ndef_int $maximum_delta = calc($guide_price / 20);\ndef_int $maximum_price = ${MAX_PRICE};\nif ($guide_price <= sub(${MAX_PRICE}, $maximum_delta)) {\n    $maximum_price = add($guide_price, $maximum_delta);\n}\nif_settext(${GE_INTERFACE_NAME}:com_140, append(append_num("", $guide_price), " gp"));\ndef_string $minimum_text = append(append_num("", $minimum_price), " gp");\ndef_string $maximum_text = append(append_num("", $maximum_price), " gp");\nif_settext(${GE_INTERFACE_NAME}:com_145, append(append($minimum_text, " - "), $maximum_text));\n~ge_offer_price_set($guide_price);\n\n[inv_button1,${SELL_INTERFACE_NAME}:inv]\nif (map_feature("grandexchange") = false) return;\ndef_int $slot = last_slot;\nif ($slot < 0 | $slot >= ${SELL_INVENTORY_SIZE}) return;\ndef_int $quantity = inv_getnum(inv, $slot);\nif ($quantity <= 0) return;\ndef_obj $item = oc_uncert(inv_getobj(inv, $slot));\n~ge_sell_apply_selection($item, $quantity);\n\n[if_close,${GE_INTERFACE_NAME}]\ninv_stoptransmit(${SELL_INTERFACE_NAME}:inv);\n\n${catalogue.source}\n`;

    return {
        source,
        triggerNames: [
            '[proc,ge_sell_apply_selection]',
            `[inv_button1,${SELL_INTERFACE_NAME}:inv]`,
            `[if_close,${GE_INTERFACE_NAME}]`,
            ...catalogue.triggerNames,
        ],
    };
}

function writeSellSelectionScript(stagedContentDir: string, symbols: string[]) {
    const scriptPath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'scripts',
        'grand_exchange_sell_item_selection.rs2'
    );
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    const generated = buildSellSelectionScript(symbols);
    fs.writeFileSync(scriptPath, generated.source, 'utf8');
    return generated.triggerNames;
}

function injectSellScriptMappings(stagedContentDir: string, triggerNames: string[]) {
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

    writeSellInventoryInterface(stagedContentDir);
    injectSellInterfaceMappings(stagedContentDir);
    patchSellSetupScript(stagedContentDir);

    const symbols = readNativeSellableObjectSymbols(stagedContentDir);
    const triggerNames = writeSellSelectionScript(stagedContentDir, symbols);
    injectSellScriptMappings(stagedContentDir, triggerNames);
}

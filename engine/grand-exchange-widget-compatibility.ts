import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const WIDGET_COMPATIBILITY_PATH = path.join(PLUGIN_DIR, 'widget-compatibility.json');

// The frozen r481 GE source uses only IF3 types 0/3/4/5/6. Keep this as a
// narrow compatibility gate around the existing r254 IF1 path rather than
// teaching the native client a general IF3/CS2 widget runtime. Group stages
// already materialize the handful of tiled/component-canvas sprite cases; this
// module verifies that every staged source stays inside the proven IF1 subset.

const EXPECTED_IN_SCOPE_GROUPS = [105, 106, 107, 108, 109, 110, 643] as const;
const EXPECTED_EXCLUDED_GROUPS = [645, 646] as const;
const EXPECTED_SOURCE_WIDGET_TYPE_COUNTS = {
    0: 129,
    3: 75,
    4: 99,
    5: 368,
    6: 8,
} as const;
const EXPECTED_FEATURE_ENVELOPE = {
    hidden_components: 28,
    tiled_sprite_components: 207,
    transparent_rect_components: 44,
    transparent_sprite_components: 1,
    sprite_shadow_components: 2,
    custom_line_height_components: 4,
    unshadowed_text_components: 3,
    model_components: 8,
    static_model_components: 1,
    action_components: 49,
    listener_components: 78,
    sprite_rotation_components: 0,
    sprite_outline_components: 0,
    sprite_flip_components: 0,
    drag_components: 0,
    scrollbar_components: 0,
    spell_action_components: 0,
} as const;
const EXPECTED_GROUPS = [
    { source_group_id: 105, interface_name: 'grand_exchange_overview', synthetic_if1_root_local_id: 8990, source_component_block_base: 9000, source_component_count: 214 },
    { source_group_id: 106, interface_name: 'grand_exchange_group_106', synthetic_if1_root_local_id: 8991, source_component_block_base: 9256, source_component_count: 146 },
    { source_group_id: 107, interface_name: 'grand_exchange_group_107', synthetic_if1_root_local_id: 8992, source_component_block_base: 9512, source_component_count: 19 },
    { source_group_id: 108, interface_name: 'grand_exchange_group_108', synthetic_if1_root_local_id: 8993, source_component_block_base: 9768, source_component_count: 98 },
    { source_group_id: 109, interface_name: 'grand_exchange_group_109', synthetic_if1_root_local_id: 8994, source_component_block_base: 10024, source_component_count: 58 },
    { source_group_id: 110, interface_name: 'grand_exchange_group_110', synthetic_if1_root_local_id: 8995, source_component_block_base: 10280, source_component_count: 93 },
    { source_group_id: 643, interface_name: 'grand_exchange_group_643', synthetic_if1_root_local_id: 8996, source_component_block_base: 10536, source_component_count: 51 },
] as const;
const EXPECTED_IF1_TYPES = ['layer', 'rect', 'text', 'graphic', 'model', 'inv'] as const;
const EXPECTED_IF1_FONTS = ['p11', 'p12', 'b12'] as const;
const FORBIDDEN_IF3_FIELDS = new Set([
    'hidden',
    'spritetiling',
    'spriteangle',
    'spriteoutline',
    'spriteshadow',
    'flipv',
    'fliph',
    'dragzone',
    'dragthreshold',
    'scrollbar',
    'spellaction',
    'onload',
    'onmouseover',
    'onmouseleave',
    'onvartransmit',
    'oninvtransmit',
    'onstattransmit',
    'onclick',
    'ondrag',
    'onscroll',
]);

type WidgetCompatibilityManifest = {
    version: number;
    source: {
        cache: string;
        revision_family: number;
        provided_timestamp: string;
        archive_sha256: string;
    };
    scope: {
        in_scope_interface_groups: number[];
        excluded_interface_groups: number[];
        source_component_count: number;
        source_widget_type_counts: Record<string, number>;
    };
    feature_envelope: Record<string, number>;
    groups: Array<{
        source_group_id: number;
        interface_name: string;
        synthetic_if1_root_local_id: number;
        source_component_block_base: number;
        source_component_count: number;
    }>;
    compatibility: {
        native_if1_types: string[];
        native_font_names: string[];
        strategies: string[];
    };
};

type ParsedComponent = {
    id: number;
    fields: Map<string, string>;
};

function sameNumbers(actual: readonly number[], expected: readonly number[]) {
    return actual.join(',') === expected.join(',');
}

function sameStrings(actual: readonly string[], expected: readonly string[]) {
    return actual.join(',') === expected.join(',');
}

function readManifest() {
    if (!fs.existsSync(WIDGET_COMPATIBILITY_PATH)) {
        throw new Error(`Grand Exchange widget compatibility manifest is missing: ${WIDGET_COMPATIBILITY_PATH}`);
    }
    return JSON.parse(fs.readFileSync(WIDGET_COMPATIBILITY_PATH, 'utf8')) as WidgetCompatibilityManifest;
}

function validateManifest(manifest: WidgetCompatibilityManifest) {
    if (
        manifest.version !== 1 ||
        manifest.source.cache !== 'runescape/568' ||
        manifest.source.revision_family !== 481 ||
        manifest.source.provided_timestamp !== '2007-12-12' ||
        manifest.source.archive_sha256 !== '868027c9ccf770b8bbb60c89aeeb9603796b40dcd501f32610176ffbf5bf1495' ||
        !sameNumbers(manifest.scope.in_scope_interface_groups, EXPECTED_IN_SCOPE_GROUPS) ||
        !sameNumbers(manifest.scope.excluded_interface_groups, EXPECTED_EXCLUDED_GROUPS) ||
        manifest.scope.source_component_count !== 679
    ) {
        throw new Error('Grand Exchange widget compatibility manifest no longer matches the frozen r481 scope');
    }

    for (const [type, count] of Object.entries(EXPECTED_SOURCE_WIDGET_TYPE_COUNTS)) {
        if (manifest.scope.source_widget_type_counts[type] !== count) {
            throw new Error(`Grand Exchange widget compatibility source type-${type} count drifted from the frozen r481 export`);
        }
    }
    if (Object.keys(manifest.scope.source_widget_type_counts).length !== Object.keys(EXPECTED_SOURCE_WIDGET_TYPE_COUNTS).length) {
        throw new Error('Grand Exchange widget compatibility manifest contains an unexpected r481 widget type');
    }

    for (const [feature, count] of Object.entries(EXPECTED_FEATURE_ENVELOPE)) {
        if (manifest.feature_envelope[feature] !== count) {
            throw new Error(`Grand Exchange widget compatibility feature ${feature} drifted from the frozen r481 export`);
        }
    }
    if (Object.keys(manifest.feature_envelope).length !== Object.keys(EXPECTED_FEATURE_ENVELOPE).length) {
        throw new Error('Grand Exchange widget compatibility manifest contains an unexpected source feature');
    }

    if (
        manifest.groups.length !== EXPECTED_GROUPS.length ||
        !sameStrings(manifest.compatibility.native_if1_types, EXPECTED_IF1_TYPES) ||
        !sameStrings(manifest.compatibility.native_font_names, EXPECTED_IF1_FONTS) ||
        manifest.compatibility.strategies.length !== 8
    ) {
        throw new Error('Grand Exchange widget compatibility IF1 strategy contract is incomplete');
    }

    for (let index = 0; index < EXPECTED_GROUPS.length; index++) {
        const actual = manifest.groups[index];
        const expected = EXPECTED_GROUPS[index];
        if (
            actual.source_group_id !== expected.source_group_id ||
            actual.interface_name !== expected.interface_name ||
            actual.synthetic_if1_root_local_id !== expected.synthetic_if1_root_local_id ||
            actual.source_component_block_base !== expected.source_component_block_base ||
            actual.source_component_count !== expected.source_component_count
        ) {
            throw new Error(`Grand Exchange widget compatibility group ${expected.source_group_id} mapping drifted from the frozen local-ID contract`);
        }
    }
}

function parseComponents(source: string, interfaceName: string) {
    const matches = Array.from(source.matchAll(/^\[com_(\d+)\]$/gm));
    const components = new Map<number, ParsedComponent>();

    for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const id = Number.parseInt(match[1], 10);
        if (components.has(id)) {
            throw new Error(`Grand Exchange ${interfaceName} contains duplicate component com_${id}`);
        }

        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length;
        const fields = new Map<string, string>();

        for (const rawLine of source.slice(start, end).split('\n')) {
            const line = rawLine.trim();
            if (!line || line.startsWith('//')) {
                continue;
            }

            const equals = line.indexOf('=');
            if (equals === -1) {
                continue;
            }

            const key = line.slice(0, equals).trim().toLowerCase();
            const value = line.slice(equals + 1).trim();
            if (fields.has(key)) {
                throw new Error(`Grand Exchange ${interfaceName}:com_${id} repeats field ${key}`);
            }
            fields.set(key, value);
        }

        components.set(id, { id, fields });
    }

    return components;
}

function requireField(component: ParsedComponent, interfaceName: string, field: string) {
    const value = component.fields.get(field);
    if (typeof value !== 'string') {
        throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} is missing required IF1 field ${field}`);
    }
    return value;
}

function validateByteField(component: ParsedComponent, interfaceName: string, field: string) {
    const value = component.fields.get(field);
    if (typeof value !== 'string') {
        return;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255 || String(parsed) !== value) {
        throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} has invalid ${field}=${value}; IF1 requires a byte value`);
    }
}

function validateBooleanField(component: ParsedComponent, interfaceName: string, field: string) {
    const value = component.fields.get(field);
    if (typeof value !== 'string') {
        return;
    }
    if (value !== 'yes' && value !== 'no') {
        throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} has invalid ${field}=${value}; expected yes/no`);
    }
}

function validateComponent(component: ParsedComponent, interfaceName: string, sourceComponentCount: number, components: Map<number, ParsedComponent>) {
    const type = requireField(component, interfaceName, 'type');
    if (!EXPECTED_IF1_TYPES.includes(type as (typeof EXPECTED_IF1_TYPES)[number])) {
        throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} requires unsupported IF1 type ${type}`);
    }

    requireField(component, interfaceName, 'width');
    requireField(component, interfaceName, 'height');

    const parent = component.fields.get('layer');
    if (parent) {
        const match = /^com_(\d+)$/.exec(parent);
        const parentId = match ? Number.parseInt(match[1], 10) : -1;
        if (!match || !components.has(parentId)) {
            throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} references unknown local IF1 parent ${parent}`);
        }
    }

    for (const field of component.fields.keys()) {
        if (FORBIDDEN_IF3_FIELDS.has(field)) {
            throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} leaks unsupported r481 IF3 field ${field} into the r254 IF1 source`);
        }
    }

    validateByteField(component, interfaceName, 'trans');
    validateBooleanField(component, interfaceName, 'fill');
    validateBooleanField(component, interfaceName, 'shadowed');
    validateBooleanField(component, interfaceName, 'center');

    const buttonType = component.fields.get('buttontype');
    if (buttonType && buttonType !== 'normal' && buttonType !== 'close') {
        throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} uses unsupported IF1 buttontype=${buttonType}`);
    }

    if (type === 'layer') {
        requireField(component, interfaceName, 'scroll');
    } else if (type === 'rect') {
        requireField(component, interfaceName, 'colour');
    } else if (type === 'text') {
        const font = requireField(component, interfaceName, 'font');
        requireField(component, interfaceName, 'colour');
        if (!EXPECTED_IF1_FONTS.includes(font as (typeof EXPECTED_IF1_FONTS)[number])) {
            throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} uses non-compatible font ${font}`);
        }
    } else if (type === 'graphic') {
        requireField(component, interfaceName, 'graphic');
        if (component.fields.has('activegraphic') && !component.fields.has('graphic')) {
            throw new Error(`Grand Exchange ${interfaceName}:com_${component.id} has an activegraphic without a base graphic`);
        }
    } else if (type === 'model') {
        requireField(component, interfaceName, 'zoom');
        if (component.fields.has('model')) {
            throw new Error(
                `Grand Exchange ${interfaceName}:com_${component.id} statically binds a model; in-scope r481 model widgets must remain native-r254 runtime item hosts`
            );
        }
    } else if (type === 'inv' && component.id < sourceComponentCount) {
        throw new Error(
            `Grand Exchange ${interfaceName}:com_${component.id} converts a frozen r481 source widget into an IF1 inventory; inventory hosts must be IF1-only helpers`
        );
    }
}

function validateInterfaceSource(stagedContentDir: string, group: WidgetCompatibilityManifest['groups'][number]) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        `${group.interface_name}.if`
    );
    if (!fs.existsSync(interfacePath)) {
        throw new Error(`Grand Exchange widget compatibility source was not staged: ${interfacePath}`);
    }

    const source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');
    const components = parseComponents(source, group.interface_name);
    for (let sourceId = 0; sourceId < group.source_component_count; sourceId++) {
        if (!components.has(sourceId)) {
            throw new Error(`Grand Exchange ${group.interface_name} is missing frozen source component com_${sourceId}`);
        }
    }

    for (const component of components.values()) {
        if (component.id > 255) {
            throw new Error(
                `Grand Exchange ${group.interface_name}:com_${component.id} escapes the reserved 256-component local block`
            );
        }
        validateComponent(component, group.interface_name, group.source_component_count, components);
    }
}

export function prepareGrandExchangeWidgetCompatibilityStage(stagedContentDir: string) {
    const manifest = readManifest();
    validateManifest(manifest);

    for (const group of manifest.groups) {
        validateInterfaceSource(stagedContentDir, group);
    }
}

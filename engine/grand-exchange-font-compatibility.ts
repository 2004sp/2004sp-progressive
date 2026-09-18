import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange');
const FONT_COMPATIBILITY_PATH = path.join(PLUGIN_DIR, 'font-compatibility.json');

const ASSET_MANIFESTS = [
    'overview-assets.json',
    'group106-assets.json',
    'group107-assets.json',
    'group108-assets.json',
    'group109-assets.json',
    'group110-assets.json',
    'group643-assets.json',
] as const;

const EXPECTED_MAPPINGS = new Map<number, { sourceCacheName: string; nativeFont: string }>([
    [494, { sourceCacheName: 'p11_full', nativeFont: 'p11' }],
    [495, { sourceCacheName: 'p12_full', nativeFont: 'p12' }],
    [496, { sourceCacheName: 'b12_full', nativeFont: 'b12' }],
]);

const FALLBACK_PREFIX = 'r481_ge_font_';

type FontCompatibilityManifest = {
    version: number;
    source: {
        cache: string;
        revision_family: number;
        archive_sha256: string;
    };
    scope: {
        in_scope_interface_groups: number[];
        excluded_interface_groups: number[];
        source_font_ids: number[];
    };
    decision: string;
    fallback_prefix: string;
    mappings: Array<{
        source_font_id: number;
        source_cache_name: string;
        native_font: string;
        status: string;
    }>;
    resource_imports: unknown[];
};

type GroupAssetManifest = {
    interface?: {
        font_compatibility?: Array<{
            source_font_id: number;
            candidate_native_font: string;
        }>;
    };
};

function walkFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const files: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkFiles(file));
        } else if (entry.isFile()) {
            files.push(file);
        }
    }
    return files;
}

function readAndValidateFontManifest() {
    if (!fs.existsSync(FONT_COMPATIBILITY_PATH)) {
        throw new Error(`Grand Exchange font compatibility manifest is missing: ${FONT_COMPATIBILITY_PATH}`);
    }

    const manifest = JSON.parse(fs.readFileSync(FONT_COMPATIBILITY_PATH, 'utf8')) as FontCompatibilityManifest;
    const expectedIds = [...EXPECTED_MAPPINGS.keys()];

    if (
        manifest.version !== 1 ||
        manifest.source.cache !== 'runescape/568' ||
        manifest.source.revision_family !== 481 ||
        manifest.scope.in_scope_interface_groups.join(',') !== '105,106,107,108,109,110,643' ||
        manifest.scope.excluded_interface_groups.join(',') !== '645,646' ||
        manifest.scope.source_font_ids.join(',') !== expectedIds.join(',') ||
        manifest.decision !== 'reuse-native-only' ||
        manifest.fallback_prefix !== FALLBACK_PREFIX ||
        manifest.resource_imports.length !== 0 ||
        manifest.mappings.length !== expectedIds.length
    ) {
        throw new Error('Grand Exchange font compatibility manifest no longer matches the frozen r481 dependency decision');
    }

    const mappings = new Map(manifest.mappings.map(mapping => [mapping.source_font_id, mapping]));
    for (const [sourceFontId, expected] of EXPECTED_MAPPINGS) {
        const mapping = mappings.get(sourceFontId);
        if (
            !mapping ||
            mapping.source_cache_name !== expected.sourceCacheName ||
            mapping.native_font !== expected.nativeFont ||
            mapping.status !== 'native-compatible'
        ) {
            throw new Error(
                `Grand Exchange font ${sourceFontId} must resolve ${expected.sourceCacheName} to native ${expected.nativeFont}`
            );
        }
    }
}

function validateGroupAssetMappings() {
    const seenSourceFontIds = new Set<number>();

    for (const filename of ASSET_MANIFESTS) {
        const manifestPath = path.join(PLUGIN_DIR, filename);
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Grand Exchange interface asset manifest is missing: ${manifestPath}`);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as GroupAssetManifest;
        for (const mapping of manifest.interface?.font_compatibility ?? []) {
            const expected = EXPECTED_MAPPINGS.get(mapping.source_font_id);
            if (!expected) {
                throw new Error(`${filename} references unexpected r481 font ${mapping.source_font_id}`);
            }
            if (mapping.candidate_native_font !== expected.nativeFont) {
                throw new Error(
                    `${filename} maps r481 font ${mapping.source_font_id} to ${mapping.candidate_native_font}; expected ${expected.nativeFont}`
                );
            }
            seenSourceFontIds.add(mapping.source_font_id);
        }
    }

    for (const sourceFontId of EXPECTED_MAPPINGS.keys()) {
        if (!seenSourceFontIds.has(sourceFontId)) {
            throw new Error(`Grand Exchange asset manifests no longer account for r481 font ${sourceFontId}`);
        }
    }
}

function validateStagedInterfaceFonts(stagedContentDir: string) {
    const interfaceDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'interfaces');
    const interfaceFiles = walkFiles(interfaceDir).filter(file => file.endsWith('.if'));
    if (interfaceFiles.length === 0) {
        throw new Error(`Grand Exchange staged interfaces are missing: ${interfaceDir}`);
    }

    const allowedFonts = new Set([...EXPECTED_MAPPINGS.values()].map(mapping => mapping.nativeFont));
    const usedFonts = new Set<string>();

    for (const interfaceFile of interfaceFiles) {
        const source = fs.readFileSync(interfaceFile, 'utf8').replace(/\r/g, '');
        for (const match of source.matchAll(/^font=([^\n]+)$/gm)) {
            const font = match[1].trim();
            if (!allowedFonts.has(font)) {
                throw new Error(
                    `Grand Exchange interface ${path.relative(REPO_DIR, interfaceFile)} uses unexpected font ${font}`
                );
            }
            usedFonts.add(font);
        }
    }

    for (const nativeFont of allowedFonts) {
        if (!usedFonts.has(nativeFont)) {
            throw new Error(`Grand Exchange staged interfaces no longer exercise native font ${nativeFont}`);
        }
    }
}

function validateNoImportedFallbackFonts() {
    const fallbackFiles = walkFiles(PLUGIN_DIR).filter(file => path.basename(file).startsWith(FALLBACK_PREFIX));
    if (fallbackFiles.length !== 0) {
        throw new Error(
            `Grand Exchange native-font compatibility decision forbids imported fallback font resources: ${fallbackFiles.join(', ')}`
        );
    }
}

export function prepareGrandExchangeFontCompatibilityStage(stagedContentDir: string) {
    readAndValidateFontManifest();
    validateGroupAssetMappings();
    validateStagedInterfaceFonts(stagedContentDir);
    validateNoImportedFallbackFonts();
}

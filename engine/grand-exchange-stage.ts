import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { prepareGrandExchangeStage as prepareGrandExchangeBaseStage, restoreGrandExchangeStage as restoreGrandExchangeBaseStage } from './grand-exchange-stage-base.js';
import { prepareGrandExchangeFontCompatibilityStage } from './grand-exchange-font-compatibility.js';
import { prepareGrandExchangeSpriteStage } from './grand-exchange-sprite-stage.js';
import { prepareGrandExchangeGroup106Stage } from './grand-exchange-group106-stage.js';
import { prepareGrandExchangeGroup107Stage } from './grand-exchange-group107-stage.js';
import { prepareGrandExchangeGroup108Stage } from './grand-exchange-group108-stage.js';
import { prepareGrandExchangeGroup109Stage } from './grand-exchange-group109-stage.js';
import { prepareGrandExchangeGroup110Stage } from './grand-exchange-group110-stage.js';
import { prepareGrandExchangeGroup643Stage } from './grand-exchange-group643-stage.js';
import { prepareGrandExchangeBuyOfferSetupStage } from './grand-exchange-buy-offer-stage.js';
import { prepareGrandExchangeSellOfferSetupStage } from './grand-exchange-sell-offer-stage.js';
import { prepareGrandExchangeOverviewInteractionStage } from './grand-exchange-overview-interaction-stage.js';
import { prepareGrandExchangeItemSearchStage } from './grand-exchange-item-search-stage.js';
import { prepareGrandExchangeItemSearchQolStage } from './grand-exchange-item-search-qol-stage.js';
import { prepareGrandExchangeRuneScriptTypeCompatibilityStage } from './grand-exchange-runescript-type-compatibility.js';
import { prepareGrandExchangeQuantityStage } from './grand-exchange-quantity-stage.js';
import { prepareGrandExchangePriceStage } from './grand-exchange-price-stage.js';
import { prepareGrandExchangeOfferPresentationStage } from './grand-exchange-offer-presentation-stage.js';
import { prepareGrandExchangeOfferSelectionStateStage } from './grand-exchange-offer-selection-state-stage.js';
import { prepareGrandExchangeOfferSubmitStage } from './grand-exchange-offer-submit-stage.js';
import { prepareGrandExchangeActiveOfferStage } from './grand-exchange-active-offer-stage.js';
import { prepareGrandExchangePartialFillStage } from './grand-exchange-partial-fill-stage.js';
import { prepareGrandExchangeCompletedOfferStage } from './grand-exchange-completed-offer-stage.js';
import { prepareGrandExchangeCancelledOfferStage } from './grand-exchange-cancelled-offer-stage.js';
import { prepareGrandExchangeActiveOfferDetailStage } from './grand-exchange-active-offer-detail-stage.js';
import { prepareGrandExchangeActiveOfferOverviewPresentationStage } from './grand-exchange-active-offer-overview-presentation-stage.js';
import { prepareGrandExchangePersistedHistoryStage, restoreGrandExchangePersistedHistoryRuntime } from './grand-exchange-persisted-history-stage.js';
import { prepareGrandExchangeSettlementStage } from './grand-exchange-settlement-stage.js';
import { prepareGrandExchangeHoverStage } from './grand-exchange-hover-stage.js';
import { prepareGrandExchangeWidgetCompatibilityStage } from './grand-exchange-widget-compatibility.js';
import { prepareGrandExchangeClientStateStage } from './grand-exchange-client-state-stage.js';
import { prepareGrandExchangeInterfaceCacheAdapter } from './grand-exchange-interface-cache-adapter.js';
import { prepareGrandExchangeLiveProgressStage } from './grand-exchange-live-progress-stage.js';
import { prepareGrandExchangeNpcStage } from './grand-exchange-npc-stage.js';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_SCRIPT_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange', 'content', 'scripts');

export function restoreGrandExchangeStage() {
    const runtimeRestored = restoreGrandExchangePersistedHistoryRuntime();
    const baseRestored = restoreGrandExchangeBaseStage();
    return runtimeRestored || baseRestored;
}

function assertNativeR254ItemDefinitionBoundary() {
    if (!fs.existsSync(PLUGIN_SCRIPT_DIR)) {
        return;
    }

    const directories = [PLUGIN_SCRIPT_DIR];
    const forbiddenItemConfigs: string[] = [];

    while (directories.length > 0) {
        const directory = directories.pop()!;
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                directories.push(fullPath);
                continue;
            }

            // Native item definitions live in RuneScript .obj sources. The GE
            // plugin may add interfaces, scripts, inventories and later the
            // clerk's NPC-specific assets, but it must never overlay an r481
            // item config into the staged r254 catalogue.
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.obj')) {
                forbiddenItemConfigs.push(path.relative(REPO_DIR, fullPath).replace(/\\/g, '/'));
            }
        }
    }

    if (forbiddenItemConfigs.length > 0) {
        throw new Error(
            `Grand Exchange plugin item-source boundary violation: r481 item definitions are not allowed (${forbiddenItemConfigs.join(', ')})`
        );
    }
}

function invalidateGrandExchangeServerConfigOutputs() {
    // Group 109 extends inv.pack with six option-2-only collection containers,
    // item search adds two temp result/selection containers, Confirm Offer adds
    // two temp context/submission containers, and authoritative active/partial/
    // completed/cancelled offer state shares six per-player temp slot containers.
    // Some installed engine packer revisions decide whether to rebuild inv.dat
    // from source mtimes alone, while the staged .inv files can retain their
    // checkout timestamps. That can leave the newly extended staged inv.pack
    // paired with the older native inv.dat; the RuneScript compiler then looks
    // up the new IDs and receives undefined before reading InvType.protect.
    //
    // The native server pack has already been snapshotted by the base stage, so
    // invalidate only the generated inventory outputs here. The option-2 build
    // must regenerate them from the staged source, and the launcher restores the
    // native copies after the custom server exits or if the build fails.
    for (const filename of ['inv.dat', 'inv.idx']) {
        fs.rmSync(path.join(ENGINE_DIR, 'data', 'pack', 'server', filename), { force: true });
    }
}

function insetGrandExchangeOverviewItemModels(stagedContentDir: string) {
    const interfacePath = path.join(
        stagedContentDir,
        'scripts',
        'grand_exchange',
        'interfaces',
        'grand_exchange_overview.if'
    );
    let source = fs.readFileSync(interfacePath, 'utf8').replace(/\r/g, '');

    for (const componentId of [33, 49, 65, 84, 103, 122]) {
        const marker = `[com_${componentId}]`;
        const start = source.indexOf(marker);
        if (start < 0) {
            throw new Error(`Grand Exchange active-offer item model is missing ${marker}`);
        }
        const next = source.indexOf('\n[com_', start + marker.length);
        const end = next < 0 ? source.length : next;
        const block = source.slice(start, end);

        for (const required of ['type=model', 'x=7', 'y=38', 'width=40', 'height=36']) {
            if (!block.includes(required)) {
                throw new Error(`Grand Exchange active-offer item model ${marker} no longer contains ${required}`);
            }
        }

        const insetBlock = block
            .replace('\nx=7\n', '\nx=9\n')
            .replace('\ny=38\n', '\ny=40\n')
            .replace('\nwidth=40\n', '\nwidth=36\n')
            .replace('\nheight=36\n', '\nheight=32\n');
        source = source.slice(0, start) + insetBlock + source.slice(end);
    }

    fs.writeFileSync(interfacePath, source, 'utf8');
}

export async function prepareGrandExchangeStage() {
    assertNativeR254ItemDefinitionBoundary();
    const stagedContentDir = await prepareGrandExchangeBaseStage();

    try {
        prepareGrandExchangeFontCompatibilityStage(stagedContentDir);
        await prepareGrandExchangeSpriteStage(stagedContentDir);
        await prepareGrandExchangeGroup106Stage(stagedContentDir);
        await prepareGrandExchangeGroup107Stage(stagedContentDir);
        await prepareGrandExchangeGroup108Stage(stagedContentDir);
        await prepareGrandExchangeGroup109Stage(stagedContentDir);
        await prepareGrandExchangeGroup110Stage(stagedContentDir);
        await prepareGrandExchangeGroup643Stage(stagedContentDir);
        prepareGrandExchangeBuyOfferSetupStage(stagedContentDir);
        prepareGrandExchangeSellOfferSetupStage(stagedContentDir);
        prepareGrandExchangeOverviewInteractionStage(stagedContentDir);
        prepareGrandExchangeItemSearchStage(stagedContentDir);
        prepareGrandExchangeItemSearchQolStage(stagedContentDir);
        prepareGrandExchangeRuneScriptTypeCompatibilityStage(stagedContentDir);
        prepareGrandExchangeQuantityStage(stagedContentDir);
        prepareGrandExchangePriceStage(stagedContentDir);
        prepareGrandExchangeOfferPresentationStage(stagedContentDir);
        prepareGrandExchangeOfferSelectionStateStage(stagedContentDir);
        prepareGrandExchangeOfferSubmitStage(stagedContentDir);
        prepareGrandExchangeActiveOfferStage(stagedContentDir);
        prepareGrandExchangePartialFillStage(stagedContentDir);
        prepareGrandExchangeCompletedOfferStage(stagedContentDir);
        prepareGrandExchangeCancelledOfferStage(stagedContentDir);
        insetGrandExchangeOverviewItemModels(stagedContentDir);
        prepareGrandExchangeActiveOfferOverviewPresentationStage(stagedContentDir);
        prepareGrandExchangeActiveOfferDetailStage(stagedContentDir);
        prepareGrandExchangePersistedHistoryStage(stagedContentDir);
        prepareGrandExchangeSettlementStage(stagedContentDir);
        await prepareGrandExchangeHoverStage(stagedContentDir);
        prepareGrandExchangeWidgetCompatibilityStage(stagedContentDir);
        prepareGrandExchangeClientStateStage(stagedContentDir);
        prepareGrandExchangeInterfaceCacheAdapter(stagedContentDir);
        // Keep the generic 256-ID compatibility/cache checks intact. The live
        // progress stage owns and validates its narrow post-check helper range.
        await prepareGrandExchangeLiveProgressStage(stagedContentDir);
        prepareGrandExchangeNpcStage(stagedContentDir);
        invalidateGrandExchangeServerConfigOutputs();
        return stagedContentDir;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

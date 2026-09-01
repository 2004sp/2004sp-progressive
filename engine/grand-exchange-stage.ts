import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { prepareGrandExchangeStage as prepareGrandExchangeBaseStage, restoreGrandExchangeStage } from './grand-exchange-stage-base.js';
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
import { prepareGrandExchangeItemSearchStage } from './grand-exchange-item-search-stage.js';
import { prepareGrandExchangeRuneScriptTypeCompatibilityStage } from './grand-exchange-runescript-type-compatibility.js';
import { prepareGrandExchangeQuantityStage } from './grand-exchange-quantity-stage.js';
import { prepareGrandExchangeWidgetCompatibilityStage } from './grand-exchange-widget-compatibility.js';
import { prepareGrandExchangeClientStateStage } from './grand-exchange-client-state-stage.js';
import { prepareGrandExchangeInterfaceCacheAdapter } from './grand-exchange-interface-cache-adapter.js';

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.join(ENGINE_DIR, '..');
const PLUGIN_SCRIPT_DIR = path.join(REPO_DIR, 'plugins', 'grand-exchange', 'content', 'scripts');

export { restoreGrandExchangeStage };

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
    // and item search adds two more temp containers for result/selection state.
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
        prepareGrandExchangeItemSearchStage(stagedContentDir);
        prepareGrandExchangeRuneScriptTypeCompatibilityStage(stagedContentDir);
        prepareGrandExchangeQuantityStage(stagedContentDir);
        prepareGrandExchangeWidgetCompatibilityStage(stagedContentDir);
        prepareGrandExchangeClientStateStage(stagedContentDir);
        prepareGrandExchangeInterfaceCacheAdapter(stagedContentDir);
        invalidateGrandExchangeServerConfigOutputs();
        return stagedContentDir;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

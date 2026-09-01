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

const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));

export { restoreGrandExchangeStage };

function invalidateGrandExchangeServerConfigOutputs() {
    // Group 109 extends inv.pack with six option-2-only collection containers.
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
        invalidateGrandExchangeServerConfigOutputs();
        return stagedContentDir;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

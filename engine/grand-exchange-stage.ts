import { prepareGrandExchangeStage as prepareGrandExchangeBaseStage, restoreGrandExchangeStage } from './grand-exchange-stage-base.js';
import { prepareGrandExchangeFontCompatibilityStage } from './grand-exchange-font-compatibility.js';
import { prepareGrandExchangeSpriteStage } from './grand-exchange-sprite-stage.js';
import { prepareGrandExchangeGroup106Stage } from './grand-exchange-group106-stage.js';
import { prepareGrandExchangeGroup107Stage } from './grand-exchange-group107-stage.js';
import { prepareGrandExchangeGroup108Stage } from './grand-exchange-group108-stage.js';
import { prepareGrandExchangeGroup109Stage } from './grand-exchange-group109-stage.js';
import { prepareGrandExchangeGroup110Stage } from './grand-exchange-group110-stage.js';
import { prepareGrandExchangeGroup643Stage } from './grand-exchange-group643-stage.js';

export { restoreGrandExchangeStage };

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
        return stagedContentDir;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

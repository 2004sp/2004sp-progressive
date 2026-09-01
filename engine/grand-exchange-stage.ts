import {
    prepareGrandExchangeStage as prepareGrandExchangeBaseStage,
    restoreGrandExchangeStage,
} from './grand-exchange-stage-base.js';
import { prepareGrandExchangeGroup106Stage } from './grand-exchange-group106-stage.js';

export { restoreGrandExchangeStage };

export async function prepareGrandExchangeStage() {
    const stagedContentDir = await prepareGrandExchangeBaseStage();

    try {
        await prepareGrandExchangeGroup106Stage(stagedContentDir);
        return stagedContentDir;
    } catch (error) {
        restoreGrandExchangeStage();
        throw error;
    }
}

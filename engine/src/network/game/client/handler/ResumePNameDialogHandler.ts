import Player from '#/engine/entity/Player.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ResumePNameDialog from '#/network/game/client/model/ResumePNameDialog.js';

export default class ResumePNameDialogHandler extends ClientGameMessageHandler<ResumePNameDialog> {
    handle(message: ResumePNameDialog, player: Player): boolean {
        const { input } = message;

        if (!player.activeScript || player.activeScript.execution !== ScriptState.NAMEDIALOG) {
            return false;
        }

        player.activeScript.lastString = input;
        player.executeScript(player.activeScript, true, true);
        return true;
    }
}

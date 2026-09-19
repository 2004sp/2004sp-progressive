import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class MessagePublic extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly colour: number, readonly effect: number, readonly input: Uint8Array) {
        super();
    }
}

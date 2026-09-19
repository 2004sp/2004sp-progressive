import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';

export default abstract class ClientGameMessage {
    abstract category: ClientGameProtCategory;
}

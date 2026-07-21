import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import ClientCheatDecoder from '#/network/game/client/codec/ClientCheatDecoder.js';
import IfButtonDecoder from '#/network/game/client/codec/IfButtonDecoder.js';
import MessagePrivateDecoder from '#/network/game/client/codec/MessagePrivateDecoder.js';
import MessagePublicDecoder from '#/network/game/client/codec/MessagePublicDecoder.js';
import MoveClickDecoder from '#/network/game/client/codec/MoveClickDecoder.js';
import OpLocDecoder from '#/network/game/client/codec/OpLocDecoder.js';
import OpNpcDecoder from '#/network/game/client/codec/OpNpcDecoder.js';
import OpObjDecoder from '#/network/game/client/codec/OpObjDecoder.js';
import OpPlayerDecoder from '#/network/game/client/codec/OpPlayerDecoder.js';
import ResumePNameDialogDecoder from '#/network/game/client/codec/ResumePNameDialogDecoder.js';
import ResumePauseButtonDecoder from '#/network/game/client/codec/ResumePauseButtonDecoder.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import IfButtonHandler from '#/network/game/client/handler/IfButtonHandler.js';
import MessagePrivateHandler from '#/network/game/client/handler/MessagePrivateHandler.js';
import MessagePublicHandler from '#/network/game/client/handler/MessagePublicHandler.js';
import MoveClickHandler from '#/network/game/client/handler/MoveClickHandler.js';
import OpLocHandler from '#/network/game/client/handler/OpLocHandler.js';
import OpNpcHandler from '#/network/game/client/handler/OpNpcHandler.js';
import OpObjHandler from '#/network/game/client/handler/OpObjHandler.js';
import OpPlayerHandler from '#/network/game/client/handler/OpPlayerHandler.js';
import ResumePNameDialogHandler from '#/network/game/client/handler/ResumePNameDialogHandler.js';
import ResumePauseButtonHandler from '#/network/game/client/handler/ResumePauseButtonHandler.js';

class ClientGameProtRepository {
    private decoders = new Map<ClientGameProt, ClientGameMessageDecoder<ClientGameMessage>>();
    private handlers = new Map<ClientGameProt, ClientGameMessageHandler<ClientGameMessage>>();

    constructor() {
        this.bind(new ClientCheatDecoder(), new ClientCheatHandler());
        this.bind(new IfButtonDecoder(), new IfButtonHandler());
        this.bind(new MessagePrivateDecoder(), new MessagePrivateHandler());
        this.bind(new MessagePublicDecoder(), new MessagePublicHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_GAMECLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_MINIMAPCLICK), new MoveClickHandler());
        this.bind(new MoveClickDecoder(ClientGameProt.MOVE_OPCLICK), new MoveClickHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC1, 1), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC2, 2), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC3, 3), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC4, 4), new OpLocHandler());
        this.bind(new OpLocDecoder(ClientGameProt.OPLOC5, 5), new OpLocHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC1, 1), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC2, 2), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC3, 3), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC4, 4), new OpNpcHandler());
        this.bind(new OpNpcDecoder(ClientGameProt.OPNPC5, 5), new OpNpcHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ1, 1), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ2, 2), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ3, 3), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ4, 4), new OpObjHandler());
        this.bind(new OpObjDecoder(ClientGameProt.OPOBJ5, 5), new OpObjHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER1, 1), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER2, 2), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER3, 3), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER4, 4), new OpPlayerHandler());
        this.bind(new OpPlayerDecoder(ClientGameProt.OPPLAYER5, 5), new OpPlayerHandler());
        this.bind(new ResumePNameDialogDecoder(), new ResumePNameDialogHandler());
        this.bind(new ResumePauseButtonDecoder(), new ResumePauseButtonHandler());
    }

    private bind<T extends ClientGameMessage>(decoder: ClientGameMessageDecoder<T>, handler: ClientGameMessageHandler<T>): void {
        this.decoders.set(decoder.prot, decoder as ClientGameMessageDecoder<ClientGameMessage>);
        this.handlers.set(decoder.prot, handler as ClientGameMessageHandler<ClientGameMessage>);
    }

    getDecoder(prot: ClientGameProt): ClientGameMessageDecoder<ClientGameMessage> | undefined {
        return this.decoders.get(prot);
    }

    getHandler(prot: ClientGameProt): ClientGameMessageHandler<ClientGameMessage> | undefined {
        return this.handlers.get(prot);
    }

    decode(prot: ClientGameProt, buf: Packet): ClientGameMessage | undefined {
        return this.getDecoder(prot)?.decode(buf);
    }
}

export default new ClientGameProtRepository();

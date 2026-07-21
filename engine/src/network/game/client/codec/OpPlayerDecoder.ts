import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';

export default class OpPlayerDecoder extends ClientGameMessageDecoder<OpPlayer> {
    constructor(readonly prot: ClientGameProt, private readonly op: number) {
        super();
    }

    decode(buf: Packet): OpPlayer {
        return new OpPlayer(this.op, buf.g2());
    }
}

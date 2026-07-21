import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';

export default class MessagePublicDecoder extends ClientGameMessageDecoder<MessagePublic> {
    prot = ClientGameProt.MESSAGE_PUBLIC;

    decode(buf: Packet): MessagePublic {
        const colour = buf.g1();
        const effect = buf.g1();
        const input = new Uint8Array(buf.available);
        buf.gdata(input, 0, input.length);
        return new MessagePublic(colour, effect, input);
    }
}

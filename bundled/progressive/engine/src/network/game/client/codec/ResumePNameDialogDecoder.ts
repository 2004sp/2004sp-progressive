import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ResumePNameDialog from '#/network/game/client/model/ResumePNameDialog.js';

export default class ResumePNameDialogDecoder extends ClientGameMessageDecoder<ResumePNameDialog> {
    prot = ClientGameProt.RESUME_P_NAMEDIALOG;

    decode(buf: Packet) {
        return new ResumePNameDialog(buf.gjstr());
    }
}

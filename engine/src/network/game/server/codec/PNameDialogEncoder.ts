import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import PNameDialog from '#/network/game/server/model/PNameDialog.js';

export default class PNameDialogEncoder extends ServerGameMessageEncoder<PNameDialog> {
    prot = ServerGameProt.P_NAMEDIALOG;

    encode(_: Packet, __: PNameDialog): void {}
}

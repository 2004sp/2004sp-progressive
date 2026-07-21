import WordEnc from '#/cache/wordenc/WordEnc.js';
import ClanManager from '#/engine/clan/ClanManager.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';
import WordPack from '#/wordenc/WordPack.js';

export default class MessagePublicHandler extends ClientGameMessageHandler<MessagePublic> {
    handle(message: MessagePublic, player: Player): boolean {
        const { input } = message;

        if (input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            // todo: do we still log their attempt to chat?
            return false;
        }

        const buf: Packet = Packet.alloc(0);
        buf.pdata(input, 0, input.length);
        buf.pos = 0;
        const unpack: string = WordPack.unpack(buf, input.length);
        buf.release();
        const text = WordEnc.filter(unpack).trim();
        const lower = text.toLowerCase();

        if (player.chatChannel === 'clan' && lower !== '/world' && lower !== 'world') {
            ClanManager.clanChat(player, text);
            return true;
        }

        if (player.socialProtect) {
            return false;
        }

        if (lower === '/clan' || lower === 'clan') {
            if (!ClanManager.isEnabled()) {
                player.messageGame('Clan chat is disabled.');
            } else if (!ClanManager.isReady()) {
                player.messageGame('Clan system is starting up. Try again in a moment.');
            } else {
                ClanManager.enterChat(player);
            }
            player.socialProtect = true;
            return true;
        }

        if (lower === '/world' || lower === 'world') {
            player.chatChannel = 'world';
            player.messageGame('You have entered world chat');
            player.socialProtect = true;
            return true;
        }

        if (text.length === 0) {
            player.socialProtect = true;
            return true;
        }

        for (const target of World.players) {
            target?.messageGame(`[World] ${player.username}: ${text}`);
        }
        player.logMessage = unpack;
        console.log('Player sent world message: ' + player.username + ': ' + unpack + ' (' + player.x + ' : ' + player.z + ')');
        player.socialProtect = true;
        return true;
    }
}

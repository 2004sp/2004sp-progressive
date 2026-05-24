import Player from '#/engine/entity/Player.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import { MoveSpeed } from '#/engine/entity/MoveSpeed.js';
import { botFindPath, botWalkPath } from '#/engine/GameMap.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import MessagePrivate from '#/network/game/client/model/MessagePrivate.js';
import { fromBase37 } from '#/util/JString.js';
import WordPack from '#/wordenc/WordPack.js';

export default class MessagePrivateHandler extends ClientGameMessageHandler<MessagePrivate> {
    handle(message: MessagePrivate, player: Player): boolean {
        const { username, input } = message;

        if (player.socialProtect || input.length > 100) {
            return false;
        }

        if (player.muted_until !== null && player.muted_until > new Date()) {
            // todo: do we still log their attempt to chat?
            return false;
        }

        if (fromBase37(username) === 'invalid_name') {
            World.notifyPlayerBan('automated', player.username, Date.now() + 172800000);
            return false;
        }

        const buf: Packet = Packet.alloc(0);
        buf.pdata(input, 0, input.length);
        buf.pos = 0;
        const unpacked = WordPack.unpack(buf, input.length);
        buf.release();

        if (this.handleBotPrivateCommand(player, username, unpacked)) {
            player.socialProtect = true;
            return true;
        }

        World.sendPrivateMessage(player, username, unpacked);
        player.socialProtect = true;
        return true;
    }

    private handleBotPrivateCommand(player: Player, username: bigint, message: string): boolean {
        if (message.trim().toLowerCase() !== 'come here') {
            return false;
        }

        const bot = World.getPlayerByUsername(fromBase37(username));
        if (!bot || !bot.is_bot || isClientConnected(bot)) {
            return false;
        }

        if (bot.level !== player.level || Math.max(Math.abs(bot.x - player.x), Math.abs(bot.z - player.z)) > 50) {
            return false;
        }

        const destination = this.getAdjacentTileNearestPlayer(player, bot);
        bot.botComeHereReturnX = bot.x;
        bot.botComeHereReturnZ = bot.z;
        bot.clearPendingAction();
        bot.clearWaypoints();
        bot.run = 1;
        bot.moveSpeed = MoveSpeed.RUN;
        this.runBotTo(bot, destination.x, destination.z);
        return true;
    }

    private runBotTo(bot: Player, x: number, z: number): void {
        let path = botWalkPath(bot.level, bot.x, bot.z, x, z);
        if (path.length === 0) {
            path = botFindPath(bot.level, bot.x, bot.z, x, z);
        }

        if (path.length > 0) {
            bot.queueWaypoints(path);
            return;
        }

        bot.queueWaypoint(x, z);
    }

    private getAdjacentTileNearestPlayer(player: Player, bot: Player): { x: number; z: number } {
        const offsets = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];

        let best = { x: player.x + offsets[0][0], z: player.z + offsets[0][1] };
        let bestDistance = Number.MAX_SAFE_INTEGER;
        for (const [dx, dz] of offsets) {
            const x = player.x + dx;
            const z = player.z + dz;
            const distance = Math.max(Math.abs(bot.x - x), Math.abs(bot.z - z));
            if (distance < bestDistance) {
                best = { x, z };
                bestDistance = distance;
            }
        }

        return best;
    }
}

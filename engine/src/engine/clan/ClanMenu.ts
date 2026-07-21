import Player from '#/engine/entity/Player.js';
import { ModalState } from '#/engine/entity/ModalState.js';
import ClanManager, { ClanRole, roleLong } from '#/engine/clan/ClanManager.js';
import IfClose from '#/network/game/server/model/IfClose.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';
import IfSetText from '#/network/game/server/model/IfSetText.js';
import PNameDialog from '#/network/game/server/model/PNameDialog.js';

const MULTI2 = 2459;
const MESSAGE5 = 374;
const MULTI5 = 2492;
const TITLE = 2460;
const CREATE = 2461;
const JOIN = 2462;
const HIDE_NO_HEADER = 2464;
const HIDE_HEADER = 2467;
const CLAN_TITLE = 2493;
const MEMBERS = 2494;
const ROLES = 2495;
const COMMANDS = 2496;
const LEAVE = 2497;
const CLOSE = 2498;
const CLAN_HIDE_NO_HEADER = 2501;
const CLAN_HIDE_HEADER = 2502;
const MESSAGE_LINE_1 = 375;
const MESSAGE_LINE_2 = 376;
const MESSAGE_LINE_3 = 377;
const MESSAGE_LINE_4 = 378;
const MESSAGE_LINE_5 = 379;
const MESSAGE_CONTINUE = 380;

type PendingAction = 'create' | 'join';
type OpenMenu = 'guest' | 'member' | 'detail' | 'leave';

const pending = new WeakMap<Player, PendingAction>();
const openMenus = new WeakMap<Player, OpenMenu>();

export default class ClanMenu {
    static open(player: Player): void {
        const info = ClanManager.getClanInfo(player);
        if (info) {
            this.openClan(player, info.displayName);
            return;
        }

        player.write(new IfSetText(TITLE, 'Clan Chat'));
        player.write(new IfSetText(CREATE, 'Create clan'));
        player.write(new IfSetText(JOIN, 'Join clan'));
        player.write(new IfSetHide(HIDE_NO_HEADER, true));
        player.write(new IfSetHide(HIDE_HEADER, false));
        player.openChatModal(MULTI2);
        player.resumeButtons.push(CREATE, JOIN);
        openMenus.set(player, 'guest');
    }

    private static openClan(player: Player, clanName: string): void {
        player.write(new IfSetText(CLAN_TITLE, `Clan name: ${clanName}`));
        player.write(new IfSetText(MEMBERS, 'Members'));
        player.write(new IfSetText(ROLES, 'Roles'));
        player.write(new IfSetText(COMMANDS, 'Commands'));
        player.write(new IfSetText(LEAVE, 'Leave Clan'));
        player.write(new IfSetText(CLOSE, 'Close Menu'));
        player.write(new IfSetHide(CLAN_HIDE_NO_HEADER, true));
        player.write(new IfSetHide(CLAN_HIDE_HEADER, false));
        player.openChatModal(MULTI5);
        player.resumeButtons.push(MEMBERS, ROLES, COMMANDS, LEAVE, CLOSE);
        openMenus.set(player, 'member');
    }

    static handleButton(player: Player, component: number): boolean {
        if (component !== CREATE && component !== JOIN) {
            return this.handleClanButton(player, component);
        }
        if (openMenus.get(player) === 'leave' && player.modalChat === MULTI2) {
            openMenus.delete(player);
            this.closeClanModal(player);
            if (component === CREATE) {
                const info = ClanManager.getClanInfo(player);
                if (info?.myRole === ClanRole.OWNER) {
                    void ClanManager.disband(player);
                } else {
                    void ClanManager.leave(player);
                }
            }
            return true;
        }
        if (openMenus.get(player) !== 'guest' || player.modalChat !== MULTI2) {
            return false;
        }

        openMenus.delete(player);
        pending.set(player, component === CREATE ? 'create' : 'join');
        this.clearClanModalState(player);
        player.write(new IfClose());
        player.write(new PNameDialog());
        return true;
    }

    private static handleClanButton(player: Player, component: number): boolean {
        if (component === MESSAGE_CONTINUE && openMenus.get(player) === 'detail' && player.modalChat === MESSAGE5) {
            return this.backToClan(player);
        }

        if (component < MEMBERS || component > CLOSE || openMenus.get(player) !== 'member' || player.modalChat !== MULTI5) {
            return false;
        }

        openMenus.delete(player);
        this.closeClanModal(player);

        const info = ClanManager.getClanInfo(player);
        if (!info) {
            player.messageGame('You are not in a clan.');
            return true;
        }

        if (component === MEMBERS) {
            const members = ClanManager.getMemberList(player);
            const lines = members.slice(0, 4).map(member => `${member.username} - ${roleLong(member.role)}${member.online ? ' (online)' : ''}`);
            this.openMessage(player, [`Clan '${info.displayName}' members (${members.length})`, ...lines]);
        } else if (component === ROLES) {
            this.openMessage(player, [
                `Your role: ${roleLong(info.myRole)}`,
                'Clan Member',
                'Clan Helper / Clan Mod',
                'Clan Admin',
                'Clan Owner'
            ]);
        } else if (component === COMMANDS) {
            this.openMessage(player, [
                'Clan commands',
                '::clan opens this menu',
                '/clan enters clan chat',
                '/world returns to world chat',
                ''
            ]);
        } else if (component === LEAVE) {
            this.openLeaveConfirm(player, info.myRole === ClanRole.OWNER);
        }
        return true;
    }

    static handlePauseButton(player: Player): boolean {
        if (openMenus.get(player) !== 'detail' || player.modalChat !== MESSAGE5) {
            return false;
        }
        return this.backToClan(player);
    }

    private static backToClan(player: Player): boolean {
        openMenus.delete(player);
        this.closeClanModal(player);
        const info = ClanManager.getClanInfo(player);
        if (info) {
            this.openClan(player, info.displayName);
        }
        return true;
    }

    private static openMessage(player: Player, lines: string[]): void {
        player.write(new IfSetText(MESSAGE_LINE_1, lines[0] ?? ''));
        player.write(new IfSetText(MESSAGE_LINE_2, lines[1] ?? ''));
        player.write(new IfSetText(MESSAGE_LINE_3, lines[2] ?? ''));
        player.write(new IfSetText(MESSAGE_LINE_4, lines[3] ?? ''));
        player.write(new IfSetText(MESSAGE_LINE_5, lines[4] ?? ''));
        player.write(new IfSetText(MESSAGE_CONTINUE, 'Back'));
        player.openChatModal(MESSAGE5);
        player.resumeButtons.push(MESSAGE_CONTINUE);
        openMenus.set(player, 'detail');
    }

    private static openLeaveConfirm(player: Player, isOwner: boolean): void {
        player.write(new IfSetText(TITLE, isOwner ? 'Disband clan?' : 'Leave clan?'));
        player.write(new IfSetText(CREATE, isOwner ? 'Disband Clan' : 'Leave Clan'));
        player.write(new IfSetText(JOIN, 'Cancel'));
        player.write(new IfSetHide(HIDE_NO_HEADER, true));
        player.write(new IfSetHide(HIDE_HEADER, false));
        player.openChatModal(MULTI2);
        player.resumeButtons.push(CREATE, JOIN);
        openMenus.set(player, 'leave');
    }

    private static closeClanModal(player: Player): void {
        player.closeModal();
        player.resumeButtons = [];
    }

    private static clearClanModalState(player: Player): void {
        player.modalChat = -1;
        player.modalState &= ~ModalState.CHAT;
        player.resumeButtons = [];
    }

    static handleName(player: Player, input: string): boolean {
        const action = pending.get(player);
        if (!action) {
            return false;
        }

        pending.delete(player);
        openMenus.delete(player);
        this.closeClanModal(player);

        if (action === 'create') {
            void ClanManager.create(player, input);
        } else {
            void ClanManager.join(player, input);
        }
        return true;
    }
}

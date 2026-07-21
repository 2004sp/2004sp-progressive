/**
 * ClanManager.ts
 *
 * Fully engine-side clan system. Does NOT depend on the content/ folder — the
 * old RuneScript `clan.rs2` is retired; the clan UI is driven by ClanMenu and
 * clan chat by `::clanchat`.
 *
 * Persistence: `clan` + `clan_member` tables in the engine DB (self-created on
 * startup, like BotDatabase). Kept in an in-memory cache for synchronous reads
 * (menu building + clan-chat broadcast) with write-through to the DB.
 *
 * Membership is keyed by username (lowercased), never account_id — the account
 * table is externally owned and absent in dev.
 */

import { db, toDbDate } from '#/db/query.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import MessageGame from '#/network/game/server/model/MessageGame.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo } from '#/util/Logger.js';

const clanDb = db as any;

// ── Role tiers ────────────────────────────────────────────────────────────────

export const ClanRole = {
    MEMBER: 1,
    HELPER: 2,
    MOD: 3,
    ADMIN: 4,
    OWNER: 5
} as const;

const ROLE_LONG: Record<number, string> = {
    1: 'Clan Member',
    2: 'Clan Helper',
    3: 'Clan Mod',
    4: 'Clan Admin',
    5: 'Clan Owner'
};

const ROLE_SHORT: Record<number, string> = {
    1: 'Member',
    2: 'Helper',
    3: 'Mod',
    4: 'Admin',
    5: 'Owner'
};

export function roleLong(tier: number): string {
    return ROLE_LONG[tier] ?? 'Clan Member';
}

export function roleShort(tier: number): string {
    return ROLE_SHORT[tier] ?? 'Member';
}

// ── In-memory model ───────────────────────────────────────────────────────────

interface ClanMember {
    username: string;   // lowercased
    role: number;
    mutedUntil: number; // epoch ms; 0 = not muted
}

interface Clan {
    id: number;
    name: string;        // lowercased, unique
    displayName: string;
    owner: string;       // lowercased username
    permDelete: number;
    permKick: number;
    permMute: number;
    members: Map<string, ClanMember>; // key = lowercased username
}

const NAME_RE = /^[a-z0-9 _]{2,15}$/;

function norm(username: string): string {
    return username.trim().toLowerCase();
}

// Public view types for the menu layer.
export interface ClanInfoView { displayName: string; myRole: number; size: number }
export interface ClanPermsView { del: number; kick: number; mute: number }
export interface ClanMemberView { username: string; role: number; online: boolean; muted: boolean }

class ClanManagerImpl {
    private clans = new Map<number, Clan>();
    private byName = new Map<string, number>();     // lower name -> clan id
    private byPlayer = new Map<string, number>();   // lower username -> clan id
    private ready = false;

    // ── Startup ────────────────────────────────────────────────────────────────

    isEnabled(): boolean {
        return Environment.NODE_FEATURE_CLANS;
    }

    async init(): Promise<void> {
        if (!Environment.NODE_FEATURE_CLANS) {
            // Feature disabled: no tables, no cache — the clan system stays hidden.
            printInfo('[ClanManager] clan system disabled (set NODE_FEATURE_CLANS=true to enable)');
            return;
        }
        try {
            await db.schema
                .createTable('clan')
                .ifNotExists()
                .addColumn('id', 'integer', c => c.primaryKey().autoIncrement())
                .addColumn('name', 'text', c => c.notNull().unique())
                .addColumn('display_name', 'text', c => c.notNull())
                .addColumn('owner', 'text', c => c.notNull())
                .addColumn('created', 'text', c => c.notNull())
                .addColumn('perm_delete', 'integer', c => c.notNull().defaultTo(ClanRole.OWNER))
                .addColumn('perm_kick', 'integer', c => c.notNull().defaultTo(ClanRole.ADMIN))
                .addColumn('perm_mute', 'integer', c => c.notNull().defaultTo(ClanRole.MOD))
                .execute();

            await db.schema
                .createTable('clan_member')
                .ifNotExists()
                .addColumn('clan_id', 'integer', c => c.notNull())
                .addColumn('username', 'text', c => c.notNull())
                .addColumn('role', 'integer', c => c.notNull().defaultTo(ClanRole.MEMBER))
                .addColumn('joined', 'text', c => c.notNull())
                .addColumn('muted_until', 'text')
                .addPrimaryKeyConstraint('clan_member_pk', ['clan_id', 'username'])
                .execute();

            const clanRows = await clanDb.selectFrom('clan').selectAll().execute();
            for (const row of clanRows) {
                const clan: Clan = {
                    id: row.id,
                    name: row.name,
                    displayName: row.display_name,
                    owner: row.owner,
                    permDelete: row.perm_delete,
                    permKick: row.perm_kick,
                    permMute: row.perm_mute,
                    members: new Map()
                };
                this.clans.set(clan.id, clan);
                this.byName.set(clan.name, clan.id);
            }

            const memberRows = await clanDb.selectFrom('clan_member').selectAll().execute();
            for (const row of memberRows) {
                const clan = this.clans.get(row.clan_id);
                if (!clan) {
                    continue;
                }
                clan.members.set(row.username, {
                    username: row.username,
                    role: row.role,
                    mutedUntil: row.muted_until ? new Date(row.muted_until).getTime() : 0
                });
                this.byPlayer.set(row.username, clan.id);
            }

            this.ready = true;
        } catch (err) {
            printError('[ClanManager] init failed: ' + err);
        }
    }

    isReady(): boolean {
        return this.ready;
    }

    // ── Lookups ──────────────────────────────────────────────────────────────

    private clanOf(player: Player): Clan | undefined {
        const id = this.byPlayer.get(norm(player.username));
        return id === undefined ? undefined : this.clans.get(id);
    }

    private memberOf(player: Player): { clan: Clan; member: ClanMember } | undefined {
        const clan = this.clanOf(player);
        if (!clan) {
            return undefined;
        }
        const member = clan.members.get(norm(player.username));
        return member ? { clan, member } : undefined;
    }

    // ── Public views for the menu layer ──────────────────────────────────────

    getClanInfo(player: Player): ClanInfoView | undefined {
        const info = this.memberOf(player);
        if (!info) {
            return undefined;
        }
        return { displayName: info.clan.displayName, myRole: info.member.role, size: info.clan.members.size };
    }

    getPerms(player: Player): ClanPermsView | undefined {
        const clan = this.clanOf(player);
        if (!clan) {
            return undefined;
        }
        return { del: clan.permDelete, kick: clan.permKick, mute: clan.permMute };
    }

    getMemberList(player: Player): ClanMemberView[] {
        const clan = this.clanOf(player);
        if (!clan) {
            return [];
        }
        return [...clan.members.values()]
            .sort((a, b) => b.role - a.role)
            .map(m => ({
                username: m.username,
                role: m.role,
                online: !!World.getPlayerByUsername(m.username),
                muted: m.mutedUntil > Date.now()
            }));
    }

    // ── Create / join / leave ──────────────────────────────────────────────

    async create(player: Player, rawName: string): Promise<void> {
        if (this.clanOf(player)) {
            player.messageGame('You are already in a clan.');
            return;
        }
        const display = rawName.trim();
        const name = norm(display);
        if (!NAME_RE.test(name)) {
            player.messageGame('Clan name must be 2-15 chars (letters, numbers, space, underscore).');
            return;
        }
        if (this.byName.has(name)) {
            player.messageGame(`A clan named '${display}' already exists.`);
            return;
        }

        const owner = norm(player.username);
        const created = toDbDate(new Date());
        try {
            await clanDb.insertInto('clan').values({
                name,
                display_name: display,
                owner,
                created,
                perm_delete: ClanRole.OWNER,
                perm_kick: ClanRole.ADMIN,
                perm_mute: ClanRole.MOD
            }).execute();

            const row = await clanDb.selectFrom('clan').select('id').where('name', '=', name).executeTakeFirst();
            if (!row) {
                player.messageGame('Failed to create clan (db).');
                return;
            }

            const clan: Clan = {
                id: row.id,
                name,
                displayName: display,
                owner,
                permDelete: ClanRole.OWNER,
                permKick: ClanRole.ADMIN,
                permMute: ClanRole.MOD,
                members: new Map()
            };
            this.clans.set(clan.id, clan);
            this.byName.set(name, clan.id);
            await this.addMember(clan, owner, ClanRole.OWNER);

            player.messageGame(`Clan '${display}' created! You are the Clan Owner.`);
        } catch (err) {
            printError('[ClanManager] create failed: ' + err);
            player.messageGame('Failed to create clan.');
        }
    }

    async join(player: Player, rawName: string): Promise<void> {
        if (this.clanOf(player)) {
            player.messageGame('You are already in a clan.');
            return;
        }
        const name = norm(rawName);
        const id = this.byName.get(name);
        const clan = id === undefined ? undefined : this.clans.get(id);
        if (!clan) {
            player.messageGame(`Clan "${rawName.trim()}" Does not exist`);
            return;
        }
        await this.addMember(clan, norm(player.username), ClanRole.MEMBER);
        player.messageGame(`You joined clan '${clan.displayName}' as a Clan Member.`);
        this.broadcast(clan, `${player.username} has joined the clan.`);
    }

    async leave(player: Player): Promise<void> {
        const info = this.memberOf(player);
        if (!info) {
            player.messageGame('You are not in a clan.');
            return;
        }
        const { clan, member } = info;
        if (member.role === ClanRole.OWNER) {
            player.messageGame('You are the owner. Disband the clan to leave, or promote someone else first.');
            return;
        }
        await this.removeMember(clan, member.username);
        player.messageGame(`You have left clan '${clan.displayName}'.`);
        this.broadcast(clan, `${player.username} has left the clan.`);
    }

    // ── Role / permission management ─────────────────────────────────────────

    async setRole(player: Player, targetName: string, newRole: number): Promise<void> {
        const actor = this.memberOf(player);
        if (!actor) {
            return;
        }
        if (newRole < ClanRole.MEMBER || newRole > ClanRole.OWNER) {
            return;
        }
        const target = actor.clan.members.get(norm(targetName));
        if (!target) {
            player.messageGame(`'${targetName}' is not in your clan.`);
            return;
        }
        // Admin+ only, target strictly below actor, new role strictly below actor.
        if (actor.member.role < ClanRole.ADMIN || actor.member.role <= target.role) {
            player.messageGame('You do not have permission to change that member\'s role.');
            return;
        }
        if (newRole >= actor.member.role) {
            player.messageGame('You cannot assign a role equal to or above your own.');
            return;
        }
        target.role = newRole;
        await this.persistMember(actor.clan.id, target);
        player.messageGame(`${target.username} is now ${roleLong(newRole)}.`);
        World.getPlayerByUsername(target.username)?.messageGame(`You are now ${roleLong(newRole)} in ${actor.clan.displayName}.`);
    }

    async setPerm(player: Player, action: 'delete' | 'kick' | 'mute', tier: number): Promise<void> {
        const info = this.memberOf(player);
        if (!info || info.member.role < ClanRole.OWNER) {
            player.messageGame('Only the Clan Owner can configure permissions.');
            return;
        }
        if (tier < ClanRole.MEMBER || tier > ClanRole.OWNER) {
            return;
        }
        const { clan } = info;
        if (action === 'delete') {
            clan.permDelete = tier;
        } else if (action === 'kick') {
            clan.permKick = tier;
        } else {
            clan.permMute = tier;
        }
        await this.persistClanPerms(clan);
        player.messageGame(`Permission '${action}' now requires ${roleLong(tier)} or higher.`);
    }

    // ── Kick / mute (work on offline members via the registry) ───────────────

    async kick(player: Player, targetName: string): Promise<void> {
        const actor = this.memberOf(player);
        if (!actor) {
            return;
        }
        if (actor.member.role < actor.clan.permKick) {
            player.messageGame(`Kicking requires ${roleLong(actor.clan.permKick)} or higher.`);
            return;
        }
        const target = actor.clan.members.get(norm(targetName));
        if (!target) {
            player.messageGame(`'${targetName}' is not in your clan.`);
            return;
        }
        if (target.role === ClanRole.OWNER || target.role >= actor.member.role) {
            player.messageGame('You cannot kick a member of equal or higher role.');
            return;
        }
        await this.removeMember(actor.clan, target.username);
        player.messageGame(`${target.username} was kicked from the clan.`);
        World.getPlayerByUsername(target.username)?.messageGame(`You were kicked from ${actor.clan.displayName}.`);
        this.broadcast(actor.clan, `${target.username} was kicked by ${player.username}.`);
    }

    async setMute(player: Player, targetName: string, mute: boolean): Promise<void> {
        const actor = this.memberOf(player);
        if (!actor) {
            return;
        }
        if (actor.member.role < actor.clan.permMute) {
            player.messageGame(`Muting requires ${roleLong(actor.clan.permMute)} or higher.`);
            return;
        }
        const target = actor.clan.members.get(norm(targetName));
        if (!target) {
            player.messageGame(`'${targetName}' is not in your clan.`);
            return;
        }
        if (target.role >= actor.member.role) {
            player.messageGame('You cannot mute a member of equal or higher role.');
            return;
        }
        target.mutedUntil = mute ? Number.MAX_SAFE_INTEGER : 0;
        await this.persistMember(actor.clan.id, target);
        player.messageGame(`${target.username} is now ${mute ? 'muted' : 'unmuted'} in clan chat.`);
        World.getPlayerByUsername(target.username)?.messageGame(
            mute ? `You were muted in ${actor.clan.displayName} clan chat.` : `You were unmuted in ${actor.clan.displayName} clan chat.`
        );
    }

    async disband(player: Player): Promise<void> {
        const info = this.memberOf(player);
        if (!info) {
            return;
        }
        if (info.member.role < info.clan.permDelete) {
            player.messageGame(`Disbanding requires ${roleLong(info.clan.permDelete)} or higher.`);
            return;
        }
        const { clan } = info;
        this.broadcast(clan, `Clan '${clan.displayName}' has been disbanded.`);
        for (const username of clan.members.keys()) {
            this.byPlayer.delete(username);
        }
        this.clans.delete(clan.id);
        this.byName.delete(clan.name);
        try {
            await clanDb.deleteFrom('clan_member').where('clan_id', '=', clan.id).execute();
            await clanDb.deleteFrom('clan').where('id', '=', clan.id).execute();
        } catch (err) {
            printError('[ClanManager] disband failed: ' + err);
        }
        player.messageGame(`Clan '${clan.displayName}' disbanded.`);
    }

    // ── Clan chat ────────────────────────────────────────────────────────────

    clanChat(player: Player, message: string): void {
        const info = this.memberOf(player);
        if (!info) {
            player.messageGame('You are not in a clan. Open ::clan to create or join one.');
            return;
        }
        const msg = message.trim();
        if (msg.length === 0) {
            player.messageGame('Usage: ::clanchat <message>');
            return;
        }
        if (info.member.mutedUntil > Date.now()) {
            player.messageGame('You are muted in this clan\'s chat.');
            return;
        }
        // Panel line — the box is clan-specific, so the clan name is implied.
        const line = `[${roleShort(info.member.role)}] ${player.username}: ${msg}`;
        for (const username of info.clan.members.keys()) {
            World.getPlayerByUsername(username)?.write(new MessageGame(line));
        }
    }

    /** Send a system notice to every online member (normal chat). */
    private broadcast(clan: Clan, line: string): void {
        for (const username of clan.members.keys()) {
            World.getPlayerByUsername(username)?.messageGame(line);
        }
    }

    // ── Persistence helpers ────────────────────────────────────────────────

    private async addMember(clan: Clan, username: string, role: number): Promise<void> {
        const member: ClanMember = { username, role, mutedUntil: 0 };
        clan.members.set(username, member);
        this.byPlayer.set(username, clan.id);
        try {
            await clanDb.insertInto('clan_member').values({
                clan_id: clan.id,
                username,
                role,
                joined: toDbDate(new Date()),
                muted_until: null
            }).execute();
        } catch (err) {
            printError('[ClanManager] addMember failed: ' + err);
        }
    }

    private async removeMember(clan: Clan, username: string): Promise<void> {
        clan.members.delete(username);
        this.byPlayer.delete(username);
        try {
            await clanDb.deleteFrom('clan_member').where('clan_id', '=', clan.id).where('username', '=', username).execute();
        } catch (err) {
            printError('[ClanManager] removeMember failed: ' + err);
        }
    }

    private async persistMember(clanId: number, member: ClanMember): Promise<void> {
        const mutedUntil = member.mutedUntil === 0
            ? null
            : toDbDate(new Date(member.mutedUntil === Number.MAX_SAFE_INTEGER ? 8640000000000000 : member.mutedUntil));
        try {
            await clanDb.updateTable('clan_member')
                .set({ role: member.role, muted_until: mutedUntil })
                .where('clan_id', '=', clanId)
                .where('username', '=', member.username)
                .execute();
        } catch (err) {
            printError('[ClanManager] persistMember failed: ' + err);
        }
    }

    private async persistClanPerms(clan: Clan): Promise<void> {
        try {
            await clanDb.updateTable('clan')
                .set({ perm_delete: clan.permDelete, perm_kick: clan.permKick, perm_mute: clan.permMute })
                .where('id', '=', clan.id)
                .execute();
        } catch (err) {
            printError('[ClanManager] persistClanPerms failed: ' + err);
        }
    }
}

const ClanManager = new ClanManagerImpl();
export default ClanManager;

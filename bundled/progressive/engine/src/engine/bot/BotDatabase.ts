/**
 * BotDatabase.ts
 *
 * Two responsibilities:
 *
 *   1. ensureBotAccount  — creates a row in `account` so LoginServer can find
 *      the bot by username during the player_logout flow and call
 *      updateHiscores().  Works in both standalone and LOGIN_SERVER modes.
 *
 *   2. updateBotHiscores — atomically upserts hiscore rows so bots appear on
 *      the leaderboard.  Needed in standalone mode (LOGIN_SERVER=false) where
 *      LoginThread's player_logout handler only writes the .sav file and never
 *      calls updateHiscores().  In production (LOGIN_SERVER=true) LoginServer
 *      also calls updateHiscores() on logout — a double upsert is harmless.
 *
 * All writes use ON CONFLICT DO UPDATE SET (SQLite upsert) which is atomic and
 * safe to call from concurrent async chains without UNIQUE constraint errors.
 */

import { db, toDbDate } from '#/db/query.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStatEnabled } from '#/engine/entity/PlayerStat.js';
import Environment from '#/util/Environment.js';

// ─────────────────────────────────────────────────────────────────────────────
// Account management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the account_id for the given bot username, creating the row if
 * it does not already exist.  Safe to call on every server start.
 *
 * Bot accounts use `!bot` as their password — intentionally not a valid
 * bcrypt hash so no client can authenticate as a bot through the normal login.
 */
export async function ensureBotAccount(username: string): Promise<number | null> {
    try {
        await db
            .insertInto('account')
            .orIgnore()
            .values({
                username,
                password:          '!bot',
                registration_ip:   '127.0.0.1',
                registration_date: toDbDate(new Date()),
                staffmodlevel:     0,  // 0 = normal player → appears on hiscores
            })
            .execute();

        const row = await db
            .selectFrom('account')
            .select('id')
            .where('username', '=', username)
            .executeTakeFirst();

        if (!row) {
            console.error(`[BotDatabase] Could not find/create account for bot "${username}"`);
            return null;
        }

        return row.id;

    } catch (err) {
        console.error(`[BotDatabase] ensureBotAccount("${username}") failed:`, err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hiscore updates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically upserts hiscore rows for a bot player.
 *
 * Mirrors LoginServer.ts's updateHiscores() so bots appear on the leaderboard
 * even in standalone mode (LOGIN_SERVER=false) where the engine's logout path
 * does not call updateHiscores().
 *
 * Rules (kept in sync with LoginServer.ts updateHiscores):
 *   - Total XP / total level always written to hiscore_large (type = 0).
 *   - Individual skill rows only written when baseLevels[stat] >= 15.
 */



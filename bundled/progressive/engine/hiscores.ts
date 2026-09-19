import http from 'http';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('db.sqlite');

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
}

function textResponse(res: http.ServerResponse, text: string, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(text);
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost`);

    // -------------------------
    // 🌍 API ROUTES
    // -------------------------

    // GET /api/hiscores?skill=overall|<skillId>&page=0
    if (url.pathname === '/api/hiscores') {
        const skillParam = url.searchParams.get('skill') ?? 'overall';
        const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0'));
        const limit = 25;
        const offset = page * limit;

        if (skillParam === 'overall') {
            const stmt = db.prepare(`
                SELECT a.username,
                       hl.level,
                       hl.value AS xp
                FROM hiscore_large hl
                JOIN account a ON a.id = hl.account_id
                WHERE hl.profile = 'main' AND hl.type = 0
                ORDER BY hl.level DESC, hl.value DESC
                LIMIT ? OFFSET ?
            `);
            return jsonResponse(res, stmt.all(limit, offset));
        } else {
            const skillType = parseInt(skillParam);
            if (isNaN(skillType)) {
                return textResponse(res, 'Bad skill param', 400);
            }
            const stmt = db.prepare(`
                SELECT a.username,
                       h.level,
                       h.value AS xp
                FROM hiscore h
                JOIN account a ON a.id = h.account_id
                WHERE h.profile = 'main' AND h.type = ?
                ORDER BY h.level DESC, h.value DESC
                LIMIT ? OFFSET ?
            `);
            return jsonResponse(res, stmt.all(skillType, limit, offset));
        }
    }

    // GET /api/player/:username
    if (url.pathname.startsWith('/api/player/')) {
        const username = decodeURIComponent(url.pathname.split('/').pop()!);

        const accountStmt = db.prepare(
            'SELECT id, username FROM account WHERE username = ? COLLATE NOCASE'
        );
        const account = accountStmt.get(username) as { id: number; username: string } | null;

        if (!account) {
            return textResponse(res, 'Not found', 404);
        }

        const overallStmt = db.prepare(`
            SELECT level, value FROM hiscore_large
            WHERE account_id = ? AND profile = 'main' AND type = 0
        `);
        const overall = overallStmt.get(account.id) as { level: number; value: number } | null;

        const skillsStmt = db.prepare(`
            SELECT type, level, value FROM hiscore
            WHERE account_id = ? AND profile = 'main'
            ORDER BY type
        `);
        const skills = skillsStmt.all(account.id) as { type: number; level: number; value: number }[];

        const rankMap: Record<number, number> = {};
        for (const skill of skills) {
            const rankStmt = db.prepare(`
                SELECT COUNT(*) + 1 AS rank
                FROM hiscore
                WHERE profile = 'main' AND type = ?
                  AND (level > ? OR (level = ? AND value > ?))
            `);
            const r = rankStmt.get(skill.type, skill.level, skill.level, skill.value) as { rank: number };
            rankMap[skill.type] = r.rank;
        }

        let overallRank = 1;
        if (overall) {
            const overallRankStmt = db.prepare(`
                SELECT COUNT(*) + 1 AS rank
                FROM hiscore_large
                WHERE profile = 'main' AND type = 0
                  AND (level > ? OR (level = ? AND value > ?))
            `);
            const r = overallRankStmt.get(overall.level, overall.level, overall.value) as { rank: number };
            overallRank = r.rank;
        }

        return jsonResponse(res, {
            username: account.username,
            overall: overall
                ? { level: overall.level, xp: overall.value, rank: overallRank }
                : null,
            skills: skills.map(s => ({ ...s, rank: rankMap[s.type] ?? null })),
        });
    }

    // -------------------------
    // 🌐 STATIC FILE ROUTES
    // -------------------------
    let pathname = url.pathname;
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.join('./public', pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    textResponse(res, 'Not found', 404);
});

server.listen(3000, () => {
    console.log('🔥 Running on http://localhost:3000');
});

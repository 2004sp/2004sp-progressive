import fs from 'fs';
import http from 'http';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import ejs from 'ejs';
import { register } from 'prom-client';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, ServerResponse } from 'http';

import { CrcBuffer } from '#/cache/CrcTable.js';
import World from '#/engine/World.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import NullClientSocket from '#/server/NullClientSocket.js';
import WSClientSocket from '#/server/ws/WSClientSocket.js';
import Environment from '#/util/Environment.js';
import OnDemand from '#/engine/OnDemand.js';
import { tryParseInt } from '#/util/TryParse.js';

export type WebSocketData = {
    client: WSClientSocket;
    origin: string;
    remoteAddress: string;
};

// kept for import compatibility with WSClientSocket
export type WebSocketRoutes = {
    '/': Response;
};

function getIp(req: IncomingMessage): string | null {
    const forwarded = (req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for']) as string | undefined;
    if (!forwarded) return null;
    return forwarded.split(',')[0].trim();
}

let db: DatabaseSync | null = null;
try {
    if (fs.existsSync('db.sqlite')) {
        db = new DatabaseSync('db.sqlite');
    }
} catch {
    // hiscores DB unavailable
}

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
}

const MIME_TYPES = new Map<string, string>([
    ['.js', 'application/javascript'],
    ['.mjs', 'application/javascript'],
    ['.css', 'text/css'],
    ['.html', 'text/html'],
    ['.wasm', 'application/wasm'],
    ['.sf2', 'application/octet-stream'],
]);

function resolveContentPath(name: string): string | null {
    let decodedName: string;
    try {
        decodedName = decodeURIComponent(name);
    } catch {
        return null;
    }

    const contentRoot = path.resolve(Environment.BUILD_SRC_DIR);
    const targetPath = path.resolve(contentRoot, decodedName);
    const relativePath = path.relative(contentRoot, targetPath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return null;
    }

    return targetPath;
}

function serveFile(res: ServerResponse, filePath: string, contentType?: string) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': contentType ?? MIME_TYPES.get(ext) ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
}

function sendBuffer(res: ServerResponse, buf: Buffer | Uint8Array) {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(buf);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, wss: WebSocketServer): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (req.method === 'GET') {
        if (url.pathname === '/') {
            // WebSocket upgrade is handled by the 'upgrade' event — if it's a plain GET, 404.
            res.writeHead(404);
            res.end();
            return;
        } else if (url.pathname.startsWith('/crc')) {
            return sendBuffer(res, Buffer.from(CrcBuffer.data));
        } else if (url.pathname.startsWith('/title')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 1)!));
        } else if (url.pathname.startsWith('/config')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 2)!));
        } else if (url.pathname.startsWith('/interface')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 3)!));
        } else if (url.pathname.startsWith('/media')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 4)!));
        } else if (url.pathname.startsWith('/versionlist')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 5)!));
        } else if (url.pathname.startsWith('/textures')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 6)!));
        } else if (url.pathname.startsWith('/wordenc')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 7)!));
        } else if (url.pathname.startsWith('/sounds')) {
            return sendBuffer(res, Buffer.from(OnDemand.cache.read(0, 8)!));
        } else if (url.pathname.startsWith('/ondemand.zip')) {
            if (fs.existsSync('data/pack/ondemand.zip')) {
                return serveFile(res, 'data/pack/ondemand.zip', 'application/octet-stream');
            }
        } else if (url.pathname.startsWith('/build')) {
            if (fs.existsSync('data/pack/server/build')) {
                return serveFile(res, 'data/pack/server/build', 'application/octet-stream');
            }
        } else if (url.pathname === '/rs2.cgi') {
            const plugin = tryParseInt(url.searchParams.get('plugin'), 0);
            const lowmem = tryParseInt(url.searchParams.get('lowmem'), 0);

            const html = Environment.NODE_DEBUG && plugin === 1
                ? await ejs.renderFile('view/java.ejs', {
                    nodeid: Environment.NODE_ID,
                    lowmem,
                    members: Environment.NODE_MEMBERS,
                    portoff: Environment.NODE_PORT - 43594
                })
                : await ejs.renderFile('view/client.ejs', {
                    nodeid: Environment.NODE_ID,
                    lowmem,
                    members: Environment.NODE_MEMBERS
                });

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        } else if (url.pathname === '/worldmap.jag') {
            if (fs.existsSync('data/pack/mapview/worldmap.jag')) {
                return serveFile(res, 'data/pack/mapview/worldmap.jag', 'application/octet-stream');
            }
        } else if (Environment.NODE_DEBUG) {
            if (url.pathname === '/maped') {
                const html = await ejs.renderFile('view/maped.ejs');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
                return;
            } else if (url.pathname.startsWith('/content/')) {
                const name = url.pathname.replace('/content/', '');
                const filePath = resolveContentPath(name);
                if (!filePath || !fs.existsSync(filePath)) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                return serveFile(res, filePath, MIME_TYPES.get(path.extname(url.pathname)) ?? 'text/plain');
            } else if (url.pathname.startsWith('/data/')) {
                const name = url.pathname.replace('/data/', '');
                if (!fs.existsSync(`data/${name}`)) {
                    res.writeHead(404);
                    res.end();
                    return;
                }
                return serveFile(res, `data/${name}`, MIME_TYPES.get(path.extname(url.pathname)) ?? 'text/plain');
            }
        }

        if (url.pathname === '/api/hiscores') {
            if (!db) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'HiScores unavailable' }));
                return;
            }
            const skillParam = url.searchParams.get('skill') ?? 'overall';
            const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0'));
            const limit = 25;
            const offset = page * limit;
            if (skillParam === 'overall') {
                const stmt = db.prepare(`
                    SELECT a.username, hl.level, hl.value AS xp
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
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Bad skill param');
                    return;
                }
                const stmt = db.prepare(`
                    SELECT a.username, h.level, h.value AS xp
                    FROM hiscore h
                    JOIN account a ON a.id = h.account_id
                    WHERE h.profile = 'main' AND h.type = ?
                    ORDER BY h.level DESC, h.value DESC
                    LIMIT ? OFFSET ?
                `);
                return jsonResponse(res, stmt.all(skillType, limit, offset));
            }
        } else if (url.pathname.startsWith('/api/player/')) {
            if (!db) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'HiScores unavailable' }));
                return;
            }
            const username = decodeURIComponent(url.pathname.split('/').pop()!);
            const accountStmt = db.prepare('SELECT id, username FROM account WHERE username = ? COLLATE NOCASE');
            const account = accountStmt.get(username) as { id: number; username: string } | null;
            if (!account) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not found');
                return;
            }
            const overallStmt = db.prepare(`SELECT level, value FROM hiscore_large WHERE account_id = ? AND profile = 'main' AND type = 0`);
            const overall = overallStmt.get(account.id) as { level: number; value: number } | null;
            const skillsStmt = db.prepare(`SELECT type, level, value FROM hiscore WHERE account_id = ? AND profile = 'main' ORDER BY type`);
            const skills = skillsStmt.all(account.id) as { type: number; level: number; value: number }[];
            const rankMap: Record<number, number> = {};
            for (const skill of skills) {
                const rankStmt = db.prepare(`SELECT COUNT(*) + 1 AS rank FROM hiscore WHERE profile = 'main' AND type = ? AND (level > ? OR (level = ? AND value > ?))`);
                const r = rankStmt.get(skill.type, skill.level, skill.level, skill.value) as { rank: number };
                rankMap[skill.type] = r.rank;
            }
            let overallRank = 1;
            if (overall) {
                const overallRankStmt = db.prepare(`SELECT COUNT(*) + 1 AS rank FROM hiscore_large WHERE profile = 'main' AND type = 0 AND (level > ? OR (level = ? AND value > ?))`);
                const r = overallRankStmt.get(overall.level, overall.level, overall.value) as { rank: number };
                overallRank = r.rank;
            }
            return jsonResponse(res, {
                username: account.username,
                overall: overall ? { level: overall.level, xp: overall.value, rank: overallRank } : null,
                skills: skills.map(s => ({ ...s, rank: rankMap[s.type] ?? null })),
            });
        } else if (fs.existsSync(`public${url.pathname}`)) {
            return serveFile(res, `public${url.pathname}`, MIME_TYPES.get(path.extname(url.pathname)) ?? 'text/plain');
        }
    } else if (req.method === 'PUT') {
        if (Environment.NODE_DEBUG) {
            if (url.pathname.startsWith('/content/')) {
                const name = url.pathname.replace('/content/', '');
                const filePath = resolveContentPath(name);
                if (!filePath) {
                    res.writeHead(400);
                    res.end();
                    return;
                }

                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const body = Buffer.concat(chunks);
                await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                await fs.promises.writeFile(filePath, body);
                res.writeHead(200);
                res.end();
                return;
            }
        }
    }

    res.writeHead(404);
    res.end();
}

export async function startWeb() {
    const server = http.createServer((req, res) => {
        handleRequest(req, res, wss).catch(() => {
            res.writeHead(500);
            res.end();
        });
    });

    const wss = new WebSocketServer({
        noServer: true,
        // Echo back the 'binary' sub-protocol so Safari (which enforces RFC 6455 §4.1)
        // advances the WebSocket from CONNECTING to OPEN. Chrome is lenient; Safari is not.
        handleProtocols: (protocols: Set<string>) => (protocols.has('binary') ? 'binary' : false)
    });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname !== '/') {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, ws => {
            const origin = req.headers['origin'] as string ?? '';
            const remoteAddress = getIp(req) ?? req.socket.remoteAddress ?? '';
            const data: WebSocketData = { client: new WSClientSocket(), origin, remoteAddress };

            if (Environment.WEB_ALLOWED_ORIGIN && origin !== Environment.WEB_ALLOWED_ORIGIN) {
                ws.terminate();
                return;
            }

            data.client.init(ws, remoteAddress);

            ws.on('message', (message: Buffer) => {
                try {
                    const { client } = data;
                    if (client.state === -1 || client.remaining <= 0) {
                        client.terminate();
                        return;
                    }

                    client.buffer(message);

                    if (client.state === 0) {
                        World.onClientData(client);
                    } else if (client.state === 2) {
                        if (Environment.NODE_WS_ONDEMAND) {
                            OnDemand.onClientData(client);
                        } else {
                            client.terminate();
                        }
                    }
                } catch (_) {
                    ws.terminate();
                }
            });

            ws.on('error', () => {
                ws.terminate();
            });

            ws.on('close', () => {
                const { client } = data;
                client.state = -1;

                World.loginRequests.delete(client.uuid);

                if (client.player) {
                    client.player.addSessionLog(LoggerEventType.ENGINE, 'WS socket closed');
                    client.player.client = new NullClientSocket();
                }
            });
        });
    });

    server.listen(Environment.WEB_PORT);
}

export async function startManagementWeb() {
    const mgmt = http.createServer(async (_req, res) => {
        if (_req.url === '/prometheus') {
            const metrics = await register.metrics();
            res.writeHead(200, { 'Content-Type': register.contentType });
            res.end(metrics);
            return;
        }
        res.writeHead(404);
        res.end();
    });

    mgmt.listen(Environment.WEB_MANAGEMENT_PORT);
}

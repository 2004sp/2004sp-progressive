import fs from 'fs';
import http from 'http';
import path from 'path';

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

        if (fs.existsSync(`public${url.pathname}`)) {
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

    const wss = new WebSocketServer({ noServer: true });

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

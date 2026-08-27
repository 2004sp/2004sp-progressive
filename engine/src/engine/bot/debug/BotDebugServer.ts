/**
 * BotDebugServer.ts
 *
 * HTTP (REST) + WebSocket transport for the bot debugger. Mounted into the
 * existing Node http server in web.ts — no second server/framework.
 *
 * Routes:
 *   GET  /debug/bots                       — dashboard HTML (public/debug/bots.html)
 *   GET  /debug/api/bots                    — BotSummary[]
 *   GET  /debug/api/bots/:username          — BotDetail
 *   GET  /debug/api/bots/:username/events   — BotDebugEvent[] for one bot
 *   GET  /debug/api/events                  — global BotDebugEvent[] (?bot=&category=&limit=)
 *   GET  /debug/api/metrics                 — BotDebugMetrics
 *   GET  /debug/api/config                  — BotDebugConfigInfo
 *   WS   /debug/api/live                    — periodic {type:'snapshot',...} + {type:'events',...} pushes
 *
 * Every handler here is read-only. Nothing mutates game state.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';

import { BotDebugService } from '#/engine/bot/debug/BotDebugService.js';

function jsonResponse(res: ServerResponse, data: unknown, status = 200): void {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
}

function serveDashboard(res: ServerResponse): void {
    const filePath = 'public/debug/bots.html';
    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Bot debugger dashboard file missing: public/debug/bots.html');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(filePath).pipe(res);
}

/**
 * Returns true if this request was handled (caller should stop routing).
 * Only called when Environment.BOT_DEBUG_ENABLED is true.
 */
export async function handleBotDebugHttp(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== 'GET') return false;

    if (url.pathname === '/debug/bots') {
        serveDashboard(res);
        return true;
    }

    if (!url.pathname.startsWith('/debug/api/')) return false;

    try {
        if (url.pathname === '/debug/api/config') {
            jsonResponse(res, BotDebugService.getConfig());
            return true;
        }
        if (url.pathname === '/debug/api/metrics') {
            jsonResponse(res, BotDebugService.getMetrics());
            return true;
        }
        if (url.pathname === '/debug/api/events') {
            const bot = url.searchParams.get('bot') ?? undefined;
            const category = url.searchParams.get('category') ?? undefined;
            const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get('limit') ?? '300', 10) || 300));
            jsonResponse(res, BotDebugService.getEvents(bot, category, limit));
            return true;
        }
        if (url.pathname === '/debug/api/bots') {
            jsonResponse(res, BotDebugService.listSummaries());
            return true;
        }

        const botEventsMatch = url.pathname.match(/^\/debug\/api\/bots\/([^/]+)\/events$/);
        if (botEventsMatch) {
            const name = decodeURIComponent(botEventsMatch[1]);
            jsonResponse(res, BotDebugService.getEvents(name, undefined, 500));
            return true;
        }

        const botMatch = url.pathname.match(/^\/debug\/api\/bots\/([^/]+)$/);
        if (botMatch) {
            const name = decodeURIComponent(botMatch[1]);
            const detail = BotDebugService.getDetail(name);
            if (!detail) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'not found' }));
                return true;
            }
            jsonResponse(res, detail);
            return true;
        }
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'debug server error' }));
        return true;
    }

    return false;
}

// ── WebSocket live feed ────────────────────────────────────────────────────

let debugWss: WebSocketServer | null = null;
let broadcastTimer: ReturnType<typeof setInterval> | null = null;
let lastSentEventId = 0;

function startBroadcastLoop(): void {
    if (broadcastTimer) return;
    const interval = Math.max(200, BotDebugService.snapshotIntervalMs);
    broadcastTimer = setInterval(() => {
        if (!debugWss || debugWss.clients.size === 0) return;
        try {
            const bots = BotDebugService.listSummaries();
            const metrics = BotDebugService.getMetrics();
            const allEvents = BotDebugService.getEvents(undefined, undefined, 500);
            const newEvents = allEvents.filter(e => e.id > lastSentEventId);
            if (allEvents.length > 0) lastSentEventId = allEvents[allEvents.length - 1].id;

            const payload = JSON.stringify({ type: 'snapshot', bots, metrics, events: newEvents });
            for (const client of debugWss.clients) {
                if (client.readyState === WebSocket.OPEN) client.send(payload);
            }
        } catch {
            // a broadcast failure must never affect bot ticking or crash the interval
        }
    }, interval);
    // don't keep the process alive solely for this timer
    if (typeof broadcastTimer === 'object' && broadcastTimer && 'unref' in broadcastTimer) {
        (broadcastTimer as NodeJS.Timeout).unref();
    }
}

function getDebugWss(): WebSocketServer {
    if (!debugWss) {
        debugWss = new WebSocketServer({ noServer: true });
        debugWss.on('connection', ws => {
            BotDebugService.dashboardClients++;
            try {
                ws.send(JSON.stringify({ type: 'snapshot', bots: BotDebugService.listSummaries(), metrics: BotDebugService.getMetrics(), events: [] }));
            } catch {
                /* noop */
            }
            ws.on('close', () => {
                BotDebugService.dashboardClients = Math.max(0, BotDebugService.dashboardClients - 1);
            });
            ws.on('error', () => {
                /* noop — 'close' still fires */
            });
        });
        startBroadcastLoop();
    }
    return debugWss;
}

/**
 * Call from the http server's 'upgrade' event before any other WS routing.
 * Returns true if this upgrade was for the debug live feed (caller should
 * stop processing); false means the caller should continue its own routing.
 */
export function tryHandleBotDebugUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, pathname: string): boolean {
    if (pathname !== '/debug/api/live') return false;
    try {
        const wss = getDebugWss();
        wss.handleUpgrade(req, socket, head, ws => {
            wss.emit('connection', ws, req);
        });
    } catch {
        try {
            socket.destroy();
        } catch {
            /* noop */
        }
    }
    return true;
}

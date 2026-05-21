import { WebSocket } from 'ws';

import WsSyncReq from '#3rdparty/ws-sync/ws-sync.js';

export default class InternalClient {
    protected ws: WebSocket | null = null;
    protected wsr: WsSyncReq | null = null;
    private connectPromise: Promise<void> | null = null;

    private host: string;
    private port: number;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;
    }

    async connect(): Promise<void> {
        if (this.wsr && this.wsr.checkIfWsLive()) {
            return;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = new Promise(res => {
            const ws = new WebSocket(`ws://${this.host}:${this.port}`, {
                timeout: 5000
            });
            this.ws = ws;

            const finish = () => {
                if (this.ws === ws) {
                    this.ws = null;
                    this.wsr = null;
                }

                this.connectPromise = null;
                res();
            };

            const timeout = setTimeout(() => {
                ws.terminate();
                finish();
            }, 10000);

            ws.once('close', () => {
                clearTimeout(timeout);
                finish();
            });

            ws.once('error', () => {
                clearTimeout(timeout);
                finish();
            });

            ws.once('open', () => {
                clearTimeout(timeout);

                this.ws = ws;
                this.wsr = new WsSyncReq(ws);
                this.connectPromise = null;
                res();
            });

            ws.on('message', (buf: Buffer) => {
                try {
                    const message = JSON.parse(buf.toString());

                    this.messageHandlers.forEach(fn => fn(message.type, message));
                } catch (err) {
                    console.error(err);
                }
            });
        });

        return this.connectPromise;
    }

    private messageHandlers: ((opcode: number, data: unknown) => void)[] = [];

    public async onMessage(fn: (opcode: number, data: unknown) => void) {
        this.messageHandlers.push(fn);
    }
}

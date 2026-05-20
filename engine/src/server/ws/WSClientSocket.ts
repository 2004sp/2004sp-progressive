import { WebSocket } from 'ws';
import ClientSocket from '#/server/ClientSocket.js';

export default class WSClientSocket extends ClientSocket {
    socket: WebSocket | null = null;
    private _closeTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        super();
    }

    init(socket: WebSocket, remoteAddress: string) {
        this.socket = socket;
        this.remoteAddress = remoteAddress;
    }

    send(src: Uint8Array): void {
        if (this.socket) {
            this.socket.send(src);
        }
    }

    close(): void {
        // give time to acknowledge and receive packets
        this.state = -1;

        this._closeTimer = setTimeout(() => {
            if (this.socket) {
                this.socket.close();
            }
        }, 1000);
    }

    terminate(): void {
        this.state = -1;

        if (this._closeTimer) {
            clearTimeout(this._closeTimer);
            this._closeTimer = undefined;
        }

        if (this.socket) {
            this.socket.terminate();
        }
    }
}

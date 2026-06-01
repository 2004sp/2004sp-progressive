/**
 * BotLLM.ts
 *
 * Singleton managing the Gemma 3 270M GGUF Worker thread.
 * All game code goes through this — ChatRouter calls generate(), SocialTask
 * calls getSync() / prefetch().
 *
 * If the GGUF file is absent, available stays false and every call returns
 * the provided fallback immediately — zero overhead.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DEFAULT_MODEL_PATH = 'models/gemma-3-270m-q4_k_m.gguf';

export class BotLLM {
    private static worker:  Worker | null = null;
    private static pending  = new Map<number, (text: string) => void>();
    private static nextId   = 0;
    private static cache    = new Map<string, string>();

    static available = false;

    // ── Startup ───────────────────────────────────────────────────────────────

    static init(modelPath = DEFAULT_MODEL_PATH): void {
        if (!fs.existsSync(modelPath)) {
            console.log('[BotLLM] GGUF not found — bots will use static phrases');
            console.log(`[BotLLM]   expected: ${modelPath}`);
            return;
        }

        try {
            const workerFile = path.join(__dirname, 'BotLLMWorker.ts');
            this.worker = new Worker(workerFile, {
                execArgv:   ['--import', 'tsx'],
                workerData: { modelPath },
            });

            this.worker.on('message', (msg: { ready?: boolean; id?: number; text?: string; error?: string }) => {
                if (msg.ready) {
                    this.available = true;
                    console.log('[BotLLM] Gemma 3 270M loaded — RAG bot chat active');
                    return;
                }
                if (msg.error) {
                    console.warn('[BotLLM] worker error:', msg.error);
                    return;
                }
                if (msg.id !== undefined && msg.text !== undefined) {
                    const resolve = this.pending.get(msg.id);
                    if (resolve) { this.pending.delete(msg.id); resolve(msg.text); }
                }
            });

            this.worker.on('error', (err) => {
                console.warn('[BotLLM] worker crashed:', err.message, '— static phrases active');
                this._shutdown();
            });

            this.worker.on('exit', (code) => {
                if (code !== 0) {
                    console.warn(`[BotLLM] worker exited (${code}) — static phrases active`);
                    this._shutdown();
                }
            });
        } catch (err) {
            console.warn('[BotLLM] failed to spawn worker:', (err as Error).message);
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Async generation for botChatCheck and ChatRouter.
     *
     * @param mode  'casual' = casual chat with style seed history (default)
     *              'rs'     = RuneScape question; prompt already contains
     *                        retrieved LostHQ context; no seed history injected
     */
    static async generate(
        prompt:      string,
        fallback:    string,
        timeoutMs    = 2000,
        history?:    ReadonlyArray<{ user: string; bot: string }>,
        playerName?: string,
    ): Promise<string> {
        if (!this.available || !this.worker) return fallback;

        const id = this.nextId++;
        return new Promise<string>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                resolve(fallback);
            }, timeoutMs);

            this.pending.set(id, (text: string) => {
                clearTimeout(timer);
                resolve(text.length > 0 ? text : fallback);
            });

            this.worker!.postMessage({ id, prompt, history: history ?? [], playerName });
        });
    }

    /** Synchronous cache read — safe inside game-tick code (player.say). */
    static getSync(key: string, fallback: string): string {
        const cached = this.cache.get(key);
        if (cached !== undefined) { this.cache.delete(key); return cached; }
        return fallback;
    }

    /** Fire-and-forget phrase pre-generation for SocialTask chat phases. */
    static prefetch(key: string, prompts: string[], fallbacks: string[]): void {
        if (!this.available || !this.worker) return;
        prompts.forEach((prompt, i) => {
            const cacheKey = `${key}:${i}`;
            if (this.cache.has(cacheKey)) return;
            this.generate(prompt, fallbacks[i] ?? '', 5000)
                .then(text => { this.cache.set(cacheKey, text); })
                .catch(() => {});
        });
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private static _shutdown(): void {
        this.available = false;
        this.worker    = null;
        for (const resolve of this.pending.values()) resolve('');
        this.pending.clear();
    }
}

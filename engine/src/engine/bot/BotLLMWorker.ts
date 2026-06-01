/**
 * BotLLMWorker.ts
 *
 * Casual chat via Ollama HTTP API — no native binaries required.
 *
 * Protocol
 * ─────────
 *   Receives:  { id, prompt, history?, playerName? }
 *   Sends:     { ready: true }
 *              { id, text }   ('' → caller uses static fallback)
 *              { error }
 *
 * Requires Ollama running locally: https://ollama.com
 * Default model: gemma3:1b  (matches original Gemma 3 270M intent)
 * Override with workerData.model or workerData.ollamaUrl.
 */

import { parentPort, workerData } from 'worker_threads';

const OLLAMA_URL: string = workerData?.ollamaUrl ?? 'http://localhost:11434';
const MODEL: string      = workerData?.model     ?? 'gemma3:1b';

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
    'You are a RuneScape 2004 player having a casual in-game chat. ' +
    'Reply with one short statement only, maximum 10 words, plain casual English. ' +
    'The word before the colon is the player\'s name — use it occasionally. ' +
    'NEVER ask a question. NEVER start your reply with "what", "why", "how", "where", "when", "who". ' +
    'NEVER say you are a bot or AI. Just react or comment briefly.';

// ── Seed history ──────────────────────────────────────────────────────────────

type OllamaMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SEED: OllamaMessage[] = [
    { role: 'user',      content: 'Dave: hey whats up' },
    { role: 'assistant', content: 'hey Dave not much, just training' },
    { role: 'user',      content: 'Dave: what level are you' },
    { role: 'assistant', content: '74 combat nearly 80 str' },
    { role: 'user',      content: 'Dave: do you pk' },
    { role: 'assistant', content: 'sometimes yeah edgeville area' },
    { role: 'user',      content: 'Dave: hey i have a question' },
    { role: 'assistant', content: 'go ahead Dave' },
    { role: 'user',      content: 'Dave: can i ask u something' },
    { role: 'assistant', content: 'sure Dave go for it' },
    { role: 'user',      content: 'Dave: whats your favourite thing here' },
    { role: 'assistant', content: 'probably fishing its good afk' },
    { role: 'user',      content: 'Dave: what is your favourite color' },
    { role: 'assistant', content: 'blue i think' },
    { role: 'user',      content: 'Dave: where do you live' },
    { role: 'assistant', content: 'near falador usually' },
];

// ── Connectivity check ────────────────────────────────────────────────────────

async function checkOllama(): Promise<void> {
    try {
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        throw new Error(`Ollama not reachable at ${OLLAMA_URL} — start Ollama and run: ollama pull ${MODEL}\n${(err as Error).message}`);
    }
}

await checkOllama();
parentPort?.postMessage({ ready: true });

// ── Serial queue ──────────────────────────────────────────────────────────────

type Exchange  = { user: string; bot: string };
type QueueItem = { id: number; prompt: string; history: Exchange[]; playerName: string | undefined };

const queue: QueueItem[] = [];
let busy = false;

function enqueue(item: QueueItem): void {
    queue.push(item);
    if (!busy) processNext();
}

async function processNext(): Promise<void> {
    const item = queue.shift();
    if (!item) { busy = false; return; }
    busy = true;

    try {
        const name   = item.playerName ?? '';
        const prefix = name ? `${name}: ` : '';

        const messages: OllamaMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...SEED,
        ];
        for (const h of item.history) {
            messages.push({ role: 'user',      content: `${prefix}${h.user}` });
            messages.push({ role: 'assistant', content: h.bot });
        }
        messages.push({ role: 'user', content: `${prefix}${item.prompt}` });

        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model:    MODEL,
                messages,
                stream:   false,
                options: {
                    temperature: 0.7,
                    top_p:       0.9,
                    min_p:       0.05,
                    num_predict: 24,
                    stop:        ['\n', '</s>', '<end_of_turn>', '<eos>'],
                },
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            parentPort?.postMessage({ id: item.id, text: '' });
            setImmediate(processNext);
            return;
        }

        const json = await res.json() as { message?: { content?: string } };
        const raw  = json.message?.content ?? '';
        parentPort?.postMessage({ id: item.id, text: sanitize(raw, item.playerName) });
    } catch {
        parentPort?.postMessage({ id: item.id, text: '' });
    }

    setImmediate(processNext);
}

// ── Sanitize ──────────────────────────────────────────────────────────────────

const SEED_NAME = 'Dave';

const NON_ENGLISH = /\b(yang|dan|untuk|dengan|dari|tidak|ini|itu|saya|anda|adalah|pada|dalam|juga|lebih|akan|bisa|ada|jika|sudah|anak|mereka|kamu|bukan|atau|tetapi|karena|seperti|ketika|kalau|maka|bahwa|hanya|tapi|nggak|anaknya|mendatang|ich|nicht|sind|haben|dass|wenn|wird|werden|seit|weil|einer|seinen|deren|ihrer|mais|avec|pour|dans|nous|vous|leur|leurs|elles|une|des|est|sont|porque|nosotros|ellos|pero|para|como|también|orada|burada|evet|tamam|benim|senin|onlar|bunlar|neden|nasil|hangi|nereye|kadar|sadece|bunu|bana|sana|isin|oluyor|diyorum|yapıyor|gidiyor|geliyor)\b/i;

const AI_SPEAK = /\b(as an ai|i'm an ai|i am an ai|language model|as a bot|i'm just a bot|i'm not (a )?real|i cannot|i can't actually)\b/i;

function looksEnglish(text: string): boolean {
    if (!text || text.length < 3) return false;
    if (NON_ENGLISH.test(text)) return false;
    const words = text.split(/\s+/);
    let softBad = 0;
    for (const w of words) {
        const lw = w.replace(/[^a-zA-Z]/g, '');
        if (!lw) continue;
        if (/(?:nya|kan|lah|kah|pun)$/.test(lw) && lw.length > 4) return false;
        if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(lw)) return false;
        if (lw.length > 13) { softBad++; continue; }
    }
    if (softBad > 1 || (words.length > 0 && softBad / words.length > 0.25)) return false;
    if (words.length === 1 && /^(yes|no|ok|okay|sure|yeah|yep|nope|maybe|idk|hmm|uh|um)$/i.test(text)) return false;
    return true;
}

function sanitize(raw: string, playerName?: string): string {
    let text = raw
        .replace(/<\/?(?:start_of_turn|end_of_turn|model|user)>/g, '')
        .replace(/\b(user|model)\s*:/gi, '')
        .replace(/^[\s\-*•:>]+/, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ').slice(0, 12).join(' ')
        .slice(0, 80);

    if (!looksEnglish(text)) return '';
    if (/you are a runescape/i.test(text)) return '';
    if (AI_SPEAK.test(text)) return '';
    if (/`|[{}[\]]|\b(?:function|const|let|var|return|import|export|console|class)\b|=>|\/\//.test(text)) return '';
    if (/^(?:what|why|how|where|when|who|which)\s+(?:is|are|was|were|do|did|does|have|has|had|will|would|could|can|should)\b/i.test(text)) return '';
    if (/\?$/.test(text)) return '';

    if (playerName) {
        text = text.replace(new RegExp(`\\b${SEED_NAME}\\b`, 'gi'), playerName);
        text = text.replace(/(?<![Oo]f )\bcourse\b/g, playerName);
    }

    return text.trim();
}

// ── Message handler ───────────────────────────────────────────────────────────

parentPort?.on('message', (msg: { id: number; prompt: string; history?: Exchange[]; playerName?: string }) => {
    enqueue({ id: msg.id, prompt: msg.prompt, history: msg.history ?? [], playerName: msg.playerName });
});

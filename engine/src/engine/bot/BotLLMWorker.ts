/**
 * BotLLMWorker.ts
 *
 * Gemma 3 270M Q4_K_M inference via node-llama-cpp — casual chat only.
 *
 * Protocol
 * ─────────
 *   Receives:  { id, prompt, history? }
 *   Sends:     { ready: true }
 *              { id, text }   ('' → caller uses static fallback)
 *              { error }
 *
 * Design
 * ──────
 * Single LlamaChatSession with GemmaChatWrapper.
 * No resetChatHistory() — node-llama-cpp's natural KV prefix-reuse handles
 * isolation: the common [system + seed] prefix is cached and reused across
 * all bots; only the bot-specific history suffix is re-evaluated per request.
 * System prompt NOT in constructor — passed as { type:'system' } in
 * setChatHistory() so it is always reliably embedded in Gemma's first turn.
 */

import { parentPort, workerData } from 'worker_threads';
import type { ChatHistoryItem } from 'node-llama-cpp';

let getLlama:         typeof import('node-llama-cpp')['getLlama'];
let LlamaChatSession: typeof import('node-llama-cpp')['LlamaChatSession'];
let GemmaChatWrapper: typeof import('node-llama-cpp')['GemmaChatWrapper'];
let LlamaLogLevel:    typeof import('node-llama-cpp')['LlamaLogLevel'];

try {
    const pkg        = await import('node-llama-cpp');
    getLlama         = pkg.getLlama;
    LlamaChatSession = pkg.LlamaChatSession;
    GemmaChatWrapper = pkg.GemmaChatWrapper;
    LlamaLogLevel    = pkg.LlamaLogLevel;
} catch {
    parentPort?.postMessage({ error: 'node-llama-cpp not installed — run: npm install node-llama-cpp' });
    process.exit(1);
}

const modelPath: string = workerData?.modelPath ?? 'models/gemma-3-270m-q4_k_m.gguf';
const CTX_SIZE   = 512;
const BATCH_SIZE = 64;

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
    'You are a RuneScape 2004 player having a casual in-game chat. ' +
    'Reply with one short statement only, maximum 10 words, plain casual English. ' +
    'The word before the colon is the player\'s name — use it occasionally. ' +
    'NEVER ask a question. NEVER start your reply with "what", "why", "how", "where", "when", "who". ' +
    'NEVER say you are a bot or AI. Just react or comment briefly.';

// ── Seed history ──────────────────────────────────────────────────────────────
// Real user/model turns — identical for every bot so KV entries are shared.

// Seed uses "Name: message" format so the model learns to recognise and use
// the player's name naturally.  "Dave" is the placeholder name in examples.
const SEED: ChatHistoryItem[] = [
    { type: 'user',  text: 'Dave: hey whats up' },
    { type: 'model', response: ['hey Dave not much, just training'] },
    { type: 'user',  text: 'Dave: what level are you' },
    { type: 'model', response: ['74 combat nearly 80 str'] },
    { type: 'user',  text: 'Dave: do you pk' },
    { type: 'model', response: ['sometimes yeah edgeville area'] },
    { type: 'user',  text: 'Dave: hey i have a question' },
    { type: 'model', response: ['go ahead Dave'] },
    { type: 'user',  text: 'Dave: can i ask u something' },
    { type: 'model', response: ['sure Dave go for it'] },
    { type: 'user',  text: 'Dave: whats your favourite thing here' },
    { type: 'model', response: ['probably fishing its good afk'] },
    { type: 'user',  text: 'Dave: what is your favourite color' },
    { type: 'model', response: ['blue i think'] },
    { type: 'user',  text: 'Dave: where do you live' },
    { type: 'model', response: ['near falador usually'] },
];

// ── Model loading ─────────────────────────────────────────────────────────────

type ModelInstance = Awaited<ReturnType<Awaited<ReturnType<typeof getLlama>>['loadModel']>>;
type CtxInstance   = Awaited<ReturnType<ModelInstance['createContext']>>;

let ctx:     CtxInstance;
let session: InstanceType<typeof LlamaChatSession>;

async function tryLoad(gpu: boolean): Promise<void> {
    const llama = await getLlama(
        gpu
            ? { gpu: 'auto', logLevel: LlamaLogLevel.error }
            : { gpu: false,  logLevel: LlamaLogLevel.error, maxThreads: 2 }
    );
    const model = await llama.loadModel({ modelPath, gpuLayers: gpu ? 'max' : 0 });
    ctx = await model.createContext({ contextSize: CTX_SIZE, batchSize: BATCH_SIZE });

    // No systemPrompt in constructor — included in setChatHistory() below
    session = new LlamaChatSession({
        contextSequence: ctx.getSequence(),
        chatWrapper:     new GemmaChatWrapper(),
    });
}

try {
    await tryLoad(true);
    parentPort?.postMessage({ ready: true });
} catch (gpuErr) {
    console.warn(`[BotLLM worker] GPU failed (${(gpuErr as Error).message}), retrying CPU…`);
    try {
        await tryLoad(false);
        parentPort?.postMessage({ ready: true });
    } catch (cpuErr) {
        parentPort?.postMessage({ error: `Failed to load model: ${(cpuErr as Error).message}` });
        process.exit(1);
    }
}

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
        // Prefix all user turns with "Name: " so the model knows who is
        // speaking and can address them naturally in replies.
        const name   = item.playerName ?? '';
        const prefix = name ? `${name}: ` : '';

        const hist: ChatHistoryItem[] = [
            { type: 'system', text: SYSTEM_PROMPT },
            ...SEED,
        ];
        for (const h of item.history) {
            hist.push({ type: 'user',  text: `${prefix}${h.user}` });
            hist.push({ type: 'model', response: [h.bot] });
        }

        session.setChatHistory(hist);

        // Include the name prefix on the live prompt too
        const raw = await session.prompt(`${prefix}${item.prompt}`, {
            maxTokens:          24,
            temperature:        0.7,
            topP:               0.9,
            minP:               0.05,
            customStopTriggers: ['\n', '</s>', '<end_of_turn>', '<eos>'],
        });

        parentPort?.postMessage({ id: item.id, text: sanitize(raw, item.playerName) });
    } catch {
        parentPort?.postMessage({ id: item.id, text: '' });
    }

    setImmediate(processNext);
}

// ── Sanitize ──────────────────────────────────────────────────────────────────

// Seed placeholder name — replaced with the real player's name in output
const SEED_NAME = 'Dave';

// Non-English word patterns (Indonesian + German + French + Turkish)
const NON_ENGLISH = /\b(yang|dan|untuk|dengan|dari|tidak|ini|itu|saya|anda|adalah|pada|dalam|juga|lebih|akan|bisa|ada|jika|sudah|anak|mereka|kamu|bukan|atau|tetapi|karena|seperti|ketika|kalau|maka|bahwa|hanya|tapi|nggak|anaknya|mendatang|ich|nicht|sind|haben|dass|wenn|wird|werden|seit|weil|einer|seinen|deren|ihrer|mais|avec|pour|dans|nous|vous|leur|leurs|elles|une|des|est|sont|porque|nosotros|ellos|pero|para|como|también|orada|burada|evet|tamam|benim|senin|onlar|bunlar|neden|nasil|hangi|nereye|kadar|sadece|bunu|bana|sana|isin|oluyor|diyorum|yapıyor|gidiyor|geliyor)\b/i;

// AI self-referential phrases the model sometimes generates
const AI_SPEAK = /\b(as an ai|i'm an ai|i am an ai|language model|as a bot|i'm just a bot|i'm not (a )?real|i cannot|i can't actually)\b/i;

function looksEnglish(text: string): boolean {
    if (!text || text.length < 3) return false;
    if (NON_ENGLISH.test(text)) return false;
    const words = text.split(/\s+/);
    let softBad = 0;
    for (const w of words) {
        const lw = w.replace(/[^a-zA-Z]/g, '');
        if (!lw) continue;
        // Hard reject: Indonesian suffixes or impossible consonant clusters (e.g. "blazegwnd", "nggk")
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
        // Cap at 12 words — prevents trailing garbage tokens from reaching the player
        .split(' ').slice(0, 12).join(' ')
        .slice(0, 80);

    if (!looksEnglish(text)) return '';
    if (/you are a runescape/i.test(text)) return '';
    if (AI_SPEAK.test(text)) return '';
    if (/`|[{}[\]]|\b(?:function|const|let|var|return|import|export|console|class)\b|=>|\/\//.test(text)) return '';
    // Reject questions — the system prompt says never ask questions back
    if (/^(?:what|why|how|where|when|who|which)\s+(?:is|are|was|were|do|did|does|have|has|had|will|would|could|can|should)\b/i.test(text)) return '';
    if (/\?$/.test(text)) return '';

    if (playerName) {
        // Replace the seed placeholder name the model learned from training examples
        text = text.replace(new RegExp(`\\b${SEED_NAME}\\b`, 'gi'), playerName);

        // Fix "course" used as a name (e.g. "go ahead course" → "go ahead PlayerName")
        // Only replace when NOT preceded by "of " — "of course" is a valid English phrase
        text = text.replace(/(?<![Oo]f )\bcourse\b/g, playerName);
    }

    return text.trim();
}

// ── Message handler ───────────────────────────────────────────────────────────

parentPort?.on('message', (msg: { id: number; prompt: string; history?: Exchange[]; playerName?: string }) => {
    enqueue({ id: msg.id, prompt: msg.prompt, history: msg.history ?? [], playerName: msg.playerName });
});

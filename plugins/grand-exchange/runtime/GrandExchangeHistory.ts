import fs from 'fs';
import path from 'path';

import Player from '#/engine/entity/Player.js';
import Environment from '#/util/Environment.js';
import { tryParseBoolean } from '#/util/TryParse.js';

const STORE_VERSION = 1 as const;
const MAX_HISTORY_ENTRIES = 100;
const DISPLAY_ROWS = 5;

export const enum GrandExchangeHistoryStatus {
    PENDING = 1,
    PARTIAL = 2,
    COMPLETED = 3,
    CANCELLED = 4,
}

export const enum GrandExchangeHistoryIntField {
    OFFER_TYPE = 0,
    STATUS = 1,
    QUANTITY = 2,
    PRICE_EACH = 3,
}

type HistoryEntry = {
    id: number;
    offerSlot: number;
    itemId: number;
    offerType: number;
    status: GrandExchangeHistoryStatus;
    quantity: number;
    priceEachGp: number;
    createdAt: number;
    updatedAt: number;
};

type HistoryStore = {
    version: typeof STORE_VERSION;
    nextId: number;
    entries: HistoryEntry[];
};

type CachedHistoryStore = {
    store: HistoryStore;
    writable: boolean;
};

const cache = new Map<string, CachedHistoryStore>();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function isEnabled() {
    return tryParseBoolean(process.env.NODE_FEATURE_GRANDEXCHANGE, false);
}

function safeProfileName() {
    return (Environment.NODE_PROFILE ?? 'main').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function playerKey(player: Player) {
    return player.username37.toString();
}

function historyPath(player: Player) {
    return path.join('data', 'players', safeProfileName(), 'grand-exchange-history', `${playerKey(player)}.json`);
}

function emptyStore(): HistoryStore {
    return { version: STORE_VERSION, nextId: 1, entries: [] };
}

function validInt(value: unknown, min: number, max: number) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<HistoryEntry>;
    return (
        validInt(entry.id, 1, Number.MAX_SAFE_INTEGER) &&
        validInt(entry.offerSlot, 1, 6) &&
        validInt(entry.itemId, 0, 0x7fffffff) &&
        validInt(entry.offerType, 1, 2) &&
        validInt(entry.status, GrandExchangeHistoryStatus.PENDING, GrandExchangeHistoryStatus.CANCELLED) &&
        validInt(entry.quantity, 1, 0x7fffffff) &&
        validInt(entry.priceEachGp, 1, 0x7fffffff) &&
        validInt(entry.createdAt, 0, Number.MAX_SAFE_INTEGER) &&
        validInt(entry.updatedAt, 0, Number.MAX_SAFE_INTEGER)
    );
}

function parseStore(raw: string): HistoryStore {
    const parsed = JSON.parse(raw) as Partial<HistoryStore>;
    if (parsed.version !== STORE_VERSION || !validInt(parsed.nextId, 1, Number.MAX_SAFE_INTEGER) || !Array.isArray(parsed.entries)) {
        throw new Error('unsupported or malformed history store');
    }
    if (!parsed.entries.every(isHistoryEntry)) {
        throw new Error('history store contains an invalid entry');
    }
    return {
        version: STORE_VERSION,
        nextId: parsed.nextId,
        entries: parsed.entries.slice(0, MAX_HISTORY_ENTRIES),
    };
}

function load(player: Player): CachedHistoryStore {
    const key = playerKey(player);
    const cached = cache.get(key);
    if (cached) return cached;

    const file = historyPath(player);
    if (!fs.existsSync(file)) {
        const created = { store: emptyStore(), writable: true };
        cache.set(key, created);
        return created;
    }

    try {
        const loaded = { store: parseStore(fs.readFileSync(file, 'utf8')), writable: true };
        cache.set(key, loaded);
        return loaded;
    } catch (error) {
        console.error(`[GrandExchangeHistory] Refusing to overwrite corrupt history ${file}: ${error instanceof Error ? error.message : String(error)}`);
        const corrupt = { store: emptyStore(), writable: false };
        cache.set(key, corrupt);
        return corrupt;
    }
}

function persist(player: Player, cached: CachedHistoryStore) {
    if (!cached.writable) return false;

    const file = historyPath(player);
    const directory = path.dirname(file);
    const temporary = `${file}.tmp`;

    try {
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(temporary, JSON.stringify(cached.store, null, 2) + '\n', 'utf8');
        fs.renameSync(temporary, file);
        return true;
    } catch (error) {
        fs.rmSync(temporary, { force: true });
        console.error(`[GrandExchangeHistory] Could not persist ${file}: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

function copyStore(store: HistoryStore): HistoryStore {
    return {
        version: STORE_VERSION,
        nextId: store.nextId,
        entries: store.entries.map(entry => ({ ...entry })),
    };
}

function mutate(player: Player, callback: (store: HistoryStore) => boolean) {
    if (!isEnabled()) return false;
    const cached = load(player);
    if (!cached.writable) return false;

    const previous = cached.store;
    const next = copyStore(previous);
    if (!callback(next)) return false;

    cached.store = next;
    if (persist(player, cached)) return true;
    cached.store = previous;
    return false;
}

function getEntry(player: Player, row: number) {
    if (!isEnabled() || !validInt(row, 0, DISPLAY_ROWS - 1)) return null;
    return load(player).store.entries[row] ?? null;
}

export default class GrandExchangeHistory {
    static recordSubmission(player: Player, offerSlot: number, itemId: number, offerType: number, quantity: number, priceEachGp: number) {
        if (
            !validInt(offerSlot, 1, 6) ||
            !validInt(itemId, 0, 0x7fffffff) ||
            !validInt(offerType, 1, 2) ||
            !validInt(quantity, 1, 0x7fffffff) ||
            !validInt(priceEachGp, 1, 0x7fffffff)
        ) {
            return false;
        }

        return mutate(player, store => {
            const now = Date.now();
            store.entries.unshift({
                id: store.nextId++,
                offerSlot,
                itemId,
                offerType,
                status: GrandExchangeHistoryStatus.PENDING,
                quantity,
                priceEachGp,
                createdAt: now,
                updatedAt: now,
            });
            if (store.entries.length > MAX_HISTORY_ENTRIES) {
                store.entries.length = MAX_HISTORY_ENTRIES;
            }
            return true;
        });
    }

    static setStatus(player: Player, offerSlot: number, status: number) {
        if (!validInt(offerSlot, 1, 6) || !validInt(status, GrandExchangeHistoryStatus.PARTIAL, GrandExchangeHistoryStatus.CANCELLED)) {
            return false;
        }

        return mutate(player, store => {
            const entry = store.entries.find(candidate =>
                candidate.offerSlot === offerSlot &&
                (candidate.status === GrandExchangeHistoryStatus.PENDING || candidate.status === GrandExchangeHistoryStatus.PARTIAL)
            );
            if (!entry) return false;
            if (entry.status === status) return true;
            if (entry.status === GrandExchangeHistoryStatus.PARTIAL && status === GrandExchangeHistoryStatus.PARTIAL) return true;

            entry.status = status as GrandExchangeHistoryStatus;
            entry.updatedAt = Date.now();
            return true;
        });
    }

    static exists(player: Player, row: number) {
        return getEntry(player, row) !== null;
    }

    static item(player: Player, row: number) {
        return getEntry(player, row)?.itemId ?? -1;
    }

    static intField(player: Player, row: number, field: number) {
        const entry = getEntry(player, row);
        if (!entry) return 0;
        switch (field) {
            case GrandExchangeHistoryIntField.OFFER_TYPE:
                return entry.offerType;
            case GrandExchangeHistoryIntField.STATUS:
                return entry.status;
            case GrandExchangeHistoryIntField.QUANTITY:
                return entry.quantity;
            case GrandExchangeHistoryIntField.PRICE_EACH:
                return entry.priceEachGp;
            default:
                return 0;
        }
    }

    static timestamp(player: Player, row: number) {
        const entry = getEntry(player, row);
        if (!entry) return '';
        const date = new Date(entry.createdAt);
        const hour = date.getUTCHours().toString().padStart(2, '0');
        const minute = date.getUTCMinutes().toString().padStart(2, '0');
        return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${hour}:${minute}`;
    }
}

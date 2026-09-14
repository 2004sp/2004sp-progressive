import fs from 'fs';
import path from 'path';

type PersistentInventoryGroup = {
    file: string;
    names: string[];
    size: number;
};

const PERSISTENT_INVENTORIES: PersistentInventoryGroup[] = [
    {
        file: 'grand_exchange_collection.inv',
        names: Array.from({ length: 6 }, (_, index) => `ge_collection_offer_${index}`),
        size: 2,
    },
    {
        file: 'grand_exchange_active_offer.inv',
        names: Array.from({ length: 6 }, (_, index) => `ge_active_offer_${index + 1}`),
        size: 7,
    },
];

function promoteInventoryBlock(source: string, name: string, expectedSize: number) {
    const marker = `[${name}]`;
    const start = source.indexOf(marker);
    if (start < 0) {
        throw new Error(`Grand Exchange persistent state is missing ${marker}`);
    }

    const next = source.indexOf('\n[', start + marker.length);
    const end = next < 0 ? source.length : next;
    const block = source.slice(start, end);

    if (!block.includes('scope=temp')) {
        throw new Error(`Grand Exchange persistent state expected ${name} to be temporary before final staging`);
    }
    if (!block.includes(`size=${expectedSize}`)) {
        throw new Error(`Grand Exchange persistent state expected ${name} to have size ${expectedSize}`);
    }

    return source.slice(0, start) + block.replace('scope=temp', 'scope=perm') + source.slice(end);
}

// Earlier compatibility stages intentionally validate the frozen r481-derived
// inventories while they are temporary. Promote only the final staged copies,
// after all offer/collection stages have finished shaping them, so the native
// player save format serializes both outstanding offer metadata and uncollected
// item/coin outputs across logout and graceful server shutdown.
export function prepareGrandExchangePersistenceStage(stagedContentDir: string) {
    const configDir = path.join(stagedContentDir, 'scripts', 'grand_exchange', 'configs');

    for (const group of PERSISTENT_INVENTORIES) {
        const configPath = path.join(configDir, group.file);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Grand Exchange persistent state config is missing: ${configPath}`);
        }

        let source = fs.readFileSync(configPath, 'utf8').replace(/\r/g, '');
        for (const name of group.names) {
            source = promoteInventoryBlock(source, name, group.size);
        }
        fs.writeFileSync(configPath, source, 'utf8');
    }
}

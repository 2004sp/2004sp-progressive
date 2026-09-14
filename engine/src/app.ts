import fs from 'fs';
import { Worker } from 'worker_threads';

const tsxWorkerHook = new URL('./engine/worker-bootstrap.mjs', import.meta.url).href;

import { collectDefaultMetrics, register } from 'prom-client';

import { packAll } from '#tools/pack/PackAll.js';
import LocType from '#/cache/config/LocType.js';
import ClanManager from '#/engine/clan/ClanManager.js';
import World from '#/engine/World.js';
import TcpServer from '#/server/tcp/TcpServer.js';
import Environment from '#/util/Environment.js';
import { printError, printInfo } from '#/util/Logger.js';
import { startManagementWeb, startWeb } from '#/web.js';
import OnDemand from '#/engine/OnDemand.js';
import { BotDebugService } from '#/engine/bot/debug/BotDebugService.js';

const grandExchangeEnabled = ['1', 'true', 'yes', 'on'].includes(
    (process.env.NODE_FEATURE_GRANDEXCHANGE ?? '').trim().toLowerCase()
);

// The r254 Bank booth config has no third location option, so a native server
// OPLOC3 validation rejects the GE Collection action before RuneScript can see
// [oploc3,bankbooth]. The option-2 webclient exposes Collect in loc.op[2]; mirror
// that narrow adapter server-side while the GE plugin is enabled so the normal
// location-operation validation and interaction path can dispatch the staged
// OPLOC3 script. Native launcher modes keep the untouched r254 loc definition.
if (grandExchangeEnabled) {
    const originalLocGet = LocType.get.bind(LocType);
    LocType.get = (id: number): LocType => {
        const loc = originalLocGet(id);
        if (loc.name?.toLowerCase() === 'bank booth' && loc.op && !loc.op[2]) {
            loc.op[2] = 'Collect';
        }
        return loc;
    };
}

if (
    OnDemand.cache.count(0) !== 9 ||
    OnDemand.cache.count(2) === 0 ||
    !fs.existsSync('data/pack/server/script.dat')
) {
    printInfo('Packing cache, please wait until you see the world is ready.');

    try {
        // todo: different logic so the main thread doesn't have to load pack files
        const modelFlags: number[] = [];
        await packAll(modelFlags);
    } catch (err) {
        if (err instanceof Error) {
            printError(err);
        }

        process.exit(1);
    }
}

if (Environment.EASY_STARTUP) {
    new Worker('./src/login.ts', { execArgv: ['--import', tsxWorkerHook] });
    new Worker('./src/friend.ts', { execArgv: ['--import', tsxWorkerHook] });
    new Worker('./src/logger.ts', { execArgv: ['--import', tsxWorkerHook] });
}

await World.start();

await ClanManager.init();

const tcpServer = new TcpServer();
tcpServer.start();

await startWeb();
await startManagementWeb();

register.setDefaultLabels({ nodeId: Environment.NODE_ID });
collectDefaultMetrics({ register });

let exiting = false;
function safeExit() {
    if (exiting) {
        return;
    }

    exiting = true;

    if (BotDebugService.enabled) {
        try {
            console.log('\n' + BotDebugService.sessionSummary() + '\n');
        } catch {
            // never block shutdown on a debug summary failure
        }
    }

    World.rebootTimer(0);
}

process.on('SIGINT', safeExit);
process.on('SIGTERM', safeExit);

process.on('uncaughtException', function (err) {
    console.error(err, 'Uncaught exception');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error({ promise, reason }, 'Unhandled Rejection at: Promise');
});

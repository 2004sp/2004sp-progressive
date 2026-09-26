'use strict';

const path = require('path');
const cp = require('child_process');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');

const ROOT = path.resolve(__dirname, '..');
const REMOTE = 'origin';
const UPDATE_BRANCH = 'dev';

function run(command, args, options = {}) {
    return cp.spawnSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });
}

function git(args, options = {}) {
    const result = run('git', args, options);

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        const detail = options.inherit
            ? ''
            : String(result.stderr || result.stdout || '').trim();

        throw new Error(
            detail || `git ${args.join(' ')} failed with exit code ${result.status}`
        );
    }

    return options.inherit ? '' : String(result.stdout || '').trim();
}

function gitAvailable() {
    const result = run('git', ['--version']);
    return !result.error && result.status === 0;
}

function isManagedCheckout() {
    try {
        if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') {
            return false;
        }

        const top = path.resolve(git(['rev-parse', '--show-toplevel']));
        return top === ROOT;
    } catch {
        return false;
    }
}

function hasTrackedChanges() {
    return git([
        'status',
        '--porcelain',
        '--untracked-files=no'
    ]).length > 0;
}

async function confirmUpdate(count) {
    if (process.argv.includes('--yes')) {
        return true;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log(
            `[update] ${count} new commit(s) available; run "node launcher/updater.js --yes" to apply them.`
        );
        return false;
    }

    const rl = readline.createInterface({ input, output });

    try {
        const answer = (
            await rl.question(
                `[update] ${count} new commit(s) available. Pull them now? [Y/n] `
            )
        ).trim().toLowerCase();

        return answer === '' || answer === 'y' || answer === 'yes';
    } finally {
        rl.close();
    }
}

async function main() {
    if (process.env.COMPACT_MANAGER_SKIP_UPDATE === '1') {
        return 0;
    }

    if (!gitAvailable()) {
        console.log('[update] Git is not installed; skipping repository update.');
        return 0;
    }

    if (!isManagedCheckout()) {
        console.log('[update] Not running from a Git checkout; skipping repository update.');
        return 0;
    }

    const branch = git(['branch', '--show-current']);

    if (branch !== UPDATE_BRANCH) {
        console.log(
            `[update] On branch "${branch || 'detached HEAD'}"; automatic updates only run on "${UPDATE_BRANCH}".`
        );
        return 0;
    }

    if (hasTrackedChanges()) {
        console.log(
            '[update] Tracked local changes detected; skipping update so nothing is overwritten.'
        );
        return 0;
    }

    let remoteUrl;

    try {
        remoteUrl = git(['remote', 'get-url', REMOTE]);
    } catch {
        console.log(`[update] Git remote "${REMOTE}" is missing; skipping repository update.`);
        return 0;
    }

    console.log(`[update] Checking ${remoteUrl} (${UPDATE_BRANCH})...`);

    try {
        git(['fetch', '--quiet', REMOTE, UPDATE_BRANCH]);
    } catch (error) {
        console.log(`[update] Could not check for updates: ${error.message}`);
        return 0;
    }

    const upstream = `${REMOTE}/${UPDATE_BRANCH}`;
    const behind = Number(git(['rev-list', '--count', `HEAD..${upstream}`]));
    const ahead = Number(git(['rev-list', '--count', `${upstream}..HEAD`]));

    if (!Number.isFinite(behind) || !Number.isFinite(ahead)) {
        console.log('[update] Could not compare local and remote commits; skipping update.');
        return 0;
    }

    if (behind === 0) {
        if (ahead > 0) {
            console.log(`[update] Local ${UPDATE_BRANCH} is ${ahead} commit(s) ahead of ${upstream}.`);
        } else {
            console.log('[update] Already up to date.');
        }

        return 0;
    }

    if (ahead > 0) {
        console.log(
            `[update] Local and remote histories have diverged (${ahead} ahead, ${behind} behind); skipping automatic update.`
        );
        return 0;
    }

    if (!(await confirmUpdate(behind))) {
        console.log('[update] Update skipped.');
        return 0;
    }

    console.log(`[update] Fast-forwarding ${UPDATE_BRANCH}...`);

    try {
        git(['merge', '--ff-only', upstream], { inherit: true });
    } catch (error) {
        console.log(`[update] Update failed: ${error.message}`);
        return 0;
    }

    console.log('[update] Repository updated successfully.');
    return 0;
}

main().then(
    code => {
        process.exitCode = code;
    },
    error => {
        console.log(`[update] ${error.message}`);
        process.exitCode = 0;
    }
);

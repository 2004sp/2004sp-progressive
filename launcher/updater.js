'use strict';

const path = require('path');
const cp = require('child_process');

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

function result(status, updated = false) {
    return { status, updated };
}

function updateRepository() {
    if (!gitAvailable()) {
        console.log('[update] Git is not installed, so this copy cannot update itself.');
        return result('no-git');
    }

    if (!isManagedCheckout()) {
        console.log('[update] This is not a Git checkout. Downloaded ZIP copies cannot pull commits.');
        return result('not-git-checkout');
    }

    const branch = git(['branch', '--show-current']);

    if (branch !== UPDATE_BRANCH) {
        console.log(
            `[update] You are on "${branch || 'detached HEAD'}". Updates are only applied while on "${UPDATE_BRANCH}".`
        );
        return result('wrong-branch');
    }

    if (hasTrackedChanges()) {
        console.log(
            '[update] Tracked local changes were found. Update cancelled so your edits are not overwritten.'
        );
        return result('dirty');
    }

    let remoteUrl;

    try {
        remoteUrl = git(['remote', 'get-url', REMOTE]);
    } catch {
        console.log(`[update] Git remote "${REMOTE}" is missing.`);
        return result('no-remote');
    }

    console.log(`[update] Checking ${remoteUrl} (${UPDATE_BRANCH})...`);

    try {
        git(['fetch', '--quiet', REMOTE, UPDATE_BRANCH]);
    } catch (error) {
        console.log(`[update] Could not check for updates: ${error.message}`);
        return result('fetch-failed');
    }

    const upstream = `${REMOTE}/${UPDATE_BRANCH}`;
    const behind = Number(git(['rev-list', '--count', `HEAD..${upstream}`]));
    const ahead = Number(git(['rev-list', '--count', `${upstream}..HEAD`]));

    if (!Number.isFinite(behind) || !Number.isFinite(ahead)) {
        console.log('[update] Could not compare local and remote commits.');
        return result('compare-failed');
    }

    if (behind === 0) {
        if (ahead > 0) {
            console.log(`[update] Your local ${UPDATE_BRANCH} is ${ahead} commit(s) ahead of ${upstream}.`);
        } else {
            console.log('[update] Already up to date.');
        }

        return result('up-to-date');
    }

    if (ahead > 0) {
        console.log(
            `[update] Local and remote history have diverged (${ahead} ahead, ${behind} behind). Automatic update cancelled.`
        );
        return result('diverged');
    }

    console.log(`[update] ${behind} new commit(s) found. Updating...`);

    try {
        git(['merge', '--ff-only', upstream], { inherit: true });
    } catch (error) {
        console.log(`[update] Update failed: ${error.message}`);
        return result('merge-failed');
    }

    console.log('[update] Update installed successfully.');
    return result('updated', true);
}

module.exports = {
    updateRepository
};

if (require.main === module) {
    try {
        updateRepository();
        process.exitCode = 0;
    } catch (error) {
        console.error(`[update] ${error.message}`);
        process.exitCode = 1;
    }
}

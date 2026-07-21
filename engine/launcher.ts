import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import kleur from 'kleur';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

type ScriptMap = Record<string, string[]>;
type ProgressRange = { from: number; to: number; message: string };

const scripts: ScriptMap = {
    start: ['npm', 'run', 'start'],
    quickstart: ['npm', 'run', 'quickstart'],
    hiscores: ['npm', 'run', 'hiscores'],
    dev: ['npm', 'run', 'dev'],
    friend: ['npm', 'run', 'friend'],
    logger: ['npm', 'run', 'logger'],
    login: ['npm', 'run', 'login'],
    build: ['npm', 'run', 'build'],
    clean: ['npm', 'run', 'clean'],
    setup: ['npm', 'run', 'setup'],
};

const customContent = [
    ['Clans', 'NODE_FEATURE_CLANS'],
    ['Custom Shops', 'NODE_FEATURE_CUSTOMSHOPS'],
    ['Boss Pets', 'NODE_FEATURE_BOSSPETS'],
    ['Custom Weapons', 'NODE_FEATURE_CUSTOMWEAPONS'],
    ['Skillcapes', 'NODE_FEATURE_SKILLCAPES'],
    ['X-Amount Shop Input', 'NODE_FEATURE_XAMOUNT'],
    ['Make-X Skill Actions', 'NODE_FEATURE_MAKEX'],
] as const;

const customContentCategories = [
    ['Custom', customContent.slice(0, 5)],
    ['QOL (Quality of Life)', customContent.slice(5)],
] as const;

const runningProcesses: Record<string, ChildProcess> = {};
let rl: readline.Interface;

function progress(percent: number, message: string) {
    const filled = Math.round(percent / 10);
    const bar = `[${'#'.repeat(filled)}${'-'.repeat(10 - filled)}]`;
    console.log(`${bar} ${percent}% ${message}`);
}

function startProgressHeartbeat(range?: ProgressRange) {
    if (!range) {
        return undefined;
    }

    let percent = range.from;
    let frame = 0;
    const frames = ['|', '/', '-', '\\'];
    return setInterval(() => {
        percent = Math.min(percent + 1, range.to);
        progress(percent, `${frames[frame]} ${range.message}`);
        frame = (frame + 1) % frames.length;
    }, 5000);
}

function createReadline() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.on('line', handleInput);
}

function runScript(name: string, detached = false) {
    if (!scripts[name]) {
        console.log(`âŒ Script "${name}" not found`);
        return;
    }

    console.log(`ðŸš€ Starting ${name}...`);

    const [cmd, ...args] = scripts[name];
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    runningProcesses[name] = proc;

    if (detached) {
        console.log(`ðŸ§µ ${name} running in background`);
    } else {
        proc.on('exit', () => {
            console.log(`ðŸ›‘ ${name} stopped`);
            delete runningProcesses[name];
        });
    }
}

async function runScriptAndWait(name: string, heartbeat?: ProgressRange) {
    if (!scripts[name]) {
        console.log(`Script "${name}" not found`);
        return 1;
    }

    console.log(`Starting ${name}...`);

    const [cmd, ...args] = scripts[name];
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    runningProcesses[name] = proc;

    const timer = startProgressHeartbeat(heartbeat);
    const code = await new Promise<number | null>(resolve => proc.on('exit', resolve));
    if (timer) {
        clearInterval(timer);
    }
    delete runningProcesses[name];
    return code ?? 0;
}

async function ensureDependencies() {
    progress(20, 'Checking dependencies');
    const requiredPackages = ['tsx', 'bcrypt-ts'];
    const hasRequiredPackages = requiredPackages.every(pkg => fs.existsSync(path.join(__dirname, 'node_modules', pkg)));
    if (hasRequiredPackages) {
        progress(40, 'Dependencies ready');
        return true;
    }

    progress(30, 'Installing dependencies');
    const proc = spawn('npm', ['install', '--include=dev'], {
        stdio: 'inherit',
        shell: true,
    });

    const timer = startProgressHeartbeat({ from: 30, to: 39, message: 'Installing dependencies' });
    const code = await new Promise<number | null>(resolve => proc.on('exit', resolve));
    clearInterval(timer);
    const ok = (code ?? 0) === 0;
    progress(ok ? 40 : 0, ok ? 'Dependencies installed' : 'Dependency install failed');
    return ok;
}

async function runServer(showComplete = true) {
    progress(10, 'Preparing server');
    if (!(await ensureDependencies())) {
        console.log('npm install failed; server not started.');
        return;
    }

    progress(80, 'Starting game server');
    const code = await runScriptAndWait('quickstart', { from: 80, to: 99, message: 'Starting game server' });
    if (code !== 0) {
        console.log('Server stopped with an error.');
        return;
    }
    if (showComplete) {
        progress(100, 'Server stopped');
    }
}

async function runCustomServer() {
    progress(10, 'Preparing custom server');
    if (!(await ensureDependencies())) {
        console.log('npm install failed; custom server not started.');
        return;
    }

    progress(45, 'Patching .env');
    patchEnv({
        NODE_CLIENT_ROUTEFINDER: 'false',
        BUILD_VERIFY: 'false',
    });

    progress(55, 'Building content');
    const code = await runScriptAndWait('build', { from: 55, to: 74, message: 'Building content' });
    if (code !== 0) {
        console.log('Build failed; server not started.');
        return;
    }

    progress(75, 'Refreshing packed scripts');
    const scriptDat = path.join(__dirname, 'data', 'pack', 'server', 'script.dat');
    fs.rmSync(scriptDat, { force: true });
    console.log('Deleted data/pack/server/script.dat');

    progress(85, 'Starting game server');
    const serverCode = await runScriptAndWait('quickstart', { from: 85, to: 99, message: 'Starting game server' });
    if (serverCode !== 0) {
        console.log('Server stopped with an error.');
        return;
    }
    progress(100, 'Custom server stopped');
}

// For processes that need full stdin control (interactive prompts).
// Closes readline so the child owns stdin, then restores it on exit.
async function runInteractive(name: string) {
    if (!scripts[name]) {
        console.log(`âŒ Script "${name}" not found`);
        return;
    }

    console.log(`ðŸš€ Starting ${name}...`);

    rl.close();

    const [cmd, ...args] = scripts[name];
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    runningProcesses[name] = proc;

    await new Promise<void>(resolve => proc.on('exit', resolve));

    console.log(`ðŸ›‘ ${name} stopped`);
    delete runningProcesses[name];

    createReadline();
    showMenu();
}

function patchEnv(patches: Record<string, string>) {
    let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

    for (const [key, value] of Object.entries(patches)) {
        const pattern = new RegExp(`^#?\\s*${key}\\s*=.*$`, 'm');
        const replacement = `${key}=${value}`;
        if (pattern.test(content)) {
            content = content.replace(pattern, replacement);
        } else {
            content += `\n${replacement}`;
        }
    }

    fs.writeFileSync(ENV_PATH, content, 'utf8');
    console.log('âœ… .env patched:');
    for (const [key, value] of Object.entries(patches)) {
        console.log(`   ${key}=${value}`);
    }
}

function showMenu() {
    const recommended = kleur.bold().green('[Recommended]');

    console.log(`
${kleur.bold().cyan('2004Scape Progressive Launcher')}
${kleur.green('Recommended:')} Use ${kleur.bold('3')} for normal play. Use ${kleur.bold('12')} first if setup/database is not done.

${kleur.bold().green('Play')}
  ${kleur.green('1.')}  Start Server ${kleur.gray('(skips npm install after first run)')}
  ${kleur.green('2.')}  Custom Server ${kleur.gray('(patch .env -> build -> delete script.dat -> start)')}
  ${kleur.green('3.')}  Start Server + Hiscores ${recommended}

${kleur.bold().cyan('Services')}
  ${kleur.cyan('4.')}  Run Hiscores in background
  ${kleur.cyan('5.')}  Friend Server
  ${kleur.cyan('6.')}  Logger Server
  ${kleur.cyan('7.')}  Login Server
  ${kleur.cyan('8.')}  Stop Hiscores

${kleur.bold().yellow('Setup and Maintenance')}
  ${kleur.yellow('9.')}  Dev Mode
  ${kleur.yellow('10.')} Build Content
  ${kleur.yellow('11.')} Clean Build Files
  ${kleur.yellow('12.')} Setup / Configure Database ${kleur.gray('(first-time setup)')}
  ${kleur.yellow('13.')} Patch .env ${kleur.gray('(disable routefinder + build verify)')}
  ${kleur.yellow('14.')} Custom Content ${kleur.gray('(enable/disable optional content)')}

${kleur.bold().magenta('Accounts')}
  ${kleur.magenta('15.')} Import Character (.sav -> account)
  ${kleur.magenta('16.')} Change Password

${kleur.bold().red('Exit')}
  ${kleur.red('0.')}  Exit

${kleur.bold('Choose an option:')}
`);
}

async function handleInput(input: string) {
    switch (input.trim()) {
        case '1':
            await runServer();
            break;

        case '2':
            await runCustomServer();
            break;

        case '3':
            progress(5, 'Preparing server and hiscores');
            if (!(await ensureDependencies())) {
                console.log('npm install failed; server not started.');
                break;
            }
            progress(90, 'Starting hiscores');
            runScript('hiscores', true);
            progress(92, 'Starting game server');
            await runScriptAndWait('quickstart', { from: 92, to: 99, message: 'Starting game server' });
            return; // server owns the terminal until it exits

        case '4':
            runScript('hiscores', true);
            break;

        case '5':
            runScript('friend');
            break;

        case '6':
            runScript('logger');
            break;

        case '7':
            runScript('login');
            break;

        case '8':
            if (runningProcesses['hiscores']) {
                runningProcesses['hiscores'].kill();
                console.log('Hiscores stopped');
            } else {
                console.log('Hiscores not running');
            }
            break;

        case '9':
            runScript('dev');
            break;

        case '10':
            runScript('build');
            break;

        case '11':
            runScript('clean');
            break;

        case '12':
            progress(10, 'Preparing setup');
            if (!(await ensureDependencies())) {
                console.log('npm install failed; setup not started.');
                break;
            }
            progress(80, 'Starting setup');
            await runInteractive('setup');
            return; // runInteractive shows the menu after exit

        case '13':
            patchEnv({
                NODE_CLIENT_ROUTEFINDER: 'false',
                BUILD_VERIFY: 'false',
            });
            break;

        case '14':
            await customContentMenu();
            return; // customContentMenu shows the menu after finishing

        case '15':
            await importCharacter();
            return; // importCharacter shows the menu after finishing

        case '16':
            await changePassword();
            return; // changePassword shows the menu after finishing

        case '0':
            console.log('ðŸ‘‹ Exiting...');
            process.exit(0);
    }

    showMenu();
}

function getEnvValue(key: string) {
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    const match = content.match(new RegExp(`^#?\\s*${key}\\s*=\\s*(true|false)\\s*$`, 'mi'));
    return match?.[1].toLowerCase() === 'true';
}

async function customContentMenu() {
    rl.close();

    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>(resolve => tempRl.question(q, resolve));

    try {
        while (true) {
            console.log(`\n${kleur.bold().yellow('Custom Content')}`);
            console.log(kleur.gray('Choose a feature to toggle. Changes are written to .env.\n'));

            let option = 1;
            for (const [category, features] of customContentCategories) {
                console.log(kleur.bold().cyan(`\n${category}`));
                for (const [name, key] of features) {
                    const enabled = getEnvValue(key);
                    const state = enabled ? kleur.green('enabled') : kleur.red('disabled');
                    console.log(`  ${option}. ${name} ${kleur.gray(`(${key})`)} - ${state}`);
                    option++;
                }
            }

            console.log('\n  A. Enable all');
            console.log('  D. Disable all');
            console.log('  B. Back');

            const choice = (await question('\nChoose an option: ')).trim().toLowerCase();

            if (choice === 'b' || choice === 'back') {
                break;
            }

            if (choice === 'a') {
                patchEnv(Object.fromEntries(customContent.map(([, key]) => [key, 'true'])));
                continue;
            }

            if (choice === 'd') {
                patchEnv(Object.fromEntries(customContent.map(([, key]) => [key, 'false'])));
                continue;
            }

            const index = Number(choice) - 1;
            const selected = customContent[index];
            if (!selected) {
                console.log('Invalid option.');
                continue;
            }

            const [name, key] = selected;
            const enabled = !getEnvValue(key);
            patchEnv({ [key]: String(enabled) });
            console.log(`${name} is now ${enabled ? 'enabled' : 'disabled'}.`);
        }
    } finally {
        tempRl.close();
        createReadline();
        showMenu();
    }
}

async function importCharacter() {
    rl.close();

    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>(resolve => tempRl.question(q, resolve));

    try {
        console.log('\nðŸ“‚ Import Character');
        console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
        console.log('Place your .sav file in:');
        console.log('  engine/data/players/main/');
        console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
        await question('\nPress Enter once your .sav file is in place...');

        const username = (await question('Enter username (filename without .sav, e.g. "bob"): ')).trim().toLowerCase();
        if (!username) {
            console.log('âŒ Username cannot be empty.');
            return;
        }

        const savPath = path.join(__dirname, 'data', 'players', 'main', `${username}.sav`);
        if (!fs.existsSync(savPath)) {
            console.log(`âŒ File not found: ${savPath}`);
            console.log('   Make sure the filename matches the username exactly.');
            return;
        }

        const password = (await question('Enter password for this account: ')).trim();
        if (!password) {
            console.log('âŒ Password cannot be empty.');
            return;
        }

        const { hashSync } = await import('bcrypt-ts');
        const { DatabaseSync } = await import('node:sqlite');

        const hash = hashSync(password.toLowerCase(), 10);
        const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));

        try {
            db.prepare("INSERT INTO account (username, password, registration_ip, registration_date) VALUES (?, ?, ?, datetime('now'))").run(username, hash, '127.0.0.1');
            console.log(`âœ… Account created â€” ${username} can now log in.`);
        } catch (e: any) {
            if (e.message?.includes('UNIQUE')) {
                db.prepare('UPDATE account SET password = ? WHERE username = ?').run(hash, username);
                console.log(`âœ… Password updated â€” ${username} can now log in.`);
            } else {
                throw e;
            }
        } finally {
            db.close();
        }
    } catch (e: any) {
        console.log(`âŒ Error: ${e.message}`);
    } finally {
        tempRl.close();
        createReadline();
        showMenu();
    }
}

async function changePassword() {
    rl.close();

    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>(resolve => tempRl.question(q, resolve));

    try {
        console.log('\nðŸ”‘ Change Password');
        console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
        console.log('Your .sav file must be present in:');
        console.log('  engine/data/player/main/');
        console.log('This verifies you own the account.');
        console.log('â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

        const username = (await question('\nEnter username: ')).trim().toLowerCase();
        if (!username) {
            console.log('âŒ Username cannot be empty.');
            return;
        }

        const savPath = path.join(__dirname, 'data', 'players', 'main', `${username}.sav`);
        if (!fs.existsSync(savPath)) {
            console.log(`âŒ No .sav found for "${username}" â€” cannot verify account ownership.`);
            console.log(`   Expected: ${savPath}`);
            return;
        }

        console.log(`âœ”ï¸  Save file verified for "${username}".`);

        const newPassword = (await question('Enter new password: ')).trim();
        if (!newPassword) {
            console.log('âŒ Password cannot be empty.');
            return;
        }

        const { hashSync } = await import('bcrypt-ts');
        const { DatabaseSync } = await import('node:sqlite');

        const hash = hashSync(newPassword.toLowerCase(), 10);
        const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));

        try {
            const result = db.prepare('UPDATE account SET password = ? WHERE username = ?').run(hash, username) as { changes: number };
            if (result.changes === 0) {
                console.log(`âš ï¸  No account found for "${username}". Use option 15 to import it first.`);
            } else {
                console.log(`âœ… Password updated â€” ${username} can now log in with the new password.`);
            }
        } finally {
            db.close();
        }
    } catch (e: any) {
        console.log(`âŒ Error: ${e.message}`);
    } finally {
        tempRl.close();
        createReadline();
        showMenu();
    }
}

showMenu();
createReadline();

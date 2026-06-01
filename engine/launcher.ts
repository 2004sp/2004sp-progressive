import { spawn, ChildProcess } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

type ScriptMap = Record<string, string[]>;

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

const runningProcesses: Record<string, ChildProcess> = {};
let rl: readline.Interface;

function createReadline() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.on('line', handleInput);
}

function runScript(name: string, detached = false) {
    if (!scripts[name]) {
        console.log(`❌ Script "${name}" not found`);
        return;
    }

    console.log(`🚀 Starting ${name}...`);

    const [cmd, ...args] = scripts[name];
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    runningProcesses[name] = proc;

    if (detached) {
        console.log(`🧵 ${name} running in background`);
    } else {
        proc.on('exit', () => {
            console.log(`🛑 ${name} stopped`);
            delete runningProcesses[name];
        });
    }
}

// For processes that need full stdin control (interactive prompts).
// Closes readline so the child owns stdin, then restores it on exit.
async function runInteractive(name: string) {
    if (!scripts[name]) {
        console.log(`❌ Script "${name}" not found`);
        return;
    }

    console.log(`🚀 Starting ${name}...`);

    rl.close();

    const [cmd, ...args] = scripts[name];
    const proc = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true,
    });

    runningProcesses[name] = proc;

    await new Promise<void>(resolve => proc.on('exit', resolve));

    console.log(`🛑 ${name} stopped`);
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
    console.log('✅ .env patched:');
    for (const [key, value] of Object.entries(patches)) {
        console.log(`   ${key}=${value}`);
    }
}

function showMenu() {
    console.log(`
=== Node Launcher ===

1.  Start Server (npm start) (must of atleast ran this once if you want to use quickstart server in future)
2.  Quickstart Server (skips npm install) (must of run option 1 at somepoint for this to work)
3.  Run Hiscores (parallel)
4.  Dev Mode
5.  Friend
6.  Logger
7.  Login
8.  Build
9.  Clean
10. Stop Hiscores
11. Start Server & Hiscores (Best Option)
12. Setup (npm run setup)
13. Patch .env (disable routefinder & build verify)
14. Import Character (.sav -> account)
15. Change Password (requires .sav in player folder)
0.  Exit

Choose an option:
`);
}

async function handleInput(input: string) {
    switch (input.trim()) {
        case '1':
            runScript('start');
            break;

        case '2':
            runScript('quickstart');
            break;

        case '3':
            runScript('hiscores', true);
            break;

        case '4':
            runScript('dev');
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
            runScript('build');
            break;

        case '9':
            runScript('clean');
            break;

        case '10':
            if (runningProcesses['hiscores']) {
                runningProcesses['hiscores'].kill();
                console.log('🛑 Hiscores stopped');
            } else {
                console.log('⚠️ Hiscores not running');
            }
            break;

        case '11':
            runScript('start');
            runScript('hiscores', true);
            break;

        case '12':
            await runInteractive('setup');
            return; // runInteractive shows the menu after exit

        case '13':
            patchEnv({
                NODE_CLIENT_ROUTEFINDER: 'false',
                BUILD_VERIFY: 'false',
            });
            break;

        case '14':
            await importCharacter();
            return; // importCharacter shows the menu after finishing

        case '15':
            await changePassword();
            return; // changePassword shows the menu after finishing

        case '0':
            console.log('👋 Exiting...');
            process.exit(0);
    }

    showMenu();
}

async function importCharacter() {
    rl.close();

    const tempRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>(resolve => tempRl.question(q, resolve));

    try {
        console.log('\n📂 Import Character');
        console.log('──────────────────────────────────────────');
        console.log('Place your .sav file in:');
        console.log('  engine/data/players/main/');
        console.log('──────────────────────────────────────────');
        await question('\nPress Enter once your .sav file is in place...');

        const username = (await question('Enter username (filename without .sav, e.g. "bob"): ')).trim().toLowerCase();
        if (!username) {
            console.log('❌ Username cannot be empty.');
            return;
        }

        const savPath = path.join(__dirname, 'data', 'players', 'main', `${username}.sav`);
        if (!fs.existsSync(savPath)) {
            console.log(`❌ File not found: ${savPath}`);
            console.log('   Make sure the filename matches the username exactly.');
            return;
        }

        const password = (await question('Enter password for this account: ')).trim();
        if (!password) {
            console.log('❌ Password cannot be empty.');
            return;
        }

        const { hashSync } = await import('bcrypt-ts');
        const { DatabaseSync } = await import('node:sqlite');

        const hash = hashSync(password.toLowerCase(), 10);
        const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));

        try {
            db.prepare("INSERT INTO account (username, password, registration_ip, registration_date) VALUES (?, ?, ?, datetime('now'))").run(username, hash, '127.0.0.1');
            console.log(`✅ Account created — ${username} can now log in.`);
        } catch (e: any) {
            if (e.message?.includes('UNIQUE')) {
                db.prepare('UPDATE account SET password = ? WHERE username = ?').run(hash, username);
                console.log(`✅ Password updated — ${username} can now log in.`);
            } else {
                throw e;
            }
        } finally {
            db.close();
        }
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
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
        console.log('\n🔑 Change Password');
        console.log('──────────────────────────────────────────');
        console.log('Your .sav file must be present in:');
        console.log('  engine/data/player/main/');
        console.log('This verifies you own the account.');
        console.log('──────────────────────────────────────────');

        const username = (await question('\nEnter username: ')).trim().toLowerCase();
        if (!username) {
            console.log('❌ Username cannot be empty.');
            return;
        }

        const savPath = path.join(__dirname, 'data', 'players', 'main', `${username}.sav`);
        if (!fs.existsSync(savPath)) {
            console.log(`❌ No .sav found for "${username}" — cannot verify account ownership.`);
            console.log(`   Expected: ${savPath}`);
            return;
        }

        console.log(`✔️  Save file verified for "${username}".`);

        const newPassword = (await question('Enter new password: ')).trim();
        if (!newPassword) {
            console.log('❌ Password cannot be empty.');
            return;
        }

        const { hashSync } = await import('bcrypt-ts');
        const { DatabaseSync } = await import('node:sqlite');

        const hash = hashSync(newPassword.toLowerCase(), 10);
        const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));

        try {
            const result = db.prepare('UPDATE account SET password = ? WHERE username = ?').run(hash, username) as { changes: number };
            if (result.changes === 0) {
                console.log(`⚠️  No account found for "${username}". Use option 14 to import it first.`);
            } else {
                console.log(`✅ Password updated — ${username} can now log in with the new password.`);
            }
        } finally {
            db.close();
        }
    } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
    } finally {
        tempRl.close();
        createReadline();
        showMenu();
    }
}

showMenu();
createReadline();

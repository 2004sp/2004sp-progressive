import child_process from 'child_process';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';

import { confirm, input, number, password, select } from '@inquirer/prompts';

// ----

let previousEnv = '';
let writtenEnvKeys = new Set<string>();
let createdEnv = false;

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resetEnv() {
    createdEnv = !fs.existsSync('.env');
    previousEnv = createdEnv ? '' : fs.readFileSync('.env', 'utf8');
    writtenEnvKeys = new Set();

    if (createdEnv) {
        fs.copyFileSync('.env.example', '.env');
    }
}

function appendEnv(content: string) {
    const assignments = [...content.matchAll(/^\s*([A-Z0-9_]+)\s*=.*$/gm)];

    if (!assignments.length) {
        fs.appendFileSync('.env', content);
        return;
    }

    let env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

    for (const match of assignments) {
        const key = match[1];
        const line = match[0].trimEnd();
        const pattern = new RegExp(`^#?\\s*${escapeRegExp(key)}\\s*=.*$`, 'm');

        writtenEnvKeys.add(key);

        if (pattern.test(env)) {
            env = env.replace(pattern, line);
        } else {
            env += `${env.endsWith('\n') || env === '' ? '' : '\n'}${line}\n`;
        }
    }

    fs.writeFileSync('.env', env);
}

function preserveEnv() {
    if (!createdEnv || !previousEnv) {
        return;
    }

    const lines = previousEnv.split(/\r?\n/).filter(line => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
        return match && !writtenEnvKeys.has(match[1]);
    });

    if (lines.length) {
        appendEnv(`\n## PRESERVED .env\n${lines.join('\n')}\n`);
    }
}

function migrateSqlite() {
    if (fs.existsSync('prisma/singleworld/schema.prisma')) {
        child_process.execSync('npm run sqlite:migrate', {
            stdio: 'inherit'
        });
        return;
    }

    const db = new DatabaseSync('db.sqlite');
    db.exec(`
        CREATE TABLE IF NOT EXISTS account (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            registration_ip TEXT,
            registration_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            muted_until TEXT,
            banned_until TEXT,
            staffmodlevel INTEGER NOT NULL DEFAULT 0,
            members INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS account_login (
            account_id INTEGER NOT NULL,
            profile TEXT NOT NULL DEFAULT 'main',
            logged_in INTEGER NOT NULL DEFAULT 0,
            login_time TEXT,
            logged_out INTEGER NOT NULL DEFAULT 0,
            logout_time TEXT,
            PRIMARY KEY (account_id, profile)
        );

        CREATE TABLE IF NOT EXISTS friendlist (
            account_id INTEGER NOT NULL,
            friend_account_id INTEGER NOT NULL,
            profile TEXT NOT NULL DEFAULT 'main',
            created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, friend_account_id, profile)
        );

        CREATE TABLE IF NOT EXISTS hiscore (
            account_id INTEGER NOT NULL,
            profile TEXT NOT NULL DEFAULT 'main',
            type INTEGER NOT NULL,
            level INTEGER NOT NULL,
            value INTEGER NOT NULL,
            date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, profile, type)
        );

        CREATE TABLE IF NOT EXISTS hiscore_large (
            account_id INTEGER NOT NULL,
            profile TEXT NOT NULL DEFAULT 'main',
            type INTEGER NOT NULL,
            level INTEGER NOT NULL,
            value INTEGER NOT NULL,
            date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, profile, type)
        );

        CREATE TABLE IF NOT EXISTS ignorelist (
            account_id INTEGER NOT NULL,
            value TEXT NOT NULL,
            profile TEXT NOT NULL DEFAULT 'main',
            created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id, value, profile)
        );

        CREATE TABLE IF NOT EXISTS input_report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            data BLOB NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ipban (
            ip TEXT PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS private_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            profile TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            coord INTEGER NOT NULL,
            to_account_id INTEGER NOT NULL,
            message TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            coord INTEGER NOT NULL,
            message TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            coord INTEGER NOT NULL,
            offender TEXT NOT NULL,
            reason INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS session (
            uuid TEXT PRIMARY KEY,
            account_id INTEGER NOT NULL,
            profile TEXT NOT NULL,
            world INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            uid INTEGER NOT NULL,
            ip TEXT
        );

        CREATE TABLE IF NOT EXISTS session_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            coord INTEGER NOT NULL,
            event TEXT NOT NULL,
            event_type INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS session_wealth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_uuid TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            coord INTEGER NOT NULL,
            event_type INTEGER NOT NULL DEFAULT 0,
            account_items TEXT NOT NULL,
            account_value INTEGER NOT NULL,
            recipient_session TEXT,
            recipient_items TEXT,
            recipient_value INTEGER
        );
    `);
    db.close();
}

function setWebPort(port: number) {
    appendEnv(`WEB_PORT=${port}\n`);
}

function setNodeId(id: number) {
    appendEnv(`NODE_ID=${id + 9}\n`);
}

function setNodePort(port: number) {
    appendEnv(`NODE_PORT=${port}\n`);
}

function setNodeMembers(state: boolean) {
    appendEnv(`NODE_MEMBERS=${state}\n`);
}

function setNodeXpRate(rate: number) {
    appendEnv(`NODE_XPRATE=${rate}\n`);
}

function setNodeProduction(state: boolean) {
    appendEnv(`NODE_PRODUCTION=${state}\n`);
    appendEnv(`NODE_DEBUG=${!state}\n`);
}

function setLoginServer(state: boolean, host?: string, port?: number) {
    if (host && port) {
        appendEnv(`LOGIN_SERVER=${state}\nLOGIN_HOST=${host}\nLOGIN_PORT=${port}\n`);
    } else {
        appendEnv(`LOGIN_SERVER=${state}\n`);
    }
}

function setFriendServer(state: boolean, host?: string, port?: number) {
    if (host && port) {
        appendEnv(`FRIEND_SERVER=${state}\nFRIEND_HOST=${host}\nFRIEND_PORT=${port}\n`);
    } else {
        appendEnv(`FRIEND_SERVER=${state}\n`);
    }
}

function setLoggerServer(state: boolean, host?: string, port?: number) {
    if (host && port) {
        appendEnv(`LOGGER_SERVER=${state}\nLOGGER_HOST=${host}\nLOGGER_PORT=${port}\n`);
    } else {
        appendEnv(`LOGGER_SERVER=${state}\n`);
    }
}

function setLocalSupportServers() {
    setLoginServer(true, 'localhost', 43500);
    setFriendServer(true, 'localhost', 45099);
    setLoggerServer(true, 'localhost', 43501);
}

function setDbBackend(backend: 'sqlite' | 'mysql') {
    appendEnv(`DB_BACKEND=${backend}\n`);
}

function setDatabase(host: string, port: number, name: string, user: string, pass: string) {
    appendEnv(`DATABASE_URL=mysql://${user}:${pass}@${host}:${port}/${name}\n`);
    appendEnv(`DB_HOST=${host}\nDB_PORT=${port}\nDB_NAME=${name}\nDB_USER=${user}\nDB_PASS=${pass}\n`);
}

function setWebsiteRegistration(state: boolean) {
    appendEnv(`WEBSITE_REGISTRATION=${state}\n`);
}

// ----

async function promptWebPort() {
    const port = await number({
        message: 'Set http port',
        default: 80,
        required: true
    });

    setWebPort(port!);
}

async function promptNodeId() {
    const id = await number({
        message: 'Set world ID',
        default: 1,
        required: true
    });

    setNodeId(id!);
}

async function promptNodePort() {
    const port = await number({
        message: 'Set world port',
        default: 43594,
        required: true
    });

    setNodePort(port!);
}

async function promptNodeMembers() {
    const choice = await confirm({
        message: 'Enable members content',
        default: true
    });

    setNodeMembers(choice);
}

async function promptNodeXpRate() {
    const rate = await number({
        message: 'Set world XP rate',
        default: 1,
        required: true
    });

    setNodeXpRate(rate!);
}

async function promptNodeProduction() {
    const choice = await confirm({
        message: 'Enable production mode',
        default: false
    });

    setNodeProduction(choice);
}

async function promptLogin() {
    const choice = await confirm({
        message: 'Do you want to use a login server to provide authentication?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: 'localhost'
        });

        const port = await number({
            message: 'Host port',
            default: 43500,
            required: true
        });

        setLoginServer(true, host, port!);
    } else {
        setLoginServer(false);
    }
}

async function promptFriend() {
    const choice = await confirm({
        message: 'Do you want to use a friend server to allow PMing?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: 'localhost'
        });

        const port = await number({
            message: 'Host port',
            default: 45099,
            required: true
        });

        setFriendServer(true, host, port!);
    } else {
        setFriendServer(false);
    }
}

async function promptLogger() {
    const choice = await confirm({
        message: 'Do you want to use a logger server to log player sessions?',
        default: true
    });

    if (choice) {
        const host = await input({
            message: 'Host address',
            default: 'localhost'
        });

        const port = await number({
            message: 'Host port',
            default: 43501,
            required: true
        });

        setLoggerServer(true, host, port!);
    } else {
        setLoggerServer(false);
    }
}

async function promptDatabase() {
    const host = await input({
        message: 'Database host address',
        default: 'localhost'
    });

    const port = await number({
        message: 'Database host port',
        default: 3306,
        required: true
    });

    const name = await input({
        message: 'Database name',
        default: 'lostcity'
    });

    const user = await input({
        message: 'Database user account',
        default: 'lostcity'
    });

    const pass = await password({
        message: 'Database user password'
    });

    setDatabase(host, port!, name, user, pass);
}

async function configureDatabase() {
    const backend = await select<'sqlite' | 'mysql'>({
        message: 'Choose a database backend',
        choices: [
            {
                name: 'SQLite',
                value: 'sqlite'
            },
            {
                name: 'MySQL',
                value: 'mysql'
            }
        ]
    });

    setDbBackend(backend);

    if (backend === 'sqlite') {
        migrateSqlite();
    } else {
        await promptDatabase();
        child_process.execSync('npm run db:migrate', {
            stdio: 'inherit'
        });
    }
}

async function promptWebsiteRegistration() {
    const autoregister = await confirm({
        message: 'Do you want to automatically register accounts when they attempt to log in?',
        default: true
    });

    setWebsiteRegistration(!autoregister);
}

// ----

async function startup() {
    while (true) {
        const choices = [];

        if (fs.existsSync('data/pack')) {
            // quickstart script should run this before starting the server. exits and continues starting the world
            choices.push({
                name: 'Continue startup',
                value: 'continue'
            });
        }

        choices.push({
            name: 'Set up as a development world',
            description: 'Game server only, using sqlite',
            value: 'configure-dev'
        });

        choices.push({
            name: 'Set up as a full development stack',
            description: 'Includes login, friend, and logger servers',
            value: 'configure-dev-stack'
        });

        choices.push({
            name: 'Set up as a single world',
            value: 'configure-local'
        });

        choices.push({
            name: 'Set up as part of a multi-world infrastructure',
            value: 'configure-prod'
        });

        choices.push({
            name: 'Advanced options',
            value: 'advanced'
        });

        const action = await select({
            message: 'What would you like to do?',
            choices
        });

        switch (action) {
            case 'continue': {
                process.exit(0);
                break;
            }
            case 'configure-dev': {
                await configureDev();
                break;
            }
            case 'configure-dev-stack': {
                await configureDevStack();
                break;
            }
            case 'configure-local': {
                await configureSingle();
                break;
            }
            case 'configure-prod': {
                await configureMulti();
                break;
            }
            case 'advanced': {
                await advancedOptions();
                break;
            }
        }
    }
}

async function configureDev() {
    // we don't actually have to do anything because it's good OOTB :)
    resetEnv();
    preserveEnv();
    process.exit(0);
}

async function configureDevStack() {
    resetEnv();
    appendEnv('\n## SETUP SCRIPT\n');

    setWebsiteRegistration(false);
    setNodeProduction(false);

    const backend = await select({
        message: 'Choose a database backend',
        choices: [
            {
                name: 'SQLite',
                value: 'sqlite'
            },
            {
                name: 'MySQL',
                value: 'mysql'
            }
        ]
    });

    if (backend === 'sqlite') {
        setDbBackend('sqlite');
    } else if (backend === 'mysql') {
        setDbBackend('mysql');
        await promptDatabase();
    } else {
        console.error('Invalid database backend');
        process.exit(1);
    }

    setLocalSupportServers();

    appendEnv('EASY_STARTUP=true\n');
    preserveEnv();

    if (backend === 'sqlite') {
        migrateSqlite();
    } else if (backend === 'mysql') {
        child_process.execSync('npm run db:migrate', {
            stdio: 'inherit'
        });
    }

    process.exit(0);
}

async function configureSingle() {
    resetEnv();
    appendEnv('\n## SETUP SCRIPT\n');

    setNodeProduction(true);

    await promptNodeId();
    await promptNodeXpRate();
    await promptNodeMembers();
    appendEnv('DB_BACKEND=sqlite\n');
    await promptWebsiteRegistration();

    setLocalSupportServers();

    appendEnv('EASY_STARTUP=true\n');
    preserveEnv();
    migrateSqlite();
    process.exit(0);
}

async function configureMulti() {
    resetEnv();
    appendEnv('\n## SETUP SCRIPT\n');

    setWebsiteRegistration(true);
    setNodeProduction(true);

    await promptNodeId();
    await promptNodeXpRate();
    await promptNodeMembers();
    setDbBackend('mysql');
    await promptDatabase();
    await promptLogin();
    await promptWebsiteRegistration();
    await promptFriend();
    await promptLogger();

    preserveEnv();
    child_process.execSync('npm run db:migrate', {
        stdio: 'inherit'
    });

    process.exit(0);
}

async function advancedOptions() {
    const advanced = await select({
        message: 'Advanced options',
        pageSize: 24,
        choices: [
            {
                name: 'Go back',
                value: 'back'
            },
            {
                name: 'Set http port',
                value: 'web_port'
            },
            {
                name: 'Set world ID',
                value: 'node_id'
            },
            {
                name: 'Set world port',
                value: 'node_port'
            },
            {
                name: 'Disable members content',
                value: 'node_members'
            },
            {
                name: 'Set world XP rate',
                value: 'node_xprate'
            },
            {
                name: 'Enable production mode',
                value: 'node_production'
            },
            {
                name: 'Configure login server',
                value: 'login'
            },
            {
                name: 'Configure friend server',
                value: 'friend'
            },
            {
                name: 'Configure logger server',
                value: 'logger'
            },
            {
                name: 'Configure database connection',
                value: 'database'
            }
        ]
    });

    switch (advanced) {
        case 'web_port': {
            await promptWebPort();
            break;
        }
        case 'node_id': {
            await promptNodeId();
            break;
        }
        case 'node_port': {
            await promptNodePort();
            break;
        }
        case 'node_members': {
            await promptNodeMembers();
            break;
        }
        case 'node_xprate': {
            await promptNodeXpRate();
            break;
        }
        case 'node_production': {
            await promptNodeProduction();
            break;
        }
        case 'login': {
            await promptLogin();
            break;
        }
        case 'friend': {
            await promptFriend();
            break;
        }
        case 'logger': {
            await promptLogger();
            break;
        }
        case 'database': {
            await configureDatabase();
            break;
        }
    }
}

try {
    await startup();
} catch (_) {
    // no-op
}

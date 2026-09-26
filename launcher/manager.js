'use strict';

const readline = require('readline/promises');
const { updateRepository } = require('./updater');

function color(text, n) {
    return process.stdout.isTTY ? `\x1b[${n}m${text}\x1b[0m` : text;
}

const yellow = x => color(x, 33);
const green = x => color(x, 32);
const red = x => color(x, 31);

/*
 * Keep launcher.js unchanged and extend its existing menu at runtime.
 * This wrapper is the entry point used by Run.bat/run.sh.
 */
const originalLog = console.log.bind(console);

console.log = (...args) => {
    if (
        args.length === 1 &&
        args[0] === '\n  0. Exit'
    ) {
        originalLog(
            `  ${yellow('7.')} Check for updates`
        );
    }

    originalLog(...args);
};

const originalCreateInterface =
    readline.createInterface.bind(readline);

readline.createInterface = (...args) => {
    const rl = originalCreateInterface(...args);
    const originalQuestion = rl.question.bind(rl);

    rl.question = async (query, ...questionArgs) => {
        const answer =
            await originalQuestion(
                query,
                ...questionArgs
            );

        if (
            query !== '\nChoose an option: ' ||
            answer.trim() !== '7'
        ) {
            return answer;
        }

        originalLog('');

        try {
            const update =
                updateRepository();

            if (update.updated) {
                originalLog(
                    green(
                        '\nUpdate installed. Restart 2004Scape Compact Manager to load the new version.'
                    )
                );

                await originalQuestion(
                    '\nPress Enter to exit...'
                );

                // Feed Exit back to launcher.js so the currently-loaded
                // manager does not keep running stale code after an update.
                return '0';
            }
        } catch (error) {
            originalLog(
                red(
                    `\nUpdate error: ${error.message}`
                )
            );
        }

        await originalQuestion(
            '\nPress Enter...'
        );

        // launcher.js ignores unknown choices and redraws the main menu.
        return '__update_menu__';
    };

    return rl;
};

require('./launcher');

#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

progress() {
    case "$1" in
        0) bar="[----------]" ;;
        15) bar="[##--------]" ;;
        35) bar="[####------]" ;;
        55) bar="[######----]" ;;
        75) bar="[########--]" ;;
        90) bar="[#########-]" ;;
        100) bar="[##########]" ;;
        *) bar="[----------]" ;;
    esac
    printf '%s %s%% %s\n' "$bar" "$1" "$2"
}

progress 0 "Preparing launcher"

echo
echo "========================================"
echo "  2004Scape Progressive Launcher"
echo "========================================"
echo

# Load nvm when available.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Engine-TS revision 254 is Bun-targeted. Make sure Bun is available even if it is not on PATH yet.
if ! command -v bun >/dev/null 2>&1; then
    if [ -x "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
    fi
fi
if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is required to build the engine, but it was not found."
    echo "Expected location: $HOME/.bun/bin/bun"
    exit 1
fi

progress 10 "Installing engine dependencies"
(cd "$ROOT_DIR/engine" && npm install)

if [ ! -f "$ROOT_DIR/engine/.build_complete" ]; then
    progress 12 "Building engine (first run only)"
    # This distribution includes custom NPC definitions, so its packed data will
    # intentionally differ from the stock revision-254 checksum.
    if ! (cd "$ROOT_DIR/engine" && BUILD_VERBOSE=true BUILD_VERIFY=false npm run build); then
        echo
        echo "Engine build failed. The full stack trace is shown above."
        exit 1
    fi
    touch "$ROOT_DIR/engine/.build_complete"
fi

progress 15 "Checking files"
if [ ! -f "$ROOT_DIR/engine/launcher.ts" ]; then
    echo "Could not find engine/launcher.ts."
    echo "Make sure you are running this from the server folder."
    exit 1
fi

progress 35 "Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed or is not on PATH."
    echo "Install Node.js, then run this file again."
    exit 1
fi

progress 55 "Checking npm/npx"
if ! command -v npx >/dev/null 2>&1; then
    echo "npm/npx is not installed or is not on PATH."
    echo "Reinstall Node.js with npm enabled, then run this file again."
    exit 1
fi

progress 75 "Entering engine"
cd "$ROOT_DIR/engine"
progress 90 "Starting launcher"
echo "Starting launcher..."
echo
npx tsx launcher.ts

echo
progress 100 "Launcher exited"
echo "Launcher exited."

#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo
echo "========================================"
echo "  2004Scape Progressive Launcher"
echo "========================================"
echo

# Load nvm when available.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if [ ! -f "$ROOT_DIR/engine/launcher.ts" ]; then
    echo "Could not find engine/launcher.ts."
    echo "Make sure you are running this from the server folder."
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed or is not on PATH."
    echo "Install Node.js, then run this file again."
    exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
    echo "npm/npx is not installed or is not on PATH."
    echo "Reinstall Node.js with npm enabled, then run this file again."
    exit 1
fi

cd "$ROOT_DIR/engine"
echo "Starting launcher..."
echo
npx tsx launcher.ts

echo
echo "Launcher exited."

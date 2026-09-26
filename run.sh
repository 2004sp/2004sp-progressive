#!/usr/bin/env sh

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required to run 2004Scape."
    echo "Install Node.js and run ./run.sh again."
    exit 1
fi

node launcher/updater.js
node launcher/launcher.js

#!/usr/bin/env bash
# 1. Define the NVM directory (default is ~/.nvm)
export NVM_DIR="$HOME/.nvm"

# 2. Source the nvm.sh script to load the nvm function
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Go into engine directory
cd "$(dirname "$0")/engine"

echo "Starting Node Launcher..."

npx tsx launcher.ts

echo ""
echo "Launcher exited."

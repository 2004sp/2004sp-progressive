# Lost City Singleplayer Progressive

[![License: Open Source](https://img.shields.io/badge/license-Open%20Source-green)](LICENSE)
[![Status: Active Development](https://img.shields.io/badge/status-Active%20Development-blue)]()
[![Version: Early Access](https://img.shields.io/badge/version-Early%20Access-orange)]()

> **A dynamic single-player RuneScape 2004 experience with autonomous progressing bots, competitive hiscores, and a living game world.**

![Banner](https://img.shields.io/badge/Built%20on%20Lost%20City%202004-RuneScape%20Reimplementation-critical)

---

## 🎮 Overview

Lost City Singleplayer Progressive reimagines the classic 2004 RuneScape experience as a rich single-player adventure. Play alongside **autonomous AI bots** that progress in real-time, compete on dynamic hiscores, and create a living, breathing game world filled with dynamic interactions—from trading and cooperation to PvP combat and even deception.

Experience the nostalgia of early RuneScape while enjoying modern quality-of-life features and a fully open-source, modifiable codebase.

---

## ✨ Key Features

### 🤖 **Autonomous Progressive Bots**
- Full progression across all 19 skills (Combat, Gathering, Artisan, Misc)
- Real-time skill leveling, questing, and achievement tracking
- Adaptive AI that responds to world state and player interaction
- Compete for dominance on dynamic hiscores

### 🌍 **Living Game World**
- Bots engage in PvP combat at designated hotspots
- Player-to-bot trading and economic interaction
- Dynamic NPC behaviors including scamming and deception
- Real-time activity simulation across all activities

### ⚔️ **Complete Skill System**
**Combat (7 skills)**: Attack, Strength, Defence, Magic, Range, Prayer, Hitpoints  
**Gathering (4 skills)**: Fishing, Woodcutting, Mining, Runecrafting  
**Artisan (6 skills)**: Firemaking, Fletching, Smithing, Cooking, Crafting, Herblore  
**Misc (2 skills)**: Agility, Thieving  

### 🎯 **Player-Centric Design**
- Solo progression without external dependencies
- Influence bot behavior through interaction
- Monitor bot progress via hiscores
- Fully customizable server settings

---

## 🚀 Quick Start

### Requirements
- **Node.js**

### Installation

#### Step 1: Fresh Server Setup
1. Download and extract the base Lost City server (254 cache)
2. Run `start.bat` to verify successful boot
3. Confirm login functionality works

#### Step 2: Install Progressive Mod
```bash
# Download the Progressive repository
git clone https://github.com/yourusername/lost-city-progressive.git

# Extract contents into your server directory
# Copy all files from the repository into your fresh server folder

# Launch with the updated start.bat
start.bat
```

#### Step 3: Verify Installation
- Login to the server
- Observe bots spawning and progressing
- Check hiscores for bot activity
- Join [Discord](https://discord.gg/pWNjzFKU4V) for support

---

## 📋 Project Structure

```
lost-city-progressive/
├── engine/
│   ├── src/engine/
│   │   ├── bot/                    # Bot AI system
│   │   │   ├── BotPlayer.ts        # Main bot class
│   │   │   ├── BotAction.ts        # Bot primitive actions
│   │   │   ├── BotGoalPlanner.ts   # Task selection & progression
│   │   │   ├── tasks/              # Individual skill tasks
│   │   │   └── ...
│   │   ├── entity/                 # Player/NPC/Loc entities
│   │   ├── script/                 # Script execution engine
│   │   └── ...
│   └── src/cache/                  # Cache configuration
├── content/                        # Game content (scripts, items, NPCs)
│   ├── scripts/
│   ├── configs/
│   └── ...
├── start.bat                       # Windows launcher
├── package.json                    # Dependencies & build config
└── README.md                       # This file
```

---

## 🛠️ Features in Detail

### Bot Progression System
Bots autonomously progress through the skill system with:
- **Intelligent task selection** based on current level and available resources
- **Resource management** (banking, inventory management, item acquisition)
- **Optimal pathing** with gate awareness and world navigation
- **Magic teleportation** with visual cast animations
- **Activity-specific AI** (combat targeting, resource respawn detection, etc.)

### Gate & Door Awareness
Bots intelligently:
- Detect closed gates, doors, and barriers within 10 tiles
- Open gates directionally (toward their destination)
- Automatically handle AL Kharid tolls, Karamja boats, and similar gated regions
- Adapt routes when paths are blocked

### Dynamic Hiscores
- Real-time skill level tracking across all 19 skills
- XP-based rankings with visual displays
- Player vs. bot competition leaderboards
- Historical progress tracking

---

## 🎯 Gameplay Systems

### Skill Categories

| Category | Skills | Status |
|----------|--------|--------|
| **Combat** | Attack, Strength, Defence, Magic, Range, Prayer, Hitpoints | ✅ Complete |
| **Gathering** | Fishing, Woodcutting, Mining, Runecrafting | ✅ Complete |
| **Artisan** | Firemaking, Fletching, Smithing, Cooking, Crafting, Herblore | ✅ Complete |
| **Misc** | Agility, Thieving | ✅ Complete |

### World Interaction
- **Trading**: Bots buy/sell items at shops and with players
- **PvP**: Bots engage in combat at wilderness hotspots
- **Questing**: Bots complete available quests for progression
- **Resource gathering**: Bots fish, mine, chop wood, and craft
- **Deception**: Bots may engage in scamming and player interaction

---

## 🔧 Configuration

### Bot Behavior
Modify bot behavior via:
- `BotKnowledge.ts` - Bot-accessible item/location data
- `BotGoalPlanner.ts` - Progression decision logic
- Individual task files - Skill-specific AI
- `BotAction.ts` - Low-level action primitives

---

## 📚 Development

### Building from Source

```bash
# Install dependencies
bun install

# Build the TypeScript compiler
bun run build

# Start development server
bun run dev

# Run tests
bun run test

# Build for production
bun run build:prod
```

### Contributing

We welcome contributions! Please:

1. **Fork the repository** and create a feature branch
2. **Follow the code style** (TypeScript, 2-space indents, clear naming)
3. **Test thoroughly** before submitting a pull request
4. **Document changes** in commit messages and code comments
5. **Join our Discord** to discuss major features

### Code Style Guide

```typescript
// Use descriptive names
const isPlayerAdjacentToGate = true;

// Comment complex logic
// botTeleport defers the actual position jump by 2 ticks so the
// cast animation plays visibly at the source location first
export function botTeleport(player: Player, x: number, z: number, level: number): void {
    // Implementation
}

// Use JSDoc for public APIs
/**
 * Opens the nearest closed gate within radius tiles, or walks toward it.
 * Returns true if a gate was found and an action was queued.
 */
export function openNearbyGate(player: Player, radius = 30): boolean {
    // Implementation
}
```

---

## 🎓 Learning Resources

- **Lost City Docs**: [Official Documentation](https://github.com/LostCityRS)
- **RuneScape Wiki**: [2004 Era Content](https://oldschool.runescape.wiki)
- **Bot AI Deep Dive**: See `engine/src/engine/bot/` for implementation details
- **Script System**: Check `engine/src/engine/script/` for scripting reference

---

## 🤝 Community

- **Discord**: [Join our server](https://discord.gg/pWNjzFKU4V) for support, discussion, and updates
- **GitHub Issues**: Report bugs and request features
- **Pull Requests**: Submit improvements and new features
- **Wiki**: Help document the project and share knowledge

---

## 📜 License

This project is **fully open source** and available under the same license as Lost City (see LICENSE file).

### Credits & Attribution

**Development Team:**
- **attackishere** - lead developer
- **_mrsam** - Bot AI system, world interaction
- **K-andy** - bot phrases

**Built on:**
- [Lost City 2004](https://github.com/LostCityRS) - Open-source RuneScape 2004 reimplementation
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [TypeScript](https://www.typescriptlang.org) - Type-safe JavaScript

---

## 🎉 Get Started Now

1. **Download** the latest release
2. **Extract** to your server directory
3. **Run** `start.bat` and login
4. **Watch** bots progress in real-time
5. **Compete** on the hiscores
6. **Share** your experience on [Discord](https://discord.gg/pWNjzFKU4V)

---

## 📞 Support

Having issues? We're here to help!

- **Discord**: [Join our community](https://discord.gg/pWNjzFKU4V)
- **GitHub Issues**: [Report a bug](https://github.com/johnson-cooper/lost-city-progressive/issues)

---

**Lost City Singleplayer Progressive** — Relive the golden age of RuneScape, now with dynamic AI bots and endless progression.

*"The game was better in 2004"* — Now you can prove it.

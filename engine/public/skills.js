// ── SKILLS LIST ──────────────────────────────────────────────────────────────
// id matches the "type" column in hiscore_large
const SKILLS = [
  // Combat
  { id: 1,  key: 'attack',       name: 'Attack',       category: 'combat'    },
  { id: 2,  key: 'defence',      name: 'Defence',      category: 'combat'    },
  { id: 3,  key: 'strength',     name: 'Strength',     category: 'combat'    },
  { id: 4,  key: 'hitpoints',    name: 'Hitpoints',    category: 'combat'    },
  { id: 5,  key: 'ranged',       name: 'Ranged',       category: 'combat'    },
  { id: 6,  key: 'prayer',       name: 'Prayer',       category: 'combat'    },
  { id: 7,  key: 'magic',        name: 'Magic',        category: 'combat'    },

  // Skilling (matches client order)
  { id: 8,  key: 'cooking',      name: 'Cooking',      category: 'artisan'   },
  { id: 9,  key: 'woodcutting',  name: 'Woodcutting',  category: 'gathering' },
  { id: 10,  key: 'fletching',    name: 'Fletching',    category: 'artisan'   },
  { id: 11, key: 'fishing',      name: 'Fishing',      category: 'gathering' },
  { id: 12, key: 'firemaking',   name: 'Firemaking',   category: 'artisan'   },
  { id: 13, key: 'crafting',     name: 'Crafting',     category: 'artisan'   },
  { id: 14, key: 'smithing',     name: 'Smithing',     category: 'artisan'   },
  { id: 15, key: 'mining',       name: 'Mining',       category: 'gathering' },
  { id: 16, key: 'herblore',     name: 'Herblore',     category: 'support'   },
  { id: 17, key: 'agility',      name: 'Agility',      category: 'support'   },
  { id: 18, key: 'thieving',     name: 'Thieving',     category: 'support'   },

  // Last skill in this revision
  { id: 21, key: 'runecrafting', name: 'Runecrafting', category: 'support'   },
];

// ── SKILL ICONS ───────────────────────────────────────────────────────────────
// Uses the .webp icons in /skillicons where available, falls back to inline SVG
function iconImg(file, alt, ext = 'webp') {
  return `<img src="skillicons/${file}.${ext}" width="22" height="22" alt="${alt}">`;
}

const svgIcons = {

  overall: iconImg('stats', 'Overall'),

  attack: iconImg('attack', 'Attack'),

  strength: iconImg('strength', 'Strength', 'png'),

  defence: iconImg('defence', 'Defence', 'png'),

  hitpoints: iconImg('hitpoints', 'Hitpoints', 'png'),

  ranged: iconImg('ranged', 'Ranged', 'png'),

  prayer: iconImg('prayer', 'Prayer'),

  magic: iconImg('magic', 'Magic'),

  cooking: iconImg('cooking', 'Cooking'),

  woodcutting: iconImg('woodcutting', 'Woodcutting'),

  fletching: iconImg('fletching', 'Fletching'),

  fishing: iconImg('fishing', 'Fishing', 'png'),

  firemaking: iconImg('firemaking', 'Firemaking'),

  crafting: iconImg('crafting', 'Crafting'),

  smithing: iconImg('smithing', 'Smithing'),

  mining: iconImg('mining', 'Mining'),

  herblore: iconImg('herblore', 'Herblore', 'png'),

  agility: iconImg('agility', 'Agility'),

  thieving: iconImg('thieving', 'Thieving', 'png'),

  runecrafting: iconImg('runecraft', 'Runecrafting'),
};

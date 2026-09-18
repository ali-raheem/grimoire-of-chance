// Default roll sets, built-in random tables and generators.

export const SET_ICONS = ['⚔', '🛡', '🔮', '🗡', '🏹', '🪓', '🔥', '🌿', '🎲', '🐉', '🧙', '🧝', '🪙', '📜', '🕯', '🍺', '💀', '⚜', '🌙', '☀'];

export const DEFAULT_SETS = [
  {
    id: 'set-adventurer',
    name: 'Adventurer',
    icon: '⚔',
    rolls: [
      { id: 'r-d20', name: 'd20', expr: 'd20' },
      { id: 'r-adv', name: 'Advantage', expr: 'd20adv' },
      { id: 'r-dis', name: 'Disadvantage', expr: 'd20dis' },
      { id: 'r-init', name: 'Initiative', expr: 'd20+2' },
      { id: 'r-death', name: 'Death Save', expr: 'd20' },
      { id: 'r-pct', name: 'Percentile', expr: 'd100' },
      { id: 'r-stats', name: 'Ability Scores', expr: '4d6dl1 x6' },
      { id: 'r-hd', name: 'Hit Die', expr: '1d8+2' },
    ],
  },
  {
    id: 'set-fighter',
    name: 'Fighter',
    icon: '🛡',
    rolls: [
      { id: 'f-atk', name: 'Longsword Attack', expr: 'd20+7' },
      { id: 'f-dmg', name: 'Longsword Damage', expr: '1d8+4' },
      { id: 'f-gs', name: 'Greatsword Damage', expr: '2d6+4' },
      { id: 'f-crit', name: 'Greatsword Crit', expr: '4d6+4' },
      { id: 'f-gwf', name: 'Great Weapon Fighting', expr: '2d6ro<3+4' },
      { id: 'f-sw', name: 'Second Wind', expr: '1d10+5' },
      { id: 'f-str', name: 'STR Save', expr: 'd20+6' },
      { id: 'f-con', name: 'CON Save', expr: 'd20+5' },
    ],
  },
  {
    id: 'set-wizard',
    name: 'Wizard',
    icon: '🔮',
    rolls: [
      { id: 'w-atk', name: 'Spell Attack', expr: 'd20+7' },
      { id: 'w-fb', name: 'Fire Bolt', expr: '2d10' },
      { id: 'w-mm', name: 'Magic Missile', expr: '(1d4+1) x3' },
      { id: 'w-fire', name: 'Fireball', expr: '8d6' },
      { id: 'w-sleep', name: 'Sleep', expr: '5d8' },
      { id: 'w-conc', name: 'Concentration', expr: 'd20+3' },
      { id: 'w-arcana', name: 'Arcana', expr: 'd20+9' },
    ],
  },
  {
    id: 'set-rogue',
    name: 'Rogue',
    icon: '🗡',
    rolls: [
      { id: 'g-rap', name: 'Rapier Attack', expr: 'd20+7' },
      { id: 'g-dmg', name: 'Rapier Damage', expr: '1d8+4' },
      { id: 'g-sa', name: 'Sneak Attack', expr: '1d8+3d6+4' },
      { id: 'g-stealth', name: 'Stealth', expr: 'd20+9' },
      { id: 'g-thieves', name: "Thieves' Tools", expr: 'd20+9' },
      { id: 'g-dex', name: 'DEX Save', expr: 'd20+7' },
    ],
  },
  {
    id: 'set-dm',
    name: 'Game Master',
    icon: '🐉',
    rolls: [
      { id: 'dm-enc', name: 'Encounter Check', expr: 'd20' },
      { id: 'dm-react', name: 'Reaction', expr: '2d6' },
      { id: 'dm-morale', name: 'Morale', expr: '2d6' },
      { id: 'dm-loot', name: 'Loot d100', expr: 'd100' },
      { id: 'dm-surge', name: 'Wild Magic', expr: 'd20' },
      { id: 'dm-surge2', name: 'Surge Table', expr: 'd100' },
      { id: 'dm-gp', name: 'Coins', expr: '3d6*10' },
      { id: 'dm-trap', name: 'Trap Damage', expr: '4d10' },
    ],
  },
];

// Built-in tables. Each entry is { w: weight, t: text } or a plain string.
export const BUILTIN_TABLES = [
  {
    id: 'tbl-direction',
    name: 'Direction (d8)',
    entries: ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'],
  },
  {
    id: 'tbl-weather',
    name: 'Weather',
    entries: [
      { w: 5, t: 'Clear skies' },
      { w: 4, t: 'Overcast and grey' },
      { w: 3, t: 'Light drizzle' },
      { w: 2, t: 'Heavy rain' },
      { w: 2, t: 'Thick fog' },
      { w: 2, t: 'Strong, gusting winds' },
      { w: 1, t: 'Thunderstorm' },
      { w: 1, t: 'Snow or hail' },
      { w: 1, t: 'Sweltering, airless heat' },
    ],
  },
  {
    id: 'tbl-room',
    name: 'Dungeon Room',
    entries: [
      'Empty, dust thick on the floor',
      'A collapsed passage, partially cleared',
      'Barracks with rotting bunks',
      'Shrine to a forgotten god',
      'Flooded chamber, knee-deep',
      'Library, shelves toppled',
      'Torture chamber, chains still hanging',
      'Storeroom of spoiled provisions',
      'Trapped corridor, pressure plates',
      'Ossuary lined with skulls',
      'Laboratory with bubbling alembics',
      'Guard post with a sleeping sentry',
    ],
  },
  {
    id: 'tbl-loot',
    name: 'Loot Tier (d100)',
    entries: [
      { w: 40, t: 'Trinkets and coppers' },
      { w: 30, t: 'A purse of silver and gold' },
      { w: 15, t: 'Gems or fine art' },
      { w: 10, t: 'A minor magic item' },
      { w: 4, t: 'A rare magic item' },
      { w: 1, t: 'A legendary relic' },
    ],
  },
  {
    id: 'tbl-complication',
    name: 'Complication',
    entries: [
      'Reinforcements arrive',
      'The floor gives way',
      'A hostage is revealed',
      'The torch gutters out',
      'An old rival appears',
      'Something valuable breaks',
      'The weather turns',
      'A secret is overheard',
      'The map was wrong',
      'A creature was watching',
      'The bridge starts to burn',
      'Someone recognises you',
    ],
  },
  {
    id: 'tbl-npc',
    name: 'NPC Quirk',
    entries: [
      'Speaks only in questions',
      'Collects teeth',
      'Terrified of birds',
      'Hums constantly',
      'Never blinks',
      'Owes money to everyone',
      'Secretly literate and proud of it',
      'Always eating something',
      'Refers to self in third person',
      'Has a pet rat named after a king',
      'Insists on formal titles',
      'Smells strongly of lavender',
    ],
  },
  {
    id: 'tbl-potion',
    name: 'Potion Appearance',
    entries: [
      'Cloudy blue, smells of rain',
      'Thick and black, tastes of iron',
      'Glowing green, fizzes on the tongue',
      'Clear with gold flecks, sweet',
      'Swirling purple, cold to hold',
      'Milky white, bitter as bark',
      'Deep red, warm and peppery',
      'Amber with a floating eye',
    ],
  },
  {
    id: 'tbl-time',
    name: 'Time of Day',
    entries: ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Evening', 'Midnight', 'The dead hours before dawn'],
  },
];

const NAME_PARTS = {
  starts: ['Ael', 'Bran', 'Cor', 'Dor', 'El', 'Fen', 'Gal', 'Har', 'Il', 'Jor', 'Kel', 'Lor', 'Mar', 'Nor', 'Or', 'Per', 'Quin', 'Ral', 'Ser', 'Tor', 'Ul', 'Val', 'Wren', 'Yor', 'Zan', 'Ash', 'Bel', 'Cas', 'Dra', 'Eri', 'Fal', 'Gwen', 'Hal', 'Isa', 'Kai', 'Lys', 'Mor', 'Nym', 'Ode', 'Ryn', 'Syl', 'Tha', 'Vor'],
  mids: ['', '', '', 'a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'io', 'an', 'en', 'ir', 'or', 'ul', 'eth', 'ath'],
  ends: ['dor', 'wyn', 'ric', 'mir', 'lin', 'gar', 'thas', 'wen', 'dan', 'vor', 'iel', 'ros', 'nak', 'dil', 'mon', 'seth', 'ra', 'la', 'ion', 'ius', 'ara', 'ith', 'or', 'an', 'is', 'ek', 'oth', 'ya'],
  surnames1: ['Iron', 'Storm', 'Raven', 'Oak', 'Ember', 'Frost', 'Shadow', 'Silver', 'Thorn', 'Wolf', 'Stone', 'Ash', 'Grim', 'Bright', 'Hollow', 'Wind', 'Night', 'Dawn', 'Black', 'Gold'],
  surnames2: ['wood', 'brook', 'shield', 'blade', 'heart', 'mantle', 'crest', 'hollow', 'fall', 'song', 'fist', 'bane', 'ward', 'hammer', 'vale', 'crown', 'rider', 'weaver', 'forge', 'moor'],
};

const TAVERN = {
  adj: ['Prancing', 'Rusty', 'Drunken', 'Golden', 'Silver', 'Broken', 'Laughing', 'Sleeping', 'Wandering', 'Crooked', 'Salty', 'Gilded', 'Weeping', 'Howling', 'Merry', 'Hungry', 'Bloody', 'Lucky', 'Blind', 'Green'],
  noun: ['Pony', 'Dragon', 'Goblin', 'Tankard', 'Griffin', 'Anchor', 'Lantern', 'Boar', 'Unicorn', 'Hound', 'Wizard', 'Kettle', 'Sword', 'Barrel', 'Stag', 'Maiden', 'Knight', 'Owl', 'Serpent', 'Crown'],
  suffix: ['Inn', 'Tavern', 'Alehouse', 'Lodge', 'Rest', 'Taproom', 'Inn', 'Tavern'],
};

function pickFrom(arr, rng) {
  return arr[rng.int(0, arr.length - 1)];
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const GENERATORS = [
  {
    id: 'gen-name',
    name: 'Character Name',
    run(rng) {
      const first = pickFrom(NAME_PARTS.starts, rng) + pickFrom(NAME_PARTS.mids, rng) + pickFrom(NAME_PARTS.ends, rng);
      const last = pickFrom(NAME_PARTS.surnames1, rng) + pickFrom(NAME_PARTS.surnames2, rng);
      return `${cap(first.toLowerCase())} ${last}`;
    },
  },
  {
    id: 'gen-tavern',
    name: 'Tavern Name',
    run(rng) {
      return `The ${pickFrom(TAVERN.adj, rng)} ${pickFrom(TAVERN.noun, rng)} ${pickFrom(TAVERN.suffix, rng)}`;
    },
  },
  {
    id: 'gen-npc',
    name: 'Quick NPC',
    run(rng) {
      const roles = ['blacksmith', 'innkeeper', 'guard captain', 'hedge witch', 'merchant', 'pickpocket', 'priest', 'farmer', 'scholar', 'sellsword', 'noble', 'beggar', 'bard', 'sailor', 'hunter'];
      const wants = ['revenge', 'a lost heirloom', 'to leave town', 'coin, quickly', 'forgiveness', 'a cure', 'to be left alone', 'fame', 'a missing sibling', 'the truth', 'protection', 'a good story'];
      const traits = ['nervous', 'boisterous', 'cold', 'kindly', 'sly', 'pious', 'greedy', 'brave', 'weary', 'curious', 'haughty', 'melancholy'];
      const first = pickFrom(NAME_PARTS.starts, rng) + pickFrom(NAME_PARTS.mids, rng) + pickFrom(NAME_PARTS.ends, rng);
      return `${cap(first.toLowerCase())}, a ${pickFrom(traits, rng)} ${pickFrom(roles, rng)} who wants ${pickFrom(wants, rng)}.`;
    },
  },
];

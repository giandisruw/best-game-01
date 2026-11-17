// FROSTLINE: Keep the Hearth — tuning and content tables.
// One clear job: every number, name and palette entry the game uses lives
// here, so balance and look can be tuned without touching the rules.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Warm hearth light against creeping blue-white frost.
export const PALETTE = {
  night: '#0a1226',
  nightEdge: '#060a18',
  snow: '#dfe9f5',
  snowShadow: '#b9cbe4',
  pine: '#1d4a38',
  pineSnow: '#cfe3ee',
  stone: '#8d9bb0',
  frost: '#a8d4f0',
  frostDeep: '#5f9fd0',
  frostEdge: '#e8f6ff',
  ember: '#ffb347',
  emberHot: '#ff7a1a',
  emberCore: '#ffd166',
  flame: '#ff9a3c',
  hearthStone: '#5b4a68',
  hearthStoneDark: '#3d3249',
  hpGood: '#7ee081',
  hpWarn: '#ffd166',
  hpBad: '#ff5d5d',
  ink: '#101827',
  panel: 'rgba(8, 14, 32, 0.88)',
  panelEdge: '#ffb347',
  text: '#f4f1e6',
  textDim: '#b9c6da',
  gold: '#ffd166',
};

export const HEARTH = { x: VIEW_W / 2, y: VIEW_H / 2 + 40, r: 46 };

// Heat dial: the whole game turns on this number (0..100).
export const HEAT = {
  start: 50,
  stokeRate: 26, // per second while stoking
  bankRate: 34, // per second while banking
  driftTo: 42, // passive drift target
  driftRate: 2.2,
  overheatAt: 85, // above this the hearth burns itself
  overheatDps: 2.5,
  coldAt: 18, // below this braziers barely fire
  fuelDrainBase: 0.35, // per second
  fuelDrainHeat: 1.25, // extra per second at full heat
  fuelEmptyHeatFall: 26, // per second toward 8 when out of fuel
  lightRadiusBase: 96,
  lightRadiusPerHeat: 1.7,
  burnDps: 26, // damage to enemies standing in lit ground
  brazierRateMin: 0.35, // fire-rate multiplier at 0 heat
  brazierRateMax: 1.75, // fire-rate multiplier at 100 heat
};

// Frost creep: a coarse grid of cells, 0 (clear) .. 1 (frozen solid).
export const FROST = {
  cols: 40,
  rows: 23,
  cell: 32,
  spreadPerSec: 0.016, // base creep from the edges inward
  meltPerSec: 0.55, // melt inside lit ground
  damagePerSec: 3.2, // hearth damage while frost touches it
  touchRadius: 74, // frost cell centre within this of hearth hurts it
  levelGainPerSec: 0.35, // global frost level while any cell is frozen
};

export const PLAYER = {
  r: 15,
  speed: 235,
  fireCooldown: 0.34,
  boltSpeed: 560,
  boltDamage: 14,
  boltRange: 520,
};

export const BRAZIERS = {
  ember: { name: 'Ember Brazier', cost: 25, range: 190, damage: 16, rate: 1.15, shots: 1, aoe: 0, color: '#ff9a3c', desc: 'Steady flame. Balanced range and damage.' },
  longflame: { name: 'Longflame Brazier', cost: 40, range: 300, damage: 22, rate: 0.7, shots: 1, aoe: 0, color: '#ffd166', desc: 'Far reach, slow heavy shots. Great on open ground.' },
  cinderburst: { name: 'Cinderburst Brazier', cost: 35, range: 130, damage: 11, rate: 1.7, shots: 3, aoe: 58, color: '#ff5d3c', desc: 'Short fuse, three-way burst. Melts crowds.' },
};

export const ENEMIES = {
  wisp: { name: 'Frost Wisp', hp: 26, speed: 46, damage: 6, score: 10, embers: 3, r: 13, color: '#bfe3ff' },
  darter: { name: 'Shard Darter', hp: 18, speed: 118, damage: 5, score: 15, embers: 4, r: 11, color: '#8fd0ff' },
  brute: { name: 'Ice Brute', hp: 130, speed: 26, damage: 18, score: 40, embers: 10, r: 24, color: '#d7ecff' },
  herald: { name: 'THE WHITEOUT HERALD', hp: 1450, speed: 20, damage: 30, score: 1000, embers: 120, r: 46, color: '#f2f9ff' },
};

// Nights: 7-night campaign, boss on night 7. spawn list is [type, count].
export const NIGHTS = [
  { night: 1, duration: 42, spawn: [['wisp', 10]], trickle: 2.4 },
  { night: 2, duration: 46, spawn: [['wisp', 12], ['darter', 4]], trickle: 2.2 },
  { night: 3, duration: 50, spawn: [['wisp', 14], ['darter', 8]], trickle: 2.0 },
  { night: 4, duration: 54, spawn: [['wisp', 14], ['darter', 10], ['brute', 2]], trickle: 1.9 },
  { night: 5, duration: 58, spawn: [['wisp', 16], ['darter', 12], ['brute', 4]], trickle: 1.8 },
  { night: 6, duration: 62, spawn: [['wisp', 18], ['darter', 14], ['brute', 6]], trickle: 1.7 },
  { night: 7, duration: 70, spawn: [['herald', 1], ['wisp', 10], ['darter', 8]], trickle: 3.0 },
];

export const DIFFICULTIES = {
  ember: { name: 'Ember', label: 'EMBER — a fair winter', hp: 100, fuel: 100, embers: 60, enemyHp: 1.0, enemySpeed: 1.0, frostSpread: 1.0 },
  blizzard: { name: 'Blizzard', label: 'BLIZZARD — the frost is hungry', hp: 80, fuel: 80, embers: 45, enemyHp: 1.35, enemySpeed: 1.12, frostSpread: 1.45 },
};

// Draft cards: pick 1 of 3 between nights. Rarity colours the card border.
export const DRAFT_POOL = [
  { id: 'kindled-core', name: 'Kindled Core', rarity: 'Rare', text: 'Braziers deal +25% damage.', note: 'Synergy: pairs with Twin Flames.', apply: 'brazierDamage' },
  { id: 'twin-flames', name: 'Twin Flames', rarity: 'Epic', text: 'Every brazier fires +1 shot.', note: 'Synergy: best with Cinderburst.', apply: 'extraShot' },
  { id: 'longflame-kit', name: 'Longflame Kit', rarity: 'Common', text: 'Unlock a Longflame Brazier to place (free).', note: 'Long range, slow heavy shots.', apply: 'grantLongflame' },
  { id: 'cinder-kit', name: 'Cinder Kit', rarity: 'Common', text: 'Unlock a Cinderburst Brazier to place (free).', note: 'Short range, three-way burst.', apply: 'grantCinder' },
  { id: 'thick-logs', name: 'Thick Logs', rarity: 'Common', text: '+40 max fuel and +40 fuel now.', note: 'Fuel is life when the wind turns.', apply: 'maxFuel' },
  { id: 'ember-hoard', name: 'Ember Hoard', rarity: 'Common', text: '+30 embers right now.', note: 'Spend them in the shop below.', apply: 'embersNow' },
  { id: 'iron-hearth', name: 'Iron Hearth', rarity: 'Rare', text: '+25 max hearth HP, heal 25 now.', note: 'A sturdier heart for the long night.', apply: 'maxHp' },
  { id: 'stokers-gloves', name: "Stoker's Gloves", rarity: 'Rare', text: 'Stoking heats +50% faster.', note: 'Reach the burn zone sooner.', apply: 'stokeSpeed' },
  { id: 'bankers-charm', name: "Banker's Charm", rarity: 'Rare', text: 'Banking also banks +2 embers per second.', note: 'Cold hands, full purse.', apply: 'bankEmbers' },
  { id: 'cinder-rain', name: 'Cinder Rain', rarity: 'Epic', text: 'Kindle Burst recharges twice as fast.', note: 'More fire when it matters.', apply: 'burstCooldown' },
  { id: 'warm-ground', name: 'Warm Ground', rarity: 'Rare', text: 'Lit ground reaches +35% further.', note: 'Frost melts before it arrives.', apply: 'lightRadius' },
  { id: 'frostbite-oil', name: 'Frostbite Oil', rarity: 'Epic', text: 'All shots slow enemies 35% for 2s.', note: 'Slow them, then burn them.', apply: 'slowShots' },
  { id: 'deep-ember', name: 'Deep Ember', rarity: 'Epic', text: 'Brazier range +20% and fire +15% faster.', note: 'The whole field becomes yours.', apply: 'brazierRange' },
  { id: 'second-wind', name: 'Second Wind', rarity: 'Epic', text: 'Once per run, survive a fatal blow at 1 HP.', note: 'The hearth refuses to go out.', apply: 'secondWind' },
];

export const SHOP_ITEMS = [
  { id: 'fuel', name: 'Dry Logs', desc: '+45 fuel', cost: 20 },
  { id: 'heal', name: 'Hearth Patch', desc: 'Repair hearth +25 HP', cost: 15 },
  { id: 'brazier', name: 'Spare Brazier', desc: '+1 free Ember Brazier to place', cost: 30 },
  { id: 'reroll', name: 'Reroll Draft', desc: 'Draw 3 new draft cards', cost: 10 },
  { id: 'upgrade', name: 'Stoke Upgrade', desc: 'Upgrade a random brazier (+dmg)', cost: 35 },
];

export const FEATS = [
  { id: 'first-blood', name: 'First Blood', desc: 'Banish your first wisp.' },
  { id: 'combo8', name: 'Wildfire', desc: 'Reach combo x8.' },
  { id: 'night3', name: 'Third Night', desc: 'Survive night 3.' },
  { id: 'night5', name: 'Fifth Night', desc: 'Survive night 5.' },
  { id: 'no-burn', name: 'Cool Head', desc: 'Finish a night without overheating.' },
  { id: 'rich', name: 'Ember Baron', desc: 'Hold 150 embers at once.' },
  { id: 'boss', name: 'Herald Slain', desc: 'Defeat the Whiteout Herald.' },
  { id: 'dawn', name: 'Dawnkeeper', desc: 'Win the 7-night campaign.' },
];

export const ABILITIES = {
  burst: { key: '1', name: 'Kindle Burst', desc: 'A ring of fire: 40 damage to all nearby enemies.', cooldown: 14, radius: 210, damage: 40 },
  ward: { key: '2', name: 'Frost Ward', desc: 'Chill the field: enemies slow 50% for 5s.', cooldown: 20, duration: 5 },
};

export const COMBO_WINDOW = 3; // seconds between kills to keep the chain
export const COMBO_MAX = 8;

export function gradeFor(score, hpLeft, hpMax, difficulty) {
  const ratio = hpLeft / hpMax;
  let g = 'C';
  if (score >= 9000 && ratio >= 0.6) g = 'S';
  else if (score >= 7000 && ratio >= 0.45) g = 'A';
  else if (score >= 5000 && ratio >= 0.3) g = 'B';
  if (difficulty === 'blizzard' && g !== 'S') g = String.fromCharCode(g.charCodeAt(0) - 1);
  if (g === '@') g = 'S';
  return g;
}

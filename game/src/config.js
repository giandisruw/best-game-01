// Lumenfall — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 330,
  fireInterval: 0.22,
  boltSpeed: 640,
  boltDamage: 1,
  dashSpeed: 900,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 1.6,
  maxEnergy: 100,
  energyPerShot: 4,
  energyPerMote: 14,
};

export const LIVES = 3;

/** Waves: 1..9 are wisp tides, wave 10 is the Gloom Herald boss. */
export const WAVES = { total: 10, betweenSeconds: 3.5, moteEverySeconds: 2.2 };

export const ENEMY = {
  wisp: { radius: 15, hp: 1, speed: 95, score: 50, touch: 1 },
  darter: { radius: 12, hp: 1, speed: 215, score: 80, touch: 1 },
  brute: { radius: 26, hp: 4, speed: 55, score: 150, touch: 1 },
  herald: { radius: 46, hp: 40, speed: 42, score: 2000, touch: 1 },
};

export const MOTE = { radius: 9, score: 25, lifetime: 9 };

/** Combo: kills within this many seconds of each other raise the multiplier. */
export const COMBO = { window: 3, max: 8 };

export const PALETTE = {
  backdrop: '#070a18',
  skyTop: '#0b1030',
  skyBottom: '#1a1440',
  groundGlow: '#241b52',
  player: '#ffd76a',
  playerCore: '#fff3c4',
  bolt: '#ffe9a3',
  wisp: '#8f7bff',
  darter: '#ff7ad9',
  brute: '#b06bff',
  herald: '#ff5d73',
  mote: '#7ef0c1',
  heart: '#ff6b81',
  panel: '#141a33',
  panelEdge: '#3d4a7a',
  text: '#f2f0ff',
  muted: '#a9b0d0',
  gold: '#ffd76a',
  danger: '#ff5d73',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumenfall.best';

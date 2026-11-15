// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (keep clear of the nearest shadow, chase the nearest mote,
// always fire at the nearest foe), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, KIND_HERALD } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 90;
const END_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 240;

/** Nearest active enemy to the keeper, or null. */
function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** Nearest active mote, or null. */
function nearestMote(state) {
  let best = null;
  let bestD = Infinity;
  for (const m of state.motes) {
    if (!m.active) continue;
    const dx = m.x - state.player.x;
    const dy = m.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

/**
 * One autopilot step: flee the nearest shadow when it is close, else drift
 * toward the nearest mote, else hold the centre; aim at the nearest foe.
 * `bold` plays well (play/win scenes); a timid pilot (end scene) only flees
 * when a shadow is almost on top of it, so it is caught out as a hurried
 * player is.
 */
function autopilot(state, bold) {
  const player = state.player;
  const foe = nearestEnemy(state);
  const mote = nearestMote(state);
  let tx = FIELD.width / 2;
  let ty = FIELD.height / 2;
  let flee = false;
  if (foe) {
    const dx = player.x - foe.x;
    const dy = player.y - foe.y;
    const d = Math.hypot(dx, dy) || 1;
    const danger = bold ? 190 : 70;
    if (d < danger) {
      flee = true;
      tx = player.x + (dx / d) * 220;
      ty = player.y + (dy / d) * 220;
    }
  }
  if (!flee && mote) {
    tx = mote.x;
    ty = mote.y;
  }
  const mx = tx - player.x;
  const my = ty - player.y;
  const len = Math.hypot(mx, my) || 1;
  const move = len < 12 ? { x: 0, y: 0 } : { x: mx / len, y: my / len };
  const aim = foe ? { x: foe.x, y: foe.y } : { x: player.x, y: player.y - 100 };
  return { move, aim, firing: foe !== null, dash: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. The win scene jumps straight to wave 10 and lets
 * the bold pilot fight the Herald; the end scene lets a timid pilot play
 * until the light goes out.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    world.reset();
    state.waveState = 'title';
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 300 }, false, false, true);
    }
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'win') {
    world.startGame();
    world.startWave(10);
    // A duel, not a crowd: clear the small fry so every bolt meets the boss.
    state.spawnQueue.length = 0;
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      for (const e of state.enemies) {
        if (e.active && e.kind !== KIND_HERALD) e.active = false;
      }
      state.player.energy = 100;
      const pilot = autopilot(state, true);
      const events = world.step(STEP, pilot.move, pilot.aim, pilot.firing, pilot.dash, false);
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
    }
    return { screen: state.waveState === 'won' ? SCREEN_WIN : SCREEN_PLAY, best: Math.max(1250, state.score) };
  }
  // play or end: a real game from wave 1.
  world.startGame();
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const bold = name !== 'end';
  if (name === 'play') {
    // Stop mid-fight, while the field is busy: wave 5 or later, the wave
    // still going, and several shadows on screen — never in a lull between
    // waves, when the field is empty. Later waves spawn faster and brutes
    // take several hits, so the field actually stays crowded.
    for (let i = 0; i < limit / STEP; i += 1) {
      const pilot = autopilot(state, bold);
      const events = world.step(STEP, pilot.move, pilot.aim, pilot.firing, pilot.dash, false);
      if (events & EVENT_OVER) break;
      if (i > 20 / STEP && state.wave >= 5 && state.waveState === 'fighting') {
        let count = 0;
        for (const e of state.enemies) if (e.active) count += 1;
        if (count >= 5) break;
      }
    }
    // If the loop ended in a between-wave lull, play on into the next wave.
    for (let i = 0; i < 10 / STEP && state.waveState === 'between'; i += 1) {
      const pilot = autopilot(state, bold);
      world.step(STEP, pilot.move, pilot.aim, pilot.firing, pilot.dash, false);
    }
    const over = state.waveState === 'over';
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(1250, state.score) };
  }
  for (let i = 0; i < limit / STEP; i += 1) {
    const pilot = autopilot(state, bold);
    const events = world.step(STEP, pilot.move, pilot.aim, pilot.firing, pilot.dash, false);
    if (events & EVENT_OVER) break;
  }
  const over = state.waveState === 'over';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(1250, state.score) };
}

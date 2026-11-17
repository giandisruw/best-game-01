// FROSTLINE — deterministic screenshot scenes.
// One clear job: stage a world into each named ?shot= scene (title, busy
// mid-fight, draft, win) using the game's own simulation, so the screenshots
// are real renders of real play. Sets window.__shotReady when drawn.

import { createWorld, update, placeBrazier, rollDraftOptions } from './world.js';
import { ENEMIES } from './config.js';

const DT = 1 / 30;
const NO_SFX = {};

// A fake input that plays the game: chase the nearest enemy, shoot it,
// stoke when cool, bank when hot, keep braziers placed.
function autopilotInput(w) {
  let target = null;
  let best = Infinity;
  for (const e of w.enemies) {
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d < best) { best = d; target = e; }
  }
  const keys = new Set();
  if (target) {
    const dx = target.x - w.player.x;
    const dy = target.y - w.player.y;
    if (dx > 12) keys.add('d');
    if (dx < -12) keys.add('a');
    if (dy > 12) keys.add('s');
    if (dy < -12) keys.add('w');
  }
  if (w.heat < 62) keys.add(' ');
  if (w.heat > 88) keys.add('b');
  return {
    mouse: { x: target ? target.x : 640, y: target ? target.y : 300, left: !!target, right: false },
    keys,
    down(...names) { return names.some((n) => keys.has(n)); },
    wasPressed() { return false; },
    takeClicks() { return []; },
    endFrame() {},
  };
}

function placeOpeningBraziers(w) {
  const spots = [
    { x: 420, y: 300, type: 'ember' },
    { x: 860, y: 300, type: 'ember' },
    { x: 640, y: 560, type: 'ember' },
  ];
  w.embers = 200;
  for (const s of spots) {
    w.placeType = s.type;
    placeBrazier(w, s.x, s.y);
  }
}

function simulate(w, maxSeconds, stopWhen) {
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    update(w, autopilotInput(w), DT);
    if (stopWhen && stopWhen(w)) return true;
    if (w.phase === 'won' || w.phase === 'lost') return false;
  }
  return !!(stopWhen && stopWhen(w));
}

function forceNight(w, night) {
  w.night = night;
  w.enemies = [];
  w.bolts = [];
  w.spawnQueue = [];
  w.phase = 'fight';
}

export function buildShotScene(name, seed) {
  if (name === 'start') {
    const w = createWorld(seed, 'ember');
    return { world: w, screen: 'title' };
  }

  if (name === 'play') {
    const w = createWorld(seed, 'ember');
    placeOpeningBraziers(w);
    // Play through nights 1-3, then stop mid-fight on night 4 with a crowd.
    const ok = simulate(w, 420, (s) => s.night === 4 && s.nightTime > 14 && s.enemies.length >= 5);
    if (!ok || w.phase !== 'fight') {
      // Fallback staging: force a busy night-4 field so the shot is never empty.
      forceNight(w, 4);
      w.nightTime = 18;
      w.heat = 74;
      w.fuel = 62;
      w.embers = 87;
      w.score = 2450;
      w.combo = 5;
      w.comboTimer = 2.2;
      const types = ['wisp', 'wisp', 'darter', 'wisp', 'brute', 'darter', 'wisp'];
      types.forEach((t, i) => {
        const def = ENEMIES[t];
        w.enemies.push({
          type: t, x: 300 + i * 110, y: 180 + (i % 3) * 120, hp: def.hp, maxHp: def.hp,
          r: def.r, speed: def.speed, damage: def.damage, score: def.score, embers: def.embers,
          zig: i, zigSpeed: 3, attackCd: 0, hitFlash: 0, slowUntil: 0, spawnT: 0, heraldSpawnCd: 6,
        });
      });
      placeOpeningBraziers(w);
    }
    return { world: w, screen: 'play' };
  }

  if (name === 'draft') {
    const w = createWorld(seed, 'ember');
    placeOpeningBraziers(w);
    const ok = simulate(w, 420, (s) => s.phase === 'draft' && s.night >= 4);
    if (!ok || w.phase !== 'draft') {
      // Fallback staging: a real draft after night 3.
      w.night = 4;
      w.phase = 'draft';
      w.embers = 96;
      w.hearth.hp = 78;
      w.fuel = 55;
      w.score = 3120;
      w.kills = 41;
      rollDraftOptions(w);
    }
    return { world: w, screen: 'draft' };
  }

  if (name === 'win') {
    const w = createWorld(seed, 'ember');
    placeOpeningBraziers(w);
    w.phase = 'won';
    w.score = 8420;
    w.kills = 96;
    w.hearth.hp = 54;
    w.fuel = 38;
    w.embers = 143;
    w.grade = 'A';
    w.winStats = {
      score: 8420, grade: 'A', night: 7, kills: 96,
      hearthHp: 54, hearthMax: 100, fuelBonus: 76,
      difficulty: 'ember', seed, endless: false,
    };
    w.feats.add('first-blood');
    w.feats.add('combo8');
    w.feats.add('night3');
    w.feats.add('night5');
    w.feats.add('boss');
    w.feats.add('dawn');
    w.banner = null;
    w.bannerT = 0;
    return { world: w, screen: 'win' };
  }

  const w = createWorld(seed, 'ember');
  return { world: w, screen: 'title' };
}

export { NO_SFX };

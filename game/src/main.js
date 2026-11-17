// FROSTLINE — main loop and screens.
// One clear job: own the canvas, the screen state machine, the meta layer
// (best score, run history, feats, endless unlock, same-seed replay) and the
// wiring between input, world, render and audio. Rules live in world.js.

import { VIEW_W, VIEW_H, FEATS } from './config.js';
import { createWorld, update, placeBrazier, applyDraft, buyShop, useAbility, startNight } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  LAYOUT, drawField, drawHud, drawTitle, drawHowTo, drawDraft,
  drawWin, drawLose, drawPause, inRect,
} from './render.js';
import { buildShotScene } from './shots.js';

const META_KEY = 'frostline-meta-v1';
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const input = createInput(canvas);
const audio = createAudio();

function loadMeta() {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return { bestScore: 0, runs: [], feats: [], endlessUnlocked: false, lastSeed: 7 };
    const m = JSON.parse(raw);
    return {
      bestScore: m.bestScore || 0,
      runs: Array.isArray(m.runs) ? m.runs : [],
      feats: Array.isArray(m.feats) ? m.feats : [],
      endlessUnlocked: !!m.endlessUnlocked,
      lastSeed: m.lastSeed || 7,
    };
  } catch {
    return { bestScore: 0, runs: [], feats: [], endlessUnlocked: false, lastSeed: 7 };
  }
}

function saveMeta(meta) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Private mode or blocked storage: the game still plays.
  }
}

const meta = loadMeta();

function newSeed() {
  return (Math.random() * 2147483646 + 1) | 0;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));
const shotMode = !!shotName;

let screen = 'title';
let difficulty = 'ember';
let world = null;
let isNewBest = false;
let statusText = '';
let lastStatusAt = 0;

function setStatus(s) {
  statusText = s;
  statusEl.textContent = s;
}

function startRun(seed, diff, endless) {
  world = createWorld(seed, diff);
  world.endless = !!endless;
  if (endless) {
    world.night = 8;
    startNight(world);
  }
  screen = 'play';
  isNewBest = false;
  setStatus(`Night 1. Keep the hearth burning. Heat ${Math.round(world.heat)} degrees.`);
  audio.unlock();
}

function backToTitle() {
  // Keep a title backdrop world so the title screen is never empty.
  world = createWorld(meta.lastSeed, difficulty);
  screen = 'title';
  setStatus('Frostline title screen. Choose a difficulty and light the hearth.');
}

function recordRun(result) {
  const run = { night: world.night, score: world.score, result, difficulty: world.difficulty };
  meta.runs.unshift(run);
  meta.runs = meta.runs.slice(0, 3);
  for (const f of world.feats) {
    if (!meta.feats.includes(f)) meta.feats.push(f);
  }
  if (result === 'WIN') {
    meta.endlessUnlocked = true;
    if (world.score > meta.bestScore) {
      meta.bestScore = world.score;
      isNewBest = true;
    }
  } else if (world.score > meta.bestScore) {
    meta.bestScore = world.score;
  }
  meta.lastSeed = world.seed;
  saveMeta(meta);
}

function handleWorldEvents() {
  if (!world) return;
  for (const ev of world.events) {
    if (ev === 'shoot') audio.shoot();
    else if (ev === 'brazierShot') audio.brazierShot();
    else if (ev === 'kill') audio.kill();
    else if (ev === 'hit') audio.hit();
    else if (ev === 'place') audio.place();
    else if (ev === 'denied') audio.denied();
    else if (ev === 'stoke') audio.stoke();
    else if (ev === 'freeze') audio.freeze();
    else if (ev === 'burst') audio.burst();
    else if (ev === 'ward') audio.ward();
    else if (ev === 'draft') audio.draft();
    else if (ev === 'coin') audio.coin();
    else if (ev === 'nightClear') audio.nightClear();
    else if (ev === 'boss') audio.boss();
    else if (ev === 'win') audio.win();
    else if (ev === 'lose') audio.lose();
    else if (ev.startsWith('feat:')) {
      const feat = FEATS.find((f) => f.id === ev.slice(5));
      if (feat) setStatus(`Feat unlocked: ${feat.name} — ${feat.desc}`);
    }
  }
  world.events.length = 0;
  if (world.phase === 'won' && screen === 'play') {
    recordRun('WIN');
    screen = 'win';
    setStatus(`Dawn breaks — the hearth endures. Grade ${world.grade}. Score ${world.score}.`);
  } else if (world.phase === 'lost' && screen === 'play') {
    recordRun('LOST');
    screen = 'lose';
    setStatus(`The frost takes the hearth on night ${world.night}. Score ${world.score}.`);
  } else if (world.phase === 'draft' && screen === 'play') {
    screen = 'draft';
    setStatus(`Night ${world.night - 1} cleared. Choose a draft card, then face night ${world.night}.`);
  }
}

function clickIn(rect, clicks) {
  return clicks.find((c) => inRect(c.x, c.y, rect));
}

// --- Screen handlers (one per screen, called once per frame) ---

function titleFrame(clicks) {
  if (input.wasPressed('h')) { screen = 'howto'; return; }
  if (input.wasPressed('1')) difficulty = 'ember';
  if (input.wasPressed('2')) difficulty = 'blizzard';
  if (clickIn(LAYOUT.title.ember, clicks)) difficulty = 'ember';
  if (clickIn(LAYOUT.title.blizzard, clicks)) difficulty = 'blizzard';
  if (clickIn(LAYOUT.title.howto, clicks)) { screen = 'howto'; return; }
  if (clickIn(LAYOUT.title.start, clicks) || input.wasPressed(' ', 'enter')) {
    startRun(newSeed(), difficulty, false);
  }
}

function howtoFrame(clicks) {
  if (clickIn(LAYOUT.howto.back, clicks) || input.wasPressed('h', 'escape')) screen = 'title';
}

function playFrame(clicks, dt) {
  if (input.wasPressed('p', 'escape')) { screen = 'pause'; return; }
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    setStatus(muted ? 'Sound muted.' : 'Sound on.');
  }
  if (input.wasPressed('r')) { startRun(newSeed(), difficulty, false); return; }
  if (input.wasPressed('q')) {
    world.placeMode = !world.placeMode;
    if (world.placeMode) {
      const types = ['ember', 'longflame', 'cinderburst'];
      const owned = types.filter((t) => t === 'ember' || world.granted[t === 'longflame' ? 'longflame' : 'cinder']);
      const idx = owned.indexOf(world.placeType);
      world.placeType = owned[(idx + 1) % owned.length];
    }
  }
  if (input.wasPressed('1')) useAbility(world, 'burst');
  if (input.wasPressed('2')) useAbility(world, 'ward');
  for (const c of clicks) {
    if (c.button === 2) { world.placeMode = false; continue; }
    if (inRect(c.x, c.y, LAYOUT.abilities.burst)) { useAbility(world, 'burst'); continue; }
    if (inRect(c.x, c.y, LAYOUT.abilities.ward)) { useAbility(world, 'ward'); continue; }
    if (inRect(c.x, c.y, LAYOUT.abilities.place)) {
      world.placeMode = !world.placeMode;
      continue;
    }
    if (world.placeMode && c.button === 0) {
      placeBrazier(world, c.x, c.y);
      if (world.embers < 25 && world.freeBraziers === 0) world.placeMode = false;
    }
  }
  update(world, input, dt);
  handleWorldEvents();
  // Hearth HP / frost status, throttled so the live region stays quiet.
  const now = performance.now();
  if (now - lastStatusAt > 4000) {
    lastStatusAt = now;
    setStatus(`Night ${world.night}. Hearth ${Math.ceil(world.hearth.hp)} HP, heat ${Math.round(world.heat)}, ${Math.floor(world.embers)} embers, score ${world.score}.`);
  }
}

function draftFrame(clicks) {
  if (input.wasPressed('1') && world.draftOptions[0]) applyDraft(world, world.draftOptions[0].id);
  if (input.wasPressed('2') && world.draftOptions[1]) applyDraft(world, world.draftOptions[1].id);
  if (input.wasPressed('3') && world.draftOptions[2]) applyDraft(world, world.draftOptions[2].id);
  for (const c of clicks) {
    let handled = false;
    world.draftOptions.forEach((card, i) => {
      if (inRect(c.x, c.y, LAYOUT.draft.cards[i])) { applyDraft(world, card.id); handled = true; }
    });
    if (handled) continue;
    const shopIds = ['fuel', 'heal', 'brazier', 'reroll', 'upgrade'];
    shopIds.forEach((id, i) => {
      if (inRect(c.x, c.y, LAYOUT.draft.shop[i])) buyShop(world, id);
    });
    if (inRect(c.x, c.y, LAYOUT.draft.continue) && world.draftPicked) {
      world.shopLog = [];
      startNight(world);
      screen = 'play';
      setStatus(`Night ${world.night}. The frost returns.`);
    }
  }
  handleWorldEvents();
}

function pauseFrame(clicks) {
  if (input.wasPressed('p', 'escape')) { screen = 'play'; return; }
  if (input.wasPressed('r')) { startRun(newSeed(), difficulty, false); return; }
  if (clickIn(LAYOUT.pause.resume, clicks)) screen = 'play';
  else if (clickIn(LAYOUT.pause.restart, clicks)) startRun(newSeed(), difficulty, false);
  else if (clickIn(LAYOUT.pause.quit, clicks)) backToTitle();
}

function winFrame(clicks) {
  if (input.wasPressed('r', ' ')) { startRun(newSeed(), difficulty, false); return; }
  for (const c of clicks) {
    if (inRect(c.x, c.y, LAYOUT.win.endless)) {
      world.endless = true;
      world.night = 8;
      startNight(world);
      screen = 'play';
      setStatus('Endless mode. The frost never stops.');
      return;
    }
    if (inRect(c.x, c.y, LAYOUT.win.replay)) { startRun(world.seed, difficulty, false); return; }
    if (inRect(c.x, c.y, LAYOUT.win.title)) { backToTitle(); return; }
  }
}

function loseFrame(clicks) {
  if (input.wasPressed('r', ' ')) { startRun(newSeed(), difficulty, false); return; }
  if (clickIn(LAYOUT.lose.restart, clicks)) startRun(newSeed(), difficulty, false);
}

// --- Setup ---

if (shotMode) {
  const scene = buildShotScene(shotName, Number.isFinite(seedParam) ? seedParam : 7);
  world = scene.world;
  screen = scene.screen;
  if (screen === 'win') {
    isNewBest = true;
    meta.bestScore = Math.max(meta.bestScore, world.score);
  }
} else {
  backToTitle();
}
setStatus('Frostline. Keep the hearth burning through seven nights.');

window.addEventListener('keydown', () => audio.unlock(), { once: true });
window.addEventListener('mousedown', () => audio.unlock(), { once: true });

// Exposed for the playtest harness and the shot scenes.
window.__frostline = {
  get screen() { return screen; },
  get world() { return world; },
  get meta() { return meta; },
  get difficulty() { return difficulty; },
};

let lastT = performance.now();
let frames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  const clicks = input.takeClicks();

  ctx.save();
  if (world && world.shake > 0 && screen === 'play') {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  if (screen === 'title') drawTitle(ctx, world, meta, difficulty, now / 1000);
  else if (screen === 'howto') drawHowTo(ctx);
  else if (screen === 'play') {
    drawField(ctx, world, now / 1000);
    drawHud(ctx, world, meta);
  } else if (screen === 'draft') drawDraft(ctx, world, meta);
  else if (screen === 'pause') {
    drawField(ctx, world, now / 1000);
    drawHud(ctx, world, meta);
    drawPause(ctx);
  } else if (screen === 'win') drawWin(ctx, world, meta, isNewBest);
  else if (screen === 'lose') drawLose(ctx, world, meta);
  ctx.restore();

  if (!shotMode) {
    if (screen === 'title') titleFrame(clicks);
    else if (screen === 'howto') howtoFrame(clicks);
    else if (screen === 'play') playFrame(clicks, dt);
    else if (screen === 'draft') draftFrame(clicks);
    else if (screen === 'pause') pauseFrame(clicks);
    else if (screen === 'win') winFrame(clicks);
    else if (screen === 'lose') loseFrame(clicks);
  } else {
    // Shot scenes are staged, not played: one rendered frame is the shot.
    frames += 1;
    if (frames >= 2) window.__shotReady = true;
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

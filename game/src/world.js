// FROSTLINE — world rules, no DOM.
// One clear job: the whole simulation — heat dial, frost creep, braziers,
// enemies, nights, draft, shop, abilities, score, feats. Render reads this
// state; input and audio stay outside.

import {
  VIEW_W, VIEW_H, HEARTH, HEAT, FROST, PLAYER, BRAZIERS, ENEMIES,
  NIGHTS, DIFFICULTIES, DRAFT_POOL, SHOP_ITEMS, FEATS, ABILITIES,
  COMBO_WINDOW, COMBO_MAX, gradeFor,
} from './config.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(seed, difficultyKey) {
  const rng = makeRng(seed);
  const diff = DIFFICULTIES[difficultyKey] || DIFFICULTIES.ember;

  // Terrain dressing, fixed by the seed so replays look identical.
  const decor = { pines: [], stones: [], drifts: [] };
  for (let i = 0; i < 46; i += 1) {
    const x = rng.range(30, VIEW_W - 30);
    const y = rng.range(30, VIEW_H - 30);
    if (dist2(x, y, HEARTH.x, HEARTH.y) < 120 * 120) continue;
    decor.pines.push({ x, y, s: rng.range(0.7, 1.4), w: rng.range(0, TAU) });
  }
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(24, VIEW_W - 24);
    const y = rng.range(24, VIEW_H - 24);
    if (dist2(x, y, HEARTH.x, HEARTH.y) < 110 * 110) continue;
    decor.stones.push({ x, y, r: rng.range(4, 11) });
  }
  for (let i = 0; i < 34; i += 1) {
    decor.drifts.push({ x: rng.range(20, VIEW_W - 20), y: rng.range(20, VIEW_H - 20), rx: rng.range(18, 60), ry: rng.range(6, 16) });
  }

  const w = {
    seed,
    difficulty: difficultyKey,
    rng,
    diff,
    time: 0,
    phase: 'fight', // fight | draft | won | lost
    night: 1,
    endless: false,
    nightTime: 0,
    nightDuration: NIGHTS[0].duration,
    spawnQueue: [],
    spawnTimer: 0,
    spawnInterval: NIGHTS[0].trickle,
    hearth: { hp: diff.hp, maxHp: diff.hp },
    heat: HEAT.start,
    fuel: diff.fuel,
    maxFuel: 100,
    embers: diff.embers,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    frostLevel: 0,
    frost: new Float32Array(FROST.cols * FROST.rows),
    player: { x: HEARTH.x, y: HEARTH.y + 150, fireCd: 0, aimX: HEARTH.x, aimY: HEARTH.y - 100 },
    braziers: [],
    freeBraziers: 0,
    enemies: [],
    bolts: [],
    particles: [],
    floaters: [],
    mods: {
      brazierDamage: 1, extraShot: 0, stokeSpeed: 1, bankEmbers: false,
      burstCdMul: 1, lightRadiusMul: 1, slowShots: false, brazierRange: 1,
      brazierRate: 1, secondWind: false, secondWindUsed: false,
    },
    granted: { longflame: false, cinder: false },
    draftOptions: [],
    draftPicked: null,
    shopLog: [],
    abilities: { burst: { cd: 0 }, ward: { cd: 0 } },
    wardUntil: 0,
    shake: 0,
    banner: null,
    bannerT: 0,
    events: [],
    feats: new Set(),
    overheatedThisNight: false,
    placeMode: false,
    placeType: 'ember',
    stats: { shots: 0, placed: 0, drafted: 0 },
    grade: null,
    winStats: null,
    decor,
    frostTick: 0,
  };

  // Frost starts at the map edges, already creeping in.
  for (let r = 0; r < FROST.rows; r += 1) {
    for (let c = 0; c < FROST.cols; c += 1) {
      const edge = Math.min(c, FROST.cols - 1 - c, r, FROST.rows - 1 - r);
      w.frost[r * FROST.cols + c] = edge === 0 ? 0.85 : edge === 1 ? 0.4 : 0;
    }
  }

  startNight(w);
  return w;
}

function nightConfig(w, n) {
  if (n <= 7) return NIGHTS[n - 1];
  // Endless nights: the campaign's last night, scaled up each night.
  const scale = 1 + (n - 7) * 0.3;
  const spawn = [
    ['wisp', Math.round(16 * scale)],
    ['darter', Math.round(12 * scale)],
    ['brute', Math.round(5 * scale)],
  ];
  if (n % 7 === 0) spawn.push(['herald', 1]);
  return { night: n, duration: 70, spawn, trickle: Math.max(1.1, 1.7 - (n - 7) * 0.05) };
}

function startNight(w) {
  const cfg = nightConfig(w, w.night);
  w.nightDuration = cfg.duration;
  w.nightTime = 0;
  w.spawnInterval = cfg.trickle;
  w.spawnTimer = 1.2;
  w.spawnQueue = [];
  for (const [type, count] of cfg.spawn) {
    for (let i = 0; i < count; i += 1) w.spawnQueue.push(type);
  }
  w.spawnQueue = w.rng.shuffle(w.spawnQueue);
  w.overheatedThisNight = false;
  w.phase = 'fight';
  const isBoss = cfg.spawn.some(([t]) => t === 'herald');
  w.banner = isBoss
    ? { title: `NIGHT ${w.night} — THE WHITEOUT HERALD`, sub: 'A great cold walks the field. Keep the hearth burning.' }
    : { title: `NIGHT ${w.night}`, sub: w.night === 1 ? 'The frost is coming. Stoke the hearth, place braziers.' : 'Hold the line until dawn.' };
  w.bannerT = 3;
  if (isBoss) w.events.push('boss');
}

export function lightRadius(w) {
  return (HEAT.lightRadiusBase + w.heat * HEAT.lightRadiusPerHeat) * w.mods.lightRadiusMul;
}

function brazierRateMul(w) {
  const t = w.heat / 100;
  return (HEAT.brazierRateMin + (HEAT.brazierRateMax - HEAT.brazierRateMin) * t) * w.mods.brazierRate;
}

function spawnEnemy(w, type) {
  const def = ENEMIES[type];
  // Spawn on a random edge, outside the lit ground.
  const side = w.rng.int(0, 3);
  let x;
  let y;
  if (side === 0) { x = w.rng.range(20, VIEW_W - 20); y = 16; }
  else if (side === 1) { x = w.rng.range(20, VIEW_W - 20); y = VIEW_H - 16; }
  else if (side === 2) { x = 16; y = w.rng.range(20, VIEW_H - 20); }
  else { x = VIEW_W - 16; y = w.rng.range(20, VIEW_H - 20); }
  const hp = def.hp * w.diff.enemyHp * (w.endless ? 1 + (w.night - 7) * 0.12 : 1);
  w.enemies.push({
    type, x, y, hp, maxHp: hp, r: def.r,
    speed: def.speed * w.diff.enemySpeed,
    damage: def.damage,
    score: def.score, embers: def.embers,
    zig: w.rng.range(0, TAU), zigSpeed: w.rng.range(2.2, 3.6),
    attackCd: 0, hitFlash: 0, slowUntil: 0, spawnT: 0, heraldSpawnCd: 6,
  });
}

function burstParticles(w, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = w.rng.range(0, TAU);
    const s = w.rng.range(speed * 0.3, speed);
    w.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: w.rng.range(0.3, 0.8), maxLife: 0.8, color,
      size: w.rng.range(2, 5),
    });
  }
}

function addFloater(w, x, y, text, color) {
  w.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function unlockFeat(w, id) {
  if (!w.feats.has(id)) {
    w.feats.add(id);
    w.events.push('feat:' + id);
  }
}

function killEnemy(w, enemy, index) {
  w.enemies.splice(index, 1);
  w.kills += 1;
  w.combo = Math.min(w.combo + 1, COMBO_MAX);
  w.comboTimer = COMBO_WINDOW;
  const mult = Math.max(1, w.combo);
  const gained = enemy.score * mult;
  w.score += gained;
  w.embers += enemy.embers;
  addFloater(w, enemy.x, enemy.y - enemy.r, `+${gained}  x${mult}`, '#ffd166');
  burstParticles(w, enemy.x, enemy.y, '#bfe3ff', 14, 160);
  burstParticles(w, enemy.x, enemy.y, '#ff9a3c', 8, 110);
  w.events.push('kill');
  if (w.kills === 1) unlockFeat(w, 'first-blood');
  if (w.combo >= COMBO_MAX) unlockFeat(w, 'combo8');
  if (w.embers >= 150) unlockFeat(w, 'rich');
  if (enemy.type === 'herald') {
    unlockFeat(w, 'boss');
    w.shake = 14;
    burstParticles(w, enemy.x, enemy.y, '#ffffff', 60, 320);
    if (w.night === 7 && !w.endless) {
      winRun(w);
    } else {
      w.banner = { title: 'THE HERALD SHATTERS', sub: 'The cold retreats — for now.' };
      w.bannerT = 3;
    }
  }
}

function damageHearth(w, amount, source) {
  if (w.phase !== 'fight') return;
  if (w.mods.secondWind && !w.mods.secondWindUsed && w.hearth.hp - amount <= 0) {
    w.mods.secondWindUsed = true;
    w.hearth.hp = 1;
    w.banner = { title: 'SECOND WIND', sub: 'The hearth refuses to go out — once.' };
    w.bannerT = 2.5;
    w.events.push('ward');
    return;
  }
  w.hearth.hp -= amount;
  w.shake = Math.max(w.shake, 5);
  if (w.hearth.hp <= 0) {
    w.hearth.hp = 0;
    loseRun(w, source || 'The frost takes the hearth');
  }
}

function winRun(w) {
  w.phase = 'won';
  w.grade = gradeFor(w.score, w.hearth.hp, w.hearth.maxHp, w.difficulty);
  const fuelBonus = Math.round(w.fuel * 2);
  w.score += fuelBonus;
  w.winStats = {
    score: w.score, grade: w.grade, night: w.night, kills: w.kills,
    hearthHp: w.hearth.hp, hearthMax: w.hearth.maxHp, fuelBonus,
    difficulty: w.difficulty, seed: w.seed, endless: w.endless,
  };
  unlockFeat(w, 'dawn');
  w.events.push('win');
}

function loseRun(w, reason) {
  w.phase = 'lost';
  w.loseReason = reason;
  w.events.push('lose');
}

function rollDraftOptions(w) {
  const pool = DRAFT_POOL.filter((c) => {
    if (c.id === 'longflame-kit' && w.granted.longflame) return false;
    if (c.id === 'cinder-kit' && w.granted.cinder) return false;
    if (c.id === 'second-wind' && w.mods.secondWind) return false;
    return true;
  });
  w.draftOptions = w.rng.shuffle(pool).slice(0, 3);
  w.draftPicked = null;
}

export function applyDraft(w, cardId) {
  const card = w.draftOptions.find((c) => c.id === cardId);
  if (!card || w.draftPicked) return false;
  w.draftPicked = cardId;
  w.stats.drafted += 1;
  const m = w.mods;
  switch (card.apply) {
    case 'brazierDamage': m.brazierDamage *= 1.25; break;
    case 'extraShot': m.extraShot += 1; break;
    case 'grantLongflame': w.granted.longflame = true; w.freeBraziers += 1; w.placeType = 'longflame'; break;
    case 'grantCinder': w.granted.cinder = true; w.freeBraziers += 1; w.placeType = 'cinderburst'; break;
    case 'maxFuel': w.maxFuel += 40; w.fuel = Math.min(w.maxFuel, w.fuel + 40); break;
    case 'embersNow': w.embers += 30; break;
    case 'maxHp': w.hearth.maxHp += 25; w.hearth.hp = Math.min(w.hearth.maxHp, w.hearth.hp + 25); break;
    case 'stokeSpeed': m.stokeSpeed *= 1.5; break;
    case 'bankEmbers': m.bankEmbers = true; break;
    case 'burstCooldown': m.burstCdMul *= 0.5; break;
    case 'lightRadius': m.lightRadiusMul *= 1.35; break;
    case 'slowShots': m.slowShots = true; break;
    case 'brazierRange': m.brazierRange *= 1.2; m.brazierRate *= 1.15; break;
    case 'secondWind': m.secondWind = true; break;
    default: break;
  }
  w.events.push('draft');
  return true;
}

export function buyShop(w, itemId) {
  const item = SHOP_ITEMS.find((s) => s.id === itemId);
  if (!item || w.embers < item.cost) {
    w.events.push('denied');
    return false;
  }
  if (itemId === 'reroll') {
    w.embers -= item.cost;
    rollDraftOptions(w);
    w.shopLog.push('Rerolled the draft.');
    w.events.push('coin');
    return true;
  }
  w.embers -= item.cost;
  switch (itemId) {
    case 'fuel': w.fuel = Math.min(w.maxFuel, w.fuel + 45); break;
    case 'heal': w.hearth.hp = Math.min(w.hearth.maxHp, w.hearth.hp + 25); break;
    case 'brazier': w.freeBraziers += 1; break;
    case 'upgrade': {
      if (w.braziers.length === 0) { w.embers += item.cost; w.events.push('denied'); return false; }
      const b = w.rng.pick(w.braziers);
      b.level += 1;
      break;
    }
    default: break;
  }
  w.shopLog.push(`Bought ${item.name}.`);
  w.events.push('coin');
  return true;
}

export function placeBrazier(w, x, y) {
  const type = BRAZIERS[w.placeType];
  const cost = w.freeBraziers > 0 ? 0 : type.cost;
  if (w.embers < cost) { w.events.push('denied'); return false; }
  if (dist2(x, y, HEARTH.x, HEARTH.y) < 95 * 95) { w.events.push('denied'); return false; }
  if (x < 30 || x > VIEW_W - 30 || y < 30 || y > VIEW_H - 30) { w.events.push('denied'); return false; }
  for (const b of w.braziers) {
    if (dist2(x, y, b.x, b.y) < 44 * 44) { w.events.push('denied'); return false; }
  }
  if (w.freeBraziers > 0) w.freeBraziers -= 1;
  else w.embers -= cost;
  w.braziers.push({ x, y, type: w.placeType, level: 1, cd: 0.2, flash: 0 });
  w.stats.placed += 1;
  burstParticles(w, x, y, '#ffb347', 16, 120);
  w.events.push('place');
  return true;
}

export function useAbility(w, name) {
  if (w.phase !== 'fight') return false;
  if (name === 'burst') {
    if (w.abilities.burst.cd > 0) { w.events.push('denied'); return false; }
    w.abilities.burst.cd = ABILITIES.burst.cooldown * w.mods.burstCdMul;
    const { x, y } = w.player;
    burstParticles(w, x, y, '#ff9a3c', 40, 320);
    w.shake = Math.max(w.shake, 7);
    for (let i = w.enemies.length - 1; i >= 0; i -= 1) {
      const e = w.enemies[i];
      if (dist2(e.x, e.y, x, y) < ABILITIES.burst.radius * ABILITIES.burst.radius) {
        e.hp -= ABILITIES.burst.damage;
        e.hitFlash = 0.15;
        addFloater(w, e.x, e.y - e.r, `-${ABILITIES.burst.damage}`, '#ff9a3c');
        if (e.hp <= 0) killEnemy(w, e, i);
      }
    }
    w.events.push('burst');
    return true;
  }
  if (name === 'ward') {
    if (w.abilities.ward.cd > 0) { w.events.push('denied'); return false; }
    w.abilities.ward.cd = ABILITIES.ward.cooldown;
    w.wardUntil = w.time + ABILITIES.ward.duration;
    w.events.push('ward');
    return true;
  }
  return false;
}

function updateFrost(w, dt) {
  w.frostTick += dt;
  if (w.frostTick < 0.12) return;
  const step = w.frostTick;
  w.frostTick = 0;
  const lr = lightRadius(w);
  const lr2 = lr * lr;
  let sum = 0;
  for (let r = 0; r < FROST.rows; r += 1) {
    for (let c = 0; c < FROST.cols; c += 1) {
      const i = r * FROST.cols + c;
      const cx = (c + 0.5) * FROST.cell;
      const cy = (r + 0.5) * FROST.cell;
      let f = w.frost[i];
      // Warmth from the hearth and from hot braziers melts frost.
      let warm = dist2(cx, cy, HEARTH.x, HEARTH.y) < lr2;
      if (!warm) {
        for (const b of w.braziers) {
          const br = 64 + w.heat * 0.55;
          if (dist2(cx, cy, b.x, b.y) < br * br) { warm = true; break; }
        }
      }
      if (warm) {
        f -= FROST.meltPerSec * step;
      } else {
        // Creep: frozen neighbours and the map edge pull the frost in.
        let neighbour = 0;
        if (c > 0) neighbour = Math.max(neighbour, w.frost[i - 1]);
        if (c < FROST.cols - 1) neighbour = Math.max(neighbour, w.frost[i + 1]);
        if (r > 0) neighbour = Math.max(neighbour, w.frost[i - FROST.cols]);
        if (r < FROST.rows - 1) neighbour = Math.max(neighbour, w.frost[i + FROST.cols]);
        const edge = Math.min(c, FROST.cols - 1 - c, r, FROST.rows - 1 - r) === 0 ? 1 : 0;
        const pull = Math.max(neighbour * 0.9, edge ? 1 : 0);
        f += FROST.spreadPerSec * w.diff.frostSpread * step * (0.35 + pull);
      }
      f = Math.max(0, Math.min(1, f));
      w.frost[i] = f;
      sum += f;
    }
  }
  w.frostLevel = (sum / (FROST.cols * FROST.rows)) * 100;
}

function frostNearHearth(w) {
  let worst = 0;
  for (let r = 0; r < FROST.rows; r += 1) {
    for (let c = 0; c < FROST.cols; c += 1) {
      const cx = (c + 0.5) * FROST.cell;
      const cy = (r + 0.5) * FROST.cell;
      if (dist2(cx, cy, HEARTH.x, HEARTH.y) < FROST.touchRadius * FROST.touchRadius) {
        worst = Math.max(worst, w.frost[r * FROST.cols + c]);
      }
    }
  }
  return worst;
}

export function update(w, input, dt) {
  dt = Math.min(dt, 0.05);
  w.time += dt;
  if (w.bannerT > 0) w.bannerT -= dt;
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 26);
  for (const p of w.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
  }
  w.particles = w.particles.filter((p) => p.life > 0);
  for (const f of w.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  w.floaters = w.floaters.filter((f) => f.life > 0);
  if (w.phase !== 'fight') return;

  w.nightTime += dt;

  // --- Heat dial: stoke heats, bank cools, idle drifts toward lukewarm.
  const stoking = input.down(' ', 'shift');
  const banking = input.down('b') || input.mouse.right;
  if (stoking && w.fuel > 0) {
    w.heat += HEAT.stokeRate * w.mods.stokeSpeed * dt;
    if (w.rng.chance(dt * 6)) w.events.push('stoke');
  } else if (banking) {
    w.heat -= HEAT.bankRate * dt;
    if (w.mods.bankEmbers) w.embers += 2 * dt;
  } else {
    w.heat += (HEAT.driftTo - w.heat) * (HEAT.driftRate / 60) * dt * 10;
  }
  w.heat = Math.max(0, Math.min(100, w.heat));

  // Fuel burns faster the hotter the hearth runs.
  if (w.fuel > 0) {
    w.fuel -= (HEAT.fuelDrainBase + (w.heat / 100) * HEAT.fuelDrainHeat) * dt;
    if (w.fuel <= 0) {
      w.fuel = 0;
      w.banner = { title: 'OUT OF FUEL', sub: 'The hearth is starving — bank heat and survive.' };
      w.bannerT = 2.5;
    }
  }
  if (w.fuel <= 0) {
    w.heat += (8 - w.heat) * (HEAT.fuelEmptyHeatFall / 60) * dt * 10;
  }

  // Overheat burns the hearth itself.
  if (w.heat > HEAT.overheatAt) {
    w.overheatedThisNight = true;
    damageHearth(w, HEAT.overheatDps * dt, 'The hearth overheated');
    if (w.rng.chance(dt * 8)) {
      burstParticles(w, HEARTH.x + w.rng.range(-30, 30), HEARTH.y - 30, '#888888', 2, 40);
    }
  }

  updateFrost(w, dt);

  // Frost touching the hearth gnaws at it.
  const touch = frostNearHearth(w);
  if (touch > 0.6) {
    damageHearth(w, FROST.damagePerSec * touch * dt, 'The frost takes the hearth');
    if (w.rng.chance(dt * 4)) w.events.push('freeze');
  }

  // --- Player movement and kindling shots.
  const p = w.player;
  let mx = 0;
  let my = 0;
  if (input.down('w', 'arrowup')) my -= 1;
  if (input.down('s', 'arrowdown')) my += 1;
  if (input.down('a', 'arrowleft')) mx -= 1;
  if (input.down('d', 'arrowright')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.x = Math.max(24, Math.min(VIEW_W - 24, p.x + (mx / len) * PLAYER.speed * dt));
    p.y = Math.max(24, Math.min(VIEW_H - 24, p.y + (my / len) * PLAYER.speed * dt));
  }
  p.aimX = input.mouse.x;
  p.aimY = input.mouse.y;
  p.fireCd -= dt;
  if (input.mouse.left && !w.placeMode && p.fireCd <= 0 && input.mouse.y > 60 && input.mouse.y < 652) {
    const dx = p.aimX - p.x;
    const dy = p.aimY - p.y;
    const len = Math.hypot(dx, dy) || 1;
    w.bolts.push({
      x: p.x, y: p.y, vx: (dx / len) * PLAYER.boltSpeed, vy: (dy / len) * PLAYER.boltSpeed,
      dmg: PLAYER.boltDamage, aoe: 0, from: 'player', slow: w.mods.slowShots, life: 1.2,
    });
    p.fireCd = PLAYER.fireCooldown;
    w.stats.shots += 1;
    w.events.push('shoot');
  }

  // --- Spawning.
  if (w.spawnQueue.length > 0) {
    w.spawnTimer -= dt;
    if (w.spawnTimer <= 0) {
      spawnEnemy(w, w.spawnQueue.pop());
      w.spawnTimer = w.spawnInterval * w.rng.range(0.7, 1.3);
    }
  }

  // --- Braziers fire while warm.
  const rateMul = brazierRateMul(w);
  const lr = lightRadius(w);
  const lr2 = lr * lr;
  for (const b of w.braziers) {
    b.cd -= dt * rateMul;
    b.flash = Math.max(0, b.flash - dt);
    if (b.cd > 0) continue;
    const def = BRAZIERS[b.type];
    let target = null;
    let best = Infinity;
    for (const e of w.enemies) {
      const d2 = dist2(e.x, e.y, b.x, b.y);
      const range = def.range * w.mods.brazierRange;
      if (d2 < range * range && d2 < best) { best = d2; target = e; }
    }
    if (!target) continue;
    const shots = def.shots + w.mods.extraShot;
    const baseAngle = Math.atan2(target.y - b.y, target.x - b.x);
    for (let s = 0; s < shots; s += 1) {
      const spread = shots > 1 ? (s - (shots - 1) / 2) * 0.22 : 0;
      const a = baseAngle + spread;
      w.bolts.push({
        x: b.x, y: b.y - 14, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
        dmg: def.damage * w.mods.brazierDamage * (1 + (b.level - 1) * 0.35),
        aoe: def.aoe, from: 'brazier', slow: w.mods.slowShots, life: 1.4,
      });
    }
    b.cd = 1 / def.rate;
    b.flash = 0.12;
    w.events.push('brazierShot');
  }

  // --- Enemies: drift, zigzag, smash the hearth.
  const wardActive = w.time < w.wardUntil;
  for (let i = w.enemies.length - 1; i >= 0; i -= 1) {
    const e = w.enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.attackCd -= dt;
    // Lit ground burns frost creatures.
    if (dist2(e.x, e.y, HEARTH.x, HEARTH.y) < lr2) {
      e.hp -= HEAT.burnDps * dt;
      if (w.rng.chance(dt * 6)) {
        burstParticles(w, e.x, e.y, '#ff9a3c', 1, 60);
      }
      if (e.hp <= 0) { killEnemy(w, e, i); continue; }
    }
    const dx = HEARTH.x - e.x;
    const dy = HEARTH.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    let vx = (dx / d) * e.speed;
    let vy = (dy / d) * e.speed;
    if (e.type === 'darter') {
      e.zig += dt * e.zigSpeed;
      const px = -dy / d;
      const py = dx / d;
      vx += px * Math.sin(e.zig) * 70;
      vy += py * Math.sin(e.zig) * 70;
    }
    let slowMul = 1;
    if (wardActive) slowMul *= 0.5;
    if (w.time < e.slowUntil) slowMul *= 0.65;
    e.x += vx * slowMul * dt;
    e.y += vy * slowMul * dt;
    const reach = HEARTH.r + e.r + 4;
    if (d < reach) {
      if (e.attackCd <= 0) {
        e.attackCd = 1.0;
        damageHearth(w, e.damage, 'The frost takes the hearth');
        w.events.push('hit');
        burstParticles(w, HEARTH.x, HEARTH.y, '#bfe3ff', 8, 120);
      }
    }
    // The Herald calls wisps to its side.
    if (e.type === 'herald') {
      e.heraldSpawnCd -= dt;
      if (e.heraldSpawnCd <= 0) {
        e.heraldSpawnCd = 6;
        if (w.enemies.length < 14) spawnEnemy(w, 'wisp');
      }
    }
  }
  if (w.phase !== 'fight') return; // a kill or a hit may have ended the run

  // --- Bolts.
  for (let i = w.bolts.length - 1; i >= 0; i -= 1) {
    const b = w.bolts[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > VIEW_W || b.y < 0 || b.y > VIEW_H;
    if (!dead) {
      for (let j = w.enemies.length - 1; j >= 0; j -= 1) {
        const e = w.enemies[j];
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + 6) * (e.r + 6)) {
          e.hp -= b.dmg;
          e.hitFlash = 0.15;
          if (b.slow) e.slowUntil = w.time + 2;
          addFloater(w, e.x, e.y - e.r, `-${Math.round(b.dmg)}`, '#ffd166');
          burstParticles(w, b.x, b.y, '#ff9a3c', 5, 100);
          if (b.aoe > 0) {
            for (let k = w.enemies.length - 1; k >= 0; k -= 1) {
              if (k === j) continue;
              const o = w.enemies[k];
              if (dist2(o.x, o.y, b.x, b.y) < b.aoe * b.aoe) {
                o.hp -= b.dmg * 0.6;
                o.hitFlash = 0.15;
                if (o.hp <= 0) killEnemy(w, o, k);
              }
            }
          }
          if (e.hp <= 0) killEnemy(w, e, j);
          dead = true;
          break;
        }
      }
    }
    if (dead) w.bolts.splice(i, 1);
  }
  if (w.phase !== 'fight') return;

  // --- Combo decay.
  if (w.comboTimer > 0) {
    w.comboTimer -= dt;
    if (w.comboTimer <= 0) w.combo = 0;
  }

  // --- Ability cooldowns.
  w.abilities.burst.cd = Math.max(0, w.abilities.burst.cd - dt);
  w.abilities.ward.cd = Math.max(0, w.abilities.ward.cd - dt);

  // Hearth glow ember drift (ambience particles).
  if (w.rng.chance(dt * 20)) {
    const a = w.rng.range(0, TAU);
    const r = w.rng.range(10, 50);
    w.particles.push({
      x: HEARTH.x + Math.cos(a) * r, y: HEARTH.y + Math.sin(a) * r * 0.6,
      vx: w.rng.range(-6, 6), vy: w.rng.range(-46, -18),
      life: w.rng.range(0.6, 1.4), maxLife: 1.4, color: '#ffb347', size: w.rng.range(1.5, 3),
    });
  }

  // --- Night clear: queue empty, field empty.
  if (w.spawnQueue.length === 0 && w.enemies.length === 0) {
    const clearBonus = 150 + w.night * 100;
    w.score += clearBonus;
    w.embers += 12 + w.night * 3;
    if (w.night === 3) unlockFeat(w, 'night3');
    if (w.night === 5) unlockFeat(w, 'night5');
    if (!w.overheatedThisNight) unlockFeat(w, 'no-burn');
    if (w.night >= 7 && !w.endless) return; // boss death already won the run
    w.events.push('nightClear');
    w.night += 1;
    rollDraftOptions(w);
    w.phase = 'draft';
    w.banner = { title: `NIGHT ${w.night - 1} CLEARED  +${clearBonus}`, sub: 'Dawn is closer. Choose a draft card, spend embers, then face the next night.' };
    w.bannerT = 3;
  }
}

export { FEATS, SHOP_ITEMS, DRAFT_POOL, ABILITIES, BRAZIERS, ENEMIES, gradeFor, startNight, rollDraftOptions };

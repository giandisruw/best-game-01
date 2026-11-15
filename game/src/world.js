// Lumenfall's rules and state, with no drawing and no browser in it: the keeper,
// its light bolts, the shadow wisps, sun motes, waves and the Gloom Herald boss.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can play sounds without the world knowing about screens or audio.
// Nothing here allocates after createWorld returns.
import { COMBO, ENEMY, FIELD, LIVES, MOTE, PLAYER, STEP, WAVES } from './config.js';

export const KIND_WISP = 0;
export const KIND_DARTER = 1;
export const KIND_BRUTE = 2;
export const KIND_HERALD = 3;
export const KIND_MOTE = 4;

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_MOTE = 16;
export const EVENT_WAVE = 32;
export const EVENT_WIN = 64;
export const EVENT_DASH = 128;

const POOL_ENEMIES = 48;
const POOL_BOLTS = 64;
const POOL_PARTICLES = 160;
const TWO_PI = Math.PI * 2;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pickEdge(random) {
  const side = Math.floor(random() * 4);
  const margin = 30;
  if (side === 0) return { x: random() * FIELD.width, y: -margin };
  if (side === 1) return { x: random() * FIELD.width, y: FIELD.height + margin };
  if (side === 2) return { x: -margin, y: random() * FIELD.height };
  return { x: FIELD.width + margin, y: random() * FIELD.height };
}

/** Wave N's roster: wisps always, darters from wave 2, brutes from wave 4. */
function rosterFor(wave) {
  const list = [];
  const wisps = 3 + wave * 2;
  const darters = wave >= 2 ? wave : 0;
  const brutes = wave >= 4 ? Math.floor((wave - 2) / 2) : 0;
  for (let i = 0; i < wisps; i += 1) list.push(KIND_WISP);
  for (let i = 0; i < darters; i += 1) list.push(KIND_DARTER);
  for (let i = 0; i < brutes; i += 1) list.push(KIND_BRUTE);
  return list;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius,
    vx: 0, vy: 0, invulnerable: 0, fireTimer: 0, dashTimer: 0,
    dashCooldown: 0, dashX: 0, dashY: 0, energy: PLAYER.maxEnergy,
  };
  const enemies = [];
  for (let i = 0; i < POOL_ENEMIES; i += 1) {
    enemies.push({ active: false, kind: KIND_WISP, x: 0, y: 0, radius: 10, hp: 1, speed: 0, seed: 0, t: 0 });
  }
  const bolts = [];
  for (let i = 0; i < POOL_BOLTS; i += 1) {
    bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const motes = [];
  for (let i = 0; i < 24; i += 1) {
    motes.push({ active: false, x: 0, y: 0, radius: MOTE.radius, life: 0, t: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff' });
  }
  const state = {
    player, enemies, bolts, motes, particles,
    score: 0, best: 0, lives: LIVES, wave: 0, waveState: 'title',
    waveTimer: 0, spawnQueue: [], spawnTimer: 0, moteTimer: 0,
    combo: 0, comboTimer: 0, kills: 0, elapsed: 0, boss: null,
    heraldHp: 0, heraldMax: 0, banner: '', bannerTimer: 0,
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const angle = random() * TWO_PI;
      const v = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v; p.vy = Math.sin(angle) * v;
      p.max = 0.5 + random() * 0.4; p.life = p.max;
      p.size = 2 + random() * 4; p.color = color;
    }
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (!e) return;
    const at = pickEdge(random);
    const base = ENEMY[kind === KIND_WISP ? 'wisp' : kind === KIND_DARTER ? 'darter' : kind === KIND_BRUTE ? 'brute' : 'herald'];
    e.active = true; e.kind = kind;
    e.x = at.x; e.y = at.y; e.radius = base.radius;
    e.hp = base.hp + Math.floor(state.wave / 5);
    e.speed = base.speed * (1 + state.wave * 0.03) * (0.9 + random() * 0.2);
    e.seed = random() * TWO_PI; e.t = 0;
  }

  function spawnBoss() {
    spawnEnemy(KIND_HERALD);
    for (const e of enemies) {
      if (e.active && e.kind === KIND_HERALD) {
        state.boss = e;
        state.heraldMax = e.hp;
        state.heraldHp = e.hp;
        return;
      }
    }
  }

  function spawnMote() {
    const m = free(motes);
    if (!m) return;
    m.active = true;
    m.x = 80 + random() * (FIELD.width - 160);
    m.y = 80 + random() * (FIELD.height - 160);
    m.life = MOTE.lifetime; m.t = random() * TWO_PI;
  }

  function startWave(wave) {
    state.wave = wave;
    state.waveState = 'fighting';
    state.spawnQueue = rosterFor(wave);
    // Shuffle the queue so the wave arrives mixed, not sorted by kind.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = tmp;
    }
    state.spawnTimer = 0.4;
    state.banner = wave === WAVES.total ? 'WAVE 10 — THE GLOOM HERALD' : `WAVE ${wave}`;
    state.bannerTimer = 2.2;
    if (wave === WAVES.total) spawnBoss();
  }

  function award(points) {
    const mult = 1 + Math.min(state.combo, COMBO.max - 1);
    state.score += points * mult;
  }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height / 2;
    player.vx = 0; player.vy = 0;
    player.invulnerable = 0; player.fireTimer = 0;
    player.dashTimer = 0; player.dashCooldown = 0;
    player.energy = PLAYER.maxEnergy;
    for (const e of enemies) e.active = false;
    for (const b of bolts) b.active = false;
    for (const m of motes) m.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.lives = LIVES; state.wave = 0;
    state.waveState = 'title'; state.waveTimer = 0;
    state.spawnQueue = []; state.spawnTimer = 0; state.moteTimer = 2;
    state.combo = 0; state.comboTimer = 0; state.kills = 0;
    state.elapsed = 0; state.boss = null;
    state.heraldHp = 0; state.heraldMax = 0;
    state.banner = ''; state.bannerTimer = 0;
  }

  /** Begin wave 1 from the title screen. */
  function startGame() {
    reset();
    startWave(1);
  }

  /**
   * One fixed step. `move` is {x, y} in [-1, 1]; `aim` is the mouse in field
   * coordinates; `firing` holds the trigger; `dash` asks for a dash this step.
   * With `harmless` set (the title backdrop) wisps drift but nothing scores.
   */
  function step(dt, move, aim, firing, dash, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- player movement & dash ---
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.x += player.dashX * PLAYER.dashSpeed * dt;
      player.y += player.dashY * PLAYER.dashSpeed * dt;
    } else {
      const len = Math.hypot(move.x, move.y) || 1;
      const nx = move.x / len;
      const ny = move.y / len;
      const moving = move.x !== 0 || move.y !== 0;
      player.x += (moving ? nx : 0) * PLAYER.speed * dt;
      player.y += (moving ? ny : 0) * PLAYER.speed * dt;
      if (dash && player.dashCooldown <= 0 && moving) {
        player.dashTimer = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown;
        player.dashX = nx; player.dashY = ny;
        burst(player.x, player.y, '#ffd76a', 10, 160);
        events |= EVENT_DASH;
      }
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y));
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.energy < PLAYER.maxEnergy) player.energy = Math.min(PLAYER.maxEnergy, player.energy + 6 * dt);

    // --- firing ---
    player.fireTimer -= dt;
    if (firing && !harmless && player.fireTimer <= 0 && player.energy >= PLAYER.energyPerShot) {
      const b = free(bolts);
      if (b) {
        const dx = aim.x - player.x;
        const dy = aim.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        b.active = true;
        b.x = player.x + (dx / len) * (player.radius + 6);
        b.y = player.y + (dy / len) * (player.radius + 6);
        b.vx = (dx / len) * PLAYER.boltSpeed;
        b.vy = (dy / len) * PLAYER.boltSpeed;
        b.life = 1.1;
        player.fireTimer = PLAYER.fireInterval;
        player.energy -= PLAYER.energyPerShot;
        events |= EVENT_SHOOT;
      }
    }

    // --- spawning ---
    if (!harmless && state.waveState === 'fighting') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy(state.spawnQueue.pop());
          state.spawnTimer = Math.max(0.25, 0.9 - state.wave * 0.05);
        }
      }
      state.moteTimer -= dt;
      if (state.moteTimer <= 0) {
        spawnMote();
        state.moteTimer = WAVES.moteEverySeconds;
      }
    } else if (harmless && state.waveState === 'title') {
      // Title backdrop: a few wisps drift across for life, never touching.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && enemies.filter((e) => e.active).length < 5) {
        spawnEnemy(KIND_WISP);
        state.spawnTimer = 1.2;
      }
    }

    // --- bolts ---
    for (const b of bolts) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + 6;
        if (dist2(b, e) < rr * rr) {
          b.active = false;
          e.hp -= PLAYER.boltDamage;
          burst(b.x, b.y, '#ffe9a3', 4, 120);
          if (e.hp <= 0) {
            e.active = false;
            const base = ENEMY[e.kind === KIND_WISP ? 'wisp' : e.kind === KIND_DARTER ? 'darter' : e.kind === KIND_BRUTE ? 'brute' : 'herald'];
            state.kills += 1;
            state.combo += 1;
            state.comboTimer = COMBO.window;
            award(base.score);
            burst(e.x, e.y, e.kind === KIND_HERALD ? '#ff5d73' : '#8f7bff', e.kind === KIND_HERALD ? 40 : 14, 220);
            events |= EVENT_KILL;
            if (e.kind === KIND_HERALD) {
              state.boss = null;
              state.waveState = 'won';
              events |= EVENT_WIN;
            }
          }
          break;
        }
      }
    }

    // --- enemies: chase, zigzag, or lumber toward the keeper ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.t += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      let mx = dx / len;
      let my = dy / len;
      if (e.kind === KIND_DARTER) {
        const sway = Math.sin(e.t * 6 + e.seed) * 0.8;
        const px = -my * sway;
        const py = mx * sway;
        mx += px; my += py;
        const ml = Math.hypot(mx, my) || 1;
        mx /= ml; my /= ml;
      }
      e.x += mx * e.speed * dt;
      e.y += my * e.speed * dt;
      if (e.kind === KIND_HERALD) state.heraldHp = Math.max(0, e.hp);
      if (harmless) continue;
      const rr = e.radius + player.radius - 4;
      if (dist2(e, player) < rr * rr && player.invulnerable <= 0 && player.dashTimer <= 0) {
        e.active = false;
        state.lives -= 1;
        player.invulnerable = PLAYER.invulnerable;
        state.combo = 0;
        burst(player.x, player.y, '#ff5d73', 24, 260);
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          state.waveState = 'over';
          events |= EVENT_OVER;
        }
      }
    }

    // --- motes: drift, sparkle, expire; collecting restores energy and score ---
    for (const m of motes) {
      if (!m.active) continue;
      m.t += dt;
      m.life -= dt;
      if (m.life <= 0) { m.active = false; continue; }
      if (harmless) continue;
      const rr = m.radius + player.radius + 6;
      if (dist2(m, player) < rr * rr) {
        m.active = false;
        player.energy = Math.min(PLAYER.maxEnergy, player.energy + PLAYER.energyPerMote);
        award(MOTE.score);
        burst(m.x, m.y, '#7ef0c1', 8, 140);
        events |= EVENT_MOTE;
      }
    }

    // --- particles ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }

    // --- wave clear: queue empty, no enemies left, boss dead ---
    if (!harmless && state.waveState === 'fighting' && state.spawnQueue.length === 0) {
      let anyLeft = false;
      for (const e of enemies) if (e.active) { anyLeft = true; break; }
      if (!anyLeft) {
        if (state.wave >= WAVES.total) {
          state.waveState = 'won';
          events |= EVENT_WIN;
        } else {
          state.waveState = 'between';
          state.waveTimer = WAVES.betweenSeconds;
          state.lives = Math.min(LIVES, state.lives + 0);
          award(100 * state.wave);
          events |= EVENT_WAVE;
        }
      }
    }
    if (!harmless && state.waveState === 'between') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) startWave(state.wave + 1);
    }

    return events;
  }

  reset();
  return { state, reset, startGame, startWave, step };
}

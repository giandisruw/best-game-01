// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred. A deep violet
// night sky with drifting stars, a glowing lantern keeper, shadow wisps in
// purple and pink, green sun motes, canvas text for the HUD and the panels.
import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { KIND_BRUTE, KIND_DARTER, KIND_HERALD, KIND_WISP } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 140, line: 32, bottom: 72 };
const HEART_R = 9;

/** Deterministic starfield: fixed positions, twinkling by wall-clock phase. */
const STARS = [];
for (let i = 0; i < 90; i += 1) {
  const s = (i * 2654435761) % 4294967296;
  STARS.push({
    x: (s % 1280),
    y: ((s >>> 7) % 720),
    r: 0.6 + ((s >>> 13) % 10) / 10,
    phase: ((s >>> 17) % 100) / 100,
  });
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const killsLabel = cachedLabel('Shadows banished ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawSky(now) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of STARS) {
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(now / 900 + star.phase * 6.28));
      context.globalAlpha = tw * 0.8;
      context.fillStyle = '#dfe6ff';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // A low violet haze along the ground line.
    const haze = context.createRadialGradient(640, 720, 60, 640, 720, 700);
    haze.addColorStop(0, 'rgba(64, 42, 130, 0.55)');
    haze.addColorStop(1, 'rgba(64, 42, 130, 0)');
    context.fillStyle = haze;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawGlow(x, y, radius, color, alpha) {
    const g = context.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = g;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawMotes(state) {
    for (const m of state.motes) {
      if (!m.active) continue;
      const pulse = 0.7 + 0.3 * Math.sin(m.t * 5);
      drawGlow(m.x, m.y, 26 * pulse, 'rgba(126, 240, 193, 0.5)', 0.8);
      context.fillStyle = PALETTE.mote;
      context.beginPath();
      context.arc(m.x, m.y, m.radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#eafff5';
      context.beginPath();
      context.arc(m.x - 2, m.y - 2, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawEnemy(e, now) {
    const bob = Math.sin(e.t * 3 + e.seed) * 3;
    const y = e.y + bob;
    if (e.kind === KIND_HERALD) {
      drawGlow(e.x, y, 150, 'rgba(255, 93, 115, 0.35)', 0.9);
      context.fillStyle = PALETTE.herald;
      context.beginPath();
      context.arc(e.x, y, e.radius, 0, Math.PI * 2);
      context.fill();
      // Crown of spikes.
      context.strokeStyle = '#ffb3bd';
      context.lineWidth = 4;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + e.t * 0.5;
        context.beginPath();
        context.moveTo(e.x + Math.cos(a) * e.radius, y + Math.sin(a) * e.radius);
        context.lineTo(e.x + Math.cos(a) * (e.radius + 16), y + Math.sin(a) * (e.radius + 16));
        context.stroke();
      }
      context.fillStyle = '#1a0b1e';
      context.beginPath();
      context.arc(e.x - 16, y - 8, 7, 0, Math.PI * 2);
      context.arc(e.x + 16, y - 8, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd76a';
      context.beginPath();
      context.arc(e.x - 16, y - 8, 3, 0, Math.PI * 2);
      context.arc(e.x + 16, y - 8, 3, 0, Math.PI * 2);
      context.fill();
      return;
    }
    const color = e.kind === KIND_WISP ? PALETTE.wisp : e.kind === KIND_DARTER ? PALETTE.darter : PALETTE.brute;
    drawGlow(e.x, y, e.radius * 2.4, color, 0.35);
    context.fillStyle = color;
    context.beginPath();
    if (e.kind === KIND_DARTER) {
      // A dart: a sharp triangle pointing at its travel.
      context.moveTo(e.x + e.radius + 8, y);
      context.lineTo(e.x - e.radius, y - e.radius * 0.8);
      context.lineTo(e.x - e.radius, y + e.radius * 0.8);
      context.closePath();
      context.fill();
    } else {
      context.arc(e.x, y, e.radius, 0, Math.PI * 2);
      context.fill();
      // Wavy tail.
      context.strokeStyle = color;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(e.x, y + e.radius);
      context.quadraticCurveTo(e.x + Math.sin(e.t * 5) * 12, y + e.radius + 18, e.x, y + e.radius + 30);
      context.stroke();
    }
    // Eyes: two dark dots that always face the keeper.
    context.fillStyle = '#120a24';
    const eyeOff = e.radius * 0.38;
    context.beginPath();
    context.arc(e.x - eyeOff, y - 3, 3.5, 0, Math.PI * 2);
    context.arc(e.x + eyeOff, y - 3, 3.5, 0, Math.PI * 2);
    context.fill();
    if (e.kind === KIND_BRUTE) {
      // HP pips above a brute.
      context.fillStyle = '#3d2a63';
      context.fillRect(e.x - 22, y - e.radius - 14, 44, 6);
      context.fillStyle = PALETTE.brute;
      context.fillRect(e.x - 22, y - e.radius - 14, 44 * (e.hp / 4), 6);
    }
  }

  function drawField(state, now) {
    drawSky(now);
    drawMotes(state);
    for (const b of state.bolts) {
      if (!b.active) continue;
      drawGlow(b.x, b.y, 14, 'rgba(255, 233, 163, 0.8)', 0.9);
      context.fillStyle = PALETTE.bolt;
      context.beginPath();
      context.arc(b.x, b.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e, now);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // The keeper: a lantern with a warm glow, blinking while invulnerable.
    const player = state.player;
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (!blink) {
      drawGlow(player.x, player.y, 110, 'rgba(255, 215, 106, 0.5)', 0.85);
      context.fillStyle = '#2a1c4d';
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerCore;
      context.beginPath();
      context.arc(player.x, player.y, player.radius * 0.55, 0, Math.PI * 2);
      context.fill();
      // Lantern handle.
      context.strokeStyle = '#8a6d2f';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y - 4, player.radius * 0.7, Math.PI * 1.15, Math.PI * 1.85);
      context.stroke();
    }
    // Dash cooldown ring.
    if (player.dashCooldown > 0) {
      context.strokeStyle = 'rgba(255, 215, 106, 0.5)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - player.dashCooldown / 1.6));
      context.stroke();
    }
  }

  function drawHeart(x, y, filled) {
    context.fillStyle = filled ? PALETTE.heart : '#3a3358';
    context.beginPath();
    context.moveTo(x, y + HEART_R * 0.8);
    context.bezierCurveTo(x - HEART_R * 1.3, y - HEART_R * 0.4, x - HEART_R * 0.6, y - HEART_R * 1.1, x, y - HEART_R * 0.3);
    context.bezierCurveTo(x + HEART_R * 0.6, y - HEART_R * 1.1, x + HEART_R * 1.3, y - HEART_R * 0.4, x, y + HEART_R * 0.8);
    context.fill();
  }

  function drawHud(state, now) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 28, PALETTE.text, 'left');
    text(waveLabel(state.wave === 0 ? 1 : state.wave) + ' / 10', FIELD.width / 2, 18, 28, PALETTE.text, 'center');
    // Lives as hearts, top right.
    for (let i = 0; i < LIVES; i += 1) {
      drawHeart(FIELD.width - 24 - i * 30, 32, i < state.lives);
    }
    // Energy bar under the score.
    context.fillStyle = '#241d47';
    context.fillRect(24, 56, 180, 12);
    context.fillStyle = PALETTE.mote;
    context.fillRect(24, 56, 180 * (state.player.energy / 100), 12);
    text('LIGHT', 212, 52, 16, PALETTE.muted, 'left');
    if (state.combo > 1) {
      text(`COMBO x${Math.min(state.combo, 8)}`, 24, 76, 22, PALETTE.gold, 'left');
    }
    // Boss health bar.
    if (state.boss && state.heraldMax > 0) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      text('THE GLOOM HERALD', FIELD.width / 2, 52, 20, PALETTE.danger, 'center');
      context.fillStyle = '#3a1030';
      context.fillRect(x, 78, w, 12);
      context.fillStyle = PALETTE.herald;
      context.fillRect(x, 78, w * (state.heraldHp / state.heraldMax), 12);
    }
    // Wave banner, fading.
    if (state.banner && state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 130, 40, PALETTE.gold, 'center');
      context.globalAlpha = 1;
    }
    // "Next wave" countdown between waves.
    if (state.waveState === 'between') {
      text(`Next wave in ${Math.ceil(state.waveTimer)}…`, FIELD.width / 2, 180, 24, PALETTE.muted, 'center');
    }
    void now;
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'The night is full of shadows. You keep the last lantern.',
    'Banish the wisps across 10 waves and face the Gloom Herald.',
    'Move: WASD or arrows · Aim: mouse · Fire: hold click or Space',
    'Dash: Shift or right-click · Pause: P · Mute: M',
    '',
  ];
  const PAUSED_LINES = ['The shadows wait for you.'];
  const WIN_LINES = ['', '', 'The dawn returns to the valley.'];
  const OVER_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state, now);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('LUMENFALL', TITLE_LINES, 'Press Space or click to begin', PALETTE.gold);
      return;
    }
    drawHud(state, now);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = `${bestLabel(best)}  ·  ${killsLabel(state.kills)}`;
      drawPanel('DAWN BREAKS — YOU WIN!', WIN_LINES, 'Press Space or click to play again', PALETTE.gold);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = `${bestLabel(best)}  ·  Reached wave ${state.wave} of 10`;
      drawPanel('The light goes out…', OVER_LINES, 'Press Space or click to try again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

// FROSTLINE — canvas rendering, nothing else.
// One clear job: draw the field, the frost, every creature, the HUD and all
// screens. It reads world state and never changes it.

import {
  VIEW_W, VIEW_H, PALETTE, HEARTH, HEAT, FROST, BRAZIERS, ENEMIES,
  ABILITIES, SHOP_ITEMS, FEATS,
} from './config.js';
import { lightRadius } from './world.js';

// Shared hit-test rectangles: main.js reads these for clicks, render draws them.
export const LAYOUT = {
  title: {
    ember: { x: 330, y: 356, w: 290, h: 56 },
    blizzard: { x: 660, y: 356, w: 290, h: 56 },
    start: { x: 440, y: 500, w: 400, h: 52 },
    howto: { x: 440, y: 562, w: 400, h: 40 },
  },
  draft: {
    cards: [
      { x: 185, y: 138, w: 280, h: 262 },
      { x: 500, y: 138, w: 280, h: 262 },
      { x: 815, y: 138, w: 280, h: 262 },
    ],
    shop: [
      { x: 108, y: 446, w: 200, h: 66 },
      { x: 324, y: 446, w: 200, h: 66 },
      { x: 540, y: 446, w: 200, h: 66 },
      { x: 756, y: 446, w: 200, h: 66 },
      { x: 972, y: 446, w: 200, h: 66 },
    ],
    continue: { x: 490, y: 540, w: 300, h: 58 },
  },
  win: {
    endless: { x: 350, y: 512, w: 240, h: 56 },
    replay: { x: 610, y: 512, w: 240, h: 56 },
    title: { x: 490, y: 586, w: 300, h: 44 },
  },
  lose: {
    restart: { x: 490, y: 512, w: 300, h: 58 },
  },
  howto: {
    back: { x: 490, y: 622, w: 300, h: 48 },
  },
  pause: {
    resume: { x: 490, y: 330, w: 300, h: 56 },
    restart: { x: 490, y: 400, w: 300, h: 48 },
    quit: { x: 490, y: 460, w: 300, h: 48 },
  },
  abilities: {
    burst: { x: 16, y: 664, w: 168, h: 44 },
    ward: { x: 192, y: 664, w: 168, h: 44 },
    place: { x: 368, y: 664, w: 210, h: 44 },
  },
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, edge) {
  rr(ctx, x, y, w, h, 12);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge || PALETTE.panelEdge;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.font = `${weight || '600'} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = color || PALETTE.text;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function keycap(ctx, label, x, y) {
  ctx.font = '700 13px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 18;
  rr(ctx, x, y - 11, w, 22, 5);
  ctx.fillStyle = '#232c42';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#8fa3c8';
  ctx.stroke();
  ctx.fillStyle = '#f4f1e6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + 1);
  return w;
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fill();
  if (frac > 0) {
    rr(ctx, x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

export function drawField(ctx, w, time) {
  // Night sky ground: cold blue snow, never empty.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#16233f');
  g.addColorStop(0.5, '#101b32');
  g.addColorStop(1, '#0a1226');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Snow drifts.
  for (const d of w.decor.drifts) {
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(223, 233, 245, 0.16)';
    ctx.fill();
  }
  // Stones.
  for (const s of w.decor.stones) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.stone;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.25, s.y - s.r * 0.3, s.r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(223,233,245,0.5)';
    ctx.fill();
  }
  // Pines with snow caps.
  for (const p of w.decor.pines) {
    const h = 34 * p.s;
    const wd = 22 * p.s;
    ctx.fillStyle = PALETTE.pine;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - wd, p.y);
    ctx.lineTo(p.x + wd, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.pineSnow;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - wd * 0.55, p.y - h * 0.45);
    ctx.lineTo(p.x + wd * 0.55, p.y - h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a3421';
    ctx.fillRect(p.x - 2, p.y, 4, 6 * p.s);
  }

  // Frost creep: a living stain over the ground.
  for (let r = 0; r < FROST.rows; r += 1) {
    for (let c = 0; c < FROST.cols; c += 1) {
      const f = w.frost[r * FROST.cols + c];
      if (f <= 0.03) continue;
      const x = c * FROST.cell;
      const y = r * FROST.cell;
      ctx.fillStyle = f > 0.66
        ? `rgba(168, 212, 240, ${0.34 + f * 0.3})`
        : `rgba(120, 170, 220, ${f * 0.42})`;
      ctx.fillRect(x, y, FROST.cell + 1, FROST.cell + 1);
      if (f > 0.75 && (c * 7 + r * 13) % 4 === 0) {
        // Sparse sparkle on solid frost, never a repeating pattern.
        ctx.fillStyle = 'rgba(232, 246, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Lit ground: warm halo around the hearth.
  const lr = lightRadius(w);
  const glow = ctx.createRadialGradient(HEARTH.x, HEARTH.y, 10, HEARTH.x, HEARTH.y, lr);
  glow.addColorStop(0, `rgba(255, 154, 60, ${0.30 + w.heat / 400})`);
  glow.addColorStop(0.7, `rgba(255, 122, 26, ${0.10 + w.heat / 900})`);
  glow.addColorStop(1, 'rgba(255, 122, 26, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(HEARTH.x, HEARTH.y, lr, 0, Math.PI * 2);
  ctx.fill();

  // Hearth: stone ring, fire, smoke.
  ctx.beginPath();
  ctx.arc(HEARTH.x, HEARTH.y, HEARTH.r + 8, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.hearthStoneDark;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(HEARTH.x, HEARTH.y, HEARTH.r, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.hearthStone;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2c2338';
  ctx.stroke();
  const flick = 1 + Math.sin(time * 9) * 0.06 + Math.sin(time * 23) * 0.04;
  const flameR = (16 + w.heat * 0.22) * flick;
  const fg = ctx.createRadialGradient(HEARTH.x, HEARTH.y, 2, HEARTH.x, HEARTH.y, flameR * 1.6);
  fg.addColorStop(0, '#ffe9a8');
  fg.addColorStop(0.45, PALETTE.flame);
  fg.addColorStop(1, 'rgba(255, 90, 26, 0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(HEARTH.x, HEARTH.y - 4, flameR * 1.6, 0, Math.PI * 2);
  ctx.fill();
  // Logs.
  ctx.strokeStyle = '#3a2415';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(HEARTH.x - 20, HEARTH.y + 12);
  ctx.lineTo(HEARTH.x + 20, HEARTH.y - 2);
  ctx.moveTo(HEARTH.x + 20, HEARTH.y + 12);
  ctx.lineTo(HEARTH.x - 20, HEARTH.y - 2);
  ctx.stroke();

  // Braziers.
  for (const b of w.braziers) {
    const def = BRAZIERS[b.type];
    const br = ctx.createRadialGradient(b.x, b.y - 14, 2, b.x, b.y - 14, 52);
    br.addColorStop(0, 'rgba(255, 170, 70, 0.5)');
    br.addColorStop(1, 'rgba(255, 170, 70, 0)');
    ctx.fillStyle = br;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 14, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d3249';
    ctx.fillRect(b.x - 3, b.y - 6, 6, 16);
    ctx.beginPath();
    ctx.arc(b.x, b.y - 12, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#241d31';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = def.color;
    ctx.stroke();
    const fr = (7 + b.flash * 30 + Math.sin(time * 11 + b.x) * 1.5);
    ctx.beginPath();
    ctx.arc(b.x, b.y - 16, Math.max(4, fr), 0, Math.PI * 2);
    ctx.fillStyle = b.flash > 0 ? '#ffe9a8' : def.color;
    ctx.fill();
    if (b.level > 1) {
      text(ctx, `Lv${b.level}`, b.x, b.y + 24, 11, PALETTE.gold, 'center', '700');
    }
  }

  // Enemies.
  for (const e of w.enemies) {
    const def = ENEMIES[e.type];
    const flash = e.hitFlash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'wisp') {
      ctx.fillStyle = flash ? '#ffffff' : def.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10, 18, 38, 0.85)';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(191, 227, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, e.r * 0.6);
      ctx.quadraticCurveTo(6, e.r + 6, 0, e.r + 12 + Math.sin(time * 5 + e.zig) * 3);
      ctx.stroke();
    } else if (e.type === 'darter') {
      ctx.rotate(Math.atan2(HEARTH.y - e.y, HEARTH.x - e.x));
      ctx.fillStyle = flash ? '#ffffff' : def.color;
      ctx.beginPath();
      ctx.moveTo(e.r + 4, 0);
      ctx.lineTo(-e.r, -e.r * 0.8);
      ctx.lineTo(-e.r * 0.4, 0);
      ctx.lineTo(-e.r, e.r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'brute') {
      ctx.fillStyle = flash ? '#ffffff' : def.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5f9fd0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.6, -e.r * 0.4);
      ctx.lineTo(e.r * 0.5, -e.r * 0.7);
      ctx.lineTo(e.r * 0.2, e.r * 0.5);
      ctx.lineTo(-e.r * 0.7, e.r * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#0a1226';
      ctx.beginPath();
      ctx.arc(-7, -4, 3, 0, Math.PI * 2);
      ctx.arc(7, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The Whiteout Herald: a towering crowned wraith.
      const pulse = 1 + Math.sin(time * 2.4) * 0.03;
      ctx.scale(pulse, pulse);
      const hg = ctx.createRadialGradient(0, 0, 6, 0, 0, e.r + 26);
      hg.addColorStop(0, 'rgba(242, 249, 255, 0.55)');
      hg.addColorStop(1, 'rgba(143, 208, 255, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : def.color;
      ctx.beginPath();
      ctx.moveTo(0, -e.r - 14);
      ctx.lineTo(e.r * 0.7, -e.r * 0.2);
      ctx.lineTo(e.r * 0.45, e.r * 0.8);
      ctx.lineTo(-e.r * 0.45, e.r * 0.8);
      ctx.lineTo(-e.r * 0.7, -e.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0a1226';
      ctx.beginPath();
      ctx.arc(-12, -8, 4, 0, Math.PI * 2);
      ctx.arc(12, -8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8fd0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, -e.r - 2);
      ctx.lineTo(0, -e.r - 22);
      ctx.lineTo(20, -e.r - 2);
      ctx.stroke();
    }
    ctx.restore();
    // HP bar for tough enemies.
    if (e.maxHp > 40 && e.hp < e.maxHp) {
      bar(ctx, e.x - 26, e.y - e.r - 14, 52, 6, e.hp / e.maxHp, '#ff5d5d');
    }
  }

  // Bolts.
  for (const b of w.bolts) {
    ctx.strokeStyle = b.from === 'player' ? '#ffd166' : '#ff9a3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles.
  for (const p of w.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating damage numbers.
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    text(ctx, f.text, f.x, f.y, 14, f.color, 'center', '800');
  }
  ctx.globalAlpha = 1;

  // The keeper.
  const p = w.player;
  const aim = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(aim);
  ctx.fillStyle = '#7a4a21';
  ctx.fillRect(6, -2, 20, 4);
  ctx.rotate(-aim);
  ctx.fillStyle = '#c65f1e';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4e3c2';
  ctx.beginPath();
  ctx.arc(0, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Placement ghost.
  if (w.placeMode) {
    const mx = p.aimX;
    const my = p.aimY;
    const def = BRAZIERS[w.placeType];
    const ok = w.embers >= (w.freeBraziers > 0 ? 0 : def.cost)
      && Math.hypot(mx - HEARTH.x, my - HEARTH.y) > 95;
    ctx.strokeStyle = ok ? '#7ee081' : '#ff5d5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, def.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(mx, my - 12, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    text(ctx, `${def.name} — ${w.freeBraziers > 0 ? 'FREE' : def.cost + ' embers'} (click to place, right-click to cancel)`, mx, my + 26, 13, ok ? PALETTE.text : '#ff8d8d', 'center', '700');
  }

  // Ward shimmer.
  if (w.time < w.wardUntil) {
    ctx.strokeStyle = 'rgba(143, 208, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(HEARTH.x, HEARTH.y, lightRadius(w) + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawHud(ctx, w, meta) {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 56);
  ctx.fillStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.fillRect(0, 56, VIEW_W, 2);

  // Hearth HP.
  text(ctx, 'HEARTH', 16, 16, 11, PALETTE.textDim, 'left', '800');
  const hpFrac = w.hearth.hp / w.hearth.maxHp;
  bar(ctx, 16, 24, 150, 14, hpFrac, hpFrac > 0.5 ? PALETTE.hpGood : hpFrac > 0.25 ? PALETTE.hpWarn : PALETTE.hpBad);
  text(ctx, `${Math.ceil(w.hearth.hp)} / ${w.hearth.maxHp}`, 174, 31, 13, PALETTE.text, 'left', '700');

  // Heat gauge with the overheat zone marked.
  text(ctx, 'HEAT', 240, 16, 11, PALETTE.textDim, 'left', '800');
  bar(ctx, 240, 24, 170, 14, w.heat / 100, w.heat > HEAT.overheatAt ? '#ff5d3c' : w.heat > 60 ? '#ff9a3c' : '#ffb347');
  ctx.fillStyle = 'rgba(255, 93, 60, 0.85)';
  ctx.fillRect(240 + 170 * (HEAT.overheatAt / 100) - 1, 24, 2, 14);
  text(ctx, `${Math.round(w.heat)}°`, 418, 31, 13, w.heat > HEAT.overheatAt ? '#ff8d7d' : PALETTE.text, 'left', '700');
  text(ctx, w.heat > HEAT.overheatAt ? 'OVERHEAT!' : w.heat < HEAT.coldAt ? 'COLD' : 'WARM', 418, 48, 10, w.heat > HEAT.overheatAt ? '#ff8d7d' : PALETTE.textDim, 'left', '700');

  // Fuel.
  text(ctx, 'FUEL', 500, 16, 11, PALETTE.textDim, 'left', '800');
  bar(ctx, 500, 24, 110, 14, w.fuel / w.maxFuel, w.fuel < 20 ? '#ff5d5d' : '#7ee081');
  text(ctx, `${Math.ceil(w.fuel)}`, 618, 31, 13, PALETTE.text, 'left', '700');

  // Embers (currency).
  text(ctx, '◆ EMBERS', 660, 16, 11, PALETTE.textDim, 'left', '800');
  text(ctx, `${Math.floor(w.embers)}`, 660, 36, 20, PALETTE.gold, 'left', '800');

  // Frost level.
  text(ctx, 'FROST', 780, 16, 11, PALETTE.textDim, 'left', '800');
  bar(ctx, 780, 24, 90, 14, w.frostLevel / 100, '#8fd0ff');
  text(ctx, `${Math.round(w.frostLevel)}%`, 878, 31, 13, '#bfe3ff', 'left', '700');

  // Night + score, centred.
  text(ctx, w.endless ? `ENDLESS NIGHT ${w.night}` : `NIGHT ${w.night} / 7`, 1020, 20, 15, PALETTE.text, 'center', '800');
  text(ctx, `SCORE ${w.score}`, 1020, 40, 13, PALETTE.gold, 'center', '700');

  // Combo.
  if (w.combo > 1) {
    text(ctx, `COMBO x${w.combo}`, 1150, 20, 15, '#ff9a3c', 'center', '800');
    bar(ctx, 1100, 30, 100, 8, w.comboTimer / 3, '#ff9a3c');
  } else {
    text(ctx, 'COMBO —', 1150, 20, 13, PALETTE.textDim, 'center', '700');
  }

  // Boss HP bar.
  const boss = w.enemies.find((e) => e.type === 'herald');
  if (boss) {
    panel(ctx, 390, 66, 500, 34, '#bfe3ff');
    text(ctx, 'THE WHITEOUT HERALD', 640, 76, 12, '#bfe3ff', 'center', '800');
    bar(ctx, 404, 82, 472, 10, boss.hp / boss.maxHp, '#e8f6ff');
  }

  // Minimap.
  const mx = 1088;
  const my = 66;
  const mw = 180;
  const mh = 96;
  panel(ctx, mx, my, mw, mh, 'rgba(255,179,71,0.6)');
  const sx = mw / VIEW_W;
  const sy = mh / VIEW_H;
  ctx.fillStyle = 'rgba(168, 212, 240, 0.5)';
  for (let r = 0; r < FROST.rows; r += 1) {
    for (let c = 0; c < FROST.cols; c += 1) {
      if (w.frost[r * FROST.cols + c] > 0.5) {
        ctx.fillRect(mx + c * FROST.cell * sx, my + r * FROST.cell * sy, 4, 4);
      }
    }
  }
  ctx.fillStyle = '#ff9a3c';
  ctx.beginPath();
  ctx.arc(mx + HEARTH.x * sx, my + HEARTH.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  for (const b of w.braziers) {
    ctx.fillRect(mx + b.x * sx - 2, my + b.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#bfe3ff';
  for (const e of w.enemies) {
    ctx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.arc(mx + w.player.x * sx, my + w.player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Ability bar.
  ctx.fillStyle = 'rgba(6, 10, 24, 0.82)';
  ctx.fillRect(0, 656, VIEW_W, 64);
  ctx.fillStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.fillRect(0, 656, VIEW_W, 2);
  drawAbility(ctx, LAYOUT.abilities.burst, '1', 'Kindle Burst', w.abilities.burst.cd, ABILITIES.burst.cooldown * w.mods.burstCdMul);
  drawAbility(ctx, LAYOUT.abilities.ward, '2', 'Frost Ward', w.abilities.ward.cd, ABILITIES.ward.cooldown);
  const place = LAYOUT.abilities.place;
  const pdef = BRAZIERS[w.placeType];
  rr(ctx, place.x, place.y, place.w, place.h, 8);
  ctx.fillStyle = w.placeMode ? '#7a4a21' : '#232c42';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = w.placeMode ? PALETTE.ember : '#8fa3c8';
  ctx.stroke();
  text(ctx, `Q  Place ${pdef.name}`, place.x + 12, place.y + 16, 13, PALETTE.text, 'left', '700');
  text(ctx, w.freeBraziers > 0 ? 'FREE' : `${pdef.cost} embers`, place.x + 12, place.y + 33, 11, PALETTE.gold, 'left', '700');
  text(ctx, 'WASD move · mouse aim · click shoot · SPACE stoke · B bank · P pause · M mute', 600, 686, 13, PALETTE.textDim, 'left', '600');
  text(ctx, `Braziers: ${w.braziers.length}  ·  Kills: ${w.kills}  ·  Seed ${w.seed}  ·  ${w.difficulty === 'blizzard' ? 'BLIZZARD' : 'EMBER'}`, 600, 704, 11, PALETTE.textDim, 'left', '600');

  // Banner.
  if (w.banner && w.bannerT > 0) {
    const a = Math.min(1, w.bannerT);
    ctx.globalAlpha = a;
    text(ctx, w.banner.title, VIEW_W / 2, 130, 30, PALETTE.text, 'center', '800');
    text(ctx, w.banner.sub, VIEW_W / 2, 160, 15, PALETTE.textDim, 'center', '600');
    ctx.globalAlpha = 1;
  }
  // Fuel warning.
  if (w.fuel <= 0 && w.phase === 'fight') {
    text(ctx, '⚠ OUT OF FUEL — braziers are going cold', VIEW_W / 2, 196, 15, '#ff8d7d', 'center', '800');
  }
}

function drawAbility(ctx, r, key, name, cd, maxCd) {
  rr(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fillStyle = cd > 0 ? '#1a2236' : '#232c42';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = cd > 0 ? '#4a5878' : '#8fa3c8';
  ctx.stroke();
  keycap(ctx, key, r.x + 10, r.y + 22);
  text(ctx, name, r.x + 44, r.y + 15, 13, cd > 0 ? PALETTE.textDim : PALETTE.text, 'left', '700');
  text(ctx, cd > 0 ? `ready in ${Math.ceil(cd)}s` : 'READY', r.x + 44, r.y + 32, 11, cd > 0 ? '#ff8d7d' : '#7ee081', 'left', '700');
}

function drawButton(ctx, r, label, sub, active, disabled) {
  rr(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fillStyle = disabled ? '#1a2236' : active ? '#7a4a21' : '#232c42';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? PALETTE.ember : '#8fa3c8';
  ctx.stroke();
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 8 : 0), 16, disabled ? PALETTE.textDim : PALETTE.text, 'center', '800');
  if (sub) text(ctx, sub, r.x + r.w / 2, r.y + r.h / 2 + 13, 12, PALETTE.textDim, 'center', '600');
}

function rarityColor(rarity) {
  return rarity === 'Epic' ? '#c07bff' : rarity === 'Rare' ? '#5fb8ff' : '#b9c6da';
}

export function drawTitle(ctx, w, meta, selectedDifficulty, time) {
  drawField(ctx, w, time);
  ctx.fillStyle = 'rgba(6, 10, 24, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  text(ctx, 'FROSTLINE', VIEW_W / 2, 88, 64, '#ffb347', 'center', '800');
  text(ctx, '— Keep the Hearth —', VIEW_W / 2, 130, 22, PALETTE.text, 'center', '600');
  text(ctx, 'Seven nights of frost. One fire. Stoke it hot and the braziers blaze —', VIEW_W / 2, 166, 16, PALETTE.textDim, 'center', '600');
  text(ctx, 'but push past the red line and the hearth burns itself. Bank it cold and', VIEW_W / 2, 188, 16, PALETTE.textDim, 'center', '600');
  text(ctx, 'the frost creeps in. Heat is the dial. The hearth is the game.', VIEW_W / 2, 210, 16, PALETTE.textDim, 'center', '600');

  // Goal / win / lose explainer.
  panel(ctx, 240, 228, 800, 92, 'rgba(255,179,71,0.6)');
  text(ctx, 'GOAL — Survive 7 nights. On night 7, slay THE WHITEOUT HERALD.', 640, 250, 15, PALETTE.text, 'center', '700');
  text(ctx, 'WIN — “Dawn breaks — the hearth endures.”   LOSE — the hearth hits 0 HP.', 640, 274, 14, PALETTE.textDim, 'center', '600');
  text(ctx, 'Between nights: pick 1 of 3 draft cards and spend embers in the shop.', 640, 298, 14, PALETTE.textDim, 'center', '600');

  // Difficulty select.
  text(ctx, 'CHOOSE YOUR WINTER', 640, 340, 13, PALETTE.textDim, 'center', '800');
  drawButton(ctx, LAYOUT.title.ember, '🔥 EMBER', 'a fair winter · 100 HP · 100 fuel', selectedDifficulty === 'ember', false);
  drawButton(ctx, LAYOUT.title.blizzard, '❄ BLIZZARD', 'hungry frost · 80 HP · tougher foes', selectedDifficulty === 'blizzard', false);

  // Keycap legend, two centred rows.
  drawLegendRow(ctx, [
    ['W A S D', 'move'], ['MOUSE', 'aim'], ['CLICK', 'shoot'], ['Q', 'place brazier'], ['SPACE', 'stoke (hold)'],
  ], 440);
  drawLegendRow(ctx, [
    ['B', 'bank (hold)'], ['1 / 2', 'abilities'], ['P', 'pause'], ['M', 'mute'], ['R', 'restart'],
  ], 468);

  drawButton(ctx, LAYOUT.title.start, '▶  LIGHT THE HEARTH', 'click or press SPACE to begin', true, false);
  drawButton(ctx, LAYOUT.title.howto, 'HOW TO PLAY  (H)', '', false, false);

  // Meta strip: best score, run history, feats.
  panel(ctx, 240, 624, 800, 56, 'rgba(255,179,71,0.4)');
  const best = meta.bestScore || 0;
  const runs = meta.runs || [];
  const feats = meta.feats || [];
  let metaLine = `BEST SCORE ${best}   ·   `;
  metaLine += runs.length ? runs.map((r) => `#${r.night} ${r.score}pts ${r.result}`).join('  ·  ') : 'No runs yet — light the hearth.';
  text(ctx, metaLine, 640, 644, 13, PALETTE.text, 'center', '600');
  text(ctx, `FEATS ${feats.length}/${FEATS.length} unlocked${meta.endlessUnlocked ? '   ·   ENDLESS MODE UNLOCKED' : ''}`, 640, 666, 12, PALETTE.gold, 'center', '700');
}

function drawLegendRow(ctx, items, y) {
  ctx.font = '600 13px system-ui, sans-serif';
  let total = 0;
  const widths = items.map(([k, label]) => {
    ctx.font = '700 13px system-ui, sans-serif';
    const kw = ctx.measureText(k).width + 18;
    ctx.font = '600 13px system-ui, sans-serif';
    const lw = ctx.measureText(label).width;
    total += kw + 6 + lw + 22;
    return kw;
  });
  let x = VIEW_W / 2 - total / 2;
  items.forEach(([k, label], i) => {
    const kw = keycap(ctx, k, x, y);
    text(ctx, label, x + kw + 6, y, 13, PALETTE.textDim, 'left', '600');
    x += widths[i] + 6 + ctx.measureText(label).width + 22;
  });
}

export function drawHowTo(ctx) {
  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'HOW TO PLAY', VIEW_W / 2, 70, 40, '#ffb347', 'center', '800');
  const lines = [
    ['THE HEART OF IT', 'Heat is a dial, not a button. STOKE (hold SPACE) to heat up: braziers fire faster,'],
    ['', 'the lit ground grows, and frost melts. But past 85° the hearth burns itself, and fuel'],
    ['', 'drains fast. BANK (hold B or right-click) to cool down and save fuel — braziers slow.'],
    ['', ''],
    ['THE FIELD', 'Frost creeps in from the edges as a living stain. Warm, lit ground melts it and'],
    ['', 'burns frost creatures standing in it. Frost that touches the hearth eats its HP.'],
    ['', ''],
    ['BRAZIERS', 'Press Q, then click the field to place a brazier (25 embers). Braziers only fire'],
    ['', 'while warm. Kills drop embers; spend them between nights.'],
    ['', ''],
    ['NIGHTS', 'Each night, waves of wisps, darters and brutes march on the hearth. Survive all 7'],
    ['', 'nights and slay THE WHITEOUT HERALD on night 7 to win. After a win, ENDLESS unlocks.'],
    ['', ''],
    ['BETWEEN NIGHTS', 'Pick 1 of 3 draft cards (rarity matters, synergies stack), then spend embers in'],
    ['', 'the shop: fuel, repairs, spare braziers, rerolls, upgrades.'],
    ['', ''],
    ['ABILITIES', '1 — Kindle Burst: a ring of fire around you.   2 — Frost Ward: slow all enemies 5s.'],
    ['', 'Chain kills within 3 seconds to raise your combo (up to x8) for more score and embers.'],
  ];
  let y = 120;
  for (const [head, body] of lines) {
    if (head) text(ctx, head, 240, y, 16, PALETTE.gold, 'left', '800');
    text(ctx, body, head ? 420 : 240, y, 15, PALETTE.text, 'left', '600');
    y += 26;
  }
  drawButton(ctx, LAYOUT.howto.back, '←  BACK TO TITLE', '', false, false);
}

export function drawDraft(ctx, w, meta) {
  drawField(ctx, w, w.time);
  ctx.fillStyle = 'rgba(6, 10, 24, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, `NIGHT ${w.night - 1} CLEARED`, VIEW_W / 2, 52, 30, '#7ee081', 'center', '800');
  text(ctx, `Night ${w.night} is coming. Choose ONE draft card, then spend embers in the shop.`, VIEW_W / 2, 84, 15, PALETTE.textDim, 'center', '600');
  text(ctx, `◆ ${Math.floor(w.embers)} embers   ·   Hearth ${Math.ceil(w.hearth.hp)}/${w.hearth.maxHp} HP   ·   Fuel ${Math.ceil(w.fuel)}/${w.maxFuel}   ·   Score ${w.score}`, VIEW_W / 2, 112, 15, PALETTE.gold, 'center', '700');

  w.draftOptions.forEach((card, i) => {
    const r = LAYOUT.draft.cards[i];
    const picked = w.draftPicked === card.id;
    panel(ctx, r.x, r.y, r.w, r.h, picked ? '#7ee081' : rarityColor(card.rarity));
    text(ctx, card.rarity.toUpperCase(), r.x + r.w / 2, r.y + 26, 12, rarityColor(card.rarity), 'center', '800');
    text(ctx, card.name, r.x + r.w / 2, r.y + 62, 20, PALETTE.text, 'center', '800');
    wrapText(ctx, card.text, r.x + 22, r.y + 106, r.w - 44, 15, PALETTE.text);
    wrapText(ctx, card.note, r.x + 22, r.y + 176, r.w - 44, 13, PALETTE.textDim);
    if (picked) {
      text(ctx, '✓ CHOSEN', r.x + r.w / 2, r.y + r.h - 24, 15, '#7ee081', 'center', '800');
    } else {
      text(ctx, w.draftPicked ? '—' : `press ${i + 1} or click`, r.x + r.w / 2, r.y + r.h - 24, 13, PALETTE.textDim, 'center', '600');
    }
  });

  text(ctx, 'SHOP — spend embers', VIEW_W / 2, 432, 15, PALETTE.gold, 'center', '800');
  SHOP_ITEMS.forEach((item, i) => {
    const r = LAYOUT.draft.shop[i];
    const afford = w.embers >= item.cost;
    rr(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = afford ? '#232c42' : '#1a2236';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = afford ? '#8fa3c8' : '#4a5878';
    ctx.stroke();
    text(ctx, item.name, r.x + r.w / 2, r.y + 18, 14, afford ? PALETTE.text : PALETTE.textDim, 'center', '700');
    text(ctx, item.desc, r.x + r.w / 2, r.y + 38, 12, PALETTE.textDim, 'center', '600');
    text(ctx, `◆ ${item.cost}`, r.x + r.w / 2, r.y + 56, 12, afford ? PALETTE.gold : '#ff8d7d', 'center', '700');
  });
  if (w.shopLog.length > 0) {
    text(ctx, w.shopLog[w.shopLog.length - 1], VIEW_W / 2, 530, 13, '#7ee081', 'center', '600');
  }
  drawButton(ctx, LAYOUT.draft.continue, `▶  FACE NIGHT ${w.night}`, w.draftPicked ? '' : 'pick a card first', true, !w.draftPicked);
}

function wrapText(ctx, s, x, y, maxW, size, color) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, x, yy);
      line = word;
      yy += size + 6;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(line, x, yy);
  }
}

export function drawWin(ctx, w, meta, isNewBest) {
  drawField(ctx, w, w.time);
  ctx.fillStyle = 'rgba(6, 10, 24, 0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, '☀  DAWN BREAKS', VIEW_W / 2, 110, 52, '#ffd166', 'center', '800');
  text(ctx, '— the hearth endures —', VIEW_W / 2, 158, 22, PALETTE.text, 'center', '600');
  if (isNewBest) {
    panel(ctx, 540, 182, 200, 40, PALETTE.gold);
    text(ctx, '★ NEW BEST ★', 640, 202, 18, PALETTE.gold, 'center', '800');
  }
  const s = w.winStats;
  panel(ctx, 390, 240, 500, 190, PALETTE.gold);
  text(ctx, `GRADE  ${s.grade}`, 640, 276, 34, '#ffd166', 'center', '800');
  text(ctx, `Score ${s.score}  (fuel bonus +${s.fuelBonus})`, 640, 318, 17, PALETTE.text, 'center', '700');
  text(ctx, `Nights survived: ${s.night}  ·  Kills: ${s.kills}`, 640, 346, 15, PALETTE.textDim, 'center', '600');
  text(ctx, `Hearth left: ${s.hearthHp}/${s.hearthMax} HP  ·  Difficulty: ${s.difficulty === 'blizzard' ? 'BLIZZARD' : 'EMBER'}`, 640, 372, 15, PALETTE.textDim, 'center', '600');
  text(ctx, `Best score: ${meta.bestScore}  ·  Feats ${w.feats.size}/${FEATS.length}`, 640, 400, 15, PALETTE.textDim, 'center', '600');
  drawButton(ctx, LAYOUT.win.endless, '∞  ENDLESS MODE', 'the frost never stops', true, false);
  drawButton(ctx, LAYOUT.win.replay, '↻  REPLAY SEED', `same seed ${w.seed}`, false, false);
  drawButton(ctx, LAYOUT.win.title, 'TITLE SCREEN', '', false, false);
  text(ctx, 'Press R or click a button — Space also restarts', VIEW_W / 2, 660, 13, PALETTE.textDim, 'center', '600');
}

export function drawLose(ctx, w, meta) {
  drawField(ctx, w, w.time);
  ctx.fillStyle = 'rgba(6, 10, 24, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, '❄  THE FROST TAKES THE HEARTH', VIEW_W / 2, 130, 40, '#bfe3ff', 'center', '800');
  text(ctx, w.loseReason || 'The fire went out.', VIEW_W / 2, 178, 18, PALETTE.textDim, 'center', '600');
  panel(ctx, 390, 220, 500, 160, '#5f9fd0');
  text(ctx, `You reached Night ${w.night} of 7`, 640, 256, 20, PALETTE.text, 'center', '800');
  text(ctx, `Score ${w.score}  ·  Kills ${w.kills}  ·  Best ${meta.bestScore}`, 640, 292, 16, PALETTE.textDim, 'center', '600');
  text(ctx, `Feats unlocked: ${w.feats.size}/${FEATS.length}   ·   The hearth remembers. Try again.`, 640, 328, 14, PALETTE.textDim, 'center', '600');
  text(ctx, 'Tip: bank heat when the field is clear, stoke hard when the wave arrives.', 640, 356, 14, PALETTE.gold, 'center', '600');
  drawButton(ctx, LAYOUT.lose.restart, '↻  TRY AGAIN  (R)', 'a new seed, the same fire', true, false);
  text(ctx, 'Press R or Space, or click — the hearth relights', VIEW_W / 2, 600, 13, PALETTE.textDim, 'center', '600');
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, '❚❚  PAUSED', VIEW_W / 2, 260, 44, PALETTE.text, 'center', '800');
  text(ctx, 'The frost waits. The fire does not go out.', VIEW_W / 2, 306, 16, PALETTE.textDim, 'center', '600');
  drawButton(ctx, LAYOUT.pause.resume, '▶  RESUME  (P)', '', true, false);
  drawButton(ctx, LAYOUT.pause.restart, '↻  RESTART RUN  (R)', '', false, false);
  drawButton(ctx, LAYOUT.pause.quit, 'TITLE SCREEN', '', false, false);
}

export { inRect, panel, text, keycap, drawButton };

// EMBER VAULT — Canvas 2D renderer: night-vault floor, walls, crates, pillars, shadow
// zones, loot, the Ember Heart, the exit, guards with raycast vision cones, the hooded
// thief, particles, HUD, and the title / pause / caught / win screens.
import { TILE, VIEW_W, VIEW_H, GUARD } from './config.js';
import { hasLOS, tileAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 16;

function coneColor(g, alpha) {
  if (g.mode === 'chase') return `rgba(255,64,54,${alpha})`;
  if (g.mode === 'wary') return `rgba(255,176,32,${alpha})`;
  return `rgba(255,226,120,${alpha})`;
}

function rayLength(state, x, y, ang) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  for (let d = 8; d <= GUARD.range; d += 8) {
    const tx = Math.floor((x + dx * d) / TILE);
    const ty = Math.floor((y + dy * d) / TILE);
    if (tileAt(state, tx, ty) === 1 || tileAt(state, tx, ty) === 2 || tileAt(state, tx, ty) === 3) return d - 4;
  }
  return GUARD.range;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - VIEW_W * scale) / 2, (canvas.height - VIEW_H * scale) / 2);
  }

  function drawFloor(state, t) {
    for (let y = 0; y < state.rows; y += 1) {
      for (let x = 0; x < state.cols; x += 1) {
        const px = x * TILE;
        const py = y * TILE;
        const code = state.grid[y * state.cols + x];
        ctx.fillStyle = (x + y) % 2 ? '#131a2e' : '#10152a';
        ctx.fillRect(px, py, TILE, TILE);
        if (code === 4) {
          ctx.fillStyle = 'rgba(3,5,16,0.6)';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(90,120,220,0.10)';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        } else if (code === 1) {
          ctx.fillStyle = '#232a40';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#39415c';
          ctx.fillRect(px, py, TILE, 5);
          ctx.fillStyle = '#171c2e';
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
        } else if (code === 2) {
          ctx.fillStyle = '#5d4126';
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = '#3d2a16';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.beginPath();
          ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + TILE - 2, py + TILE - 2);
          ctx.moveTo(px + TILE - 2, py + 2); ctx.lineTo(px + 2, py + TILE - 2);
          ctx.stroke();
        } else if (code === 3) {
          ctx.fillStyle = '#3f4457';
          ctx.beginPath();
          ctx.arc(px + TILE / 2, py + TILE / 2, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#565d75';
          ctx.beginPath();
          ctx.arc(px + TILE / 2 - 2, py + TILE / 2 - 2, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    void t;
  }

  function drawExit(state, t) {
    const e = state.exit;
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.open) {
      ctx.fillStyle = `rgba(90,255,140,${0.25 + 0.2 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#12351d';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.fillStyle = '#7dff8a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', 0, -18);
      ctx.fillStyle = '#7dff8a';
      ctx.beginPath();
      ctx.moveTo(-6, -6); ctx.lineTo(6, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#1a2033';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.strokeStyle = '#4a5468';
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -13, 26, 26);
      ctx.fillStyle = '#8a93a8';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', 0, -18);
      ctx.fillStyle = '#c8a24a';
      ctx.fillRect(-3, -6, 6, 8);
      ctx.beginPath(); ctx.arc(0, 3, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawLoot(state, t) {
    for (const gem of state.gems) {
      if (gem.taken) continue;
      const pulse = 0.7 + 0.3 * Math.sin(t * 4 + gem.x);
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.fillStyle = `rgba(95,242,224,${0.18 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ff2e0';
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dffff9';
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(3, 0); ctx.lineTo(0, 5); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const h = state.heart;
    if (!h.taken) {
      const flick = 0.75 + 0.25 * Math.sin(t * 6) * Math.sin(t * 2.3);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = `rgba(255,122,60,${0.3 * flick})`;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(10, -2); ctx.lineTo(8, 10); ctx.lineTo(0, 13); ctx.lineTo(-8, 10); ctx.lineTo(-10, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 7); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawCone(state, g) {
    const half = GUARD.halfAngle;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = coneColor(g, g.mode === 'chase' ? 0.30 : g.mode === 'wary' ? 0.24 : 0.17);
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const ang = g.dir - half + (2 * half * i) / CONE_RAYS;
      const len = rayLength(state, g.x, g.y, ang);
      ctx.lineTo(g.x + Math.cos(ang) * len, g.y + Math.sin(ang) * len);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      drawCone(state, g);
      ctx.save();
      ctx.translate(g.x, g.y);
      // Body.
      ctx.fillStyle = '#1d2438';
      ctx.beginPath(); ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = g.mode === 'chase' ? '#ff4036' : g.mode === 'wary' ? '#ffb020' : '#5a6a8c';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Facing tick.
      ctx.strokeStyle = '#dfe6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(g.dir) * 15, Math.sin(g.dir) * 15);
      ctx.stroke();
      // Suspicion arc.
      if (g.suspicion > 1) {
        ctx.strokeStyle = g.mode === 'chase' ? '#ff4036' : '#ffb020';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
        ctx.stroke();
      }
      // Mark.
      if (g.mode === 'chase' || g.mode === 'wary') {
        ctx.fillStyle = g.mode === 'chase' ? '#ff4036' : '#ffb020';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.mode === 'chase' ? '!' : '?', 0, -22);
      }
      ctx.restore();
    }
  }

  function drawPlayer(state, t) {
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Ground shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 7, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Cloak.
    ctx.fillStyle = p.hidden ? '#1d4a4a' : '#14524a';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b2e2a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood.
    ctx.fillStyle = '#0e3a34';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7, 2);
    ctx.lineTo(-7, 2);
    ctx.closePath();
    ctx.fill();
    // Face + direction.
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath(); ctx.arc(Math.cos(p.dir) * 3, Math.sin(p.dir) * 3 - 1, 3, 0, Math.PI * 2); ctx.fill();
    if (p.hidden) {
      ctx.strokeStyle = 'rgba(120,200,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 16 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9fd8ff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', 0, -20);
    }
    ctx.restore();
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(state, totalScore) {
    ctx.fillStyle = 'rgba(5,7,16,0.82)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.fillStyle = '#e8ecff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.level.name, 12, 22);
    ctx.fillStyle = '#5ff2e0';
    ctx.fillText(`◆ ${state.loot}/${state.lootTotal}`, 250, 22);
    ctx.fillStyle = state.heart.taken ? '#ff7a3c' : '#5a6276';
    ctx.fillText(state.heart.taken ? '♥ EMBER' : '♡ EMBER', 350, 22);
    const m = Math.floor(state.time / 60);
    const s = Math.floor(state.time % 60);
    ctx.fillStyle = '#e8ecff';
    ctx.textAlign = 'right';
    ctx.fillText(`${m}:${String(s).padStart(2, '0')}`, 560, 22);
    // Suspicion eye + bar.
    const sus = state.suspicion;
    ctx.textAlign = 'left';
    ctx.fillStyle = sus >= 100 ? '#ff4036' : sus >= 35 ? '#ffb020' : '#8a93a8';
    ctx.fillText('◉', 580, 22);
    ctx.fillStyle = '#222a44';
    ctx.fillRect(602, 11, 130, 12);
    ctx.fillStyle = sus >= 100 ? '#ff4036' : sus >= 35 ? '#ffb020' : '#3fae6a';
    ctx.fillRect(602, 11, Math.max(0, Math.min(130, (sus / 100) * 130)), 12);
    ctx.fillStyle = '#e8ecff';
    ctx.textAlign = 'right';
    ctx.fillText(`${totalScore}`, VIEW_W - 12, 22);
    if (state.alert) {
      ctx.fillStyle = `rgba(255,64,54,${0.65 + 0.35 * Math.sin(state.time * 10)})`;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED — BREAK LINE OF SIGHT!', VIEW_W / 2, 62);
    } else if (state.message) {
      ctx.fillStyle = '#ffd9a0';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW_W / 2, 62);
    }
    void hasLOS;
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4,6,14,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText(title, VIEW_W / 2, 210);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '16px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 260 + i * 28));
  }

  function draw(state, screen, best, totalScore, t) {
    fit();
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawFloor(state, t);
    drawExit(state, t);
    drawLoot(state, t);
    drawGuards(state);
    drawPlayer(state, t);
    drawParticles(state);
    // Vignette.
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 280, VIEW_W / 2, VIEW_H / 2, 640);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state, totalScore);
    if (screen === SCREEN_TITLE) {
      overlay('EMBER VAULT', [
        'A top-down stealth heist. Steal the Ember Heart. Reach the exit unseen.',
        'WASD / arrows — move    Shift — sprint (louder)    P — pause    M — mute',
        'Stay out of the guards’ vision cones. Shadows hide you. Crates block sight.',
        'Patience pays: watch the patrols, slip through when a cone turns away.',
        '',
        'Press ENTER or click to begin',
        best > 0 ? `Best score: ${best}` : '',
      ], '#ffb020');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Enter to resume', 'R — restart this level'], '#e8ecff');
    } else if (screen === SCREEN_CAUGHT) {
      overlay('CAUGHT!', [
        `${state.level.name} — spotted by a guard.`,
        `Loot: ${state.loot}/${state.lootTotal}    Time: ${Math.floor(state.time)}s    Score: ${totalScore}`,
        'The vault keeps its secrets… this time.',
        '',
        'Press R or Enter to try again',
      ], '#ff4036');
    } else if (screen === SCREEN_WIN) {
      const last = state.levelIndex === 2;
      overlay(last ? 'ALL VAULTS CLEARED' : 'VAULT CLEARED', [
        last ? 'You stole every Ember Heart and vanished into the night.' : `${state.level.name} — the Ember Heart is yours.`,
        `Time: ${Math.floor(state.time)}s    Loot: ${state.loot}/${state.lootTotal}    Score: ${totalScore}`,
        last ? 'Press Enter for the title screen' : 'Press Enter for the next vault',
        best > 0 ? `Best score: ${best}` : '',
      ], '#7dff8a');
    }
  }

  return { draw };
}

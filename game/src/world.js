// EMBER VAULT — pure game logic (no DOM, no canvas): movement, patrols, vision cones,
// line of sight, suspicion, alert/chase, loot, win/lose. Importable from Node for tests.
import { TILE, PLAYER, GUARD, DETECT, SCORE, LEVELS } from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_HEART = 2;
export const EVENT_ALERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;
export const EVENT_CALM = 32;
export const EVENT_LOCKED = 64;

// Grid codes: 0 floor, 1 wall, 2 crate, 3 pillar, 4 shadow floor.
const SOLID = [false, true, true, true, false];
const BLOCKS_SIGHT = [false, true, true, true, false];

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function tileAt(state, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= state.cols || ty >= state.rows) return 1;
  return state.grid[ty * state.cols + tx];
}

export function hasLOS(state, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (BLOCKS_SIGHT[tileAt(state, tx, ty)]) return false;
  }
  return true;
}

export function guardSees(state, g) {
  const p = state.player;
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.range) return 0;
  if (angDiff(Math.atan2(dy, dx), g.dir) > GUARD.halfAngle) return 0;
  if (!hasLOS(state, g.x, g.y, p.x, p.y)) return 0;
  return dist;
}

function moveCircle(state, e, dx, dy, r) {
  // Axis-separated AABB move against solid tiles.
  let nx = e.x + dx;
  if (dx !== 0) {
    const top = Math.floor((e.y - r) / TILE);
    const bot = Math.floor((e.y + r) / TILE);
    const edge = dx > 0 ? nx + r : nx - r;
    const tx = Math.floor(edge / TILE);
    let blocked = false;
    for (let ty = top; ty <= bot; ty += 1) if (SOLID[tileAt(state, tx, ty)]) { blocked = true; break; }
    if (blocked) nx = dx > 0 ? tx * TILE - r - 0.01 : (tx + 1) * TILE + r + 0.01;
  }
  let ny = e.y + dy;
  if (dy !== 0) {
    const left = Math.floor((nx - r) / TILE);
    const right = Math.floor((nx + r) / TILE);
    const edge = dy > 0 ? ny + r : ny - r;
    const ty = Math.floor(edge / TILE);
    let blocked = false;
    for (let tx = left; tx <= right; tx += 1) if (SOLID[tileAt(state, tx, ty)]) { blocked = true; break; }
    if (blocked) ny = dy > 0 ? ty * TILE - r - 0.01 : (ty + 1) * TILE + r + 0.01;
  }
  e.x = nx;
  e.y = ny;
}

function burst(state, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 90;
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, max: 0.8, color });
  }
}

export function createWorld(random) {
  const state = {
    levelIndex: 0, level: null, grid: null, cols: 0, rows: 0,
    player: { x: 0, y: 0, dir: 0, moving: false, sprinting: false, hidden: false, shadow: false },
    guards: [], gems: [], heart: { x: 0, y: 0, taken: false },
    exit: { x: 0, y: 0, open: false },
    loot: 0, lootTotal: 0, time: 0, score: 0,
    status: 'playing', suspicion: 0, alert: false,
    message: '', messageTimer: 0, particles: [], random,
  };

  function reset(levelIndex) {
    const level = LEVELS[levelIndex % LEVELS.length];
    const rows = level.map.length;
    const cols = level.map[0].length;
    const grid = new Uint8Array(cols * rows);
    state.levelIndex = levelIndex % LEVELS.length;
    state.level = level;
    state.cols = cols;
    state.rows = rows;
    state.grid = grid;
    state.guards = [];
    state.gems = [];
    state.loot = 0;
    state.time = 0;
    state.score = 0;
    state.status = 'playing';
    state.suspicion = 0;
    state.alert = false;
    state.message = '';
    state.messageTimer = 0;
    state.particles = [];
    const cx = (tx) => (tx + 0.5) * TILE;
    const cy = (ty) => (ty + 0.5) * TILE;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const ch = level.map[y][x];
        if (ch === '#') grid[y * cols + x] = 1;
        else if (ch === 'C') grid[y * cols + x] = 2;
        else if (ch === 'P') grid[y * cols + x] = 3;
        else if (ch === ',') grid[y * cols + x] = 4;
        else if (ch === 'G') { grid[y * cols + x] = 0; state.gems.push({ x: cx(x), y: cy(y), taken: false }); }
        else if (ch === 'H') { grid[y * cols + x] = 0; state.heart = { x: cx(x), y: cy(y), taken: false }; }
        else if (ch === 'E') { grid[y * cols + x] = 0; state.exit = { x: cx(x), y: cy(y), open: false }; }
        else if (ch === 'T') { grid[y * cols + x] = 0; state.player = { x: cx(x), y: cy(y), dir: 0, moving: false, sprinting: false, hidden: false, shadow: false }; }
        else grid[y * cols + x] = 0;
      }
    }
    state.lootTotal = state.gems.length + 1;
    level.guards.forEach((g) => {
      const wps = g.waypoints.map(([wx, wy]) => ({ x: cx(wx), y: cy(wy) }));
      const first = wps[0];
      const second = wps[1] || wps[0];
      state.guards.push({
        x: first.x, y: first.y, dir: Math.atan2(second.y - first.y, second.x - first.x),
        baseDir: 0, wpIndex: 1, pause: 0, speed: g.speed, pauseTime: g.pause,
        suspicion: 0, mode: 'patrol', loseTimer: 0, seenX: 0, seenY: 0, scanT: random() * 6,
      });
    });
  }

  function step(dt, input, demo) {
    let events = 0;
    // Particles always animate.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
      if (state.messageTimer <= 0) state.message = '';
    }
    if (state.status !== 'playing') return events;
    state.time += dt;
    const p = state.player;

    // --- player ---
    let ix = input.x || 0;
    let iy = input.y || 0;
    const mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; }
    p.moving = mag > 0.1;
    p.sprinting = !!input.sprint && p.moving;
    if (p.moving) {
      const speed = p.sprinting ? PLAYER.sprint : PLAYER.walk;
      p.dir = Math.atan2(iy, ix);
      moveCircle(state, p, ix * speed * dt, iy * speed * dt, PLAYER.radius);
    }
    const pTile = tileAt(state, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    p.shadow = pTile === 4;

    // --- pickups ---
    for (const gem of state.gems) {
      if (!gem.taken && Math.hypot(gem.x - p.x, gem.y - p.y) < 24) {
        gem.taken = true;
        state.loot += 1;
        state.score += SCORE.gem;
        burst(state, gem.x, gem.y, '#5ff2e0', 10);
        events |= EVENT_PICKUP;
      }
    }
    if (!state.heart.taken && Math.hypot(state.heart.x - p.x, state.heart.y - p.y) < 26) {
      state.heart.taken = true;
      state.loot += 1;
      state.score += SCORE.heart;
      state.exit.open = true;
      burst(state, state.heart.x, state.heart.y, '#ff7a3c', 22);
      events |= EVENT_HEART;
    }
    if (Math.hypot(state.exit.x - p.x, state.exit.y - p.y) < 24) {
      if (state.heart.taken) {
        state.status = 'won';
        state.score += Math.max(0, Math.round((state.level.par - state.time) * SCORE.timeBonus));
        burst(state, state.exit.x, state.exit.y, '#7dff8a', 26);
        events |= EVENT_WIN;
        return events;
      }
      if (state.messageTimer <= 0) {
        state.message = 'Sealed — steal the Ember Heart first.';
        state.messageTimer = 2.2;
        events |= EVENT_LOCKED;
      }
    }

    // --- guards ---
    let maxSuspicion = 0;
    let anyAlert = false;
    let anySees = false;
    for (const g of state.guards) {
      const dist = demo ? 0 : guardSees(state, g);
      const sees = dist > 0;
      if (sees) { anySees = true; g.seenX = p.x; g.seenY = p.y; }
      if (!demo) {
        if (sees) {
          let rate = DETECT.base * (DETECT.closeBonus + 1 - dist / GUARD.range);
          if (rate < 12) rate = 12;
          if (p.shadow) rate *= DETECT.shadowMul;
          if (p.sprinting) rate *= DETECT.sprintMul;
          g.suspicion = Math.min(100, g.suspicion + rate * dt);
        } else {
          g.suspicion = Math.max(0, g.suspicion - DETECT.decay * dt);
        }
        if (g.suspicion >= DETECT.alertAt && g.mode !== 'chase') {
          g.mode = 'chase';
          g.loseTimer = 0;
          events |= EVENT_ALERT;
        } else if (g.suspicion >= DETECT.waryAt && g.mode === 'patrol') {
          g.mode = 'wary';
        } else if (g.suspicion < DETECT.waryAt && g.mode === 'wary') {
          g.mode = 'patrol';
        }
      }
      if (g.mode === 'chase') {
        anyAlert = true;
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const d = Math.hypot(dx, dy) || 1;
        g.dir = Math.atan2(dy, dx);
        moveCircle(state, g, (dx / d) * GUARD.chaseSpeed * dt, (dy / d) * GUARD.chaseSpeed * dt, GUARD.radius);
        if (d < GUARD.catchDist) {
          state.status = 'caught';
          events |= EVENT_CAUGHT;
          return events;
        }
        if (!sees) {
          g.loseTimer += dt;
          if (g.loseTimer > DETECT.loseSight) {
            g.mode = 'patrol';
            g.suspicion = DETECT.waryAt + 10;
            let best = 0;
            let bestD = Infinity;
            g.wpIndex = 0;
            state.level.guards.forEach((_, i) => { void i; });
            // Return to the nearest waypoint of this guard's route.
            const route = state.level.guards[state.guards.indexOf(g)].waypoints;
            route.forEach(([wx, wy], i) => {
              const dd = Math.hypot((wx + 0.5) * TILE - g.x, (wy + 0.5) * TILE - g.y);
              if (dd < bestD) { bestD = dd; best = i; }
            });
            g.wpIndex = best;
            events |= EVENT_CALM;
          }
        } else g.loseTimer = 0;
      } else if (g.mode === 'wary') {
        g.dir = Math.atan2(g.seenY - g.y, g.seenX - g.x);
      } else {
        // Patrol: walk the waypoints, pause and scan at each.
        const route = state.level.guards[state.guards.indexOf(g)].waypoints;
        const target = { x: (route[g.wpIndex][0] + 0.5) * TILE, y: (route[g.wpIndex][1] + 0.5) * TILE };
        if (g.pause > 0) {
          g.pause -= dt;
          g.scanT += dt;
          g.dir = g.baseDir + Math.sin(g.scanT * 1.4) * 0.85;
          if (g.pause <= 0) g.wpIndex = (g.wpIndex + 1) % route.length;
        } else {
          const dx = target.x - g.x;
          const dy = target.y - g.y;
          const d = Math.hypot(dx, dy);
          if (d < 5) {
            g.x = target.x;
            g.y = target.y;
            g.pause = g.pauseTime;
            g.baseDir = g.dir;
          } else {
            g.dir = Math.atan2(dy, dx);
            moveCircle(state, g, (dx / d) * g.speed * dt, (dy / d) * g.speed * dt, GUARD.radius);
          }
        }
      }
      if (g.suspicion > maxSuspicion) maxSuspicion = g.suspicion;
    }
    state.suspicion = maxSuspicion;
    state.alert = anyAlert;
    p.hidden = p.shadow && !anySees;
    return events;
  }

  return { state, reset, step };
}

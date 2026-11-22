// Node play-test for EMBER VAULT world logic (no browser needed).
// Run: node tools/test-world.mjs
import { createRandom } from '../game/src/random.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_HEART, EVENT_PICKUP, EVENT_WIN, tileAt } from '../game/src/world.js';
import { LEVELS, STEP, TILE } from '../game/src/config.js';

let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) { pass += 1; console.log(`ok ${name}`); }
  else { fail += 1; console.log(`FAIL ${name}`); }
}
const world = createWorld(createRandom(1));
const S = () => world.state;

// --- level data validation ---
for (let li = 0; li < LEVELS.length; li += 1) {
  const level = LEVELS[li];
  check(`L${li + 1} rows all 30 wide`, level.map.every((r) => r.length === 30) && level.map.length === 20);
  world.reset(li);
  const s = S();
  // Flood fill from player start over walkable tiles.
  const seen = new Set();
  const start = [Math.floor(s.player.x / TILE), Math.floor(s.player.y / TILE)];
  const q = [start];
  seen.add(start.join(','));
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!seen.has(key) && tileAt(s, nx, ny) !== 1 && tileAt(s, nx, ny) !== 2 && tileAt(s, nx, ny) !== 3) {
        seen.add(key);
        q.push([nx, ny]);
      }
    }
  }
  const reach = (tx, ty) => seen.has(`${tx},${ty}`);
  const heartTile = [Math.floor(s.heart.x / TILE), Math.floor(s.heart.y / TILE)];
  const exitTile = [Math.floor(s.exit.x / TILE), Math.floor(s.exit.y / TILE)];
  check(`L${li + 1} heart reachable`, reach(...heartTile));
  check(`L${li + 1} exit reachable`, reach(...exitTile));
  check(`L${li + 1} all gems reachable`, s.gems.every((g) => reach(Math.floor(g.x / TILE), Math.floor(g.y / TILE))));
  // Waypoint segments must not cross solid tiles.
  let segsOk = true;
  for (const g of level.guards) {
    for (let i = 0; i < g.waypoints.length; i += 1) {
      const a = g.waypoints[i];
      const b = g.waypoints[(i + 1) % g.waypoints.length];
      const ax = (a[0] + 0.5) * TILE;
      const ay = (a[1] + 0.5) * TILE;
      const bx = (b[0] + 0.5) * TILE;
      const by = (b[1] + 0.5) * TILE;
      const dist = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d <= dist; d += 8) {
        const t = d / dist;
        const tx = Math.floor((ax + (bx - ax) * t) / TILE);
        const ty = Math.floor((ay + (by - ay) * t) / TILE);
        const code = tileAt(s, tx, ty);
        if (code === 1 || code === 2 || code === 3) { segsOk = false; console.log(`  blocked segment L${li + 1} (${a})->(${b}) at tile ${tx},${ty}`); }
      }
    }
  }
  check(`L${li + 1} guard patrol segments clear`, segsOk);
}

// --- behaviour tests on level 1 ---
world.reset(0);
let s = S();
// 1. Standing in a guard's cone raises suspicion. (Hold the guard in wary mode,
// pre-seeded above the wary threshold, so its facing stays on the player.)
world.reset(0);
s = S();
const g0 = s.guards[0];
g0.x = (2 + 0.5) * TILE;
g0.y = (4 + 0.5) * TILE;
g0.mode = 'wary';
g0.suspicion = 36;
g0.seenX = (7 + 0.5) * TILE;
g0.seenY = (4 + 0.5) * TILE;
s.player.x = (7 + 0.5) * TILE;
s.player.y = (4 + 0.5) * TILE;
for (let i = 0; i < 60; i += 1) world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('suspicion rises inside cone', g0.suspicion > 36 + 15);
// 2. Leaving the cone lets suspicion decay.
const peaked = g0.suspicion;
s.player.x = (2 + 0.5) * TILE;
s.player.y = (18 + 0.5) * TILE;
for (let i = 0; i < 180; i += 1) world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('suspicion decays out of sight', g0.suspicion < peaked - 10);
// 3. Shadow slows detection: same geometry, same distance, shadow vs lit floor.
function shadowRate(useShadow) {
  world.reset(0);
  const st = S();
  const g = st.guards[0];
  g.x = (3 + 0.5) * TILE;
  g.y = (7 + 0.5) * TILE;
  g.mode = 'wary';
  g.suspicion = 40;
  const py = useShadow ? (9 + 0.5) * TILE : (7 + 0.5) * TILE;
  const px = useShadow ? (3 + 0.5) * TILE : (1 + 0.5) * TILE;
  g.seenX = px;
  g.seenY = py;
  st.player.x = px;
  st.player.y = py;
  world.step(STEP, { x: 0, y: 0, sprint: false }, false);
  const onShadow = st.player.shadow;
  for (let i = 0; i < 30; i += 1) world.step(STEP, { x: 0, y: 0, sprint: false }, false);
  return { sus: g.suspicion, onShadow };
}
const sh = shadowRate(true);
const li = shadowRate(false);
check(`shadow slows detection (shadow ${sh.sus.toFixed(1)} < lit ${li.sus.toFixed(1)})`, sh.onShadow && !li.onShadow && sh.sus < li.sus - 5);
// 4. Gem pickup.
world.reset(0);
s = S();
const gem = s.gems[0];
s.player.x = gem.x;
s.player.y = gem.y;
const ev1 = world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('gem pickup fires + loot counts', (ev1 & EVENT_PICKUP) !== 0 && s.loot === 1);
// 5. Heart opens the exit; exit without heart does not win.
world.reset(0);
s = S();
s.player.x = s.exit.x;
s.player.y = s.exit.y;
world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('exit locked before heart', s.status === 'playing' && !s.exit.open);
s.player.x = s.heart.x;
s.player.y = s.heart.y;
const ev2 = world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('heart pickup opens exit', (ev2 & EVENT_HEART) !== 0 && s.exit.open);
s.player.x = s.exit.x;
s.player.y = s.exit.y;
const ev3 = world.step(STEP, { x: 0, y: 0, sprint: false }, false);
check('reaching open exit wins', (ev3 & EVENT_WIN) !== 0 && s.status === 'won');
// 6. Full alert -> caught.
world.reset(0);
s = S();
const g = s.guards[0];
g.x = (14 + 0.5) * TILE; g.y = (4 + 0.5) * TILE; g.dir = Math.PI / 2; g.mode = 'patrol'; g.suspicion = 99;
s.player.x = (14 + 0.5) * TILE;
s.player.y = (6 + 0.5) * TILE;
let sawAlert = false;
let sawCaught = false;
for (let i = 0; i < 60 * 8 && !sawCaught; i += 1) {
  const ev = world.step(STEP, { x: 0, y: 0, sprint: false }, false);
  if (ev & EVENT_ALERT) sawAlert = true;
  if (ev & EVENT_CAUGHT) sawCaught = true;
}
check('alert fires then guard catches a stationary thief', sawAlert && sawCaught);
// 7. Breaking line of sight calms an alert.
world.reset(0);
s = S();
const g2 = s.guards[0];
g2.x = (14 + 0.5) * TILE; g2.y = (4 + 0.5) * TILE; g2.dir = Math.PI / 2; g2.mode = 'chase'; g2.suspicion = 100; g2.loseTimer = 0;
s.player.x = (2 + 0.5) * TILE; // far away, behind the wall block at x 4-5? (2,18) is open floor, out of range
s.player.y = (18 + 0.5) * TILE;
let calmed = false;
for (let i = 0; i < 60 * 6; i += 1) {
  world.step(STEP, { x: 0, y: 0, sprint: false }, false);
  if (g2.mode === 'patrol') { calmed = true; break; }
}
check('alert cools down after losing sight', calmed && s.status === 'playing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

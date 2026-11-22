// Screenshot scenes behind ?shot=start|play|loot|win. Each stages a real world state
// (real guards patrolling, real cones, real loot) and returns the screen to draw, so the
// frame is what the game really looks like — same seed, same frame.
import { TILE, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

function demoRun(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, { x: 0, y: 0, sprint: false }, true);
}

export function stageShot(name, world) {
  const s = world.state;
  if (name === 'play') {
    world.reset(0);
    demoRun(world, 3);
    // Near-miss: the thief crouches just past a turning cone, one gem already pocketed.
    s.player.x = (17 + 0.5) * TILE;
    s.player.y = (6 + 0.5) * TILE;
    s.player.dir = Math.PI;
    const g = s.guards[0];
    g.x = (17 + 0.5) * TILE;
    g.y = (4 + 0.5) * TILE;
    g.dir = Math.PI / 2;
    g.suspicion = 45;
    g.mode = 'wary';
    g.seenX = s.player.x;
    g.seenY = s.player.y;
    if (!s.gems[0].taken) { s.gems[0].taken = true; s.loot = 1; }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'loot') {
    world.reset(0);
    demoRun(world, 6);
    // The thief beside the Ember Heart, a guard's cone sweeping in from above.
    s.player.x = (12 + 0.5) * TILE;
    s.player.y = (14 + 0.5) * TILE;
    s.player.dir = Math.PI / 2;
    const g = s.guards[1];
    g.x = (12 + 0.5) * TILE;
    g.y = (11 + 0.5) * TILE;
    g.dir = Math.PI / 2;
    g.suspicion = 25;
    g.mode = 'wary';
    g.seenX = s.player.x;
    g.seenY = s.player.y;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    world.reset(0);
    s.heart.taken = true;
    s.exit.open = true;
    s.loot = s.lootTotal;
    s.score = 1100;
    s.time = 61.4;
    s.status = 'won';
    return { screen: SCREEN_WIN, best: 1100 };
  }
  // Default: title over a living level.
  world.reset(0);
  demoRun(world, 5);
  return { screen: SCREEN_TITLE, best: 0 };
}

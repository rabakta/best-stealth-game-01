// EMBER VAULT — boot and the one loop: input every frame, the world advances in fixed
// 1/60 s steps, the renderer paints what is there. Screens: title, play, paused, caught, win.
//
// ?seed=N fixes the run. ?shot=start|play|loot|win (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LEVELS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALERT, EVENT_CALM, EVENT_CAUGHT, EVENT_HEART, EVENT_LOCKED, EVENT_PICKUP, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.best, 1.2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let runScore = 0;
  let accumulator = 0;
  let last = performance.now();
  let stepTimer = 0;
  world.reset(0);

  function announce(message) {
    status.textContent = message;
  }

  function startLevel(index) {
    world.reset(index);
    runScore = index === 0 ? 0 : runScore;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Steal the Ember Heart.`);
  }

  function endCaught() {
    screen = SCREEN_CAUGHT;
    announce(`Caught. Loot ${world.state.loot} of ${world.state.lootTotal}.`);
  }

  function endWin() {
    runScore += world.state.score;
    if (runScore > best) {
      best = runScore;
      saveBest(best);
    }
    screen = SCREEN_WIN;
    announce(`Vault cleared. Score ${runScore}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HEART) audio.heart();
    if (events & EVENT_ALERT) audio.alarm();
    if (events & EVENT_CALM) audio.calm();
    if (events & EVENT_CAUGHT) { audio.caught(); endCaught(); }
    if (events & EVENT_WIN) { audio.win(); endWin(); }
    if (events & EVENT_LOCKED) audio.locked();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_CONFIRM) audio.ensure();
    if (actions & ACTION_RESTART && (screen === SCREEN_CAUGHT || screen === SCREEN_PLAY)) {
      audio.click();
      startLevel(world.state.levelIndex);
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      audio.ensure();
      audio.click();
      startLevel(0);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) {
      audio.click();
      startLevel(world.state.levelIndex);
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) {
      audio.click();
      if (world.state.levelIndex >= LEVELS.length - 1) {
        runScore = 0;
        world.reset(0);
        screen = SCREEN_TITLE;
      } else startLevel(world.state.levelIndex + 1);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const dir = input.direction();
        const events = world.step(STEP, dir, false);
        if (world.state.player.moving) {
          stepTimer -= STEP;
          if (stepTimer <= 0) {
            audio.step();
            stepTimer = world.state.player.sprinting ? 0.2 : 0.3;
          }
        }
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sprint: false }, true);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, runScore + world.state.score, now / 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // For automated play-tests.
  window.__game = { world, get screen() { return screen; } };

  announce('EMBER VAULT. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

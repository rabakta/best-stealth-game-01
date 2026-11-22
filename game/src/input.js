// Keyboard + mouse input. WASD/arrows move, Shift sprint, Enter/Space confirm,
// P/Esc pause, R restart, M mute, click confirms.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Enter: 'confirm', Space: 'confirm',
  KeyP: 'pause', Escape: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  function onKey(e, down) {
    const name = KEYS[e.code];
    if (!name) return;
    if (name === 'confirm' || name === 'pause' || name === 'restart' || name === 'mute') {
      if (down) {
        if (name === 'confirm') actions |= ACTION_CONFIRM;
        else if (name === 'pause') actions |= ACTION_PAUSE;
        else if (name === 'restart') actions |= ACTION_RESTART;
        else actions |= ACTION_MUTE;
      }
    } else if (down) held.add(name);
    else held.delete(name);
    e.preventDefault();
  }
  const keyDown = (e) => onKey(e, true);
  const keyUp = (e) => onKey(e, false);
  const click = () => { actions |= ACTION_CONFIRM; };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointerdown', click);
  return {
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      return { x, y, sprint: held.has('sprint') };
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}

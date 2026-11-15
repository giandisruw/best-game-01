// Keyboard + mouse, nothing else: WASD/arrows move, the mouse aims, holding the
// mouse (or Space) fires, Shift or right-click dashes, P pauses, M mutes, R restarts.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

/** Reads live input from the canvas and hands the world one frame of intent. */
export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let firing = false;
  let dashQueued = false;
  const aim = { x: 640, y: 300 };

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyOf(event);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'Enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'P' || key === 'Escape') actions |= ACTION_PAUSE;
    if (key === 'm' || key === 'M') actions |= ACTION_MUTE;
    if (key === 'r' || key === 'R') actions |= ACTION_RESTART;
    if (key === 'Shift') dashQueued = true;
    if (key === ' ') firing = true;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(keyOf(event));
    if (event.key === ' ') firing = false;
  });
  window.addEventListener('blur', () => {
    keys.clear();
    firing = false;
  });

  function aimFrom(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    aim.x = (event.clientX - rect.left) * scaleX;
    aim.y = (event.clientY - rect.top) * scaleY;
  }
  canvas.addEventListener('mousemove', aimFrom);
  canvas.addEventListener('mousedown', (event) => {
    aimFrom(event);
    if (event.button === 0) {
      firing = true;
      actions |= ACTION_CONFIRM;
    } else if (event.button === 2) dashQueued = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  /** -1, 0 or 1 on each axis, from WASD or the arrow keys. */
  function direction() {
    const left = keys.has('a') || keys.has('ArrowLeft');
    const right = keys.has('d') || keys.has('ArrowRight');
    const up = keys.has('w') || keys.has('ArrowUp');
    const down = keys.has('s') || keys.has('ArrowDown');
    return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
  }

  /** Actions pressed since the last call, then cleared. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  /** A dash request since the last call, then cleared. */
  function takeDash() {
    const taken = dashQueued;
    dashQueued = false;
    return taken;
  }

  return { direction, takeActions, takeDash, aim, isFiring: () => firing };
}

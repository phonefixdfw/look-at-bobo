// Keyboard + mouse for the first-person slice (step 6). Pure state, no
// rendering, no Three.js. The slice is deterministic: mouse deltas
// accumulate in events and are consumed ONCE per fixed simulation step,
// so an unattended run (capture, selfTest, two-process determinism)
// always sees the same input stream. Pointer lock is the real pointer
// path but nothing here requires it — captures drive the camera through
// the game's state API instead.

const KEY_MAP = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  ShiftLeft: "run", ShiftRight: "run",
};

export function createInput({ dom = document, canvas = null } = {}) {
  const keys = Object.create(null);
  let lookDx = 0;
  let lookDy = 0;
  const actions = []; // "point" | "pause" | "resume"
  let locked = false;
  const lockListeners = [];
  const errorListeners = [];

  const target = canvas ?? dom.body;

  function onKeyDown(event) {
    const role = KEY_MAP[event.code];
    if (role) {
      keys[role] = true;
      if (event.code.startsWith("Arrow")) event.preventDefault();
    }
  }
  function onKeyUp(event) {
    const role = KEY_MAP[event.code];
    if (role) keys[role] = false;
  }
  function onMouseMove(event) {
    if (!locked) return; // free cursor does not steer the game
    lookDx += event.movementX ?? 0;
    lookDy += event.movementY ?? 0;
  }
  function onMouseDown(event) {
    if (event.button === 0 && locked) actions.push("point");
  }
  function onLockChange() {
    locked = dom.pointerLockElement === target;
    if (!locked) {
      for (const k of Object.keys(keys)) keys[k] = false; // drop keys on unlock
      lookDx = 0;
      lookDy = 0; // deltas from a stale cursor must never bank into the next lock
      actions.push("pause");
    }
    for (const fn of lockListeners) fn(locked);
  }
  function onLockError() {
    // requestPointerLock failed (Chrome refuses an instant re-lock after
    // Esc, iframes, tab-hidden): the caller stays paused and lets the user
    // ask again. State first: a failed grab must not leave keys or look held.
    for (const k of Object.keys(keys)) keys[k] = false;
    lookDx = 0;
    lookDy = 0;
    for (const fn of errorListeners) fn();
  }
  function onBlur() {
    // Alt-Tab / window switch: key-up never arrives, so drop every held key
    // (the classic "player keeps walking after refocus") and ask to pause.
    for (const k of Object.keys(keys)) keys[k] = false;
    lookDx = 0;
    lookDy = 0;
    actions.push("pause");
  }
  function onContextMenu(event) {
    event.preventDefault(); // right-click shouldn't leave the game view
  }

  dom.addEventListener("keydown", onKeyDown);
  dom.addEventListener("keyup", onKeyUp);
  dom.addEventListener("mousemove", onMouseMove);
  dom.addEventListener("mousedown", onMouseDown);
  dom.addEventListener("pointerlockchange", onLockChange);
  dom.addEventListener("pointerlockerror", onLockError);
  dom.addEventListener("blur", onBlur);
  const win = dom.defaultView; // window blur does not bubble; listen where it fires
  win?.addEventListener?.("blur", onBlur);
  target?.addEventListener?.("contextmenu", onContextMenu);

  return {
    isDown: (role) => keys[role] === true,
    // Consume accumulated look once per step (drift-free under capture).
    takeLook() {
      const l = { dx: lookDx, dy: lookDy };
      lookDx = 0;
      lookDy = 0;
      return l;
    },
    consumeActions() {
      return actions.splice(0, actions.length);
    },
    queueAction(a) {
      actions.push(a);
    },
    lock() {
      if (!locked) target?.requestPointerLock?.();
    },
    unlock() {
      if (locked) dom.exitPointerLock?.();
    },
    isLocked: () => locked,
    onLockChange(fn) {
      lockListeners.push(fn);
    },
    onLockError(fn) {
      errorListeners.push(fn);
    },
    reset() {
      for (const k of Object.keys(keys)) delete keys[k];
      lookDx = 0;
      lookDy = 0;
      actions.length = 0;
    },
    destroy() {
      dom.removeEventListener("keydown", onKeyDown);
      dom.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("mousemove", onMouseMove);
      dom.removeEventListener("mousedown", onMouseDown);
      dom.removeEventListener("pointerlockchange", onLockChange);
      target?.removeEventListener?.("contextmenu", onContextMenu);
    },
  };
}

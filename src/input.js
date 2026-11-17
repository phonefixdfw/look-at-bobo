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
  // Issue #25: roles held by the touch controller (virtual stick). Separate
  // from `keys` so a blur/unlock that drops real keys never drops the stick
  // mid-step (the controller releases it explicitly), and so the desktop
  // keyboard path below stays byte-for-byte what it always was.
  const virtual = Object.create(null);
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
    isDown: (role) => keys[role] === true || virtual[role] === true,
    /** Issue #25: the touch stick presses "keys" without a keyboard. Same
     *  roles the keyboard map uses (forward/back/left/right/run). */
    setVirtual(role, on) {
      if (on) virtual[role] = true;
      else delete virtual[role];
    },
    /** Issue #25: accumulate look from a finger drag, in pixels (the same
     *  unit mouse deltas are in — stepPlayer applies sensitivity + invertY
     *  to touch look exactly as it does to mouse look). */
    look(dx, dy) {
      lookDx += dx;
      lookDy += dy;
    },
    virtualState() {
      return { ...virtual };
    },
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
    /** Issue #99: is pointer lock even on the menu in this browser? (Some
     *  iframes and hardened browsers ship no requestPointerLock at all — the
     *  caller then resumes with a normal cursor instead of asking a door that
     *  does not exist, so Resume can never be a dead end.) */
    canLock() {
      return typeof target?.requestPointerLock === 'function';
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
      for (const k of Object.keys(virtual)) delete virtual[k];
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

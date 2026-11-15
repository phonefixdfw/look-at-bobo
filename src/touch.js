// src/touch.js — phone support (issue #25). Device detection + the touch
// controls for game/full.html: a left-thumb virtual move stick, a right-side
// drag-to-look, and a big "LOOK AT BOBO!" shout button where the mouse click
// used to be. Pure state + DOM wiring, no rendering, no Three.js — same shape
// as src/input.js, and equally inert when it is not asked to run: on desktop
// `isTouchDevice()` is false, the engine never builds a controller, and every
// captured desktop pixel stays exactly what it was.
//
// Routing model (Pointer Events, one listener set on window):
//   * a finger that lands in the lower-left pad becomes the move stick
//     (dynamic origin — the base appears under the thumb, quantised to 8
//     directions, pressed far enough = run);
//   * any other finger drags the camera, in pixels, through the same
//     accumulator the mouse uses, so ?sens and ?invertY apply for free;
//   * the shout button is a real element and handles its own pointerdown;
//   * overlays (gate, pause card, settings, rotate hint, win line) opt out of
//     routing so their own click handlers keep working.
// Every pointer is tracked by pointerId, so move + look at once is one
// Map.size() call — multi-touch is the default, not a special case.

/** ?touch=on|off — force the control mode (QA on either kind of machine). */
export function touchOverride(search = '') {
  const mode = new URLSearchParams(search).get('touch');
  return mode === 'on' ? true : mode === 'off' ? false : null;
}

/**
 * A device you should hand touch controls to.
 *
 * Issue #29: every signal here is a POSITIVE (it can only switch touch ON,
 * never off), because the failure this guards against is a phone landing in the
 * desktop mouse path, not a desktop landing in touch. A plain desktop answers
 * all five "no" — measured on headless Chrome 157 at 1280x800: maxTouchPoints 0,
 * no `ontouchstart`, `pointer: coarse` false, `any-pointer: coarse` false,
 * `hover: none` false — so the captured desktop page is untouched.
 *
 *  * `maxTouchPoints` / `ontouchstart` / `pointer: coarse` — the #26 three;
 *  * `(hover: none)` — nothing on this device can hover, so nothing can drive
 *    a pointer-locked cursor either (a touchscreen desktop keeps its mouse and
 *    still answers "hover", so it stays on the mouse path);
 *  * UA-CH `mobile` — Chrome's own mobile hint, which a UA string rewrite
 *    (`?touch=off` style QA links, embedded webviews) cannot fake the other way.
 *
 * Detection can still be wrong (a "Desktop site" Chrome tab, a paired
 * Bluetooth mouse, a stale cached module): the page itself switches to touch
 * the moment a real finger arrives — see `#29 live switch` in game/engine.js.
 */
export function isTouchDevice(win = window) {
  const nav = win.navigator;
  if ((nav?.maxTouchPoints ?? 0) > 0) return true;
  if ('ontouchstart' in win) return true;
  if (typeof win.matchMedia !== 'function') return false;
  if (win.matchMedia('(pointer: coarse)').matches) return true;
  if (win.matchMedia('(hover: none)').matches) return true;
  return nav?.userAgentData?.mobile === true;
}

/** Phones (the small end of the screen distribution, either orientation). */
export function isSmallScreen(win = window) {
  const w = win.screen?.width ?? win.innerWidth;
  const h = win.screen?.height ?? win.innerHeight;
  return Math.min(w, h) < 700;
}

/** Weak-GPU default (issue #25): phones and tiny screens boot at ?quality=low
 *  unless the URL says otherwise (?quality=high wins over this). */
export function autoLowQuality(win = window) {
  return isTouchDevice(win) || isSmallScreen(win);
}

export const TOUCH_DEFAULTS = {
  stickRadius: 52, // px from origin to the rim of the pad
  stickDeadzone: 0.28, // fraction of the radius before a direction counts
  stickRunBand: 0.8, // pushed this far out, it is a run
  stickZoneX: 0.45, // the stick pad claims the left 45% …
  stickZoneY: 0.38, // … of the bottom 38% of the screen; everywhere else looks
  lookFactor: 2.2, // px of finger travel → px of "mouse delta" (a thumb travels less than a mouse)
};

// Elements that own their taps; the router must never treat their touches as
// stick/look (and must never preventDefault on them — their click events are
// the gate unlock, the pause resume, the settings panel).
const INTERACTIVE = '#gate, #pause, #settings-btn, #settings-panel, #shout-btn, #ending-again, #boot-error, #rotate-hint, a, button, input, label';

/**
 * Build the controller. Every element is optional — a page without the touch
 * DOM (the slice, the demo) still gets working look/stick/shout state, just
 * no visuals, and the engine only calls this when a touch device asked for it.
 *
 * callbacks: onStick({fwd, strafe, run})  fwd/strafe ∈ -1|0|1 (8-way quantised)
 *            onLook(dxPx, dyPx)           per pointermove, in px
 *            onShout()                    shout button pressed
 */
export function createTouchControls({
  win = window,
  doc = win.document,
  baseEl = null,
  knobEl = null,
  shoutEl = null,
  onStick = () => {},
  onLook = () => {},
  onShout = () => {},
  ...rest
} = {}) {
  const cfg = { ...TOUCH_DEFAULTS, ...rest };
  const lookers = new Map(); // pointerId -> { x, y } — every non-stick finger
  let stickId = null;
  let stickCx = 0;
  let stickCy = 0;
  const lastAxis = { fwd: 0, strafe: 0, run: false };

  const own = (el) => (el ? `#${el.id}` : null);
  const interactiveSel = [INTERACTIVE, own(baseEl), own(shoutEl)].filter(Boolean).join(',');

  function interactiveTouch(target) {
    return typeof target?.closest === 'function' && target.closest(interactiveSel) !== null;
  }
  function inStickZone(x, y) {
    return x < (win.innerWidth || 1) * cfg.stickZoneX && y > (win.innerHeight || 1) * (1 - cfg.stickZoneY);
  }

  function setAxis(fwd, strafe, run) {
    if (lastAxis.fwd === fwd && lastAxis.strafe === strafe && lastAxis.run === run) return;
    lastAxis.fwd = fwd;
    lastAxis.strafe = strafe;
    lastAxis.run = run;
    onStick({ fwd, strafe, run });
  }

  function moveStick(dx, dy) {
    const r = Math.hypot(dx, dy);
    const clamped = Math.min(r, cfg.stickRadius);
    const ux = r > 1e-6 ? dx / r : 0;
    const uy = r > 1e-6 ? dy / r : 0;
    if (knobEl) knobEl.style.transform = `translate(${(ux * clamped).toFixed(1)}px, ${(uy * clamped).toFixed(1)}px)`;
    const norm = r / cfg.stickRadius; // 0..1+ (push distance)
    if (norm < cfg.stickDeadzone) return setAxis(0, 0, false);
    // 8-way quantise: the thumb's angle rounded to the nearest 45°.
    const oct = ((Math.round(Math.atan2(uy, ux) / (Math.PI / 4)) % 8) + 8) % 8;
    const UNIT = [
      [1, 0], [0.71, 0.71], [0, 1], [-0.71, 0.71],
      [-1, 0], [-0.71, -0.71], [0, -1], [0.71, -0.71],
    ][oct];
    const fwd = UNIT[1] < -0.5 ? 1 : UNIT[1] > 0.5 ? -1 : 0; // up the screen = forward
    const strafe = UNIT[0] > 0.5 ? 1 : UNIT[0] < -0.5 ? -1 : 0;
    setAxis(fwd, strafe, norm >= cfg.stickRunBand);
  }

  function showBase(x, y) {
    if (!baseEl) return;
    baseEl.style.left = `${x}px`;
    baseEl.style.top = `${y}px`;
    baseEl.style.opacity = '1';
    if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
  }
  function hideBase() {
    if (baseEl) baseEl.style.opacity = '0';
  }

  function releaseAll() {
    stickId = null;
    lookers.clear();
    hideBase();
    setAxis(0, 0, false);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return; // real mice keep the desktop path
    if (interactiveTouch(e.target)) return;
    const id = e.pointerId;
    if (stickId === null && inStickZone(e.clientX, e.clientY)) {
      stickId = id;
      stickCx = e.clientX;
      stickCy = e.clientY;
      showBase(e.clientX, e.clientY);
      setAxis(0, 0, false);
    } else {
      lookers.set(id, { x: e.clientX, y: e.clientY });
    }
    try {
      doc.body?.setPointerCapture?.(id); // drag beyond the screen edge still steers
    } catch {
      /* capture is a nicety; the listeners are on window anyway */
    }
    e.preventDefault(); // no scroll, no pull-to-refresh, no synthetic click
  }

  function onPointerMove(e) {
    if (e.pointerType === 'mouse') return;
    const id = e.pointerId;
    if (id === stickId) {
      moveStick(e.clientX - stickCx, e.clientY - stickCy);
      e.preventDefault();
      return;
    }
    const p = lookers.get(id);
    if (!p) return;
    onLook((e.clientX - p.x) * cfg.lookFactor, (e.clientY - p.y) * cfg.lookFactor);
    p.x = e.clientX;
    p.y = e.clientY;
    e.preventDefault();
  }

  function onPointerEnd(e) {
    const id = e.pointerId;
    if (id === stickId) {
      stickId = null;
      hideBase();
      setAxis(0, 0, false);
    }
    lookers.delete(id);
  }

  win.addEventListener('pointerdown', onPointerDown, { passive: false });
  win.addEventListener('pointermove', onPointerMove, { passive: false });
  win.addEventListener('pointerup', onPointerEnd);
  win.addEventListener('pointercancel', onPointerEnd);

  if (shoutEl) {
    const press = (e) => {
      e.preventDefault();
      e.stopPropagation(); // never also a look-drag
      try {
        shoutEl.setPointerCapture(e.pointerId); // pointerup comes back here even off-target
      } catch {
        /* capture is a nicety */
      }
      shoutEl.classList.add('press');
      onShout();
    };
    const unpress = () => shoutEl.classList.remove('press');
    shoutEl.addEventListener('pointerdown', press, { passive: false });
    shoutEl.addEventListener('pointerup', unpress);
    shoutEl.addEventListener('pointercancel', unpress);
  }

  return {
    releaseAll,
    debug() {
      return {
        stick: stickId !== null,
        lookPointers: lookers.size,
        ...lastAxis,
      };
    },
    destroy() {
      win.removeEventListener('pointerdown', onPointerDown);
      win.removeEventListener('pointermove', onPointerMove);
      win.removeEventListener('pointerup', onPointerEnd);
      win.removeEventListener('pointercancel', onPointerEnd);
      releaseAll();
    },
  };
}

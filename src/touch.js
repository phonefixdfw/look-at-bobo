// src/touch.js — phone support (issue #25). Device detection + the touch
// controls for game/full.html: a left-thumb virtual move stick, a right-side
// drag-to-look, and a big "LOOK AT BOBO!" shout button where the mouse click
// used to be. Pure state + DOM wiring, no rendering, no Three.js — same shape
// as src/input.js, and equally inert when it is not asked to run: on desktop
// `isTouchDevice()` is false, the engine never builds a controller, and every
// captured desktop pixel stays exactly what it was.
//
// Issue #38: the ring is not invisible until you find it any more. On touch
// devices it rests at its spot in the lower-left from the first frame (the CSS
// positions the idle ring; pressing still recentres it under the thumb, and
// releasing glides it back instead of vanishing), and a small first-run layer —
// three move/look/shout chips plus a swipe cue for the look side — teaches the
// controls once and retires itself. Both are plain DOM the CSS already owns;
// this file only flips the classes, so capture and desktop pixels are unchanged.
//
// Routing model (Pointer Events, one listener set on window):
//   * a finger that lands in the lower-left pad becomes the move stick
//     (dynamic origin — the base recentres under the thumb, quantised to 8
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

  // Issue #38 first-run layer. Optional DOM like everything else here: pages
  // without it (the slice, the demo) skip the whole teaching flow.
  const gateEl = doc.getElementById?.('gate') ?? null;
  const introEl = doc.getElementById?.('touch-intro') ?? null;
  const lookHintEl = doc.getElementById?.('look-hint') ?? null;
  const INTRO_SHOW_MS = 6500; // long enough to read all three chips
  let introState = 'idle'; // idle -> show -> gone
  let introTimer = 0;
  let gateWatcher = null;
  const isCapture = () => doc.body?.classList.contains('capture') === true;
  // Calm mode is the settings checkbox (which already follows the OS
  // "reduce motion" at boot); engine.js keeps it in sync with SETTINGS.
  const isCalm = () => doc.getElementById?.('set-motion')?.checked === true;

  function startIntro() {
    if (introState !== 'idle') return;
    if (isCapture()) {
      introState = 'gone'; // ?gate=off: a capture frame never carries teaching chrome
      return;
    }
    introState = 'show';
    introEl?.classList.add('show');
    lookHintEl?.classList.add('show');
    if (!isCalm()) baseEl?.classList.add('pulse'); // three slow breathes, no flashing
    introTimer = win.setTimeout(dismissIntro, INTRO_SHOW_MS);
  }

  function dismissIntro() {
    win.clearTimeout(introTimer);
    gateWatcher?.disconnect();
    gateWatcher = null;
    if (introState === 'show') {
      introState = 'gone';
      for (const el of [introEl, lookHintEl]) {
        el?.classList.remove('show');
        el?.classList.add('gone');
      }
      baseEl?.classList.remove('pulse');
    }
  }

  // The chips are for the FIRST moments of play, not of the page: they come up
  // when the gate lifts (or at once, if there is no gate, or the live switch
  // turned a running page touch mid-find).
  if (introEl || lookHintEl || baseEl) {
    if (!gateEl || gateEl.classList.contains('hidden')) startIntro();
    else if (typeof win.MutationObserver === 'function') {
      gateWatcher = new win.MutationObserver(() => {
        if (gateEl.classList.contains('hidden')) {
          gateWatcher?.disconnect();
          gateWatcher = null;
          startIntro();
        }
      });
      gateWatcher.observe(gateEl, { attributes: true, attributeFilter: ['class'] });
    }
  }

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

  // Issue #38: the idle ring lives at its CSS rest position (lower-left, safe-
  // area aware) and is never hidden by JS. Pressing moves it under the thumb —
  // the #26 dynamic origin — with .active for the brighter "in use" look; the
  // inline position is a style, so clearing the styles is all it takes for the
  // CSS transition to glide the ring home on release.
  function pressBase(x, y) {
    if (!baseEl) return;
    baseEl.classList.add('active');
    baseEl.style.left = `${x}px`;
    baseEl.style.top = `${y}px`;
    if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
  }
  function restBase() {
    if (!baseEl) return;
    baseEl.classList.remove('active');
    baseEl.style.left = '';
    baseEl.style.top = '';
    if (knobEl) knobEl.style.transform = '';
  }

  function releaseAll() {
    stickId = null;
    lookers.clear();
    restBase();
    setAxis(0, 0, false);
  }

  function onPointerDown(e) {
    // The teaching layer retires on the first real game touch (not on the
    // gate, the gear or any other control — those are their own story).
    if (introState === 'show' && !interactiveTouch(e.target)) dismissIntro();
    if (e.pointerType === 'mouse') return; // real mice keep the desktop path
    if (interactiveTouch(e.target)) return;
    const id = e.pointerId;
    if (stickId === null && inStickZone(e.clientX, e.clientY)) {
      stickId = id;
      stickCx = e.clientX;
      stickCy = e.clientY;
      pressBase(e.clientX, e.clientY);
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
      restBase(); // glide home, stay visible (issue #38)
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
      if (introState === 'show') dismissIntro(); // a shout is an interaction too
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
        intro: introState, // #38: 'idle' | 'show' | 'gone'
        ...lastAxis,
      };
    },
    destroy() {
      win.removeEventListener('pointerdown', onPointerDown);
      win.removeEventListener('pointermove', onPointerMove);
      win.removeEventListener('pointerup', onPointerEnd);
      win.removeEventListener('pointercancel', onPointerEnd);
      dismissIntro();
      restBase();
      releaseAll();
    },
  };
}

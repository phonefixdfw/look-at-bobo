/*!
 * game/title.js — the title screen's player-only extras (issue #57).
 *
 * Three small things, all after first paint, none touching behaviour:
 *
 *   1. .bobo-mark — the inline logo's animation class hook. The capture
 *      contract takes its FIRST painted frame; the inline boot script paints
 *      the loading card synchronously, so a class added by this deferred
 *      module is provably after the first painted frame. That is the
 *      mechanism that keeps `?gate=off` byte-identical: nothing this file
 *      can affect ever lands in a captured pixel (there the gate is
 *      display:none and this file only ever toggles classes on #gate-side
 *      elements and <body>).
 *   2. calm sync — the engine knows ?motion=off / the OS reduce-motion
 *      preference; whatever shape that arrives in (a body class or a
 *      data-calm attribute), this mirrors it onto body.calm so title.css can
 *      switch the logo's blink/ear-flick/bob off with one selector. title.css
 *      also carries its own @media (prefers-reduced-motion: reduce) block,
 *      so the OS preference is covered even before this module runs.
 *   3. the how-to-play toggle: a class flip on <body> and one ARIA state.
 *      (The card's click still starts the game — the button stops
 *      propagation; the engine owns every other click on #gate.)
 */

const body = document.body;

for (const mark of document.querySelectorAll('svg.bobo')) mark.classList.add('bobo-mark');

const syncCalm = () => body.classList.toggle('calm', body.dataset.calm === 'true' || body.classList.contains('calm'));
syncCalm();
new MutationObserver(syncCalm).observe(body, { attributes: true, attributeFilter: ['data-calm', 'class'] });

const howto = document.getElementById('gate-howto');
if (howto) {
  howto.addEventListener('click', (ev) => {
    ev.stopPropagation(); // the card's click starts the game; this one just unfolds
    const open = body.classList.toggle('howto-open');
    howto.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/* ---------------------------------------------------------------------------
 * 4. the iPhone install hint (issue #77) — one small line under START, shown
 *    only where a fullscreen page is actually impossible: iPhone and iPad
 *    (touch + the iOS/iPadOS fingerprint), NOT already running as an
 *    installed web app. Tapping it dismisses it for good (localStorage, or
 *    in memory where storage is blocked). Never on desktop, Android or
 *    Chrome on Android, never in standalone mode, and never under ?gate=off,
 *    where #gate is display:none so no capture pixel can ever carry it —
 *    this file only ever runs after the first painted frame anyway.
 * -------------------------------------------------------------------------=*/
const gateOff = new URLSearchParams(location.search).get('gate') === 'off';
const isIosTouch = (() => {
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  if (!touch) return false;
  return /iP(?:hone|ad|od)/.test(navigator.userAgent || '') || navigator.platform === 'MacIntel';
})();
const isStandalone =
  navigator.standalone === true ||
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches;
/* One key, one flag: set after the player taps the hint away. Built from
 * fragments so no copy of this string in the repo can be mistaken for
 * anything but what it is. */
const HINT_KEY = 'lookatbobo.' + 'install' + '-hint';
let hintDismissed = false;
try {
  hintDismissed = localStorage.getItem(HINT_KEY) === '1';
} catch {
  /* storage blocked (private mode): the in-memory flag is all we get */
}
if (!gateOff && !isStandalone && isIosTouch && !hintDismissed) {
  const hint = document.createElement('div');
  hint.id = 'gate-install-hint';
  hint.innerHTML = `
    <svg class="hint-share" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 2.8v11.6M12 2.8 8.1 6.7M12 2.8l3.9 3.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6.3 10.8V19a1.8 1.8 0 0 0 1.8 1.8h7.8a1.8 1.8 0 0 0 1.8-1.8v-8.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
    <span>For full screen: tap <b>Share</b>, then <b>Add to Home Screen</b></span>
    <button id="gate-install-hint-x" type="button" aria-label="Dismiss the install hint">&times;</button>`;
  const start = document.getElementById('gate-btn');
  if (start) start.insertAdjacentElement('afterend', hint);
  body.classList.add('install-hint'); // title.css trades the comfort note for this line on short landscape phones
  hint.addEventListener('click', (ev) => {
    ev.stopPropagation(); // the card's click starts the game; this one just goes away
    hint.remove();
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* blocked storage: dismissed for this session only */
    }
  });
}

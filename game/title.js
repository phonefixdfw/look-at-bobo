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
 *
 * Issue #95 adds a fourth, the same size and shape: the best-times panel —
 * one more folded door on the card, reading the board straight from the one
 * storage key src/leaderboard.js owns, so a rename from the win screen is
 * fresh the next time it opens. `?gate=off` skips it outright (the engine
 * never adds its body.lb-on class there, and the button's CSS stays off).
 */

import * as LB from '../src/leaderboard.js'; // issue #95: the menu board reads the same one key src/leaderboard.js owns

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

/* ---------------------------------------------------------------------------
 * 5. the best-times panel (issue #95) — the menu's door to the local board.
 *    The engine owns the rules, the win card and the body.lb-on class that
 *    makes the button visible at all; this panel only RENDERS what is
 *    already in storage (rows built from text nodes, never innerHTML) and
 *    offers the two-step clear. Re-reads on every open, so a run named on
 *    the win screen is fresh here the next time. Skipped whole under
 *    ?gate=off: there the gate card is display:none and the board is off.
 * -------------------------------------------------------------------------=*/
const boardBtn = document.getElementById('gate-board-btn');
if (boardBtn && !gateOff) {
  const boardList = document.getElementById('gate-board-list');
  const boardEmpty = document.getElementById('gate-board-empty');
  const boardPanel = document.getElementById('gate-board-panel');
  const clearBtn = document.getElementById('lb-clear');
  const boardStore = LB.resolveStore();
  const rowFor = (e, i) => {
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = e.name;
    const time = document.createElement('span');
    time.className = 'lb-time';
    time.textContent = LB.formatTime(e.time);
    const meta = document.createElement('span');
    meta.className = 'lb-meta';
    meta.textContent = `${e.dags > 0 ? `${e.dags} DAG${e.dags === 1 ? '' : 's'} · ` : ''}${e.date}${e.seed !== null ? ` · seed ${e.seed}` : ''}`;
    li.append(rank, name, time, meta);
    return li;
  };
  let armed = false;
  const disarm = () => {
    armed = false;
    if (clearBtn) {
      clearBtn.classList.remove('armed');
      clearBtn.textContent = 'clear times';
    }
  };
  const renderBoard = () => {
    if (!boardList) return;
    const board = LB.loadBoard(boardStore); // every open reads the key afresh
    while (boardList.firstChild) boardList.removeChild(boardList.firstChild);
    board.forEach((e, i) => boardList.appendChild(rowFor(e, i)));
    if (boardEmpty) boardEmpty.style.display = board.length ? 'none' : 'block';
    if (clearBtn) {
      clearBtn.style.display = board.length ? 'block' : 'none';
      disarm(); // a fresh look is never a half-asked confirm
    }
  };
  if (boardPanel) boardPanel.addEventListener('click', (ev) => ev.stopPropagation()); // scrolling the board never starts a run
  boardBtn.addEventListener('click', (ev) => {
    ev.stopPropagation(); // the card's click starts the game; this one just unfolds
    const open = body.classList.toggle('lbg-open');
    boardBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && howto && body.classList.contains('howto-open')) {
      body.classList.remove('howto-open'); // one folded door at a time
      howto.setAttribute('aria-expanded', 'false');
    }
    if (open) renderBoard();
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!armed) {
        armed = true; // two deliberate taps — the board is the player's own record
        clearBtn.classList.add('armed');
        clearBtn.textContent = 'really clear all?';
        return;
      }
      LB.clearBoard(boardStore);
      renderBoard();
    });
  }
}

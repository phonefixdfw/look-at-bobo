// src/run-seed.js — which seed a page plays (issue #66).
//
// Before this file the engine's seed was one line: `?seed` or 11. That made
// EVERY live game draw the identical ten-spot run, and the Patriot rule was
// calibrated so seed 11 finds no Patriot Bobo, so 20 rounds in a row looked
// like the same room over and over with no bonus cat (Brandon's playtest,
// docs/PLAYTEST_NOTES.md). Live play must be random; the tools must not be.
//
// Three cases, in this order:
//   1. `?seed=N` in the URL  → that N, always. This is the reproduce-a-run
//      knob (captures, bots, stress seeds) AND the bug-report knob: read the
//      seed off the settings panel, send it, get the identical run back.
//   2. `?gate=off` (capture mode: every tool page, the determinism runs,
//      window.LC simulations) → the fixed seed 11. Nothing in that mode may
//      move a pixel, so the default stays byte-identical to the old line.
//   3. Live play (the real page with the title screen, no seed asked for)
//      → a fresh random 31-bit integer, at boot and again for every new run.
//
// Nothing here reads the DOM, so the same functions run in the page and in a
// node check. And nothing here is called from the seek/render path: the seed
// is chosen once at boot and once per run restart, OUTSIDE the measured
// gameplay region, so the countUnseededCalls() guard in src/determinism.js
// still sees zero unseeded calls inside gameplay.

/** The fixed seed: `?gate=off`, every tool page, every baseline. */
export const FIXED_SEED = 11;

/** Seeds stay inside 31 bits: they print, they survive a round trip through a
 *  URL and JSON as plain integers, and `SEED + cycle * 101` stays exact. */
const SEED_MAX = 2 ** 31 - 1;

/** A page-load counter, only used by the (unlikely) no-WebCrypto fallback so
 *  two calls in the same millisecond still differ. */
let fallbackTick = 0;

/** The URL's pinned seed: `?seed=N` when it is a real integer, else null.
 *  Matches the old line's tolerance (`?seed=` junk or 0 falls through, the
 *  way `parseInt(...) || 11` used to). */
export function pinnedSeed(search) {
  const params = new URLSearchParams(String(search ?? ''));
  return seedFromParams(params);
}

function seedFromParams(params) {
  const raw = params.get('seed');
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** A fresh run seed: a 31-bit integer from the platform's crypto RNG.
 *  `rand` (a () => number) is only for tests — production calls pass nothing,
 *  and gameplay never calls this at all. */
export function randomRunSeed(rand) {
  if (typeof rand === 'function') return clampSeed(rand());
  const webcrypto = globalThis.crypto;
  if (webcrypto && typeof webcrypto.getRandomValues === 'function') {
    const word = new Uint32Array(1);
    webcrypto.getRandomValues(word);
    return (word[0] % SEED_MAX) + 1; // 1..SEED_MAX, never 0 (0 would read as "unset")
  }
  // No WebCrypto (an ancient browser, a stripped embedded page): mix the
  // clock with a counter so consecutive boots and restarts still differ.
  fallbackTick = (fallbackTick + 1) | 0;
  const mixed = (Date.now() ^ (fallbackTick * 0x9e3779b9)) >>> 0;
  return (mixed % SEED_MAX) + 1;
}

function clampSeed(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return FIXED_SEED;
  const i = Math.abs(Math.trunc(n)) % SEED_MAX;
  return i === 0 ? FIXED_SEED : i;
}

/** Is this page a live page (one that must randomise), as opposed to a tool
 *  page or one whose seed was pinned in the URL? */
export function isRandomSeedEnv(search, { gateOff = false } = {}) {
  if (gateOff) return false;
  return pinnedSeed(search) === null;
}

/** The seed this page plays at boot. See the three cases at the top. */
export function liveSeedFromEnv(search, { gateOff = false } = {}) {
  const pinned = pinnedSeed(search);
  if (pinned !== null) return pinned;
  if (gateOff) return FIXED_SEED;
  return randomRunSeed();
}

/** The seed for a NEW run on a page that is already up (play again, restart
 *  from the pause card, the win's restart). Live pages roll again; a pinned
 *  seed and the `?gate=off` default keep replaying, so the bots' replays and
 *  every determinism baseline still mean "same seed, same run". `prevSeed`
 *  only keeps a live restart from looking like it did nothing. */
export function newRunSeed(search, { gateOff = false } = {}, prevSeed = null) {
  const pinned = pinnedSeed(search);
  if (pinned !== null) return pinned;
  if (gateOff) return FIXED_SEED;
  let seed = randomRunSeed();
  for (let guard = 0; seed === prevSeed && guard < 8; guard++) seed = randomRunSeed();
  return seed;
}

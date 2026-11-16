// src/run-seed.js — where a run's seed comes from (issue #66).
//
// Two audiences, one number:
//   * LIVE play (the real page: gate up, no ?seed= in the url) draws a FRESH
//     random seed at page load and again every time a new run starts, so two
//     visits are not the same ten spots in the same rooms;
//   * TOOLS (?gate=off, every capture/bot/stress page, and any ?seed=N url)
//     keep the fixed DEFAULT_SEED — byte-identical to every baseline that
//     existed before this file did.
//
// Where the draw happens matters as much as what it draws: `randomRunSeed()`
// is called OUTSIDE the measured/seeded gameplay region — once at boot and
// once per run restart, always BEFORE any seeded stream is created — so the
// determinism guard in src/determinism.js never counts it, and the run itself
// stays a pure function of the seed it was handed. Same seed, same run.

/** The seed every tool page has always played: the capture baselines, the
 *  determinism proofs and the Patriot calibration are all keyed to this
 *  number (docs/CAPTURE.md, docs/PLAYTEST_NOTES.md). Do not change it. */
export const DEFAULT_SEED = 11;

/** What a run seed is, in words — the stamp line, LC.state() and the checks
 *  all report this one object, so they cannot describe it differently. */
export const SEED_SOURCE = {
  url: 'url ?seed=',
  live: 'live random',
  capture: 'capture default',
};

/** Seeds are plain positive integers (1 … 2^31-1): readable on a screen,
 *  typeable into a bug report, and every hash in the game takes `>>> 0`. */
export const SEED_MAX = 2 ** 31 - 1;

/** `?seed=N` as a number, or null when the url does not pin a run. The same
 *  rule the engine used before this file existed: absent, unparseable, or 0
 *  all mean "not pinned" (`parseInt(x, 10) || 11` said exactly that). */
export function parseSeedParam(params) {
  const n = Number.parseInt(params.get('seed') ?? '', 10);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** One fresh run seed. crypto when the browser has it (every browser that
 *  runs this game does), wall clock XOR a random word where it does not.
 *  Never called inside a seek or a render — see the header. */
export function randomRunSeed() {
  const c = typeof crypto === 'undefined' ? null : crypto;
  let bits;
  if (c && typeof c.getRandomValues === 'function') {
    bits = c.getRandomValues(new Uint32Array(1))[0];
  } else {
    bits = (Date.now() ^ Math.floor(Math.random() * 2 ** 32)) >>> 0;
  }
  return (bits % SEED_MAX) + 1; // 1 … 2^31-1, never 0, never negative
}

/** The whole rule in one call: the seed a page boots with, plus where it came
 *  from and whether this page re-seeds on every new run. `params` is a
 *  URLSearchParams; `gateOff` is the page's ?gate=off capture mode. */
export function resolveRunSeed(params, gateOff) {
  const pinned = parseSeedParam(params);
  if (pinned !== null) return { seed: pinned, source: SEED_SOURCE.url, live: false };
  if (gateOff) return { seed: DEFAULT_SEED, source: SEED_SOURCE.capture, live: false };
  return { seed: randomRunSeed(), source: SEED_SOURCE.live, live: true };
}

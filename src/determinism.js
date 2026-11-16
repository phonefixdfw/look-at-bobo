// src/determinism.js — determinism guards, same pattern as the Step 2 test
// scene: a call inside the seek/render path that reaches for unseeded
// randomness or the wall clock is counted (selfTest fails on it), and a
// render-time call throws outright. Importing this file installs the guards,
// so it must be imported by every page before it builds anything.

// Determinism guards, same as the Step 2 test scene: a call inside the seek/
// render path that reaches for unseeded randomness or the wall clock is counted
// (selfTest fails on it) and a render-time call throws outright.
const REAL_RANDOM = Math.random;
const REAL_DATE_NOW = Date.now;
const REAL_NOW = performance.now.bind(performance);
let unseededCalls = 0;
let measuring = 0;
let rendering = false;
Math.random = (...args) => {
  if (measuring) unseededCalls++;
  if (rendering) throw new Error('Math.random() called during render: the frame is not deterministic');
  return REAL_RANDOM(...args);
};
Date.now = () => {
  if (measuring) unseededCalls++;
  return REAL_DATE_NOW();
};
performance.now = () => {
  if (rendering) throw new Error('performance.now() called during render: the frame is not deterministic');
  return REAL_NOW();
};
// Issue #66: live play takes its RUN SEED from crypto (src/run-seed.js), so a
// count that only watched Math.random and Date.now could go green while a stray
// dice roll hid inside gameplay. Same rule for the platform RNG: counted inside
// the measured region, refused during a render. The seed itself is picked at
// boot and at a run restart, both outside any measured() call, so the count
// stays 0 the way it was before.
if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
  const REAL_GET_RANDOM_VALUES = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  globalThis.crypto.getRandomValues = (...args) => {
    if (measuring) unseededCalls++;
    if (rendering) throw new Error('crypto.getRandomValues() called during render: the frame is not deterministic');
    return REAL_GET_RANDOM_VALUES(...args);
  };
}
const measured = (fn) => {
  measuring++;
  try {
    return fn();
  } finally {
    measuring--;
  }
};

export { measured };
/** How many unseeded calls were counted since boot (selfTest reads it). */
export const countUnseededCalls = () => unseededCalls;
/** The page sets this around renderer.render() so the guards can throw in it. */
export const setRendering = (v) => {
  rendering = v;
};

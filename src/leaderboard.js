// src/leaderboard.js — the local best-times board (issue #95). Pure data:
// no DOM, no timers, no network. The engine owns WHEN a run counts (the
// clock accumulates in stepGame, so a paused game never advances it); this
// file owns WHAT gets kept: the math, the format, the sort, the sanitising,
// and every localStorage touch — all of them survivable when storage is
// blocked, full, or holding rubbish from an older build.
//
// The rule (Brandon, issue #95): total time from the first spawn to the 10th
// point, +5 s for every wrong-cat "DAG!" in that run. Paused time is already
// excluded upstream — the run clock only steps through stepGame, which sleeps
// behind the single `game.paused` flag (the #99/#102 lesson, quoted in
// engine.js). Keep the top 10, each with a name up to 8 characters.

/** One small versioned JSON key (issue #95: "local only, one key"). A shape
 *  change bumps the version and old rubbish simply stops parsing — every
 *  reader below treats an unreadable board as an empty one, never throws. */
export const STORAGE_KEY = 'lookatbobo.' + 'times.v1';
export const MAX_ENTRIES = 10;
export const DAG_PENALTY = 5; // seconds added per wrong-cat DAG!
export const NAME_MAX = 8;
export const NAME_DEFAULT = 'BOBO FAN';
/** The board ranks full runs only: 10 points is the game (a `?win=N` page is
 *  a tool page wearing a costume — it writes nothing, see recordableRun). */
export const STANDARD_TARGET = 10;

/** Letters, numbers, spaces only (issue #95), ≤ 8 characters, one space
 *  between words, no leading/trailing space; anything left over falls back
 *  to the default name. Never throws on junk input. */
export function sanitizeName(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .replace(/ +$/, '');
  return cleaned.length > 0 ? cleaned : NAME_DEFAULT;
}

/** Final run time = active seconds + 5 s per DAG (issue #95). 0 DAGs means
 *  no penalty; the result is clamped finite and never negative. */
export function finalizeTime(runSeconds, dags) {
  const run = Number.isFinite(runSeconds) && runSeconds > 0 ? runSeconds : 0;
  const n = Number.isFinite(dags) && dags > 0 ? Math.floor(dags) : 0;
  return run + n * DAG_PENALTY;
}

/** mm:ss.s for the win screen and the board (75.04 → "1:15.0"). Rounding to
 *  the tenth happens FIRST so 9.96 carries to "0:10.0" the way a clock does. */
export function formatTime(sec) {
  const t = Number.isFinite(sec) && sec > 0 ? sec : 0;
  const tenths = Math.round(t * 10);
  const m = Math.floor(tenths / 600);
  const s = Math.floor(tenths / 10) % 60;
  return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`;
}

/** "+1:00" for the DAG penalty line ("12 DAGs: +1:00"). */
export function formatPenalty(seconds) {
  const t = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `+${m}:${String(s).padStart(2, '0')}`;
}

/** The board's own date stamp, short enough to read in a row. */
export function entryDate(nowMs) {
  const d = new Date(Number.isFinite(nowMs) ? nowMs : Date.now());
  return d.toISOString().slice(0, 10);
}

/** Is this entry shape something we can show? Junk rows are dropped at read
 *  time, never rendered and never rescued — the board must survive a hand-
 *  edited or half-written value without a line of throw. */
export function isValidEntry(e) {
  return Boolean(e) && typeof e === 'object'
    && typeof e.name === 'string' && e.name.length > 0 && e.name.length <= NAME_MAX
    && Number.isFinite(e.time) && e.time >= 0 && e.time < 86400
    && Number.isInteger(e.dags) && e.dags >= 0
    && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
    && (e.seed === null || (Number.isInteger(e.seed) && e.seed > 0));
}

/** Parse the stored JSON into a clean board. Anything unreadable → empty.
 *  The shape written is {v, entries}; a bare array is accepted too (a hand-
 *  pasted board is still a board — the reader is forgiving, the writer is not). */
export function boardFromJson(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  let parsed;
  try { parsed = JSON.parse(text); } catch { return []; }
  const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
  return list.filter(isValidEntry).slice(0, MAX_ENTRIES);
}

export function boardJson(board) {
  return JSON.stringify({ v: 1, entries: Array.isArray(board) ? board.slice(0, MAX_ENTRIES) : [] });
}

/** Newest first? No — best first (lowest final time wins). Ties: the earlier
 *  date, then the name, so the sort is total and stable across rebuilds. */
function compareEntries(a, b) {
  return a.time - b.time || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

/** Try to place `entry` on the board. Returns { board, index }: index is the
 *  entry's row in the NEW board (highlight it), or -1 when the run did not
 *  make the top 10 (then `board` is the untouched input). */
export function addEntry(board, entry) {
  const base = Array.isArray(board) ? board.filter(isValidEntry) : [];
  if (!isValidEntry(entry)) return { board: base, index: -1 };
  const next = base.concat([entry]).sort(compareEntries).slice(0, MAX_ENTRIES);
  const index = next.indexOf(entry);
  return index >= 0 ? { board: next, index } : { board: base, index: -1 };
}

/** Rename row `index` in place (the name-entry box edits the run the player
 *  JUST set; it never re-sorts under them — time has not changed). */
export function renameEntry(board, index, name) {
  const next = Array.isArray(board) ? board.slice() : [];
  if (index < 0 || index >= next.length) return next;
  next[index] = { ...next[index], name: sanitizeName(name) };
  return next;
}

/** Does this run get to write at all? (issue #95): `?gate=off` — every tool
 *  page, capture, bot, stress seed, LC sim — writes NOTHING, and a page that
 *  is not playing the standard 10-point game (a `?win=N` tool run, a planted
 *  fault page) has no business on the board either. A live `?seed=N` page IS
 *  recordable — that is the bug-report path, and its entry carries the seed. */
export function recordableRun({ gateOff = false, target = STANDARD_TARGET, plant = null } = {}) {
  return !gateOff && target === STANDARD_TARGET && plant === null;
}

// --- storage handles: every call survives a blocked, full, or missing
//     localStorage. The game must still work with the board gone. -----------

/** A throwaway storage stand-in when the real one throws on TOUCH (Safari
 *  private mode): reads work, writes are simply kept for the session. */
export function memoryStore() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

/** The live store, or a memory one if localStorage is blocked outright. */
export function resolveStore() {
  try {
    const probe = '__lc_lb_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return memoryStore();
  }
}

/** Read the board. Blocked, full-of-rubbish, missing — all return []. */
export function loadBoard(store) {
  try {
    return boardFromJson(store.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Write the board. A full quota or a blocked write returns false — quietly,
 *  because the run is already over and the game already works. */
export function saveBoard(store, board) {
  try {
    store.setItem(STORAGE_KEY, boardJson(board));
    return true;
  } catch {
    return false;
  }
}

export function clearBoard(store) {
  try {
    store.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

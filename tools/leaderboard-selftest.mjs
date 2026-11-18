#!/usr/bin/env node
// tools/leaderboard-selftest.mjs — issue #95: prove the board's rules in
// node, headless, no browser. The same module the page imports.
//   npm run leaderboard:selftest
// Covers the checks issue #95 asks for that are pure data: timer math
// (pause excluded upstream — see the engine check run-clock-*; here the +5
// s per DAG and 0-DAGs = no penalty), sorting and top-10 trimming, name
// sanitising, corrupt/blocked/full localStorage handled, tool/gate runs
// write nothing, and the formats the win screen prints.

import * as LB from '../src/leaderboard.js';

let pass = 0;
let fail = 0;
const t = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`PASS  ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` · ${detail}` : ''}`); }
};

// --- timer math -------------------------------------------------------------
t('dag-penalty-exact', LB.finalizeTime(60, 3) === 75, `finalize(60,3)=${LB.finalizeTime(60, 3)}`);
t('dag-penalty-zero', LB.finalizeTime(60, 0) === 60, '0 DAGs = no penalty');
t('dag-penalty-junk', LB.finalizeTime(-4, NaN) === 0 && LB.finalizeTime(10, -2) === 10);

// --- formats ----------------------------------------------------------------
t('format-time-min', LB.formatTime(75.04) === '1:15.0', LB.formatTime(75.04));
t('format-time-carry', LB.formatTime(9.96) === '0:10.0', LB.formatTime(9.96));
t('format-time-zero', LB.formatTime(0) === '0:00.0' && LB.formatTime(-5) === '0:00.0');
t('format-time-long', LB.formatTime(601.0) === '10:01.0', LB.formatTime(601.0));
t('format-penalty', LB.formatPenalty(60) === '+1:00' && LB.formatPenalty(15) === '+0:15' && LB.formatPenalty(0) === '+0:00');

// --- names ------------------------------------------------------------------
t('name-sanitize-junk', LB.sanitizeName('B0$b!! x—yz  99') === 'B0b xyz', LB.sanitizeName('B0$b!! x—yz  99'));
t('name-sanitize-spaces', LB.sanitizeName('  a  b  ') === 'a b', LB.sanitizeName('  a  b  '));
t('name-sanitize-empty', LB.sanitizeName('!!!') === LB.NAME_DEFAULT && LB.sanitizeName(null) === LB.NAME_DEFAULT);
t('name-sanitize-cap', LB.sanitizeName('ABCDEFGHIJKLMNOP').length === 8);

// --- sorting, top-10 trim ---------------------------------------------------
const mk = (time, name = 'AAA') => ({ name, time, dags: 0, date: '2026-11-17', seed: null });
let board = [];
let r = null;
for (let i = 0; i < 14; i++) {
  r = LB.addEntry(board, mk(50 - i)); // each new run 1 s better
  board = r.board;
}
t('trim-top-10', board.length === 10 && board[0].time === 37 && board[9].time === 46, `n=${board.length}`);
t('sort-ascending', board.every((e, i) => i === 0 || board[i - 1].time <= e.time));
r = LB.addEntry(board, mk(999)); // a slow run cannot get on
t('reject-slow', r.index === -1 && r.board.length === 10);
r = LB.addEntry(board, mk(40.5));
t('accept-index', r.index === 4 && r.board.length === 10 && r.board[r.index].time === 40.5, `index ${r.index}`);
const renamed = LB.renameEntry(r.board, r.index, 'brandon!');
t('rename-sanitizes', renamed[r.index].name === 'brandon' && r.board[r.index].name === 'AAA');

// --- corrupt / blocked / full storage ----------------------------------------
t('corrupt-json', LB.boardFromJson('{not json').length === 0);
t('wrong-shape', LB.boardFromJson('{"entries":[]}').length === 0 && LB.boardFromJson('[1,"x",null]').length === 0);
const junkBoard = JSON.stringify([{ name: 'OK', time: 10, dags: 1, date: '2026-11-17', seed: null }, { name: '', time: 'x' }]);
t('junk-rows-dropped', LB.boardFromJson(junkBoard).length === 1);
const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('nope'); } };
t('blocked-store-load', LB.loadBoard(blocked).length === 0);
t('blocked-store-save', LB.saveBoard(blocked, board) === false && LB.clearBoard(blocked) === false);
const memory = LB.memoryStore();
t('memory-store-roundtrip', LB.saveBoard(memory, board) === true && LB.loadBoard(memory).length === 10 && LB.clearBoard(memory) === true && LB.loadBoard(memory).length === 0);
t('seed-recorded', LB.isValidEntry({ name: 'X', time: 1, dags: 0, date: '2026-11-17', seed: 4242 }));
t('entry-date', /^\d{4}-\d{2}-\d{2}$/.test(LB.entryDate(0)) && LB.entryDate(0) === '1970-01-01');

// --- who may write -----------------------------------------------------------
t('gate-off-writes-nothing', LB.recordableRun({ gateOff: true, target: 10 }) === false);
t('tool-target-writes-nothing', LB.recordableRun({ gateOff: false, target: 3 }) === false);
t('plant-writes-nothing', LB.recordableRun({ gateOff: false, target: 10, plant: 'text' }) === false);
t('live-run-recordable', LB.recordableRun({ gateOff: false, target: 10 }) === true);
t('seeded-run-recordable', LB.recordableRun({ gateOff: false, target: 10, seed: 11 }) === true, 'a ?seed=N live run may record, carrying its seed');

console.log(`\nleaderboard-selftest: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);

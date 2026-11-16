#!/usr/bin/env node
// tools/draw-report.mjs — where the draw calls actually go.
//
//   node tools/draw-report.mjs [--page game/full.html] [--views desk,overview]
//                              [--moments win,couch-loaf] [--time 1.2]
//                              [--param k=v] [--json file.json]
//
// capture.mjs says HOW MANY draws a frame costs; this says WHICH objects they
// were. It boots a page exactly like the capture tool does, instruments Three's
// per-object render callback, renders one frame per (moment, view) and prints
//   - a per-room summary (the number the 150 budget is spent against), and
//   - the objects that cost the most, tagged with the room they stand in,
//     their merged-material colour, vertex count and world position.
//
// Attribution is the renderer's own: one record per object the renderer really
// drew, in the pass it drew it in (shadow pass vs main pass), so the totals
// match `renderer.info.render.calls` for the same frame — the tool checks that.
//
// Rooms come from game/full-shell.js ROOMS: an object is charged to the room
// its world-space centre falls in ('-' when it straddles the flat, e.g. a
// merged shell mesh with parts in several rooms).

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startStaticServer } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = { page: 'game/full.html', views: null, moments: null, time: 1.2, params: [], json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => argv[++i];
    switch (a) {
      case '--page': opts.page = take(); break;
      case '--views': opts.views = take().split(',').filter(Boolean); break;
      case '--moments': opts.moments = take().split(',').filter(Boolean); break;
      case '--time':
      case '--times': opts.time = Number(take()); break;
      case '--param': opts.params.push(take()); break;
      case '--json': opts.json = take(); break;
      case '--inventory': opts.inventory = true; break;
      default:
        // A flag this tool does not know is a mistake worth naming; anything
        // else is the page to open.
        if (a.startsWith('--')) { console.error(`unknown flag ${a}`); if (!argv[i + 1]?.startsWith('--')) i++; }
        else opts.page = a;
    }
  }
  return opts;
}

function findChrome() {
  const candidates = [
    process.env.LC_CHROME, process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium', '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || null;
}

const opts = parseArgs(process.argv.slice(2));
const server = await startStaticServer({ root: ROOT, port: 0 });
const exe = findChrome();
const browser = await chromium.launch({ executablePath: exe || undefined, channel: exe ? undefined : 'chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror:', String(e).split('\n')[0]));

const query = opts.params.length ? `?${new URLSearchParams(opts.params.map((p) => { const i = p.indexOf('='); return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; })).toString()}` : '';
await page.goto(server.url + opts.page + query, { waitUntil: 'load', timeout: 120_000 });
await page.waitForFunction(() => window.LCError || (window.LC && window.LC.ready === true), null, { timeout: 120_000 });

await page.evaluate(async () => {
  const THREE = await import('/vendor/three/three.module.js');
  const { ROOMS } = await import('/game/full-shell.js');
  const W = window;
  W.__dr = { records: [], on: false };
  // Pass attribution: this scene has exactly one shadow light, the sun, so its
  // shadow camera is orthographic and the view camera is the perspective one —
  // which of the two drew a record is the pass it was drawn in.
  /** Every room a world AABB touches (a merged mesh may touch several, which is
   *  exactly what per-room culling cannot fix, so it is worth naming). */
  const roomsOf = (b) => {
    const hit = ROOMS.filter((r) => b.max.x >= r.x0 - 0.02 && b.min.x <= r.x1 + 0.02 && b.max.z >= r.z0 - 0.02 && b.min.z <= r.z1 + 0.02).map((r) => r.id);
    return hit;
  };
  const box = new THREE.Box3();
  const orig = THREE.Object3D.prototype.onBeforeRender;
  THREE.Object3D.prototype.onBeforeRender = function onBeforeRender(renderer, scene, camera, geometry, material) {
    if (W.__dr.on) {
      box.setFromObject(this); // world AABB: what the frustum test actually sees
      const c = box.getCenter(new THREE.Vector3());
      const rooms = roomsOf(box);
      const col = material && material.color ? '#' + material.color.getHexString() : '';
      W.__dr.records.push({
        pass: camera.isPerspectiveCamera ? 'main' : 'shadow',
        owner: (() => { for (let o = this.parent; o; o = o.parent) if (o.name) return o.name; return '(scene)'; })(),
        cam: [camera.position.x, camera.position.y, camera.position.z, camera.fov ?? 0].map((v) => +v.toFixed(2)),
        rooms,
        tag: this.userData?.tag || '',
        path: (() => { const p = []; for (let o = this.parent; o && o.type !== 'Scene'; o = o.parent) p.unshift(o.name || o.type); return p.join('/'); })(),
        mat: col,
        kind: material?.type || '',
        inst: this.isInstancedMesh ? this.count : 0,
        transparent: Boolean(material?.transparent),
        vtx: geometry?.attributes?.position?.count ?? 0,
        tris: Math.floor((geometry?.attributes?.position?.count ?? 0) / 3),
        at: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
        size: [+(box.max.x - box.min.x).toFixed(2), +(box.max.z - box.min.z).toFixed(2)],
      });
    }
    return orig.apply(this, arguments);
  };
});

const contract = await page.evaluate(() => ({ views: window.LC.views || [], moments: window.LC.moments || [] }));

if (opts.inventory) {
  // Everything the page built, per room and per material: the merge plan. What
  // a frame actually draws is the listing above; this is the ceiling for
  // merging (two meshes in the same room with the same colour are one draw).
  const inv = await page.evaluate(async () => {
    const THREE = await import('/vendor/three/three.module.js');
    const { ROOMS } = await import('/game/full-shell.js');
    const { mergeLock, shadingSig, geometrySig } = await import('/game/full-merge.js');
    const scene = (() => {
      // the page never hands its scene out, but every object's onBeforeRender
      // closure did: find the scene by walking up from any object we can reach
      let o = null;
      window.LC.renderNow?.();
      const prev = THREE.Object3D.prototype.onBeforeRender;
      THREE.Object3D.prototype.onBeforeRender = function (r, s) { o = o || s; return prev.apply(this, arguments); };
      window.LC.renderNow();
      THREE.Object3D.prototype.onBeforeRender = prev;
      return o;
    })();
    const rows = [];
    const label = (o) => (o ? `${o.name || '(unnamed)'}#${o.id}` : '(none)');
    scene.traverse((m) => {
      if (!m.isMesh && !m.isPoints && !m.isSprite) return;
      const b = new THREE.Box3().setFromObject(m);
      const rooms = ROOMS.filter((r) => b.max.x >= r.x0 - 0.02 && b.min.x <= r.x1 + 0.02 && b.max.z >= r.z0 - 0.02 && b.min.z <= r.z1 + 0.02).map((r) => r.id);
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      let owner = '(scene)';
      for (let o = m.parent; o; o = o.parent) if (o.name) { owner = o.name; break; }
      rows.push({
        owner,
        par: label(m.parent),
        rooms: rooms.length === 1 ? rooms[0] : rooms.length ? `spans:${rooms.length}` : 'outside',
        mat: mat?.color ? '#' + mat.color.getHexString() : mat?.type || '?',
        // The exact bucket key game/full-merge.js uses: two rows with the same
        // sig fold into one draw with no pixel change, and nothing else does.
        sig: m.isMesh ? `${shadingSig(mat)}#${geometrySig(m.geometry)}` : 'other',
        // And the exact refusal the shipped code gives, so what this prints is
        // what the merge will do, not what this tool guesses.
        why: m.isMesh ? mergeLock(m) || '' : 'not a mesh',
        kind: mat?.type || '',
        alpha: Boolean(mat?.transparent),
        cast: `${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}${m.renderOrder || 0}`,
        vtx: m.geometry?.attributes?.position?.count ?? 0,
        inst: m.isInstancedMesh ? m.count : 0,
      });
    });
    return rows;
  });
  // Three merge scopes, all using game/full-merge.js's own rules: what folding
  // siblings of one group gives (that is what ships), what folding per ROOM
  // would give, and what folding the whole flat by shading would give. The gap
  // between them is the argument for one scope or the other.
  const keyOf = (r) => `${r.sig}\u0000${r.cast}`;
  const fold = (rows, keyof) => {
    const by = new Map();
    for (const r of rows) {
      const k = `${keyof(r)}\u0000${keyOf(r)}\u0000${r.why ? 'L' : 'F'}`;
      const b = by.get(k) || { n: 0, free: 0, tris: 0, rooms: new Set(), why: [], r };
      b.n++; if (!r.why) b.free++; b.tris += Math.floor(r.vtx / 3); b.rooms.add(r.rooms);
      if (r.why) b.why.push(r.why);
      by.set(k, b);
    }
    const groups = [...by.values()];
    return { groups, saves: groups.reduce((s, b) => s + (b.why.length ? 0 : Math.max(0, b.free - 1)), 0) };
  };
  const free = inv.filter((r) => !r.why);
  const scopes = [
    ['siblings of one group (ships)', (r) => r.par],
    ['per room', (r) => r.rooms],
    ['whole flat', () => 'flat'],
  ];
  console.log(`${inv.length} meshes, ${free.length} foldable by full-merge's rules:`);
  const perRoom = new Map();
  for (const [name, keyof] of scopes) {
    const { groups, saves } = fold(inv, keyof);
    console.log(`  folding ${name.padEnd(30)} gives back ${String(saves).padStart(3)} draws`);
    if (name === 'per room') {
      for (const b of groups.filter((g) => g.free > 1 && !g.why.length)) {
        const room = [...b.rooms][0];
        perRoom.set(room, (perRoom.get(room) || 0) + b.free - 1);
      }
      const blocked = new Map();
      for (const b of groups.filter((g) => g.why.length)) {
        for (const w of b.why) {
          const kind = w.startsWith('userData.') ? w.slice(9) : w;
          blocked.set(kind, (blocked.get(kind) || 0) + 1);
        }
      }
      console.log(`  what keeps a mesh its own draw: ${[...blocked].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ')}`);
    }
  }
  console.log(`  per room, folds available: ${[...perRoom].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}:${n}`).join(' ')}`);
  const freeByOwner = new Map();
  for (const r of free) freeByOwner.set(r.owner, (freeByOwner.get(r.owner) || 0) + 1);
  console.log(`  foldable by owner: ${[...freeByOwner].sort((a, b) => b[1] - a[1]).map(([o, n]) => `${o}:${n}`).join(' ')}`);
  const bySig = fold(free, (r) => r.rooms).groups.filter((b) => b.free > 2).sort((a, b) => b.free - a.free);
  console.log('  the folds themselves (room, colour, meshes, tris):');
  for (const b of bySig.slice(0, 18)) {
    console.log(`   ${[...b.rooms].join(',').slice(0, 22).padEnd(23)}${b.r.mat} ${String(b.free).padStart(3)} meshes ${String(b.tris).padStart(6)} tris  owners ${[...new Set(free.filter((r) => `${r.sig}\u0000${r.cast}` === `${b.r.sig}\u0000${b.r.cast}` && r.rooms === b.r.rooms).map((r) => r.owner))].join(',').slice(0, 40)}`);
  }
  console.log(`\ntotal meshes: ${inv.length}`);
  await browser.close();
  await server.close();
  process.exit(0);
}

const views = !opts.views || opts.views.includes('all') ? contract.views : opts.views;
// `--moments all` is the whole list; a single moment (the default) is the first
// one, because the cats' poses are what move the number most between moments.
const moments = !opts.moments
  ? [contract.moments[0] ?? null]
  : opts.moments.includes('all') ? contract.moments : opts.moments;

const results = [];
for (const moment of moments) {
  for (const view of views) {
    const recs = await page.evaluate(
      async ([m, t, v]) => {
        const THREE = await import('/vendor/three/three.module.js');
        window.LC.pause?.();
        if (m !== null) window.LC.setMoment(m);
        window.LC.seek?.(t);
        window.LC.setView(v);
        window.__dr.records = [];
        window.__dr.on = true;
        window.LC.renderNow();
        window.__dr.on = false;
        const stats = window.LC.getStats?.() ?? null;
        return { records: window.__dr.records, stats };
      },
      [moment, opts.time, view],
    );
    results.push({ moment, view, ...recs });
  }
}

await browser.close();
await server.close?.();

// ---------------------------------------------------------------- reporting
const fmt = (n, w) => String(n).padStart(w);
for (const r of results) {
  const total = r.records.length;
  const cams = [...new Map(r.records.map((x) => [x.pass + x.cam.join(','), x.cam])).entries()];
  console.log(
    `\n=== ${r.moment ?? 'none'} / ${r.view} — frame costs ${r.stats?.drawCalls} draws: ${total} main pass (listed below) + ${
      (r.stats?.drawCalls ?? 0) - total
    } shadow pass (three renders the shadow map without the per-object callback)` +
      cams.map(([k, c]) => `\n    camera ${k.startsWith('main') ? 'main' : 'shadow'} @ (${c.join(', ')}) → ${r.records.filter((x) => x.pass + x.cam.join(',') === k).length} draws`).join(''),
  );
  const byOwner = new Map();
  for (const rec of r.records) {
    const b = byOwner.get(rec.owner) || { draws: 0, tris: 0 };
    b.draws++; b.tris += rec.tris;
    byOwner.set(rec.owner, b);
  }
  console.log('  who draws it'.padEnd(22) + 'draws'.padStart(7) + 'tris'.padStart(9));
  for (const [owner, b] of [...byOwner.entries()].sort((a, b2) => b2[1].draws - a[1].draws)) {
    console.log('  ' + owner.padEnd(20) + fmt(b.draws, 7) + fmt(b.tris, 9));
  }
  const byRoom = new Map();
  const byObj = new Map();
  /** Which bucket an object's draws fall in: one room, several rooms (culling
   *  cannot split it) or outside every room rect (shell, sky, structure). */
  const bucket = (rec) =>
    rec.rooms.length === 0 ? 'outside rooms' : rec.rooms.length === 1 ? rec.rooms[0] : `SPANS ${rec.rooms.length}`;
  for (const rec of r.records) {
    const room = bucket(rec);
    const b = byRoom.get(room) || { draws: 0, tris: 0, shadow: 0 };
    b.draws++; b.tris += rec.tris; if (rec.pass === 'shadow') b.shadow++;
    byRoom.set(room, b);
    const k = `${rec.rooms.join('+')}|${rec.tag}|${rec.mat}|${rec.vtx}|${rec.at.join(',')}`;
    const o = byObj.get(k) || { ...rec, draws: 0, tris: 0 };
    o.draws++; o.tris += rec.tris;
    byObj.set(k, o);
  }
  console.log('  bucket'.padEnd(18) + 'draws'.padStart(7) + 'tris'.padStart(9));
  for (const [room, b] of [...byRoom.entries()].sort((a, b2) => b2[1].draws - a[1].draws)) {
    console.log('  ' + room.padEnd(16) + fmt(b.draws, 7) + fmt(b.tris, 9));
  }
  console.log('  top objects (rooms, tag, colour, verts, centre, footprint, draws):');
  const top = [...byObj.values()].sort((a, b) => b.draws - a.draws).slice(0, 28);
  for (const o of top) {
    console.log(
      `   ${(o.rooms.join('+') || 'outside').padEnd(14)} ${(o.tag || '—').padEnd(15)} ${o.mat.padEnd(9)} ${fmt(o.vtx, 6)} (${o.at.join(',')})`.padEnd(74) +
        ` ${(`box ${o.size[0]}x${o.size[1]}`).padEnd(13)} x${o.draws}${o.inst ? ` inst x${o.inst}` : ''}${o.transparent ? ' alpha' : ''}`,
    );
  }
}
if (opts.json) writeFileSync(opts.json, JSON.stringify(results, null, 1));
console.log(`\nwrote ${results.length} frames${opts.json ? ' -> ' + opts.json : ''}`);

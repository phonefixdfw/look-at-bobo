// game/full-street-mesh.js — the Uptown Dallas street seen from the balcony
// and the living-room windows (issue #83): ONE canvas-painted atlas + ONE
// merged mesh, drawn in a single unlit draw call. No photos, no brand names,
// no text, no real lights, no per-frame updates — the cars are parked and
// painted, which is what keeps this at one draw call and zero CPU per frame.
//
// The atlas rows are depth bands of one street: sky, far skyline, midrise,
// storefronts, roadway, near rooftops, side-street block (see full-street.js
// for the card math). Each backdrop card tiles quads sampling those rows, so
// far towers vanish behind the midrise, storefront bases meet the sidewalk,
// and the ground card's swapped roadway cross-section meets the canyon walls.
//
// `?quality=low` stacks two rows (sky + one compressed city/road row painted
// from the SAME skyline silhouette) on the same planes: a simpler scene, the
// same shape of skyline.
//
// Everything is painted from a fixed-seed generator, so the atlas — and every
// frame it appears in — is byte-identical run to run (capture determinism).
//
// Pure builder: takes { THREE, quality }, returns { group, stats }. The group
// carries userData.cullRooms so createRoomCull shows it from the living room
// and the balcony only.

import { CARDS_FULL, CARDS_LOW, CITY } from './full-street.js';

const ATLAS_FULL = {
  w: 512, h: 512,
  cells: {
    sky: { x: 0, y: 0, w: 256, h: 160 },
    far: { x: 256, y: 0, w: 256, h: 160 },
    mid: { x: 0, y: 160, w: 256, h: 128 },
    front: { x: 256, y: 160, w: 256, h: 128 },
    road: { x: 0, y: 288, w: 256, h: 112 },
    roof: { x: 256, y: 288, w: 256, h: 112 },
    side: { x: 0, y: 400, w: 256, h: 112 }, // block running down the street
  },
};
const ATLAS_LOW = {
  w: 256, h: 256,
  cells: {
    sky: { x: 0, y: 0, w: 128, h: 128 },
    city: { x: 0, y: 128, w: 256, h: 128 },
  },
};

// deterministic sequence — the atlas paints identically every run
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
const between = (rand, a, b) => a + rand() * (b - a);

// ─── painting ───────────────────────────────────────────────────────────────
// Cell-local pixel ops; drawing is clipped to the cell so cells can never
// bleed into one another.

function painter(ctx, cell) {
  const inside = (fn) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(cell.x, cell.y, cell.w, cell.h);
    ctx.clip();
    fn();
    ctx.restore();
  };
  return {
    cell,
    rect(x, y, w, h, style) {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = style;
      ctx.fillRect(cell.x + x, cell.y + y, w, h);
    },
    tri(x0, y0, x1, y1, x2, y2, style) {
      inside(() => {
        ctx.fillStyle = style;
        ctx.beginPath();
        ctx.moveTo(cell.x + x0, cell.y + y0);
        ctx.lineTo(cell.x + x1, cell.y + y1);
        ctx.lineTo(cell.x + x2, cell.y + y2);
        ctx.closePath();
        ctx.fill();
      });
    },
    disc(cx, cy, r, style) {
      inside(() => {
        ctx.fillStyle = style;
        ctx.beginPath();
        ctx.arc(cell.x + cx, cell.y + cy, r, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    hgrad(y0, y1, stops) {
      inside(() => {
        const g = ctx.createLinearGradient(0, cell.y + y0, 0, cell.y + y1);
        for (const [at, color] of stops) g.addColorStop(at, color);
        ctx.fillStyle = g;
        ctx.fillRect(cell.x, cell.y + Math.min(y0, y1), cell.w, Math.abs(y1 - y0));
      });
    },
    vgrad(x0, x1, y, h, stops) {
      inside(() => {
        const g = ctx.createLinearGradient(cell.x + x0, 0, cell.x + x1, 0);
        for (const [at, color] of stops) g.addColorStop(at, color);
        ctx.fillStyle = g;
        ctx.fillRect(cell.x + x0, cell.y + y, Math.abs(x1 - x0), h);
      });
    },
  };
}

// the sky gradient keeps the old flat sky's colours (#8ec4ea top, #cfe6f4 low,
// #f3ead9 foot) so the daytime outside is recognisably the same sky, layered
function paintSky(P, rand) {
  const { h } = P.cell;
  P.hgrad(0, h, [
    [0, CITY.sky.zenith], [0.22, CITY.sky.top], [0.5, CITY.sky.mid],
    [0.7, CITY.sky.low], [0.88, CITY.sky.haze], [1, '#efe3cd'],
  ]);
  const clouds = Math.max(5, Math.round(h / 16));
  for (let i = 0; i < clouds; i += 1) {
    const cx = between(rand, 10, P.cell.w - 10);
    const cy = between(rand, h * 0.08, h * 0.6);
    const w = between(rand, 18, 52);
    const hh = between(rand, 2, 4);
    P.rect(cx - w / 2, cy, w, hh, 'rgba(255,252,244,0.28)');
    P.rect(cx - w * 0.3, cy + hh, w * 0.6, hh, 'rgba(255,252,244,0.16)');
  }
}

// the skyline silhouette — a fixed shape (seed 1337) so the low tier can
// paint the same outline compressed. Uptown nods: a pointed crown, a
// sphere-tip tower, a couple of masts.
function skylinePoints(w, maxH) {
  const rand = rng(1337);
  const pts = [];
  let x = 0;
  while (x < w) {
    const bw = Math.round(between(rand, 9, 24));
    const bh = Math.round(between(rand, 0.3, 1) * maxH);
    pts.push({ x, w: bw, h: bh, kind: rand() });
    x += bw + Math.round(between(rand, 0, 3));
  }
  return pts;
}

function paintFar(P) {
  const { w, h } = P.cell;
  P.hgrad(0, h, [[0, CITY.sky.haze], [1, '#eadfce']]);
  const rand = rng(777);
  const bodies = ['#b9c2cc', '#c3c9cf', '#aeb6bf', '#cdd2d6', '#9fb3c6', '#b2bcc6'];
  for (const b of skylinePoints(w, h * 0.72)) {
    const top = h - 2 - b.h;
    const style = pick(rand, bodies);
    P.rect(b.x, top, b.w, b.h + 2, style);
    if (b.kind < 0.14 && b.h > h * 0.45) {
      P.rect(b.x + Math.round(b.w / 2) - 1, top - Math.round(between(rand, 8, 18)), 2, 16, '#8d959e'); // mast
    } else if (b.kind < 0.28) {
      P.rect(b.x + 2, top - 4, b.w - 4, 4, style); // setback crown
    } else if (b.kind > 0.92 && b.h > h * 0.5) {
      P.tri(b.x, top, b.x + b.w, top, b.x + b.w / 2, top - 24, '#b7c0ca'); // pointed
    } else if (b.kind > 0.84 && b.kind < 0.88 && b.w > 8) {
      P.rect(b.x + Math.round(b.w / 2) - 1, top - 14, 2, 8, '#96a0aa');
      P.disc(b.x + b.w / 2, top - 12, 4, '#cfd6dd'); // sphere tip
    } else {
      P.rect(b.x, top, b.w, 2, '#d7dbdf');
    }
    const win = rand() < 0.5 ? 'rgba(96,112,128,0.7)' : 'rgba(216,226,234,0.55)';
    for (let wy = top + 4; wy < h - 5; wy += 4) {
      for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 4) {
        if (rand() < 0.6) P.rect(wx, wy, 1, 2, win);
      }
    }
  }
  // haze pooling at the horizon and again at the very foot (the far card
  // samples this bottom strip for the ground beyond the last rooftops)
  P.hgrad(h, h * 0.5, [[0, 'rgba(240,229,208,0.8)'], [1, 'rgba(240,229,208,0)']]);
  P.hgrad(h, h - 18, [[0, 'rgba(233,222,201,1)'], [1, 'rgba(233,222,201,0)']]);
}

function paintMid(P, rand) {
  const { w, h } = P.cell;
  P.hgrad(0, h, [[0, '#f0e7d6'], [1, '#e7dcc8']]);
  let x = 2;
  while (x < w - 8) {
    const bw = Math.round(between(rand, 16, 40));
    const bh = Math.round(between(rand, h * 0.45, h * 0.92));
    const top = h - bh;
    const style = pick(rand, CITY.mid.bricks.concat(CITY.mid.glass));
    P.rect(x, top, bw, bh, style);
    P.rect(x, top, bw, 2, '#cbc4b6');
    const glass = CITY.midWindows[pick(rand, [0, 1, 2]) % CITY.midWindows.length];
    if (CITY.mid.glass.indexOf(style) >= 0) {
      for (let wy = top + 3; wy < h - 2; wy += 3) P.rect(x + 1, wy, bw - 2, 1, glass);
    } else {
      for (let wy = top + 4; wy < h - 3; wy += 5) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 4) {
          P.rect(wx, wy, 2, 3, rand() < 0.82 ? glass : '#c9c1b2');
        }
      }
    }
    if (rand() < 0.5) P.rect(x + Math.round(bw * 0.6), top - 3, 4, 3, '#8a9098');
    x += bw + Math.round(between(rand, 2, 7));
  }
  P.hgrad(h, h * 0.72, [[0, 'rgba(235,224,202,0.45)'], [1, 'rgba(235,224,202,0)']]);
}

function paintFront(P, rand) {
  const { w, h } = P.cell;
  P.hgrad(0, h, [[0, '#efe5d2'], [1, '#e6dac4']]);
  let x = 0;
  while (x < w - 6) {
    const bw = Math.round(between(rand, 18, 44));
    const bh = Math.round(between(rand, h * 0.3, h * 0.62));
    const top = h - 8 - bh;
    const style = pick(rand, CITY.front.bricks.concat(CITY.front.painted));
    P.rect(x, top, bw, bh + 8, style);
    P.rect(x, top, bw, 3, rand() < 0.5 ? '#e0d5c0' : '#6f4a41'); // cornice
    if (rand() < 0.4) P.rect(x + 3, top - Math.round(between(rand, 4, 12)), bw - 6, 12, style); // false front
    const pane = CITY.frontWindows[pick(rand, [0, 1, 2]) % CITY.frontWindows.length];
    for (let wy = top + 8; wy < h - 27; wy += 9) {
      for (let wx = x + 4; wx < x + bw - 5; wx += 7) P.rect(wx, wy, 3, 5, pane);
    }
    P.rect(x + 2, h - 24, bw - 4, 16, CITY.front.door); // storefront glazing
    P.rect(x + 3, h - 23, bw - 6, 13, CITY.front.glass);
    for (let sx = x + 2; sx < x + bw - 3; sx += 6) {
      P.rect(sx, h - 27, 3, 3, CITY.front.awnings[((sx - x) / 3) % 2 ? 1 : 0]);
    }
    x += bw + 1;
  }
  P.rect(0, h - 8, w, 8, '#d8d2c6'); // sidewalk foot — the far card seam below
}

function paintCar(P, rand, x, y, dir) {
  const bw = Math.round(between(rand, 22, 30));
  const style = pick(rand, CITY.car.body);
  const y0 = dir > 0 ? y : y + 1;
  P.rect(x + 2, y0 - 3, bw - 5, 3, style); // cabin
  P.rect(x, y0, bw, 9, style); // body
  P.rect(x + 4, y0 - 2, bw - 9, 2, '#42505e'); // glass
  P.rect(x + 3, y0 + 9, 4, 2, '#20232a'); // tyres
  P.rect(x + bw - 7, y0 + 9, 4, 2, '#20232a');
  P.rect(dir > 0 ? x + bw - 1 : x, y0 + 2, 1, 2, '#f0e9d2'); // headlight end
  P.rect(x - 1, y0 + 11, bw + 2, 2, 'rgba(30,33,38,0.35)'); // shadow
}

function paintRoad(P) {
  const { w, h } = P.cell;
  P.rect(0, 0, w, 12, '#c9c3b6'); // far sidewalk — meets the storefronts
  P.rect(0, 11, w, 2, '#b3ac9e'); // curb
  P.rect(0, 13, w, h - 26, '#4b4f54'); // asphalt
  P.rect(0, 33, w, 1, 'rgba(214,206,182,0.5)'); // parking-lane lines
  P.rect(0, 64, w, 1, 'rgba(214,206,182,0.5)');
  for (let dx = 8; dx < w - 24; dx += 40) P.rect(dx, 49, 16, 2, 'rgba(214,206,182,0.55)'); // centre dashes
  const rand = rng(90210);
  for (let cx = 4; cx < w - 32; cx += Math.round(between(rand, 36, 58))) paintCar(P, rand, cx, 20, 1);
  for (let cx = 12; cx < w - 32; cx += Math.round(between(rand, 38, 62))) paintCar(P, rand, cx, 52, -1);
  // a box truck in the near lane
  P.rect(w - 66, 72, 32, 11, '#dcd6ca');
  P.rect(w - 36, 74, 8, 9, '#8c9299');
  P.rect(w - 64, 83, 5, 3, '#20232a');
  P.rect(w - 35, 83, 5, 3, '#20232a');
  P.rect(w - 67, 84, 40, 2, 'rgba(30,33,38,0.35)');
  P.rect(0, h - 14, w, 2, '#b3ac9e'); // near curb
  P.rect(0, h - 12, w, 12, '#d4cec1'); // near sidewalk
  const r2 = rng(4242);
  for (let i = 0; i < 10; i += 1) {
    P.rect(Math.round(between(r2, 4, w - 12)), Math.round(between(r2, 16, h - 18)),
      Math.round(between(r2, 4, 9)), Math.round(between(r2, 3, 5)), 'rgba(64,68,72,0.9)');
  }
}

// the block running down the street (west/east cards): brick rows with
// cornices + window grids, storefront glazing and awnings at the foot, and a
// sidewalk strip that meets the ground card's side edge. One cell stretches
// the ~33 m the card spans; the stretch reads as wide 1920s warehouse bays.
function paintSide(P, rand) {
  const { w, h } = P.cell;
  P.hgrad(0, h, [[0, CITY.sky.haze], [0.3, '#efe7d6'], [1, '#e6dbc6']]);
  let x = 0;
  while (x < w - 6) {
    const bw = Math.round(between(rand, 22, 52));
    const bh = Math.round(between(rand, h * 0.4, h * 0.92));
    const top = h - bh;
    const style = pick(rand, CITY.mid.bricks.concat(CITY.front.painted));
    P.rect(x, top, bw, bh, style);
    P.rect(x, top, bw, 3, rand() < 0.5 ? '#e0d5c0' : '#6f4a41'); // cornice
    const pane = CITY.midWindows[pick(rand, [0, 1, 2]) % CITY.midWindows.length];
    for (let wy = top + 8; wy < h - 27; wy += 7) {
      for (let wx = x + 3; wx < x + bw - 4; wx += 6) {
        P.rect(wx, wy, 3, 4, rand() < 0.85 ? pane : '#c9c1b2');
      }
    }
    P.rect(x + 2, h - 22, bw - 4, 14, CITY.front.door); // storefront glazing
    P.rect(x + 3, h - 21, bw - 6, 11, CITY.front.glass);
    for (let sx = x + 2; sx < x + bw - 3; sx += 6) {
      P.rect(sx, h - 25, 3, 3, CITY.front.awnings[((sx - x) / 3) % 2 ? 1 : 0]);
    }
    x += bw + 1;
  }
  P.rect(0, h - 7, w, 7, '#d8d2c6'); // sidewalk foot — meets the ground card
}

function paintRoof(P, rand) {
  const { w, h } = P.cell;
  P.rect(0, 0, w, h, '#3a3d42'); // the slot you fall into between rooftops
  let x = 0;
  while (x < w - 10) {
    const bw = Math.round(between(rand, 26, 62));
    const face = pick(rand, ['#8f8d86', '#98958c', '#86837c']);
    P.rect(x, 2, bw, h - 2, face);
    P.rect(x, 2, bw, 3, '#c5c0b4'); // sunlit parapet cap
    P.rect(x, 5, bw, 2, '#6f6c65');
    for (let i = 2; i < bw - 2; i += 3) P.rect(x + i, 8 + ((i * 7) % Math.max(1, h - 14)), 1, 1, 'rgba(255,255,255,0.1)');
    let cx = x + 3;
    while (cx < x + bw - 5) {
      const kind = rand();
      if (kind < 0.45) {
        const bw2 = Math.round(between(rand, 4, 9));
        P.rect(cx, Math.round(between(rand, 10, h - 16)), bw2, Math.round(between(rand, 4, 7)), '#7d8288'); // HVAC
        cx += bw2 + 3;
      } else if (kind < 0.58) {
        P.rect(cx + 1, 10, 6, 9, '#9a8f80'); // water tank
        P.rect(cx, 19, 8, 2, '#7b7266');
        cx += 11;
      } else if (kind < 0.72) {
        for (let sy = 0; sy < 2; sy += 1) P.rect(cx, 12 + sy * 5, Math.min(12, x + bw - cx - 4), 3, '#2e3d52'); // solar
        cx += 14;
      } else if (kind < 0.86) {
        P.rect(cx, Math.round(between(rand, 12, h - 14)), 3, 3, '#aeb4ba'); // vent
        cx += 6;
      } else {
        P.rect(cx, Math.round(between(rand, 10, h - 12)), Math.round(between(rand, 5, 10)), Math.round(between(rand, 4, 8)), '#5c7a4a'); // planting
        cx += 12;
      }
    }
    x += bw + Math.round(between(rand, 2, 6));
  }
}

// low tier: compressed city+road row — same skyline silhouette on top, a
// midrise band in the middle, roadway with parked cars at the bottom
function paintCity(P, rand) {
  const { w, h } = P.cell;
  P.hgrad(0, h, [[0, CITY.sky.haze], [1, '#e4d9c4']]);
  const randB = rng(777);
  const bodies = ['#b9c2cc', '#c3c9cf', '#aeb6bf', '#cdd2d6', '#9fb3c6', '#b2bcc6'];
  const roadTop = Math.round(h * 0.7);
  const skyTop = Math.round(h * 0.42);
  for (const b of skylinePoints(w / 2, (h * 0.72) / 2)) {
    const top = Math.max(2, skyTop - Math.round(b.h / 2));
    P.rect(b.x * 2, top, b.w * 2, skyTop - top + 2, pick(randB, bodies));
  }
  P.rect(0, skyTop, w, 2, 'rgba(238,228,206,0.9)'); // horizon line
  let x = 2;
  while (x < w - 8) {
    const bw = Math.round(between(rand, 16, 40));
    const bh = Math.round(between(rand, (roadTop - skyTop) * 0.45, roadTop - skyTop));
    const style = pick(rand, CITY.mid.bricks);
    P.rect(x, roadTop - bh, bw, bh, style);
    P.rect(x, roadTop - bh, bw, 2, '#cbc4b6');
    for (let wy = roadTop - bh + 3; wy < roadTop - 2; wy += 6) {
      for (let wx = x + 3; wx < x + bw - 3; wx += 6) P.rect(wx, wy, 2, 3, CITY.midWindows[0]);
    }
    x += bw + Math.round(between(rand, 2, 8));
  }
  P.rect(0, roadTop, w, 4, '#c9c3b6');
  P.rect(0, roadTop + 4, w, h - roadTop - 4, '#4b4f54');
  for (let dx = 8; dx < w - 24; dx += 44) P.rect(dx, roadTop + Math.round((h - roadTop) * 0.5), 14, 2, 'rgba(214,206,182,0.5)');
  const randC = rng(90210);
  for (let cx = 6; cx < w - 30; cx += Math.round(between(randC, 42, 64))) paintCar(P, randC, cx, roadTop + 7, 1);
  P.rect(0, h - 5, w, 5, '#d4cec1');
}

function paintAtlas(THREE, tier) {
  const atlas = tier === 'low' ? ATLAS_LOW : ATLAS_FULL;
  const canvas = document.createElement('canvas');
  canvas.width = atlas.w;
  canvas.height = atlas.h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = CITY.sky.haze;
  ctx.fillRect(0, 0, atlas.w, atlas.h);
  const at = (key) => painter(ctx, atlas.cells[key]);
  const rand = rng(20261117);
  paintSky(at('sky'), rand);
  if (tier === 'low') {
    paintCity(at('city'), rand);
  } else {
    paintFar(at('far'));
    paintMid(at('mid'), rand);
    paintFront(at('front'), rand);
    paintRoad(at('road'));
    paintRoof(at('roof'), rand);
    paintSide(at('side'), rand);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { atlas, canvas, texture };
}

// ─── mesh ───────────────────────────────────────────────────────────────────

// one quad of a card: world y span [yTop, yBottom], sampling one atlas row
// (optionally sliced by vBand fractions from the row's top), in that card's
// plane. Corners go bl, br, tr, tl; north planes face +z (long axis x), west
// planes face +x and east planes face -x (long axis z, running down-street).
function emitQuad(parts, plane, spec, quad, atlas) {
  const cell = atlas.cells[quad.cell];
  const [vb0, vb1] = quad.vBand ?? [0, 1];
  const [ub0, ub1] = quad.uBand ?? [0, 1];
  const tint = quad.tint ?? 1;
  const pad = 1; // px: keep filtering off neighbouring cells
  const u0 = (cell.x + ub0 * cell.w + (ub0 === 0 ? pad : 0)) / atlas.w;
  const u1 = (cell.x + ub1 * cell.w - (ub1 === 1 ? pad : 0)) / atlas.w;
  const vTop = 1 - (cell.y + vb0 * cell.h + (vb0 === 0 ? pad : 0)) / atlas.h;
  const vBot = 1 - (cell.y + vb1 * cell.h - (vb1 === 1 ? pad : 0)) / atlas.h;
  const [yTop, yBot] = quad.y ?? [0, 0];
  let bl; let br; let tl; let tr;
  if (plane === 'ground') {
    // flat on the street floor: the cell's top edge is the FAR curb (it tucks
    // under the storefront card) and its bottom edge the near one
    bl = [spec.x0, spec.y, spec.z1]; br = [spec.x1, spec.y, spec.z1];
    tr = [spec.x1, spec.y, spec.z0]; tl = [spec.x0, spec.y, spec.z0];
  } else if (plane === 'north') {
    bl = [spec.x1, yBot, spec.z]; br = [spec.x0, yBot, spec.z];
    tr = [spec.x0, yTop, spec.z]; tl = [spec.x1, yTop, spec.z];
  } else if (plane === 'west') {
    bl = [spec.x, yBot, spec.z1]; br = [spec.x, yBot, spec.z0];
    tr = [spec.x, yTop, spec.z0]; tl = [spec.x, yTop, spec.z1];
  } else {
    bl = [spec.x, yBot, spec.z0]; br = [spec.x, yBot, spec.z1];
    tr = [spec.x, yTop, spec.z1]; tl = [spec.x, yTop, spec.z0];
  }
  const idx = parts.pos.length / 3;
  parts.pos.push(bl[0], bl[1], bl[2], br[0], br[1], br[2], tr[0], tr[1], tr[2], tl[0], tl[1], tl[2]);
  if (quad.swapUV) {
    // ground cards only: cell-u runs down-street (world z, near edge first),
    // cell-v across the canyon (world x, west first) — the painted roadway
    // cross-section spans the canyon and its cars/dashes run with the street
    parts.uv.push(u0, vBot, u0, vTop, u1, vTop, u1, vBot);
  } else {
    parts.uv.push(u0, vBot, u1, vBot, u1, vTop, u0, vTop);
  }
  for (let i = 0; i < 4; i += 1) parts.col.push(tint, tint, tint);
  parts.idx.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
}

export function buildFullStreet({ THREE, quality = 'full' }) {
  const tier = quality === 'low' ? 'low' : 'full';
  const { atlas, canvas, texture } = paintAtlas(THREE, tier);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    vertexColors: true,
    side: THREE.DoubleSide,
    toneMapped: false, // same treatment as the sky sheets it replaces
  });

  const parts = { pos: [], uv: [], col: [], idx: [] };
  for (const card of tier === 'low' ? CARDS_LOW : CARDS_FULL) {
    for (const quad of card.quads) emitQuad(parts, card.plane, card, quad, atlas);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(parts.pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(parts.uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(parts.col, 3));
  geometry.setIndex(parts.idx);
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'uptown-street';
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  const group = new THREE.Group();
  group.name = 'street';
  group.userData.cullRooms = ['living', 'balcony'];
  group.add(mesh);

  return {
    group,
    mesh,
    texture,
    atlasCanvas: canvas,
    tier,
    stats: {
      drawCalls: 1,
      triangles: parts.idx.length / 3,
      atlasWidth: atlas.w,
      atlasHeight: atlas.h,
      material: 'basic',
    },
  };
}

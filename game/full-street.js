// game/full-street.js — data for the Uptown Dallas street backdrop (issue #83).
// The mesh + painted atlas live in full-street-mesh.js; this file is the plain
// data the checks and docs read: which rooms may see the street, and the card
// layout in world coordinates.
//
// The world maths: the eye sits at y 1.62 on the balcony (floor 0) and the
// street runs 9.3 m below. A backdrop card is a vertical plane; the band that
// holds a row of buildings roots their bases where the sight-line to their
// real bases crosses the card — at or near the horizon line y ≈ 1.62 for
// anything across the street. Near things (the roof of the two-storey block
// directly below the balcony) sit low on their own card and occlude what is
// behind them, so looking down the balcony shows: near rooftops, the street
// just above their parapets, storefronts, midrise, and the skyline on the
// horizon.

export const STREET_GROUND_Y = -9.3; // asphalt level below the balcony
export const STREET_ROOF_Y = -2.2; // parapet of the block under the balcony
export const HORIZON_Y = 1.62; // eye height — the skyline's anchor line

// The street group is only ever visible from these rooms (checked against the
// camera room by createRoomCull via userData.cullRooms). The balcony rect sits
// inside the living room, so one list covers both; every other room — and the
// street view frame, which stands inside the living room — shows it, and
// nothing else does.
export const CULL_ROOMS = ['living', 'balcony'];

// Palette — flat painted card colours (issue #83: not the material PBR set).
// The sky tops out on the old flat blue (#8ec4ea) so the daytime reads the
// same; warm haze toward the horizon.
export const CITY = {
  sky: {
    zenith: '#5d93c4',
    top: '#8ec4ea', // the old sky's top blue — kept
    mid: '#b8d9ee',
    low: '#cfe6f4', // the old sky's bottom blue — kept
    haze: '#f3ead9', // the old sky's warm foot — kept
  },
  mid: {
    bricks: ['#a8625a', '#8f5049', '#b5ac9d', '#9aa0a6'],
    glass: ['#7f97ab', '#6f8ba1', '#8c9fb2'],
  },
  midWindows: ['#55606c', '#48525e', '#6a7683'],
  front: {
    bricks: ['#a5554e', '#b0685c', '#8f4a42'],
    painted: ['#c9b7a0', '#7c8b93', '#b8a488'],
    glass: '#62707d',
    door: '#4a4038',
    awnings: ['#b0433f', '#e8ddca'],
  },
  frontWindows: ['#62707d', '#556370', '#6e7d8a'],
  car: {
    body: ['#e6e6e2', '#a9adb2', '#a8413d', '#2c2e31', '#4a6785', '#c9c2b2'],
  },
};

// One flat card = a plane + a stack of quads tiling it top-down. `quads` are
// world y spans [top, bottom]; each samples one atlas row (cell), `tint` is a
// flat brightness, `vBand` optionally slices the row (fractions from its top)
// for haze/base strips. North planes face +z (long axis x); west/east planes
// run down the street (long axis z) and face the street.
export const CARDS_FULL = [
  {
    id: 'window',
    plane: 'north',
    z: -3.24,
    x0: -2.8,
    x1: 0.4,
    quads: [
      { cell: 'sky', y: [2.55, 1.7] },
      { cell: 'far', y: [1.7, 1.15], tint: 0.98 },
      { cell: 'front', y: [1.15, 0.75], tint: 1.02 },
      { cell: 'road', y: [0.75, 0.45], tint: 1.06 },
    ],
  },
  {
    id: 'far',
    plane: 'north',
    z: -60,
    x0: -43,
    x1: 49,
    quads: [
      { cell: 'sky', y: [46, 26.4] },
      { cell: 'far', y: [26.4, 1.2], tint: 0.94 },
      { cell: 'far', y: [1.2, STREET_GROUND_Y], vBand: [0.85, 1], tint: 0.98 },
    ],
  },
  {
    id: 'mid',
    plane: 'north',
    z: -36,
    x0: -20,
    x1: 18,
    quads: [
      { cell: 'mid', y: [18.7, 0.2], tint: 0.97 },
      { cell: 'mid', y: [0.2, STREET_GROUND_Y], vBand: [0.9, 1] },
    ],
  },
  {
    id: 'street',
    plane: 'north',
    z: -20.5,
    x0: -16,
    x1: 14,
    quads: [
      { cell: 'front', y: [5.9, 0.15], tint: 1.03 },
      { cell: 'road', y: [0.15, -9.28], tint: 1.08 },
    ],
  },
  {
    id: 'roof',
    plane: 'north',
    z: -8,
    x0: -11,
    x1: 13,
    quads: [
      { cell: 'roof', y: [STREET_ROOF_Y, -9.28], tint: 0.95 },
    ],
  },
  {
    id: 'west',
    plane: 'west',
    x: -8,
    z0: -4.6,
    z1: -36,
    quads: [
      { cell: 'sky', y: [46, 26] },
      { cell: 'far', y: [26, 1.2], tint: 0.94 },
      { cell: 'road', y: [1.2, -9.28], tint: 1.02 },
    ],
  },
  {
    id: 'east',
    plane: 'east',
    x: 9.5,
    z0: -4.6,
    z1: -36,
    quads: [
      { cell: 'sky', y: [46, 26] },
      { cell: 'far', y: [26, 1.2], tint: 0.94 },
      { cell: 'road', y: [1.2, -9.28], tint: 1.02 },
    ],
  },
];

// `?quality=low`: two rows (sky + one compressed city/road row painted with
// the SAME skyline silhouette) on the same planes. The occluders in between
// (midrise, storefront, rooftops) drop out; the shape of the skyline does not
// change with quality.
export const CARDS_LOW = [
  {
    id: 'window',
    plane: 'north',
    z: -3.24,
    x0: -2.8,
    x1: 0.4,
    quads: [
      { cell: 'sky', y: [2.55, 1.35] },
      { cell: 'city', y: [1.35, 0.45] },
    ],
  },
  {
    id: 'far',
    plane: 'north',
    z: -60,
    x0: -43,
    x1: 49,
    quads: [
      { cell: 'sky', y: [46, 5] },
      { cell: 'city', y: [5, STREET_GROUND_Y] },
    ],
  },
  {
    id: 'west',
    plane: 'west',
    x: -8,
    z0: -4.6,
    z1: -36,
    quads: [
      { cell: 'sky', y: [46, 16] },
      { cell: 'city', y: [16, -9.28] },
    ],
  },
  {
    id: 'east',
    plane: 'east',
    x: 9.5,
    z0: -4.6,
    z1: -36,
    quads: [
      { cell: 'sky', y: [46, 16] },
      { cell: 'city', y: [16, -9.28] },
    ],
  },
];

// Where the camera stands for the new 'street' capture view, and the rects
// the backdrop must stay clear of (the balcony + living-room walkable floors —
// geometry there would read as floating cards, issue #83).
export const EYEWITNESS = {
  view: { pos: [1.5, 1.62, -3.6], yaw: 0, pitch: -0.5, fov: 55 },
  windowCard: CARDS_FULL[0],
  clearRects: [
    { x0: -4.0, x1: 4.2, z0: -5.0, z1: 2.4 }, // living room floor
    { x0: 0.55, x1: 2.45, z0: -4.4, z1: -3.1 }, // balcony floor
  ],
};

// game/full-roomba-mesh.js — the robot vacuum of issue #85: one small disc
// of household plastic, built as ONE merged mesh in ONE draw call, the way
// game/full-street-mesh.js does for the street. Every part (body, bumper
// collar, brush skirt, sensor turret, status light) is pushed into a single
// BufferGeometry sharing one lit material with vertex colours, so the whole
// appliance costs the budget +1 draw and a couple hundred triangles, and it
// shades with the flat's own sun and fills like any furniture piece.
//
// The mesh never moves itself: game/full-apartment.js files it on the flat,
// createRoomCull hides it with the rooms the route never enters, and the
// engine places it every frame from game/full-roomba-route.js — position and
// heading from the arc-length walk, plus a small roll into each corner so it
// leans into turns like a feeler bar sweeping the floor. It is nobody's brand
// and wears no logos: a plain round vacuum, the sort any flat has.
//
// `?quality=low` keeps the same silhouette on fewer segments (body + bumper
// collar + light) — the same appliance with the detail sanded off.

/** Palette — appliance greys with one acid status LED, in the flat's own
 *  restrained register (docs/ART_STYLE.md): dark body, darker bumper, pale
 *  sensor dome, and the light the only bright thing on it. */
const PAINT = {
  body: [0.246, 0.275, 0.314], // #3f4650 graphite
  bumper: [0.137, 0.149, 0.173], // #23262c
  skirt: [0.106, 0.118, 0.133], // #1b1e22 brush shadow
  turret: [0.847, 0.871, 0.902], // #d8dee6 sensor dome
  light: [0.722, 1.0, 0.369], // #b8ff5e — "on duty"
};

/**
 * Build the vacuum.
 * @param {{THREE:any, quality?:'full'|'low'}} opts
 * @returns {{group: any, mesh: any, stats: {drawCalls:number, triangles:number}}}
 */
export function buildFullRoomba({ THREE, quality = 'full' }) {
  const low = quality === 'low';
  const seg = low ? 10 : 20;

  const parts = [];
  const add = (geo, matrix, color) => {
    const g = geo.clone().applyMatrix4(matrix);
    geo.dispose();
    g.userData.color = color;
    parts.push(g);
  };
  const at = (x, y, z, ry = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
    new THREE.Vector3(1, 1, 1),
  );

  // Body: the disc. Radius 0.145 under the route's 0.15 clearance so the
  // drawn footprint is the footprint the route planned with.
  add(new THREE.CylinderGeometry(0.145, 0.145, 0.075, seg), at(0, 0.055, 0), PAINT.body);
  // Top cap bevel: a slightly smaller, slightly higher disc — the molded lid.
  add(new THREE.CylinderGeometry(0.118, 0.132, 0.02, seg), at(0, 0.1, 0), PAINT.body);
  // Bumper collar: the front-driving ring, a hair wider than the body.
  add(new THREE.CylinderGeometry(0.15, 0.15, 0.05, seg, 1, true), at(0, 0.045, 0), PAINT.bumper);
  // Brush skirt: the dark shadow-gap under the body — reads as clearance.
  add(new THREE.CylinderGeometry(0.122, 0.122, 0.018, low ? 8 : 14), at(0, 0.012, 0), PAINT.skirt);

  if (!low) {
    // Sensor turret at the back: the little raised dome that does the seeing.
    add(new THREE.CylinderGeometry(0.052, 0.058, 0.024, 12), at(0, 0.116, -0.062), PAINT.turret);
    // Front face plate: the bumper's scan window, a flatter lighter band.
    add(new THREE.BoxGeometry(0.085, 0.026, 0.012), at(0, 0.062, 0.144), PAINT.turret);
  }
  // Status light: the one bright thing. A lit LED the size of a grain of rice.
  add(new THREE.BoxGeometry(0.034, 0.011, 0.008), at(0, 0.082, 0.14), PAINT.light);

  // ── merge ──
  let vTotal = 0;
  let iTotal = 0;
  for (const g of parts) { vTotal += g.attributes.position.count; iTotal += g.index ? g.index.count : 0; }
  const pos = new Float32Array(vTotal * 3);
  const nrm = new Float32Array(vTotal * 3);
  const col = new Float32Array(vTotal * 3);
  const idx = new Uint16Array(iTotal);
  let vOff = 0; let iOff = 0;
  for (const g of parts) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    pos.set(p, vOff * 3);
    nrm.set(n, vOff * 3);
    const c = g.userData.color;
    for (let i = 0; i < g.attributes.position.count; i++) { col[(vOff + i) * 3] = c[0]; col[(vOff + i) * 3 + 1] = c[1]; col[(vOff + i) * 3 + 2] = c[2]; }
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[iOff + i] = gi[i] + vOff;
    vOff += g.attributes.position.count;
    iOff += gi.length;
    g.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setIndex(new THREE.BufferAttribute(idx, 1));
  geometry.computeBoundingSphere();

  // One material for the whole appliance; the LED colour is bright enough to
  // read as emissive under the flat's lighting without a second draw.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'robot-vacuum';
  // No shadow: the sun's shadow pass would draw this mesh a SECOND time, and
  // the issue's promise is +1 draw call, max. For an 11 cm floor disc nobody
  // sees the missing shadow, but the draw table would see the +2.
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const group = new THREE.Group();
  group.name = 'roomba';
  group.add(mesh);
  // createRoomCull: the vacuum only serves the open rooms — shown whenever
  // the camera is in any of them, hidden (with zero cost) everywhere else.
  group.userData.cullRooms = ['living', 'hall', 'kitchen', 'dining'];

  return {
    group,
    mesh,
    material,
    stats: { drawCalls: 1, triangles: iTotal / 3, tier: low ? 'low' : 'full' },
  };
}

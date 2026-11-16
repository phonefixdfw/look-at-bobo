/** --------------------------------------------------------------------------
 *  Issue #61 — folding the flat's static geometry down to one draw per shading.
 *
 *  Why: `npm run capture:full` counts every draw call in every frame of the
 *  507-frame matrix, and the flat's worst frame had grown to 169 against the
 *  150-call budget docs/ART_STYLE.md sets. The rooms are built from data tables
 *  that emit one mesh per box, so a run of twelve cabinet doors costs twelve
 *  draws even though all twelve share one material, never move, and are never
 *  read by a check. This folds those runs together: same vertices, same normals,
 *  same material, one buffer, one draw.
 *
 *  What it refuses to fold, and why:
 *   - anything a selfTest check measures by mesh — `userData.scale` /
 *     `userData.scaleGroup` (game/full.js `furniture-real-scale` reads the built
 *     AABB of every box the ruler names), `userData.tag` (the parked door leaves
 *     `doorways-read-open` renders pixels at) or a mesh `name`
 *     (`bedroom-flush-to-wall` looks its pieces up by name). Folding two of
 *     those into one box would move a check, not a draw call.
 *   - anything with a script on it: the pen, the cats, any object carrying an
 *     `eyes` / `ell` / `baseScale` / `baseRot*` marker, and any group whose own
 *     `userData.noMerge` says the subtree under it is live.
 *   - anything transparent. Those meshes sit in the renderer's sorted list, and
 *     their order is part of how they look; one mesh cannot stand in for five
 *     quads that sort against other things between them.
 *   - anything whose geometry will not concat cleanly: an attribute the other
 *     members of the bucket lack, morph targets, a multi-material mesh.
 *
 *  Two meshes fold when their MATERIALS SHADE THE SAME, which is not the same
 *  question as "are they the same object": `shadingSig` reads the parameters
 *  that reach the fragment — colour, roughness, metalness, emissive, maps, side,
 *  blending, depth — and only identical signatures fold, onto the material
 *  object the first member already used. No new material, no new shader.
 *
 *  `mergeStaticMeshes` folds siblings of the same group only, so a room's
 *  geometry stays inside the room's group — which is what lets the per-room
 *  culling of game/full-cull.js switch a room off at all. It reports what it
 *  did; game/full-apartment.js prints the report in the boot log, so the number
 *  the docs quote is the number the page measured, not the number this file
 *  hoped for.
 * ------------------------------------------------------------------------- */

import * as THREE from 'three';

/** `userData` markers that mean "a check or a script reads THIS mesh on its
 *  own" — see the header. A mesh carrying any of them keeps its own draw. */
export const MERGE_LOCKS = Object.freeze([
  'scale', 'scaleGroup', 'tag', 'patriot', 'fuzz', 'eyes', 'ell',
  'baseScale', 'baseRotX', 'baseRotZ', 'noContact', 'noMerge', 'contact',
]);

/** Why a mesh may not be folded, or null when it may. */
export function mergeLock(m) {
  if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || Array.isArray(m.material)) return 'not a plain mesh';
  if (m.children.length) return 'has children';
  for (const k of MERGE_LOCKS) if (m.userData?.[k] !== undefined) return `userData.${k}`;
  if (m.name) return 'name';
  const mat = m.material;
  if (!mat) return 'no material';
  if (mat.transparent) return 'transparent';
  const g = m.geometry;
  if (!g || !g.attributes.position) return 'no geometry';
  return null;
}

/** Everything that reaches the fragment, as a string: two materials with the
 *  same signature are interchangeable for shading, so their meshes can share a
 *  draw call without one pixel moving. */
export function shadingSig(mat) {
  if (!mat) return 'none';
  const col = (c) => (c && c.isColor ? c.getHexString() : '-');
  // Identity here means "same pixels": two textures over the same source with
  // the same wrapping and the same transform apply the same texels, whether or
  // not the builders handed out the same Texture object. Builders do call
  // SURFACES.plaster() per piece, so keying on the object would fold almost
  // nothing and keying on the source folds the pieces that really do match.
  const tex = (t) => (t
    ? `${t.source?.uuid ?? t.image?.src ?? t.uuid}:${t.wrapS}${t.wrapT}:${t.channel ?? 0}:` +
      `${t.repeat.x}x${t.repeat.y}:${t.offset.x}x${t.offset.y}:${t.rotation}:${t.center}:` +
      `${t.colorSpace}:${t.magFilter}${t.minFilter}${t.generateMipmaps ? 'm' : ''}${t.anisotropy}:${t.flipY ? 'f' : ''}`
    : '-');
  const num = (k, d) => (typeof mat[k] === 'number' ? mat[k] : d);
  return [
    mat.type,
    col(mat.color), col(mat.emissive), col(mat.specular),
    num('roughness', '-'), num('metalness', '-'), num('opacity', 1), num('ior', 1.5),
    num('emissiveIntensity', 1), num('envMapIntensity', 1),
    mat.flatShading ? 'flat' : 'smooth', mat.side, mat.blending, mat.vertexColors ? 'vc' : '-',
    mat.depthTest ? 'dt' : '-', mat.depthWrite ? 'dw' : '-', mat.toneMapped ? 'tm' : '-',
    mat.wireframe ? 'wf' : '-', mat.dithering ? 'di' : '-',
    // The density merged plaster was UV-baked at (game/full-apartment.js
    // `mergedMesh` reads `mat.userData.uvTile`): two materials that share a
    // texture but were baked at different tilings do NOT share a shader result.
    mat.userData?.uvTile ?? '-',
    tex(mat.map), tex(mat.normalMap), tex(mat.aoMap), tex(mat.roughnessMap),
    tex(mat.metalnessMap), tex(mat.emissiveMap), tex(mat.alphaMap),
  ].join('|');
}

/** Whether geometries can be concatenated at all: the same attributes with the
 *  same widths, no morphs, and the same index shape. Indexed stays indexed and
 *  non-indexed stays non-indexed, so a fold costs no extra vertices to shade. */
export function geometrySig(geo) {
  if (!geo) return 'none';
  const names = Object.keys(geo.attributes).sort();
  const item = (n) => `${n}:${geo.attributes[n].itemSize}${geo.attributes[n].normalized ? 'n' : ''}`;
  const morphed = geo.morphAttributes && Object.keys(geo.morphAttributes).length ? 'morph' : 'plain';
  return `${morphed}:${geo.index ? 'idx' : 'flat'}:${names.map(item).join(',')}`;
}

/** Concatenate geometries that already share a signature, in buffer order. */
function concat(geos) {
  const names = Object.keys(geos[0].attributes);
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const itemSize = geos[0].attributes[n].itemSize;
    const normalized = geos[0].attributes[n].normalized;
    const arr = new Float32Array(count * itemSize);
    let o = 0;
    for (const g of geos) {
      const a = g.attributes[n];
      arr.set(a.array.subarray(0, a.count * itemSize), o * itemSize);
      o += a.count;
    }
    const attr = new THREE.BufferAttribute(arr, itemSize, normalized);
    out.setAttribute(n, attr);
  }
  if (geos[0].index) {
    const idx = new Uint32Array(count);
    let vOff = 0;
    let iOff = 0;
    for (const g of geos) {
      const gi = g.index;
      for (let i = 0; i < gi.count; i++) idx[iOff + i] = gi.array[i] + vOff;
      iOff += gi.count;
      vOff += g.attributes.position.count;
    }
    out.setIndex(new THREE.BufferAttribute(idx.subarray(0, iOff), 1));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/**
 * Fold the static siblings of every group under `root`, in place.
 *
 * @param {THREE.Object3D} root the subtree to fold (the flat, or one room)
 * @param {{ minTris?: number }} opts `minTris` ignores buckets with no geometry
 *   worth a buffer copy
 * @returns {{ folded: number, into: number, draws: number, tris: number,
 *   kept: Record<string, number>, groups: object[] }} what happened, in a shape
 *   game/full.js can print and a check can assert on
 */
export function mergeStaticMeshes(root, { minTris = 0 } = {}) {
  root.updateMatrixWorld(true);
  const report = { folded: 0, into: 0, draws: 0, tris: 0, kept: {}, groups: [], parents: 0, visited: 0 };
  const dropped = new Set();

  const walk = (parent, live) => {
    const locked = live || parent.userData?.noMerge;
    const buckets = new Map();
    report.parents += 1;
    for (const m of parent.children) {
      if (m.isMesh && !m.children.length) {
        report.visited += 1;
        const why = locked ? 'live subtree' : mergeLock(m);
        if (why) { report.kept[why] = (report.kept[why] || 0) + 1; continue; }
        const g = m.geometry;
        const tris = Math.floor((g.index ? g.index.count : g.attributes.position.count) / 3);
        if (tris < minTris) { report.kept['below minTris'] = (report.kept['below minTris'] || 0) + 1; continue; }
        const key = `${shadingSig(m.material)}\u0000${geometrySig(g)}\u0000${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}${m.renderOrder}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(m);
        continue;
      }
      if (m.children.length) walk(m, locked || Boolean(m.userData?.noMerge));
    }
    for (const members of buckets.values()) {
      if (members.length < 2) continue;
      const head = members[0];
      const geos = members.map((m) => {
        const g = m.geometry.clone();
        // Bake each sibling's transform relative to `parent`, so the folded mesh
        // covers exactly where its members did and needs no transform of its own.
        const rel = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(m.matrixWorld);
        g.applyMatrix4(rel);
        return g;
      });
      const merged = new THREE.Mesh(concat(geos), head.material);
      merged.castShadow = head.castShadow;
      merged.receiveShadow = head.receiveShadow;
      merged.renderOrder = head.renderOrder;
      merged.frustumCulled = head.frustumCulled;
      merged.matrixAutoUpdate = false; // identity: the vertices carry the pose
      merged.userData.mergedFrom = members.length;
      merged.userData.mergeMat = `#${head.material.color?.getHexString?.() || head.material.type}`;
      parent.add(merged);
      const tris = Math.floor(merged.geometry.attributes.position.count / 3);
      report.groups.push({
        parent: parent.name || '(unnamed)',
        mat: merged.userData.mergeMat,
        from: members.length, to: 1, tris,
      });
      report.folded += members.length;
      report.into += 1;
      report.draws += members.length - 1;
      report.tris += tris;
      for (const m of members) { m.parent.remove(m); dropped.add(m.geometry); }
      for (const g of geos) dropped.add(g);
    }
  };
  walk(root, Boolean(root.userData?.noMerge));

  // A geometry may have been shared by a mesh that stayed: free only the
  // buffers nothing in this subtree draws any more.
  const stillUsed = new Set();
  root.traverse((o) => { if (o.isMesh) stillUsed.add(o.geometry); });
  for (const g of dropped) if (!stillUsed.has(g)) g.dispose();
  return report;
}

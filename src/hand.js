// src/hand.js — the player's pointing hand: the first-person body the game
// plays through. Built from the same parts kit as the cats (ellGeo +
// cylinderBetween) so it lives in the same look: rounded forms, no downloads.
// The sleeve is the UI mustard token — the hand is "the player", the same
// colour family as the HUD. The skin tone is a provisional token
// (TOKENS.skin), flagged for Brandon in docs/HANDOFF.md.
//
// Authored around the wrist at the origin, pointing along -z (the camera's
// forward), so a page can parent the root to its camera and the hand reads as
// "the player's own", pointing wherever the aim is.

import * as THREE from 'three';
import { TOKENS } from './tokens.js';
import { std } from './materials.js';
import { ellGeo, addMesh, cylinderBetween } from './cat.js';

/** Build the pointing hand. Returns { root } — add `root` to a camera. */
export function buildHand() {
  const root = new THREE.Group();
  root.name = 'pointing-hand';
  const skin = std(TOKENS.skin, { roughness: 0.62 });
  const sleeveMat = std(TOKENS.uiMustard, { roughness: 0.9 });

  // rolled-up sleeve over the forearm — slimmer than the wrist reads, so the
  // hand (not the sleeve) is the thing the eye follows
  root.add(cylinderBetween([0, 0.002, 0.17], [0, 0, 0.085], 0.045, sleeveMat, 'sleeve', 2));
  root.add(cylinderBetween([0, 0.001, 0.10], [0, 0, 0.005], 0.036, skin, 'forearm', 2));

  // the palm, slightly flattened, tilted so the back of the hand reads top-lit
  const palm = addMesh(root, ellGeo(0.05, 0.042, 0.06, 28, 20), skin, [0, 0, -0.035], 'palm', {
    rot: [0.1, 0, 0],
  });
  void palm;

  // the pointing index: slightly raised, rounded at the tip, bold enough to
  // read at arm's length (this is where the whole game points)
  root.add(cylinderBetween([0.014, 0.012, -0.078], [0.01, 0.026, -0.19], 0.016, skin, 'index', 3));
  addMesh(root, ellGeo(0.017, 0.017, 0.019, 18, 12), skin, [0.01, 0.026, -0.198], 'index-tip');

  // the three folded fingers: compact bumps along the far side of the palm
  const foldX = [-0.014, -0.033, -0.049];
  for (let i = 0; i < 3; i++) {
    addMesh(
      root,
      ellGeo(0.0155 - i * 0.0015, 0.0135, 0.021, 18, 12),
      skin,
      [foldX[i], -0.018, -0.062 + i * 0.006],
      'folded',
      { rot: [-0.35, 0, 0.12] },
    );
  }

  // the thumb, folded across the middle
  addMesh(root, ellGeo(0.016, 0.0135, 0.034, 18, 12), skin, [-0.046, -0.004, -0.026], 'thumb', {
    rot: [0.15, 0.5, 0.95],
  });

  // a hand between the eye and the cat must not shadow the room
  root.traverse((o) => {
    if (o.isMesh || o.isLine) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return { root };
}

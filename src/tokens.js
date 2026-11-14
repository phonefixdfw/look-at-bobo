// src/tokens.js — the single source for colour (docs/ART_STYLE.md §2).
// Extracted verbatim from the Step 3 reference implementation
// (design/style-test/styletest.js), which now imports this file.

// ---------------------------------------------------------------------------
// 1. Design tokens — the single source for colour (docs/ART_STYLE.md §2).
//    Everything built later imports this object; nothing is hard-coded twice.
// ---------------------------------------------------------------------------
export const TOKENS = {
  // fur
  furBlack: 0x1b1e26, // cool near-black, NOT pure black: keeps readable shading
  furSheen: 0x5a6480, // sunlit coat sheen (used as the material's specular tint)
  furWhite: 0xf1ece1, // warm white markings, never clinical white
  eyes: 0xb7c94b, // yellow-green (from Brandon's photo)
  pupil: 0x0c0e12,
  nose: 0xd18b8b,
  earInner: 0x61494a,
  whisker: 0xf6f2ea,
  // room
  oakFloor: 0xa87c52,
  plaster: 0xd9d3c7,
  rug: 0xa99a83,
  couch: 0x3f4650,
  pillow: 0xd9a441,
  walnut: 0x6b4a30,
  leaf: 0x4f7a4a,
  metal: 0x23262b,
  cardboard: 0xc19a67,
  lampShade: 0xf2e6cf,
  sky: 0xbfd8ea,
  // UI (also in style-test.html CSS custom properties — they must match)
  uiInk: 0x10151c,
  uiPaper: 0xf7f4ee,
  uiMustard: 0xe8b04a,
  uiCoral: 0xff8f7d,
  uiGlow: 0xffd98a,
};

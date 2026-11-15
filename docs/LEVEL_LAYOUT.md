# LEVEL_LAYOUT — the apartment, as data

Metres, right-handed, floor y=0, the same space as `src/room.js`.
**Forward is −z.** Angle convention (camera and cats, identical formula): a
yaw `a` faces `(−sin a, −cos a)`; 0 = facing −z; −π/2 = +x; +π/2 = −x;
π = +z. Every number here is the number `game/level.js` uses, chosen against
the geometry `buildRoom()` actually builds (its couch cushions top out at
0.44, its box interior is x∈[1.46,2.04] × z∈[0.54,0.96] with the floor of the
box at 0.02, its window opening is x∈[−1.15,1.15] y 0.5–2.0 at z=−2.6).

## Rooms in the slice

`buildRoom()` provides the living room + lighting as-is; `game/apartment.js`
adds the east + south walls (with one doorway), the hall, and the bedroom.
Kitchen and bathroom moments are step 7.

```
          z=−2.6 ┌─────────── window x∈[−1.15,1.15] ───────┐
                 │ LIVING  (buildRoom, untouched look)     │
   couch (W wall)│  lamp NW · side table NW · plant NE     │
                 │  rug centre (0.1,0.55) · box (1.75,0.75)│
          z=2.6  └──────┐  door x∈[−1.13,−0.07]  ┌─────────┘
                 HALL   └───────────────────────┘  x∈[−1.34,0.34] z∈[2.66,4.14]
          z=4.2  ┌──────┴────────── door x∈[−1.13,−0.07] ────┐
                 │ BEDROOM  x∈[−3.14,2.0]  z∈[4.26,6.94]    │
                 │ bed (E wall) · nightstand · laundry (W)  │
          z=7.0  └────── window x∈[−1.15,1.15] ──────────────┘
```

- Head/eye height 1.62 m (docs/CHARACTERS.md). Extension walls are 0.12 m
  slabs, flush with `buildRoom`'s (north wall inner face z=−2.54, west x=−3.14).
- **Walk rects** — the player centre (push radius 0.30) may not leave their
  union; doorways are the small rects that connect the rooms:
  | rect | x | z |
  |---|---|---|
  | living | [−3.04, 3.04] | [−2.44, 2.44] |
  | door 1 (living→hall) | [−1.05, −0.15] | [2.36, 2.86] |
  | hall | [−1.24, 0.32] | [2.76, 4.04] |
  | door 2 (hall→bedroom) | [−1.05, −0.15] | [3.96, 4.46] |
  | bedroom | [−3.04, 1.9] | [4.36, 6.84] |
  Doorways are 1.06 m wide (0.23 m clearance either side of the player
  radius); doors stay open all game (docs/LOCATIONS.md).
- **Rect inset vs plaster (issue #27):** rect edges sit **0.08 m off the
  wall's inner face**, not 0.02 m. Walls are not colliders — the rect edge is
  the only thing keeping the camera out of the plaster — and with the 0.05 m
  near plane, a 0.02 m inset let the near plane clip 3 cm of every wall face
  away and you could see the next room through the hole (furniture never did
  this: its collider pad keeps a body 0.30 m out). Doorway rects still cross
  their own wall band — that is the opening — but keep ≥0.08 m off each jamb.
  The selfTest check `wall-camera-clearance` measures every rect↔slab gap off
  the slabs that were actually built (`apt.wallBoxes`, src/reach.js), so these
  numbers can never drift from the plaster again. `walk-reachable` floods a
  body-sized grid (0.30 m radius, collider pads subtracted) from every spawn
  and demands every room, spawn and cat — the point-walk `walk-rects-connected`
  could not see the bathroom trap.

## Extension geometry (apartment.js, merged plaster)

| piece | slab |
|---|---|
| living east wall | x∈[3.14,3.26], z∈[−2.66,2.66], h 2.6 |
| living south wall | z∈[2.54,2.66], x∈[−3.2,−1.13] ∪ [−0.07,3.2], h 2.6 |
| hall west wall | x∈[−1.46,−1.34], z∈[2.66,4.26], h 2.6 |
| hall east wall | x∈[0.34,0.46], z∈[2.66,4.26], h 2.6 |
| hall south / bedroom north wall | z∈[4.14,4.26], x∈[−3.26,−1.13] ∪ [−0.07,2.12], h 2.6 |
| bedroom west wall | x∈[−3.26,−3.14], z∈[2.66,7.06], h 2.6 |
| bedroom east wall | x∈[2.0,2.12], z∈[4.14,7.06], h 2.6 |
| bedroom south wall | z∈[6.94,7.06], x∈[−3.26,−1.15] ∪ [1.15,2.12] + sill x∈[−1.15,1.15] y 0–0.5 + header y 2.0–2.6 (window opening like the north wall) |
| skies | 3.6×2.4 plane at (0, 1.28, 7.2), toneMapping-exempt, same `skyMap` |
| floors | hall plane x∈[−1.46,0.46] z∈[2.54,4.26]; bedroom plane x∈[−3.26,2.12] z∈[4.14,7.06]; same oak material, own uv repeat |
| bedroom window frame | same metal bars as the north wall's |

Lights: `buildRoom`'s hemi + sun (the one shadow light) + floor lamp, plus a
no-shadow warm point each in the bedroom (0.9, 2.35, 5.7) and hall
(−0.5, 2.3, 3.4) → 4 real lights, 1 casting.

## Bobo moment spots (`x, z, y` = support top)

| moment | room | x, z | support / y | pose | faceYaw | why there |
|---|---|---|---|---|---|---|
| `loaf-couch` | living | (−2.55, 0.46) | cushion 0.44 | loaf | −π/2 | loafed on the couch cushion, facing into the room |
| `window-bird` | living | (−0.6, −2.2) | floor 0 | sit | −0.98 | haunches at the window, head sweeping the glass |
| `cardboard-box` | living | (1.75, 0.75) | box floor 0.02 | sit | +π/2 | sits **in** the style-test box; walls hide the lower body; faces the room |
| `tail-chase` | hall | (−0.5, 3.42) | floor 0 | loaf | 0.6 | the only room you can spin in (1.66 m clear) |
| `bed-sprawl` | bedroom | (1.2, 5.9) | duvet 0.5 | sprawl | +π/2 | sprawled on the duvet, head toward the doorway side |

## Decoy spots (fixed 4; seeded pick per round, never Bobo's, ≥ 1.2 m)

| id | room | x, z | faceYaw | canonical for |
|---|---|---|---|---|
| `d-rug` | living | (0.15, 0.55) | +0.9 | window-bird, cardboard-box, tail-chase |
| `d-plant` | living | (2.55, −1.6) | +2.4 | loaf-couch |
| `d-hall` | hall | (−0.5, 3.45) | 0 | bed-sprawl |
| `d-bed` | bedroom | (−1.8, 5.7) | −1.2 | (valid fallback) |

Every spot has ≥ 2 valid candidates ≥ 1.2 m away (the tail-chase spot
excludes only `d-hall` at 0.03 m), so "always findable, never the same spot"
(docs/DECOY_CAT.md) always holds. The decoy is 22 lb scenery (root scale
1.30/1.13/1.12, collar, no dash, no bib) and is always visible somewhere —
finding it is the joke, clicking it costs −1 (floored at 0).

## Props the extension adds (bedroom)

| prop | extent (x, y, z) | note |
|---|---|---|
| bed frame (walnut) | x∈[0.45,1.95] y∈[0,0.26] z∈[4.95,6.65] | E wall; headboard y≤0.7 at z 4.95–5.05 |
| mattress (paper) | x∈[0.5,1.9] y∈[0.26,0.44] z∈[5.0,6.6] | |
| duvet (couch colour) | x∈[0.48,1.92] y∈[0.40,0.50] z∈[5.5,6.62] | **SUPPORTS.bedTop = 0.5** |
| pillow (pillow token) | x∈[0.9,1.5] y∈[0.46,0.56] z∈[5.08,5.48] | head end (north) |
| nightstand (walnut) | x∈[0.03,0.47] y∈[0,0.46] z∈[4.93,5.37] | clear of door 2 channel |
| laundry pile | x∈[−0.2,0.4] y≤0.3 z∈[5.95,6.55] | paper/mustard/coral soft boxes |

## Colliders (walk-blocking AABBs; doorways/windows are openings)

| name | x0, z0 → x1, z1 |
|---|---|
| couch | (−3.16, −1.2) → (−2.15, 1.2) |
| side table | (−2.76, −1.81) → (−2.24, −1.29) |
| floor lamp | (−2.13, −2.18) → (−1.87, −1.92) |
| plant pot | (2.45, −2.22) → (2.79, −1.88) |
| box | (1.44, 0.53) → (2.06, 0.97) |
| bed | (0.45, 4.95) → (1.95, 6.65) |
| nightstand | (0.03, 4.93) → (0.47, 5.37) |
| laundry | (−0.2, 5.95) → (0.4, 6.55) |

The living-room furniture list mirrors `buildRoom`'s built geometry; walls
themselves are the edges of the walk rects. Bobo and the decoy also push the
player out at radii 0.46 / 0.50 (`CAT_PUSH`): you can crowd close and point
in a face, but you can't stand inside a cat.

## Player spawns

| # | room | x, z | yaw | note |
|---|---|---|---|---|
| run start | living | (1.6, 2.0) | +0.6 | looks north-west across the rug toward couch + window |
| cycle 1 | bedroom | (−2.6, 6.4) | −0.79 | corner, faces the bed |
| cycle 2 | hall | (−0.55, 3.5) | 0 | faces the living doorway |
| cycle 3 | bedroom | (−2.2, 4.8) | −1.2 | faces east into the bedroom |
| cycle 4 | living | (−1.5, −1.8) | +2.6 | NW corner, looks south across the room (**moved from −2.0 in Step 7 — the old spot sat inside the sofa**) |
| cycle 5 | living | (2.6, 1.8) | +0.85 | SE, looks north-west across the rug |

After each catch, respawn takes the next cycle entry whose **room ≠ Bobo's
new room and ≠ the previous spawn room** ("respawn elsewhere", issue #11);
the cycle covers all three rooms so that always succeeds. Every moment is
reachable from every spawn — one open doorway chain, checked by
`walk-rects-connected` + `spots-walkable`.

Step 7 added a clearance rule on top (stress-suite bug #3): every pick also avoids landing within `SPAWN_AVOID_DIST` (1.2 m) of the other cat or the previous spot — room rules still outrank distance, and the fallbacks relax distance before room rules — with a `standClearOfCats` push-out through the real collision resolver as a backstop. Both paths are regression-tested by the `respawn-clear-of-cats` and `spawn-clearance` selfTest checks.

## Capture views (exact `LC.setView` inputs)

Aim math to the canonical tableau (Bobo `sit` in the box at (1.75, 0.75),
head mid ≈ y 0.4; decoy `sprawl` on the rug at (0.15, 0.55), mid ≈ y 0.35):
yaw = atan2(−dx, −dz), pitch = atan2(Δy, horiz distance) — so the tableau
frames (and the catch/wrong/win frames that stage it) point at their subject.
`views-distinct` (selfTest) requires all six pairwise ≥ 0.5 m apart (min
measured 0.65 m, `bobo`↔`bobo-face`).

| view | position | yaw | pitch | fov | hand |
|---|---|---|---|---|---|
| `diorama` | (2.85, 1.95, 2.3) | +0.62 | −0.69 | 55 | no — both cats in frame: Bobo in his box, decoy on the rug |
| `first-person` | (0.4, 1.62, 1.2) | −1.25 | −0.71 | 55 | yes — 1.4 m from the box, looking down like play feels |
| `bobo` | (2.95, 0.95, 1.05) | +1.33 | −0.44 | 30 | no — 1.24 m 3/4 on the box cat |
| `bobo-face` | (2.45, 0.62, 0.75) | +π/2 | −0.35 | 22 | no — 0.7 m face close-up |
| `decoy-face` | (−0.45, 0.6, −0.35) | −2.56 | −0.23 | 24 | no — decoy close-up (collar, no dash) |
| `bedroom` | (−0.6, 1.62, 4.35) | −2.28 | −0.35 | 55 | yes — the doorway view of `bed-sprawl` |

---

# The full flat (Step 8 — `game/full-level.js` + `game/full-apartment.js`)

The slice above stays byte-identical (`game/slice.html` still ships it). The
full game builds the same living room, hall and bedroom, then adds the
rooms `docs/LOCATIONS.md` promised: a **kitchenette** along the living
room's north-east arm (counter run x∈[0.6,2.4] z≈2.24, marble laminate,
fridge + kettle), and a **bathroom** off the hall's west side (tub, vanity,
toilet, round mirror, bath mat, tiled walls). The bedroom gains a desk +
keyboard against the west wall, a laundry basket, and a window with
curtains. `game/full.html` boots `bootGame()` from `game/engine.js` against
this file; every number below is what `game/full-level.js` uses.

```
          z=−2.6 ┌───── plant ── TV wall ──── window ───────┐
                 │ LIVING  couch W · rug · box · big plant  │
   bookshelf NW  │            kitchenette NE (counter,      │
                 │            fridge, kettle, sink-sit)     │
          z=2.6  └──────┐  door                    table 2E ┘
                 HALL   └──────────────┐ console ┌──────────
          z=4.2  ┌──────┴── bath W ────┴── door ─┴──────────┐
                 │ BATH (tub·vanity·toilet·mat) │           │
          z=2.6… ├──────────────────────────────┤  BEDROOM  │  z up to 7.0
                 │  (hall continues)            │ desk W ·  │
                 │                              │ bed · rug │
                 └──────────────────────────────┴───────────┘
```

## The ten moments (all generic — Brandon swaps the real ones later)

| id | room | pose | Bobo's spot | support y | decoy for the staged frame | rig write (game/full.js) |
|---|---|---|---|---|---|---|
| `couch-loaf` | living | loaf | (−2.55, cushion, 0.46) | 0.44 | d-plant | loaf breathe + slow blink |
| `window-bird` | living | sit | (−0.6, floor, −2.2) | 0 | d-rug | head tracks an arc (the bird), ear twitches |
| `box-sit` | living | sit | (1.75, boxFloor, 0.75) | 0.02 | d-rug | canonical event tableau (unchanged) |
| `sink-sit` | living | sit | (2.05, counterTop, 2.2) | 0.9 | d-rug | taps head to the faucet, drips |
| `desk-pen` | bedroom | sit | (−2.84, deskTop, 5.55) | 0.76 | d-bed | bats the pen off the desk (pen reset per frame — order-safe) |
| `keyboard-sit` | bedroom | sit | (−2.84, kbTop, 5.87) | 0.79 | d-bed | walks paws on the keys |
| `laundry-nap` | bedroom | loaf | (−0.45, laundryTop, 6.2) | 0.18 | d-hall | deep loaf, fabric-rise breathing |
| `bed-stretch` | bedroom | sit | (1.2, bedTop, 5.21) | 0.5 | d-bed | front-paw stretch + quivering hindquarters |
| `blanket-biscuits` | bedroom | sit | (1.2, blanketTop, 5.61) | 0.58 | d-bed | alternating kneading, purr bounce |
| `hall-chase` | hall | loaf | (−0.5, floor, 3.42) | 0 | d-rug | chatter-teeth, tail lash, haunch wiggle |

Extra supports come from `EXTRA_SUPPORTS`; `cushion`/`rug` are the slice's.
Queue: seeded shuffle, cycle at 10, no repeats inside a round, no same-spot
respawn (`DECOY_MIN_DIST` 1.2, ≥0.30 m spawn clearance) — engine unchanged
from the slice, `winAt: 10`.

## Respawns (8) and decoy spots (5)

Spawns: living (0.98,−1.5)+0.6 · living (−1.5,−1.8)+2.6 · living
(−2.2,1.7)−2.2 · hall (−0.55,3.5)0 · bathroom (−2.3,3.3)+1.9 · bedroom
(−2.6,6.55)−0.79 · bedroom (−1.2,4.7)−1.4 · bedroom (−1.35,6.6)+0.85
(was (−0.2,6.75), which sat on the basket's pad — issue #27).
Decoys: d-rug (0.15,0.55) · d-plant (2.55,−1.6) · d-hall (−0.5,3.45) ·
d-bath (−2.4,3.4) · d-bed (−1.7,6.8) — one per room so the wrong cat can
ambush anywhere.

## Full-flat colliders (16)

| name | x0, z0 → x1, z1 |
|---|---|
| couch | (−3.16, −1.2) → (−2.15, 1.2) |
| side-table | (−2.76, −1.81) → (−2.24, −1.29) |
| floor-lamp | (−2.13, −2.18) → (−1.87, −1.92) |
| plant-pot | (2.45, −2.22) → (2.79, −1.88) |
| box | (1.44, 0.53) → (2.06, 0.97) |
| counter (kitchenette) | (0.6, 1.94) → (2.4, 2.54) |
| bed | (0.45, 4.26) → (1.95, 5.96) | ← flush to the hall-side wall (issue #27)
| nightstand | (0.03, 4.26) → (0.47, 4.7) | ← flush with the bed (issue #27)
| basket (laundry) | (−0.76, 5.97) → (−0.14, 6.43) |
| desk (bedroom) | (−3.14, 5.2) → (−2.54, 6.2) |
| vanity (bath) | (−3.09, 2.66) → (−2.36, 2.98) |
| toilet | (−3.14, 3.61) → (−2.77, 4.12) | ← was at the door; its pad sealed the room (issue #27)
| tv-stand | (1.19, −2.55) → (2.43, −2.09) |
| bookshelf | (−3.14, −2.55) → (−2.84, −1.85) |
| coffee-table | (−1.6, 0.27) → (−0.7, 0.83) |
| kitchen-table | (2.1, 1.25) → (3.15, 2.0) |
| hall-console | (0.06, 3.14) → (0.34, 3.86) |
| big-plant | (−1.87, −2.53) → (−1.44, −2.11) |

**Furniture-round-2 clearance rule (Brandon's TV/props list).** The six new
boxes were placed by a probe (`/tmp/opencode/clear-check.mjs`, re-runnable)
asserting every spawn, capture camera, moment spot and decoy spot stays
**≥ 0.30 m** from a new blocker, with no blocker overlaps and no corridor
pinches. Three hand-ray-checked exemptions, all for the kitchen table: the
`bobo` and `diorama` cameras and the `sink-sit` spot sit within 0.20–0.30 m
of its collider — the table is 0.72 m tall and the two cameras are above it
looking west/east over the top, and the chair back is 0.45 m of walnut with
the sink cat on the counter at hip height, so the frames are clear (proof:
frames 03/01/102 in the capture). The fridge stands **inside** the counter
collider's row (x 0.62–1.08 at z 2.26) rather than adding a 17th box. The
TV moved to the north wall centred x 1.81 because the east wall is where
three capture cameras physically sit.

## New capture views (Step 8)

| view | position | yaw | pitch | fov | hand |
|---|---|---|---|---|---|
| `kitchen` | (0.9, 1.5, 0.9) | −2.417 | −0.137 | 50 | no — aimed at the sink run |
| `bathroom` | (−1.25, 1.62, 3.65) | +1.357 | −0.872 | 55 | yes — doorway view of the mat |
| `desk` | (−1.35, 1.2, 5.55) | +π/2 | −0.266 | 40 | no — pen + Bobo on the desk |

All nine views pairwise ≥ 0.5 m (`views-distinct`, 46-check selfTest).

## Procedural textures (Step 8, code-only — no downloads, no paid calls)

`game/full-apartment.js` builds five canvas textures at boot through the
existing `src/textures.js` helpers (`canvasTexture` + seeded `hash1`, so
they are byte-stable and the determinism suites are unaffected): **walnut
grain** (TV stand, bookshelf, tables, console, shelves), **marble laminate**
(counter + porcelain sink), **bath tile grid** (bathroom walls), **fabric
weave** (sofa cushion refresh, curtains, plant leaves), **TV glass** (the
off screen: near-black with one diagonal sheen). The whole furniture set
merges into **two** meshes (`fur` casts shadows, `furSoft` doesn't) by
sharing material consts — the round took the draw count from the 150 cap
back down to **126** at 98,576 triangles, 5 lights, 1 shadow light, 1 pass.

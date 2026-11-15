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
  | living | [−3.12, 3.12] | [−2.52, 2.52] |
  | door 1 (living→hall) | [−1.11, −0.09] | [2.50, 2.72] |
  | hall | [−1.32, 0.32] | [2.66, 4.14] |
  | door 2 (hall→bedroom) | [−1.11, −0.09] | [4.08, 4.30] |
  | bedroom | [−3.12, 1.98] | [4.28, 6.92] |
  Doorways are 1.06 m wide (0.23 m clearance either side of the player
  radius); doors stay open all game (docs/LOCATIONS.md).

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

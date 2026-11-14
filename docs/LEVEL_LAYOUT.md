# LEVEL_LAYOUT — the apartment, as data

Coordinates are metres, right-handed, floor y=0, same space as
`src/room.js`. **Forward is -z.** Angle convention (camera and cats, same
formula): a yaw `a` faces the direction `(−sin a, −cos a)`; yaw 0 = facing
−z; −π/2 = facing +x; +π/2 = facing −x; π = facing +z. All anchors below are
real numbers used by `game/level.js` (`data/coordinates.yaml` for the full
apartment remains a step-7 doc).

## Rooms in the slice

Three rooms; bathroom and kitchen-sink moments are step 7.

```
            z=-2.6 ┌────────── window (east half) ──────────┐
                   │  LIVING                                │
   sofa ←          │  x ∈ [-3.2, 3.2]   z ∈ [-2.6, 2.6]    │ → kitchenette counter
   (west wall)     │                                        │   (east wall)
                   │   coffee table      TV (north wall)    │
            z=2.6  └───────┐                      ┌─────────┘
                   HALL    │ doorway x∈[-1.15,-0.05] │  x ∈ [-1.4, 0.4]  z ∈ [2.6, 4.2]
            z=4.2  ┌───────┴──────────────────────┴───────────────┐
                   │  BEDROOM  x ∈ [-3.2, 2.0]  z ∈ [4.2, 7.0]   │
                   │  nightstand   bed (east wall)  window (S)   │
            z=7.0  └───────────────────────────────────────────────┘
```

- Head height 1.62 m (docs/CHARACTERS.md). Wall thickness 0.15 m.
- **Walk rects** (interior faces, player centre may not leave their union;
  player push radius 0.30 m):
  | rect | x | z |
  |---|---|---|
  | living | [−3.12, 3.12] | [−2.52, 2.52] |
  | door 1 (living→hall) | [−1.13, −0.07] | [2.50, 2.72] |
  | hall | [−1.32, 0.32] | [2.66, 4.14] |
  | door 2 (hall→bedroom) | [−1.13, −0.07] | [4.08, 4.30] |
  | bedroom | [−3.12, 1.92] | [4.28, 6.92] |
  Doorways are 1.10 m wide (0.60 m of clearance either side of a 0.30 m
  player radius). Doors stay open all game (docs/LOCATIONS.md).

## Prop anchors (living room keeps style-test positions)

| anchor | x, z | rotation | note |
|---|---|---|---|
| `tv` | (0, −2.42) | π | north wall, screen faces +z — style-test position |
| `console` | (0, −2.45) | π | TV stand — style-test position |
| `sofa` | (−2.42, 0.3) | π/2 | west side, faces +x — style-test position |
| `table` | (−0.5, 0.4) | π/2 | coffee table — style-test position |
| `rug` | (−1.2, 0.45) | π/2 | under table/sofa — style-test position |
| `lamp` | (2.9, 2.1) | — | floor lamp, SE corner (base r 0.16 inside x=3.125) |
| `window` | (1.5, −2.6) | 0 | north wall, east of the TV — kit position |
| `counter` | (2.98, −1.1) | 0 | kitchenette on east wall (kit `makeCounter`; body sinks 0.44 into the wall, 0.72 m stays in the room) |
| `box` | (1.7, 1.2) | −0.2 | cardboard box prop (0.58 × 0.36 × 0.52) |
| `bed` | (1.05, 5.6) | 0 | east wall, headboard north (z 4.81–6.76), faces −x |
| `nightstand` | (−0.35, 4.8) | — | beside the headboard |
| `bedroom.window` | (−1.2, 7.0) | 0 | south wall |
| `laundry` | (1.85, 6.35) | 0 | laundry pile prop at the foot/side of the bed |
| `door.living.hall` | (−0.6, 2.6) | — | doorway centre |
| `door.bedroom.hall` | (−0.6, 4.2) | — | doorway centre |

## Bobo moment spots (`moment.spot`, cat root y)

| moment | room | x, z | y | faceYaw | why there |
|---|---|---|---|---|---|
| `loaf-couch` | living | (−2.04, 0.12) | 0.47 | −π/2 | loafed on the sofa cushion (world seat centre), facing into the room |
| `window-bird` | living | (2.1, −2.0) | 0 | +0.79 | haunches by the window corner, chattering at the glass; 0.4 m clear of the counter collider |
| `cardboard-box` | living | (1.7, 1.2) | 0.26 | π | sits **in** the box (box walls hide the lower body), facing south toward the doorway |
| `tail-chase` | hall | (−0.5, 3.4) | 0 | 0 | the only room wide enough to spin in; spin radius fits the 1.64 m clear width |
| `bed-stretch` | bedroom | (1.05, 5.6) | 0.30 | +π/2 | on the duvet stretching, laundry pile beside him |

## Decoy spots (fixed 4; one per round, ≠ Bobo's room, ≥ 1.2 m)

| id | room | x, z | faceYaw |
|---|---|---|---|
| `d-rug` | living | (−0.6, 1.5) | +0.59 |
| `d-counter` | living | (2.15, −0.4) | +π/2 |
| `d-hall` | hall | (−0.5, 3.5) | 0 |
| `d-bed` | bedroom | (−1.4, 5.8) | −π/2 |

Every Bobo spot has ≥ 2 valid decoy candidates in *other* rooms, so the
"always findable, never the same spot" rules (docs/DECOY_CAT.md Q2/Q6) always
hold; `pickDecoySpot(boboSpot, rng)` filters distance + room and takes the
seeded pick.

## Player spawns

| # | room | x, z | yaw | note |
|---|---|---|---|---|
| run start | living | (0.2, 1.9) | −1.1 | looks down the room toward the box corner |
| cycle 1 | bedroom | (−2.2, 5.4) | −π/2 | faces +x into the bedroom |
| cycle 2 | hall | (−0.6, 3.3) | 0 | faces the living doorway |
| cycle 3 | living | (1.8, 2.0) | +0.15 | south of the box spot, 0.5 m clear of its collider |
| cycle 4 | bedroom | (−2.4, 4.9) | −1.9 | bedroom corner, faces the bed |

After each catch, respawn picks the first cycle entry **whose room ≠ Bobo's
new room** (issue #11: "respawn elsewhere"). Every moment is reachable from
every spawn — one open doorway chain, verified by selfTest.

## Capture views (exact `LC.setView` inputs)

| view | position | yaw | pitch | shows |
|---|---|---|---|---|
| `diorama` | (−3.6, 2.05, 8.6) | −0.55 | −0.18 | bedroom → hall → living from the open doorway; moment `cardboard-box`, decoy `d-rug` — both cats in frame |
| `first-person` | (0.2, 1.62, 1.9) | −1.1 | −0.35 | what play feels like: lowered hand + Bobo in his box at 1.6 m |
| `bobo` | (1.7, 1.55, 3.4) | 0 | −0.30 | Bobo in his box, 2.2 m, slightly above |
| `bobo-face` | (1.7, 1.05, 2.25) | 0 | 0.0 | 0.8 m face close-up |
| `decoy-face` | (−1.10, 0.85, 0.75) | −2.55 | −0.12 | decoy face close-up (collar, no dash, bib-free chest) |
| `bedroom` | (−2.6, 1.62, 4.6) | −1.35 | −0.22 | first-person bedroom with `bed-stretch` |

## Colliders (walk-blocking AABBs; doorways and windows are openings)

| name | x0, z0 → x1, z1 |
|---|---|
| sofa | (−2.90, −0.81) → (−1.84, 1.41) |
| coffee table | (−0.80, −0.15) → (−0.20, 0.95) |
| console + TV | (−0.95, −2.62) → (0.95, −2.28) |
| counter | (2.40, −1.58) → (3.12, −0.62) |
| lamp | (2.74, 1.94) → (3.06, 2.26) |
| box | (1.41, 0.94) → (1.99, 1.46) |
| bed | (0.22, 4.81) → (1.88, 6.76) |
| nightstand | (−0.59, 4.56) → (−0.11, 5.04) |
| laundry | (1.55, 6.05) → (2.15, 6.65) |

Bobo and the decoy also push the player out at radius 0.45 / 0.47 m
(`CAT_PUSH`), so you can crowd close but not stand inside a cat — the close
hand-off distance from docs/CHARACTERS.md.

# LEVEL_LAYOUT — the apartment, as data

Metres, right-handed, floor y=0, the same space as `src/room.js`.
**Forward is −z.** Angle convention (camera and cats, identical formula): a
yaw `a` faces `(−sin a, −cos a)`; 0 = facing −z; −π/2 = +x; +π/2 = −x;
π = +z. Cat rigs face local +z, so every cat-root writer converts through
`catRootYaw(a) = a + π` — the authored number below IS the facing (the
selfTest check `cats-face-the-room` measures real rigs and proves it). Every number here is the number `game/level.js` uses, chosen against
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
| `window-bird` | living | (−0.6, −2.2) | floor 0 | sit | 2.36 | haunches at the window, half-turned to the room (was −0.98, 124° off its approach — issue #27) |
| `cardboard-box` | living | (1.75, 0.75) | box floor 0.02 | sit | +π/2 | sits **in** the style-test box; walls hide the lower body; faces the room |
| `tail-chase` | hall | (−0.5, 3.42) | floor 0 | loaf | 0.6 | the only room you can spin in (1.66 m clear) |
| `bed-sprawl` | bedroom | (1.2, 5.9) | duvet 0.5 | sprawl | 0.785 | sprawled on the duvet, NW to the doorway approach (was +π/2 — exactly 90° off, knife-edge; issue #27) |

## Decoy spots (fixed 4; seeded pick per round, never Bobo's, ≥ 1.2 m)

| id | room | x, z | faceYaw | canonical for |
|---|---|---|---|---|
| `d-rug` | living | (0.15, 0.55) | +0.9 | window-bird, cardboard-box, tail-chase |
| `d-plant` | living | (2.55, −1.6) | +2.4 | loaf-couch |
| `d-hall` | hall | (−0.5, 3.45) | 0 | bed-sprawl |
| `d-bed` | bedroom | (−1.8, 5.7) | +π/2 | (valid fallback; was −1.2 — 159° off, stared at the corner; issue #27) |

Every spot has ≥ 2 valid candidates ≥ 1.2 m away (the tail-chase spot
excludes only `d-hall` at 0.03 m), so "always findable, never the same spot"
(docs/DECOY_CAT.md) always holds. The decoy is 22 lb scenery (root scale
1.30/1.13/1.12, white on his feet only — no dash, no bib, no neck white, no
white muzzle) and is always visible somewhere —
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
| `decoy-face` | (−0.45, 0.6, −0.35) | −2.56 | −0.23 | 24 | no — decoy close-up (white feet, no dash, no bib) |
| `bedroom` | (−0.6, 1.62, 4.35) | −2.28 | −0.35 | 55 | yes — the doorway view of `bed-sprawl` |

---

# The full flat (Step 8 — `game/full-level.js` + `game/full-apartment.js`)

The slice above stays byte-identical (`game/slice.html` still ships it). The
full game builds the same living room, hall and bedroom, then adds the
rooms `docs/LOCATIONS.md` promised: a **kitchenette** along the living
room's north-east arm (counter run x∈[0.6,2.4] z≈2.24, marble laminate,
fridge + kettle), and a **bathroom** off the hall's west side (tub, vanity,
toilet, round mirror, bath mat, tiled walls); since issue #81 also a
**dining room** in the flat's east arm (round table, four chairs, a pendant,
a sideboard under a new south window), and the hall at the issue's own 2.40 m; since issue #82 also the cat
furniture — a litter box in the bathroom, food and water bowls on a mat at
the kitchen pass wall, a bigger bin on the east run, and a heat pad on the
couch.
The bedroom gains a desk +
keyboard against the west wall, a laundry basket, and a window with
curtains. `game/full.html` boots `bootGame()` from `game/engine.js` against
this file; every number below is what `game/full-level.js` uses.

```
                 ┌ LIVING ──────────────┐ ┌ KITCHEN ────────┐  ┌ DINING ┐
                 │ sofa W · coffee      │ │ L-counters ·    │  │table Ø │
                 │ table · rug · box    │ │ sink · fridge · │  │1.05 ·4 │
                 │ lamp · plant · TV N  │ │ bar             │  │chairs  │
                 │              ╔═══════╡ │ window over     │  │pendant │
                 │              ║ pass- ║ │ the sink        │  │side-   │
                 └──────┐       ║ 0.90  ║ └───door 0.90(N)──┤  │board · │
                        │       ╚═══════╡                   │  │art · S │
                 ┌ BATHROOM ──────┐  HALL║  door 1.22 (W) ──┤  │window  │
                 │ 1.98 × 2.98    │ 2.40 ║ ┌ ENTRY ─────────┴──┤        │
                 │ tub · vanity   │ ×2.98│ │ 1.40 × 1.68       │        │
                 │ · toilet · mat │      │ │ mat · bench ·     │        │
                 │ · bin · window │ open ║ │ hooks · console   │        │
                 └────────────────┘doorw.║ └ FRONT DOOR(sealed)┴────────┘
                        bedroom→hall door 0.90
                 ┌ BEDROOM ────────────────────────────────┐
                 │ bed W · desk · keyboard · dresser ·     │
                 │ closet · laundry · rug · plant          │
                 └───────── window (sill 0.90) ────────────┘
```

The plan with every measurement on it is `docs/ISSUE_33_REBUILD.md` §2; the
rooms' rectangles are that table plus issue #67's two changes (bathroom south
face z 3.90 → 5.20, hall's east band built out to z 5.20) and issue #81's:
the hall widened to 2.40 m (x −1.20 … 1.20, the bathroom's and entry's old
bands giving 0.30 each), the entry rebuilt x 1.32 … 2.72 with the front-door
case at x 1.32 … 2.34, and the new **dining room** x 2.60 … 5.52 z 0.80 …
4.40 — south of the kitchen, east of the hall/entry, 9.99 m² usable.

## The ten moments (all generic — Brandon swaps the real ones later)

| id | room | pose | Bobo's spot | support y | decoy for the staged frame | rig write (game/full.js) |
|---|---|---|---|---|---|---|
| `couch-loaf` | living | side | (−2.55, cushion, 0.46) | 0.44 | d-plant | side-sleeper: flank breathes in the horizontal plane, dreaming tail flick (was loaf — issue #27) |
| `window-bird` | living | sit | (−0.6, floor, −2.2) | 0 | d-rug | head tracks an arc (the bird), ear twitches |
| `box-sit` | living | sit | (1.75, boxFloor, 0.75) | 0.02 | d-rug | canonical event tableau (unchanged) |
| `sink-sit` | living | sit | (2.05, counterTop, 2.2) | 0.9 | d-rug | taps head to the faucet, drips |
| `desk-pen` | bedroom | sit | (−2.84, deskTop, 5.55) | 0.76 | d-bed | bats the pen off the desk (pen reset per frame — order-safe) |
| `keyboard-sit` | bedroom | sit | (−2.84, kbTop, 5.87) | 0.79 | d-bed | walks paws on the keys |
| `laundry-nap` | bedroom | side | (−0.45, laundryTop, 6.2) | 0.18 | d-hall | deep sleep curled on its side in the laundry, slow horizontal breathing (was loaf — issue #27) |
| `bed-stretch` | bedroom | back | (1.2, bedTop, 5.21) | 0.5 | d-bed | belly-up roll-stretch: spine extends, belly flattens, chin to the ceiling (was sit — issue #27) |
| `blanket-biscuits` | bedroom | sit | (1.2, blanketTop, 5.61) | 0.58 | d-bed | alternating kneading, purr bounce |
| `hall-chase` | hall | loaf | (−0.5, floor, 3.42) | 0 | d-rug | chatter-teeth, tail lash, haunch wiggle |

Extra supports come from `EXTRA_SUPPORTS`; `cushion`/`rug` are the slice's.
(Since issue #33 the rooms, positions and yaws below are slice-era values —
the full flat's live numbers live in `SPOTS`, one `canonical` entry per
moment; see "The spot pool" directly after this section.)
Issue #27 re-authored the yaws the `cats-face-the-room` check failed or found
knife-edge: window-bird 2.36 (was −0.98), desk-pen −0.7 and keyboard-sit −2.36
(both were ±π/2 exactly), blanket-biscuits 2.64 (was π/2), d-bath −1.68 + pose
`side` (was 1.6 — 172° off, staring at the tub wall), d-bed +π/2 (was −1.2).
Decoy spots may carry an optional `pose`; `placeDecoyAt` honours it.
Slice queue (demo): seeded shuffle, cycle at 10, no repeats inside a round,
no same-spot respawn (`DECOY_MIN_DIST` 1.2, ≥0.30 m spawn clearance),
`winAt: 10`. The full flat draws each run from the spot pool instead —
see "The spot pool" below (issue #53).

## The spot pool (`SPOTS`, 37 — wired up by issue #53, dining added by #81, cat furniture by #82)

`full-level.js` exports `SPOTS`: 37 authored places Bobo can actually be,
each with the moment `type` it belongs to, its `room`, `pose`, `spot`
[x, y, z] and `faceYaw`. Every moment's canonical capture spot is one of
them, named by `MOMENTS[i].canonical` (★ below); the rest are alternates
drawn into play by issue #53's run draw. Ids are `<type>.<place>`. A spot
marked ‡ hides its cat behind a prop (issue #70 — see "Partial hiding"
below the table).

| id | room | pose | Bobo's spot | faceYaw |
|---|---|---|---|---|
| `couch-loaf.couch` ★ | living | side | (−2.75, cushion, −0.1) | −0.73 |
| `couch-loaf.sofa-back` | living | loaf | (−3.16, sofaBackTop, 0.35) | −1.6 |
| `couch-loaf.heatpad` § | living | loaf | (−2.73, heatPad, 0.355) | −1.57 |
| `window-bird.n-window` ★ ‡ | living | sit | (−1.35, floor, −2.5) | 1.71 |
| `window-bird.balcony-door` | living | sit | (1.5, floor, −2.45) | 3.04 |
| `box-sit.box` ★ | living | sit | (−2.075, boxFloor, 1.575) | −1.57 |
| `window-bird.balcony-rail` | balcony | sit | (1.35, floor, −3.85) | −2.9 |
| `couch-loaf.balcony-chair` | balcony | loaf | (2.15, chairSeat, −3.6) | 1.77 |
| `sink-sit.sink` ★ | kitchen | sit | (4.15, counterTop, −2.6) | −2.92 |
| `sink-sit.counter-return` ‡ | kitchen | loaf | (2.82, counterTopW, −1.5) | 3.02 |
| `sink-sit.fridge` | kitchen | sit | (5.2, floor, −1.75) | 1.4 |
| `sink-sit.bar` | kitchen | side | (4.55, barTop, 0.4) | −0.14 |
| `sink-sit.table` † | dining | sit | (4.3, diningTop, 2.28) | −1.57 |
| `sink-sit.chair-n` § | dining | sit | (4.06, diningSeatN, 1.73) | 0 |
| `sink-sit.chair-e` § | dining | sit | (4.61, diningSeatE, 2.28) | −1.57 |
| `sink-sit.chair-s` § | dining | sit | (4.06, diningSeatS, 2.83) | 1.57 |
| `sink-sit.chair-w` § | dining | sit | (3.51, diningSeatW, 2.28) | 0 |
| `hall-chase.dining` † | dining | loaf | (4.9, floor, 1.15) | 1.57 |
| `hall-chase.kitchen` | kitchen | loaf | (4.3, floor, −1.3) | 1.58 |
| `hall-chase.hall` ★ | hall | loaf | (−0.35, floor, 3.3) | −0.19 |
| `hall-chase.hall-door` | hall | sit | (0.3, floor, 4.85) | 1.55 |
| `hall-chase.entry` | entry | loaf | (1.77, floor, 3.4) | 1.81 |
| `hall-chase.entry-door` | entry | loaf | (1.82, floor, 3.0) | 1.57 |
| `hall-chase.bath-mat` ‡ | bathroom | side | (−2.2, floor, 4.12) | 1.22 |
| `hall-chase.vanity` | bathroom | sit | (−2.65, vanityTop, 2.46) | 3.14 |
| `laundry-nap.bath-tub` ‡ | bathroom | side | (−2.55, tubWell, 4.85) | −0.44 |
| `desk-pen.desk` ★ | bedroom | sit | (−1.85, deskTop, 5.7) | 2.89 |
| `desk-pen.desk-end` | bedroom | loaf | (−2.3, deskTop, 5.85) | 3.01 |
| `keyboard-sit.keyboard` ★ | bedroom | sit | (−1.85, kbTop, 5.82) | 3.13 |
| `laundry-nap.basket` ★ | bedroom | side | (0.82, laundryTop, 9) | 1.46 |
| `laundry-nap.nightstand` | bedroom | side | (0.95, nightstandTop, 6.6) | 0.28 |
| `laundry-nap.desk-chair` § | bedroom | side | (−1.98, deskChair, 6.29) | 3.14 |
| `bed-stretch.bed` ★ | bedroom | back | (0.2, bedTop, 7.35) | 0.08 |
| `bed-stretch.bed-foot` | bedroom | side | (−0.4, bedTop, 8.25) | 1.43 |
| `blanket-biscuits.blanket` ★ | bedroom | sit | (0.2, blanketTop, 7.15) | 0 |
| `blanket-biscuits.wardrobe` | bedroom | loaf | (−1.55, floor, 8) | 0.03 |
| `blanket-biscuits.dresser-gap` ‡ | bedroom | loaf | (0.95, floor, 6.85) | 2.62 |

† — issue #81's two dining spots. Their yaws are the measured `bestApproach`
ones (the `cats-face-the-room` vantage, not a guess): the table sitter faces
east at the gap off the table's east end, the loofer faces west along the
table's north side at the lane a chase would come from. Both rode the table's
final pin to (4.06, 2.28) — the spot x is the capsule centre, 0.24 east of
the table's.

§ — issue #82's six cat-furniture spots. The pad loaf faces east into the
living room like the couch loaf it shares the sofa with; the desk chair
nap faces north down the bedroom's length, toward the door walk. The
chairs do NOT face the table — a sitter aimed at a round table shows no
face from any aisle — they carry the yaws `cats-face-the-room` measures:
each faces the aisle a standing player will be on (north chair south
down the west aisle, east chair east down its own shoulder of the room,
south chair west across the room, west chair south). chair-s re-measured
3.93 → 1.57 on the check's first run: the intuitive yaw read 135° off its
approach. The desk-chair sits as `laundry-nap`, not `sink-sit`: the run
draw already locks the bedroom to exactly five of the ten moment types
(`run-draw-legal`'s bound) and laundry-nap is one of them — a sixth
bedroom sink-sit spot would break the alternation, a fourth laundry-nap
spot is free. `window-bird.e-window` is gone from this table on purpose:
#81 removed the spot with the kitchen window's plaster and the row was
the last place it still lived.

Room coverage (≥ 2 each — `spot-pool-covers-rooms`): bedroom 11 · living 6 ·
kitchen 5 · dining 6 (chairs by #82) · bathroom 3 · hall 2 · entry 2 · balcony 2. Two data moves got
there (issue #53): `hall-chase.living` (2.6, 0.2) **moved** to
`hall-chase.entry-door` — living had 6 spots, entry only 1, and (2.6, 0.2)
sat on the rug beside the style-test box anyway — and `window-bird.balcony-door`
had its faceYaw corrected −0.1 → 3.04 (the pool sweep found it 96° off its
approach; it's not a canonical capture spot, so no baseline moved).

### Partial hiding (issue #70)

A spot may carry `hide: '<prop>'`: a named prop **partly covers the cat at
that spot** — it blocks the *view*, never the aim ray, never the walk. The
aim exemption is structural, not a special case: `catUnderCrosshair()` in
`game/engine.js` raycasts only the two cat root groups, so no prop mesh can
ever stand between a shout and a cat. Walking is likewise untouched:
hiding added **zero colliders** (`collider-set-stable` still holds) and zero
draw calls (worst full-flat frame still **149 / 150** — issue #82's heat
pad has since taken it back to 150 / 150, within budget).

Six spots hide today — five of Bobo's, one decoy's (★ = hidden):

| id | hides behind | visible ring | nearest vantage |
|---|---|---|---|
| `laundry-nap.bath-tub` ★ | `shower-curtain` | **5 %** | 1.14 m |
| `window-bird.n-window` ★ | `big-plant` | 42 % (was 59 %) | 0.90 m |
| `hall-chase.bath-mat` ★ | `tub` | 29 % | 0.90 m |
| `blanket-biscuits.dresser-gap` ★ | `dresser` | 28 % | 0.90 m |
| `sink-sit.counter-return` ★ | `counter-w` | 26 % | 0.90 m |
| `d-kitchen` (decoy) ★ | `counter-w` | 24 % | 0.90 m |

The centrepiece is new: `laundry-nap.bath-tub` naps **in the tub** for once,
on the well floor (support `tubWell`, same precedent as `vanityTop`) behind
the shower curtain gathered across the north half of the rim — the curtain's
15 folds now bunch within `CURTAIN.clothX1` (−2.15) instead of spreading to
the rod's full 0.94 m, the bellows denser, the rod unchanged. 38 % of the
ring around an unhidden tub cat can see him; behind the gathered cloth only
5 % can, and the gap at the curtain's east end is where he's found. The
other geometry change is `big-plant`'s fronds (0.36 → 0.50 m, same 26
leaves): bedded at the plant's foot, the bird watches the window through
42 % of its ring instead of 59 %. Everything else on the list hides behind
furniture that was always there — the `hide` field *documents* the cover the
piece already gives and lets the build check guarantee it.

What "hides" means is data, not vibes: `HIDE_PROPS` in `full-level.js` gives
each named prop an axis-aligned box at its **true drawn height**
(`SIGHT_HEIGHTS` carries a row for every one of the 38 `COLLIDERS`; the
curtain box comes from the `CURTAIN` constants and is deliberately *not* a
collider — cloth is walk-through). The new `findable` selfTest check then
walks a 24-point ring 2.2 m out (clipped to the flat's walkable rects) and
raycasts each vantage to the cat's aim point through the flat's *own*
sight model at true heights — walls + colliders at real tops (not the
engine's eye-level 1.05 m LOS clip) + the hide box — and fails the build
naming the spot if any hiding cat has **no** vantage that sees it
("partly hidden, never unfindable"). It also fails a `hide` that hides
nothing (≥ 50 % of the ring sees the cat), enforces ≤ 25 % of the pool
hiding (6/37 = 16 % today), and requires ≥ 6 hiding spots overall so the
feature can't silently rot away. Full check count 81 → **82**, and
`playtest:stress:full` passes `--checks 82` to match.

**Run draw** (`pickSpotCycle`, engine's queue slot): every run draws TEN
spots — one per moment type, all ten types exactly once — and the round
order is itself randomised (weighted-random greedy over a dead-end-guarded
frontier — the bedroom locks exactly five of the ten types, the most one
room can hold without neighbours colliding, so plain greedy could paint
itself into a corner; the safety filter keeps it provably deadlock-free). Two catches can therefore never land in the same room
back to back. The draw is seeded per refill (`mulberry32(SEED + refills ×
101)`), so the same seed replays the same run; `run-draw-legal` sweeps 200
seeded draws. `game.spotId` names the live spot; `game.momentId` stays the
moment type (labels, voice, pose anims key off it). Decoys now *prefer* a
different room than Bobo's new spot (legality unchanged: never Bobo's spot,
≥ 1.2 m, facing).

## Respawns (8) and decoy spots (13)

Spawns: living (0.98,−1.5)+0.6 · living (−1.5,−1.8)+2.6 · living
(−2.2,1.7)−2.2 · hall (−0.55,3.5)0 · bathroom (−2.3,3.3)+1.9 · bedroom
(−2.6,6.55)−0.79 · bedroom (−1.2,4.7)−1.4 · bedroom (−1.35,6.6)+0.85
(was (−0.2,6.75), which sat on the basket's pad — issue #27).
Decoys (issue #82: thirteen, every room covered and the balcony holding
three lazy options): d-living (−1.45, 1.8) · d-tv (0.9, −2.0) · d-dining
(3.35, 1.3, `side`) · d-kitchen (3.5, −1.5, hides behind `counter-w`) ·
d-bar (4.05, −0.62, `side`) · d-hall (0.35, 3.0) · d-entry (2.0, 2.5) ·
d-bath (−1.65, 3.2, `side`) · d-bedroom (−0.55, 6.45) · d-balcony (1.4,
−3.35, `side`) — plus the three #82 adds: **d-balcony-chair** (2.18,
chairSeat, −3.58, `sit`, the deck chair's lazy twin), **d-balcony-deck**
(1.1, floor, −3.98, `sprawl`, full length on the boards) and **d-heatpad**
(−2.73, heatPad, 0.355, `side`, curled on the yellow pad). Decoys may
*share* a Bobo spot — `pickDecoySpot`'s legality filter (never Bobo's live
spot, ≥ 1.2 m, facing) is what keeps the pair honest — so the pad and the
deck chair can wrong-cat exactly like the couch does.

## Full-flat colliders (16 in Step 8 — 43 today)

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
| `kitchen` | (3.95, 1.55, 0.25) | 0 | −0.377 | 55 | no — aimed at the sink run |
| `bathroom` | (−1.22, 1.62, 3.02) | +2.2 | −0.3 | 68 | no — from the open doorway, the whole enlarged room |
| `entry` | (1.45, 1.62, 2.6) | +3.379 | −0.17 | 76 | no — the front door and the entry dressing (issue #67) |
| `desk` | (−1.85, 1.45, 7.05) | 0 | −0.437 | 45 | no — pen + Bobo on the desk |

All fourteen views pairwise ≥ 0.5 m (`views-distinct`). `entry` is the new one:
the front door's room had no view of its own, which is part of why nobody
noticed it was empty.

## Issue #67 — a bigger bathroom, and the hall stops ending in nothing

Two things in one issue: the bathroom was too small to play in once the tub
became a real 1.68 m one, and the hall "ends in a dark nothing".

**The bathroom: 3.8 → 6.8 m².** It took the dead service void behind its own
south wall: `ROOMS.bathroom.z1` moved 3.90 → **5.20** and the band there
stopped belonging to two rooms at once — `S-bath-1` is gone from `WALL_DEFS`,
and the plaster you see from inside the bathroom is the bedroom's own north
band (`M-bed-1`, z 5.20 … 5.32), which already spanned x −3.30 → −0.53. Wall
count down one, no new exterior plaster bought: `W-2` ran to z 5.52 and
`E-bath-2` to 5.20 already, which is what made the void sealed in the first
place. Interior **2.28 × 2.98**. Layout (`game/full-bath.js`):

| thing | footprint | why |
|---|---|---|
| tub | x [−3.30, −1.70] · z [4.45, 5.20] | the long way along the new south wall, flush with it and with the west wall: a body can now stand all the way round the tub's north face (`bathGapReport` "bath mat in front of tub" reads **1.73 m** of standable width, ruler ≥ 0.55) |
| vanity | x [−3.30, −2.40] · z [2.22, 2.70] | unchanged — the west wall's run is untouched, and its front is where it always was |
| toilet | x [−2.02, −1.65] · z [2.22, 2.90] | unchanged |
| mat | x [−2.65, −1.75] · z [3.90, 4.45] | the strip you stand on stepping out of the tub, inside the open doorway |
| bin | x [−1.58, −1.34] · z [4.90, 5.14] | the SE corner the enlarged room made |

Tub, curtain, taps, shower head, spout, towel bar, mirror and bin all moved
+1.30 m in z with the room; the vanity and toilet did not move, so the two
bathroom reach-checks (`hall-chase.bath-mat`, `hall-chase.vanity`) still land
where they always landed. `bathGapReport`'s "bath mat in front of tub" row
became `standable 1.73 m` against the ruler's ≥ 0.55. No colliders added or
removed, and the room is still door-less: the issue's rule stands (the player
can never be trapped).

**The hall's dark nothing: a hole in the plaster, and nothing to look at.**
`WALL_DEFS` band-built the hall's east wall (x 0.90 … 1.02) for z 2.22 … 3.90
only — from the entry doorway to the bedroom door the corridor had no east
wall at all, so the camera looked through it into the void outside the flat
and the sun lit nothing back. `E-hall-3` (axis `x`, z 3.90 → 5.20) closes it;
it joins the plaster merge, so **the fix costs no draw calls at all**. The rest
of the complaint was that both rooms were empty: `game/full-entry.js` (data, no
Three.js) and `game/full-entry-mesh.js` (geometry) dress them — bench + hooks,
console, print, bowl, mat, runner, four ceiling bodies. Those draw the two
colliders the flat has had, unrendered, since issue #33: `coat-bench` in the
entry and `hall-console` in the hall. **No new colliders** (`collider-set-stable`
proves the pool never changes); the check caught up with reality rather than
the level changing.

Light, then. Still four point fills and still `realLights = 6`, exactly the
budget: the bathroom keeps a fill (3.9 @ 5.8 m, cooler, under its own new
ceiling body). The hall/entry fill has moved twice since: #67 stepped it to
the entry side of the corridor at 5.4 so it serves both rooms, and #81 hung
it under the entry pendant ([1.85, 2.34, 3.5] @ 5.6) because at the widened
hall the old point grazed the front-door leaf and the `front-door-shut-and-
found` pixel probe read the leaf face as a black hole. That is the whole
lighting change — plus the dining pendant, which is emissive-only, so the
budget holds — and it is why the bathroom now sits at mean luma ~183 where
the played rooms' median is ~141 (tile and porcelain, lit).

Four checks came with it, in `game/full.js`:

| check | what it proves |
|---|---|
| `bath-clear-path` | a 0.60 m body has a flooded route from the flat's root to 0.40 m off every fixture, and ≥ 2 m² of standable floor (measured 2.67 m², against 0.24 m² before the enlargement) |
| `bath-luma-in-band` | the bathroom's mean luma is 0.7 … 1.5 of the median of the played rooms and 90 … 200 absolute, so it is neither the dark room again nor a milky one |
| `entry-reads-lit` | the front door's room renders under 25 % near-black and ≥ 70 mean luma (4 % / 139 since #81; 4 % / 128 at #67 — and a live boot at 800×500 reads even brighter, 2 % / 178) |
| `front-door-shut-and-found` | `door-front` is built shut, its leaf is `LEAF_W` in the cased 1.02 m opening, the entry camera sees it, and no walk rect is reachable past it |

The three pixel checks render once per page and remember it, the way
`doorways-read-open` does: they measure geometry and lights, which cannot
change between `selfTest` calls, and five renders a call starves the live loop
under the stress suite.

Budget: two draws (the bench, because the ruler measures it; the lit shades,
because nothing else at that level glows). Everything else shades exactly like
the flat's trim paint and folds into a bucket the flat already pays for — see
the header of `game/full-entry-mesh.js` for how `game/full-merge.js` decides
what it may fold. Worst full-flat frame after all of this: **149 / 150** draw
calls. Full check count 77 → **81**, and `playtest:stress:full` in
`package.json` passes `--checks 81` to match.

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
(Cap note, issue #87: the capture cap has since become one shared constant,
`DRAW_CALL_CAP = 250` in `tools/capture.mjs`, up from the 150 quoted above —
and the merging/culling habits this section documents stay the preferred way
to pay for geometry: the cap is a ceiling, not a target.)

## Lookalike decor (issue #69) — the one list, in prose

Black-and-white wall art, bedding and bath things that read, for one
frame, as "is that Bobo?" — and resolve as scenery on the second frame.
The data lives in `game/full-decor.js` (`DECOR`, one row per piece, room
order); the mesh is `game/full-decor-mesh.js`; the rules below are what
the five `decor-*` checks in `game/full.js` enforce. Nothing here is a
cat: no piece carries eyes, ears, whiskers, a blaze or a bib, none is
hit-testable, and no new collider exists — the full decoy-vs-lookalike
distinction is docs/CHARACTERS.md.

**Living room** — 4 framed abstracts: `art-living-sofa-n` (portrait,
above the sofa's north end, clear of the colour-block piece),
`art-living-npier` (the pier between window and slider),
`art-living-south` (south plaster west of the hall door),
`art-living-dine` (south plaster east of the hall door and its parked
leaf — the kitchen door's leaf owns the east pier, measured);
`pot-coffee`, the black pot with its white ring-and-dot band, empty, on
the coffee table's clear north half; `books-coffee-1/2`, two B/W books
flat under its elbow, page edges up.

**Kitchen** — `art-kitchen-e`, the one bare stretch of east wall between
fridge and range, under no upper cabinet.

**Hall** — `art-hall-w`, west plaster between the bathroom opening and
the console end.

**Entry** — `art-entry-e` over the coat bench, below the hat shelf's
sight line, clear of the pendant.

**Bathroom** — `art-bath-e` on the east plaster south of the doorway,
hung above the tile band (bottom edge 1.36) and clear of the curtain
rod's findable gap; `towel-bath-hang`, a striped hand towel on the same
bar as the duck-egg one; `towel-bath-stack`, a folded stack on the
vanity's rim band; `mat-bath`, the patchy mat east of the seafoam one
that the #67 enlargement left room for.

**Bedroom** — `art-bed-head` over the headboard, `art-bed-desk` on the
north plaster above the monitor; `duvet-bw`, the cow-patch duvet panel
across the bed's middle (12 mm proud, bedding — not a lying place of its
own); `cushion-bed-n/s`, two patchwork cushions off the pillow ends;
`throw-bed`, the check throw folded into the gap between the pillows;
`books-dresser-1/2` low on the dresser top; `box-wardrobe` under the
wardrobe's 2.10 m lid.

All 10 artworks are 0.4 … 1.0 m on a side, hung with centres around
1.5 m, none over a door or window; every pattern is static (painted once
into the atlas at boot from `hash1` — same seed, same art, byte for
byte), moderate contrast, no moire.

Budget: the whole collection is **one draw call in every frame** — one
atlas material, one merged mesh, spans five rooms so the culler never
hides it. Measured, every one of the 546 capture frames lands at exactly
before+1; worst frame 149 → **150 / 150** (`npm run capture:full`). Full
check count 82 → **87** and `playtest:stress:full` passes `--checks 87`
to match.

## Issue #82 — cat furniture: a litter box, bowls, a bigger bin, a heat pad

Brandon's list, kept literal: litter box, food and water bowls **on a mat**,
a **bigger** kitchen trash can, a yellow heat pad on the couch (plus the
chair spots and balcony decoys — see "The spot pool" and the decoy list
above). Everything is plain static-file procedural geometry at real pet
gear's size; nothing gross anywhere (a plain litter tray, a bin with a
closed lid — the owner was explicit).

**Kitchen trash can (bigger).** Was 0.30 m across; now a cylinder Ø 0.35 ×
0.62 m with a lid rim and a foot pedal, standing flush in the east run's
south corner: x 5.17 … 5.52, z 0.26 … 0.61. The `kitchen-bin` collider grew
2 cm each way in place; its `SIGHT_HEIGHTS` row rose 0.5 → **0.645** with
the lid rim. Old lid and pedal details were *moved* onto the new mouth and
south face, not duplicated.

**Food + water bowls on a mat.** Two porcelain bowls (Ø 0.16, tops 0.082)
side by side on a soft 0.34 × 0.55 m feeding mat, 12 mm proud, against the
pass-wall south of the counter return: x 3.10 … 3.44, z −1.60 … −1.05. One
push box (`pet-bowls`) covers mat and bowls together — the mat itself never
collides. The mat's east face sits at x 3.44 so the d-kitchen decoy's
shoulder room at x 3.5 survives (the envelope started at 3.48 and the raw
mat box ate the gap; that's how it ships). Ruler-wise the *pair* is one
row — `food-bowl` w 0.33 … 0.36 d 0.15 … 0.17 h 0.06 … 0.08 — measured
across both bowls as the piece that actually sits on the floor.

**Litter box.** Open tray 0.46 × 0.32 × 0.15 m, plain sand tile, in the
bathroom's tub-flank pocket: x −1.66 … −1.34, z 4.44 … 4.90, east wall
flush, 4 cm clear of the tub's flank. The first placement — the open floor
between tub and bath bin — failed three checks at once (`bath-clear-path`
dropped to 1.99 < 2 m² of clear bath floor, `findable` pinned the tub cat's
ring, `decor-off-openings` caught the mat-bath overlap), and the pocket
passes everything because it stands on cells already in the tub's shadow.
New `litter-box` collider; `SIGHT_HEIGHTS` 0.15; `SCALE_RANGES` row w
0.46 … 0.54 d 0.30 … 0.34 h 0.13 … 0.18.

**Heat pad on the couch.** Folded fabric 0.55 × 0.40 × 0.03 m in a warm
yellow (0xf2b63f, its own fabric material — the pad is the only cat prop
that buys its own draw call), centred on the sofa's south cushion: top
surface 0.48 = the `heatPad` support, and the new `heat-pad-rests-on-cushion`
check pins pad-bottom to cushion-top 0.45 and support to mesh top within a
millimetre. A three-box cord folds into the living room's dark-detail merge
— no extra draw. `SCALE_RANGES` `heat-pad` w 0.52 … 0.6 d 0.38 … 0.44 h
0.02 … 0.06, top 0.46 … 0.50.

**Where things rest / how they get found.** Pad → new support `heatPad`;
chairs → new supports `diningSeatN/E/S/W` (seat top 0.45); desk-chair nap →
`deskChair` (0.41). `SIGHT_HEIGHTS` rows: `kitchen-bin` 0.645, `pet-bowls`
0.082, `litter-box` 0.15. Bobo's six new spots and their yaws are in the
pool table above; the three new decoys are in the decoy list above.

**Pool after #82.** 37 spots · 8 rooms · thirteen decoys. Over the 500-seed
coverage run every spot is drawn and the rarest is `sink-sit.fridge` at
**8.8 %** (chairs land 9.4 … 12.6 % — nine sink-sit spots share the type's
one draw per run); the pad holds ~25 % like every couch-loaf alternate.
`seed:coverage` passes.

**Draw budget.** The pad's fabric is +1 draw in the living room and the
bowls+mat +1 in the kitchen's detail merge; the kitchen carcass mesh gives
back a slot (untagged pieces now fold nameless into the merge, one more
material bucket absorbed). Worst frame lands **150 / 150** — the budget
of that day; the draw budget is now the one shared `DRAW_CALL_CAP = 250`
(tools/capture.mjs, issue #87), so this table reads as headroom, not
headroom-left-to-cap. Max draw per camera room over all 546 capture frames:

| room | living | dining | kitchen | bedroom | balcony | entry | hall |
|---|---|---|---|---|---|---|---|
| max draws | **150** | 149 | 129 | 125 | 115 | 103 | 96 |

**Checks.** Two new selfTests — `heat-pad-rests-on-cushion` and
`cat-props-clear-the-plan` (no prop rect covers a spawn, a floor moment
spot or a decoy) — full check count 91 → **93**, and `playtest:stress:full`
passes `--checks 93` to match.

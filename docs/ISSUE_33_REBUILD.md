# Issue #33 — real-size apartment rebuild (plan + reference dimensions)

Brandon's playtest: *"the kitchen feels like a kids playset, expand the apartment
to a real apartment size and layout."* This file is the working spec for the
rebuild: the **reference-dimensions table** every piece is built (and checked)
against, the **floor plan** with its dimensions, and the four-chunk plan with a
status log so a later session can re-read this instead of re-deriving it.

`docs/LEVEL_LAYOUT.md` stays the coordinate-level record of what the data files
actually contain; this file is the ruler they are measured with. If the two ever
disagree, the measured geometry + LEVEL_LAYOUT win and this table gets fixed.

**Everything here is generic-real, not Brandon's real flat.** He has not
supplied a floor plan, so this is a typical modern one-bedroom at real
dimensions (the PM defaults in issue #33). Swapping in his real layout later =
editing the rectangles in `game/full-level.js` + the wall defs in
`game/full-apartment.js`; the moments are data, so they move with the rooms.

## 1. Reference dimensions (the ruler)

Metres. This is the table the `furniture-real-scale` selfTest check compares
measured geometry against (tolerance column = what the check allows, so a
deliberately toy-sized prop fails the run).

| # | Piece | Built at | Check allows (measured) |
|---|---|---|---|
| 1 | Ceiling height | 2.50 | 2.40 … 2.70 |
| 2 | Interior wall thickness | 0.12 | 0.10 … 0.16 |
| 3 | Exterior wall thickness | 0.20 | 0.16 … 0.26 |
| 4 | Interior door opening | 0.90 W × 2.05 H | W 0.78 … 1.05, H 1.95 … 2.15 |
| 5 | Door frame (jamb) | 0.06 wide, 0.02 proud of plaster | 0.04 … 0.10 |
| 6 | Baseboard | 0.10 high × 0.018 proud | 0.07 … 0.15 |
| 7 | Window sill height (rooms) | 0.90 | 0.75 … 1.00 |
| 8 | Window head height (rooms) | 2.10 | 1.95 … 2.30 |
| 9 | Kitchen window sill (over counter) | 0.95 | 0.90 … 1.10 |
| 10 | Bathroom window sill (high, frosted) | 1.50 | 1.35 … 1.75 |
| 11 | Counter worktop height | 0.90 | 0.85 … 0.95 |
| 12 | Counter depth | 0.60 | 0.55 … 0.68 |
| 13 | Worktop thickness | 0.04 | 0.025 … 0.06 |
| 14 | Backsplash height | 1.35 (0.45 above the worktop) | 1.20 … 1.50 |
| 15 | Upper cabinet depth / height / bottom | 0.35 / 0.70 / 1.45 | d 0.28 … 0.40, h 0.55 … 0.85, bottom 1.35 … 1.55 |
| 16 | Base cabinet door (each) | 0.58 tall × 0.45 wide | h 0.50 … 0.70 |
| 17 | Sink bowl | 0.50 × 0.42 × 0.20 deep, rim at worktop | w 0.40 … 0.62, d 0.32 … 0.50 |
| 18 | Faucet | 0.28 tall, 0.22 reach | 0.20 … 0.40 |
| 19 | Range/cooktop | 0.60 × 0.60, 4 burners, knobs | 0.55 … 0.68 |
| 20 | Extractor hood | 0.60 wide × 0.50 deep, y 1.55 … 1.85 | 0.50 … 0.75 |
| 21 | Fridge | 0.70 W × 0.70 D × 1.80 H | W 0.60 … 0.85, H 1.65 … 1.95 |
| 22 | Dishwasher (under counter) | 0.60 × 0.61 front | 0.55 … 0.65 |
| 23 | Microwave | 0.52 × 0.38 × 0.30 | 0.45 … 0.60 long, 0.24 … 0.36 high |
| 24 | Kettle | 0.17 dia × 0.24 | 0.14 … 0.22 high |
| 25 | Toaster | 0.26 × 0.18 × 0.19 | 0.15 … 0.24 high |
| 26 | Coffee maker | 0.20 × 0.26 × 0.36 | 0.28 … 0.45 high |
| 27 | Dish rack | 0.40 × 0.30 × 0.15 | 0.10 … 0.22 high |
| 28 | Trash bin | 0.30 dia × 0.42 | 0.28 … 0.50 high |
| 29 | Dining table | 0.75 high top, 4 legs, top 0.04 | 0.71 … 0.80 |
| 30 | Chair seat / back | 0.45 / 0.86 | seat 0.40 … 0.50, back 0.78 … 0.95 |
| 31 | Breakfast bar top | 1.05 with a 0.30 overhang | 0.98 … 1.15 |
| 32 | Bar stool seat | 0.68 | 0.60 … 0.75 |
| 33 | Kitchen rug runner | 0.70 × 2.00 | 0.60 … 0.85 wide |
| 34 | Sofa (overall) | 2.10 L × 0.92 D × 0.85 H | L 1.8 … 2.4, D 0.82 … 1.05, H 0.75 … 0.95 |
| 35 | Sofa seat height | 0.44 (the `cushion` support) | 0.38 … 0.50 |
| 36 | Coffee table | 1.10 × 0.60 × 0.45 high | 0.38 … 0.52 |
| 37 | Side table | 0.45 dia × 0.55 high | 0.48 … 0.62 |
| 38 | Floor lamp | 1.55 tall, shade 0.34 dia | 1.35 … 1.75 |
| 39 | TV panel (55") | 1.22 × 0.71, centre y 1.20 | W 1.0 … 1.35 |
| 40 | TV stand | 1.60 × 0.40 × 0.45 high | 0.38 … 0.55 |
| 41 | Bookshelf | 0.90 × 0.32 × 1.90 high | 1.7 … 2.1 |
| 42 | Bed — queen mattress | 1.53 × 2.03, top y 0.50 (`bedTop`) | 1.45 … 1.65 × 1.95 … 2.10, top 0.45 … 0.60 |
| 43 | Bed frame + headboard | frame top 0.30, headboard to 1.20, flush to the wall | headboard 1.0 … 1.35 |
| 44 | Nightstand | 0.50 × 0.45 × 0.55 high | 0.48 … 0.65 |
| 45 | Dresser | 1.20 × 0.45 × 0.78 high | 0.70 … 0.90 |
| 46 | Wardrobe / closet | 0.60 deep × 2.10 high × 1.15 wide | d 0.5 … 0.65, h 1.95 … 2.20 |
| 47 | Desk | 1.40 × 0.70, top y 0.75 (`deskTop`) | 0.70 … 0.80 |
| 48 | Keyboard | 0.44 × 0.13 × 0.03, top y 0.79 (`kbTop`) | 0.40 … 0.48 long |
| 49 | Desk chair | seat 0.45, back 0.90 | seat 0.40 … 0.50 |
| 50 | Laundry basket | 0.40 × 0.30 × 0.55 high (pile top 0.18 in the basket = `laundryTop`) | 0.30 … 0.50 wide |
| 51 | Blanket (folded at the foot of the bed) | top y 0.58 (`blanketTop`) | 0.52 … 0.68 |
| 52 | Toilet | 0.37 W × 0.68 long, seat 0.40, tank top 0.78 | seat 0.36 … 0.45 |
| 53 | Vanity + sink | 0.90 W × 0.48 D, counter top 0.85 | 0.80 … 0.92 |
| 54 | Bath mirror | 0.70 × 0.90, bottom y 1.10 | 0.55 … 0.95 |
| 55 | Bath towel bar | 0.60 long at y 1.15 | 0.50 … 0.75 |
| 56 | Tub | 1.68 × 0.75, rim 0.55 | 1.5 … 1.8 long, rim 0.5 … 0.62 |
| 57 | Bath mat | 0.55 × 0.90 | 0.45 … 0.70 |
| 58 | Clear walkway (anywhere) | ≥ 0.90 (kitchen ~1.00) | ≥ 0.90 |
| 59 | Balcony | 1.90 × 1.30 decking, railing 1.00 high | railing 0.9 … 1.1 |
| 60 | Cardboard box (the game's hero prop) | 0.60 × 0.44 × 0.42, floor y 0.02 (`boxFloor`) | 0.4 … 0.7 |
| 61 | Player eye height | 1.62 (`MOVE.eye`, unchanged) | — |
| 62 | Player collision radius | 0.30 (`MOVE.playerRadius`, unchanged) | — |

## 2. The floor plan (real scale)

Conventions unchanged: metres, right-handed, floor y = 0, **forward is −z**
(north), x east. Interior faces are what the walk rects hug (0.08 m inset, the
issue #27 rule). Wall bands: exterior 0.20, interior 0.12, ceiling y 2.50.

Net interior area **65.7 m²** (living 28.5, kitchen 10.5, hall 5.4, entry 2.3,
bathroom 3.8, bedroom 15.2) ≈ **707 sq ft**, plus a **2.5 m² balcony**
(outdoor) — inside the issue's 65–80 m² / 700–850 sq ft target. Gross is
*measured* off the built wall boxes by the scale selfTest and recorded in
`docs/LEVEL_LAYOUT.md`; this table is the ruler, never the measurement.

**One deliberate deviation from the issue's sketch:** the living room is
5.70 × 5.00 (28.5 m²), not the ≈4.5 × 5 first pencilled. At 4.50 wide the
living room's west face (x = −2.70) and the bathroom's (x = −3.30) were two
different lines, which left a 0.60 m dead notch behind the sofa — a corner no
piece of furniture fits and no player can explain, i.e. exactly the playset
tell this issue is about. Running the living room and the bathroom off one west
wall line (x = −3.30) straightens the sofa wall, and the flat still lands
inside the target area.

```
 z=−4.60 ┌───────────────────╤──────────────────╤────────────────────────┐
         │ party wall        │    BALCONY       │   void: sky, the city  │
 z=−4.40 ╞═══════════════════╪══════════════════╪════════════════════════╡ railing
         │                   │  1.90 × 1.30     │            railing 1.00│
 z=−3.10 ╞═══════════════════╧═════════╗ ╔══════╧════════════════════════╡
         │   LIVING + DINING           ║ ║  glass door (clear 1.30)       │
         │                             ╚═╝                                │
         │  sofa W · coffee table · rug      ╔══════════╗   KITCHEN       │
         │  box · floor lamp · plant         ║pass-thru ║   3.00 × 3.50   │
  x=−3.30│  TV + bookshelf N/E · table  ═N   ║ (0.90)   ║   window over   │
         │  dining table SE            window║          ║   the sink ·    │
         │                                   ║          ║   L-counters ·  │
         │                                   ╩          ║   uppers · sink │
  x=2.40 ├── door (0.90) ═══════════════════════════════╩═══╡ x=2.52       │
 z=2.10  │        │      ╔════╤════════════════════════════╗║              │
         └────────┼──────╢    │  HALL 1.80 × 2.98          ║║              │
                  │      ║    │  console · hooks · mats    ║║              │
         ┌────────┴──────╨────╢         ╔════╤═════════════╬╝              │
         │  BATHROOM 2.28×1.68║ open    ║    ║ ENTRY       ║               │
         │  door-less (open)  ║  0.90   ║    ║ 1.38 × 1.68 ║               │
         │  window sill 1.50  ╚═════════╛    ║ coat closet ║               │
         └───────────────────────────────────╫ front door ║               │
  z=3.90                                     ║ (E, closed)║               │
  z=4.02                                     ╚════════════╛               │
  z=5.20 ┌──────────────────────────────────────────────────┐             │
         │  BEDROOM 3.80 × 4.00                             │             │
         │  bed (headboard flush W) · nightstand · dresser  │             │
         │  closet E · desk N (the keyboard moment) ·       │             │
         │  laundry basket · rug · plant                    │             │
  z=9.32 └────── window (sill 0.90) ────────────────────────┘             │
  z=9.52 └────────────────────────────────────────────────────────────────┘
```

Room rectangles (interior faces, x0 z0 → x1 z1):

| room | x | z | area | notes |
|---|---|---|---|---|
| living | [−3.30, 2.40] | [−2.90, 2.10] | 28.5 m² | N window + the balcony glass door, E window, S doorway to the hall |
| kitchen | [2.52, 5.52] | [−2.90, 0.60] | 10.5 m² | N window over the sink; doorway + pass-through to the living room |
| hall | [−0.90, 0.90] | [2.22, 5.20] | 5.4 m² | the spine: living, bathroom, entry, bedroom |
| entry (vestibule) | [1.02, 2.40] | [2.22, 3.90] | 2.3 m² | front door (E, closed) + coat closet (N) |
| bathroom | [−3.30, −1.02] | [2.22, 3.90] | 3.8 m² | door-less on purpose (issue #31 rule): the player can never be trapped |
| bedroom | [−2.60, 1.20] | [5.32, 9.32] | 15.2 m² | S window, closet, desk |
| balcony | [0.55, 2.45] | [−4.40, −3.10] | 2.5 m² | outdoor decking, railing 1.00 m, glass door off the living room |

**The 0.08 m rule, spelled out once.** Every walk rect sits 0.08 m off the
plaster (`wall-camera-clearance` needs ≥ near-plane 0.05 + 0.02). So every
opening is built 0.16 m wider than the rect that bridges it: the structural gap
is (clear width + 0.16), the bridging rect is inset 0.08 from each jamb, and
the door casing fills exactly that 0.08. The "clear width" column is what the
*player* fits through, which is the number that matters.

Openings (2.05 tall unless noted; every walkable one stays open all game):

| id | wall | plaster gap | bridging walk rect | clear width |
|---|---|---|---|---|
| `door-living-hall` | living S wall (z 2.10–2.22) | x ∈ [−0.53, 0.53] | x ∈ [−0.45, 0.45], z ∈ [2.00, 2.32] | 0.90 |
| `door-living-kitchen` | kitchen W wall (x 2.40–2.52) | z ∈ [−0.68, 0.38] | z ∈ [−0.60, 0.30], x ∈ [2.30, 2.62] | 0.90 |
| `pass-kitchen` | same wall, over the counter | z ∈ [−1.90, −1.00], y 0.95–1.55 | (not walkable) | 0.90 |
| `door-hall-bedroom` | bedroom N wall (z 5.20–5.32) | x ∈ [−0.53, 0.53] | x ∈ [−0.45, 0.45], z ∈ [5.10, 5.42] | 0.90 |
| `open-hall-bath` | hall W wall (x −1.02–−0.90) | z ∈ [2.42, 3.48] | z ∈ [2.50, 3.40], x ∈ [−1.12, −0.80] | 0.90 (cased, no leaf) |
| `open-hall-entry` | hall E wall (x 0.90–1.02) | z ∈ [2.52, 3.58] | z ∈ [2.60, 3.50], x ∈ [0.80, 1.12] | 0.90 (cased, no leaf) |
| `door-front` | entry E wall (x 2.40–2.60) | z ∈ [2.72, 3.80] | (closed leaf — never walkable) | 0.92 as built |
| `door-balcony` | living N wall (z −3.10–−2.90) | x ∈ [0.77, 2.23] | x ∈ [0.85, 2.15], z ∈ [−3.04, −2.80] | 1.30 (1.46 glass sliding door) |

Windows (sill 0.90 / head 2.10 unless noted): living N x∈[−2.10,−0.30];
living E z∈[1.00,1.95]; kitchen N x∈[3.40,4.90] sill 0.95 head 1.75;
bedroom S x∈[−1.90,−0.20]; bathroom W z∈[2.60,3.30] sill 1.50 head 2.05.
No window is a route and none is a fall risk: the room rects stop short of
them, so the player only ever sees the sky through glass it is meant to look
out of.

**Door leaves are parked, never across** (issue #65). The three `door`
openings above are permanently open — there is no door control and there
never will be — and their walnut leaves now stand at 90° flat along the
plaster BESIDE the opening (2 cm off the trim, 5 cm off the wall, knob on
the free edge), each on the side with a clear run of wall: living-hall west
(open floor), living-kitchen north (clear to the window), hall-bedroom east
and bedroom-side (the hall has only 37 cm stubs there, and the bedroom's
north face runs clear east to the corner). `doors-read-open` proves no leaf
touches a walk rect; `doorways-read-open` proves the hole shows the room
beyond from each standing-height `door-*` VIEWS camera. The old builder ran
the leaf from the opening's own lo edge, which is why every doorway
photographed as shut.

**With a ceiling the sun only comes in through the openings.** The rig keeps
the same warm sun at the same angle, moved back along its own axis so the whole
flat sits inside its shadow frustum (pos ≈ (−4.0, 8.6, −15.0), target
≈ (1.2, 0.3, 3.0)); interior brightness comes from the hemisphere plus at most
four no-shadow fills, and `sun-through-window` still proves the sun is outside
and above the far wall.

**Why this layout answers the playtest:** the kitchen is a room, not a strip of
counter in the living room — 3.0 × 3.5 with an L of 0.60 × 0.90 counters, base
and upper cabinets, sink under a window, range + hood, fridge, dishwasher,
small appliances and a breakfast bar, and a 1.0 m walkway; there is a ceiling
over everything (the dollhouse ceiling was the biggest "playset" tell), real
0.90 × 2.05 doorways with frames, 0.90 sills, baseboards, and rooms of the
sizes a person recognises.

## 2b. The spot pool, the lookalikes and the hiding (Brandon's two follow-ups)

Both arrived as comments on the issue (2026-11-15, quoted and summarised in
[LOCATIONS.md](LOCATIONS.md) and [CHARACTERS.md](CHARACTERS.md)) and both are in
scope here, not "later".

**The balcony is the flat's one owner-supplied feature.** Brandon: the flat has
a balcony off the living room, with a sliding glass door. Recorded as an owner
fact in [CHARACTERS.md](CHARACTERS.md); everything else about the flat stays
generic-real. It is built so it can never be a trap or a fall: the door is open
and walkable, the railing is solid geometry, the walk rect stops 0.35 m short
of it, and the camera cannot leave the flat.

**A pool, not a list.** The ten moment *types* stay exactly ten (the capture
matrix, `ALL_STAGE_IDS` and the `moments-count` check are unchanged), but each
type now owns several *spots* — `SPOTS` in `game/full-level.js`, 25–40 records,
spread over every room including the balcony. A run draws ten of them:

- random order, no repeats inside a cycle (same rule the moment queue had);
- **never two catches in a row in the same room** — "go look in the bedroom" is
  always a real change of scene;
- the decoy draws from its own bigger lazy-spot pool, still never Bobo's spot
  and still ≥ 1.2 m away;
- a spot is a record `{ id, type, room, pose, spot, faceYaw, hide }`, so Bobo
  moves when Brandon moves the rooms: nothing about a spot lives in code.
  The animation is keyed by the moment **type**, so "biscuits on the balcony"
  and "biscuits on the blanket" share one rig write.

The existing checks are generated over the **whole pool** instead of a
hand-picked ten: `spots-walkable`, `walk-reachable`, `cats-face-the-room`,
`lying-poses`, `decoy-never-shares-spot`, `respawn-clear-of-cats` and the new
`spot-pool-covers-rooms`. Per-room culling keeps the frame budget honest while
the pool is that big (chunk 4).

**Black-and-white lookalike decor.** Generic tuxedo-pattern scenery built in
code — framed abstract art, tuxedo/spotted bedding and cushions, a rug, bath
towels, a black plant pot with white accents. Scenery only: no penalty, no
voice line, nothing that pretends to be a cat. Up close it is plainly not an
animal, and no prop ever carries a marking either cat has (the marking checks
keep their limits, so a cushion with a dash-shaped patch could never ship). The
items are data, listed next to the spots.

**Partial hiding, with a floor under it.** A spot may name the prop it hides
behind (`hide: '<collider id>'`): a plant leaf, the shower curtain, a curtain
edge, a table leg, a basket rim, an open closet door, a sofa arm. Never fully
hidden, never inside a wall, never unreachable. The new **`findable`** check
proves it per spot: from at least one reachable standing place, the pointing
ray must reach him (so the hiding prop cannot block it — that would be a bug,
not a joke) *and* either his face/dash or ≥ 25 % of his body must be visible,
measured by sampling the body against the same boxes the sight-line checks use.

## 3. Gameplay rules that must keep holding (unchanged contracts)

- 10 moments, 10 points, random order, no repeats in a round; decoy ≥ 1.2 m and
  never Bobo's spot; one decoy spot per findable room; exact `your did it! you
  wind` and `DAG!`; no timers, no game over.
- Every spawn reaches every room, every other spawn and a stand-and-see cell
  for every cat (`walk-reachable`, 0.30 m body grid); no see-through walls
  (`wall-camera-clearance`, rects 0.08 m off plaster); cats face an approach
  (`cats-face-the-room`); lying cats stay pointable (`lying-poses`).
- **Longer walks, same 10–15 minutes:** the respawn rule gains "prefer a room
  adjacent to Bobo's" so a catch does not teleport the player across the flat,
  and the hint after 3 points stays. No new mechanics, no timers.
- Determinism contract (PR #24), touch/mobile code (PRs #26/#30) and the build
  stamp (PR #29) stay untouched. `?gate=off`, the plants, the bots' public API
  surface and the `window.LC` contract are unchanged.
- The **slice** (`game/slice.html`, `game/level.js`, `game/apartment.js`,
  `src/room.js`) is not rebuilt: it keeps shipping the Step-6 living-room
  apartment byte-identically, which is what the style-test baselines prove.
  Only the full game (`game/full.html`) gets the real-size flat.

## 4. Chunks (one PR each)

| # | PR | Scope | Suites at the end |
|---|---|---|---|
| 1 | "Part of #33" | shell at real scale: rooms, walls (0.12/0.20) with real thickness, doorways + casings, ceiling, windows + sills, floors, baseboards, skies, the balcony shell; the reference table (this file) + the `furniture-real-scale` selfTest check; the **spot-pool data model** (`SPOTS`, drawn ten a run, never two catches in one room) + the decoy pool; moments/spawns/views relocated into the new rooms; connectivity/wall/facing checks generated over the whole pool; the new `spot-pool-covers-rooms` and `findable` checks | full chain |
| 2 | "Part of #33" | the kitchen built properly (L-counters 0.60×0.90, base/upper cabinets + handles, sink + faucet, range + hood, fridge, dishwasher, kettle/toaster/coffee maker, dish rack, bin, runner rug, pendants, breakfast bar + stools) + the kitchen spots | full chain |
| 3 | "Part of #33" | living room, bedroom, bathroom furniture at real scale + balcony furniture (sofa, coffee/side tables, TV + stand, bookshelf, dining table + chairs, plants, rug, lamp; queen bed + 2 nightstands + dresser + closet + desk/chair; tub, vanity, mirror, toilet, towel bar, mat; railing furniture, bird); the **lookalike decor set** and the **partial-hiding spots** (`hide:` + the props they hide behind) | full chain |
| 4 | "Closes #33" | textures, lighting and clutter pass; per-room culling / merged + instanced geometry; per-room light budget; phone `?quality=low` check; draw/triangle report per room | full chain |

Status log (append one line per step; re-read this if context is lost):

- 2026-11-15 — plan + ruler written; branching from `origin/main` @ `2e35bb2`
  (PR #32 merged). Chunk 1 started.
- 2026-11-15 — Brandon's two follow-ups logged (issue comments
  [#33 comment 1](https://github.com/phonefixdfw/look-at-bobo/issues/33#issuecomment-6900173927)
  balcony + bigger spot pool,
  [#33 comment 2](https://github.com/phonefixdfw/look-at-bobo/issues/33#issuecomment-6900174136)
  lookalike decor + partial hiding) and folded into §2b and the chunk table.
- 2026-11-15 — area arithmetic corrected (the first draft's "70.0 m²" was the
  old 4.50-wide living room mis-added: 24.5 + 10.5 + 5.4 + 2.1 + 3.8 + 15.2 =
  61.5, not 70.0). The living room is 5.70 × 5.00 now, sharing one west wall
  line with the bathroom: net interior **65.7 m²** + a 2.5 m² balcony. The
  balcony moved to z ∈ [−4.40, −3.10] so the living room's north wall keeps its
  0.20 m thickness at the glass door.
- 2026-11-15 — chunk 1: `game/full-apartment.js` became a self-contained
  real-scale shell builder (its own sun + rig, no `buildRoom`). The slice
  (`game/slice.html`, `game/level.js`, `game/apartment.js`, `src/room.js`) keeps
  shipping the Step-6 room byte-identically, which is what the style-test
  baselines prove, so the full flat can no longer share its builder.

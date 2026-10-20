# Route curve

Phase 6 notes. **The numbers live in `src/data/run.ts`** (`LEVEL_BANDS.trainerXp` and
the per-floor `TRAINER_XP_PER_MAP`) and in `src/data/maps.ts` (the per-map level
ranges); this sheet records where they come from, not the values themselves.

A floor is one **map** (`docs/maps-spec.md`): a grid of routes of one biome with its
own level range, closed into a loop, whose farthest room fields the boss. A finite
run walks eight of them. The rule below is what makes a squad keep pace with the band
by fighting **trainers** instead of grinding the tall grass: beating 75 % of a
floor's trainers is enough to reach that floor's level cap. Two numbers pay that
budget: the defeated Pokémon's **band rate** (`LEVEL_BANDS.trainerXp`) and the
**floor's own factor** (`TRAINER_XP_PER_MAP`), so a band shared by several floors no
longer forces one rate on all of them.

**Re-measured (Task-83).** Every measured number on this sheet was re-walked against
the shipped tree: the band table, the per-floor factors and the caps are read from
`src/data/run.ts` and `src/data/maps.ts`, and `T̄(m)`, `A(m)` and the fill column are
the per-map figures `src/engine/run/curve.test.ts` computes over its three fixed
seeds (`curve-a`, `curve-b`, `curve-c`). The `trainerXp` column was **corrected** to
the values `LEVEL_BANDS` ships today (the sheet had drifted from them), and the
eight fills below are the walk's own.

**Re-walked again (Task-92).** The shop room is retired, so no floor hangs that leaf
any more: every floor from map 2 on tags a different set of trainer rooms and
places a trainer more or less. The eight per-floor factors were re-solved with the
recipe below (`factor = 1.25 / fill`), and the columns below are the new walk's
own: every floor lands within a hundredth of **1.25**, the middle of the window.

**Re-walked again (Task-96).** The static-species leaf hangs on some floors from map
3 on, so a floor can hold one room more, and `routeIndexForRoom` sums the previous
floors' room counts: every later floor's rooms build from a shifted route index and
place a trainer more or less. `src/engine/run/curve.test.ts`'s `MEASURED_FILL`
records that walk as it now stands — **1.25, 1.25, 1.25, 1.33, 1.35, 1.13, 1.18 and
1.25** on maps 1-8 — and every one still sits inside the rule's `1.05 – 1.5` window.
The eight factors are **not** re-solved (that is a balance task, not a room task), so
the per-map table's `fill` column is unchanged: it is
`0.75 × T̄(m) × A(m) / needed(m)`, which reads the pinned trainer counts and the cap,
never a route index. The Task-92 paragraph's "within a hundredth of **1.25**" claim
describes the walk **before** this task; maps 4, 5, 6 and 7 now read off that target
on their shipped factors.

## Level bands

Every floor reads one band (`bandForLevel(minLevel)` in `src/data/run.ts`): a level
window, the typical trainer party size, the trainer XP multiplier the battle awards,
and the BST window the archetype pools draw from. The windows meet at their
boundaries and the higher band owns the shared level, so the six bands span 2..55
with no gap.

| Band  | Levels | Trainer party | `trainerXp` | BST window |
| ----- | -----: | ------------: | ----------: | ---------- |
| Early |    2–9 |             1 |        6.07 | 0–305      |
| Low   |   9–16 |             1 |       16.18 | 306–355    |
| Mid   |  16–23 |             2 |        8.59 | 356–440    |
| High  |  23–30 |             2 |       12.70 | 441–490    |
| Late  |  30–37 |             3 |       10.86 | 491–520    |
| End   |  37–55 |             4 |        7.96 | 521–800    |

`trainerXp` is the **band's** rate, not a difficulty ramp, and is not monotonic: a
floor's trainer party already carries its own levels and party size, so the rate is
only what the band contributes to reaching a floor's cap — the per-floor factor
below is the remaining lever. `Low` is the peak — map 2's cap leaps 9 → 16 while its
trainers still field one Pokémon each and the floor places four of them, so each
defeat carries 1402 XP of the 3367 the floor needs. `Early` is the lowest — map 1
asks for only 604 XP and places three trainers over levels 2–9, so each defeat
carries 335. `End` is modest (7.96)
although its floors field four members each: the per-floor factors trim maps 6-7 and
lift map 8 instead, which is what keeps a shared band's three floors inside the
window. `High` sits over `Mid` for a related reason: map 4's step (23 → 30) is the
same seven levels as map 3's, but it is taken higher up the curve, where a defeat is
worth more (`A(4)` 4944 against `A(3)` 2689) while the floor places the same five
trainers.

The **BST windows** were re-checked against the shipped dex in the Task-09 pass and
**did not move**: they tile `0..800` with no gap and no overlap (the tiling
`src/engine/run/pool.test.ts` asserts), no band straddles an `EVOLUTION_BST_LEVELS`
mirror (0–355 / 356–440 / 441–800, the table under _Evolution levels_), and the
six bands hold 208 / 171 / 202 / 223 / 158 / 290 spawnable species for a trainer
and 206 / 171 / 200 / 220 / 157 / 137 for the wild, which drops the legendary and
mythical tags. The `trainerSize` column is `LEVEL_BANDS`' own and did not move
either: it is solved into `A(m)`, and every floor's fill below sits inside the
window.

## Level caps per map

The **cap** is the map's only level anchor and the map's own `cap` in
`src/data/maps.ts` (`levelCapForMap`); a fresh run's starter begins at level 5
(`START_LEVEL`, `src/scenes/StarterScene.ts`). The floor's level window is not
stored: it opens at the previous floor's cap and closes at this one
(`levelWindowForMap`, `src/engine/run/floors.ts`), which is what the `Window` column
below reads. `needed(m)` is the XP the squad still needs on floor `m` if it capped
out on floor `m - 1`: the `level³` curve at the new cap minus the curve at the old
one.

| Map | Window | Cap | `needed(m)` |
| --: | ------ | --: | ----------: |
|   1 | 2–9    |   9 |         604 |
|   2 | 9–16   |  16 |        3367 |
|   3 | 16–23  |  23 |        8071 |
|   4 | 23–30  |  30 |       14833 |
|   5 | 30–37  |  37 |       23653 |
|   6 | 37–43  |  43 |       28854 |
|   7 | 43–49  |  49 |       38142 |
|   8 | 49–55  |  55 |       48726 |

The whole run to 55 is `55³ = 166 375` XP, in steps of 7 levels then 6. A **constant**
ten-level step to the engine ceiling would not fit that curve: its top step alone,
`xpForLevel(100) − xpForLevel(90)`, wants 271 000 XP — more than the entire campaign
above — which is why the step narrows as the levels climb, per the plan this task
implements.

## The per-floor trainer budget

The three seeds are `curve-a`, `curve-b` and `curve-c` (fixed in
`src/engine/run/curve.test.ts`), so the counts below are reproducible. `T̄(m)` is the
trainers a floor places (**summed over its rooms**, quiet leaves counting zero; the
hand-placed boss and mini-boss are injected on top by the scene and are not part of
the budget), averaged over the three seeds. `A(m)` is what one of those trainers
awards on average: `trainerSize` roster members drawn uniformly across the map's
level range, each worth
`experienceAward(level, 1, true, trainerXpMultiplierForMap(m))` — **the floor's own
factor is part of every award in the column**, which is why `A(m)` follows the
`Factor` column and not the band alone.

Room size is **shape-derived**, not rolled (`docs/maps-spec.md` §1/§4):
`ROOM_SHAPE_SIZES` pins each shape's aspect on map 8 and `roomSizeForShape` scales
it by the map's own `size.max / 56`, so a `corridor` reaches 52x30 on map 8 while the
quiet leaves stay 30x30. A floor also holds a **fixed** number of trainer rooms
(`TRAINER_ROOMS_PER_MAP`, `src/data/population.ts`): two on maps 1-2, three on maps
3-5 and four on maps 6-8, each holding one or two trainers. That table — not the
room size — is what bounds the trainer counts below, so a seed moves them by a
trainer or two and never by a room full.

| Map | Band  | Trainers per seed (rooms) | `T̄(m)` |   `A(m)` | `0.75 × T̄(m) × A(m)` | Window          | Factor | Fill |
| --: | ----- | ------------------------- | -----: | -------: | -------------------: | --------------- | -----: | ---: |
|   1 | Early | 4 (7), 2 (6), 3 (7)       |   3.00 |   335.38 |               754.59 | 604 – 906       |   1.00 | 1.25 |
|   2 | Low   | 3 (7), 4 (6), 4 (7)       |   3.67 |  1528.75 |              4204.06 | 3367 – 5050.5   |   1.09 | 1.25 |
|   3 | Mid   | 5 (7), 4 (7), 5 (6)       |   4.67 |  2876.75 |             10068.63 | 8071 – 12106.5  |   1.07 | 1.25 |
|   4 | High  | 5 (8), 5 (9), 5 (9)       |   5.00 |  4944.00 |             18540.00 | 14833 – 22249.5 |   1.00 | 1.25 |
|   5 | Late  | 5 (7), 4 (8), 3 (7)       |   4.00 |  9853.50 |             29560.50 | 23653 – 35479.5 |   1.25 | 1.25 |
|   6 | End   | 5 (7), 7 (8), 7 (8)       |   6.33 |  7639.43 |             36287.29 | 28854 – 43281   |   0.80 | 1.26 |
|   7 | End   | 6 (7), 7 (10), 6 (11)     |   6.33 |  9994.86 |             47475.57 | 38142 – 57213   |   0.91 | 1.24 |
|   8 | End   | 4 (10), 7 (8), 7 (9)      |   6.00 | 13532.57 |             60896.57 | 48726 – 73089   |   1.09 | 1.25 |

"Fill" is `0.75 × T̄(m) × A(m) / needed(m)`; the rule wants it inside `1.05 – 1.5`,
and every floor lands at about **1.25**, the middle of the window, because the eight
factors were solved for exactly that (maps 6 and 7 read 1.26 and 1.24, the closest a
two-decimal factor reaches on those trainer counts).

Maps 6, 7 and 8 read the same `end` band, and one shared rate cannot pay three
different caps from three different trainer counts: measured with every factor at
`1`, the three floors read **1.57, 1.37 and 1.15** — a 1.37x spread, so one shared
rate would leave map 6 a quarter over the target while map 8 sat barely above the
window's floor. The shipped rule is therefore a **per-floor**
factor: maps 6 and 7 pay 0.80 and 0.91 of the band's rate and map 8 pays 1.09, so
each of the three fills at about 1.25 (`0.75 × 6.00 × 13532.57 / 48726 = 1.25` on
map 8). The other five floors pay their own solved rates (1.00, 1.09, 1.07, 1.00
and 1.25), so every floor where the band rate alone does not fit gets its own lever.
A **seventh band** was rejected because `TRAINER_XP_PER_MAP` keys off the **floor**,
not a `BandId`: a band column would reach the tables that key off those six ids
(`ROUTE_LOOT`, the shop, the casino and the trainer-money tables), and the three
`end` floors do not split along a level boundary the way a band must.

A floor's level range **straddles two bands**, and the rate comes from the
_defeated_ Pokémon's band, so `A(m)` mixes its own band's rate with the next band's:
map 1's roster spans levels 2–9, so its 2–8 roster members are paid Early's 6.07 and
its level-9 member Low's 16.18. That is why the six band rates are solved as a chain
— each floor's window constrains its own band _and_ the one above it — rather than
one band at a time; the per-floor factor is then solved on top of that chain.
Re-solve by measuring first: `A(m)` is fixed by the floor's level range, party size
and factor, so the sheet's numbers follow the walk in
`src/engine/run/curve.test.ts`, never the other way round. The fill is linear in the
factor, so a fill measured with every factor at `1` gives `factor = 1.25 / fill`, and
two decimals are enough: 0.80, 0.91 and 1.09 land the re-run within 0.008 of 1.25,
and the five other floors within 0.003.

Worked once, so the column can be checked by hand: map 1's band spans levels 2-9, so
`A(1)` is `(91 + 136 + 182 + 227 + 273 + 318 + 364 + 1092) / 8 = 335.375` — levels
2-8 paid Early's 6.07 (`floor(level × 5 × 1.5 × trainerXp)`) and level 9 paid
`low`'s 16.18, which is the straddle above in one figure. Map 2 straddles the other
way: its band spans levels 9-16, so `A(2)` is
`(1092 + 1213 + 1334 + 1456 + 1577 + 1698 + 1820 + 1030) / 8 = 1402.50`, seven
levels at `low`'s 16.18 and the eighth at `mid`'s 8.59. The `end` floors show the
factor at work: map 6 spans levels 37-43, so its seven awards run 1767 … 2053 at
factor 0.80 for `A(6) = 4 × 1909.857 = 7639.43`, and map 8's levels 49-55 run 3188 …
3579 at factor 1.09 for `A(8) = 4 × 3383.143 = 13532.57`.

## The rule

A Pokémon defeated in a **trainer** battle is worth
`experienceAward(level, 1, true, floorMultiplier)` =
`floor(level × 5 × 1.5 × trainerXp × floorMultiplier)`, where `trainerXp` is the
multiplier of the **defeated** Pokémon's level band (`bandForLevel`, `src/data/run.ts`)
and `floorMultiplier` is the factor of the floor the battle was fought on
(`trainerXpMultiplierForMap`, row `mapIndex - 1`, clamped at both ends, so it repeats
its last row past map 8). A wild encounter is worth `floor(level × 5)` and reads
neither the band rate nor the floor factor.

Every band rate is **above** 1: a trainer's Pokémon is always worth more than the
wild one of the same level, before the floor factor. The floors still pay their cap
because the squad shares the bar, and the numbers are re-solved whenever a level
range, the trainer-room table or a floor's density moves — a floor that places more
trainers needs less per defeat, and the per-floor factor is the last lever.

The squad shares **one XP bar** (`D35`), so the budget is a floor total, not a
per-member figure, and nothing is split across participants (`participants` is 1 at
the one call site, `resolveBattle` in `src/engine/run/resolve.ts`, which passes the
floor the battle was fought on — `next.mapIndex`, before `advanceMap` runs).

## Exceptions

- **The map boss** fields a fixed six (three on **map 1**) at the floor's cap and
  the **mini-boss** a fixed three (two on map 1) at band levels
  (`src/data/bosses.ts`); both are injected by the scene on top of the route, so
  they award beyond the 75 % budget. **Verdict, re-measured in this pass: the
  award stays uncapped and outside the budget.** A boss roster pays
  `experienceAward(cap, 1, true, factor)` once per member — 3276, 6738, 14064,
  14658, 16566, 12318, 15972 and 21474 XP on maps 1-8, which is 5.42x, 2.00x, 1.74x,
  0.99x, 0.70x, 0.43x, 0.42x and 0.44x of that floor's own `needed(m)`. Folding it
  into the budget would put **every** floor past the rule's `1.5` ceiling
  (fill 6.67, 3.25, 2.99, 2.24, 1.95, 1.68, 1.66 and 1.69), because the eight
  floors are solved at 1.25 and even the smallest boss surplus (0.42x, map 7) is more
  than the 0.25 the window leaves above that fill — so a boss folded into the rule
  would make the rule meaningless on every floor. The window measures
  whether 75 % of a floor's **regular** trainers pays its cap; the boss is the
  floor's finale, injected on top of the route like the mini-boss — whose
  band-level roster is drawn under the run seed (`<seed>:miniboss:<map>`,
  `src/scenes/RouteScene.ts`), so its own sum is not quoted per floor — and capping
  either would be a change to the award rule (`experienceAward`, a battle rule), not
  an edit to balance data. The surplus the finale pays is clamped by the floor's cap
  (`levelCapForMap`) like any other gain.
- The floor's **entry, boss and every special leaf** (the mini-boss, the mega-stone,
  the casino, the gated room, the trade room and the no-heal room) are quiet: they
  place no route trainers at all. There is no shop room any more: the **merchant**
  special NPC stands in the floor's first trainer room and only adds its own sprite,
  so the Mart a floor carries no longer moves a trainer count
  (`docs/maps-spec.md` §7).
- **Wild encounters** are outside the budget entirely; they are how a floor is
  walked, not how it is paid for.
- **Infinite mode** reuses the `End` band past map 8 while the cap keeps climbing
  (`MAP_TUNING_STEP.levelStep` a map, both ends of the range, until it saturates at
  `MAP_MAX_LEVEL`), and `trainerXpMultiplierForMap` repeats its last row, so every
  floor past map 8 pays map 8's 1.09: no single factor can hold the window against a
  cap that keeps stepping, so the 75 % rule is stated for the **eight finite maps**
  only.
- A single capture per route is untouched by any of this: the XP curve never gates a
  catch.

## Evolution levels

Every evolution is a level evolution (`D38`), and a non-level one (stone, trade,
friendship, move) reads its species' **BST band** from `EVOLUTION_BST_LEVELS`
(`src/data/dex/evolutions.ts`), which mirrors the BST windows the level bands
above tile:

| BST band          | `LevelBand.bst` | Level |
| ----------------- | --------------- | ----: |
| Early + Low       | 0–355           |    20 |
| Mid               | 356–440         |    30 |
| High + Late + End | 441–800         |    40 |

A branch never resolves below its band's level, and never below **10 levels over
the evolution that produced the species** (`EVOLUTION_MIN_GAP`): the floor is the
pre-evolution's **own resolved level**, so a line whose canon level-up is late
pushes its stone/trade branch along with it (Horsea 32 → Seadra 42). A canon
level-up evolution keeps its own level untouched — the starters still read 16 and
36 — which is why the two rules coexist on the same graph. Across the playable
dex the rule moves **60 of the 156** non-level branches away from the old stage
constant: up where a middle form's band beats 30 (Primeape 30 → 40, Scyther
20 → 40) and down where a pre-evolution levels early (Lombre and Nuzleaf
30 → 24).

| Species  | `bst` | Level | Why                                            |
| -------- | ----: | ----: | ---------------------------------------------- |
| Eevee    |   325 |    20 | base form, Early+Low band                      |
| Pichu    |   205 |    20 | base form, Early+Low band                      |
| Ralts    |   198 |    20 | base form, Early+Low band                      |
| Mankey   |   305 |    28 | canon level-up, unchanged                      |
| Horsea   |   295 |    32 | canon level-up, unchanged                      |
| Slowpoke |   315 |    37 | canon level-up, unchanged                      |
| Pikachu  |   320 |    30 | Early+Low band 20, +10 over Pichu's 20         |
| Kirlia   |   278 |    30 | canon level-up 30, shared by Gardevoir/Gallade |
| Primeape |   455 |    40 | End band 40, over Mankey's 28 (was 30)         |
| Seadra   |   440 |    42 | Mid band 30, +10 over Horsea's 32 (was 33)     |

Per **finite** map, read against `levelCapForMap` (`src/data/maps.ts`, the Cap
column) at the time this sheet is read, which of those levels the squad can
actually reach:

| Map | Cap | Evolution levels of the table the cap reaches |
| --: | --: | --------------------------------------------- |
|   1 |   9 | none (the lowest level in the table is 20)    |
|   2 |  16 | none                                          |
|   3 |  23 | 20 — Eevee, Pichu, Ralts                      |
|   4 |  30 | 28 Mankey, 30 Pikachu/Kirlia                  |
|   5 |  37 | 32 Horsea, 37 Slowpoke                        |
|   6 |  43 | 40 Primeape, 42 Seadra                        |
|   7 |  49 | — (the table is complete at map 6)            |
|   8 |  55 | —                                             |

Every level of the table is reached **inside** the finite run now, by map 6; the
cap only keeps climbing past map 8 in **infinite** mode, where the floors grow by
`MAP_TUNING_STEP.levelStep` (8) a map until the engine ceiling (`MAX_LEVEL`, 100)
saturates both ends of the range. A branch the cap blocks is not clamped — it stays
grey until the squad legally reaches its level. Retuning `MAP_TUNING` moves this
table; the rule above does not move with it.

## Re-reading this sheet

Change `LEVEL_BANDS[*].trainerXp`, `TRAINER_XP_PER_MAP` (or a map's level range) in
`src/data/`, run `npm test`, and re-read the walk: `src/engine/run/curve.test.ts`
rebuilds every room of every finite map the way `RouteScene` does, over the three
seeds above, measures `T̄(m)` and `A(m)`, and asserts the window per map. When this
sheet and that test disagree, the test is right.

Since `[Task-65]`'s **gated** leaf the walk counts that leaf too: it rolls with a
**20 %** chance **from map 3 on** (`src/engine/maps/plan.ts`, `docs/maps-spec.md`
§7), so it adds a door to the room it hangs from and shifts the floors after it, and
the counts above include it. The trainer counts themselves are bounded by
`TRAINER_ROOMS_PER_MAP` (`[Task-82]`), which is why a later map's count no longer
follows its room count.

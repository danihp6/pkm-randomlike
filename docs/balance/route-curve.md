# Route curve

Phase 6 notes. **The numbers live in `src/data/run.ts`** (`LEVEL_BANDS.trainerXp`)
and in `src/data/maps.ts` (the per-map level ranges); this sheet records where they
come from, not the values themselves.

A floor is one **map** (`docs/maps-spec.md`): a grid of routes of one biome with its
own level range, closed into a loop, whose farthest room fields the boss. A finite
run walks eight of them. The rule below is what makes a squad keep pace with the band
by fighting **trainers** instead of grinding the tall grass: beating 75 % of a
floor's trainers is enough to reach that floor's level cap.

**Re-measured (Task-09).** Every number on this sheet was re-walked against the
shipped tree: the band table and the caps are read from `src/data/run.ts` and
`src/data/maps.ts`, and `T̄(m)`, `A(m)` and the fill column are the per-map figures
`src/engine/run/curve.test.ts` computes over its three fixed seeds (`curve-a`,
`curve-b`, `curve-c`). The walk reproduced the tables below **unchanged**, so no
number on this sheet moved in that pass; the one decision it took is the boss's
award, recorded under Exceptions.

## Level bands

Every floor reads one band (`bandForLevel(minLevel)` in `src/data/run.ts`): a level
window, the typical trainer party size, the trainer XP multiplier the battle awards,
and the BST window the archetype pools draw from. The windows meet at their
boundaries and the higher band owns the shared level, so the six bands span 2..55
with no gap.

| Band  | Levels | Trainer party | `trainerXp` | BST window |
| ----- | -----: | ------------: | ----------: | ---------- |
| Early |    2–9 |             1 |        2.67 | 0–305      |
| Low   |   9–16 |             1 |       10.68 | 306–355    |
| Mid   |  16–23 |             2 |        3.04 | 356–440    |
| High  |  23–30 |             2 |        5.82 | 441–490    |
| Late  |  30–37 |             3 |        4.65 | 491–520    |
| End   |  37–55 |             4 |        2.61 | 521–800    |

`trainerXp` is **not** a difficulty ramp and is not monotonic: a floor's trainer
party already carries its own levels and party size, so the multiplier is only what
is left to reach the floor's cap. It tracks two things: how many Pokémon the floor
fields (`T̄(m)` × `trainerSize`) and how far its cap jumps (`needed(m)`) against the
levels those members stand at. `Low` is therefore the peak — map 2's cap leaps
9 → 16 while its roster is still one Pokémon per trainer, so six-odd defeats have
to carry 3367 XP — and `End` is the lowest — its floors field four members each,
over fourteen or more trainers, so map 6 alone beats 58 Pokémon. `High` sits over
`Mid` for a related reason: map 4's step (23 → 30) is the same seven levels as
map 3's, but it is taken higher up the curve, where a defeat is worth more while
the floor places only about one trainer more, so each defeat still carries more.

The **BST windows** were re-checked against the shipped dex in the same pass and
**did not move**: they tile `0..800` with no gap and no overlap (the tiling
`src/engine/run/pool.test.ts` asserts), no band straddles an `EVOLUTION_BST_LEVELS`
mirror (0–355 / 356–440 / 441–800, the table under _Evolution levels_), and the
six bands hold 208 / 171 / 202 / 223 / 158 / 290 spawnable species for a trainer
and 206 / 171 / 200 / 220 / 157 / 137 for the wild, which drops the legendary and
mythical tags. The `trainerSize` column is `LEVEL_BANDS`' own and did not move
either: it is solved into `A(m)`, and every floor's fill below already sits inside
the window.

## Level caps per map

The cap is the map's own `maxLevel` (`levelCapForMap`), and a fresh run's starter
begins at level 5 (`START_LEVEL`, `src/scenes/StarterScene.ts`). `needed(m)` is the
XP the squad still needs on floor `m` if it capped out on floor `m - 1`: the `level³`
curve at the new cap minus the curve at the old one.

| Map | Levels | Cap | `needed(m)` |
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
level range, each worth `experienceAward(level, 1, true)`.

| Map | Band  | Trainers per seed (rooms) | `T̄(m)` |  `A(m)` | `0.75 × T̄(m) × A(m)` | Window          | Fill |
| --: | ----- | ------------------------- | -----: | ------: | -------------------: | --------------- | ---: |
|   1 | Early | 7 (7), 5 (6), 5 (7)       |   5.67 |  177.50 |               754.38 | 604 – 906       | 1.25 |
|   2 | Low   | 5 (8), 8 (7), 6 (7)       |   6.33 |  886.25 |              4209.69 | 3367 – 5050.5   | 1.25 |
|   3 | Mid   | 11 (8), 13 (7), 12 (7)    |  12.00 | 1008.00 |              9072.00 | 8071 – 12106.5  | 1.12 |
|   4 | High  | 15 (9), 12 (9), 12 (9)    |  13.00 | 2246.50 |             21903.38 | 14833 – 22249.5 | 1.48 |
|   5 | Late  | 16 (8), 12 (8), 9 (8)     |  12.33 | 3291.38 |             30445.22 | 23653 – 35479.5 | 1.29 |
|   6 | End   | 14 (8), 15 (7), 15 (9)    |  14.67 | 3130.29 |             34433.14 | 28854 – 43281   | 1.19 |
|   7 | End   | 13 (8), 12 (9), 19 (10)   |  14.67 | 3600.00 |             39600.00 | 38142 – 57213   | 1.04 |
|   8 | End   | 23 (11), 15 (7), 14 (8)   |  17.33 | 4069.71 |             52906.29 | 48726 – 73089   | 1.09 |

"Fill" is `0.75 × T̄(m) × A(m) / needed(m)`; the rule wants it inside `1 – 1.5`, and
every floor lands there. Maps 1-2 sit in the **middle** of the window (1.25 and
1.25): they are the run's on-ramp, and the population pass that thins them
(`POPULATION`, `O-M5`) cancels the map-size tier's `+1` and hangs each pocket's
guard only a chance of the time. Map 1 hangs no shop leaf either, so its floor
reads **six rooms, seven with its mini-boss**. That thinner density is what the
`early` and `low` `trainerXp` numbers above are solved against: before the pass the
two floors placed 12.00 and 12.33 trainers and read 1.42 and 1.44 — the upper half
of the window, held open on purpose for exactly this re-solve.

A floor's level range **straddles two bands**, and the multiplier comes from the
_defeated_ Pokémon's band, so `A(m)` mixes its own band's rate with the next band's:
map 1's roster spans levels 2–9, so its 2–8 roster members are paid Early's 2.67 and
its level-9 member Low's 10.68. That is why the six multipliers are solved as a chain —
each floor's window constrains its own band _and_ the one above it — rather than one
band at a time. Re-solve by measuring first: `A(m)` is fixed by the floor's own level
range and party size, so the sheet's numbers follow the walk in
`src/engine/run/curve.test.ts`, never the other way round. Solvable from the bottom:
`low` from map 2, then `early` from map 1 (whose level-9 rosters are paid `low`'s
multiplier), then the four later bands the same way.

Worked once, so the column can be checked by hand: map 1's band spans levels 2-9,
so `A(1)` is `(40 + 60 + 80 + 100 + 120 + 140 + 160 + 720) / 8 = 177.50` — levels
2-8 paid `early`'s 2.67 (`floor(level × 5 × 1.5 × trainerXp)`) and level 9 paid
`low`'s 10.68, which is the straddle above in one figure. Map 2 straddles the
other way: its band spans levels 9-16, so `A(2)` is
`(720 + 801 + 881 + 961 + 1041 + 1121 + 1201 + 364) / 8 = 886.25`, seven levels at
`low`'s 10.68 and the eighth at `mid`'s 3.04. Every later row is the same sum over
that floor's own band.

## The rule

A Pokémon defeated in a **trainer** battle is worth `experienceAward(level, 1, true)`
= `floor(level × 5 × 1.5 × trainerXp)`, where `trainerXp` is the multiplier of the
**defeated** Pokémon's level band (`bandForLevel`, `src/data/run.ts`). A wild
encounter is worth the same without the 1.5 × `trainerXp` factor.

Every multiplier is **above** 1: a trainer's Pokémon is always worth more than the
wild one of the same level. The floors still pay their cap because the squad shares
the bar, and the multipliers are re-solved whenever a level range or a floor's
density moves — a floor that places more trainers needs less per defeat.

The squad shares **one XP bar** (`D35`), so the budget is a floor total, not a
per-member figure, and nothing is split across participants (`participants` is 1 at
the one call site, `resolveBattle` in `src/engine/run/resolve.ts`).

## Exceptions

- **The map boss** fields a fixed six (three on **map 1**) at the floor's cap and
  the **mini-boss** a fixed three (two on map 1) at band levels
  (`src/data/bosses.ts`); both are injected by the scene on top of the route, so
  they award beyond the 75 % budget. **Verdict, re-measured in this pass: the
  award stays uncapped and outside the budget.** A boss roster pays
  `experienceAward(cap, 1, true)` once per member — 2160, 2184, 6018, 6276, 4344,
  5046, 5754 and 6456 XP on maps 1-8, which is 3.58x, 0.65x, 0.75x, 0.42x, 0.18x,
  0.17x, 0.15x and 0.13x of that floor's own `needed(m)`. Folding it into the
  budget would put maps 1-4 past the rule's `1.5` ceiling (fill 4.83, 1.90, 1.87
  and 1.90) while maps 5-8 would still land inside it (1.47, 1.37, 1.19, 1.22), so
  a boss folded into the rule would make the rule meaningless exactly where the
  run is an on-ramp. The window measures whether 75 % of a floor's **regular**
  trainers pays its cap; the boss is the floor's finale, injected on top of the
  route like the mini-boss — whose own three members pay 240, 3123, 1368, 3534,
  3555, 2349, 2700 and 3051 XP, the map 2 fight alone reading 93 % of that floor's
  `needed(m)` because `low` carries the chain's peak multiplier — and capping
  either would be a change to the award rule (`experienceAward`, a battle rule),
  not an edit to balance data. The surplus the finale pays is clamped by the
  floor's cap (`levelCapForMap`) like any other gain.
- The floor's **entry, boss and special leaves** (the shop, the mini-boss room and
  the mega-stone room) are quiet: they place no route trainers at all, and the shop
  holds a counter rather than a trainer. **Map 1 hangs no shop leaf** at all
  (`docs/maps-spec.md` §7, `hangsShop`): the leaf it would hold is quiet either way,
  so not one trainer moves for it — its floor simply reads one room fewer.
- **Wild encounters** are outside the budget entirely; they are how a floor is
  walked, not how it is paid for.
- **Infinite mode** reuses the `End` band past map 8 while the cap keeps climbing
  (`MAP_TUNING_STEP.levelStep` a map, both ends of the range, until it saturates at
  `MAP_MAX_LEVEL`), so no single multiplier can hold the window there: the 75 % rule
  is stated for the **eight finite maps** only.
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

Change `trainerXp` (or a map's level range) in `src/data/`, run `npm test`, and
re-read the walk: `src/engine/run/curve.test.ts` rebuilds every room of every finite
map the way `RouteScene` does, over the three seeds above, measures `T̄(m)` and
`A(m)`, and asserts the window per map. When this sheet and that test disagree, the
test is right.

# Route curve

Phase 6 notes. **The numbers live in `src/data/run.ts`** (`LEVEL_BANDS.trainerXp`)
and in `src/data/maps.ts` (the per-map level ranges); this sheet records where they
come from, not the values themselves.

A floor is one **map** (`docs/maps-spec.md`): a grid of routes of one biome with its
own level range, closed into a loop, whose farthest room fields the boss. A finite
run walks eight of them. The rule below is what makes a squad keep pace with the band
by fighting **trainers** instead of grinding the tall grass: beating 75 % of a
floor's trainers is enough to reach that floor's level cap.

## Level bands

Every floor reads one band (`bandForLevel(minLevel)` in `src/data/run.ts`): a level
window, the typical trainer party size, the trainer XP multiplier the battle awards,
and the BST window the archetype pools draw from. The windows meet at their
boundaries and the higher band owns the shared level, so the six bands span 2..55
with no gap.

| Band  | Levels | Trainer party | `trainerXp` | BST window |
| ----- | -----: | ------------: | ----------: | ---------- |
| Early |    2–9 |             1 |        1.35 | 0–305      |
| Low   |   9–16 |             1 |        6.08 | 306–355    |
| Mid   |  16–23 |             2 |        3.04 | 356–440    |
| High  |  23–30 |             2 |        5.82 | 441–490    |
| Late  |  30–37 |             3 |        4.65 | 491–520    |
| End   |  37–55 |             4 |        2.61 | 521–800    |

`trainerXp` is **not** a difficulty ramp and is not monotonic: a floor's trainer
party already carries its own levels and party size, so the multiplier is only what
is left to reach the floor's cap. It tracks two things: how many Pokémon the floor
fields (`T̄(m)` × `trainerSize`) and how far its cap jumps (`needed(m)`) against the
levels those members stand at. `Low` is therefore the peak — map 2's cap leaps
9 → 16 while its roster is still one Pokémon per trainer, so twelve-odd defeats have
to carry 3367 XP — and `End` is the lowest — its floors field four members each,
over sixteen or more trainers, so map 6 alone beats 64 Pokémon. `Mid` sits under
`High` for the same reason: map 4 places _fewer_ trainers (eleven against thirteen)
for a one-band cap jump of the same size, so each of its defeats carries more.

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
|   1 | Early | 12 (8), 12 (7), 12 (8)    |  12.00 |   95.13 |               856.13 | 604 – 906       | 1.42 |
|   2 | Low   | 11 (8), 12 (7), 14 (7)    |  12.33 |  524.00 |              4847.00 | 3367 – 5050.5   | 1.44 |
|   3 | Mid   | 13 (8), 13 (7), 14 (7)    |  13.33 | 1008.00 |             10080.00 | 8071 – 12106.5  | 1.25 |
|   4 | High  | 12 (9), 9 (9), 12 (9)     |  11.00 | 2246.50 |             18533.63 | 14833 – 22249.5 | 1.25 |
|   5 | Late  | 16 (8), 10 (8), 10 (8)    |  12.00 | 3291.38 |             29622.38 | 23653 – 35479.5 | 1.25 |
|   6 | End   | 14 (8), 17 (7), 17 (9)    |  16.00 | 3130.29 |             37563.43 | 28854 – 43281   | 1.30 |
|   7 | End   | 13 (8), 15 (9), 23 (10)   |  17.00 | 3600.00 |             45900.00 | 38142 – 57213   | 1.20 |
|   8 | End   | 25 (11), 15 (7), 12 (8)   |  17.33 | 4069.71 |             52906.29 | 48726 – 73089   | 1.09 |

"Fill" is `0.75 × T̄(m) × A(m) / needed(m)`; the rule wants it inside `1 – 1.5`, and
every floor lands there. Maps 1-2 sit in the **upper half** of the window (1.42 and
1.44) on purpose: the pass that thins those two floors strips trainers and loot, and
a floor that leaves the window's slack to spend is what lets it stay above 1 without
re-solving the whole chain.

A floor's level range **straddles two bands**, and the multiplier comes from the
_defeated_ Pokémon's band, so `A(m)` mixes its own band's rate with the next band's:
map 1's roster spans levels 2–9, so its 2–8 roster members are paid Early's 1.35 and
its level-9 member Low's 6.08. That is why the six multipliers are solved as a chain —
each floor's window constrains its own band _and_ the one above it — rather than one
band at a time. Re-solve by measuring first: `A(m)` is fixed by the floor's own level
range and party size, so the sheet's numbers follow the walk in
`src/engine/run/curve.test.ts`, never the other way round.

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

- **The map boss** fields a max-level party one size larger than its band and the
  **mini-boss** one size larger still; both are injected by the scene on top of the
  route, so they award beyond the 75 % budget.
- The floor's **entry, boss and special leaves** (the shop, the mini-boss room and
  the mega-stone room) are quiet: they place no route trainers at all, and the shop
  holds a counter rather than a trainer.
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

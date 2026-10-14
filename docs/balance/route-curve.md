# Route curve

Phase 6 notes. **The numbers live in `src/data/run.ts`** (`LEVEL_BANDS.trainerXp`)
and in `src/data/maps.ts` (the per-map level ranges); this sheet records where they
come from, not the values themselves.

A floor is one **map** (`docs/maps-spec.md`): a grid of routes of one biome with its
own level range, closed into a loop, whose farthest room fields the boss. A finite
run walks six of them. The rule below is what makes a squad keep pace with the band
by fighting **trainers** instead of grinding the tall grass: beating 75 % of a
floor's trainers is enough to reach that floor's level cap.

## Level bands

Every floor reads one band (`bandForLevel(minLevel)` in `src/data/run.ts`): a level
window, the typical trainer party size, the trainer XP multiplier the battle awards,
and the BST window the archetype pools draw from.

| Band  | Levels | Trainer party | `trainerXp` | BST window |
| ----- | -----: | ------------: | ----------: | ---------- |
| Early |    2–5 |             1 |         0.3 | 0–305      |
| Low   |    5–9 |             1 |         0.6 | 306–355    |
| Mid   |   9–14 |             2 |         3.9 | 356–440    |
| High  |  14–20 |             2 |         1.7 | 441–490    |
| Late  |  20–28 |             3 |           6 | 491–520    |
| End   |  28–40 |             4 |         3.2 | 521–800    |

`trainerXp` is **not** a difficulty ramp and is not monotonic: a floor's trainer
party already carries its own levels and party size, so the multiplier is only what
is left to reach the floor's cap. A level-40 roster of four Pokémon per trainer
needs a _smaller_ multiplier than a level-28 roster of three, which is why `End`
sits below `Late`.

## Level caps per map

The cap is the map's own `maxLevel` (`levelCapForMap`), and a fresh run's starter
begins at level 5 (`START_LEVEL`, `src/scenes/StarterScene.ts`). `needed(m)` is the
XP the squad still needs on floor `m` if it capped out on floor `m - 1`: the `level³`
curve at the new cap minus the curve at the old one.

| Map | Levels | Cap | `needed(m)` |
| --: | ------ | --: | ----------: |
|   1 | 2–6    |   6 |          91 |
|   2 | 6–11   |  11 |        1115 |
|   3 | 11–17  |  17 |        3582 |
|   4 | 17–24  |  24 |        8911 |
|   5 | 24–32  |  32 |       18944 |
|   6 | 32–40  |  40 |       31232 |

## The per-floor trainer budget

The three seeds are `curve-a`, `curve-b` and `curve-c` (fixed in
`src/engine/run/curve.test.ts`), so the counts below are reproducible. `T̄(m)` is the
trainers a floor places (**summed over its rooms**, quiet leaves counting zero; the
hand-placed boss and mini-boss are injected on top by the scene and are not part of
the budget), averaged over the three seeds. `A(m)` is what one of those trainers
awards on average: `trainerSize` roster members drawn uniformly across the map's
level range, each worth `experienceAward(level, 1, true)`.

| Map | Band  | Trainers per seed (rooms) | `T̄(m)` |  `A(m)` | `0.75 × T̄(m) × A(m)` | Window         | Fill |
| --: | ----- | ------------------------- | -----: | ------: | -------------------: | -------------- | ---: |
|   1 | Early | 11 (8), 10 (7), 13 (8)    |  11.33 |   13.40 |               113.90 | 91 – 136.5     | 1.25 |
|   2 | Low   | 10 (8), 11 (7), 12 (7)    |  11.00 |  161.50 |              1332.38 | 1115 – 1672.5  | 1.20 |
|   3 | Mid   | 11 (8), 11 (7), 13 (7)    |  11.67 |  526.00 |              4602.50 | 3582 – 5373    | 1.28 |
|   4 | High  | 11 (9), 9 (9), 11 (9)     |  10.33 | 1409.25 |             10921.69 | 8911 – 13366.5 | 1.23 |
|   5 | Late  | 17 (8), 10 (8), 10 (8)    |  12.33 | 2730.00 |             25252.50 | 18944 – 28416  | 1.33 |
|   6 | End   | 12 (8), 16 (7), 16 (9)    |  14.67 | 3456.00 |             38016.00 | 31232 – 46848  | 1.22 |

"Fill" is `0.75 × T̄(m) × A(m) / needed(m)`; the rule wants it inside `1 – 1.5`, and
every floor lands there with at least 0.16 of slack to the nearer edge.

A floor's level range **straddles two bands**, and the multiplier comes from the
_defeated_ Pokémon's band, so `A(m)` mixes its own band's rate with the next band's:
map 1's roster spans levels 2–6, so its 2–4 roster members are paid Early's 0.3 and
its 5–6 members Low's 0.6. That is why the six multipliers are solved as a chain —
each floor's window constrains its own band _and_ the one above it — rather than one
band at a time.

Two bands land **below 1**, which means they were **over-rewarding** trainers before
this task, not under-rewarding: on maps 1 and 2 a floor's upper roster members
already earn the next band's much larger rate, so the floor's own rate has to be a
discount for 75 % of its trainers to land on the cap instead of flying past it. The
window was not widened for them.

## The rule

A Pokémon defeated in a **trainer** battle is worth `experienceAward(level, 1, true)`
= `floor(level × 5 × 1.5 × trainerXp)`, where `trainerXp` is the multiplier of the
**defeated** Pokémon's level band (`bandForLevel`, `src/data/run.ts`). A wild
encounter is worth the same without the 1.5 × `trainerXp` factor.

From Mid up (a multiplier of 3.9 or more) a trainer's Pokémon is worth several times
a wild one of the same level, so a floor is paid by fighting its trainers. In Early
and Low the multiplier is below 0.67, so a single trainer's Pokémon is worth _less_
than the wild one of the same level: that is the over-rewarding correction above, and
the floor still pays its cap because it places a dozen or so trainers and the bar is
shared.

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
- **Infinite mode** reuses the `End` band past map 6 while the cap keeps climbing
  (`MAP_TUNING_STEP`), so no single multiplier can hold the window there: the 75 %
  rule is stated for the **six finite maps** only.
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

| Map | Cap | Evolution levels of the table the cap reaches      |
| --: | --: | -------------------------------------------------- |
|   1 |   6 | none (the earliest canon level-up in the dex is 7) |
|   2 |  11 | none                                               |
|   3 |  17 | none (the lowest level in the table is 20)         |
|   4 |  24 | 20 — Eevee, Pichu, Ralts                           |
|   5 |  32 | 28 Mankey, 30 Pikachu/Kirlia, 32 Horsea            |
|   6 |  40 | 37 Slowpoke, 40 Primeape                           |

Only **Seadra's 42** stays out of reach: past map 6 the cap grows by
`MAP_TUNING_STEP.levelStep` (8) a map, so an **infinite** run's map 7 already caps
above it. A branch the cap blocks is not clamped — it stays grey until the squad
legally reaches its level, and in a finite run the late stone lines simply never
fire. Retuning `MAP_TUNING` moves this table; the rule above does not move with
it.

## Re-reading this sheet

Change `trainerXp` (or a map's level range) in `src/data/`, run `npm test`, and
re-read the walk: `src/engine/run/curve.test.ts` rebuilds every room of every finite
map the way `RouteScene` does, over the three seeds above, measures `T̄(m)` and
`A(m)`, and asserts the window per map. When this sheet and that test disagree, the
test is right.

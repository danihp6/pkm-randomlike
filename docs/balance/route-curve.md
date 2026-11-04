# Route curve

**The numbers live in `src/data/run.ts`** (`LEVEL_BANDS.trainerXp` and the per-stretch
`TRAINER_XP_PER_MAP`) and in `src/data/region.ts` (`BADGE_CAPS`, `badgeCap`); this
sheet records where they come from and what the walk measures, not the values
themselves.

One run is one **region** (`docs/region-spec.md` §1): a starting town, eight gym
cities in badge order, one long main route per **stretch** plus one or two optional
**laterals**, the Victory Road, the League and the tower. This sheet is the eight
stretches' trainer curve. The rule it records is what makes a squad keep pace with the
ladder by fighting **trainers** instead of grinding the tall grass: beating 75 % of a
stretch's trainers is enough to reach that stretch's level cap. Two numbers pay that
budget: the defeated Pokémon's **band rate** (`LEVEL_BANDS.trainerXp`) and the
**stretch's own factor** (`TRAINER_XP_PER_MAP`), so a band shared by several stretches
no longer forces one rate on all of them.

**Re-measured (Task-83).** Every measured number here was re-walked against the
shipped tree: the band table, the factors and the caps are read from `src/data/run.ts`
and `src/data/region.ts`, and `T̄(s)`, `A(s)` and the fill column are the per-stretch
figures `src/engine/run/curve.test.ts` computes over its three fixed seeds
(`curve-a`, `curve-b`, `curve-c`). The `trainerXp` column was **corrected** to the
values `LEVEL_BANDS` ships, and the eight fills are the walk's own.

**Re-pinned by every pass that moved a route's content (Task-92, 96, 97, 101, 102,
117, 157).** Each of those passes added, retired or re-shaped a room, so the trainers
the walk counted moved by one or two per stretch and so did this table's `T̄` column.
The **recipe** never changed: a stretch whose fill leaves the `1.05 – 1.5` window has
its single row re-solved with `factor' = round2(factor × 1.25 / fill)`, because the
fill is linear in the factor and two decimals land the re-run within a hundredth of
**1.25**, the middle of the window. A stretch that still sits inside the window keeps
its row — a broad re-solve is a balance task, not a room task.

**Re-walked on the region's ladder (Task-297).** The walk is the region's eight
stretches, not eight maps: every row reads its badge, its cap (`badgeCap`) and its band
(`bandForNode(route:<badge>)`, the previous stretch's cap up to this one's) off
`planRegion`, and the XP its cap costs off `xpForLevel`. The trainer count is still the
one the stretch's route posts through the shipped room generator, which is where
`RouteScene` places a regular trainer today; `docs/balance/campaign.md`'s open rows own
the population pass that replaces it. **No figure in `src/data/` moved in this pass**:
the table below is the walk's own, corrected wherever it had drifted from the shipped
factors and from the counts the later room passes produced.

## Level bands

Every node reads one band (`bandForLevel(minLevel)` in `src/data/run.ts`, wrapped for a
node by `bandForNode`): a level window, the typical trainer party size, the trainer XP
multiplier the battle awards, and the BST window the archetype pools draw from. The
windows meet at their boundaries and the higher band owns the shared level, so the six
bands span 2..55 with no gap.

| Band  | Levels | Trainer party | `trainerXp` | BST window |
| ----- | -----: | ------------: | ----------: | ---------- |
| Early |    2–9 |             1 |        6.07 | 0–305      |
| Low   |   9–16 |             1 |       16.18 | 306–355    |
| Mid   |  16–23 |             2 |        8.59 | 356–440    |
| High  |  23–30 |             2 |       12.70 | 441–490    |
| Late  |  30–37 |             3 |       10.86 | 491–520    |
| End   |  37–55 |             4 |        7.96 | 521–800    |

`trainerXp` is the **band's** rate, not a difficulty ramp, and is not monotonic: a
stretch's trainer party already carries its own levels and party size, so the rate is
only what the band contributes to reaching a stretch's cap — the per-stretch factor is
the remaining lever. `Low` is the peak — stretch 2's cap leaps 9 → 16 while its
trainers still field one Pokémon each and the stretch posts 3.33 of them, so each
defeat carries 1 528.75 XP of the 3 367 the cap costs. `Early` is the lowest — stretch
1 asks for only 604 XP and posts three trainers over levels 2–9, so each defeat carries
335.38. `End` is modest (7.96) although its stretches field four members each: the
per-stretch factors trim stretches 6 and 7 and lift stretch 8, which is what keeps a
shared band's three stretches inside the window. `High` sits over `Mid` for a related
reason: stretch 4's step (23 → 30) is the same seven levels as stretch 3's, but it is
taken higher up the curve, where a defeat is worth more (`A(4)` 4 944 against `A(3)`
2 876.75) while both stretches post five trainers.

The **BST windows** were re-checked against the shipped dex and **did not move**: they
tile `0..800` with no gap and no overlap (the tiling `src/engine/run/pool.test.ts`
asserts), no band straddles an `EVOLUTION_BST_LEVELS` mirror (0–355 / 356–440 /
441–800, the table under _Evolution levels_), and the six bands hold
208 / 171 / 202 / 223 / 158 / 290 spawnable species for a trainer and
206 / 171 / 200 / 220 / 157 / 137 for the wild, which drops the legendary and mythical
tags. The `trainerSize` column is `LEVEL_BANDS`' own and did not move either: it is
solved into `A(s)`, and every stretch's fill below sits inside the window.

## Level caps per stretch

The **cap** is a stretch's only level anchor and the gym city's own `cap` in the plan
(`node.cap`, `badgeCap(badge)` in `src/data/region.ts`); a fresh run's starter begins
at level 5 (`STARTER_LEVEL`, `src/engine/run/prologue.ts`). A stretch's level window is
not stored: it opens at the previous stretch's cap and closes at this one
(`bandForNode`, `src/engine/run/levelCurve.ts`), which is what the `Window` column
below reads. `needed(s)` is the XP the squad still needs on stretch `s` if it capped
out on the previous one: the `level³` curve at the new cap minus the curve at the old
one, measured from a fresh starter's 5 on the first stretch, because there is no
previous cap to come from.

| Badge | Window | Cap | `needed(s)` |
| ----: | ------ | --: | ----------: |
|     1 | 2–9    |   9 |         604 |
|     2 | 9–16   |  16 |       3 367 |
|     3 | 16–23  |  23 |       8 071 |
|     4 | 23–30  |  30 |      14 833 |
|     5 | 30–37  |  37 |      23 653 |
|     6 | 37–43  |  43 |      28 854 |
|     7 | 43–49  |  49 |      38 142 |
|     8 | 49–55  |  55 |      48 726 |

The whole campaign to 55 is `55³ = 166 375` XP, in steps of 7 levels then 6. A
**constant** ten-level step to the engine ceiling would not fit that curve: its top
step alone, `xpForLevel(100) − xpForLevel(90)`, wants 271 000 XP — more than the entire
campaign above — which is why the step narrows as the levels climb (`BADGE_CAPS`).

## The per-stretch trainer budget

The three seeds are `curve-a`, `curve-b` and `curve-c` (fixed in
`src/engine/run/curve.test.ts`), so the counts below are reproducible. `T̄(s)` is the
trainers a stretch's route posts, summed over the rooms that route is built from (a
quiet leaf counts zero; the hand-placed boss and mini-boss are injected on top and are
not part of the budget), averaged over the three seeds. `A(s)` is what one of those
trainers awards on average: `trainerSize` roster members drawn across the stretch's
level window, each worth `experienceAward(level, 1, true, factor)` — **the stretch's
own factor is inside every award in the column**, which is why `A(s)` follows the
`Factor` column and not the band alone.

Route size is **shape-derived**, not rolled (`docs/routes-spec.md` §1/§4): the room
generator's shapes and the row's own size class decide a room's sides, and a stretch's
route is a stack of two, three or four 60x40 **screens** (`ROUTE_HEIGHTS`,
`src/data/region.ts`; `planRouteLayout` in `src/engine/region/route/layout.ts`). The
trainers are bounded by the room table, not by the room size: `TRAINER_ROOMS_PER_MAP`
(`src/data/population.ts`) tags a fixed number of a row's rooms as trainer rooms — two
on the first two rows, three on the next three, four on the last three — each holding
one or two trainers, so a seed moves the count by a trainer or two and never by a room
full.

| Badge | Band  | Trainers per seed (rooms) | `T̄(s)` |    `A(s)` | `0.75 × T̄ × A` | Window            | Factor | Fill |
| ----: | ----- | ------------------------- | -----: | --------: | -------------: | ----------------- | -----: | ---: |
|     1 | Early | 4 (7), 2 (6), 3 (7)       |   3.00 |    335.38 |         754.59 | 604 – 906         |   1.00 | 1.25 |
|     2 | Low   | 3 (7), 3 (6), 4 (6)       |   3.33 |  1 528.75 |       3 821.88 | 3 367 – 5 050.5   |   1.09 | 1.14 |
|     3 | Mid   | 4 (9), 6 (10), 5 (8)      |   5.00 |  2 876.75 |      10 787.81 | 8 071 – 12 106.5  |   1.07 | 1.34 |
|     4 | High  | 6 (8), 4 (9), 5 (10)      |   5.00 |  4 944.00 |      18 540.00 | 14 833 – 22 249.5 |   1.00 | 1.25 |
|     5 | Late  | 5 (7), 5 (8), 5 (8)       |   5.00 |  7 409.63 |      27 786.09 | 23 653 – 35 479.5 |   0.94 | 1.17 |
|     6 | End   | 6 (8), 5 (8), 5 (7)       |   5.33 |  7 639.43 |      30 557.71 | 28 854 – 43 281   |   0.80 | 1.06 |
|     7 | End   | 6 (10), 4 (12), 6 (13)    |   5.33 | 11 972.00 |      47 888.00 | 38 142 – 57 213   |   1.09 | 1.26 |
|     8 | End   | 5 (12), 5 (8), 5 (9)      |   5.00 | 16 265.14 |      60 994.29 | 48 726 – 73 089   |   1.31 | 1.25 |

"Fill" is `0.75 × T̄(s) × A(s) / needed(s)`; the rule wants it inside `1.05 – 1.5`,
and every stretch lands near **1.25**, the middle of the window, because the eight
factors were solved for exactly that. Stretch 6 is the thinnest (1.06) and stretch 3
the widest (1.34): the middle of the window is a target, not a rounding accident, and a
two-decimal factor cannot hit it exactly on every trainer count.

Stretches 6, 7 and 8 read the same `end` band, and one shared rate cannot pay three
different caps from three different trainer counts: measured with every factor at `1`,
the three read **1.32, 1.15 and 0.96** — a 1.38x spread, so one shared rate would
leave stretch 6 a third over the target while stretch 8 sat under the window's edge.
The shipped rule is therefore a **per-stretch** factor: stretches 6 and 7 pay 0.80 and
1.09 of the band's rate and stretch 8 pays 1.31, so each lands near 1.25
(`0.75 × 5.00 × 16 265.14 / 48 726 = 1.25` on stretch 8). The other five pay their own
solved rates (1.00, 1.09, 1.07, 1.00 and 0.94), so every stretch where the band rate
alone does not fit gets its own lever. A **seventh band** was rejected because
`TRAINER_XP_PER_MAP` keys off the **stretch**, not a `BandId`: a band column would
reach the tables that key off those six ids (`ROUTE_LOOT`, the shop, the casino and
the trainer-money tables), and the three `end` stretches do not split along a level
boundary the way a band must.

A stretch's level window **straddles two bands**, and the rate comes from the
_defeated_ Pokémon's band, so `A(s)` mixes its own band's rate with the next band's:
stretch 1's roster spans levels 2–9, so its 2–8 members are paid Early's 6.07 and its
level-9 member Low's 16.18. That is why the six band rates are solved as a chain —
each stretch's window constrains its own band _and_ the one above it — rather than one
band at a time; the per-stretch factor is then solved on top of that chain. Re-solve by
measuring first: `A(s)` is fixed by the stretch's level window, party size and factor,
so the sheet's numbers follow the walk in `src/engine/run/curve.test.ts`, never the
other way round.

Worked twice, so the column can be checked by hand. Stretch 1's band spans levels 2-9,
so `A(1)` is `(91 + 136 + 182 + 227 + 273 + 318 + 364 + 1 092) / 8 = 335.375` — levels
2-8 paid Early's 6.07 (`⌊level × 5 × 1.5 × trainerXp⌋`) and level 9 paid `low`'s 16.18,
which is the straddle above in one figure. Stretch 2 straddles the other way and
carries the factor: its window is levels 9-16 at 1.09, so its seven `low` awards run
1 190 … 1 984 and its level-16 member pays `mid`'s 8.59 at 1 123, for
`A(2) = 12 230 / 8 = 1 528.75`. The `end` stretches show the factor at work: stretch 6
spans levels 37-43, so its seven awards run 1 767 … 2 053 at factor 0.80 for
`A(6) = 4 × 1 909.857 = 7 639.43`, and stretch 8's levels 49-55 run 3 832 … 4 301 at
factor 1.31 for `A(8) = 4 × 4 066.286 = 16 265.14`.

## The rule

A Pokémon defeated in a **trainer** battle is worth
`experienceAward(level, 1, true, factor)` =
`⌊level × 5 × 1.5 × trainerXp × factor⌋`, where `trainerXp` is the multiplier of the
**defeated** Pokémon's level band (`bandForLevel`, `src/data/run.ts`) and `factor` is
the row of the stretch the battle was fought on (`trainerXpMultiplierForMap`, row
`badge - 1`, clamped at both ends, so it repeats its last row past the eighth). A wild
encounter is worth `⌊level × 5⌋` and reads neither the band rate nor the stretch
factor.

Every band rate is **above** 1: a trainer's Pokémon is always worth more than the wild
one of the same level, before the factor. The stretches still pay their cap because
the squad shares the bar, and the numbers are re-solved whenever a level cap, the
trainer-room table or a route's density moves — a stretch that posts more trainers
needs less per defeat, and the per-stretch factor is the last lever.

The squad shares **one XP bar** (`D35`), so the budget is a stretch total, not a
per-member figure, and nothing is split across participants (`participants` is 1 at
the one call site, `resolveBattle` in `src/engine/run/resolve.ts`, which passes the
stretch the battle was fought on — the **badge** of the node the run stands on,
`runNode(next).badge`, read by `trainerXpMultiplierForMap`).

## Exceptions

- **The boss** fields a fixed six (three on **stretch 1**) at the stretch's cap and
  the **mini-boss** a fixed three (two on stretch 1) at band levels
  (`src/data/bosses.ts`); both are injected by the scene on top of the route, so they
  award beyond the 75 % budget. **Verdict, re-measured in this pass: the award stays
  uncapped and outside the budget.** A boss roster pays
  `experienceAward(cap, 1, true, factor)` once per member — 3 276, 6 738, 14 064,
  14 658, 12 456, 12 318, 19 128 and 25 806 XP on stretches 1-8, which is 5.42x, 2.00x,
  1.74x, 0.99x, 0.53x, 0.43x, 0.50x and 0.53x of that stretch's own `needed(s)`.
  Folding it into the budget would put **seven of the eight** stretches past the rule's
  `1.5` ceiling (fill 6.67, 3.14, 3.08, 2.24, 1.70, 1.76 and 1.78 on stretches 1-5, 7
  and 8), stretch 6 landing at 1.49 only because its boss surplus is the smallest of
  the eight — so a boss folded into the rule would make the rule meaningless on seven
  stretches and misleading on the eighth. The window measures whether 75 % of a
  stretch's **regular** trainers pays its cap; the boss is the stretch's finale,
  injected on top of the route like the mini-boss — whose band-level roster is drawn
  under the run seed (`<seed>:miniboss:<route>`, `src/scenes/RouteScene.ts`), so its own
  sum is not quoted per stretch — and capping either would be a change to the award
  rule (`experienceAward`, a battle rule), not an edit to balance data. The surplus
  the finale pays is clamped by the stretch's cap (`badgeCap`) like any other gain.
- The route's **entry, boss and every special leaf** (the mini-boss, the mega-stone,
  the gated room, the trade room and the no-heal room) are quiet: they post no route
  trainers at all. There is no shop room any more: the **merchant** special NPC stands
  in the route's first trainer room and only adds its own sprite, so the Mart a stretch
  carries no longer moves a trainer count (`docs/region-spec.md` §7). The slot machine
  is an NPC's panel too, so it is no room at all.
- **Wild encounters** are outside the budget entirely; they are how a stretch is
  walked, not how it is paid for. Their band is `docs/balance/campaign.md` §1's.
- **Endless mode** reuses the `End` band past stretch 8 while the cap keeps climbing
  (`MAP_TUNING_STEP.levelStep` a step, both ends of the range, until it saturates at
  `MAP_MAX_LEVEL`), and `trainerXpMultiplierForMap` repeats its last row, so every
  stretch past the eighth pays the eighth's 1.31: no single factor can hold the window
  against a cap that keeps stepping, so the 75 % rule is stated for the **eight finite
  stretches** only.
- A single capture per route is untouched by any of this: the XP curve never gates a
  catch.

## Evolution levels

Every evolution is a level evolution (`D38`), and a non-level one (stone, trade,
friendship, move) reads its species' **BST band** from `EVOLUTION_BST_LEVELS`
(`src/data/dex/evolutions.ts`), which mirrors the BST windows the level bands above
tile:

| BST band          | `LevelBand.bst` | Level |
| ----------------- | --------------- | ----: |
| Early + Low       | 0–355           |    20 |
| Mid               | 356–440         |    30 |
| High + Late + End | 441–800         |    40 |

A branch never resolves below its band's level, and never below **10 levels over the
evolution that produced the species** (`EVOLUTION_MIN_GAP`): the base is the
pre-evolution's **own resolved level**, so a line whose canon level-up is late pushes
its stone/trade branch along with it (Horsea 32 → Seadra 42). A canon level-up
evolution keeps its own level untouched — the starters still read 16 and 36 — which is
why the two rules coexist on the same graph. Across the playable dex the rule moves
**60 of the 156** non-level branches away from the old stage constant: up where a
middle form's band beats 30 (Primeape 30 → 40, Scyther 20 → 40) and down where a
pre-evolution levels early (Lombre and Nuzleaf 30 → 24).

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

Per **finite** stretch, read against `badgeCap` at the time this sheet is read, which
of those levels the squad can actually reach:

| Badge | Cap | Evolution levels of the table the cap reaches |
| ----: | --: | --------------------------------------------- |
|     1 |   9 | none (the lowest level in the table is 20)    |
|     2 |  16 | none                                          |
|     3 |  23 | 20 — Eevee, Pichu, Ralts                      |
|     4 |  30 | 28 Mankey, 30 Pikachu/Kirlia                  |
|     5 |  37 | 32 Horsea, 37 Slowpoke                        |
|     6 |  43 | 40 Primeape, 42 Seadra                        |
|     7 |  49 | — (the table is complete at stretch 6)        |
|     8 |  55 | —                                             |

Every level of the table is reached **inside** the finite campaign now, by stretch 6;
the cap only keeps climbing past the eighth stretch in **infinite** mode, where the
cap rows grow by `MAP_TUNING_STEP.levelStep` (8) a step until the engine ceiling
(`MAX_LEVEL`, 100) saturates both ends of the range. A branch the cap blocks is not
clamped — it stays grey until the squad legally reaches its level. Retuning
`BADGE_CAPS` moves this table; the rule above does not move with it.

## Re-reading this sheet

Change `LEVEL_BANDS[*].trainerXp`, `TRAINER_XP_PER_MAP` (or a stretch's cap) in
`src/data/`, run `npm test`, and re-read the walk: `src/engine/run/curve.test.ts`
rebuilds every room of every stretch's route the way `RouteScene` does, over the three
seeds above, measures `T̄(s)` and `A(s)`, and asserts the window per stretch. When this
sheet and that test disagree, the test is right.

Since the **gated** leaf's arrival the walk counted that leaf too: it rolled with a
**20 %** chance from the plan's third row on, so it added a door to the room it hung
from and shifted the stretches after it. The region retires that leaf and the plan
that rolled it: a lateral is optional, its kind is the content pass's draw and a
`vault` is one of nine points of interest (`docs/region-spec.md` §7.3, §7.8), so it
adds no door and shifts no stretch. The trainer counts
themselves were bounded by `TRAINER_ROOMS_PER_MAP`, which is why a later stretch's
count no longer follows its room count; a region node's count is
`planNodeContent(...).trainers` (2-4 on a route), not that table's.

**Re-walked once more (Task-297).** This sheet was re-read end to end against the tree
with `curve-a`, `curve-b` and `curve-c`: the band table, the caps, the `needed(s)`
column, the per-stretch factors, `T̄(s)`, `A(s)`, the budget, the fills and the boss
exception's multiples are all the walk's own — the `T̄` and `A` columns had drifted from
the counts the later room passes produced and the exception section still quoted the
old factors' awards, both now corrected. **Nothing this pass measured moved in
`src/data/`**: the eight factors, the six band rates and the eight caps are the shipped
ones, and `docs/balance/campaign.md` is the same walk in one page.

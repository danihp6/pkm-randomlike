# The campaign

One run is one **region** (`docs/region-spec.md` §1), and the campaign is its eight
badge **stretches**: the long main route out of the last settlement, the optional
laterals hanging off it, the city whose gym closes it, then the Victory Road, the
League and the tower behind the Champion. A **stretch** is the campaign unit this
sheet uses; it replaces the old **floor**, the per-map unit the trainer budget was
solved against before the region existed. This sheet walks those eight stretches end
to end — cap, distance, party size, wild band, money and machine per stretch —
against the tables the tree actually ships.

**Measured by Task-297.** Every figure below is read off a named file and pinned by a
test in the suite; nothing here is read by the game, and nothing it measured was moved
in `src/data/`. `route-curve.md` carries the trainer curve in depth, `economy.md` the
catalogue, the shelves and the casino; this sheet is the one-page walk that ties them
to the ladder, and it reuses those two tables **by reference**, never by copy.

## What each column is read from

| column                      | read from                                                                                         | pinned by                      |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| badge, and the stretch      | `REGION_COUNTS` and the chain order (`src/data/region.ts`, `src/engine/region/plan.ts`)           | `src/engine/run/curve.test.ts` |
| cap                         | `BADGE_CAPS` / `badgeCap` (`src/data/region.ts`)                                                  | `src/engine/run/curve.test.ts` |
| gym city tier               | `CITY_TIERS` / `cityTierForBadge` (`src/data/region.ts`)                                          | `src/data/region.test.ts`      |
| main-route length (screens) | `planRouteLayout(...).screens.length` (`src/engine/region/route/layout.ts`)                       | `src/engine/run/curve.test.ts` |
| wild band                   | `WILD_LEVEL_FRACTION` / `wildLevel` (`src/data/wildLevels.ts`) at the stretch's entry squad level | `src/data/wildLevels.test.ts`  |
| party size at the leader    | `GYMS[*].partySize` through `gymLeaderFoe` (`src/data/gyms.ts`, `src/engine/run/badge.ts`)        | `src/engine/run/curve.test.ts` |
| trainer money per stretch   | `TRAINER_ARCHETYPES[*].money` × `TRAINER_MONEY_BAND_SCALE` (`src/data/trainers.ts`) × `T̄(s)`      | `src/engine/run/curve.test.ts` |
| TM / stall row              | `SHOP_TM` (`src/data/shop.ts`) and `GYMS[*].tmItemId` (`src/data/gyms.ts`)                        | `src/engine/run/curve.test.ts` |

The walk's three seeds are `curve-a`, `curve-b` and `curve-c`, fixed in
`src/engine/run/curve.test.ts`, so every figure on this sheet is reproducible; the
ladder itself (a badge's cap, its band, its distance to the gym) is seed-independent,
which that test asserts too.

## 1. The eight stretches

| badge | cap | city tier     | main route (screens) | wild band at entry | leader party | trainer money | TM / stall row                                                      |
| ----: | --: | ------------- | -------------------- | ------------------ | -----------: | ------------: | ------------------------------------------------------------------- |
|     1 |   9 | 1 — 50x50, 6  | 4 / 3 / 4            | 3–3 (entry 5)      |            3 |        357.75 | TM001–TM016 (one of 8, 3 000) · badge TM058                         |
|     2 |  16 | 1 — 50x50, 6  | 3 / 3 / 3            | 5–6 (entry 9)      |            6 |        497.83 | TM033–TM053 (one of 8, 3 000) · badge TM011                         |
|     3 |  23 | 2 — 70x70, 10 | 3 / 2 / 4            | 9–12 (entry 16)    |            6 |      1 044.75 | TM061–TM086 (one of 8, 3 000) · badge TM020                         |
|     4 |  30 | 2 — 70x70, 10 | 3 / 4 / 3            | 13–17 (entry 23)   |            6 |      1 491.25 | TM093–TM119 (one of 8, 3 000) · badge TM023                         |
|     5 |  37 | 2 — 70x70, 10 | 2 / 3 / 4            | 18–22 (entry 30)   |            6 |      2 087.50 | TM121–TM140 (one of 8, 3 000) · badge TM026 + 1 G-Max stone (8 000) |
|     6 |  43 | 3 — 90x90, 14 | 2 / 4 / 2            | 22–27 (entry 37)   |            6 |      3 180.00 | TM153–TM170 (one of 8, 3 000) · badge TM034 + 1 G-Max stone         |
|     7 |  49 | 3 — 90x90, 14 | 2 / 4 / 2            | 25–32 (entry 43)   |            6 |      3 180.00 | TM153–TM170 (one of 8, 3 000) · badge TM042 + 1 G-Max stone         |
|     8 |  55 | 3 — 90x90, 14 | 3 / 3 / 2            | 29–36 (entry 49)   |            6 |      2 981.25 | TM153–TM170 (one of 8, 3 000) · badge TM099 + 1 G-Max stone         |

- **Main route length** is the three seeds' screen counts in walk order (`curve-a`,
  `curve-b`, `curve-c`); a route is `ROUTE_HEIGHTS` — 120, 160 or 200 tiles for two,
  three or four 60x40 screens (`src/data/region.ts`) — so a stretch is never one
  screen and never more than four.
- **The wild band at entry** is `wildLevel`'s shipped 60–75 % share applied to the
  level the squad enters the stretch at: `5` (a fresh starter) on the first stretch,
  the previous cap on every later one. The value never exceeds the stretch's cap, and
  the clamp does not bite on these eight rows. A wild is a **live** draw, so the band
  climbs with the squad: read at the cap instead of at the entry, the eight rows are
  **5–6, 9–12, 13–17, 18–22, 22–27, 25–32, 29–36 and 33–41**. The first stretch's
  band collapses to one level because a level-5 squad's 60 % and 75 % both round
  down to 3.
- **The leader party** is what the gym fight fields: gym 1's fixed three
  (`geodude`, `machop`, `onix`), every later gym's six, all at `leaderLevel(cap)` —
  the cap itself. The gym's room-1 trainer is not counted here; it posts at
  `trainerLevel(cap, 0, size)`, the cap.
- **Trainer money** is the whole stretch's regular trainers beaten at the mean
  archetype: `T̄(s) × 119.25 / 149.35 / 208.95 / 298.25 / 417.50 / 596.25` for the six
  bands. The finale and the badge are **not** in this column — they are in §4's purse,
  because they are hand-placed and pay beyond the route.
- **The TM / stall row** is `SHOP_TM`'s row for the stretch's band, one of eight on
  the counter at 3 000, plus the machine the **badge** pays once
  (`GYMS[*].tmItemId`). The G-Max stone row appears from `late` on
  (`SHOP_GMAX_STONE_BANDS`, one of 34 at 8 000), so stretches 5–8 carry it and 1–4 do
  not.

## 2. The budget check

The rule the tree is solved against: **beating 75 % of a stretch's regular trainers
pays for that stretch's level cap.** The method is one line — the same test
`src/engine/run/curve.test.ts` runs: it plans every stretch's route through the
region's one carver, `planRouteScreens`, over `curve-a`, `curve-b` and `curve-c`,
reads the screens it plans and the trainers it posts on them (pinned as
`MEASURED_CARVE`), prices one at the stretch's band and its factor (`A(s)`, below), and
reads `fill = 0.75 × T̄(s) × A(s) / needed(s)`. The table below is the ladder's
**solve** — `T̄(s)` = 3.00-5.33 — while the carver posts 2-4 trainers a route
(`ROUTE_TRAINER_COUNT`), so its own fill is measured in that test as
`MEASURED_CARVER_FILL` and the population pass that closes the gap is §5's second row.

| badge | trainers per seed (rooms) | `T̄(s)` | factor |    `A(s)` | `0.75 × T̄ × A` | `needed(s)` | fill |
| ----: | ------------------------- | -----: | -----: | --------: | -------------: | ----------: | ---: |
|     1 | 4 (7), 2 (6), 3 (7)       |   3.00 |   1.00 |    335.38 |         754.59 |         604 | 1.25 |
|     2 | 3 (7), 3 (6), 4 (6)       |   3.33 |   1.09 |  1 528.75 |       3 821.88 |       3 367 | 1.14 |
|     3 | 4 (9), 6 (10), 5 (8)      |   5.00 |   1.07 |  2 876.75 |      10 787.81 |       8 071 | 1.34 |
|     4 | 6 (8), 4 (9), 5 (10)      |   5.00 |   1.00 |  4 944.00 |      18 540.00 |      14 833 | 1.25 |
|     5 | 5 (7), 5 (8), 5 (8)       |   5.00 |   0.94 |  7 409.63 |      27 786.09 |      23 653 | 1.17 |
|     6 | 6 (8), 5 (8), 5 (7)       |   5.33 |   0.80 |  7 639.43 |      30 557.71 |      28 854 | 1.06 |
|     7 | 6 (10), 4 (12), 6 (13)    |   5.33 |   1.09 | 11 972.00 |      47 888.00 |      38 142 | 1.26 |
|     8 | 5 (12), 5 (8), 5 (9)      |   5.00 |   1.31 | 16 265.14 |      60 994.29 |      48 726 | 1.25 |

- `needed(s)` is the XP the cap costs above the one the squad entered on:
  `xpForLevel(badgeCap(b)) − xpForLevel(badgeCap(b − 1))`, and the first stretch
  measures from a fresh starter's 5. The eight rows are 604, 3 367, 8 071, 14 833,
  23 653, 28 854, 38 142 and 48 726 — the whole campaign to 55 is `55³ = 166 375`.
- `A(s)` is what **one trainer** awards: `band.trainerSize` members at the stretch's
  own roster size, each worth `experienceAward(level, 1, true, factor)` averaged over
  the band's level window. The factor is the stretch's own row of
  `TRAINER_XP_PER_MAP`, so `A(s)` follows the factor and not the band alone.
- The window is **1.05 – 1.5**. Every row lands inside it, at about 1.25 by
  construction (stretch 6's 1.06 is the thinnest, stretch 3's 1.34 the widest), and
  `curve.test.ts` asserts the window and pins each fill to two decimals.
- The **finale is outside the rule**: the stretch's boss pays
  `experienceAward(cap, 1, true, factor)` per member (three on the first stretch, six
  on the rest), which is 3 276, 6 738, 14 064, 14 658, 12 456, 12 318, 19 128 and
  25 806 XP — 5.42x, 2.00x, 1.74x, 0.99x, 0.53x, 0.43x, 0.50x and 0.53x of that
  stretch's `needed`, before the mini-boss. It is injected on the route like the
  mini-boss, so it pays **on top of** the 75 % budget; folding it in would put seven
  of the eight rows past the window's ceiling — 6.67, 3.14, 3.08, 2.24, 1.70, 1.76 and
  1.78 on stretches 1–5, 7 and 8 — and stretch 6 at **1.49**, inside only because its
  boss surplus (0.43x) is the smallest of the eight. `route-curve.md` ("Exceptions")
  carries the full verdict.

## 3. The tower's ramp

Behind the Champion the region's **tower** (`tower:1`, `src/engine/region/tower.ts`)
runs the run's endless mode: every fight fields **five** members at `LEAGUE_LEVEL`
(60) — the party size is `TOWER_PARTY_SIZE` and the level is the row's own, never a
band draw. A fight's **rung** is `streak + 1`, so the first fight after the Champion
is rung 1 and every win steps the streak one rung up, never back:

| streak | rung | party | level | roster stream     | XP the fight pays |
| -----: | ---: | ----: | ----: | ----------------- | ----------------: |
|      0 |    1 |     5 |    60 | `${seed}:tower:1` |            17 910 |
|      1 |    2 |     5 |    60 | `${seed}:tower:2` |            17 910 |
|      2 |    3 |     5 |    60 | `${seed}:tower:3` |            17 910 |
|      3 |    4 |     5 |    60 | `${seed}:tower:4` |            17 910 |
|      4 |    5 |     5 |    60 | `${seed}:tower:5` |            17 910 |

The ramp is monotone and **flat on purpose**: the rung steps, the level does not, so a
fight pays `5 × experienceAward(60, 1, true, 1) = 5 × 3 582 = 17 910` XP at every
rung — a non-decreasing run of the same figure, which `curve.test.ts` asserts in
`xpForLevel` terms (the rung strictly rises, the XP never falls, `xpForLevel(60)` is
216 000 throughout). Each rung draws its roster off **its own** stream,
`${seed}:tower:<rung>` (`D60`), so a rung replays alone and appending one cannot move
an earlier one; the test rebuilds every rung's roster from that stream and compares.

## 4. The economy per city tier

A city's **tier** decides its square and its buildings (`CITY_TIERS`, §1's table);
the **band** decides what its Mart stocks. The two shelf tables — the band's stock
rows and the seeded counter one fixed seed opens with — live in `economy.md`
("The Mart's stock") and are **not** copied here; this is the tier's slice of them:

| tier | badges | city               | bands it spans        | Mart rows (per band, `economy.md` §"The Mart's stock")                                                                                                                  |
| ---: | ------ | ------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | 1–2    | 50x50, 6 buildings | `early`, `low`        | 10x Poke Ball 1 000 · Potion 300 → Super Potion 700 · 3 / 7 held rows at 100–200 · one of 8 TMs 3 000 · no G-Max                                                        |
|    2 | 3–5    | 70x70, 10          | `mid`, `high`, `late` | 10x Great Ball 3 000 → Ultra Ball 6 000 · Super 700 → Hyper 1 200 · 14 / 13 / 32 held rows at 200–4 000 · one of 8 TMs 3 000 · one of 34 G-Max stones 8 000 from `late` |
|    3 | 6–8    | 90x90, 14          | `end`                 | 10x Ultra Ball 6 000 · Full Restore 3 000 · 13 held rows at 200–4 000 · one of 8 TMs 3 000 · one of 34 G-Max stones 8 000                                               |

What a stretch **pays** against that shelf — the regular trainers of §1, plus its two
hand-placed fights and the badge, all at the mean roll:

| badge | band  | per trainer | trainers of the route |  boss | mini-boss | leader | stretch total | pack + rung | total ÷ (pack + rung) |
| ----: | ----- | ----------: | --------------------: | ----: | --------: | -----: | ------------: | ----------: | --------------------: |
|     1 | early |      119.25 |                357.75 |   720 |       240 |    158 |      1 475.75 |       1 300 |                  1.14 |
|     2 | low   |      149.35 |                497.83 |   900 |       300 |    184 |      1 881.83 |       1 700 |                  1.11 |
|     3 | mid   |      208.95 |              1 044.75 | 1 260 |       420 |    239 |      2 963.75 |       3 700 |                  0.80 |
|     4 | high  |      298.25 |              1 491.25 | 1 800 |       600 |    960 |      4 851.25 |       4 200 |                  1.16 |
|     5 | late  |      417.50 |              2 087.50 | 2 520 |       840 |    914 |      6 361.50 |       7 200 |                  0.88 |
|     6 | end   |      596.25 |              3 180.00 | 3 600 |     1 200 |  1 100 |      9 080.00 |       9 000 |                  1.01 |
|     7 | end   |      596.25 |              3 180.00 | 3 600 |     1 200 |    935 |      8 915.00 |       9 000 |                  0.99 |
|     8 | end   |      596.25 |              2 981.25 | 3 600 |     1 200 |  2 880 |     10 661.25 |       9 000 |                  1.18 |

- **The purse is every drop a stretch holds**: `T̄(s)` regular trainers at the mean
  archetype, the stretch boss at `BOSS_MONEY_MULTIPLIER` (3) times the `ace` roll, the
  mini-boss at 1, and the badge's own purse (the leader's borrowed archetype at the
  band scale, times the gym's `moneyMultiplier`). It is an expected value: a real
  stretch's drops jitter around it by each archetype's own band.
- **`pack + rung`** is the band's ten-ball pack plus its potion rung
  (`economy.md`'s shelf table): 1 300 / 1 700 / 3 700 / 4 200 / 7 200 / 9 000.
- The ratio stays between **0.80 and 1.18** on all eight rows: a whole stretch's purse
  buys its pack **and** its potion rung on five of them (1, 2, 4, 6 and 8) and falls
  short of the pair on the other three — stretch 3 by 736.25, stretch 5 by 838.50 and
  stretch 7 by 85 — so the shelf is a real choice and never a shopping trip. That is
  the tight trade-off `docs/region-spec.md` §7 asks for, and it holds with the finale
  counted, which is what `economy.md`'s trainer-only column deliberately does not do.
- The **G-Max stone** (8 000, from `late` on) is the exception that proves the
  column: stretch 5's whole purse (6 361.50) does not reach it, and stretches 6–8
  (8 915 … 10 661.25) buy exactly one. It is saved for across stretches, as
  `economy.md` records.
- **No cure and no X-item** is sold at any tier; those come from ground loot and the
  mini-boss reward alone (`economy.md`'s "No cure and no X-item is sold"). The
  city's own services, the Centre and the Mart, are `docs/region-spec.md` §6's.

## 5. Open rows

Numbers this walk found off the curve and **left alone**, with the path that would
have to move and the batch it belongs to. Each one is a road for the next pass, not a
verdict on the tree.

1. **A route node was drawn from a compat map index, not from its own cap.**
   *(Resolved by `Task-304`.)* The walk found that a scene-side compatibility helper —
   `compatForNode` — derived a floor index from the node's chain position, so `route:1`
   was sketched off the chain's second plan and `route:8` off the eighth's. The walk
   above prices stretch `b` off the plan whose **cap is** `badgeCap(b)` (asserted equal
   in `curve.test.ts`), which is the ladder's own. Measured cost: badge 1 would post
   the second plan's 3.33 trainers instead of 3.00, and its fill would read
   `0.75 × 3.33 × 335.38 / 604 = 1.39` — above the window's ceiling. **Resolved:**
   `Task-304` deleted the deprecated position fields and the helper with them, so a
   route node is carved off its own badge and the cost above is historical.
2. **The region's route places no trainers of its own.**
   `generateRoute` (`src/engine/region/route/map.ts`) passes no `trainerArchetypes`
   and `sketchRoute` posts none without them, while `planNodeContent(...).trainers`
   (`src/engine/region/content.ts`, 2–4 a route, `ROUTE_TRAINER_COUNT`) is read by no
   scene. Measured: the roll tops out at **four** trainers a route, under every
   stretch's 5.00–5.33 (§2) from the third on, so the region's own count cannot pay the
   ladder until the population pass prices it against the caps. **Move:** the route
   population pass and the ladder's budget together. **Owner:** the route population
   pass.
3. **`TRAINER_ROOMS_PER_MAP` still bounds the count.** The room generator's
   2/2/3/3/3/4/4/4 trainer rooms a map row (`src/data/population.ts`) are what actually
   caps how many trainers a stretch posts, and §2's budget is solved against them.
   **Move:** the same table, re-expressed per route. **Owner:** the route population
   pass.
4. **Two ladders hold the same eight caps.** `BADGE_CAPS` (`src/data/region.ts`) and
   `MAP_TUNING[*].cap` (`src/data/maps.ts`) both carry 9/16/23/30/37/43/49/55 and have
   to move as one; `curve.test.ts` pins the equality so a retune of either fails
   loudly, but the duplicate stays. **Move:** retire `MAP_TUNING[*].cap` behind the
   ladder. **Owner:** the data-close batch.
5. **`TRAINER_XP_PER_MAP` is still named and keyed as a map table.** Its eight rows
   are one per stretch now, and the call site hands `trainerXpMultiplierForMap` the
   node's **badge**, but the name and the parameter still read as a floor index.
   **Move:** `src/data/run.ts` and its call sites. **Owner:** the
   data-close batch.
6. **The tower's party size lives in engine code.** `src/engine/region/tower.ts`
   hard-codes `TOWER_PARTY_SIZE = 5`, and its own comment says the region's size table
   (`src/data/region.ts`) should hold it. **Move:** `src/data/region.ts` plus the
   reader. **Owner:** the region-data batch.
7. **Stretch 6 sits 0.01 above the window's lower edge.** Its fill is 1.06 against a
   1.05 edge and its factor (0.80) is the lowest row in the table, so the next
   room-content or density change in that stretch will push it under the window
   before any other row moves. Not off the curve today — **watch it**. **Owner:** the
   next balance pass.

## What would move this sheet

Retuning a cap (`BADGE_CAPS`), a band (`LEVEL_BANDS`), a factor
(`TRAINER_XP_PER_MAP`), a gym row (`GYMS`), a money table (`TRAINER_ARCHETYPES`,
`TRAINER_MONEY_BAND_SCALE`), a shelf (`SHOP_TM`) or the wild share
(`WILD_LEVEL_FRACTION`) moves a column here. The walk that produces §1 and §2 is
`src/engine/run/curve.test.ts` (three fixed seeds), the wild column is
`src/data/wildLevels.test.ts`, and §3 is the tower block of the same test: run
`npm test` and the sheets' tables are the numbers the test prints.

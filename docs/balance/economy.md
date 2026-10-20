# Economy

Phase 6 notes. **Prices live in `src/data/items.ts`** (`ItemDef.price`); this sheet
records the reasoning, not the numbers. The Mart's own tables live in
`src/data/shop.ts` and its model in `src/ui/shop.ts`.

**Re-measured (Task-09).** Every table below was re-walked against the shipped
tree: the prices are read from `src/data/items.ts`, the shelves from
`buildShop` (`src/ui/shop.ts`) at the fixed seed `src/ui/shop.test.ts` freezes
(`task-54:<band>`), the pools from `src/data/loot.ts` and the award from
`src/data/trainers.ts`. The walk **moved no number**: the pack stays value-neutral,
every shelf row stays at its catalogue price, no cure and no X-item is on the buy
list, and a floor's whole trainer money stays under two of that floor's own Mart
rows. What it did change is this sheet: the tier notes below had drifted from the
catalogue (the type items are 18, not 17, and the 4000-class held set reaches the
shelf at `mid`, not at `late`), and the trainer award was not recorded at all.

## Resources

- **Poké Dollars** are the run's only currency. A price of `0` means the economy
  never sells the item (the Master Ball, every Mega Stone); `isForSale` reads
  `price > 0`.
- **One capture per route** is a guaranteed resource, not something bought (D5:
  the economy must be able to replace a fallen Pokémon).
- **Selling** returns half the buy price, rounded down (`sellPrice`), except a
  **valuable**, which is pure treasure and sells for its whole listed price.
- **Money comes only from defeating trainers** (`docs/maps-spec.md` §7): a fixed
  base plus a jitter per archetype, scaled by the map's band. A fresh run starts
  with none.

## Prices

The catalogue as it stands. A row's price is what `buyPrice` charges and what
`sellPrice` halves (a valuable excepted).

| Item                            |              Price | Notes                                                              |
| ------------------------------- | -----------------: | ------------------------------------------------------------------ |
| Poke Ball / Premier Ball        |                200 | 1x capture; the Premier shares the rate and the price              |
| Great Ball                      |                600 | 1.5x catch bonus                                                   |
| Ultra Ball                      |               1200 | 2x catch bonus                                                     |
| Master Ball                     |                  0 | never sold                                                         |
| Potion                          |                300 | 20 HP                                                              |
| Super Potion                    |                700 | 60 HP                                                              |
| Hyper Potion                    |               1200 | 120 HP                                                             |
| Full Restore                    |               3000 | full HP + any status                                               |
| Antidote                        |                100 | poison, ground loot only                                           |
| Paralyze Heal                   |                200 | paralysis, ground loot only                                        |
| Awakening                       |                200 | sleep, ground loot only                                            |
| Burn Heal                       |                250 | burn, ground loot only                                             |
| Ice Heal                        |                250 | freeze, ground loot only                                           |
| Full Heal                       |                600 | any status, ground loot only                                       |
| X Attack / X Defense / X Speed  |     500 / 550 / 350 | +2 stages, ground loot only                                        |
| Type items (18x)                |               1000 | held, 1.2x to one type — one per type, Silk Scarf … Fairy Feather   |
| Leftovers                       |               4000 | held, strongest sustain                                            |
| Berries (Oran / Sitrus / Lum)   |      100 / 200 / 200 | held, single use                                                  |
| Competitive held set (122 rows) |           200 / 4000 | held: a dex berry 200, the rest 4000                                |
| Plates (17x)                    |               4000 | held, boss-tier treasure; retypes Judgment (D37)                   |
| Memories and Drives (21x)       |               3000 | held, ground-only treasure; retypes Multi-Attack / Techno Blast (D37) |
| Mega Stones                     |                  0 | never sold; held by a boss, a mini-boss or an `ace` (D34)          |
| G-Max Stones (34x)              |               8000 | held, late/end only: one on the counter and four/six on the ground |
| TMs (TM001–TM171)               |               3000 | reusable: it gates a move in the learnset panel, never spent       |
| Valuables (9x)                  |      1000 … 12000 | treasure: sells for its whole price, usable for nothing else       |

Balls are priced in step with their catch bonus (200 / 600 / 1200 for 1 / 1.5 /
2x), so a better ball is a real economy choice and not a strict upgrade you
always afford. The held tiers are the catalogue's own, and `items.test.ts` pins
them: a competitive row is `200` when the dex calls it a berry and `4000`
otherwise, while a Memory or a Drive is its own ground-only `3000` row.

## The Mart's stock

Four stock rows in a **fixed order**, then the band's one machine — five rows —
and, from `late` on, one **G-Max Stone** (`D44`), for six: `buildShop`
(`src/ui/shop.ts`) reads the tables in `src/data/shop.ts`. Rows 3 and 4 are the
two held rows the band's own weighted pool fills, drawn **without replacement**
from the seeded `Rng`, so which two a shelf shows is a property of the run's seed.

| Band  | Row 1 — ball pack      | Row 2 — potion rung  | Rows 3–4 — held pool                          | Row 5 — machine       | Row 6 — G-Max Stone   |
| ----- | ---------------------- | -------------------- | --------------------------------------------- | --------------------- | --------------------- |
| early | 10x Poke Ball — 1000   | Potion — 300         | 3 rows, all 100–200 (the cheap berries)        | one of 8 TMs — 3000   | —                     |
| low   | 10x Poke Ball — 1000   | Super Potion — 700   | 7 rows, all 100–200                            | one of 8 TMs — 3000   | —                     |
| mid   | 10x Great Ball — 3000  | Super Potion — 700   | 14 rows: 200 berries, 1000 type items, 4000 boosters | one of 8 TMs — 3000 | —                 |
| high  | 10x Great Ball — 3000  | Hyper Potion — 1200  | 13 rows: 200 berries, 1000 type items, 4000 boosters | one of 8 TMs — 3000 | —                 |
| late  | 10x Ultra Ball — 6000  | Hyper Potion — 1200  | 31 rows: 200 berries, 1000 type items, 4000 premium  | one of 8 TMs — 3000 | one of 34 — 8000 |
| end   | 10x Ultra Ball — 6000  | Full Restore — 3000  | 13 rows: 200 berries, 1000 type items, 4000 premium  | one of 8 TMs — 3000 | one of 34 — 8000 |

The rows one fixed seed opens with, per band — the shelves
`src/ui/shop.test.ts` freezes under the seed `task-54:<band>`, at the catalogue
prices above:

| Band  | Rows the counter shows                                                                         |
| ----- | ---------------------------------------------------------------------------------------------- |
| early | 10x Poke Ball — 1000, Potion — 300, Chesto Berry — 200, Cheri Berry — 200, TM001 Take Down — 3000 |
| low   | 10x Poke Ball — 1000, Super Potion — 700, Rawst Berry — 200, Oran Berry — 100, TM044 Dragon Tail — 3000 |
| mid   | 10x Great Ball — 3000, Super Potion — 700, Normal Gem — 4000, Iron Ball — 4000, TM067 Fire Punch — 3000 |
| high  | 10x Great Ball — 3000, Hyper Potion — 1200, Petaya Berry — 200, Expert Belt — 4000, TM110 Liquidation — 3000 |
| late  | 10x Ultra Ball — 6000, Hyper Potion — 1200, Colbur Berry — 200, Tanga Berry — 200, TM126 Thunderbolt — 3000, Duraludonite G — 8000 |
| end   | 10x Ultra Ball — 6000, Full Restore — 3000, Focus Band — 4000, Life Orb — 4000, TM156 Outrage — 3000, Meowthite G — 8000 |

- **The pack** is the band's own ball **in tens** at **half** the ten-unit
  catalogue sum (`buyPrice × 10 / 2`), snapped to a round hundred: Poke 1000, Great
  3000, Ultra 6000. `sellPrice` is also half the catalogue price, so a pack is
  **value-neutral at best** — Poke 1000 vs 10 × 100, Great 3000 vs 10 × 300, Ultra
  6000 vs 10 × 600 — and a pack bought and resold unit by unit never turns a profit
  (`src/data/shop.test.ts`, `src/ui/shop.test.ts`). The discount is deliberately not
  steep enough to open a buy-and-sell loop.
- **The potion rung** is the band's heal at the catalogue price, one rung per band
  or two: Potion (300) at early, Super Potion (700) at low/mid, Hyper Potion (1200)
  at high/late, Full Restore (3000) at end. A rung that beats a floor's damage is
  what makes money worth holding.
- **The two held rows** take the **catalogue price with no per-band markup**, so
  the tiers are the catalogue's own: the cheap berries (100–200) at early and low,
  then the 1000-class type items and the 4000-class competitive boosters together
  from `mid` on — Wide Lens, Muscle Band, Wise Glasses, Normal Gem, Iron Ball and
  Lagging Tail at `mid`, Expert Belt, Scope Lens and Razor Claw at `high` — while
  the **premium** 4000-class pieces (Leftovers, the Choice set, Life Orb, the
  Sashes, the Orbs) wait for `late`, and the 18 resist berries arrive with them. A
  `mid` floor's whole money (≈ 2 500) buys the pack and the rung rather than one of
  its 4000-class rows; that is accepted, because the row is a two-of-fourteen draw
  and the premium rows still wait for `late`.
- **No cure and no X-item is sold.** Every `kind: 'status'` item (Antidote,
  Paralyze Heal, Full Heal, …) and every `kind: 'boost'` item (X Attack, X Defense,
  X Speed) has left the buy list, so a cure or a booster reaches a run from the
  **ground loot** and the **mini-boss reward** alone (`src/data/loot.ts`). The Mart
  still buys them from the bag side: a cure picked up on the ground sells at
  `sellPrice`.
- **The machine** (Task-22) is appended last: the band's one TM off `SHOP_TM` at the
  catalogue 3000, undiscounted, because a slot priced below `sellPrice` would be a
  money loop. It is the reason the counter shows five rows and not four.
- **The G-Max Stone row** (`D44`) comes after the machine, and only at `late` and
  `end` (`SHOP_GMAX_STONE_BANDS`): one of the 34 stones at the catalogue 8 000,
  `count: 1`, drawn from `GMAX_STONE_IDS` on the same seeded `Rng`. It is a real
  sink — a `late` floor's whole money (≈ 5 148) does not buy it and an `end` floor's
  (≈ 8 747 … 10 333) buys one — so a stone is saved for across floors. It is never a
  duplicate of a row already on the shelf: the held pool holds no stone, exactly as
  it holds no Mega Stone. `sellPrice` halves it to 4 000, so buying and reselling a
  stone loses 4 000 and opens no money loop.
- The stock is rolled **once per map** from the run seed
  (`${seed}:shop:${mapIndex}`) and never saved, so a Mart always reopens the same.

## The trainer award

A beaten trainer drops `money.base + rng.int(0, money.jitter)`, multiplied by the
map's band scale (`TRAINER_MONEY_BAND_SCALE`). The ten archetypes are unchanged by
this pass:

| Archetype                 | Award (base + jitter) |
| ------------------------- | --------------------- |
| Youngster / Lass          | 60 + 30 / 70 + 30     |
| Bug Catcher               | 50 + 25               |
| Hiker                     | 90 + 40               |
| Camper / Picnicker        | 80 + 35 / 80 + 35     |
| Fisher                    | 100 + 45              |
| Psychic                   | 120 + 50              |
| Black Belt                | 130 + 55              |
| Ace Trainer               | 200 + 80              |

The band scale rounds each archetype's base and jitter **before** the roll
(`trainerMoney`, `src/engine/run/reward.ts`), so one drop is
`round(base × scale) + rng.int(0, round(jitter × scale))` — an integer, and the
mean over the ten archetypes is `round(base × scale) + round(jitter × scale) / 2`
averaged over them. Read against the floor's own density (`T̄(m)` from
`route-curve.md`) and its own Mart:

| Band (map) | Scale | Mean award per trainer | One drop ranges | Floor total `T̄(m) × award` | Pack + rung | Floor / (pack + rung) |
| ---------- | ----: | ---------------------: | --------------: | -------------------------: | ----------: | --------------------: |
| early (1)  |     1 |                 119.25 |       50 … 280  |                       ≈ 676 |   1000 + 300 |                  0.52 |
| low (2)    |  1.25 |                 149.35 |       63 … 350  |                       ≈ 945 |   1000 + 700 |                  0.56 |
| mid (3)    |  1.75 |                 208.95 |       88 … 490  |                      ≈ 2507 |   3000 + 700 |                  0.68 |
| high (4)   |   2.5 |                 298.25 |      125 … 700  |                      ≈ 3877 |  3000 + 1200 |                  0.92 |
| late (5)   |   3.5 |                 417.50 |      175 … 980  |                      ≈ 5148 |  6000 + 1200 |                  0.71 |
| end (6)    |     5 |                 596.25 |     250 … 1400  |                      ≈ 8747 |  6000 + 3000 |                  0.97 |
| end (7)    |     5 |                 596.25 |     250 … 1400  |                      ≈ 8747 |  6000 + 3000 |                  0.97 |
| end (8)    |     5 |                 596.25 |     250 … 1400  |                     ≈ 10333 |  6000 + 3000 |                  1.15 |

A **boss** pays `BOSS_MONEY_MULTIPLIER` (3) times the same roll, so the finale is
the floor's single richest drop; a mini-boss pays the ordinary award.

The floor total is the **whole** floor's money — every trainer on it beaten, at the
mean archetype, with `T̄(m)` the same three-seed average `route-curve.md` records,
so a density change re-solves both sheets. Re-measured, the ratio stays **under
two** on every floor (0.52 … 1.15): a floor's money buys its pack *or* its rung,
rarely both, which is the tight Isaac-style trade-off `docs/maps-spec.md` §7 asks
for. No archetype award and no band scale moved in this pass.

## Between-route rewards

Between-route rewards ship as **ground items**: each route's optional pockets hold
items drawn from `ROUTE_LOOT[band.id].pool` (`src/data/loot.ts`), placed by the
route sketch and picked up with the interact key — Potions and Poke Balls early,
then Super/Hyper Potions, Great/Ultra Balls, the held items the battle engine
models, the valuables and the odd TM as the bands climb. A beaten **mini-boss**
offers a choice of three items from that same pool. The Mart is the run's
**currency sink**: the money a trainer drops buys the pack, the rung and the held
rows above, and the valuables are the way to cash the bag out. No Revive anywhere
(D5).

The pools, re-measured (the hidden and item chances are pinned by
`src/data/loot.test.ts`; the counts are the pools as they stand):

| Band  | `hiddenChance` | `itemChance` | Rows | Composition                                                              |
| ----- | -------------: | -----------: | ---: | ------------------------------------------------------------------------ |
| early |           0.35 |          0.5 |    5 | 1 ball, 1 heal, 1 cure, 1 valuable, 1 TM                                   |
| low   |           0.35 |          0.6 |    7 | 1 ball, 2 heal, 1 cure, 2 valuable, 1 TM                                   |
| mid   |            0.4 |         0.75 |   39 | 1 ball, 2 heal, 1 cure, 1 X-item, 3 valuable, 2 TM, 29 held (74 %)        |
| high  |            0.4 |         0.75 |   45 | 1 ball, 2 heal, 1 cure, 1 X-item, 3 valuable, 2 TM, 35 held (78 %)        |
| late  |           0.45 |         0.75 |   40 | 1 ball, 2 heal, 1 cure, 1 X-item, 3 valuable, 2 TM, 26 held, 4 G-Max Stones (75 %) |
| end   |           0.45 |         0.75 |   57 | 1 ball, 2 heal, 1 cure, 1 X-item, 3 valuable, 2 TM, 41 held, 6 G-Max Stones (82 %) |

The hidden chance rises with the band and never falls (0.35 → 0.45), the two
on-ramp floors keep the thinned `itemChance` (0.5 and 0.6) the population pass
shipped (`O-M5`), and the held share climbs from **none** on the two on-ramp bands
to 72–82 % from `mid` on: the Plates are `late`/`end` treasure only, every
unmodelled id reaches a run from the ground alone and never from the Mart (`D16`),
every competitive held row is reachable from the ground or the counter, and the
**G-Max Stones** (`D44`) are ground treasure at `late`/`end` alone — four ids at
`late`, six at `end`, weight 1 each (`GMAX_STONE_LOOT`) — with the other 24 stones
reachable from the Mart's one-stone row at those two bands and nowhere else.

## The casino's spin

The slot machine (`docs/maps-spec.md` §7, `src/data/casino.ts`, `src/ui/casino.ts`)
takes one price per band and pays a prize on 85 % of the spins; the other 15 % are
the grunt fight (`CASINO.battleChance`). One row of every band is the **grouped
equipable**, weight 1, whose id is drawn from the band's own `SHOP_ROTATION` shelf
(`casinoHeldPool`) instead of naming an item, so there is no second held table to
keep in step with the Mart.

| Band  | Price | Rows | Total | Grouped share | Recovery |
| ----- | ----: | ---: | ----: | ------------: | -------: |
| early |   300 |    5 |    12 |          7.1 % |     63 % |
| low   |   700 |    6 |    13 |          6.5 % |  ≈ 90 %  |
| mid   |  1000 |    5 |     9 |          9.4 % |  ≈ 91 %  |
| high  |  1500 |    5 |     7 |         12.1 % |     75 % |
| late  |  2000 |    5 |     8 |         10.6 % |     88 % |
| end   |  2500 |    5 |     8 |         10.6 % |     71 % |

The **grouped share** is the absolute chance of an equipable on a pressed spin:
`(1 − battleChance) × weight / total`, the same shape as every other row's share, so
the Egg (one weight of each band's total too) keeps the same absolute chance. The
equipable's id is the spin stream's **last** draw over that band's shelf, so no other
outcome's numbers move.

**Recovery** is the share of the price a spin returns on average: the resale value of
the prize it pays, plus the grunt's purse on the 15 % of spins that become the fight.
The two bands that sat over break-even with the grouped row folded in — `low` and
`mid` — ship **diluted**: their heal and ball rungs carry four and three weights (13
and 9 total), so the machine stays a currency sink. `early`, `high`, `late` and `end`
keep the weights the row measured first. The two on-ramp bands draw `mid`'s shelf
because their own shelf is berry-only, which the recovery column already counts.

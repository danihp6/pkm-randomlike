# Economy

Phase 6 notes. **Prices live in `src/data/items.ts`** (`ItemDef.price`); this sheet
records the reasoning, not the numbers. The Mart's own tables live in
`src/data/shop.ts` and its model in `src/ui/shop.ts`.

## Resources

- **Poké Dollars** are the run's only currency. A price of `0` means the economy
  never sells the item (the Master Ball); `isForSale` reads `price > 0`.
- **One capture per route** is a guaranteed resource, not something bought (D5:
  the economy must be able to replace a fallen Pokémon).
- **Selling** returns half the buy price, rounded down (`sellPrice`), except a
  **valuable**, which is pure treasure and sells for its whole listed price.

## Prices

| Item | Price | Notes |
| --- | ---: | --- |
| Poke Ball | 200 | baseline capture |
| Great Ball | 600 | 1.5x catch bonus |
| Ultra Ball | 1200 | 2x catch bonus |
| Master Ball | — | never sold |
| Potion | 300 | 20 HP |
| Super Potion | 700 | 60 HP |
| Hyper Potion | 1200 | 120 HP |
| Full Restore | 3000 | full HP + any status |
| Antidote | 100 | poison, ground loot only |
| Paralyze Heal | 200 | paralysis, ground loot only |
| Awakening | 200 | sleep, ground loot only |
| Burn Heal | 250 | burn, ground loot only |
| Ice Heal | 250 | freeze, ground loot only |
| Full Heal | 600 | any status, ground loot only |
| X Attack / X Defense / X Speed | 500 / 550 / 350 | +2 stages, ground loot only |
| Leftovers | 4000 | held, strongest sustain |
| Berries (Oran / Sitrus / Lum) | 100 / 200 / 200 | held, single use |
| Type items (17x) | 1000 | held, 1.2x to one type |

Balls are priced in step with their catch bonus (200 / 600 / 1200 for 1 / 1.5 /
2x), so a better ball is a real economy choice and not a strict upgrade you
always afford.

## The Mart's stock

Four stock rows in a **fixed order**, then the band's one machine: `buildShop`
(`src/ui/shop.ts`) reads the tables in `src/data/shop.ts`.

| Band | Row 1 — ball pack | Row 2 — potion rung | Rows 3–4 — two held rows from `SHOP_ROTATION` |
| --- | --- | --- | --- |
| early | 10x Poke Ball — 1000 | Potion — 300 | the cheap berries: Oran / Cheri / Chesto Berry |
| low | 10x Poke Ball — 1000 | Super Potion — 700 | Oran and Sitrus plus the five status berries |
| mid | 10x Great Ball — 3000 | Super Potion — 700 | the 1000-class type items, Wide Lens / Muscle Band / Wise Glasses, Iron Ball / Lagging Tail, the 1/3-HP berries |
| high | 10x Great Ball — 3000 | Hyper Potion — 1200 | the 1000-class type items, Expert Belt, Scope Lens / Razor Claw, the pinch berries, Lum / Sitrus |
| late | 10x Ultra Ball — 6000 | Hyper Potion — 1200 | Leftovers, the Choice set, Life Orb, the Sashes, the Orbs and the 18 resist berries |
| end | 10x Ultra Ball — 6000 | Full Restore — 3000 | Leftovers, the Choice set, Life Orb, the Sashes, the Orbs and Dragon Fang / Metal Coat / Sharp Beak |

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
- **The two held rows** take the **catalogue price with no per-band markup**. The
  tiers are the catalogue's own: the cheap berries (100–200) at early/low, the
  1000-class utility and the 1/3-HP berries at mid, the Expert Belt, the pinch
  berries, the Sashes and Lum at high, and the 4000-class pieces (Leftovers, the
  Choice set, Life Orb) from late on, with the resist berries at late. Cheap berry
  rows on the early floors are accepted: the intent holds from `mid` on, where the
  1000-class and then the 4000-class held items enter the pools.
- **No cure and no X-item is sold.** Every `kind: 'status'` item (Antidote,
  Paralyze Heal, Full Heal, …) and every `kind: 'boost'` item (X Attack, X Defense,
  X Speed) has left the buy list, so a cure or a booster reaches a run from the
  **ground loot** and the **mini-boss reward** alone (`src/data/loot.ts`). The Mart
  still sells them from the bag side: a cure picked up on the ground sells at
  `sellPrice`.
- **The machine** (Task-22) is appended last: the band's one TM off `SHOP_TM` at the
  catalogue 3000, undiscounted, because a slot priced below `sellPrice` would be a
  money loop. It is the reason the counter shows five rows and not four.
- The stock is rolled **once per map** from the run seed
  (`${seed}:shop:${mapIndex}`) and never saved, so a Mart always reopens the same.

## Between-route rewards

Between-route rewards ship as **ground items**: each route's optional pockets hold
items drawn from `ROUTE_LOOT[band.id].pool` (`src/data/loot.ts`), placed by the
route sketch and picked up with the interact key — Potions and Poke Balls early,
then Super/Hyper Potions, Great/Ultra Balls, the held items the battle engine
models, the valuables and the odd TM as the bands climb. A beaten **mini-boss**
offers a choice of three items from that same pool. The Mart is the run's
**currency sink**: the money a trainer drops (`src/data/trainers.ts`) buys the
pack, the rung and the held rows above, and the valuables are the way to cash the
bag out. No Revive anywhere (D5).

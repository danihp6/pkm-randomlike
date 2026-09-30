# Economy

Phase 6 notes. **Prices live in `src/data/items.ts`** (`ItemDef.price`); this sheet
records the reasoning, not the numbers.

## Resources

- **Poké Dollars** are the run's only currency. A price of `0` means the economy
  never sells the item (the Master Ball); `isForSale` reads `price > 0`.
- **One capture per route** is a guaranteed resource, not something bought (D5:
  the economy must be able to replace a fallen Pokémon).
- **Selling** returns half the buy price, rounded down (`sellPrice`).

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
| Antidote | 100 | poison |
| Paralyze Heal | 200 | paralysis |
| Awakening | 200 | sleep |
| Burn Heal | 250 | burn |
| Ice Heal | 250 | freeze |
| Full Heal | 600 | any status |
| X Attack / X Defense / X Speed | 500 / 550 / 350 | +2 stages |
| Leftovers | 4000 | held, strongest sustain |
| Berries (Oran / Sitrus / Lum) | 100 / 200 / 200 | held, single use |
| Type items (17x) | 1000 | held, 1.2x to one type |

Balls are priced in step with their catch bonus (200 / 600 / 1200 for 1 / 1.5 /
2x), so a better ball is a real economy choice and not a strict upgrade you
always afford.

## Between-route rewards

The reward is **ground items, like the classic games**: each route scatters a
band-scaled set of items on the floor and walking over one adds it to the bag.
`src/data/loot.ts` holds the per-band `count` and weighted pool; the route
generator draws positions *and* contents from the route `Rng`, so `(seed,
routeIndex)` fixes the loot (D11). There is no shop and no currency sink yet;
the early bands lean on Potions and Poke Balls, the late bands on Hyper Potions,
Ultra Balls and held items. No Revive anywhere (D5).

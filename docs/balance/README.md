# Balance sheets

Spreadsheets and coverage tables for tuning. These are **notes, not data**: the
numbers that matter live in `src/data/*`, and nothing here is read by the game.

- `effect-coverage.md` — Phase 4: every battle ability and item marked
  `port | no-op | excluded`, so "Gen 9 complete" is a claim the table backs up
  (`D16` in `docs/tech-decisions.md`).
- `route-curve.md` — Phase 6: level bands, level caps, roster sizes, the trainers a
  floor places and the trainer XP rule that pays for the cap.
- `economy.md` — Phase 6: catch rates, ball/consumable prices, the Mart's shelves,
  the trainer award and between-route rewards.

When a sheet disagrees with the game, retune `src/data/`, not this folder.

## Re-measuring a sheet

A sheet is only worth its measurement, so each one names where its numbers come
from and how to re-read them:

- **`route-curve.md`** is read off `src/data/run.ts` (`LEVEL_BANDS`),
  `src/data/maps.ts` (`levelCapForMap`) and the walk in
  `src/engine/run/curve.test.ts` — the one that rebuilds every room of every finite
  map the way `RouteScene` does, over its three fixed seeds. Change a band, a cap or
  a population table, run `npm test`, and the test's `T̄(m)`, `A(m)` and fill are the
  numbers the sheet has to carry.
- **`economy.md`** is read off `src/data/items.ts` (prices), `src/data/shop.ts`
  (the stock tables), `buildShop` (`src/ui/shop.ts`) at the fixed seed
  `src/ui/shop.test.ts` freezes, `src/data/trainers.ts` (the award) and
  `src/data/loot.ts` (the ground pools).
- **`effect-coverage.md`** is generated: run `npm run docs:coverage`.

Task-09 re-measured `route-curve.md` and `economy.md` against the shipped tree and
moved no number in `src/data/`; both sheets record what the walk found.

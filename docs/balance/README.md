# Balance sheets

Spreadsheets and coverage tables for tuning. These are **notes, not data**: the
numbers that matter live in `src/data/*`, and nothing here is read by the game.

- `effect-coverage.md` — Phase 4: every battle ability and item marked
  `port | no-op | excluded`, so "Gen 9 complete" is a claim the table backs up
  (`D16` in `docs/tech-decisions.md`).
- `campaign.md` — the region's one-page campaign walk: the eight badge stretches end
  to end (cap, city tier, main-route screens, wild band, leader party, money and
  machine per stretch), the 75 % trainer budget against each cap, the tower's ramp,
  the economy per city tier, and the open rows this pass was not allowed to move.
- `route-curve.md` — the trainer curve in depth: level bands, per-stretch caps,
  the trainers a stretch posts and the trainer XP rule that pays for the cap.
- `economy.md` — the catalogue: catch rates, ball/consumable prices, the Mart's
  shelves, the trainer award and between-route rewards.

When a sheet disagrees with the game, retune `src/data/`, not this folder.

## Re-measuring a sheet

A sheet is only worth its measurement, so each one names where its numbers come
from and how to re-read them:

- **`campaign.md`** is read off `src/data/region.ts` (`REGION_COUNTS`, `CITY_TIERS`,
  `BADGE_CAPS`, `badgeCap`), the plan (`src/engine/region/plan.ts`), the route layout
  (`src/engine/region/route/layout.ts`), `src/data/wildLevels.ts`, `src/data/gyms.ts`,
  `src/data/trainers.ts`, `src/data/shop.ts` and the tower
  (`src/engine/region/tower.ts`). Its three walk seeds (`curve-a`, `curve-b`,
  `curve-c`) and every figure are pinned by `src/engine/run/curve.test.ts` (the
  stretch walk, the budget, the money and the tower's ramp) and
  `src/data/wildLevels.test.ts` (the eight wild bands). Run `npm test` and the
  table's columns are the numbers those tests print; its open rows name the paths a
  later pass has to move.
- **`route-curve.md`** is read off `src/data/run.ts` (`LEVEL_BANDS`,
  `TRAINER_XP_PER_MAP`), `src/data/region.ts` (`BADGE_CAPS`) and the walk in
  `src/engine/run/curve.test.ts` — the one that rebuilds every room of every
  stretch's route the way `RouteScene` does, over its three fixed seeds. Change a
  band, a cap or a population table, run `npm test`, and the test's `T̄(s)`, `A(s)`
  and fill are the numbers the sheet has to carry.
- **`economy.md`** is read off `src/data/items.ts` (prices), `src/data/shop.ts`
  (the stock tables), `buildShop` (`src/ui/shop.ts`) at the fixed seed
  `src/ui/shop.test.ts` freezes, `src/data/trainers.ts` (the award),
  `src/data/loot.ts` (the ground pools) and `src/data/casino.ts` (the machine). Its
  stretch totals reuse `route-curve.md`'s `T̄(s)`, so a density change re-solves
  both.
- **`effect-coverage.md`** is generated: run `npm run docs:coverage`.

Task-09 re-measured `route-curve.md` and `economy.md` against the shipped tree and
moved no number in `src/data/`; both sheets record what the walk found. Task-297
re-walked them in the region's vocabulary, carried the eight stretches' walk into
`campaign.md`, corrected the columns that had drifted, and again moved no number in
`src/data/`.

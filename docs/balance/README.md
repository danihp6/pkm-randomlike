# Balance sheets

Spreadsheets and coverage tables for tuning. These are **notes, not data**: the
numbers that matter live in `src/data/*`, and nothing here is read by the game.

- `effect-coverage.md` — Phase 4: every battle ability and item marked
  `port | no-op | excluded`, so "Gen 9 complete" is a claim the table backs up
  (`D16` in `docs/tech-decisions.md`).
- `route-curve.md` — Phase 6: level bands, level caps, roster sizes, the trainers a
  floor places and the trainer XP rule that pays for the cap.
- `economy.md` — Phase 6: catch rates, ball/consumable prices and between-route
  rewards.

When a sheet disagrees with the game, retune `src/data/`, not this folder.

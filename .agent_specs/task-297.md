# Spec: Task-297 — The campaign's numbers are measured once, end to end

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** docs + balance measurement + regression pins. **No new behaviour.**
- **Role:** Dev.
- **Objective:** the region's campaign gets **one measured sheet**,
  `docs/balance/campaign.md`, that walks the eight badge stretches end to end — cap,
  distance, party size, wild band, money and TM per stretch — against the tables the
  tree actually ships, and the two older sheets (`route-curve.md`, `economy.md`) stop
  describing an eight-floor campaign and describe the region. The seeds those sheets
  rest on are **re-pinned** in `src/engine/run/curve.test.ts`,
  `src/engine/run/roster.test.ts` and `src/data/wildLevels.ts` + its test, and every
  stretch's trainer budget and the tower's ramp get a fixed-seed assertion.
- **Environment:** worktree `../wt-pkm-297`, branch `task-297`.
- **Dependencies (already merged on `main`):** the region plan at its real scale
  (`planRegion`, `REGION_COUNTS`, `CITY_TIERS` in `src/data/region.ts`, `BADGE_CAPS`
  and `badgeCap` in `src/data/region.ts`), the badge curve (`src/engine/run/levelCurve.ts`),
  the tower (`src/engine/region/tower.ts`), the shipped sheets in `docs/balance/`.

### Exclusive paths (single writer)

- `docs/balance/campaign.md` (new)
- `docs/balance/route-curve.md`
- `docs/balance/economy.md`
- `docs/balance/README.md`
- `src/engine/run/curve.test.ts`
- `src/engine/run/roster.test.ts`
- `src/data/wildLevels.ts`
- `src/data/wildLevels.test.ts`

**Hard rule for this task:** if a measurement shows a number outside this list is off
the curve (a `src/data/` table, the plan's arithmetic, a trainer budget), **do not move
it** — record the finding as an open row in `docs/balance/campaign.md` and name it in
your final report. Moving it would collide with a batch-mate's paths.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1 (the frozen counts), §3 (the badge ladder and the caps),
  §7.6 (the League), §7.11 (the tower).
- `docs/design-spec.md` §7 (missions/economy are per node).
- `src/data/region.ts` (`REGION_COUNTS`, `CITY_TIERS`, `BADGE_CAPS`, `badgeCap`,
  `cityTierForBadge`), `src/data/run.ts` (`LEVEL_BANDS`, `TRAINER_XP_PER_MAP`,
  `trainerXpMultiplierForMap`), `src/data/gyms.ts`, `src/data/league.ts`,
  `src/data/shop.ts`, `src/data/items.ts`, `src/data/trainers.ts`, `src/data/loot.ts`,
  `src/data/wildLevels.ts`.
- `src/engine/run/curve.test.ts`, `src/engine/run/roster.test.ts`,
  `src/engine/run/levelCurve.ts` (`bandForNode`, `wildLevel`, `wildLevelAt`),
  `src/engine/region/plan.ts`, `src/engine/region/tower.ts`,
  `src/engine/region/league.ts`.

## 🔒 Contract

### `docs/balance/campaign.md` (new)

The region's campaign sheet. It must carry, and nothing measured may be left out:

1. **The eight-stretch table**, one row per badge 1-8, with these columns read from the
   tree (name the file each column comes from): `badge | cap | gym city tier |
   main-route length (screens) | wild band (min-max level) | party size at the leader |
   trainer money per stretch | TM/stall row`.
   `cap` is `badgeCap(badge)`; the wild band is `wildLevel`'s 60-75 % share applied to
   the stretch's entry squad level and clamped to the cap; the trainer budget is
   `trainerRoster`'s band and `trainerXp` arithmetic the sheet shows, not guesses.
2. **The budget check.** For each stretch, the XP its trainers pay against the XP the
   cap costs (`xpForLevel`), with the fill figure the check computes. State the method
   in one line: the same simulation `curve.test.ts` runs.
3. **The tower's ramp**: five foes at `LEAGUE_LEVEL` (60), monotone streak, and the
   per-rung stream `${seed}:tower:<rung>`.
4. **The economy per city tier**: shelf rows at each tier and the money a stretch pays
   against them, with the two `economy.md` tables it reuses by reference, not copy.
5. **An open-rows section** listing every number this walk found off the curve **and
   left alone**, with the path that would have to move and the batch it belongs to.

### `docs/balance/route-curve.md` and `docs/balance/economy.md`

Re-walk them in the region's vocabulary: no "floor", no "map N", no room model as live
behaviour. Keep their measured tables and their method notes; correct every figure the
walk disagrees with. Each sheet ends with a dated paragraph naming this task, the seeds
it reads and the fact that nothing it measured moved in `src/data/`.

### `docs/balance/README.md`

Add `campaign.md` to the list of sheets, one line in the folder's own voice, and its
"re-measuring" entry (which files it is read off).

### `src/data/wildLevels.ts` and `src/data/wildLevels.test.ts`

The wild band is the shipped `WILD_LEVEL_FRACTION` (0.6-0.75). Measure it against the
region: `wildLevel`'s clamping and flooring must be pinned for the eight stretches'
caps, and the values the sheet prints must be the ones this module returns. If the walk
shows the fraction is right, **do not change it**; if it shows a number is off, change
only this module's constant and re-pin its test. Either way, add the eight-stretch
regression block (one fixed seed per stretch) to `wildLevels.test.ts`.

### `src/engine/run/curve.test.ts` and `src/engine/run/roster.test.ts`

- `curve.test.ts`: keep its three fixed seeds (`curve-a`, `curve-b`, `curve-c`) and make
  the walk the **region's** — eight stretches, `badgeCap` per stretch, the trainer
  budget per stretch — instead of the eight-floor map walk. Add `[unit]`-grade
  assertions: every stretch's budget is finite and the fill lands inside the sheet's
  window, and the tower's ramp is monotone in `xpForLevel` terms.
- `roster.test.ts`: re-pin the fixed-seed roster snapshots to the region's bands and
  node caps (`bandForNode`), keeping the existing determinism tests. A re-pin means the
  expected values are recomputed from the tree and asserted, never loosened to
  `toBeGreaterThan`.

Both files keep their current public assertions where they still hold; a deleted
assertion needs a line in your report saying why.

## 📣 Coordination

- For the next batch: `campaign.md`'s open-rows section is the backlog of numbers this
  pass was not allowed to move; the sweep and the docs-close task read it.
- For the QA: nothing in this task may change gameplay. A diff that touches a
  non-exclusive `src/` path is a failure — the measurement is the deliverable.

## 🧪 Test and Validation Plan (for QA)

- **Method:** `npm test`, `npm run build`, `git diff --name-only main...task-297` audited
  against the exclusive paths. **No browser pass is owed** (every criterion is `[unit]`).
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The whole suite is green with the re-pinned seeds (`npm test`).
  - [ ] `[unit]` `curve.test.ts` proves every stretch's trainer budget clears its cap on
    the simulated party and that the tower's ramp is monotone; `grep -n "floor"
    docs/balance/campaign.md` finds no live floor reference (the word may appear only in
    a "replaces" sentence naming what died).
  - [ ] `[unit]` `campaign.md` carries the five blocks above: the eight-stretch table
    with every column named, the budget check with its method line, the tower ramp, the
    economy per tier, and the open-rows section (which may say "none").
  - [ ] `[unit]` Every number `campaign.md` prints is one the suite computes: pick three
    cells at random and trace each to the named source file and the test that pins it.
  - [ ] `[unit]` `docs/balance/README.md` lists `campaign.md` and how to re-measure it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
- **No `[live]` criterion:** this task ships no screen and moves no rule.

## ⛔ Out of scope

- No new `src/` module, no new dependency, no save change, no scene.
- No moving a number outside the exclusive paths — record it instead.
- Do not rewrite `docs/region-spec.md` or `docs/design-spec.md`; the docs-close task
  owns them.

# Spec: Task-83 — the XP curve is re-solved against the new floor budgets

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + balance solve + one optional engine parameter.
- **Role:** Dev.
- **Objective:** the trainer XP award becomes a function of **the floor the squad is
  standing on**, not only of the defeated Pokémon's level band. After this task,
  `src/data/run.ts` carries `TRAINER_XP_PER_MAP` — eight two-decimal factors, one per
  finite map — and `trainerXpMultiplierForMap(mapIndex)`; `experienceAward` takes it as
  a **fourth, defaulted** argument so every existing call site is unchanged; the battle
  fold (`resolveBattle`) passes the floor's factor; and `src/engine/run/curve.test.ts`
  proves, over its three fixed seeds, that **75 % of every floor's trainers pays that
  floor's cap** — every one of the eight floors inside the rule's `1.05 – 1.5` window,
  with no shared-band exception left. `docs/balance/route-curve.md` records the measured
  walk and `docs/battle-spec.md` §7 records the rule.
- **Environment:** worktree `../wt-pkm-83`, branch `task-83` (already created and pushed
  with this spec as its first commit).
- **Dependencies (all merged on `main`):**
  - `[Task-78]` — the trainer's level is a percentage of the live squad level
    (`src/data/trainerLevels.ts`, `src/engine/run/roster.ts`).
  - `[Task-79]` — a wild encounter's level is a fraction of the squad level
    (`src/engine/run/encounters.ts`).
  - `[Task-80]` — `MAP_TUNING` keeps only the cap (`src/data/maps.ts`,
    `src/engine/run/floors.ts`).
  - `[Task-82]` — a floor holds a fixed number of trainer rooms
    (`src/engine/maps/plan.ts`, `TRAINER_ROOMS_PER_MAP`).
  - `[Task-81]`, `[Task-65]`, `[Task-111]` — the room-size rule, the gated leaf and the
    room descriptors the walk in `curve.test.ts` already rebuilds.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/data/run.ts`
- `src/data/run.test.ts`
- `src/engine/run/progression.ts`
- `src/engine/run/progression.test.ts`
- `src/engine/run/resolve.ts`
- `src/engine/run/resolve.test.ts`
- `src/engine/run/curve.test.ts`
- `docs/balance/route-curve.md`
- `docs/battle-spec.md` — **§7 only**, the one `experienceAward` bullet (see
  “Contract → Docs”). No other section of that file may change.

Explicitly **not** yours, in this batch or any other: `src/data/run.test.ts`'s
neighbours in `src/data/` beyond the two named, `src/engine/run/index.ts` (no barrel
change), `src/engine/run/state.ts`, `src/engine/save.ts`, `src/ui/notice.ts`,
`src/i18n/*`, `src/scenes/*`, `package.json`, `src/main.ts`, `vite.config.ts`.

### Inputs (read-only)

- `docs/balance/route-curve.md` — the sheet you rewrite (read it whole first).
- `docs/battle-spec.md` §7 — the bullet you amend.
- `src/data/run.ts`, `src/data/maps.ts`, `src/data/bosses.ts`, `src/data/trainers.ts`.
- `src/engine/run/progression.ts`, `src/engine/run/resolve.ts`,
  `src/engine/run/floors.ts`, `src/engine/maps/plan.ts`,
  `src/engine/routes/sketch.ts`.
- `src/engine/run/curve.test.ts` — the measuring harness you extend; it already
  rebuilds every room of every finite map the way `RouteScene.buildRoute` does.
- `TODO.md`'s `[Task-83]` entry — the cut note that freezes this shape.

## 🔒 Contract

### TypeScript

`src/data/run.ts` gains, beside `LEVEL_BANDS` and **outside** it:

```ts
/**
 * Per-floor trainer-XP factors, one per finite map (`FINITE_MAPS` = 8), two
 * decimals each. The award is `LEVEL_BANDS[*].trainerXp` × this floor's factor,
 * so a multiplier shared by several floors can no longer starve the last ones
 * (`docs/balance/route-curve.md`). The last row repeats past the last finite map
 * (infinite mode walks the `end` band upwards).
 */
export const TRAINER_XP_PER_MAP: readonly number[] = [/* eight factors */];

/**
 * The factor floor `mapIndex` pays: row `mapIndex - 1`, clamped at both ends, so
 * map 0 and a negative index read the first row and map 9+ reads the last.
 */
export function trainerXpMultiplierForMap(mapIndex: number): number;
```

`src/engine/run/progression.ts`:

```ts
export function experienceAward(
  defeatedLevel: number,
  participants = 1,
  isTrainer = false,
  floorMultiplier = 1,
): number;
```

- Semantics: `base = level * 5`; `scale = isTrainer ? 1.5 * bandForLevel(level).trainerXp * floorMultiplier : 1`;
  result `Math.max(1, Math.floor((base * scale) / Math.max(1, Math.floor(participants))))`.
  **A non-trainer award ignores `floorMultiplier` entirely** (a wild encounter stays
  outside the budget).
- The default `1` is what makes every existing call site and every existing test
  inert: `experienceAward(level, 1, true)` still equals
  `Math.floor(level * 5 * 1.5 * bandForLevel(level).trainerXp)`.
- Pure; reads no RNG. No new import cycle: `src/data/run.ts` must not import from
  `src/engine/`.

`src/engine/run/resolve.ts`: the one XP fold passes the floor's factor —

```ts
const amount = reward.enemyLevels.reduce(
  (total, level) =>
    total + experienceAward(level, 1, reward.isTrainer, trainerXpMultiplierForMap(next.mapIndex)),
  0,
);
```

`next.mapIndex` is the floor the battle was fought on (`advanceMap` has not run yet in
that fold). Nothing else in `resolve.ts` changes.

`src/engine/run/curve.test.ts`:

- The walk measures each floor's `A(m)` **with that floor's factor**:
  `awards += experienceAward(level, 1, true, trainerXpMultiplierForMap(mapIndex))` when
  it sums a band's levels.
- `SHARED_BAND_MIN_FILL` is **deleted**; every floor, map 8 included, must reach
  `MIN_FILL = 1.05`.
- `MEASURED_FILL` is re-pinned to the fills the new table measures, two decimals, and
  the per-floor assertion `toBeCloseTo(MEASURED_FILL[m], 2)` stays.
- A new assertion that the table itself is well-formed:
  `TRAINER_XP_PER_MAP.length === FINITE_MAPS`, every row finite, `> 0` and two decimals;
  `trainerXpMultiplierForMap(0) === TRAINER_XP_PER_MAP[0]`,
  `trainerXpMultiplierForMap(FINITE_MAPS) === TRAINER_XP_PER_MAP[FINITE_MAPS - 1]`,
  `trainerXpMultiplierForMap(FINITE_MAPS + 5) === TRAINER_XP_PER_MAP[FINITE_MAPS - 1]`.
- A regression that the wiring reaches the fold: one `resolveBattle` trainer win on a
  floor whose factor is not `1` awards exactly
  `Math.floor(level * 5 * 1.5 * bandForLevel(level).trainerXp * factor)` for that floor,
  and the same win read as a **wild** battle awards `level * 5` × 1 (no trainer factor,
  no floor factor). Put it in `src/engine/run/resolve.test.ts`, built from
  `createRun` + a `mapIndex`/`levelCap` override the way the file's other tests build
  their runs.

### Data

`TRAINER_XP_PER_MAP` — eight numbers, `mapIndex` 1..8, **two decimals**, each the factor
that puts that floor's fill at `1.25` (mid-window). Solve them **by measuring first**:

1. Set every row to `1` and run the walk (`npx vitest run src/engine/run/curve.test.ts`
   with `MEASURED_FILL` temporarily relaxed to see the numbers, or read the fill the
   failure message prints).
2. The fill is linear in the factor: `factor(m) = 1.25 * needed(m) / (0.75 * T̄(m) * A₁(m))`,
   where `A₁(m)` is the award measured with the factor at `1`. Round to two decimals.
3. Re-run the walk with the solved table and pin what it measures. Every floor must land
   in `1.05 – 1.5`, and the eight fills should read ≈ `1.25` (± 0.02).

A factor above `1` pays **more** per trainer than the band's own rate and a factor below
`1` pays less; both are legitimate — the factor is what is left to reach the floor's cap,
exactly as `trainerXp` was before. **Do not touch `LEVEL_BANDS[*].trainerXp`**: it is the
band's rate and eight other tables key off its solving.

`TRAINER_XP_PER_MAP` is a `readonly number[]` consumed by the engine and the sheet; it is
**not** a `BandId`-keyed table, so it never reaches `ROUTE_LOOT`, the shop, the casino or
the trainer-money tables (that is why a seventh band was rejected).

### Docs

`docs/balance/route-curve.md` — rewrite the **measured** parts so the sheet and the test
agree (the test is right when they disagree):

- **Level bands** table: the `trainerXp` column must carry the values
  `LEVEL_BANDS` actually ships today (read them out of `src/data/run.ts`; the sheet's
  column has drifted — the shipped Early row is **not** `2.67`). Leave `Levels`,
  `Trainer party` and `BST window` as they are unless the code disagrees.
- **The per-floor trainer budget**: add the floor's factor to the table (one new column,
  `Factor`), keep `T̄(m)`, `A(m)`, the `0.75 × T̄(m) × A(m)` product, the window and the
  fill, and make every number the one the walk measures with the new table. `A(m)` now
  includes the floor's factor — say so in the paragraph above the table.
- The prose that says maps 6-8 share the `end` band and that a shared multiplier cannot
  express their spread: replace it with the shipped rule (a per-floor factor) and the
  numbers that prove it, keeping the rejected alternative (a seventh band) recorded in
  one sentence with its reason.
- **The rule** section: `experienceAward(level, 1, true, floorMultiplier)` is
  `floor(level × 5 × 1.5 × trainerXp × floorMultiplier)`; the wild award stays
  `floor(level × 5)` and reads no factor. **Infinite mode** keeps the last row.
- **Level caps per map** and **Evolution levels** tables do not move; check them against
  `src/data/maps.ts` and leave them alone if they already agree.

`docs/battle-spec.md` §7 — the bullet beginning "The curve is medium-fast (`level^3`)…"
gains one clause: a **trainer** award is also multiplied by the floor's own
`trainerXpMultiplierForMap` (`src/data/run.ts`), so 75 % of a floor's trainers pays that
floor's cap (`docs/balance/route-curve.md`); a wild award is not. **Touch nothing else in
that file** — another task in a later batch owns its other sections.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless, must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-83` audited against the exclusive paths
    above.
  - Every criterion below is `[unit]`: this task has **no** `[live]` criterion and owes
    **no** browser pass.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test` is green — 155+ test files, no skipped new test.
  - [ ] `[unit]` `TRAINER_XP_PER_MAP` has exactly `FINITE_MAPS` (8) rows, each finite,
    `> 0`, two decimals; `trainerXpMultiplierForMap` clamps at both ends and repeats its
    last row past map 8 (asserted in `curve.test.ts` or `run.test.ts`).
  - [ ] `[unit]` `experienceAward(level, 1, true)` — the three-argument form — is
    unchanged for every level 1..100 against
    `Math.floor(level * 5 * 1.5 * bandForLevel(level).trainerXp)`, and
    `experienceAward(level, 1, false, 3)` equals `experienceAward(level)` (the factor
    never reaches a wild award).
  - [ ] `[unit]` `src/engine/run/curve.test.ts` proves, over `curve-a`/`curve-b`/`curve-c`,
    that **all eight** floors fill inside `1.05 – 1.5`, each equal to `MEASURED_FILL[m]`
    to two decimals, with **no** `SHARED_BAND_MIN_FILL` symbol left in the file.
  - [ ] `[unit]` A `resolveBattle` trainer win on a floor with a factor ≠ 1 awards the
    factored amount and a wild win of the same levels awards the un-factored one
    (`src/engine/run/resolve.test.ts`).
  - [ ] `[unit]` The table in `docs/balance/route-curve.md` matches what the test
    computes (the `Factor` column equals `TRAINER_XP_PER_MAP`, the `A(m)` column is the
    factored award, the fill column equals `MEASURED_FILL`), and the band table's
    `trainerXp` column equals `LEVEL_BANDS[*].trainerXp`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched, and `docs/battle-spec.md`
    shows a single-hunk diff inside §7.

## 📣 Coordination

- For the Architect: the plan's `[Task-83]` cut note is implemented as written — a
  per-floor factor, no seventh band. The fill column in `docs/balance/route-curve.md` is
  now a measured artefact of `curve.test.ts`; a later balance pass re-pins it, never the
  other way round.
- For the next batch: any task that computes XP by hand must call `experienceAward` with
  the floor's factor (`resolveBattle` is the only production call site).

## ⛔ Out of scope

- The boss's award and the wild pool stay outside the budget (unchanged).
- The band table itself (`LEVEL_BANDS[*].trainerXp`, the BST windows, `trainerSize`) does
  not move — only the new per-floor factors do.
- No `SAVE_VERSION` step, no run field, no scene, no i18n key, no RNG.
- The room-size rule, the trainer-room count and the level caps are read, never changed.

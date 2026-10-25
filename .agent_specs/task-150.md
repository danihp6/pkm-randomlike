# Spec: Task-150 — The four team-type bonuses

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure TypeScript, no Phaser).
- **Role:** Dev.
- **Objective:** a battle carries the **player party's repeated types** as
  `teamTypes`, and while a type is repeated by two **living** members, a move of that
  type deals **+10 %** damage and its status side-effect gets **+20** percentage
  points of chance — Fire→burn, Ice→freeze, Electric→paralysis, Poison→poison. The
  damage half multiplies inside `src/engine/battle/damage.ts` next to STAB; the status
  half is **one** exported helper in `src/engine/battle/turn.ts` that the existing
  secondary roll calls, so the two can never disagree. `docs/battle-spec.md` §10/§11
  document the rule.
- **Environment:** worktree `../wt-pkm-150`, branch `task-150`.
- **Dependencies:** none. `damage.ts` and the secondary roll are shipped.

**Read this before coding:** `BattleSetup` has no `teamTypes` field today (the backlog
cites line numbers that are stale). This task **adds** the field to `BattleSetup` and
to `BattleState`; it does not "fill" an existing one. The launch call site that would
populate it (`src/scenes/RouteScene.ts`) is **not** in your paths — see Coordination.

### Exclusive paths (single writer)

- `src/engine/battle/state.ts`
- `src/engine/battle/damage.ts`
- `src/engine/battle/turn.ts`
- `src/engine/battle/damage.test.ts`
- `src/engine/battle/turn.test.ts`
- `docs/battle-spec.md` — **§10 and §11 only**; another batch-mate never touches this
  file, but touch no other section.

No other file. `package.json`, `src/main.ts`, scenes, `src/data/**` are off-limits.

### Inputs (read-only)

- `src/engine/battle/fighter.ts` (`BattleFighter.types`), `effects/registry.ts`
  (`runModifySecondaryChance`), `src/data/dex/moves.json` (a move's `type`, its
  `secondaries[].status`/`chance`).
- `docs/battle-spec.md`, `docs/design-spec.md`.

## 🔒 Contract

### TypeScript

```ts
// state.ts
export type BattleSetup = Readonly<{
  // ...existing fields unchanged...
  /** The party types the launch's living members repeat (at least two each). Default `[]`. */
  teamTypes?: readonly string[];
}>;

export type BattleState = {
  // ...existing fields unchanged...
  /** The player's repeated party types; the enemy side never gets this bonus. */
  teamTypes: readonly string[];
};

// damage.ts
/** The damage multiplier a repeated party type adds to a move of that type. */
export const TEAM_TYPE_DAMAGE = 1.1;

/**
 * The multiplier a move of `moveType` earns from `teamTypes`: `TEAM_TYPE_DAMAGE`
 * when the type is listed, `1` otherwise. Never reads the RNG.
 */
export function teamTypeDamageMultiplier(
  moveType: string,
  teamTypes: readonly string[],
): number;

/** `teamTypes` rides in the damage context so `computeDamage` stays state-free. */
export type DamageContext = Readonly<{
  // ...existing fields unchanged...
  teamTypes?: readonly string[];
}>;

// turn.ts
/** Percentage points a repeated party type adds to its status side-effect's chance. */
export const TEAM_TYPE_STATUS_BONUS = 20;

/**
 * The chance a status side-effect actually rolls, in whole percent: `chance` plus
 * `TEAM_TYPE_STATUS_BONUS` when `moveType` is in `state.teamTypes` and `status` is
 * that type's status (Fire→brn, Ice→frz, Electric→par, Poison→psn). Clamped to
 * 0..100. Pure; never reads the RNG.
 */
export function teamTypeStatusChance(
  state: BattleState,
  moveType: string,
  status: string | undefined,
  chance: number,
): number;
```

- **Where the damage multiplier applies:** in `computeDamage`, immediately **after**
  the STAB `Math.floor(damage * 1.5)` line and **before** the type-chart multiply, as
  `damage = Math.floor(damage * teamTypeDamageMultiplier(move.type, context.teamTypes ?? []))`.
  `estimateDamage` (the AI's deterministic path) applies the same multiplier from the
  same context field so the AI and the real hit agree.
- **Who passes it:** `turn.ts` sets `context.teamTypes = state.teamTypes` on the
  **player's** damage context only. The enemy's context leaves it undefined. Do not
  read `state.teamTypes` inside `damage.ts` (it has no state) and do not give the
  enemy the bonus.
- **Where the status helper applies:** the two places a secondary status picks its
  chance today — the `effect.chance !== undefined` guard inside `applySecondary` and
  the status branch of the main `effect` path. Both call
  `runModifySecondaryChance(...)` today; wrap that result:
  `teamTypeStatusChance(state, move.type, effect.status, runModifySecondaryChance(...))`.
  `applySecondary` does not receive the move; thread its `type` through the internal
  call site (`applySecondary(state, actingSide, secondary, acting, defender, move.type)`
  is fine — it is private).
- **The mapping lives in engine code with named constants** (`TEAM_TYPE_STATUS_BONUS`,
  `TEAM_TYPE_DAMAGE`) because this task owns no `src/data/` path; it is exactly four
  types and two numbers, and the spec's numbers are frozen. Record in Coordination that
  a later balance pass would move them to `src/data/`.
- **Determinism:** reads **no RNG**. The RNG draw (`state.rng.int(1, 100)`) is
  unchanged and happens in the same order; only the threshold moves. With `teamTypes`
  absent/empty the numbers must be **byte-identical** to today: the default is `[]`,
  the multiplier is `1` and the helper returns `chance` untouched. Every existing
  fixed-seed test must stay green **without re-pinning**.
- Rules: no Phaser imports, no DOM, no allocation in the per-turn path beyond reading
  `state.teamTypes`.

### Data

No data file changes. `teamTypes` holds dex type ids as the dex spells them
(`'Fire'`, `'Ice'`, `'Electric'`, `'Poison'` — the capitalisation `effectiveness()`
uses), not lowercase keys.

## 🧩 Data and configuration

| repeated type | bonus |
|---|---|
| Fire | +10 % damage on Fire moves, +20 pp to `brn` |
| Ice | +10 % damage on Ice moves, +20 pp to `frz` |
| Electric | +10 % damage on Electric moves, +20 pp to `par` |
| Poison | +10 % damage on Poison moves, +20 pp to `psn` |

## 🧪 Test and Validation Plan (for QA)

All criteria are `[unit]`. **No browser pass is owed** — no scene reads this field yet,
so there is nothing to see on screen.

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-150` against the exclusive paths.
  - Read `docs/battle-spec.md` §10/§11 for the two documented paragraphs.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean.
- [ ] `[unit]` `npm test` is green **with no re-pinned seed**: the suite that existed
      before this task passes unchanged when `teamTypes` is absent.
- [ ] `[unit]` `teamTypeDamageMultiplier('Fire', ['Fire'])` is `1.1`;
      `('Fire', [])`, `('Fire', ['Ice'])` are `1`. A `computeDamage` test proves the
      final number is `Math.floor` of the unbonused damage × 1.1 (assert the two
      integers, not "bigger than").
- [ ] `[unit]` `teamTypeStatusChance` returns `chance + 20` for Fire/`brn` with
      `['Fire']`, returns `chance` for Fire/`brn` with `[]`, returns `chance` for
      Fire/`par` (wrong status), and clamps at 100.
- [ ] `[unit]` A `turn.ts` test proves a secondary whose chance would fail at the base
      number lands with the bonus: fix the RNG seed so the raw d100 is between the two
      thresholds, and assert the status is applied with `teamTypes` and not without —
      two runs, same seed, one difference.
- [ ] `[unit]` `createBattle({...})` with no `teamTypes` yields `state.teamTypes` deep
      equal to `[]`; with `teamTypes: ['Fire']` it carries that array. (There is no
      `state.test.ts` in `src/engine/battle/` — put this in `turn.test.ts`; creating a
      new test file there would owe a folder-README update you do not own.)
- [ ] `[unit]` `docs/battle-spec.md` §10/§11 state the +10 % / +20 pp rule and the four
      type→status pairs.
- [ ] `[unit]` `git diff --name-only main...task-150` lists only exclusive paths, and
      `git diff main...task-150 -- docs/battle-spec.md` touches no section but §10/§11.

## 📣 Coordination

- For the Architect: **the launch that fills `teamTypes` is a follow-up.** The party's
  living members' types live in `RunState` (`party[].fighter.types`), and the call site
  is `src/scenes/RouteScene.ts` (or wherever `createBattle` is invoked) — outside this
  task's paths. Until that follow-up lands, the rule is reachable and tested only by
  passing `teamTypes` explicitly, and the game shows no bonus. Register it.
- For the Architect: `src/data/` is the home of balance values; the two constants and
  the four-pair map should move there when a tuning pass needs them.
- For the next batch: `BattleSetup.teamTypes` is optional and defaults to `[]`, so
  every existing caller keeps its exact numbers.
- For `[Task-154]`/HUD work: `state.teamTypes` is the battle's copy, not the run's.

## ⛔ Out of scope

- Wiring the launch (`RouteScene.ts`, the run state) — a follow-up task.
- Any fifth type, any change to STAB, the type chart, or the secondary-chance
  modifiers already shipped (`runModifySecondaryChance`).
- A HUD/panel surface that shows the active bonuses.
- `src/data/**`, scenes, `package.json`.

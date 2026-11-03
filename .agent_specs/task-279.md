# Spec: Task-279 — Levels come from the badge and the distance to the leader

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data row + roster wiring.
- **Role:** Dev.
- **Objective:** the region's three level rules exist as pure functions: a regular
  trainer's level is its stretch's cap minus what its distance to the closing gym and
  its party size are worth; a wild sits at 60-75 % of the squad's level; a gym leader
  sits exactly on the cap. A node's level band is derived from the plan, and a
  trainer roster can be built straight off a node without taking a level draw.
- **Environment:** worktree `../wt-pkm-279`, branch `task-279`.
- **Dependencies:** the region plan — `src/engine/region/plan.ts` (`RegionNode`) —
  `src/data/region.ts` (`BADGE_CAPS`, `badgeCap`) and `src/engine/run/roster.ts`
  (`trainerRoster`, `RosterOptions`), all merged.

### Exclusive paths (single writer)

- `src/engine/run/levelCurve.ts` (new)
- `src/engine/run/levelCurve.test.ts` (new)
- `src/engine/run/roster.ts`
- `src/engine/run/roster.test.ts`
- `src/data/trainerLevels.ts`
- `src/data/trainerLevels.test.ts`
- `docs/region-spec.md` **§3 only**

### Inputs (read-only)

- `AGENTS.md`
- `docs/region-spec.md` (§1, §3)
- `src/engine/region/plan.ts`, `src/engine/region/plan.test.ts`
- `src/data/region.ts`, `src/data/run.ts` (`LEVEL_BANDS`, `bandForLevel`, `LevelBand`)
- `src/data/wildLevels.ts` (`WILD_LEVEL_FRACTION`)
- `src/engine/rng.ts` (`Rng.next`, `Rng.int`)
- `src/engine/run/roster.ts`, `src/engine/run/floors.ts` (`bandForMap`)
- `src/data/trainerLevels.ts` (the shipped `trainerLevel(squadLevel, size, cap)`)

> **The name `trainerLevel` exists twice, on purpose.** `src/data/trainerLevels.ts`
> already exports `trainerLevel(squadLevel, size, cap)` for the shipped floor scene;
> that one is **frozen** and keeps feeding `RouteScene` until the sweep. The new
> rule lives in `src/engine/run/levelCurve.ts` and is imported by path from there.

## 🔒 Contract

### `src/data/trainerLevels.ts` — added, nothing removed

```ts
/** The party-size factor a regular trainer's level is worth: bigger party, lower members. */
export const TRAINER_SIZE_FACTOR: Readonly<Record<1 | 2 | 3, number>> = {
  1: 1,
  2: 0.9,
  3: 0.8,
};

/** The factor of a party of `size`, clamped into `1..3` (`TRAINER_SIZE_FACTOR[size]`). */
export function trainerSizeFactor(size: number): number;
```

`TRAINER_LEVEL_PERCENT`, `trainerLevelPercent` and `trainerLevel` stay byte-identical.

### `src/engine/run/levelCurve.ts` — new

```ts
import type { LevelBand } from '../../data/run';
import type { RegionNode } from '../region/plan';

/** A regular trainer member's level: `cap` less the distance's worth, floored, in `1..cap`. */
export function trainerLevel(cap: number, gymDistance: number, partySize: 1 | 2 | 3): number;

/** A wild encounter's level: 60-75 % of the squad's, floored, never below 2. */
export function wildLevel(squadLevel: number, rng: Rng): number;

/** A gym leader's level: the cap itself, floored, never below 1. */
export function leaderLevel(cap: number): number;

/** The band a node reads: the previous stretch's cap up to this node's own cap. */
export function bandForNode(node: RegionNode): LevelBand;
```

Rules, exactly:

1. **`trainerLevel(cap, gymDistance, partySize)`** =
   `Math.min(cap, Math.max(1, Math.floor(cap - distance * trainerSizeFactor(partySize))))`
   where `distance = Math.max(0, Math.floor(gymDistance))` and `cap` is floored and
   clamped at `>= 1`. Therefore: at `gymDistance === 0` the level **is** the cap for
   every party size; every step back lowers it by that size's factor (`1`, `0.9`,
   `0.8`), floored. It reads no RNG.
2. **`wildLevel(squadLevel, rng)`**: one draw, `share = WILD_LEVEL_FRACTION.min +
   rng.next() * (WILD_LEVEL_FRACTION.max - WILD_LEVEL_FRACTION.min)` (so
   `0.6 <= share < 0.75`), then
   `Math.max(2, Math.floor(Math.max(0, squadLevel) * share))`. One `next()` per call,
   nothing else; the caller supplies its `encounters` stream.
3. **`leaderLevel(cap)`** = `Math.max(1, Math.floor(cap))`. No RNG.
4. **`bandForNode(node)`**: `minLevel = node.badge <= 1 ? LEVEL_BANDS[0].minLevel :
   badgeCap(node.badge - 1)`; `maxLevel = node.cap`; the result is
   `{ ...bandForLevel(minLevel), minLevel, maxLevel }`. It is total: no throw, no RNG.

Module rules: no Phaser, no DOM, no clock, no `Math.random()`; no import from
`src/scenes/**`.

### `src/engine/run/roster.ts`

`RosterOptions` gains one optional field and nothing else changes:

```ts
/**
 * The region node the roster is posted on. When given (and `levelFor` is not), the
 * roster's level is `trainerLevel(node.cap, node.gymDistance, size)` and the band's
 * level draw is **not** taken, exactly as with `levelFor`.
 */
node?: RegionNode;
```

`trainerRoster`'s level branch becomes: `options.levelFor` first, else `options.node`
→ `trainerLevel(options.node.cap, options.node.gymDistance,
Math.min(3, Math.max(1, size)) as 1 | 2 | 3)`, else the shipped
`rng.int(band.minLevel, band.maxLevel)`. The species draw, the `variant` stream and
the Mega Stone pick keep their order and their streams.

### `docs/region-spec.md` §3

Extend the paragraph that begins "The cap is the only **level anchor**" with what
shipped: `src/engine/run/levelCurve.ts`, its four functions, the
`TRAINER_SIZE_FACTOR` table `1 / 0.9 / 0.8`, the wild window
(`WILD_LEVEL_FRACTION`, floored at 2) and the node's band
(`bandForNode`, previous cap → this cap). Replace the forward-looking wording with
the shipped names. Do not touch §1-§2 or §4-§8, and do not restate the gym or League
tables.

## 🧩 Data and configuration

- `TRAINER_SIZE_FACTOR`: `1 → 1`, `2 → 0.9`, `3 → 0.8`. These are the only new
  balancing values; they are what a step back from the gym costs a party of that
  size, in levels.
- `WILD_LEVEL_FRACTION` (`0.6 … 0.75`) is read, never changed.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`; green.
  - `git diff --name-only main...task-279` against the exclusive paths list.
  - No browser pass: every criterion is `[unit]`.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `TRAINER_SIZE_FACTOR` is exactly `{1: 1, 2: 0.9, 3: 0.8}` and
    `trainerSizeFactor(0) === 1`, `trainerSizeFactor(7) === 0.8`.
  - [ ] `[unit]` A party of three at `gymDistance === 0` lands on the cap (for every
    cap in `[9, 16, 23, 30, 37, 43, 49, 55, 60]`), and the same party at
    `gymDistance === 3` is lower; for each size `1|2|3` the level is non-increasing
    in distance, never above `cap` and never below `1`.
  - [ ] `[unit]` `trainerLevel(cap, 1, s)` equals `Math.floor(cap - factor(s))` on
    every cap above.
  - [ ] `[unit]` Over 1 000 calls of `wildLevel(squad, rng)` on one `Rng` stream,
    every result is `>= 2`, `>= Math.floor(0.6 * squad)` and
    `<= Math.floor(0.75 * squad)`, and at least two distinct values appear; the same
    `Rng` seed replays the same 1 000 values.
  - [ ] `[unit]` `leaderLevel(cap) === cap` for every `BADGE_CAPS` entry and for
    `60`.
  - [ ] `[unit]` `bandForNode` on every node of a fixed seed's plan has
    `maxLevel === node.cap`, `minLevel === (node.badge <= 1 ? 2 : badgeCap(node.badge
    - 1))` and `id === bandForLevel(minLevel).id`.
  - [ ] `[unit]` A `trainerRoster(band, rng, 'x', { node })` gives every member the
    level `trainerLevel(node.cap, node.gymDistance, clamp(size))`, and it yields the
    same species as the same call with the equivalent `levelFor` — i.e. the level
    draw is not taken.
  - [ ] `[unit]` `src/engine/` still imports no Phaser and no DOM, and no
    `Math.random()` or `Date.now()` entered it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the Architect: the module is `src/engine/run/levelCurve.ts`, not `curve.ts` —
  `src/engine/run/curve.test.ts` is the shipped XP-budget regression (`Task-83`) and
  must not be replaced. `wildLevel` takes the `Rng` it draws its 60-75 % window with
  (`wildLevel(squadLevel, rng)`); the plan's one-argument signature could not express
  the window the same plan asks the test to measure. The rule itself is
  `floor(cap − distance × TRAINER_SIZE_FACTOR[size])`, so a gym-adjacent party sits
  on the cap *before* rounding, which is the sentence the plan's test states.
- For the next batch: `trainerLevel`, `wildLevel`, `leaderLevel` and `bandForNode`
  are the only level rules the region scene reads; a routine roster passes its
  `node` (`RosterOptions.node`) instead of a `levelFor` closure. The old
  `src/data/trainerLevels.ts` `trainerLevel` and `floors.ts`'s `bandForMap` stay for
  the old scene until the sweep.

## ⛔ Out of scope

- Re-tuning the caps, the bands or the XP curve.
- Deleting `bandForMap`, the shipped `trainerLevel(squadLevel, size, cap)` or
  `src/data/wildLevels.ts`'s `wildLevel(fraction, squadLevel, cap)`.
- Anything in `src/scenes/**`, `src/ui/**`, `src/engine/maps/**` or the region plan.
- Calling the new curve from a scene: the region scene is a later batch.

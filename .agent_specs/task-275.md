# Spec: Task-275 — The eight leaders, the four and the Champion are data

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data.
- **Role:** Dev.
- **Objective:** the campaign's eight gym fights and its five League fights become
  tables, so retuning them is never a code change: `GYMS` holds one row per badge
  (its leader, the archetype it fights as, a generated six or gym 1's fixed three,
  the 10 % double chance, its TM and its money multiplier), `LEAGUE` holds the four
  Elite Four members and the Champion at `LEAGUE_LEVEL`, `TOWER` holds the tower's
  "no leader, no rule" row, and `src/data/trainers.ts` gains the eight leaders'
  names and classes without disturbing the archetype tables the rest of the game
  rolls from.
- **Environment:** worktree `../wt-pkm-275`, branch `task-275`.
- **Dependencies:** none from this batch. Reads Batch 117's `src/data/region.ts`
  (`BADGE_CAPS`, `LEAGUE_LEVEL`, `badgeCap`) — the cap ladder stays there; this
  task never restates a cap.

### Exclusive paths (single writer)

- `src/data/gyms.ts` (new)
- `src/data/gyms.test.ts` (new)
- `src/data/league.ts` (new)
- `src/data/league.test.ts` (new)
- `src/data/trainers.ts` (extend — a **new** table only, see the constraints)
- `src/data/README.md` (the two new table lines)
- `docs/region-spec.md` **§3 only** (add the ladder's data paragraph; §7 belongs to
  the generators in this batch — do **not** touch §7, nor §1, §2, §4-§8)

**Nothing outside this list.** In particular: no `src/data/trainers.test.ts` (it
pins tables this task must not change), no `src/data/region.ts`, no
`src/data/tms.ts`, no `src/data/bosses.ts`, no `src/i18n/**`, no engine file, no
scene, no `package.json`.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1 (sizes/counts are data), §3 (the section you extend),
  §6 (a city has a Centre, a shop and a gym).
- `docs/data-spec.md` §3 and §5 (what an authored table looks like, and the rules).
- `src/data/region.ts` (`BADGE_CAPS`, `LEAGUE_LEVEL`, `badgeCap`,
  `cityTierForBadge`), `src/data/trainers.ts`, `src/data/tms.ts`,
  `src/data/bosses.ts` (for the shape a fixed party row takes), `src/data/run.ts`
  (`LevelBand`), `src/data/README.md`.
- `src/data/dex/types.ts` (`TYPE_NAMES`, `isTypeName`), `src/data/dex/species.ts`
  (`getSpecies`) — the tests use them.
- `src/engine/run/roster.ts` (`trainerRoster`, `RosterOptions.count`) — read it to
  see how a table row will feed a party; you do not call it in this task.

## 🔒 Contract

### TypeScript — `src/data/gyms.ts`

```ts
/** One gym fight: badge, leader, archetype, party, doubling, TM and payout. */
export type GymRow = Readonly<{
  /** 1..8, the badge the gym awards, also the chain position of its city. */
  badge: number;
  /** A `LEADER_IDENTITIES` id from `src/data/trainers.ts` — the leader's name/class. */
  leaderId: string;
  /** A `TRAINER_ARCHETYPES` id — the sprite, AI flags and money base it fights as. */
  archetypeId: string;
  /** How many party members the fight fields when it is not a fixed party. */
  partySize: number;
  /**
   * Gym 1 only: the three species ids in field order, so the run's on-ramp is the
   * same every time. Absent on every other row (their party is generated).
   */
  fixedParty?: readonly string[];
  /** Probability in `0..1` that the fight fields two actives per side. */
  doubleChance: number;
  /** The machine the badge pays, a TM item id (`tmNNN`, `src/data/tms.ts`). */
  tmItemId: string;
  /** Multiplies the borrowed archetype's `money.base` and `money.jitter`. */
  moneyMultiplier: number;
}>;

export const GYMS: readonly GymRow[];

/** The row for `badge`; throws `Error("no gym for badge <n>")` outside 1..8. */
export function gymForBadge(badge: number): GymRow;
```

### TypeScript — `src/data/league.ts`

```ts
import type { TypeName } from './dex/types';

export type LeagueTitle = 'elite' | 'champion';

/** One League fight: the four Elite Four members, then the Champion. */
export type LeagueRow = Readonly<{
  /** 1..5, the member order; 5 is the Champion. */
  index: number;
  title: LeagueTitle;
  /** The member's own name, e.g. `Nival`. */
  name: string;
  /** The class the HUD prints, e.g. `Elite Four` or `Champion`. */
  className: string;
  /** A `TRAINER_ARCHETYPES` id — the sprite, AI flags and money base it fights as. */
  archetypeId: string;
  /** The row's single type theme, a `TYPE_NAMES` entry; distinct across the five. */
  type: TypeName;
  /** How many party members the fight fields. */
  partySize: number;
  /** The level every member of the fight carries: `LEAGUE_LEVEL` (60) on every row. */
  level: number;
}>;

export const LEAGUE: readonly LeagueRow[];

/** The tower behind the Champion: no leader, no badge and no fixed party. */
export type TowerRow = Readonly<{
  key: 'tower';
  leaderId: null;
  /** The tower's fights start at the League's level and the streak raises them. */
  level: number;
  /** No fixed party: the streak's rung decides it. */
  partySize: null;
  /** No badge is awarded and no cap applies. */
  badge: null;
}>;

export const TOWER: TowerRow;
```

### TypeScript — `src/data/trainers.ts` (the only addition)

Add, after `SPECIAL_TRAINER_ROWS` and before the `BY_ID` map (its own section, its
own name space):

```ts
/** A named boss fight's identity: what the HUD prints, and nothing else. */
export type LeaderIdentity = Readonly<{
  id: string;
  /** The displayed name, e.g. `Boulder`. */
  name: string;
  /** The displayed class, e.g. `Gym Leader`. */
  className: string;
}>;

export const LEADER_IDENTITIES: readonly LeaderIdentity[];

/** The identity `id` names, or `undefined`. */
export function leaderIdentity(id: string): LeaderIdentity | undefined;
```

- **Frozen tables, do not touch:** `TRAINER_ARCHETYPES`, `TRAINER_ARCHETYPE_IDS`,
  `SPECIAL_ARCHETYPES`, `SPECIAL_TRAINER_ROWS`, `TrainerArchetype`, `BY_ID` and
  `getTrainerArchetype` keep their exact contents and order. `trainers.test.ts`
  pins them id by id and that file is **not** yours; a leader must never enter
  `TRAINER_ARCHETYPES` (it would become a route roll) or `SPECIAL_ARCHETYPES` (it
  would break `SPECIAL_TRAINER_ROWS`'s id space). `getTrainerArchetype('leader-1')`
  must stay `undefined`.
- `leaderIdentity` is a second, separate map — a leader is not an archetype.

### Data — the rows this task ships

`GYMS`, in badge order (baseline balance; retuning is an edit here):

| badge | leaderId | archetypeId | partySize | fixedParty | doubleChance | tmItemId | moneyMultiplier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `leader-1` | `blackbelt` | 3 | `['geodude','machop','onix']` | 0 | `tm058` | 1 |
| 2 | `leader-2` | `fisher` | 6 | — | 0.1 | `tm011` | 1.2 |
| 3 | `leader-3` | `camper` | 6 | — | 0.1 | `tm020` | 1.4 |
| 4 | `leader-4` | `ace` | 6 | — | 0.1 | `tm023` | 1.6 |
| 5 | `leader-5` | `psychic` | 6 | — | 0.1 | `tm026` | 1.8 |
| 6 | `leader-6` | `hiker` | 6 | — | 0.1 | `tm034` | 2 |
| 7 | `leader-7` | `lass` | 6 | — | 0.1 | `tm042` | 2.2 |
| 8 | `leader-8` | `ace` | 6 | — | 0.1 | `tm099` | 2.4 |

`LEADER_IDENTITIES`, eight rows, all `className: 'Gym Leader'`:

| id | name |
| --- | --- |
| `leader-1` | `Boulder` |
| `leader-2` | `Tide` |
| `leader-3` | `Thorn` |
| `leader-4` | `Volt` |
| `leader-5` | `Dusk` |
| `leader-6` | `Frost` |
| `leader-7` | `Ember` |
| `leader-8` | `Steel` |

`LEAGUE`, in order, every row `level: LEAGUE_LEVEL`:

| index | title | name | className | archetypeId | type | partySize |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `elite` | `Winter` | `Elite Four` | `lass` | `Ice` | 5 |
| 2 | `elite` | `Grave` | `Elite Four` | `psychic` | `Ghost` | 5 |
| 3 | `elite` | `Kata` | `Elite Four` | `blackbelt` | `Fighting` | 5 |
| 4 | `elite` | `Vega` | `Elite Four` | `psychic` | `Psychic` | 5 |
| 5 | `champion` | `Aurum` | `Champion` | `ace` | `Dragon` | 6 |

`TOWER` is `{ key: 'tower', leaderId: null, level: LEAGUE_LEVEL, partySize: null,
badge: null }`.

## 🧩 Data and configuration

- Every id used by a row is an existing id: `archetypeId` ∈ `TRAINER_ARCHETYPE_IDS`,
  `leaderId` ∈ `LEADER_IDENTITIES`, `tmItemId` passes `isTmItemId` and is unique,
  `fixedParty` ids resolve through `getSpecies`, `type` passes `isTypeName`.
- `level` is `LEAGUE_LEVEL` on all five rows and on `TOWER`; **no cap number is
  written in either new file** — `BADGE_CAPS`/`badgeCap` stay `src/data/region.ts`'s
  and a later engine task reads them.
- These name/class strings are authored data, exactly like `TRAINER_ARCHETYPES`'
  own `name`/`className`; no i18n key is invented here because `src/i18n/en.ts` is
  not this task's path.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the two new test files **and**
    the untouched `src/data/trainers.test.ts` and `src/data/region.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-275` — must be **exactly** the seven
    paths of the exclusive list.
  - Every criterion below is `[unit]`; **no browser pass is owed**.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `npm test -- src/data/gyms.test.ts -t "ships eight gyms in badge
        order, one TM each, no duplicates"`: `GYMS.map((r) => r.badge)` equals
        `[1,2,3,4,5,6,7,8]`; `new Set(GYMS.map((r) => r.tmItemId)).size === 8`;
        every `tmItemId` satisfies `isTmItemId`; every row's `moneyMultiplier > 0`
        and `partySize >= 1`.
  - [ ] `[unit]` `npm test -- src/data/gyms.test.ts -t "keeps gym 1's fixed three
        the only fixed party"`: `GYMS.filter((r) => r.fixedParty !== undefined)`
        has `badge === 1`; that row's `fixedParty` has length 3, has no duplicates,
        every id resolves via `getSpecies(id) !== undefined`, and its `partySize ===
        3`; every other row has `fixedParty === undefined`.
  - [ ] `[unit]` `npm test -- src/data/gyms.test.ts -t "rolls a double battle on a
        tenth of every other gym"`: `gymForBadge(1).doubleChance === 0` and every
        other row's `doubleChance === 0.1`.
  - [ ] `[unit]` `npm test -- src/data/gyms.test.ts -t "resolves every leader
        through trainers.ts and every TM through tms.ts"`: every `leaderId` has a
        `leaderIdentity(...)` row with a non-empty `name` and `className`, every
        `archetypeId` is in `TRAINER_ARCHETYPE_IDS`, and
        `getTrainerArchetype(row.leaderId) === undefined` for all eight rows
        (leaders are identities, not archetypes).
  - [ ] `[unit]` `npm test -- src/data/gyms.test.ts -t "gymForBadge reads the
        ladder and refuses a badge with no gym"`: `gymForBadge(n)` returns the row
        whose `badge === n` for 1…8, and `gymForBadge(0)`, `gymForBadge(9)` and
        `gymForBadge(2.5)` all throw.
  - [ ] `[unit]` `npm test -- src/data/league.test.ts -t "ships five rows at the
        League level with distinct themes"`: `LEAGUE.length === 5`,
        `LEAGUE.map((r) => r.index)` equals `[1,2,3,4,5]`,
        `LEAGUE.every((r) => r.level === LEAGUE_LEVEL)` with
        `expect(LEAGUE_LEVEL).toBe(60)`, `new Set(LEAGUE.map((r) => r.type)).size ===
        5`, and every `type` passes `isTypeName`.
  - [ ] `[unit]` `npm test -- src/data/league.test.ts -t "ends on a Champion row and
        starts on elite row 1"`: `LEAGUE.map((r) => r.title)` equals
        `['elite','elite','elite','elite','champion']`, the last row's
        `className === 'Champion'`, and every `partySize >= 1`.
  - [ ] `[unit]` `npm test -- src/data/league.test.ts -t "gives the tower no leader,
        no badge and no fixed party"`: `TOWER.leaderId === null`,
        `TOWER.partySize === null`, `TOWER.badge === null` and `TOWER.level ===
        LEAGUE_LEVEL`.
  - [ ] `[unit]` `npm test -- src/data/league.test.ts -t "keeps every party size at
        least one and every archetype real"`: every `archetypeId` is in
        `TRAINER_ARCHETYPE_IDS`, every `name` and `className` is non-empty, and
        `LEAGUE` writes no `BADGE_CAPS` number as a level (each `level ===
        badgeCap(9)`).
  - [ ] `[unit]` `npm test -- src/data/trainers.test.ts` is green **without that
        file being modified** (`git diff --name-only origin/main...task-275` does not
        list it), which proves `TRAINER_ARCHETYPES`, `TRAINER_ARCHETYPE_IDS` and
        `SPECIAL_ARCHETYPES` kept their contents.
  - [ ] `[unit]` `git diff -U0 docs/region-spec.md` shows exactly one new hunk
        inside §3, and `git diff -U0 src/data/README.md` touches only the two new
        layout lines.
  - [ ] `[unit]` `git diff --name-only origin/main...task-275` lists nothing outside
        the seven exclusive paths.
  - [ ] No `[live]` criterion exists for this task; **no browser pass is owed**.

## 📣 Coordination

- **For the Architect:** the item's `Docs:` line also names `docs/region-spec.md` §7,
  but §7.1 and §7.2 are the two generators' in this batch and §7's subsection list
  is theirs. This spec claims **§3 only**; the tower row is documented in
  `src/data/README.md` and in `league.ts`'s own header instead.
- **For the next batch (the gym and League screens):** the whole surface is
  `GYMS` / `gymForBadge(badge)` / `LEAGUE` / `TOWER` plus
  `leaderIdentity(id)`. A fight's party is
  `trainerRoster(band, rng, id, { count: row.partySize })` for a generated gym,
  `row.fixedParty` for gym 1, and `row.level` is the only level an engine ever
  passes to the League.
- `LEADER_IDENTITIES` is deliberately **not** an archetype table: a leader keeps
  its identity here and borrows its sprite, AI flags and money base from
  `archetypeId`, so the ten route classes stay exactly ten.
- `src/data/trainers.test.ts` and `src/data/region.test.ts` are the two guard rails
  — both must pass untouched.

## ⛔ Out of scope

- No engine code: no fight builder, no badge award, no level rule, no `RunState`,
  no gate. `trainerRoster` is read, never called from a new engine path.
- No sprite or battle-sprite keys for leaders: the borrowed `archetypeId` supplies
  them.
- No new TM, no new move, no `tms.ts` change, no new archetype, no new class.
- No i18n keys (`src/i18n/**` is not this task's path).
- No scene work, no boss-room data (`bosses.ts` keeps the floor bosses it has).
- No new dependency, no generated data file.

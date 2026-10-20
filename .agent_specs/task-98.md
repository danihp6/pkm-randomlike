# Spec: Task-98 — the floor-mission framework

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data table + one HUD line + docs.
- **Role:** Dev.
- **Objective:** a floor now has an **objective**. After this task a run carries one
  mission per floor, chosen deterministically from the seed when the floor is built, and
  the run **records whether it was met** when the portal advances. The one kind that
  ships is `flawless`: leave the floor having lost **no HP** and without a casualty. A
  met mission bumps a run-scoped counter, raises one transient notice through
  `src/ui/notice.ts`, and hands the run a **fixed reward row** (`{ kind: 'room' }`)
  that later tasks' rooms read. The route HUD shows the floor's mission in one line.
  The record is persisted, so the schema steps **18 → 19**.
- **Environment:** worktree `../wt-pkm-98`, branch `task-98` (already created and pushed
  with this spec as its first commit).
- **Dependencies (all merged on `main`):** none beyond the shipped tree — the floor
  advance (`advanceMap`, `src/engine/run/state.ts` 218-237), the casualty counter
  (`RunStats.casualties`), the transient-notice module (`src/ui/notice.ts`), the HUD
  (`src/scenes/RouteScene.ts`) and the i18n tables (`src/i18n/en.ts`, `src/i18n/es.ts`)
  all ship.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**

- `src/engine/run/missions.ts` **(new)**
- `src/engine/run/missions.test.ts` **(new)**
- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/README.md` (one line for the new module — its own rule 5)
- `src/data/missions.ts` **(new)**
- `src/data/missions.test.ts` **(new)**
- `src/data/README.md` (one line for `missions.ts`)
- `src/ui/notice.ts`
- `src/ui/notice.test.ts`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/scenes/RouteScene.ts`
- `docs/routes-spec.md` — **§4 and §6 only**
- `docs/design-spec.md` — **§7 only**
- `docs/maps-spec.md` — **§7 only**, one paragraph after the special-rooms list (no row
  in the special-room table, no rewrite of the leaf paragraphs)

Explicitly **not** yours: `src/engine/run/resolve.ts` (**another task in this batch owns
it — the HP-loss helper lives in your `missions.ts` and the scene wires it**),
`src/engine/run/curve.test.ts`, `src/data/run.ts`, `src/engine/run/index.ts` (no barrel
change), `package.json`, `src/main.ts`, `vite.config.ts`, `src/dev/**`,
`src/scenes/rooms/**`, `src/ui/README.md` (no new module in that folder),
`docs/battle-spec.md`.

### Inputs (read-only)

- `src/engine/run/state.ts` — `RunState`, `RunStats`, `createRun`, `advanceMap`,
  `advanceRoute`, `gainExperience`, `releaseFainted`'s caller.
- `src/engine/save.ts` — `SAVE_VERSION`, `SAVE_MIGRATIONS`, `parseRun`.
- `src/engine/run/resolve.ts` — read only, to see how a battle folds and where the
  scene can read the HP the battle spent.
- `src/ui/notice.ts`, `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`.
- `src/scenes/RouteScene.ts` — `buildNotice`/`showNotice` (5704-5738),
  `refreshHud` (2383), `applyBattleResult` (6084), `tryLeaveRoom` (5267),
  `teleportToFloor` (6716), `buildHud` (1663).
- `src/data/README.md`, `src/engine/README.md` (the per-folder map convention).
- `docs/routes-spec.md` §4/§6, `docs/design-spec.md` §7, `docs/maps-spec.md` §7.
- `TODO.md`'s `[Task-98]` entry — the cut that freezes this shape.

## 🔒 Contract

### TypeScript — `src/data/missions.ts` (new)

```ts
import type { TranslationKey } from '../i18n';

/** What a met mission pays. A later room task reads the row; nothing here applies it. */
export type MissionReward =
  | Readonly<{ kind: 'room' }>
  | Readonly<{ kind: 'item'; itemId: string; count: number }>
  | Readonly<{ kind: 'money'; amount: number }>;

/** What a mission asks for. One kind ships; a second one adds a row, not an engine branch. */
export type MissionKind = 'flawless';

export type MissionRow = Readonly<{
  id: string;
  kind: MissionKind;
  /** The mission's own display name, in the i18n table. */
  nameKey: TranslationKey;
  reward: MissionReward;
}>;

/**
 * The mission table. `flawless` is the human's first row — «no perder vida» — and
 * its reward is a special room the later room tasks hang off a completed mission.
 */
export const MISSION_TABLE: readonly MissionRow[] = [
  { id: 'flawless', kind: 'flawless', nameKey: 'mission.flawless', reward: { kind: 'room' } },
];

export function getMission(id: string): MissionRow | undefined;
export function missionsOfKind(kind: MissionKind): readonly MissionRow[];
```

`getMission` is a plain lookup; `missionsOfKind` filters in table order. Both pure, no
i18n call, no dex read.

### TypeScript — `src/engine/run/missions.ts` (new)

```ts
import type { FighterSnapshot } from '../battle/fighter';
import type { RunState } from './state';

/** The run's record of the floor's mission: its row id, its progress and whether it is met. */
export type MissionProgress = Readonly<{ id: string; progress: number; completed: boolean }>;

/**
 * The mission a floor is given, chosen deterministically from the run seed alone:
 * one draw from `Rng(hashSeed(`${seed}:map:${mapIndex}:mission`))`, its own stream,
 * so no `map`/`layout`/`encounters`/roster draw moves (`D11`) and a revisit or a
 * reload picks the same row.
 */
export function missionForMap(seed: string, mapIndex: number): MissionProgress;

/** True when the floor the run stands on meets its mission. `flawless`: no HP lost, no casualty. */
export function missionMet(run: RunState): boolean;

/** Adds HP the squad lost on this floor; a non-positive amount is a no-op (same object). */
export function recordHpLost(run: RunState, amount: number): RunState;

/**
 * The HP a battle took out of the party, matched by member id: for every party member
 * that `player` reports, `max(0, before.hp - after.hp)`; a member the battle did not
 * report contributes nothing (the box never fights). Counts a faint as its whole
 * remaining bar, so a casualty always reads as a loss.
 */
export function battleHpLoss(run: RunState, player: readonly FighterSnapshot[]): number;

/**
 * The mission the advance just met, or null: reads `missionsCompleted` across the two
 * runs and resolves `before.mission`'s row through `getMission`. The scene raises the
 * notice with it.
 */
export function missionCompletedBy(before: RunState, after: RunState): MissionRow | null;
```

Rules:

- `missionForMap` draws exactly **one** value: `rng.int(0, MISSION_TABLE.length - 1)`,
  and returns `{ id: row.id, progress: 0, completed: false }`. A negative or zero
  `mapIndex` is clamped to 1; the same `(seed, mapIndex)` always returns an equal value.
- `missionMet(run)`: `run.mission === null` → `false`; else
  `run.hpLost === 0 && run.stats.casualties === run.floorCasualties`.
- No Phaser, no DOM, no clock, no `Math.random()`.

### TypeScript — `src/engine/run/state.ts`

`RunState` gains four **required** fields, documented in the same voice as their
neighbours:

```ts
/** The floor's mission and whether the run has met it, or null on an old save. */
mission: MissionProgress | null;
/** How many missions this run has completed. Run-long: `advanceMap` never clears it. */
missionsCompleted: number;
/** HP the party lost on `mapIndex` — the `flawless` mission's progress. Resets per floor. */
hpLost: number;
/** `stats.casualties` when `mapIndex` was entered, so a death on this floor is visible. Resets per floor. */
floorCasualties: number;
```

- `createRun`: `mission: missionForMap(init.seed, FIRST_MAP)`, `missionsCompleted: 0`,
  `hpLost: 0`, `floorCasualties: 0`.
- `advanceRoute`: unchanged (all four are per **floor**).
- `advanceMap`: **evaluate the floor being left before anything else**, then build the
  next floor:
  - `const met = missionMet(run);`
  - `missionsCompleted: run.missionsCompleted + (met ? 1 : 0)`;
  - `mission: missionForMap(run.seed, mapIndex)` for the **new** floor,
    `hpLost: 0`, `floorCasualties: run.stats.casualties`;
  - everything else exactly as today, and `healParty(advanced)` still the last call.

### TypeScript — `src/engine/save.ts`

- `SAVE_VERSION = 19`.
- One migration, plus its line in the block comment above `SAVE_MIGRATIONS` (the comment
  already lists every step, 1 → 18):

  ```ts
  // The floor mission: a v18 run never carried one, so it starts with none, a zero
  // counter and a clean floor; `advanceMap` gives it a mission on the next floor.
  18: (document) => ({
    ...document,
    version: 19,
    run: isRecord(document.run)
      ? { mission: null, missionsCompleted: 0, hpLost: 0, floorCasualties: 0, ...document.run }
      : document.run,
  }),
  ```

- `parseRun` reads the four fields with the same defensive style as its neighbours:
  a non-negative integer for the two counters and `hpLost` (else `0`), `mission` through
  a small `parseMission(value)` that rejects anything that is not a `MISSION_TABLE` id
  with a non-negative integer `progress` and a boolean `completed` (else `null`), and
  `floorCasualties` **clamped to the run's own casualty count**
  (`Math.min(parsed, stats.casualties)`) so a hand-edited document cannot make a floor
  look casualty-free.

### TypeScript — `src/ui/notice.ts`

One more builder beside the shipped ones (same module, N strings):

```ts
/** The floor's mission was met on the advance: `<mission>` is its display name. */
export function missionCompleteNotice(mission: string): Notice;
```

with `t('notice.missionComplete', { mission })` and `NOTICE_HOLD_MS`.

### i18n — `src/i18n/en.ts` (authored first) and `src/i18n/es.ts` (overlay)

```ts
// en
'hud.mission': 'Mission: {mission}',
'mission.flawless': 'Flawless floor',
'notice.missionComplete': 'Mission complete: {mission}',

// es
'hud.mission': 'Misión: {mission}',
'mission.flawless': 'Planta sin daño',
'notice.missionComplete': 'Misión completada: {mission}',
```

`TranslationKey` is `keyof typeof en`, so the two tables must gain the same three keys.
No other key moves.

### Phaser — `src/scenes/RouteScene.ts`

1. **The HUD line.** A new `hudMissionText` and its own card, screen-space on the pinned
   HUD camera exactly like the notice strip (`buildNotice`, 5704):

   - constants beside `NOTICE_W` / `NOTICE_H` / `NOTICE_TOP` (521-523):
     `MISSION_W = 360`, `MISSION_H = 32`, `MISSION_TOP = NOTICE_TOP + NOTICE_H + 8`;
   - built in a new `buildMissionLine()` called right after `this.buildNotice()` in
     `create` (1542), as one `Phaser.GameObjects.Container` holding
     `addFrlgWindow(this, x, MISSION_TOP, MISSION_W, MISSION_H)` over a centred
     `addFrlgText(..., FRLG_INK)` of size 16, with
     `x = (this.scale.width - MISSION_W) / 2`; the container is `this.cameras.main.ignore`d
     and its depth is one under the notice strip's (`439`);
   - `refreshHud` sets the text to `t('hud.mission', { mission: t(row.nameKey) })` and
     shows the container when `this.run.mission` resolves to a `MISSION_TABLE` row, and
     hides the whole container when it does not (an old save's `null` mission draws
     nothing — no empty card).
2. **The HP the floor spent.** In `applyBattleResult` (6084), before the fold, read
   `const hpLoss = battleHpLoss(this.run, result.player);` and right after
   `this.run = run;` (6099) apply `this.run = recordHpLost(this.run, hpLoss);`. No rule
   in the scene: it only calls the pure helper and stores the result.
3. **The completion beat.** In `tryLeaveRoom`'s portal branch (5273-5278), keep a
   `const before = this.run;`, advance as it does today, and after the hatch fold raise
   `const met = missionCompletedBy(before, afterAdvance)`; when it is non-null, show
   `missionCompleteNotice(t(met.nameKey))` — the egg's own notice keeps priority if both
   would fire (one notice at a time, and the hatch is the rarer beat).
4. **The dev teleport.** `teleportToFloor` (6716) builds its own run literal: it must
   assign `mission: missionForMap(this.run.seed, floor)`, `hpLost: 0` and
   `floorCasualties: this.run.stats.casualties` (and carry `missionsCompleted` through
   the spread), so a teleported floor is not mission-less.
5. Nothing else in the scene changes: no key, no input mode, no panel layout, no
   `NOTICE_*` constant move.

### Docs

- `docs/routes-spec.md` **§4**: one bullet — a floor carries **one mission**, chosen
  deterministically from the run seed when the floor is built, evaluated when the run
  takes the portal; meeting it bumps a run-long counter and pays a fixed reward row
  (`{ kind: 'room' }` today, read by the special-room tasks); the first kind is
  `flawless` (no HP lost and no casualty on the floor). Nothing about the rest of §4
  moves.
- `docs/routes-spec.md` **§6**: one bullet — the HUD carries the floor's mission in one
  line under the transient-notice strip, and meeting it raises one transient notice
  through the same module (one message at a time, no key, no block).
- `docs/design-spec.md` **§7**: one bullet after the special-room list — the floor's
  mission and what `flawless` asks, and that a met mission's reward is a special room.
- `docs/maps-spec.md` **§7**: one paragraph after the special-rooms list (before the
  `### The gated leaf` subsection if that is where the list ends) saying the same in
  this file's voice: where the mission comes from, when it is evaluated, what it pays
  and that the room tasks consume the row. **No table row, no other subsection.**
- `src/engine/README.md`: add `run/missions.ts` (the floor's mission and its progress)
  to the `run/` bullet.
- `src/data/README.md`: add a `missions.ts` bullet beside `gates.ts`'s.

## 🧩 Data and configuration

- `MISSION_TABLE` — one row: `id: 'flawless'`, `kind: 'flawless'`,
  `nameKey: 'mission.flawless'`, `reward: { kind: 'room' }`. A second mission is a new
  row and a new `MissionKind`, never a branch in the scene.
- The record in the save is `{ id, progress, completed }` + `missionsCompleted` +
  `hpLost` + `floorCasualties`; nothing else about a mission is stored, so a later
  mission kind that needs a fact adds it to `RunState`, not to the row.
- No RNG is drawn at runtime: `missionForMap` draws once per floor, from its own stream,
  when the floor is built. A fixed seed's floors, routes, rosters and battles do not
  move.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless, must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-98` audited against the exclusive paths.
  - The one `[live]` criterion needs a browser: `npm run dev -- --port <free> --strictPort`,
    a headless Chromium over CDP, `renderer.snapshotArea` + `getImageData` on the live
    canvas, at **1280x800**, on a **fixed seed** run opened the same way on `main` and on
    this branch.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `npm test` is green — 155+ test files.
  - [ ] `[unit]` `missionForMap` is a pure function of `(seed, mapIndex)`: the same pair
    returns an equal value twice; two seeds or two floors eventually disagree; the
    returned `id` is a `MISSION_TABLE` row and `progress`/`completed` start at `0`/`false`.
  - [ ] `[unit]` A fixed-seed regression pins `missionForMap('pkm-111', 1..8)` — the
    eight ids, in a test whose seed is written in the spec of the test, so a later change
    to the stream is a deliberate re-pin.
  - [ ] `[unit]` `battleHpLoss` returns the exact summed drop (a party of two hurt for 3
    and 5 reads `8`), `0` when nobody was hurt, ignores a member the battle did not
    report, and counts a faint as the member's whole remaining bar;
    `recordHpLost` accumulates across battles and is the same object for `0`.
  - [ ] `[unit]` `advanceMap` meets a clean floor (`missionsCompleted` +1, the next
    floor's `mission` is set, `hpLost` back to `0`, `floorCasualties` = the run's
    casualties), and does **not** meet a floor that spent HP (`hpLost > 0`) or lost a
    member (`stats.casualties` above the baseline); `advanceRoute` changes none of the
    four fields.
  - [ ] `[unit]` `missionCompletedBy` returns the completed row across the advance and
    `null` when nothing completed.
  - [ ] `[unit]` The save round-trips the four fields; a v18 document migrates to 19 with
    `mission: null`, `missionsCompleted: 0`, `hpLost: 0`, `floorCasualties: 0`; a
    hand-edited `floorCasualties` above `stats.casualties` is clamped; `SAVE_VERSION` is
    `19` and every migration key 1..18 still exists.
  - [ ] `[unit]` `missionCompleteNotice('X')` is the `notice.missionComplete` string with
    its hold, and both locales carry the three new keys (`en` and `es` have the same
    `TranslationKey` set).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` On a fresh run at 1280x800 on the fixed seed, the rect
    `((1280 - 360) / 2, NOTICE_TOP + NOTICE_H + 8, 360, 32)` = `(460, 76, 360, 32)` of the
    live canvas carries the mission card: the **same rect** read on `origin/main` at the
    same seed, same map, same room and same viewport differs in **at least 200 pixels**
    (card surface + hairline + one line of text), while the control rect of the minimap
    panel `(8, 8, 216, 250)` differs in **0 pixels** — the rest of the screen did not
    move. Report the two counts and the method (`renderer.snapshotArea` + `getImageData`).

## 📣 Coordination

- For the Architect: the `[Task-98]` cut is implemented with the HP-loss fact recorded
  by a **pure helper in `missions.ts` called from the scene**, not inside
  `src/engine/run/resolve.ts`, because that file is the batch-mate's (`[Task-83]`) and a
  batch is an antichain. The rule is unchanged: the progress is the HP the party lost on
  the floor, and a casualty fails the mission.
- For the next batch: the mission's **reward row** is data a room task reads
  (`MISSION_TABLE`'s `reward`); `[Task-96]`'s legendary roll and `[Task-93]`'s sacrifice
  are its first readers, and `missionsCompleted` is the run-scoped count they derive
  "once per run" from. A second mission kind is a `MissionKind` + a `MISSION_TABLE` row
  + a branch in `missionMet`, never a second record.
- The schema is now **19**; a task that adds a run field steps to **20**.

## ⛔ Out of scope

- The rewards themselves: no room, no item grant, no money is paid by this task — only
  the row and the counter.
- The mission's own panel or screen: the HUD line and the notice are the whole surface.
- Any second mission kind, any difficulty of mission, any mission roll UI.
- The battle's HP rules, the Pokevial, the heal stop (`advanceMap`'s own heal), the
  casualty counter's meaning and permadeath (`D5`).
- No new dependency, no `package.json` change, no dev-menu key, no new input mode.

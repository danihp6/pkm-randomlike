# Spec: Task-163 — A back press never orders a turn the player did not order

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene.
- **Role:** Dev.
- **Objective:** while the player owes a replacement (the lead fainted and a reserve
  exists), the switch grid is the **only** menu a back press can reach. Today both back
  paths (`onCancel`, `onBack`) route a `party` mode back to `openMenu()`, and `openMenu`
  reads neither `forcedSwitch` nor `state.sides.player.awaitingReplacement`, so it builds
  a command grid with FIGHT enabled. Confirming that FIGHT reaches `submit` →
  `takeTurn` → `validateCommand`, which **throws** ("A replacement must be sent out
  first.") — the scene has no `try`/`catch`, so the press that escapes the forced switch
  is a dead end. After this task the engine owns the predicate
  (`replacementOwed(state)`) and both back paths plus `openMenu` obey it.
- **Environment:** worktree `../wt-pkm-163`, branch `task-163`, base `origin/main`
  @ `e241f9f`.
- **Dependencies:** none — `awaitingReplacement`, `needsReplacement` and `performSwitch`
  all ship.

### Exclusive paths (single writer)

**Nothing outside this list.** `src/engine/battle/turn.ts` is claimed by **Task-167 in
this same batch**: read it, never edit it.

- `src/engine/battle/commands.ts`
- `src/engine/battle/commands.test.ts`
- `src/scenes/BattleScene.ts`
- `docs/battle-spec.md` — **§4 only**. Task-167 owns §3.3 of the same file in this
  batch; do not touch §3.3 and do not reformat the document.

### Inputs (read-only)

- `AGENTS.md`
- `src/engine/battle/state.ts` (the `BattleSide.awaitingReplacement` field, `SideId`)
- `src/engine/battle/turn.ts` (`needsReplacement`, `sideNeedsReplacement`, `performSwitch`
  — **read only**)
- `src/engine/battle/double.test.ts` (the `board` / `emptyTurn` / `autoReplace` idiom)
- `src/engine/battle/commands.test.ts` (the `build` helper)
- `src/scenes/BattleScene.ts`
- `docs/battle-spec.md` §4

## 🔒 Contract

### TypeScript

```ts
// src/engine/battle/commands.ts

/**
 * True when the player side owes a replacement: its active fighter fainted and a
 * healthy reserve exists, i.e. `state.sides.player.awaitingReplacement`. Pure; reads
 * no RNG, no Phaser, no DOM.
 */
export function replacementOwed(state: BattleState): boolean;
```

```ts
// src/scenes/BattleScene.ts — a dev read, on the `battleBagDrawnObjectCount` pattern
// (the exported function only forwards to a private method).

/**
 * The mode a back press (Esc or ◀) opens from the scene's current mode, without
 * performing it: `'party'` while `replacementOwed(this.state)` holds and the mode is
 * one of `'moves' | 'bag' | 'party'`, else `'menu'` for those three modes.
 */
export function battleBackPressMode(scene: BattleScene): string;
```

- **Determinism:** `replacementOwed` reads one boolean field. `battleBackPressMode`
  reads the scene's own mode and that same field. No RNG anywhere in this task.
- **Rules:** `src/engine/battle/commands.ts` stays pure (no Phaser, no DOM). The
  scene keeps its shipped public surface; do not rename or remove any existing export.

### Behaviour (exact)

1. `replacementOwed(state)` returns `state.sides.player.awaitingReplacement`.
2. `onCancel`: in the `'moves' | 'bag' | 'party'` branch, a back press goes through one
   private path that computes the target mode. When the target is `'party'` it sets
   `this.forcedSwitch = true` and calls `this.openParty()`; otherwise it calls
   `this.openMenu()` exactly as today. The `'info'` and `'over'` branches do not change.
3. `onBack` (the ◀ control): same branch, same path.
4. `openMenu()` returns to the switch grid **before** it builds a command menu:
   if `replacementOwed(this.state)`, set `this.forcedSwitch = true`, call
   `this.openParty()`, and return. This guard is the safety net for every other
   caller, so a command grid can never be built while a replacement is owed.
5. Do not change the grid's `enabled` gate, `emptiedPlayerSlot`, the "no reserve → the
   run ends" path (`sideNeedsReplacement` answers `false` on a last Pokémon) or
   `submit`. The bug is the menu that opens, not the switch.
6. The double-battle partner branch (`if (this.double && this.partnerCommand === null …)`)
   keeps working: place the guard at the very top of `openMenu`, and if a shipped
   double-battle test goes red as a consequence, **stop and report it** — do not edit
   `turn.ts` or a test outside your exclusive paths to make it pass.

## 🧩 Data and configuration

None. No data row, no i18n key, no `SAVE_VERSION` step.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-163` audited against the exclusive paths.
  - This task has one `[live]` criterion, so it owes **one** browser pass; the rest are
    commands.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[unit]` `commands.test.ts`: on a single-battle board **with** a reserve,
    `replacementOwed` is `false` on a fresh board, becomes `true` after the lead is
    fainted and the turn emptied (`hp = 0` + `emptyTurn`, the `double.test.ts` idiom),
    and is `false` again once the switch completes (`performSwitch` or the switch
    command through the turn).
  - [ ] `[unit]` `commands.test.ts`: on a board with **no** reserve the same faint
    leaves `replacementOwed` false (the run ends; `sideNeedsReplacement` answers false).
  - [ ] `[unit]` `commands.test.ts`: `replacementOwed` answers only for the **player**
    side — an enemy that owes a replacement does not make it true.
  - [ ] `[live]` In the running dev build, a wild battle
    (`(await import('/src/main.ts')).game.scene.getScene('Battle')`): read
    `battleBackPressMode(scene)` from `/src/scenes/BattleScene.ts` while
    `scene.state.sides.player.awaitingReplacement` is `true` and the scene sits in
    `'moves'` — it must read `'party'`; clear the field and it must read `'menu'`.
    Additionally dispatch Escape and ArrowLeft on the page and read `scene.mode`: while
    the field is set the mode must stay `'party'` (never `'menu'`) and no feed may
    start (`scene.mode !== 'feed'`). Report the two readings and the method
    (CDP `Runtime.evaluate` over the live scene).

## 📣 Coordination

- For the Architect: no plan change; `turn.ts` untouched.
- For the next batch: `replacementOwed` joins `commands.ts` beside `validateCommand`,
  and `openMenu` now returns to the grid while a replacement is owed.

## ⛔ Out of scope

- Any change to `turn.ts`, `state.ts`, `double.test.ts`, the AI, or the battle engine's
  validation.
- A `try`/`catch` around `submit` (the fix removes the dead end at its source).
- The message/log seam or a revealed foe move name — this batch's decision adopts the
  forced-switch reading; the report's alternative stays out.
- A new `.test.ts` file for the scene (the scene decision is measured `[live]`).

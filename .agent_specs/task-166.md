# Spec: Task-166 — The arrows reach a disabled row instead of jumping over it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + two pure `src/ui/` cursor helpers + two doc rows.
- **Role:** Dev.
- **Objective:** In the battle's **command grid** (FIGHT / BAG / SWITCH / RUN) and
  in its **switch grid**, the arrow keys stop on a dimmed row instead of hopping
  over it, so the cursor can reach a disabled row and `confirm` declines it. The
  **moves grid keeps its skip** (a 0 PP or barred move must stay unreachable).
  This is a deliberate change of the shipped accessibility rule of `[Task-08]`
  (`docs/design-spec.md` §10.3), not a regression fix. The grid arithmetic moves
  out of `BattleScene` into pure helpers so the wrap/clamp rules are unit-tested
  headlessly.
- **Environment:** work only in your own worktree
  `/home/runner/work/pkm-randomlike/wt-pkm-166`, branch `task-166`, spec at
  `.agent_specs/task-166.md` inside it. Never work in
  `/home/runner/work/pkm-randomlike/pkm-randomlike` (that checkout is `main`) and
  never push to `main`.
- **Dependencies:** none. The shipped `moveMenuGrid` / `moveMenu` cursor logic and
  `[Task-143]`'s switch card are already on `main`.

### Exclusive paths (single writer)

Nothing outside this list. No new file is created, so no folder `README.md`
changes.

- `src/scenes/BattleScene.ts`
- `src/ui/moveGrid.ts` + `src/ui/moveGrid.test.ts`
- `src/ui/partyGrid.ts` + `src/ui/partyGrid.test.ts`
- `docs/design-spec.md` **§10.3's table rows** `Battle command grid` and
  `Battle switch grid and its detail` — and **no other section of that file**.
  Silence in the rest of the document is part of your contract: another task in
  this batch owns other sections of the same file.

### Inputs (read-only)

- `src/scenes/BattleScene.ts` — the code you change: `moveMenu` (~2887),
  `navigateMenu` (~2899), `moveMenuGrid` (~2922-3029), `confirmMenu` (~3031),
  `renderCommandMenu` (~3692) and `renderPartyGrid` (~3840+) — the cells whose
  `fillColor` a QA reads live are `commandCells` and `partyCells`.
- `src/ui/partyGrid.ts` — `partyGridLayout`, `partyGridFieldRows` (the shipped
  pure layout you sit beside).
- `src/ui/moveGrid.ts` — the shared moves grid; the cursor helper lives here
  because this is where the grid's own rules already live.
- `docs/design-spec.md` §10.3 — the table you edit.
- `src/engine/battle/commands.ts` — `switchablePartyIndices` (what `enabled` means
  for a switch row).

## 🔒 Contract

### `src/ui/partyGrid.ts`

```ts
/**
 * One linear step of the switch grid's cursor, in rows: it never skips a
 * disabled row, because the caller decides what `confirm` does there. Wraps at
 * both ends. `count <= 0` answers 0, and a non-finite index is treated as 0.
 */
export function stepPartyCursor(index: number, delta: number, count: number): number;
```

- `delta` is `-1` or `+1` (the scene normalises `up`/`left` to `-1`).
- `((index + delta) % count + count) % count`, and it must land on **every**
  index: a fainted member or the active lead is reachable from both sides.

### `src/ui/moveGrid.ts`

```ts
export type MoveGridDirection = 'up' | 'down' | 'left' | 'right';

/**
 * One step of a 2D menu grid (the command, partner and moves grids share it).
 * `enabled` is one flag per cell, so `enabled.length` is the cell count and the
 * caller never passes a count it could disagree with. The arithmetic is the
 * shipped `moveMenuGrid` loop: `rows = ceil(count / cols)`, a direction wraps
 * its row or column, and `Math.min(nextRow * cols + nextCol, count - 1)` clamps a
 * partial last row back into it. With `skipDisabled` the step repeats (at most
 * `count` times) until it lands on an enabled cell; without it, one step. If no
 * cell would be accepted the starting index is returned unchanged.
 */
export function stepMoveGridCursor(
  index: number,
  action: MoveGridDirection,
  enabled: readonly boolean[],
  cols: number,
  skipDisabled: boolean,
): number;
```

- `enabled.length === 0` answers `0`. `cols < 1` is treated as `1`.
- An index outside `0 .. enabled.length - 1` is clamped into range before the
  first step.
- With `skipDisabled === false`, the very first computed cell is accepted
  whatever its flag says — that is the whole behaviour change for the command and
  party grids.

### `src/scenes/BattleScene.ts`

- `navigateMenu`: the `moves` / `menu` / `partner` branch and the linear branch
  both route through the helpers:
  - `moves`, `menu`, `partner`:
    `stepMoveGridCursor(this.menuIndex, action, this.menuItems.map((item) => item.enabled), MENU_GRID_COLS, this.mode === 'moves')`
    — the skip is the **moves** grid's alone.
  - `party` (new): `stepPartyCursor(this.menuIndex, action === 'up' || action === 'left' ? -1 : 1, this.menuItems.length)`
    — the switch grid moves on `up`/`down` today; a `left`/`right` press must keep
    the shipped behaviour of that grid (it is one column, so a horizontal press
    moves it like a vertical one does after this change; state the choice in the
    report).
  - `bag` keeps `stepBagGrid`, `target` keeps `moveTarget`.
- **Keep** the shipped `megaSelected` / `gmaxSelected` / `infoSelected` branches
  in `moveMenuGrid` untouched: `right` from the last column still reaches MEGA /
  G-MAX / INFO and `left` walks back out. Only the loop that computes the next
  cell is replaced by the helper.
- `moveMenu` keeps serving the remaining linear list (nothing else may lose its
  skip: the bag grid, the target picker and the info window are untouched).
- `confirmMenu`'s `item?.enabled` gate stays exactly as it is: a disabled row is
  reachable **and** refused. `partyCells` / `commandCells` drawing (the selected
  fill) stays as it is, so a selected disabled row is visibly selected.
- Pointer input (`menuZones`, `partyCells` zones) stays as it is — a click may
  already select a disabled row; the change is keyboard-only.

## 🧩 Data and configuration

No data key, no i18n key, no new constant outside the two helpers. `MENU_GRID_COLS`
stays where it is.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-166` audit against the exclusive paths list
    (and, for `docs/design-spec.md`, the two §10.3 table rows only).
  - `[live]`: a dev server plus CDP over the headless Chromium, as `docs/agent-ci.md`
    describes. Start your own `npm run dev -- --port <free> --strictPort`, stop it
    when done. Read state and drawn colours through the page's own modules
    (`await import('/src/main.ts')` exposes `game`; `await import('/src/ui/frlg.ts')`
    exposes `FRLG_SELECTED_FILL`), not a screenshot. Say which method produced each
    piece of evidence.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `partyGrid.test.ts`: with `enabled` implied by a five-row party,
    `stepPartyCursor(2, +1, 5) === 3`, `stepPartyCursor(4, +1, 5) === 0`,
    `stepPartyCursor(0, -1, 5) === 4`; a disabled row in the middle is reached
    from both sides (index 2 answers 2 from 1 and from 3); `count === 0` answers 0.
  - [ ] `[unit]` `moveGrid.test.ts`: four cells, index 1 disabled —
    `stepMoveGridCursor(0, 'right', [true, false, true, true], 2, false) === 1`
    (lands on the disabled cell with the flag off) and the same call with
    `skipDisabled: true === 2` (skips it); `down` from index 2 with three cells
    clamps into the partial last row (`=== 2`); `right` from the last column wraps;
    `enabled.length === 0` answers 0 and `cols: 0` is treated as 1.
  - [ ] `[unit]` `partyGrid.test.ts` also pins that the helper never reads a
    disabled flag: it has no such argument, so a one-row grid answers 0 for both
    deltas.
  - [ ] `[live]` **Command grid.** Party of one, wild battle
    (`game.scene.getScene('Route').startDebugWildBattle('pidgey', 5)`), wait for
    `scene.mode === 'menu'`, dispatch `ArrowDown` twice (CDP
    `Input.dispatchKeyEvent`, keydown+keyup). Read: `scene.menuIndex === 2`,
    `scene.menuItems[2].enabled === false` (SWITCH, no bench), and
    `scene.commandCells[2].fillColor === FRLG_SELECTED_FILL.colour`. Then
    `Enter`: `scene.mode` is still `'menu'` and no turn was submitted
    (`scene.state.turn` unchanged, no new `scene.state.log` entry of kind
    `'turn'`).
  - [ ] `[live]` **Switch grid.** Add a second member
    (`game.scene.getScene('Route').addDebugPokemon('rattata', 5)`), start a wild
    battle, `ArrowDown` to index 2 + `Enter` → `scene.mode === 'party'`; one
    `ArrowDown` → `scene.menuIndex === 1`; a second `ArrowDown` →
    `scene.menuIndex === 0` (the active lead, `menuItems[0].enabled === false`)
    and `scene.partyCells[0].fillColor === FRLG_SELECTED_FILL.colour`; `Enter`
    leaves `scene.mode === 'party'` with the same active member (a refused
    confirm).
  - [ ] `[live]` **The moves grid still skips.** In `scene.mode === 'moves'` with a
    move whose `enabled` is false (spend its PP to 0 through the dev read or pick a
    barred move), `ArrowRight` from the cell before it answers the next **enabled**
    index, never the disabled one. If the state cannot be built in one battle,
    report the criterion as **not run** and say why — the unit test above is its
    evidence then.
  - [ ] `[unit]` `docs/design-spec.md` §10.3's two table rows say, for the command
    grid and the switch grid, that the cursor **visits** a disabled row and
    `confirm` declines it; the moves row is untouched and no other section of the
    file changed (`git diff -U0 docs/design-spec.md` shows only those two lines).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the next batch: `stepMoveGridCursor` is the one grid-cursor rule of the
  battle; a third 2D grid (a later window) must reuse it with its own
  `skipDisabled` flag instead of copying the loop.
- The keyboard rule is now asymmetric on purpose — a disabled **command** or
  **switch** row is reachable, a disabled **move** is not. `docs/design-spec.md`
  §10.3 is the sentence that says so; any later key that moves a grid should cite
  it.

## ⛔ Out of scope

- The pointer path of either grid (a click already selects a disabled row).
- The moves grid's skip, the bag grid's `stepBagGrid`, the target picker, the info
  window, the ⓘ controls, the Mega / G-Max controls.
- The battle's colours, layout, fonts and the `[Task-58]` chrome pass.
- Any other section of `docs/design-spec.md`; any other scene or any engine rule.

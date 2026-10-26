# Spec: Task-169 — The battle Bag's keys reach the pocket row, and a click picks a stack

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + pure UI model (+ docs).
- **Role:** Dev.
- **Objective:** two seams of the battle's BAG menu.
  1. **The keys reach the pockets.** Today the bag branch of `navigateMenu` only
     steps the stack grid (`stepBagGrid`), so no arrow key ever puts the cursor on
     the pocket row; only the pointer, `[` and `]` change pockets. After this task
     `ArrowUp` from the grid's **top row** moves the focus to the pocket row, `←`/`→`
     there cycle the pockets on offer (wrapping), `↓` returns to the grid's first
     stack, and the grid keeps its shipped stepping rule.
  2. **A click spends.** Today a canvas click on a stack only moves the cursor
     (`selectBagCell`, "It never submits") while the DOM card's `cellPressIntent`
     arms and uses on a second press. After this task a click on a stack **selects
     it and uses it**, exactly as `confirm` does, so `cellPressIntent` answers `use`
     for a stack and `select` only for an empty cell. The arm/use split, the
     disabled rows' rule and the search field's typing stay.
- **Environment:** worktree `../wt-pkm-169`, branch `task-169`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/scenes/BattleScene.ts` (this batch's **only** claim on that file)
- `src/ui/bag.ts`
- `src/ui/bag.test.ts`
- `src/ui/hud/panels/battle-bag/battleBagPanel.tsx`
- `src/ui/hud/panels/battle-bag/view.ts`
- `src/ui/hud/panels/battle-bag/view.test.ts`
- `docs/design-spec.md` — **§10.3 only, and inside it only the bag row** (the bullet
  that says the bag's stacks are browsed with the arrows and used with `confirm`).
  No other section, no other row.

If the folder's role list needs it, `src/ui/hud/panels/battle-bag/README.md` is
**not** yours (no file is added or renamed there). Nothing under `src/data/`, no
`src/main.ts`, no `package.json`, no i18n table.

### Inputs (read-only)

- `AGENTS.md`, `docs/design-spec.md` (`§10.3`), `docs/battle-spec.md` (`§2`).
- `src/ui/bag.ts`'s existing exports (`BAG_GRID_COLS`, `stepBagGrid`,
  `cycleBagCategory`, `stepBagCursor`, `filterBagStacks`), `src/ui/hud/panels/battle-bag/{index.ts,mount.tsx}`,
  `src/scenes/BattleScene.ts` around `openBag`, `refreshBagItems`, `cycleBagTab`,
  `selectBagTab`, `selectBagCell`, `navigateMenu`, `confirmMenu`, the bag zones and
  the `[`/`]` listener, `src/ui/hud/fixtures` (the `?hud=dom` flag).

## 🔒 Contract

### TypeScript

`src/ui/bag.ts` gains one focus type and **two** pure steppers. They are pure: no
Phaser, no DOM, no allocation beyond the returned object.

```ts
/** Where the bag's cursor sits: on the pocket row or in the stack grid. */
export type BagFocus = 'tabs' | 'grid';

/**
 * One arrow press while the bag is open, for the **focus** it lands in and the
 * grid cursor that goes with it. `count`/`columns` describe the stacks on screen
 * (the shipped `stepBagGrid` rule); a focus that stays on the tabs keeps `index`.
 */
export function stepBagFocus(
  focus: BagFocus,
  index: number,
  action: BagGridDirection,
  count: number,
  columns: number = BAG_GRID_COLS,
): Readonly<{ focus: BagFocus; index: number }>;

/**
 * The pocket one arrow press selects, wrapped over the pockets on offer
 * (`left`/`up` = previous, `right`/`down` = next). A one-pocket list answers itself.
 */
export function stepBagTab(
  pockets: readonly BagCategory[],
  category: BagCategory,
  action: BagGridDirection,
): BagCategory;
```

Rules of `stepBagFocus`, exactly:

- `focus === 'grid'` and `action === 'up'` and the cursor is in the **top row**
  (`steps in the grid` means `Math.floor(index / columns) === 0`) → the tabs:
  `{ focus: 'tabs', index }` (the grid index is kept, unchanged, for the way back).
- `focus === 'grid'` otherwise → `{ focus: 'grid', index: stepBagGrid(index, action, count, columns) }`.
- `focus === 'tabs'` and `action === 'down'` → `{ focus: 'grid', index: 0 }`.
- `focus === 'tabs'` otherwise → `{ focus: 'tabs', index }`.
- A grid with no stacks (`count <= 0`) keeps `stepBagGrid`'s own `0`.

`src/scenes/BattleScene.ts` gains one field beside `bagCategory`, a
`private bagFocus: BagFocus = 'grid'`, and:

- `openBag()` resets it to `'grid'`; `cycleBagTab`/`selectBagTab` keep it as it is
  and keep resetting the grid cursor to `0` as they do today.
- `navigateMenu`'s bag branch calls `stepBagFocus(this.bagFocus, this.menuIndex, action, this.bagStacks.length)`,
  writes both fields, and calls:
  - `stepBagTab(this.bagCategories, this.bagCategory, action)` when the focus went
    to (or stayed on) `'tabs'` and the action is `left`/`right` — the pocket changes
    through the shipped `selectBagTab`, since the pockets are a subset of
    `BAG_CATEGORIES` and the scene owns which are on offer;
  - `this.menuIndex = step` when the focus went to the grid (first stack, clamped by
    `stepBagCursor` semantics);
  - one `refreshHud()` either way. When the pocket actually changes, the shipped
    `selectBagTab` already refreshes.
- The `[` / `]` listener (`cycleBagTab`) **stays** as it is.
- `selectBagCell(index)` becomes "select **and** use": it keeps setting
  `this.menuIndex = index` and then runs the same path `confirmMenu` runs for that
  stack (the `menuItems[index].onSelect()`, guarded by `enabled`). A press on an
  empty cell, past the last stack, does nothing. The comment above `selectBagCell`
  and the one on the zone array ("A click selects a cell; it never spends the stack")
  must be updated to the new rule; **no** new behaviour for the search field, the ◀
  back control or the pocket tabs' pointer zones.
- The DOM card's intent receiver (`onBattleBagIntent`) keeps answering `use` and
  `select`; a `select` that now precedes a use in the canvas does not double-spend,
  because the canvas never emits two intents for one press.

`src/ui/hud/panels/battle-bag/battleBagPanel.tsx` — `cellPressIntent` moves to
`view.ts` (it is pure and must be testable without a renderer) and the panel imports
it, keeping the same exported name and signature:

```ts
/** The press a cell answers with: a stack spends its stack, an empty cell picks itself. */
export function cellPressIntent(cell: BattleBagCell): BattleBagIntent;
```

It answers `{ type: 'use', itemId }` for **any** cell with an `itemId` (selected or
not) and `{ type: 'select', index }` for an empty one.

### Data

No data key, no balance value, no new i18n key (every label the bag draws already
exists).

## 🧩 Data and configuration

Nothing new.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-169` against the exclusive paths above.
  - One browser pass (`npm run dev` + CDP) for the single `[live]` criterion.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `bag.test.ts`: the focus walks **grid → tabs → grid** — `up` from a
        top-row index answers `{focus:'tabs'}`; `up` from a lower row stays in the
        grid and steps one row; `down` on the tabs answers `{focus:'grid', index: 0}`.
  - [ ] `[unit]` `bag.test.ts`: `stepBagTab` wraps in both directions over a
        two-pocket list and over the four-pocket list the game can offer, and a
        one-pocket list answers itself.
  - [ ] `[unit]` `view.test.ts`: `cellPressIntent` answers `{type:'use', itemId}` for
        a **deselected** stack cell (today it answers `select`) and for a selected
        one, and `{type:'select', index}` only for a cell whose `itemId` is `''`.
  - [ ] `[unit]` The shipped `view.test.ts` and `fixture.test.ts` stay green (the
        fixture's `toEqual` of the view model is unchanged: no field is added to it).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **Arrows reach the pockets, and one click spends a Potion.**
        Measurement, two runs of `npm run dev`, both read over CDP:
        1. `?hud=dom`, open a battle, open BAG from the command menu: read
           `[data-hud-bag-tab][data-active="true"]` (call it pocket A) and the owning
           `[data-hud-bag-cell]` set; press `ArrowUp`, then `ArrowRight`; the active
           tab attribute must now name the **next** pocket of `bagCategories` and the
           cell set must be that pocket's stacks; press `ArrowDown`; the active tab
           does not change and the first cell is the cursor's
           (`[data-hud-bag-cell="0"]` carries the selected style / the detail line
           `[data-hud-bag-detail]` names that stack).
        2. Plain canvas (no `?hud=dom`): in a wild battle with a Potion in the bag,
           open BAG and click the Potion's cell at the rect `bagGridLayout` gives it
           (CDP `Input.dispatchMouseEvent`, left button, at the cell's centre). Expect
           the card to close, `[data-hud-panel="battle-bag"]` to be absent/hidden in
           the DOM run and, in the canvas run, the bag panel's pixels gone from the
           menu rect by `renderer.snapshotArea` + `getImageData` (compare the same
           rect before and after: the panel's own fill dominates before, not after),
           and the battle's log to carry the item's line and the enemy's reply. One
           click, one use — not two.

## 📣 Coordination

- For the Architect: the bag now has a two-level cursor; `docs/design-spec.md` §10.3
  records it, and the DOM card and the canvas answer the same press.
- For the next batch: `view.ts` exports `cellPressIntent`; `bagPanel` imports it.

## ⛔ Out of scope

- The bag's search field, the ◀ back control, the pocket tabs' pointer zones.
- Re-balancing `MENU_BAG_CAP`, the grid's columns or the pocket order.
- The route HUD's bag panel (`src/ui/hud/panels/bag/**`) — a different surface.

# Spec: Task-196 — The double battle's target step says which foe is marked

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene + DOM panel + data (i18n) + docs.
- **Role:** Dev.
- **Objective:** the target step a double battle opens for a single-target damaging
  move stops being invisible. Its predicate becomes one pure, unit-tested helper in
  the battle command rules (`targetStepFor`), the battle-moves panel grows a **prompt
  row** that names the marked foe (and is `null` while the step is closed), the scene
  feeds the marked slot's name into it while the step is open, and one new i18n key
  prints the question. After this task a player who picks a move in a double battle
  reads *which* foe the canvas cursor is on, in the same card that lists the moves.
- **Environment:** worktree `../wt-pkm-196` (a sibling of this repo, never a junction),
  branch `task-196` off `main`. The Orchestrator has already pushed the spec as
  `spec: task-196`; commit on that tip. When `npm test` and `npm run build` are green,
  leave an **empty** commit `dev: done task-196` on the tip and push `task-196` — the
  QA wave validates that tip. Never commit to `main`, never merge, never create another
  branch. `$ASSETS_ROOT` is `/home/runner/work/_temp/assets/store`: never symlink or
  junction it into the worktree, and pass absolute paths to any packer.
- **Dependencies:** none must be merged first. Builds on the shipped double battle
  (`docs/battle-spec.md` §12: `BattleLaunch.double` → `createBattle({ ..., double })`)
  and the shipped `battle-moves` panel (`src/ui/hud/panels/battle-moves/`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/scenes/BattleScene.ts`
- `src/scenes/BattleScene.test.ts`
- `src/engine/battle/commands.ts`
- `src/engine/battle/commands.test.ts`
- `src/ui/hud/panels/battle-moves/**` — every file in the folder, including
  `view.ts`, `view.test.ts`, `battleMoves.tsx`, `battleMoves.test.ts`,
  `battleMoves.css`, `mount.tsx`, `index.ts`, `fixture.test.ts` and `README.md`
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `docs/battle-spec.md` — **§12 only** (the double-battle section)
- `docs/hud-fidelity.md` — **§5 only** (“Panel geometry”). Do **not** touch §6 or §9

If `src/ui/hud/panels/battle-moves/` gains a file, add its one-line role to that
folder's `README.md` in this task (`AGENTS.md`’s folder-map rule).

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/battle-spec.md` — §12 is the rule this task makes visible.
- `docs/hud-fidelity.md` — §5 carries the numbers the prompt row must respect.
- `docs/agent-spec-template.md`
- `src/engine/battle/state.ts` — `BattleState`, `SideId`, `Slot`, `liveSlots`,
  `activeFighter`, `opponentOf`.
- `src/engine/battle/fighter.ts`, `src/engine/battle/turn.ts` — only for types and
  for the shape of a double `BattleState` in tests.
- `src/ui/moveGrid.ts` — `moveGridCellRects`, `padMoveGridCells`, `MoveGridSlot`.
- `src/ui/hud/panels/battle-hp/view.ts` — `battleHpBox` (the card clears the HP column).
- `src/ui/hud/frlg.ts`, `src/ui/frlg.ts` — `FRLG_WINDOW_PADDING`.
- `src/data/dex/**` — `getMove`, `Move` (the dex’s `target` and `category` fields).
- `src/i18n/index.ts` — `t`, `TranslationKey`.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

**1. The predicate, in `src/engine/battle/commands.ts`** (beside `validateCommand`;
it may use the module’s private `SPREAD_TARGETS` and `SELF_TARGETS`):

```ts
import type { Move } from '../../data/dex';
import type { BattleState, SideId } from './state';

/**
 * True when picking `move` on `side` owes the target step: a double battle whose
 * opposing side still fields **two** standing slots, and a damaging move whose dex
 * target is one slot (not a spread row, not `self`, not `ally`, not `Status`).
 */
export function targetStepFor(state: BattleState, side: SideId, move: Move | null): boolean;
```

- `false` when `state.double` is false.
- `false` when fewer than two of `liveSlots(state, opponentOf(side))` hold a fighter
  with `hp > 0` (`activeFighter(state, opponentOf(side), slot)`).
- `false` when `move` is `null`, `move.category === 'Status'`,
  `move.target === 'self'`, `move.target === 'ally'`, or
  `SPREAD_TARGETS.has(move.target)` (`allAdjacentFoes`, `allAdjacent`, `all`).
- `true` otherwise.
- **Determinism:** reads no RNG, no clock, no Phaser, no DOM; a pure function of its
  arguments.

**2. The panel’s input and view, in `src/ui/hud/panels/battle-moves/view.ts`:**

```ts
export type BattleMovesInput = Readonly<{
  // …the shipped fields unchanged: open, card, cells, selected, info,
  // mega, gmax, megaArmed, gmaxArmed
  /** The marked foe’s name while the target step is open; null while it is closed. */
  target: string | null;
}>;

export type BattleMovesView = Readonly<{
  // …the shipped fields unchanged
  /** The step’s prompt row: the question naming the marked foe, or null. */
  target: Readonly<{ label: string; box: Rect }> | null;
}>;
```

- `target.label` is exactly `t('battle.targetPrompt', { name: input.target })`.
- `target` is `null` when `input.target` is `null`; a non-empty name always yields the
  row (an empty string is treated as closed).
- `target.box` is the **page-space** box inside the card’s top band, and the four move
  cells are untouched by it:
  `x = card.x + FRLG_WINDOW_PADDING.x`,
  `y = card.y + 1`,
  `w = card.w - FRLG_WINDOW_PADDING.x * 2`,
  `h = 22`.
  Export the two numbers so a test can pin them:
  `export const MOVE_TARGET_TOP = 1;` and `export const MOVE_TARGET_H = MOVE_INFO_SIZE;`.
- **Rule:** `target.box.y + target.box.h <= slot.box.y` for all four
  `view.slots` at both QA viewports (the card’s top padding is 16 px + the grid’s
  8 px inset, so the 22 px row ends 1 px above the first cell).
- The view stays pure and total: the same input deep-equals, out-of-range indices clamp.

**3. The DOM card, in `src/ui/hud/panels/battle-moves/battleMoves.tsx`:**

```ts
// inside the card, only when view.target !== null:
<span
  class="battle-moves__target"
  data-hud-move-target
  style={insetStyle(view.target.box, card)}
>
  {view.target.label}
</span>
```

`battleMoves.css` paints `.battle-moves__target` as `position: absolute`, one line
(`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`), body type
(`var(--hud-type-body-size)` / `var(--hud-type-body-line)`), `color: var(--hud-text-ink)`,
vertically centred in its box.

**4. The scene, in `src/scenes/BattleScene.ts`:**

- `private needsTargetStep(slot, moveIndex)` is **deleted**; `chooseMove` reads the
  engine helper once:

```ts
if (targetStepFor(this.state, 'player', getMove(fighter.moves[moveIndex]?.moveId ?? '') ?? null)) {
  this.openTargetStep(slot, moveIndex);
  return;
}
```

- `private liveFoeSlots()` stays (the cursor and `moveTarget` still need it).
- `battleMovesInput` now reports the step as an open card and feeds the name:

```ts
open: this.mode === 'moves' || this.mode === 'target',
target:
  this.mode === 'target' && this.targetSlot !== null
    ? (this.slotFighter('enemy', this.targetSlot)?.name ?? null)
    : null,
```

- Nothing else about the step changes: `openTargetStep` still parks the cursor on
  `liveFoeSlots()[0]`, `moveTarget` still cycles the live slots,
  `confirmTarget` still submits
  `{ type: 'fight', moveIndex, slot: this.commandSlot, target: { side: 'enemy', slot: target } }`.
- No new `Rng` draw is added, so no seed, stream or battle log moves.

### Data

Three keys, authored in `src/i18n/en.ts` first and overlaid by key in
`src/i18n/es.ts` (`D43`); insert them in the `// battle — BattleScene's chrome`
block, next to `battle.promptAction`:

| key | en | es |
| --- | --- | --- |
| `battle.targetPrompt` | `Which foe? {name}` | `¿A cuál? {name}` |

- One token, `name`; it is the **only** param call sites may pass (the i18n suite
  compares a call site’s params with the key’s tokens).
- Both tables must carry the key (the suite asserts key parity both ways).

### Docs (the sections this task owns)

- `docs/battle-spec.md` **§12**: append one sentence to the paragraph that starts
  “The **screen** reads one flag and adds no rule” — the step now says what it means.
  Wording to ship (adjust only for line wrapping): “The target step is **visible**: a
  single-target damaging move in a double battle with two live foes opens it, a prompt
  names the marked foe (`battle.targetPrompt`), the arrows move the mark and the prompt
  with it, and a press on a foe marks it or confirms the mark.” Do not renumber,
  restate or re-derive any rule above it.
- `docs/hud-fidelity.md` **§5**: append one paragraph after “The compact battle has its
  own cell.”, titled “**The target step’s prompt.**”, stating: the row is **22 px**
  tall (the ⓘ’s own size) and lives inside the card’s top band — `x = card.x + 20`,
  `y = card.y + 1`, `w = card.w − 40`, `h = 22` on both widths — so it ends **1 px**
  above the first cell (the grid starts at the card’s 16 px padding plus its 8 px
  inset) and is one line that never meets the four cells at 1280×800 or 390×844; it
  prints the marked foe’s name and nothing else.

## 🧩 Data and configuration

None beyond the two i18n keys above. No balancing value, no JSON table, no new asset.
The panel draws with the shipped tokens (`--hud-type-body-size`, `--hud-text-ink`).

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree (no
    `node_modules` is inherited).
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-196` audit against the exclusive paths list.
  - This task has `[live]` criteria, so QA owes a browser pass: `npm run dev --
    --port <free> --strictPort`, its own tab, Chromium over CDP, DOM rect arithmetic
    (`getBoundingClientRect`, `textContent`). Stop the server when done.
- **Acceptance criteria:** every one is tagged **`[unit]`** (a headless command, a
  decoded asset, a pinned number — seconds and deterministic) or **`[live]`** (it only
  exists in the running game: layering, overlap, a band, a beat, a colour on screen).
  QA runs them all, but its browser budget goes to the `[live]` ones, so an untagged
  criterion is a spec bug. A `[live]` criterion states its **measurement** — what to
  read, on which layout, against which bound — so QA reproduces it instead of
  inventing one.
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass (`npm test`): the four
        `targetStepFor` cases, the view’s null/name and geometry at 1280×800 and
        390×844, the DOM row’s presence and label, the scene seam, and the two keys.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-196` lists only them).
  - [ ] `[unit]` `targetStepFor` walks the four cases: a double state with two
        standing foes answers `true`; the same state with one standing foe answers
        `false`; a `SPREAD_TARGETS` move (`allAdjacentFoes`) answers `false`; a
        `Status` move and a `self`/`ally` move each answer `false`.
  - [ ] `[unit]` `battleMovesView({ ..., target: 'Pidgey' }).target` is the prompt
        whose `label` is `t('battle.targetPrompt', { name: 'Pidgey' })`, and
        `battleMovesView({ ..., target: null }).target` is `null`.
  - [ ] `[unit]` At `battleMovesBox({ width: 1280, height: 800 })` and
        `battleMovesBox({ width: 390, height: 844 })`, `target.box` has `h === 22`,
        and `target.box.y + target.box.h <= slot.box.y` for all four slots.
  - [ ] `[unit]` The panel renders exactly one `data-hud-move-target` node carrying
        `view.target.label` when `view.target !== null`, and none when it is `null`
        (walk the Preact props, as `battleMoves.test.ts` already does).
  - [ ] `[unit]` `src/scenes/BattleScene.ts` calls `targetStepFor(` exactly once,
        defines no `needsTargetStep`, and its `battleMovesInput` reads
        `this.mode === 'target'` into both `open` and `target` (source-seam test, the
        `BattleScene.test.ts` precedent).
  - [ ] `[unit]` `en['battle.targetPrompt']` and `es['battle.targetPrompt']` both
        declare exactly the token `name`, and the Spanish string carries no character
        the FRLG font lacks (the repo’s own i18n suite proves it; a direct assertion
        in `view.test.ts` pins the wording).
  - [ ] `[live]` **A double battle’s prompt names the mark and follows it.** Reach one
        with this exact recipe on the dev server: (1) open `/?hud=dom` at 1280×800;
        (2) start a run and pick any starter; (3) press `F`, open the PARTY tab, type
        a second species (e.g. `pidgey`) and press **Add**, so the party fields two
        actives for the boss’s double; (4) read the run’s seed (the dev menu’s ROUTE
        tab input, or `JSON.parse(localStorage.getItem('pokerandomlike.save')).run.seed`
        — `SAVE_KEY` in `src/engine/save.ts`) and evaluate in
        the page:
        `(await import('/src/data/bosses.ts')).bossIsDouble('boss', seed, 1, 'room:' + (await import('/src/engine/maps/plan.ts')).planMap(seed, 1).bossRoom)`;
        if `false`, start a new run (`N` at the menu) and repeat — the roll is a pure
        function of the seed; (5) with `true`, use the dev menu’s MAP tab to jump to
        floor `1` and that `bossRoom`, then walk to the boss and confirm on it;
        (6) press FIGHT and pick a **damaging** move (a cell whose category is not
        `STATUS`). Measure: `[data-hud-move-target]` exists; its `textContent` equals
        the name in `[data-hud-hp="enemy-0"] .battle-hp__name`; after one Right (or
        Down) key it equals the name in `[data-hud-hp="enemy-1"] .battle-hp__name`;
        the prompt’s `getBoundingClientRect()` is inside
        `[data-hud-panel="battle-moves"]`’s rect and its `bottom` is `<=` the `top` of
        every `[data-hud-move-slot]` rect; confirming (`A`) makes the marked foe’s
        `[data-hud-hp-value]` differ from its value before the turn while the other
        foe’s text is unchanged (if the move missed or had no effect, take the next
        turn with another damaging move and measure again).
  - [ ] `[live]` **The prompt survives the phone.** Rebuild the same fight at
        390×844: start a new run with the **same seed** (the starter screen’s `S`
        prompt), add a second party member again with the dev menu, jump to the same
        boss room, open the target step and measure: `[data-hud-move-target]` exists,
        is one line (`scrollWidth <= clientWidth + 1`), its rect has `height === 22`
        and `width === card.width - 40` (±1), and its `bottom` is `<=` the `top` of all
        four `[data-hud-move-slot]` rects at 390×844.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- For the Architect: this task holds the batch’s only `src/scenes/BattleScene.ts`
  (serial chain `196 → 206`), the batch’s only `src/i18n/{en,es}.ts`
  (chain `190 → 196 → 211`), the only `battle-moves/**` (chain `193 → 196 → 203 →
  214`) and `docs/hud-fidelity.md` **§5**. This spec claims §5 only: §6 and §9 belong
  to other tasks and must be left byte-identical.
- For the next batch: `BattleMovesInput` gained a **required** `target` field and
  `BattleMovesView` gained `target`; `mount.tsx`’s `CLOSED` input and
  `fixture.test.ts` must pass `target: null`, and `design/fixtures/05-battle-hud.json`
  is **not** edited (the fixture test supplies the field). `Task-203` rewrites this
  panel’s cells and must keep `data-hud-move-target` and the 22 px top band intact;
  `Task-206` adds the command window and must not move the card.
- For `Task-211`: the i18n pair is released after this task; the only key this task
  adds is `battle.targetPrompt`.
- For QA: the card is visible during the target step **because the scene reports
  `open: this.mode === 'target'` too**; a run in which the card closes during the
  step is a bug in this task, not in the panel.

## ⛔ Out of scope

- No change to the target rules themselves: `validateTarget`, `FightCommand.target`
  and `turn.ts` stay as shipped, and `docs/battle-spec.md` §12’s rules are not
  reworded beyond the prompt sentence.
- No prompt on the canvas: the Phaser message box and the FRLG cursor stay as they
  are; only the DOM card gains the row.
- No new target step for single battles, spread moves, status moves or a one-member
  party; no “cancel” key on the step beyond the shipped `onBack`.
- No fixture payload in `design/fixtures/**` (that folder belongs to another task),
  no `src/ui/hud/commands.ts` change, no new dependency, no `package.json` edit.
- No restyling of the four cells, the ⓘ, the ◀, the formes or the description card.

# Spec: Task-204 — Every stat prints the rule the board draws under it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM panel + docs (the panel’s measured geometry).
- **Role:** Dev.
- **Objective:** the stats and ranking screens stop printing their figures bare.
  Every figure of the TOTALS grid draws the 1 px rule the board draws under its value,
  and every table row (the run list, the Pokémon table and both ranking tables) draws
  the same rule, all from the token `stats.css` already carries (`--stats-rule`,
  white at 8 %) — never a new alpha per panel. The rule’s geometry is measured data on
  `StatsBoard` (the frames’ own `stat N rule` / `m rule …` rectangles), so the panel
  positions it at both widths and a new figure inherits it by being a figure.
- **Environment:** worktree `../wt-pkm-204` (a sibling of this repo, never a junction),
  branch `task-204` off `main`. The Orchestrator has already pushed the spec as
  `spec: task-204`; commit on that tip. When `npm test` and `npm run build` are green,
  leave an **empty** commit `dev: done task-204` on the tip and push `task-204` — the
  QA wave validates that tip. Never commit to `main`, never merge, never create another
  branch. `$ASSETS_ROOT` is `/home/runner/work/_temp/assets/store`: never symlink or
  junction it into the worktree, and pass absolute paths to any packer.
- **Dependencies:** none must be merged first. Builds on the shipped stats panel
  (`src/ui/hud/panels/stats/`) and the board frames `design/frames/08-stats-totals.json`,
  `m08-stats-totals.json`, `08b`, `08c`, `09`, `09b` and their `m…` twins (read-only).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/ui/hud/panels/stats/**` — every file in the folder, including `view.ts`,
  `view.test.ts`, `statsPanel.tsx`, `stats.css`, `index.ts`, `fixture.test.ts`,
  `README.md` (and any new file the rule needs inside this folder)
- `docs/hud-fidelity.md` — **§6 only** (“Frame → node map”): append one paragraph
  after the table. Do **not** touch §5 (`Task-196`) or §9 (`Task-202`)

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/hud-fidelity.md` — §5’s panel rules and §6’s frame → node map.
- `design/frames/08-stats-totals.json`, `design/frames/m08-stats-totals.json`,
  `design/frames/08b-stats-runs.json`, `design/frames/08c-stats-pokemon.json`,
  `design/frames/09-ranking.json`, `design/frames/m08-stats-totals.json` and the
  `m…` twins — the measured rectangles, read only through the existing test helpers.
- `docs/agent-spec-template.md`
- `src/ui/hud/panels/stats/view.ts`, `statsPanel.tsx`, `stats.css`, `fixture.test.ts`,
  `view.test.ts` — the panel this task extends.
- `src/styles/root.css` — `--hud-*` tokens (read only; `--stats-rule` is declared in
  `stats.css`, not here).
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx` — the `useCompactViewport` pattern
  this panel copies (read only; do not edit it).

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

In `src/ui/hud/panels/stats/view.ts`:

```ts
/** The breakpoint `stats.css` switches its phone column at; the panel reads it. */
export const STATS_NARROW_QUERY = '(max-width: 600px)';

export type StatsBoard = Readonly<{
  // …the shipped fields unchanged: panel, title, blurb, tabs, figureLabel,
  // figureValue, row, button
  /**
   * Where each figure’s rule sits: one on every figure of the TOTALS grid, in page
   * coordinates at the board’s own width. `columns` is the grid’s column count,
   * `colPitch` / `rowPitch` the pitch between two figures.
   */
  figureRule: Readonly<{
    x: number;
    y: number;
    w: number;
    h: number;
    colPitch: number;
    rowPitch: number;
    columns: number;
  }>;
}>;

/** The rule box of the figure at `index` (0 … 11), in page coordinates. */
export function figureRuleBox(board: StatsBoard, index: number): StatsRect;

/**
 * The same box in the figure block’s own coordinates (what the panel positions
 * inside `.stats__figure`): the rule is identical for every figure of a board.
 */
export function figureRuleLocal(board: StatsBoard): StatsRect;
```

The two boards carry these exact numbers (measured from the frames and pinned by
`fixture.test.ts`):

| board | `figureRule` |
| --- | --- |
| `statsBoard('desktop')` | `{ x: 120, y: 274, w: 320, h: 1, colPitch: 360, rowPitch: 88, columns: 3 }` |
| `statsBoard('narrow')` | `{ x: 32, y: 228, w: 165, h: 1, colPitch: 169, rowPitch: 62, columns: 2 }` |

- `figureRuleBox(board, i)` is
  `{ x: rule.x + (i % rule.columns) * rule.colPitch, y: rule.y + Math.floor(i / rule.columns) * rule.rowPitch, w: rule.w, h: rule.h }`;
  an index outside `0 … 11` clamps to `0`.
- `figureRuleLocal(board)` is
  `{ x: 0, y: rule.y - board.figureLabel.y, w: rule.w, h: rule.h }`
  (`{ x: 0, y: 44, w: 320, h: 1 }` on the desk, `{ x: 0, y: 50, w: 165, h: 1 }` on the
  phone).
- The rule is **under the value** and **never meets the next row**: for every
  `i` in `0 … 11`,
  `figureRuleBox(board, i).y >= board.figureValue.y + row * rowPitch + board.figureValue.h`
  and, when a row below exists,
  `figureRuleBox(board, i).y + 1 <= board.figureLabel.y + (row + 1) * board.figureLabel.pitch`
  (row = `Math.floor(i / columns)`). Both boards pass.

The panel (`statsPanel.tsx`) adds, with no other view change:

- a `useCompactViewport()` hook keyed on `STATS_NARROW_QUERY` (the
  `mainMenuPanel.tsx` pattern), so the board is `statsBoard(compact ? 'narrow' : 'desktop')`;
- one rule node inside each figure of `view.figures`:
  `<span class="stats__figure-rule" data-hud-stats-rule aria-hidden="true" style={ruleStyle} />`
  where `ruleStyle` is `figureRuleLocal(board)` as `left`/`top`/`width`/`height` px;
- one rule node as the **last child of every `.stats__row`**:
  `<span class="stats__row-rule" data-hud-stats-rule aria-hidden="true" />`.

`stats.css` paints both from the existing token, which is **not** re-invented:

```css
.stats__figure-rule,
.stats__row-rule {
  position: absolute;
  height: 1px;
  background: var(--stats-rule); /* the shipped `rgb(255 255 255 / 8%)` */
}
.stats__row-rule {
  right: 0;
  bottom: 0;
  left: 0;
}
```

`--stats-rule` keeps its shipped value and comments. The `.stats__figure` block stays
`position: relative` (it already is) and no other geometry moves.

### Data

No JSON, no i18n key, no `SAVE_VERSION`, no new token. The only values introduced are
the eight `figureRule` numbers per board, copied from
`design/frames/08-stats-totals.json` (`stat 0/1/3 rule`) and
`design/frames/m08-stats-totals.json` (`m rule RUNS PLAYED`, `m rule WINS`,
`m rule ROUTES CLEARED`) by the fixture test.

### Docs (the section this task owns)

- `docs/hud-fidelity.md` **§6**: after the frame → node table, before `## 7`, append one
  paragraph titled “**The figure’s rule.**” stating: every figure of `08` / `m08` draws
  the `stat N rule` rectangle — **1 px**, white at **8 %** (`--stats-rule`, not a new
  alpha), **320 px** at x `120` / `480` / `840` on the desk and **165 px** at x `32` /
  `201` on the phone, with an **88 px** row pitch (desk) and **62 px** (phone); the run
  list and the Pokémon table carry the same 1 px rule flush with the bottom of each row
  card (no frame node — the row cards are the frame’s own node there), and a new figure
  inherits the rule by being a figure. Do not touch §5 or §9.

## 🧩 Data and configuration

- Rule height `1` px, width `320` px (desk) / `165` px (phone), always the full figure
  column; the token’s alpha (8 %) is the board’s and is not retyped.
- Row rules are full-width, flush with the row card’s inner bottom edge; the row’s own
  outline stays.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-204` audit against the exclusive paths list.
  - This task has `[live]` criteria, so QA owes a browser pass: `npm run dev --
    --port <free> --strictPort`, its own tab, Chromium over CDP. The fixtures mount the
    screens without a run: `/?hud=dom&hudFixture=08-stats-totals`,
    `…=08b-stats-runs`, `…=08c-stats-pokemon`. Measure `getBoundingClientRect()` and
    `getComputedStyle`. Stop the server when done.
- **Acceptance criteria:** every one is tagged **`[unit]`** or **`[live]`**; a `[live]`
  one states its measurement.
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass (`npm test`): the two boards’
        rule geometry, the twelve boxes, the row rule in the rendered rows and the
        fixture pin against the frames.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-204` lists only them).
  - [ ] `[unit]` Each figure’s view returns a rule box under its value and the boxes
        never intersect the next row: for both boards and every `i` in `0 … 11`,
        `figureRuleBox(board, i).y >= valueBottom(i)` and, when a row follows,
        `figureRuleBox(board, i).y + figureRuleBox(board, i).h <= nextLabelTop(i)`
        (the numbers in the Contract).
  - [ ] `[unit]` The fixture test pins `statsBoard('desktop').figureRule` to
        `rectOf(frame08, 'stat 0 rule')` plus `rectOf(frame08, 'stat 1 rule')`’s x
        pitch and `rectOf(frame08, 'stat 3 rule')`’s y pitch, and
        `statsBoard('narrow').figureRule` to `m rule RUNS PLAYED` / `m rule WINS` /
        `m rule ROUTES CLEARED` the same way.
  - [ ] `[unit]` Every rendered `.stats__row` carries exactly one
        `data-hud-stats-rule` child (walk the Preact props of each mode’s rows), and
        each figure carries one; the panel uses `statsBoard` for the layout it is in
        (`STATS_NARROW_QUERY`).
  - [ ] `[unit]` `stats.css` paints both rule nodes from `var(--stats-rule)` and the
        token still reads `rgb(255 255 255 / 8%)` (a stylesheet read, the existing
        `drawnTextWidth`/cssSize pattern).
  - [ ] `[live]` **The totals grid shows one rule per figure at both widths.** At
        1280×800 with `/?hud=dom&hudFixture=08-stats-totals`: the page has exactly 12
        `[data-hud-stats-figure]` and exactly 12 `[data-hud-stats-rule]` inside the
        grid; every rule’s rect has `height === 1`, its
        `getComputedStyle(rule).backgroundColor` is `rgba(255, 255, 255, 0.08)`, its
        `top` is `>=` the `bottom` of the `[data-hud-stats-value]` in the same figure,
        and, for every figure that has one a grid row below (`i + 3 < 12` at 1280,
        `i + 2 < 12` at 390), its `bottom` is `<=` the `top` of that figure
        (`[data-hud-stats-figure]` index `i + 3` / `i + 2`). Repeat at
        390×844 with the same URL: 12 figures, 12 rules, and at least one rule’s width
        is 165 px (±1).
  - [ ] `[live]` **The run list and the Pokémon table show the rule too.** At
        1280×800 with `/?hud=dom&hudFixture=08b-stats-runs` and with
        `…=08c-stats-pokemon`: the number of `[data-hud-stats-rule]` elements inside
        `[data-hud-stats-table]` equals the number of `[data-hud-stats-row]` elements,
        each rule’s rect is 1 px tall, its `left` equals its row’s `left` (±0.5) and
        its `bottom` equals its row’s `bottom` (±1). Repeat both URLs at 390×844.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- For the Architect: this task holds the batch’s only `stats/**` and
  `docs/hud-fidelity.md` **§6**. The instruction that assigned §6 here is recorded in
  this spec because the TODO’s own `Docs:` line named the file without a section; §5
  and §9 are other tasks’ this batch.
- Deviation from the TODO’s wording, forced by the code: `liveStatsView(history,
  mode, monthKey, now)` has **no viewport**, and its caller is
  `src/scenes/MainMenuScene.ts` — which this task does not own. A per-figure **page**
  box inside `StatsView` therefore cannot be right at both widths, so the measured
  geometry lives on `StatsBoard` (`figureRule`, read by the panel with the same 600 px
  query the stylesheet uses) and the view exposes the two pure helpers. The board is
  the view’s own measured model, and `StatsFigure` keeps its `{ id, label, value }`
  shape so `fixtureStatsView` still rebuilds a payload unchanged.
- The row rule is not a frame node (08b/08c draw row cards, not rules); it is the same
  token under each row’s numbers, which is what the TODO’s `[live]` line asks the run
  list and the Pokémon table to show. `docs/hud-fidelity.md` §6’s paragraph says so
  explicitly, so a later task does not “fix” it back.
- For the next batch: `Task-199`’s shared helper lands in the same folder a batch
  later and inherits `figureRule`/`figureRuleLocal`; it must keep the 12 figures and
  their ids. `Task-210`/`211` split the menu’s STATS row and do not touch this panel.
- For QA: the fixtures mount the screens with no run and no save, so nothing here
  depends on a playthrough; the panel is only mounted under `?hud=dom`.

## ⛔ Out of scope

- No new figure, no change to the twelve ids, their labels, their values, the em
  dash, the sort orders, the month chip or the empty states.
- No change to `--stats-rule`’s colour or alpha, no per-panel alpha, no new token in
  `src/ui/hud/styles/root.css` or `design/tokens.json`.
- No change to the panel/card/tab/table geometry (the boards keep every shipped rect
  except the new `figureRule` field), and no `design/fixtures/**` or
  `design/frames/**` edit.
- No other screen’s rule: the main menu, the party card, the battle panels and the
  run-over screen are not touched; `Task-203`/`206`/`212` own their own sections.
- No dependency, no `package.json`, no i18n key, no `SAVE_VERSION` step.

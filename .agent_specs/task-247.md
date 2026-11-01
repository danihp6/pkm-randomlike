# Spec: Task-247 — The PC box and its RIP list are wired to its spec (`03p-panels-pc-rip`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03p Panels · pc rip` is **measured** instead of
  `pending`: a new adapter `src/ui/hud/specGap.views/pc.ts` builds the PC card's `PanelView`
  from `design/fixtures/03p-panels-pc-rip.json` on its RIP tab at 1280×800, claims the
  **seven strings** the card and the frame agree on (the `RIP` tab's label and the six dead
  members' names), claims no box — the card is a 344 × 378 grid at `576, 72` where the board
  draws a 304 × 243 list at `24, 348` — and writes the rest of the comparison down as
  measured numbers in the adapter's doc comment and in a new test. No game behaviour and no
  pixel of the route changes.
- **Environment:** worktree `../wt-pkm-247`, branch `task-247`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/notices.ts` and `.../detail.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03p Panels · pc rip` (`design/board.json`, node `6:2525`), **33 boxes,
  20 strings, 19 colours**, viewport 1280×800. Its card is `pc panel` `(24, 348, 304, 243)`
  with `pc panel highlight` `(36, 360, 280, 1)`, `key pc` `(36, 360, 24, 24)`,
  `pc search field` `(68, 360, 190, 24)`, `pc search icon` `(76, 367, 10, 10)`,
  `pc view toggle` `(292, 360, 24, 24)` with two thumbs and two lines, `pc rip button`
  `(264, 360, 24, 24)` on the accent with `pc rip icon` `(268, 364, 16, 16)`, and
  `rip viewport` `(36, 396, 280, 183)` holding **six `rip row 0…5`** of 280 × 38 at a
  **44 px pitch**, each with a 24 × 24 `rip icon n` at `(8, 7)` and the `rip name n` /
  `rip meta n` / `rip tag n` lines.
- **The frame draws a list; the card paints a grid.** The shipped card is
  `pcPanelBox({ width: 1280, height: 800 })` = `{ x: 576, y: 72, w: 344, h: 378 }` — a delta
  of **dx +552, dy −276, dw +40, dh +135** — and `pcPanelView` lays out **16** cells of
  76 × 76 in a 4 × 4 band (`view.grid.band`, panel-relative `14, 50, 316, 316`; viewport
  `590, 122, 316, 316`) for **both** panes: `rip` is a tab flag (`PcPanelView.rip` is
  `{ active, locked, box }`), so there is **no per-row box at all** — no `rip row`, no
  `rip icon`, no `rip meta`, no `rip tag`.
- **The header controls are not the card's.** The frame's `pc search field`/`icon`, its
  `pc view toggle` with its thumbs and lines, and its `pc rip button` have no field in
  `PcPanelView`: the shipped card paints a **page-tab strip** (`view.tabs`) and one 32 × 26
  `RIP` tab (`view.rip.box`, `locked: true` always — the dead are read-only, `D5`), which at
  this viewport is `868, 88, 32, 26` against the board's 24 × 24 icon button at
  `264, 360`.
- **The six names are the frame's own.** `design/fixtures/03p-panels-pc-rip.json` carries
  `ui: { pane: 'rip', page: 0, cursor: 0 }`, `pc.pageCount: 1` and six rows whose names are
  exactly the frame's `rip name 0…5`: `PSYDUCK`, `MACHOP`, `RATICATE`, `GLOOM`, `ZUBAT`,
  `DODUO` (levels 30, 27, 22, 19, 16, 21 — the frame's `rip meta n` agrees on the level).
  The card prints those six names in its cells, so the six names **and** the `RIP` label
  the tab paints are claimable as strings.
- **What the copy misses, and why it is not claimed:** the frame's `rip meta n` is one line
  `LV 30 · ROUTE 3` where the card prints `t('hud.level')` = `Lv30` on one line and `0/92`
  on another and never names a route (the space and the missing route are the
  `common.level` defect registered under **Bugs**); the page tab prints `1` where the frame
  draws no page number; a status label would print only when a row carries one and every
  fixture row carries `null`.
- **The card's chip and the strip's disagree, and neither is this row's:** `pcPanelView`'s
  `chip.letter` is `O` (`CHIP_LETTER`), while the strip's letter for the `box` card is `C`
  (`STRIP_CHIP_LETTERS`) and the frame's `key letter pc` is `C`. The chip is a control
  (frame `03c`'s row, Task-245) and the shipped PC card draws it flush at the card's corner
  while the board insets it 12 px; **claim neither letter here**.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/pc.ts` — new.
- `src/ui/hud/panels/pc/specGap.test.ts` — new.
- `src/ui/hud/panels/pc/README.md` — **one new line** in its `## Layout` list, and nothing
  else in that file: the folder's title line names the frame its *paint* came from (frame
  `03b` carries the PC group) and stays as it is.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03p-panels-pc-rip`
  (`'the PC box and its RIP tab; no view builder is wired'`) is deleted at merge. While it
  is still there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03p-panels-pc-rip`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03p-panels-pc-rip` row in `The spec gap, measured (D57)`
  flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`specGap.views/hud.ts`, `specGap.views/detail.ts`, `src/ui/hud/panels/pc/view.ts`,
`pcPanel.tsx`, `pc.css`, `pcPanel.test.ts`, `view.test.ts`,
`src/ui/hud/panels/{party,bag,map,hud}/**`, `src/i18n/**`, `src/scenes/**`,
`src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry",
  "Chips" and "A panel's chip and its compressed state", and the `The spec gap, measured
  (D57)` table), `design/README.md`.
- `design/screens/03p-panels-pc-rip.json` and `design/exports/03p-panels-pc-rip.png` —
  frame **`03p Panels · pc rip`**, 1280×800.
- `design/fixtures/03p-panels-pc-rip.json` — its `ui` block (`pane`, `page`, `cursor`) and
  its `pc` block (`pageCount`, `rows`).
- `src/ui/hud/panels/pc/` — the whole folder, especially `view.ts` (`pcPanelBox`,
  `pcPanelView`, `PcPanelView`, `PcCellView`, `PcPanelUi`, `PcRow`, the `PC_*` mirror
  constants), `pcPanel.tsx` (the `RIP` label at its `pc__rip-label`) and the `README.md`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`, `src/ui/hud/specGap.views/detail.ts`,
  `src/ui/hud/panels/detail/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for `hud.level` and the `common.level` key the Bugs
  entry names, to quote them.

## 🔒 Contract

`src/ui/hud/specGap.views/pc.ts` exports exactly two names:

```ts
export const slug = '03p-panels-pc-rip';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03p-panels-pc-rip.json` as a module default and
  builds the card exactly as the route scene does, on the RIP tab:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const view = pcPanelView(FIXTURE.pc.rows, FIXTURE.ui, FIXTURE.pc.pageCount, DESKTOP);
  ```

  `FIXTURE.ui.pane` is `'rip'`, so `view.rip.active` is `true` and the sixteen cells are the
  RIP list the frame draws as six rows.
- **Boxes:** `[]`. Claim a box only when the shipped rect for it is within `GAP_TOLERANCE`
  of the frame's box of that name, the way `specGap.views/detail.ts`'s `cardClaim` does, so a
  card that lands on the board becomes a claim instead of a silent pass. The candidates and
  their shipped rects, all outside the tolerance here:
  - `pc panel`: frame `24, 348, 304, 243`; shipped `view.box` = `576, 72, 344, 378`.
  - `pc panel highlight`: frame `36, 360, 280, 1`; shipped `view.highlight`
    (panel-relative `12, 12, 320, 1`) → viewport `588, 84, 320, 1`.
  - `key pc`: frame `36, 360, 24, 24`; shipped `view.chip.box` (panel-relative `0, 0, 24,
    24`) → viewport `576, 72, 24, 24`.
  - `rip viewport`: frame `36, 396, 280, 183`; shipped `view.grid.band` (panel-relative
    `14, 50, 316, 316`) → viewport `590, 122, 316, 316`. Name it only if it ever matches;
    do not rename the band to force it.
- **Strings:** exactly these seven, in this order — the tab's label first, then the six
  cells' names:

  ```ts
  const RIP_LABEL = 'RIP'; // pcPanel.tsx's pc__rip-label, typed there as a literal
  const strings = [RIP_LABEL, ...view.cells.filter((cell) => cell.memberId !== null).map((cell) => cell.name)];
  // ['RIP', 'PSYDUCK', 'MACHOP', 'RATICATE', 'GLOOM', 'ZUBAT', 'DODUO']
  ```

  `RIP` is a literal in the component (not a `t` key), so the adapter types the same three
  letters and says so in the comment. Claim a string only when `gapFor`'s own fold makes it
  the board's: the six names are the frame's `rip name 0…5`, and `RIP` is its six
  `rip tag n`. Everything else the card prints — `Lv30`, `0/92`, the page tab's `1` — is
  **not** claimed, and the comment says why with the numbers.
- **Colours:** `[]`. The card's card, slot and RIP paint is `pc.css`'s tokens plus the
  geometry tokens in `pc.css`; the view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no DOM and no store. `pcPanelView` is pure and
  the fixture is a module constant.
- You may read `spec` only as a **structural selector** — is this box name in the frame, is
  this line the board's text. Never filter strings or colours by the spec's content beyond
  that.

### The table the doc comment carries

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `pc panel` | `24, 348, 304, 243` | `view.box` = `576, 72, 344, 378` | dx +552, dy −276, dw +40, dh +135: the board draws a 304 × 243 list card bottom-left, the game a 344 × 378 grid card in the middle column |
| `pc panel highlight` | `36, 360, 280, 1` | `view.highlight` = the card's `12, 12, 320, 1` | follows the card |
| `key pc` | `36, 360, 24, 24` | `view.chip.box` = the card's corner, `24 × 24` | the chip is flush with the card and the board insets it 12 px, so it inherits both deltas; its letter is `O` in the view, `C` on the board and `C` in the strip |
| `pc search field`, `pc search icon` | `68, 360, 190, 24` / `76, 367, 10, 10` | — | the shipped card has no search field |
| `pc view toggle`, `pc toggle thumb 1/2`, `pc toggle line 1/2` | `292, 360, 24, 24` … | — | the shipped card has no row/grid toggle; its strip is the page tabs |
| `pc rip button`, `pc rip icon` | `264, 360, 24, 24` / `268, 364, 16, 16` | `view.rip.box` → `868, 88, 32, 26` | the board draws a 24 × 24 icon button, the card a 32 × 26 labelled tab at the strip's right end |
| `rip viewport`, `rip row 0…5`, `rip icon n`, `rip grid scroll track/thumb` | `36, 396, 280, 183`; rows 280 × 38 at a 44 px pitch | `view.grid.band` `590, 122, 316, 316` and 16 cells of 76 × 76 | the board draws a six-row list, the card one 4 × 4 grid for both panes: `PcPanelView.rip` has no per-row box |
| `rip name n`, `rip meta n`, `rip tag n` | text nodes | `cell.name`, `t('hud.level')` + `cell.hpText`, the `RIP` tab label | the names and `RIP` are claimed as strings; the meta is `LV 30 · ROUTE 3` on the board against `Lv30` and `0/92` on two lines in the card, and the route is not in the view |
| `route screenshot`, `Vector` ×5 | — | — | the frame's painted scene and the search/rip glyph shapes |

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a route to the dead rows and do not touch `src/i18n/**`**: the
`Lv30` copy defect is registered under **Bugs**, not fixed here.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-247` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/pc/specGap.test.ts` is green. It asserts:
    `slug === '03p-panels-pc-rip'` and `SPEC.slug` the same; the spec carries **33 boxes,
    20 text nodes and 19 colours**; `buildView(SPEC)` deep-equals
    `{ boxes: [], strings: ['RIP', 'PSYDUCK', 'MACHOP', 'RATICATE', 'GLOOM', 'ZUBAT',
    'DODUO'], colours: [] }`; `gapIsEmpty(gapFor(buildView(SPEC), SPEC))` is `true`;
    `buildView(SPEC)` twice deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: the frame's card is
    `pc panel` `24, 348, 304, 243` and its RIP list is `rip viewport`
    `36, 396, 280, 183` with six rows 280 × 38 at a 44 px pitch; the frame's six
    `rip name n` characters are the fixture's six row names, in order; its six `rip tag n`
    are `RIP`; and `pcPanelBox({ width: 1280, height: 800 })` is
    `{ x: 576, y: 72, w: 344, h: 378 }`, a delta of `{ dx: 552, dy: −276, dw: 40, dh: 135 }`
    whose four numbers all exceed `GAP_TOLERANCE`.
  - [ ] `[unit]` The same file pins what the view cannot claim: the RIP pane's
    `view.rip` is `{ active: true, locked: true, box: { x: 292, y: 16, w: 32, h: 26 } }`
    and `view.cells` has **16** entries of 76 × 76 in a band `14, 50, 316, 316` (six of
    them named, ten empty), so no `rip row` exists; the first cell's level line is `Lv30`
    against the board's `LV 30 · ROUTE 3` (the two differ after `gapFor`'s fold), and the
    tab's label is `1` where the frame draws no page number.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03p-panels-pc-rip`. That red is the Orchestrator's
    `PENDING` flip at merge. No other test fails — quote the summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-247` lists exactly
    `src/ui/hud/specGap.views/pc.ts`, `src/ui/hud/panels/pc/specGap.test.ts` and
    `src/ui/hud/panels/pc/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/i18n/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03p-panels-pc-rip.json`, or to any file of
    `src/ui/hud/panels/pc/` other than the README's **one added line**.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, with the PC
    box opened (`O`) and its RIP tab pressed (`[data-hud-pc="rip"]`), measured over CDP with
    `getBoundingClientRect()` and `data-locked`:
    `document.querySelector('[data-hud-panel="box"]')` is exactly `576, 72, 344, 378` —
    `pcPanelBox({ width: 1280, height: 800 })` — the card's `data-pane` is `rip`, and the
    RIP tab reads `868, 88, 32, 26` with `data-locked="true"` (the dead are read-only,
    `D5`). The frame's own card is `24, 348, 304, 243` and its RIP button
    `264, 360, 24, 24`: the deltas are the adapter's record, not a defect of this task.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03p-panels-pc-rip'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `03p-panels-pc-rip` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push. The
  row's counts (33 / 20 / 19) stay as they are: they count the **frame**, not this
  comparison, and the card's three unclaimable lines are recorded in the adapter instead.
- **For the next batch:** the board's RIP row prints a route (`LV 30 · ROUTE 3`) that the
  run does not carry into the box — `[Task-44]`'s report says the dead are deleted and only
  counted — so a list layout is a run-state task before it is a paint task. If the card ever
  grows a list, this adapter's `rip viewport`/`rip row` claim starts matching on its own:
  the claim is written as a tolerance test, not a hard-coded `[]`.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Turning the card into the board's 304 × 243 list, adding `rip row`/`rip icon`/`rip meta`/
  `rip tag` boxes, a search field or a row/grid toggle: each is a geometry and run-state
  decision above this measurement (`[Task-44]` owns the dead's own record).
- Moving the card to `24, 348`, insetting its chip 12 px, renaming its chip letter from `O`
  to `C`, or resizing the RIP tab to 24 × 24.
- Fixing `common.level`/`hud.level` (`Lv30` → `LV 30`): a copy task registered under
  **Bugs**; `src/i18n/**` is not this task's path.
- The page-tab strip's `1`, the locked veil, the status marks, the drag and reorder
  handlers, the phone twin (`m03p-panels-pc-rip`).
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or any test other
  than the one this task adds.
- New dependencies, refactors of `notices.ts`/`detail.ts`, prettier sweeps of unrelated
  files.

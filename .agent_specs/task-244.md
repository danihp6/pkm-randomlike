# Spec: Task-244 — The bag's row view is wired to its spec (`03b-panels-row-view`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03b Panels · row view` is **measured**
  instead of `pending`: a new adapter `src/ui/hud/specGap.views/bag.ts` builds the route
  bag's `PanelView` from `design/fixtures/03b-panels-row-view.json` at 1280×800, claims
  the boxes and strings the frame and the panel agree on (at these rects: none), and
  writes the rest of the comparison down as measured numbers in the adapter's doc
  comment and in a new test — the frame's `bag panel` `(24, 24, 304, 130)` against the
  shipped `{928, 422, 344, 308}`, the frame's one-row list of eight 64 × 60 tiles against
  the shipped 5 × 3 grid of 56 px cells, the board's `×3` against the card's `x3`. No game
  behaviour and no pixel of the route changes.
- **Environment:** worktree `../wt-pkm-244`, branch `task-244`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedents
  `src/ui/hud/specGap.views/notices.ts` and `.../detail.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03b Panels · row view` (`design/board.json`, node `2:6`), **136 boxes,
  15 strings, 25 colours**, viewport 1280×800. The panel it is assigned to is **`bag`**
  (`design/import.json`'s `panel` column and `design/README.md`'s frame → scene map), so
  this row is the bag's even though the caption says "row view".
- **The frame draws three cards, and only one of them is this panel's.**
  - the bag's: `bag group` / `bag panel` `(24, 24, 304, 130)`, `bag panel highlight`
    `(36, 36, 280, 1)`, `key bag` `(36, 36, 24, 24)`, `bag search field`
    `(140, 36, 142, 24)`, `bag search icon` `(148, 43, 10, 10)`, `bag view toggle`
    `(292, 36, 24, 24)`, `bag row viewport` `(36, 72, 280, 60)` and, inside it,
    `bag tile 1…8` — 64 × 60 at a **72 px pitch**, at local x `0, 72, 144, 216, 288, 360,
    432, 504`, each with a 24 × 24 `bag icon <item>` at local `(tileX + 20, 18)` — plus a
    `bag scroll track`/`bag scroll thumb` and four `bag toggle grid` cells in the toggle;
  - the party's: `party group` / `party panel` `(928, 536, 304, 124)`,
    `party panel highlight` `(940, 548, 280, 1)`, four `portrait CH/PI/BU/GA` with their
    `hp track`/`hp fill`, `party xp track`/`party xp fill`, `key party`;
  - the PC's: `pc group` / `pc panel` `(24, 208, 304, 112)`, `pc panel highlight`
    `(36, 220, 280, 1)`, `key pc`, `pc slot 1…30` with their `pc mon …`, `pc rip button`.

  The party's and the PC's groups belong to those panels' own rows (`03c`, `03p`), not
  here, and neither of them is the bag's card.
- **The shipped card is the grid, not the row.** `bagPanelBox({ width: 1280, height: 800 })`
  = `{ x: 928, y: 422, w: 344, h: 308 }` (`x = 1280 − 344 − 8`, `y = 8 + 406 + 8`): against
  the frame's `bag panel` that is **dx +904, dy +398, dw +40, dh +178**. Its
  `bagPanelView(...)` grid is `{ columns: 5, gap: 6, cell: 56 }` in a band
  `{ x: 20, y: 82, w: 304, h: 180 }`, with five pocket tabs (`BAG_TAB_W` 55, `BAG_TAB_H`
  26) the frame's card does not draw and no row viewport at all.
- **The fixture is the frame's own copy.** `design/fixtures/03b-panels-row-view.json`
  carries `ui: { pocket: 'consumable', cursor: 0, query: '' }`, a `bag` of eight stacks
  (six `consumable`, two `ball`) and `money: 2480`, so `bagPanelView` draws the **six
  consumable stacks** with counts `x3, x1, x2, x1, x5, x2`. The frame draws eight tiles
  with `bag qty 1…8` `×3, ×1, ×2, ×1, ×5, ×2, ×4, ×1`.
- **The copy misses on three points, which is why no string is claimable:** the count is
  `x3` (ASCII) where the board draws `×3` (U+00D7); the footer prints `t('hud.money')`
  = `MONEY` beside the value `2480` where the board draws one line `$ 2,480`; the search
  field's placeholder is `t('hud.searchItems')` = `search items...` where the board draws
  `SEARCH ITEM`. `gapFor` folds case but not glyphs, so each of the three would be a
  `strings` gap.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/bag.ts` — new.
- `src/ui/hud/panels/bag/specGap.test.ts` — new.
- `src/ui/hud/panels/bag/README.md` — **one new line** in its `## Layout` list, and
  nothing else in that file: the folder's title line names the frame its *paint* came from
  and stays as it is.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03b-panels-row-view`
  (`'party row view; no view builder is wired'`) is deleted at merge. While it is still
  there the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03b-panels-row-view`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `03b-panels-row-view` row in `The spec gap, measured
  (D57)` flips from `pending` to `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`specGap.views/detail.ts`, `src/ui/hud/panels/bag/view.ts`, `bagPanel.tsx`, `bag.css`,
`src/ui/hud/panels/{party,pc,map,hud}/**`, `src/i18n/**`, `src/scenes/**`,
`src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "Panel geometry",
  "Chips", and the `The spec gap, measured (D57)` table), `design/README.md`.
- `design/screens/03b-panels-row-view.json` and
  `design/exports/03b-panels-row-view.png` — frame **`03b Panels · row view`**, 1280×800.
- `design/fixtures/03b-panels-row-view.json` — its `state` (the six-key `HudState`) and
  its `ui` block.
- `src/ui/hud/panels/bag/` — the whole folder, especially `view.ts` (`bagPanelBox`,
  `bagPanelView`, `BagPanelView`, `BagTileView`, `BagPanelUi`, `BagIconResolver`, the
  `BAG_*` mirror constants) and the `README.md`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`, `src/ui/hud/specGap.views/detail.ts`,
  `src/ui/hud/panels/detail/specGap.test.ts`.
- `src/i18n/en.ts` — read **only** for the three keys named above, to quote them.

## 🔒 Contract

`src/ui/hud/specGap.views/bag.ts` exports exactly two names:

```ts
export const slug = '03b-panels-row-view';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/03b-panels-row-view.json` as a module default and
  builds the panel exactly as the route scene does:

  ```ts
  const DESKTOP = { width: 1280, height: 800 };
  const view = bagPanelView(FIXTURE.state, FIXTURE.ui, DESKTOP, () => null);
  ```

  The icon resolver is a stub returning `null`: an atlas URL is a runtime concern and no
  box or string depends on it.
- **Boxes:** `[]`. Claim a box only when the shipped rect for it is within `GAP_TOLERANCE`
  of the frame's box of that same name, the way `specGap.views/detail.ts`'s `cardClaim`
  does, so a card that lands on the board becomes a claim instead of a silent pass. The
  candidates and their shipped rects — all of them outside the tolerance at this
  viewport:
  - `bag panel`: frame `24, 24, 304, 130`; shipped `bagPanelBox(DESKTOP)` =
    `928, 422, 344, 308`.
  - `bag panel highlight`: frame `36, 36, 280, 1`; shipped `view.highlight` (panel-relative
    `12, 12, 320, 1`) → viewport `940, 434, 320, 1`.
  - `key bag`: frame `36, 36, 24, 24`; shipped `view.chip.box` (panel-relative
    `0, 0, 24, 24`) → viewport `928, 422, 24, 24`.
  - `bag search field`: frame `140, 36, 142, 24`; shipped `view.search.box` (panel-relative
    `20, 50, 304, 24`) → viewport `948, 472, 304, 24`.
  - `bag tile 1…8`: frame 64 × 60 inside a 280 × 60 viewport; shipped cells 56 × 56.
- **Strings:** `[]`, for the three reasons in the measured facts (`×` vs `x`, one money
  line vs two, `SEARCH ITEM` vs `search items...`). Claim a string only when `gapFor`'s
  own fold (trim + upper-case) makes it the board's, so a copy fix becomes a claim.
- **Colours:** `[]`. The card's fills and borders are `bag.css`'s tokens and the atlases;
  the view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no DOM and no store. `bagPanelView` is pure
  and the fixture is a module constant.
- You may read `spec` only as a **structural selector** — is this box name in the frame at
  all, is this line the board's text. Never filter strings or colours by the spec's
  content beyond that.

### The table the doc comment carries

Put these numbers in a doc comment above `buildView`, in the shape
`specGap.views/detail.ts` uses:

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `bag panel` | `24, 24, 304, 130` | `bagPanelBox(DESKTOP)` = `928, 422, 344, 308` | dx +904, dy +398, dw +40, dh +178: the card is the 344 × 308 grid, not the board's 304 × 130 row |
| `bag panel highlight` | `36, 36, 280, 1` | `view.highlight` = the card's `12, 12, 320, 1` | follows the card |
| `key bag` | `36, 36, 24, 24` | `view.chip.box` = the card's corner, `24 × 24` | the chip is flush with the card; the board insets it 12 px, so it inherits both deltas |
| `bag search field`, `bag search icon` | `140, 36, 142, 24` / `148, 43, 10, 10` | `view.search.box` = `20, 50, 304, 24` | follows the card; the icon is a glyph inside the field |
| `bag view toggle`, `bag toggle grid`, `bag scroll track`, `bag scroll thumb` | — | — | the shipped card has **five pocket tabs** and no row/grid toggle and no scroll bar |
| `bag row viewport`, `bag tile 1…8`, `bag icon …` | `36, 72, 280, 60`, 64 × 60 at a 72 px pitch | `view.grid` = `{ columns: 5, gap: 6, cell: 56 }` in a band `20, 82, 304, 180` | the board draws the **row** view and the card draws the **grid**; the fixture's six consumable stacks fill one 5-cell row and one cell of the next |
| `party group`, `party panel`, `portrait CH…GA`, `party xp track/fill`, `key party` | `928, 536, 304, 124` … | — | the party card's own row (`03c`) |
| `pc group`, `pc panel`, `pc slot 1…30`, `pc mon …`, `pc rip button` | `24, 208, 304, 112` … | — | the PC card's own row (`03p`) |
| `route screenshot`, `Vector` ×2 | — | — | the frame's painted scene and the search glyph's two shapes |

And the copy it does not claim: `money` `$ 2,480` against the footer's `MONEY` + `2480`;
`bag search placeholder` `SEARCH ITEM` against `search items...`; `bag qty 1…8` `×n`
against `view.tiles[i].count` `xn`; the six stack names and the description card's body,
which the board's bag row does not print.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only — **do not add a row-view block to `design/fixtures/03b-panels-row-view.json`**
and do not touch `src/i18n/**`: the copy deltas are recorded, not fixed here.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-244` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/bag/specGap.test.ts` is green. It
    asserts: `slug === '03b-panels-row-view'` and `SPEC.slug` the same; the spec carries
    **136 boxes, 15 text nodes and 25 colours**; `buildView(SPEC)` deep-equals
    `{ boxes: [], strings: [], colours: [] }`; `gapIsEmpty(gapFor(buildView(SPEC), SPEC))`
    is `true`; `buildView(SPEC)` twice deep-equals itself.
  - [ ] `[unit]` The same file pins the **premise**: `bagPanelBox({ width: 1280, height:
    800 })` is `{ x: 928, y: 422, w: 344, h: 308 }` while the frame's `bag panel` is
    `{ x: 24, y: 24, width: 304, height: 130 }`, a delta of `{ dx: 904, dy: 398, dw: 40,
    dh: 178 }`, and each of those four numbers is greater than `GAP_TOLERANCE`; the
    frame's `bag row viewport` is `36, 72, 280, 60` and its eight tiles are 64 × 60 at a
    72 px pitch; the shipped `view.grid` is `{ columns: 5, gap: 6, cell: 56 }` and the
    fixture yields **six** tiles with counts `x3, x1, x2, x1, x5, x2`.
  - [ ] `[unit]` The same file pins the copy it cannot claim: the board's `bag qty 1` is
    `×3` and the view's first count is `x3` (the two differ after `gapFor`'s fold); the
    board's `money` is `$ 2,480` and the view's footer prints `MONEY` + `2480`; the
    board's `bag search placeholder` is `SEARCH ITEM` and the view's placeholder is
    `search items...`.
  - [ ] `[unit]` `npm test` fails **only** in `src/ui/hud/specGap.walk.test.ts` → `accounts
    for every screen: mapped, or a named reason`, with the message
    `screens both mapped and pending: 03b-panels-row-view`. That red is the
    Orchestrator's `PENDING` flip at merge. No other test fails — quote the summary line
    in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-244` lists exactly
    `src/ui/hud/specGap.views/bag.ts`, `src/ui/hud/panels/bag/specGap.test.ts` and
    `src/ui/hud/panels/bag/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/`, `src/i18n/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, to `design/fixtures/03b-panels-row-view.json`, or to any file
    of `src/ui/hud/panels/bag/` other than the README's **one added line**.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, with the bag
    opened (`I` if it is collapsed), measured over CDP with `getBoundingClientRect()`:
    `document.querySelector('[data-hud-panel="bag"]')` is exactly
    `928, 422, 344, 308` — `bagPanelBox({ width: 1280, height: 800 })` — and, when the
    pocket draws at least one stack, every `[data-hud-bag-tile]` it draws reads
    `56 × 56` — `bagPanelView`'s `cell` at that viewport. A run whose consumable pocket is
    empty is reported as such and the card's rect stands as the measurement. The frame's own
    card is `24, 24, 304, 130`: the delta is the adapter's record, not a defect of this
    task.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03b-panels-row-view'` from the `PENDING` map
  in `src/ui/hud/specGap.walk.test.ts` **and** flip the `03b-panels-row-view` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push, and
  the walker's "both mapped and pending" red clears. The row's counts (136 / 15 / 25) stay
  as they are: they count the **frame**, not this comparison.
- **For the next batch:** the frame this row measures draws **three** cards — the bag's, the
  party's (`928, 536, 304, 124`) and the PC's (`24, 208, 304, 112`). The party's and the
  PC's are their own rows' (`03c`, `03p`) and are **not** claimed here; `03p`'s own frame
  draws the PC on its RIP tab, so the PC's 304 × 112 grid card is measured by no row until
  a frame draws it.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a `*.test.ts`
  beside an adapter registers an adapter with an `undefined` slug and breaks the walker.

## ⛔ Out of scope

- Moving the bag card to the board's `24, 24, 304, 130`, giving it a row view, its scroll
  bar or its `bag view toggle`, insetting its chip by 12 px, or changing the pocket strip:
  every one of them is a geometry decision above this measurement.
- The money line's `$ 2,480` format, the `×n` count glyph, the placeholder's wording and
  the `common.level`/`hud.level` copy defect: copy tasks in their own rows, and
  `src/i18n/**` is not this task's path.
- The party group's and the PC group's boxes, the frame's painted `route screenshot`, the
  search glyph's two `Vector` shapes, the phone twin (`m03b-panels-row-view`).
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or any test other
  than the one this task adds.
- New dependencies, refactors of `notices.ts` or `detail.ts`, prettier sweeps of unrelated
  files.

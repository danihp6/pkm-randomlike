# Spec: Task-242 — The member detail card is wired to its spec (`03m-panels-pokemon-moves`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `03m Panels · pokemon moves` is **measured**
  instead of `pending`: a new adapter `src/ui/hud/specGap.views/detail.ts` projects
  `design/fixtures/03m-panels-pokemon-moves.json` through `detailPanelView` at
  1280×800 on the tab the fixture asks for (`moves`) and narrows it to the copy the
  frame draws — the member's name and level, the four move cells' name / PP / power /
  accuracy lines and the learnset search placeholder — so `gapFor` reports nothing. The
  card's **geometry** is recorded, box by box with its measured delta, in the adapter's
  comment: the board's `03m` card is 360×508 at (448, 88) and the shipped card is
  460×560 at (108, 72), so no box is claimable and the panel does not move. No game
  behaviour and no pixel of the card changes.
- **Environment:** worktree `../wt-pkm-242`, branch `task-242`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the precedent
  `src/ui/hud/specGap.views/notices.ts` are already merged.

### The measured facts this task is built on (verify them, then write them down)

- The frame is `03m Panels · pokemon moves` (`design/board.json`, node `6:1596`),
  **47 boxes, 31 strings, 16 colours**, viewport 1280×800. It is the **moves** tab: four
  152×76 move tiles, a learnset band and `SEARCH MOVES...`.
- The shipped card is `detailPanelBox({ width: 1280, height: 800 })` =
  `{ x: 108, y: 72, w: 460, h: 560 }` (`DETAIL_PANEL_W` / `DETAIL_PANEL_H`). The frame
  draws `detail panel` at `448, 88, 360, 508` — dx −340, dy −16, dw +100, dh +52. The
  card therefore cannot be claimed without shrinking it, which is not this task.
- The shipped card has **three** tabs (`STATS · EVOLUTION · MOVES`, `DETAIL_TABS`,
  `DETAIL_TABS_TOP = 72`, `DETAIL_TAB_H = 26`, each `floor((460 − 40 − 8) / 3)` wide
  = 137/137/138, page `128/269/410, 144`); the frame draws two, 70 and 76 wide at
  `576, 176, 70/76, 28`. The row is a **control**: a control is not content.
- The fixture's `ui.tab` is already `'moves'` and its `pool` is Charizard's learnset
  (`RAZOR LEAF`, `LEECH SEED`, `FLAMETHROWER`, `AIR SLASH`, `DRAGON CLAW`,
  `EARTHQUAKE`) while the frame's band carries another family's (EMBER, WING ATTACK,
  FIRE FANG, SLASH, METAL CLAW, FLARE BLITZ, AIR SLASH, GROWL). The pool's names are
  therefore **not** comparable and are not claimed.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/detail.ts` — new.
- `src/ui/hud/panels/detail/specGap.test.ts` — new.
- `src/ui/hud/panels/detail/README.md` — one new line in its `## Layout` list.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `03m-panels-pokemon-moves`
  is deleted at merge. While it is still there the walker **fails on purpose**: its
  case `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 03m-panels-pokemon-moves`. That single red is the
  expected state of your branch.
- `docs/hud-fidelity.md` — its `03m-panels-pokemon-moves` row flips from `pending` to
  `wired` at merge, in the same push.

Also do not touch `design/**`, `src/ui/hud/specGap.ts`, `specGap.views/notices.ts`,
`src/ui/hud/panels/detail/view.ts`, `detailPanel.tsx`, `detail.css`,
`src/scenes/panels/detail.ts`, `src/scenes/**`, `src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§5 "The detail
  card's three-tab row", §9, and the `The spec gap, measured (D57)` table),
  `design/README.md`.
- `design/screens/03m-panels-pokemon-moves.json` and
  `design/exports/03m-panels-pokemon-moves.png` — frame
  **`03m Panels · pokemon moves`**, 1280×800.
- `design/fixtures/03m-panels-pokemon-moves.json` — a `detail` block (the member), a
  `pool` block (six learnset rows) and a `ui` block (`tab: 'moves'`, cursor 0, page 0).
- `src/ui/hud/panels/detail/` — the whole folder, especially `view.ts`
  (`detailPanelView`, `DetailPanelView`, `DetailPanelUi`, `DetailPoolRow`,
  `MemberDetail`, `detailPanelBox`, `initialDetailPanelUi`, `DETAIL_*` constants) and
  its `README.md`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/detail.ts` exports exactly two names:

```ts
export const slug = '03m-panels-pokemon-moves';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports the fixture as a module default and calls
  `detailPanelView(fixture.detail, fixture.pool, fixture.ui, DESKTOP)` with
  `DESKTOP = { width: 1280, height: 800 }`. Pass the fixture's own `ui` block — its
  `tab` is `'moves'`, the tab the frame draws; never force `'stats'` and never build a
  `DetailPanelUi` by hand.
- **Boxes:** `[]` (see the geometry table below — no frame box is within `GAP_TOLERANCE`
  of the shipped one).
- **Strings** (the card's copy on the moves tab, in this order): `view.name`,
  `view.level`, then for each of `view.moves` its `name`, `pp`, `power` and `accuracy`,
  then `view.search.placeholder`. With this fixture that is the frame's own:
  `CHARIZARD`, `LV 36`, `FLAMETHROWER`, `PP 15/15`, `PWR 90`, `ACC 100`, `AIR SLASH`,
  `PP 15/15`, `PWR 75`, `ACC 95`, `DRAGON CLAW`, `PP 10/10`, `PWR 80`, `ACC 100`,
  `EARTHQUAKE`, `PP 10/10`, `PWR 100`, `ACC 100`, `SEARCH MOVES...`. `gapFor` folds
  case, so the `t()` literals do not have to be typed by hand anywhere — emit the
  view's fields.
- **Colours:** `[]`. The card's fills and borders are `detail.css`'s tokens and the two
  atlases; the view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no store, no scene — `detailPanelView` is
  pure. Do not set the locale, and do not read `src/data/dex` or the run.
- You may read `spec` only as a **structural selector**. Never filter strings or
  colours by the spec's content.

### The boxes and strings this view does **not** claim

Put this table, with the deltas, in a doc comment above `buildView`:

| frame box | frame rect | shipped | why not claimed |
| --- | --- | --- | --- |
| `detail panel` | `448, 88, 360, 508` | `detailPanelBox` = `108, 72, 460, 560` | the shipped card is the 460×560 one (`DETAIL_PANEL_W/H`); dw +100, dh +52 |
| `detail panel highlight` | `460, 100, 336, 1` | `box + (12, 12, 436, 1)` | follows the card |
| `tab stats`, `tab moves` | `576/654, 176, 70/76, 28` | `128/269/410, 144, 137/137/138, 26` | the card's tab row is a control; three tabs, not two |
| `key stats` | `460, 100, 24, 24` | — | the board draws **no** chip for this card (`panels/detail/README.md` rule 8); the card's `×` control is `data-hud-detail-close` |
| `move tile 0…3`, `move type/category 0…3` | `472/632, 248/332, 152, 76` | `moveSlots(...).box` / `typeBox` / `categoryBox` inside the 460 card | follows the card's size |
| `detail portrait` | `472, 140, 88, 88` | the header's portrait cell | follows the card |
| `nickname field`, `nickname caret`, `type square fire/flying` | — | `view.nickname.box`, `view.types[].box` | follows the card |
| `stats panel`, `route screenshot` | — | — | the frame's painted scene and its stats overlay, not this card |

And the strings it does not claim: the tab labels `STATS` / `MOVES` and the letters `S`
and `X` (the card's own controls), the learnset band's eight names (`EMBER`… `GROWL`,
another family than the fixture's pool), and every label the board's card does not print
(`NATURE`, `ABILITY`, `HELD`, the hints) — because there is no frame string to match and
a claimed string that the board does not carry is a gap.

## 🧩 Data and configuration

None. No new key, no new default, no run field, no save version step. The fixture is
read-only.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-242` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/detail/specGap.test.ts` is green. It
    asserts: `slug === '03m-panels-pokemon-moves'`; `buildView(spec).boxes` is `[]`;
    the emitted string list equals the 19 literals pinned in the test; every emitted
    string is carried by the spec (so the list cannot grow into a gap);
    `gapIsEmpty(gapFor(buildView(spec), spec))` is `true`; and the premise —
    `detailPanelBox({ width: 1280, height: 800 })` is `{ x: 108, y: 72, w: 460,
    h: 560 }` while the spec's `detail panel` box is `{ x: 448, y: 88, width: 360,
    height: 508 }` (dx −340, dy −16, dw +100, dh +52) and the spec's `tab stats` /
    `tab moves` are 70/76 wide at `y 176` while the shipped tab row is 137/137/138 wide
    at `y 144` — so the empty box claim cannot rot silently.
  - [ ] `[unit]` `npm test` fails **only** in
    `src/ui/hud/specGap.walk.test.ts` → `accounts for every screen: mapped, or a named
    reason`, with the message
    `screens both mapped and pending: 03m-panels-pokemon-moves`. That red is the
    Orchestrator's `PENDING` flip at merge. No other test fails — quote the summary
    line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-242` lists exactly
    `src/ui/hud/specGap.views/detail.ts`, `src/ui/hud/panels/detail/specGap.test.ts`
    and `src/ui/hud/panels/detail/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/` or `.agent_specs/`.
  - [ ] `[unit]` `git diff` shows no change to `src/ui/hud/specGap.walk.test.ts`, to
    `docs/hud-fidelity.md`, or to any file of `src/ui/hud/panels/detail/` other than
    the README's one added line.
  - [ ] `[live]` At **1280×800**, after NEW RUN → a starter → the first route, open a
    member's card from the party card's row and read it over CDP with
    `getBoundingClientRect()`: `[data-hud-panel="detail"]` is `108, 72, 460, 560` (=
    `detailPanelBox({ width: 1280, height: 800 })`), the card carries three
    `[data-hud-detail-tab]` elements (`stats`, `evolution`, `moves`), and on the MOVES
    tab `[data-hud-detail-slot]` has four elements whose boxes are inside the card.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'03m-panels-pokemon-moves'` from the
  `PENDING` map in `src/ui/hud/specGap.walk.test.ts` **and** flip that row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push.
- **For the next batch:** the `03` frame carries a `detail panel` box at
  `448, 88, 360, 508` as well; it is the **same** board card and belongs to this
  adapter's record, not to `03`'s. If the human decides the board's 360×508 card wins
  over the shipped 460×560 one, that is a redesign task of its own (the card's grid, its
  learnset band and `src/scenes/panels/detail.ts`'s mirrored constants all move), and
  this adapter's geometry table is where the numbers are.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a
  `*.test.ts` beside an adapter registers an adapter with an `undefined` slug and
  breaks the walker.

## ⛔ Out of scope

- Resizing the card, its tabs, its move grid, its portrait or its search field to the
  frame's 360×508 geometry; changing `view.ts`, `detail.css` or the scene.
- The EVOLUTION tab, the learnset band's own content, the nickname field's behaviour,
  the card's `×` and `Escape` (shipped in `[Task-238]`).
- The frame's painted scene (`route screenshot`), its `stats panel` overlay, the
  `03`/`03b` frames.
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or any test
  other than the one this task adds.
- New dependencies, refactors of `notices.ts`, prettier sweeps of unrelated files.

# Task-260 — the battle bag is wired to its spec

## 🎯 Scope

- **Task type:** tooling / HUD measurement (a Preact panel's spec-gap adapter + its test).
  No scene, no engine rule, no data table.
- **Role:** Dev.
- **Objective:** after this task the `05c Battle · bag` frame is answered by an adapter in
  `src/ui/hud/specGap.views/`, so the walker no longer needs a `PENDING` reason for its slug and
  the panel's delta against the frame is pinned by a test. The frame draws a **bigger** bag than
  the route's — its card is the battle menu `(664, 544, 576, 216)` and its tabs are
  `128 × 30` at a 136 px pitch — while the shipped panel is `battleBagBox` (= `battleMovesBox`)
  with `120 × 26` chips at a 124 px pitch, so **no box lands** and the adapter's honest claim is
  the strings, with the rect-by-rect delta recorded as a table.
- **Environment:** worktree `../wt-pkm-260`, branch `task-260`. A fresh worktree has no
  `node_modules`: install once with `npm ci --prefer-offline --no-audit --no-fund`. Never
  junction `node_modules` or any asset tree in from another tree (`AGENTS.md`, *Asset trees*).
- **Dependencies:** none.

### Exclusive paths (single writer)

Nothing outside this list — `git diff --name-only main...task-260` is audited against it.

- `src/ui/hud/specGap.views/battle-bag.ts` *(new)*
- `src/ui/hud/panels/battle-bag/specGap.test.ts` *(new)*
- `src/ui/hud/panels/battle-bag/README.md` *(the one map line the new test needs)*

**Do not touch** `src/ui/hud/specGap.walk.test.ts` and `docs/hud-fidelity.md`: the `PENDING`
line and the fidelity row for this slug are the **Orchestrator's at merge** (three other tasks
in this batch add adapters to the same two files). See *Expected red* below.

### Inputs (read-only)

- `design/screens/05c-battle-bag.json` — the frame spec; `caption` is **`05c Battle · bag`**,
  **98 boxes, 26 strings, 29 colours**. Its bag lives inside `battle menu`
  `(664, 544, 576, 216)`: four `menu tab n` of `128 × 30` at `684 / 820 / 956 / 1092, 564`, a
  `bag search` field `(684, 602, 216, 24)`, eight `item tile n` of `128 × 52` on two rows
  (`y 636`, `y 696`) each with a 24 px `item icon n`, and its filter labels `CONSUMABLES` /
  `POKEBALLS`.
- `design/exports/05c-battle-bag.png` — the export (read only; never diff pixels).
- `design/fixtures/05c-battle-bag.json` — the frame's own copy: `bag` with `open: true`, a
  `card`, two tabs (`CONSUMIBLES` active, `POKEBALLS`), eight stacks (`Potion x3`,
  `Super Potion x2`, `Hyper Potion x1`, `Poke Ball x12`, `Great Ball x5`, `Ultra Ball x4`,
  `Antidote x2`, `Awakening x1`), `selected: 0`, `detail: 'Potion x3'`, an `info` card and
  `empty: null`.
- `src/ui/hud/specGap.ts` — `gapFor`, `GAP_TOLERANCE` (1 px), `PanelView`, `ScreenSpec`,
  `SpecBox`; `src/ui/hud/specGap.walk.test.ts` (read, never write).
- `src/ui/hud/panels/battle-bag/view.ts` — `battleBagView(input)`, `battleBagBox` (=
  `battleMovesBox`), `BattleBagInput` / `BattleBagView`, and the mirrored constants
  (`TAB_W` 120, `TAB_H` 26, `TAB_GAP` 4, `ROW_GAP` 8, `SEARCH_H` 24). **Every box it returns is
  card-relative**: add the card's origin before comparing with a frame rect.
- `src/ui/hud/panels/battle-bag/battleBagPanel.tsx` (`data-hud-panel="battle-bag"`,
  `data-hud-bag-tab`, `data-hud-bag-cell`, `data-hud-bag-search`), `battleBag.css`,
  `fixture.test.ts`, `view.test.ts`, `mount.tsx`.
- `src/ui/hud/specGap.views/battle-hp.ts` — the doc-comment table shape to copy.
- `src/ui/hud/specGap.views/bag.ts` and `src/ui/hud/panels/bag/specGap.test.ts` — the adapter
  and test shape this repo already uses for a bag.
- `AGENTS.md`, `docs/agent-spec-template.md`. `docs/hud-fidelity.md` is **read only**.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05c-battle-bag';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the panel **exactly as the scene builds it**: take the fixture's `bag`
  block as `BattleBagInput` but with `card: battleBagBox({ width: 1280, height: 800 })` (the
  scene's own card, not the fixture's `276, 582` one), then `battleBagView(input)`. It reads no
  battle, no run, no i18n and no clock.
- `boxes`: **`[]`**, and the module's doc comment says why, one row per family, with the frame
  rect, the shipped rect and the delta:

  | frame box | frame rect | shipped | why not claimed |
  | --- | --- | --- | --- |
  | `battle menu`, `battle menu group` | `664, 544, 576, 216` | `battleBagBox(1280×800)` = `676, 582, 564, 192` | the card sits on the battle menu's own shared bottom line; dx +12, dy +38, dw −12, dh −24 |
  | `battle menu highlight` | `676, 556, 552, 1` | the stylesheet's rule on the card | not a view field |
  | `menu tab n` | `128 × 30` at `684 / 820 / 956 / 1092, 564` | `120 × 26` at the card + `(20, 16)`, 124 px pitch | the four tabs are the battle menu's, not the bag's: the bag paints two pocket chips |
  | `bag search` | `684, 602, 216, 24` | card-relative `(20, 50, 524, 24)` | moved with the card |
  | `item tile n`, `item icon n` | `128 × 52` on two rows, icons 24 px | `bagGridLayout`'s cells (≤ 56 px) and 24 px icons | moved with the card |
  | `item icon` (the info card's), `attack detail`, `attack detail highlight` | `684, 428, 24, 24` … | `info.box` inside the card | moved with the card |

  Fill the table from the real numbers you compute; the rows above are the families, not a
  licence to skip the arithmetic.
- `strings`: **exactly** the strings `battleBagView` prints that the frame carries, filtered by
  comparing (trimmed, upper-cased) against `spec.text` — the `notices.ts` / `bag.ts` pattern.
  The claim must not be empty: at 1280×800 with this fixture it contains at least the two
  pocket labels `CONSUMIBLES` and `POKEBALLS` and the search placeholder `SEARCH ITEMS`. A
  string the panel prints that the frame does not carry (e.g. a stack's `Potion` label, which
  the frame draws as its `attack name` `POTION`) is **not** claimed — it is recorded in the
  module's doc comment as a string the frame does not spell the same way, never silently
  dropped.
- `colours: []` — the glass, the chip skins and the dim tail outline are the stylesheet's
  tokens, which `scripts/design/check.mjs` covers.
- **Determinism:** no `Rng`, no clock, no DOM. Pure data in, pure data out.

## 🧩 Data and configuration

None. This task introduces no key, no default and no balancing value.

## 🧪 Test and Validation Plan (for QA)

Run this verbatim.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` (once, if `node_modules` is absent).
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-260` against the exclusive paths above.
  - One browser pass, for the single `[live]` criterion.

- **Expected red (one, and only one):** `src/ui/hud/specGap.walk.test.ts` › *"accounts for
  every screen: mapped, or a named reason"* fails **on this slug only**, because the adapter is
  mapped while the walker's `PENDING` still names the slug. That line is the Orchestrator's at
  merge: do not edit the walker or `docs/hud-fidelity.md`. Every other test must pass, and the
  QA report must record this as the expected red — not as a pass, not as a second failure.
  After the merge the whole suite is green.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `npm test` is green except the single expected red above, and the new test file
        runs (not skipped).
  - [ ] `[unit]` `git diff --name-only main...task-260` names nothing outside the three
        exclusive paths.
  - [ ] `[unit]` The adapter answers for its frame: `slug` is `'05c-battle-bag'`,
        `gapFor(buildView(SPEC), SPEC)` is empty (`gapIsEmpty`), and the spec's caption is
        `05c Battle · bag`.
  - [ ] `[unit]` The "no box lands" premise is pinned against both sides, not asserted in prose:
        the test reads `frameBox('battle menu')` = `(664, 544, 576, 216)`,
        `frameBox('menu tab 0')` = `(684, 564, 128, 30)` and the batch's own
        `battleBagBox({ width: 1280, height: 800 })` = `(676, 582, 564, 192)`, and asserts each
        delta is **greater than** `GAP_TOLERANCE` — so the day the card or the tabs move onto
        the frame, the test fails and `boxes: []` is revisited.
  - [ ] `[unit]` The strings claim is real: `buildView(SPEC).strings` contains `CONSUMIBLES`,
        `POKEBALLS` and `SEARCH ITEMS` (read the expected labels from the fixture and the frame,
        not as bare literals), every claimed string is one the frame carries, and `colours` is
        empty.
  - [ ] `[live]` At 1280×800 in the running game with a battle open, press the `BAG` row:
        `[data-hud-panel="battle-bag"]` is on screen and its `getBoundingClientRect()` equals
        `battleBagBox({ width: 1280, height: 800 })` = `676, 582, 564, 192` (±1 px), and each of
        its `[data-hud-bag-tab]` elements' rects equals the corresponding
        `battleBagView(input).tabs[i].box` translated by the card origin — i.e. `120 × 26` at
        the shipped 124 px pitch. (The frame's tab is `128 × 30`: that delta is the measured gap
        recorded in the adapter, not a live bound.) A battle opens on the first route, so no run
        count is needed. Measure with the dev server plus CDP over headless Chromium (prefer
        `renderer.snapshotArea` + `getImageData` for the canvas, `getBoundingClientRect` for the
        DOM card); say which method produced the evidence.
  - [ ] `[unit]` `src/ui/hud/panels/battle-bag/README.md` gains one line for
        `specGap.test.ts` in its file map, in the file's own voice, and nothing else moves.

## 📣 Coordination

- For the Orchestrator at merge: delete `'05c-battle-bag': 'the battle bag; no view builder is
  wired',` from `PENDING` in `src/ui/hud/specGap.walk.test.ts` and flip the row
  `| battle-bag | 05c Battle · bag | ... | pending |` in `docs/hud-fidelity.md` to `wired`, in
  the merge commit.
- For the next batch: `05d`/`05e` share the `battle-switch` panel and are separate adapters;
  this task does not touch that folder.

## ⛔ Out of scope

- Do not resize the bag's card, its chips or its grid to match the frame's `128 × 30` tabs. The
  panel is the battle menu's box on purpose (`battleBagBox` = `battleMovesBox`) and that rule is
  not this task's to break.
- Do not touch the walker, `docs/hud-fidelity.md`, `src/ui/hud/specGap.ts`, the panel's view
  model, its components, its CSS or `battleMovesBox`.
- Do not claim the battle field, the HP plates, the ball rows or the frame's four `menu tab n`.

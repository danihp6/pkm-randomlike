# Task-261 — the battle's SWITCH window is wired to its spec

## 🎯 Scope

- **Task type:** tooling / HUD measurement (a Preact panel's spec-gap adapter + its test).
  No scene, no engine rule, no data table.
- **Role:** Dev.
- **Objective:** after this task the `05d Battle · pokemon` frame is answered by an adapter in
  `src/ui/hud/specGap.views/`, so the walker no longer needs a `PENDING` reason for its slug and
  the panel's delta against the frame is pinned by a test: the frame draws the party as a
  **two-column grid** of `264 × 70` tiles at `684 / 956 × 600 / 678` (`party grid group`
  `(684, 600, 536, 148)`), while the shipped window is `partyGridLayout`'s **six-row list**
  inside `battleSwitchBox` (= `battleMovesBox`), so no tile lands and the adapter's honest claim
  is the strings plus a documented rect table.
- **Environment:** worktree `../wt-pkm-261`, branch `task-261`. A fresh worktree has no
  `node_modules`: install once with `npm ci --prefer-offline --no-audit --no-fund`. Never
  junction `node_modules` or any asset tree in from another tree (`AGENTS.md`, *Asset trees*).
- **Dependencies:** none. (`05e`, the same window's stats state, is a **different** task and a
  different adapter; it is not in this batch, so it touches no file you own.)

### Exclusive paths (single writer)

Nothing outside this list — `git diff --name-only main...task-261` is audited against it.

- `src/ui/hud/specGap.views/battle-pokemon.ts` *(new)*
- `src/ui/hud/panels/battle-switch/specGap.pokemon.test.ts` *(new)*
- `src/ui/hud/panels/battle-switch/README.md` *(the one map line the new test needs)*

The test is named for its **frame** (`specGap.pokemon.test.ts`), not `specGap.test.ts`: this
folder carries two frames in the phase (`05d`, `05e`), and the second one's test file is a
later task's. Add exactly one map line, for your own file.

**Do not touch** `src/ui/hud/specGap.walk.test.ts` and `docs/hud-fidelity.md`: the `PENDING`
line and the fidelity row for this slug are the **Orchestrator's at merge** (three other tasks
in this batch add adapters to the same two files). See *Expected red* below.

### Inputs (read-only)

- `design/screens/05d-battle-pokemon.json` — the frame spec; `caption` is
  **`05d Battle · pokemon`**, **116 boxes, 36 strings, 28 colours**. The window itself is
  `party grid group` `(684, 600, 536, 148)`, `party sel` `(684, 600, 264, 70)`, `party sel bar`
  `(688, 608, 3, 54)` and `slot tile 2/3/4` of `264 × 70` at `956, 600` / `684, 678` /
  `956, 678`; the rest of the frame is the battle behind it (the field, the two HP plates, the
  ball rows, the four menu tabs), which belongs to other adapters.
- `design/exports/05d-battle-pokemon.png` — the export (read only; never diff pixels).
- `design/fixtures/05d-battle-pokemon.json` — the frame's own copy: `switch`
  `{ open: true, selected: 0, rows: [...] }` with **six** members (`CHARIZARD` `LV 36`
  `98/112`, `PIKACHU` `LV 32` `84/112`, `BULBASAUR` `LV 30` `51/102` `PAR`, `GASTLY` `LV 28`
  `21/84` `PSN`, `CHARMANDER` `LV 24` `14/70`, and the sixth), their `enabled` / `field` flags.
- `src/ui/hud/specGap.ts` — `gapFor`, `GAP_TOLERANCE` (1 px), `PanelView`, `ScreenSpec`,
  `SpecBox`; `src/ui/hud/specGap.walk.test.ts` (read, never write).
- `src/ui/hud/panels/battle-switch/view.ts` — `battleSwitchView(input)`, `battleSwitchBox` (= the
  battle menu box), `fixtureSwitchInput(payload, viewport)` (it already forces the card to
  `battleSwitchBox(viewport)`, so the fixture's own `card` is documentation), `SWITCH_ROWS` 6,
  `SwitchRowView` and the row/portrait/label/HP/status rects. **Every box it returns is
  card-relative**: add the card's origin before comparing with a frame rect.
- `src/ui/hud/panels/battle-switch/battleSwitchPanel.tsx` (`data-hud-panel="battle-switch"`,
  `data-hud-switch-row`, `data-hud-switch-label`, `data-hud-switch-portrait`),
  `battleSwitch.css`, `preview.ts`, `fixture.test.ts`, `view.test.ts`.
- `src/ui/partyGrid.ts` — `partyGridLayout`, the one place the row arithmetic lives.
- `src/ui/hud/specGap.views/battle-hp.ts` — the doc-comment table shape to copy;
  `src/ui/hud/specGap.views/bag.ts` + `src/ui/hud/panels/bag/specGap.test.ts` — adapter/test shape.
- `AGENTS.md`, `docs/agent-spec-template.md`. `docs/hud-fidelity.md` is **read only**.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05d-battle-pokemon';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the panel **exactly as the preview does**:
  `fixtureSwitchInput(FIXTURE, { width: 1280, height: 800 })` then `battleSwitchView(input)`. It
  reads no battle, no run, no i18n and no clock. A `null` input yields an empty claim, never a
  throw.
- `boxes`: claim **only** the rects that land within `GAP_TOLERANCE` of the frame's own box of
  the same name. Compute them; do not assume. The shipped card is
  `battleSwitchBox(1280×800)` = `battleMovesBox` = `(676, 582, 564, 192)` while the frame's
  window sits inside `party grid group` `(684, 600, 536, 148)`, and the shipped grid is six
  full-width rows against the frame's two `264 × 70` columns — so expect the honest claim to be
  **`boxes: []`**, and the module's doc comment to carry the table:

  | frame box | frame rect | shipped | why not claimed |
  | --- | --- | --- | --- |
  | `party grid group` | `684, 600, 536, 148` | the card `(676, 582, 564, 192)` + `SWITCH_INSET` | the window is the battle menu's card; the grid's bounding box is a different shape |
  | `slot tile n`, `party sel` | `264 × 70` at `684 / 956 × 600 / 678` | `partyGridLayout`'s rows | two columns in the frame, one six-row list shipped |
  | `party sel bar` | `688, 608, 3, 54` | `battleSwitch.css`'s selected accent | not a view field |
  | the battle behind the window | — | — | `battle-hp`'s, `battle-moves`' and the canvas's (`D49`) |

  Fill it from the real numbers you compute; the rows above are the families.
- `strings`: **exactly** the strings `battleSwitchView` prints that the frame carries, filtered
  by comparing (trimmed, upper-cased) against `spec.text` — the `notices.ts` / `bag.ts` pattern.
  The claim must not be empty: the frame carries the members' names (`Charizard`, `Pikachu`,
  `Bulbasaur`, `Gastly` in `mon name …`), their levels and their HP lines (`LV 36`,
  `98/112`), so at least one row's label must survive the filter. A string the panel prints
  that the frame does not carry is not claimed, and is recorded in the doc comment.
- `colours: []` — the glass, the row skins, the three HP fills and the status mark are the
  stylesheet's tokens, which `scripts/design/check.mjs` covers.
- **Determinism:** no `Rng`, no clock, no DOM. Pure data in, pure data out.

## 🧩 Data and configuration

None. This task introduces no key, no default and no balancing value.

## 🧪 Test and Validation Plan (for QA)

Run this verbatim.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` (once, if `node_modules` is absent).
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-261` against the exclusive paths above.
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
  - [ ] `[unit]` `git diff --name-only main...task-261` names nothing outside the three
        exclusive paths — in particular `panels/battle-switch/README.md` gains exactly one line
        and no other line of it changes.
  - [ ] `[unit]` The adapter answers for its frame: `slug` is `'05d-battle-pokemon'`,
        `gapFor(buildView(SPEC), SPEC)` is empty (`gapIsEmpty`), and the spec's caption is
        `05d Battle · pokemon`.
  - [ ] `[unit]` The premise is pinned on both sides: the test reads
        `frameBox('party grid group')` = `(684, 600, 536, 148)`,
        `frameBox('slot tile 2')` = `(956, 600, 264, 70)` and the shipped
        `battleSwitchView(fixtureSwitchInput(FIXTURE, { width: 1280, height: 800 })!)` card and
        first row, and asserts the row count is `SWITCH_ROWS` and the deltas are **greater than**
        `GAP_TOLERANCE` for the claim it does not make — so the day the grid moves onto the
        frame, the test fails and the empty claim is revisited.
  - [ ] `[unit]` The strings claim is real: `buildView(SPEC).strings` is non-empty, every
        claimed string is one the frame carries (folded), at least one member's name survives
        the filter, and `colours` is empty. A `null` payload yields `boxes: []`, `strings: []`.
  - [ ] `[live]` At 1280×800 in the running game with a battle open, pick the `POKEMON` row in
        the battle command menu: `[data-hud-panel="battle-switch"]` is on screen with exactly one
        `[data-hud-switch-row]` per party member (count the DOM rows and compare with the party
        length the debug overlay reports), and the panel's `getBoundingClientRect()` equals
        `battleSwitchBox({ width: 1280, height: 800 })` = `676, 582, 564, 192` (±1 px). A battle
        opens on the first route, so no run count is needed. Measure with the dev server plus CDP
        over headless Chromium (prefer `renderer.snapshotArea` + `getImageData` for the canvas,
        `getBoundingClientRect` for the DOM card); say which method produced the evidence.
  - [ ] `[unit]` `src/ui/hud/panels/battle-switch/README.md` gains one line for
        `specGap.pokemon.test.ts` in its file map, in the file's own voice, and nothing else
        moves.

## 📣 Coordination

- For the Orchestrator at merge: delete `'05d-battle-pokemon': 'the SWITCH window; no view
  builder is wired',` from `PENDING` in `src/ui/hud/specGap.walk.test.ts` and flip the row
  `| battle-switch | 05d Battle · pokemon | ... | pending |` in `docs/hud-fidelity.md` to
  `wired`, in the merge commit.
- For the next batch: `05e Battle · stats` is the **same panel's second frame** and needs its own
  adapter (`specGap.views/battle-stats.ts`) and its own test
  (`specGap.stats.test.ts`). This task leaves both names free and the README already written, so
  that task claims the README as its own single-writer path and appends one line.

## ⛔ Out of scope

- Do not touch the walker, `docs/hud-fidelity.md`, `src/ui/hud/specGap.ts`, the panel's view
  model, its components, its CSS or `partyGrid.ts`.
- Do not turn the shipped six-row list into a two-column grid to match the frame.
- Do not add the `05e` adapter or its test in this task.

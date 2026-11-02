# Task-259 — the battle message box is wired to its spec

## 🎯 Scope

- **Task type:** tooling / HUD measurement (a Preact panel's spec-gap adapter + its test).
  No scene, no engine rule, no data table.
- **Role:** Dev.
- **Objective:** after this task the `05b Battle · message` frame is answered by an adapter in
  `src/ui/hud/specGap.views/`, so the walker no longer needs a `PENDING` reason for its slug and
  the panel's delta against the frame is pinned by a test: the panel claims the frame's
  `message box` **at a zero delta** because the shipped `battleLogBoard('desktop')` box *is* the
  frame's rect, and it claims the frame's two message lines as **strings**, because the two
  line rects are the board's own insets and not a view field.
- **Environment:** worktree `../wt-pkm-259`, branch `task-259`. A fresh worktree has no
  `node_modules`: install once with `npm ci --prefer-offline --no-audit --no-fund`. Never
  junction `node_modules` or any asset tree in from another tree (`AGENTS.md`, *Asset trees*).
- **Dependencies:** none.

### Exclusive paths (single writer)

Nothing outside this list — `git diff --name-only main...task-259` is audited against it.

- `src/ui/hud/specGap.views/battle-log.ts` *(new)*
- `src/ui/hud/panels/battle-log/specGap.test.ts` *(new)*
- `src/ui/hud/panels/battle-log/README.md` *(the one map line the new test needs)*

**Do not touch** `src/ui/hud/specGap.walk.test.ts` and `docs/hud-fidelity.md`: the `PENDING`
line and the fidelity row for this slug are the **Orchestrator's at merge** (three other tasks
in this batch add adapters to the same two files). See *Expected red* below.

### Inputs (read-only)

- `design/screens/05b-battle-message.json` — the frame spec; `caption` is
  **`05b Battle · message`**, **71 boxes, 9 strings, 22 colours**.
- `design/exports/05b-battle-message.png` — the export (read only; never diff pixels).
- `design/fixtures/05b-battle-message.json` — the frame's own copy: `battleLog`
  `{ visible: true, lines: [{ text: 'VENUSAUR used SLUDGE BOMB!', tone: 'primary' },
  { text: 'CHARIZARD lost 38 HP and is poisoned.', tone: 'effect' }] }` and an empty six-key
  `state`.
- `src/ui/hud/specGap.ts` — `gapFor`, `GAP_TOLERANCE` (1 px), `PanelView`, `ScreenSpec`,
  `SpecBox`; `src/ui/hud/specGap.walk.test.ts` (read, never write).
- `src/ui/hud/panels/battle-log/view.ts` — `fixtureBattleLogView(payload)`,
  `battleLogBoard('desktop' | 'narrow')` (the desktop box is `(664, 544, 576, 216)` and the two
  lines `(696, 580, 292, 20)` / `(696, 612, 294, 15)`), `battleLogLayout`, `BATTLE_LOG_SLUG`.
- `src/ui/hud/panels/battle-log/battleLogPanel.tsx` (`data-hud-battle-log`,
  `data-hud-battle-log-line`), `battleLog.css`, `preview.ts`, `fixture.test.ts`, `view.test.ts`.
- `src/ui/hud/specGap.views/battle-hp.ts` — the adapter that already measured this frame's
  battle field, HP plates, ball rows and menu tabs (`Task-243`); its doc-comment table is the
  shape to copy.
- `src/ui/hud/specGap.views/bag.ts` and `src/ui/hud/panels/bag/specGap.test.ts` — the adapter
  and test shape this repo already uses.
- `AGENTS.md`, `docs/agent-spec-template.md`. `docs/hud-fidelity.md` is **read only**.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '05b-battle-message';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the panel **exactly as the fixture preview does**: it calls
  `fixtureBattleLogView(FIXTURE)` — the fixture above — and returns the three facts `gapFor`
  compares. It reads no battle, no scene, no i18n and no clock.
- `boxes`: **one claim**, `{ name: 'message box', ...battleLogBoard('desktop').box }`, which is
  the frame's `message box` to the pixel — a zero delta. Nothing else lands:
  `message box highlight` `(676, 556, 552, 1)` is the panel's own 1 px rule drawn 12 px down
  (`battleLogPanel.tsx`), not a view field; and the frame's other ~68 boxes are the painted
  battle — `foe name`/`foe hp text`/`player …` are `battle-hp`'s, `menu tab n` and the move
  cells are `battle-moves`', the field and the sprites are the canvas's (`D49`). Record that as
  a table in the module's doc comment, one row per family, as `battle-hp.ts` does.
- `strings`: the fixture's two lines, and only the lines the view actually carries (a `null`
  view or `visible: false` must yield no string — the function is total). Both are the frame's
  `message line 1` / `message line 2`, so `gapFor` folds them to the frame's own text and
  reports nothing.
- `colours: []` — the glass, the hairline and the effect red are the stylesheet's tokens, which
  `scripts/design/check.mjs` covers.
- **Determinism:** no `Rng`, no clock, no DOM. Pure data in, pure data out.

## 🧩 Data and configuration

None. This task introduces no key, no default and no balancing value.

## 🧪 Test and Validation Plan (for QA)

Run this verbatim.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` (once, if `node_modules` is absent).
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-259` against the exclusive paths above.
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
  - [ ] `[unit]` `git diff --name-only main...task-259` names nothing outside the three
        exclusive paths.
  - [ ] `[unit]` The adapter answers for its frame: `slug` is `'05b-battle-message'`,
        `gapFor(buildView(SPEC), SPEC)` is empty (`gapIsEmpty`), and the spec's caption is
        `05b Battle · message`.
  - [ ] `[unit]` The box claim is a real zero delta, pinned against the frame: the adapter's
        one box is named `message box` and its rect equals
        `frameBox('message box')` = `(664, 544, 576, 216)` exactly — the test reads the frame
        box from `design/screens/05b-battle-message.json` by name and compares, so a change to
        either side fails. It also pins `battleLogBoard('desktop').box` to the same numbers.
  - [ ] `[unit]` The strings claim is real and total: `buildView(SPEC).strings` is exactly the
        fixture's two lines (folded case-insensitively they are the frame's `message line 1`
        and `message line 2`), `fixtureBattleLogView(null)` and a payload with no `battleLog`
        block yield an empty `strings`, and `colours` is empty.
  - [ ] `[live]` At 1280×800 in the running game with a battle open, `[data-hud-battle-log]`
        carries `data-visible="true"`, one or two `.battle-log__line` (or
        `[data-hud-battle-log-line]`) nodes carry non-empty text, and the panel's
        `getBoundingClientRect()` equals the battle menu card's own rect on the same layout —
        compare it with `battleMovesBox({ width: 1280, height: 800 })` from
        `src/ui/hud/panels/battle-moves/` (the log mounts the battle menu's card,
        `panels/battle-log/view.ts`, `battleLogLayout`) within ±1 px, and with the rect of the
        menu card element on the same page if it is in the DOM. A battle opens on the first
        route (a trainer's sight or a grass step), so no run count is needed. Measure with the
        dev server plus CDP over headless Chromium (prefer `renderer.snapshotArea` +
        `getImageData` for the canvas, `getBoundingClientRect` for the DOM card); say which
        method produced the evidence.
  - [ ] `[unit]` `src/ui/hud/panels/battle-log/README.md` gains one line for
        `specGap.test.ts` in its file map, in the file's own voice, and nothing else moves.

## 📣 Coordination

- For the Orchestrator at merge: delete `'05b-battle-message': 'the battle message box; no view
  builder is wired',` from `PENDING` in `src/ui/hud/specGap.walk.test.ts` and flip the row
  `| battle-log | 05b Battle · message | ... | pending |` in `docs/hud-fidelity.md` to `wired`,
  in the merge commit.
- For the next batch: `05h`/`m05b` remain the only unmeasured battle frames; this adapter's
  doc comment is the map of what is already claimed by whom.

## ⛔ Out of scope

- Do not touch the walker, `docs/hud-fidelity.md`, `src/ui/hud/specGap.ts`, the panel's view
  model, its components or its CSS.
- Do not claim `message box highlight`, the HP plates, the ball rows, the menu tabs or the
  painted field.
- Do not change `battleLogBoard`, `battleLogLayout` or `DESKTOP_BOX` to make a claim land.

# Spec: Task-257 — The options screen is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD adapter (TypeScript, read-only over a shipped Preact panel).
- **Role:** Dev.
- **Objective:** after this task the `02 Options` frame (`design/screens/02-options.json`)
  has one adapter in `src/ui/hud/specGap.views/options.ts` exporting `slug` and
  `buildView(spec)`, the walker's `PENDING` line for `02-options` is gone, and
  `docs/hud-fidelity.md`'s `options` row reads `wired`. The adapter claims the strings
  the shipped `OptionsView` prints and claims no box and no colour, because the model
  carries no rect: `options.css` owns the geometry. That "no box" is the measurement,
  not an omission — a premise test pins the frame's 33 boxes and its two cards at
  `96, 200, 640, 470` / `760, 200, 424, 470` in `[unit]` so the zero claim is evidence.
- **Environment:** worktree `../wt-pkm-257`, branch `task-257`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/options.ts` (new)
- `src/ui/hud/panels/options/specGap.test.ts` (new)
- `src/ui/hud/panels/options/README.md` (one added line)
- `src/ui/hud/specGap.walk.test.ts` (**only** the deletion of the `'02-options'` line
  inside the `PENDING` map; do not reflow or reformat the rest)
- `docs/hud-fidelity.md` (**only** the `options` row of the table under *The table*
  that currently reads `| options | 02 Options | \`02-options\` | 33 | 35 | 16 | pending |`;
  flip its last cell to `wired`. Do not touch any other row, in particular not
  `05e-battle-stats` or `06-run-over-defeat`, which batch-mates own in the same file.)

Nothing outside this list.

### Inputs (read-only)

- `AGENTS.md`.
- `design/screens/02-options.json` and `design/exports/02-options.png` — the frame
  `02 Options` (`design/board.json`, node `1:1557`), **33 boxes, 35 strings, 16
  colours**.
- `design/fixtures/02-options.json` — its `panel` block is the desktop payload.
- `src/ui/hud/specGap.ts` — `PanelView`, `GapBox`, `ScreenSpec`, `gapFor`, `GAP_TOLERANCE`.
- `src/ui/hud/specGap.views/battle-log.ts` and `src/ui/hud/specGap.views/notice-level-up.ts`
  — the adapter shape to copy (import the fixture, one `slug`, one `buildView`, a
  comment table for what is not claimed).
- `src/ui/hud/panels/battle-log/specGap.test.ts` and
  `src/ui/hud/panels/pause/specGap.test.ts` — the test shape to copy.
- `src/ui/hud/panels/options/view.ts` (the `OptionsView` model and
  `fixtureOptionsView(payload, narrow)`), `optionsPanel.tsx`, `index.ts`, `README.md`.
- `src/ui/hud/specGap.walk.test.ts` — locate your `PENDING` line here.
- `docs/hud-fidelity.md` — locate your row here.

## 🔒 Contract

```ts
// src/ui/hud/specGap.views/options.ts
export const slug = '02-options';
export function buildView(spec: ScreenSpec): PanelView;
```

- Build the view exactly as the preview does: `fixtureOptionsView(FIXTURE.panel, false)`
  at a desktop viewport of `{ width: 1280, height: 800 }`, where `FIXTURE` is the default
  import of `design/fixtures/02-options.json` cast to `{ panel: unknown }`. A payload
  that does not read as an `OptionsView` yields `{ boxes: [], strings: [], colours: [] }`.
- `boxes: []` and `colours: []`, always: `OptionsView` has no rect field
  (`title`, `subtitle`, `footer`, `back`, `reset`, `selected`, `groups` of
  `{ id, kind, label, value, fraction, on }`) and every colour is the stylesheet's
  token. Say this in the doc comment, with the frame's card rects in a small table.
- `strings` is the copy the model carries that the frame also prints, in view order:
  `title`, `subtitle`, `footer`, `back`, `reset`, then each group's `title` and each
  row's `label` and `value`. Drop `''` and `null`. `selected` is a row id, not copy.
- Deterministic and total: no `Rng`, no clock, no DOM, no store, no i18n call — the
  fixture's own strings and the same exported `fixtureOptionsView` give the same view
  every time.

## 🧩 Data and configuration

None. This task introduces no JSON keys, no data table and no balancing value.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree (a fresh
    worktree has no `node_modules`).
  - `npm test` — Vitest, headless; must be green, including the new test.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-257` audited against the exclusive paths.
  - `npx vitest run src/ui/hud/specGap.walk.test.ts` specifically.
  - The browser pass below.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/ui/hud/panels/options/specGap.test.ts` asserts: `slug` is
    `'02-options'` and equals the spec's slug; the spec carries 33 boxes, 35 text nodes
    and 16 colours; `buildView(SPEC)` equals the expected `PanelView` exactly
    (`boxes: []`, `colours: []`, the string list above); `gapFor(buildView(SPEC), SPEC)`
    is empty in all four lists; two calls are deep-equal.
  - [ ] `[unit]` The premise test pins `card gameplay` at `96, 200, 640, 470` and
    `card keybinds` at `760, 200, 424, 470` in the spec, asserts the spec's 33 boxes,
    and asserts the model carries no rect field (e.g. no `x`/`y`/`w`/`h` key on any
    group or row object), so `boxes: []` is the measured answer.
  - [ ] `[unit]` `src/ui/hud/specGap.walk.test.ts` is green and its `PENDING` map no
    longer carries `'02-options'`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800 from the main menu's `OPTIONS` row:
    `[data-hud-panel="options"]` exists and is visible;
    `[data-hud-group="gameplay"]`'s `getBoundingClientRect()` reads
    `x=96, y=200, w=640, h=470` and `[data-hud-group="keybinds"]` reads
    `x=760, y=200, w=424, h=470`, each within ±1 px. **Measurement:** start
    `npm run dev -- --port <free> --strictPort`, drive headless Chromium over CDP,
    press the main menu's `OPTIONS` row (or click it), then read
    `element.getBoundingClientRect()` on the two elements above. Report the four
    numbers and the viewport. Prefer reading the live DOM/canvas over a screenshot.

## 📣 Coordination

- For Task QA: this task owns the `'02-options'` line of `PENDING` and the `options`
  row of `docs/hud-fidelity.md`; batch-mates own the `05e-battle-stats` and
  `06-run-over-defeat` rows of the same files.
- For the Orchestrator: the `OptionsView` model intentionally carries no geometry; if
  the adapter ever claims a box, that is a regression against `D57`'s rule that the
  stylesheet paints the options screen.

## ⛔ Out of scope

- Do not add rects to `OptionsView` or change `options.css`, `optionsPanel.tsx` or
  `view.ts`.
- Do not wire the `mobile` block or the 390×844 frame; only the desktop frame is this
  row's claim.
- Do not touch `docs/hud-fidelity.md`'s pixel-result rows (lines with `1280x800` /
  `390x844` columns), only the panel table's `options` row.

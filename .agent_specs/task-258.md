# Task-258 — the level-up notice is wired to its spec

## 🎯 Scope

- **Task type:** tooling / HUD measurement (a Preact panel's spec-gap adapter + its test).
  No scene, no engine rule, no data table.
- **Role:** Dev.
- **Objective:** after this task the `03l Panels · notice level up` frame is answered by an
  adapter in `src/ui/hud/specGap.views/`, so the spec-gap walker no longer needs a `PENDING`
  reason for its slug and the panel's measured delta against the frame — the strip is **132
  px tall in the frame and 56 px in the panel**, and the frame's two `move type` chips have no
  field at all — is pinned by a test instead of living in a paragraph.
- **Environment:** worktree `../wt-pkm-258`, branch `task-258`. A fresh worktree has no
  `node_modules`: install once with `npm ci --prefer-offline --no-audit --no-fund`. Never
  junction `node_modules` or any asset tree in from another tree (`AGENTS.md`, *Asset trees*).
- **Dependencies:** none.

### Exclusive paths (single writer)

Nothing outside this list — `git diff --name-only main...task-258` is audited against it.

- `src/ui/hud/specGap.views/notice-level-up.ts` *(new)*
- `src/ui/hud/panels/notices/specGap.levelUp.test.ts` *(new)*
- `src/ui/hud/panels/notices/README.md` *(the one map line the new test needs)*

**Do not touch** `src/ui/hud/specGap.walk.test.ts` and `docs/hud-fidelity.md`. Their `PENDING`
line and the fidelity row for this slug are the **Orchestrator's at merge** (three other tasks
in this batch add adapters to the same two files), so they stay as they are on your branch and
move in the merge commit. See *Expected red* below for what that means for your gate.

### Inputs (read-only)

- `design/screens/03l-panels-notice-level-up.json` — the frame spec; `caption` is
  **`03l Panels · notice level up`**, and the frame carries **5 boxes, 5 strings, 6 colours**.
- `design/exports/03l-panels-notice-level-up.png` — the export (read only; do not diff pixels).
- `design/fixtures/03l-panels-notice-level-up.json` — the frame's own copy:
  `{ screen: 'notices', notice: { text: 'BULBASAUR GREW TO LV 18!' }, mission: null, area: null }`
  and an empty six-key `state`.
- `src/ui/hud/specGap.ts` — `gapFor`, `GAP_TOLERANCE` (1 px), `PanelView`, `ScreenSpec`,
  `SpecBox`; `src/ui/hud/specGap.walk.test.ts` (read, never write).
- `src/ui/hud/specGap.views/notices.ts` — the **same panel's first adapter**, for `03k`: copy
  its shape (one `slug`, one `buildView`).
- `src/ui/hud/panels/notices/view.ts` — `noticesPanelView(input, viewport)`, `noticeBox`,
  `areaBox`, and the desktop constants (`NOTICE_W` 720, `NOTICE_H` 56, `DESKTOP_TOP` 24).
- `src/ui/hud/panels/notices/noticesPanel.tsx` (`data-hud-notice`, `data-hud-panel="notices"`),
  `notices.css`, `fixture.test.ts`, `view.test.ts`.
- `src/ui/hud/panels/bag/specGap.test.ts` — the shape a per-panel spec-gap test takes in this
  repo (premise numbers, `frameBox`, `gapFor`).
- `AGENTS.md`, `docs/agent-spec-template.md`. `docs/hud-fidelity.md` is **read only**.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

/** The screen this adapter answers for: one slug, one spec, one panel. */
export const slug = '03l-panels-notice-level-up';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the panel **exactly as the running panel does**: it reads the fixture's
  `notice.text` and calls `noticesPanelView({ notice: FIXTURE.notice.text, area: null },
  { width: 1280, height: 800 })`. It reads no run, no scene, no i18n and no clock.
- It returns the three facts `gapFor` compares:
  - `boxes: []` — **and this is the measurement, not an omission.** `noticeBox(1280×800)` is
    `(280, 24, 720, 56)`; the frame's `level up strip` is `(280, 24, 720, 132)`. `x`, `y` and
    `w` agree and `h` is 76 px off, so the box is *moved*, and the only honest claim is none.
    The frame's other boxes — `level up strip highlight` `(292, 36, 696, 1)`, `move type 1`
    `(304, 92, 24, 24)`, `move type 2` `(304, 118, 24, 24)` and `route screenshot`
    `(0, 0, 1280, 800)` — are the stylesheet's hairline, two chips the panel has **no field
    for**, and the route behind the strip.
  - `strings` — the one line the strip prints, i.e. the fixture's `notice.text`. It is the
    frame's `level line`, so `gapFor` folds it to the frame's own text and reports nothing.
  - `colours: []` — the strip paints no colour of its own; the glass is the stylesheet's
    tokens, which `scripts/design/check.mjs` already covers.
- The module's doc comment carries the table the `battle-hp` adapter uses: frame box → shipped
  rect → why it is not claimed. `gapFor` is total and `box.name` is matched exactly, so a
  renamed box is a `missing` gap.
- **Determinism:** no `Rng`, no clock, no DOM. Pure data in, pure data out.

## 🧩 Data and configuration

None. This task introduces no key, no default and no balancing value.

## 🧪 Test and Validation Plan (for QA)

Run this verbatim.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` (once, if `node_modules` is absent).
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-258` against the exclusive paths above.
  - One browser pass, for the single `[live]` criterion.

- **Expected red (one, and only one):** `src/ui/hud/specGap.walk.test.ts` › *"accounts for
  every screen: mapped, or a named reason"* fails **on this slug only**, because the adapter is
  mapped while the walker's `PENDING` still names the slug. That line is the Orchestrator's at
  merge: do not edit the walker or `docs/hud-fidelity.md` to make it green. Every other test in
  the suite must pass, and the QA report must record this as the expected red, not as a pass
  and not as a second failure. After the merge the whole suite is green.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `npm test` is green except the single expected red above, and the new test
        file runs (it is not skipped).
  - [ ] `[unit]` `git diff --name-only main...task-258` names nothing outside the three
        exclusive paths.
  - [ ] `[unit]` The adapter answers for its frame: `slug` is `'03l-panels-notice-level-up'`,
        the spec at `design/screens/03l-panels-notice-level-up.json` exists, and
        `gapFor(buildView(SPEC), SPEC)` is empty (`gapIsEmpty`), with the frame's caption
        `03l Panels · notice level up`.
  - [ ] `[unit]` The premise is pinned, not asserted in prose: with
        `viewport = { width: 1280, height: 800 }`, `noticeBox(viewport)` is
        `{ x: 280, y: 24, w: 720, h: 56 }` while the frame's `level up strip` is
        `(280, 24, 720, 132)` — so the test fails if someone shrinks the frame's strip or grows
        the panel's, which is exactly when `boxes: []` stops being true. The frame's two
        `move type` boxes are located by name (`frameBox('move type 1')` etc.), never by index.
  - [ ] `[unit]` The strings claim is real: `buildView(SPEC).strings` contains
        `BULBASAUR GREW TO LV 18!` (folded case-insensitively) and the test reads it from
        `design/fixtures/03l-panels-notice-level-up.json`, not from a literal in the test.
  - [ ] `[live]` At 1280×800 in the running game, after a battle that levels a party member,
        `[data-hud-notice]` exists and `getBoundingClientRect()` reads **`x 280, y 24, w 720,
        h 56`** (±1 px), and the element's text content is non-empty. Measure with the dev
        server plus CDP over headless Chromium (prefer `renderer.snapshotArea` +
        `getImageData` for the canvas and `getBoundingClientRect` for the DOM card); say
        which method produced the evidence. If no level-up happens within two runs' first two
        battles, report **not run** with the battles tried — this criterion is `[live]` and the
        others are not negotiable.
  - [ ] `[unit]` `src/ui/hud/panels/notices/README.md` gains one line for
        `specGap.levelUp.test.ts` in its file map, in the file's own voice, and nothing else
        in that file moves.

## 📣 Coordination

- For the Orchestrator at merge: delete
  `'03l-panels-notice-level-up': 'the level-up notice; no view builder is wired',` from
  `PENDING` in `src/ui/hud/specGap.walk.test.ts` and flip the matching row in
  `docs/hud-fidelity.md` (line `| notices | 03l Panels · notice level up | ... | pending |`)
  from `pending` to `wired`, in the merge commit.
- For the next batch: `03k` and `03l` now both answer through adapters on the `notices` panel;
  a third notices frame can be added without touching either.

## ⛔ Out of scope

- Do not change the notice strip's height, its position or its CSS to match the frame's 132 px.
  The frame's strip carries a learned-moves block that is the **Phaser learn popup** in the
  running game; matching it is a different task.
- Do not touch the walker, `docs/hud-fidelity.md`, `src/ui/hud/specGap.ts`, the panel's view
  model or its components.
- Do not delete `PENDING` lines for other slugs.

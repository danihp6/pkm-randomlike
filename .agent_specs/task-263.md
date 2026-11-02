# Spec: Task-263 — The defeat card is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD adapter (TypeScript, read-only over a shipped panel).
- **Role:** Dev.
- **Objective:** the `06 Run over · defeat` frame grows one adapter,
  `src/ui/hud/specGap.views/run-over-defeat.ts`, exporting `slug = '06-run-over-defeat'`
  and `buildView(spec)`. It builds `fixtureRunOverView(FIXTURE)` at 1280×800, claims the
  four boxes the shipped board lands on to the pixel (`run over panel`,
  `main menu button`, `tab totals`, `tab pokemon`), claims the strings the card prints,
  and records the accent and the four rules the stylesheet paints. The walker's
  `PENDING` line for `06-run-over-defeat` is gone, `docs/hud-fidelity.md`'s `run-over` /
  `06` row flips to `wired`, and the panel's README gains one line.
- **Environment:** worktree `../wt-pkm-263`, branch `task-263`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/run-over-defeat.ts` (new)
- `src/ui/hud/panels/run-over/specGap.defeat.test.ts` (new)
- `src/ui/hud/panels/run-over/README.md` (one added line)
- `src/ui/hud/specGap.walk.test.ts` (**only** the deletion of the
  `'06-run-over-defeat'` line inside the `PENDING` map; do not reflow or reformat the
  rest)
- `docs/hud-fidelity.md` (**only** the `| run-over | 06 Run over · defeat |
  \`06-run-over-defeat\` | 12 | 14 | 14 | pending |` row of the panel table: flip its
  last cell to `wired`. Do not touch the `02-options` or `05e-battle-stats` rows, nor
  the `07`/`07b` victory rows, nor any pixel-result row.)

Nothing outside this list.

### Inputs (read-only)

- `AGENTS.md`.
- `design/screens/06-run-over-defeat.json` and
  `design/exports/06-run-over-defeat.png` — the frame `06 Run over · defeat`
  (`design/board.json`, node `6:2171`), **12 boxes, 14 strings, 14 colours**.
- `design/fixtures/06-run-over-defeat.json` — its `runOver` block is the payload
  (`won`, `tab`, `title`, `blurb`, four `stats`, `share`, `button`, `tabLabels`, empty
  `rows`).
- `src/ui/hud/specGap.ts` — `PanelView`, `GapBox`, `ScreenSpec`, `GAP_TOLERANCE`.
- `src/ui/hud/panels/run-over/view.ts` — `fixtureRunOverView`, `runOverBoard`,
  `RunOverView`, `RunOverBoard`, `RunOverRect`.
- `src/ui/hud/specGap.views/battle-pokemon.ts` and
  `src/ui/hud/specGap.views/pause.ts` — the adapter shape to copy.
- `src/ui/hud/panels/pause/specGap.test.ts` — the test shape to copy.
- `src/ui/hud/panels/run-over/README.md` (append your line; change nothing else).
- `src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md` — locate your entries.

## 🔒 Contract

```ts
// src/ui/hud/specGap.views/run-over-defeat.ts
export const slug = '06-run-over-defeat';
export function buildView(spec: ScreenSpec): PanelView;
```

- Build the card exactly as the preview does: `fixtureRunOverView(FIXTURE)` at a desktop
  viewport of `{ width: 1280, height: 800 }`, where `FIXTURE` is the default import of
  `design/fixtures/06-run-over-defeat.json` cast to a provided type whose only read key
  is `runOver`. A payload that does not read as a `RunOverView` yields
  `{ boxes: [], strings: [], colours: [] }`.
- Box claims, from `runOverBoard('desktop')` and the view:
  - `run over panel` ← `board.panel` `{ 280, 170, 720, 480 }`,
  - `main menu button` ← `board.button` `{ 540, 590, 200, 40 }`,
  - `tab totals` ← `board.tabs[0]` `{ 336, 312, 90, 24 }`,
  - `tab pokemon` ← `board.tabs[1]` `{ 432, 312, 100, 24 }`.
  Claim each only if the spec draws that name at that rect within `GAP_TOLERANCE`
  (a `claim` helper like `battle-pokemon.ts`'s); all four are zero-delta.
- Boxes the frame draws but this task does **not** claim, recorded in the comment table
  with their rects and the reason: `run over panel highlight`, `run over accent` and
  `run over rule 0…3` (the stylesheet's paint off the panel and the stat rows),
  `route screenshot` (the route canvas behind the card, `D49`) and `scrim` (the scene's).
  The title, blurb, four stat rows and share have **no named box** in the frame — they
  are text nodes only — so they are claimed as strings, never as boxes.
- `strings`, in view order and only where the frame carries the same line folded
  (trim + uppercase as `gapFor` folds): `title`, `blurb`, each stat's `label` and
  `value` (four pairs), `share`, `button.label`, `tabLabels.totals`,
  `tabLabels.pokemon`. Drop `''`.
- `colours: []`: every colour is `run-over.css`'s token.
- Deterministic and total: no `Rng`, no clock, no DOM, no store, no i18n.

## 🧩 Data and configuration

None. This task introduces no JSON key, no data table and no balancing value.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless, green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-263` audited against the exclusive paths.
  - `npx vitest run src/ui/hud/specGap.walk.test.ts`.
  - The browser pass below.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `specGap.defeat.test.ts` asserts: `slug` is `'06-run-over-defeat'` and
    equals the spec's slug; the spec carries 12 boxes, 14 text nodes, 14 colours;
    `buildView(SPEC)` equals the expected view exactly (the four boxes above at their
    frame rects, the string list above, `colours: []`); the card's panel and button
    rects equal `runOverBoard('desktop').panel` / `.button`; `gapFor` is empty in all
    four lists; two calls are deep-equal; a payload with no `runOver` block returns the
    empty view.
  - [ ] `[unit]` The five stat-row labels and values are each **both** claimed as
    strings, and no box whose rect the frame does not draw is invented.
  - [ ] `[unit]` `src/ui/hud/specGap.walk.test.ts` is green and its `PENDING` map no
    longer carries `'06-run-over-defeat'`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800 on a run whose party is wiped:
    `[data-hud-run-over]` is on screen with `data-won="false"` and
    `[data-hud-run-over-panel]`'s `getBoundingClientRect()` reads
    `x=280, y=170, w=720, h=480` (±1 px); `[data-hud-run-over-title]` prints the
    frame's `YOU HAVE NO MORE POKEMON!`. **Measurement:** `npm run dev -- --port <free>
    --strictPort`, headless Chromium over CDP, then a run whose party faints (walk into
    grass and lose). Report the rect and the title text. This state costs a **whole
    run**; if no defeat arrives within three runs, report this criterion **not run**
    with the runs tried and the `[unit]` premise stands.

## 📣 Coordination

- For Task QA: this task owns the `'06-run-over-defeat'` line of `PENDING` and the
  `run-over`/`06` row of `docs/hud-fidelity.md`; the `07`/`07b` victory rows and the
  `07`/`07b` `PENDING` lines belong to no task in this batch.
- For the Orchestrator: the victory frames are retired by the region phase; do not wire
  them here.

## ⛔ Out of scope

- Do not change `run-over/view.ts`, `runOverPanel.tsx`, `run-over.css` or the panel's
  markup.
- Do not wire `07-run-over-victory` or `07b-run-over-victory-pokemon`.
- Do not claim `route screenshot`/`scrim`: those are the scene's, not the panel's.

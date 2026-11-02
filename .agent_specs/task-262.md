# Spec: Task-262 — The SWITCH window's stats state is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD adapter (TypeScript, read-only over a shipped panel).
- **Role:** Dev.
- **Objective:** the pair's **second** frame on one panel gets its own adapter:
  `src/ui/hud/specGap.views/battle-stats.ts` exports `slug = '05e-battle-stats'` and
  `buildView(spec)`, building the shipped SWITCH window from the frame's own fixture at
  1280×800, claiming exactly the boxes and lines that land and recording the stat block
  it cannot reach in a small table. The walker's `PENDING` line for `05e-battle-stats`
  is gone and `docs/hud-fidelity.md`'s `battle-switch` / `05e` row flips to `wired`.
  `[Task-261]` owns the same panel's `05d` frame and that folder's `README.md`; this task
  owns **no README** and its Task QA checks
  `src/ui/hud/panels/battle-switch/README.md` is byte-identical to `main`.
- **Environment:** worktree `../wt-pkm-262`, branch `task-262`.
- **Dependencies:** none. (`05d`'s adapter, `specGap.views/battle-pokemon.ts`, is
  already merged and may be read as the pattern.)

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/battle-stats.ts` (new)
- `src/ui/hud/panels/battle-switch/specGap.stats.test.ts` (new)
- `src/ui/hud/specGap.walk.test.ts` (**only** the deletion of the
  `'05e-battle-stats'` line inside the `PENDING` map; do not reflow or reformat the
  rest)
- `docs/hud-fidelity.md` (**only** the `| battle-switch | 05e Battle · stats |
  \`05e-battle-stats\` | 111 | 33 | 28 | pending |` row of the panel table: flip its
  last cell to `wired`. Do not touch the `02-options` row, the `06-run-over-defeat`
  row or any pixel-result row.)

Nothing outside this list. In particular: **not**
`src/ui/hud/panels/battle-switch/README.md`, not `view.ts`, not `mount.tsx`, not
`battleSwitch.css`, not the `05d` adapter or its test.

### Inputs (read-only)

- `AGENTS.md`.
- `design/screens/05e-battle-stats.json` and `design/exports/05e-battle-stats.png` —
  the frame `05e Battle · stats` (`design/board.json`, node `6:1879`), **111 boxes, 33
  strings, 28 colours**.
- `design/fixtures/05e-battle-stats.json` — its `switch` block is the payload
  (`open`, `card`, `selected`, four `rows`); it carries no stat block.
- `src/ui/hud/specGap.ts` — `PanelView`, `GapBox`, `ScreenSpec`, `GAP_TOLERANCE`.
- `src/ui/hud/specGap.views/battle-pokemon.ts` — the same panel's `05d` adapter: copy
  its `buildViewFor`, `claim` and `stringClaims` shape.
- `src/ui/hud/panels/battle-pokemon/../battle-switch/view.ts` — `battleSwitchView`,
  `fixtureSwitchInput`, `BattleSwitchView`, `Rect`, `Viewport`.
- `src/ui/hud/panels/battle-switch/specGap.pokemon.test.ts` — the test shape to copy.
- `src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md` — locate your entries.

## 🔒 Contract

```ts
// src/ui/hud/specGap.views/battle-stats.ts
export const slug = '05e-battle-stats';
export function buildView(spec: ScreenSpec): PanelView;
export function buildViewFor(payload: unknown, spec: ScreenSpec): PanelView;
```

- `buildView` calls `buildViewFor(FIXTURE, spec)` with the default import of
  `design/fixtures/05e-battle-stats.json` cast to `Readonly<{ switch: unknown }>`.
- `buildViewFor` calls `fixtureSwitchInput(payload, { width: 1280, height: 800 })`;
  when it returns `null`, return `{ boxes: [], strings: [], colours: [] }`; otherwise
  build `battleSwitchView(input)`.
- Box claims are **measured, not assumed**: for each candidate (`party grid group`,
  `battle menu`, `party sel`, `slot tile 2/3/4`, the `battle menu` family) read its page
  rect from `BattleSwitchView` and claim the frame's box of that name only when all four
  numbers agree within `GAP_TOLERANCE` (the same `claim` helper as `battle-pokemon.ts`).
  In practice the shipped card is `battleSwitchBox(1280×800)` while `05e` draws the two
  columns, so record the deltas in a comment table whose rows name the frame box, its
  rect, the shipped rect and the delta — and claim what actually lands.
- String claims: the copy the card prints that the frame also carries, each compared
  folded as `gapFor` folds it (trim + uppercase): the four member names, each row's
  fitted `label.text`, `hpText` and `statusLabel` when non-empty, and the back glyph.
  **The stat block is not claimed as text**: the frame's `stat row label 0…4` /
  `stat row value 0…4` (`ATTACK 84`, `DEFENSE 78`, `SP. ATK 109`, `SP. DEF 85`,
  `SPEED 100`), `tab stats label`, `tab moves label`, `detail nature`, `detail ability`
  and `detail item name` are lines the shipped `BattleSwitchView` does not print (the
  window has no stats state); list them in the comment as the frame's own, not as a gap.
- `colours: []`: the glass, the bars and the marks are `battleSwitch.css`'s tokens.
- Deterministic and total: no `Rng`, no clock, no DOM, no store, no i18n.

## 🧩 Data and configuration

None. This task introduces no JSON key, no data table and no balancing value.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless, green.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-262` audited against the exclusive paths; confirm
    `src/ui/hud/panels/battle-switch/README.md` is unchanged.
  - `npx vitest run src/ui/hud/specGap.walk.test.ts`.
  - The browser pass below.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `specGap.stats.test.ts` asserts: `slug` is `'05e-battle-stats'` and
    equals the spec's slug; the spec carries 111 boxes, 33 text nodes, 28 colours;
    `buildView(SPEC)` is deterministic (two calls deep-equal) and reports an empty
    `gapFor(buildView(SPEC), SPEC)` in all four lists; a payload with no `switch` block
    returns the empty view; the stat-row strings (`ATTACK` … `SPEED`) are **absent**
    from the claimed strings, and the frame's five rule boxes are not claimed.
  - [ ] `[unit]` `src/ui/hud/specGap.walk.test.ts` is green and its `PENDING` map no
    longer carries `'05e-battle-stats'`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; the panel README is
    byte-identical to `main`.
  - [ ] `[live]` At 1280×800 in a battle, open the switch window and its stats state:
    `[data-hud-panel="battle-switch"]` is visible and each of its
    `[data-hud-switch-row]` elements' `getBoundingClientRect()` equals the page rect
    `battleSwitchView` gives that row's `row` field for the same input, within ±1 px;
    the back control `[data-hud-switch-back]` is present. Report the rows' four numbers
    and the viewport. **Measurement:** `npm run dev -- --port <free> --strictPort`,
    headless Chromium over CDP, reach a battle (a trainer's sight or a grass step on
    the first route), press `POKEMON`, then read the rects and the DOM. If no battle can
    be reached within three runs, report the criterion **not run** with the runs tried;
    the `[unit]` premise stands. Prefer reading live DOM/canvas over a screenshot.

## 📣 Coordination

- For Task QA: this task owns the `'05e-battle-stats'` line of `PENDING` and the
  `battle-switch`/`05e` row of `docs/hud-fidelity.md`; nothing else in the panel folder.
- For the Orchestrator: the panel has **no** stats state; if the adapter claims the
  frame's stat rows as boxes, it is fabricating geometry and must be rejected.

## ⛔ Out of scope

- Do not add a stats state to `BattleSwitchView`, and do not change the panel's markup,
  CSS or README.
- Do not touch `05d`'s adapter, test or the `05d` row.
- Do not claim the battle behind the window (the two HP plates, the ball rows, the
  sprites, the four menu tabs) — those are `battle-hp`, `battle-moves` and the canvas's.

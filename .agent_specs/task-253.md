# Spec: Task-253 — the trade counter's result card is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling / HUD spec-gap adapter (pure TypeScript + Vitest; no Phaser, no DOM).
- **Role:** Dev.
- **Objective:** the trade counter's **result state** gains its own spec-gap adapter, so the card
  a landed trade shows is measured against the imported frame `03j Panels · trade result` and the
  four boxes and five lines it draws are claimed at a zero delta. After this task
  `src/ui/hud/specGap.walk.test.ts` discovers an adapter for `03j-panels-trade-result`, and
  `gapFor(buildView(spec), spec)` is empty for that slug.
- **Environment:** worktree `../wt-pkm-253` (sibling of the repo checkout), branch `task-253`,
  which already carries the commit `spec: task-253`. `node_modules` may be absent: install once
  with `npm ci --prefer-offline --no-audit --no-fund` (never a network-only `npm ci`, never a
  junction or symlink of another tree's `node_modules`). Work only inside that worktree.
- **Dependencies:** none. `tradePanelView`, its result state and the fixture already exist on
  `main`. The batch-mate Task-252 writes `panels/trade/README.md` and
  `specGap.views/trade-pick.ts`; you do not touch either.

### Exclusive paths (single writer)

Nothing outside this list. Both files are new.

- `src/ui/hud/specGap.views/trade-result.ts` — **new**: the adapter.
- `src/ui/hud/panels/trade/specGap.result.test.ts` — **new**: its test.

**Do not touch** `src/ui/hud/panels/trade/README.md` (Task-252 owns it — your Task QA checks it is
byte-identical to `main`), `src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`,
`CHANGELOG.md` or `design/**`. The Orchestrator removes this slug's `PENDING` line and flips its
table row in the merge commit (see *Coordination*).

### Inputs (read-only)

- `AGENTS.md` (the whole file).
- `design/screens/03j-panels-trade-result.json` and `design/exports/03j-panels-trade-result.png` —
  the frame `03j Panels · trade result` (board node `6:1559`), **7 boxes, 5 strings, 7 colours**.
- `design/fixtures/03j-panels-trade-result.json` — its `result` block is this row's input; its
  `pick` block belongs to Task-252's frame and is not read here.
- `src/ui/hud/specGap.ts` — `GAP_TOLERANCE`, `PanelView`, `GapBox`, `ScreenSpec`, `gapFor`.
- `src/ui/hud/specGap.views/README.md` and the shipped pattern
  `src/ui/hud/specGap.views/rewards-pokemon.ts` (claim helper, `at`, `stringClaims`).
- `src/ui/hud/specGap.walk.test.ts` — how the walker discovers an adapter.
- `src/ui/hud/panels/trade/view.ts` — `tradePanelView`, `TradeInput`, `TradePanelView`, `Rect`;
  note `result.card` is **panel-relative** while every rect inside `result` is **card-relative**,
  and `view.highlight` is already lifted into panel coordinates in the result state.
- `src/ui/hud/panels/trade/fixture.test.ts` — the `inputFrom` mapping you must mirror (and its
  `03j` result assertions, which already pin `type.box` = `268, 296, 24, 24` card-relative).
- `src/i18n/en.ts` — the `trade.*` keys.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

export const slug = '03j-panels-trade-result';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the view **exactly as the running card builds it**:
  `tradePanelView(inputFrom(FIXTURE.result), { width: 1280, height: 800 })`, where `inputFrom` is
  the same mapping `panels/trade/fixture.test.ts` uses (restated here, it is not exported). The
  fixture's `result` block has `kind: 'result'`, six party members (the received `SHELLDER` last),
  five PC members, `received: { name: 'SHELLDER', level: 18, type: 'water', frame: 90 }`.
- `spec` is read only as a structural selector — *does the frame draw this box name*, *is this
  line the board's text*. The shipped numbers come from `view.ts`.
- **Determinism:** no `Rng`, no clock, no DOM, no store, no Phaser, no i18n side effect beyond the
  panel's own `t()` calls inside `view.ts`. Same spec ⇒ same view.
- No `src/engine/`, no `src/data/**`, no `src/scenes/**`, no `src/main.ts`.

### The boxes you claim — four, every delta 0

The shipped result card **is** the frame's card: `result.card` is `100, 70, 560, 420`
panel-relative, which lands on `360, 190` once the pick box `260, 120` is added. Note the two
coordinate frames: `result.card` is panel-relative; `result.highlight`, `result.portrait` and
`result.type.box` are card-relative, so they need **two** `at()` lifts (card origin, then box
origin); `view.highlight` is already panel-relative and needs one.

| frame box | frame rect | shipped (`1280×800`) | delta |
| --- | --- | --- | --- |
| `result panel` | `360, 190, 560, 420` | `at(view.box, view.result!.card)` | 0,0,0,0 |
| `panel highlight` | `372, 202, 536, 1` | `at(view.box, view.highlight)` | 0,0,0,0 |
| `received portrait` | `576, 278, 128, 128` | `at(view.box, at(view.result!.card, view.result!.portrait))` | 0,0,0,0 |
| `type WATER` | `628, 486, 24, 24` | the same double lift on `view.result!.type!.box` | 0,0,0,0 |

The chip's **frame name is derived**, not literal: `type ${view.result!.type!.id.toUpperCase()}`
→ `type WATER`. A renamed or a missing chip is then a `missing` gap instead of a silent pass.

**Declared and not claimed** — guard each with a premise test:

- `header divider` at `384, 240, 512, 1`: the card paints no divider (it is `trade.css`'s paint on
  the pick face; the result card's rule has no view box). Declare it in the claim table's prose, not
  as a claim.
- The `CLOSE` button the card draws at `view.result!.button.box` → `470, 542, 340, 44`
  viewport (`view.close.box` is the same rect in the result state). The frame draws **no** button
  on this card, so it is recorded — a `missing` gap would be a lie, an unrecorded rect a silent
  pass. Its label `CLOSE` (`view.result!.button.label`) is a string the frame does not carry.
- `route screenshot` and `scrim` (`0, 0, 1280, 800`): the frame's painted scene and its dimming
  layer; the card's own scrim is `trade.css`'s child of the root.

### The strings you claim — five

The card prints, in the result state:

| printed line | source | frame text node | claimed |
| --- | --- | --- | --- |
| `TRADE` | `view.result!.title` | `result title` | **yes** |
| `TRADE COMPLETE` | `view.meta.text` (`trade.title` + `trade.complete`) | `meta` | **yes** |
| `RECEIVED` | `view.result!.kicker` | `kicker` | **yes** |
| `SHELLDER` | `view.result!.name` | `received name` | **yes** |
| `ADDED TO YOUR PARTY` | `view.result!.added` | `level line` | **yes** |
| `CLOSE` | `view.result!.button.label` | — | no — the frame draws no button |
| the room's line | `view.message.text` (`Received SHELLDER!`) | — | no — the frame prints no message on this card |

Implement `stringClaims` as a **filter over the printed lines** against the spec's text set
(trim + upper-case both sides), never a hard-coded literal list. `colours: []` — the card's fills
and strokes are `trade.css`'s tokens.

## 🧩 Data and configuration

None. No new key, no new data table, no balancing value.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim, on a clean integration worktree (this branch merged onto the batch base).

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-253` against the exclusive-path list above.
- **Expected state of the suite on this branch.** The adapter lands while its slug is still in
  `specGap.walk.test.ts`'s `PENDING` map, which the Orchestrator deletes in the merge commit. So
  `npm test` is expected to fail **exactly one** assertion:

  ```
  the spec gap, walked > accounts for every screen: mapped, or a named reason
  screens both mapped and pending: 03j-panels-trade-result
  ```

  Every other test must pass and `npm run build` must be fully green. A second failing test file
  or a build error is a failure of this task.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is green.
  - [ ] `[unit]` `npm test` shows no failure other than the single documented
        `screens both mapped and pending: 03j-panels-trade-result` assertion.
  - [ ] `[unit]` `src/ui/hud/panels/trade/specGap.result.test.ts` exists and passes, and it pins:
        `slug === '03j-panels-trade-result'`; `gapFor(buildView(SPEC), SPEC)` is
        `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView` twice is deep-equal.
  - [ ] `[unit]` It proves the four claims are the frame's rects: each claimed rect equals the
        frame's own `x, y, width, height` read out of `design/screens/03j-panels-trade-result.json`
        — `result panel` `360,190,560,420`, `panel highlight` `372,202,536,1`,
        `received portrait` `576,278,128,128`, `type WATER` `628,486,24,24` — every delta `0`, and
        that the type box is reached through the double lift (a one-lift bug gives `528, 416`).
  - [ ] `[unit]` It proves the empty claims: the frame draws no `give away button` and no close
        rect on this card; `view.give` is `null`; the card's `CLOSE` sits at `470, 542, 340, 44`
        and is **not** among the frame's boxes; `header divider` is `384, 240, 512, 1` and no claim
        carries it.
  - [ ] `[unit]` It proves the copy: the five claimed strings are the frame's own text nodes under
        `gapFor`'s fold, and `CLOSE` and the room's message are **not** claimed.
  - [ ] `[unit]` Nothing outside the two exclusive paths was touched; in particular
        `git diff --name-only main...task-253` does **not** list
        `src/ui/hud/panels/trade/README.md`.
  - [ ] `[unit]` The adapter imports no `phaser`, no DOM global and no `Math.random()`/`Date.now()`.
  - **No `[live]` criterion, and none is owed:** this task adds no drawing code and the trade panel
    has no fixture preview installed (`?hudFixture=` registers only panels with a `preview.ts`;
    `trade` has none), so the only honest measurement is the frame against the view model. Do not
    start a dev server for this task.

## 📣 Coordination

- **For the Orchestrator:** at merge, delete the line
  `'03j-panels-trade-result': 'trade, the result step; no view builder is wired',` from
  `src/ui/hud/specGap.walk.test.ts`'s `PENDING` map and flip the row
  `| trade | 03j Panels · trade result | \`03j-panels-trade-result\` | 7 | 5 | 7 | pending |` to
  `wired` in `docs/hud-fidelity.md`.
- **For the batch-mate (Task-252, the same panel's `03i` pick state):** it owns the folder's
  `README.md` and adds both map lines; you add neither. Do not edit that file even to fix a typo.
- **For the next batch:** the trade panel is then measured in both states.
- Commit with a subject in the house style (`hud: wire the trade result card to its 03j spec-gap
  adapter`), then leave the marker: an **empty** commit `dev: done task-253` on the tip of
  `task-253`, pushed to `origin`. Do not amend or rebase after the marker.

## ⛔ Out of scope

- Changing `view.ts`, `tradePanel.tsx`, `trade.css`, `mount.tsx` or any other panel code.
- The pick sheet (`03i`, Task-252) and any other slug.
- `panels/trade/README.md`, `specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`
  and `CHANGELOG.md`.
- Adding a `?hudFixture=` preview or any scene work.
- New dependencies, a shared adapter base class, or a registry.

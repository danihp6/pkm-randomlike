# Spec: Task-252 — the trade counter's pick sheet is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling / HUD spec-gap adapter (pure TypeScript + Vitest; no Phaser, no DOM).
- **Role:** Dev.
- **Objective:** the trade counter's **pick sheet** gains a spec-gap adapter, so the panel the
  game already ships is measured against the imported frame `03i Panels · trade pick` and every
  box and string it draws is *claimed* at a zero delta instead of passing silently. After this
  task `src/ui/hud/specGap.walk.test.ts` discovers an adapter for `03i-panels-trade-pick`, and
  `gapFor(buildView(spec), spec)` is empty for that slug.
- **Environment:** worktree `../wt-pkm-252` (sibling of the repo checkout), branch `task-252`,
  which already carries the commit `spec: task-252`. `node_modules` may be absent: install once
  with `npm ci --prefer-offline --no-audit --no-fund` (never a network-only `npm ci`, never a
  junction or symlink of another tree's `node_modules`). Work only inside that worktree.
- **Dependencies:** none. `tradePanelView` and the fixture already exist on `main`.

### Exclusive paths (single writer)

Nothing outside this list. Two of the three files are new.

- `src/ui/hud/specGap.views/trade-pick.ts` — **new**: the adapter.
- `src/ui/hud/panels/trade/specGap.pick.test.ts` — **new**: its test.
- `src/ui/hud/panels/trade/README.md` — **one edit**: the two map lines for
  `specGap.pick.test.ts` (yours) and `specGap.result.test.ts` (the batch-mate's frame, same
  folder, which is cut in parallel and must not touch this file). Add both, verbatim, in the
  `## Layout` list, in alphabetical position among the existing entries.

**Do not touch** `src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`,
`CHANGELOG.md` or `design/**`. The Orchestrator removes this slug's `PENDING` line and flips its
table row in the merge commit (see *Coordination*).

### Inputs (read-only)

- `AGENTS.md` (the whole file).
- `design/screens/03i-panels-trade-pick.json` and `design/exports/03i-panels-trade-pick.png` —
  the frame `03i Panels · trade pick` (board node `6:1505`), **39 boxes, 6 strings, 11 colours**.
- `design/fixtures/03i-panels-trade-pick.json` — its `pick` block is this row's input; its
  `result` block belongs to Task-253 and is not read here.
- `src/ui/hud/specGap.ts` — `GAP_TOLERANCE`, `PanelView`, `GapBox`, `ScreenSpec`, `gapFor`.
- `src/ui/hud/specGap.views/README.md` and the two shipped patterns
  `src/ui/hud/specGap.views/rewards-pokemon.ts` (fully claiming) and `shop-sell.ts` (claim helper).
- `src/ui/hud/specGap.walk.test.ts` — how the walker discovers an adapter.
- `src/ui/hud/panels/trade/view.ts` — `tradePanelView`, `TradeInput`, `TradePanelView`, `Rect`.
- `src/ui/hud/panels/trade/fixture.test.ts` — the `inputFrom` mapping you must mirror.
- `src/i18n/en.ts` — the `trade.*` keys.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

export const slug = '03i-panels-trade-pick';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the panel's view **exactly as the running card builds it**:
  `tradePanelView(inputFrom(FIXTURE.pick), { width: 1280, height: 800 })`, where
  `inputFrom` is the same mapping `panels/trade/fixture.test.ts` uses (restated in the adapter,
  it is not exported there):

  ```ts
  function inputFrom(block: PickBlock): TradeInput {
    return {
      kind: 'pick',
      message: block.message,
      canTrade: block.canTrade,
      party: block.party.map((tile) => ({
        memberId: tile.memberId, name: tile.name, level: tile.level ?? 0,
        frame: tile.frame, selected: false, box: { x: 0, y: 0, w: 0, h: 0 },
      })),
      pc: block.pc.map((tile) => ({
        memberId: tile.memberId, name: tile.name, frame: tile.frame,
        box: { x: 0, y: 0, w: 0, h: 0 },
      })),
      selected: block.selected,
      partyCount: block.partyCount,
      pcCount: block.pcCount,
      received: null,
      open: block.open,
    };
  }
  ```

  `TradeInput` takes no icon callback; `view.ts` is pure and the adapter reads no atlas.
- `spec` is read only as a structural selector — *does the frame draw this box name*, *is this
  line the board's text* — never as the answer. The shipped numbers come from `view.ts`.
- **Determinism:** reads no `Rng`, no clock, no DOM, no store, no Phaser. The fixture is a
  module constant and `tradePanelView` is pure, so the same spec always yields the same view.
- No `src/engine/`, no `src/data/**`, no `src/scenes/**`, no `src/main.ts`.

### The boxes you claim — thirteen, every delta 0

The shipped pick card **is** the board's card. Claim each one only when the frame draws that
name within `GAP_TOLERANCE` (1 px), with `at(origin, rect)` lifting a panel-relative rect into
the card's viewport box, exactly as `rewards-pokemon.ts` does.

| frame box | frame rect | shipped (`1280×800`) | delta |
| --- | --- | --- | --- |
| `trade panel` | `260, 120, 760, 560` | `view.box` = `tradePanelBox` | 0,0,0,0 |
| `panel highlight` | `272, 132, 736, 1` | `at(view.box, view.highlight)` | 0,0,0,0 |
| `party row 1`…`6` | `284/454, 236/352/468, 158, 104` | `at(view.box, view.party[i].box)`, six tiles | 0,0,0,0 |
| `pc slot 1`…`5` | `656/744/832/920 × 236/324`, `76 × 76` | `at(view.box, view.pc[i].box)`, **five** cells | 0,0,0,0 |
| `give away button` | `470, 612, 340, 44` | `at(view.box, view.give!.box)` | 0,0,0,0 |

Name each box with the frame's own name: `party row ${index + 1}` and `pc slot ${index + 1}`,
the way `rewards-pokemon.ts` names `row ${index + 1}`. A renamed box is a `missing` gap, not a
typo — and the fixture holds **five** PC members, so the card paints five of the frame's sixteen
cells and no empty cell is claimed. The frame's `header divider`, the eleven `party icon` /
`pc icon` rects, `route screenshot` and `scrim` are **not** claimed: the divider and the scrim are
`trade.css`'s paint, a portrait inside a tile is centred by the stylesheet (the contract's tiles
carry their box, not their portrait's) and the route behind the card is the canvas. Guard each
empty claim with a premise test (below), so a card that ever moves onto the board's rect becomes
a claim instead of a silent pass.

### The strings you claim — five

`gapFor` folds case and trims; it folds nothing else. The card prints, in the pick state:

| printed line | source | frame text node | claimed |
| --- | --- | --- | --- |
| `TRADE` | `view.title.text` | `trade title` | **yes** |
| `PARTY 6/6 · PC 5/16` | `view.meta.text` | `meta` = `PARTY 6/6   PC 5/16` | no — the board separates with three spaces, the card with `·` (the fixture pins this) |
| `Pick the Pokémon you will give away.` | `view.message.text` | `greeting` | **yes** |
| `PARTY` | `view.partyLabel.text` | `party label` | **yes** |
| `PC` | `view.pcLabel.text` | `pc label` | **yes** |
| `GIVE AWAY` | `view.give!.label` | `button label` | **yes** |
| `✕` | `view.close.label` | — | no — the frame draws no dismiss control |

Implement `stringClaims` as a **filter over the printed lines** against the spec's own text set
(trim + upper-case on both sides), never a hard-coded literal list, so the board's set is the
authority. `colours: []` — the card's fills and strokes are `trade.css`'s tokens, and the view
model carries no colour literal.

## 🧩 Data and configuration

None. No new key, no new data table, no balancing value. The fixture and the frame are read, not
written.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim, on a clean integration worktree (this branch merged onto the batch base).

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-252` against the exclusive-path list above.
- **Expected state of the suite on this branch — read this before judging a red.** A branch of
  this batch adds an adapter while its slug is still listed in `specGap.walk.test.ts`'s `PENDING`
  map, which the Orchestrator deletes in the merge commit (one slug per push). So `npm test` is
  expected to fail **exactly one** assertion:

  ```
  the spec gap, walked > accounts for every screen: mapped, or a named reason
  screens both mapped and pending: 03i-panels-trade-pick
  ```

  That red is the documented merge-time handoff, not a defect: every other test must pass and
  `npm run build` must be fully green. A *second* failing test file, or a build error, is a
  failure of this task.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is green.
  - [ ] `[unit]` `npm test` shows no failure other than the single documented
        `screens both mapped and pending: 03i-panels-trade-pick` assertion.
  - [ ] `[unit]` `src/ui/hud/panels/trade/specGap.pick.test.ts` exists and passes, and it pins:
        `slug === '03i-panels-trade-pick'`; `gapFor(buildView(SPEC), SPEC)` is
        `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView` twice is deep-equal.
  - [ ] `[unit]` That test proves the thirteen claims are the frame's rects: for each of the
        thirteen names it asserts the claimed rect equals the frame's own `x, y, width, height`
        read out of `design/screens/03i-panels-trade-pick.json` (six `party row n`, five
        `pc slot n`), every delta `0`.
  - [ ] `[unit]` It proves the empty claims: the frame's `header divider` is `284, 204, 712, 1`
        and no claimed box carries that rect; `view.pc` has **five** cells and the claimed names
        are exactly `pc slot 1`…`pc slot 5` (no `pc slot 6`…`16`); `route screenshot`/`scrim` and
        the eleven icon rects are not claimed.
  - [ ] `[unit]` It proves the copy: the five claimed strings are the frame's own text nodes under
        `gapFor`'s fold, and the meta line is **not** claimed (the fixture's
        `PARTY 6/6 · PC 5/16` against the board's `PARTY 6/6   PC 5/16`), nor is the `✕`.
  - [ ] `[unit]` Nothing outside the three exclusive paths was touched
        (`git diff --name-only main...task-252`).
  - [ ] `[unit]` The adapter imports no `phaser`, no DOM global and no `Math.random()`/`Date.now()`.
  - [ ] `[unit]` `src/ui/hud/panels/trade/README.md` names both new test files, one line each, and
        no other line of that file changed.
  - **No `[live]` criterion, and none is owed:** this task adds no drawing code and the trade
    panel has no fixture preview installed (`?hudFixture=` registers only panels with a
    `preview.ts`; `trade` has none), so the only honest measurement is the frame against the view
    model. Do not start a dev server for this task.

## 📣 Coordination

- **For the Orchestrator:** at merge, delete the line
  `'03i-panels-trade-pick': 'trade, the pick step; no view builder is wired',` from
  `src/ui/hud/specGap.walk.test.ts`'s `PENDING` map and flip the row
  `| trade | 03i Panels · trade pick | \`03i-panels-trade-pick\` | 39 | 6 | 11 | pending |` to
  `wired` in `docs/hud-fidelity.md`. After that the gate is fully green.
- **For the batch-mate (Task-253, the same panel's `03j` result state):** this task owns
  `panels/trade/README.md`; Task-253 adds only its adapter and its test. The two test files are
  named for their frames (`specGap.pick.test.ts`, `specGap.result.test.ts`) so the folder holds
  two tests and one README owner.
- **For the next batch:** the pick sheet is now measured; the four-row pause card and the taller
  slot machine are still open (`03n`, `03h`).
- Commit with a subject in the house style (`hud: wire the trade pick sheet to its 03i spec-gap
  adapter`), then leave the marker: an **empty** commit `dev: done task-252` on the tip of
  `task-252`, pushed to `origin`. Do not amend or rebase after the marker; a moved tip voids it.

## ⛔ Out of scope

- Changing `view.ts`, `tradePanel.tsx`, `trade.css`, `mount.tsx` or any other panel code: the
  panel is the shipped one and this task only measures it.
- The result card (`03j`, Task-253) and any other slug.
- Adding a `?hudFixture=` preview for the trade panel, or any scene work.
- Editing `specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md` or `CHANGELOG.md`.
- New dependencies, a new registry, or a shared adapter base class.

# Spec: Task-254 — the slot machine is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling / HUD spec-gap adapter (pure TypeScript + Vitest; no Phaser, no DOM).
- **Role:** Dev.
- **Objective:** the Team Rocket NPC's **slot machine** gains a spec-gap adapter. It is the only
  panel in the wave that is **Phaser**, not Preact (`src/ui/rocketPanel.ts`, the
  `src/ui/<panel>Panel.ts` half of `design/README.md`'s component check, with no
  `src/ui/hud/panels/rocket/` folder), so the adapter is built from the machine's **pure** half
  `src/ui/casinoReels.ts` plus three private layout numbers it restates with their lines named.
  After this task `src/ui/hud/specGap.walk.test.ts` discovers an adapter for
  `03h-panels-rocket-slots`, `gapFor(buildView(spec), spec)` is empty for that slug, and the
  seven candidate boxes are declared and honestly unclaimed because the shipped cabinet is a
  different height from the board's.
- **Environment:** worktree `../wt-pkm-254` (sibling of the repo checkout), branch `task-254`,
  which already carries the commit `spec: task-254`. `node_modules` may be absent: install once
  with `npm ci --prefer-offline --no-audit --no-fund` (never a network-only `npm ci`, never a
  junction or symlink of another tree's `node_modules`). Work only inside that worktree.
- **Dependencies:** none. `casinoReels.ts`, `rocketPanel.ts` and the fixture already exist on
  `main`.

### Exclusive paths (single writer)

Nothing outside this list. Two are new; the third is one line added to a map.

- `src/ui/hud/specGap.views/rocket.ts` — **new**: the adapter.
- `src/ui/rocketPanel.specGap.test.ts` — **new**: its test, beside the panel it measures.
  (Not `src/ui/rocketPanel.test.ts`, which pins the module's export list and is not yours.)
- `src/ui/README.md` — **one edit**: one new map line for `rocketPanel.specGap.test.ts`, in the
  `## Layout` list, next to `rocketPanel.test.ts`. No other line of that file changes.

**Do not touch** `src/ui/rocketPanel.ts`, `src/ui/casinoReels.ts`, `src/ui/rocketPanel.test.ts`,
`src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`, `CHANGELOG.md` or
`design/**`. The Orchestrator removes this slug's `PENDING` line and flips its table row in the
merge commit (see *Coordination*).

### Inputs (read-only)

- `AGENTS.md` (the whole file).
- `design/screens/03h-panels-rocket-slots.json` and `design/exports/03h-panels-rocket-slots.png` —
  the frame `03h Panels · rocket slots` (board node `6:1485`), **14 boxes, 4 strings,
  11 colours**.
- `design/fixtures/03h-panels-rocket-slots.json` — its `rocket` block: `title: 'SLOT MACHINE'`,
  `money: 2480`, `message`, two rows (`SPIN`, price 300 / `LEAVE`), `selected: 0`.
- `src/ui/hud/specGap.ts` — `GAP_TOLERANCE`, `PanelView`, `GapBox`, `ScreenSpec`, `gapFor`.
- `src/ui/hud/specGap.views/README.md` and the shipped pattern
  `src/ui/hud/specGap.views/notice-level-up.ts` (a view with declared-but-unclaimed boxes).
- `src/ui/hud/specGap.walk.test.ts` — how the walker discovers an adapter.
- `src/ui/casinoReels.ts` — `CASINO_CARD_W` 460, `CASINO_CARD_H` **300**, `REEL_BAND_LEFT` 146,
  `REEL_BAND_TOP` 72, `REEL_W`/`REEL_H` 48, `REEL_GAP` 12, `REEL_COUNT` 3, `reelRects`.
- `src/ui/rocketPanel.ts` — **read only, to name the lines**: line 63 `CASINO_PAD = 24`, line 64
  `CASINO_ROW_H = 44`, line 65 `CASINO_ROWS = 2`, line 66
  `CASINO_ROW_TOP = REEL_BAND_TOP + REEL_H + 16` (= 136), and `buildCasinoPanel`, which draws the
  card at `(width − CASINO_CARD_W)/2, (height − CASINO_CARD_H)/2`, the field at
  `(bandX − 8, bandY − 8, fieldW, REEL_H + 16)` with `fieldW = 3 × 48 + 2 × 12 + 16`, the reels
  from `reelRects(cardX, cardY)`, and each row's visible bar at
  `(left, cardY + CASINO_ROW_TOP + i × CASINO_ROW_H, CASINO_CARD_W − CASINO_PAD × 2,
  CASINO_ROW_H − 6)`.
- `src/i18n/en.ts` — `casino.title`, `casino.money`, `casino.spin`, `casino.leave`.

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

export const slug = '03h-panels-rocket-slots';

export function buildView(spec: ScreenSpec): PanelView;
```

- **Import `casinoReels.ts` and never `rocketPanel.ts`:** the panel imports `phaser`, cannot run
  headless, and `rocketPanel.test.ts` pins its export list to exactly `['openRocket',
  'rocketGrunt']`. The three numbers the panel keeps private (`CASINO_PAD`, `CASINO_ROW_H`,
  `CASINO_ROW_TOP`) are **restated** in the adapter, each with a comment naming the
  `rocketPanel.ts` line it mirrors, so a drift is visible in review and the geometry test catches
  it.
- Geometry, at `1280 × 800`, from the constants and the fixture only:

  ```ts
  const cardX = (1280 - CASINO_CARD_W) / 2;          // 410
  const cardY = (800 - CASINO_CARD_H) / 2;           // 250
  const card  = { x: cardX, y: cardY, w: CASINO_CARD_W, h: CASINO_CARD_H };
  const field = { x: cardX + REEL_BAND_LEFT - 8, y: cardY + REEL_BAND_TOP - 8,
                  w: REEL_COUNT * REEL_W + (REEL_COUNT - 1) * REEL_GAP + 16,
                  h: REEL_H + 16 };                 // 548, 314, 184, 64
  const reels = reelRects(cardX, cardY);            // 556/616/676, 322, 48 × 48
  const row = (i: number) => ({ x: cardX + CASINO_PAD,
                                y: cardY + CASINO_ROW_TOP + i * CASINO_ROW_H,
                                w: CASINO_CARD_W - CASINO_PAD * 2, h: CASINO_ROW_H - 6 });
  // rows: 434, 386, 412, 38  and  434, 430, 412, 38
  ```

- **Determinism:** no `Rng`, no clock, no DOM, no Phaser, no store, no `loadSettings()`. The
  fixture is a module constant, so the same spec always yields the same view.
- No `src/engine/`, no `src/data/**` beyond nothing at all, no `src/scenes/**`.

### The boxes — seven declared candidates, none claimed

Every candidate is **outside** the 1 px tolerance. Declare all seven (so a cabinet that ever moves
onto the board's rect becomes a claim), claim none, and pin each delta in the test:

| frame box | frame rect | shipped (`1280×800`) | delta |
| --- | --- | --- | --- |
| `casino card` | `410, 228, 460, 344` | `card` = `410, 250, 460, 300` | dy **+22**, dh **−44** |
| `reel field` | `548, 336, 184, 64` | `field` = `548, 314, 184, 64` | dy **−22** |
| `reel 1` | `556, 344, 48, 48` | `reels[0]` = `556, 322` | dy **−22** |
| `reel 2` | `616, 344, 48, 48` | `reels[1]` = `616, 322` | dy **−22** |
| `reel 3` | `676, 344, 48, 48` | `reels[2]` = `676, 322` | dy **−22** |
| `row 1` | `434, 410, 412, 38` | `row(0)` = `434, 386` | dy **−24** |
| `row 2` | `434, 454, 412, 38` | `row(1)` = `434, 430` | dy **−24** |

The sign convention is shipped − frame: the shipped cabinet sits **22 px lower** than the board's
and is 44 px shorter, so its field and reels are 22 px lower and its rows 24 px higher.

**Declared in prose and not claimed** — each with a premise assertion:

- `card highlight` (`422, 240, 436, 1`): the panel draws its card with `addFrlgWindow`, a
  nine-slice with no separate 1 px bar; the frame's rule has no view box.
- `reel face 1 potion` / `2 poke_ball` / `3 oran_berry` (`568/628/688, 356, 24, 24`): the panel
  paints each item icon at `REEL_W / ITEM_ICON_SIZE`, i.e. it **fills** the 48 px window, while
  the frame draws a 24 px face centred in it (dx +12, dy +12, dw +24, dh +24). The fixture's
  faces are not the frame's three prizes, so only the rect is comparable and it is not the
  panel's.
- `rocket emblem` (`624, 276, 32, 48`): the panel has no emblem at all — the Rocket face exists
  only inside a reel when the booked outcome is the fight.
- `route screenshot`, `scrim` (`0, 0, 1280, 800`): the frame's painted scene and its dimming
  layer; the machine is a Phaser container with no scrim of its own.
- The 44 px press zone (`CASINO_ROW_H`) is not a drawn box: the visible bar is the 38 px
  highlight above it.

### The strings — exactly two claimed

The panel prints, through `t()`:

| printed line | source (as `refreshCasino` formats it) | frame text node | claimed |
| --- | --- | --- | --- |
| `SLOT MACHINE` | `t('casino.title')` | `card title` | **yes** |
| `MONEY  ¥2480` | `t('casino.money', { amount: block.money })` | `money` = `MONEY  $ 2,480` | no — `¥` against the board's `$ 2,480` |
| `SPIN  ¥300` | `t('casino.spin', { price: block.rows[0].price })` | `row label 1` = `SPIN  $ 300` | no — same |
| `LEAVE` | `t('casino.leave')` | `row label 2` | **yes** |
| the room's line | the fixture's `message` | — | no — the frame prints no message |

So `strings` is exactly `['SLOT MACHINE', 'LEAVE']`, implemented as a **filter** over the printed
lines against the spec's text set (trim + upper-case both sides), never a literal list. The money
pair and the `SPIN` line are the copy deltas this row records. `colours: []` — every tone is
`frlg.ts`'s token or `src/data/ui/chrome.json`'s, not a view literal.

## 🧩 Data and configuration

None. No new key, no new data table, no balancing value. The three restated layout numbers are
documented constants inside the adapter, not a new data file.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim, on a clean integration worktree (this branch merged onto the batch base).

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-254` against the exclusive-path list above.
- **Expected state of the suite on this branch.** The adapter lands while its slug is still in
  `specGap.walk.test.ts`'s `PENDING` map, which the Orchestrator deletes in the merge commit. So
  `npm test` is expected to fail **exactly one** assertion:

  ```
  the spec gap, walked > accounts for every screen: mapped, or a named reason
  screens both mapped and pending: 03h-panels-rocket-slots
  ```

  Every other test must pass — including `src/ui/rocketPanel.test.ts`, whose export-list
  assertion proves you did not import the panel into the adapter — and `npm run build` must be
  fully green.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is green.
  - [ ] `[unit]` `npm test` shows no failure other than the single documented
        `screens both mapped and pending: 03h-panels-rocket-slots` assertion.
  - [ ] `[unit]` `src/ui/rocketPanel.specGap.test.ts` exists and passes, and it pins:
        `slug === '03h-panels-rocket-slots'`; `gapFor(buildView(SPEC), SPEC)` is
        `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView` twice is deep-equal.
  - [ ] `[unit]` It proves the **seven** candidates are declared and unclaimed, each at the shipped
        rect above and each outside `GAP_TOLERANCE` on at least one edge, with the delta asserted
        against the frame read out of `design/screens/03h-panels-rocket-slots.json`
        (`casino card` dy +22 dh −44; `reel field` and the three reels dy −22; `row 1`/`row 2`
        dy −24).
  - [ ] `[unit]` It proves `boxes` is empty, and that `card highlight`, the three `reel face` rects,
        `rocket emblem`, `route screenshot` and `scrim` are not claimed.
  - [ ] `[unit]` It proves the copy: `strings` is exactly `['SLOT MACHINE', 'LEAVE']`; the money
        line folds to `MONEY  ¥2480` and differs from the frame's `MONEY  $ 2,480`, and the `SPIN`
        line folds to `SPIN  ¥300` and differs from `SPIN  $ 300`.
  - [ ] `[unit]` It proves the adapter never imports the panel: `src/ui/rocketPanel.test.ts` is
        green, and the adapter's own module graph has no `phaser` (assert it, e.g. by pinning the
        adapter's import list, or by the absence of a `rocketPanel` import in review).
  - [ ] `[unit]` Nothing outside the three exclusive paths was touched — in particular
        `src/ui/rocketPanel.ts`, `src/ui/casinoReels.ts` and `src/ui/rocketPanel.test.ts` are
        unchanged.
  - [ ] `[unit]` `src/ui/README.md` gained exactly one line, for `rocketPanel.specGap.test.ts`.
  - **No `[live]` criterion, and none is owed:** this task adds no drawing code, the machine has
    no fixture preview and opening it needs a route that holds the grunt, so the only honest
    measurement is the frame against the geometry. `D57` forbids a pixel criterion in any case.
    Do not start a dev server for this task.

## 📣 Coordination

- **For the Orchestrator:** at merge, delete the line
  `'03h-panels-rocket-slots': 'the rocket panel; no view builder is wired',` from
  `src/ui/hud/specGap.walk.test.ts`'s `PENDING` map and flip the row
  `| rocket | 03h Panels · rocket slots | \`03h-panels-rocket-slots\` | 14 | 4 | 11 | pending |`
  to `wired` in `docs/hud-fidelity.md`.
- **Why the file lives in `src/ui/`:** the panel is `src/ui/rocketPanel.ts`, so its test is
  `src/ui/rocketPanel.specGap.test.ts` and its map line is in `src/ui/README.md`, which this task
  owns alone in the batch. **Do not** create `src/ui/hud/panels/rocket/`: the card is Phaser and
  no `PanelView` can be built from it. This is the wave's precedent for a panel with no view
  model, and the next such panel will follow it.
- **For the next batch:** the machine is measured and its 22 px / 44 px cabinet drift is recorded
  rather than fixed. Fixing the cabinet to the board's 344 px is a separate panel task.
- Commit with a subject in the house style (`hud: wire the slot machine to its 03h spec-gap
  adapter`), then leave the marker: an **empty** commit `dev: done task-254` on the tip of
  `task-254`, pushed to `origin`. Do not amend or rebase after the marker.

## ⛔ Out of scope

- Changing the machine: `rocketPanel.ts` keeps its 300 px cabinet, its 44 px rows and its `¥`
  money pair. This task measures the drift, it does not fix it.
- Creating `src/ui/hud/panels/rocket/` or any Preact panel folder.
- Any other slug, any scene work, any `?hudFixture=` preview.
- `specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`, `CHANGELOG.md`.
- New dependencies or a shared adapter base class.

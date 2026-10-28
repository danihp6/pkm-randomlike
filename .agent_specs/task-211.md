# Spec: Task-211 — STATS and RANKING are two rows of the main menu

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD panel (Preact) + two design fixtures + docs.
  No engine rule, no data table, no RNG.
- **Role:** Dev.
- **Objective:** the main menu's DOM card gains a fifth row, **RANKING**, under
  **STATS**; pressing it opens the existing stats screen directly on that screen's
  `ranking` mode, so the monthly table is one press away from the menu instead of two
  presses inside STATS. The card's five-row geometry (desk and phone) is data in the
  view and the stylesheet draws exactly those numbers, and the keyboard's wrap-around
  walk steps all five rows. No screen is duplicated: the stats panel already owns
  `ranking` and its two sub-tabs.
- **Environment:** worktree `../wt-pkm-211`, branch `task-211`.
- **Dependencies (all merged on `main`, verified 2026-10-28):**
  - `[Task-198]` (Batch 86, merged) — the menu's live route window and
    `liveMainMenuView`'s shape.
  - `[Task-199]` (Batch 86, merged) — `mainMenuRecords`, the footer's three live
    figures and `menuVersionLabel`.
  - `[Task-201]` (Batch 88, merged) — `MAIN_MENU_GLOW` / `glowBackground` and the card's
    current four-row geometry in `main-menu.css` (`[data-rows='4']`).
  - `[Task-210]` (Batch 88, merged) — the stats screen's `ranking` mode reads the
    global board; this task only **opens** that mode, and never fetches anything.

### Exclusive paths (single writer)

Create or modify **nothing** outside this list.

- `src/ui/hud/panels/main-menu/view.ts`
- `src/ui/hud/panels/main-menu/view.test.ts`
- `src/ui/hud/panels/main-menu/fixture.test.ts`
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`
- `src/ui/hud/panels/main-menu/mount.tsx`
- `src/ui/hud/panels/main-menu/main-menu.css`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts`
- `design/fixtures/01-main-menu.json`
- `design/fixtures/01b-main-menu-no-save.json`
- `docs/design-spec.md` — **§2 only, one bullet**: the main-menu bullet's row
  enumeration (lines 16-20) and its STATS sentence (lines 23-27). Stop at line 27
  (`… the canvas fallback keeps its three.`); lines 28-40 (the records footer, the
  version line, the live route, the phone wrap) are **not** yours.
- `docs/hud-fidelity.md` — **§9 only, one inserted block**: a new
  **`**The menu card's five rows.**`** block inserted **after the `**The party
  card's rows.**` block (ends line 315), immediately before `## The gate's measured
  table`**. Nothing else in the file (`[Task-205]`, `[Task-213]` and `[Task-214]` own
  their own §5 blocks).

You are **the only task in this batch** holding `src/scenes/MainMenuScene.ts`,
`design/fixtures/01-main-menu.json` and `design/fixtures/01b-main-menu-no-save.json`.
`src/i18n/{en,es}.ts` are **not** yours (see 🔒 Contract).

### Inputs (read-only)

- `docs/design-spec.md`, `docs/hud-fidelity.md`, `docs/tech-decisions.md` (D43, D49).
- `src/ui/hud/panels/stats/**` — `StatsMode`, `liveStatsView`, `mountStats`,
  `statsMonths`, `StatsHandle`, `StatsView`; `openStats` already threads the mode.
- `src/i18n/en.ts`, `src/i18n/es.ts` — read only. `'stats.actionRanking'` already
  exists in both (`en.ts` 63 → `RANKING`, `es.ts` 66 → `CLASIFICACIÓN`).
- `src/ui/hud/kit/**`, `src/ui/hud/portrait.ts`, `src/ui/runSummary.ts`,
  `src/engine/run/history.ts` — untouched.
- `design/frames/01-main-menu.json`, `design/frames/01b-main-menu-no-save.json`,
  `design/frames/m01-main-menu.json`, `design/frames/m01b-main-menu-no-save.json` —
  **read only and never edit**: they are Figma exports (`exportedAt`), and the board
  has no five-row frame. This task's five-row numbers are recorded in
  `docs/hud-fidelity.md` §9 and in the view's data instead.

## 🔒 Contract

Everything below is frozen.

### `src/ui/hud/panels/main-menu/view.ts`

Measured on `main`: `MAIN_MENU_ROW_IDS` is `['continue','new','options','stats']`
(line 11), `MAIN_MENU_ACTIONS` is the same four (line 15), and `liveMainMenuView`
pushes `continue`/`new`/`options`/`stats` (lines 257-267) before clamping the cursor
(269-271).

```ts
export const MAIN_MENU_ROW_IDS = ['continue', 'new', 'options', 'stats', 'ranking'] as const;
export const MAIN_MENU_ACTIONS = ['continue', 'new', 'options', 'stats', 'ranking'] as const;
export type MainMenuRowId = (typeof MAIN_MENU_ROW_IDS)[number];   // '…' | 'ranking'
export type MainMenuAction = (typeof MAIN_MENU_ACTIONS)[number];  // '…' | 'ranking'

/** The card's own height per drawn row count, the desk frame's numbers plus the fifth row. */
export const MAIN_MENU_CARD_H: Readonly<Record<number, number>> = { 4: 362, 5: 372 };
/** The same, for the phone card (`@media (max-width: 600px)`). */
export const MAIN_MENU_CARD_H_NARROW: Readonly<Record<number, number>> = { 4: 264, 5: 275 };
```

- **Row order is `continue · new · options · stats · ranking`.** `ranking` is the last
  row, after `stats` — the least disruptive order and the one the entry's title names.
- `liveMainMenuView` pushes, after the `stats` row:
  `{ id: 'ranking', label: t('stats.actionRanking'), value: '', enabled: true }`.
  It is pushed **even with no save** (so the no-save menu has four rows: new, options,
  stats, ranking), exactly as `stats` already is.
- **No new i18n key.** The row's label is the existing `'stats.actionRanking'`
  string — the same word the stats panel's own action row prints. `src/i18n/{en,es}.ts`
  belong to `[Task-213]` in this batch; this task must not write them.
- `MainMenuView`, `MainMenuRowView`, `mainMenuStats`, `mainMenuRecords`, `forLayout`,
  `MAIN_MENU_BOARD*`, `MAIN_MENU_FOOTER_NARROW`, `MAIN_MENU_GLOW`, `glowBackground`,
  `fixtureMainMenuView` keep their shapes. `forLayout(view,'compact')` keeps dropping
  only the CONTINUE row's `value`.

### Five-row geometry (the numbers, and why)

The card is `padding: 63px 0 0 19px`, `gap: 8px`, rows `54` tall on the desk; on the
phone `padding: 11px 0 0 23px`, `gap: 6px`, rows `48`.

- **Desk.** `MAIN_MENU_BOARD.card` is `{x: 724, y: 236, w: 460}` and
  `MAIN_MENU_BOARD.footer.labelY` is `616` — the MONTHLY MAX STRIKE block starts
  there, in the card's own column. A 4-row card is 362 tall (bottom 598). A fifth row
  needs `63 + 5·54 + 4·8 = 365` px of content, so the card is **372** (bottom **608**),
  which keeps **8 px** above the footer's first label. It must **not** be 424: that
  bottom (660) would paint over the monthly figure.
- **Phone.** `MAIN_MENU_BOARD_NARROW.card` is `{x: 8, y: 390, w: 374}` and
  `MAIN_MENU_FOOTER_NARROW.wins.y` is `676`. A fifth row needs
  `11 + 5·48 + 4·6 = 275` px, so the card is **275** (bottom **665**), 11 px above the
  footer's first block. 318 (the 4-row height plus one pitch) would collide.
- `main-menu.css` must carry exactly:
  `.main-menu__card[data-rows='5'] { height: 372px; }` in the desk block and
  `.main-menu__card[data-rows='5'] { height: 275px; }` inside
  `@media (max-width: 600px)`. The existing `[data-rows='4']` rules (362 / 264) and
  the 300 px / 196 px defaults stay as they are.
- The card keeps `data-rows={String(view.rows.length)}` on the wrapper
  (`mainMenuPanel.tsx` 227), so the stylesheet and the model cannot drift.

### `mainMenuPanel.tsx` and `mount.tsx`

```ts
// mount.tsx — the intent union grows one variant.
export type MainMenuIntent =
  | Readonly<{ type: 'continue' }>
  | Readonly<{ type: 'new-run' }>
  | Readonly<{ type: 'options' }>
  | Readonly<{ type: 'stats' }>
  | Readonly<{ type: 'ranking' }>;
```

- `ROW_INTENTS: Readonly<Record<MainMenuRowId, MainMenuIntent['type']>>` gains
  `ranking: 'ranking'` (`mainMenuPanel.tsx` 40-45). Nothing else in the component
  changes: the row is a `Row` like its siblings, and the ranking row draws no value
  and no portraits.

### `src/scenes/MainMenuScene.ts`

Measured on `main`: `MenuAction` is `'continue' | 'new' | 'options' | 'stats'`
(line 52); `MENU_LABELS` is a `Record<MenuAction, TranslationKey>` (55-60);
`openStats()` hard-codes `this.statsMode = 'totals'` (304); `handleIntent` switches on
the intent (417-432); `choose()` switches on `this.items[this.index]` (448-465).

```ts
type MenuAction = 'continue' | 'new' | 'options' | 'stats' | 'ranking';

const MENU_LABELS: Readonly<Record<MenuAction, TranslationKey>> = {
  continue: 'menu.continue',
  new: 'menu.new',
  options: 'menu.options',
  stats: 'menu.stats',
  ranking: 'stats.actionRanking',
};

/** Opens the stats screen on `mode`; TOTALS and the newest month by default. */
private openStats(mode: StatsMode = 'totals'): void;
```

- `openStats(mode)`: the body is today's, with `this.statsMode = mode` in place of
  `'totals'`. Everything else (the guard `if (!this.dom || this.statsOpen …)`, the
  host lookup, `statsMonths(...)[0]`, `mountStats`, `loadGlobalRanking()`) is
  unchanged.
- `handleIntent` gains `case 'ranking': this.openStats('ranking'); return;`.
- `choose()` gains `case 'ranking': this.openStats('ranking'); return;`.
- `handleAction` gains nothing: `up`/`down` already walk `this.items`, and
  `createDom` already derives `this.items` from `MAIN_MENU_ACTIONS` filtered by the
  drawn rows (line 184) — so it becomes five with a save and four without, and the
  wrap-around in `move()` reaches the fifth row with no further change.
- **The canvas path is untouched.** `create()` (line 151) still builds
  `['continue','new','options']` / `['new','options']`, and `draw()` still paints
  those; `openStats` already refuses when `!this.dom`, so the canvas never offers a
  row it cannot serve. Do not add RANKING to the canvas list (see ⛔ Out of scope).

### Determinism and rules

- Reads **no RNG**: `randomSeed()` keeps its single call in `create()` (the preview
  seed) and no new `Date.now`/`Math.random` appears in the scene.
- No new dependency, no new file, no `src/data/**` change, no `SAVE_VERSION` step.

## 🧩 Data and configuration

- `design/fixtures/01-main-menu.json` — `menu.rows` gains, after the `stats` row:
  `{ "id": "ranking", "label": "RANKING", "value": "" }`. Everything else in the file
  is untouched (`selected` stays `continue`; the footer's three figures stay).
- `design/fixtures/01b-main-menu-no-save.json` — `menu.rows` gains the same row after
  its `stats` row, so the no-save frame's live panel (four rows) matches its fixture.
  `selected` stays `new`.
- `docs/design-spec.md` §2 and `docs/hud-fidelity.md` §9 record the five-row card; no
  other data file moves.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — full Vitest run, headless; targeted first:
    `npx vitest run src/ui/hud/panels/main-menu src/scenes/MainMenuScene.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run lint`.
  - `git diff --name-only main...task-211` — every path must be in the exclusive list.
  - **This task owes a browser pass**: three `[live]` criteria below. `npm run dev`,
    then `http://localhost:5173/?hud=dom` (with a save: the CONTINUE row is only drawn
    when the save holds a run with a living party; start a run first, or use the
    `01b` path for the four-row case). DOM boxes read with `getBoundingClientRect()`;
    nothing in this task is measured on the canvas.
- **Acceptance criteria:**
  - **The model (tests this task owes).**
    - [ ] `[unit]` `liveMainMenuView(run, 0, …).rows.map(r => r.id)` is
      `['continue','new','options','stats','ranking']`, and
      `liveMainMenuView(null, …)` is `['new','options','stats','ranking']`; the
      `ranking` row's `label` is `t('stats.actionRanking')`, its `value` is `''` and
      its `enabled` is `true`.
    - [ ] `[unit]` The cursor clamps to the fifth row: `liveMainMenuView(run, 9, …).selected`
      is `'ranking'`, and `liveMainMenuView(run, 4, …).selected` is `'ranking'`.
    - [ ] `[unit]` `fixtureMainMenuView(01-main-menu)` returns five rows ending
      `['stats','ranking']` and `fixtureMainMenuView(01b)` four rows ending
      `['stats','ranking']`; the fixture test's label assertions read the frame's own
      text for the four frame rows and `t('stats.actionRanking')` for the fifth
      (there is no frame node for it — do not invent one); the "unknown id" guard test
      uses an id that is still unknown (for example `'missions'`), not `'ranking'`.
    - [ ] `[unit]` `MAIN_MENU_CARD_H[5]` (372) plus `MAIN_MENU_BOARD.card.y` (236) is
      `≤ MAIN_MENU_BOARD.footer.labelY - 8` (608), and the five rows' content
      (`63 + 5·54 + 4·8 = 365`) fits inside it; `MAIN_MENU_CARD_H_NARROW[5]` (275)
      plus `MAIN_MENU_BOARD_NARROW.card.y` (390) is `≤ MAIN_MENU_FOOTER_NARROW.wins.y - 8`
      (668) and the dense content (`11 + 5·48 + 4·6 = 275`) fits.
    - [ ] `[unit]` `main-menu.css` carries `[data-rows='5']` with `height: 372px` in
      the base block and `height: 275px` inside the `max-width: 600px` block, and the
      same numbers as `MAIN_MENU_CARD_H[5]` / `MAIN_MENU_CARD_H_NARROW[5]`.
    - [ ] `[unit]` `MainMenuScene`: a `ranking` intent opens the stats screen on the
      ranking mode — the scene's `statsMode` is `'ranking'` and `statsView().mode` is
      `'ranking'` (the test's own `mountStats` stub is enough; no network);
      `openStats('totals')` still sets `'totals'`. The source-string assertion on
      `'private openStats(): void {'` is updated to the new signature.
    - [ ] `[unit]` `MainMenuScene`'s `createDom` items are five with a save and four
      without, and `move(1)` from index 0 walks to index 1 … wrapping from the last
      back to 0.
    - [ ] `[unit]` It typechecks and builds clean.
    - [ ] `[unit]` Nothing outside the exclusive paths was touched — in particular
      `src/i18n/{en,es}.ts`, `design/frames/**` and `src/ui/hud/panels/stats/**` are
      byte-identical to `main`.
  - **Live.**
    - [ ] `[live]` At **1280×800**, `?hud=dom`, with a save: the card
      `[data-hud-main-menu-card]` has `data-rows="5"` and its `getBoundingClientRect()`
      is `{left:724, top:236, width:460, height:372}` ±1; five
      `[data-hud-main-menu-row]` exist in the order
      `continue,new,options,stats,ranking`, each `{744, …, 420, 54}` with a 62 px
      pitch, the last row's `bottom` ≤ 601, and no row box intersects the footer
      (`[data-hud-main-menu-stat]` boxes start at y 616).
    - [ ] `[live]` At **1280×800**: click `[data-hud-main-menu-row="ranking"]` →
      the menu is unmounted and `[data-hud-panel="stats"]`'s parent `.stats` carries
      `data-mode="ranking"` with its blurb `MONTHLY RANKING · EVERYONE.` (or the local
      `MONTHLY RECORD · THIS DEVICE.` when the endpoint is unreachable); `BACK`
      (`[data-hud-stats-action="back"]`) returns to the five-row menu. Click
      `[data-hud-main-menu-row="stats"]` instead → `data-mode="totals"`.
    - [ ] `[live]` At **1280×800** and at **390×844**: press the down key four times
      from the first row — `[data-hud-main-menu-row="ranking"]` reaches
      `data-selected="true"` and `confirm` opens it; at 390 the five-row card
      `[data-hud-main-menu-card]` reads `{left:8, top:390, width:374, height:275}` ±1,
      its rows are `{32, …, 326, 48}` with a 54 px pitch, and no row box intersects a
      `[data-hud-main-menu-stat]` block (the footer's first block starts at 676).

## 📣 Coordination

- **For the Architect / Orchestrator:** the entry's claims line names the **i18n
  pair**; this task does not need it — the row reuses `'stats.actionRanking'` — and
  the pair moves to `[Task-213]` in this batch. This spec also claims
  `design/fixtures/01b-main-menu-no-save.json`, because the no-save panel draws four
  rows after this change and its fixture must match it; and
  `src/ui/hud/panels/main-menu/view.test.ts` / `fixture.test.ts` / `mount.tsx`, which
  the one-folder claim already covered.
- **For `[Task-213]` (same batch):** you hold `src/i18n/{en,es}.ts`. If you need a
  main-menu string, it is already there: `'menu.*'` for the rows,
  `'stats.actionRanking'` for RANKING.
- **For `[Task-215]` (Batch 92):** the desk CONTINUE row's value and the portrait
  block are untouched here; the five-row card changes the card's height only, not the
  row's internals, so your `label.right <= portraits.left` work starts from the same
  geometry it saw.
- **For the next batch:** a sixth row is `MAIN_MENU_ROW_IDS` + one key in `MENU_LABELS`
  + one height in `MAIN_MENU_CARD_H` / `MAIN_MENU_CARD_H_NARROW` + the same two CSS
  rules. There is no frame for it; the numbers go in §9 of `docs/hud-fidelity.md`.

## ⛔ Out of scope

- The **canvas** menu (`MainMenuScene.create`'s `items`, `draw()`, `choose()`'s
  reachability from the canvas): it still draws three rows and has no STATS row at
  all; `[Task-200]` retires that layer. Do not "fix" it here.
- `src/ui/hud/panels/stats/**` — the ranking screen, its modes, its sub-tabs, its
  fetch. This task only opens it on a mode.
- `design/frames/**` (read-only Figma exports), `docs/tech-decisions.md` (no new
  `D##`), the records footer's figures, the version line, the compose of the route
  window and the glow.
- The i18n pair, `package.json`, `vite.config.ts`, `src/main.ts`, any `src/data/**`
  file, any `SAVE_VERSION` step.

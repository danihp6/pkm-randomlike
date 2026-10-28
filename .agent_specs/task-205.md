# Spec: Task-205 — Evolution is its own tab, between STATS and MOVES

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser-side DOM HUD (Preact panel) + a shared pure model. No engine
  rule, no data table, no RNG.
- **Role:** Dev.
- **Objective:** the member detail card's tab row has **three** tabs in the order
  STATS · EVOLUTION · MOVES, the family graph that today lives in a band inside STATS
  is drawn on the EVOLUTION tab and no longer on STATS, and the tab can be changed by
  a click and by `ArrowLeft` / `ArrowRight` while the card holds the keyboard. After
  this task the pure tab model (`DetailTab`, `DETAIL_TABS`, `nextDetailTab`,
  `detailStops`) knows three tabs, and `?hud=dom` shows the third tab.
- **Environment:** worktree `../wt-pkm-205`, branch `task-205`.
- **Dependencies (all merged on `main`, verified 2026-10-28):**
  - `[Task-203]` (Batch 87, merged) — the icon kit the move cells and the pool rows
    draw with (`MoveTypeBadge`, `MoveCategoryIcon`, `MOVE_ICON_BOX`). **Read-only
    here**; this task does not change a single glyph box.
  - `[Task-185]` (Batch 81, merged) — `src/ui/hud/panels/detail/evolution.ts` and
    `evolutionView`, the graph model this task re-parents. **Read-only.**
  - `[Task-189]` (Batch 82, merged) — the detail card's Preact mount and CSS.

### Exclusive paths (single writer)

Create or modify **nothing** outside this list.

- `src/ui/hud/panels/detail/view.ts`
- `src/ui/hud/panels/detail/view.test.ts`
- `src/ui/hud/panels/detail/detailPanel.tsx`
- `src/ui/hud/panels/detail/detail.css`
- `src/ui/hud/panels/detail/fixture.test.ts`
- `src/ui/hud/panels/detail/mount.tsx`
- `src/ui/hud/panels/detail/index.ts`
- `src/ui/partyDetail.ts`
- `src/ui/partyDetail.test.ts`
- `docs/design-spec.md` — **§2 only, one block**: the detail-panel bullet from
  `A plain **click**` … `opens a **detail panel**` (line 104) through
  `… a closed panel opens on STATS.` (line 136). Nothing else in the file.
- `docs/hud-fidelity.md` — **§5 only, one inserted block**: a new
  **`**The detail card's three-tab row.**`** block inserted **between the `Chips.`
  block (ends line 98) and the `The main menu's glow.` block (starts line 100)**.
  Nothing else in the file. (`[Task-211]` owns §9 of the same document and
  `[Task-213]`/`[Task-214]` own their own §5 blocks; you must not touch theirs.)

Reading any other file is allowed; **writing** is not. If a change outside this list
seems necessary, stop and report it in your final message instead of making it.

### Inputs (read-only)

- `docs/design-spec.md`, `docs/hud-fidelity.md`, `docs/tech-decisions.md` (D43, D49).
- `src/ui/hud/panels/detail/evolution.ts` — `evolutionView`, `EVO_ROW_H`,
  `EVO_WINDOW_ROWS`, `levelColumnWidth`. Untouched.
- `src/ui/hud/panels/detail/detailPanel.tsx`'s partner modules,
  `src/ui/hud/panels/detail/README.md`, `src/ui/hud/kit/**`.
- `src/ui/partyDetail.ts` is **claimed** (it is where the tab model lives).
- `src/scenes/panels/detail.ts` — **read-only in this task** (see 🔒 Contract,
  "What the scene already does").
- `src/i18n/en.ts`, `src/i18n/es.ts` — **read-only**; the tab label reuses an
  existing key, so this task writes no i18n.

## 🔒 Contract

Everything below is frozen. Other specs in this batch are written against it.

### `src/ui/partyDetail.ts` — the tab model (three tabs)

Facts measured on `main` today: `DetailTab` is `'stats' | 'moves'` (line 39),
`DETAIL_TABS` is `['stats','moves']` (line 277) and `nextDetailTab` wraps over that
array (lines 280-284). `detailStops` (297-313) puts the member's ready evolution
branches on the `stats` tab.

```ts
/** The panel's three tabs, in board order. */
export type DetailTab = 'stats' | 'evolution' | 'moves';

export const DETAIL_TABS: readonly DetailTab[] = ['stats', 'evolution', 'moves'];

/** Unchanged signatures; only the union and the array grow. */
export function openDetail(memberId: string, tab: DetailTab = 'stats'): DetailState;
export function carriedDetailTab(state: DetailState): DetailTab;
export function setDetailTab(state: DetailState, tab: DetailTab): DetailState;
export function nextDetailTab(tab: DetailTab, delta: number): DetailTab;
```

- `nextDetailTab`: `('stats', 1) → 'evolution'`, `('evolution', 1) → 'moves'`,
  `('moves', 1) → 'stats'`, `('stats', -1) → 'moves'`, `('moves', 2) → 'moves'`.
  Wrap-around is unchanged in shape.
- `carriedDetailTab` and `setDetailTab` keep their current semantics verbatim: a
  closed panel still carries `'stats'`, and a tab change still drops the move in hand.
- `detailStops(tab, counts)`:
  - `'stats'` → `name`, `ability`, and **no** `evolution` stops any more;
  - `'evolution'` → one `evolution` stop per `counts.evolutions` (0 → an empty list);
  - `'moves'` → unchanged (`search`, the slots, then the pool).
  `DetailStopKind` already carries `'evolution'`; do not rename it.

### `src/ui/hud/panels/detail/view.ts` — the card's model

Today: `DetailPanelUi.tab: 'stats' | 'moves'` (line 36), the tab row is built from
`(['stats','moves'] as const)` with `tabW = (innerW - HUD_TAB_GAP) / 2` (lines 503,
531-536), and `evolution` is non-null only on STATS (line 558).

```ts
import { DETAIL_TABS, type DetailTab } from '../../../partyDetail';

export type DetailPanelUi = Readonly<{
  tab: DetailTab;              // was 'stats' | 'moves'
  // … every other field unchanged
}>;

export type DetailPanelView = Readonly<{
  // … unchanged fields …
  tabs: readonly Readonly<{ tab: DetailTab; label: string; active: boolean; box: Rect }>[];
  /** Non-null on the EVOLUTION tab only, and only for a member with a family. */
  evolution: DetailEvolutionView | null;
}>;

/** The evolution tab's own geometry, replacing the STATS band's 250 / 272. */
export const DETAIL_EVO_TITLE_TOP = DETAIL_CONTENT_TOP;      // 108
export const DETAIL_EVO_TOP = DETAIL_EVO_TITLE_TOP + 22;     // 130
```

- **Tab row.** Three boxes at `y = DETAIL_TABS_TOP` (72), height `DETAIL_TAB_H` (26).
  Widths: `const base = Math.floor((innerW - HUD_TAB_GAP * 2) / 3)`, tabs 0 and 1 are
  `base` wide, tab 2 takes the remainder (`innerW - HUD_TAB_GAP * 2 - base * 2`);
  `x = padX + i * (base + HUD_TAB_GAP)`. The gap stays `HUD_TAB_GAP` (4) and the row
  keeps its own left/right insets (`padX`), so the third box ends exactly on the
  card's inner right edge.
  - At **1280×800** (`detailPanelBox` → `{x: 108, y: 72, w: 460, h: 560}`, `padX` 20,
    `innerW` 420) the three boxes are, in **page** coordinates:
    `{128, 144, 137, 26}`, `{269, 144, 137, 26}`, `{410, 144, 138, 26}`.
  - At **390×844** (`{x: 8, y: 72, w: 374, h: 560}`, `padX` 12, `innerW` 350):
    `{20, 144, 114, 26}`, `{138, 144, 114, 26}`, `{256, 144, 114, 26}`.
- **Labels**, exactly, in this order: `t('detail.tabStats')`, `t('detail.evolution')`,
  `t('detail.tabMoves')` — i.e. `STATS`, `EVOLUTION`, `MOVES` in English and
  `ESTADÍSTICAS`, `EVOLUCIÓN`, `MOVIMIENTOS` in Spanish. **No new i18n key:**
  `'detail.evolution'` already exists (`src/i18n/en.ts` 350, `src/i18n/es.ts` 353)
  and is the one string the band's title already used. `src/i18n/{en,es}.ts` belong
  to `[Task-213]` in this batch and this task must not write them.
- **Tab clamping.** `const tab: DetailTab = ui.tab === 'moves' || ui.tab === 'evolution' ? ui.tab : 'stats'` —
  an unknown value still lands on STATS, exactly as `ui.tab !== 'moves'` does today.
- **Content gating.** `statsTab = tab === 'stats'`, `evolutionTab = tab === 'evolution'`,
  `movesTab = tab === 'moves'`. `evolution` is built only when `evolutionTab` and
  `detail.evolutions.length > 0`; its `box` is
  `{ x: padX, y: DETAIL_EVO_TOP, w: innerW, h: evolutionView(...).height }`. The STATS
  tab returns `evolution: null`.
- **Everything else on the view is unchanged**: the six stat rows, `nature`, `ability`,
  `held`, `caught`, `abilityInfo`, the move grid's slots and their boxes, `search`,
  `pool`, `nickname`, `hints`, `highlight`, `box`, `open`.

### `src/ui/hud/panels/detail/detailPanel.tsx` — the card

- `active` is read as today (`view.tabs.find((tab) => tab.active)?.tab ?? 'stats'`);
  `stats = active === 'stats'`, `moves = active === 'moves'`, and a new
  `evolution = active === 'evolution'`.
- The three `<button class="detail__tab" data-hud-detail-tab=…>` are painted from
  `view.tabs` (no hard-coded pair). The existing attributes and the
  `data-hud-detail="tabs"` container are kept.
- The `Evolution` component (already in this file) is painted **when
  `view.evolution !== null`**, unchanged in its own markup: `data-hud-detail="evolution"`,
  `[data-hud-detail-evo-row]`, `[data-hud-detail-evo-ready]`, the hint. It loses no
  attribute. The nickname field, the stats block and the info block keep their
  `stats`-only gates; the move grid, search and pool keep their `moves`-only gates.
- **Keyboard stepping.** The card's root `<div class="detail" …>` gains
  `onKeyDown`:
  ```ts
  (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target;
    if (target instanceof Element && target.tagName === 'INPUT') return; // the nickname field keeps its arrows
    event.preventDefault();
    event.stopPropagation();
    send({ type: 'tab', tab: nextDetailTab(active, event.key === 'ArrowRight' ? 1 : -1) });
  }
  ```
  `nextDetailTab` is imported from `../../../partyDetail`; the existing `holdKeys`
  helper is the precedent for stopping the route's own keyboard from seeing the key.
- **CSS.** `detail.css`'s `.detail__tabs` / `.detail__tab` rules must not encode a
  2-column grid or a 50 % width — the three boxes come from the model. Change the
  rule to a plain container (`position: absolute; inset: 0;` or `display: contents`)
  so `.detail__tab`'s own inline `left/top/width/height` places each box, the way
  every other box in this card is placed. Do not add a `grid-template-columns`.
- **No new tab label type.** `DetailIntent`'s tab variant widens to
  `{ type: 'tab'; tab: DetailTab }` in `mount.tsx` (and its re-export from
  `index.ts` keeps its name).

### What the scene already does (do not touch it)

`src/scenes/panels/detail.ts` is **not** in your path list and needs no change:

- `runDetailIntent`'s `case 'tab': hudDetailState = setDetailTab(hudDetailState, intent.tab)`
  compiles as soon as `DetailTab` grows, because `intent.tab` is typed `DetailTab`.
- `domUi()` passes `hudDetailState.tab` into `DetailPanelUi.tab`; a wider union is
  assignable.
- The **canvas** panel (`refreshDetail` + `buildDetailPanel`) still draws two tabs and
  still draws the graph inside STATS. It can never receive `'evolution'` (its tab hits
  come from `detailTabAt`, which only knows the two it drew), so nothing there breaks —
  but the canvas divergence is deliberate and `[Task-200]` retires that layer. See
  ⛔ Out of scope.
- If your change makes `src/scenes/panels/detail.ts` fail to typecheck, that is a spec
  bug: stop and report it, do not edit the scene.

### Determinism and rules

- Reads **no RNG**. `npm test` must show no change in any fixed-seed battle or route
  test.
- No Phaser import in `src/ui/hud/**` or `src/ui/partyDetail.ts` (both are DOM/pure).
- No new dependency, no new file unless you add one inside
  `src/ui/hud/panels/detail/` (then add its one-line role to that folder's
  `README.md`, in the same task, per `AGENTS.md`).

## 🧩 Data and configuration

Nothing new. No JSON, no balancing value, no `SAVE_VERSION` step, no `src/data/**`
change. The only numbers this task introduces are the three tab widths and the
evolution tab's 108 / 130 tops, and they are frozen above.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — full Vitest run, headless; must be green. Targeted first:
    `npx vitest run src/ui/hud/panels/detail src/ui/partyDetail.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run lint` — Prettier is the repo's formatter gate.
  - `git diff --name-only main...task-205` — every path must be in the exclusive list
    above.
  - **This task owes a browser pass**: four `[live]` criteria below. Serve with
    `npm run dev` (Vite prints the port, default 5173) and open
    `http://localhost:5173/?hud=dom`; drive it over CDP. Open the card by clicking a
    `[data-hud-party-member]` row on the route.
  - Read DOM boxes with `getBoundingClientRect()`; there is no canvas measurement in
    this task.
- **Acceptance criteria:**
  - **The model (the tests this task owes).**
    - [ ] `[unit]` `detailPanelView(detail, pool, ui, viewport).tabs.map(t => [t.tab, t.label])`
      is `[['stats','STATS'], ['evolution','EVOLUTION'], ['moves','MOVES']]` at both
      viewports, with exactly one `active: true`, and it is the one `ui.tab` names.
    - [ ] `[unit]` The tab boxes are, at 1280×800, `{128,144,137,26}`, `{269,144,137,26}`,
      `{410,144,138,26}` in page coordinates, and at 390×844 `{20,144,114,26}`,
      `{138,144,114,26}`, `{256,144,114,26}`; each tab's `box.x + box.w` never passes
      the card's inner right edge (`box.x + box.w - padX`).
    - [ ] `[unit]` `detailPanelView(…, uiOf({tab:'evolution'}), …).evolution` is non-null
      for a member with a family (its `box` is `{x: padX, y: 130, w: innerW, h: rows*28}`)
      and `null` on both `'stats'` and `'moves'`; a member with no family returns
      `evolution: null` on `'evolution'` too.
    - [ ] `[unit]` `nextDetailTab` walks `stats → evolution → moves → stats` in both
      directions, and `carriedDetailTab(closeDetail(setDetailTab(openDetail('m'), 'evolution')))`
      is `'stats'`.
    - [ ] `[unit]` `detailStops('stats', {evolutions: 2, slots: 0, pool: 0})` carries no
      `evolution` stop, `detailStops('evolution', {evolutions: 2, …})` carries exactly
      two, and `detailStops('moves', …)` is unchanged.
    - [ ] `[unit]` The card's rendered tree (the existing vnode test, e.g.
      `renderToString` / the `detailPanel` test helper already in the folder) carries
      three `[data-hud-detail-tab]` buttons in order, `data-hud-detail="evolution"` is
      absent on STATS, and present when `view.tabs`' active tab is `evolution`; no
      `.detail__slot-info` node is affected by this task.
    - [ ] `[unit]` A rendered card's `tabs` container key handler, fed an
      `ArrowRight` `keydown` with an `Element` target that is not an `INPUT`, emits
      exactly one `{type:'tab', tab:'evolution'}` from `onIntent`; the same event from
      an `INPUT` target emits nothing.
    - [ ] `[unit]` It typechecks and builds clean.
    - [ ] `[unit]` Nothing outside the exclusive paths was touched — in particular
      `src/i18n/{en,es}.ts`, `src/scenes/panels/detail.ts` and
      `src/ui/hud/panels/detail/evolution.ts` are byte-identical to `main`.
  - **Live.**
    - [ ] `[live]` At **1280×800**, `?hud=dom`, a run with a Charmander-family member:
      click its party row, then read
      `[...document.querySelectorAll('[data-hud-detail-tab]')].map(b => b.dataset.hudDetailTab)`
      → `['stats','evolution','moves']`; their `getBoundingClientRect()` widths are
      137 / 137 / 138 ±1 px and their `top` is 144 ±1; the last button's `right` is
      548 ±1, equal to the card's inner right edge (`[data-hud-panel="detail"]`'s
      `left + width - 20`).
    - [ ] `[live]` At **1280×800**, same card: on STATS,
      `document.querySelector('[data-hud-detail="evolution"]') === null` and the six
      `[data-hud-detail-stat]` rows are painted; click the EVOLUTION tab →
      `[data-hud-detail="evolution"]` exists with at least one
      `[data-hud-detail-evo-row]` (and no `[data-hud-detail-stat]` row is visible),
      and the tab reports `aria-pressed="true"`; press `ArrowRight` once (focus is on
      the card's tab) → the active tab is `moves` and four `[data-hud-detail-slot]`
      exist.
    - [ ] `[live]` At **390×844**, same walk: three tabs of 114 ±1 px starting at
      `left` 20 / 138 / 256, `top` 144 ±1, no horizontal overflow of the card, the
      tab row's `bottom` (170) stays above the first content row, the graph is drawn
      after one press and the move grid after the second, and no element of the card
      is painted outside `[data-hud-panel="detail"]`'s rect.
    - [ ] `[live]` The nickname field keeps `ArrowLeft` / `ArrowRight`: with the field
      focused on the STATS tab, pressing `ArrowRight` moves the caret (the tab does
      **not** change; the `data-hud-detail-tab` active id stays `stats`).

## 📣 Coordination

- **For the Architect / Orchestrator:** the entry's claims line omits
  `src/ui/partyDetail.ts` + its test, which is where `DetailTab`, `DETAIL_TABS`,
  `nextDetailTab` and `detailStops` live; without it the third tab cannot exist. This
  spec claims them. It also claims `mount.tsx` (the `DetailIntent` union) and
  `index.ts` (the re-export), and **nothing else**.
- **For `[Task-213]` (same batch):** you hold `src/i18n/{en,es}.ts`; this task needs
  no key and writes neither file. It uses the existing `'detail.evolution'`.
- **For `[Task-200]` (Batch 90):** when the canvas panel retires, its two-tab row and
  its STATS band go with it; the DOM card is already three-tab and the graph is
  already its own tab.
- **For the next batch:** `DETAIL_TAB_ORDER` is `DETAIL_TABS` in
  `src/ui/partyDetail.ts` — a fourth tab is an edit to that array plus one label key,
  never a new list in the panel.
- **Canvas divergence, on the record:** while both layers exist, the canvas card
  draws two tabs and the graph inside STATS. `?hud=dom` is the surface this task
  fixes; the canvas is fixed by retiring it, not by a second implementation.

## ⛔ Out of scope

- `src/scenes/panels/detail.ts` in any form (the canvas tab row, the canvas band, the
  canvas hit tests). `[Task-200]` retires that layer.
- `src/ui/hud/panels/detail/evolution.ts` — the graph's own rows, edges, window and
  scroll maths are unchanged.
- Wiring `detailStops`/`stepStop` to any keyboard handler: they still have no caller
  after this task; only their model is correct.
- The move grid, the learnset pool, the nickname field, the ability ⓘ, the panel's
  drag/collapse behaviour (`[Task-208]`), the i18n pair, any data file, any scene
  other than `MainMenuScene.ts` (not yours), and any change to `package.json`,
  `vite.config.ts` or `src/main.ts`.
- A `SAVE_VERSION` step: the tab is view state, never saved.

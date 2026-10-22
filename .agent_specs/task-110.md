# Spec: Task-110 — The item bag is an icon grid, in the route HUD and in battle

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (two scenes) + a pure UI model module.
- **Role:** Dev.
- **Objective:** both bag surfaces stop being lists of text rows and become an
  **icon grid**: five fixed columns of square cells, each cell the item's Añil
  icon (`itemIconFrame`) with a small count badge in its corner, the shipped
  pocket-tab strip above and a filter text field between tabs and grid, the money
  line (route) or the selected stack's line (battle) below, the selected cell in
  the shipped accent fill + accent outline and an empty slot a dim outline. The
  cursor steps by column and row through a new pure `stepBagGrid`, a click selects
  a cell, and the applying gesture does not change (the route's drag onto a member,
  the battle's confirm). A floating info card beside the grid — the shipped
  `InfoPopup` card that `src/ui/abilityInfo.ts` wraps — names the selected item and
  prints its catalogue description, or, for a coloured candy the run has already
  discovered, the run's own stat through `candyTreat`. The filter narrows the
  visible cells by a case-insensitive name substring through a new pure
  `filterBagStacks`, and while it holds focus it owns the keyboard exactly as the
  shipped nickname and learnset fields do — in battle that makes it the scene's
  first text input and keeps every command shortcut off.
- **Environment:** worktree `../wt-pkm-110`, branch `task-110`, cut from
  `origin/main` at `9182192`. Install with
  `npm ci --prefer-offline --no-audit --no-fund`.
- **Dependencies** (all merged; each with the file this task reads):
  - **[Task-58]** the design tokens — `src/ui/frlg.ts`'s `FRLG_SURFACE`,
    `FRLG_ROW_FILL`, `FRLG_ROW_STROKE`, `FRLG_SELECTED_FILL`,
    `FRLG_SELECTED_STROKE`, `FRLG_ACCENT`, `FRLG_MUTED`, and
    `src/data/ui/chrome.json`'s `tokens`.
  - **[Task-103]** the coloured candy — `src/engine/run/items.ts`'s `candyTreat`,
    `src/engine/run/state.ts`'s `discoveredCandy`, `src/data/items.ts`'s
    `ItemDef.candy` / `CANDY_COLOURS` / `CANDY_STATS`.
  - **[Task-34]** the fixed-cell precedent this task follows (not edits) —
    `src/ui/partyGrid.ts`.
  - The **shared info popup** (`src/ui/infoPopup.ts`, the card
    `src/ui/abilityInfo.ts` wraps) and the **item icon atlas**
    (`src/data/itemIcons.ts`, `itemIconFrame`), both shipped.

### Exclusive paths (single writer)

Create or modify **only** these files. Nothing outside this list.

- `src/ui/bag.ts` — the pure grid model, the stepper and the filter.
- `src/ui/bag.test.ts` — its tests.
- `src/scenes/RouteScene.ts` — the HUD's bag window.
- `src/scenes/BattleScene.ts` — the battle's bag window.
- `src/i18n/en.ts` — two new keys.
- `src/i18n/es.ts` — their Spanish overlay.
- `docs/design-spec.md` — the sections named under **Coordination** only.
- `docs/data-spec.md` — the sections named under **Coordination** only.

`src/i18n/index.test.ts`, `src/ui/README.md` and `src/scenes/README.md` are **not**
yours (another task in this batch owns `src/ui/README.md`). No file is added,
renamed or deleted by this task, so **no folder `README.md` changes** — say so in
your commit message, do not edit one.

### Inputs (read-only)

The eight files under **Exclusive paths** are yours to edit (read them whole
first); everything below is read-only.

- `AGENTS.md`, `docs/tech-decisions.md` (`D10`, `D11`, `D12`, `D43`, `D45`).
- `docs/design-spec.md` §3, §4, §10.1 and §10.3 — the current wording you amend:
  read the whole file, change only those sections.
- `docs/data-spec.md` §3 (the candy bullet) and the data-file table row for
  `src/data/itemIcons.ts`.
- `src/ui/frlg.ts`, `src/ui/frlgFont.ts`, `src/ui/infoPopup.ts`,
  `src/ui/abilityInfo.ts`, `src/ui/partyGrid.ts`, `src/ui/metrics.ts`.
- `src/data/itemIcons.ts`, `src/data/items.ts`, `src/data/ui/chrome.json`,
  `src/data/keybinds.ts`, `src/data/shop.ts`.
- `src/engine/run/state.ts` (`BagCounts`, `RunState.discoveredCandy`),
  `src/engine/run/items.ts` (`candyTreat`), `src/engine/run/battleLink.ts`
  (`BattleLaunch` — proof the battle never receives `discoveredCandy`),
  `src/engine/battle/state.ts` (`BagSlot`).
- `src/i18n/index.ts` (`t`, `TranslationKey`), `src/i18n/index.test.ts` (the
  guards your keys must not trip).
- `src/dev/env.ts` (`IS_DEVELOP`) and `src/dev/debugMenu.ts` (the precedent for a
  dev-only read method).
- `src/ui/partyDetail.ts` (`statLabel`).

## 🔒 Contract

Everything below is a promise. Names, signatures, defaults and numbers are exact.

### TypeScript — `src/ui/bag.ts` (new exports, additive)

The shipped exports (`BagCategory`, `BAG_CATEGORIES`, `BAG_CATEGORY_LABELS`,
`bagCategoryLabel`, `bagCategoryForKind`, `bagCategoryFor`, `bagForCategory`,
`cycleBagCategory`, `stepBagCursor`) **do not change** — other shipped code and
tests read them.

```ts
/** The human's pick: every bag grid is five columns wide, whatever the surface. */
export const BAG_GRID_COLS = 5;

/** The gap between two cells, both axes, in px. */
export const BAG_GRID_GAP = 6;

export type BagGridDirection = 'up' | 'down' | 'left' | 'right';

/** A rect in the caller's own coordinate space. */
export type BagGridRect = Readonly<{ x: number; y: number; w: number; h: number }>;

export interface BagGridOptions {
  /** Columns to lay out. Default `BAG_GRID_COLS` (5). Never below 1. */
  readonly columns?: number;
  /** Gap between cells, both axes. Default `BAG_GRID_GAP` (6). Never below 0. */
  readonly gap?: number;
  /** Rows to lay out. Default `bagGridRows(count, columns)`. Never below 1. */
  readonly rows?: number;
  /** An upper bound on the cell's side, so a wide band cannot make huge cells. */
  readonly maxCell?: number;
}

export interface BagGridMetrics {
  readonly columns: number;
  readonly rows: number;
  readonly gap: number;
  /** The cell's side in px. `cellH === cellW` always: the cells are square. */
  readonly cellW: number;
  readonly cellH: number;
  /** `rows * columns` rects, row-major (index 0 top-left), all `cellW` square. */
  readonly cells: readonly BagGridRect[];
}

/** The rows a count needs at `columns` wide: `max(1, ceil(count / columns))`. */
export function bagGridRows(count: number, columns?: number): number;

/** Lays the grid out inside `bounds`; see the geometry rules below. Pure. */
export function bagGridLayout(
  bounds: BagGridRect,
  count: number,
  options?: BagGridOptions,
): BagGridMetrics;

/** The cell **slot** `index` (not a stack), or null when it is out of range. */
export function bagGridCell(metrics: BagGridMetrics, index: number): BagGridRect | null;

/** The stack index under a point, or null (outside the grid, in a gap, past `count`). */
export function bagGridIndexAt(
  metrics: BagGridMetrics,
  x: number,
  y: number,
  count: number,
): number | null;

/** The cursor after one step, row-major; see the stepping rule below. */
export function stepBagGrid(
  index: number,
  direction: BagGridDirection,
  count: number,
  columns?: number,
): number;

/**
 * The stacks whose catalogue name contains `query` (trimmed, case-insensitive),
 * in bag order. An empty/blank query returns `stacks` itself (same reference).
 */
export function filterBagStacks(
  stacks: readonly BagCounts[],
  query: string,
): readonly BagCounts[];

/** The candy colour the run has already discovered for `itemId`, or null. */
export function bagDiscoveredCandy(
  itemId: string,
  discoveredCandy: readonly string[],
): string | null;
```

**Geometry rules for `bagGridLayout` — the five-column rule, written once.**

1. `columns = Math.max(1, Math.trunc(options.columns ?? BAG_GRID_COLS))`;
   `gap = Math.max(0, Math.trunc(options.gap ?? BAG_GRID_GAP))`;
   `count = Math.max(0, Math.trunc(count))`, and a non-finite input reads 0.
2. `rows = Math.max(1, Math.trunc(options.rows ?? bagGridRows(count, columns)))`.
3. The cell is the largest **integer** square that fits both axes of `bounds`:
   `cell = Math.max(1, Math.floor(Math.min(
     (bounds.w - (columns - 1) * gap) / columns,
     (bounds.h - (rows - 1) * gap) / rows,
   )))`, then, when `options.maxCell` is finite,
   `cell = Math.max(1, Math.min(cell, Math.trunc(options.maxCell)))`.
4. `gridW = columns * cell + (columns - 1) * gap`; the grid is **centred
   horizontally** and anchored at the top:
   `originX = bounds.x + Math.floor((bounds.w - gridW) / 2)`, `originY = bounds.y`.
5. `cells[i] = { x: originX + (i % columns) * (cell + gap),
   y: originY + Math.floor(i / columns) * (cell + gap), w: cell, h: cell }`,
   for `i` in `[0, rows * columns)`. Length is always `rows * columns`, whether or
   not there are that many stacks — the caller draws the empty tail.
6. The returned grid always fits `bounds`: `cells[last].x + cell <= bounds.x +
   bounds.w` and the same on `y`.

**The selected cell is derived from the cursor, never stored as a rect:** the
caller keeps an **index into the drawn stack list** and reads
`metrics.cells[clampedIndex]` (`clampedIndex = Math.min(index, count - 1)`, and
`stepBagCursor(index, 0, count)` is the shipped clamp). Row-major order is what
makes both surfaces agree: `row = floor(index / 5)`, `column = index % 5`.

**Hit-testing rule for `bagGridIndexAt`:** with `stride = cellW + gap`, compute
`column = Math.floor((x - cells[0].x) / stride)` and
`row = Math.floor((y - cells[0].y) / stride)`. Return `null` when `column` is
outside `[0, columns)`, `row` outside `[0, rows)`, the resulting
`index = row * columns + column` is `>= count`, or the point is **not inside that
cell's own rect** (`x > rect.x + rect.w` or `y > rect.y + rect.h`) — so a press in
the gap between cells or in the band's margin selects nothing and lets the panel
take it. A point exactly on a cell's right or bottom edge counts as inside (the
shipped `panelPoint`/`pointInRect` hit tests are inclusive). `count <= 0` returns
`null`.

**Stepping rule for `stepBagGrid`** (the shipped `BattleScene.moveMenuGrid` rule,
extracted):

- `count <= 0` returns `0`. A non-finite `index` reads `0`; it is clamped into
  `[0, count - 1]` otherwise (`Math.trunc` first).
- `row = floor(current / columns)`, `column = current % columns`,
  `rows = bagGridRows(count, columns)`.
- `up` / `down` move the row and **wrap through the rows**:
  `(row - 1 + rows) % rows` / `(row + 1) % rows`.
- `left` / `right` move the column and **wrap inside the row**:
  `(column - 1 + columns) % columns` / `(column + 1) % columns`.
- The result is `Math.min(nextRow * columns + nextColumn, count - 1)`, so a
  direction that would leave a partial last row **clamps back into it**.
- `columns` defaults to `BAG_GRID_COLS`.

**`filterBagStacks` rules:** the needle is `query.trim().toLowerCase()`; the haystack
is `getItem(stack.itemId)?.name ?? stack.itemId` lowercased — the catalogue's own
**English** name in every locale (`D43`: item names are content, not chrome), so a
Spanish player filters by the English name. Bag order is preserved and the array is
not sorted, deduped or mutated.

**`bagDiscoveredCandy` rules:** returns `getItem(itemId)?.candy` when that colour is
listed in `discoveredCandy`, else `null`. It reads no RNG; the caller passes the
run's list.

- **Determinism:** none of the new functions reads `Rng`, the clock, the DOM or
  Phaser: no stream is consumed, so a seed's run is byte-identical before and after
  this task.
- **Purity:** `src/ui/bag.ts` keeps importing only `../i18n`,
  `../data/items` and `types` from `../engine/run`. **No Phaser import, no DOM
  global** (`grep -nE "phaser|document\.|window\.|localStorage" src/ui/bag.ts`
  must print nothing).

### Route HUD geometry — `src/scenes/RouteScene.ts`

Replace the row list's constants with these (exact values):

```ts
const HUD_BAG_GRID_ROWS = 3;          // replaces HUD_BAG_ROWS (6)
const HUD_BAG_GRID_CELL = 56;         // the reserved cell at the full panel width
const HUD_BAG_SEARCH_GAP = 8;         // filter field -> grid
const HUD_BAG_GRID_GAP = 8;           // grid -> footer rule
const HUD_BAG_INFO_W = 280;           // the floating card's width
const HUD_BAG_INFO_GAP = 8;           // card -> panel edge
const HUD_BAG_GRID_H =
  HUD_BAG_GRID_ROWS * HUD_BAG_GRID_CELL + (HUD_BAG_GRID_ROWS - 1) * BAG_GRID_GAP; // 180
const HUD_BAG_CAP = HUD_BAG_GRID_ROWS * BAG_GRID_COLS;                             // 15
```

`HUD_BAG_ROW` (40) and `HUD_BAG_ROWS` (6) are deleted. `HUD_BAG_HEADER`,
`HUD_TAB_W`, `HUD_TAB_H`, `HUD_TAB_GAP`, `HUD_BAG_FOOTER`, `HUD_PAD_X`,
`HUD_PAD_BOTTOM` and `HUD_DETAIL_SEARCH_H` (24) are reused unchanged.

Window height, top to bottom (all of it inside the FRLG card):

```
bagH = HUD_BAG_HEADER (50)                 // the pocket tab strip
     + HUD_DETAIL_SEARCH_H (24)            // the filter field  (x: left, w: panelW - 2*HUD_PAD_X)
     + HUD_BAG_SEARCH_GAP (8)
     + HUD_BAG_GRID_H (180)                // the grid band
     + HUD_BAG_GRID_GAP (8)
     + HUD_BAG_FOOTER (26)                 // the money band, unchanged
     + HUD_PAD_BOTTOM (12)
     = 308
```

- Filter field: `y = bagY + HUD_BAG_HEADER`, height `HUD_DETAIL_SEARCH_H`, the same
  look **and height** as the MOVES tab's field: a `Rectangle` at
  `FRLG_ROW_FILL.colour/alpha` with `setStrokeStyle(1, FRLG_ROW_STROKE.colour,
  FRLG_ROW_STROKE.alpha)`, plus a `BitmapText` at `size: 16`, `x + 6`, `y + 4`,
  `setMaxWidth(w - 78)`.
- Grid band: `x = left` (`hudX + HUD_PAD_X`), `y = bagY + HUD_BAG_HEADER +
  HUD_DETAIL_SEARCH_H + HUD_BAG_SEARCH_GAP`, `w = panelW - HUD_PAD_X * 2`,
  `h = HUD_BAG_GRID_H`, passed to `bagGridLayout`. At a 1280 px canvas
  (`panelW = 344`, `w = 304`) the layout yields **`cellW = cellH = 56`** and 15
  cells. Store the metrics once, in `buildHud`, in a `private bagGrid:
  BagGridMetrics` field.
- Build `HUD_BAG_CAP` cells once in `buildHud`, each `{ bg, icon, badgeBg, badge }`:
  - `bg`: `this.add.rectangle(...)`, origin `(0, 0)`, no fill/stroke set yet.
  - `icon`: `this.add.image(..., ITEM_ICON_TEXTURE_KEY, 0)`, scale **1**, centred in
    the cell (`x + cellW / 2`, `y + cellH / 2`), `setOrigin(0.5)`.
  - `badgeBg`: `this.add.rectangle(...)`, origin `(0, 0)`.
  - `badge`: `addFrlgText(..., size: 16, tint: FRLG_INK)`, right-aligned in the cell.
  - Push order per cell is `bg, icon, badgeBg, badge` so the badge rides over the
    icon. Push the filter's two objects and every cell into `bagChildren` between
    the tab strip and `hudBagEmpty`, so they move, hide and collapse with the panel
    like the shipped rows did.
- `hudBagEmpty` (`t('hud.noItems')`) is centred on the grid band, shown when the
  drawn list is empty (empty pocket or a filter with no match).
- The footer (rule, `t('hud.money')` label, money value) keeps its shipped
  geometry, moved to `footerY = bagY + HUD_BAG_HEADER + HUD_DETAIL_SEARCH_H +
  HUD_BAG_SEARCH_GAP + HUD_BAG_GRID_H + HUD_BAG_GRID_GAP`.

**Every cell paints by state (the same three states on both surfaces):**

| state | fill | stroke |
| --- | --- | --- |
| occupied, not selected | `FRLG_ROW_FILL` (colour + alpha) | 1 px `FRLG_ROW_STROKE` |
| occupied, selected | `FRLG_SELECTED_FILL` (colour + alpha) | 1 px `FRLG_SELECTED_STROKE` |
| empty slot | same colour, **alpha 0** (no fill) | 1 px `FRLG_ROW_STROKE` at `alpha * 0.4` (the dim outline) |

- The count badge: `badge.setText('x' + stack.count)` first, then
  `badgeBg.setSize(badge.width + 6, 16).setPosition(cell.x + cell.w - 4 -
  badge.width - 3, cell.y + cell.h - 18)` filled `FRLG_SURFACE` at alpha `0.85`,
  and the text at `(cell.x + cell.w - 4, cell.y + cell.h - 18)` with
  `setOrigin(1, 0)`. It is drawn for **every occupied cell**, whatever the count.
- The icon draws at `setFrame(itemIconFrame(itemId))`; a stack whose
  `itemIconFrame` is `null` still gets its cell and its badge, with no icon.

**State on the route** (new private fields):
`hudBagCursor = 0` (index into the drawn stacks), `hudBagQuery = ''`,
`hudBagSearchFocus = false`, `hudBagSearchRect`, `hudBagCells`, `bagGrid`,
`bagInfoPopup: InfoPopup`, `bagInfoLayer: Phaser.GameObjects.Container`.

- `hudBagStacks()` becomes: `bagForCategory(this.run.bag, this.hudBagCategory)`,
  minus the stack in hand (`stack.itemId !== inHand`), through
  `filterBagStacks(..., this.hudBagQuery)`, `.slice(0, HUD_BAG_CAP)`. The 15-cell
  cap **drops the overflow**, exactly as the shipped 6-row list did; the filter is
  how the player reaches the rest.
- `hudBagStackAt(pointer)` is replaced by `hudBagCellAt(pointer): number | null`
  which returns the **index into the drawn stacks** via `bagGridIndexAt` on the
  pointer's panel-local point; `hudDraggableStackAt` keeps its filter on the item
  kind and reads the stack at that index. Both keep the
  `pointerInBagPanel` / `panelPoint(pointer, 'bag')` guard.
- In `handleHudPointerDown`, in this order and **before** the panel-drag fallback:
  `if (this.focusBagSearch(pointer)) return;` (the press landed on the filter
  field: focus it and consume the press), then
  `const cell = this.hudBagCellAt(pointer); if (cell !== null) { this.hudBagCursor = cell; this.refreshHud(); }`
  — the press still falls through to the shipped item drag below it, so a click
  selects and a drag applies. A press **inside the panel but not on a control**
  clears the focus (`if (this.hudBagSearchFocus) { this.hudBagSearchFocus = false; this.refreshHud(); }`),
  mirroring the shipped detail-field rule.
- `textFieldFocused()` becomes `this.hudNicknameFocus || this.hudSearchFocus ||
  this.hudBagSearchFocus` — no new input mode, and `handleAction` already returns
  early on it.
- `typeInBagSearch(event: KeyboardEvent): boolean` mirrors `typeInDetailSearch`
  exactly: returns `false` while unfocused; `Escape`/`Enter` unfocus and return
  `true`; `Backspace` drops the last character (or returns `true` when already
  empty); `event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)` appends it;
  any other key returns `true` and changes nothing; every branch that edited
  `event.preventDefault()`s and `refreshHud()`s. It is called from the scene's
  shipped `keydown` listener right after `typeInDetailSearch(event)`.
- Focus/pocket rules: a pocket change (`selectBagTab`) sets
  `hudBagCursor = 0`, `hudBagQuery = ''`, `hudBagSearchFocus = false`; collapsing
  the bag panel (`togglePanel` → the `'bag'` branch) clears `hudBagSearchFocus`.
- The card: `bagInfoLayer = this.add.container(0, 0)`, then
  `this.hudRoot.add(this.bagInfoLayer)` **after** `hudRoot` exists, then
  `this.bagInfoPopup = new InfoPopup(this, this.bagInfoLayer)`. In `raisePanel`,
  after the two existing `bringToTop` calls, add
  `this.hudRoot.bringToTop(this.bagInfoLayer);` so the card keeps riding over every
  panel. `refreshHud` shows it as
  `this.bagInfoPopup.show({ x: Math.max(HUD_PANEL_MARGIN, this.hudX - HUD_BAG_INFO_W - HUD_BAG_INFO_GAP), width: HUD_BAG_INFO_W, above: cell.y + cell.h, below: cell.y }, { text })`
  when a stack is selected and `hide()`s it otherwise. `cell` is the selected cell's
  rect in **panel-local** coordinates; the card lives on `hudRoot`, so add the bag
  panel's own drag offset (`panel.dx`, `panel.dy`) to `x`, `above` and `below`, so
  the card follows the panel it belongs to. `InfoPopup` places the card's height
  itself; add nothing else.
- The card's text: `${getItem(itemId).name}\n${getItem(itemId).shortDesc}`, except
  for `const colour = bagDiscoveredCandy(itemId, this.run.discoveredCandy)`, when
  it is `${name}\n${t('hud.candyKnown', { stat: statLabel(candyTreat(this.run.seed, colour).stat), delta: candyTreat(this.run.seed, colour).delta > 0 ? '+1' : '-1' })}`.
  Keep the text the scene handed the popup in `private bagInfoText: string` so the
  dev read below can report it.

### Battle geometry — `src/scenes/BattleScene.ts`

```ts
const MENU_BAG_ROWS = 2;      // grid rows (was 3 text rows); 5 columns x 2 rows
const MENU_BAG_CELL_MAX = 56;
const MENU_BAG_DETAIL_H = 20; // the selected stack's line below the grid
const MENU_BAG_DETAIL_GAP = 6;
const BAG_INFO_W = 320;
const BAG_INFO_GAP = 8;
const MENU_BAG_CAP = MENU_BAG_ROWS * BAG_GRID_COLS; // 10
```

`MENU_BAG_ROWS` becomes **2** (5 columns × 2 rows = 10 visible stacks; the shipped
list showed 3). Inside the menu box, top to bottom: the shipped pocket tabs
(`tabY = menu.y + pad.top`, `MENU_TAB_W`/`MENU_TAB_H`), the filter field
(`y = tabY + MENU_TAB_H + 8`, height 24, `x = menu.x + pad.x`,
`w = menu.w - pad.x * 2`, the same rectangle + text look as the route's), the grid
band (`y = filterY + 24 + 8`, `h = menu.y + menu.h - pad.bottom - MENU_BAG_DETAIL_H
- MENU_BAG_DETAIL_GAP - y`), then the selected stack's line in the last
`MENU_BAG_DETAIL_H` band. The band is passed to `bagGridLayout` as
`bagGridLayout(band, count, { rows: MENU_BAG_ROWS, gap: BAG_GRID_GAP, maxCell: MENU_BAG_CELL_MAX })`;
build `MENU_BAG_CAP` cells once, in `create`, exactly as the route does (same four
objects, same paint table, same badge rule), and compute the band and
`this.bagGrid` at the **top of `renderBagMenu`** — the menu rect depends on the
stage size, so the metrics are recomputed on every redraw while the cells are built
once and only repositioned.

**Battle state and behaviour:**

- `private bagStacks: readonly BagSlot[]` — the pocket's stacks, filtered, capped
  at `MENU_BAG_CAP`. `private menuIndex` stays the cursor into it.
- `private bagQuery = ''`, `private bagSearchFocused = false`,
  `private bagSearchRect`, `private bagSearchBg`, `private bagSearchText`,
  `private bagEmptyText`, `private bagCells`, `private bagZones`,
  `private bagInfoPopup: InfoPopup`, `private bagInfoText = ''`, and
  `private bagGrid: BagGridMetrics | null`.
- `setBagItems(category)` sets `bagCategory` and calls `refreshBagItems()`.
  `refreshBagItems()` recomputes the drawn list from the current query and pocket —
  the `usableBag()` slots filtered by `bagCategoryForKind(slot.item.kind) ===
  this.bagCategory` and then by `filterBagStacks` — capped at `MENU_BAG_CAP` into
  `bagStacks`, rebuilds `menuItems` from `bagStacks` (`{ label: '${name} x${count}',
  enabled: true, onSelect: () => this.submit({ type: 'bag', itemId }) }`), clamps
  `menuIndex` with `stepBagCursor(this.menuIndex, 0, this.bagStacks.length)` and
  calls `refreshHud()`. `filterBagStacks` stays the **only** owner of the matching
  rule: map the slots to `{ itemId: slot.item.id, count: slot.count }`, run
  `filterBagStacks`, collect the kept ids into a `Set` and keep the pocket slots
  whose `item.id` is in it — the bag holds one slot per item id, and the order is
  the pocket's own. An empty pocket keeps the shipped placeholder
  `[{ label: t('battle.noItems'), enabled: false, onSelect: () => {} }]` so
  `menuOpen = this.menuItems.length > 0` stays true and `cancel` works.
- `openBag()` clears the filter (`bagQuery = ''`, `bagSearchFocused = false`) as
  does every pocket change (`cycleBagTab`, `selectBagTab`) before `setBagItems`.
- `renderBagMenu(menu)` draws the tabs (unchanged), then: the filter field and its
  text, the grid cells (paint table above; the tail beyond `bagStacks.length` is
  empty), the `battle.noItems` text centred in the grid band when the pocket is
  empty, the selected line `t('battle.noItems')` or `'${name} x${count}'` of
  `bagStacks[menuIndex]`, and the card:
  `bagInfoPopup.show({ x: menu.x + pad.x, width: BAG_INFO_W, above: grid.y - BAG_INFO_GAP, below: grid.y }, { text })`
  — above the menu, over the field, as the shipped `ⓘ` popups float. The battle's
  card text is always `getItem(itemId).name + '\n' + getItem(itemId).shortDesc`:
  the run's `discoveredCandy` list is **not** on `BattleLaunch`
  (`src/engine/run/battleLink.ts`), and that file is outside this task's paths, so
  the candy's discovered line is the route card's alone. Keep the string in
  `this.bagInfoText` for the dev read.
  It must not call `layoutMenuRows` any more; the row texts (`menuRows`) and row
  zones (`menuZones`) stay hidden in bag mode and are still used by the other modes.
- Cell zones: `MENU_BAG_CAP` invisible `Zone`s, interactive, each
  `pointerdown` → `this.selectBagCell(index)`, which ignores an index past
  `bagStacks.length` and otherwise sets `menuIndex` and `refreshHud()`s. **A click
  selects; it never submits.** `hideMenu()` hides/disables them and hides the card.
- `handleAction`: the shipped first line
  `if (this.mode === 'bag' && (action === 'left' || action === 'right')) cycleBagTab(...)`
  is **removed** — all four arrows now reach the grid — and a
  `if (this.bagSearchFocused) return;` guard is the new first line, so no command
  shortcut fires while the field is focused. `navigateMenu` in bag mode becomes
  `if (this.mode === 'bag') { const next = stepBagGrid(this.menuIndex, action,
  this.bagStacks.length); if (next !== this.menuIndex) { this.menuIndex = next;
  this.refreshHud(); } return; }`.
- The raw `keydown` listener (`bindInput`, the one that reads `[` / `]`) becomes:
  keep the `if (this.mode !== 'bag') return;`, then
  `if (this.typeInBagSearch(event)) return;`, then the `[` / `]` pocket cycle. So
  while the field is focused `[` and `]` are swallowed as text input, and the
  pockets stay reachable with a click on their tab or (unfocused) with `[` / `]`.
- `typeInBagSearch(event)` is the same function as the route's (copy the shape; the
  two scenes share no base class), calling `this.refreshBagItems()` instead of a
  HUD refresh. `confirm` while focused is already inert through the
  `handleAction` guard.

### Dev read — one bounded accessor per scene (both scenes)

A `[live]` criterion needs something objective to read, and the shipped scenes
already expose dev-only reads (`RouteScene.debugParty`,
`RouteScene.debugBattlefieldOverlay`). Add exactly one method per scene, gated by
`IS_DEVELOP` (import it in `BattleScene` — it does not import it today):

```ts
/** Dev only: the bag grid as drawn. Null when no bag is on screen. */
bagDebugState(): BagGridDebugState | null;
```

`BagGridDebugState` (declare it in each scene file, identical shape, or once in
`src/ui/bag.ts` as a **type only** — either is fine; if you put it in `bag.ts` it
must stay type-only and Phaser-free):

```ts
export type BagGridDebugCell = Readonly<{
  index: number;            // the stack index in the drawn list
  itemId: string | null;    // null on an empty slot
  count: number;            // 0 on an empty slot
  badge: string;            // the exact string the badge BitmapText draws, '' when empty
  iconFrame: number | null; // Number(icon.frame.name), null when the icon is hidden
  selected: boolean;
  fill: number;             // the bg rectangle's fillColor (0xRRGGBB)
  fillAlpha: number;        // its fillAlpha
  stroke: number;           // its strokeColor
  strokeAlpha: number;      // its strokeAlpha
  rect: BagGridRect;
}>;

export type BagGridDebugState = Readonly<{
  category: BagCategory;
  query: string;
  focused: boolean;
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  gap: number;
  search: BagGridRect;      // the filter field
  grid: BagGridRect;        // the band handed to bagGridLayout
  tabs: readonly Readonly<{ category: BagCategory; rect: BagGridRect }>[]; // the drawn pocket tabs
  cells: readonly BagGridDebugCell[];  // every drawn cell, row-major, empty slots included
  info: Readonly<{ visible: boolean; text: string; x: number; width: number }>;
  footer: string;           // the line drawn under the grid: the money value (route) / the selected stack's line (battle)
}>;
```

- Every rect is in **canvas (pointer) coordinates**: read it from the live object
  (`bg.getBounds()` / `bg.x` + the panel's `dx, dy`) and add the camera viewport
  origin where the surface has one (`this.cameras.main.x/y` in the battle; the HUD
  camera sits at 0,0, so the route's `getBounds()` is already canvas space).
- `badge`, `iconFrame`, `fill`/`fillAlpha`, `stroke`/`strokeAlpha`, `footer`,
  `selected` and `info.text` are read back from the **live drawing objects**, never
  recomputed, so the read measures what is on screen.
- The route returns `null` when `this.run` is missing; the battle returns `null`
  when `this.mode !== 'bag'`.

## 🧩 Data and configuration

No data table and no generated file changes: the item icons, the catalogue and the
candy table all ship. Only strings are added.

### i18n keys (authored in `en.ts`, overlaid by `es.ts`)

| key | en | es | where |
| --- | --- | --- | --- |
| `hud.searchItems` | `search items...` | `buscar objetos...` | the grid's filter placeholder, both surfaces |
| `hud.candyKnown` | `This run: {stat} {delta}` | `En esta partida: {stat} {delta}` | the info card of a discovered candy |

- `{stat}` is `statLabel(treat.stat)` and `{delta}` is `+1` or `-1`.
- **Why the prefix is `hud.` and not `bag.`:** the shipped
  `src/i18n/index.test.ts` pins the `bag.` prefix to **exactly five** keys ("keeps
  every bag pocket label at six characters or fewer",
  `expect(pockets).toHaveLength(5)`). That test file is outside this task's
  exclusive paths, so the candy key must not join the `bag.` family. Do not edit
  `src/i18n/index.test.ts`, `en.ts`'s five `bag.*` rows or the guard.
- The Spanish values must be drawable in the FRLG font (the table test checks every
  glyph) and must declare no param English does not.

### Caps (documented, not configurable)

- Route: **15** drawn stacks (3 rows × 5); the rest are reachable through the
  filter. This replaces the shipped 6-row cap.
- Battle: **10** drawn stacks (2 rows × 5); the rest through the filter. This
  replaces the shipped 3-row cap.

## 🧪 Test and Validation Plan (for QA)

### Method

Run in this order, from the worktree's root, on the branch tip.

```bash
npm ci --prefer-offline --no-audit --no-fund
npx vitest run src/ui/bag.test.ts     # the new tests, alone
npm test                              # the whole suite, headless
npm run build                         # tsc --noEmit && vite build
git diff --name-only origin/main...task-110   # the path audit
grep -nE "phaser|document\.|window\.|localStorage" src/ui/bag.ts   # must print nothing
```

Then the `[live]` pass, which is mandatory for this task (two Phaser scenes). No
criterion below is skippable.

### The live fixture (exact; use it for every `[live]` criterion)

Dev server and browser:

```bash
npm run dev -- --port 5199 --host 127.0.0.1      # .env.development => IS_DEVELOP true
# headless Chromium at 1280x800 with CDP, halves of the runner image:
chromium --headless=new --no-sandbox --window-size=1280,800 \
         --remote-debugging-port=9222 http://127.0.0.1:5199/ &
```

Set the viewport to **1280×800** so one canvas pixel is one game pixel (Phaser's
scale mode is `RESIZE`, resolution 1) and so the route's `panelW` is exactly 344.

**A clean profile first.** The HUD layout is persisted with the settings (`D22`):
a bag panel left open or dragged by an earlier criterion moves the grid. Launch
Chromium with a throwaway `--user-data-dir=$(mktemp -d)`, and before the fixture
run `Runtime.evaluate` `localStorage.clear()` + `location.reload()` once, then
re-do the fixture. Read state through
`const route = game.scene.getScene('Route'); const battle = game.scene.getScene('Battle');`
— every `route.…` / `battle.…` in the criteria below means that object.

**The fixture run** — build it in the page, never by hand-editing the save. This is
deterministic (fixed seed, fixed bag) and reaches every state the criteria need:

```js
const { game } = await import('/src/main.ts');
const { createRun, createRunPokemon } = await import('/src/engine/run/index.ts');
const starter = createRunPokemon({ id: 'starter', speciesId: 'pikachu', level: 5, learnsetSeed: 'task-110' });
const run = {
  ...createRun({
    seed: 'task-110',
    starter,
    money: 1234,
    bag: [
      { itemId: 'charcoal', count: 1 },      // equipment
      { itemId: 'leftovers', count: 1 },     // equipment
      { itemId: 'potion', count: 3 },        // consumable, index 0
      { itemId: 'superpotion', count: 2 },   // consumable, index 1
      { itemId: 'antidote', count: 1 },      // consumable, index 2
      { itemId: 'oranberry', count: 5 },     // consumable, index 3
      { itemId: 'burnheal', count: 1 },      // consumable, index 4
      { itemId: 'candyred', count: 2 },      // consumable, index 5
      { itemId: 'pokeball', count: 4 },      // ball
      { itemId: 'greatball', count: 2 },     // ball
      { itemId: 'nugget', count: 1 },        // valuable
    ],
  }),
  discoveredCandy: ['red'],
};
game.scene.stop('MainMenu');
game.scene.start('Route', { run });
```

The pocket under test is **CONSUM**: six stacks, so the grid is 5 columns × 2 rows
with 10 drawn cells and 6 occupied. The route opens on **EQUIP**, so the CONSUM tab
must be clicked first, using `bagDebugState().tabs[1].rect` as the target.

Key events: send real ones with `Input.dispatchKeyEvent` (`type: 'keyDown'` then
`'keyUp'`, `text` filled for printable characters). The keys used:
`i` (open the bag panel: `key: 'i'`, `code: 'KeyI'`, `windowsVirtualKeyCode: 73`),
`E` (battle confirm: `key: 'e'`, `code: 'KeyE'`, `windowsVirtualKeyCode: 69`),
`ArrowDown` (40), `Escape` (27), `Backspace` (8), and the letters of the query
(`s`=83, `u`=85, `p`=80, `e`=69, `r`=82). Phaser listens on `window`
(`KeyboardManager`), so a real CDP key event reaches it; `window.dispatchEvent(new
KeyboardEvent('keydown', { key, code, keyCode }))` is an acceptable fallback.

**Clicking** a rect `bagDebugState()` hands you: map the canvas coordinate to the
viewport with the canvas' own box —
`const r = game.canvas.getBoundingClientRect(); x = r.left + cx * r.width / game.canvas.width;`
— and send `Input.dispatchMouseEvent` `mousePressed` then `mouseReleased`
(`button: 'left'`, `clickCount: 1`, no `buttons` juggling).

**Pixel reads** (only the two route colour criteria need them):

```js
async function readRect(x, y, w, h) {
  const { game } = await import('/src/main.ts');
  if (!game.renderer.gl) return game.canvas.getContext('2d').getImageData(x, y, w, h).data;
  const img = await new Promise((res) => game.renderer.snapshotArea(x, y, w, h, (image) => res(image)));
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h).data;
}
```

Report, per criterion, the numbers you read (`bagDebugState()` snapshots, pixel
counts). A measurement that was not printed does not exist.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is clean (`tsc --noEmit && vite build`).
- [ ] `[unit]` `npx vitest run src/ui/bag.test.ts` is green **and** the file's new
      suites exist and cover, at minimum:
      - `bagGridRows`: `(0) → 1`, `(5) → 1`, `(6) → 2`, `(15) → 3`, `(16) → 4`.
      - `bagGridLayout`: `columns === 5` by default; `cellW === cellH`;
        `cells.length === rows * columns`; a 304×180 band with 6 stacks gives
        `cellW === 56` and `rows === 2`; cells are row-major and their pitch is
        `cellW + gap`; a wide band gives the height-bound cell and a tall band the
        width-bound one; the grid never exceeds `bounds`; the grid is centred
        horizontally when it is narrower than `bounds`; count 0 → `rows === 1` and 5
        cells.
      - `bagGridCell`: in range returns `cells[index]`, out of range returns `null`.
      - `bagGridIndexAt`: a point in a cell returns its index; a point in a gap, the
        band's margin, or a slot past `count` returns `null`; `count === 0` returns
        `null`.
      - `stepBagGrid`: `right` from 4 → 0 (wraps inside the row); `down` from 0 with
        7 → 5; `down` from 2 with 7 → 6 (clamps into the partial last row); `up`
        from 0 with 7 → 5; `left` from 0 → 4; `count 0` → 0; a non-finite index → 0.
      - `filterBagStacks`: case-insensitive; trims the query; a blank query returns
        the **same array reference**; matches on the catalogue name, not the id
        (`'pot'` finds `potion`, `'potion'` does not find `antidote`); no match →
        `[]`; order preserved.
      - `bagDiscoveredCandy`: `('candyred', [])` → `null`, `('candyred', ['red'])` →
        `'red'`, `('potion', ['red'])` → `null`, an unknown id → `null`.
- [ ] `[unit]` `npm test` (whole suite) is green — in particular
      `src/i18n/index.test.ts` still passes with the two new keys and its
      `bag.`-prefix guard still counting 5.
- [ ] `[unit]` `git diff --name-only origin/main...task-110` lists **only** the
      eight exclusive paths, and
      `grep -nE "phaser|document\.|window\.|localStorage" src/ui/bag.ts` prints
      nothing.
- [ ] `[live]` **The route bag is a 5-column icon grid.** After the fixture run,
      press `i` and click the CONSUM tab. `route.bagDebugState()` reports
      `columns === 5`, `rows === 2`, `cellW === cellH`, `cellW === 56`,
      `cells.length === 10`, `grid.w === 304`, and exactly 6 cells with a non-null
      `itemId` in this order: `potion, superpotion, antidote, oranberry, burnheal,
      candyred`; the badges read `x3, x2, x1, x5, x1, x2`; every occupied cell's
      `iconFrame === Number((await import('/src/data/itemIcons.ts')).itemIconFrame(itemId))`;
      the four empty cells have `itemId === null`, `badge === ''` and
      `iconFrame === null`.
- [ ] `[live]` **The selection is the shipped accent and an empty slot is a dim
      outline.** Same state: `cells[0]` (the cursor's own cell) has
      `selected === true`, `fill === FRLG_SELECTED_FILL.colour`,
      `fillAlpha === FRLG_SELECTED_FILL.alpha`,
      `stroke === FRLG_SELECTED_STROKE.colour`, `strokeAlpha === 1`, while
      `cells[1]` has `fill === FRLG_ROW_FILL.colour`,
      `stroke === FRLG_ROW_STROKE.colour`, and `cells[6]` (empty) has
      `fillAlpha === 0` and `strokeAlpha < FRLG_ROW_STROKE.alpha / 2` — the four
      constants imported live from `/src/ui/frlg.ts`. Pixel measurement: scan the
      row `y = cells[0].rect.y`, `x` from `cells[0].rect.x` to
      `cells[0].rect.x + cellW - 1` with `readRect`, and count the pixels equal to
      `0x7dd3fc`; the count is at least `cellW - 2` (only the two corners may
      differ). Report the count and the RGB triples read.
- [ ] `[live]` **Clicking a cell selects it and the card describes it.** Click the
      centre of `cells[1]` (Potion is index 0, Super Potion index 1): the four
      pointer fields are the cell's `rect` centre. Afterwards
      `bagDebugState().cells[1].selected === true` and `cells[0].selected === false`,
      no stack was spent (`cells[1].count === 2`), and
      `info.visible === true` with `info.text` equal to
      `getItem('superpotion').name + '\n' + getItem('superpotion').shortDesc` (both
      read live from `/src/data/items.ts`), and
      `info.x + info.width <= grid.x` (the card sits beside the grid, never over it).
- [ ] `[live]` **A discovered candy prints the run's own stat.** Click the candy
      cell (`cells[5]`, "Red Candy"): `info.visible === true` and `info.text ===
      getItem('candyred').name + '\n' + t('hud.candyKnown', { stat:
      statLabel(candyTreat('task-110', 'red').stat), delta: candyTreat('task-110',
      'red').delta > 0 ? '+1' : '-1' })`, with `t` from `/src/i18n/index.ts`,
      `statLabel` from `/src/ui/partyDetail.ts` and `candyTreat` from
      `/src/engine/run/items.ts`. Then **restart the fixture** with
      `discoveredCandy: []` (`game.scene.start('Route', { run: { ...run, discoveredCandy: [] } })`),
      press `i`, click the CONSUM tab and the same candy cell: the card now reads
      `getItem('candyred').name + '\n' + getItem('candyred').shortDesc`.
- [ ] `[live]` **The filter narrows the grid and an empty filter restores it.**
      Click the centre of `bagDebugState().search` (focus), then send `s`,`u`,`p`,
      `e`,`r`: `query === 'super'`, `focused === true`, exactly one occupied cell
      (`superpotion`, `count === 2`), `rows === 1`, `cells.length === 5`, and
      `footer` is still `'1234'`. Then send `Backspace` five times: `query === ''`,
      `rows === 2`, `cells.length === 10`, the six stacks return in the same order
      and `footer` is still `'1234'`. Then send `Escape`: `focused === false` and
      `query === ''` (the field left focus without losing the list).
- [ ] `[live]` **In battle the bag is the same grid and typing owns the keyboard.**
      With the fixture run live, call
      `(await import('/src/main.ts')).game.scene.getScene('Route').startDebugWildBattle('pidgey', 5)`,
      wait for `game.scene.isActive('Battle')`, send `E` until
      `getScene('Battle').mode === 'menu'` (at most 4 presses, 400 ms apart), then
      `ArrowDown` and `E`. `battle.bagDebugState()` is non-null and reports
      `columns === 5`, `rows === 2`, `cellW === cellH`, `cellW >= 24`,
      `cells.length === 10`, `cellW === Math.floor(Math.min((grid.w - 4 * gap) / 5,
      (grid.h - gap) / 2, 56))` (recomputed from the reported `grid`/`gap`; 56 is
      `MENU_BAG_CELL_MAX`), `category === 'consumable'`, and 6 occupied cells. Then
      click the centre of
      `search` and send `e`: `query === 'e'`, `focused === true`, and
      `bagDebugState()` is **still non-null** (the confirm shortcut did not submit a
      bag command and the battle is still in its bag); then send `[`:
      `category` is unchanged and `query` is unchanged (the key was swallowed as
      text input). Then click the centre of `cells[1]`: `cells[1].selected === true`
      and `bagDebugState()` is still non-null (a click only selects). Finally send
      `E` while unfocused (send `Escape` first): `bagDebugState()` returns `null`,
      i.e. the confirm applied the stack exactly as the row list did.

## 📣 Coordination

- **For the Orchestrator / Integration QA:** this task edits
  `docs/design-spec.md` and `docs/data-spec.md` **by section only**. Its sections
  are: `docs/design-spec.md` §3 (the new bag bullet after the *consumable* bullet
  and before *The Pokevial*), §4 (the *The bag opens as pockets…* bullet), §10.1
  item 4 (leave untouched unless the underline wording must name the grid), §10.3
  (the paragraph naming the focused text fields, and the table rows at *Bag stacks*
  / *Bag pockets* / *Battle bag list and pockets*), and `docs/data-spec.md` §3 (the
  candy bullet) plus the `src/data/itemIcons.ts` row of its data-file table. No
  other section of either file is touched; review the combined documents for lost
  lines.
- **For the next batch:** the frozen surface is `src/ui/bag.ts`'s
  `BAG_GRID_COLS`/`BAG_GRID_GAP`/`bagGridRows`/`bagGridLayout`/`bagGridCell`/
  `bagGridIndexAt`/`stepBagGrid`/`filterBagStacks`/`bagDiscoveredCandy` plus the
  `bagDebugState()` shape. Any later bag-like grid (the Mart, the reward card, the
  PC box) reuses these instead of a second geometry. The battle's bag now owns the
  arrows (`left`/`right` no longer cycle pockets); anything written against the old
  `up`/`down`-list + `left`/`right`-pockets map must be rebased.
- **Resolved readings, recorded so they are not re-litigated:**
  1. `left`/`right` in the battle's bag used to cycle pockets; the five-column grid
     needs them for columns, so the pockets become click-or-`[`/`]` only.
  2. The route HUD is pointer-first (`D45`/§10.3): its selected cell comes from a
     click (plus the shipped item drag), and `stepBagGrid` drives the battle's
     keyboard. The route never takes an arrow key.
  3. The candy key is `hud.candyKnown`, not a `bag.*` key — see the i18n note; the
     shipped test pins `bag.` to five keys and is not in this task's paths.
  4. The card is the `InfoPopup` component (`src/ui/infoPopup.ts`), which
     `src/ui/abilityInfo.ts` wraps, with no `ⓘ` button: the selection itself shows
     it, on both surfaces.
  5. Overflow past the cap (15 route / 10 battle) is dropped as the shipped lists
     dropped theirs; the filter is the way to the rest.
  6. The candy's discovered line is the **route** card's only: the run's
     `discoveredCandy` never reaches the battle (`BattleLaunch` carries `runSeed`
     and the bag, not the discovery list), and `src/engine/run/battleLink.ts` is
     outside this task's paths. In battle the card prints the catalogue
     description, which is the same "which stat is this run's secret" line every
     other surface prints.

## ⛔ Out of scope

- The bag's **model**: `BAG_CATEGORIES`, the pockets, `bagCategoryFor`,
  `cycleBagCategory`, the ball pocket's wild-only rule and `usableBag()`'s
  filtering.
- The item catalogue, its prices, the candies' data and `candyTreat`'s mapping.
- Any further RNG, save field, `SAVE_VERSION` step or run field: this task adds
  none.
- The Mart and the reward panels (`src/scenes/rooms/*`) — floating cards whose
  rows stay rows.
- The other grids: the battle's FIGHT/INFO/party grids, `src/ui/moveGrid.ts`,
  `src/ui/partyGrid.ts`. Read them as the precedent; change none.
- `src/ui/README.md` and `src/scenes/README.md` (no file added, renamed or
  deleted), `src/i18n/index.test.ts`, `src/ui/infoPopup.ts`,
  `src/ui/abilityInfo.ts`, `src/data/itemIcons.ts`.
- Scroll, paging, drag-reorder or hover-preview inside the bag grid; a second
  filter field; per-cell tooltips.
- Regenerating the dex or any asset (`npm run data:*`, `npm run assets:*`).

# Spec: Task-129 — The bag panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene module + Preact panel (`D49`, Phase 12).
- **Role:** Dev.
- **Objective:** The bag window leaves Phaser as a **pure move plus a skin**. With
  `?hud=dom` on, the route's bag is a Preact panel in the `#hud` layer that draws the
  **same card the Phaser module draws today** — the same rect, the same five pocket
  tabs, the same filter field, the same five-column grid of stacks with their icons
  and counts, the same money footer and the same floating description card — while
  `src/scenes/panels/bag.ts` draws no Phaser object at all. The card's paint comes
  from the prototype board (`design/frames/03b-panels-row-view.json`): radius 11, the
  1 px hairline, the 1 px highlight 12 px inside its top edge, the 24×24 accent-edged
  key chip, the board's type scale and line boxes, and the board's item tile (radius
  8, 4 % fill, 8 % stroke, a centred 24×24 atlas icon and a 9 px count). With the
  flag off every line of the shipped Phaser bag draws exactly as it draws today.
- **Environment:** worktree `../wt-pkm-129`, branch `task-129`.
- **Dependencies:** all merged, nothing produced by a batch-mate:
  - `Task-127` (the spike) — `src/ui/hud/panels/options/**` is the pattern this task
    copies, and `src/scenes/SettingsScene.ts` shows the scene-side `DOM_HUD` branch.
  - `Task-128` — `src/scenes/panels/bag.ts` exists and is the only writer of the bag.
  - `Task-124` — `src/ui/hud/mount.ts`, `styles/root.css`, the Silkscreen faces.
  - `Task-125` — `src/ui/hud/kit/**`.
  - `Task-126` — `src/ui/hud/fixtures/**` (`parseHudFlags`).
  - Read but never changed: `src/ui/bag.ts` (the shipped bag model), `src/ui/hud/state.ts`
    (`HudState`), `src/ui/hud/commands.ts` (`HudCommand`), `src/ui/infoPopup.ts`,
    `src/ui/metrics.ts`, `src/data/itemIcons.ts` (`ITEM_ICON_ATLAS_URL`,
    `ITEM_ICON_SIZE`, `itemIconFrame`) and `src/data/anil/item-icons.json` (`cols`),
    `src/scenes/panels/hud.ts` (`HUD_*`, `hudMetrics`, `panelExpanded`,
    `toggleHudPanel`, `makeHudPanel`), `src/scenes/panels/party.ts` (`partyBottom`),
    `src/data/ui/chrome.json` (`window.padding`, `window.alpha`).

### Board vs shipped screen (read this before planning the work)

`03b Panels · row view` is a **compact variant** of the same screen, not the screen:
its bag group is one 304×130 card holding one row of tiles and no pocket tabs. The DOM
panel draws the **shipped** screen inside the **shipped** box, and takes the board's
*paint* only. Three things are therefore deliberately **not** adopted, each with its
arithmetic:

1. **The 304×130 card.** The shipped bag is 344×308: `hudMetrics(w).panelW` is
   `min(HUD_PANEL_W = 344, w - 16)` and its height is
   `HUD_BAG_HEADER 50 + HUD_SEARCH_H 24 + 8 + HUD_BAG_GRID_H 180 + 8 + HUD_BAG_FOOTER 26
   + HUD_PAD_BOTTOM 12 = 308` (`src/scenes/panels/bag.ts`). Adopting the frame's card
   would delete three of the five pocket tabs' room and the money footer.
2. **The 64×60 tile at pitch 72.** The shipped header already holds the five pockets:
   `5 × HUD_TAB_W 55 + 4 × HUD_TAB_GAP 4 = 291 px` of a 304 px inner width, and one row
   of `64 + 8` tiles needs `4 × 72 − 8 = 280 px` of the same 304, which a five-column
   grid cannot reach (`5 × 64 + 4 × BAG_GRID_GAP 6 = 344 > 304`). Adopting it would cut
   the grid to four columns and the pocket's cap from `HUD_BAG_CAP = 15` to 12. The DOM
   keeps the shipped cell and takes the tile's **paint**: radius 8, the 4 %/8 % pair, a
   centred 24×24 icon (the board's `bag icon <item>` at tile +(20,18) is exactly
   `((64−24)/2, (60−24)/2)`, so "centred" is the board's own rule) and the 9 px count at
   the board's insets (11 px from the tile's right edge, 6 px from its bottom: `bag qty`
   is an 11×10 box at +(42,44) of a 64×60 tile).
3. **The board's view toggle and scroll track.** The shipped bag has neither (`bag.ts`
   caps at 15 stacks with no scroll), and the 304 px header row has 3 px left after the
   pocket tabs — a 24 px toggle would displace the fifth pocket. The Phaser bag keeps
   its exact behaviour; adding a second bag presentation is a design change, not a
   migration.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/bag.ts` (modify)
- `src/ui/hud/panels/bag/view.ts` (new)
- `src/ui/hud/panels/bag/view.test.ts` (new)
- `src/ui/hud/panels/bag/bagPanel.tsx` (new)
- `src/ui/hud/panels/bag/bag.css` (new)
- `src/ui/hud/panels/bag/mount.tsx` (new)
- `src/ui/hud/panels/bag/index.ts` (new)
- `src/ui/hud/panels/bag/README.md` (new)

Do **not** touch `src/ui/hud/panels/README.md` (Task-124 already wrote the `bag/`
line), `src/scenes/panels/README.md`, `src/ui/README.md`, `design/fixtures/**` (see
*Fixture decision*), `package.json`, `src/main.ts`, `vite.config.ts`,
`src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/kit/**`,
`src/scenes/panels/hud.ts`, `src/scenes/panels/party.ts`, `src/scenes/panels/pc.ts`,
`src/scenes/RouteScene.ts`, `src/data/**`.

### Fixture decision (read this before planning the work)

`03b Panels · row view` is **one sheet carrying three panels** — the bag group, the pc
group and the party group — over a route screenshot, so its `hud:diff` needs all three
panels *and* a canvas that reproduces the board's own screenshot. And **no route or
battle frame can pass `hud:diff` until the preview can draw the frame's own
background** (the harness navigates to `?hud=dom&hudFixture=<slug>` and diffs the whole
1440×1600-odd screenshot against the board's PNG). **This task therefore claims no
`design/fixtures/<slug>.json` and must not create one.** `npm run hud:diff` is **not**
a gate for this task; the gate is the DOM measurement in the Test and Validation Plan.

### Inputs (read-only)

- `AGENTS.md`, this spec.
- `design/frames/03b-panels-row-view.json` (the bag group's paint: `2:103`, `2:104`,
  `2:106`, `2:109`, `2:114`…, `2:144`) — the authority for every skin number below.
- `design/tokens.json`, `src/ui/hud/styles/root.css`, `src/ui/hud/kit/kit.css`,
  `src/data/ui/chrome.json`.
- `src/ui/hud/panels/options/**` (the pattern), `src/ui/hud/panels/README.md`.
- `src/ui/bag.ts`, `src/ui/infoPopup.ts`, `src/ui/hud/state.ts`,
  `src/ui/hud/commands.ts`, `src/ui/hud/fixtures/index.ts`, `src/ui/metrics.ts`,
  `src/data/itemIcons.ts`, `src/data/anil/item-icons.json`.
- `src/scenes/panels/bag.ts` (your file), `src/scenes/panels/types.ts`,
  `src/scenes/panels/hud.ts`, `src/scenes/panels/party.ts`, `src/scenes/RouteScene.ts`
  (the call sites you must keep safe).
- `docs/hud-fidelity.md` §2–§5, `docs/hud-dom-proposal.md` §4–§6, `D49` in
  `docs/tech-decisions.md`.

## 🔒 Contract

Two halves, frozen. Names and signatures are exact.

### A. The panel folder (`src/ui/hud/panels/bag/`) — no Phaser, no scene, no run

```ts
// view.ts
import type { HudState } from '../../state';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type BagPocket = 'equipment' | 'consumable' | 'machine' | 'ball' | 'valuable';

/** The panel's own cursor state; the scene module owns it, the panel paints it. */
export type BagPanelUi = Readonly<{ pocket: BagPocket; cursor: number; query: string }>;

/** A CSS-ready sprite cell: `background-position: -x px -y px`, `background-size: auto`. */
export type SpriteCell = Readonly<{ url: string; size: number; x: number; y: number }>;

/** Where a tile's icon comes from. The scene module builds it from the item atlas. */
export type BagIconResolver = (itemId: string) => SpriteCell | null;

export type BagTileView = Readonly<{
  index: number;
  itemId: string | null;
  name: string;
  /** `x<count>`, the string the board's `bag qty` prints. */
  count: string;
  selected: boolean;
  /** Panel-relative. */
  box: Rect;
  icon: SpriteCell | null;
}>;

export type BagPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `bagPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  tabs: readonly Readonly<{ category: BagPocket; label: string; active: boolean; box: Rect }>[];
  search: Readonly<{ value: string; placeholder: string; box: Rect }>;
  grid: Readonly<{ band: Rect; columns: number; gap: number; cell: number }>;
  tiles: readonly BagTileView[];
  footer: Readonly<{ rule: Rect; label: string; value: string; box: Rect }>;
  /** The floating description card, or null when no stack is selected. */
  info: Readonly<{ title: string; text: string; box: Rect }> | null;
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const BAG_PANEL_W = 344; // hudMetrics().panelW / HUD_PANEL_W
export const BAG_PANEL_H = 308; // bagH in src/scenes/panels/bag.ts
export const BAG_PAD_X = 20; // FRLG_WINDOW_PADDING.x / HUD_PAD_X
export const BAG_PAD_TOP = 16; // HUD_PAD_TOP
export const BAG_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const BAG_TAB_W = 55; // HUD_TAB_W
export const BAG_TAB_H = 26; // HUD_TAB_H
export const BAG_TAB_GAP = 4; // HUD_TAB_GAP
export const BAG_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const BAG_SEARCH_H = 24; // HUD_SEARCH_H
export const BAG_GRID_COLS = 5; // BAG_GRID_COLS
export const BAG_GRID_GAP = 6; // BAG_GRID_GAP
export const BAG_GRID_ROWS = 3;
export const BAG_GRID_CELL = 56; // bagGridLayout(...).cellW at 344×800
export const BAG_CAP = 15; // BAG_GRID_ROWS * BAG_GRID_COLS
export const BAG_FOOTER = 26;
export const BAG_INFO_W = 280; // HUD_BAG_INFO_W
export const BAG_INFO_GAP = 8; // HUD_BAG_INFO_GAP
export const BAG_TILE_ICON = 24; // ITEM_ICON_SIZE
export const BAG_TILE_COUNT_RIGHT = 11; // 64 − (42 + 11) in the board's tile
export const BAG_TILE_COUNT_BOTTOM = 6; // 60 − (44 + 10)

/** The shipped rect: `x = width − panelW − 8`, `y = 8 + partyHeight(406) + 8`. */
export function bagPanelBox(viewport: Viewport): Rect;
export function initialBagPanelUi(): BagPanelUi;
/** Pure: same `(state, ui, viewport, icon)` ⇒ deep-equal view. */
export function bagPanelView(
  state: HudState,
  ui: BagPanelUi,
  viewport: Viewport,
  icon: BagIconResolver,
): BagPanelView;
```

`bagPanelView` filters `state.bag` by `ui.pocket` (each `HudBagRow` carries its
`category`) and then by `ui.query` against `name`, case-insensitively and trimmed, and
slices to `BAG_CAP`. Each tile's `icon` is `icon(itemId)`; the resolver is the only way
a sprite reaches the panel, so the folder never imports `src/data/**` and a test can
pass a stub.

```ts
// bagPanel.tsx
import type { JSX } from 'preact';
import type { HudCommand } from '../../commands';
import type { BagPanelView } from './view';

export type BagPanelProps = Readonly<{
  view: BagPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;
export function BagPanel(props: BagPanelProps): JSX.Element;
```

```ts
// mount.tsx
import type { Signal } from '@preact/signals';
export function mountBagPanel(
  host: Element,
  view: Signal<BagPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void;
```

```ts
// index.ts — the barrel the scene module imports
export { BagPanel } from './bagPanel';
export type { BagPanelProps } from './bagPanel';
export { mountBagPanel } from './mount';
export {
  BAG_CAP, BAG_CONTENT_LEFT, BAG_FOOTER, BAG_GRID_CELL, BAG_GRID_COLS, BAG_GRID_GAP,
  BAG_GRID_ROWS, BAG_INFO_GAP, BAG_INFO_W, BAG_PAD_BOTTOM, BAG_PAD_TOP, BAG_PAD_X,
  BAG_PANEL_H, BAG_PANEL_W, BAG_SEARCH_H, BAG_TAB_GAP, BAG_TAB_H, BAG_TAB_W,
  BAG_TILE_COUNT_BOTTOM, BAG_TILE_COUNT_RIGHT, BAG_TILE_ICON,
  bagPanelBox, bagPanelView, initialBagPanelUi,
} from './view';
export type { BagIconResolver, BagPanelUi, BagPanelView, BagPocket, BagTileView, Rect, SpriteCell, Viewport } from './view';
```

**The shipped layout this task reproduces** (panel-relative, from the module's own
constants; `bag.ts` computes these from `host.hud()` and `partyBottom()`):

| part | rect |
| --- | --- |
| card | 344×308 at `(w − 344 − 8, 422)` when `w ≥ 360`; radius 11 |
| key chip | (0,0) 24×24 (`HUD_ICON_INSET` 0), radius 6, `#0B1017` 50 %, 1 px accent 55 %, letter `I` 11 px Bold |
| pocket tabs | 5 × (55×26) at `(30 + i × 59, 16)`, `bagCategoryLabel(category)` |
| search field | (20,50) 304×24, a real `<input>`, placeholder `t('hud.searchItems')` |
| grid band | (20,82) 304×180 |
| cells | 5 columns × 3 rows of 56×56, pitch **62** (56 + `BAG_GRID_GAP` 6) |
| icon | 24×24 centred in the cell |
| count | 9 px / 10 px, right 11 px and bottom 6 px inside the cell |
| footer | rule 1 px at (20,274); label left, value right, both at y 282 (`t('hud.money')`) |
| highlight | 1 px at (12,12) `w − 24`, `#FFFFFF` at 14 % (the board's own value; it overrides the kit's 8 % on that pseudo-element) |
| description card | 280 wide at `x = max(8, box.x − 288)`; `y = above − h` when that is ≥ 0, else `below` (the shipped `InfoPopup` rule), height `max(56, 48 + wrapped text)` |

- `view` is data only: the component reads no scene, no run, no engine, no save and no
  RNG. It imports `HudState`/`HudCommand` as **types**, the kit, `./bag.css` and
  `../../../../i18n`. **It must not import Phaser, `src/scenes/**`, `src/engine/**`
  (including `src/engine/save.ts`), `src/data/**` or write any save field** — the atlas
  URL and the sprite offsets arrive through `BagTileView.icon`.
- Every pressable control smaller than 44×44 carries the kit's `::after` hit overlay
  (`min-width: 44px; min-height: 44px`): the key chip. Cells are 56×56 (and the tab
  strip's 55×26 tabs are 55 wide × 26 high — give them the same overlay).
- DOM contract QA reads: root `[data-hud-panel="bag"]`, then
  `[data-hud-bag="chip"|"tabs"|"search"|"grid"|"footer"]`, `[data-hud-bag-tab="<pocket>"]`,
  `[data-hud-bag-tile="<index>"]`, `[data-hud-bag-icon]` and `[data-hud-bag-count]`
  inside a tile, and `[data-hud-bag-info]` for the description card. `hidden` on the
  root when `view.open === false`.
- The root is `position: absolute` inside `#hud`, `pointer-events: auto`, `box-sizing:
  border-box`; it mounts into `document.getElementById('hud')` and nowhere else.

### B. The scene module (`src/scenes/panels/bag.ts`) — the flag branch

```ts
/** The number of display objects the bag draws right now: 0 under `?hud=dom`. */
export function bagDrawnObjectCount(): number;
```

- `DOM_HUD` is read once at module load:
  `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
  (`parseHudFlags` from `../../ui/hud/fixtures`).
- **Flag off:** not one line of the shipped behaviour changes — same objects, same
  rects, same `bagDrawnObjectCount()` = the bag body container's child count (> 0).
- **Flag on:** `build(host)` creates **no** bag content but **keeps the shipped layout
  arithmetic** (it computes the same `x`, `bagY`, `bagH` it computes today) and keeps
  the panel record so the quick key, the saved layout and the collapse still work:
  - create the window with `addFrlgWindow(...)` and `.setVisible(false)`, pass an empty
    `scene.add.container(0, 0)` as the body, call `makeHudPanel(...)` with the same
    `x/y/w/h` as today, then `panel.container.setVisible(false)` and
    `panel.icon.setVisible(false)`;
  - mount the DOM panel once with `mountBagPanel(document.getElementById('hud')!, view)`;
  - `refresh(host)` rebuilds the view and assigns `view.value`; it is the only place the
    DOM is fed;
  - `close?()` disposes the mount and clears module state.
- **Open/collapsed is `panelExpanded(host, 'bag')`**, nothing else, so the quick key
  (`I`), the collapse icon path and `hudLayout.bag.collapsed` keep working unchanged.
- **The icons.** The view's `icon` resolver is built here, from the module's existing
  imports: `itemIconFrame(itemId)` → `frame`; `col = frame % cols`, `row = floor(frame
  / cols)` with `cols` from `src/data/anil/item-icons.json` (`cols: 8`), and
  `x = col * ITEM_ICON_SIZE`, `y = row * ITEM_ICON_SIZE`, `url = ITEM_ICON_ATLAS_URL`.
  `ITEM_ICON_ATLAS_URL` falls back to the committed placeholder, so a clean clone draws.
- The bag slice of the view comes from
  `projectHud({ screen: 'route', run: host.run(), notice: null }).bag` (+ `money`), so
  the HUD never reads the run's shape twice. **No RNG, no save field, no engine rule
  change, no new run field, no `SAVE_VERSION` step.**
- Flag-on, these exported helpers must stay safe (the scene calls them on every
  press/drag and none may throw when no layout was computed): `hudBagCellAt` → `null`,
  `hudDraggableStackAt` → `null`, `bagDebugState` → `null`, `bagTextFieldFocused()` →
  true while the native search input has focus, `typeInBagSearch` → `true` and no query
  edit while it does (the input owns the text; mirror it with an `input` listener into
  `ui.query`). `hudBagStacks(host)` keeps its current behaviour. `pointerInBagPanel` and
  the other geometry helpers keep their current semantics.
- The DOM component answers `onCommand` with `{ type: 'panel', panel: 'bag' }` from the
  key chip (the module resolves it with `toggleHudPanel(host, 'bag')`); tab, cell and
  search presses are the module's own `ui` state, pushed through `view.value`. The
  module never mutates the run from the DOM.

## 🧩 Data and configuration

No new data table, no `src/data/**` write, no balancing value. The constants this task
introduces are the mirror block in `view.ts` above (each one named after the Phaser
constant it copies) plus the board's skin values in `bag.css` (the 14 % highlight, the
chip's `#0B1017` at 50 % and its accent 55 % stroke, the tile's radius 8 / 4 % / 8 %,
the 24 px icon and the 9 px count). Do not edit `kit.css`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `view.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-129` must list only the eight exclusive paths.
  - The `[live]` criteria need a browser: on this host set
    `CHROME_PATH=/tmp/opencode/chrome-nosandbox` (a wrapper adding
    `--no-sandbox --remote-debugging-address=127.0.0.1`) and serve the game with
    `npm run dev -- --port 5199 --strictPort` (the checks import `/src/main.ts`, so the
    dev server, not the preview, is required). Drive it over CDP exactly as
    `scripts/hud/diff.mjs` does.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`.
  - [ ] `[unit]` `npm test` is green and `src/ui/hud/panels/bag/view.test.ts` asserts:
        `bagPanelBox({ width: 1280, height: 800 })` = `{ x: 928, y: 422, w: 344, h: 308 }`
        and `bagPanelBox({ width: 390, height: 844 })` = `{ x: 38, y: 422, w: 344, h: 308 }`;
        for a two-stack fixture and a stub resolver
        (`() => ({ url: 'atlas.png', size: 24, x: 24, y: 0 })`) the highlight
        `{ x: 12, y: 12, w: 320, h: 1 }`, the chip `{ x: 0, y: 0, w: 24, h: 24 }`, the
        search `{ x: 20, y: 50, w: 304, h: 24 }`, the tab strip's five boxes at
        `x = 30 + i × 59`, the grid band `{ x: 20, y: 82, w: 304, h: 180 }`, cell 0 at
        `{ x: 20, y: 82, w: 56, h: 56 }` and cell 1 at `{ x: 82, y: 82, w: 56, h: 56 }`,
        the footer rule at `y = 274`, tile 0's `icon` equal to the resolver's value; that
        the pocket and the query narrow the row and the slice stops at `BAG_CAP = 15`;
        that the mirrored constants equal their literals (`BAG_TAB_W 55`,
        `BAG_GRID_COLS 5`, `BAG_GRID_GAP 6`, `BAG_GRID_CELL 56`, `BAG_SEARCH_H 24`,
        `BAG_INFO_W 280`).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The same box as the Phaser panel it replaces.** Two runs of the same
        steps with `?hud=dom` off and on: with it **off** read
        `(() => { const p = (await import('/src/main.ts')).game.scene.getScene('Route').panelHost.panels().find(x => x.id === 'bag'); return { x: p.x + p.dx, y: p.y + p.dy, w: p.w, h: p.h }; })()`
        (TS `private` is erased; `panelHost` and `panels()` are the runtime names); with
        it **on** read `document.querySelector('[data-hud-panel="bag"]').getBoundingClientRect()`
        (x, y, width, height). The two agree within ±2 px on all four numbers, at
        1280×800 and at 390×844 (press `I` first in both, so the panel is expanded).
  - [ ] `[live]` **The same internals.** With the panel open, the five tab boxes are
        55×26 at `x = panelX + 30 + i × 59` and `y = panelY + 16`; the search field is
        304×24 at `+20,+50`; the cells are 56×56 at a 62 px pitch (`BAG_GRID_COLS 5`,
        `BAG_GRID_GAP 6` — the values `src/ui/bag.ts` exports), and the number of cells
        the model yields is drawn (`min(15, filtered length)` for the live run);
        `[data-hud-bag-info]`, when a stack is selected, is 280 wide at
        `x = max(8, panelX − 288)`.
  - [ ] `[live]` **The skin.** `getComputedStyle` on the root reports
        `border-top-left-radius: 11px`, `border-top-width: 1px`,
        `border-top-color: rgba(255, 255, 255, 0.16)`; the tile 0 reports
        `border-top-left-radius: 8px` and is 56×56; its `[data-hud-bag-icon]` is 24×24,
        `getComputedStyle(icon).backgroundImage` contains `item-icons`, and
        `backgroundPosition` is `-<col·24>px -<row·24>px` for the stack's atlas frame
        (`itemIconFrame(id)` with `cols = 8` from `src/data/anil/item-icons.json`);
        `[data-hud-bag-count]` sits 11 ±2 px from the tile's right edge and 6 ±2 px from
        its bottom edge at 9 px type; the key chip is 24×24 with a `::after` of
        `min-width: 44px; min-height: 44px`.
  - [ ] `[live]` **No overflow.** `document.documentElement.scrollWidth <= window.innerWidth`
        at 1280×800 and at 390×844.
  - [ ] `[live]` **The flag contract.** `?hud=dom` **off**:
        `(await import('/src/scenes/panels/bag.ts')).bagDrawnObjectCount() > 0` and
        `document.querySelector('[data-hud-panel="bag"]') === null`. **On**:
        `bagDrawnObjectCount() === 0`, the node exists, and
        `…panelHost.panels().find(p => p.id === 'bag').container.visible === false`.
  - [ ] `[live]` **The toggle still works.** `I` collapses the panel (the root becomes
        `hidden`, `getBoundingClientRect().width === 0`) and a second `I` brings it back
        at the same rect; the rest of the route still walks (one arrow press moves the
        player's tile).
- **Live recipe:**
  1. `CHROME_PATH=/tmp/opencode/chrome-nosandbox npm run dev -- --port 5199 --strictPort`
  2. Launch that Chrome headless with `--remote-debugging-port=9222`, attach to the page
     target, `Page.enable`, `Emulation.setDeviceMetricsOverride` with
     `{ width, height, deviceScaleFactor: 2, mobile: width < 600 }`.
  3. `Page.navigate` to `http://127.0.0.1:5199/?hud=dom`; wait for the load event.
  4. Poll `(await import('/src/main.ts')).game.scene.isActive('MainMenu')` every 200 ms
     (up to 20 s), dispatch `Enter` (`key: 'Enter', code: 'Enter', windowsVirtualKeyCode:
     13`) twice with 600 ms between (new run → starter → first card), then poll
     `game.scene.isActive('Route')`.
  5. Dispatch `i` (`key: 'i', code: 'KeyI', windowsVirtualKeyCode: 73`), wait 400 ms.
  6. `Runtime.evaluate` with `awaitPromise: true` and an async IIFE returning the JSON
     of the expressions above.
  7. Repeat with `?` removed (flag off) and with
     `{ width: 390, height: 844, mobile: true }`.

## 📣 Coordination

- **For the Orchestrator's report:** no route or battle frame can pass `hud:diff` until
  the preview can draw the frame's own background, which is why this task (and 130, 131,
  140) is gated by DOM measurement instead. The batch's paragraph in `TODO.md` already
  records it.
- **For the next batch:** the flag branch shape (the shipped layout arithmetic kept, the
  record kept but invisible with an empty body, the DOM panel following
  `panelExpanded`) is the pattern Tasks 130, 131 and the later route panels copy;
  `bagDrawnObjectCount()` is its flag-contract probe. The mirror-constant block in
  `view.ts` is how a migrated panel proves it did not drift from the Phaser layout.
- `src/scenes/panels/party.ts`'s `partyBottom()` (406 px) is what makes the bag's `y`
  422; Task-131 is pinned not to change it. `hud.ts` and `RouteScene.ts` are never
  edited here, so no signature there may move.
- No fixture, no `hud:diff` gate, no `docs/` change, no `src/data/` change.

## ⛔ Out of scope

- The board's 304×130 card, its 64×60-at-72 tile row, its view toggle and its scroll
  track (see *Board vs shipped screen* for the arithmetic on each).
- `design/fixtures/**`, any `hud:diff` pass, any change to `scripts/hud/**` or
  `design/**`.
- Dragging the DOM panel: the shipped rect wins and `hudLayout.bag.dx/dy` are ignored
  under the flag (`collapsed` is honoured). The chips and the pad are Task-139.
- Dragging a stack out of the DOM grid (the shipped drag path needs Phaser objects);
  under the flag a cell press selects, and the run is only changed by the keys.
- Any change to `src/ui/bag.ts`, `src/ui/infoPopup.ts`, `src/ui/hud/state.ts`,
  `src/ui/hud/commands.ts`, `src/scenes/panels/hud.ts`, `src/scenes/RouteScene.ts`,
  the engine, the RNG or the save.

## 🔁 Corrective round 1 — the DOM card must not float over a battle (Orchestrator)

This task's own plan was green on its integration tree. The **batch** integration pass found one
objective failure that none of the task's own criteria covered, measured on the combined tree
(`4c4fd288a45ac523ecaf8cba3b88461979f301fa`) over CDP at 1280×800 with `?hud=dom` on Chrome 155
headless:

- On the route the DOM card draws correctly; but when a wild battle starts
  (`RouteScene.startBattle` → `this.scene.pause()`), the route's DOM roots stay on screen **above**
  the battle: `[data-hud-panel="bag"|"pc"|"party"]` keep `display: block`, `hidden: false` and their
  route rects, and each is the topmost node at its own centre (`document.elementFromPoint`). The
  party card (open by default, `928,8 250×406`) covers the battle field for the whole fight: hiding
  its root changes **29.8 %** (30 231 / 101 500) of the pixels of its rect, while a control region
  changes **0 %**.
- The canvas build does not do this: hiding `scene.hudRoot` during a battle changes **0** of
  **105 952** pixels of that rect, because the Battle scene draws over the paused route scene. `#hud`
  is a DOM layer **above** the canvas, so it needs the rule spelled out.
- Cause: a DOM mount is torn down on **SHUTDOWN** only, and `RouteScene` **pauses** itself for a
  battle (`this.scene.pause(); this.scene.launch('Battle', …)`) while `BattleScene` later runs
  `this.scene.resume('Route'); this.scene.stop();`. The Settings scene takes the same pause path.

### Required behaviour (parity with the Phaser card)

- While the `Route` scene is paused — a battle, or the Settings scene — this panel's DOM root is
  **not visible**: `hidden` set and `getBoundingClientRect().width === 0`.
- On `resume` it is visible again at **exactly** the rect it had, with the open/collapsed state it
  had, and its own key behaves as before.
- Its own key pressed while the route is paused neither toggles nor queues a toggle.
- The flag-off path does not move: not one line of the shipped Phaser drawing changes, and neither
  does the Phaser-side layout arithmetic.

### Where the fix goes

Only this task's exclusive paths. It belongs in the scene module you already own
(`src/scenes/panels/bag.ts.ts`), next to `panelExpanded(host, …)` and its mount: the module has
`host.scene` (`RoutePanelHost.scene`), so it can subscribe to the scene's own
`Phaser.Scenes.Events.PAUSE` / `RESUME` events and drop the subscription in `close?()`. Do **not**
touch `src/ui/hud/mount.ts`, `src/ui/hud/shell.ts`, `src/scenes/RouteScene.ts`,
`src/scenes/BattleScene.ts`, `src/main.ts` or a batch-mate's file. A hidden root is
`view.open === false` — the behaviour the collapse already implements — so the mount stays and only
the view changes.

### Extra acceptance criterion (must be measured, not eyeballed)

- [ ] `[live]` **Hidden over the battle, back on resume.** At 1280×800 with `?hud=dom`: on the route
      with the panel open (press `I`), record its rect **R** and `hidden === false`. Call
      `startDebugWildBattle('pidgey', 5)` on the **live** `RouteScene` module (the URL taken from
      `performance.getEntriesByType('resource')`; a fresh `import('/src/scenes/RouteScene.ts')` is a
      different module instance) and after 500 ms assert `hidden === true`,
      `getBoundingClientRect().width === 0`, and that the root is **not** the topmost node at R's
      centre (`document.elementFromPoint` neither is it nor sits inside it). Then stop the fight the
      way `BattleScene` does (`game.scene.getScene('Battle').scene.stop()` +
      `game.scene.getScene('Route').scene.resume()`) and assert the root is visible again at exactly
      R with the same open state. Repeat once with the panel collapsed: hidden over the battle and
      still `hidden === true` after the resume.
- [ ] `[unit]` the task's original plan stays green (`npm test`, `npm run build`) and the diff still
      lists only this task's exclusive paths (plus `.agent_specs/task-129.md`).

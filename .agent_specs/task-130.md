# Spec: Task-130 — The PC panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene module + Preact panel (`D49`, Phase 12).
- **Role:** Dev.
- **Objective:** The box window leaves Phaser as a **pure move plus a skin**. With
  `?hud=dom` on, the route's PC is a Preact panel in the `#hud` layer that draws the
  **same card the Phaser module draws today** — the same rect, the same page-tab strip,
  the same RIP tab with its lock veil, the same 4 × 4 grid of avatar cells over the
  same `PartyUiState` pane and page, the same selected/locked/held marks, the same
  withdraw rule — while `src/scenes/panels/pc.ts` draws no Phaser object at all. The
  card's paint comes from the prototype board (`design/frames/03b-panels-row-view.json`):
  radius 11, the 1 px hairline, the 1 px highlight 12 px inside its top edge, the 24×24
  accent-edged key chip, the board's type scale and line boxes, and the board's slot
  paint (radius 8, 4 % fill, 8 % stroke). With the flag off every line of the shipped
  Phaser box draws exactly as it draws today.
- **Environment:** worktree `../wt-pkm-130`, branch `task-130`.
- **Dependencies:** all merged, nothing produced by a batch-mate:
  - `Task-127` (the spike) — `src/ui/hud/panels/options/**` is the pattern this task
    copies, and `src/scenes/SettingsScene.ts` shows the scene-side `DOM_HUD` branch.
  - `Task-128` — `src/scenes/panels/pc.ts` exists and is the only writer of the box.
  - `Task-124` — `src/ui/hud/mount.ts`, `styles/root.css`, the Silkscreen faces.
  - `Task-125` — `src/ui/hud/kit/**`.
  - `Task-126` — `src/ui/hud/fixtures/**` (`parseHudFlags`).
  - Read but never changed: `src/ui/partyScreen.ts` (`boxRows`, `ripRows`, `PartyRow`,
    `PartyUiState`, `pcMemberEditable`, `BOX_COLS`, `BOX_ROWS`, `BOX_PAGE_SIZE`,
    `boxPageCount`, `boxCellIndex`, `boxPageForIndex`), `src/ui/hud/state.ts`,
    `src/ui/hud/commands.ts`, `src/scenes/panels/hud.ts` (`HUD_*`, `hudMetrics`,
    `panelExpanded`, `toggleHudPanel`), `src/engine/run` (`withdrawToParty`),
    `src/data/ui/chrome.json`.

### Board vs shipped screen (read this before planning the work)

`03b Panels · row view` is a **compact variant** of the same screen, not the screen: its
pc group is one 304×112 card holding a single-row strip. The DOM panel draws the
**shipped** screen inside the **shipped** box, and takes the board's *paint* only. What
is deliberately **not** adopted, each with its arithmetic:

1. **The 304×112 card.** The shipped box is 344×378: `hudMetrics(w).panelW` is
   `min(HUD_PANEL_W = 344, w − 16)` and its height is
   `HUD_BOX_TABS_H 50 + HUD_BOX_GRID_H (4 × 76 + 3 × 4 = 316) + HUD_BOX_PAD 12 = 378`
   (`src/scenes/panels/pc.ts`). The frame's card is the row-view variant of the same
   storage grid.
2. **The 42×42 slot at pitch 47, one row.** The shipped grid is 4 × 4 cells of
   `HUD_BOX_CELL = 76` with a 4 px gap (`BOX_COLS`/`BOX_ROWS`/`BOX_PAGE_SIZE = 16` over
   up to `HUD_BOX_MAX_PAGES = 7` pages). A single 42 px row cannot show a page, so
   adopting it deletes paging — the screen's primary control. The DOM keeps the shipped
   cell and takes the slot's **paint** (radius 8, the 4 %/8 % pair) from the frame.
3. **The board's `pc search field` and `pc view toggle`.** The shipped PC has **no**
   filter field at all (`pc.ts` builds none and `RouteScene` routes no typing to it), so
   there is nothing to make native; and the shipped header is already full — seven page
   tabs (`7 × HUD_BOX_TAB_W 32 + 6 × HUD_BOX_TAB_GAP 4 = 248 px` from `x = 30`) plus the
   32 px RIP tab at `x = 292` fill the 304 px inner width, leaving no room for either
   control. Adding them would displace the page tabs and the RIP tab.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/pc.ts` (modify)
- `src/ui/hud/panels/pc/view.ts` (new)
- `src/ui/hud/panels/pc/view.test.ts` (new)
- `src/ui/hud/panels/pc/pcPanel.tsx` (new)
- `src/ui/hud/panels/pc/pc.css` (new)
- `src/ui/hud/panels/pc/mount.tsx` (new)
- `src/ui/hud/panels/pc/index.ts` (new)
- `src/ui/hud/panels/pc/README.md` (new)

Do **not** touch `src/ui/hud/panels/README.md` (Task-124 already wrote the `pc/` line),
`src/scenes/panels/README.md`, `src/ui/README.md`, `design/fixtures/**` (see *Fixture
decision*), `package.json`, `src/main.ts`, `vite.config.ts`, `src/ui/hud/state.ts`,
`src/ui/hud/commands.ts`, `src/ui/hud/kit/**`, `src/scenes/panels/hud.ts`,
`src/scenes/panels/party.ts`, `src/scenes/panels/bag.ts`, `src/scenes/RouteScene.ts`,
`src/data/**`.

### Fixture decision (read this before planning the work)

`03b Panels · row view` is **one sheet carrying three panels** (bag, pc, party) over a
route screenshot, and `03p Panels · pc rip` has the route's grass behind it (measured:
`--slug 03p-panels-pc-rip` fails at 90 % of pixels, flat ΔE 67, and a fresh boot cannot
reproduce that canvas). And **no route or battle frame can pass `hud:diff` until the
preview can draw the frame's own background** — the harness diffs the whole screenshot.
**This task therefore claims no `design/fixtures/<slug>.json` and must not create one.**
`npm run hud:diff` is **not** a gate for this task; the gate is the DOM measurement in
the Test and Validation Plan.

### Inputs (read-only)

- `AGENTS.md`, this spec.
- `design/frames/03b-panels-row-view.json` (the pc group's paint: `2:382`, `2:383`,
  `2:384`, `2:396`, `2:397`…), `design/tokens.json`, `src/ui/hud/styles/root.css`,
  `src/ui/hud/kit/kit.css`, `src/data/ui/chrome.json`.
- `src/ui/hud/panels/options/**` (the pattern), `src/ui/hud/panels/README.md`.
- `src/ui/partyScreen.ts`, `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`,
  `src/ui/hud/fixtures/index.ts`, `src/ui/metrics.ts`.
- `src/scenes/panels/pc.ts` (your file), `src/scenes/panels/types.ts`,
  `src/scenes/panels/hud.ts`, `src/scenes/RouteScene.ts` (the call sites you must keep
  safe).
- `docs/hud-fidelity.md` §2–§5, `docs/hud-dom-proposal.md` §4–§6, `D49` in
  `docs/tech-decisions.md`.

## 🔒 Contract

Two halves, frozen. Names and signatures are exact.

### A. The panel folder (`src/ui/hud/panels/pc/`) — no Phaser, no scene, no run

```ts
// view.ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type PcPane = 'box' | 'rip';

/** The panel's own state. The scene module keeps it in step with `PartyUiState`. */
export type PcPanelUi = Readonly<{ pane: PcPane; page: number; cursor: number }>;

/** One grid cell, as the shipped panel paints it. */
export type PcCellView = Readonly<{
  index: number;
  memberId: string | null;
  name: string;
  level: number;
  hpText: string;
  hpFraction: number;
  statusLabel: string | null;
  selected: boolean;
  /** The shipped dimming: a box member the run's rules will not let you move. */
  locked: boolean;
  /** Panel-relative. */
  box: Rect;
}>;

export type PcPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `pcPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  /** The visible page tabs, in page order: `label` is the printed page number. */
  tabs: readonly Readonly<{ page: number; label: string; active: boolean; box: Rect }>[];
  /** The RIP tab and whether its list is the one on screen (the shipped lock veil). */
  rip: Readonly<{ active: boolean; locked: boolean; box: Rect }>;
  grid: Readonly<{ band: Rect; columns: number; rows: number; gap: number; cell: number }>;
  cells: readonly PcCellView[];
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const PC_PANEL_W = 344; // HUD_PANEL_W / hudMetrics().panelW
export const PC_PANEL_H = 378; // HUD_BOX_H in src/scenes/panels/pc.ts
export const PC_PAD = 12; // HUD_BOX_PAD
export const PC_PAD_X = 20; // HUD_PAD_X, used for the key chip and the RIP tab
export const PC_PAD_TOP = 16; // HUD_PAD_TOP
export const PC_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const PC_TAB_W = 32; // HUD_BOX_TAB_W
export const PC_TAB_H = 26; // HUD_TAB_H
export const PC_TAB_GAP = 4; // HUD_BOX_TAB_GAP
export const PC_TABS_H = 50; // HUD_BOX_TABS_H
export const PC_RIP_TAB_W = 32; // HUD_BOX_RIP_TAB_W
export const PC_MAX_PAGES = 7; // HUD_BOX_MAX_PAGES
export const PC_CELL = 76; // HUD_BOX_CELL
export const PC_CELL_GAP = 4; // HUD_BOX_CELL_GAP
export const PC_COLUMNS = 4; // BOX_COLS
export const PC_ROWS = 4; // BOX_ROWS
export const PC_PAGE_SIZE = 16; // BOX_PAGE_SIZE

/** The shipped rect: `x = max(8, width − 344 − 8 − 344 − 8)`, `y = 8 + 64`. */
export function pcPanelBox(viewport: Viewport): Rect;
export function initialPcPanelUi(): PcPanelUi;
/** Pure: same `(rows, ui, pageCount, viewport)` ⇒ deep-equal view. */
export function pcPanelView(
  rows: readonly PcRow[],
  ui: PcPanelUi,
  pageCount: number,
  viewport: Viewport,
): PcPanelView;
```

```ts
export type PcRow = Readonly<{
  memberId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  statusLabel: string | null;
  locked: boolean;
}>;
```

`pcPanelView` slices the page (`page × PC_PAGE_SIZE` … `+ PC_PAGE_SIZE`) and draws all
`PC_PAGE_SIZE` cells of it, empty ones included — the shipped grid always lays out 16
cells. `selected` comes from `ui.cursor`, and `min(PC_MAX_PAGES, max(1, pageCount))` page
tabs are drawn. No filter: the shipped PC has none (see *Board vs shipped screen*).

```ts
// pcPanel.tsx
import type { JSX } from 'preact';
import type { HudCommand } from '../../commands';
import type { PcPanelView } from './view';

export type PcPanelProps = Readonly<{
  view: PcPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;
export function PcPanel(props: PcPanelProps): JSX.Element;
```

```ts
// mount.tsx
import type { Signal } from '@preact/signals';
export function mountPcPanel(
  host: Element,
  view: Signal<PcPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void;
```

```ts
// index.ts — the barrel the scene module imports
export { PcPanel } from './pcPanel';
export type { PcPanelProps } from './pcPanel';
export { mountPcPanel } from './mount';
export {
  PC_CELL, PC_CELL_GAP, PC_COLUMNS, PC_CONTENT_LEFT, PC_MAX_PAGES, PC_PAD,
  PC_PAD_TOP, PC_PAD_X, PC_PAGE_SIZE, PC_PANEL_H, PC_PANEL_W, PC_RIP_TAB_W,
  PC_ROWS, PC_TAB_GAP, PC_TAB_H, PC_TAB_W, PC_TABS_H,
  initialPcPanelUi, pcPanelBox, pcPanelView,
} from './view';
export type { PcCellView, PcPane, PcPanelUi, PcPanelView, PcRow, Rect, Viewport } from './view';
```

**The shipped layout this task reproduces** (panel-relative, from the module's own
constants; `pc.ts` computes these from `host.hud()`):

| part | rect |
| --- | --- |
| card | 344×378 at `max(8, w − 344 − 16)` / `y = 72`; radius 11 |
| key chip | (0,0) 24×24 (`HUD_ICON_INSET` 0), radius 6, `#0B1017` 50 %, 1 px accent 55 %, letter `O` 11 px Bold |
| page tabs | up to 7 × (32×26) at `(30 + page × 36, 16)`, label `String(page + 1)` |
| RIP tab | (292,16) 32×26, label `RIP`, with the shipped lock veil (`#10161F` at 55 %) |
| grid band | (14,50) 316×316 |
| cells | 4 columns × 4 rows of 76×76, pitch **80** (76 + `PC_CELL_GAP` 4) |
| highlight | 1 px at (12,12) `w − 24`, `#FFFFFF` at 8 % (the kit's value) |

- `view` is data only: the component reads no scene, no run, no engine, no save and no
  RNG. It imports `HudCommand` as a **type**, the kit, `./pc.css` and
  `../../../../i18n`. **It must not import Phaser, `src/scenes/**`, `src/engine/**`
  (including `src/engine/save.ts`), `src/data/**` or write any save field.**
- Every pressable control smaller than 44×44 carries the kit's `::after` hit overlay
  (`min-width: 44px; min-height: 44px`): the key chip, the page tabs and the RIP tab.
  Cells are 76×76 and need none.
- DOM contract QA reads: root `[data-hud-panel="pc"]`, then
  `[data-hud-pc="chip"|"tabs"|"rip"|"grid"]`, `[data-hud-pc-tab="<page>"]`,
  `[data-hud-pc-cell="<index>"]`. `hidden` on the root when `view.open === false`, and
  `data-pane="box"|"rip"` on the root so QA can read which list is on screen.
- The root is `position: absolute` inside `#hud`, `pointer-events: auto`, `box-sizing:
  border-box`; it mounts into `document.getElementById('hud')`.

### B. The scene module (`src/scenes/panels/pc.ts`) — the flag branch

```ts
/** The number of display objects the PC draws right now: 0 under `?hud=dom`. */
export function pcDrawnObjectCount(): number;
```

- `DOM_HUD` is read once at module load:
  `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
  (`parseHudFlags` from `../../ui/hud/fixtures`).
- **Flag off:** not one line of the shipped behaviour changes — same objects, same
  rects, `pcDrawnObjectCount()` = the box body container's child count (> 0), and
  `boxLeft()`, `boxTop()`, `hudBoxCellAt`, `boxHeldBadge`, `stepBoxPage`,
  `pointerInBoxPanel` keep their exact current semantics and values.
- **Flag on:** `build(host)` creates **no** box content but **keeps the shipped layout
  arithmetic** (the same `boxX`, `boxY`, `panelW`, `HUD_BOX_H` it computes today) and
  keeps the panel record so the quick key, the saved layout and the collapse still work:
  - create the window with `addFrlgWindow(...)` and `.setVisible(false)`, pass an empty
    `scene.add.container(0, 0)` as the body, call `makeHudPanel(...)` with the same
    `x/y/w/h` as today, then `panel.container.setVisible(false)` and
    `panel.icon.setVisible(false)`;
  - mount the DOM panel once with `mountPcPanel(document.getElementById('hud')!, view)`;
  - `refresh(host)` rebuilds the view and assigns `view.value`; it is the only place the
    DOM is fed;
  - `close?()` disposes the mount and clears module state.
- **Open/collapsed is `panelExpanded(host, 'box')`**, nothing else, so the quick key
  (`O`), the collapse icon path and `hudLayout.box.collapsed` keep working unchanged.
- **The same state, not a copy.** The DOM panel's pane *is* `host.ui().pane`
  (`'box'`/`'rip'`): the RIP tab press mirrors the shipped `setHudBoxPane(host, host.ui().pane === 'rip' ? 'box' : 'rip')`,
  and `ui.page` follows the module's `hudBoxPage` through `boxPageForIndex(host.ui().index)`
  so the keyboard cursor and the DOM page never disagree. Rows come from
  `boxRows(host.run())` / `ripRows(host.run())` mapped to `PcRow`, with
  `locked: pane === 'box' && !pcMemberEditable(run, row.id)` (the shipped dimming).
- **Withdraw, one press:** a box cell press answers `{ type: 'member', memberId }`; the
  module resolves it through the shipped rule — when `pcMemberEditable(run, memberId)`
  and `withdrawToParty(run, boxIndex)` returns a new run, `host.commitRun(next)`;
  otherwise nothing. A press also moves the cursor (`ui.cursor`) to that cell. The
  component never touches the run. The key chip answers
  `{ type: 'panel', panel: 'box' }`; the module resolves it with
  `toggleHudPanel(host, 'box')`.
- Flag-on, `hudBoxCellAt` → `null`, `boxHeldBadge` → `undefined` and `stepBoxPage` →
  no-op (no layout was computed and the DOM drives the page from its own tabs and a
  `wheel` listener on the grid). `pointerInBoxPanel` → `false`. **No RNG, no save
  field, no engine rule change, no new run field, no `SAVE_VERSION` step.**

## 🧩 Data and configuration

No new data table, no `src/data/**` write, no balancing value. The constants this task
introduces are the mirror block in `view.ts` above (each named after the Phaser
constant it copies) plus the board's skin values in `pc.css` (the 8 % highlight, the
chip's `#0B1017` at 50 % and its accent 55 % stroke, the slot's radius 8 / 4 % / 8 %).
Do not edit `kit.css`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `view.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-130` must list only the eight exclusive paths.
  - The `[live]` criteria need a browser: on this host set
    `CHROME_PATH=/tmp/opencode/chrome-nosandbox` (a wrapper adding
    `--no-sandbox --remote-debugging-address=127.0.0.1`) and serve the game with
    `npm run dev -- --port 5199 --strictPort` (the checks import `/src/main.ts`). Drive
    it over CDP exactly as `scripts/hud/diff.mjs` does.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`.
  - [ ] `[unit]` `npm test` is green and `src/ui/hud/panels/pc/view.test.ts` asserts:
        `pcPanelBox({ width: 1280, height: 800 })` = `{ x: 576, y: 72, w: 344, h: 378 }`
        and `pcPanelBox({ width: 390, height: 844 })` = `{ x: 8, y: 72, w: 344, h: 378 }`;
        with 18 rows and `pageCount = boxPageCount(18) = 2`, page 0 draws 16 cells at
        pitch 80 from `{ x: 14, y: 50, w: 76, h: 76 }` (all filled), page 1 draws 16
        cells of which 2 carry a member and 14 are empty, the visible tabs are 2 at
        `x = 30` and `x = 66`, the RIP tab is `{ x: 292, y: 16, w: 32, h: 26 }`, the
        highlight is `{ x: 12, y: 12, w: 320, h: 1 }` and the chip
        `{ x: 0, y: 0, w: 24, h: 24 }`; that `locked` cells carry the flag and RIP cells
        never do; that the mirrored constants equal their literals (`PC_CELL 76`,
        `PC_CELL_GAP 4`, `PC_TAB_W 32`, `PC_MAX_PAGES 7`, `PC_PAGE_SIZE 16`,
        `PC_PANEL_H 378`).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The same box as the Phaser panel it replaces.** With `?hud=dom`
        **off** read
        `(() => { const p = (await import('/src/main.ts')).game.scene.getScene('Route').panelHost.panels().find(x => x.id === 'pc'); return { x: p.x + p.dx, y: p.y + p.dy, w: p.w, h: p.h }; })()`;
        with it **on** read
        `document.querySelector('[data-hud-panel="pc"]').getBoundingClientRect()`.
        The two agree within ±2 px on x, y, width and height at 1280×800 and at
        390×844 (press `O` first in both).
  - [ ] `[live]` **The same internals.** With the panel open: the page tabs are 32×26
        at `x = panelX + 30 + page × 36`, `y = panelY + 16`; the RIP tab is 32×26 at
        `+292,+16`; the cells are 76×76 at an 80 px pitch (`HUD_BOX_CELL 76`,
        `HUD_BOX_CELL_GAP 4`) in 4 columns and 4 rows; the number of page tabs equals
        `boxPageCount(run.box.length)` and the number of cells filled equals the page's
        slice of `run.box`.
  - [ ] `[live]` **The skin.** `getComputedStyle` on the root reports
        `border-top-left-radius: 11px`, `border-top-width: 1px`,
        `border-top-color: rgba(255, 255, 255, 0.16)`; cell 0 reports
        `border-top-left-radius: 8px`; the key chip is 24×24 with a `::after` of
        `min-width: 44px; min-height: 44px`, and so does each page tab.
  - [ ] `[live]` **No overflow.** `document.documentElement.scrollWidth <= window.innerWidth`
        at 1280×800 and at 390×844.
  - [ ] `[live]` **The flag contract.** `?hud=dom` **off**:
        `(await import('/src/scenes/panels/pc.ts')).pcDrawnObjectCount() > 0` and
        `document.querySelector('[data-hud-panel="pc"]') === null`. **On**:
        `pcDrawnObjectCount() === 0`, the node exists, and
        `…panelHost.panels().find(p => p.id === 'pc').container.visible === false`.
  - [ ] `[live]` **The toggle and the panes.** `O` collapses the panel (the root becomes
        `hidden`, `getBoundingClientRect().width === 0`) and a second `O` brings it back
        at the same rect; pressing `[data-hud-pc="rip"]` sets `data-pane="rip"` on the
        root and leaves `game.scene.getScene('Route').hudUi.pane === 'rip'` (the shipped
        state, not a copy), and pressing it again returns to `box`; with a fresh run the
        box is empty and the grid draws its 16 empty cells at the same rects.
- **Live recipe:**
  1. `CHROME_PATH=/tmp/opencode/chrome-nosandbox npm run dev -- --port 5199 --strictPort`
  2. Launch that Chrome headless with `--remote-debugging-port=9222`, attach to the page
     target, `Page.enable`, `Emulation.setDeviceMetricsOverride` with
     `{ width, height, deviceScaleFactor: 2, mobile: width < 600 }`.
  3. `Page.navigate` to `http://127.0.0.1:5199/?hud=dom`; wait for the load event.
  4. Poll `(await import('/src/main.ts')).game.scene.isActive('MainMenu')` every 200 ms
     (up to 20 s), dispatch `Enter` twice with 600 ms between, then poll
     `game.scene.isActive('Route')`.
  5. Dispatch `o` (`key: 'o', code: 'KeyO', windowsVirtualKeyCode: 79`), wait 400 ms.
  6. `Runtime.evaluate` with `awaitPromise: true` and an async IIFE returning the JSON
     of the expressions above; presses go through `Input.dispatchMouseEvent`
     (`mousePressed`/`mouseReleased` at the element's centre).
  7. Repeat with `?` removed (flag off) and with
     `{ width: 390, height: 844, mobile: true }`.

## 📣 Coordination

- **For the Orchestrator's report:** no route or battle frame can pass `hud:diff` until
  the preview can draw the frame's own background, which is why this task (and 129, 131,
  140) is gated by DOM measurement instead.
- **For the Orchestrator / the human — one reading to confirm:** the backlog says "the
  release and withdraw commands through `HudCommand`". The shipped PC has exactly one
  run-changing action — moving a member out of the box (`withdrawToParty`, gated by
  `pcMemberEditable`) — and **no release rule exists anywhere** (the death release is
  the route's own beat, `src/ui/permadeath.ts` + `releaseRoot`). The DOM panel therefore
  withdraws on a cell press and renders the RIP pane read-only, exactly as the Phaser
  panel does. A release *control* would be a new rule and belongs to its own task.
- **For the next batch:** the flag branch shape (shipped layout arithmetic kept, the
  record kept but invisible with an empty body, the DOM panel following
  `panelExpanded`) is the pattern Tasks 129/131 and the later route panels copy;
  `pcDrawnObjectCount()` is its flag-contract probe, and the mirror-constant block in
  `view.ts` is how a migrated panel proves it did not drift.
- `src/scenes/panels/party.ts`'s exported helpers are read by this module's flag-off
  path; Task-131 is pinned not to change their values. `hud.ts` and `RouteScene.ts` are
  never edited here.
- No fixture, no `hud:diff` gate, no `docs/` change, no `src/data/` change.

## ⛔ Out of scope

- The board's 304×112 card, its single-row 42×42-at-47 strip, its search field and its
  view toggle (see *Board vs shipped screen* for the arithmetic on each).
- Member portraits inside the cells: a cell draws the member's name, level, HP text and
  status mark. The portrait atlas is a `public/anil/` URL that `.gitignore` keeps out of
  the repo (`.gitignore:33`), so a CSS sprite from it would 404 in a clean clone; the
  item atlas has a committed placeholder and is used in 129 only.
- `design/fixtures/**`, any `hud:diff` pass, any change to `scripts/hud/**` or
  `design/**`.
- Dragging the DOM panel: the shipped rect wins and `hudLayout.box.dx/dy` are ignored
  under the flag (`collapsed` is honoured). The chips and the pad are Task-139.
- Dragging a member between panes (the shipped drag path needs Phaser objects); under
  the flag a cell press withdraws, and the detail popup is Task-132.
- Any change to `src/ui/partyScreen.ts`, `src/ui/hud/state.ts`,
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
(`src/scenes/panels/pc.ts.ts`), next to `panelExpanded(host, …)` and its mount: the module has
`host.scene` (`RoutePanelHost.scene`), so it can subscribe to the scene's own
`Phaser.Scenes.Events.PAUSE` / `RESUME` events and drop the subscription in `close?()`. Do **not**
touch `src/ui/hud/mount.ts`, `src/ui/hud/shell.ts`, `src/scenes/RouteScene.ts`,
`src/scenes/BattleScene.ts`, `src/main.ts` or a batch-mate's file. A hidden root is
`view.open === false` — the behaviour the collapse already implements — so the mount stays and only
the view changes.

### Extra acceptance criterion (must be measured, not eyeballed)

- [ ] `[live]` **Hidden over the battle, back on resume.** At 1280×800 with `?hud=dom`: on the route
      with the panel open (press `O`), record its rect **R** and `hidden === false`. Call
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
      lists only this task's exclusive paths (plus `.agent_specs/task-130.md`).

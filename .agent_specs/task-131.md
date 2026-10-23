# Spec: Task-131 — The party panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene module + Preact panel (`D49`, Phase 12).
- **Role:** Dev.
- **Objective:** The party window leaves Phaser as a **pure move plus a skin**. With
  `?hud=dom` on, the route's party is a Preact panel in the `#hud` layer that draws the
  **same card the Phaser module draws today** — the same rect, the same header (the
  squad's level, the shared XP bar, the Pokevial meter and its label), the same six
  52 px rows with their portrait cell, name, status mark and HP bar, and the same
  reorder the run already allows — while `src/scenes/panels/party.ts` draws no Phaser
  object at all. The card's paint comes from the prototype board
  (`design/frames/03b-panels-row-view.json`): radius 11, the 1 px hairline, the 1 px
  highlight 12 px inside its top edge, the 26×26 accent-edged key chip, the board's type
  scale and line boxes, and the accent selected row. With the flag off every line of
  the shipped Phaser party draws exactly as it draws today.
- **Environment:** worktree `../wt-pkm-131`, branch `task-131`.
- **Dependencies:** all merged, nothing produced by a batch-mate:
  - `Task-127` (the spike) — `src/ui/hud/panels/options/**` is the pattern this task
    copies, and `src/scenes/SettingsScene.ts` shows the scene-side `DOM_HUD` branch.
  - `Task-128` — `src/scenes/panels/party.ts` exists and is the only writer of the party.
  - `Task-124` — `src/ui/hud/mount.ts`, `styles/root.css`, the Silkscreen faces.
  - `Task-125` — `src/ui/hud/kit/**`.
  - `Task-126` — `src/ui/hud/fixtures/**` (`parseHudFlags`).
  - Read but never changed: `src/ui/partyScreen.ts` (`partyRows`, `PartyRow`,
    `moveInParty` is in `src/engine/run`), `src/ui/hud/state.ts` (`HudState`,
    `HudPartyRow`), `src/ui/hud/commands.ts` (`HudCommand`), `src/scenes/panels/hud.ts`
    (`HUD_*`, `hudMetrics`, `panelExpanded`, `toggleHudPanel`),
    `src/data/ui/chrome.json`, `src/data/frlg/battle-ui.json` (`hpbar`).

### Board vs shipped screen (read this before planning the work)

`03b Panels · row view` is a **compact variant** of the same screen, not the screen: its
party group is one 304×124 card holding a single row of four portraits, a two-state view
toggle and a 26×62 vial button. The DOM panel draws the **shipped** screen inside the
**shipped** box, and takes the board's *paint* only. What is deliberately **not**
adopted:

1. **The 304×124 card and the four-portrait strip.** The shipped party is 250×406:
   `hudMetrics(w).partyW = min(HUD_PARTY_W = 250, w − 16)` and its height is
   `HUD_PARTY_HEADER 82 + 6 × HUD_PARTY_ROW 52 + HUD_PAD_BOTTOM 12 = 406` (the header is
   `HUD_VIAL_Y 54 + HUD_VIAL_H 20 + 8`). Six members are the game's maximum
   (`MAX_PARTY_SIZE = 6`) and the shipped panel shows all six as rows; a four-cell strip
   would hide two of them.
2. **The board's `party view toggle`.** The shipped panel has one presentation and no
   toggle; a second one is a design change, not a migration (and the shipped header row
   is already full: the level text, the right-aligned XP readout and the XP bar span it).
3. **The board's 26×62 `vial button`.** The shipped header draws a 100×20 Pokevial bar
   with its name inside it (`HUD_VIAL_W`/`HUD_VIAL_H`), driven by `run.pokevialCharges`.
   The DOM keeps the shipped bar and takes the board's warning tone (`#FBBF24`) for its
   charges.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/party.ts` (modify)
- `src/ui/hud/panels/party/view.ts` (new)
- `src/ui/hud/panels/party/view.test.ts` (new)
- `src/ui/hud/panels/party/partyPanel.tsx` (new)
- `src/ui/hud/panels/party/party.css` (new)
- `src/ui/hud/panels/party/mount.tsx` (new)
- `src/ui/hud/panels/party/index.ts` (new)
- `src/ui/hud/panels/party/README.md` (new)

Do **not** touch `src/ui/hud/panels/README.md` (Task-124 already wrote the `party/`
line), `src/scenes/panels/README.md`, `src/ui/README.md`, `design/fixtures/**` (see
*Fixture decision*), `package.json`, `src/main.ts`, `vite.config.ts`,
`src/ui/hud/state.ts`, `src/ui/hud/commands.ts`, `src/ui/hud/kit/**`,
`src/scenes/panels/hud.ts`, `src/scenes/panels/bag.ts`, `src/scenes/panels/pc.ts`,
`src/scenes/RouteScene.ts`, `src/data/**`.

### Fixture decision (read this before planning the work)

`03b Panels · row view` is **one sheet carrying three panels** (bag, pc, party) over a
route screenshot, so its `hud:diff` needs all three panels *and* a canvas that
reproduces the board's own screenshot. And **no route or battle frame can pass
`hud:diff` until the preview can draw the frame's own background** — the harness diffs
the whole screenshot against the board's PNG. **This task therefore claims no
`design/fixtures/<slug>.json` and must not create one.** `npm run hud:diff` is **not**
a gate for this task; the gate is the DOM measurement in the Test and Validation Plan.

### Inputs (read-only)

- `AGENTS.md`, this spec.
- `design/frames/03b-panels-row-view.json` (the party group's paint: `2:9`, `2:10`,
  `2:33`, `2:34`, `2:35`, `2:36`, `2:191`), `design/tokens.json`,
  `src/ui/hud/styles/root.css`, `src/ui/hud/kit/kit.css`, `src/data/ui/chrome.json`,
  `src/data/frlg/battle-ui.json`.
- `src/ui/hud/panels/options/**` (the pattern), `src/ui/hud/panels/README.md`.
- `src/ui/partyScreen.ts`, `src/ui/hud/state.ts`, `src/ui/hud/commands.ts`,
  `src/ui/hud/fixtures/index.ts`, `src/ui/metrics.ts`.
- `src/scenes/panels/party.ts` (your file), `src/scenes/panels/types.ts`,
  `src/scenes/panels/hud.ts`, `src/scenes/RouteScene.ts` (the call sites you must keep
  safe).
- `docs/hud-fidelity.md` §2–§5, `docs/hud-dom-proposal.md` §4–§6, `D49` in
  `docs/tech-decisions.md`.

## 🔒 Contract

Two halves, frozen. Names and signatures are exact.

### A. The panel folder (`src/ui/hud/panels/party/`) — no Phaser, no scene, no run

```ts
// view.ts
import type { HudState } from '../../state';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The panel's own cursor state; the scene module keeps it in step with `PartyUiState`. */
export type PartyPanelUi = Readonly<{ cursor: number }>;

export type PartyRowView = Readonly<{
  /** `HudState.party[i].id`. */
  memberId: string;
  name: string;
  level: number;
  hpText: string;
  /** 0…1, from `HudPartyRow.hpFraction`. */
  hpFraction: number;
  statusLabel: string | null;
  heldItemName: string | null;
  selected: boolean;
  /** Panel-relative: the whole row, the portrait cell and the HP bar. */
  row: Rect;
  portrait: Rect;
  hpBar: Rect;
}>;

export type PartyPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `partyPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  level: Readonly<{ text: string; box: Rect }>;
  xp: Readonly<{ text: string; fraction: number; box: Rect }>;
  vial: Readonly<{ text: string; charges: number; max: number; fill: number; box: Rect }>;
  rows: readonly PartyRowView[];
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const PARTY_PANEL_W = 250; // HUD_PARTY_W / hudMetrics().partyW
export const PARTY_PANEL_H = 406; // HUD_PARTY_HEADER + 6 × HUD_PARTY_ROW + HUD_PAD_BOTTOM
export const PARTY_PAD_X = 20; // HUD_PAD_X / FRLG_WINDOW_PADDING.x
export const PARTY_PAD_TOP = 16; // HUD_PAD_TOP
export const PARTY_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const PARTY_HEADER_H = 82; // HUD_PARTY_HEADER
export const PARTY_ROW = 52; // HUD_PARTY_ROW
export const PARTY_ROWS = 6; // MAX_PARTY_SIZE
export const PARTY_COLUMN = 56; // HUD_PARTY_COLUMN
export const PARTY_PORTRAIT = 45; // PORTRAIT_SIZE 64 × HUD_PARTY_PORTRAIT_SCALE 0.7, rounded
export const PARTY_PORTRAIT_X = 44; // partyLeft 20 + 24, the cell's centre
export const PARTY_XP_INSET = 12; // HUD_XP_BAR_INSET
export const PARTY_XP_H = 8; // HUD_XP_BAR_H
export const PARTY_XP_Y = 38; // HUD_XP_BAR_Y
export const PARTY_VIAL_W = 100; // HUD_VIAL_W
export const PARTY_VIAL_H = 20; // HUD_VIAL_H
export const PARTY_VIAL_Y = 54; // HUD_VIAL_Y
export const PARTY_HP_BAR = 154; // (partyW − 40 − HUD_PARTY_COLUMN)
export const PARTY_HP_BAR_H = 16; // FRLG_HPBAR.height 28 × 154/268, rounded
export const PARTY_HP_FILL_RATIO = 110.3 / 154; // the baked track's share of the bar

/** The shipped rect: `x = width − HUD_PANEL_W 344 − 8`, `y = HUD_TOP 8`, `w = 250`. */
export function partyPanelBox(viewport: Viewport): Rect;
export function initialPartyPanelUi(): PartyPanelUi;
/** Pure: same `(state, ui, viewport)` ⇒ deep-equal view. */
export function partyPanelView(state: HudState, ui: PartyPanelUi, viewport: Viewport): PartyPanelView;
```

`partyPanelView` reads `state.party` (`id`, `name`, `level`, `hp`, `maxHp`,
`hpFraction`, `statusLabel`, `heldItemName`), `state.route?.squadLevel`,
`state.route?.xpFraction`, `state.route?.pokevialCharges` and `state.route?.pokevialMax`;
a missing `route` yields `level.text === ''`, `xp.fraction === 0`, `vial.charges === 0`.
It lays out at most `PARTY_ROWS` rows from `PARTY_HEADER_H` at `PARTY_ROW` pitch and
clamps `ui.cursor` to the party's length.

```ts
// partyPanel.tsx
import type { JSX } from 'preact';
import type { HudCommand } from '../../commands';
import type { PartyPanelView } from './view';

export type PartyPanelProps = Readonly<{
  view: PartyPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;
export function PartyPanel(props: PartyPanelProps): JSX.Element;
```

```ts
// mount.tsx
import type { Signal } from '@preact/signals';
export function mountPartyPanel(
  host: Element,
  view: Signal<PartyPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void;
```

```ts
// index.ts — the barrel the scene module imports
export { PartyPanel } from './partyPanel';
export type { PartyPanelProps } from './partyPanel';
export { mountPartyPanel } from './mount';
export {
  PARTY_COLUMN, PARTY_HEADER_H, PARTY_HP_BAR, PARTY_HP_BAR_H, PARTY_HP_FILL_RATIO,
  PARTY_PAD_BOTTOM, PARTY_PAD_TOP, PARTY_PAD_X, PARTY_PANEL_H, PARTY_PANEL_W,
  PARTY_PORTRAIT, PARTY_PORTRAIT_X, PARTY_ROW, PARTY_ROWS, PARTY_VIAL_H, PARTY_VIAL_W,
  PARTY_VIAL_Y, PARTY_XP_H, PARTY_XP_INSET, PARTY_XP_Y,
  initialPartyPanelUi, partyPanelBox, partyPanelView,
} from './view';
export type { PartyPanelUi, PartyPanelView, PartyRowView, Rect, Viewport } from './view';
```

**The shipped layout this task reproduces** (panel-relative, from the module's own
constants; `party.ts` and `hud.ts` compute these from `host.hud()`):

| part | rect |
| --- | --- |
| card | 250×406 at `(w − 344 − 8, 8)`; radius 11 |
| key chip | (0,0) 26×26 (the board's chip; the shipped icon is 24 — the chip takes the board's 26 and its own corner), radius 6, `#0B1017` 50 %, 1 px accent 55 %, letter `P` 11 px Bold |
| level text | (32,16), 16 px / 20 px, ink (`t('hud.level', { level })`) |
| XP readout | right-aligned at (218,16), 16 px / 20 px, muted |
| XP bar | (32,38) 186×8, track white 12 %, fill `#60A5FA` at `fraction × 186` |
| Pokevial | (75,54) 100×20, track white 12 %, fill one step per charge (`#FDE68A`, `#FBBF24`, `#F97316`), label `t('hud.vial')` centred at +3 |
| rows | 6 × 52 high at `y = 82 + i × 52` |
| row highlight | (20, y) 210×48, selected = accent 16 % fill + 1 px accent stroke (`FRLG_SELECTED_*`) |
| portrait | 45×45 centred on (44, y + 26) — the shipped `PORTRAIT_SIZE 64 × 0.7` cell, rounded |
| held badge | 24×24 at (47, y + 27) — the shipped item icon at (59, y+39) with origin 0.5 |
| name | (76, y + 6), 16 px / 20 px, ink |
| status | right-aligned at (230, y + 5), 11 px, warning tone |
| HP bar | (76, y + 28) 154×16; its fill is the baked track's share: `x + 34.5`, `y + 4.6`, `110.3 × 6.9`, scaled by `hpFraction`, `#58D080` |
| highlight (card) | 1 px at (12,12) `w − 24`, `#FFFFFF` at 8 % (the kit's value) |

- `view` is data only: the component reads no scene, no run, no engine, no save and no
  RNG. It imports `HudState`/`HudCommand` as **types**, the kit, `./party.css` and
  `../../../../i18n`. **It must not import Phaser, `src/scenes/**`, `src/engine/**`
  (including `src/engine/save.ts`), `src/data/**` or write any save field.**
- Every pressable control smaller than 44×44 carries the kit's `::after` hit overlay
  (`min-width: 44px; min-height: 44px`): the key chip. Rows are 210×48 and need none.
- DOM contract QA reads: root `[data-hud-panel="party"]`, then
  `[data-hud-party="chip"|"level"|"xp"|"vial"]` and
  `[data-hud-party-member="<memberId>"]` on each row (its portrait is
  `[data-hud-party-portrait]`, its HP bar `[data-hud-party-hp]`). `hidden` on the root
  when `view.open === false`.
- The root is `position: absolute` inside `#hud`, `pointer-events: auto`, `box-sizing:
  border-box`; it mounts into `document.getElementById('hud')`.

### B. The scene module (`src/scenes/panels/party.ts`) — the flag branch

```ts
/** The number of display objects the party draws right now: 0 under `?hud=dom`. */
export function partyDrawnObjectCount(): number;
```

- `DOM_HUD` is read once at module load:
  `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
  (`parseHudFlags` from `../../ui/hud/fixtures`).
- **Flag off:** not one line of the shipped behaviour changes — same objects, same
  rects, `partyDrawnObjectCount()` = the party body container's child count (> 0), and
  **the values of `partyBottom()`, `paneMembers()`, `pointerInPartyPanel()`,
  `hudPartyRowAt()`, `partyHeldBadge()`, `setPartyPortraitTint()`,
  `clearPartyPortraitTints()` do not change.** `src/scenes/panels/bag.ts` (Task-129) and
  `src/scenes/panels/pc.ts` (Task-130) lay themselves out from `partyBottom()` in this
  same batch, so a moved return value is a cross-task regression.
- **Flag on:** `build(host)` creates **no** party content but **keeps the shipped layout
  arithmetic** (the same `x`, `partyY`, `partyW`, `partyH` it computes today) and keeps
  the panel record so the quick key, the saved layout and the collapse still work:
  - create the window with `addFrlgWindow(...)` and `.setVisible(false)`, pass an empty
    `scene.add.container(0, 0)` as the body, call `makeHudPanel(...)` with the same
    `x/y/w/h` as today, then `panel.container.setVisible(false)` and
    `panel.icon.setVisible(false)`;
  - mount the DOM panel once with `mountPartyPanel(document.getElementById('hud')!, view)`;
  - `refresh(host)` rebuilds the view and assigns `view.value`; it is the only place the
    DOM is fed;
  - `close?()` disposes the mount and clears module state.
- **Open/collapsed is `panelExpanded(host, 'party')`**, nothing else, so the saved
  `hudLayout.party.collapsed` and the collapse icon path keep working. A fresh save
  opens the party expanded (`defaultHudLayout().party.collapsed === false`), so the
  panel is on screen as soon as the route starts; `P` collapses it.
- **The same state.** `ui.cursor` mirrors `host.ui().index` for the party pane, so the
  keyboard cursor and the DOM highlight never disagree. The view comes from
  `projectHud({ screen: 'route', run: host.run(), notice: null })`.
- **Reorder-to-lead, one press.** A row press answers `{ type: 'member', memberId }`;
  the module resolves it as "make that member the lead": find its index in `run.party`,
  apply `moveInParty(run, index, 0)`, and if the result is a new run call
  `host.commitRun(next)` (which repaints). A no-op for the member already at index 0.
  The component never touches the run. The key chip answers
  `{ type: 'panel', panel: 'party' }`; the module resolves it with
  `toggleHudPanel(host, 'party')`.
- Flag-on, these exported helpers must stay safe (the scene calls them on every
  press/drag and none may dereference an unbuilt layout): `hudPartyRowAt` → `null`,
  `partyHeldBadge` → `undefined`, `setPartyPortraitTint`/`clearPartyPortraitTints` →
  no-op, `pointerInPartyPanel` → `false`. `paneMembers(host, pane)` keeps its current
  behaviour and `partyBottom()` keeps returning exactly what it returns today.
- **No RNG, no save field, no engine rule change, no new run field, no
  `SAVE_VERSION` step.**

## 🧩 Data and configuration

No new data table, no `src/data/**` write, no balancing value. The constants this task
introduces are the mirror block in `view.ts` above (each named after the Phaser
constant it copies) plus the board's skin values in `party.css` (the chip at 26×26 with
its `#0B1017` 50 % fill and accent 55 % stroke, the 8 % card highlight, the vial's
warning tone). Do not edit `kit.css`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including `view.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-131` must list only the eight exclusive paths.
  - The `[live]` criteria need a browser: on this host set
    `CHROME_PATH=/tmp/opencode/chrome-nosandbox` (a wrapper adding
    `--no-sandbox --remote-debugging-address=127.0.0.1`) and serve the game with
    `npm run dev -- --port 5199 --strictPort` (the checks import `/src/main.ts`). Drive
    it over CDP exactly as `scripts/hud/diff.mjs` does.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean: `npm run build`.
  - [ ] `[unit]` `npm test` is green and `src/ui/hud/panels/party/view.test.ts` asserts:
        `partyPanelBox({ width: 1280, height: 800 })` = `{ x: 928, y: 8, w: 250, h: 406 }`
        and `partyPanelBox({ width: 390, height: 844 })` = `{ x: 38, y: 8, w: 250, h: 406 }`;
        for a two-member fixture the chip `{ x: 0, y: 0, w: 26, h: 26 }`, the level text
        at `{ x: 32, y: 16 }`, the XP bar `{ x: 32, y: 38, w: 186, h: 8 }`, the vial
        `{ x: 75, y: 54, w: 100, h: 20 }`, row 0 at `{ x: 20, y: 82, w: 210, h: 48 }` with
        its portrait `{ x: 22, y: 86, w: 45, h: 45 }` and its HP bar
        `{ x: 76, y: 110, w: 154, h: 16 }`, and row 1 at `y = 134`; that the XP fill is
        `fraction × 186` and the HP fill `hpFraction × PARTY_HP_FILL_RATIO × 154`; that
        at most `PARTY_ROWS = 6` rows are drawn and the cursor is clamped; that the
        mirrored constants equal their literals (`PARTY_ROW 52`, `PARTY_HEADER_H 82`,
        `PARTY_COLUMN 56`, `PARTY_XP_Y 38`, `PARTY_VIAL_Y 54`, `PARTY_PANEL_H 406`).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The same box as the Phaser panel it replaces.** With `?hud=dom`
        **off** read
        `(() => { const p = (await import('/src/main.ts')).game.scene.getScene('Route').panelHost.panels().find(x => x.id === 'party'); return { x: p.x + p.dx, y: p.y + p.dy, w: p.w, h: p.h }; })()`;
        with it **on** read
        `document.querySelector('[data-hud-panel="party"]').getBoundingClientRect()`.
        The two agree within ±2 px on x, y, width and height at 1280×800 and at
        390×844 (the party opens expanded on a fresh save — no key press needed).
  - [ ] `[live]` **The same internals.** With the panel open: the rows are 210×48 at
        `y = panelY + 82 + i × 52` (`HUD_PARTY_ROW 52`), the first row's portrait is
        45×45 centred on `panelX + 44`, and the HP bar is 154×16 at `panelX + 76`,
        `rowY + 28`; the number of rows drawn equals `run.party.length` (up to 6) and
        each row's `[data-hud-party-member]` equals the member's `fighter.id`.
  - [ ] `[live]` **The skin.** `getComputedStyle` on the root reports
        `border-top-left-radius: 11px`, `border-top-width: 1px`,
        `border-top-color: rgba(255, 255, 255, 0.16)`; the key chip is 26×26 with a
        `::after` of `min-width: 44px; min-height: 44px`; the selected row reports
        `border-top-color: rgba(125, 211, 252, 1)` (the accent) when its member is the
        cursor's.
  - [ ] `[live]` **No overflow.** `document.documentElement.scrollWidth <= window.innerWidth`
        at 1280×800 and at 390×844.
  - [ ] `[live]` **The flag contract.** `?hud=dom` **off**:
        `(await import('/src/scenes/panels/party.ts')).partyDrawnObjectCount() > 0` and
        `document.querySelector('[data-hud-panel="party"]') === null`. **On**:
        `partyDrawnObjectCount() === 0`, the node exists, and
        `…panelHost.panels().find(p => p.id === 'party').container.visible === false`.
  - [ ] `[live]` **The toggle and the lead.** `P` collapses the panel (the root becomes
        `hidden`, `getBoundingClientRect().width === 0`) and a second `P` brings it back
        at the same rect; with two or more members, pressing the second row's
        `[data-hud-party-member]` element makes that member the lead:
        `game.scene.getScene('Route').run.party[0].fighter.id` equals the pressed row's
        `data-hud-party-member` value, and the rows re-render in that order.
- **Live recipe:**
  1. `CHROME_PATH=/tmp/opencode/chrome-nosandbox npm run dev -- --port 5199 --strictPort`
  2. Launch that Chrome headless with `--remote-debugging-port=9222`, attach to the page
     target, `Page.enable`, `Emulation.setDeviceMetricsOverride` with
     `{ width, height, deviceScaleFactor: 2, mobile: width < 600 }`.
  3. `Page.navigate` to `http://127.0.0.1:5199/?hud=dom`; wait for the load event.
  4. Poll `(await import('/src/main.ts')).game.scene.isActive('MainMenu')` every 200 ms
     (up to 20 s), dispatch `Enter` twice with 600 ms between, then poll
     `game.scene.isActive('Route')` and wait 600 ms.
  5. `Runtime.evaluate` with `awaitPromise: true` and an async IIFE returning the JSON
     of the expressions above; for the lead criterion, add a second member with
     `game.scene.getScene('Route').addDebugPokemon('pidgey', 5)` (dev-only), re-read the
     rows, then press the second row with `Input.dispatchMouseEvent`
     (`mousePressed`/`mouseReleased` at its centre).
  6. Repeat with `?` removed (flag off) and with
     `{ width: 390, height: 844, mobile: true }`.

## 📣 Coordination

- **For the Orchestrator's report:** no route or battle frame can pass `hud:diff` until
  the preview can draw the frame's own background, which is why this task (and 129, 130,
  140) is gated by DOM measurement instead.
- **For the Orchestrator / the human — two readings to confirm:**
  1. The board's party group is a four-portrait strip with a view toggle; the shipped
     panel is six rows with a level/XP/vial header. The DOM keeps the **shipped** six
     rows (a strip would hide two of `MAX_PARTY_SIZE`) and drops the board's toggle,
     which has no shipped behaviour to mirror.
  2. "The party order and the lead become commands" is implemented as **one press =
     make that member the lead** (`moveInParty(run, index, 0)`), because the panel has no
     drag under the flag and the board draws no reorder control.
- **For the next batch:** the flag branch shape (shipped layout arithmetic kept, the
  record kept but invisible with an empty body, the DOM panel following
  `panelExpanded`) is the pattern Tasks 129/130 and the later route panels copy;
  `partyDrawnObjectCount()` is its flag-contract probe, and the mirror-constant block
  in `view.ts` is how a migrated panel proves it did not drift.
- **Cross-task pin:** `partyBottom()` must not change value — `bag.ts` (Task-129) and
  `pc.ts` (Task-130) put their panels under this one in the same batch.
- `hud.ts` and `RouteScene.ts` are never edited here. No fixture, no `hud:diff` gate, no
  `docs/` change, no `src/data/` change.

## ⛔ Out of scope

- The board's 304×124 card, its four-portrait strip, its view toggle and its 26×62 vial
  button (see *Board vs shipped screen*).
- Member portraits: a row draws its 45×45 cell with the member's name, level, HP and
  status. The portrait atlas is a `public/anil/` URL that `.gitignore` keeps out of the
  repo (`.gitignore:33`), so a CSS sprite from it would 404 in a clean clone.
- `design/fixtures/**`, any `hud:diff` pass, any change to `scripts/hud/**` or
  `design/**`.
- Dragging the DOM panel: the shipped rect wins and `hudLayout.party.dx/dy` are ignored
  under the flag (`collapsed` is honoured). The chips and the pad are Task-139.
- Dragging a member to reorder (the shipped drag path needs Phaser objects); the party
  detail popup is Task-132.
- Any change to `src/ui/partyScreen.ts`, `src/ui/hud/state.ts`,
  `src/ui/hud/commands.ts`, `src/scenes/panels/hud.ts`, `src/scenes/RouteScene.ts`,
  the engine, the RNG or the save.

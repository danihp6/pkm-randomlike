# Spec: Task-133 — the route map panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD migration (`D49`).
- **Role:** Dev.
- **Objective:** under `?hud=dom` the route header — the floor minimap (`docs/maps-spec.md`
  §8, `D32`): the `Map N · Biome` title over the discovered-rooms grid, its
  openings, its links and the boss / portal / spent-capture / special markers — is a
  Preact card in the `#hud` layer, drawn as **CSS boxes and an SVG** from the pure
  `buildMapView` output, with the card's paint from `design/tokens.json`.
  `src/scenes/panels/map.ts` keeps its `descriptor` and its layout arithmetic but
  draws no Phaser object and no `Graphics` under the flag; with the flag off it is
  byte-for-byte the panel it is today. `src/ui/mapView.ts` is **not edited**: every
  position, reveal rule and marker stays its decision.
- **Environment:** worktree `../wt-pkm-133`, branch `task-133`.
- **Dependencies:** `[Task-124]` (`src/ui/hud/mount.ts` — the `#hud` layer),
  `[Task-125]` (`src/ui/hud/kit/**` — `Panel`, `Meta`), `[Task-127]` (`?hud=dom`),
  `[Task-128]` (`src/scenes/panels/types.ts`'s `RoutePanelHost`, the descriptor
  registry). Shipped, merged, read as the pattern to copy: `[Task-129]`
  `src/scenes/panels/bag.ts`, `[Task-130]` `src/scenes/panels/pc.ts`, `[Task-131]`
  `src/scenes/panels/party.ts`.

### Exclusive paths (single writer)

- `src/scenes/panels/map.ts`
- `src/ui/hud/panels/map/**` (new folder)
- `design/fixtures/03o-panels-map-routes.json` (new file)

Nothing else. You may **not** touch `src/ui/mapView.ts`, `src/scenes/RouteScene.ts`,
`src/scenes/panels/hud.ts`, `src/scenes/rooms/**`, `src/ui/hud/commands.ts`,
`src/ui/hud/state.ts`, `src/i18n/**`, `src/ui/hud/panels/README.md` or
`src/scenes/panels/README.md`. Both READMEs already list `map/` and `map.ts`; **no
line of them changes**. `src/ui/hud/panels/map/README.md` is yours to create.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `docs/tech-decisions.md` (`D49`, `D32`, `D31`),
  `docs/hud-fidelity.md` (§5 panel geometry, §6 frame map), `docs/maps-spec.md` §8
  (the minimap), `docs/design-spec.md`.
- `src/ui/mapView.ts` (`MapView`, `MapViewRoom`, `MapViewLink`, `MapViewOpening`,
  `MapRoomMarker`, `buildMapView`) — **read only, never edited**.
- `src/scenes/panels/map.ts` (the panel you migrate, with its constants
  `HUD_MAP_X`, `HUD_MAP_Y`, `HUD_MAP_H`, `HUD_MAP_TITLE_H`,
  `HUD_MAP_CURRENT_FILL`, `HUD_MAP_CURRENT_STROKE`, `portalOpen`),
  `src/scenes/panels/hud.ts` (`HUD_MAP_W = 216`, `hudMetrics`, `HUD_TOP`,
  `HUD_PAD_X`, `HUD_PAD_TOP`, `HUD_PAD_BOTTOM`, `HUD_CONTENT_LEFT`,
  `panelExpanded`, `panelById`, `makeHudPanel`), `src/scenes/panels/types.ts`,
  `src/engine/maps` (`isFinalMap`, `MapRoomSpecial`), `src/data/biomes.ts`.
- The shipped DOM panels as the seam to copy (`src/ui/hud/panels/party/*`) and
  `src/ui/hud/styles/root.css` (`--hud-*`).
- The board: `design/frames/03o-panels-map-routes.json` and
  `design/frames/m03o-panels-map-routes.json` (the frame's own copy: the card, the
  title, the room grid), `design/screens/03o-panels-map-routes.png` /
  `m03o-…png` (reference only), `design/tokens.json`.
- `src/i18n/en.ts` (`route.mapTitle`, `hud.noMap`).

## 🔒 Contract

### `src/ui/hud/panels/map/view.ts` — the pure layout model

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The card's paint tokens, as CSS-ready strings: no colour is retyped in CSS. */
export type MapTone = Readonly<{ fill: string; stroke: string }>;

export type MapRoomView = Readonly<{
  id: number;
  /** Viewport coordinates, already scaled and centred inside the grid band. */
  box: Rect;
  current: boolean;
  /** The markers this room carries, in draw order. */
  markers: readonly MapMarkerView[];
  /** One segment per opening; `edge` follows the plan's cardinal order. */
  openings: readonly Readonly<{ edge: 'N' | 'E' | 'S' | 'W'; kind: 'entry' | 'link' | 'portal'; d: string }>[];
}>;

export type MapMarkerView =
  | Readonly<{ kind: 'boss'; cx: number; cy: number; r: number }>
  | Readonly<{ kind: 'capture'; cx: number; cy: number; r: number }>
  | Readonly<{ kind: 'portal'; cx: number; cy: number; r: number }>
  | Readonly<{ kind: 'special'; special: MapRoomSpecial; cx: number; cy: number; r: number; fill: string }>;

export type MapPanelView = Readonly<{
  /** False while the header panel is collapsed or the route is paused. */
  open: boolean;
  box: Rect;                       // viewport coordinates
  highlight: Rect;                 // panel-relative
  title: Readonly<{ text: string; box: Rect }>;
  /** `hud.noMap` in its own box, or null while a floor is on screen. */
  empty: Readonly<{ label: string; box: Rect }> | null;
  grid: Readonly<{ box: Rect; width: number; height: number; scale: number; dx: number; dy: number }>;
  links: readonly Readonly<{ from: number; to: number; x1: number; y1: number; x2: number; y2: number }>[];
  rooms: readonly MapRoomView[];
}>;

export const MAP_PANEL_W = 216;    // HUD_MAP_W / hudMetrics().mapW
export const MAP_PANEL_H = 250;    // HUD_MAP_H
export const MAP_TITLE_H = 50;     // HUD_MAP_TITLE_H = HUD_PAD_TOP 16 + 34
export const MAP_PAD_X = 20;       // HUD_PAD_X
export const MAP_PAD_BOTTOM = 12;  // HUD_PAD_BOTTOM
export const MAP_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const MAP_LINK_STROKE = 3;  // the shipped link line width
export const MAP_ROOM_STROKE = 2;  // the shipped room outline width
export const MAP_OPENING_STROKE = 4; // the shipped opening tick width
export const MAP_CURRENT_FILL = '#f6d98a';   // HUD_MAP_CURRENT_FILL 0xf6d98a
export const MAP_CURRENT_STROKE = '#9a7a1f'; // HUD_MAP_CURRENT_STROKE 0x9a7a1f
export const MAP_PORTAL_STROKE = '#3fa9f5';
export const MAP_ENTRY_STROKE = '#4ad15c';
export const MAP_BOSS_FILL = '#b0304a';
export const MAP_CAPTURE_FILL = '#e2554e';

/** The one colour a special room's dot takes; the kind's identity is its letter. */
export const MAP_SPECIAL_TONES: Readonly<Record<MapRoomSpecial, string>>;

export function mapPanelBox(viewport: Viewport): Rect;
export function mapPanelView(view: MapView | null, title: string, viewport: Viewport): MapPanelView;
```

`mapPanelBox(viewport)` mirrors `hudMetrics` + `map.ts`'s own constants:

```
mapW = min(216, max(160, width - 16))
box  = { x: 8, y: 8, w: mapW, h: 250 }
```

so it is `{x:8,y:8,w:216,h:250}` at both 1280×800 and 390×844 (the 216 px card fits
a 390 px window with both margins).

`mapPanelView` is **pure and total** and repeats the shipped arithmetic exactly:

- title box `{x: MAP_CONTENT_LEFT, y: 16, w: mapW - MAP_CONTENT_LEFT - MAP_PAD_X, h: 20}`;
- grid band `area = {x: 20, y: 50, w: mapW - 40, h: 250 - 50 - 12}` (panel-relative);
- `scale = min(area.w / view.width, area.h / view.height)`; the view is centred:
  `dx = area.x + (area.w - view.width·scale)/2`, `dy = area.y + (area.h - view.height·scale)/2`;
  a room's box is `{x: dx + room.x·scale, y: dy + room.y·scale, w: room.w·scale, h: room.h·scale}`
  (panel-relative, and the component adds `view.box.x/y` — the same convention
  `bag/view.ts` uses);
- `view === null` or `!view.visible` ⇒ `rooms: []`, `links: []` and the `empty`
  label at `{x: mapW/2, y: MAP_TITLE_H + 56}` (origin `0.5 0`);
- a room's opening tick is a segment of half-length `gap = max(2.5, min(w, h)·0.18)`
  through the opening's scaled midpoint, perpendicular to its edge: `N`/`S` are
  horizontal (`M x-gap y H x+gap`), `E`/`W` vertical (`M x y-gap V y+gap`);
- markers, in this order and **mutually exclusive for the first three**: `boss`
  (`r = max(3, min(w,h)·0.18)`), else `capture` when the room's capture is spent,
  else nothing; then one `special` marker per `room.marker` (`r = max(3, min(w,h)·0.18)`,
  `fill = MAP_SPECIAL_TONES[special]`); then `portal` when `room.portal`
  (`r = 1.4 × the boss/capture radius`, stroke only).
  The canvas paints the boss's eyes and the capture ball's band; the DOM paints the
  boss as the frame's two-ink dot and the capture as a two-tone ball (see CSS), the
  portal as the ring. The **special** dot is the one deliberate simplification:
  `src/scenes/rooms/*` draws those glyphs with `Phaser.GameObjects.Graphics` (a
  `drawMarker` on the room descriptor), which no DOM panel can call — the DOM paints
  the kind's dot in `MAP_SPECIAL_TONES[kind]` and its letter in `data-hud-map-marker`
  for QA, never the canvas artwork.

`MAP_SPECIAL_TONES` (content colours, so they live in the view module and not in
`kit.css`):

| kind          | tone      |
| ------------- | --------- |
| `mini-boss`   | `#7dd3fc` |
| `mega-stone`  | `#c084fc` |
| `gated`       | `#fbbf24` |
| `trade`       | `#4ad15c` |
| `no-heal`     | `#e2554e` |
| `static`      | `#f8fafc` |
| `secret-shop` | `#22d3ee` |
| `banned`      | `#94a3b8` |
| `puzzle`      | `#a3e635` |

### `src/ui/hud/panels/map/mount.tsx`

```ts
export function mountMapPanel(
  host: Element,
  view: Signal<MapPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void;
```

Same shape as `mountBagPanel` / `mountPartyPanel` (`<div class="map-mount">`,
`paint()` on every signal change, idempotent disposer). The one command this panel
sends is the header's own toggle, `{ type: 'panel', panel: 'header' }`, from its
chip when the card carries one; nothing else in the panel is interactive today
(`map.ts`: "The header has nothing interactive").

### `src/ui/hud/panels/map/index.ts` — the barrel

```ts
export { MapPanel } from './mapPanel';
export type { MapPanelProps } from './mapPanel';
export { mountMapPanel } from './mount';
export { MAP_SPECIAL_TONES, mapPanelBox, mapPanelView, /* + the constants above */ } from './view';
export type { MapMarkerView, MapPanelView, MapRoomView, MapTone, Rect, Viewport } from './view';
```

### DOM contract (`mapPanel.tsx`)

- `div.map` with `data-hud-panel="header"`, `data-open`, `hidden={!view.open}`,
  `position: fixed` at `view.box`; inside it `span.map__highlight` at `view.highlight`.
- `[data-hud-map="title"]` — the title line.
- `[data-hud-map="grid"]` — the grid wrapper, sized `view.grid.box`; inside it one
  **`<svg>`** (`viewBox="0 0 grid.w grid.h"`, `width/height` in px) holding, in this
  order: one `<line>` per link (`[data-hud-map-link="<from>-<to>"]`), one `<rect>`
  per room (`[data-hud-map-room="<id>"]`, `data-current="true"` on the current one),
  one `<path>` per opening (`[data-hud-map-opening]`), then the markers as `<g>`
  (`[data-hud-map-marker="boss|capture|portal|<kind>"]`). One SVG, no per-room DOM
  boxes: the whole minimap is one element so a viewport change is one re-render.
- `[data-hud-map="empty"]` — `t('hud.noMap')` while no floor is up.
- `pointer-events: none` on the card except the chip (there is nothing to press).

### `src/scenes/panels/map.ts` — the seam

Keep the module's existing exports and descriptor exactly (`id: 'map'`, `order: 10`,
`hudPanel: 'header'`); edit only these points, in the shape `party.ts` uses:

1. Module scope: `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
2. `portalOpen(host)` stays as it is and is reused by both branches.
3. `build(host)`: `if (DOM_HUD) { buildDom(host); return; } … existing body …`.
   `buildDom` repeats the layout arithmetic (`HUD_MAP_X/Y`, `mapW`, `HUD_MAP_H`),
   calls `makeHudPanel(host, 'header', …)` with an **invisible** window and an empty
   body (`panel.container.setVisible(false)`, `panel.icon.setVisible(false)`,
   `body.remove(panel.border)` as `pc.ts` does), then creates the signal and calls
   `mountMapPanel(layer, view, undefined)`.
4. `refresh(host)`: `if (DOM_HUD) { pushDomView(host); return; } … existing body …`,
   where `pushDomView` builds the title with
   `t('route.mapTitle', { map: run.mapIndex, biome: getBiome(route.biomeId).name })`,
   the `MapView` with the **unchanged** `buildMapView(plan, { discovered, currentRoom,
   portalOpen, captureSpent, markers })` call (same five fields as today), sets
   `open: panelExpanded(host, 'header') && !mapPaused`, and assigns the signal once.
   It creates no `Graphics` and no text object.
5. Subscribe `pause` / `resume` (`SCENE_PAUSE = 'pause'`, `SCENE_RESUME = 'resume'`,
   spelled out as `pc.ts` does) so a battle or the Settings screen over the route
   hides the card and the resume brings it back; `descriptor.close` unsubscribes and
   disposes the mount.
6. `export function mapDrawnObjectCount(): number` — `0` under the flag, the shipped
   container's `list.length` otherwise (the flag-contract probe; `bag.ts`/`party.ts`
   have the same one).

**Determinism:** reads no `Rng` stream, no clock, no random number. `buildMapView`
is called with the same five inputs as today, so a fixed seed reveals the same grid
in the DOM as in the canvas; nothing in this task can move a floor.

**Rules:** `view.ts` imports no Phaser, touches no DOM, has no `Math.random`/`Date.now`;
only `*.tsx`/`mount.tsx` import Preact. No new dependency.

### Data

- No engine, save, `SAVE_VERSION`, RNG or `src/ui/mapView.ts` change.
- New fixture: **`design/fixtures/03o-panels-map-routes.json`** (below).
- No i18n key is added: the panel reuses `route.mapTitle` and `hud.noMap`.
  `src/i18n/**` is **not** edited.

## 🧩 Data and configuration

`design/fixtures/03o-panels-map-routes.json` — the frame's own copy, in the shape
`design/fixtures/02-options.json` established (`{ slug, state, <panel block> }`,
extra keys allowed; the store validates only `slug` and `state`):

```json
{
  "slug": "03o-panels-map-routes",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "map": {
    "title": "Map 1 · Viridian Forest",
    "view": {
      "width": 15, "height": 11, "visible": true,
      "links": [ { "from": 0, "to": 1, "x1": 3, "y1": 3, "x2": 6, "y2": 3 } ],
      "rooms": [
        { "id": 0, "col": 0, "row": 0, "shape": "square", "x": 0, "y": 0, "w": 6, "h": 6,
          "current": true, "boss": false, "portal": false, "marker": null,
          "captureSpent": true,
          "openings": [ { "edge": "E", "kind": "entry", "x": 6, "y": 3 } ] }
      ]
    }
  }
}
```

- `state` is the empty `HudState` (it must pass `isHudState` unchanged): this panel
  reads a title string and a `MapView`, not `HudState` — the same shape `02-options`
  used for its `panel` block. Say so in the folder README.
- `map.view` is a `MapView` **verbatim** (`MapView`'s own field names and units,
  grid units as `buildMapView` emits them): the dev derives it once from the floor
  the frame draws (an entry room, four regular rooms, the boss room, one link per
  joined pair, one special, one spent capture, the portal open) and pastes it. It is
  the fixture's own grid, so the test needs no `MapPlan` and `buildMapView` stays
  untouched.
- `map.title` is the frame's own string (`VIRIDIAN FOREST` in the board's title
  node; the shipped title key prints `Map 1 · Viridian Forest`). Both are pinned: the
  fixture carries the shipped shape, and the frame's uppercase rendering comes from
  the panel's `text-transform: uppercase`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green including the two
    `src/ui/hud/panels/map/*.test.ts` files this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-133` audited against **Exclusive paths**.
  - The browser pass is only for the `[live]` criteria.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/ui/hud/panels/map/view.test.ts` exists and passes and pins:
        `mapPanelBox({1280,800})` and `mapPanelBox({390,844})` both
        `{x:8,y:8,w:216,h:250}`; the title box `{x:30,y:16,w:166,h:20}`; the grid
        band `{x:20,y:50,w:176,h:188}`; for a `MapView` of `width 15 / height 11` the
        `scale` is `min(176/15, 188/11) = 11.7333…` and the room boxes are the
        documented `dx + x·scale`; `view === null` ⇒ `rooms.length === 0`,
        `empty.label === t('hud.noMap')`; `!visible` behaves the same.
  - [ ] `[unit]` `view.test.ts` also asserts: purity and no input mutation; one
        `boss` marker on the boss room and none elsewhere; `capture` only when
        `captureSpent`; `portal` only when `room.portal`, at `r = 1.4 × r`; a
        `special` marker for each `MapRoomSpecial` with the documented tone; the
        opening `d` strings for all four edges (`N`/`S` horizontal, `E`/`W`
        vertical) at `gap = max(2.5, min(w,h)·0.18)`.
  - [ ] `[unit]` `src/ui/hud/panels/map/fixture.test.ts` imports the fixture, asserts
        its `state` passes `isHudState`, and asserts
        `mapPanelView(fixture.map.view, fixture.map.title, {width:1280,height:800})`
        reproduces: the title text, one room, one link, the current room flagged,
        its one opening, and its `capture` marker.
  - [ ] `[unit]` `grep -rn "from 'phaser'\|document\.\|Math.random\|Date.now\|window\." src/ui/hud/panels/map/view.ts` prints nothing.
  - [ ] `[unit]` `git diff --name-only main...task-133` ⊆ the three entries above (the
        folder glob covers every new file under it), and `src/ui/mapView.ts` is
        **unchanged**.
  - [ ] `[live]` **The card is the shipped rect at both sizes.** With `?hud=dom`,
        `document.querySelector('[data-hud-panel="header"]').getBoundingClientRect()`
        is `8,8 216×250` at 1280×800 and at 390×844, Δ ≤ 1 px per edge;
        `getComputedStyle` gives `border-radius: 11px` and
        `background-color: rgba(16, 22, 31, 0.72)`.
  - [ ] `[live]` **The grid is the canvas's grid.** On a planned floor,
        `document.querySelectorAll('[data-hud-map-room]').length` equals the number
        of `run.discoveredRooms` that the plan holds, counted on the canvas with the
        flag off on the same floor and save; `[data-current="true"]` is exactly one
        element and its `fill` computes to `rgb(246, 217, 138)` (`#f6d98a`).
  - [ ] `[live]` **The canvas draws nothing under the flag.** `mapDrawnObjectCount()`
        returns `0` with `?hud=dom` and > 0 with the flag off on the same save.
  - [ ] `[live]` **The card follows the route's pause.** Enter a wild battle and
        leave it: while the battle is up the header card is hidden (`hidden` or
        `display: none`), and after it the card is back with the same rect and the
        same room count as before the battle.

## 📣 Coordination

- **For the Orchestrator:** the flag is `?hud=dom`; the fixture slug is
  `03o-panels-map-routes`; the tests are `src/ui/hud/panels/map/view.test.ts` and
  `fixture.test.ts`. This panel is the **header** panel record (`hudPanel: 'header'`),
  not one of the four draggable cards, so its `open` is `panelExpanded(host, 'header')`
  and it has no quick-key chip of its own — `[Task-139]` owns the route HUD strip and
  its chips. As in Batch 61, the route gate is DOM-vs-Phaser rect parity plus the
  board's paint over CDP, **not** `npm run hud:diff` (that harness compares a whole
  screenshot against `design/screens/<slug>.png`, whose `<image>` layer is the
  board's own route world).
- **For the next batch:** `MapPanelView` carries the grid as one SVG and the markers
  as data, so if `[Task-139]` moves the header strip it can mount the same view. If a
  task ever needs the room tooltip, `mapPanelView` already exposes every room's box
  and id.

## ⛔ Out of scope

- No engine, `src/ui/mapView.ts`, save, `SAVE_VERSION` or RNG change: the reveal
  rules and the layout stay `buildMapView`'s.
- **No panning and no room tooltip.** The backlog line mentions both, but neither
  exists in the shipped panel (`map.ts`: "The header has nothing interactive"), in
  `src/ui/mapView.ts` (no `pan*`, no tooltip field) or in the board's `03o` frame
  (its text nodes are `M`, `ROUTE`, `MAP`, `VIRIDIAN FOREST` only). Adding them would
  be new interaction and a new contract, and no task owns it — see the report.
- No ROUTE / MAP segmented control, even though `03o` draws one (`view route` /
  `view map` at `1096,36`): the shipped header has no "route vs map" mode, so a
  control with one state would be dead UI.
- No canvas `drawMarker` artwork for the special rooms (the nine `drawMarker`
  functions are Phaser `Graphics` code in `src/scenes/rooms/*`, and those files are
  not in this task): the DOM paints the kind's documented tone dot.
- No i18n edit, no `hud:diff` change, no `design/tokens.json` change, no kit change.

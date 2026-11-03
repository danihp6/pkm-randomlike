# Spec: Task-281 — The header card is the region map

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (a Preact card) + one pure `src/ui/` view module + the scene
  module that feeds the card.
- **Role:** Dev.
- **Objective:** the header card (`03o Panels · map routes`) stops drawing one floor's
  rooms and draws the **whole region** the way FRLG's Town Map does: the plan's node
  graph as a straight-line graph, every settlement visible from the first frame, the
  visited ones marked, the node the run stands on marked current (and blinking), the
  run's badge count printed in the card, and no click anywhere. A new pure
  `src/ui/regionMap.ts` turns `RegionPlan` + the run's three node facts into markers and
  edges; the card is rebuilt on it and the floor minimap leaves the card.
- **Environment:** worktree `../wt-pkm-281`, branch `task-281`.
- **Dependencies (already merged on `main`):** the region plan —
  `src/engine/region/plan.ts` (`planRegion`, `RegionPlan`, `RegionNode`,
  `RegionNodeKind`, `nodeKey`, `parseNodeKey`) and `src/engine/region/names.ts`; the run's
  node fields — `src/engine/run/state.ts` (`RunState.nodeKey`, `visitedNodes`, `badges`);
  the badge ladder — `src/data/region.ts` (`BADGE_CAPS`).

### Exclusive paths (single writer)

Nothing outside this list. The whole `src/ui/hud/panels/map/` folder belongs to this
task this batch (no other task touches it), enumerated file by file:

- `src/ui/regionMap.ts` — **new**: the pure region-map view.
- `src/ui/regionMap.test.ts` — **new**.
- `src/ui/hud/panels/map/view.ts` — the panel's value model, rebuilt on `regionMapView`.
- `src/ui/hud/panels/map/view.test.ts` — rebuilt with it.
- `src/ui/hud/panels/map/fixture.test.ts` — the fixture's `HudState` test survives; its
  floor-paint test goes.
- `src/ui/hud/panels/map/specGap.test.ts` — the `03o` premise test, updated (not
  deleted).
- `src/ui/hud/panels/map/mapPanel.tsx` — paints the region nodes and edges.
- `src/ui/hud/panels/map/map.css` — the node, edge and badge styles.
- `src/ui/hud/panels/map/mount.tsx` — **claimed; no edit is expected** (its props keep
  their names). Touch it only if a typecheck forces it.
- `src/ui/hud/panels/map/index.ts` — the barrel's export list follows `view.ts`.
- `src/ui/hud/panels/map/README.md` — the folder map and its rules, rewritten for the
  region card.
- `src/ui/hud/specGap.views/map.ts` — the `03o` adapter, fed by the new view.
- `src/ui/README.md` — the `regionMap.ts` line.
- `src/scenes/panels/map.ts` — the scene module that feeds the card: it builds the plan
  once per seed and pushes the region view instead of the floor's `MapView`.
- `docs/region-spec.md` — **§5 only**, the last paragraph ("Neither half is shipped
  code yet…"). No other line of that file.

**Not** claimed, deliberately: `src/ui/hud/specGap.walk.test.ts`, `src/ui/mapView.ts`,
`src/ui/hud/specGap.ts`, `design/**` (screens, exports and fixtures),
`src/i18n/**`, `src/scenes/README.md`, `docs/tech-decisions.md`. See *Coordination*.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `design/screens/03o-panels-map-routes.json` and
  `design/exports/03o-panels-map-routes.png` — the imported frame this card answers for.
  Its `caption` is exactly **`03o Panels · map routes`** (middle dot included) and its
  `slug` is `03o-panels-map-routes`. The frame docks the card at `928, 24, 304 × 198`;
  the shipped card stays `8, 8, 216 × 250` (see *Out of scope*).
- `design/fixtures/03o-panels-map-routes.json` — read only.
- `docs/region-spec.md` §1 (the node kinds, the chain, the laterals), §2 (identity), §5
  (the map and flying — the paragraph this task rewrites).
- `docs/agent-spec-template.md`, `docs/agent-ci.md` §The `[live]` criteria (`D57`).
- `src/engine/region/plan.ts`, `src/engine/region/names.ts`,
  `src/engine/region/streams.ts`, `src/engine/run/state.ts`, `src/data/region.ts`.
- `src/ui/mapView.ts`, `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.walk.test.ts`,
  `src/ui/hud/panels/map/**` (the files being changed),
  `src/ui/hud/panels/hud/panelFrame.tsx` (`PanelFrame`, `panelFrameProps`,
  `PanelFrameMount`), `src/ui/hud/commands.ts`.
- `src/scenes/panels/types.ts` (`RoutePanelHost`), `src/scenes/panels/hud.ts`
  (`panelExpanded`, `panelFrameMount`), `src/scenes/panels/map.ts` (being changed),
  `src/scenes/RouteScene.ts` (the dev handle `__pkmRoute` and the
  `debugRouteContext()` shape — read only).
- `src/i18n/index.ts` (`t`) — read; the key table itself is another task's.

## 🔒 Contract

### `src/ui/regionMap.ts` (pure — no Preact, no DOM, no Phaser, no clock)

```ts
import type { RegionNodeKind, RegionPlan } from '../engine/region/plan';

/** The three run facts the region map reads. `RunState` satisfies this shape. */
export type RegionMapRun = Readonly<{
  /** The node the run stands on. */
  nodeKey: string;
  /** Every node the run has entered, in first-entry order. */
  visitedNodes: readonly string[];
  /** The badges held; only its length is drawn. */
  badges: readonly number[];
}>;

/** One node as the card draws it. */
export type RegionNodeMarker = Readonly<{
  /** `node.key` — the card's `data-hud-region-node` value. */
  key: string;
  kind: RegionNodeKind;
  /** `node.name` (`'Viridian Forest'`, `'Route 3'`, `'League'`). */
  name: string;
  /** The plan's own grid column/row, shifted so the whole graph starts at 0, 0. */
  x: number;
  y: number;
  visited: boolean;
  current: boolean;
}>;

/** One plan edge, each pair emitted once. */
export type RegionMapEdge = Readonly<{ from: string; to: string }>;

export type RegionMapView = Readonly<{
  /** The graph's extent in plan cells: `max(x) + 1`, `max(y) + 1`. */
  width: number;
  height: number;
  /** The current node's `name`, the card's title line; `''` when the plan holds no such node. */
  title: string;
  /** `run.badges.length`. */
  badges: number;
  /** `BADGE_CAPS.length` (8) — the ladder's own width, never a literal. */
  badgeTotal: number;
  /** One marker per plan node, in `plan.nodes` order. */
  markers: readonly RegionNodeMarker[];
  /** Every plan edge once, in `plan.nodes` order of its `from` end. */
  edges: readonly RegionMapEdge[];
}>;

export function regionMapView(plan: RegionPlan, run: RegionMapRun): RegionMapView;
```

Rules:

- **Positions.** `plan.nodes[i].position` is `{ x, y }` in plan cells and `y` can be
  negative (the plan jitters it by ±2 and puts laterals at ±3). The view shifts every
  marker by `(-minX, -minY)` so the graph starts at `0, 0` and `x`/`y` are never
  negative; `width`/`height` are `max + 1` of the shifted values. Two nodes never share a
  position (`plan.test.ts` pins it), so no marker overlaps another.
- `markers` is exactly `plan.nodes.map(...)`, one per node, in that order. A node is
  `visited` when `run.visitedNodes` holds its key and `current` when its key is
  `run.nodeKey`.
- `edges` carries every `node.edges` pair once: emit `{ from: key, to: neighbour }` only
  when the neighbour sits **later** in `plan.nodes`, and skip a neighbour the plan does
  not hold (`plan` holds every one today; the guard keeps the function total).
- `title` is the current node's `name` and `''` when `run.nodeKey` is not a plan node.
- `badges` is `run.badges.length`, `badgeTotal` is `BADGE_CAPS.length` imported from
  `../data/region` — never `8`.
- **Determinism:** reads no RNG, no clock, no store; the same two arguments always give
  a deep-equal result, and no argument is mutated.

### `src/ui/hud/panels/map/view.ts` (rebuilt; pure)

```ts
import type { RegionNodeKind } from '../../../../engine/region/plan';
import type { RegionMapEdge, RegionMapView } from '../../../regionMap';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** A node's dot: panel-relative centre, radius and state. */
export type RegionMarkerView = Readonly<{
  key: string;
  kind: RegionNodeKind;
  name: string;
  cx: number;
  cy: number;
  r: number;
  visited: boolean;
  current: boolean;
}>;

export type RegionEdgeView = RegionMapEdge &
  Readonly<{ x1: number; y1: number; x2: number; y2: number }>;

export type MapPanelView = Readonly<{
  open: boolean;
  /** Viewport coordinates; every rect below is panel-relative (measured from `box.x`/`box.y`). */
  box: Rect;
  highlight: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  /** The badge line, its text `${badges}/${badgeTotal}`, or null with no region. */
  badges: Readonly<{ text: string; box: Rect }> | null;
  /** `hud.noMap` in its own box while there is no region; null otherwise. */
  empty: Readonly<{ label: string; box: Rect }> | null;
  grid: Readonly<{ box: Rect; width: number; height: number; scale: number; dx: number; dy: number }>;
  edges: readonly RegionEdgeView[];
  /** One per marker, in `RegionMapView.markers` order. */
  nodes: readonly RegionMarkerView[];
}>;

/** The card's rect: `x = 8`, `y = 8`, `w = min(216, max(160, width - 16))`, `h = 250`. */
export function mapPanelBox(viewport: Viewport): Rect;

/** The card as data; `null` leaves the grid empty and prints `hud.noMap`. */
export function mapPanelView(region: RegionMapView | null, viewport: Viewport): MapPanelView;
```

Rules:

- `mapPanelBox` is unchanged from today: `MAP_PANEL_W = 216`, `MAP_PANEL_H = 250`,
  `MAP_MARGIN = 8`, `MAP_MIN_W = 160`, and it clamps on a narrow window exactly as now.
- The grid band is unchanged: `MAP_PAD_X = 20`, `MAP_TITLE_H = 50`,
  `MAP_PAD_BOTTOM = 12`, `MAP_CONTENT_LEFT = 30`.
- `scale = min(area.w / region.width, area.h / region.height)`, and the graph is centred
  in the band: `dx = area.x + (area.w - width * scale) / 2`,
  `dy = area.y + (area.h - height * scale) / 2` — the same arithmetic `gridLayout` does
  today, unchanged.
- A marker's centre is `dx + x * scale`, `dy + y * scale`; its radius is
  `max(MAP_NODE_MIN_R, min(scale, 8))` with `MAP_NODE_MIN_R = 3`. An edge's endpoints are
  its two markers' centres.
- `title.text` is `region.title`; `title.box` keeps today's box
  (`{ x: 30, y: 16, w: box.w - 50, h: 20 }`).
- `badges.text` is `${region.badges}/${region.badgeTotal}` — a bare figure, **no new
  i18n key** (`src/i18n/**` is another task's). Its box is
  `{ x: box.w - MAP_PAD_X - 32, y: 16, w: 32, h: 20 }`; `null` when `region` is null.
- `empty` is `{ label: t('hud.noMap'), box: { x: box.w / 2, y: MAP_TITLE_H + 56, w: box.w - 50, h: 20 } }`
  when `region === null`, and `null` otherwise.
- The view keeps the **floor minimap's constants out**: `MAP_SPECIAL_TONES`,
  `MAP_BOSS_FILL`, `MAP_CAPTURE_FILL`, `MAP_PORTAL_STROKE`, `MAP_ENTRY_STROKE`,
  `MAP_OPENING_STROKE`, `MAP_OPENING_MIN_GAP`, `MAP_OPENING_GAP_RATIO`, `MAP_ROOM_STROKE`
  and `MapRoomView`/`MapMarkerView`/`MapTone` are deleted with the floor. Keep
  `MAP_LINK_STROKE = 3` (the edge stroke's width) and `MAP_CURRENT_FILL = '#f6d98a'`,
  `MAP_CURRENT_STROKE = '#9a7a1f'` (the current node's fill/ring); add
  `MAP_VISITED_FILL = '#7dd3fc'` and `MAP_UNVISITED_FILL = '#94a3b8'` for the two other
  dot tones. Every constant is exported, and `view.test.ts` pins each.
- Pure: `open` is still stamped by the caller (`{ ...view, open: … }`).

### The card (`mapPanel.tsx`, `map.css`, `index.ts`)

- `MapPanel` keeps its props (`view`, `onCommand`) and its root
  `<div class="map" data-hud-panel="header" data-open hidden style=…>`.
- It renders, inside the one SVG, one element per node and one per edge:
  - `<g data-hud-region-node={node.key} data-kind={node.kind} data-visited={node.visited ? 'true' : 'false'} data-current={node.current ? 'true' : 'false'}>`
    holding one `<circle cx cy r>` (fill `MAP_CURRENT_FILL` when current, else
    `MAP_VISITED_FILL` when visited, else `MAP_UNVISITED_FILL`; stroke
    `MAP_CURRENT_STROKE` when current, `none` otherwise);
  - `<line data-hud-region-edge={`${edge.from}-${edge.to}`} x1 y1 x2 y2 stroke="var(--map-link)" stroke-width={MAP_LINK_STROKE}>`.
- It renders the badge line as
  `<span class="map__badges" data-hud-badge-count style=…>{view.badges.text}</span>` when
  `view.badges` is not null.
- `map.css` gains the node, edge and badge rules and a **blink** for the current node:
  `@keyframes map-node-pulse` (opacity 0.35 → 1 over 1.1 s, `infinite`) applied to
  `[data-hud-region-node][data-current="true"] circle`, under
  `@media (prefers-reduced-motion: reduce) { … animation: none }`. The blink is a CSS
  affordance and is **never** measured.
- `index.ts` re-exports exactly `MapPanel`, `MapPanelProps`, `mountMapPanel`,
  `mapPanelBox`, `mapPanelView`, the kept constants above and the types `Rect`,
  `Viewport`, `MapPanelView`, `RegionMarkerView`, `RegionEdgeView`. The deleted names
  leave the barrel; nothing outside this folder imports them (`grep -rn 'MAP_SPECIAL_TONES\|MAP_BOSS_FILL\|MAP_CAPTURE_FILL\|MAP_PORTAL_STROKE\|MAP_ENTRY_STROKE\|MAP_OPENING_STROKE\|MapRoomView\|MapMarkerView\|MapTone' src --include=*.ts --include=*.tsx`
  must name only files of this task's list).

### `src/scenes/panels/map.ts` (the feeder)

- The module keeps its descriptor (`id: 'map'`, `order: 10`, `hudPanel: 'header'`), its
  mount/pause/resume wiring and `mapDrawnObjectCount()` (still `0`).
- It drops `mapViewOf`, `mapTitle`, `portalOpen` and the `MapView`/`buildMapView` imports,
  and it builds the card's view as:

  ```ts
  const plan = planFor(host.run().seed);          // planRegion, cached per seed in this module
  const view = mapPanelView(regionMapView(plan, host.run()), viewport(host));
  return { ...view, open: !mapPaused && panelExpanded(host, 'header') };
  ```

  `host.run()` satisfies `RegionMapRun` structurally. The plan cache is one
  `Map<string, RegionPlan>` keyed by the run seed, cleared when the seed changes; a
  region's plan is pure and cheap but not rebuilt on every repaint.
- No click, no command, no `onCommand`: `mountMapPanel(layer, view, undefined, panelFrameMount(host, 'header'))`
  stays exactly as it is.

### `src/ui/hud/specGap.views/map.ts` (the `03o` adapter)

- It keeps `slug = '03o-panels-map-routes'` and `buildView(spec): PanelView`, stops
  importing the floor fixture, and builds the card from a **fixed seed of its own**:
  `regionMapView(planRegion('03o'), { nodeKey: 'town:1', visitedNodes: ['town:1'], badges: [] })`
  through `mapPanelView(...)` at `1280×800`.
- It claims **no box, no string and no colour** (`{ boxes: [], strings: [], colours: [] }`),
  because the shipped card is docked at `8, 8, 216 × 250` while the frame draws a
  `928, 24, 304 × 198` card and draws a ROUTE/MAP toggle the game does not have. The
  module's table comment is rewritten to say that the frame's **region map now exists
  in the game**, that the gap is the card's docking rect and the toggle, and what would
  turn each row into a claim. `gapIsEmpty(gapFor(...))` stays true, so
  `src/ui/hud/specGap.walk.test.ts` (not this task's file) keeps passing.

## 🧩 Data and configuration

Nothing. No new data table, no new JSON, no new i18n key, no new balancing value, no
change under `src/data/`. `BADGE_CAPS.length` is the badge total and `plan.nodes` is the
graph: the card reads both, it never retypes them.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the tests this task rewrites
  and adds, and `src/ui/hud/specGap.walk.test.ts` unchanged and green.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-281` audited against the exclusive paths list.
- Browser pass (the `[live]` criteria): `npm run dev` on the worktree, headless Chromium
  over CDP at `1280×800`, a run started from the main menu (main menu → starter → route).
  Press `M` once (the shipped `map` keybind, `M`) so the header card is open. The page
  can import a repository module in a `vite dev` build:
  `await import('/src/engine/region/plan.ts')`, and the run's seed is
  `__pkmRoute.run.seed` (the dev handle `__pkmRoute` exists in `vite dev`).

### Acceptance criteria

- [ ] `[unit]` `npm run build` is green.
- [ ] `[unit]` `npm test` is green; `src/ui/regionMap.test.ts` exists; the rewritten
      `view.test.ts`, `fixture.test.ts` and `specGap.test.ts` pass;
      `specGap.walk.test.ts` is untouched and passes.
- [ ] `[unit]` `regionMap.test.ts` pins, on `planRegion('task-281')`: the view has
      exactly `plan.nodes.length` markers, in plan order; the shifted `x`/`y` equal
      `node.position` minus the plan's minima, with `min x = 0`, `min y = 0`; `width` and
      `height` are `max + 1`; a run on `plan.townKey` flags that one marker `current` and
      no other; `visited` is exactly the plan nodes that `run.visitedNodes` names; every
      `node.edges` pair appears exactly once with both ends present; `title` is the
      current node's `name`; `badges`/`badgeTotal` are `run.badges.length` /
      `BADGE_CAPS.length`; two calls are deep-equal and neither argument was mutated.
- [ ] `[unit]` `regionMap.test.ts` pins the shifted-negative case: a plan whose
      `position.y` is negative on `plan.nodes[0]` still yields `min y = 0` (assert on the
      real plan's minimum, computed from `planRegion('task-281').nodes`).
- [ ] `[unit]` `view.test.ts` pins: `mapPanelBox` is `{ x: 8, y: 8, w: 216, h: 250 }` at
      `1280×800` and at `390×844`, and clamps to `184` / `160` on a 200 / 100 px window;
      one `RegionMarkerView` per marker in order; `cx`/`cy` equal
      `dx + x * scale` / `dy + y * scale` with `scale = min(176 / width, 188 / height)`;
      the centring; each edge's endpoints are its two markers' centres; `badges.text` is
      `'0/8'` for an empty badge list and `'3/8'` for three; `mapPanelView(null, DESKTOP)`
      yields no nodes, no edges, a `hud.noMap` label and `badges === null`; the exported
      constants keep their values; two calls deep-equal.
- [ ] `[unit]` Nothing outside the exclusive paths was touched
      (`git diff --name-only main...task-281`).
- [ ] `[live]` At `1280×800` after pressing `M`, the card holds one element per plan
      node. Measured over CDP:
      `document.querySelectorAll('[data-hud-region-node]').length` equals
      `(await import('/src/engine/region/plan.ts')).planRegion(__pkmRoute.run.seed).nodes.length`,
      and every element's `data-hud-region-node` value is a key of that plan.
- [ ] `[live]` Exactly one node is the current one, and it is the run's:
      `document.querySelectorAll('[data-hud-region-node][data-current="true"]').length === 1`
      and that element's `data-hud-region-node` equals `__pkmRoute.run.nodeKey`.
- [ ] `[live]` The visited marks are the run's own:
      `[...document.querySelectorAll('[data-hud-region-node][data-visited="true"]')].map(e => e.dataset.hudRegionNode)`
      sorted equals `__pkmRoute.run.visitedNodes` filtered to plan keys, sorted.
- [ ] `[live]` The badge line prints the run's badges:
      `document.querySelector('[data-hud-badge-count]').textContent` is
      `` `${__pkmRoute.run.badges.length}/8` `` (a fresh dev run reads `0/8`).
- [ ] `[live]` The card draws edges and no floor box: the
      `[data-hud-region-edge]` count equals the plan's undirected edge count
      (`planRegion(seed).nodes.reduce((n, node) => n + node.edges.length, 0) / 2`) and
      `document.querySelectorAll('[data-hud-map-room]').length === 0`.

## 📣 Coordination

- **For the Architect — what this spec had to fix in the item:**
  1. The item says "the region plan (Batch 117) carries **`col`/`row`** per node". It
     does not: `RegionNode.position` is `{ x, y }` in plan cells (and `y` is negative for
     some nodes). The whole contract above is written against `position.x` /
     `position.y`, and `regionMapView` shifts them so the card draws from `0, 0`.
  2. The item's *Claims* line names `src/ui/hud/panels/map/**` only by folder through
     its hot-file paragraph, and never names **`src/scenes/panels/map.ts`** — the scene
     module that feeds the card. Without it the card can only be fed by the floor, so the
     task is impossible; it is added to the exclusive paths, it is not claimed by any
     other task in this batch, and no batch-mate writes it.
  3. Two files inside the folder had to be added to the item's list for the same reason:
     `fixture.test.ts` (it calls `mapPanelView` with a floor `MapView` and stops
     compiling) and `mapPanel.tsx` (the card is the thing that must draw the nodes).
  4. `src/ui/hud/panels/map/map.css` and `index.ts` likewise follow the view model.
  5. The item does not say the card moves. It does **not**: the card stays the shipped
     `8, 8, 216 × 250` dock, so the `03o` adapter keeps claiming nothing. The frame's
     own rect and its ROUTE/MAP toggle are the gap the adapter's table now states.
  6. `D64` is **not** written (see the note on `docs/tech-decisions.md` in the
     `[Task-280]` spec): the item's *Claims* line does not name that file, the numbers
     `D65`/`D66` were never written by the merged previous batch, and two appending
     tasks would collide. The three facts for the record are: the region map is a DOM
     straight-line graph, it is fed only by the pure `regionMapView(plan, run)`, and it
     wires no click (the travel task dispatches it).
- **For the next batch — what it may assume:**
  - `regionMapView(plan, run)` and its four types (`RegionMapRun`, `RegionNodeMarker`,
    `RegionMapEdge`, `RegionMapView`) are frozen; `RegionMapView.markers` carries exactly
    one entry per plan node with its `key`, `kind`, `name`, `visited`, `current`, and
    `edges` carries each pair once.
  - Every node in the card is one `[data-hud-region-node="<key>"]` element, and it is
    **not** clickable yet. The travel task dispatches the flight; it reads the node key
    off that attribute and should not need to change `view.ts`.
  - `mapPanelView(region, viewport)` takes no title argument any more: the title is the
    current node's `name`, carried by `RegionMapView.title`. A scene that needs a
    different title must change the view, not the card.
  - The card prints `badges/badgeTotal` with **no new i18n key**, so the i18n task does
    not owe it a string; the only key the card still reads is `hud.noMap`.
  - `route.mapTitle` stops being read by this card. The key stays in `en.ts`/`es.ts`
    because `src/i18n/**` belongs to the i18n task, which deletes its dead keys.
  - `src/ui/mapView.ts`, `buildMapView` and the floor `MapView` are **untouched** and
    still feed nothing in the HUD; they die with the sweep task.
- **For `[Task-280]`:** this task does not touch a scene other than
  `src/scenes/panels/map.ts`, and does not touch `src/main.ts`, `vite.config.ts`,
  `src/render/**`, `src/workers/**` or `src/engine/region/**`.

## ⛔ Out of scope

- **No click and no travel:** the card dispatches no command, mounts no handler and
  knows nothing about flying. `[Task-283]` wires it.
- No moving or resizing of the card: the shipped `8, 8, 216 × 250` dock stays. Adopting
  the frame's `304 × 198` rect, its ROUTE/MAP toggle and its `key map` chip is a
  separate, measured panel task (`D57`: fidelity is read from the imported spec, not
  from a screenshot).
- No new i18n key, no edit under `src/i18n/**`, no edit of `design/**` (screens,
  exports, fixtures), no edit of `src/ui/mapView.ts`, `src/ui/hud/specGap.ts` or
  `src/ui/hud/specGap.walk.test.ts`.
- No legend, no biome tint per route, no route labels, no fly-cost display, no mission
  markers on the card.
- No `RegionPlan` change, no `RunState` change, no new engine module.

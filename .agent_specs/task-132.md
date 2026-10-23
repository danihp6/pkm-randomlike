# Spec: Task-132 — the party detail panel is the HUD's

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene + DOM HUD migration (`D49`).
- **Role:** Dev.
- **Objective:** under `?hud=dom` the member detail panel (the route's STATS / MOVES
  window: name, level, status, types, the six stats with the nature tint, nature,
  ability with its ⓘ, held item, caught line, the evolution graph, the draggable
  four-slot move grid with its ⓘ, the search field, the learnset pool and the
  nickname field) is a Preact card in the `#hud` layer, rendered from a pure view
  model, with the evolution graph as **SVG**. `src/scenes/panels/detail.ts` keeps
  its `descriptor`, its exported function names (other modules call them) and its
  layout arithmetic, but draws **no Phaser object** and dispatches **no canvas
  pointer** under the flag; with the flag off it behaves exactly as it does today.
  Either way the run is only ever written by the scene module, through
  `RoutePanelHost.commitRun` and the engine rules it already calls.
- **Environment:** worktree `../wt-pkm-132`, branch `task-132`.
- **Dependencies:** `[Task-124]` (`src/ui/hud/mount.ts`, `shell.tsx` — the `#hud`
  layer and its parser), `[Task-125]` (`src/ui/hud/kit/**` — `Panel`, `Row`, `Chip`,
  `Meta`, `TypeBadge`), `[Task-127]` (`?hud=dom` proven on `02-options`),
  `[Task-128]` (`src/scenes/panels/types.ts`'s `RoutePanelHost`, and the
  `descriptor` registry that discovers this module). Shipped, merged, read as the
  pattern to copy: `[Task-129]` `src/scenes/panels/bag.ts`,
  `[Task-130]` `src/scenes/panels/pc.ts`, `[Task-131]`
  `src/scenes/panels/party.ts`.

### Exclusive paths (single writer)

- `src/scenes/panels/detail.ts`
- `src/ui/hud/panels/detail/**` (new folder)
- `design/fixtures/03m-panels-pokemon-moves.json` (new file)

Nothing else. In particular you may **not** touch `src/scenes/RouteScene.ts`,
`src/scenes/panels/hud.ts`, `src/scenes/panels/pc.ts`, `src/scenes/panels/pause.ts`,
`src/ui/partyDetail.ts`, `src/ui/evolutionGraph.ts`, `src/ui/moveGrid.ts`,
`src/ui/hud/commands.ts`, `src/ui/hud/state.ts`, `src/i18n/**` or any
`src/ui/hud/panels/README.md` / `src/scenes/panels/README.md`. Those two READMEs
already list `detail/` and `detail.ts`; **no line of them changes**.

`src/ui/hud/panels/detail/README.md` is **yours to create** (one role line per file,
no exported names) — it lives inside your own folder.

### Inputs (read-only)

- `docs/agent-spec-template.md`, `docs/tech-decisions.md` (`D49`),
  `docs/hud-fidelity.md` (§2 type scale, §4 palette, §5 panel geometry),
  `docs/hud-dom-proposal.md`, `docs/design-spec.md` §5 (the detail window).
- `src/scenes/panels/detail.ts` (the panel you are migrating: every constant and
  every rule you must mirror), `src/scenes/panels/types.ts`,
  `src/scenes/panels/hud.ts` (`HUD_DETAIL_W`, `hudMetrics`, `dockDetailPanelOnce`,
  `panelExpanded`, `panelById`, `makeHudPanel`, `PANEL_ICON_KEYS.detail`).
- `src/ui/partyDetail.ts` (`MemberDetail`, `MoveDetail`, `DetailState`,
  `natureEffect`, `statLabel`, `memberDetail`, `DETAIL_STATS`),
  `src/ui/evolutionGraph.ts` (`FamilyNode`), `src/ui/moveGrid.ts`
  (`MoveGridCell`, `padMoveGridCells`, `moveGridCellRects`, `moveGridInfoAt`),
  `src/ui/frlg.ts`, `src/ui/typeColors.ts`.
- `src/engine/run/learnset.ts` (`LearnEntry`, `learnsetPool`, `equipMove`,
  `unequipMove`), `src/engine/run/nickname.ts` (`NICKNAME_MAX_LENGTH`,
  `normalizeNickname`, `renameMember`), `src/engine/run/state.ts` (`moveMoves`),
  `src/engine/run.ts` (`evolveMember`, `MAX_MOVES`, `RunPokemon`).
- The shipped DOM panels as the seam to copy: `src/ui/hud/panels/bag/*`,
  `src/ui/hud/panels/party/*`, `src/ui/hud/fixtures/index.ts` (`isHudState`),
  `src/ui/hud/styles/root.css` (`--hud-*`).
- The board: `design/frames/03m-panels-pokemon-moves.json` (r1280),
  `design/frames/m03m-panels-pokemon-moves.json` (r390) and
  `design/screens/03m-panels-pokemon-moves.png` / `m03m-…png` (reference images,
  never edited), plus `design/frames/03b-panels-row-view.json` and
  `03c-panels-compress.json` for the card's paint. `design/tokens.json` is the only
  place a colour, radius or type size is read from.
- `src/i18n/en.ts` (the keys listed under **Data and configuration**), `src/i18n`.

## 🔒 Contract

Everything below is a promise. Exact names, exact signatures.

### `src/ui/hud/panels/detail/view.ts` — the pure layout model

```ts
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The MOVES tab's pool row, as the scene hands it over (no engine import here). */
export type DetailPoolRow = Readonly<{
  moveId: string;
  name: string;
  type: string;
  /** `Lv 12`, `TM31` or `Tutor` — from the i18n keys `detail.learnLevel` / `detail.learnTm` / `detail.learnTutor`. */
  source: string;
  enabled: boolean;
}>;

/** The panel's own cursor state. The scene module owns it; the panel paints it. */
export type DetailPanelUi = Readonly<{
  tab: 'stats' | 'moves';
  /** The move slot under the cursor (0…3), or -1. */
  cursor: number;
  /** The learnset pool's scroll offset in rows (0…). */
  page: number;
  /** The pool row under the cursor inside its window, or -1. */
  poolCursor: number;
  /** The move slot whose ⓘ is pinned, or null. */
  info: number | null;
  /** True while the ABILITY ⓘ is pinned. */
  abilityInfo: boolean;
  /** The slot held by a drag, or null. */
  grab: number | null;
  /** The nickname buffer while the field is being edited, or null. */
  nickname: string | null;
}>;

export type DetailStatView = Readonly<{
  stat: StatId;
  label: string;
  value: string;
  effect: 'up' | 'down' | 'neutral';
  box: Rect;
  labelBox: Rect;
  valueBox: Rect;
}>;

export type DetailMoveSlotView = Readonly<{
  index: number;
  moveId: string | null;
  name: string;
  type: string;
  category: string;
  pp: string;      // `t('move.pp', …)`
  power: string;   // `t('move.pwr' | 'move.pwrNone', …)`
  accuracy: string;// `t('move.acc' | 'move.accNone', …)`
  desc: string;
  selected: boolean;
  /** False for an empty slot and for a slot the run cannot equip (a locked TM). */
  enabled: boolean;
  box: Rect;
  /** The ⓘ hit box, cell-relative (the canvas's own `moveGridInfoAt` box). */
  info: Rect;
}>;

export type DetailPoolRowView = Readonly<{
  index: number;
  moveId: string;
  name: string;
  type: string;
  source: string;
  enabled: boolean;
  selected: boolean;
  box: Rect;
}>;

export type DetailEvolutionRowView = Readonly<{
  id: string;
  name: string;
  row: number;
  depth: number;
  /** The row of the node this edge comes from, or null for the family's root. */
  parent: number | null;
  level: string | null; // `t('detail.evoLevel', …)` or null
  current: boolean;
  ready: boolean;
  kind: 'species' | 'mega' | 'gmax';
  /** Row-relative text origin; the portrait cell is `{x, y, w: 26, h: 26}`. */
  x: number;
  y: number;
}>;

export type DetailEvolutionView = Readonly<{
  title: string;        // `t('detail.evolution')`
  empty: string;        // `t('detail.noEvolution')`
  box: Rect;            // the SVG's own box, panel-relative
  rows: readonly DetailEvolutionRowView[];
  edges: readonly Readonly<{ fromRow: number; toRow: number; d: string }>[];
}>;

export type DetailPanelView = Readonly<{
  open: boolean;
  box: Rect;                 // viewport coordinates
  highlight: Rect;           // panel-relative
  name: string;
  level: string;             // `t('common.level', …)`
  statusLabel: string | null;
  types: readonly Readonly<{ type: string; box: Rect }>[];
  tabs: readonly Readonly<{ tab: 'stats' | 'moves'; label: string; active: boolean; box: Rect }>[];
  stats: readonly DetailStatView[];
  nature: string;            // `t('detail.nature', …)`
  ability: string;           // `t('detail.ability', …)`
  abilityDesc: string | null;
  abilityInfo: Readonly<{ pinned: boolean; box: Rect }> | null;
  held: string;              // `t('detail.held', …)`
  caught: string;            // `t('detail.caughtLabel', …)`
  evolution: DetailEvolutionView | null; // null off the STATS tab or with no family
  moves: readonly DetailMoveSlotView[];
  emptyMoves: string | null;  // `t('detail.noMoves')` while the MOVES tab is empty
  search: Readonly<{ value: string; placeholder: string; box: Rect }>;
  pool: readonly DetailPoolRowView[];
  emptyPool: string | null;   // `t('detail.noMovesToLearn')`
  nickname: Readonly<{ value: string; placeholder: string; editing: boolean; box: Rect }>;
  /** `t('detail.clickToName')` / `t('detail.clickToEvolve')`, drawn as the panel's hints. */
  hints: Readonly<{ name: string; evolve: string }>;
}>;

export const DETAIL_PANEL_W = 460;   // HUD_DETAIL_W
export const DETAIL_PANEL_H = 560;   // HUD_DETAIL_H
export const DETAIL_TABS_TOP = 72;   // HUD_DETAIL_TABS_TOP
export const DETAIL_TAB_H = 26;      // HUD_DETAIL_TAB_H
export const DETAIL_CONTENT_TOP = 108; // HUD_DETAIL_CONTENT_TOP
export const DETAIL_STAT_ROW = 26;   // HUD_DETAIL_STAT_ROW
export const DETAIL_INFO_ROW = 22;   // HUD_DETAIL_INFO_ROW
export const DETAIL_MOVE_GRID_H = 188; // HUD_DETAIL_MOVE_GRID_H
export const DETAIL_POOL_ROWS = 2;   // HUD_DETAIL_LEARN_ROWS
export const DETAIL_POOL_COLS = 2;   // HUD_DETAIL_LEARN_COLS

export function detailPanelBox(viewport: Viewport): Rect;
export function initialDetailPanelUi(): DetailPanelUi;
export function detailPanelView(
  detail: MemberDetail | null,
  pool: readonly DetailPoolRow[],
  ui: DetailPanelUi,
  viewport: Viewport,
): DetailPanelView;
```

`detailPanelView` is **pure and total**: same `(detail, pool, ui, viewport)` ⇒
deep-equal view; `detail === null` returns a view with `open: false` and empty
lists; no throw for any `ui` (clamp `cursor` to `0…moves.length-1`, `page` to
`0…max(0, pool.length - DETAIL_POOL_ROWS * DETAIL_POOL_COLS)`, `poolCursor` to the
window).

`detailPanelBox` mirrors `buildDetailPanel` + `hudMetrics` + `pc.ts`'s box corner,
all from the viewport alone:

```
panelW   = min(344, max(160, width - 16))
column   = width - panelW - 8            // hudColumnLeft
boxX     = max(8, column - panelW - 8)   // pc.ts's boxX
boxY     = 72                            // HUD_TOP 8 + 64
detailW  = min(460, max(160, width - 16))
padX     = detailW < 460 ? 12 : 20
x        = max(8, boxX - detailW - 8)
y        = boxY
h        = 560
```

So `detailPanelBox({width:1280,height:800}) = {x:108,y:72,w:460,h:560}` and
`detailPanelBox({width:390,height:844}) = {x:8,y:72,w:374,h:560}`.

### `src/ui/hud/panels/detail/evolution.ts` — the graph as SVG data

```ts
export type EvolutionEdge = Readonly<{ fromRow: number; toRow: number; d: string }>;
export const EVO_ROW_H = 28;      // HUD_DETAIL_EVO_ROW_H
export const EVO_INDENT = 34;     // HUD_DETAIL_EVO_INDENT
export const EVO_MAX_ROWS = 9;    // HUD_DETAIL_EVO_MAX
export const EVO_PORTRAIT = 26;   // 64 × HUD_DETAIL_EVO_PORTRAIT_SCALE 0.4, rounded
export const EVO_PAD_X = 8;
export function evolutionView(
  nodes: readonly FamilyNode[],
  width: number,
): Readonly<{ height: number; rows: readonly DetailEvolutionRowView[]; edges: readonly EvolutionEdge[] }>;
```

Deterministic geometry, exactly:

- `rows = nodes.slice(0, EVO_MAX_ROWS)`; `height = rows.length * EVO_ROW_H`.
- row `i`'s text origin is `x = EVO_PAD_X + EVO_INDENT * depth`, `y = i * EVO_ROW_H`.
- the `level` label (when `node.level !== null`) is right-aligned at `width - EVO_PAD_X`
  and vertically centred in its row.
- one edge per row whose `parent !== null`: `parent` is the parent row, and
  `d = 'M ' + (parentX + EVO_PORTRAIT) + ' ' + rowMid(parent) + ' H ' +
  (parentX + EVO_INDENT / 2) + ' V ' + rowMid(child) + ' H ' + childX`, where
  `rowMid(i) = i * EVO_ROW_H + EVO_ROW_H / 2`, `parentX`/`childX` are the two
  rows' `x`. No other path syntax: the test pins the strings for `03m`'s family.
- `current` rows and `ready` rows are **not** geometry: they are flags the CSS
  paints (accent `--hud-accent` and `--hud-positive`).

### `src/ui/hud/panels/detail/mount.tsx`

```ts
export function mountDetailPanel(
  host: Element,
  view: Signal<DetailPanelView>,
  onIntent?: ((intent: DetailIntent) => void) | undefined,
): () => void;
```

Same shape as `mountBagPanel` / `mountPartyPanel`: create a `<div class="detail-mount">`,
append it to `host`, render on every `view` change, return an idempotent disposer
that unsubscribes, `render(null, …)`s and removes its container.

```ts
/** The panel's own command channel: plain data, never a run, never a Phaser object. */
export type DetailIntent =
  | Readonly<{ type: 'tab'; tab: 'stats' | 'moves' }>
  | Readonly<{ type: 'cursor'; index: number }>
  | Readonly<{ type: 'poolCursor'; index: number }>
  | Readonly<{ type: 'page'; delta: number }>
  | Readonly<{ type: 'search'; query: string }>
  | Readonly<{ type: 'info'; index: number | null }>
  | Readonly<{ type: 'abilityInfo'; open: boolean }>
  | Readonly<{ type: 'grab'; index: number }>
  | Readonly<{ type: 'drop'; slot: number }>
  | Readonly<{ type: 'equip'; moveId: string }>
  | Readonly<{ type: 'unequip'; slot: number }>
  | Readonly<{ type: 'evolve'; into: string }>
  | Readonly<{ type: 'nickname'; begin: true } | { type: 'nickname'; commit: string } | { type: 'nickname'; cancel: true }>;
```

**This type does not extend `HudCommand`** and `src/ui/hud/commands.ts` is not edited:
the detail panel's interaction set has no equivalent in the shared union, and the
`src/ui/hud/commands.ts` owner is not in this batch. The scene module is the only
receiver, and it is the only writer of the run (see below). State that in
`src/ui/hud/panels/detail/README.md`.

### `src/ui/hud/panels/detail/index.ts` — the barrel

```ts
export { DetailPanel } from './detailPanel';
export type { DetailPanelProps } from './detailPanel';
export { mountDetailPanel } from './mount';
export type { DetailIntent } from './mount';
export { EVO_INDENT, EVO_MAX_ROWS, EVO_PORTRAIT, EVO_PAD_X, EVO_ROW_H, evolutionView } from './evolution';
export {
  DETAIL_CONTENT_TOP, DETAIL_INFO_ROW, DETAIL_MOVE_GRID_H, DETAIL_PANEL_H, DETAIL_PANEL_W,
  DETAIL_POOL_COLS, DETAIL_POOL_ROWS, DETAIL_STAT_ROW, DETAIL_TAB_H, DETAIL_TABS_TOP,
  detailPanelBox, detailPanelView, initialDetailPanelUi,
} from './view';
export type {
  DetailEvolutionRowView, DetailEvolutionView, DetailMoveSlotView, DetailPanelUi,
  DetailPanelView, DetailPoolRow, DetailPoolRowView, DetailStatView, Rect, Viewport,
} from './view';
```

### DOM contract (`detailPanel.tsx`) — the attributes QA reads

The card is `div.detail` with `data-hud-panel="detail"`, `data-open="true"|"false"`
and `hidden={!view.open}`, `position: fixed` at `view.box`. Inside it, these
attributes are **required** (QA's `[live]` criteria read them and nothing else):

- `data-hud-detail="highlight" | "chip" | "tabs" | "stats" | "evolution" | "moves" | "search" | "pool" | "nickname" | "ability-info"`
- `data-hud-detail-name` — the header name element.
- `data-hud-detail-tab="stats" | "moves"` on each tab button, with `aria-pressed`.
- `data-hud-detail-stat="<StatId>"` on each stat row.
- `data-hud-detail-evo` on the **`<svg>`** wrapper; `data-hud-detail-evo-row="<row>"`
  on each `<g>`, with `data-current="true"` on the current row and
  `data-hud-detail-evo-ready="true"` on a ready one; the ready row is a `<g
  role="button" tabindex="0">`, the others are plain groups.
- `data-hud-detail-slot="<0…3>"` on each move cell button, `aria-pressed` for
  `selected`, `data-hud-detail-info="<index>"` on its ⓘ button.
- `data-hud-detail-pool="<index>"` (index inside the window) and
  `data-hud-detail-pool-move="<moveId>"` on each pool row.
- `data-hud-detail="search"` on the `<input type="text">` and
  `data-hud-detail="nickname"` on the nickname `<input type="text">`.
- Every control is a real `<button type="button">` (or `<input>`), so a press is a
  click and the 44 × 44 hit area comes from `kit.css`'s rule, never from a new one.

The panel answers in `DetailIntent`s only: a press on an evolution row sends
`{ type: 'evolve', into }`, a move cell `{ type: 'cursor', index }` and on double
press `{ type: 'grab' | 'drop' }`, a pool row `{ type: 'equip', moveId }`, the ⓘ
`{ type: 'info', index }`, a tab `{ type: 'tab', tab }`, the search field
`{ type: 'search', query }` and the nickname field `{ type: 'nickname', … }`.

### `src/scenes/panels/detail.ts` — the seam

The module **keeps every export it has today** with the same signature, because
`src/scenes/RouteScene.ts` and `src/scenes/panels/pause.ts` import them and neither
is in this task: `openMemberDetail`, `closeMemberDetail`, `refreshDetail`,
`detailOpen`, `detailHover`, `clearDetailInfo`, `cancelDetailDrags`,
`cancelNicknameEdit`, `typeInNickname`, `detailTextFieldFocused`,
`typeInDetailSearch`, `learnPopupOpenNow`, `dismissLearnPopup`, `closeLearnPopup`,
`showLearnPopup`, `scrollLearnset`, `pointerInLearnBand`, `descriptor`.

Edits, in the shape `bag.ts` / `pc.ts` / `party.ts` already use:

1. Module scope: `const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;`
   (import `parseHudFlags` from `../../ui/hud/fixtures`).
2. `descriptor.build(host)`: `if (DOM_HUD) { buildDom(host); return; } … existing body …`.
   `buildDom` repeats the existing layout arithmetic (`hudDetailX/Y`, `HUD_DETAIL_H`,
   `makeHudPanel(host, 'detail', …)`), then hides everything it built
   (`panel.container.setVisible(false)`, `panel.icon.setVisible(false)`,
   `body.remove(panel.border)` the way `pc.ts` does), creates a `signal(...)` and
   calls `mountDetailPanel(layer, view, (intent) => runDetailIntent(host, intent))`.
   Nothing on the learn popup, the ghost or the `MoveGrid` is created under the flag.
3. `descriptor.refresh`: `if (DOM_HUD) { pushDomView(host); return; } …` where
   `pushDomView` builds the `MemberDetail` with `memberDetail(host.run(), id)`, the
   pool with `learnsetPool(host.run(), member)` mapped to `DetailPoolRow`, sets the
   view's `open` to `!detailPaused && panelExpanded(host, 'detail')`, and assigns
   `view.value` **once**. No allocation per frame: it runs from the descriptor only.
4. `descriptor.pointer` and `descriptor.key`: return `false` under the flag (the
   seven canvas pointer phases are the shipped ones and stay untouched off it).
5. `descriptor.close(host)`: under the flag, unsubscribe the scene events, dispose
   the mount, reset `hudDetailState = CLOSED_DETAIL`, drop the view signal and clear
   the module state the way `pc.ts`'s `closeDom` does.
6. Subscribe `pause` / `resume` on `host.scene.events` (names spelled out as
   `pc.ts`'s `SCENE_PAUSE`/`SCENE_RESUME`) so a battle or the Settings screen
   over the route hides the card and the resume brings it back as it was.
7. **The opener.** Under the flag `RouteScene`'s canvas pointer path never reaches
   `openMemberDetail` (the party rows are DOM buttons that send
   `{ type: 'member' }` to `party.ts`). `buildDom` therefore installs, on the same
   `#hud` element, one delegated `click` listener that opens the member whose
   `[data-hud-party-member]` was pressed:
   `openMemberDetail(host, <that attribute's value>)`, ignored while paused and
   while the value names no member of `host.run()`. `closeDom` removes it. Do not
   add a second opener for `[data-hud-pc-cell]` (that attribute carries an index, and
   the PC panel's own press already withdraws that member).
8. `runDetailIntent(host, intent)` — the only writer. It mutates **only** through the
   functions already imported by this module and only commits through the host:
   - `tab` / `cursor` / `poolCursor` / `page` / `search` / `info` / `abilityInfo` /
     `grab` / `drop` / `nickname begin|cancel`: panel-local state only
     (`hudDetailState`, `hudLearnQuery`, `hudLearnScrollTop`, …), then
     `pushDomView(host)`. No run write.
   - `evolve`: `evolveMember(host.run(), memberId, into)` then
     `if (next !== run) host.commitRun(next)`.
   - `equip`: `equipMove(run, memberId, moveId)`; `unequip`: `unequipMove(run, memberId, slot)`;
     `drop` onto another slot: `moveMoves(run, memberId, from, to)`.
   - `nickname commit`: `renameMember(run, memberId, normalizeNickname(value))`.
   Every one of those is `next !== run ? host.commitRun(next) : pushDomView(host)`,
   exactly as `pc.ts`'s `pressDomCell` and `party.ts`'s `runPanelCommand` do.
9. `*DrawnObjectCount`: add `export function detailDrawnObjectCount(): number` that
   returns `0` under the flag and the shipped body's `list.length` otherwise (the
   probe the flag contract uses; `bag.ts`/`party.ts` have the same one).

**Determinism:** this task reads no `Rng` stream, draws no random number and reads
no clock. `memberDetail` / `learnsetPool` / `evolutionGraph` are the shipped pure
readers, called with the live run; the panel is a projection, so a fixed save shows
the same panel.

**Rules:** `view.ts` / `evolution.ts` import no Phaser, touch no DOM, no `src/data/**`
except type names, and contain no `Math.random`/`Date.now`. Only `*.tsx`/`mount.tsx`
import Preact. No new dependency.

### Data

- No engine, save, `SAVE_VERSION` or RNG change.
- New fixture: **`design/fixtures/03m-panels-pokemon-moves.json`** (below).
- No i18n key is added. The panel renders with existing keys: `detail.tabStats`,
  `detail.tabMoves`, `detail.hp`, `detail.stat.*`, `detail.nature`, `detail.ability`,
  `detail.held`, `detail.none`, `detail.caught`, `detail.caughtLabel`,
  `detail.starter`, `detail.clickToName`, `detail.clickToEvolve`, `detail.evolution`,
  `detail.noEvolution`, `detail.noMoves`, `detail.noMovesToLearn`, `detail.searchMoves`,
  `detail.evoLevel`, `detail.learnLevel`, `detail.learnTm`, `detail.learnTutor`,
  `move.pp`, `move.pwr`, `move.pwrNone`, `move.acc`, `move.accNone`, `common.level`,
  `common.unknownPokemon`. `src/i18n/**` is **not** edited.

## 🧩 Data and configuration

`design/fixtures/03m-panels-pokemon-moves.json` — the frame's own copy, so the panel
can be built from it headlessly (the same shape `design/fixtures/02-options.json`
established: `{ slug, state, <panel block> }`, extra keys allowed):

```json
{
  "slug": "03m-panels-pokemon-moves",
  "state": { "party": [], "bag": [], "money": null, "route": null, "battle": null, "notice": null },
  "detail": { "id": "fixture-charizard", "speciesId": "charizard", "name": "CHARIZARD",
              "nickname": null, "level": 36, "types": ["fire", "flying"],
              "nature": "adamant", "ability": "Blaze", "abilityDesc": "…",
              "hp": 98, "maxHp": 112, "status": null, "statusLabel": null,
              "heldItemName": null,
              "stats": { "hp": 112, "atk": 84, "def": 78, "spa": 109, "spd": 85, "spe": 100 },
              "moves": [ /* four MoveDetail rows, `name` exactly the frame's strings:
                            FLAMETHROWER pp 15/15 pwr 90 acc 100, AIR SLASH 15/15 75 95,
                            DRAGON CLAW 10/10 80 100, EARTHQUAKE 10/10 100 100 */ ],
              "caughtLabel": null,
              "evolutions": [ /* FamilyNode rows for charmander → charmeleon → charizard,
                                 with charizard `current` and the two Mega rows as `mega` */ ] },
  "pool": [ { "moveId": "razorleaf", "name": "RAZOR LEAF", "type": "grass", "source": "Lv 12", "enabled": true },
            { "moveId": "leechseed", "name": "LEECH SEED", "type": "grass", "source": "Lv 15", "enabled": true } ],
  "ui": { "tab": "moves", "cursor": 0, "page": 0, "poolCursor": 0, "info": null,
          "abilityInfo": false, "grab": null, "nickname": null }
}
```

- `state` is the empty `HudState` (it must pass `isHudState` unchanged): this panel
  reads `MemberDetail`, not `HudState`, exactly like `02-options` carries its own
  `panel` block. State that in the folder README.
- The `detail` numbers are the frame's (`CHARIZARD`, `LV 36`, four moves, the PP /
  PWR / ACC strings above); `evolutions` is derived once from `evolutionGraph('charmander', 36)`
  and pasted, so the graph's rows/edges are pinned without a dex read.
- `pool` is the frame's learnset band (RAZOR LEAF, LEECH SEED, FLAMETHROWER, AIR SLASH,
  DRAGON CLAW, EARTHQUAKE …), two visible rows at a time (`DETAIL_POOL_ROWS × DETAIL_POOL_COLS`).
- `ui` pins the MOVES tab open on slot 0 with nothing pinned.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the three
    `src/ui/hud/panels/detail/*.test.ts` files this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-132` audited against **Exclusive paths**.
  - `node -e "JSON.parse(require('fs').readFileSync('design/fixtures/03m-panels-pokemon-moves.json','utf8'))"`
    — the fixture parses.
  - The browser pass is needed for criteria tagged `[live]` only; every other
    criterion is a headless command.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/ui/hud/panels/detail/view.test.ts` exists and passes, and pins:
        `detailPanelBox` = `{108,72,460,560}` at 1280×800 and `{8,72,374,560}` at
        390×844; the two tabs at `y = 72 + 72`, `w = 208` desktop / `173` mobile,
        gap 4; the six stat rows at `y = 180 + 26·i`, at `x = 128` and `x = 338`
        (desktop) and `x = 20` and `x = 195` (mobile) with their value boxes
        right-aligned 12 px inside each column; the move grid's four cell
        rects at `(128,188,202,70)`, `(338,188,202,70)`, `(128,266,202,70)`,
        `(338,266,202,70)` desktop and `(28,188,159,70)`, `(195,188,159,70)`,
        `(28,266,159,70)`, `(195,266,159,70)` mobile (via `moveGridCellRects`); the
        ⓘ box at `{x: cell.w − 36, y: 8, w: 22, h: 22}` of every filled cell; and
        `initialDetailPanelUi()`.
  - [ ] `[unit]` `view.test.ts` also asserts: purity (two calls with the same
        arguments are deep-equal, and a frozen input is not mutated); a `null`
        `detail` yields `open: false` with empty arrays; the cursor/page clamps; the
        nature tint (`'up'`/`'down'`/`'neutral'` for an adamant `atk`/`spa`/`def`);
        the labels string-for-string as the frame prints them.
  - [ ] `[unit]` `src/ui/hud/panels/detail/evolution.test.ts` exists and passes and
        pins: `EVO_MAX_ROWS`-row truncation; `height = rows × 28`; the row origin
        `x = 8 + 34·depth`, `y = row·28`; and the exact `d` strings for the fixture
        family, e.g. charmander→charmeleon is
        `M 34 14 H 25 V 42 H 42` at `width = 420`.
  - [ ] `[unit]` `src/ui/hud/panels/detail/fixture.test.ts` imports the fixture,
        asserts its `state` passes `isHudState`, and asserts
        `detailPanelView(fixture.detail, fixture.pool, fixture.ui, {width:1280,height:800})`
        reproduces the frame's strings: `name === 'CHARIZARD'`, the four move names
        and their `PP 15/15` / `PWR 90` / `ACC 100` strings, `tab.active === 'moves'`,
        and `pool` rows `RAZOR LEAF` / `LEECH SEED`.
  - [ ] `[unit]` The pure modules import no Phaser and no DOM:
        `grep -rn "from 'phaser'\|document\.\|Math.random\|Date.now\|window\." src/ui/hud/panels/detail/view.ts src/ui/hud/panels/detail/evolution.ts`
        prints nothing.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-132` ⊆ the four entries listed above; the
        folder glob covers every new file under it).
  - [ ] `[live]` **The card is the shipped rect.** At 1280×800 and at 390×844, with
        `?hud=dom`, open the panel with a real click on a party member row
        (`[data-hud-party-member="<id>"]`) and read
        `document.querySelector('[data-hud-panel="detail"]').getBoundingClientRect()`:
        it is `108,72 460×560` at 1280×800 and `8,72 374×560` at 390×844, Δ ≤ 1 px on
        each edge against the `detailPanelBox` values.
  - [ ] `[live]` **No Phaser object is drawn.** With `?hud=dom` on that route,
        `detailDrawnObjectCount()` returns `0`; with the flag off after the same
        clicks it returns > 0 and the canvas panel is visible.
  - [ ] `[live]` **The graph is SVG, not canvas.** On the STATS tab,
        `document.querySelectorAll('[data-hud-detail-evo] path').length` equals the
        number of rows whose `parent !== null` for the opened member, and
        `document.querySelectorAll('[data-hud-detail-evo] text').length`
        equals the rows with a non-null `level`; `getComputedStyle(card).borderRadius`
        is `11px` and `getComputedStyle(card).backgroundColor` is
        `rgba(16, 22, 31, 0.72)`.
  - [ ] `[live]` **The card hides behind a paused route.** Open the detail, start a
        wild battle (walk into grass) and then return: while the battle is up
        `[data-hud-panel="detail"]` has `hidden` (or `display: none`), and after the
        battle it is back with the same `open` value and the same rect as before.
  - [ ] `[live]` **A press still writes the run.** With `?hud=dom`, open a member
        whose level allows a ready branch, read
        `document.querySelector('[data-hud-detail-name]').textContent` and the
        `data-current="true"` row of the graph, press the evolution row marked
        `[data-hud-detail-evo-ready="true"]`, and read both again: the name is the
        branch's species name and the current row moved to it, in one transaction
        (one press, one redraw), at both viewports.

## 📣 Coordination

- **For the Orchestrator:** this is the largest task of the phase (the panel is
  1,668 lines with drag-reorder, a scroll band, two ⓘ popups, a nickname field and
  the learn/evolve popup). Its `descriptor` keeps **every** exported name because
  `RouteScene.ts` and `pause.ts` import eighteen of them and neither is in this
  batch — a Task QA that sees those exports disappear must fail the task.
  `?hud=dom` is the only flag; the fixture slug is
  `03m-panels-pokemon-moves`; the test files it adds are
  `view.test.ts`, `evolution.test.ts`, `fixture.test.ts` under
  `src/ui/hud/panels/detail/`.
  - **The gate for a route panel is not `npm run hud:diff`** — that harness
    compares a whole 1280×800/390×844 screenshot against
    `design/screens/<slug>.png`, whose `<image>` layer is the board's own route
    world, so it can never match a live run. Batch 61 (bag/PC/party) measured
    **DOM-vs-Phaser rect parity plus the board's paint values over CDP**, and this
    spec follows that precedent. Run `hud:diff` only if a future task gives the
    route lane a fixture-driven preview.
- **For the next batch:** `src/ui/hud/panels/detail/` exports `DetailIntent` as its
  own command channel; a later task that widens the shared `HudCommand` union
  (`src/ui/hud/commands.ts`) should fold `DetailIntent` into it rather than keep
  two vocabularies. `detailPanelView` takes a `MemberDetail`, so the battle's
  `05e Battle · stats` frame can reuse it if a task ever migrates that window.

## ⛔ Out of scope

- No engine, `src/engine/**`, save, `SAVE_VERSION`, RNG or run-field change.
- No other panel, no `src/scenes/RouteScene.ts`, no `src/scenes/panels/hud.ts`.
- No new i18n key and no edit to `src/i18n/**`.
- The learn / evolve popup is **not** migrated in this task: `showLearnPopup` keeps
  painting the shipped Phaser window under the flag too (it is the level-up beat's
  window, raised by `RouteScene`, and its own migration is a later task). Do not
  restyle it, do not move it.
- The board's `detail close` (X) button and its `key stats` chip are **not**
  implemented: the shipped panel has none (`PANEL_KEY_ACTIONS.detail` is undefined
  and the panel closes from the pointer-outside rule / its panel icon). Do not
  invent a close button.
- No PC-box opener (see the seam's item 7) and no drag-and-drop of a *learnset* row
  onto a *move slot* through HTML5 DnD: the pool's `equip` intent is a press, one
  command, one transaction.
- No `hud:diff` change, no `design/tokens.json` change, no kit change.

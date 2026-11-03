# Spec: Task-289 — Routes carry the POIs, as zones

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + engine rule (+ a mountable Phaser module with no caller yet).
- **Role:** Dev.
- **Objective:** every point of interest a lateral's terminus ends on becomes **data
  plus a zone on the route** instead of a room flag: `src/data/pois.ts` folds the six
  legacy room tables (the vault's seals, the no-heal rule, the banned-species rule,
  the secret shop's shelf, the static's species, the puzzle's stack) into one row per
  `PoiKind` **by reference** — the originals and their importers stay in place, so no
  import dangles — and `src/engine/region/pois.ts` answers, for a terminus, the one
  POI it ends on, the rectangle on the route it owns, the tile its marker stands on
  and the battle rules a battle started inside it obeys. The drawing half
  (`src/scenes/pois.ts`) mounts nothing yet: `WorldScene` belongs to Task-290, out of
  this batch.
- **Environment:** worktree `../wt-pkm-289`, branch `task-289` (already created;
  `node_modules` is installed — do **not** reinstall, do **not** junction or symlink
  any asset tree).
- **Dependencies (already merged, read them, do not edit them):**
  - the per-node content pass — `src/engine/region/content.ts` (`planNodeContent`,
    `NodeContent`, `PoiKind`, `POI_KINDS`); **this task does not change it**, and it
    is the source of truth for *which* kind a terminus ends on (§7.3);
  - the long route — `src/engine/region/route/map.ts` (`generateRoute`,
    `RegionRouteMap` with `width`, `height`, `tiles`, `entry`, `exits`, `spine`);
  - the region streams — `src/engine/region/streams.ts` (`nodeStreams`,
    `regionStream`) and `src/engine/rng.ts` (`Rng.split` does **not** advance its
    parent);
  - the battle's own no-heal rule — `src/engine/run/battleLink.ts:75`
    (`BattleLaunch.noHeal`) and `src/engine/battle/commands.ts` (it reads
    `BARRED_HEALING_MOVES`) — the contract the zone will feed.

### Exclusive paths (single writer)

**Nothing outside this list.** Eight paths.

- `src/data/pois.ts` (new)
- `src/data/pois.test.ts` (new)
- `src/data/README.md` — **one bullet only**, the `pois.ts` line (the folder-README
  rule; Task-288 was told not to edit this file).
- `src/engine/region/pois.ts` (new)
- `src/engine/region/pois.test.ts` (new)
- `src/scenes/pois.ts` (new)
- `src/scenes/pois.test.ts` (new)
- `docs/region-spec.md` — **§7.8 only**, a new subsection **inserted** in one block
  immediately after §7.6's last line (the line
  `rest of the registry like a city or a gym screen.`) and immediately **before**
  `### 7.11 The tower behind the Champion`. Task-288 inserts its own §7.7 in the same
  gap; the two must end up as `§7.6 → §7.7 → §7.8 → §7.11`, each one block, no line
  of the others rewritten.

`src/engine/region/README.md` is **Task-288's** and must **not** be edited: it writes
the `pois.ts` line ("the POI a lateral's terminus ends on and the zone rect a battle
reads"). `src/scenes/README.md` is **Task-287's**: it writes the `pois.ts` and
`pois.test.ts` lines. Neither is yours.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `docs/region-spec.md` — §1, §2, §7.3 (the POI kinds and who draws them), §7.6's
  tail (the insertion point). Do not edit anything but the new §7.8.
- No `design/screens/` frame: this task ships **no** screen and no HUD panel, so it
  owes no board and no `[live]` pass (see below).
- `src/engine/region/content.ts`, `plan.ts`, `streams.ts`, `route/map.ts`,
  `route/layout.ts`, `src/engine/rng.ts`, `src/engine/grid.ts`,
  `src/engine/map.ts` (`isWalkable`, `TileMap`).
- The six legacy tables this task folds, **read only**:
  `src/data/gates.ts` (`GATES`, `GATE_KINDS`, `GateKind`),
  `src/data/noHeal.ts` (`NO_HEAL_ROOM`, `BARRED_HEALING_MOVES`),
  `src/data/bannedRoom.ts` (`BANNED_ROOM`),
  `src/data/shop.ts` (`SECRET_SHOP`),
  `src/data/staticSpecies.ts` (`STATIC_ROOM`, `LEGENDARY_ROOM`, `STATIC_SPECIES`,
  `LEGENDARY_SPECIES`, `STATIC_GATES`),
  `src/data/puzzles.ts` (`PUZZLE_STACK`, `PUZZLE_ROOM`),
  `src/data/loot.ts` (`ROUTE_LOOT`).
- `src/data/README.md` (its `## Layout` list and `## Rules`), `src/engine/region/README.md`
  (read; Task-288 writes it), `src/engine/run/battleLink.ts`,
  `src/engine/battle/commands.ts`, `src/engine/battle/state.ts` (read only, to match
  the two launch fields' names and defaults).

## 🔒 Contract

### `src/data/pois.ts` (new)

One row per `PoiKind`, a discriminated union so a caller narrows on `row.kind`.
Every row that has a legacy table under it **references** it; nothing is copied.

```ts
import type { PoiKind } from '../engine/region/content';
import type { GateKind } from './gates';
import type { BannedRoomConfig } from './bannedRoom';
import type { NoHealRoomConfig } from './noHeal';
import type { SecretShopConfig } from './shop';
import type { StaticRoomConfig } from './staticSpecies';
import type { PuzzleStackEntry } from './puzzles';

/** How big a POI's zone is on the route, in tiles. One size for every kind. */
export const POI_ZONE_WIDTH: number;   // 7
export const POI_ZONE_HEIGHT: number;  // 5

export type PoiRow =
  | Readonly<{ kind: 'vault'; gateKinds: readonly GateKind[] }>
  | Readonly<{ kind: 'miniboss' }>
  | Readonly<{ kind: 'trade' }>
  | Readonly<{ kind: 'no-heal'; room: NoHealRoomConfig; barredMoves: readonly string[] }>
  | Readonly<{ kind: 'static'; room: StaticRoomConfig; species: readonly string[] }>
  | Readonly<{ kind: 'secret-shop'; shop: SecretShopConfig; shelf: readonly string[] }>
  | Readonly<{ kind: 'banned'; room: BannedRoomConfig }>
  | Readonly<{ kind: 'puzzle'; stack: readonly PuzzleStackEntry[] }>
  | Readonly<{ kind: 'legendary'; room: StaticRoomConfig; species: readonly string[] }>;

export const POI_ROWS: Readonly<Record<PoiKind, PoiRow>>;
export function poiRow(kind: PoiKind): PoiRow;
```

The fold, row by row (each `toBe`-identical to the legacy export):

| row | carries |
| --- | --- |
| `vault` | `gateKinds: GATE_KINDS` (`src/data/gates.ts`) |
| `miniboss` | nothing — its presence is `content.poi`'s uniform draw, its roster is the trainer engine's |
| `trade` | nothing — its counter is `src/engine/run/trade.ts`'s rule |
| `no-heal` | `room: NO_HEAL_ROOM`, `barredMoves: BARRED_HEALING_MOVES` |
| `static` | `room: STATIC_ROOM`, `species: STATIC_SPECIES` |
| `secret-shop` | `shop: SECRET_SHOP`, `shelf: [...SECRET_SHOP.held, ...SECRET_SHOP.tm]` |
| `banned` | `room: BANNED_ROOM` |
| `puzzle` | `stack: PUZZLE_STACK` |
| `legendary` | `room: LEGENDARY_ROOM`, `species: LEGENDARY_SPECIES` |

- No odds and no counters are invented here: `miniboss`'s per-stretch target lives
  in `TODO.md`'s review item and `content.ts` owns which kind a terminus draws
  (§7.3, and the batch decision Q5 = B). A row with no table carries no field.
- `poiRow(kind)` is total over `PoiKind` (a `Record`, no fallback needed).
- `POI_ZONE_WIDTH`/`POI_ZONE_HEIGHT` are the only geometry in data; the engine reads
  them, never a literal.

### `src/engine/region/pois.ts` (new)

```ts
import type { Tile } from '../grid';
import type { GateKind } from '../../data/gates';
import type { PoiRow } from '../../data/pois';
import type { NodeContent, PoiKind } from './content';
import type { RegionPlan } from './plan';
import type { RegionRouteMap } from './route/map';

/** A zone on a route, in tiles: its top-left cell and its size. */
export type PoiRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type NodePoi = Readonly<{
  nodeKey: string;
  kind: PoiKind;
  row: PoiRow;
  /** The zone, always inside the route's walkable body (never the border ring). */
  rect: PoiRect;
  /** The tile the marker stands on: the spine's end, clamped into the rect. */
  marker: Tile;
  /** The vault's seal, drawn once per region; `null` for every other kind. */
  gateKind: GateKind | null;
  /** The species a `static` or a `legendary` holds; `null` for every other kind. */
  speciesId: string | null;
}>;

/** The zone a terminus' POI owns: the rect at the end of the route's spine. */
export function poiRect(route: RegionRouteMap): PoiRect;

/** The one POI a lateral's terminus ends on, or a throw when the node is not one. */
export function nodePoi(plan: RegionPlan, key: string, content: NodeContent): NodePoi;

/** The region's one vault seal, identical for every vault of a seed. */
export function regionVaultGate(plan: RegionPlan): GateKind;

/** Every `static` of a region, one species each: `nodeKey -> speciesId`. */
export function regionStatics(plan: RegionPlan): ReadonlyMap<string, string>;

export function inPoiRect(rect: PoiRect, tile: Tile): boolean;

/** The POI whose zone holds `tile`, or `null`. First match wins; zones never overlap. */
export function poiAt(pois: readonly NodePoi[], tile: Tile): NodePoi | null;

/** What a battle started on `tile` inherits: the launch's own two names. */
export function poiBattleRules(pois: readonly NodePoi[], tile: Tile): Readonly<{
  noHeal: boolean;
  barredMoves: readonly string[];
}>;
```

**`poiRect(route)`** — pure, reads **no RNG**:

```
anchor = route.spine[route.spine.length - 1] ?? route.entry
x = clamp(anchor.x - floor(POI_ZONE_WIDTH / 2),  1, max(1, route.width  - 1 - POI_ZONE_WIDTH))
y = clamp(anchor.y - floor(POI_ZONE_HEIGHT / 2), 1, max(1, route.height - 1 - POI_ZONE_HEIGHT))
rect = { x, y, width: POI_ZONE_WIDTH, height: POI_ZONE_HEIGHT }
```

so `x >= 1`, `y >= 1`, `x + width <= route.width - 1`, `y + height <= route.height - 1`
for every generated route (the clamp's `max(1, …)` keeps a map narrower than the zone
inside its own border ring).

**`nodePoi(plan, key, content)`**:

- `nodeOf(plan, key)` missing → throw `` `unknown node: ${key}` `` (the content pass's
  message). `node.lateralOf === null` or `content.poi === null` → throw
  `` `not a terminus: ${key}` ``.
- `route = generateRoute(plan, key)`, `rect = poiRect(route)`,
  `marker = { x: clamp(anchor.x, rect.x, rect.x + rect.width - 1), y: clamp(anchor.y, rect.y, rect.y + rect.height - 1) }`
  with the same `anchor` as above.
- `row = poiRow(content.poi)`.
- `gateKind` = `row.kind === 'vault' ? regionVaultGate(plan) : null`.
- `speciesId` = `row.kind === 'static' ? regionStatics(plan).get(key) ?? null`
  for a static; for a `legendary`, one draw off
  `regionStream(plan.seed).split(`pois:legendary:${key}`)` —
  `rng.int(0, row.species.length - 1)`; `null` for every other kind.
- **Determinism:** the only draws are the three named splits
  (`regionStream(seed).split('pois:statics')`, `…split('pois:vault')` and
  `…split(`pois:legendary:${key}`)`), and the only content reads are
  `regionStatics`'s replay of `planNodeContent` over the plan's laterals — each off
  its own node's `content` stream, which is replayable and order-independent
  (`D60`), so no content draw of the node being asked about moves (`D11`: a fixed
  seed reproduces the same POI for ever).

**`regionVaultGate(plan)`** — `regionStream(plan.seed).split('pois:vault')`, one
`rng.int(0, GATE_KINDS.length - 1)` into `GATE_KINDS`; the same answer for every
vault of the seed and for every call.

**`regionStatics(plan)`** — `regionStream(plan.seed).split('pois:statics')`,
Fisher–Yates over a copy of `STATIC_SPECIES`, then the plan's `lateral` nodes in
`plan.nodes` order: for each whose `planNodeContent(plan, key, node.tier ?? 1).poi`
is `'static'`, take the next species of the shuffled order (index modulo the pool's
length, so a region with more statics than the pool keeps a stable, documented
order instead of throwing). Returns `Map<nodeKey, speciesId>`. Pure and total.

**`poiBattleRules(pois, tile)`** — `poiAt(pois, tile)`; a `no-heal` zone answers
`{ noHeal: true, barredMoves: row.barredMoves }`, every other answer (including no
zone) is `{ noHeal: false, barredMoves: [] }`. Those two names and their defaults are
exactly `BattleLaunch.noHeal` (`src/engine/run/battleLink.ts:75`, optional, absent =
`false`) and the list `src/engine/battle/commands.ts` reads, so the battle side needs
no change.

### `src/scenes/pois.ts` (new, **no caller in this batch**)

```ts
import type Phaser from 'phaser';
import type { RegionRouteMap } from '../engine/region/route/map';
import type { NodePoi, PoiRect } from '../engine/region/pois';

/** A tile rect in screen px, for the scene that later draws the zone. */
export function poiScreenRect(route: RegionRouteMap, rect: PoiRect, tileSize: number): Readonly<{ x: number; y: number; w: number; h: number }>;

/** The marker's screen centre, in px: the middle of its tile. */
export function poiMarkerPoint(route: RegionRouteMap, poi: NodePoi, tileSize: number): Readonly<{ x: number; y: number }>;

/** Draws the zone's outline and its marker; returns what it created (possibly none). */
export function drawPoi(scene: Phaser.Scene, route: RegionRouteMap, poi: NodePoi, tileSize: number): readonly Phaser.GameObjects.GameObject[];
```

- `poiScreenRect` and `poiMarkerPoint` are pure arithmetic (`tileSize` is handed in,
  never imported), so they are unit-tested headless.
- `drawPoi` draws one `Rectangle` outline for the zone and one small marker square at
  `poiMarkerPoint`, both at a depth above the tile layers, and returns them; it owns
  no rule and starts nothing. **Nothing imports it in this batch** — `WorldScene` is
  Task-290's — and the module must not register a scene (it is not a `*Scene.ts`
  file, and it exports no `regionSceneKey`).

## 🧩 Data and configuration

- `src/data/pois.ts` is the new content table; every row is frozen in the Contract
  table above. No number is invented: `POI_ZONE_WIDTH = 7`, `POI_ZONE_HEIGHT = 5`.
- The six legacy files are **not** edited, not renamed and not re-exported away:
  `gates.ts`, `noHeal.ts`, `bannedRoom.ts`, `shop.ts`, `staticSpecies.ts`,
  `puzzles.ts` keep their exports and their importers (`src/engine/maps/plan.ts`
  imports `NO_HEAL_ROOM`, `src/engine/battle/commands.ts` imports
  `BARRED_HEALING_MOVES`, `src/engine/routes/*` imports the rest). The sweep
  (Task-298) deletes them **after** this task's fold exists.
- `src/data/README.md`: one new bullet in `## Layout`, in the alphabetical place
  between `puzzles.ts` and `staticSpecies.ts`:

  `- \`pois.ts\` — the nine points of interest a lateral's terminus can end on, one row per kind, each folding the legacy room table it replaces by reference (the vault's seals, the no-heal rule and barred moves, the banned-species row, the secret shop's shelf, the static's and the legendary's species, the puzzle stack) plus the two zone sizes (\`docs/region-spec.md\` §7.8).`

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-289` — audit against the eight exclusive paths.
    `docs/region-spec.md` must show **one** added block, before `### 7.11`;
    `src/data/README.md` **one** added bullet.
  - **Every criterion is `[unit]`: this task owes no browser pass**, because its
    scene module has no caller in this batch (`WorldScene` is Task-290's). The
    `[live]` wiring — a marker standing on its zone, a battle inside the no-heal zone
    refusing the bag — is **owed to the batch that puts POIs into `WorldScene`**, and
    must then measure `poiBattleRules`' answer through the battle's own bag menu.
- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `src/data/pois.test.ts` proves the fold is by reference:
    `POI_ROWS.vault.gateKinds` **is** `GATE_KINDS`;
    `POI_ROWS['no-heal'].room` **is** `NO_HEAL_ROOM` and its `barredMoves` **is**
    `BARRED_HEALING_MOVES`; `POI_ROWS.banned.room` **is** `BANNED_ROOM`;
    `POI_ROWS.static.room` **is** `STATIC_ROOM` and its `species` **is**
    `STATIC_SPECIES`; `POI_ROWS.legendary.room` **is** `LEGENDARY_ROOM` and its
    `species` **is** `LEGENDARY_SPECIES`; `POI_ROWS['secret-shop'].shop` **is**
    `SECRET_SHOP` and its `shelf` equals
    `[...SECRET_SHOP.held, ...SECRET_SHOP.tm]`; `POI_ROWS.puzzle.stack` **is**
    `PUZZLE_STACK`.
  - [ ] `[unit]` `pois.test.ts` proves the table is the nine kinds: `Object.keys(POI_ROWS)`
    equals `POI_KINDS` in order, `poiRow(kind)` answers `POI_ROWS[kind]` for every
    kind, and the two zone sizes are the integers `7` and `5`.
  - [ ] `[unit]` `src/engine/region/pois.test.ts` proves every lateral terminus
    resolves to **exactly one** kind: over 64 seeds, for every `lateral` node,
    `nodePoi(plan, key, planNodeContent(plan, key, 1))` returns one `NodePoi` whose
    `.kind` equals that content's `poi`; `nodePoi` on `town:1`, `city:1`, `route:1`,
    `victory-road:1`, `league:1` and `tower:1` throws `not a terminus: <key>`; and a
    key the plan does not hold throws `unknown node: <key>`.
  - [ ] `[unit]` `pois.test.ts` proves all nine kinds are reachable: over 64 seeds the
    union of every terminus' `.kind` equals the nine `POI_KINDS`.
  - [ ] `[unit]` `pois.test.ts` proves the quota and the count: over **1 000** seeds
    the share of termini whose `.kind === 'miniboss'` is `1 / 9` within `±0.02`
    (the shipped uniform draw from `POI_KINDS`, §7.3 — not a data row); every
    terminus holds **at most one** POI (`nodePoi` returns one object); a stretch has
    at most one mini-boss **per lateral** (so at most two in the whole stretch, one
    per terminus) — and the file states, in a comment, that the "one mini-boss per
    stretch" target in `TODO.md` is the review item, not this table's.
  - [ ] `[unit]` `pois.test.ts` proves the zone lies inside the route: over 64 seeds,
    for every terminus, `rect.x >= 1`, `rect.y >= 1`,
    `rect.x + rect.width <= generateRoute(plan, key).width - 1`,
    `rect.y + rect.height <= generateRoute(plan, key).height - 1`, the `marker` is
    inside the rect, and `inPoiRect(rect, marker) === true` while
    `inPoiRect(rect, { x: rect.x - 1, y: rect.y }) === false`.
  - [ ] `[unit]` `pois.test.ts` proves the battle rules: for a terminus whose kind is
    `no-heal`, `poiBattleRules([poi], poi.marker)` is
    `{ noHeal: true, barredMoves: BARRED_HEALING_MOVES }` (same array, `toBe`) and
    `poiBattleRules([poi], { x: rect.x - 1, y: rect.y - 1 })` is
    `{ noHeal: false, barredMoves: [] }`; for any other kind the marker answers
    `{ noHeal: false, barredMoves: [] }`.
  - [ ] `[unit]` `pois.test.ts` proves the static is unique per region: over 64 seeds,
    no two entries of `regionStatics(plan)` share a species, every key is a `lateral`
    whose content's `poi` is `'static'`, and a static's `nodePoi(...).speciesId`
    equals the map's entry; the vault seal is region-stable (two calls and two
    different vaults of one seed answer the same `gateKind`).
  - [ ] `[unit]` `pois.test.ts` proves the replay: two `nodePoi` calls for one node
    are `toEqual`; a call after another node's call is still `toEqual`; and the call
    moves no content draw: `planNodeContent(plan, key, 1)` called before and after a
    `nodePoi(plan, key, content)` is deep-equal, and building another node's POI in
    between leaves the first answer unchanged.
  - [ ] `[unit]` `src/scenes/pois.test.ts` proves the drawing half's math with
    `phaser` mocked the way `MainMenuScene.test.ts` mocks it: `poiScreenRect(route,
    { x: 3, y: 4, width: 7, height: 5 }, 24)` is `{ x: 72, y: 96, w: 168, h: 120 }`
    and `poiMarkerPoint` is the marker tile's centre.
  - [ ] `[unit]` Purity: `src/engine/region/pois.ts` imports no Phaser, no DOM and no
    clock; no file this task adds or edits contains `Math.random` or `Date.now`.
  - [ ] `[unit]` No import dangles: `npm test` and `npm run build` are green with
    `src/data/{gates,noHeal,bannedRoom,shop,staticSpecies,puzzles}.ts` **unchanged**
    (`git diff --name-only main...task-289` shows none of them), and
    `src/engine/maps/plan.ts` and `src/engine/battle/commands.ts` are untouched.
  - [ ] `[unit]` `docs/region-spec.md` has exactly one new `### 7.8` block, placed
    after §7.7 (or after §7.6 if it lands first) and before `### 7.11`, and no other
    hunk.
  - [ ] `[unit]` `src/data/README.md` has exactly one new bullet (`pois.ts`) and no
    other hunk.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

- **No `[live]` criterion.** This task ships no screen (Contract: `src/scenes/pois.ts`
  has no caller) and changes no HUD panel, so it owes **no browser pass** at all.

## 📣 Coordination

- **For the Orchestrator (plan changes this spec froze):**
  - The exclusive list is the Orchestrator's seven paths plus `src/data/README.md`,
    whose `pois.ts` bullet the folder-README rule puts in this task and whose only
    other claim this batch (Task-288's `npcs.ts`) the Orchestrator already excluded.
  - `src/engine/region/README.md` and `src/scenes/README.md` are **not** this task's;
    Tasks 288 and 287 write the `pois.ts` lines there.
  - `content.ts` is untouched (Q5 = B): the *kind* a terminus ends on stays the
    uniform `POI_KINDS` draw, and this task adds no odds.
  - The test that would have read "one mini-boss per stretch" is written as "one per
    **lateral** (at most two per stretch)", because the uniform per-lateral draw
    cannot guarantee the stronger claim (a two-lateral stretch draws `miniboss`
    twice with probability `1/81`). The stronger target is the `TODO.md` review
    item the Orchestrator opened; it does not block this task.
- **For Task-288:** your `npcs.ts`/`pois.ts` README lines are yours; this task never
  opens that file. Your `CityScene` and mine touch no common path.
- **For Task-287:** nothing here reads the prologue; a prologue run cannot reach a
  route, so no POI is ever built for it.
- **For Task-290 (next batch, owns `WorldScene`):** the wiring this task defers is
  exactly three calls — `nodePoi(plan, run.nodeKey, planNodeContent(...))` on entering
  a lateral, `drawPoi(scene, route, poi, TILE_SIZE)`, and
  `poiBattleRules([poi], tile)` folded into the `BattleLaunch` the grass step builds
  (`noHeal`, and `barredMoves` is already what `battle/commands.ts` reads). Do not
  rebuild the rect: `poiRect` is the one answer.
- **For the sweep (Task-298):** the six legacy tables are now referenced by
  `src/data/pois.ts`; deleting them means deleting their rows' `room`/`gateKinds`…
  fields **and** `src/engine/maps/plan.ts`'s and `src/engine/battle/commands.ts`'s
  last imports of them first, in that order.

## ⛔ Out of scope

- Editing `src/engine/region/content.ts` (the kind is its draw), any legacy room
  table, `src/engine/maps/plan.ts`, `src/engine/battle/**`,
  `src/engine/run/battleLink.ts`, `src/scenes/WorldScene.ts`, `src/scenes/RouteScene.ts`,
  `src/scenes/CityScene.ts`, `src/engine/region/README.md`, `src/scenes/README.md`.
- Deleting `gates.ts`, `noHeal.ts`, `bannedRoom.ts`, `shop.ts`, `staticSpecies.ts`,
  `puzzles.ts`, the room scenes (`src/scenes/rooms/**`) or their tables — Task-298.
- Starting a battle, opening a shop, drawing a card or registering a scene from
  `src/scenes/pois.ts`: it draws a zone and a marker and owns nothing else.
- Any HUD panel, DOM card or `design/screens/` frame; any `[live]` criterion.
- Inventing a mini-boss chance, a trade counter or a shop shelf: the first is
  `content.ts`'s, the second is `src/engine/run/trade.ts`'s, the third is
  `SECRET_SHOP`'s.
- Any new dependency, `Math.random()` or `Date.now()` in `src/engine/`.
- `src/data/dex/**`, `src/main.ts`, `vite.config.ts`, `package.json`, any generated
  data file.

## ✅ Delivery

Commit on `task-289` only, never on `main`. When `npm test` and `npm run build` are
green, leave an **empty commit** `dev: done task-289` on the tip and
`git push origin task-289`. No other role commits to this branch.

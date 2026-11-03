# Spec: Task-288 — Cities have people

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + engine rule + Phaser scene.
- **Role:** Dev.
- **Objective:** every settlement stands the people its per-node content rolled — the
  generic NPCs with a line by city tier and the one or two specials with their own
  probability and action — placed deterministically on the settlement's own walkable
  tiles, drawn on the city screen, and talked to through the shipped NPC card. Their
  actions resolve **once** and survive a revisit, and the card's copy is authored in
  both locale tables.
- **Environment:** worktree `../wt-pkm-288`, branch `task-288` (already created;
  `node_modules` is installed — do **not** reinstall, do **not** junction or symlink
  any asset tree).
- **Dependencies (already merged, read them, do not edit them):**
  - the per-node content pass — `src/engine/region/content.ts` (`planNodeContent`,
    `NodeContent`, `PoiKind`, `POI_KINDS`), which decides **how many** NPCs a node
    stands and **which** rows;
  - the streams — `src/engine/region/streams.ts` (`nodeStreams`);
  - the settlement plan — `src/engine/region/city/plan.ts` (`planCity`, `CityPlan`);
  - the city screen — `src/scenes/CityScene.ts` (this task edits it, see Q4-A) and
    `src/scenes/walker.ts` / `src/scenes/walker.test.ts`;
  - the NPC card — `src/ui/npcPanel.ts` (`openNpcPanel`, `NpcPanelView`);
  - the shipped special-NPC framework — `src/engine/routes/npcs.ts`
    (`chefTrade`, `npcUseId`, `medicHeal`, `npcRequirementMet`) and
    `src/engine/run/heal.ts` (`healParty`);
  - the overworld atlas — `src/data/overworldSprites.ts`
    (`overworldSpriteFrame`, `OVERWORLD_SPRITE_KEYS`), `src/render/trainerAnim.ts`
    (`trainerFacingPose`).

### Exclusive paths (single writer)

**Nothing outside this list.** Twelve paths. No other task in the batch claims any of
them.

- `src/data/npcs.ts`
- `src/data/npcs.test.ts`
- `src/engine/region/npcs.ts` (new)
- `src/engine/region/npcs.test.ts` (new)
- `src/scenes/npcs.ts` (new)
- `src/scenes/npcs.test.ts` (new)
- `src/scenes/CityScene.ts`
- `src/scenes/walker.test.ts` — **only** the `CityScene` parts. The file also tests
  `WorldWalker`'s step rule and `canWalkStep`; **leave those assertions byte-for-byte
  untouched**. If a `CityScene` assertion must change, change only that one.
- `src/i18n/en.ts`
- `src/i18n/es.ts`
- `src/engine/region/README.md` — this task writes the one-line entries for **both**
  `npcs.ts` and `pois.ts` (Task-289's file, which must not edit this README).
- `docs/region-spec.md` — **§7.7 only**, a new subsection. It is **inserted** in one
  block, immediately after §7.6's last line (the line
  `rest of the registry like a city or a gym screen.`, which ends §7.6) and
  immediately **before** the line `### 7.11 The tower behind the Champion`. No other
  section of the file may change: §1, §6, §7.8 and §8 belong to other tasks.

`src/scenes/README.md` is **Task-287's** and must **not** be edited: it writes the
`npcs.ts` line for you. `src/data/README.md` is **not** yours (Task-289 adds the only
new bullet there); your documentation of the reworked table lives in
`src/data/npcs.ts`'s own header and in §7.7.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `docs/region-spec.md` — §1, §2, §7.1 (the settlement's tiles, spawn, buildings and
  doors), §7.3 (the content pass, its fields and its draw order). Read §7.6's tail to
  find the insertion point; do not edit anything but the new §7.7.
- `design/screens/01-main-menu.json`… **not needed**: this task changes no HUD panel
  and mounts no DOM card. The NPC card is Phaser-drawn (`src/ui/npcPanel.ts`), so it
  has no `design/screens/` frame and owes no `[live]` pixel read.
- `src/engine/region/city/plan.ts`, `src/engine/region/plan.ts`,
  `src/engine/region/streams.ts`, `src/engine/region/content.ts`,
  `src/engine/rng.ts`.
- `src/engine/run/state.ts` (`RunState`, `itemCount`, `addItem`, `markItemPicked`,
  `isItemPicked`), `src/engine/run/heal.ts`, `src/engine/routes/npcs.ts`,
  `src/engine/run/memberEdits.ts` (read only).
- `src/scenes/CityScene.ts`, `src/scenes/WorldScene.ts`, `src/scenes/walker.ts`,
  `src/scenes/RouteScene.ts` — the last one **read only**, for the two idioms this
  task copies: `drawRoomNpc` (lines 1648-1663) and `openNpcCardView` (lines
  2406-2422).
- `src/ui/npcPanel.ts`, `src/ui/frlg.ts`, `src/input/input.ts`
  (`actionKeys`, `subscribeKeybinds`), `src/settings.ts`, `src/dev/env.ts`.
- `src/i18n/index.ts` (`t`, `TranslationKey`), `src/i18n/en.ts`, `src/i18n/es.ts`
  (read the whole of both before adding keys), `src/i18n/index.test.ts` (the three
  guards your keys must pass).
- `src/data/npcs.ts`, `src/data/npcs.test.ts`, `src/data/overworldSprites.ts`,
  `src/data/overworldSprites.test.ts`, `src/data/keybinds.ts`.

## 🔒 Contract

### `src/data/npcs.ts`

The table is **not** renamed away: `NPC_ROWS` keeps its name and its order because
`src/engine/region/content.ts:1,78` and `src/engine/routes/npcs.ts:9,127,160` read it
and are not in this task. Everything below is additive.

```ts
/** A special row with the chance it takes one of a city's special slots. */
export type CityNpcRow = NpcRow & Readonly<{ cityChance: number }>;

/** The shipped sixteen special rows; `NPC_ROWS` stays the same array under its old name. */
export const SPECIAL_NPCS: readonly CityNpcRow[];
export const NPC_ROWS: readonly NpcRow[];                      // === SPECIAL_NPCS

/** What a row's `cityChance` reads when a caller hands in a plain `NpcRow`. */
export const CITY_SPECIAL_CHANCE_DEFAULT: number;              // 0.8

/** The generic lines a settlement's people say, by the city tier that stands them. */
export type GenericTier = 1 | 2 | 3;
export const GENERIC_LINES: Readonly<Record<GenericTier, readonly TranslationKey[]>>;

export function genericLines(tier: GenericTier): readonly TranslationKey[];
export function cityChanceOf(row: NpcRow): number;
export function specialNpcRow(id: string): CityNpcRow | undefined;
```

- `SPECIAL_NPCS` holds **exactly the sixteen rows `NPC_ROWS` holds today, in the same
  order**, each with a new `cityChance`. Nothing else about a row changes: ids,
  keys, sprites, `chance`, `floorStep`, `guaranteedFromMap`, `requires`,
  `repeatable`, `choices`, `grant` and `battle` stay byte-for-byte.
- `NPC_ROWS` is `SPECIAL_NPCS` (same array, same order), so
  `NPC_ROWS[0].id === 'merchant'` still holds and
  `src/engine/region/content.ts`'s town draw is unchanged.
- `cityChance` values, in table order (merchant, rocket, tutor, nature, ability,
  iv-judge, species, sacrifice, exorcist, weather-man, magician, type-gate, medic,
  chef, berry-tree, mega-stone):
  `1, 1, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.75, 0.75, 0.75, 0.75, 0.9, 0.9, 0.9, 0.9`.
  The merchant and the grunt are `1` because they are the city's shop and its
  casino counter; the last four are likelier because a city that offers them has
  nowhere else to get them.
- `cityChanceOf(row)` is `(row as CityNpcRow).cityChance ?? CITY_SPECIAL_CHANCE_DEFAULT`
  and always clamps into `0..1`.
- `GENERIC_LINES` carries **four lines per tier**, tier `1` = badges 1-2, `2` = 3-5,
  `3` = 6-8 — the same bands `src/data/region.ts`'s `CITY_TIERS` uses. The keys are,
  in order, `npc.generic.tier1.1` … `npc.generic.tier1.4`,
  `npc.generic.tier2.1` … `npc.generic.tier3.4`.
- `genericLines(tier)` returns the tier's array (the same array object; it is
  `readonly`).

### `src/engine/region/npcs.ts` (new)

```ts
import type { TranslationKey } from '../../i18n';
import type { Tile } from '../grid';
import type { RunState } from '../run/state';
import type { NodeContent } from './content';
import type { RegionPlan } from './plan';

export type NpcFacing = 'N' | 'E' | 'S' | 'W';
export type NpcKind = 'generic' | 'special';

export type PlacedNpc = Readonly<{
  /** `npcPlacementId(nodeKey, index)`. */
  id: string;
  nodeKey: string;
  /** 0-based, in placement order: every generic first, then every special. */
  index: number;
  kind: NpcKind;
  /** The `SPECIAL_NPCS` row the body and the sprite come from. */
  rowId: string;
  /** A key of `OVERWORLD_SPRITE_KEYS`. */
  spriteKey: string;
  /** The card's title: the row's `nameKey`, or `npc.generic.name` for a generic. */
  nameKey: TranslationKey;
  /** The card's paragraph: the row's `greetingKey`, or the tier's generic line. */
  lineKey: TranslationKey;
  /** The row's first choice id, or `null` for a generic (its card offers `LEAVE` only). */
  choiceId: string | null;
  tile: Tile;
  facing: NpcFacing;
}>;

export function npcPlacementId(nodeKey: string, index: number): string;
export function nodeNpcs(plan: RegionPlan, key: string, content: NodeContent): readonly PlacedNpc[];

export type NpcUseRefusal = 'once' | 'line-only' | 'needs-member' | 'needs-scene';

export type NpcUse =
  | Readonly<{ ok: true; run: RunState }>
  | Readonly<{ ok: false; reason: NpcUseRefusal }>;

export function npcUseId(placed: PlacedNpc): string;
export function npcUsed(run: RunState, placed: PlacedNpc): boolean;
export function markNpcUsed(run: RunState, placed: PlacedNpc): RunState;
export function useNpc(run: RunState, placed: PlacedNpc, memberId?: string): NpcUse;
```

**`npcPlacementId(nodeKey, index)`** is `` `npc-${nodeKey}-${index}` `` — e.g.
`npc-city:1-0`. **`npcUseId(placed)`** adds the row:
`` `${placed.id}-${placed.rowId}` `` — e.g. `npc-city:1-2-medic`. Both are pure and
read no RNG.

**`nodeNpcs(plan, key, content)`** — pure and total over a key the plan holds:

1. `const node = nodeOf(plan, key)`; a key the plan does not hold throws
   `` `unknown node: ${key}` `` (the same message `planNodeContent` uses).
2. `const city = planCity(plan, key)` — the town or a city; a node that is not a
   settlement throws `` `not a settlement: ${key}` `` (the `planCity` message).
3. The tier is `node.tier ?? 1` (the town and every non-city read as tier 1, exactly
   as the content pass reads them).
4. **The generic NPCs** are `content.npcs`, in order. A generic's `rowId` is
   `content.npcs[i].npcId` **when that id is a `SPECIAL_NPCS` row**, else
   `SPECIAL_NPCS[0].id`; its `spriteKey` is that row's `spriteKey`; its `nameKey` is
   `'npc.generic.name'` and its `lineKey` is drawn from `genericLines(tier)`.
5. **The specials** are `content.specials`, in order, and each is placed only when
   its **own** draw passes: `Rng(hashSeed(`${plan.seed}:node:${key}:npc-special:${rowId}`)).next() < cityChanceOf(row)`.
   One row, one stream, one draw — so the number of generic lines, the number of
   generic NPCs and any later pass cannot move a special, and a special's presence
   cannot move a line.
6. **Positions.** The candidates are `planCity`'s tiles that are walkable
   (`isWalkable(city.tiles, tile)`) and are neither `city.spawn` nor any
   `building.door`. One draw per NPC, in placement order (generics first, then the
   specials that passed), off
   `nodeStreams(plan.seed, key).content.split('npcs')` — a **derived** stream
   (`Rng.split` never advances its parent), so the content pass's own sequence is
   untouched (`D60`): every placement is `rng.int(0, candidates.length - 1)` and that
   candidate is then removed, so no two NPCs share a tile. A settlement with fewer
   free tiles than NPCs keeps the ones it could place (the list is shorter, never a
   throw).
7. **The generic line** is `genericLines(tier)[rng.int(0, lines.length - 1)]` on the
   same `npcs` stream, drawn **after** all positions, so a line cannot move a tile.
8. **Facing** is derived, never drawn: `'S'` when the tile south is walkable, else
   `'N'` when the tile north is, else `'E'`, else `'W'`.
9. Two calls with the same `(plan, key, content)` are **deep equal**: no clock, no
   `Math.random()`, no `nodeStreams(...).content` consumption.

**`useNpc(run, placed, memberId?)`** — the once rule and the two effects this task
can resolve without a battle:

- `npcUsed(run, placed)` is `isItemPicked(run, npcUseId(placed))`.
- `markNpcUsed(run, placed)` is `markItemPicked(run, npcUseId(placed))`.
- `useNpc` answers, in this order:
  1. already used → `{ ok: false, reason: 'once' }`;
  2. `placed.kind === 'generic'` → `{ ok: false, reason: 'line-only' }`;
  3. `rowId === 'medic'` → `{ ok: true, run: markNpcUsed(healParty(run), placed) }`;
  4. `rowId === 'chef'` → `memberId` absent or unknown →
     `{ ok: false, reason: 'needs-member' }`; otherwise `chefTrade(run, memberId)`;
     a refusal is `{ ok: false, reason: 'needs-member' }`, a success is
     `{ ok: true, run: markNpcUsed(trade.run, placed) }`;
  5. every other special → `{ ok: false, reason: 'needs-scene' }` (its card's own
     choice resolves it and the scene then calls `markNpcUsed`).
- Reads **no RNG** except through `healParty`/`chefTrade`, which draw nothing.

### `src/scenes/npcs.ts` (new)

```ts
import Phaser from 'phaser';
import type { RunState } from '../engine/run';
import type { PlacedNpc } from '../engine/region/npcs';
import type { CityPlan } from '../engine/region/city/plan';

/** Draws the node's people; returns the sprites it created, in placement order. */
export function drawCityNpcs(scene: Phaser.Scene, city: CityPlan, placed: readonly PlacedNpc[]): readonly Phaser.GameObjects.Sprite[];

/** The sprite frame a placed NPC draws: `overworldSpriteFrame(spriteKey, pose.facing)`. */
export function npcFrameOf(placed: PlacedNpc): number | null;

/** The card copy for one placed NPC, already localised (`t` resolved by the caller's locale). */
export function npcCardView(placed: PlacedNpc, used: boolean): Readonly<{ title: string; paragraph: string; choices: readonly Readonly<{ id: string; label: string }>[] }>;
```

- `drawCityNpcs` mirrors `RouteScene.drawRoomNpc` (lines 1648-1663): one
  `scene.add.sprite(centerX(tile.x), centerY(tile.y) + TILE_SIZE / 2,
  OVERWORLD_SPRITE_TEXTURE_KEY, frame)` with `setOrigin(0.5, 1)`,
  `setScale(TILE_SIZE / OVERWORLD_SPRITE_WIDTH)` and `setDepth(actorDepth(footY))`;
  a null frame draws nothing for that NPC (the list skips it).
- `npcCardView` returns `title: t(placed.nameKey)`,
  `paragraph: used ? t('npc.used') : t(placed.lineKey)`, and `choices`: the row's
  own choices localised when `used` is false, `[]` when it is true — the shipped
  `RouteScene.openNpcCard` behaviour (lines 2385-2398).
- The module holds **no run state** and imports Phaser for the draw only; every rule
  is `src/engine/region/npcs.ts`'s.

### `src/scenes/CityScene.ts`

- `CityDebugState` gains two fields and keeps its four:

  ```ts
  export type CityDebugState = Readonly<{
    key: string;
    tile: { x: number; y: number };
    interior: string | null;
    travels: number;
    /** Every placed NPC of the settlement on screen, in placement order. */
    npcs: readonly Readonly<{ id: string; kind: 'generic' | 'special'; rowId: string; x: number; y: number; used: boolean }>[];
    /** The card on screen, or null. */
    card: Readonly<{ rowId: string; used: boolean }> | null;
  }>;
  ```

- On `enter`/`onNodeArrived` the scene computes
  `nodeNpcs(plan, node.key, planNodeContent(plan, node.key, node.tier ?? 1))` once
  and stores it; `landed(tile)` checks an NPC's tile **before** the door and the
  exit band and opens its card (the NPC blocks nothing else: the tile stays walkable
  and the player may stand on it).
- A dev-only `talkTo(id: string): void` opens the card of the NPC with that placement
  id exactly as the interact key does (the usable hook for the browser pass).
- The card is opened with `openNpcPanel` through the same
  `openPanel`/`closePanel` bookkeeping `RouteScene.openNpcCardView` uses, so one
  panel is open at a time; `card` in the debug state is set when it opens and cleared
  on close.
- The interact key comes from `actionKeys(this, 'interact', settings.keybinds)`, the
  same way `CityScene` already reads `run`.
- **Nothing else in the scene changes**: the walker, the camera, the music, the
  travel seam and the door opening stay exactly as they are; a prologue run standing
  in the town is a settlement like any other.

## 🧩 Data and configuration

### i18n — new keys, both tables, same order

Add to `src/i18n/en.ts` (source table, authored first) and to `src/i18n/es.ts`
(overlay, same keys). None takes a `{token}`.

| key | `en` | `es` |
| --- | --- | --- |
| `npc.generic.name` | `PASSERBY` | `TRANSEUNTE` |
| `npc.generic.tier1.1` | `The grass here is loud at night.` | `La hierba aquí suena de noche.` |
| `npc.generic.tier1.2` | `My cousin swears he saw a legendary.` | `Mi primo jura que vio un legendario.` |
| `npc.generic.tier1.3` | `Buy a potion before the next route.` | `Compra una poción antes de la ruta.` |
| `npc.generic.tier1.4` | `Trainers walk with their eyes, not their feet.` | `Los entrenadores miran, no pisan.` |
| `npc.generic.tier2.1` | `The gym leader is not in a hurry.` | `Al líder no le corre prisa.` |
| `npc.generic.tier2.2` | `I lost my best Pokémon on a lateral.` | `Perdí a mi mejor Pokémon en un desvío.` |
| `npc.generic.tier2.3` | `The Centre heals. Nothing brings them back.` | `El Centro cura. Nada los devuelve.` |
| `npc.generic.tier2.4` | `Eight badges. Then the real road.` | `Ocho medallas. Luego la ruta de verdad.` |
| `npc.generic.tier3.1` | `Victory Road has eaten better trainers.` | `La Calle Victoria ha comido mejores.` |
| `npc.generic.tier3.2` | `The tower has no end. That is the point.` | `La torre no tiene final. Esa es la idea.` |
| `npc.generic.tier3.3` | `One catch per route. Choose it well.` | `Una captura por ruta. Elígela bien.` |
| `npc.generic.tier3.4` | `The Champion heals between fights. You do not.` | `El Campeón cura entre combates. Tú no.` |

These strings are **frozen**: every character must already be in the FRLG font (the
accents and `í`/`é`/`ú`/`ñ` above are), no em dash (`\u2014`) in Spanish, no `{}`,
and both tables carry the same key set. `npc.used` already exists — reuse it.

### `src/data/npcs.ts` header

Rewrite the file header so it states both halves of the table: `SPECIAL_NPCS` is the
sixteen rows with their `cityChance`, `NPC_ROWS` is the same array kept for
`content.ts`/`routes/npcs.ts`, and `GENERIC_LINES` is the per-tier line table the
cities' generic people print. No exported name beyond the ones frozen above.

### `docs/region-spec.md` §7.7 — "The city's people"

Insert one new `### 7.7 The city's people` block between §7.6's last line and
`### 7.11 The tower behind the Champion`. It must state, in prose:

- `planNodeContent` decides the counts (`2..3` / `4..6` / `7..10` by tier, the town
  exactly one) and the ids; `nodeNpcs` turns them into placed people keyed
  `npc-<nodeKey>-<n>`, and the placement reads no draw of the content pass;
- the specials' own `cityChance`, one stream per row
  (`${seed}:node:${key}:npc-special:${rowId}`), so a line can never move a special;
- the tiles: the settlement's walkable tiles, never the spawn and never a door;
- the once rule (`npc-<nodeKey>-<n>-<rowId>` in `pickedItems`) and the two effects
  that resolve headless (the medic's heal, the chef's trade); every other card
  resolves in its own scene;
- **a pinned table** for the seed the task's tests use, with the header
  `| node | index | id | kind | rowId | x | y |`, listing that seed's placements for
  `town:1` and `city:1` — the exact numbers `src/engine/region/npcs.test.ts` pins.
  Choose the seed string so that `city:1` places **at least one special**; name it in
  the table's own caption (`placements for seed \`qa-288\`` or the nearest
  `qa-288-<n>` that qualifies) and use the very same string in the test.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-288` — audit against the twelve exclusive
    paths. `docs/region-spec.md` must show **one** added block, before
    `### 7.11`.
  - The `[live]` criteria run against `npm run dev`, Chromium at `1280×800`, over
    CDP; the scene hooks are dev-only (`IS_DEVELOP`).
  - **The city harness (used by both `[live]` criteria):** the save lives in
    `localStorage['pokerandomlike.save']`, shape
    `{"version":28,"settings":{…},"run":{…},"history":[]}`. Capture one document by
    playing a new run until the starter is taken, then rewrite **only**
    `run.seed` (to the seed §7.7 pins), `run.nodeKey` (`"city:1"`),
    `run.visitedNodes` (`["town:1","route:1","city:1"]`) and leave `run.party` as
    captured. Reload, click `[data-hud-main-menu-row="continue"]`, and wait up to 5 s
    for `window.__pkmCity`. Run every pass **twice**: both runs must print the same
    numbers.
- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `src/data/npcs.test.ts` keeps every shipped assertion green and
    adds: `SPECIAL_NPCS` and `NPC_ROWS` are the same array with the same sixteen ids
    in the same order (`expect(SPECIAL_NPCS).toBe(NPC_ROWS)` and the id list),
    `NPC_ROWS[0].id === 'merchant'`; every `cityChance` is a probability in `0..1`;
    `cityChanceOf` answers the row's value and
    `CITY_SPECIAL_CHANCE_DEFAULT` for a row without one; `GENERIC_LINES` has the
    three tiers with four keys each, every key resolves in **both** tables, and
    `npc.generic.name` too.
  - [ ] `[unit]` `src/engine/region/npcs.test.ts` proves the count follows the tier:
    over seeds `npc-count-0` … `npc-count-9`, `nodeNpcs(plan, 'city:1', content)`
    places between 2 and 3 generic NPCs (tier 1), `city:3` between 4 and 6 (tier 2)
    and `city:6` between 7 and 10 (tier 3), and `town:1` places exactly 1.
  - [ ] `[unit]` `npcs.test.ts` proves a special's own probability cannot be moved by
    a line roll: for the pinned seed, every special the content pass offers whose
    `Rng(hashSeed(`${seed}:node:${key}:npc-special:${rowId}`)).next() <
    cityChanceOf(row)` passes is placed, independently of the generic count — asserted
    by calling `nodeNpcs` with the same content and comparing against the same
    computation, and by checking that a `content` whose `npcs` list is empty yields
    the **same** specials.
  - [ ] `[unit]` `npcs.test.ts` proves the replay: two calls for one node are
    `toEqual`; a call after another node's call is still `toEqual` (no cross-node
    drift); every `tile` is walkable in `planCity(plan, key).tiles`, no two NPCs
    share a tile, none stands on `city.spawn` or a `building.door`.
  - [ ] `[unit]` `npcs.test.ts` proves the once rule: `useNpc(run, medicNpc)` heals
    and marks; a second call returns `{ ok: false, reason: 'once' }` and the run is
    the same object; `useNpc` on a generic answers `'line-only'`; on the keeper
    answers `'needs-scene'`; on the chef without a member `'needs-member'`, and with
    a member holding three berries it trades once and refuses the second time.
  - [ ] `[unit]` `npcs.test.ts` pins the placements: the ids, kinds, rowIds and
    coordinates for the seed §7.7 names, on `town:1` and `city:1`, equal the table in
    the doc line for line.
  - [ ] `[unit]` `src/scenes/npcs.test.ts` proves the pure half of the scene module
    with `phaser` mocked the way `MainMenuScene.test.ts` mocks it: `npcFrameOf` is
    `overworldSpriteFrame(spriteKey, 'down')` for a `'S'` facing and non-null for
    every sprite key `SPECIAL_NPCS` names; `npcCardView(placed, false)` prints
    `t(nameKey)` and `t(lineKey)` with the row's choices localised, and
    `npcCardView(placed, true)` prints `t('npc.used')` with no choices.
  - [ ] `[unit]` `src/scenes/walker.test.ts` is green: its `WorldWalker`/`canWalkStep`
    block is byte-for-byte unchanged, and the `doorAt`/`exitBandAt`/
    `interiorSceneKey` block still passes against `city:1`.
  - [ ] `[unit]` `src/engine/region/README.md` has a `npcs.ts` line **and** a
    `pois.ts` line, both one sentence, no exported names.
  - [ ] `[unit]` `docs/region-spec.md` has exactly one new `### 7.7` block, placed
    before `### 7.11`, with the pinned placement table; `git diff` on that file shows
    no other hunk.
  - [ ] `[unit]` `src/i18n/index.test.ts` is green: the two tables carry the same
    keys both ways, every new Spanish string draws in the FRLG font, no Spanish key
    declares a param English does not, and the call-site scan finds the new
    `t('npc.generic.name')`/`t(lineKey)` sites consistent (a line key has no token).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **L1 — the city's people stand where the plan put them.** With the
    harness on `city:1` (the seed §7.7 pins), read
    `window.__pkmCity.debugCityState()`. Expected, in order: `.key === 'city:1'`;
    `.npcs.length` equal to the number of rows the §7.7 table lists for `city:1`;
    for each row `i`, `.npcs[i].id`, `.rowId`, `.kind`, `.x`, `.y` equal the table's
    values exactly; every `.used` is `false`. Then call
    `__pkmCity.talkTo(<the first special's id>)` and read
    `debugCityState().card` — expected `{ rowId: <that row>, used: false }` — and
    confirm the card's own action once (the interact/confirm key). Then read
    `debugCityState().card === null` and
    `debugCityState().npcs.find(n => n.id === <id>).used === true`. Talk to the same
    NPC again and confirm again: `.used` stays `true` and
    `localStorage`'s `run.pickedItems` gains the one mark `npc-city:1-<n>-<rowId>`
    (no second mark). (Measurement: scene-object fields and one storage read.)
  - [ ] `[live]` **L2 — the town's one person is drawn and reachable.** With the
    harness on `town:1`, `debugCityState().npcs` has exactly **1** entry, its
    `.kind === 'generic'`, and its `.x`/`.y` equal the §7.7 table's `town:1` row;
    `talkTo` that id → `card = { rowId: <the table's rowId>, used: false }` and the
    NPC's line is the town's tier-1 line (`npcCardView`'s paragraph equals
    `t('npc.generic.tier1.<k>')` for the `k` the table records). (Measurement:
    scene-object fields; the card's text is read from the same view builder the
    scene uses, never from a screenshot.)

- **A `[live]` that compares pixels is not a criterion** (`D57`). Both `[live]`
  criteria read scene fields and storage JSON; the card is a Phaser window with no
  `design/screens/` frame, so no pixel, rect or colour of it is measured.

## 📣 Coordination

- **For the Orchestrator (plan changes this spec froze):**
  - Task-288's exclusive list gained `src/scenes/CityScene.ts` and
    `src/scenes/walker.test.ts` (Q4 = A) so `src/scenes/npcs.ts` has a real caller
    and its `[live]` a real screen. `src/scenes/README.md` stays Task-287's:
    **it writes the `npcs.ts` and `pois.ts` lines.**
  - `src/engine/region/README.md` is this task's and it writes **both** the `npcs.ts`
    and the `pois.ts` line; Task-289 must not edit it. The `pois.ts` line is:
    `` - `pois.ts` — the POI a lateral's terminus ends on and the zone rect a battle reads. `` (one line, no exported names).
  - `src/data/npcs.ts` keeps `NPC_ROWS` because `src/engine/region/content.ts` and
    `src/engine/routes/npcs.ts` read it and are outside the batch; `SPECIAL_NPCS` is
    the same array under the new name.
- **For Task-287:** this task edits `src/scenes/CityScene.ts`; the prologue
  (`canLeaveTown`, `'prologue'`) is enforced at `travel.ts`, not here, so the city
  screen needs no prologue branch. `src/scenes/README.md` belongs to Task-287 —
  it writes `npcs.ts`'s line.
- **For Task-289:** your `pois.ts`'s README line is written here; do **not** edit
  `src/engine/region/README.md`. Your POI scene mounts nowhere yet (Q4 = B): this
  task's `CityScene` places NPCs only.
- **For Task-290 (next batch):** the region NPC card and the once-mark
  (`npc-<nodeKey>-<n>-<rowId>` in `pickedItems`) are node-scoped, not floor-scoped;
  a world scene that adds POIs must reuse `npcUseId`'s shape for its own marks so the
  two never collide.
- **For the next batch:** the sixteen special rows' `chance`/`floorStep` are read by
  the **legacy** room roll only; a later sweep of `src/engine/routes/npcs.ts`
  (Task-298) must keep `SPECIAL_NPCS` as the single table.

## ⛔ Out of scope

- Editing `src/engine/region/content.ts`, `src/engine/routes/npcs.ts`,
  `src/engine/run/state.ts`, `src/engine/region/README.md`'s other lines,
  `src/scenes/README.md`, `src/data/README.md`.
- Deleting `NPC_ROWS`, `RouteScene`'s room NPCs, `RoomHost` or any `src/scenes/rooms/**`
  module — the sweep (Task-298) does that.
- The battle half of the NPC rows: a `battle`/`grant`/`rocket`/`berry-tree` action
  still resolves in the legacy room scene; the city card answers
  `{ ok: false, reason: 'needs-scene' }` for them and the scene marks the use.
- Any HUD panel, DOM card, `design/screens/` frame or `src/ui/hud/**` change.
- Any new dependency, `Math.random()` or `Date.now()` in `src/engine/`.
- `src/data/dex/**`, `src/main.ts`, `vite.config.ts`, `package.json`, any generated
  data file.

## ✅ Delivery

Commit on `task-288` only, never on `main`. When `npm test` and `npm run build` are
green, leave an **empty commit** `dev: done task-288` on the tip and
`git push origin task-288`. No other role commits to this branch.

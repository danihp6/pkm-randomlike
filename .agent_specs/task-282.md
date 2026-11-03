# Spec: Task-282 — The gym's puzzle is drawn from a stack, and the first one is ice

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** pure engine rules (a new `src/engine/region/gym/` folder) + one data
  table.
- **Role:** Dev.
- **Objective:** a gym stops being four rooms with nothing in its third one. A new
  `src/engine/region/gym/` folder holds the **puzzle stack** (its entries in
  `src/data/puzzles.ts`), the **ice room**'s slide rule — a step carries the player
  across the ice until a solid cell stops them, and a hole drops them into another room —
  and `planGym(plan, cityKey)`, which takes the gym's four rooms from the interior
  generator, picks the puzzle off the node's own stream, lays the ice floor on the
  `puzzle` room, and reports the `pickedItems` key a solved room is marked with, so a
  revisit finds it solved without a re-roll.
- **Environment:** worktree `../wt-pkm-282`, branch `task-282`.
- **Dependencies (already merged on `main`):**
  - the gym's interior layout — `src/engine/region/interior/plan.ts`
    (`planInterior`, `InteriorPlan`, `InteriorRoom`, `InteriorRoomKind`) and
    `src/data/region.ts` (`GYM_SIZE`);
  - the region plan and its streams — `src/engine/region/plan.ts` (`planRegion`,
    `RegionPlan`, `nodeOf`, `RegionNode`), `src/engine/region/streams.ts`
    (`nodeStreams`);
  - the run's per-floor marks — `src/engine/run/state.ts` (`RunState.pickedItems`,
    `isItemPicked`).

### Exclusive paths (single writer)

Nothing outside this list. The whole `src/engine/region/gym/` folder belongs to this
task this batch, enumerated file by file:

- `src/engine/region/gym/ice.ts` — **new**: the ice room and its slide rule.
- `src/engine/region/gym/ice.test.ts` — **new**.
- `src/engine/region/gym/stack.ts` — **new**: the stack accessors.
- `src/engine/region/gym/stack.test.ts` — **new**.
- `src/engine/region/gym/plan.ts` — **new**: `planGym`, `gymSolved`, `gymSolvedKey`.
- `src/engine/region/gym/plan.test.ts` — **new**.
- `src/engine/region/gym/index.ts` — **new**: the folder's barrel.
- `src/engine/region/gym/README.md` — **new**: the folder map (its files only).
- `src/data/puzzles.ts` — the `PUZZLE_STACK` table and the file's header.
- `src/data/puzzles.test.ts` — the stack's tests, added to the shipped ones.
- `docs/region-spec.md` — **§7.4 only**: the new `### 7.4 The gym's puzzle` section,
  inserted between §7.3 and `## 8`. No other line of that file.

**Not** claimed, deliberately: `src/engine/region/README.md` (its `gym/` folder line is
written by `[Task-280]`, which holds that file this batch — see *Coordination*),
`src/engine/region/interior/**`, `src/engine/region/plan.ts`,
`src/engine/routes/puzzle.ts`, `src/data/region.ts`, `docs/tech-decisions.md`.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/region-spec.md` §1, §3, §7 (the section it writes sits in), §7.2 (the interior
  list — the four rooms, the slot model), §7.1 (the city's doors).
- `docs/design-spec.md` §the gym's puzzle (the campaign's intent), `docs/tileset-spec.md`
  §1 (the interior tile kinds).
- `src/engine/region/interior/plan.ts`, `src/engine/region/interior/README.md`,
  `src/engine/region/interior/plan.test.ts`, `src/engine/region/plan.ts`,
  `src/engine/region/streams.ts`, `src/engine/region/content.ts`,
  `src/engine/region/README.md` (read: you do not edit it).
- `src/engine/grid.ts` (`Tile`), `src/engine/map.ts` (`TileMap`, `FLOOR`, `WALL`,
  `DOOR`, `mapSize`), `src/engine/rng.ts` (`Rng`, `hashSeed`), `src/engine/run/state.ts`
  (`RunState`, `isItemPicked`).
- `src/engine/routes/puzzle.ts` and its test (the **retired** floor puzzle: read it for
  the shuffle and the mark idioms, then leave it alone — the old route scene still reads
  it).
- `src/data/puzzles.ts`, `src/data/region.ts`, `src/data/items.ts`.
- `src/engine/region/route/map.test.ts` and `src/engine/region/city/plan.test.ts` (the
  house style for a generator's tests).

## 🔒 Contract

### `src/data/puzzles.ts` — the stack (data)

Added to the file, above the floor puzzle's rows, under a new header paragraph that says
in one line that this is the **region's** table while `PUZZLES` below is the retired
floor room's, kept until the sweep deletes it.

```ts
/** One entry in a gym's puzzle stack: the puzzle and the room it fills. */
export type PuzzleStackEntry = Readonly<{
  /** The entry's only name. The stack's first entry is `'ice'`. */
  id: string;
  /** The gym room its floor takes over. A gym's rooms are `entrance`, `trainer`, `puzzle`, `leader`. */
  room: 'puzzle';
  /** The first badge whose gym may carry it (1-8). */
  fromBadge: number;
  /** How many holes the room's floor holds. */
  holes: number;
  /** The gym room a wrong step drops the player into, by index: `0` is `entrance`. */
  dropsInto: number;
}>;

/** A gym's puzzles, in stack order: the first eligible entry is the one a gym rolls first. */
export const PUZZLE_STACK: readonly PuzzleStackEntry[] = [
  { id: 'ice', room: 'puzzle', fromBadge: 1, holes: 3, dropsInto: 0 },
];
```

The shipped `PUZZLE_ROOM`, `PUZZLES`, `PuzzleRow` and `puzzleRowsForMap` stay exactly
as they are — `src/engine/routes/puzzle.ts` and the old route scene still import them,
and a dangling import fails the build.

### `src/engine/region/gym/ice.ts` (pure — no Phaser, no DOM, no clock)

```ts
import type { Tile } from '../../grid';
import type { Rng } from '../../rng';

/** The three cells an ice floor's rect can hold. */
export type IceCell = 'ice' | 'solid' | 'hole';

/** The four ways a step can go. */
export type SlideDir = 'up' | 'down' | 'left' | 'right';

/** Where a hole puts the player. */
export type IceLanding = Readonly<{
  /** The gym room's index in `InteriorPlan.rooms`: `0` is `entrance`. */
  room: number;
  /** The cell inside that room, in the interior's own map coordinates. */
  tile: Tile;
}>;

/** A gym's third room, floored in ice. */
export type IceRoom = Readonly<{
  /** The room it fills; every gym room list has exactly one `puzzle`. */
  room: 'puzzle';
  /** The room's rect in the interior's map coordinates, wall ring included. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /**
   * One row per `rect.height`, one entry per `rect.width`, in map coordinates:
   * `cells[y - rect.y][x - rect.x]`.
   */
  cells: readonly (readonly IceCell[])[];
  /** Where a hole drops the player, keyed by `iceCellKey(tile)` of the hole's own cell. */
  landings: Readonly<Record<string, IceLanding>>;
}>;

/** What one step does. */
export type SlideResult = Readonly<{
  /** Where the player ends standing: the last `ice` cell, or `from` when nothing moved. */
  stop: Tile;
  /** The cells crossed, in order, `stop` included; `[]` when nothing moved. A hole is never in it. */
  path: readonly Tile[];
  /** Non-null when the step fell through a hole. */
  landing: IceLanding | null;
}>;

/** The request the gym plan hands the floor: its own geometry and its own stream. */
export type IceRoomRequest = Readonly<{
  /** The `puzzle` room's rect (`InteriorRoom.rect`). */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** The cell the player enters the room on (`InteriorRoom.doorIn`); holes never stand next to it. */
  entry: Tile;
  /** The room a hole drops into (`PuzzleStackEntry.dropsInto`). */
  landingRoom: number;
  /** That room's rect, whose centre is where the player lands. */
  landingRect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** How many holes the floor holds (`PuzzleStackEntry.holes`). */
  holes: number;
}>;

/** A cell's key in `IceRoom.landings`: `${tile.x},${tile.y}`. */
export function iceCellKey(tile: Tile): string;

/** The cell at `tile`, or `null` outside the rect. Total over any coordinate. */
export function iceCellAt(room: IceRoom, tile: Tile): IceCell | null;

/** The floor: an `ice` rectangle in a one-cell `solid` ring, with `holes` holes. */
export function planIceRoom(request: IceRoomRequest, layout: Rng): IceRoom;

/** One step from `from` in `dir`. Pure and total: never throws, never reads RNG. */
export function slideStep(room: IceRoom, from: Tile, dir: SlideDir): SlideResult;
```

Rules:

- **The floor.** `cells` covers the whole `rect`. The one-cell ring of the rect
  (`x`/`y` at the rect's own edges, `ICE_RING = 1`) is `solid`; every other cell is
  `ice` except the holes. A hole is drawn from the floor cells whose Manhattan distance
  to `request.entry` is **at least 2**, so the player never falls on the step that
  enters the room. The holes are picked by one Fisher–Yates shuffle off `layout` (the
  idiom `src/engine/routes/puzzle.ts` uses), in one fixed order, and nothing else is
  drawn. When the floor cannot hold `holes` eligible cells the room is **all ice with no
  holes** and no `landings` — a gym is never left unsolvable.
- **The landing.** Every hole lands on the same cell: the centre of `landingRect`,
  `{ x: landingRect.x + Math.floor(landingRect.width / 2), y: landingRect.y + Math.floor(landingRect.height / 2) }`,
  in room `landingRoom`.
- **The slide.** `slideStep` walks `from + dir`, `from + 2·dir`, … while the cell is
  `ice`. A cell that is `solid` or outside the rect stops the slide on the last `ice`
  cell entered. A `hole` ends the slide: `stop` is the last `ice` cell entered (or
  `from` when the hole is the first cell), `landing` is that hole's `IceLanding`, and the
  hole is **not** added to `path`. When the first cell in `dir` is blocked, the result is
  `{ stop: from, path: [], landing: null }`.
- **Determinism.** `planIceRoom` reads `layout` and nothing else; `slideStep` reads no
  RNG at all. Same request + same stream state ⇒ deep-equal room. No Phaser, no DOM, no
  `localStorage`, no clock, no `Math.random()`.

### `src/engine/region/gym/stack.ts` (pure)

```ts
import type { PuzzleStackEntry } from '../../../data/puzzles';

/** Every entry a gym of `badge` may carry, in stack order. */
export function gymPuzzlesFor(badge: number): readonly PuzzleStackEntry[];

/** The entries' ids, in stack order (`['ice']` today). */
export function puzzleStackIds(): readonly string[];
```

`gymPuzzlesFor(badge)` is `PUZZLE_STACK.filter((entry) => entry.fromBadge <= badge)`,
in table order, and `[]` for a badge below the first entry.

### `src/engine/region/gym/plan.ts` (pure)

```ts
import type { RegionPlan } from '../plan';
import type { InteriorPlan } from '../interior';
import type { PuzzleStackEntry } from '../../../data/puzzles';
import type { IceRoom } from './ice';

/** The puzzle a gym carries. */
export type GymPuzzlePlan = Readonly<{
  /** The stack entry the node rolled. */
  entry: PuzzleStackEntry;
  /** The ice floor, when the entry is `'ice'`; `null` for a future entry with no floor yet. */
  ice: IceRoom | null;
}>;

export type GymPlan = Readonly<{
  /** The gym city's node key, `city:<n>`. */
  cityKey: string;
  /** The gym's four rooms, exactly as `planInterior(plan, 'gym', cityKey)` emits them. */
  interior: InteriorPlan;
  puzzle: GymPuzzlePlan;
  /** The mark a solved room leaves in `RunState.pickedItems`: `gym-solved:<cityKey>`. */
  solvedKey: string;
}>;

/** `gym-solved:<cityKey>` — the one key a solved gym is remembered by. */
export function gymSolvedKey(cityKey: string): string;

/** The gym a city node holds, or a throw when the key is not a gym city. */
export function planGym(plan: RegionPlan, cityKey: string): GymPlan;

/** True when the run's marks already carry this gym's `solvedKey`. Never re-rolls anything. */
export function gymSolved(run: Readonly<{ pickedItems: readonly string[] }>, gym: GymPlan): boolean;
```

Rules:

- `planGym` refuses a key the plan holds no gym for — `nodeOf(plan, cityKey)` undefined,
  or a node whose `gym` is `false` — with `throw new Error(\`not a gym: ${cityKey}\`)`.
- It calls `planInterior(plan, 'gym', cityKey)` and keeps that object as `interior`; the
  `puzzle` room is `interior.rooms[2]` and the landing room is
  `interior.rooms[entry.dropsInto]`.
- **Streams.** The entry is rolled off the gym's own sub-key so it cannot move the
  city's content pass: `const eligible = gymPuzzlesFor(node.badge)` and
  `entry = eligible[nodeStreams(plan.seed, \`${cityKey}/gym\`).content.int(0, eligible.length - 1)]`.
  The ice floor is planed off a second sub-key,
  `nodeStreams(plan.seed, \`${cityKey}/gym/puzzle\`).content`. `planNodeContent`'s own
  draws are untouched and replay identically before and after `planGym` (`D60`).
- `puzzle.ice` is `planIceRoom({ rect, entry: rooms[2].doorIn!, landingRoom:
  entry.dropsInto, landingRect: rooms[entry.dropsInto].rect, holes: entry.holes }, that stream)`
  when `entry.id === 'ice'`, and `null` otherwise. `rooms[2].doorIn` is always present on
  a gym (the entrance is the only room without one).
- `solvedKey` is `gymSolvedKey(cityKey)`, and `gymSolved(run, gym)` is
  `run.pickedItems.includes(gym.solvedKey)` — a read of the run, never a re-roll, so a
  revisit that recomputes the same plan reads the same solved state.
- `planGym` is pure and total (apart from the two documented throws) and deep-equal on
  repeated calls.

### `src/engine/region/gym/index.ts`

```ts
export * from './ice';
export * from './plan';
export * from './stack';
```

`src/engine/region/index.ts` is **not** edited (its barrel re-exports `plan`, `names`,
`streams` and `content` only, and that file is nobody's this batch). Callers import
`../engine/region/gym` by folder.

## 🧩 Data and configuration

- `PUZZLE_STACK` (above): four keys, all required — `id` (string, unique, `'ice'` first),
  `room` (`'puzzle'`), `fromBadge` (1-8, ascending in table order), `holes` (a positive
  integer the room's floor can hold; 3 today), `dropsInto` (a gym room index; 0 today).
- The ice floor's cells (`IceCell`), the slide directions (`SlideDir`) and the landing
  shape are the module's own vocabulary, not data: a new puzzle is a new stack row plus a
  new module, never a branch in this one.
- No balancing number lives in `src/engine/`: the hole count comes from the stack row,
  the badge from the plan, the rects from the interior generator.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the four test files this task
  adds or extends.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-282` audited against the exclusive paths list.
- **No browser pass is owed:** every criterion below is `[unit]`. Nothing in this task
  draws; the gym screen is a later batch's.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is green.
- [ ] `[unit]` `npm test` is green; `src/engine/region/gym/{ice,stack,plan}.test.ts`
      exist and pass, and the shipped `src/data/puzzles.test.ts` still passes with the
      stack's tests added.
- [ ] `[unit]` `src/data/puzzles.test.ts` pins the stack: `PUZZLE_STACK` is non-empty,
      `PUZZLE_STACK[0].id === 'ice'`, every id is unique and non-empty, every `room` is
      `'puzzle'`, `fromBadge` is 1-8 and never decreases down the table, and `holes` is a
      positive integer.
- [ ] `[unit]` `stack.test.ts` pins: `gymPuzzlesFor(1)` starts with the `'ice'` entry;
      `gymPuzzlesFor(0)` is `[]`; `gymPuzzlesFor(n)` is a prefix of `PUZZLE_STACK` for
      `n` in 1-8; `puzzleStackIds()` equals `PUZZLE_STACK.map((entry) => entry.id)`.
- [ ] `[unit]` `ice.test.ts` pins the slide on a hand-built room: a slide across open
      ice stops on the cell **before** the first `solid` (and the cell after the stop is
      that `solid`); a blocked first step answers `{ stop: from, path: [], landing: null }`;
      a hole midway answers `landing` equal to that hole's `IceLanding` and a `path` that
      does not contain the hole; a hole as the first cell answers `stop === from` **and**
      a non-null `landing`; all four directions.
- [ ] `[unit]` `ice.test.ts` pins `planIceRoom`: the returned `cells` is `rect.height`
      rows of `rect.width` entries; the ring is `solid` on all four sides; exactly
      `holes` cells are `hole`, each with a `landings` entry whose `room` is
      `landingRoom` and whose `tile` is the landing rect's centre; no hole is within
      Manhattan distance 1 of `entry`; two calls with the same `Rng` seed are deep-equal
      and a different seed differs; a floor too small for the holes answers an all-ice
      room with no `landings`.
- [ ] `[unit]` `plan.test.ts` pins, on `planRegion('task-282')`: `planGym(plan, 'city:1')`
      has four rooms whose names are `entrance`, `trainer`, `puzzle`, `leader`, a
      `puzzle.entry` whose id starts the stack, and an `ice` room whose `rect` equals
      `interior.rooms[2].rect` and whose hole count equals `entry.holes`; two calls are
      deep-equal (the fixed-seed regression this generator owes); `planGym(plan, 'town:1')`
      and `planGym(plan, 'route:1')` each throw `/^not a gym: /`.
- [ ] `[unit]` `plan.test.ts` pins "no stream is consumed": `planNodeContent(plan, 'city:1', tier)`
      deep-equals the same call made after `planGym(plan, 'city:1')`, and
      `planInterior(plan, 'gym', 'city:1')` still deep-equals `planGym(...).interior`.
- [ ] `[unit]` `plan.test.ts` pins the solved flag:
      `gymSolvedKey('city:1') === 'gym-solved:city:1'`; `gymSolved({ pickedItems: [] }, gym)`
      is `false`; `gymSolved({ pickedItems: ['gym-solved:city:1'] }, gym)` is `true`; and
      the same plan object is reported solved on a second call without the room changing.
- [ ] `[unit]` Nothing outside the exclusive paths was touched
      (`git diff --name-only main...task-282`).
- [ ] `[unit]` `docs/region-spec.md` has the new section and only it: `grep -n '^### 7.4 ' docs/region-spec.md`
      prints exactly one line, it reads `### 7.4 The gym's puzzle`, and §5 (the region
      map) and §7.3 (node content) are byte-identical to `main`
      (`git diff -U0 main...task-282 -- docs/region-spec.md` shows one added block).

## 📣 Coordination

- **For the Architect — what this spec had to fix in the item:**
  1. The item's *Claims* line lists `ice.ts`, `stack.ts` and `README.md` but gives
     `planGym` no file. It is added: `src/engine/region/gym/plan.ts` (+ its test) and the
     folder's `index.ts`. Nothing else in the batch touches `src/engine/region/gym/`, so
     the folder stays one writer's.
  2. `src/data/puzzles.test.ts` already exists (the floor table's seven tests). The item
     says "puzzles.test.ts"; the stack's tests are **added** to it, never replacing the
     shipped ones — `src/engine/routes/puzzle.ts` still reads `PUZZLES`.
  3. The item says "`planGym(plan, key)` picks the puzzle off the node's `content`
     stream". Reading `nodeStreams(seed, cityKey).content` twice would replay
     `planNodeContent`'s first draw; the gym therefore rolls off its **own sub-key**
     (`<cityKey>/gym`, the same one `planInterior` uses for its `layout`), with an
     `.content` and a `<cityKey>/gym/puzzle` `.content` for the floor. `D60` keeps the
     family: a node's sub-keys replay alone.
  4. `D##`: none written. The item's *Claims* line does not name
     `docs/tech-decisions.md`, and the phase's numbering is already short (`D65`/`D66`
     were assigned to the merged previous batch and never written). Flagged to the
     Orchestrator/human; the decision text, if the human wants it recorded, is: a gym's
     puzzle is a row in `PUZZLE_STACK`, its floor and its rule live in one module per
     puzzle, and a solved room is remembered by one `pickedItems` key, never by a
     regenerated flag.
- **For the next batch — what it may assume:** the gym screen task
  (the gym scene over the interior scene's base) reads
  - `planGym(plan, cityKey)` for the four rooms plus `puzzle.ice`;
  - `slideStep(room, from, dir)` for every step taken inside the `puzzle` room, and
    applies `landing.room`/`landing.tile` by moving the player into that room;
  - `gymSolved(run, gym)` to decide whether the puzzle is already open, and
    `markItemPicked(run, gym.solvedKey)` (`src/engine/run/state.ts`) to solve it — there
    is no other flag;
  - `gymPuzzlesFor(badge)` to list the stack a gym of that badge could carry.
  Nothing in this folder draws, reads `RunState` mutably or owns a scene.
- **For `[Task-280]`:** that task writes the single line for this folder in
  `src/engine/region/README.md`. Do not edit that file; your folder's map is
  `src/engine/region/gym/README.md`, one role line per file, no exported names.
- **For `[Task-285]`** (the gym scene, later batch): the ice floor fights nothing and
  spawns nothing — it is geometry and a rule. Trainers, the leader and the badge are that
  task's.

## ⛔ Out of scope

- **No gym scene, no drawing, no `src/scenes/**`, no Phaser, no DOM.**
- No second puzzle: the stack has one entry and this task ships the ice room only. A new
  entry is a new stack row plus its own module, in its own task.
- No change to `src/engine/region/interior/plan.ts`, to the gym's four rooms, to the
  slot model, to `src/engine/region/plan.ts`, to `src/data/region.ts` or to
  `GYM_SIZE`/`INTERIOR_SIZE`.
- No change to the retired floor puzzle: `src/engine/routes/puzzle.ts`,
  `PUZZLE_ROOM`, `PUZZLES` and `puzzleRowsForMap` stay live for the old route scene and
  die with the sweep task.
- No `src/engine/region/README.md` edit, no `src/engine/region/index.ts` edit, no
  `docs/tech-decisions.md` edit, no i18n key.
- No badge, trainer, roster or reward logic: a solved ice room pays nothing by itself.

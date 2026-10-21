# Spec: Task-102 — The puzzle rooms: a switch sequence that pays an item

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data + Phaser scene (the special-room layer) + docs.
- **Role:** Dev.
- **Objective:** the plan learns a **tenth special room** (`'puzzle'`) — a dead-end
  leaf whose floor holds a row of **switches** the player presses with the interact
  key in a **rolled order**. A correct press advances the sequence, a wrong one
  resets it (the row says so), and the completed sequence records the solve as
  `puzzle-<map>-<room>` in the run's `pickedItems` and a **ground item** appears at
  the room's reward tile. A revisit re-reads the run's mark, so the room is never
  solved twice; a reload re-draws the same room, the same switches and the same
  order. **No run field is added** and the run's `SAVE_VERSION` does not move.
- **Environment:** worktree `../wt-pkm-102`, branch `task-102`.
- **Dependencies:** **none** — the special-room layer (`src/scenes/rooms/types.ts`
  + `registry.ts`, `D47`), the plan's special pass
  (`src/engine/maps/plan.ts`), the tile vocabulary (`src/engine/map.ts`), the
  ground-item path (`RouteScene.collectItemAt` + `RouteFixture.items`), the notice
  module (`src/ui/notice.ts`) and the i18n tables are all shipped on this commit.

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
Deleting a stray `.gitkeep` from a directory this task populates is always allowed.

- `src/engine/maps/plan.ts` — the `'puzzle'` kind and its own minted draw
- `src/engine/maps/plan.test.ts`
- `src/engine/run/curve.test.ts` — **re-pin only** (see *Plan pins*)
- `src/data/run.ts` — **only** if a floor leaves the curve window (see *Plan pins*)
- `docs/balance/route-curve.md` — the re-walk paragraph, if a pin moved
- `src/engine/routes/battlefield.test.ts` — **re-pin only** (`BOSS_PINS`, maps 4+)
- `src/engine/routes/puzzle.ts` *(new)*
- `src/engine/routes/puzzle.test.ts` *(new)*
- `src/engine/routes/index.ts` — the barrel line
- `src/data/puzzles.ts` *(new)*
- `src/data/puzzles.test.ts` *(new)*
- `src/scenes/rooms/puzzle.ts` *(new)*
- `src/scenes/rooms/puzzle.test.ts` *(new)*
- `src/scenes/rooms/registry.test.ts` — `SHIPPED_KINDS` gains `'puzzle'`
- `src/ui/notice.ts` + `src/ui/notice.test.ts` — the three puzzle notices
- `src/i18n/en.ts` + `src/i18n/es.ts` — three keys
- `src/engine/README.md`, `src/data/README.md`, `src/scenes/rooms/README.md`
- `docs/maps-spec.md` §7 — **one table row, one clause in the rates paragraph and
  one new `###` subsection only** (see *Docs blocks*)
- `docs/routes-spec.md` §2 — one new paragraph

**This task does not touch `src/scenes/RouteScene.ts`.** The room layer carries the
whole room: the scene already calls a descriptor's `fixture`, `interact` and
`drawFixture` (`D47`), so the room needs **no** scene edit and **no** generator
pass. Do not add one.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/agent-spec-template.md`, `docs/maps-spec.md` §2/§7, `docs/routes-spec.md`
  §2, `docs/design-spec.md` §7, `TODO.md`'s `[Task-102]` entry
- `src/engine/maps/plan.ts`, `src/engine/maps/progress.ts`, `src/engine/map.ts`,
  `src/engine/grid.ts`, `src/engine/rng.ts`
- `src/engine/routes/routeMap.ts`, `src/engine/routes/validate.ts`,
  `src/engine/routes/gate.ts` + test (this task's template), `src/engine/routes/index.ts`
- `src/data/gates.ts`, `src/data/noHeal.ts`, `src/data/bannedRoom.ts`,
  `src/data/items.ts` (the reward ids this task may name), `src/data/itemIcons.ts`
- `src/scenes/rooms/types.ts`, `src/scenes/rooms/registry.ts`,
  `src/scenes/rooms/gate.ts`, `src/scenes/rooms/banned.ts` + test,
  `src/scenes/rooms/noHeal.ts`
- `src/scenes/RouteScene.ts` (read only: how `buildRoom`, `drawRoomFixture`,
  `tryInteract` and `collectItemAt` call a descriptor)
- `src/ui/notice.ts` + `src/ui/notice.test.ts`, `src/ui/mapView.ts`,
  `src/i18n/en.ts`, `src/i18n/es.ts`, `src/i18n/index.ts`

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion.

### TypeScript

```ts
// src/data/puzzles.ts  (new, pure data, no imports)
export type PuzzleRow = Readonly<{
  /** The row's id; also the plan's `rowId`. */
  id: string;
  /** How many switches the room holds (2..5). */
  switches: number;
  /** The catalogue id (`src/data/items.ts`) the solved room pays. */
  reward: string;
  /** The first map whose floor may carry the row. */
  fromMap: number;
  /** A wrong press sends the sequence back to 0 (the only shipped value is `true`). */
  wrongResets: boolean;
}>;

/** The leaf's own placement: the first floor that may hang it and its chance. */
export const PUZZLE_ROOM: Readonly<{ fromMap: number; chance: number }>;

export const PUZZLES: readonly PuzzleRow[];

/** The rows `mapIndex` may carry, in table order. */
export function puzzleRowsForMap(mapIndex: number): readonly PuzzleRow[];
```

```ts
// src/engine/routes/puzzle.ts  (new, pure: no Phaser, no DOM, no run mutation)
import type { Tile } from '../grid';
import type { TileMap } from '../map';
import type { RunState } from '../run/state';

export type PuzzleLayout = Readonly<{
  /** The `PUZZLES` row the room carries. */
  rowId: string;
  /** The switch tiles, in **slot order** (`switches[slot]`). */
  switches: readonly Tile[];
  /** The slot indices in **press order**: a permutation of `0..switches-1`. */
  order: readonly number[];
  /** The tile the reward item is placed on once the room is solved. */
  reward: Tile;
  /** Copied from the row, so the rule reads the data, never a constant. */
  wrongResets: boolean;
}>;

export type PuzzleOptions = Readonly<{ seed: string; mapIndex: number; roomId: number }>;

/**
 * The room's whole puzzle: which row it carries, where its switches and its
 * reward stand, and the order they must be pressed in. Pure and deterministic:
 * three minted streams (see *Determinism*). Null when the floor carries no
 * eligible row or the room has too few free tiles — the caller then places
 * nothing and shows no notice.
 */
export function puzzleLayout(
  route: Readonly<{ tiles: TileMap; entry: Tile }>,
  options: PuzzleOptions,
): PuzzleLayout | null;

/** The progress after pressing `slot`: `progress + 1` on a correct press, else
 * `wrongResets ? 0 : progress`. Never above `order.length`. */
export function puzzlePress(
  progress: number,
  slot: number,
  order: readonly number[],
  wrongResets: boolean,
): number;

/** True when every slot has been pressed in order. */
export function puzzleIsSolved(progress: number, order: readonly number[]): boolean;

/** The solve's per-floor mark in `pickedItems`: `puzzle-<mapIndex>-<roomId>`. */
export function puzzleId(mapIndex: number, roomId: number): string;

/** The reward's ground-item id: `puzzle-loot-<mapIndex>-<roomId>`. */
export function puzzleRewardId(mapIndex: number, roomId: number): string;

/** True when this floor's room already carries its solve mark (`puzzleId` is in
 * `pickedItems`). */
export function puzzleMarked(run: RunState, mapIndex: number, roomId: number): boolean;
```

```ts
// src/engine/maps/plan.ts
export type MapRoomSpecial =
  | 'mini-boss' | 'mega-stone' | 'casino' | 'gated' | 'trade'
  | 'no-heal' | 'static' | 'secret-shop' | 'banned'
  | 'puzzle'; // the tenth kind, this task's
```

```ts
// src/ui/notice.ts
/** Entering the leaf: the room explains its rule. */
export function puzzleRoomNotice(): Notice;   // t('notice.puzzleRoom')
/** A wrong press sent the sequence back to the start. */
export function puzzleResetNotice(): Notice;  // t('notice.puzzleReset')
/** The sequence is complete and the reward is on the floor. */
export function puzzleSolvedNotice(): Notice; // t('notice.puzzleSolved')
```

- **Ordering inside `puzzleLayout`.** (1) `rows = puzzleRowsForMap(mapIndex)`; return
  `null` when it is empty. (2) Pick the row with
  `new Rng(hashSeed(`${seed}:puzzle:${mapIndex}:${roomId}:row`)).int(0, rows.length - 1)`
  — **one** draw. (3) Build the site candidates and pick the tiles off
  `…:sites` (below). (4) Build `order` off `…:order` (below). Return the layout.
- **Site rule.** A candidate tile is one where `isWalkable(tiles, tile)` is true,
  `reachableTiles(tiles, entry)` contains it, and its **Manhattan distance from
  `entry` is at least 2** (so the player never presses a switch by spawning on it).
  Tiles are collected in row-major order (`y` then `x`), then shuffled with the
  `…:sites` stream (Fisher-Yates, `rng.int(0, i)` per step, descending `i`). The
  layout takes `switches + 1` tiles: the **first `switches`** become `switches` in
  that shuffled order, the **last** is `reward`. Fewer candidates than
  `switches + 1` returns `null`.
- **Order rule.** `order` starts as `[0, 1, …, switches-1]` and is shuffled with the
  `…:order` stream (same Fisher-Yates shape). It is a permutation, so no slot
  repeats and every slot is pressed exactly once.
- **The room's rule (the descriptor).** `interact(host, tile)` returns `false` at
  once when the room is already solved (`puzzleMarked`), so the key falls through to
  the ground item on a revisit. Otherwise it finds the layout's slot whose tile
  equals `tile`; when none does, it returns `false` (the key falls through to the
  shipped trainer/item paths). On a hit it computes the next
  progress with `puzzlePress`, and then:
  - **solved** (`puzzleIsSolved`): `host.commitRun(markItemPicked(host.run, puzzleId(...)))`,
    then `host.rebuildRoom()` (which re-runs the fixture and therefore places the
    reward), then `host.showNotice(puzzleSolvedNotice())`; progress is cleared.
  - **not solved**: store the new progress for the room and repaint the switches;
    `host.showNotice(puzzleResetNotice())` **only** when the press reset the
    sequence (the new progress is 0 and the previous one was not 0).
  Return `true` in both branches.
- **Where the progress lives.** The descriptor module keeps its own
  `Map<string, number>` keyed `` `${mapIndex}:${roomId}` ``. `fixture` and
  `drawFixture` **do not clear it** (a `rebuildRoom()` mid-solve must not lose it);
  a different room's key is simply never read, and a fresh page load starts empty.
  Progress is deliberately **not** run state: leaving the room forgets it, and a
  solved room is solved for the rest of the floor through `pickedItems` alone.
- **The fixture.** It returns, in this order of precedence:
  - `null` when there is no layout;
  - `{ notice: puzzleRoomNotice() }` when the room is **not** solved (the entry
    hint, like the no-heal leaf's);
  - `{ items: [{ id: puzzleRewardId(mapIndex, roomId), position: layout.reward, itemId: row.reward, hidden: false }] }`
    when the room **is** solved and the reward id is not yet in `pickedItems`;
  - `{}` when it is solved and the reward was already taken.
  No trainers, no counter, no hidden item.
- **The drawing.** `drawFixture` does **nothing** while `host.generatorStepActive()`
  and does **nothing** once the room is solved (`puzzleMarked(host.run,
  view.mapIndex, view.roomId)` is true: a solved room shows no discs), and otherwise
  creates **one circle per switch** with the shipped fixture style
  (`src/scenes/rooms/staticSpecies.ts` is the template):

  ```ts
  const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;
  const SWITCH_RADIUS = TILE_SIZE * 0.22;
  const FIXTURE_DEPTH = 5; // the ground items' band (`RouteScene`'s ACTOR_DEPTH is 8)
  const PRESSED = 0xf2c94c;
  const RESTING = 0x94a3b8;
  const RING = 0x10161f;
  ```

  Each disc is `host.scene.add.circle(centerX(tile.x), centerY(tile.y), SWITCH_RADIUS, fill)`
  with `.setDepth(FIXTURE_DEPTH)` and a 2px `setStrokeStyle(2, RING)`, filled
  `RESTING` when its slot is not among the first `progress` entries of `order` and
  `PRESSED` when it is. The discs and the progress are kept together in the
  descriptor's own `Map<string, { progress: number; discs: Phaser.GameObjects.Arc[] }>`
  (key `` `${mapIndex}:${roomId}` ``), so a press repaints by calling
  `disc.setFillStyle(...)` on the two discs whose state changed — never by
  rebuilding the room. The scene books every created object into its teardown list
  and the HUD camera ignore list (`drawRoomFixture` does that for every object
  created during the call), and a room change re-runs `drawFixture`, which
  overwrites the map entry with the new discs. `import type Phaser from 'phaser'`
  is the only Phaser reference the module takes (the `types.ts` precedent).
- **Determinism (D11).** This task reads **three minted streams**, all keyed by the
  room and never by the run's moving `routeIndex`:
  `` Rng(hashSeed(`${seed}:puzzle:${mapIndex}:${roomId}:row`)) `` (one `int`),
  `` …:order `` (one `int` per shuffle step) and `` …:sites `` (one `int` per shuffle
  step). The plan's own draw is a **fourth** minted stream,
  `` Rng(hashSeed(`${seed}:map:${index}:puzzle-room`)) ``, appended **last** of the
  special pass, so no floor's biome, room count, topology, room id, size, role or
  shipped special moves (the `static`/`secret-shop`/`banned` precedent). Nothing
  reads `state.rng`: no battle, encounter, roster or loot draw moves.
- Rules: no Phaser import in `src/engine/`, no DOM, no allocation in a hot path
  (everything here runs once per room build or once per interact press, never per
  frame).

### Data

- `MapRoomSpecial` gains `'puzzle'`: **the tenth special kind**. Its row hangs off
  a regular room that is neither the entry nor the boss and is never farther from
  the entry than the boss (`freeParents` already enforces both).
- `PUZZLE_ROOM.fromMap = 2`, `PUZZLE_ROOM.chance = 0.2` — the same magnitude the
  casino leaf uses from map 2, so the on-ramp gains one optional leaf and the
  floor's trainer budget stays green.
- The solve and the reward are **per floor**: both ids carry `mapIndex` and both
  ride `pickedItems`, which `advanceMap` already clears. **No `RunState` field and
  no `SAVE_VERSION` step.**
- The three i18n keys, one `{token}`-free line each:

  | Key | en | es |
  | --- | --- | --- |
  | `notice.puzzleRoom` | `The switches click in a set order.` | `Los interruptores suenan en un orden fijo.` |
  | `notice.puzzleReset` | `The switches reset.` | `Los interruptores se reinician.` |
  | `notice.puzzleSolved` | `The last switch clicks — something appears!` | `¡El último interruptor encaja y algo aparece!` |

  No key declares a `{param}`, so `src/i18n/index.test.ts`'s call-site scanner
  must find no parameter at their `t(...)` sites.

## 🧩 Data and configuration

`src/data/puzzles.ts` (new, pure, no imports):

```ts
export const PUZZLE_ROOM = { fromMap: 2, chance: 0.2 } as const;

export const PUZZLES: readonly PuzzleRow[] = [
  { id: 'three', switches: 3, reward: 'nugget', fromMap: 2, wrongResets: true },
  { id: 'four', switches: 4, reward: 'bignugget', fromMap: 5, wrongResets: true },
];
```

- Both reward ids are **existing** catalogue rows (`src/data/items.ts`, kind
  `valuable`), so this task names no new item and touches no item table. `nugget`
  pays the on-ramp, `bignugget` the deep floors — the row is why `fromMap` exists
  per row, and why the row is picked off its own stream: a fixed seed's room
  carries the same row forever.
- `puzzleRowsForMap(mapIndex)` returns every row whose `fromMap <= mapIndex`, in
  table order, and never an empty list for `mapIndex >= 2`.
- The plan's draw, appended after the banned leaf's and **before** the trainer-role
  pass:

  ```ts
  const puzzleRng = new Rng(hashSeed(`${seed}:map:${index}:puzzle-room`));
  if (index >= PUZZLE_ROOM.fromMap && puzzleRng.next() < PUZZLE_ROOM.chance) {
    const parents = freeParents();
    if (parents.length > 0) addSpecial('puzzle', parents[puzzleRng.int(0, parents.length - 1)], puzzleRng);
  }
  ```

  `addSpecial`'s two size draws come from `puzzleRng`, exactly as the `banned` leaf
  does, so the `map` stream does not advance.

**Folder READMEs** (one role line per file, no exported names):
- `src/data/README.md` — a `puzzles.ts` bullet right after the `bannedRoom.ts` one:
  the leaf's first floor and chance, and one row per puzzle with its switch count,
  its reward id, its first floor and the wrong-press rule.
- `src/scenes/rooms/README.md` — `puzzle.ts` and `puzzle.test.ts` right after the
  `banned.ts` / `banned.test.ts` pair: the switch sequence, the per-room progress
  the descriptor keeps, the reward it places once the run's mark says solved, and
  its own marker.
- `src/engine/README.md` — the `routes/` bullet gains `routes/puzzle.ts` after the
  `routes/bannedRoom.ts` clause: the puzzle room's layout (row, switch tiles, press
  order, reward tile), the press rule and the two per-floor ids.

`src/scenes/rooms/puzzle.ts` (new): `kind: 'puzzle'`, `marker: 'puzzle'`, and the
four hooks `fixture`, `interact`, `drawFixture`, `drawMarker` as frozen above.
`drawMarker` paints the glyph no other room draws: a `0x38bdf8` disc
(`fillStyle(0x38bdf8, 1)`, `fillCircle(cx, cy, radius * 0.8)`), then three
`0x10161f` bars — `fillRect(cx - radius * 0.55, cy - radius * 0.45, radius * 1.1, radius * 0.22)`,
`fillRect(cx - radius * 0.55, cy - radius * 0.11, radius * 1.1, radius * 0.22)` and
`fillRect(cx - radius * 0.55, cy + radius * 0.23, radius * 1.1, radius * 0.22)` —
the "switches" read.

### Docs blocks

- `docs/maps-spec.md` §7: (a) **one table row** appended after the `banned` row —
  room `puzzle`, per floor `20 % from map 2 on`, placement `a leaf anywhere`,
  content: a switch sequence pressed with the interact key in the row's own order,
  a wrong press resetting it, and the solved room paying one ground item; (b) **one
  clause** in the rates paragraph, after the secret-shop sentence: the puzzle leaf
  is the special pass's **last** draw, on its own `…:puzzle-room` stream, so it
  moves nothing; (c) **one new `### The puzzle room` subsection** after
  `### The banned-species room`, covering the layout (row, switch tiles, press
  order, reward tile), the three streams, the `puzzle-<map>-<room>` /
  `puzzle-loot-<map>-<room>` ids and the fact that the reward is an ordinary
  visible ground item. **Nothing else in §7 moves** — the casino row, the NPC
  table, the other subsections and the rates paragraph's existing sentences are
  other tasks' blocks and stay byte-identical.
- `docs/routes-spec.md` §2: one paragraph after the gated vault's, saying a
  special leaf's own content (the puzzle's switches and its reward) is placed by
  the **room descriptor at build time**, from the route's own tiles and its own
  minted streams, and that no build pass and no `RouteRequest` field is involved.

### Plan pins (the moves a new leaf causes, and nothing else)

A floor that hangs the puzzle leaf holds **one room more**, and
`routeIndexForRoom` (`src/engine/run/floors.ts`) sums the floors before it, so
every floor **after** the first one that hangs a leaf builds its rooms from a
shifted route index. Handle it by these rules and no others:

1. `src/engine/maps/plan.test.ts` — add `'puzzle'` to the `filter` list of the
   *never moves a shipped special leaf* test (so the new kind is excluded from the
   `SHIPPED_SPECIALS` comparison) and add **one new pin** (`PUZZLE_LEAVES`, 8 seeds ×
   maps 1–8, shape of the `BAN_LEAVES`/`STATIC_LEAVES` pins) recording the puzzle
   room ids. Every
   pre-existing pin (`SHIPPED_SPECIALS`, `PLAN_PINS`, `STATIC_LEAVES`,
   `SECRET_SHOP_LEAVES`, `TRADE_LEAVES`, `BAN_LEAVES`, the boss/portal and
   trainer-role pins) must stay **byte-identical**. If one moves, the draw is in
   the wrong place: stop and report it, do not re-pin.
2. `src/engine/run/curve.test.ts` — re-measure the eight rows of `MEASURED_FILL` and
   record them in the header comment as a **new re-pin paragraph** naming this task.
   If a floor's fill leaves the `MIN_FILL = 1.05` – `1.5` window, re-solve **that
   floor only** with `factor' = round2(factor × 1.25 / fill)`, write it in
   `src/data/run.ts`'s `TRAINER_XP_PER_MAP` and record the recipe in
   `docs/balance/route-curve.md`. Never move a factor that still sits inside the
   window, and never touch `src/data/run.ts` or `docs/balance/route-curve.md` when
   no floor left it.
3. `src/engine/routes/battlefield.test.ts` — `BOSS_PINS` is read through
   `routeIndexForRoom`; a boss opening on **map 4 or later** may move. Re-pin only
   the moved rows and add one sentence naming the cause. Any **other** fixed-seed
   expectation that moves must be derived from `routeIndexForRoom`/`floorForRoute`
   on a floor of **map 4 or later**; if one is not, it is a defect: stop and report
   it in the commit message instead of re-pinning. Every re-pinned literal carries a
   comment with its pre-change value.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the tests this task adds.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-102` audited against the exclusive paths list.
- Browser pass **is** required (two `[live]` criteria below).

### Acceptance criteria

- [ ] `[unit]` It typechecks and builds clean: `npm run build`.
- [ ] `[unit]` The whole suite is green: `npm test`.
- [ ] `[unit]` Nothing outside the exclusive paths was touched:
  `git diff --name-only main...task-102`.
- [ ] `[unit]` The three new test files exist and pass:
  `npx vitest run src/engine/routes/puzzle.test.ts src/data/puzzles.test.ts src/scenes/rooms/puzzle.test.ts`.
- [ ] `[unit]` The plan hangs the leaf by the frozen rules:
  `npx vitest run src/engine/maps/plan.test.ts` — never on map 1, at most one per
  floor, `dead-end`, `wild`, not the entry, not the boss, never farther than the
  boss, listed in `plan.specials`; the new per-seed pin records the room ids; every
  pre-existing pin is unchanged (diff the file: only the new pin, the `'puzzle'`
  filter line and the new test appear).
- [ ] `[unit]` The layout is the frozen one:
  `npx vitest run src/engine/routes/puzzle.test.ts` covers (a) two calls with the
  same `(seed, mapIndex, roomId)` returning deep-equal layouts, (b) a different
  `roomId` changing the order, (c) `switches.length` equal to the row's
  `switches` and `order` a permutation of `0..switches-1`, (d) every switch tile
  walkable, reachable from the entry and at Manhattan distance ≥ 2 from it,
  (e) `reward` distinct from every switch, (f) `null` when the room offers fewer
  than `switches + 1` candidates, and (g) `puzzleRowsForMap(1)` being empty while
  `puzzleRowsForMap(2)` holds the `three` row and `puzzleRowsForMap(5)` both.
- [ ] `[unit]` The press rule is the frozen one:
  `npx vitest run src/engine/routes/puzzle.test.ts` covers `puzzlePress(0, order[0], order, true) === 1`,
  a wrong press from progress 2 returning 0 with `wrongResets`, the same wrong
  press leaving 2 with `wrongResets: false`, a press never exceeding
  `order.length`, `puzzleIsSolved(3, [2,0,1])` true and `puzzleIsSolved(2, [2,0,1])`
  false.
- [ ] `[unit]` The two ids are the frozen ones and the solve re-reads the run:
  `npx vitest run src/engine/routes/puzzle.test.ts` — `puzzleId(3, 7)` is
  `'puzzle-3-7'`, `puzzleRewardId(3, 7)` is `'puzzle-loot-3-7'`,
  `puzzleMarked` false on a clean run and true after `markItemPicked` of that id.
- [ ] `[unit]` The data table is the frozen one:
  `npx vitest run src/data/puzzles.test.ts` asserts `PUZZLE_ROOM` equals
  `{ fromMap: 2, chance: 0.2 }`, that both rows' `switches` are in `2..5`, that both
  `reward` ids resolve through `getItem`, that `fromMap` is non-decreasing, that
  every id is unique and that `wrongResets` is `true`.
- [ ] `[unit]` The descriptor is the frozen one:
  `npx vitest run src/scenes/rooms/puzzle.test.ts` covers (a) `kind`/`marker`,
  (b) the entry notice while unsolved, (c) the reward `RouteItem` with
  `puzzleRewardId`, the layout's `reward` tile and the row's `reward` id once the
  solve mark is in `pickedItems`, (d) `{}` when the reward was taken, (e) an
  `interact` on a switch advancing the progress, one off the switches returning
  `false`, and **every** press returning `false` once the room is marked, (f) the
  solved press calling `commitRun` (with the mark), `rebuildRoom`
  and the solved notice, (g) the marker's paint calls in the frozen order and
  colours, and (h) `drawFixture` creating no object on a solved room.
- [ ] `[unit]` The registry collects the new kind:
  `npx vitest run src/scenes/rooms/registry.test.ts` (its `SHIPPED_KINDS` list now
  contains `'puzzle'` and every kind resolves a descriptor).
- [ ] `[unit]` The notices read their keys:
  `npx vitest run src/ui/notice.test.ts src/i18n/index.test.ts` — the three keys
  exist in both tables with no `{token}`, the Spanish uses no em dash and only
  FRLG-drawable characters, and each builder returns `NOTICE_HOLD_MS`.
- [ ] `[unit]` No run field and no version step: `git diff main...task-102 -- src/engine/save.ts src/engine/run/state.ts`
  is empty and `grep -n "SAVE_VERSION = " src/engine/save.ts` still reads **22**.
- [ ] `[live]` The room draws its switches and answers the interact key.
  Measurement: `npm run dev`, start a run with a seed of the `PUZZLE_LEAVES` pin that
  records a room id on its floor, open the debug menu (`F`), set that floor and room
  id,
  press Go; the room shows `n` grey discs (n = the row's `switches`), each centred
  on its own reachable tile; facing one and pressing the interact key turns it
  **gold** and floats `Los interruptores se reinician.` (or the English line) only
  once a press breaks the sequence; the discs sit **under** the player and the
  trainers (the player walks over one without being hidden by it), and none stands
  on the room's entry tile.
- [ ] `[live]` A solved room pays its item once and stays solved on a revisit.
  Measurement: in that same room press the switches in the order
  `puzzleLayout(...)` returns (read it from the `puzzle.test.ts` pin or by trial:
  a wrong press floats the reset notice), until the solved notice appears — a
  visible ground item now stands on the reward tile, collecting it shows
  `Obtained <item>!` and puts one stack in the bag; walk out and back in: the room
  shows **no** switches and **no** item (the solve mark is per floor), and after
  taking the portal to the next floor a **new** puzzle room may hang with its own
  room id and its own order.

## 📣 Coordination

- **For the Architect:** this task claims **no** `src/scenes/RouteScene.ts`, so the
  plan's Batch-47 hot-file record (`RouteScene.ts` → 102) does not hold: the room
  layer carries the whole room through the shipped `RoomHost` (`fixture`,
  `interact`, `drawFixture`, `commitRun`, `rebuildRoom`, `showNotice`) and no
  generator pass is needed, because the reward is an ordinary ground item that the
  fixture places once the run's mark says solved. The batch's `RouteScene` claim is
  `[Task-108]`'s.
- **For `[Task-103]` (the same batch):** the three i18n keys are this task's; that
  task adds none, and this task adds no item and touches no `src/data/items.ts`.
  `src/data/items.ts`'s `nugget` / `bignugget` rows are **read only** here.
- **For `[Task-110]` (Batch 52):** `pickedItems` now also carries a
  `puzzle-<map>-<room>` mark and a `puzzle-loot-<map>-<room>` ground-item id; the
  bag grid reads neither, but a bag filter that lists "obtained this floor" must
  not treat the solve mark as an item id.
- **For the next batch:** a special room's content can be placed **entirely by its
  descriptor** when it needs no new tile value and no build pass — `RoomHost`
  already exposes the route, the entry, the counter, `commitRun` and
  `rebuildRoom`. Prefer that over a `RouteRequest` flag.
- **For QA:** the descriptor keeps its per-room progress in module state on
  purpose (no run field). A room change drops it, and that is the specified
  behaviour, not a defect: the room's **solve** is the only fact that survives, and
  it survives through the run's `pickedItems`.

## ⛔ Out of scope

- Any `RouteRequest`/`RouteMap` field, any new build pass in `src/engine/routes/sketch.ts`,
  any new tile value in `src/engine/map.ts` and any tileset/atlas cell: the reward
  is a ground item and the switches are drawn by the descriptor.
- A barrier, a sealed vault or a rock/bush/pond seal — the gated, static and
  secret-shop leaves own those.
- The boss room's own puzzle: `[Task-100]` shipped the boss room's rules (opening,
  seal, free heal) and this task adds nothing there.
- Any `RunState` field, any `SAVE_VERSION` step, and any change to `src/engine/save.ts`.
- The reward's balance beyond the two catalogue ids above, the loot tables
  (`src/data/loot.ts`), the shop's stock and any new item row.
- The minimap beyond its shipped marker lookup (`src/ui/mapView.ts` needs no edit:
  `MapRoomMarker` is `MapRoomSpecial`).
- Any new dependency, any `package.json`/`vite.config.ts`/`src/main.ts` change, and
  any regeneration of `src/data/dex/**`.

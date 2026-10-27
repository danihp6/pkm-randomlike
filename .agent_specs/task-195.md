# Spec: Task-195 — A special NPC stands against a wall, with its back to it

## 🎯 Scope

- **Task type:** pure engine rule + the scene that draws it.
- **Role:** Dev.
- **Objective:** A room's special NPC (medic, exorcist, merchant, weather man, magician, …) is
  placed today on **any** free walkable tile — it can stand in the middle of an open field —
  and the placement carries no facing at all, so the sprite always shows its default down
  frame. After this task the candidate list narrows to tiles with at least one **cardinally
  unwalkable** neighbour, and the placement gains the facing **away** from that wall (a wall
  to the north turns the NPC `'S'`, so its back is to the wall and its front to the open
  tile). A room whose free tiles are all open keeps today's pick with `'S'` rather than
  dropping the NPC. One seed still gives one tile and one facing, and no other stream moves.
- **Environment:** worktree `../wt-pkm-195`, branch `task-195`. Run
  `npm ci --prefer-offline --no-audit --no-fund` first. Never junction `node_modules` or the
  asset tree; `ASSETS_ROOT` is already set and lives outside this checkout.
- **Dependencies:** none — `src/engine/routes/npcs.ts`, `src/render/trainerAnim.ts` and
  `src/data/overworldSprites.ts` are merged on `main`.

### Exclusive paths (single writer)

- `src/engine/routes/npcs.ts`
- `src/engine/routes/npcs.test.ts`
- `src/scenes/RouteScene.ts` — **only** `type RoomNpc`, `rollRoomNpc`, `drawRoomNpc` and the
  import block. Another task in this batch holds other files, not this one, but do not
  "tidy" anything else inside it.
- `docs/routes-spec.md` **§2 only** (the special NPC's spot)
- `docs/maps-spec.md` **§7 only** (the same rule, one line)
- `src/engine/README.md` and `src/engine/routes/README.md` (only if a file is added/renamed)

### Inputs (read-only)

- `.agent_specs/task-195.md` (this file) and `AGENTS.md`.
- `docs/routes-spec.md` §2, `docs/maps-spec.md` §7.
- `src/engine/map.ts` (`isWalkable`), `src/engine/grid.ts` (`Tile`),
  `src/engine/routes/routeMap.ts` (`RouteMap`, `Facing`), `src/engine/rng.ts` (`Rng`,
  `hashSeed`).
- `src/render/trainerAnim.ts` (`trainerFacingPose`), `src/data/overworldSprites.ts`
  (`overworldSpriteFrame`, `OverworldFacing`).
- `src/scenes/RouteScene.ts` (the `RoomNpc` type, `rollRoomNpc`, `drawRoomNpc` — read them
  before editing).

## 🔒 Contract

```ts
// src/engine/routes/npcs.ts
import type { Facing, RouteMap } from './routeMap';
import type { Tile } from '../grid';

/** The tile the NPC stands on and the way it looks: back to the wall, front to the room. */
export type NpcSpot = Readonly<{ tile: Tile; facing: Facing }>;

/** The tile and facing the NPC gets, or null when the room has no free tile at all. */
export function npcSpot(
  route: RouteMap,
  roomIndex: number,
  seed: string,
  npcId: string,
): NpcSpot | null;
```

Rules:

1. The **excluded** tiles are exactly today's: the entry and its four cardinal neighbours,
   every exit, walls, trainers on the room and visible items. Do not add or drop an exclusion.
2. The **candidate** list is the free tiles that have at least one cardinally unwalkable
   neighbour (`!isWalkable(route.tiles, neighbour)`), in the same row-major order the current
   loop builds.
3. If that list is empty, the candidate list falls back to the **whole free list** (today's
   behaviour) and every fallback spot reads `'S'`.
4. The tile is drawn by **one** `Rng.int(0, candidates.length - 1)` on
   `Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:spot`))` — the shipped stream name. No
   second draw exists: the facing is **derived** from the chosen tile's walls in the fixed
   order **N, E, S, W** (wall to the north → face `'S'`; wall to the east → face `'W'`; …), so
   the same seed always gives the same tile and the same facing and no other stream moves
   (`D11`).
5. The facing always points at a **walkable** neighbour of the tile (the first free cardinal
   in the N, E, S, W order when the tile touches two walls).
6. Pure: no Phaser, no DOM, no clock, no `Math.random()`.

```ts
// src/scenes/RouteScene.ts
type RoomNpc = Readonly<{ row: NpcRow; tile: Tile; facing: Facing }>;
```

- `rollRoomNpc` stores the whole `NpcSpot` (`{ row, tile, facing }`).
- `drawRoomNpc` poses the sprite the way a resting trainer already is: `trainerFacingPose(facing)`
  → `{ facing, flipX }`, `overworldSpriteFrame(npc.row.spriteKey, pose.facing)` for the frame
  and `.setFlipX(pose.flipX)`. The sprite keeps its origin, scale, depth and `entitySprites`
  booking.
- Nothing else about the NPC (no sight, no spin, no chase, no roster) changes.

## 🧩 Data and configuration

No new data. `NPC_ROWS` (`src/data/npcs.ts`) is read, not edited.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-195` audited against the exclusive paths.
  - `[live]` against `npm run dev` on your own free port; this machine's Chromium is
    `/usr/bin/google-chrome` (`CHROME_PATH` if needed). Read the running scene through CDP
    `Runtime.evaluate` (`const { game } = await import('/src/main.ts')` works in Vite dev: the
    module is already loaded, so the import returns the same `game` instance).
- **Acceptance criteria:**
  - [ ] `[unit]` For a generated route and a room that holds an NPC, over at least 8 seeds and
    every room index that returns a spot, the returned tile has **at least one** cardinally
    unwalkable neighbour, and the facing's own tile is **walkable**.
  - [ ] `[unit]` A hand-built room whose free tiles are all open (no wall neighbour anywhere)
    still returns a spot, and its facing is `'S'` — never `null`, never a throw.
  - [ ] `[unit]` Fixed-seed regression: one seed and one room return the same `{ tile, facing }`
    twice, and the test pins the exact values.
  - [ ] `[unit]` The exclusions hold: the spot is never the entry, its four neighbours, an
    exit, a trainer's tile or a visible item's tile (keep the shipped test and extend it).
  - [ ] `[unit]` A room with no free tile at all returns `null` (the shipped rule).
  - [ ] `[unit]` `src/engine/` still imports no Phaser and no DOM; the module reads no clock.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` In `npm run dev` (1280×800), start a run and walk into a room whose NPC
    rolled (the same seed the unit test uses is not required; any NPC room works). With
    `Runtime.evaluate`:
    (1) read `game.scene.getScene('Route').npc` → `{ row, tile, facing }`;
    (2) assert the tile has a cardinally unwalkable neighbour in `game.scene.getScene('Route').route.tiles`
    and that the neighbour in the facing direction is walkable;
    (3) read the NPC's sprite object (`game.scene.getScene('Route').npcSprite`, or the sprite
    whose frame belongs to `row.spriteKey` inside `entitySprites`) and assert its frame index
    equals `overworldSpriteFrame(row.spriteKey, trainerFacingPose(facing).facing)` and its
    `flipX` equals `trainerFacingPose(facing).flipX`.
    Report the tile, the facing, the wall direction and the frame index.

## 📣 Coordination

- For the Architect: `npcSpot` changed its return type; its only caller is `RouteScene`. The
  `:spot` stream keeps its name and its single draw.
- For the next batch: special trainers keep `Facing` placements of their own; do not merge
  the two placement rules.

## ⛔ Out of scope

- Special **trainers** (`specialTrainerFor`) and their placement.
- Any NPC's facing after it is talked to, any idle animation, and the sprite atlas.
- The NPC's room eligibility, its roll, its table and its rewards.
- Widening the tile placement to the room's doors or the entry room.

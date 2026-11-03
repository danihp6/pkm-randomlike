# Spec: Task-269 — The frame mesh is resolved once, not per cell

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure TypeScript, no Phaser).
- **Role:** Dev.
- **Objective:** `src/engine/frameMap.ts` gains one flat, whole-map resolver,
  `buildFrameMesh`, so a caller can turn a `TileMap` plus a `TilesetConfig` into a
  single `Int32Array` of atlas frame indices — one entry per cell, row-major, `-1`
  where a cell has no frame — without building the rich `FrameCellInfo` objects,
  the mass index and the tree list that `buildFrameMap` builds for the dev "Map"
  tool. After this task the scene renderer of Batch 120 (`WorldScene` →
  `src/render/tilemapLayer.ts`) has the one input it needs: a contiguous array it
  can hand to a `TilemapLayer`, resolved once per map instead of once per cell per
  layer. `buildFrameMap` keeps its exact current output.
- **Environment:** worktree `../wt-pkm-269`, branch `task-269`.
- **Dependencies:** none. Everything this task reads is already on `main`
  (`src/engine/frameMap.ts`, `src/engine/tileFrames.ts`, `src/engine/map.ts`,
  `src/engine/tileset.ts`, `src/data/tilesets/frlg.ts`).

### Exclusive paths (single writer)

- `src/engine/frameMap.ts`
- `src/engine/frameMap.test.ts`

Nothing else. In particular: **do not** touch `src/engine/index.ts` (it does not
re-export `./frameMap` and must not start doing so), `src/engine/README.md` (no
file is added, renamed or deleted), `src/scenes/**`, `src/render/**`,
`src/data/**`, `package.json`, `docs/**`.

### Inputs (read-only)

- `docs/tileset-spec.md` §2 (the atlas contract) and §3b (the wall pattern, and the
  `border` flag).
- `src/engine/frameMap.ts` — `FrameMap`, `FrameCellInfo`, `buildFrameMap`,
  `padMap` usage.
- `src/engine/tileFrames.ts` — `resolveTileFrame`, `patternCell`, `TileFrame`.
- `src/engine/map.ts` — `FLOOR`, `WALL`, `WATER`, `TALL_GRASS`, `LEDGE`, `TileMap`.
- `src/engine/tileset.ts` — `TilesetConfig`, `WallPattern`.
- `src/data/tilesets/frlg.ts` — `FRLG_FOREST_TILESET`, `FRLG_TILESET`.
- `src/engine/routes/sketch.ts` — `sketchRoute`, `RouteRequest` (for the
  fixed-seed regression case).
- `src/engine/routes/walls.test.ts` — the existing precedent for an engine test
  that imports `FRLG_TILESET` from `src/data/`.

## 🔒 Contract

### TypeScript

Add to `src/engine/frameMap.ts`, directly below `buildFrameMap`:

```ts
/**
 * The whole map resolved into frames: one `Int32Array` of atlas frame indices,
 * row-major (`y * width + x`), `-1` where a cell resolves to no frame. The flat
 * twin of `buildFrameMap`, built for the renderer: no cell objects, no mass index,
 * no tree list.
 */
export type FrameMesh = Readonly<{
  width: number;
  height: number;
  frames: Int32Array;
}>;

export function buildFrameMesh(map: TileMap, tileset: TilesetConfig, pad = 0): FrameMesh;
```

Rules, all of them binding:

1. **Same resolution as `buildFrameMap`.** For every cell `(x, y)`:
   `buildFrameMesh(map, tileset, pad).frames[y * width + x]` is **exactly**
   `buildFrameMap(map, tileset, pad).cells[y * width + x].frame ?? -1`, in the same
   order (`y` outer, `x` inner).
2. **Same `pad` and `border` semantics.** With `pad > 0` the frames are resolved
   against `padMap(map, pad, FLOOR)` at `(x + pad, y + pad)`, exactly as
   `buildFrameMap` does, and `border = true` is passed to `resolveTileFrame` in
   both cases. `width`/`height` on the returned mesh are the **unpadded** map's
   (`map[0].length` and `map.length`), so `frames.length === width * height`.
3. **Empty map.** A `TileMap` with zero rows returns
   `{ width: 0, height: 0, frames: new Int32Array(0) }`.
4. **`-1` means "no frame".** Any map value the tileset cannot resolve (no
   `frames` entry, no `commonFrames`, no matching `autotile` rule, no
   `wallPattern`, no `variants`) writes `-1`, never `0`.
5. **Purity.** No Phaser import, no DOM, no `localStorage`, no clock, and **no
   RNG** — this function reads no stream (`D11` is untouched by it).
6. **Allocation.** The only array it allocates is the returned `Int32Array` (plus
   `padMap`'s one copy when `pad > 0`, which `buildFrameMap` also pays). It must
   build **no** `FrameCellInfo[]`, no `FrameMap`, no mass array and no tree list,
   and it must not retain `resolveTileFrame`'s per-cell `TileFrame` object.
7. `buildFrameMap` and every other export of the file keep their current
   signature and output byte for byte.

### Data

- No data key, no JSON, no balancing value. The function reads no table.

## 🧩 Data and configuration

None. This task adds no file, no key and no default.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the cases this task
    adds to `src/engine/frameMap.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-269` — must list `src/engine/frameMap.ts` and
    `src/engine/frameMap.test.ts` and nothing else.
  - **No browser pass is owed:** every criterion below is `[unit]`, and no scene,
    renderer or asset is touched.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (typecheck + Vite build).
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `git diff --name-only main...task-269` names only
        `src/engine/frameMap.ts` and `src/engine/frameMap.test.ts`.
  - [ ] `[unit]` The new cases exist in `src/engine/frameMap.test.ts` and pass, and
        they are these six, by these names/measurements:
        1. *every cell of a 60×120 forest map matches `buildFrameMap`*: build the
           map in the test as a 60-column grid of 120 rows, all `FLOOR`, with a
           one-cell ring of `WALL`, a 3-wide × 4-tall `WALL` block at `(10, 20)`, a
           2×2 `WATER` pond at `(30, 40)`, a 3-cell `LEDGE` run at row 60 starting
           at column 20 and a 4-wide × 3-tall `TALL_GRASS` patch at `(40, 80)`;
           assert `frames.length === 7200` and that all 7 200 cells equal
           `buildFrameMap(map, FRLG_FOREST_TILESET).cells[i].frame ?? -1`.
        2. *the same equality with `pad = 6`*: `buildFrameMesh(map, FRLG_FOREST_TILESET, 6)`
           equals `buildFrameMap(map, FRLG_FOREST_TILESET, 6)` cell for cell, and
           the mesh's `width`/`height` are still `60`/`120`.
        3. *an unknown value reads `-1`*: a 3×3 map of `FLOOR` with `99` at
           `(1, 1)` and `FRLG_FOREST_TILESET` — `frames[4]` is `-1`, every other
           cell is not `-1`.
        4. *shape and length*: for the 60×120 map, `width === 60`, `height === 120`,
           `frames.length === width * height`, and `frames instanceof Int32Array`.
        5. *a second call is byte-identical*: two calls on the same map produce
           arrays with the same `Array.from(...)` contents (and the same
           `byteLength`).
        6. *fixed-seed regression*: `sketchRoute({ seed: 'mesh-269', routeIndex: 1,
           biomeId: 'forest', shape: 'straight', width: 32, height: 24 })` — that
           call is the only RNG read in the whole file, and it lives in the test,
           never in the engine; `buildFrameMesh(route.tiles, FRLG_FOREST_TILESET)`
           runs once and the test pins a **literal** checksum of the frames (a
           FNV-1a-style 32-bit fold over the `Int32Array`, written as a hex literal
           in the test — not recomputed at assert time), so a later change to the
           resolver or to the tileset that moves one frame fails the suite.
  - [ ] `[unit]` `buildFrameMap`'s own existing tests still pass unmodified (the
         equality cases above are the proof its output did not move).

## 📣 Coordination

- **For `[Task-280]` (Batch 120, `WorldScene` + `src/render/tilemapLayer.ts`):**
  `buildFrameMesh(map, config)` is the layer's input. `frames` is row-major over
  `width × height` and is **never padded**; `-1` is the "no tile" sentinel, so the
  layer must skip that cell (not draw frame 0). The tileset's own `atlas.tileSize`
  is the cell size (`D18`); the world tile is `TILE_SIZE = 24`, so the layer scales
  by `24 / atlas.tileSize`.
- **For the next batch:** `[Task-272]`'s stitched 60×120/160/200 route map can be
  fed to `buildFrameMesh` as-is; a route taller than 120 needs no change here.
- **For `[Task-271]`:** nothing — this task adds no map value and no atlas.
- **For `[Task-270]`:** nothing — no file was added, so no README or doc line moves.

## ⛔ Out of scope

- The renderer, `src/render/tilemapLayer.ts`, `WorldScene`, the worker and the
  Phaser `TilemapLayer` — Batch 120.
- Changing or deprecating `buildFrameMap`, `FrameCellInfo`, `FrameTreeInfo`,
  `serializeFrameMap` or the exported JSON shape (the dev Map tool reads them).
- Exposing the mesh through `src/engine/index.ts` or `src/engine/region/index.ts`.
- Adding a `groundFrames`/second-layer array, a water/height variant, a culling
  index, or a `FrameMesh` serializer: none is asked for.
- Any `docs/` or README edit.

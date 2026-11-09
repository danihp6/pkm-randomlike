# Spec: Task-311 — A city's buildings are whole houses

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** art pipeline (packer + data) + engine plan + Phaser scene.
- **Role:** Dev.
- **Objective:** Every settlement building draws its **own whole-house sprite** over
  the footprint the plan already emits, instead of repeating one `WALL` frame and one
  `ROOF` frame. The sprites are composed from the buildings compendium
  `sprite-sources/frlg/tileset-1.png` into a new `city-buildings` atlas, the plan
  picks a stable house per `BuildingKind` and places its door on the walkable `DOOR`
  tile, and the city screen draws the sprite as a decal over the tile layer. The map
  values stay the collision rule.
- **Environment:** worktree `../wt-pkm-311`, branch `task-311`.
- **Dependencies:** the region tilesets (`Task-280`/Batch 117-118, shipped) and the
  city screen (`Task-300`, shipped). The asset store is at
  `C:\Users\Dani\projects\pkm-randomlike\sprite-sources`.

### Exclusive paths (single writer)

Nothing outside this list.

- `scripts/frlg/build-city-buildings.mjs` (new)
- `scripts/assets/pack.mjs`
- `scripts/assets/build-placeholders.mjs`
- `src/assets/frlg/city-buildings.png` (generated, gitignored)
- `src/data/frlg/city-buildings.json` (generated, committed)
- `src/assets/placeholders/frlg/city-buildings.png` (committed blank)
- `src/data/tilesets/cityBuildings.ts` (new)
- `src/data/tilesets/cityBuildings.test.ts` (new)
- `src/engine/region/city/plan.ts`
- `src/engine/region/city/plan.test.ts`
- `src/scenes/CityScene.ts`
- `src/scenes/BootScene.ts`
- `docs/tileset-spec.md` (§2b and §6)
- `docs/art-direction.md` (the buildings source paragraph)
- `docs/region-spec.md` (§7.1)

### Inputs (read-only)

- `AGENTS.md`.
- `sprite-sources/frlg/tileset-1.png` (1096×1090, the buildings compendium; view it
  to choose the houses). The worktree does not carry the store; use the absolute path
  `C:\Users\Dani\projects\pkm-randomlike\sprite-sources\frlg\tileset-1.png`.
- `scripts/frlg/build-region-tilesets.mjs` (the city/interior packer and its
  transparent-key / composite rules).
- `scripts/frlg/build-sign.mjs` (the flat-crop refusal and the alpha rules).
- `scripts/assets/pack.mjs`, `scripts/assets/build-placeholders.mjs`,
  `scripts/legacy-art/png-codec.mjs`.
- `src/data/tilesets/city.ts`, `src/data/tilesets/index.ts`, `src/data/frlg/city.json`.
- `src/engine/region/city/plan.ts` and `plan.test.ts`.
- `src/scenes/CityScene.ts`, `src/scenes/WorldScene.ts`, `src/scenes/BootScene.ts`.
- `src/engine/tileset.ts`, `src/engine/map.ts`, `src/engine/frameMap.ts`.
- `docs/tileset-spec.md` §2b/§6, `docs/art-direction.md`, `docs/region-spec.md` §7.1.

## 🔒 Contract

### TypeScript

`src/data/tilesets/cityBuildings.ts` (new):

```ts
import type { BuildingKind } from '../../../engine/region/city/plan';

export const CITY_BUILDINGS_TEXTURE_KEY = 'frlg:city-buildings';
/** One frame in the map's 16 px units: 5 tiles wide by 6 tall. */
export const CITY_BUILDING_W = 80;
export const CITY_BUILDING_H = 96;
export const CITY_BUILDING_COLS = 4;
export const CITY_BUILDING_ROWS = 1;
export const CITY_BUILDINGS_ATLAS_URL: string; // packed or placeholder

export type CityBuildingSprite = Readonly<{
  kind: BuildingKind;
  /** The door's tile column inside the frame, 0..4. */
  door: number;
}>;

export const CITY_BUILDING_SPRITES: readonly CityBuildingSprite[];
export function buildingFrameFor(kind: BuildingKind, index: number): number;
```

`buildingFrameFor` is pure and stable: it selects among the frames whose `kind`
matches (the house kind has two variants) and wraps `index` modulo that list; it
never returns a frame whose `door` is outside `0..4`. A kind with no frame falls back
to the first house frame.

`src/engine/region/city/plan.ts`:

```ts
export type CityBuilding = Readonly<{
  // ...the shipped fields...
  /** The `city-buildings` frame the scene draws over `rect`. */
  sprite: number;
}>;
```

The plan re-orients the front to the **block's bottom edge** (the compendium's houses
face south; `drawBuilding` today puts the door on the top row):

- `BUILDING_HEIGHT` becomes `6` (the block is 7 tall; the house leaves one `WALL`
  row above it).
- `const top = block.y + BLOCK - BUILDING_HEIGHT;` the footprint starts at `top`;
  the front row is `top + BUILDING_HEIGHT - 1`; the roof rows are above it.
- The sprite is chosen from the layout RNG (`layoutRng.int(0, frames.length - 1)`)
  **before** the door column; the door column is the chosen sprite's `door`. The
  `door` tile is `{ x: block.x + doorColumn, y: top + BUILDING_HEIGHT - 1 }` and the
  `rect` is `{ x: block.x, y: top, width: BUILDING_WIDTH, height: BUILDING_HEIGHT }`.
- The map values are unchanged: the front row is `DOOR` at the door column and `WALL`
  elsewhere, every other row is `ROOF`.

`src/scenes/CityScene.ts`:

- Draw one image per `plan.buildings` after the world is applied and before the
  player: texture `CITY_BUILDINGS_TEXTURE_KEY`, frame `building.sprite`, origin
  `(0, 0)`, position `(rect.x * TILE_SIZE, rect.y * TILE_SIZE)`, display size
  `(rect.width * TILE_SIZE, rect.height * TILE_SIZE)`, depth so a player south of the
  building draws above it and a player north of it draws below the roof
  (`actorDepth((rect.y + rect.height) * TILE_SIZE)` is the intended shape).
- Keep the sprites in an array and destroy them before a node swap (`onNodeArrived`)
  and on shutdown, so a travel does not leave the old city's houses over the new map.
- The map's `WALL`/`ROOF`/`DOOR` values stay the collision/fallback; the sprite is a
  decal, never a map value.

`src/scenes/BootScene.ts` loads the atlas as a spritesheet at `CITY_BUILDING_W` ×
`CITY_BUILDING_H` under `CITY_BUILDINGS_TEXTURE_KEY`, from
`CITY_BUILDINGS_ATLAS_URL`.

### Data

`src/data/frlg/city-buildings.json` (generated):

```json
{
  "width": 80,
  "height": 96,
  "cols": 4,
  "rows": 1,
  "frames": [
    { "kind": "centre", "door": 2 },
    { "kind": "gym", "door": 2 },
    { "kind": "lab", "door": 2 },
    { "kind": "house", "door": 2 }
  ]
}
```

The packer writes one frame per chosen house, in the order of its `HOUSES` table.
The frame order is the manifest's order and `buildingFrameFor` reads it.

## 🧩 Data and configuration

- The packer `scripts/frlg/build-city-buildings.mjs`:
  - Source: `tileset-1.png` (1096×1090, alpha-keyed; no magenta key needed).
  - `HOUSES`: four entries, each `{ kind, rect: [x, y, w, h], door }`. Pick four
    whole houses from the compendium whose footprint is 5-6 tiles tall; the door is
    the door's tile column inside the 5-wide frame. The top-left blue-roof house and
    the red/green-roofed houses are suitable; the exact rects are the packer's table,
    not a guess in the scene.
  - Crop each rect with its own alpha, scale it nearest-neighbour to 80×96 and stamp
    it into the 320×96 atlas (4 columns × 1 row). The packer must refuse a flat crop
    (fewer than 3 distinct opaque colours, or more than 40 % near-black pixels) the
    way `build-sign.mjs` does, naming the house and its rect.
  - Write `src/assets/frlg/city-buildings.png` and
    `src/data/frlg/city-buildings.json`; print the atlas size and the frame count.
  - Deterministic: the same input writes byte-identical outputs.
- `scripts/assets/pack.mjs` adds a step after `frlg region tilesets`:
  `name: 'frlg city buildings'`, `script: 'scripts/frlg/build-city-buildings.mjs'`,
  `needs: requires(['frlg/tileset-1.png'])`,
  `args: (p) => [p('frlg/tileset-1.png')]`.
- `scripts/assets/build-placeholders.mjs` adds `'frlg/city-buildings.png'` to
  `ATLASES`; run `node scripts/assets/build-placeholders.mjs frlg/city-buildings.png`
  after the packer so the committed blank is 320×96.
- `cityBuildings.ts` resolves the atlas through `packedAtlasUrl` with the committed
  placeholder, the `typeIcons.ts` shape.
- The plain `wall`/`roof`/`door` frames of `city.png` stay; a hand-authored fixture
  and a clone without the pack still draw the flat tiles.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - Run the packer before the tests:
    `node scripts/frlg/build-city-buildings.mjs "C:\Users\Dani\projects\pkm-randomlike\sprite-sources\frlg\tileset-1.png"`
  - Regenerate the blank:
    `node scripts/assets/build-placeholders.mjs frlg/city-buildings.png`
  - `npm test`
  - `npm run build`
  - `git diff --name-only main...task-311` against the exclusive paths.
  - The live pass needs the packed region and city-building atlases; run
    `node scripts/frlg/build-region-tilesets.mjs` with the store's `tileset.png` and
    `tileset-2.png` first.
- **Acceptance criteria:**
  - [ ] `[unit]` The manifest is 80×96, 4 columns × 1 row, one frame per
    `BuildingKind`, and `buildingFrameFor` answers a frame for every kind, wraps
    `index`, and never answers a door outside `0..4` (`cityBuildings.test.ts`).
  - [ ] `[unit]` The decoded `city-buildings.png` is 320×96 and every frame has
    non-empty art (the `hasArt`/`decodePng` pattern of `typeIcons.test.ts`).
  - [ ] `[unit]` The plan's `CityBuilding.sprite` is a frame of the manifest, the
    `door` tile is the sprite's door column on the front row, the `rect` is 5×6 and
    its bottom row is the block's bottom row; the fixed-seed settlement digests in
    `plan.test.ts` are re-pinned.
  - [ ] `[unit]` `CityScene` names `CITY_BUILDINGS_TEXTURE_KEY` and draws the sprite
    over `building.rect` (a source pin); `BootScene` loads the atlas at 80×96 (a
    source pin).
  - [ ] `[unit]` The suite and the build are green.
  - [ ] `[live]` At 1280×800 in the starting town and `city:1`: the buildings are
    distinct houses (different roofs/walls, not one repeated block), each house's
    door sits on the walkable `DOOR` and the player walks into it; walking in front
    of a house draws the player above it and walking behind its roof draws the player
    below it. Read the scene's `debugCityState()` and the rendered map.

## 📣 Coordination

- For the Architect: `CityBuilding` gains `sprite`; `BUILDING_HEIGHT` 4 → 6 and the
  door row moves from the block's top to its bottom; the fixed-seed digests move.
- For the next batch: a new building kind adds a `HOUSES` row and a manifest frame;
  no scene code changes.
- The sprite is a decal; any future building collision change still edits the map
  values, not the sprite.

## ⛔ Out of scope

- No change to the city's street grid, block count, exit bands or grass corner.
- No change to the interior plans, the interior atlas or the NPCs.
- No new building kinds and no new city content.
- No change to the route's tilesets or the `city.png` wall/roof/door crops.
- No change to the player, the walker or the camera.

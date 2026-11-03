# Spec: Task-271 — The city and interior tiles are imported

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** data + imported art (a packer, two atlases, two tileset configs, the
  8 map values they need, and the docs that carry their table).
- **Role:** Dev.
- **Objective:** a generated city and a generated interior can be **drawn**. The
  FRLG building and terrain rips that already live in the asset store are packed
  into two new atlases in the established 4×13 / 16px contract —
  `src/assets/frlg/city.png` and `src/assets/frlg/interior.png` — each with a
  committed frame manifest (`src/data/frlg/city.json`, `interior.json`), a committed
  blank of the same pixel size under `src/assets/placeholders/frlg/`, a
  `TilesetConfig` (`src/data/tilesets/city.ts`, `interior.ts`) and a registry row, so
  `TILESET_IDS` is `['forest', 'city', 'interior']` and `BootScene` loads all three
  with no further edit. The **tile kinds** a city and an interior are laid out
  against are frozen as map values in `src/engine/map.ts` — `grass`, `path`,
  `plaza`, `wall`, `roof`, `door`, `water`, `sign` for a city, `floor`, `wall`,
  `door`, `counter`, `heal`, `pc` for an interior — with their walkability, so
  Batch 118's generators emit values the engine already understands and the scene
  draws them without a second vocabulary.
- **Environment:** worktree `../wt-pkm-271`, branch `task-271`.
- **Dependencies:** none in code. Every file this task edits is on `main`; the two
  source sheets come from the asset store, never from the worktree.

### Exclusive paths (single writer)

- `scripts/frlg/build-region-tilesets.mjs` (new)
- `scripts/assets/pack.mjs`
- `scripts/assets/build-placeholders.mjs`
- `scripts/assets/placeholderAccent.mjs` (one pinned hue for `frlg/city.png`; see the
  accent note under **Build** — the allow-list's own distinctness test forces it)
- `scripts/assets/placeholderAccent.test.mjs` (the allow-list length it pins)
- `src/data/frlg/city.json` (new, generated, committed)
- `src/data/frlg/interior.json` (new, generated, committed)
- `src/assets/placeholders/frlg/city.png` (new, generated, committed)
- `src/assets/placeholders/frlg/interior.png` (new, generated, committed)
- `src/engine/map.ts`
- `src/engine/map.test.ts`
- `src/data/tilesets/city.ts` (new)
- `src/data/tilesets/city.test.ts` (new)
- `src/data/tilesets/interior.ts` (new)
- `src/data/tilesets/interior.test.ts` (new)
- `src/data/tilesets/ids.ts`
- `src/data/tilesets/ids.test.ts`
- `src/data/tilesets/index.ts`
- `src/data/tilesets/palettes.ts`
- `src/data/README.md`
- `src/assets/README.md`
- `docs/tileset-spec.md`

Nothing else. **Not** `src/data/biomes.ts` or `src/data/biomes.test.ts` (city and
interior are not biomes; `BIOME_ORDER` stays `['forest']` and
`BIOMES`'s keys stay `['forest']`), **not** `src/data/tilesets/frlg.ts` (the
forest's config is untouched), **not** `src/scenes/**`, `src/main.ts`,
`src/engine/tileset.ts`, `package.json`, `vite.config.ts`, `.gitignore` (the
`/src/assets/frlg/` line already ignores both new atlases), `TODO.md` or
`CHANGELOG.md`.

### Inputs (read-only)

- `docs/tileset-spec.md` — §1 (map values), §2 (the atlas contract and its 4×13
  cell grid), §4 (the registry), §6 (pending art slots, the tone this task's new
  section continues).
- `docs/art-direction.md` — the FRLG source inventory (§"FireRed/LeafGreen sources"),
  the asset-tree rule and the licence line.
- `AGENTS.md` — "Asset trees": the source directory is passed by argv or the
  environment and is never junctioned or symlinked into a worktree.
- `src/engine/tileset.ts` — `TILE_SIZE`, `TILESET_COLS`, `TILESET_ROWS`,
  `ATLAS_WIDTH`, `ATLAS_HEIGHT`, `TilesetConfig`, `WALL_SHAPES`, `WATER_SHAPES`,
  `FRAME_*`.
- `src/engine/map.ts` — `FLOOR`…`ROCK`, `SOLID`, `SKETCH_LEGEND`, `mapFromSketch`,
  `isWalkable`, `triggersWildEncounter`.
- `src/engine/tileFrames.ts` — `resolveTileFrame`, `resolveGroundFrame`.
- `scripts/frlg/build-tilesets.mjs` — the packer this one is modelled on (the 17px
  pitch, `ORIGIN`, `stampTile`, `compositeOver`, `keyBackground`, `stampBlock`,
  `fieldFrames`).
- `scripts/assets/pack.mjs`, `scripts/assets/build-placeholders.mjs`,
  `scripts/assets/root.mjs` (`ASSETS_ROOT`, `assetPath`),
  `scripts/legacy-art/png-codec.mjs` (`decodePng`, `encodePng`).
- `src/data/tilesets/frlg.ts` (`FRLG_TILE_SIZE`, `FRLG_ATLAS_WIDTH`,
  `FRLG_ATLAS_HEIGHT`, the shape of a field config), `src/data/tilesets/ids.ts`,
  `src/data/tilesets/index.ts`, `src/data/tilesets/palettes.ts`,
  `src/data/tilesets/placeholder.ts`, `src/assets/optional.ts`
  (`packedAtlasUrl`), `src/assets/art.ts` (`hasArt`).
- `src/data/tilesets/frlg.test.ts` — the precedent for a test that decodes the
  packed PNG and skips when the art is absent.
- `src/scenes/BootScene.ts` (it loads every `TILESET_IDS` entry as a spritesheet
  with `tilesetTextureKey(id)` and `config.atlas.tileSize`) and
  `src/data/tilesets/index.ts`'s `tilesetTextureKey`.

## 🔒 Contract

### TypeScript — `src/engine/map.ts`

Add eight values after `ROCK = 11`, with exactly these names and numbers:

```ts
export const PATH = 12;    // a city street, walkable
export const PLAZA = 13;   // a paved square, walkable
export const ROOF = 14;    // a building's roof, solid
export const DOOR = 15;    // a building's entrance, walkable
export const SIGN = 16;    // a readable post, solid
export const COUNTER = 17; // a shop / Centre counter, solid
export const HEAL = 18;    // the Centre's healing station, solid
export const PC = 19;      // the storage PC, solid
```

- `SOLID` becomes `new Set([WALL, WATER, LEDGE, BUSH, ROCK, ROOF, SIGN, COUNTER,
  HEAL, PC])`. `PATH`, `PLAZA` and `DOOR` are walkable and are **not** in it.
- `SKETCH_LEGEND` gains exactly these characters, so hand-authored fixtures (and the
  generators' tests) can build a city or an interior from a string:
  `P: PATH`, `Z: PLAZA`, `O: ROOF`, `D: DOOR`, `S: SIGN`, `U: COUNTER`,
  `H: HEAL`, `X: PC`. No existing character changes meaning.
- Every existing value keeps its number and its walkability byte for byte
  (`FLOOR` 0 … `ROCK` 11, and `isWalkable`'s answer for each is what
  `src/engine/map.test.ts` already pins).
- `triggersWildEncounter` is unchanged: a city's grass corner is `TALL_GRASS` (8).

### TypeScript — `src/data/tilesets/city.ts` (new)

```ts
export type CityKind = 'grass' | 'path' | 'plaza' | 'wall' | 'roof' | 'door' | 'water' | 'sign';

/** The map value each city kind is stamped as. Frozen for the generators. */
export const CITY_KIND_VALUES: Readonly<Record<CityKind, number>>;

export const FRLG_CITY_TILESET: TilesetConfig;
```

- `CITY_KIND_VALUES` is exactly
  `{ grass: TALL_GRASS, path: PATH, plaza: PLAZA, wall: WALL, roof: ROOF, door: DOOR,
  water: WATER, sign: SIGN }` (8, 12, 13, 1, 14, 15, 6, 16).
- `FRLG_CITY_TILESET.atlas` is `{ tileSize: FRLG_TILE_SIZE, cols: TILESET_COLS,
  rows: TILESET_ROWS, width: FRLG_ATLAS_WIDTH, height: FRLG_ATLAS_HEIGHT }` (16px
  cells, 4×13, 64×208 — `D18`).
- `frames` is `{ [FLOOR]: 0 }` plus one entry per `CITY_KIND_VALUES` value, each read
  from the committed manifest `src/data/frlg/city.json`'s `cells` map (import the
  JSON; `resolveJsonModule` is on and `src/data/trainerSprites.ts` is the pattern).
  Frame `0` is the atlas's plain pavement — the ground `resolveGroundFrame` lays under
  every cell.
- The config declares **no** `autotile`, no `wallPattern`, no `variants`, no
  `wallAdjacentVariants`, no `commonFrames`, no `grassRustle` and no
  `hiddenItemFrame`: one frame per kind is the whole contract of this task, and
  shape-aware building edges are Batch 118's business.

### TypeScript — `src/data/tilesets/interior.ts` (new)

```ts
export type InteriorKind = 'floor' | 'wall' | 'door' | 'counter' | 'heal' | 'pc';

export const INTERIOR_KIND_VALUES: Readonly<Record<InteriorKind, number>>;

export const FRLG_INTERIOR_TILESET: TilesetConfig;
```

- `INTERIOR_KIND_VALUES` is exactly
  `{ floor: FLOOR, wall: WALL, door: DOOR, counter: COUNTER, heal: HEAL, pc: PC }`
  (0, 1, 15, 17, 18, 19).
- `frames` is `{ [FLOOR]: 0 }` plus one entry per kind read from
  `src/data/frlg/interior.json`'s `cells` (`floor` **is** 0 — the interior's ground
  and its floor are the same tile).
- Same "no autotile, no pattern, no variants" rule as the city.

### Data — the two manifests (`src/data/frlg/city.json`, `interior.json`)

Generated by the packer, **committed**, and the only source of the frame numbers:

```json
{
  "kind": "pkmr-tileset",
  "version": 1,
  "id": "city",
  "atlas": { "tileSize": 16, "cols": 4, "rows": 13, "width": 64, "height": 208 },
  "cells": { "grass": 1, "path": 2, "plaza": 3, "wall": 4, "roof": 5, "door": 6, "water": 7, "sign": 8 }
}
```

- `id` is `"city"` / `"interior"`; `cells`' keys are exactly that tileset's kinds and
  nothing else; every value is a frame index in `0..51`; **no two kinds share a
  frame**; `cells` never contains frame `0` except the interior's `floor`.
- The numbers above are the *intended* ones; the packer writes what it stamps, and
  the configs read it, so a different crop assignment is legal as long as the rules
  hold.

### Build — `scripts/frlg/build-region-tilesets.mjs` (new)

```
node scripts/frlg/build-region-tilesets.mjs [buildings.png] [terrain.png]
```

- argv `[2]` is the **buildings** sheet, default `assetPath('frlg/tileset.png')`
  (300×450, magenta-keyed, Hoeloo); argv `[3]` is the **terrain** sheet, default
  `assetPath('frlg/tileset-2.png')` (477×800, 16px tiles on a 17px pitch with a 1px
  origin, fabnt). `assetPath` resolves through `ASSETS_ROOT`/`sprite-sources/` — the
  script never reads a path inside this checkout, and nothing under the store is
  ever linked into the worktree.
- Outputs, and only these: `src/assets/frlg/city.png`,
  `src/assets/frlg/interior.png` (both 64×208 RGBA), `src/data/frlg/city.json`,
  `src/data/frlg/interior.json`. One `console.log` line per output, naming the file,
  its size and its byte count, like `build-tilesets.mjs`.
- Two cell tables live in the script (`CITY_CELLS`, `INTERIOR_CELLS`), one row per
  kind: `{ kind, source: 'buildings' | 'terrain', at: [x, y] }` where `at` is the
  **source cell** — `(1 + col*17, 1 + row*17)` on the terrain sheet, and an explicit
  pixel rect on the buildings sheet (that sheet is not on a uniform grid). Every kind's
  16×16 window is copied out, magenta-keyed (a pixel with `r >= 240 && g <= 15 &&
  b >= 240` becomes transparent), composited over the city/interior ground colour and
  stamped at its frame; **frame 0 of every atlas is the plain ground**.
- Every cell of every output atlas (frames 0..51) is **fully opaque**: the sheet is a
  filled field, not a decal, so a patch of map never shows a hole. Any transparent
  pixel left after the key is filled from the ground colour.
- The build is **deterministic**: the same two inputs produce byte-identical PNGs and
  byte-identical JSON.
- Known-good source cells you may build on (the existing packer stamps the same ones,
  see `build-tilesets.mjs`): terrain `(7,0)` is the light-ground tall-grass tuft,
  `(6,1)` the light outdoor floor, `(6,0)` a plain floor variant, `(10,0)` the
  top-left of the rocky-banked pond block. Everything else — the buildings' wall,
  roof, door and sign, and the interior's counter, heal and PC — is yours to pick off
  the buildings sheet; pick crops that satisfy the **colour separation** the live
  criterion below measures before you commit them.
- **Provenance limit, written down in `docs/tileset-spec.md`.** The asset store has
  no indoor tileset (`docs/art-direction.md`'s FRLG inventory: terrain, buildings and
  characters only, and pret/pokefirered is not in the store). The interior atlas is
  therefore composed from the two sheets that do exist — the terrain sheet's wooden
  platform block reads as an interior floor, the buildings sheet supplies the plaster
  wall, a counter, a heal station and a PC from its props — and the doc section must
  say so plainly: **the interiors are provisional art**, and when a real indoor rip
  arrives it replaces `INTERIOR_CELLS` in this one script and nothing else.

### Build — the packer's registration and the blanks

- `scripts/assets/pack.mjs`: add one step, right after `frlg tilesets`:
  `{ name: 'frlg region tilesets', script: 'scripts/frlg/build-region-tilesets.mjs',
  needs: requires(['frlg/tileset.png', 'frlg/tileset-2.png']),
  args: (p) => [p('frlg/tileset.png'), p('frlg/tileset-2.png')] }`.
- `scripts/assets/build-placeholders.mjs`: add `'frlg/city.png'` and
  `'frlg/interior.png'` to `ATLASES` (next to the other `frlg/*.png` rows) and change
  nothing else — `sourceSize` already prefers the packed atlas and falls back to the
  committed blank, so a clean clone stays idempotent once the two blanks are
  committed. Generate them with
  `node scripts/assets/build-placeholders.mjs frlg/city.png frlg/interior.png` and
  commit both; each is a 64×208 blank in its own accent (`placeholderAccent.mjs`).
- **The accent exception, and why it is in scope.** `placeholderAccent.test.mjs`
  already proves that every path in `ATLASES` gets its **own** fill
  (`accentFor(ATLASES[i]).fill !== accentFor(ATLASES[j]).fill`, all pairs) and it
  pins `ATLASES`' length. Adding `frlg/city.png` and `frlg/interior.png` therefore
  enters the allow-list: `frlg/city.png` hashes into the same hue as
  `beach-cave.png`, so `placeholderAccent.mjs` gains **one** pinned entry
  (`HUE_OVERRIDES` with `frlg/city.png` → a free hue) and
  `placeholderAccent.test.mjs` moves its length literal from 20 to 22. No other
  edit is allowed in either file: the accent stays a property of the path alone and
  every existing blank keeps its pair. This is the only reason those two files are
  in the exclusive list, and QA must check that no other line of them moved.

### Data — the registry

- `src/data/tilesets/ids.ts`: `export const TILESET_IDS = ['forest', 'city',
  'interior'] as const;` and `TILESET_NAMES` gains
  `city: 'FRLG City'`, `interior: 'FRLG Interior'`.
- `src/data/tilesets/index.ts`: two `import.meta.glob` maps mirroring
  `FOREST_ATLASES` (`'../../assets/frlg/city.png'`, `'../../assets/frlg/interior.png'`,
  eager, `?url`, `import: 'default'`), the two placeholder imports, and the two
  registry rows `city` / `interior` built like the forest's:
  `atlasUrl: packedAtlasUrl(CITY_ATLASES, '../../assets/frlg/city.png',
  cityPlaceholderUrl)`, `palette: FRLG_CITY_PALETTE`, `config: FRLG_CITY_TILESET`
  (and the interior twin). `TILESET_TEXTURE_KEY`, `COMMON_TEXTURE_KEY` and
  `tilesetTextureKey` are unchanged, so the city loads as `tiles:city` and the
  interior as `tiles:interior`.
- `src/data/tilesets/palettes.ts`: add `FRLG_CITY_PALETTE` and
  `FRLG_INTERIOR_PALETTE`, one entry for **every** map value its config resolves
  (the city's `0`, `1`, `6`, `8`, `12`-`16`; the interior's `0`, `1`, `15`, `17`-`19`),
  each an opaque `#rrggbb` string. The colours are the dev's choice; the key set is
  not.

## 🧩 Data and configuration

| Key | Where | Shape | Meaning |
|---|---|---|---|
| `PATH`…`PC` | `src/engine/map.ts` | `12`…`19` | the city/interior tile kinds' map values; walkability per the table below |
| `CITY_KIND_VALUES` | `src/data/tilesets/city.ts` | `Record<CityKind, number>` | kind → map value, frozen for Batch 118 |
| `INTERIOR_KIND_VALUES` | `src/data/tilesets/interior.ts` | `Record<InteriorKind, number>` | kind → map value, frozen for Batch 118 |
| `cells` | `src/data/frlg/city.json`, `interior.json` | `Record<kind, frame>` | kind → atlas frame, written by the packer |
| `TILESET_IDS` | `src/data/tilesets/ids.ts` | `['forest','city','interior']` | the registry's id list |

Walkability, frozen (`isWalkable`):

| value | name | walkable | kind |
|---|---|---|---|
| 0 | `FLOOR` | yes | interior floor / city ground |
| 1 | `WALL` | no | both |
| 6 | `WATER` | no | city |
| 8 | `TALL_GRASS` | yes (rolls a wild encounter) | city grass corner |
| 12 | `PATH` | yes | city street |
| 13 | `PLAZA` | yes | city square |
| 14 | `ROOF` | no | city building |
| 15 | `DOOR` | yes | both |
| 16 | `SIGN` | no | city |
| 17 | `COUNTER` | no | interior |
| 18 | `HEAL` | no | interior |
| 19 | `PC` | no | interior |

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the four test files this
    task adds or extends (`src/engine/map.test.ts`, `src/data/tilesets/city.test.ts`,
    `src/data/tilesets/interior.test.ts`, `src/data/tilesets/ids.test.ts`).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-271` — the twenty-two paths of the exclusive
    list (the twenty of the items plus the two `scripts/assets/placeholderAccent*`
    paths of the accent exception) and nothing else. (`src/assets/frlg/city.png` and `interior.png` must **not**
    appear: that folder is gitignored.)
  - Art commands, run from the worktree:
    `node scripts/frlg/build-region-tilesets.mjs "$ASSETS_ROOT/frlg/tileset.png" "$ASSETS_ROOT/frlg/tileset-2.png"`
    (`$ASSETS_ROOT` = `/home/runner/work/_temp/assets/store` on this machine), then
    `node scripts/assets/build-placeholders.mjs frlg/city.png frlg/interior.png`.
  - **One browser pass is owed**, for the two `[live]` criteria below; it is a dev
    server plus headless Chromium over CDP. No scene draws a city or an interior
    yet (the generators are Batch 118 and `WorldScene` is Batch 120), so the pass
    reads the **atlas the running game actually loaded** and paints the frozen grid
    from it in-page — `renderer.snapshotArea` is not applicable to a tileset no
    scene draws, and this is stated so nobody hunts for a missing scene.
  - **No other browser pass is owed:** no scene, no HUD panel and no player-facing
    string changes.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean.
  - [ ] `[unit]` `npm test` is green.
  - [ ] `[unit]` `git diff --name-only main...task-271` lists only the twenty-two
        exclusive paths (the two `placeholders/frlg/*.png` included, the two
        `assets/frlg/*.png` excluded, and the two `scripts/assets/placeholderAccent*`
        files carrying nothing but the pinned hue and the allow-list length).
  - [ ] `[unit]` `src/engine/map.test.ts` pins the new vocabulary: `PATH`…`PC` are
        `12`…`19`; every value of the walkability table above answers exactly as
        declared; each of the eight new sketch characters round-trips through
        `mapFromSketch`; and the existing "every other map value walkable exactly as
        it was" case still passes with the new rows added to its table.
  - [ ] `[unit]` `src/data/tilesets/ids.test.ts` asserts `TILESET_IDS` equals
        `['forest', 'city', 'interior']`, `TILESET_NAMES` has a non-empty name for
        each, and `Object.keys(TILESETS)` equals `[...TILESET_IDS]` (the shipped
        `['forest']` assertion is updated, not deleted).
  - [ ] `[unit]` In `city.test.ts` / `interior.test.ts`, for **every** kind of its
        tileset: `CITY_KIND_VALUES[kind]` / `INTERIOR_KIND_VALUES[kind]` is the
        documented number, the manifest's `cells[kind]` equals
        `config.frames[value]`, and `resolveTileFrame([[value]], 0, 0, config)`
        returns a non-null frame equal to `config.frames[value]`. Each file also
        asserts `config.frames[FLOOR] === 0`, that `Object.keys(manifest.cells)` is
        exactly its kind list, that its frame values are distinct, and that
        `manifest.atlas` equals `config.atlas`.
  - [ ] `[unit]` Both manifests are committed and both atlases are not:
        `git ls-files src/data/frlg/city.json src/data/frlg/interior.json` prints
        both, and `git check-ignore -q src/assets/frlg/city.png &&
        git check-ignore -q src/assets/frlg/interior.png` exits `0`.
  - [ ] `[unit]` The committed blanks decode to 64×208 and are what a clone without the
        pack resolves: `city.test.ts` and `interior.test.ts` each decode
        `src/assets/placeholders/frlg/<id>.png` **unconditionally** and assert its
        size is 64×208 (this always runs); each also carries
        `describe.skipIf(hasArt('frlg/<id>.png'))` asserting
        `TILESETS[<id>].atlasUrl.includes('placeholders/frlg/<id>.png')` (the
        clean-clone case; it skips on a packed clone, which is expected), and the
        twin `describe.skipIf(!hasArt('frlg/<id>.png'))` asserting the packed
        `src/assets/frlg/<id>.png` is 64×208, that **all 52 frames are fully
        opaque**, and that its kind frames' mean colours are pairwise distinct (max
        channel distance `>= 12`).
  - [ ] `[unit]` The placeholder wiring is in the registry:
        `grep -c "packedAtlasUrl(CITY_ATLASES, '../../assets/frlg/city.png', cityPlaceholderUrl)" src/data/tilesets/index.ts`
        prints `1` and the interior twin prints `1` — so the clean-clone fallback is
        the shipped `packedAtlasUrl` path and not a second resolver.
  - [ ] `[unit]` With `$ASSETS_ROOT/frlg/` present (this machine has it; skip and
        report **not-run** otherwise, naming the missing files), the packer runs
        twice and is deterministic: `sha256sum src/assets/frlg/city.png
        src/assets/frlg/interior.png src/data/frlg/city.json
        src/data/frlg/interior.json` recorded after the first run is identical after
        the second, and both PNGs decode to 64×208.
  - [ ] `[unit]` `grep -c "^  'frlg/city.png',\|^  'frlg/interior.png',"
        scripts/assets/build-placeholders.mjs` prints `2`, and
        `grep -c "build-region-tilesets" scripts/assets/pack.mjs` prints at least `1`.
  - [ ] `[unit]` `src/data/biomes.ts` is untouched:
        `git diff --name-only main...task-271 -- src/data/biomes.ts src/data/biomes.test.ts`
        is empty and `npm test` proves `BIOME_ORDER` is still `['forest']`.
  - [ ] `[live]` **The running game loaded both new atlases.** Method: from the
        worktree, `node scripts/frlg/build-region-tilesets.mjs "$ASSETS_ROOT/frlg/tileset.png" "$ASSETS_ROOT/frlg/tileset-2.png"`,
        then `npm run dev`, open `http://localhost:5173/` at 1280×800 (DPR 1) and
        wait until the main menu is drawn. Over CDP, evaluate:
        ```js
        const { game } = await import('/src/main.ts');
        const textures = ['tiles:city', 'tiles:interior'].map((key) => game.textures.get(key));
        const report = textures.map((tex) => ({
          exists: Boolean(tex),
          frames: Array.from({ length: 52 }, (_, i) => i)
            .every((i) => tex.has(String(i)) && tex.get(String(i)).width === 16 && tex.get(String(i)).height === 16),
          size: tex.getSourceImage().width + 'x' + tex.getSourceImage().height,
        }));
        ```
        **Measurement:** both `exists` are `true`, both `frames` are `true`, and both
        `size` read `64x208` — **with `src/assets/frlg/city.png` and
        `interior.png` present on the worktree** (run the packer first). It fails if
        either atlas fell back to a differently sized blank or if the
        registry/`BootScene` wiring missed a sheet; a run against the committed
        blanks alone still passes this one (a blank is 64×208 and slices into 52
        frames), which is why the patch criterion below is the art's real gate.
  - [ ] `[live]` **A 20×20 city patch paints every kind at 24 px, with no seam, and
        the door is not the wall.** Method: same session, then evaluate:
        ```js
        const { game } = await import('/src/main.ts');
        const { default: manifest } = await import('/src/data/frlg/city.json');
        const image = game.textures.get('tiles:city').getSourceImage();
        const KINDS = ['grass', 'path', 'plaza', 'wall', 'roof', 'door', 'water', 'sign'];
        const surface = document.createElement('canvas');
        surface.width = 480; surface.height = 480;
        const paint = surface.getContext('2d');
        paint.imageSmoothingEnabled = false;
        const means = {};
        for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
          const kind = KINDS[(x + y) % KINDS.length];
          const frame = manifest.cells[kind];
          paint.drawImage(image, (frame % 4) * 16, Math.floor(frame / 4) * 16, 16, 16,
            x * 24, y * 24, 24, 24);
          const data = paint.getImageData(x * 24, y * 24, 24, 24).data;
          const acc = (means[kind] ??= { r: 0, g: 0, b: 0, n: 0 });
          for (let i = 0; i < data.length; i += 4) {
            acc.r += data[i]; acc.g += data[i + 1]; acc.b += data[i + 2]; acc.n += 1;
          }
        }
        const pixels = paint.getImageData(0, 0, 480, 480).data;
        let transparent = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) transparent += 1;
        const mean = (k) => [means[k].r / means[k].n, means[k].g / means[k].n, means[k].b / means[k].n];
        const distance = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        ```
        **Measurement, on `http://localhost:5173/` (dev server, packed atlas, 20×20
        grid, cell `(x, y)` draws `KINDS[(x + y) % 8]` with `KINDS` in the order
        above):** (a) `transparent === 0` — no seam and no hole in the 480×480 patch
        (230 400 pixels read with `getImageData`); (b) `distance(mean('door'),
        mean('wall')) >= 25`; (c) every pair of the 8 kinds' means is at least `12`
        apart on its best channel. It fails if a crop is partly transparent, if two
        kinds share a crop, or if the door reads as the wall.

## 📣 Coordination

- **For `[Task-273]` and `[Task-274]` (Batch 118, the city and interior
  generators):** import the vocabulary, not the numbers —
  `CITY_KIND_VALUES` / `INTERIOR_KIND_VALUES` for map values and
  `TILESETS.city.config` / `TILESETS.interior.config` for frames. `DOOR` and `PATH`
  are walkable, `ROOF`, `SIGN`, `COUNTER`, `HEAL` and `PC` are solid, and a city's
  grass corner is `TALL_GRASS` so it rolls encounters with no new rule. Every kind
  is a plain frame (no autotile, no wall pattern), so a building is a rectangular
  block of `WALL`/`ROOF` cells with a `DOOR` cell on its street row.
- **For `[Task-272]` (the long route):** nothing here changes the forest config or
  `TILESET_IDS`' first entry; a route keeps `TILESETS.forest`.
- **For `[Task-284]`/`[Task-287]` (Batch 121, the city and interior screens):** the
  interiors are **provisional art** composed from the buildings sheet; the doc
  section records it, and a future indoor rip replaces `INTERIOR_CELLS` in
  `scripts/frlg/build-region-tilesets.mjs` and nothing else.
- **For the Architect:** the tile-kind vocabulary is now frozen in
  `src/engine/map.ts`; Batch 118's specs must read `CITY_KIND_VALUES` /
  `INTERIOR_KIND_VALUES` rather than invent values, and `docs/region-spec.md`'s
  §7.1/§7.2 quotes this table.
- **For QA:** this is the batch's widest task (twenty-two paths, fourteen of them
  mechanical; the two accent files may carry only the pinned hue and the length
  literal). Audit the diff against the list before running the suite, and give
  the two `[live]` criteria the whole browser budget.

## ⛔ Out of scope

- Any city, route, interior or gym **generator** — Batch 118.
- Any scene, `WorldScene`, a `TilemapLayer` draw path, or a dev preview screen — the
  atlases are measured through the texture the game loads, not through a new screen.
- A real FRLG indoor tileset: none exists in the asset store (`docs/art-direction.md`
  inventory), so the interior's art is composed from the buildings sheet and
  documented as provisional. Importing a true indoor rip is a later task if the
  human wants it.
- `autotile`/`wallPattern`/`variants` for the new tilesets, a `grassRustle` for the
  city's grass, and a `hiddenItemFrame`.
- Regenerating the dex (`npm run data:dex`), touching `src/data/biomes.ts`, adding a
  `BiomeId`, or changing the forest's config, atlas, frames or tests.
- `.gitignore`: `/src/assets/frlg/` already ignores both new atlases; only add a line
  if an output lands outside that folder.

# Spec: Task-312 — The laboratory, the Centre and the houses wear FireRed's own art

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** art pipeline (packer + manifests) + tileset data + two scene lines.
- **Role:** Dev.
- **Objective:** the interior field the region draws is three **FireRed fields** instead
  of one provisional composite: `interior-lab`, `interior-centre` and `interior-house`,
  each a 64x208 atlas of the decomp's own 16x16 metatiles and a committed manifest of
  six kinds (`floor`, `wall`, `door`, `counter`, `heal`, `pc`). The laboratory and the
  Pokémon Centre draw their own field; the gym and the casino keep the provisional
  `interior` field until their own batch.
- **Environment:** worktree `../wt-pkm-312`, branch `task-312`.
- **Dependencies:** none. The region tilesets (`Task-271`), the interior config
  (`src/data/tilesets/interior.ts`) and the scene wiring (`Task-300`) are merged on
  `main`. The decomp checkout is at
  `C:\Users\Dani\projects\pkm-randomlike\sprite-sources\pokefirered` and its sparse
  checkout already carries `data/tilesets/primary/building`,
  `data/tilesets/secondary/{lab,pokemon_center,generic_building_1}` and
  `data/layouts/{PalletTown_ProfessorOaksLab,PokemonCenter_1F,House1}`.

### Exclusive paths (single writer)

Nothing outside this list.

- `scripts/frlg/build-interior-tilesets.mjs` (new)
- `scripts/assets/pack.mjs`
- `scripts/assets/build-placeholders.mjs`
- `scripts/assets/placeholderAccent.mjs`
- `scripts/assets/placeholderAccent.test.mjs`
- `src/assets/frlg/interior-lab.png` (generated, gitignored)
- `src/assets/frlg/interior-centre.png` (generated, gitignored)
- `src/assets/frlg/interior-house.png` (generated, gitignored)
- `src/data/frlg/interior-lab.json` (generated, committed)
- `src/data/frlg/interior-centre.json` (generated, committed)
- `src/data/frlg/interior-house.json` (generated, committed)
- `src/assets/placeholders/frlg/interior-lab.png` (committed blank)
- `src/assets/placeholders/frlg/interior-centre.png` (committed blank)
- `src/assets/placeholders/frlg/interior-house.png` (committed blank)
- `src/data/tilesets/interior.ts`
- `src/data/tilesets/interior.test.ts`
- `src/data/tilesets/ids.ts`
- `src/data/tilesets/ids.test.ts`
- `src/data/tilesets/index.ts`
- `src/data/tilesets/palettes.ts`
- `src/scenes/InteriorScene.ts`
- `src/scenes/services.ts`
- `src/data/README.md`
- `src/assets/README.md`
- `docs/tileset-spec.md` (§2b and §6 only)
- `docs/art-direction.md` (the interiors paragraph)

`src/scenes/GymScene.ts`, `src/scenes/BootScene.ts`, `src/engine/map.ts`,
`src/data/region.ts`, `src/main.ts`, `package.json` and `vite.config.ts` are **not**
touched.

### Inputs (read-only)

- `AGENTS.md`.
- The decomp: `C:\Users\Dani\projects\pkm-randomlike\sprite-sources\pokefirered`
  (`data/tilesets/primary/building`, `data/tilesets/secondary/{lab,pokemon_center,generic_building_1}`,
  the three `data/layouts/.../map.bin`). The store is gitignored; take its path from
  argv or `PKM_FRLG_DECOMP`, never a path inside the worktree.
- The three reference renders (view them with the read tool; they are the expected
  room art):
  - `C:\Users\Dani\AppData\Local\Temp\frlg-interiors\layout3-lab.png`
  - `C:\Users\Dani\AppData\Local\Temp\frlg-interiors\layout3-centre.png`
  - `C:\Users\Dani\AppData\Local\Temp\frlg-interiors\layout3-house.png`
  - the labelled per-metatile sheets `ids-lab.png`, `ids-centre.png`,
    `ids-house.png` in the same folder.
- `scripts/frlg/build-region-tilesets.mjs` (the atlas contract and the
  composite-over-ground rule).
- `scripts/frlg/build-city-buildings.mjs`, `scripts/frlg/build-sign.mjs` (the
  flat-crop refusal and the alpha rules).
- `scripts/legacy-art/png-codec.mjs` (`decodePng` returns `indices` for a palette
  PNG, `encodePng` takes a Buffer).
- `scripts/assets/root.mjs`, `scripts/assets/pack.mjs`,
  `scripts/assets/build-placeholders.mjs`, `scripts/assets/placeholderAccent.mjs`.
- `src/data/tilesets/interior.ts`, `interior.test.ts`, `city.ts`, `city.test.ts`,
  `frlg.ts`, `ids.ts`, `ids.test.ts`, `index.ts`, `palettes.ts`,
  `src/data/frlg/interior.json`, `src/data/frlg/city.json`.
- `src/engine/tileset.ts`, `src/engine/tileFrames.ts`, `src/engine/frameMap.ts`,
  `src/engine/map.ts`.
- `src/scenes/InteriorScene.ts`, `src/scenes/services.ts`, `src/scenes/GymScene.ts`,
  `src/scenes/BootScene.ts`, `src/scenes/WorldScene.ts`, `src/scenes/walker.ts`.
- `docs/tileset-spec.md` §1/§2b/§6, `docs/art-direction.md`, `src/data/README.md`,
  `src/assets/README.md`.

## 🔒 Contract

### TypeScript

`src/data/tilesets/interior.ts` keeps everything it exports today and adds:

```ts
import type { InteriorRoomKind } from '../../../engine/region/interior/plan';

/** The provisional field the gym and the casino still draw. */
export const FRLG_INTERIOR_TILESET: TilesetConfig;

export const FRLG_LAB_TILESET: TilesetConfig;
export const FRLG_CENTRE_TILESET: TilesetConfig;
export const FRLG_HOUSE_TILESET: TilesetConfig;

/** The field a room kind draws: lab/centre/house their own, gym/casino `interior`. */
export function interiorTilesetId(kind: InteriorRoomKind): TilesetId;
```

`interiorTilesetId` is total over `InteriorRoomKind`:
`lab → 'interior-lab'`, `centre → 'interior-centre'`, `house → 'interior-house'`,
`gym → 'interior'`, `casino → 'interior'`.

`ids.ts`:

```ts
export const TILESET_IDS = [
  'forest', 'city', 'interior',
  'interior-lab', 'interior-centre', 'interior-house',
] as const;
```

`TILESET_NAMES` adds `'FRLG Lab'`, `'FRLG Centre'`, `'FRLG House'`. `TILESETS`
(`index.ts`) adds the three rows, each with `atlasUrl` from `packedAtlasUrl` over its
own `src/assets/frlg/interior-<field>.png` glob and its committed blank, and its own
palette.

`InteriorScene.ts` and `services.ts` replace the one config with the room's:

```ts
const id = interiorTilesetId(interior.kind);
this.drawWorld({
  tiles: interior.tiles,
  meshes: buildNodeMeshes(interior.tiles, TILESETS[id].config),
  tilesetId: id,
});
```

`GymScene.ts` keeps `FRLG_INTERIOR_TILESET` and `tilesetId: 'interior'` untouched.

### Data

Each `src/data/frlg/interior-<field>.json` (committed, written by the packer):

```json
{
  "kind": "pkmr-tileset",
  "version": 1,
  "id": "interior-lab",
  "atlas": { "tileSize": 16, "cols": 4, "rows": 13, "width": 64, "height": 208 },
  "cells": { "floor": 0, "wall": 1, "door": 2, "counter": 3, "heal": 4, "pc": 5 },
  "metatiles": { "floor": 649, "wall": 105, "door": 665, "counter": 641, "heal": 685, "pc": 117 }
}
```

The `cells` order is exactly `floor`, `wall`, `door`, `counter`, `heal`, `pc`, and
frame 0 is the floor (the ground every cell is drawn over). `metatiles` records the
decomp id each cell was composed from; it is the pin the test checks.

| field | layout (w×h) | secondary set | floor | wall | door | counter | heal | pc |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `interior-lab` | `PalletTown_ProfessorOaksLab` 13×14 | `lab` | 649 | 105 | 665 | 641 | 685 | 117 |
| `interior-centre` | `PokemonCenter_1F` 15×10 | `pokemon_center` | 641 | 644 | 27 | 692 | 715 | 736 |
| `interior-house` | `House1` 11×9 | `generic_building_1` | 273 | 172 | 27 | 327 | 335 | 341 |

These ids are **verified** against the rendered layouts; do not re-pick them. The
room canvas (24×18 today) is Batch 136's; the atlas is 16px and tiles at any size.
**Corrected after Task QA (round 1):** the Centre's `heal` is `715` (the green
machine with the red cross) and its `pc` is `736` (the blue/white monitor);
`685` is the cream box on the counter and `672` is the layout's black diagonal
corner, which is why the first pass drew neither. The lab's and the house's
`heal`/`pc` are never stamped by the plan and stay as pinned.

## 🧩 Data and configuration

### The matcher the packer reads (verified — reproduce exactly)

- Primary set `data/tilesets/primary/building`: `tiles.png` is 128×320 (640 8×8 tiles),
  `metatiles.bin` 640 metatiles, `palettes/00.pal`-`15.pal` JASC-PAL.
- Secondary set: `tiles.png` 8px-tile sheet (`lab` 128×56, `pokemon_center` 128×192,
  `generic_building_1` 128×56), `metatiles.bin` (`lab` 175, `pokemon_center` 255,
  `generic_building_1` 24), its own palettes.
- **Tiles:** a metatile entry's tile index < 640 reads the primary `tiles.png` at that
  index; ≥ 640 reads the secondary `tiles.png` at `index - 640`.
- **Metatiles:** id < 640 is the primary's `metatiles.bin` at `id * 16`; id ≥ 640 is
  the secondary's at `(id - 640) * 16`.
- **Entry:** 8 `u16` per metatile, 16 bytes: entries 0-3 are the bottom layer (2×2),
  entries 4-7 the top layer (2×2). `tile = e & 0x3ff`, `hflip = e & 0x400`,
  `vflip = e & 0x800`, `palette = (e >> 12) & 0xf`.
- **Palette:** index the **metatile's own tileset's** `palettes/NN.pal` (not a shared
  7+6 table — a secondary metatile uses the secondary's palette). Read the JASC-PAL
  text: line 2 is the count, then `r g b` lines. Pixel index 0 is transparent.
- **Pixel:** `decodePng(readFileSync(tiles.png)).indices` is the 4bpp index per pixel
  (`x = tile % (width / 8) * 8 + 0..7`). Colour = `palette[index]`; skip index 0.
- **Compose:** bottom layer first, then the top layer over it, skipping transparent
  pixels (never overwrite with alpha 0).
- **Layout:** `map.bin` is `width * height` little-endian `u16`, row-major; the
  metatile id is `entry & 0x3ff`. The collision/elevation bits are ignored.

### `scripts/frlg/build-interior-tilesets.mjs` (new)

- `node scripts/frlg/build-interior-tilesets.mjs [decompRoot]`;
  `decompRoot = argv[2] ?? process.env.PKM_FRLG_DECOMP ?? assetPath('pokefirered')`.
  Fail with a clear message when a set or layout is missing.
- One `FIELDS` table of the three rows above: `{ id, layout, width, height, kindIds }`.
- For each field: decode the primary + its secondary, compose the six kind metatiles,
  **composite each over the floor** (so every cell is a filled field), write frames
  0-5 in the contract order, and fill frames 6-51 with the floor. Refuse a kind whose
  metatile id is not in the layout's `map.bin` (a wrong id is caught here) and a cell
  that is still transparent after the floor is laid under it.
- Write `src/assets/frlg/interior-<field>.png` (64×208) and
  `src/data/frlg/interior-<field>.json`; print each atlas's size and its six ids.
- Deterministic: the same input writes byte-identical outputs. No new dependency.
- Doc line at the top: the decomp sparse paths the store must carry
  (`data/tilesets/primary/building`, the three secondary sets, the three layouts).

### Pack and blanks

- `scripts/assets/pack.mjs`, after `frlg region tilesets`:
  `name: 'frlg interior fields'`, `script: 'scripts/frlg/build-interior-tilesets.mjs'`,
  `needs: requires(['pokefirered/data/tilesets/primary/building', 'pokefirered/data/tilesets/secondary/lab', 'pokefirered/data/tilesets/secondary/pokemon_center', 'pokefirered/data/tilesets/secondary/generic_building_1'])`,
  `args: (p) => [p('pokefirered')]`.
- `scripts/assets/build-placeholders.mjs`: add `frlg/interior-lab.png`,
  `frlg/interior-centre.png`, `frlg/interior-house.png` to `ATLASES` (the list goes
  from 23 to 26) and regenerate the three blanks with
  `node scripts/assets/build-placeholders.mjs frlg/interior-lab.png frlg/interior-centre.png frlg/interior-house.png`.
  The three blanks are 64×208, one accent each (`placeholderAccent.mjs`), committed.
- `palettes.ts`: one `Palette` per field, flat fallback colours for values
  `0` floor, `1` wall, `15` door, `17` counter, `18` heal, `19` pc (lab grey/cream,
  Centre cream/yellow/red, house wood/white).
- A clone without the pack resolves the three placeholders and builds; the gym keeps
  `frlg/interior.png`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `node scripts/frlg/build-interior-tilesets.mjs "C:\Users\Dani\projects\pkm-randomlike\sprite-sources\pokefirered"`
  - `node scripts/assets/build-placeholders.mjs frlg/interior-lab.png frlg/interior-centre.png frlg/interior-house.png`
  - `npm test`
  - `npm run build`
  - `git diff --name-only main...task-312` against the exclusive paths.
  - The live pass needs `npm run dev` with the three atlases packed.
- **Acceptance criteria:**
  - [ ] `[unit]` The three manifests exist, each is 64×208 / 4×13, its `cells` keys are
    exactly `floor, wall, door, counter, heal, pc` in that order, frame 0 is `floor`,
    the five other frames are distinct and in `1..51`, and each `metatiles` row equals
    the pinned table above (`interior.test.ts`).
  - [ ] `[unit]` `interiorTilesetId` maps `lab → interior-lab`, `centre →
    interior-centre`, `house → interior-house`, `gym → interior`, `casino →
    interior`; every id in `TILESET_IDS` has a name and a `TILESETS` row
    (`ids.test.ts`).
  - [ ] `[unit]` `TILESET_IDS` is `['forest','city','interior','interior-lab',
    'interior-centre','interior-house']` and `TILESETS` is keyed exactly by it.
  - [ ] `[unit]` The three committed blanks are 64×208; the placeholder list is 26 and
    `accentFor` gives each blank its own fill; the three placeholder-fallback tests
    pass (`interior.test.ts`, `placeholderAccent.test.mjs`).
  - [ ] `[unit]` When the atlas is packed, each of its 52 cells is opaque and the six
    kind cells do not share one mean colour (the `interior.test.ts` pattern, skipped
    when the pack is absent).
  - [ ] `[unit]` `InteriorScene` and `services.ts` name `interiorTilesetId` and no
    longer name `FRLG_INTERIOR_TILESET` (a source pin); `GymScene` still names it.
  - [ ] `[unit]` The packer refuses an id that is not in its layout's `map.bin` (a
    negative test that builds the table with a bogus id, or a pure `assertKindInLayout`
    exported by the script and tested from the Vitest suite — keep the check headless).
  - [ ] `[unit]` The suite and the build are green.
  - [ ] `[live]` At 1280×800 with the three atlases packed: NEW RUN lands in the town's
    laboratory and the room shows the FRLG lab floor (grey diagonal tile) and its wall,
    with no magenta and no transparent seam; walking into a city's Pokémon Centre shows
    the yellow checkered floor, the red counter, the green heal screen and the blue PC;
    the gym still draws the provisional field. Read the scene's
    `__pkmInterior.debugInteriorState()` (lab) and the Centre's gone state; the house
    field loads but no scene draws it until Task-313.

## 📣 Coordination

- For the next batch: Task-313 reads `interiorTilesetId`, the three manifests and the
  three configs; it adds the room sizes, the furniture pieces and the `House` scene.
- The `metatiles` map is the pin: a future re-pack that changes an id must change the
  test in the same task.
- No map value moves: the fields stamp the six values the interior already has.

## ⛔ Out of scope

- No change to `src/data/region.ts`, the interior plan, the room sizes or the slots.
- No furniture/piece atlas (Task-313).
- No `HouseScene.ts` (Task-313).
- No gym or casino field, no `mart`, no `game_corner`.
- No new map values, no new kinds, no autotile/pattern/variants.
- No change to the city, the route, the player or the walker.

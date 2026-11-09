# PokeRandomLike — Tileset Spec

The point of this spec: **a route swaps its tileset and the same map still
renders**, because the map holds semantics (`WALL`, `FLOOR`, `TALL_GRASS`...) and
the tileset holds art. `src/engine/tileFrames.ts` turns the two into one frame
index; nothing else knows about the atlas.

## 1. Map values

Defined once in `src/engine/map.ts`. Walkability and encounters are decided by
value, never by art:

| Value | Name | Walkable | Notes |
| --- | --- | --- | --- |
| 0 | `FLOOR` | yes | plain ground |
| 1 | `WALL` | no | rock/tree/building wall; also the route border |
| 2 | `EXIT` | yes | a route's exit position (unused tile since the region's exit bands); no art yet (draws ground, §6) |
| 3 | `TRAP` | yes | hazard, cave-flavoured |
| 4 | `CHEST` | yes | loot |
| 5 | `ITEM` | yes | floor item |
| 6 | `WATER` | no | blocks movement only |
| 7 | `CARPET` | yes | interior floor |
| 8 | `TALL_GRASS` | yes | rolls a wild encounter |
| 9 | `LEDGE` | no | jump down only (movement rule, later) |
| 10 | `BUSH` | no | a field-gate obstacle; opened by a party type, not a move |
| 11 | `ROCK` | no | same, the rock seal |
| 12 | `PATH` | yes | a city street |
| 13 | `PLAZA` | yes | a city square |
| 14 | `ROOF` | no | a building's roof |
| 15 | `DOOR` | yes | a building's entrance (the one walkable part of its front) |
| 16 | `SIGN` | no | a readable post |
| 17 | `COUNTER` | no | a shop / Pokémon Centre counter |
| 18 | `HEAL` | no | the Centre's healing station |
| 19 | `PC` | no | the storage PC |

Values 12-19 are the **city and interior vocabulary**, frozen here so a region
generator emits map values the engine already walks and the scene already draws:
`grass`, `path`, `plaza`, `wall`, `roof`, `door`, `water`, `sign` for a city and
`floor`, `wall`, `door`, `counter`, `heal`, `pc` for an interior, mapped by
`CITY_KIND_VALUES` / `INTERIOR_KIND_VALUES` (§2b). A city's grass corner is
`TALL_GRASS` (8), so it rolls wild encounters with no new rule, and `DOOR`/`PATH`
are walkable while `ROOF`, `SIGN`, `COUNTER`, `HEAL` and `PC` are solid.

`SKETCH_LEGEND` carries one character per value, so a hand-authored fixture can
build a city or an interior from a string: `P` `PATH`, `Z` `PLAZA`, `O` `ROOF`,
`D` `DOOR`, `S` `SIGN`, `U` `COUNTER`, `H` `HEAL`, `X` `PC` (beside `.` `#` `E`
`T` `C` `I` `~` `,` `"` `^` `B` `R`).

## 2. Atlas contract

Every biome ships two images:

- **biome sheet**: 4 columns x 13 rows of square cells, frame index row-major.
  The cell size is the tileset's own `tileSize` (`D18`): 24px for the PMD-derived
  sheets (96x312), 16px for the FireRed/LeafGreen atlases (64x208). Frames 0-50
  are the shared vocabulary (floor variants, wall autotile shapes, water autotile
  shapes) declared as constants in `src/engine/tileset.ts`, and frame 51 is the
  rocky ledge lip (`FRAME_LEDGE`, `D26`). The FRLG fields stamp every floor
  variant (`1`,`2`,`41`-`43`, beside the shared common-sheet slots) and draw
  the wall as a repeating whole-object motif on frames `7`-`18` (`wallPattern`,
  §3) instead of one frame per shape. A ledge is a **horizontal run**: frame 51 is
  its centre and frames `3`/`4` its left/right caps (`FRLG_LEDGE_LEFT`/
  `FRLG_LEDGE_RIGHT`), which the field sheet leaves free (it draws the stair/trap
  slots from the common atlas). Frame `5` is the tall-grass ground
  (`FRLG_TALL_GRASS`), stamped whole from the sheet's tufted grass. The sheet has
  one tuft per ground palette (the outdoor `7,0` on the light ground, the forest
  `2,33` on the dark one), so each field picks the tuft drawn on its own floor; the
  ledge lip has no dark-ground variant, so it is re-grounded onto the field's floor
  (`overFill` keys its light sheet background and fills it with the floor). Frames
  `49`/`50` — the two dead wall-shape slots (`wallPattern` wins every wall, so the
  autotiler never draws them) — now carry the **bush** and **rock** seals of a
  `vault` point of interest (`FRLG_OBSTACLE_BUSH`/`FRLG_OBSTACLE_ROCK`), re-grounded the way
  the ledge lip is: the bush is the tree bank's lower-leaves cell keyed against the
  field's floor, the boulder is the cave bank's rock body keyed against the **cave**
  floor it is drawn on. The third seal, the pond, draws through the shipped `WATER`
  autotile rule. The
  **forest is the only field wired to a biome**: it picks the darker `0,34`
  (`rgb(88,160,128)`, the tone the tree bank is drawn on), while the outdoor light
  floor `6,1` (`rgb(112,200,160)`) and the cave rock `2,24` stay in their atlases,
  unwired. The forest floor is a **weighted mix** of its dark-ground tiles (`0,34`
  base, `2,34`, `3,34` and the rare flowered `0,38`; §3,
  `FRLG_FOREST_TILESET`), so the ground reads varied instead of one repeated tile.
  The fifth dark-ground cell, `5,34` (frame `41`, `FRAME_FLOOR_ALT_3`), is **not**
  in that mix: it is the forest's `hiddenItemFrame` (§6), the patch a hidden ground
  item draws, so the ground never draws it naturally and only a hidden item can
  show it.
- **common sheet** (`src/assets/common.png`): 5 cells of 24x24, shared by every
  biome, for the tiles that mean the same thing everywhere: trap, chest, item,
  carpet (and a stair slot that no map value maps to while the route `EXIT` art
  is deferred — the `EXIT` tile currently draws plain ground).
- **props**: a static prop a route draws over a tile is its **own** 16x16 texture,
  never a 14th atlas row, so the route can draw it whatever sheet its biome uses.
  The boss door's sign is `src/assets/frlg/sign.png` — the field sheet's cell
  `23,3` (a 17px-pitch block grid with a 1px origin), cropped by
  `scripts/frlg/build-sign.mjs` **with its own alpha kept** (68 of its 256 pixels
  are transparent, all four corners among them), read through
  `src/data/tilesets/props.ts` and loaded as a one-frame 16x16 spritesheet. A
  **flat** crop is refused (exit 1, the source cell's origin, column and row
  named): fewer than 3 distinct opaque colours, or more than 40 % near-black
  pixels (all three channels ≤ 16), means the grid shifted and the cell is not a
  sign, so nothing is written instead of a square. The committed fallback is art
  too, not a blank: `src/assets/placeholders/frlg/sign.png` is a **transparent**
  16x16 board-and-post silhouette (82 opaque pixels, the board `#7888A0` over the
  post `#3A4252`), written by
  `node scripts/assets/build-placeholders.mjs frlg/sign.png` — that generator
  takes an optional atlas filter and branches per atlas whose fallback would
  otherwise read as the wrong object — so a clone without the pack draws a
  signpost as well.

A tileset declares:

```ts
type VariantFrame = { frame: number; weight: number }   // a weighted entry
type VariantFrames = (number | VariantFrame)[]          // bare frame = weight 1

type TilesetConfig = {
  atlas: { tileSize, cols, rows, width, height }
  frames: Record<number, number>          // default frame per map value
  autotile?: AutotileRule[]               // neighbour-aware framing (walls, water)
  variants?: Record<number, VariantFrames>      // deterministic per-tile variety
  wallAdjacentVariants?: Record<number, VariantFrames>
  commonFrames?: Record<number, number>    // map values drawn from the common sheet
  grassRustle?: number[]                   // tall grass' own rustle; rest frame first
  hiddenItemFrame?: number                 // hidden ground item's floor frame; absent = frames[FLOOR]
}
```

## 2b. The city and interior atlases

A **city** and an **interior** are not biomes: they are the two region fields a
settlement and its buildings draw, and each ships its own 4x13 sheet of 16px cells (64x208) plus
a committed manifest, all written by `scripts/frlg/build-region-tilesets.mjs`:

| Tileset | sheet | manifest | kinds (kind → map value → frame) |
| --- | --- | --- | --- |
| `city` | `src/assets/frlg/city.png` | `src/data/frlg/city.json` | `grass`→8→1, `path`→12→2, `plaza`→13→3, `wall`→1→4, `roof`→14→5, `door`→15→6, `water`→6→7, `sign`→16→8 |
| `interior` | `src/assets/frlg/interior.png` | `src/data/frlg/interior.json` | `floor`→0→0, `wall`→1→1, `door`→15→2, `counter`→17→3, `heal`→18→4, `pc`→19→5 |

The manifests are the only source of the frame numbers: `CITY_KIND_VALUES` /
`INTERIOR_KIND_VALUES` freeze the **kind → map value** table (the generators read
those, never a literal) and `FRLG_CITY_TILESET` / `FRLG_INTERIOR_TILESET` read the
frame for each value out of the committed JSON. Frame 0 is the field's own ground —
the city's plain pavement, which `resolveGroundFrame` lays under every cell, and the
interior's floor, which is the same tile a room's `FLOOR` cells draw.

Neither field declares an autotile, a wall pattern, variants, a rustle or a
hidden-item frame: **one frame per kind is the whole contract**, so a building's map
is a rectangular block of `WALL`/`ROOF` cells with a `DOOR` cell on its bottom row
and a room is a `WALL` ring around a `FLOOR` field with its fixtures on it. A
building's own outline comes from its whole-house decal (below), so the map's
rectangle is the collision footprint rather than the art. Every cell of both sheets is
a **filled field** (the crop composited over the ground), so a patch of map never
shows a hole.

A settlement's buildings are the third sheet of this family, and it is a **decal
atlas**, not a field: `src/assets/frlg/city-buildings.png` is 320x96 — four frames of
80x96, i.e. 5x6 tiles — with `src/data/frlg/city-buildings.json`, both written by
`scripts/frlg/build-city-buildings.mjs` from the buildings compendium
`sprite-sources/frlg/tileset-1.png`:

| frame | kind | source | door column |
| --- | --- | --- | --- |
| 0 | `centre` | the P.C. (red roof, `P.C.` sign) | 2 |
| 1 | `gym` | the green-roofed two-storey building | 2 |
| 2 | `lab` | the tan-roofed house with the arched door | 2 |
| 3 | `house` | the blue-roofed `SHOP` house | 2 |

The manifest is the only source of the frame numbers: `CITY_BUILDING_SPRITES` reads it,
`buildingFrameFor(kind, index)` answers the frames a kind carries (wrapped by `index`,
so a second house variant is one manifest row and one `HOUSES` row) and the first
house for a kind the sheet does not carry, and the plan's `CityBuilding.sprite` is one
of those indices. The packer crops each house whole — its own roof top to its front
wall's foot, centred so the house's door lands on its manifest column — keeps the
crop's own alpha, repairs the compendium's 1px transparent cell separators, scales
nearest-neighbour to the frame and refuses a flat crop (fewer than 3 opaque colours, or
more than 40 % near-black) the way `build-sign.mjs` does. The city screen draws one
frame per building over the plan's `rect` as a decal above the tile layer, sorted by
the house's foot row, so a player south of a house draws above it and one behind its
roof draws below (`docs/region-spec.md` §7.1, §7.5). The map values stay the rule:
the sprite never replaces a `WALL`, `ROOF` or `DOOR` cell, so collision and the flat
fallback a clone without the pack draws are untouched.

## 3. Autotiling

`autotileFrame` reads the 4-neighbour bitmask and returns one of 24 shapes:
interior, 4 edges, 4 convex corners, 4 inner (concave) corners, 4 diagonal-only
corners, 2 straights, 4 tees and the cross. Any tile that is *not* the rule's own
value counts as open, so a wall next to a chest still gets an edge.

`variantFrame` picks floor decoration from a stable positional hash, so the same
map always looks the same. A plain frame list draws each frame equally; an entry
may instead carry a `weight`, and the hash then falls in a range proportional to
the weights, so a ground can mix several tiles and make some rare (the forest
mixes its dark-ground tiles this way, `FRLG_FOREST_TILESET`). The hash is mixed
hard, so a rare tile scatters instead of lining up into a diagonal run.

## 3b. Wall patterns

A tileset can declare a `wallPattern` instead of shaping a wall with the autotile:
a whole `cols` x `rows` motif (`WallPattern` in `src/engine/tileset.ts`).
`patternFrame` anchors the **row phase** to the cell's own contiguous wall run, so
`rows[0]` is the run's top layer and the last row its foot. A run a lane detached
from the stack above or below therefore draws as a whole object - its top adds the
crown (`rows[0]`) when there is no tree above, and its bottom the base when there
is no tree below - instead of a mid-stack slice. `cleanWalls` guarantees the runs
are whole objects, so re-anchoring only ever adds the cap a run was missing. The
`cols` frames repeat across x, and the pattern **column** stays anchored to the
column's first wall cell, so a lane that bites the side below the top cannot slide
the run's columns aside.
A wall narrower than the motif is centred on it, so a one-tile hedge shows the
middle column of a tree and never a cut-off edge.

`RouteScene` resolves the frames against the route map itself (there is no frame
ring): the motif binds to the playable grid, so no pad can shift its columns. A
mass that reaches the map's top or bottom edge is a **window** into the forest
continuing past the limit: `patternCell` extends it two rows outward (one tree's
overlap) before reading the phase, so the edge is a mid-stack crown/body and the
motif is never cut into a crop there. A border piece too short for a whole object
(an opening's approach can leave a one-row stump) extends both ways, so it reads as
mid-stack instead of a lone trunk. An interior run is unchanged, so a detached tree
still shows its own crown and trunk. `patternCell` takes a `border` flag for this;
the scene and the dev frame map pass it, a bare motif call does not.

A wall cell that draws as the motif's **pure top row** (`rows[0]`, the crown over
open ground) is a **walkable tip**: `treeTipKeys` finds them (never a cell on the
one-tile border ring, which is the fence), and `RouteScene` walks on them (its
movement map turns them into floor) while drawing the crown **over** the player
(`TREE_TIP_DEPTH`), so the character passes behind the tree top.

A tip that is cardinally adjacent to a `TALL_GRASS` cell is a **grass tip**
(`grassTipKeys`): a patch packed against a tree can spill onto its crown. The
scene draws the grass frame **under** the crown on those cells (the crown is still
the frame over the player) and rolls a wild encounter when the player steps on
one, so a patch reads as running through the tree's edge.

The FRLG fields use it to draw the real FireRed tree, three columns wide, with six
frames: `rows[0]` the crown over open ground (the mass's top), `rows[1]` the tree's
own upper leaves, `rows[2]` the next tree's crown laid over the **lower leaves** of
the tree above, `rows[3]` a tree's upper leaves laid over the **trunk** of the tree
above, `rows[4]` the mass's lower leaves above the foot and `rows[5]` the trunk
platform. Because the crown lands on the lower-body row of the tree above and the
body row covers its trunk (instead of its lower leaves), the trunk stays hidden
inside the mass and only shows at the foot; the grass background is keyed out at
bake time (`D26`).

A wall's own ground is left **transparent** on the rows that sit against the
floor (the mass's top, its body row and its trunk platform), and `RouteScene` draws a floor frame
under every cell (`resolveGroundFrame`, `src/engine/tileFrames.ts`). The FRLG
fields resolve that ground to the plain floor frame, so the tree blends into a
uniform field; the lighter `FLOOR_ALT_*` frames are kept for the future route path
but are **not** used as a wall-edge decal (they read as a path). The PMD sheets
keep the per-shape `autotileFrame`, their wall-edge floor decals
(`wallAdjacentVariants`) and never declare a pattern.

## 4. Swapping

`src/data/tilesets/index.ts` is the registry:

```ts
TILESETS: Record<TilesetId, { id, name, atlasUrl, palette, config }>
```

`TILESET_IDS` is `['forest', 'city', 'interior']`: the forest is the only **biome**
(`BIOME_ORDER` stays `['forest']`), while `city` and `interior` are the region fields
of §2b. `BootScene` loads every id as a spritesheet under `tilesetTextureKey(id)`
(`tiles:forest`, `tiles:city`, `tiles:interior`) at its own `config.atlas.tileSize`,
so a new field is one registry row plus its sheet and its placeholder — no scene edit.
`packedAtlasUrl` falls back to `src/assets/placeholders/frlg/<id>.png` on a clone
without the pack, and each blank carries the real sheet's 64x208 size.

Swapping is `config = TILESETS[nextId].config` plus loading
`TILESETS[nextId].atlasUrl`; the route scene in the scaffold proves it with the
`R` key. Adding a biome is one entry plus its sheet.

## 5. Art provenance and the licence line

- `src/assets/tileset.png` is the **procedural placeholder** sheet: safe to ship.
- `wood.png`, `desert.png`, `apple-woods.png`, `lush-prairie.png`,
  `beach-cave.png` and `pokemon/*.png` are **rips of the Pokémon games**, brought
  in from the sibling project `pkm-mystery-dungeon-like` for local development,
  exactly as the user asked ("use the originals"). They are
  Nintendo/GameFreak/Chunsoft art and are **not** redistributable: `sprite-sources/`
  is gitignored and the processed crops must not be published. See
  `docs/art-direction.md`.
- `frlg/*.png` are the **FireRed/LeafGreen** field atlases
  (`scripts/frlg/build-tilesets.mjs` for the fields, `build-region-tilesets.mjs` for
  the city and the interior), composed from `sprite-sources/frlg/`; the
  UI sheets live beside them. Same licence line: local only, never redistributed.
- The `scripts/legacy-art/` pipeline (imported from the sibling project)
  regenerates the sheets and sprites from local source packs.

## 6. Pending art slots

- **Tall grass** draws a real FRLG frame now (`FRLG_TALL_GRASS`, frame 5): the
  field sheet's tufted grass ground, stamped **whole** with its ground baked in.
  The sheet carries one tuft per ground palette: source `7,0` on the light ground
  (outdoor) and `2,33` on the dark forest ground; the earlier `6,0` was a plain
  floor variant. The PMD-derived sheets still have
  no grass tile, so they keep the plain-ground fallback plus the procedural tuft
  overlay (`BootScene` builds it). `RouteScene` only draws that overlay when the
  tileset's `TALL_GRASS` frame is its floor frame.
  Walking into — or standing in — tall grass rustles **only the tile the player
  occupies**: one overlay sprite follows their feet, hidden the moment they step
  onto plain ground, so no other cell on the map ever moves. The FRLG fields carry
  that sprite's five cells in `grassRustle` (`FRLG_GRASS_RUSTLE_FRAMES`): the five
  stacked 16x16 frames of pret/pokefirered's `tall_grass.png` field effect, stamped
  **raw with their own alpha** — the sheet's frames 1-4 as cells 45-48 and its
  **settled frame (frame 4) as the parked cell 6**, which is the hit's own last frame,
  so the sprite parks on art byte-identical to `frames[4]` and the settle has no jump.
  So the overlay paints no ground of its own: the tile under it is untouched and the
  character shows through it, and because frame 4's alpha is empty until cell row 6 the
  parked overlay covers the player's **lower half** — 13.5 of their 28.5 visible px,
  from world y 153 down — while the cap, face, shoulders and upper torso stay clear.
  The sheet's blades-only rest frame (frame 0, empty until row 10, 7.5 px) is **not**
  used: it covers too little for the standing pose. The four hit frames keep the rip's
  transparent gaps; cell 45, the closing one, is opaque over its whole cell. The beat is
  ~70 ms a frame, played **once per step** on the player's own tile (never looping while
  they stand still). A tileset with no `grassRustle` keeps the procedural tuft.

  Those five cells are the **outdoor palette's** effect art, stamped the same for every
  field, so a field whose own tuft is a different palette declares a `grassRustleTint`
  that the route applies to the overlay sprite: the forest is the only one today
  (`0xC1D7EF`, the per-channel ratio of its dark tuft's mean `59,125,76` to the art's
  `78,148,81` — `59/78`, `125/148`, `76/81`). The route also **clips the overlay to
  the cell's rows 6-15** (`setCrop(0, 6, 16, 10)`, atlas branch only): the art's own
  first blade row is 6 on the parked cell but 0, 2 and 5 on the first three hit frames,
  so an unclipped closing frame would paint the whole cell — tinted, the ground itself
  over the player.
  Clipped, every frame of the beat draws the same 15 px band (world y 153 down, the
  player's lower half) and the cap, face, shoulders and upper torso stay clear. A tint
  multiplies colour and leaves alpha alone, so it reaches the blades only and the
  field's own ground still shows through their gaps; a tileset with no `grassRustle` —
  the PMD sheets' 24 px procedural tuft — takes neither the tint nor the crop. The beat,
  the parked cell and the cells' alpha are untouched.
- **Ledge** draws a three-tile run: frame 51 is the centre lip and frames `3`/`4`
  its end caps (`FRLG_LEDGE_LEFT`/`FRLG_LEDGE_RIGHT`, `LedgeFrames` in
  `src/engine/tileset.ts`); the FRLG fields stamp all three (`D26`), and the PMD
  sheets leave them transparent so a ledge falls back to plain ground. A dedicated
  PMD ledge tile is still open.
- **Obstacle seals** (`BUSH`, `ROCK`) draw real FRLG cells now, in the sheet's last
  two free slots: `FRLG_OBSTACLE_BUSH` (frame 49) from the tree bank's centre
  lower-leaves cell, source `4,36`, re-grounded onto the field's own floor; and
  `FRLG_OBSTACLE_ROCK` (frame 50) from the cave bank's boulder body, source `1,44`,
  keyed against the **cave** floor it is drawn on (source `2,24`) and composited over
  the field's floor. Both are whole cells, so a sealed vault reads as a solid object.
  The third obstacle kind, the pond, needs no cell of its own: a one-tile `WATER`
  cell's neighbours are all open, so the shipped `WATER` autotile rule resolves it to
  the interior frame 24 (`WATER_SHAPES.interior`). A tileset that ships its own
  obstacle art maps its own frames through `frames[BUSH]`/`frames[ROCK]`.
- **Hidden ground items** draw a concrete floor frame of the route's biome now,
  not a procedural glint: `TilesetConfig.hiddenItemFrame` names the patch a hidden
  item draws (the forest's is frame `41`, `FRAME_FLOOR_ALT_3`, the dark `5,34`
  ground), drawn at the atlas's own cell size and the same 24px world scale as the
  ground, at depth `5` over the floor and under the player. The item is still
  walkable and still picked up underfoot; only the ground frame tells it apart. The
  forest keeps that frame **out of** its natural ground mix (§2), so a hidden patch
  is ground that no other tile draws. A tileset that declares no `hiddenItemFrame`
  draws its plain floor frame (`hiddenItemFrame()` falls back to `frames[FLOOR]`,
  then `0`) and its hidden items are indistinguishable at rest: a biome opts in by
  stamping a patch. The procedural `route:sparkle` texture and its builder are
  gone, and Reduce flashing keeps only its battle and reset-scrim surfaces (`D45`).
- **Trainer sprites** do not exist yet in any imported set; they need their own
  sheet (walk cycles + overworld facing).
- **City and interior kinds** draw one real frame each (§2b), so nothing is pending
  per kind, and a settlement's buildings are whole houses now: the `city-buildings`
  decal atlas (§2b) puts one composed house per kind over the plan's 5x6 footprint,
  door art on the walkable `DOOR` cell. What is still open is the interior's furniture
  — a room's fixtures are single cells rather than multi-tile furniture — plus
  `autotile`/`wallPattern`/`variants` for the two fields, a `grassRustle` for the
  city's grass corner and a `hiddenItemFrame` for either. More house variants are one
  `HOUSES` row each in the packer, with no scene change.
- **The interior is provisional art, and the doc says so plainly.** The asset store
  has **no indoor tileset**: `docs/art-direction.md`'s FRLG inventory is terrain
  (`tileset-2.png`), buildings (`tileset.png`, `tileset-1.png`) and characters, and
  pret/pokefirered is not in the store. So `INTERIOR_CELLS` in
  `scripts/frlg/build-region-tilesets.mjs` composes the interior from the two sheets
  that do exist: the terrain sheet's wooden plank platform (source cell `20,12`)
  reads as the floor, and the buildings sheet supplies the plaster wall (`244,132`),
  a dark doorway (`171,104`), a wooden counter (`112,166`), a heal station (`180,125`)
  and a PC (`159,3`) from its props — the city's own kinds are terrain `7,0` (grass),
  `0,18` (path), `0,15` (plaza), `0,24` (ground) and `11,1` (water) plus buildings
  `56,212` (wall), `30,168` (roof), `40,209` (door) and `176,4` (sign). **When a real
  indoor rip arrives it replaces `INTERIOR_CELLS` in that one script and nothing
  else**: the manifests are regenerated from it, the kind table and the registry rows
  stay, and no tile kind changes.

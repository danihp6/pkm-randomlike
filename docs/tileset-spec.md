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
| 2 | `EXIT` | yes | route exits are floor positions for now (unused tile); no art yet (draws ground, §6) |
| 3 | `TRAP` | yes | hazard, cave-flavoured |
| 4 | `CHEST` | yes | loot |
| 5 | `ITEM` | yes | floor item |
| 6 | `WATER` | no | blocks movement only |
| 7 | `CARPET` | yes | interior floor |
| 8 | `TALL_GRASS` | yes | rolls a wild encounter |
| 9 | `LEDGE` | no | jump down only (movement rule, later) |

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
  (`overFill` keys its light sheet background and fills it with the floor). Each
  FRLG field picks that floor: outdoor `6,1` (`rgb(112,200,160)`), forest the darker
  `0,34` (`rgb(88,160,128)`, the tone the tree bank is drawn on) and cave the rock
  `2,24`. The forest floor is a **weighted mix** of its dark-ground tiles (`0,34`
  base, `2,34`, `3,34`, `5,34` and the rare flowered `0,38`; §3,
  `FRLG_FOREST_TILESET`), so the ground reads varied instead of one repeated tile.
- **common sheet** (`src/assets/common.png`): 5 cells of 24x24, shared by every
  biome, for the tiles that mean the same thing everywhere: trap, chest, item,
  carpet (and a stair slot that no map value maps to while the route `EXIT` art
  is deferred — the `EXIT` tile currently draws plain ground).

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
}
```

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
  (`scripts/frlg/build-tilesets.mjs`), composed from `sprite-sources/frlg/`; the
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
  used: it covers too little for the standing pose. Only cell 45, the closing frame, is
  opaque over the whole cell, for the one beat it is on screen; the three after it keep
  the rip's transparent gaps. The beat is ~70 ms a frame, played **once per step** on
  the player's own tile (never looping while they stand still). A tileset with no
  `grassRustle` keeps the procedural tuft.
- **Ledge** draws a three-tile run: frame 51 is the centre lip and frames `3`/`4`
  its end caps (`FRLG_LEDGE_LEFT`/`FRLG_LEDGE_RIGHT`, `LedgeFrames` in
  `src/engine/tileset.ts`); the FRLG fields stamp all three (`D26`), and the PMD
  sheets leave them transparent so a ledge falls back to plain ground. A dedicated
  PMD ledge tile is still open.
- **Trainer sprites** do not exist yet in any imported set; they need their own
  sheet (walk cycles + overworld facing).

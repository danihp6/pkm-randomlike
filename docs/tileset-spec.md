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
| 2 | `EXIT` | yes | ends the route |
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
  variant (`1`,`2`,`41`-`43`, beside the common stair/trap slot `3`-`6`) and draw
  the wall as a repeating whole-object motif on frames `7`-`18` (`wallPattern`,
  §3) instead of one frame per shape.
- **common sheet** (`src/assets/common.png`): 5 cells of 24x24, shared by every
  biome, for the tiles that mean the same thing everywhere: exit, trap, chest,
  item, carpet.

A tileset declares:

```ts
type TilesetConfig = {
  atlas: { tileSize, cols, rows, width, height }
  frames: Record<number, number>          // default frame per map value
  autotile?: AutotileRule[]               // neighbour-aware framing (walls, water)
  variants?: Record<number, number[]>      // deterministic per-tile variety
  wallAdjacentVariants?: Record<number, number[]>
  commonFrames?: Record<number, number>    // map values drawn from the common sheet
}
```

## 3. Autotiling

`autotileFrame` reads the 4-neighbour bitmask and returns one of 24 shapes:
interior, 4 edges, 4 convex corners, 4 inner (concave) corners, 4 diagonal-only
corners, 2 straights, 4 tees and the cross. Any tile that is *not* the rule's own
value counts as open, so a wall next to a chest still gets an edge.

`variantFrame` picks floor decoration from a stable positional hash, so the same
map always looks the same.

## 3b. Wall patterns

A tileset can declare a `wallPattern` instead of shaping a wall with the autotile:
a whole `cols` x `rows` motif (`WallPattern` in `src/engine/tileset.ts`).
`patternFrame` anchors it to the mass's top-left, so `rows[0]` is the mass's top
layer and the last row its base. In between, the object repeats every `rows - 1`
rows — the object's last row (its trunk) is overlapped by the next object's first
row (its crown), which is `rows[1]` baked solid. The `cols` frames repeat across
x. A wall narrower than the motif is centred on it, so a one-tile hedge shows the
middle column of a tree and never a cut-off edge.

The FRLG fields use it to draw the real FireRed tree: a 3x4 block (crown, two
canopy rows and the trunk platform) three columns wide, stacked vertically inside
a wall. The crown repeats every three rows so each tree overlaps the trunk of the
tree above, leaving a single trunk at the foot of the mass (`D26`). The PMD sheets
keep the per-shape `autotileFrame` and never declare a pattern.

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

- **Tall grass** has no dedicated frame: it draws plain ground today, with a
  procedural overlay sprite (`BootScene` builds it) so it reads while the real
  art is pending. It does not spend a third atlas row.
- **Ledge** now draws frame 51 (the sheet's last cell): the FRLG fields stamp
  their cliff lip there (`D26`), and the PMD sheets leave it transparent so a
  ledge falls back to plain ground. A dedicated PMD ledge tile is still open.
- **Trainer sprites** do not exist yet in any imported set; they need their own
  sheet (walk cycles + overworld facing).

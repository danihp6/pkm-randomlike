# `src/render/` — animation and geometry registries, and the objects built from them

The row/frame tables and pure selectors a scene needs to draw a sheet, plus the one builder that
turns a table into a Phaser object. A module here either **tabulates** — frames, keys,
measurements, no Phaser at all — or **builds a Phaser object from a scene and a table**, and
ships a co-located `*.test.ts` over its pure half; a table that describes a committed atlas is
pinned by a test that reads and measures that PNG, so a re-extract which shifts a row fails the
test instead of drawing the wrong art.

## Layout

- `moveFx.ts` — the move-effect registry (`D20`): one row per effect in
  `src/assets/moves.png`, the frame count per strip, and the archetype table that picks a
  strip from a move's type and flags. Its test decodes the committed atlas and checks the
  rows and frame counts.
- `playerAnim.ts` — the player's walk cycle per facing, framed through
  `src/data/playerSprite.ts` and keyed for Phaser's animation manager.
- `trainerAnim.ts` — the same for the trainer overworld sheets: one two-frame cycle per
  archetype and facing, framed through `src/data/overworldSprites.ts`.
- `pokemonFollower.ts` — the party follower's animation registry: a Pokémon overworld
  pair's manifest (`src/data/pokemonOverworld.ts`) becomes one looping idle and walk
  strip per facing the route draws, keyed for Phaser's animation manager. Running is
  the walk strip played with the player's own time scale (`D24`). The follower's own
  fit is `followerFit`: the pair drawn at `TILE_SIZE × overworldScale(speciesId)` with
  its feet on the tile's bottom edge.
- `spriteBounds.ts` — measures how much of a battle sheet is actually drawn and where its
  feet are, so a sprite can be zoomed and anchored by its feet; reads the pixels through a
  canvas and caches the result per texture key.
- `tilemapLayer.ts` — builds the two culled tile layers a map draws from the engine's frame
  meshes (the underlay and the tiles over it), their depths and their teardown; it resolves no
  frame, and its only Phaser import is a type one.
- `tilemapLayer.test.ts` — the pure half of that builder, the mesh → tile-data conversion: one
  row of indices per map row, `-1` kept as the empty cell, no rows for an empty mesh.

## Rules

1. A module here either tabulates — frames, keys or measurements, no Phaser at all — or it
   builds one Phaser object from a scene and a table (`tilemapLayer.ts` is the only builder,
   and imports Phaser by type only). A builder carries no game rule: what it draws is handed
   to it.
2. A frame table describing a committed atlas is pinned by a test that measures that atlas,
   not by a comment.
3. A new atlas or row means a new registry entry plus its test, and a line in the matching
   `docs/` spec (`D20` for move effects).
4. Geometry a hot path would recompute per frame is measured once and cached.

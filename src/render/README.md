# `src/render/` — animation and geometry registries

The row/frame tables and pure selectors a scene needs to draw a sheet. Each module holds its
asset's table plus the selectors over it, imports no Phaser, and ships a co-located
`*.test.ts`; a table that describes a committed atlas is pinned by a test that reads and
measures that PNG, so a re-extract which shifts a row fails the test instead of drawing the
wrong art.

## Layout

- `moveFx.ts` — the move-effect registry (`D20`): one row per effect in
  `src/assets/moves.png`, the frame count per strip, and the archetype table that picks a
  strip from a move's type and flags. Its test decodes the committed atlas and checks the
  rows and frame counts.
- `playerAnim.ts` — the player's walk cycle per facing, framed through
  `src/data/playerSprite.ts` and keyed for Phaser's animation manager.
- `trainerAnim.ts` — the same for the trainer overworld sheets: one two-frame cycle per
  archetype and facing, framed through `src/data/overworldSprites.ts`.
- `spriteBounds.ts` — measures how much of a battle sheet is actually drawn and where its
  feet are, so a sprite can be zoomed and anchored by its feet; reads the pixels through a
  canvas and caches the result per texture key.

## Rules

1. No Phaser import: a module here returns frames, keys or measurements, and the scene
   registers the animation.
2. A frame table describing a committed atlas is pinned by a test that measures that atlas,
   not by a comment.
3. A new atlas or row means a new registry entry plus its test, and a line in the matching
   `docs/` spec (`D20` for move effects).
4. Geometry a hot path would recompute per frame is measured once and cached.

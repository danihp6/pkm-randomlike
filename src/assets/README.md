# `src/assets/` — art contract

## Layout

| File / dir | What it is | Licence |
| --- | --- | --- |
| `tileset.png` | procedural placeholder biome sheet, 4x13 of 24px cells (96x312) | generated, safe |
| `common.png` | shared 5x1 sheet: exit, trap, chest, item, carpet | generated, safe |
| `wood.png`, `desert.png`, `apple-woods.png`, `lush-prairie.png`, `beach-cave.png` | real biome sheets, same 96x312 layout | **game rip, local only** |
| `pokemon/<id>.png` + `<id>.json` | overworld sheets (32x32 frames, 5 direction rows) + animation manifest | **game rip, local only** |
| `items.png`, `moves.png`, `hud.png` | battle/UI art for later phases | **game rip, local only** |
| `portraits.png` | PMDCollab faces, 40x40, 40-column grid, dex order (frame = `num-1`) | **game rip, local only** |
| `frlg/outdoor.png`, `frlg/forest.png`, `frlg/cave.png` | FRLG field atlases, 4x13 of 16px cells (64x208), from `scripts/frlg/build-tilesets.mjs` (config in `src/data/tilesets/frlg.ts`) | **game rip, local only** |
| `frlg/item-icons.png` | FRLG item icons, 24x24, packed by `scripts/frlg/build-item-icons.mjs` (frame map in `src/data/frlg/item-icons.json`) | **game rip, local only** |
| `frlg/window.png`, `frlg/textbox.png` | FRLG menu window + battle message box nine-slices, 4x, from `scripts/frlg/build-battle-ui.mjs` | **game rip, local only** |
| `frlg/hpbar.png`, `frlg/cursor.png` | FRLG HP bar (chip + empty track) and ▶ command cursor, 4x, from `scripts/frlg/build-battle-ui.mjs` (geometry in `src/data/frlg/battle-ui.json`) | **game rip, local only** |
| `frlg/font.png` | FRLG bitmap font atlas, 2x, from `scripts/frlg/build-font.mjs` (metrics in `src/data/frlg/font.json`, read by `src/ui/frlgFont.ts`) | **game rip, local only** |

Everything under "local only" is Nintendo/GameFreak/Chunsoft art imported from
the sibling project `pkm-mystery-dungeon-like` for development, per the project
owner's request. It must not be redistributed; `sprite-sources/` (the raw packs)
is gitignored. See `docs/art-direction.md`.

## Rules

1. Any biome sheet must satisfy the atlas contract in `docs/tileset-spec.md`,
   otherwise `resolveTileFrame` cannot draw it.
2. Regenerating sheets/sprites goes through `scripts/legacy-art/` (imported from
   the sibling project; paths inside still target that project and are adapted
   as each sheet is regenerated).
3. Adding a sheet means adding a registry entry in `src/data/tilesets/index.ts`.

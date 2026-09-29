# `src/assets/` — art contract

## Layout

| File / dir | What it is | Licence |
| --- | --- | --- |
| `tileset.png` | procedural placeholder biome sheet, 4x13 of 24px cells (96x312) | generated, safe |
| `common.png` | shared 5x1 sheet: exit, trap, chest, item, carpet | generated, safe |
| `wood.png`, `desert.png`, `apple-woods.png`, `lush-prairie.png`, `beach-cave.png` | real biome sheets, same 96x312 layout | **game rip, local only** |
| `pokemon/<id>.png` + `<id>.json` | overworld sheets (32x32 frames, 5 direction rows) + animation manifest | **game rip, local only** |
| `items.png`, `moves.png`, `hud.png`, `portraits.png` | battle/UI art for later phases | **game rip, local only** |

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

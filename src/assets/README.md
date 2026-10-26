# `src/assets/` — art contract

The tree is split in two halves. **Committed**: every generated atlas, every
manifest, and the blanks under `placeholders/`. **Gitignored**: the packed art
derived from the ripped sources, rebuilt locally with `npm run assets:pack`.
A clone without the private `pkrl-assets` store builds, boots and draws the
blanks; the ripped atlases never enter the repository or its history.

## Layout

| File / dir | What it is | Licence |
| --- | --- | --- |
| `tileset.png` | procedural placeholder biome sheet, 4x13 of 24px cells (96x312) | generated, safe |
| `common.png` | shared 5x1 sheet: exit, trap, chest, item, carpet | generated, safe |
| `placeholders/<same path>` | one blank of the real pixel size per ripped atlas, written by `scripts/assets/build-placeholders.mjs` (`npm run assets:placeholders`); `packedAtlasUrl` falls back to it when the real file is absent | generated, safe |
| `placeholders/audio/silence.wav` | the committed 0.05 s of silence every audio cue falls back to when the rip is absent (`PLACEHOLDER_AUDIO_URL`), so a clone without the store still boots | generated, safe |
| `optional.ts` | `packedAtlasUrl`: resolves an atlas from its `import.meta.glob` map, or returns the placeholder | source |
| `art.ts` | `hasArt`: whether a ripped atlas is present in this checkout, for the tests that measure art | source |
| `wood.png`, `desert.png`, `apple-woods.png`, `lush-prairie.png`, `beach-cave.png` | real biome sheets, same 96x312 layout | **game rip, gitignored** |
| `pokemon/<id>.png` + `<id>.json` | overworld sheets (32x32 frames, 5 direction rows) + animation manifest, one pair per species and per forme — `<id>` is the dex number, or `num * 100 + form index` for a forme (Castform-Sunny is `35101`); the `.png` is packed from PMDCollab by `scripts/legacy-art/extract-real-sprites.mjs`, the `.json` manifest is committed | **PNG: game rip, gitignored** · manifest: generated, safe |
| `pokemon/index.json` | the overworld **coverage manifest**: `files` maps a species id to the pair it draws and `missing` lists the ids PMDCollab has no art for, written by `scripts/legacy-art/build-pokemon-index.mjs` | **generated, safe** |
| `items.png`, `moves.png`, `hud.png` | battle/UI art for later phases | **game rip, gitignored** |
| `frlg/outdoor.png`, `frlg/forest.png`, `frlg/cave.png` | FRLG field atlases, 4x13 of 16px cells (64x208), from `scripts/frlg/build-tilesets.mjs` (config in `src/data/tilesets/frlg.ts`) | **game rip, gitignored** |
| `frlg/trainers.png` | FRLG battle trainer sprites, 64x64 per archetype, from `scripts/frlg/build-trainer-sprites.mjs` (frame map in `src/data/frlg/trainers.json`) | **game rip, gitignored** |
| `frlg/overworld.png` | FRLG overworld sprites, 16x32, one row of nine poses (idle + walk per down/up/side) per key — the ten trainer archetypes, the casino's `rocket` and the ten special NPCs `merchant`, `chef`, `magician`, `exorcist`, `weather-man`, `sacrifice`, `medic`, `iv-judge`, `berry-tree`, `ninja` (six borrow another class's art) — from `scripts/frlg/build-overworld-sprites.mjs`, which takes its source directory as an absolute path in argv or `PKM_FRLG_OVERWORLD_DIR` and has no in-repo default (frame map in `src/data/frlg/overworld.json`) | **game rip, gitignored** |
| `frlg/player.png` | FRLG player overworld sprite, nine 16x32 frames (idle + walk per down/up/side), from `scripts/frlg/build-player-sprite.mjs` (frame map in `src/data/frlg/player.json`) | **game rip, gitignored** |
| `frlg/item-icons.png` | FRLG item icons, 24x24, packed by `scripts/frlg/build-item-icons.mjs` (frame map in `src/data/frlg/item-icons.json`); superseded by `anil/item-icons.png` and no longer read by the game | **game rip, gitignored** |
| `anil/item-icons.png` | Añil item icons, one 24x24 frame each, 8 columns, packed by `scripts/anil/build-item-icons.mjs` from the fangame's 48x48 `Graphics/Items/` art (frame map in `src/data/anil/item-icons.json`, read by `src/data/itemIcons.ts`) | **game rip, gitignored** |
| `frlg/move-categories.png` | official move-category badges (physical / special / status), 32x14, packed by `scripts/frlg/build-category-icons.mjs` (frame map in `src/data/frlg/move-categories.json`, read by `src/data/moveCategoryIcons.ts`) | **game rip, gitignored** |
| `frlg/ground-item.png` | FRLG field Poke Ball (the ground-item sprite), 16x16, cropped from the store's `frlg/tileset.png` by `scripts/frlg/build-field-items.mjs` (read through `src/data/groundItemSprite.ts`) | **game rip, gitignored** |
| `frlg/sign.png` | FRLG field sign (the boss door's prop), one 16x16 cell cropped from the store's `frlg/tileset-2.png` by `scripts/frlg/build-sign.mjs` with its own alpha kept (read through `src/data/tilesets/props.ts`) | **game rip, gitignored** |
| `ui/window.png`, `ui/textbox.png` | the drawn UI chrome: the two glass-card nine-slices, 96x96 / 128x128, from `scripts/ui/build-chrome.mjs` (`npm run data:ui`); one `#10161f` surface at 0.72 / 0.80 under an 11px-cornered 1px hairline and a 1px shadow ring, and the outer shape and content insets are the FRLG frames' | **generated, safe** |
| `ui/font.png` | the drawn bitmap font atlas, 2x, from `scripts/ui/build-chrome.mjs` (metrics in `src/data/ui/font.json`, read by `src/ui/frlgFont.ts`); the FRLG glyph shapes with a half-alpha black halo | **generated, safe** |
| `frlg/window.png`, `frlg/textbox.png` | FRLG menu window + battle message box nine-slices, 4x, from `scripts/frlg/build-battle-ui.mjs`; superseded by `ui/window.png` + `ui/textbox.png` and no longer read by the game | **game rip, gitignored** |
| `frlg/hpbar.png`, `frlg/cursor.png` | FRLG HP bar (chip + empty track) and ▶ command cursor, 4x, from `scripts/frlg/build-battle-ui.mjs` (geometry in `src/data/frlg/battle-ui.json`) | **game rip, gitignored** |
| `frlg/font.png` | FRLG bitmap font atlas, 2x, from `scripts/frlg/build-font.mjs` (metrics in `src/data/frlg/font.json`); superseded by `ui/font.png` and no longer read by the game | **game rip, gitignored** |
| `audio/<cue-id>.wav` | one sound per cue id in `src/audio/cues.ts` (three music beds, the one-shot cues, the shared `hit`, one cue per move sound and per cry, 525 in all), 16-bit PCM mono WAV at the source's own rate, rendered from the FRLG soundtrack by `scripts/frlg/render-frlg-audio.mjs` and packed by `scripts/frlg/build-audio.mjs` | **game rip, gitignored** |
| `fonts/silkscreen-400.woff2` | Silkscreen Regular, the latin WOFF2 subset the DOM HUD self-hosts through `src/ui/hud/styles/root.css` (`D49`) | OFL, safe to commit |
| `fonts/silkscreen-700.woff2` | Silkscreen Bold, the latin WOFF2 subset of the same two `@font-face` blocks | OFL, safe to commit |
| `fonts/OFL.txt` | the SIL Open Font License 1.1 both Silkscreen faces ship under | OFL, safe to commit |

Every "game rip, gitignored" entry is Nintendo/GameFreak/Chunsoft art. It is
packed from the private `pkrl-assets` store (or a local `sprite-sources/`
checkout) and **must not be redistributed**: the paths are listed in
`.gitignore`, the repository ships only the generated blanks, and the history
carries neither. See `docs/art-direction.md`.

The **battle** Pokémon sprites are not here: they come from the fangame
Pokémon Añil, are served out of the gitignored `public/anil/` (one animated
filmstrip per species, front/back/icon plus shiny and female variants) and are
read through `src/data/anil/pokemon-sprites.json`. `scripts/anil/build-pokemon-sprites.mjs`
copies them in, portraits included. Same rule: game rip, gitignored.

## Packing

```
npm run assets:pack                        # ASSETS_ROOT, or ./sprite-sources
npm run assets:pack -- C:\path\to\store    # an explicit store root
```

`scripts/assets/pack.mjs` runs every packer in dependency order and passes each
one an absolute path inside the store (never a junction: `AGENTS.md`, "Asset
trees"). The overworld PMDCollab pairs (`pokemons/`) are the one optional tree:
they are public, so the store does not carry them, and a machine that needs them
re-downloads the set into it with
`node scripts/legacy-art/fetch-pmdcollab.mjs --table --missing --dest=<store>/pokemons`
before packing (the suites that measure them skip until it is there).
Eight atlases whose source sheets were never kept (`moves.png`, `items.png`,
`hud.png`, the five biome sheets) travel in the store's `prebuilt/` as the only
copy and are copied into place last. The outputs are the gitignored paths in the
table above, plus the generated manifests, which are committed.


## Rules

1. Any biome sheet must satisfy the atlas contract in `docs/tileset-spec.md`,
   otherwise `resolveTileFrame` cannot draw it.
2. Regenerating sheets/sprites goes through `scripts/legacy-art/` (imported from
   the sibling project; the overworld pipeline takes the sprite-source tree as an
   absolute `--dest`/`--source`, never a path inside the repo, and derives its
   work list from `src/data/dex/species.json` — see `docs/art-direction.md`).
3. `pokemon/index.json` is **generated**: regenerate it with
   `node scripts/legacy-art/build-pokemon-index.mjs` instead of editing it.
4. Adding a sheet means adding a registry entry in `src/data/tilesets/index.ts`.

# PokeRandomLike — Tech Decisions

Decision log. `D##` ids are cited from `TODO.md` and the specs. A decision is
`decided`, `open` or `superseded`.

## D1 — Engine & language: Phaser 3 + Vite + TypeScript *(decided)*

Phaser 3 on Vite + TS, reusing the workspace scaffolding (`slate-line`/`dustfall`):
same `package.json`, `tsconfig.json` (strict, `verbatimModuleSyntax`,
`noImplicitOverride`, `exactOptionalPropertyTypes`), `vite.config.ts` shape and
scene registration by array in `src/main.ts`. Considered and rejected: plain
Canvas 2D (what the donor project uses — less scene/UI/tween support), PixiJS
(no batteries for scenes/input).

## D2 — Pure logic in `src/engine`, no Phaser imports *(decided)*

The turn resolver, the route generator, the battle engine, the cost/odds models
and the tileset frame selection are plain TypeScript, verifiable headless with
Vitest co-located as `*.test.ts`. Phaser lives in `src/scenes/` and `src/render/`
only. Same split the donor project got right with `core/`+`generators/`, kept and
named `engine/`.

## D3 — Dex data generated at build time from `@pkmn/dex` *(decided)*

`npm run data:dex` writes `src/data/dex/*.json` (Gen 9, 911 playable species).
The package is a devDependency; the game reads committed JSON. Considered:
copies of the donor's `pokedex.json` (only 649, Gen 1–5, and its `moves.json`
carries Mystery Dungeon numbers, not turn-based ones), and PokeAPI at runtime
(network dependency, no).

## D4 — Battle: our own engine, extending what we copy from Showdown *(decided)*

We do **not** embed `@pkmn/sim`. Its model has no bag, run or capture, and its
battle loop is a black box; the glue would be as much work as the engine. We
write the flow (menu, order, switching, bag, run, capture, permadeath) and port
effect handlers category by category on the same hook names. See
`docs/showdown-reuse.md` for the split and the coverage plan.

## D5 — Permadeath is real *(decided)*

`0 HP = lost forever`. No Revive, no Pokémon Center resurrection, no box
recovery. Losing the whole party ends the run and nothing carries over.
Consequence: the run's economy must be able to *replace* a Pokémon, which is why
one capture per route is guaranteed.

## D6 — Routes: top-down tiles with tall grass and trainer sight *(decided)*

Classic overworld, not a Mystery Dungeon BSP cave. `TALL_GRASS` is the only
encounter tile; trainers have a facing and a sight line and trigger on sight.
The donor's `pathfinding.ts` and the tileset autotiling carry over unchanged; its
BSP `dungeon.ts` stays as a candidate for cave-flavoured routes. Addendum:
cave/dungeon layouts must read like the originals (Mt. Moon, Seafoam), so the BSP
cave is a base to reshape into that style, not the target look (see
`docs/routes-spec.md` §2). Addendum: the route draws the whole map at once, with
no fog of war or vision radius — like the originals, everything in the area is
visible from the start, so trainers and items are read off the map itself.

## D7 — Party of 6 plus a PC box *(decided)*

Six active, the rest in the box. Swapping is a battle command.

## D8 — Run structure: routes, mini-boss, boss, final boss, plus infinite mode *(decided)*

Finite chain by default with a mini-boss cadence, a boss closing each block and a
final boss; infinite mode reuses the generator without the finish line. Exact
cadences are data (`src/data/run.ts`), not code.

## D9 — Classic XP and levels, with a per-route cap *(decided)*

Pokémon gain XP, level up and evolve; the route's level cap clamps gain so the
next route is always a step up and grinding is impossible. Evolution blocked by
the cap waits.

## D10 — Tilesets are swappable per route *(decided)*

Map values are semantics; tilesets are art. `TilesetConfig` (biome sheet 4x13 of
24px cells + shared common sheet) plus `resolveTileFrame` is the whole contract.
Adding a biome is one registry entry and one sheet. The scaffold proves the swap
with a key press.

## D11 — Determinism: seeded runs *(decided)*

One seed per run. Map layout, encounter rolls, trainer rosters, loot and battle
randomness all come from `Rng` streams derived from it. Same seed + same inputs =
same run; there is a regression test whenever the RNG or a generator changes.

## D12 — UI language: English *(decided)*

Game text, docs, code and commit messages in English. (The donor's convention of
Spanish content names is dropped per this decision.)

## D13 — Backlog and changelog split *(decided)*

`TODO.md` holds only open/in-progress work (`[ ]` / `[~]`). Completed items move
to `CHANGELOG.md`, grouped by the phase they belonged to. Each phase in `TODO.md`
keeps a one-line pointer to the changelog.

## D14 — Reuse from `pkm-mystery-dungeon-like` *(decided)*

The donor project is the source for: the pure grid/FOV/pathfinding modules, the
tileset atlas contract and autotiling, the packed art (tilesets + 652 overworld
sprites), and the art pipeline scripts (`scripts/legacy-art/`). What does not
carry over: its Canvas renderer (we render in Phaser), its grid-based combat, its
non-permadeath save model, and its TypeScript style (we use the workspace's).

## D15 — No `src/core`; `src/engine` is the only logic root *(decided)*

The donor split logic across `core/`, `entities/` and `generators/`. We keep one
`src/engine/` with domain subfolders (`battle/`, `routes/`, `dex/`) so the "no
Phaser imports" rule is easy to enforce and to test.

## D16 — Effect coverage is tracked, never implied *(decided)*

Porting ~300 abilities and ~250 items is the bulk of "Gen 9 complete". Every
effect is `port`, `no-op` or `excluded` in `docs/balance/effect-coverage.md`, and
a dev build warns when a battle meets an unported effect. "Complete" means the
table says so, not that the list was copied.

## D17 — What randomness may touch *(decided)*

Stats, types and evolutions are fixed per species (dex data) and are never
rolled. Randomness is limited to what a run varies: a wild encounter's species
and level, a Pokémon's learnset/moveset and ability, and a trainer's team. One
run seed drives all of it through `Rng` streams.

## D18 — Tile size is a property of the tileset *(decided)*

`TilesetConfig` declares its own `tileSize` instead of relying on a global
constant: the PMD-derived atlases stay at 24px, while FireRed/LeafGreen atlases
use their native 16px. `BootScene` loads each biome sheet at its declared cell
size and `RouteScene` scales every cell by `TILE_SIZE / tileSize`, so the world
stays a single 24px grid: movement, overlays and the camera never learn the
sheet's size, and the shared 24px `common.png` sheet draws at 1:1 beside the
1.5x-upscaled FRLG fields. `TILE_SIZE = 24` remains the default for the configs
written before this change.

## D19 — Interface art is FireRed/LeafGreen *(decided)*

Menus, effects and HUD come from the FireRed/LeafGreen rips on spriters-resource
(`sprite-sources/frlg-ui/`, gitignored, never redistributed): window frames, the
HP-bar/in-battle-menu sheet, the bag/party/summary screens, type/status icons,
fonts and the battle FX sheets, plus the decomp-named 24x24 item icons
(`graphics/items/icons` in pret/pokefirered, the same art, so the id → icon map
is authoritative). Window chrome is packed as nine-slices
(`scripts/frlg/build-battle-ui.mjs`, `src/ui/frlg.ts`), and the same script bakes
the HP bar and the ▶ command cursor; the FRLG bitmap font is packed from
`latin_normal.png` + `charmap.txt` by `scripts/frlg/build-font.mjs` and rendered
through `src/ui/frlgFont.ts`. Item icons and their frame map likewise
(`scripts/frlg/build-item-icons.mjs`, `src/data/frlg/item-icons.json` via
`src/data/itemIcons.ts`). Provenance and the per-sheet credits live in
`docs/art-direction.md`. Consequence: the UI converges on the FRLG look — the
battle scene's HP panels, message box and command menu and the route HUD and
starter pick all use the FRLG windows and glyph set. Being a game rip, this keeps
O4 open for any public build.

## D20 — Battle presentation is archetype art, not per-move art *(decided)*

The battle scene's extra art is resolved by family, so content can grow without
new assets. The enemy platform of a trainer battle shows that archetype's 64x64
sprite from the packed FRLG sheet `src/assets/frlg/trainers.png` (frame from the
archetype's `battleSprite` through `src/data/trainerSprites.ts`), resolved from
`BattleLaunch.trigger.archetypeId`; a wild battle keeps the placeholder mon. Move
FX play by animation archetype (`src/render/moveFx.ts`: `moveFxFor` maps a move
to one of the six `moves.png` strips by its own id, type and flags), never one
strip per move; `BootScene` builds one Phaser animation per strip and the battle
plays it over the side that was hit. The capture beat is the classic throw/wobble
derived from the engine's `shakes`/`success` by `src/ui/capture.ts`. To resolve
this art from the same inputs the route used, `BattleLaunch` carries the run seed
and route index and the triggers carry the encounter `tile` and the trainer
`archetypeId`, so the battle still draws run-derived art without taking run state.

## D21 — A run is shared as a seed string *(decided)*

A run is reproduced by its seed and its mode and by nothing else, so those two
travel together as one token: `PKRL-1-<f|i>-<seed>`, e.g.
`PKRL-1-f-daily-2026-09-30` (`f` finite, `i` infinite). `src/engine/run/share.ts`
encodes and decodes it (`encodeRunShare` / `decodeRunShare`): the seed is
percent-encoded with `-` escaped so the fields stay separable, a string with no
`PKRL` prefix is taken as the seed itself with the mode the player picked, and a
prefixed string that is malformed (unknown version, unknown mode, missing or
broken seed) is rejected instead of silently starting a different run. The
starter screen shows the run's share string and `S` opens a prompt (a DOM overlay
in `src/ui/seedPrompt.ts`, like the dev debug menu) to type a seed or paste one;
the end-of-run screen reports the string beside the seed. The token carries no
progress, so a shared run starts from route 1.

## D22 — Player settings live in the save and change at once *(decided)*

`Settings` (`src/engine/save.ts`) is the part of the save that outlives a run —
text speed, master volume and the tileset preference — and it shares the versioned
document with the run, so `SAVE_VERSION` is 3 and `SAVE_MIGRATIONS[2]` adds the
tileset preference to a v2 document. `src/settings.ts` is the browser-facing
shim the scenes read and write through (the engine never touches storage).
`src/scenes/SettingsScene.ts` is the one editor: the starter screen and the route
HUD open it paused-on-top with `O`, up/down picks a row and left/right steps its
value, and every change is stored and applied immediately, so there is nothing to
confirm. Each setting is honoured for real: text speed drives the battle message
box's typewriter (`src/ui/typewriter.ts`, `TEXT_SPEED_MS`; a confirm tap or `Z`
held skips a line), volume is pushed into Phaser's sound manager at boot and on
change — the only audio knob until the sounds themselves ship in Phase 8 — and
the tileset preference is resolved per route by `resolveTileset` and re-rendered
when the route resumes. To let the engine validate the preference, the tileset
ids and their display names moved to the asset-free `src/data/tilesets/ids.ts`,
which the registry in `index.ts` builds on. Keybinds live beside them in the same
document and screen, but needed their own layer — see `D23`.

## D23 — One shared keybind map, captured in the settings screen *(decided)*

Every scene reads its confirm / cancel / move / party / settings key from one
map instead of hardcoding a key. The vocabulary is in `src/data/keybinds.ts`
(pure, no Phaser import, so the save can validate it): one key per action, the
defaults (`Z`/`X`/arrows/`P`/`O`), display labels, and the pure rules
`actionForKey` (explicit binding, then the always-on `Enter`/`Space` confirm and
`Esc` cancel aliases, so a rebind can never lock a player out of confirm),
`withBinding` (rebinding swaps with whichever action held the key, so no key is
ever ambiguous) and `sanitizeKeybinds` (repairs a hand-edited save). The Phaser
half is `src/input/` (`subscribeKeybinds`, `actionKeys`, `keyNameOf`): it listens
to the plugin's generic `keydown`, so the map is re-read per press and a rebind
applies at once, and auto-repeat is skipped (the two places that want held state
— the route's walk, the battle's hold-to-skip — poll `actionKeys`). The bindings
are part of `Settings`, so `SAVE_VERSION` is 4 and `SAVE_MIGRATIONS[3]` adds the
defaults to a v3 document. `SettingsScene` lists them as `keybind` rows beside
the `step` rows; selecting one and pressing confirm captures the next key (the
raw press, bound or not, so any key can be chosen), and cancel keeps the old one.
Keys that are not player actions stay on Phaser directly: the route's debug
tileset swap (`R`) and wild battle (`B`), and the starter screen's seed prompt
(`S`).

## D24 — Overworld trainer art is the FRLG class sprite *(decided)*

A trainer on the route draws its FireRed/LeafGreen overworld sprite instead of a
tinted placeholder. The ten archetypes' down-facing idle frames are packed from
the pret/pokefirered decomp's `graphics/object_events/pics/people/*.png` (each a
160x32 sheet of ten 16x32 walk frames) by
`scripts/frlg/build-overworld-sprites.mjs` into `src/assets/frlg/overworld.png`
plus `src/data/frlg/overworld.json`, resolved from the archetype's `spriteKey`
through `src/data/overworldSprites.ts`. The mapping is by class name, unlike the
battle `trainers.png` whose compilation grid is ordered arbitrarily; `psychic`
has no decomp class of its own and borrows the Channeler, and `ace` the male
Cooltrainer. The route draws the 16px frame at `TILE_SIZE / 16` with its feet on
the tile bottom, matching the FRLG fields (`D18`), and keeps the tinted facing
arrow. The player's own overworld sprite (`red_normal.png`) ships from the same
decomp via `scripts/frlg/build-player-sprite.mjs` — see `D25`.

## D25 — Player movement is hold-to-walk, with a run key *(decided)*

The route's player is the FireRed/LeafGreen protagonist, packed from the
pret/pokefirered decomp's `graphics/object_events/pics/people/red_normal.png`
(a 144x32 strip of nine 16x32 walk frames: the resting pose and the two-frame
cycle of each of down, up and the left-facing side) by
`scripts/frlg/build-player-sprite.mjs` into `src/assets/frlg/player.png` plus
`src/data/frlg/player.json`, read through `src/data/playerSprite.ts`. This
replaces the PMD `pokemon/25.png` overworld sprite. The right-facing side is the
left-facing frame flipped (`O1`).

Movement is grid-based but no longer one tile per key press: holding a direction
walks, one tile at a time, and the player slides between tiles over a fixed
duration (`WALK_STEP_MS`) while the direction's walk animation plays; releasing
shows the resting frame, and pushing into a wall turns the player in place. The
run action (a new keybind, `SHIFT` by default, rebindable in the settings
screen) shortens the step to `RUN_STEP_MS` and scales the walk animation's
`timeScale` to match, so running reuses the walking frames at a faster rate
exactly as the originals do, with no second sheet to ship. Encounters and
trainer sight are unaffected: a step still lands on one tile and runs the same
`onTileEntered` beat it always did.

## D26 — A route's layout follows its biome, measured off the real games *(decided)*

Route generation is no longer one generic blob for every biome. The shape comes
from a per-biome style in `src/engine/routes/layout.ts` (`route`, `forest`,
`cavern`), and the numbers behind each style come from the actual layouts in the
pret/pokefirered decomp (`data/layouts/*/map.bin`, the 10-bit metatile id + 2-bit
collision blocks): Route 1 is an open field (~38% blocked) cut by one-tile tree
hedges attached to the borders, Viridian Forest is a one-tile-corridor labyrinth
(~57% blocked) and Mt. Moon is two-tile rock corridors with wide chambers
(~40% blocked). `sketch.ts` has one carver per kind — `carveHedges` opens the
field and drops the hedges, `carveMaze` grows a depth-first grid maze with an
optional braid — joined by a shortest-path guard that keeps solid terrain
(water, ledges) off the one route through. The FRLG walls are drawn as the real
FireRed tree, a 3x4 block (`TilesetConfig.wallPattern`, `docs/tileset-spec.md`
§3b), rather than one frame per autotile shape. Its five-frame motif keeps the two
body rows distinct and repeats every three tiles, so the crown of each tree is
superimposed on the complete trunk row of the tree above — the crown's grass
background is keyed out at bake time so the trunk still shows — which is why a
wall reads as stacked complete trees instead of a flat stamp or a column of
trunks. The wall's ground is transparent where the tree meets the floor, and the
scene lays a floor frame under every cell (`resolveGroundFrame`), so the tree sits
on the field's plain floor frame instead of a baked flat colour. A route is now
larger than the camera view (56x32 tiles), so the camera follows the player and
scrolls; the scene renders a tree/rock margin past the playable edge (`padMap`,
three tiles on the sides and four top/bottom with the route's own border) and
bounds the camera to it, so the route border never shows the empty background. The map is drawn in
full — no fog of war or vision radius, like the originals (`D6`).
`docs/routes-spec.md` §2 holds the pipeline; adding a biome is a `layout` field
plus its tileset. **Addendum (current):** only the `forest` style is active —
`route` and `cavern` were removed for now — and it still carves the open field;
the `hedges` and `maze` carvers wait until the interiors come back.

## Open questions

- **O1 — Overworld art.** Battle trainer sprites (`D20`), trainer overworld
  sprites (`D24`) and the player overworld sprite with its walk/run cycle
  (`D25`) all shipped from the decomp. Still open: the unused
  `npc-overworld.png` and `player-sprites.png` compilations, and the remaining
  PMD art listed in `TODO.md`. Blocks Phase 8 cosmetics, not logic.
- **O2 — Battle arena framing.** Single-screen per battle (GB style) vs a
  floating HUD over the route. Cosmetic, blocks Phase 5.
- **O3 — EVs/IVs.** The data has IVs and EVs exist in Gen 9; do we let a caught
  Pokémon keep the dex's random IVs (more roguelike variance) or normalise IVs to
  31 and drop EVs entirely (purer balance)? Lean: random IVs, zero EVs.
- **O4 — Public build.** If the game ever ships, the imported Nintendo art must be
  replaced by CC0/placeholder art. Does that change the plan for `src/assets`?

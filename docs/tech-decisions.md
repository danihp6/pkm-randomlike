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

`npm run data:dex` writes `src/data/dex/*.json` (the full National Dex since
`D40`; 1281 entries).
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
the cap waits. The cap is now the map's (D29) and the bar is shared by the whole
squad (D35).

## D10 — Tilesets are swappable per route *(decided)*

Map values are semantics; tilesets are art. `TilesetConfig` (biome sheet 4x13 of
24px cells + shared common sheet) plus `resolveTileFrame` is the whole contract.
Adding a biome is one registry entry and one sheet. The scaffold proves the swap
with a key press.

## D11 — Determinism: seeded runs *(decided)*

One seed per run. Map layout, encounter rolls, trainer rosters, loot and battle
randomness all come from `Rng` streams derived from it. Same seed + same inputs =
same run; there is a regression test whenever the RNG or a generator changes.

### D11 — addendum: the seed fixes the draw, not the level *(decided)*

A **regular trainer's** level is no longer a value the seed fixes: it is a
function of the live squad level and the floor's cap (`trainerLevel`,
`src/data/trainerLevels.ts`, `docs/maps-spec.md` §5). The seed still fixes the
**draws** — the species picks, the variant rolls and the Mega Stone — so a
replay from the same save rebuilds the same team at the levels the squad has at
that moment. Two consequences are deliberate: replaying at a higher squad level
fields a stronger trainer, and a roster built with `levelFor` skips the level
draw, which shifts the draws after it in the same stream (a fixed seed's Mega
Stone pick changes, and only the first member's species is guaranteed to stay
put), while the shipped band draw — no `levelFor` — is untouched. The
twenty-fifth round's player-relative model.

### D11 — addendum: the seed fixes the wild level's draw, not the level *(decided)*

The route's encounter stream keeps **one level draw per encounter**: the draw
sequence and the species picks stay the seed's, and the level that draw yields is
`fraction × squadLevel` (`rollWildLevel`, `src/data/wildLevels.ts`), so a replay on
a stronger squad fields stronger wilds (`docs/routes-spec.md` §3/§5). The scene used
to pass `minLevel === maxLevel`, and `Rng.int` spent **no** draw there, so a fixed
seed's encounter sequence moves **once**, here: the fraction now takes the slot the
level draw would have occupied, and every later draw of that stream shifts with it.

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
effect is `port`, `no-op`, `excluded` or `removed` in
`docs/balance/effect-coverage.md`, and a dev build warns when a battle meets an
unported effect. `removed` records an effect the engine **deleted** because its
mechanic became data — the forme-changing abilities (`D41`) whose formes are now
evolution branches, variants at generation or hand-authored Megas — so a row never
claims a port for code that is gone. "Complete" means the table says so, not that
the list was copied.

A `port` is **evidence, never a flag**: the generator reads the registered
handlers, the ids `turn.ts` special-cases and the data fields the engine consumes,
so `flags.protect` — set on nearly every status move — does not count as a port
any more. The move half of the table is measured by
`src/engine/battle/moveAudit.ts`: `probeMove` runs one move against a clean
level-50 board and snapshots what changed, `MOVE_AUDIT_ROWS` holds one
Showdown-derived expectation per ported non-plain-damage move, and every row is a
test — so a move that goes off and does nothing is a visible `no-op` row and a
develop-build warning instead of a quiet assumption. A row the engine does not
satisfy yet carries `knownGap` and runs as `it.fails`, so a stale flag fails.

## D17 — What randomness may touch *(decided)*

Stats, types and evolutions are fixed per species (dex data) and are never
rolled. Randomness is limited to what a run varies: a wild encounter's species
and level, a Pokémon's learnset/moveset and ability, and a trainer's team. One
run seed drives all of it through `Rng` streams.

The random ability (`src/engine/battle/randomAbility.ts`, `randomAbility`) draws
only from the abilities the effect registry implements (`D16`: an unported
ability would be a dead no-op) and drops the formes it cannot model. Downside
abilities are kept on purpose — a worse ability is part of the random run — and
the one that would be dead on an arbitrary species is implemented generically
instead of excluded (Wonder Guard). **No Guard is never paired with an
OHKO move.** An evolution **re-rolls** the ability from the new species' pool
under the same run seed.

### D17 — addendum: the squad level may set a level *(decided)*

"A trainer's team" still covers what is rolled — species, variant forme, Mega
Stone — but the **level** of a regular trainer's roster leaves the list of things
randomness touches: each member is `floor(squadLevel × percent[size])` clamped to
the floor's cap, with 100 / 90 / 80 / 70 % for 1 / 2 / 3 / 4 members
(`trainerLevel`, `src/data/trainerLevels.ts`), so a trainer scales with the
player by construction instead of rolling across the map's range. The **boss**
and the **mini-boss** keep their hand-placed levels. Wild levels are the
addendum below. The twenty-fifth round.

### D17 — addendum: a wild level is a fraction of the squad level *(decided)*

A wild encounter's **level** leaves the list of things randomness touches: it is
`clamp(floor(squadLevel(run) × fraction), 1, cap)`, with `fraction ∈ [0.60, 0.75)`
drawn on the encounter stream (`WILD_LEVEL_FRACTION`, `wildLevel`,
`src/data/wildLevels.ts`) and `cap` the floor's `maxLevel`, so the seed fixes the
draw while the level follows the live squad (`docs/routes-spec.md` §3/§5,
`docs/maps-spec.md` §5). The **species** and **variant** draws stay rolled, and the
wild table's species window follows the band the squad's own level falls in
(`bandForLevel(squadLevel(run))`), not the floor's.

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
text speed, master volume, always run, the transparent-HUD flag and the HUD layout
— and it shares the versioned document with the run. `src/settings.ts` is the
browser-facing shim the scenes read and write through (the engine never touches
storage). `src/scenes/SettingsScene.ts` is the one editor: the starter screen and
the route HUD open it paused-on-top with `Tab`, up/down picks a row and left/right
steps its value (a click or touch drives it too), and every change is stored and
applied immediately, so there is nothing to confirm. Each setting is honoured for
real: text speed drives the battle message box's typewriter
(`src/ui/typewriter.ts`, `TEXT_SPEED_MS`; a confirm tap or `E` held skips a line),
volume is pushed into Phaser's sound manager at boot and on change — the only
audio knob until the sounds themselves ship in Phase 8 — and the transparent-HUD
flag redraws the panels when the route resumes. The tileset is **not** a setting:
a route always renders its biome's own (`D10`), so the tileset ids and their
display names live in the asset-free `src/data/tilesets/ids.ts`, which the
registry in `index.ts` builds on. Keybinds live beside them in the same document
and screen, but needed their own layer — see `D23`.

### D22 — addendum: the imported audio *(decided)*

The sounds are imported game rips, treated exactly like the imported art: the raw
sources live in the gitignored `sprite-sources/`, one rendered file per cue id
(`frlg-audio/<cue-id>.wav`), and only the derived `src/assets/audio/*.wav` is
committed, packed by `scripts/frlg/build-audio.mjs` (plain `node`, no
`package.json` script, no dependency). The rip is local-only and must never be
redistributed; a public build replaces it with a CC0 set by re-running the
packer, not by editing code.

`pret/pokefirered` ships the soundtrack as MIDI plus the instrument bank and
samples, not as audio, so a cue is produced by `scripts/frlg/render-frlg-audio.mjs`
— a sparse checkout of that decomp and the `huderlem/poryaaaa` m4a renderer, both
fetched into `sprite-sources/` — and a looping bed is cut down to its loop body so
the file Phaser loops is the song's own loop. A move sound takes its voicegroup
and master volume (`-G`/`-V`) from the decomp's own `sound/songs/midi/midi.cfg`.
The Pokémon cries need no renderer at all: they are already per-species samples
(`sound/direct_sound_samples/cries/*.wav`, 8-bit PCM at 10512 Hz) and are copied
in as they are. The renderer is the one external tool this pipeline needs; a CC0
set skips it entirely and just drops files in for the packer.

The seam is a **cue table** in `src/audio/cues.ts` (pure, no Phaser import): the
six hand-authored rows plus a shared `hit` and one cue per move sound and per cry
the decompilation carries — **525 rows**, the committed asset set, resolved in one
`import.meta.glob` because a computed asset path is not bundlable and 525 static
imports are not a table. Each row carries a `gain` that is a share of the master
volume. A cue id is the only name a scene uses — no scene names a file, a key or a
volume — and `src/audio/audio.ts` is the Phaser half: it preloads every cue and
owns the game's single music channel, switched by cue id (a scene on top takes the
bed over, the scene underneath takes it back when it resumes). `D22`'s master
volume stays the only audio knob; the per-cue `gain` is the only tunable beside it.

An **encounter plays the appearing Pokémon's cry** and a **hit plays the move's
own sound**, from two generated tables that a later task extends instead of the
table: `src/data/audio/cries.json` (species → cry cue, one row per species the
decompilation carries a sample for — `num` 1..386, matched by name, never by
`cry_tables.inc`'s internal species order) and `src/data/audio/moveSounds.json`
(move → the `SE_M_*` its own animation script plays, 295 moves). A move with no
sound of its own plays the shared `hit`, which is a second copy of
`se_m_comet_punch` — the impact the cartridge gives TACKLE — so the fallback never
moves when a move's mapping does. A species with no cry stays **silent**: a
stand-in would be a lie about an id the rip never had. The original's
`PokemonCrySong` replay, a cry's pitch/pan change and the effectiveness sounds are
deliberately **not** ported: the bare sample and one sound per move, no variants.

The two ripped families are the only ones normalized in the **packer**: the 131
MIDI-rendered move cues together and the 388 cries together, one gain each on the
packed 16-bit mono PCM, so each family's loudest cue sits at 0.85 of full scale.
The six hand rows keep the gain the render step applies over their own six files,
so re-rendering never moves their bytes, and a cue of a ripped family is real
audio or a hard error — the generated placeholder stays what it was, a stop-gap
for a hand row.

## D23 — One shared keybind map, captured in the settings screen *(decided)*

Every scene reads its confirm / cancel / move / interact / settings key from one
map instead of hardcoding a key. The vocabulary is in `src/data/keybinds.ts`
(pure, no Phaser import, so the save can validate it): one key per action except
the accept key `E`, which `confirm` and `interact` deliberately share so the same
press confirms a menu and picks up the item in front of the player; the defaults
(`E`/`Q`/arrows, the four HUD-panel keys `P`/`I`/`M`/`O` and `Tab` for settings),
display labels, and the pure rules
`actionForKey` (explicit binding, then the always-on `Enter`/`Space` confirm and
`Esc` cancel aliases, so a rebind can never lock a player out of confirm),
`withBinding` (rebinding swaps with whichever action held the key, so no key is
ever ambiguous) and `sanitizeKeybinds` (repairs a hand-edited save). The Phaser
half is `src/input/` (`subscribeKeybinds`, `actionKeys`, `keyNameOf`): it listens
to the plugin's generic `keydown`, so the map is re-read per press and a rebind
applies at once, and auto-repeat is skipped (the two places that want held state
— the route's walk, the battle's hold-to-skip — poll `actionKeys`). The bindings
are part of `Settings` (added by `SAVE_MIGRATIONS[3]` and reset by `[4]`; `[11]`
adds the four panel keys and hands the old `O` to `box`, so `settings` falls back
to `Tab`). The `party`/`bag`/`map`/`box` actions open the matching route HUD
panel, the keyboard twin of clicking its icon. `SettingsScene` lists them as
`keybind` rows beside
the `step` rows; selecting one and pressing confirm captures the next key (the
raw press, bound or not, so any key can be chosen), and cancel keeps the old one.
Keys that are not player actions stay on Phaser directly: the route's debug
tileset swap (`R`) and wild battle (`B`), and the starter screen's seed prompt
(`S`).

## D24 — Overworld trainer art is the FRLG class sprite *(decided)*

A trainer on the route draws its FireRed/LeafGreen overworld sprite instead of a
tinted placeholder. The ten archetypes' walk frames are packed from the
pret/pokefirered decomp's `graphics/object_events/pics/people/*.png` (each a
160x32 sheet of ten 16x32 frames: down/up/side idle plus a two-frame walk each,
then an ignored field-move pose) by `scripts/frlg/build-overworld-sprites.mjs`
into `src/assets/frlg/overworld.png` (one row of nine poses per archetype) plus
`src/data/frlg/overworld.json`, resolved from the archetype's `spriteKey`
through `src/data/overworldSprites.ts`. The mapping is by class name, unlike the
battle `trainers.png` whose compilation grid is ordered arbitrarily; `psychic`
has no decomp class of its own and borrows the Channeler, and `ace` the male
Cooltrainer. The route draws the 16px frame at `TILE_SIZE / 16` with its feet on
the tile bottom, matching the FRLG fields (`D18`): a standing trainer shows the
resting pose of its facing (the right side is the left-facing frame flipped) and
a spotted one plays its walk cycle as it steps toward the player. The player's
own overworld sprite (`red_normal.png`) ships from the same
decomp via `scripts/frlg/build-player-sprite.mjs` — see `D25`.

**Task-90 addendum.** The atlas is no longer trainer-only: after the ten archetype
rows it carries `rocket` (the slot machine's grunt, an NPC key since `Task-117`) and
the ten special-NPC keys
(`merchant`, `chef`, `magician`, `exorcist`, `weather-man`, `sacrifice`, `medic`,
`iv-judge`, `berry-tree`, `ninja`), so 21 rows of nine poses. A key the decomp has
no class for borrows the closest shipped sheet and the generated manifest's
`fallbacks` says which; `medic` and `ninja` read the decomp's own shorter strips
with its repetition map. The packer resolves its source directory from argv or
`PKM_FRLG_OVERWORLD_DIR` only — an absolute path outside the worktree — so no
repack can read a path inside the tree.

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
on the field's plain floor frame instead of a baked flat colour. A route is
larger than the camera view (its size now comes from the map plan, 30x30 up to
48x48 tiles, `docs/maps-spec.md` §1), so the camera follows the player and
scrolls; the scene renders a tree/rock margin past the playable edge (`padMap`,
three tiles on the sides and four top/bottom with the route's own border) and
bounds the camera to it, so the route border never shows the empty background. The map is drawn in
full — no fog of war or vision radius, like the originals (`D6`).
`docs/routes-spec.md` §2 holds the pipeline; adding a biome is a `layout` field
plus its tileset. **Addendum (current):** only the `forest` style is active —
`route` and `cavern` were removed for now. The open field was replaced by
**carving the shape's lanes out of a solid interior** (openings punched in the
one-tile border), with wide, chamber-ended branches; water is decoration now, not
a terrain pass, a room's size comes from the map plan (30x30 up to 48x48 tiles,
never the fixed 20x20), and the beyond-the-edge tree frame
(`padMap`) is parked while the generator is the focus. The `hedges` and `maze`
carvers wait until the interiors come back.

## D27 — Battle sprites are Pokemon Anil's animated sheets, served from `public/` *(decided)*

The battle front/back/icon art is the one the fangame **Pokemon Anil** (EricLostie)
uses: RPG Maker XP / Pokemon Essentials, Gen 5/DS style, animated. Its
`Graphics/Pokemon/{Front,Back,Front shiny,Back shiny,Icons}` sheets are
**horizontal filmstrips** — each frame is a square of the sheet's own height and
the count is `width / height`, the layout Anil's own *Pokemon Animados para DBK*
plugin reads — and they are 16-colour palette PNGs (~365 bytes a frame).
`scripts/anil/build-pokemon-sprites.mjs` copies them verbatim into `public/anil/`
and writes `src/data/anil/pokemon-sprites.json`; `src/data/pokemonSprites.ts`
resolves a species (+ shiny, + female) to a sheet and `BattleScene` loads just
the sheets a battle draws, plays one looping idle animation per sheet and drops
the textures again on shutdown.

Relative size does **not** come from the art. Essentials renders every battler at
one global zoom and lets the art carry the size, but the Anil set compresses the
real 0.1m-20m range into a narrow band — Regigigas is drawn barely taller than
Scatterbug — so scaling by the sheet (frame or drawn box) still left the titans
looking small. Instead each species carries a canonical `heightm` (PokeAPI, via
`scripts/fetch-heights.mjs` and `scripts/data/heights.json`, merged by
`build-dex.mjs`) and `BattleScene` sizes the sprite from it through the power
curve in `src/data/spriteSize.ts` (sqrt, so 200x of height becomes ~4x of pixels).
`src/render/spriteBounds.ts` measures each sheet's drawn box once per texture: the
box converts the target height into a zoom (an Anil frame is padded to the
animation's movement envelope, not the creature) and its bottom-centre anchors the
sprite's feet on the platform, so every size stands correctly.

Why not repack into an RGBA atlas like the old `build-pokemon-sprites.mjs` did:
the same art would inflate from ~169 MB to gigabytes (253k frames total), and a
fixed cell cannot hold per-species frame sizes anyway. Why `public/` and not
`src/assets/`: one bundled asset module per sheet pushed the entry chunk to
12 MB; 9,600 files are runtime-loaded, not imported. Why per-battle loading: the
full set is 169 MB and a battle needs a handful of sheets, so a boot-time load
is out. Shiny sheets are picked up when the fighter's `shiny` flag is set; the
flag rolls on its own encounter stream (1 in 4096), so it never shifts the
encounter sequence a fixed seed already produced (D11).

Local-only art, never redistributed; credits are in `docs/art-direction.md`.
Formes resolve to `<SPECIES>_<n>.png` when the Añil set lists `1..n` for that
species, with an explicit `FORM_OVERRIDE` table for the ones that do not line up
(the Alcremie grid, Arceus by type, the cap Pikachu, Minior, Ogerpon, Kyurem,
Vivillon's official Spanish pattern names...); an unmapped forme falls back to
its base species rather than drawing the wrong mon.

The **portraits** (party, HUD, starter cards, release beat) are packed by the
same script from the game's `Icons` folders into `public/anil/portraits.png` and
`portraits-shiny.png`: one 64x64 cell per dex entry in dex order, under half a
megabyte each, read through `src/data/portraits.ts`. A member's `shiny` flag
picks the shiny atlas.

## D28 — A map groups routes of one biome *(decided)*

The run's chain is now a chain of **maps**, and a map is a **graph of routes**
(rooms) laid out on a coarse grid — Binding of Isaac's floors with rooms. A map
owns the three things that used to be rolled per route: the **biome**, the
**level range** and the route **sizes**. So `biomeForRoute` and a per-route band
are replaced by one `MapPlan` per map index (`docs/maps-spec.md`). Consequence:
the same biome repeats across a map's rooms, which reads as one continuous floor,
and the run advances map to map. Refines D8 (the cadence now sits on top of the
maps) and D26 (the layout style is per map, not per route).

## D29 — Map composition is rolled from per-map ranges *(decided)*

Everything a map is comes from one `map` stream keyed `(seed, "map", mapIndex)`,
so a plan is a pure function of the seed and the map index (D11). The biome is
picked from `BIOME_ORDER`, **never repeating the previous map's**; the room count
and each room's **width and height** (rolled independently) come from inclusive
**ranges** in `src/data/maps.ts`; the size range **grows with the map index**, so
later floors are bigger, and `MAP_TUNING_STEP` keeps growing past the last tuned
row for infinite mode. Retuning a run is a data edit, never a generator edit. The
player's cap is the map's `maxLevel` (`levelCapForMap`), generalising the
per-route cap of D9.

### D29 — addendum: the cap is the only level anchor *(decided)*

Once a wild's level and a regular trainer's level both follow the **live squad**
(D11/D17 amended), a floor has exactly one level anchor left: its **cap**.
`MapTuning` therefore carries `cap` and no level range, and `levelCapForMap` reads
it. The floor's level **window** is **derived**, never stored:
`levelWindowForMap(m)` opens at the **previous floor's cap** and closes at this
floor's cap, and map 1 opens at the run's first band floor
(`LEVEL_BANDS[0].minLevel`) because it has no previous cap. `bandForMap`/`runBand`
keep their signature and their values — the band id still comes from
`bandForLevel(window.minLevel)` and `maxLevel` is still the cap — so a scene that
reads a band does not move. The per-room "working level" is deleted with no
replacement: the ramp it described exists only as the window, and the boss is
pinned to the cap by its caller.

## D30 — The map is a closed room graph on a grid *(decided)*

A map is a Binding of Isaac-style floor: rooms sit on a coarse **grid of cells**
and a door on one room's wall lines up with the neighbour's **opposite** door
(leave East → enter West). Each room is still played on its own screen (camera
follow); the grid lays out the graph and the minimap, not world space. The floor
is **connected** and **closed into at least one cycle**, and no opening dangles.
A room with a single `link` is the new **`dead-end`** shape (a leaf that holds the
usual trainers, items and grass). The shape follows from the room's opening set:
`dead-end` (1), `corridor` (2 opposite, the "pasillo", no branches), `bend` (2
adjacent), `tee` (3), `cross` (4) and the older branchy `straight`. The plan fixes
the openings; the route builder no longer rolls a shape on its own
(`docs/maps-spec.md` §2–§3).

### D30 — addendum: a floor tags each regular room's population role

A route's trainer count used to be emergent — one guard on the main lane, one per
filled pocket and the map-size tier's bonus, thinned per band — so a floor fielded
5-21 trainers and no floor had a designed composition. A floor now **tags each of
its regular rooms with a role**, `'trainers'` or `'wild'`: exactly
`trainerRoomsForMap(mapIndex)` of them are `'trainers'` (2 on map 1 rising to 4 on
maps 6-8, one more every two maps past the table up to 6) and every other room is
`'wild'`, while the entry, the boss and every special leaf are always `'wild'`. The
population pass places **1-2 trainers in a `trainers` room and none in a `wild`
one** (`TRAINERS_PER_ROOM`, `src/data/population.ts`), so the room's size no longer
changes the count. The role draws are **appended after the last special draw** of
the `map` stream, so a fixed seed's floor — biome, count, topology, ids, sizes and
specials — does not move; the pass reads `MapRoom.role` / `RoomView.role` and never
re-derives it (`docs/maps-spec.md` §2–§3, `docs/route-generator.md` §3.4).

## D31 — The map boss seals the exit and opens the portal *(decided)*

The **room farthest from the entry** (graph distance) fields the map's **boss**, a
fixed themed trainer at the map's `maxLevel`. Its onward opening is **sealed**
while the boss stands; once it falls a **portal** opens and stepping through it
advances to the next map (heal stop intact: HP/PP only, never a resurrection). A
finite run's last map holds the **final boss** and no portal, so clearing it wins
the run; infinite mode reopens the portal forever. This is the map's gate, on top
of the room cadence of D8.

## D32 — The route HUD shows the map with fog of discovery *(decided)*

The route HUD's header grows into a **minimap of the floor**, exactly the
Binding of Isaac minimap: a **grid of room cells**, each room drawn at its grid
position from its `size` and shape with its openings on the matching walls, the
current room highlighted, the boss room marked and the portal flagged. Rooms that
have not been **discovered** (entered) yet — and the links to them — stay hidden,
so the floor reveals itself as the run advances. The pure layout and the reveal
filter live in `src/ui/mapView.ts`; `RouteScene` only draws it
(`docs/maps-spec.md` §7).

## D33 — Special rooms and the Poké Dollar economy *(decided)*

Beyond its K regular rooms, a Binding of Isaac floor can hold **special rooms**:
extra `dead-end` leaves that carry **only their own content** — a guaranteed
**shop** near the entry (on every floor, map 1 included), a **mini-boss** room (medium chance) whose strong
trainer offers a **choice of items**, and a **mega-stone** room (low chance) that
hands out a random **Mega Stone**. They count outside K and are discovered on
entry like any room (`docs/maps-spec.md` §7).

Money is **Poké Dollars**, earned **only** by defeating trainers — a **fixed base
per trainer plus a random jitter** (data, per archetype/band) — and spent in the
shop; the run starts with none and the economy is tight, Binding of Isaac-style.
The shop is a **HUD panel that only exists in the shop room** (Pokémon Mart
style), opened at the counter with the interact key; it sells a fixed core of
Balls and Potions that improves with the map's band plus one or two random items
from the map's pool at the catalogue `price`, and buys any item at `sellPrice` —
but only the new **valuables** (Nugget, Big Nugget, Pearl, …) are worth real
money, so they are added to the ground-item loot pool. **Mega Stones** are new
`held` items, one per Mega-capable species, that allow a **Mega Evolution** in
battle (see `D34`). The run's money lives in `RunState` and shows in the route
HUD's bag panel.

## D34 — Mega Evolution is a battle mechanic *(decided)*

Mega Evolution is implemented in the battle engine before the mega-stone room
ships, so the stones do something. A Pokémon holding its **Mega Stone** may
**Mega Evolve once per battle** from a control in the command menu (both the
player and the AI can), changing its stats, type and ability to the Mega forme for
the rest of the battle. The formes are generated into `src/data/dex/megas.json`
beside `species.json` (they may be `isNonstandard: "Past"`, and a Mega whose base
species is not in the playable Gen 9 set is skipped rather than shipped as a dead
stone); each gets its stone in `src/data/items.ts`. Only **bosses, mini-bosses and
the `ace` archetype** carry stones, per their data.

## D35 — The squad shares one level and one XP bar *(decided)*

XP and level are **run-wide**, not per Pokémon: the party and the PC level
together off a single bar (`RunState.xp`, `squadLevel`). A catch joins the squad
at that level — its stats, moves and any allowed evolution are rebuilt from the
species at the shared level, whatever level the wild was. There is no per-member
XP field. The per-map cap (D9/D29) still clamps gain, so power comes from play.

## D36 — Technical Machines and the learnset panel *(decided)*

TMs are **items** in the bag's `machine` pocket, one per base-Gen-9 machine
(TM001 … TM171) and each tied to the move it teaches (`src/data/tms.ts`, the
`teaches` field). They are **reusable**: teaching never spends one, so a machine
is a permanent key to its move for any compatible species. Because `@pkmn/dex`
carries no numbered TM items, the number → move table is hand-authored from the
learnsets' `9M` flags and the move ids are validated against `moves.json`.

The detail window's MOVES tab is a **learnset panel**: the four slotted moves
over a search field and a full-width grid scrolled one row at a time, of
everything the member may equip — the learned level-up moves (from the run's
randomized learnset, D17) that
are not already in one of its four slots, and the moves a TM **in the bag** can
teach it. A pool cell is dragged onto a slot to equip it, replacing what sat
there; this goes through the pure `equipMove`, so a move the member already holds
is never offered and the slots never duplicate. A slotted move dragged back onto
the band is **unequipped** — the exact inverse, through the pure `unequipMove`:
the slot stays an empty container and the move returns to the band with its
`Lv##` / `TM###` tag. A member's **last remaining move cannot be removed**: the
save decoder, `validateCommand` and the FIGHT menu all assume a member holds at
least one. TM compatibility reads the
**canonical**
learnset, not the randomized one: D17's random TM slots name moves no machine
sells, so only the real machines gate the panel. TMs drop from route loot and
mini-boss rewards; a dedicated TM Machine and a real machine icon stay open.

## D37 — A move's shown type follows the ability and the battle context *(decided)*

The type badge a player sees is the **effective** type, not the dexed one. A
single pure rule (`src/engine/battle/moveType.ts`) handles the ability side —
the `-ate` abilities (Aerilate, Galvanize, Pixilate, Refrigerate), Liquid Voice
and Normalize — and is read by the FIGHT menu's preview, the party panel and the
damage calc. Moves whose type follows the battle situation register their own
`onModifyMoveType` move effect instead, so the same value reaches all three:
Weather Ball (weather), Terrain Pulse (terrain), Revelation Dance (the user's
primary type) and Aura Wheel (the Morpeko form). A **held item** hooks the same
path: the seventeen Plates ship and give Judgment their type (`item.plate`).
Multi-Attack (Memories), Techno Blast (Drives), Natural Gift (berries) and
Judgment's form-changing relatives wait for those moves/items to exist in a
future dex - Judgment stays Normal without a Plate. Hidden Power ships as a single
entry whose type is computed from the holder's IVs by `hiddenPowerType`
(`src/engine/battle/moveType.ts`): the battle publishes it through the
`hiddenpower` move effect (`src/engine/battle/effects/hiddenPower.ts`) and the
party panel reads the same function.

## D38 — Every evolution is a level evolution and the player clicks it *(decided)*

The dex's stone, trade, friendship and move evolutions are resolved to a level
(`evolutionBranches`, `src/data/dex/evolutions.ts`): a canon level evolution
keeps its level, the rest read their species' **BST band** — 20, 30 or 40 on the
same windows the run's own `LevelBand.bst` tiles (`EVOLUTION_BST_LEVELS`, `D39`,
`src/data/run.ts`) — floored at `EVOLUTION_MIN_GAP` (10) levels over the
**pre-evolution's own resolved level**, so the level a species was obtained at is
itself derived from the rule rather than only from a canon level-up (Horsea 32 →
Seadra 42). All of a species' branches share that level, so Eevee's eight forms
unlock together. Evolution is **manual** — a
member never evolves on level-up (`levelUpPokemon`) or on a catch
(`adoptAtLevel`) — the STATS tab draws the whole family as a graph
(`src/ui/evolutionGraph.ts`) and a click on a ready branch evolves the member
(`evolvePokemon`/`evolveMember`), keeping the level, nature, IVs/EVs, moves, PP,
status and held item and carrying the missing HP across. The graph shows the
pre-evolutions too, so a final form still reads its line.

The formes the deleted form-change abilities used to reach arrive this way too
(`D41`, reversed), as **branches instead of a battle-time change**: one row of the
override keyed by the species that promotes, `into` the promoted forme's own
species id, and all of a species' rows sharing its resolved level unless a row
carries an **authored** one — the sequential Zygarde and Terapagos stages and
Castform's three, whose promoted forme would otherwise read the wrong band. A
promoted forme that is stat-identical to its base is not an upgrade, so the four
of them are authored up in `scripts/build-dex.mjs`: Castform's Sun, Rain and Snow
forms gain 60 Sp. Atk (480) and Cherrim's Sunshine 30 Sp. Atk and 30 Sp. Def
(510), both inside the 441-800 band. The three species whose alternate forme is no
other species at all — **Eiscue, Morpeko and Minior** — stay **one pool entry**
whose individual is rolled from a hand-authored **variant family**
(`VARIANT_FORMES`) at generation, on its own sibling stream (`Rng.split`) at the
two sites that can meet them: the wild table (`rollEncounter`) and every trainer
roster (`trainerRoster`). One entry in the band, one forme per individual, and no
stream that already existed moves.

## D39 — Encounter and roster pools are BST windows per floor *(decided)*

The wild table and every trainer roster are **derived from the dex at runtime**,
not hand-authored: a pure `speciesPool(band, roster)` (`src/engine/run/pool.ts`)
filters `playableSpecies()` by the band's inclusive BST window (`LevelBand.bst`,
`src/data/run.ts`) and by the roster's ban list. The pool varies **only** by that
window and the bans — there is no per-biome or per-archetype theming any more;
`ENCOUNTER_TABLES` and the archetype `pools` are gone. The windows tile `0..800`
with a rough population split (~120-150 species each), so every spawnable species
lands in exactly one band and the union covers the whole dex.

- **Wild** bans the legendary and mythical tags (`Restricted Legendary`,
  `Sub-Legendary`, `Mythical`); the tall grass never spawns one.
- **Trainers** ban nothing, so a high-BST legendary or mythical appears in the
  bands its BST falls in, whichever archetype fields it.
- **Battle-only formes** (Gulp Missile, Hunger Switch, the Crowned/Terastal
  formes) never appear in either pool; they only exist inside a fight. A species
  whose alternate forme is a hand-authored **variant family** is one pool entry
  all the same, and the roll picks which forme the individual is generated as
  (`D38`) — the forme is reached by the roll, never by a second pool row.
- A **boss** (map boss and mini-boss) fields the **upper half** of its band's
  window (`bossBstWindow`), one step above the floor's regular trainers.
- Coverage is a test (`src/engine/run/pool.test.ts`): the wild union is every
  spawnable species minus the banned tags, the trainer union every spawnable
  species. Past the last band (an infinite run's deeper floors) the window stays
  `end`: its BST saturates at the top of the dex.

## D40 — The game ships the full National Dex *(decided)*

`build-dex.mjs` no longer keeps only the Gen 9 standard set: the playable
`species.json` is the **whole National Dex** — every numbered species, the
`Past` Dexit entries included — 1281 entries across all 1025 dex numbers, with
89 Megas generated beside it. Only non-species are dropped at generation time:
CAP/fan entries, `Custom` (MissingNo, Pokéstar), LGPE's partner starters (no
art), the battle-only Gigantamax/Eternamax formes, and the nine `Future` formes
whose entry names a Mega (`Mega-Z`, `M-Mega`, `F-Mega`, `Original-Mega` and the
three Tatsugiri): a stone's target, never a grass spawn, and no fit for
`megas.json` because three of them share a stone its one-stone guard rejects.
**Greninja-Ash** is the one hand-authored row of `megas.json` (89th): the dex
leaves `isMega` unset on it and marks it `battleOnly: "Greninja-Bond"` instead, so
`isPlayable` keeps it out of `species.json` by id and the generator builds the row
itself, stone and all.

Two learnset rules keep a Dexit species playable: a species with no gen-8
source falls back to its own newest learnset, and a forme without one inherits
its base species'. A species that somehow ends up with no move at all falls back
to Tackle in `defaultMoveset` (Unown keeps Hidden Power, which ships as of
`D42`). This is what gives the hand-authored branches a real target (`D38`):
forms like Wishiwashi-School, Darmanitan-Zen, Aegislash-Blade and Castform-Sunny
now exist in the dex. It changes what the wild, the trainers, the starters and
the battle art (`npm run data:anil`) can meet.

## D41 — Form-change abilities are gone; their formes became data *(decided, reversed)*

The twelve abilities whose whole job was to change their holder into another forme
— **Battle Bond, Disguise, Flower Gift, Forecast, Hunger Switch, Schooling,
Shields Down, Stance Change, Tera Shift, Zen Mode, Zen Mode (Galar)** and **Zero
to Hero** — were **deleted** from `src/engine/battle/effects/abilities.ts` and
from the registry, and the formes they used to reach are content now: a
hand-authored evolution branch (`FORM_EVOLUTIONS`, `D38`), a variant family rolled
at generation (Eiscue, Morpeko, Minior) or the hand-authored second Greninja Mega
in `megas.json` (Greninja-Ash). Their rows in
`docs/balance/effect-coverage.md` read **`removed`** (`D16`), so the table never
claims a port for code that is gone, and `randomAbility`'s pool — derived from the
registry — loses them with no code change.

This **reverses** the rule as it was written: any holder used to change forme
mid-battle from level 20 on through `changeBattleForm`/`restoreBattleForm`. A
forme is now something a member **is**, decided when the individual is generated,
so nothing changes shape inside a fight. `changeBattleForm` /
`restoreBattleForm` stay — **Mega Evolution** (`D34`) and **Gigantamax** (`D44`)
still call them — and **Ice Face** stays ported: in this tree it is a one-hit
shield volatile, not a forme change. `TRACE_BANNED` keeps naming the twelve (a
no-op ability is inert) and the dex's own ability slots are untouched (`D17`: a
run re-rolls the ability anyway).

## D42 — The game ships the full move set *(decided)*

`build-dex.mjs` now generates every real move, the `Past` ones included, so a
Dexit species keeps its learnset: `moves.json` grows from 685 to **835**. Dropped
are the Dynamax (Max) and Z moves (the engine models neither) and the
CAP/Future/Unobtainable entries. Hidden Power's 17 typings all share the id
`hiddenpower`; the engine keys moves by id, so only the single Normal-typed entry
ships, and its type is now derived from the holder's IVs at battle time. A move
with no ported effect still resolves its base damage generically; an unported
status move is a dev-warned no-op.

## D43 — Game text is keyed: English is the source table, a locale overlays it *(decided)*

No player-facing string is a literal any more. `src/i18n/` is a pure module:
**`en.ts` is the source table** (the one place an English string is written, flat and
dotted, grouped by the surface it is drawn on) and **`es.ts` overlays it by key**, typed
as `Record<TranslationKey, string>` so a missing Spanish line is a compile error.
`t(key, params)` resolves the current locale's entry (falling back to `en[key]`,
unreachable while the parity test holds) and replaces every `{token}` with
`String(params[token])`; **a token with no param throws** (`i18n: missing param "…" for
key "…"`), because a silent `{name}` on screen is worse than a loud test failure. Extra
params are ignored and a number param is stringified.

The module is a **leaf**: no Phaser, no DOM, no `localStorage`, no `navigator`, no `Rng`,
no clock, and no import from `src/engine/`, `src/data/` or `src/scenes/`, so the tables
are testable headless. **The browser's language tag is an argument**: `detectLocale(tag)`
lowercases it, takes the part before the first `-` or `_`, and returns `es` only when
that primary subtag is exactly `es` — `es-ES`, `es` and `ES-mx` are Spanish; `en-GB`,
`fr-FR` and `ca-ES` are the source table. The module's initial locale is `en`, so a test
that never calls `setLocale` reads English. This **refines `D12`**: docs, code,
identifiers, commit messages and the changelog stay English, and English is now also the
game text's *source* table rather than its only language.

**The setting: `Settings.language`**, beside `alwaysRun`. It is read per field in
`parseSettings` (`isLocale(value.language) ? value.language : base.language`), so a
document with no such key reads the default `en`: **no `SAVE_VERSION` bump and no
migration step** (the `D22`/`D45`/`D46` precedent; the version stays **16**). It is the
one setting defaulted from the browser, and only `src/settings.ts` — the browser-facing
shim — reads `navigator.language` and feeds the pure `detectLocale`. When the save
carries no language the shim **stores what it detected** (`storeSettings`), so the first
`storeRun` of the run cannot freeze the source table into a Spanish player's save;
`storedSettingsLanguage` (in `src/engine/save.ts`) is what tells "the player chose `en`"
from "nothing was ever chosen", which the decoded settings cannot. `loadSettings` and
`saveSettings` both apply the locale, so a switch needs **no restart and no scene-level
boot hook**, and the row is the **last step row** of `src/ui/settingsScreen.ts` (after
difficulty, so every shipped index keeps its order), naming each language in its own
language (`English` / `Español`) so the picker reads from either side.

**The boundary.** The dex's own names stay English in every locale: Pokémon, move,
ability and item names, the biome names and the trainer classes come from `@pkmn/dex` and
`src/data/**`, which ship English only — they are *content*, not chrome, and localising
them is a separate and much larger job.

**Items join moves and abilities** (`Task-209`). An **item description** is
content-localised: `itemText` (`src/i18n/content.ts`) reads
`src/data/i18n/es/items.json`, a **hand-authored** table of item id → Spanish body, and
falls back to the catalogue's English `shortDesc` when it has no row (`''` for an id the
catalogue does not know). Item **names** stay English, as the boundary above says. Every
`ball`, `heal` and `status` row of `src/data/items.ts` must carry one — those are the
stacks a run hands the player — while the held-item and valuable prose stays English until
a generated table exists.

The **engine's battle log is keyed too**
(`Task-114`): a text event carries a `battle.log.*` key and the params it interpolates,
never a sentence, and `src/ui/feed.ts` resolves it through `t()` at the moment it builds
the frame the battle scene prints. The engine therefore stays headless and
language-free, a fixed seed logs the same keys in every language, and the action log
follows the locale like the rest of the chrome. Exactly three params are ids a table
owns — `move` through `src/i18n/content.ts`, `ability` through `abilityNameFromEnglish`,
`item` through `src/data/items.ts` — and every other one is inserted verbatim, species,
type and side names included. `src/engine/battle/golden.test.ts` pins the **keys** it
prints byte for byte.

**The font constraint.** A key's text may only use characters the FRLG bitmap font can
draw (`src/data/ui/font.json`, `D19`): Latin-1 letters and accents (á/é/í/ó/ú/ü/ñ, `¿`,
`¡`), `·` (U+00B7), `…`, the curly quotes, the arrows and `▶`, `¥`, `♀`/`♂`. The atlas
carries **no em dash (U+2014)**, so Spanish copy never uses one — `·`, `:` or `,`
instead, and the test enforces it over `es` (`index.test.ts`). The same test pins the
width guards the geometry depends on: three-character status chips, six-character pocket
tabs, seven-character stat labels and battle commands.

**Considered:** an embedded locale library (a table plus one `t` is a few lines, and a
dependency is not worth it) and a per-scene string map (it drifts: two scenes would spell
the same sentence twice and nothing would notice).

## D44 — Gigantamax is a battle mechanic in the Mega mould *(decided)*

Gigantamax exists with the shape Mega Evolution already has (`D34`,
`src/engine/battle/gmax.ts`). A Pokémon **that holds the G-Max Stone of its own
species** may **Gigantamax once per battle** from a control in the battle's MOVES
window (both the player and the AI can), before any move; the stone is the gate
`canGigantamax` reads, exactly as a Mega Stone is for a Mega (`D34`), and it is
**never spent on use** — the holder keeps it and may Gigantamax again next battle.
Taking its G-Max forme changes its **name and species/sprite** while **keeping its
stats, types, ability, moves and held item**, and the **HP pool doubles** (`× 2`,
the current HP included, so the HP fraction holds). It lasts the whole battle — a
switch-out does not end it — and everything reverts when the battle ends, before
the run snapshot, so no doubled pool (a captured wild included) ever reaches the
run. Gigantamax and Mega Evolution are **mutually exclusive per Pokémon per
battle**, and the mechanic draws **no RNG at all**: it is deterministic, so a fixed
seed's battle log is unchanged.

The formes are generated into `src/data/dex/gmaxes.json` beside `megas.json`: one row
per dex `…-Gmax` entry (the name filter `isBattleBossForm` already uses) whose base
species is playable, each carrying the exact `changesFrom` as `baseSpeciesId` and,
beside it, the **G-Max Stone** that formes it — `stoneId` and `stoneName`, one per
forme, named `<the base's Mega-style name> G` (`Venusaurite G`, `venusauriteg`). So
`gmaxFormForBase(id)` resolves one forme per species, and `gmaxFormForItem(id)` /
`gmaxMatchesSpecies(stoneId, speciesId)` resolve a held stone to its forme. **Max /
G-Max moves are not modelled** (`D42`): a G-Max forme keeps its normal moves, with no
damage bonus and no Dynamax timer. `Eternatus-Eternamax` is **not** a Gigantamax
forme — its name ends in `-Eternamax`, not `Gmax` — so it is in neither generated
file and Eternatus cannot Gigantamax in this game.

Each stone is a catalogue row minted beside `MEGA_STONES` (`src/data/items.ts`):
**34 `held` rows at 8 000** Poké Dollars (resale 4 000, half like every held good),
which makes a stone the counter's single biggest purchase and a real sink. A stone is
**obtainable twice over**, at the same two bands: one on the Mart's shelf at `late`
and `end` (`SHOP_GMAX_STONE_BANDS`, drawn from all 34, `GMAX_STONE_PRICE`) and four
ids at `late` / six at `end` on the ground (`GMAX_STONE_LOOT`, weight 1 each). It
takes the Hard Stone icon, exactly as a Mega Stone whose Añil spelling does not match
does.

## D45 — Accessibility: hue is never the only carrier, and one reduced-flash knob *(decided)*

The game carries a written accessibility contract, in `docs/design-spec.md` §10.
Two rules hold it up. **First: colour is never the only carrier.** Wherever a
state is told apart by hue, a second, non-colour carrier tells it apart too — a
shape, a stroke width, a mark or a printed value. The audit found five hue-only
readings and fixed each at a named seam: a spent trainer ball now carries a 2-px
dark slash as well as its dim tint (`BattleScene.drawFoeBallRow`); `tox` takes the
abbreviation chip and prints `TOX`, because `src/data/statusIcons.ts` maps `psn`
and `tox` onto the **same** art (`BattleScene.drawSidePanel`); the battle's FIGHT
window draws the FRLG ▶ on the selected cell, as the command and switch grids
already did (`BattleScene.renderMoveMenu`); the active bag pocket carries a 2-px
dark underline beside its fill inversion (`BattleScene.renderBagMenu`); and a
disabled move cell keeps its `0.4` alpha but gains a 3-px dark stroke
(`src/ui/moveGrid.ts`). **Type badges are adequate as they stand**: every type that
rides on a hue carries an Añil badge with it (both battle panels, both move
windows, the move info popup) and the move cell's tinted background always has one
of those badges inside it — no change. **Second: HP is readable without colour**
(`docs/design-spec.md` §10.2): the player's panel keeps its `hp/maxHp` numbers and
a living Pokémon at or below `LOW_HP_FRACTION` (`0.2`, `src/ui/metrics.ts`) has its
bar's fill cut into `HP_CUE_BLOCKS` (`4`) blocks by 2-px `FRLG_INK` notches
(`hpCueNotches`), with the two big battle panels as the only surface that gets it.
The cue is a pure function of the fraction — it reads no RNG, no run and no battle
state.

**One knob, and only one: `settings.reducedFlash`** (`DEFAULT_REDUCED_FLASH`,
off). It drops the full-screen camera flash a Mega Evolution / Gigantamax beat
would play (`BattleScene.playMega` / `playGmax` keep their sprite fade-in) and
releases the hold-to-reset scrim at once instead of `RESET_FADE_IN_MS`
(`RouteScene.fadeResetOverlayIn`). It no longer owns a route surface: a hidden
ground item used to be a pulsing sprite, and it is now the biome's own floor
frame (`hiddenItemFrame`, `docs/tileset-spec.md` §6), with nothing to flash. It
is a `Settings` boolean
read per field in `parseSettings`, so a save with no such key simply reads `false`:
**no `SAVE_VERSION` bump and no migration step** (the `D22` precedent). It draws
**no RNG** and touches no generator, so every fixed seed still reproduces. A second
knob (per-beat speed, a full motion-reduction mode, colour-blind palettes,
subtitles, i18n of the new strings) is deliberately **not** built here.

**The route HUD is pointer-first** (the human's inversion: *the movement keys never
browse a pane*). The keyboard model adds no keybind action — `src/data/keybinds.ts`
is byte-identical — and the four panel quick keys (`party` / `bag` / `map` / `box`)
are plain toggles that expand or collapse their panel exactly as a click on its
collapse icon does; they never hand a pane the keyboard, so the arrows keep walking
the character from the first frame and a second press on an open panel hides it
instead of "leaving" a cursor. Every route-HUD operation is reached with the
pointer: the party and box rows (click opens the detail, drag reorders, a drag
across the two panes deposits or withdraws), the party header's Pokevial, the PC
box cells and page tabs, the bag's stacks and pocket tabs, the detail's STATS/MOVES
tabs, nickname field, ability ⓘ, evolution branches, search field and move slots,
and the learnset pool's scroll and drag-onto-a-slot equip. The **pause menu is the
one keyboard surface the route keeps** (`cancel`, arrows, `confirm`); the Mart, the
mini-boss reward and a focused text field (nickname, search) keep their own keys
until a later task moves those two windows to pointer-first floating panels, and
the release overlay / level-up popup keep `confirm`. Every other screen — the
battle, the main and starter menus, the settings and the run-over screen — stays
fully keyboard playable, and the hue / flashing rules above are untouched.

## D46 — Enemy AI: the cartridge's script flags, and one difficulty knob *(decided)*

The enemy used to think with one hard-coded scorer. It now thinks with the
cartridge's **own AI script flags**, read as **data** off the trainer archetype
(`TrainerArchetype.aiFlags`, `src/data/trainers.ts`), scored as expected value in
`src/engine/battle/ai.ts`. The six flags are `checkBadMove`, `tryToFaint`,
`checkViability`, `setupFirstTurn`, `risky` and `preferBatonPass`; the archetype
ladder is early classes → `checkBadMove` only, the middle classes →
`+checkViability`, `psychic` → `+tryToFaint`, `blackbelt` → `+risky`, and `ace` —
therefore **every boss and mini-boss**, which are the `ace` archetype — all six. A
flag's bonuses (the `+1000` faint, the 60/40/50/25 status rungs, the `+80` and
`+60`) stay where they were, in `ai.ts`: the per-archetype *flags* are the knob a
later balance sheet should move. `docs/battle-spec.md` §11 is the write-up.

**A wild Pokémon stops out-thinking an Ace.** At the default difficulty it picks a
**random move that still has PP**, exactly as the cartridge does, so `chooseAiCommand`
takes the wild branch for `state.isWild` on the enemy side at `normal`. Trainers keep
the scored policy. A trainer that is **trapped** never switches, whatever the score,
and an active that cannot hurt the foe switches to a reserve that can; the Emerald
bench-absorption rules are **not** implemented because no ability-versus-type table
exists here. The enemy's **items** are equally out of scope: `validateBag` refuses
every side but the player, so the cartridge's item AI (Full Restores, X items) is
not built — the only item the AI spends is the Mega Stone (`D34`), through the
shipped `canMegaEvolve` arming. The two difficulties differ in **flag set, wild
policy and tie-break, and in nothing else**.

**One discrete, visible knob: `settings.aiLevel`** (`DEFAULT_AI_LEVEL`, `normal`).
`hard` is nothing but the cartridge's *Hard Mode*: it hands **every** trainer the
trio `HARD_MODE_FLAGS` = `checkBadMove`, `tryToFaint`, `checkViability` on top of
the archetype's own flags, so the ladder's bottom rows become `ace`-like and the top
rows gain nothing new. It is strictly additive, and the only level that draws an
exact tie from the battle's `Rng`; `normal` keeps the lowest index and spends no
draw. The row is the Options screen's **Difficulty** step row (last of the step
rows, so every shipped index keeps its order), reaching the battle as
`BattleLaunch.aiLevel` — read from the settings at launch, so a battle's AI is
reproducible from the battle's inputs alone. It is a `Settings` field read per field
in `parseSettings` (`value.aiLevel === 'hard' ? 'hard' : base.aiLevel`), so a save
with no such key reads the default: **no `SAVE_VERSION` bump and no migration step**
(the `D22`/`D45` precedent), and `SAVE_VERSION` stays **16**.

The AI draws from **`state.rng`** and from nowhere else, never `Math.random()` and
never a stream of its own, so one seed and the same board replay the same command.
Those draws — a wild's pick, an exact tie at `hard` — advance the battle's stream,
which is why the fixed-seed battle logs (`golden.test.ts`) move with this rule and
were re-pinned with it. The AI reads nothing but legal information: its own side's
party, movesets and PP; the **active** fighters' public facts; the field;
`state.turn`, `state.isWild`, `state.lastMove` and `state.rng`. It never reads the
opposing **bench** and never the opposing side's unrevealed moves. A second knob —
per-archetype difficulty, a per-beat row, adaptive or rubber-band difficulty,
telegraphing the enemy's choice — is deliberately **not** built here.

## D47 — A special room kind is a descriptor module; the route keeps one auto-discovered registry *(decided)*

Every **special room kind** (`MapRoomSpecial`: `shop`, `mini-boss`, `mega-stone`, and every
kind a later task adds) used to be code inside `RouteScene.ts`. It is now one **descriptor
module** under `src/scenes/rooms/`, and the scene keeps **one registry** of them, built from
the folder itself with `import.meta.glob(['./rooms/*.ts', '!./rooms/*.test.ts'], { eager: true })`
— the negative pattern keeps the folder's tests out of the bundle. `collectDescriptors` takes
that module map and collects every module that exports a named `descriptor` whose `kind` is a
string; any other module (`types.ts`, `registry.ts`, a helper) is skipped silently, so the
folder may hold non-descriptor files. Two descriptors that claim one kind **throw**, naming both
module paths in module-map key order, so a duplicated room kind fails loudly at scene start
rather than silently dropping one. Both indexes (`byKind` and `byMarker`) are built once and
never mutated.

A `RoomDescriptor` is data plus four optional hooks: `fixture(host)` is the room's content
(trainers appended after the map boss's own entry, ground items, and the counter tile the
movement block and the interact key read), `interact(host, tile)` is the interact key while the
player faces a tile — `true` means the room consumed it — `drawFixture(host)` draws the room's
own fixture sprite where the scene draws entities, and `drawMarker(graphics, cx, cy, radius)`
draws the room's minimap glyph. A room reaches the scene only through **`RoomHost`**, a
read-only port whose members are the room's `view`, the live `run`, the entry/counter/farthest
tiles, the facing helper, the dev-generator flag, `commitRun`, `releaseHudKeyboard`,
`openPanel` / `closePanel` / `panelOpen` and the scene's own `add`/`scale`/`cameras`.
`RouteScene` satisfies it; nothing else does, and the descriptor modules never import a scene.
`Phaser` is a **type-only** import in `types.ts`, and `registry.ts` imports Phaser not at all,
so the whole layer is unit-tested headless — including the Mart window, which drives a stub
scene.

**The plan's data stays the plan's.** `MapRoomSpecial` is still what `src/engine/maps/plan.ts`
rolls and what the run's rooms carry; the **marker the minimap draws** comes from the
descriptor (`byMarker`), so the map's glyph vocabulary lives beside the room that draws it.
`src/ui/mapView.ts` keeps `MapRoomMarker = MapRoomSpecial` untouched, and its geometry — the
bands, the centring, the door midpoints and the fog — is unchanged.

**The scene owns the keyboard slot, not the panel.** `RouteScene.roomPanel` holds the open
`RoomPanel` (or nothing); the scene's action handler gives it every key first, the pointer
guards read `panelOpen()`, and the panel's `close()` — called by the scene, never by the panel
— destroys the objects the room built. The shop room's own state (its stock, tab, cursor and
the row objects it repaints) lives in its module, as does the counter tile it declares; the
scene keeps the tile so movement can still block on it. No room's behaviour, price, key, tile,
marker or RNG draw moved with the code: the mini-boss and the mega-stone place no roll of their
own (their ids are `miniBossTrainerId(mapIndex)` / `megaStoneItemId(mapIndex)`), the stone
still draws off `${run.seed}:mega:${mapIndex}` and the shop's shelves still off
`${run.seed}:shop:${run.mapIndex}` through `buildShop`.

**A new room is a new file** in `src/scenes/rooms/` exporting `descriptor`, plus its own
`MapRoomSpecial` value in `src/engine/maps/plan.ts` and its `docs/maps-spec.md` §7 row — the
scene and the registry need no edit. Hooks a later room needs and does not have yet (starting a
battle, adding an item, spending money, hooking `advanceMap`) are `RouteScene` edits that task
must claim.

## D48 — An NPC member edit is one pure run transaction, and its two member words are optional *(decided)*

The five member-edit NPCs and the sacrifice (`docs/maps-spec.md` §7) all live in **one** engine
module, `src/engine/run/memberEdits.ts`, and each is a single pure transaction on the run: it
takes the `RunState` plus the member (or, for the sacrifice, the run alone), draws only from its
own `:npc:` stream and answers either the new run with a `MemberEditLine` or the **same run
reference** with a refusal reason. The scene owns no rule: it opens the shipped card, passes the
chosen member and commits `ok.run` with the floor's use mark in one write.

**Per-operation substreams, minted inside the function.** Every draw is
`Rng(hashSeed(`${seed}:npc:${roomIndex}:${npcId}:<op>`))`, the family `npcSpot` already uses:
`nature`, `ability`, `second-ability`, `ivs`, `species`, and the sacrifice's three-draw stream
`sacrifice` (the stack, the member, the reward row) followed by `sacrifice:<op>` for the reward it
drew, so a reward that cannot resolve costs nothing. No map, layout, encounter, roster, passive,
casino or battle draw moves, and the same `(seed, mapIndex, roomIndex, npcId)` always yields the
same edit — a reload can neither re-roll one nor lose one.

**The two new member words are optional-on-the-wire.** `RunPokemon.taughtMoves` and
`RunPokemon.secondAbility` are written **only when they carry something** (`SAVE_VERSION` 19 → 20,
the migration-14 precedent: the migration bumps the version and writes no field, and the decoder
drops an absent or malformed one to none). A v19 save therefore reads as "no tutored moves, no
second ability", and a v20 round trip is stable. `taughtMoves` is the band's `Tutor` source, which
is why a tutored move survives an unequip for free.

**The second ability is run-level until a precedence rule exists.** `memberAbilities` is the run's
one answer to "which abilities does this member carry": `partyHasAbility`, `runPassives` and the
learnset's No Guard guard ask it, so a granted ability opens a gate, pays a `MAP_PASSIVES` row and
bans the OHKO pair. The **battle** keeps fighting with `fighter.ability` alone: firing two
abilities at once needs a rule for which one wins a contested hook and no spec decides it, so that
stays a later task rather than a silent choice here.

## D49 — The HUD is a DOM layer over an untouched canvas, and "identical to the board" is a measured gate *(decided)*

**The canvas is not touched.** World, camera, route tiles, sprites, the battle background, the
combatants, the effects, the shake, the flashes and the fades stay exactly where they are and are
drawn exactly as they are drawn today: not one tile, sprite, palette or atlas moves, and no route or
battle scene changes its rendering. What leaves Phaser is the **chrome** — every panel, box, menu,
bar, chip, label, list, dialog and sheet, in the menus, in the routes and **in battle** (the HP
boxes, the move menu, the bag, the switch screen and the message box). The board is CSS geometry and
Silkscreen, so the panels are reproduced where they were authored.

**The layer.** `#hud` is mounted once in `src/main.ts` above the canvas, `pointer-events: none`, and
each panel re-enables it. It renders from one serialisable `HudState` snapshot projected **from the
engine** (`src/engine/run/state.ts`, `src/engine/battle/state.ts`) and never reads a Phaser object;
it sends `HudCommand` back through the same action handler a key or a pad press takes, so rebinding
keeps working. One emit point (`syncHud()`), never an ad-hoc `setState` from a scene: the engine is
the truth and the HUD is a projection, so the two cannot drift.

**The runtime.** Preact + `@preact/signals` (≈5 KB gzip). React is rejected: nothing here needs it,
and the repo rule is "no new deps unless a few lines cannot do it". No component library, no CSS
framework, no CSS-in-JS — the diff has to be debuggable in devtools and Playwright has to see plain
CSS.

**The board is the layout source.** `design/` holds only the frames a migrated screen needs:
`<slug>.svg` (1:1), `<slug>.png` (@2x, for the diff) and `<slug>.json` (the `node_info` tree),
exported through the Figma MCP by `scripts/design/export.mjs`. `design/tokens.json` is **generated**
from the file, never hand-typed, and is the only place a colour, radius, spacing or type size is
written; `scripts/ui/build-chrome.mjs` derives the Phaser-side chrome from the same values, so the
two worlds cannot drift. Everything else in a panel is a CSS custom property. The measurements the
generator is checked against are in `docs/hud-fidelity.md`.

**The font.** Silkscreen, self-hosted (`src/assets/fonts/silkscreen-{400,700}.woff2`, OFL, no CDN),
because the board is Silkscreen. The FRLG bitmap atlas stays where it is: the world keeps it and so
does any canvas label that survives. The consequence is accepted openly: the HUD is Silkscreen while
canvas text is FRLG, and the board's sizes are used unchanged (9/10/11/12/18/20) rather than snapped
to multiples of 8 — matching the board beats glyph crispness.

**Identity is a test, not a look.** Each frame ships with `design/fixtures/<slug>.json` — the frame's
own strings and numbers — and `?hudFixture=<slug>` feeds the store that fixture, so the diff compares
the same content instead of a different party against the board. `npm run hud:diff -- <slug>` boots
the preview, screenshots at 390×844 and 1280×800 with `deviceScaleFactor: 2`, and runs `pixelmatch`
against `<slug>.png`. Two gates per screen: **geometry** (panel edges, row pitch, radii and chips
within 2 px) and **colour** (mean ΔE ≤ 2 on the flat fills). Text is measured on its bounding box and
colour, not per pixel: no two rasterisers agree glyph for glyph, and pretending otherwise would turn
the gate into a tuning treadmill. A screen that cannot pass keeps its Phaser version, the flag stays
on Phaser for that screen, and **no phase closes with a screen migrated half-way**.

**Escape hatch, per element.** When a shape will not match in CSS — a glow, an exotic corner, a
pattern — it ships as the board's own SVG or as a nine-slice asset, the `addFrlgWindow` precedent.
Identity by construction beats identity by tuning.

**Animation.** The battle's pacing already lives in `battleFrames()` and `entryBeat()` frames, not in
the boxes: each frame carries the events applied as its message appears. The bridge keeps that shape
— the scene awaits `hud.play(action)` and the DOM answers when its transition ends, so a "Critical
hit!" beat still lands with the HP drop it describes. Floating damage numbers stay in the canvas for
now: they are anchored to a moving sprite and live one beat. Moving them later needs a per-frame
sprite→screen projection, and that projection is the only genuinely new contract this decision adds.

**Deps.** Runtime `preact` and `@preact/signals`; dev `pixelmatch` and `pngjs`. Nothing else: no jsdom
(the HUD's logic stays in pure modules under `src/ui/hud/` with Vitest, and the components are
covered by the diff), no testing-library, no CSS toolchain.

**Process.** A new architectural layer plus a dependency is a `D##` (this entry), and it runs as a
**serial chain of small batches**, never a four-wide wave: `package.json`, `src/main.ts`,
`vite.config.ts` and every `src/scenes/*.ts` are hot files and each batch claims them once. Order:
(1) `design/` export, token generation, the diff harness and the `#hud` shell behind `?hud=dom`;
(2) Options `02` as the spike; (3) the route panels, one per task; (4) the battle boxes, one per
task; (5) the route HUD chips and the pad decision last.

### D49 addendum — the canvas HUD layer retired (`Task-200`)

**The decision.** The DOM HUD is the HUD: `mountHud` mounts on a clean boot, `?hud=dom` is a no-op
alias, and `parseHudFlags(search).dom` is always `true`. Every scene and every route panel is a
render-free controller that mounts its card into `#hud`; no scene and no panel branches on the flag
any more, and `src/scenes/panels/**` draws no Phaser object at all.

**What went with the canvas layer, named and not hidden.** The collapse chip, the panel drag with
its clamp and the saved slot were carried by that layer alone (`src/data/hudLayout.ts`,
`src/scenes/panels/hud.ts`). The stored shape stays — `hudLayout`'s `collapsed` flags still decide
which cards a fresh boot opens — but the drag offset is never written again. Their DOM parity is
`Task-208` (Batch 91).

### D49 addendum — the touch pad stays in Phaser

**The decision.** The touch pad stays in Phaser. It is an **input surface, not chrome**: it draws
three transparent outlines and two letters, and every press is already the `KeybindAction` a key
produces — `createTouchControls({ onAction })` in `src/ui/touchControls.ts` hands the pad's
direction, `confirm` and `cancel` to the same handler the keyboard drives — so a DOM pad would
re-implement pointer capture, the pad's owning pointer id, held-direction polling and the battle's
camera offset for zero fidelity. Its geometry is already the board's to the pixel:
`touchControlsLayout(390, 844)` yields the 156 px pad at (103,741) and A/B at r35
(334,767)/(235,788), exactly `docs/hud-fidelity.md` §5, so there is nothing for the diff to
improve. `src/ui/touchLayout.ts` stays the one model; if the pad ever moves it moves as its own
task with that model and a pointer-events contract.

## D50 — The board's rasters stay in the repo, with the game's own screen inside them *(decided)*

**The fact.** 62 of the 66 viewports exported into `design/screens/` carry the route's screenshot as
`<image>` layers: the world, its trees and the player sprite are the decomp's tiles, drawn on the board
so the panel is designed over the screen it will sit on. The PNG references carry the same pixels.
`AGENTS.md` says no ripped output is committed, and the asset pipeline keeps ripped sources in
`sprite-sources/**` and the packed atlases out of git for exactly that reason.

**Why the exception is right.** The board is not a build input. `design/` sits outside `src/`, nothing
imports it, Vite never sees it and no byte of it reaches `dist/`: the surfaces that ship are `src/` and
`assets:pack`'s output, and this adds nothing to either. What it is, is the **reference image the gate
compares**, and a board with the world erased measures a different screen than the one that ships — it
would turn `D49`'s identity test into a comparison against a picture nobody ever designed. The rule
that matters ("no ripped output is committed **as game content**") is untouched: no atlas, no cue and
no source tree enters the repo, and `design/screens/**` is generated by `npm run design:export` from
the Figma file, never packed, served or imported.

**The escape hatch, so this stays one decision and not a habit.** `design/screens/**` is a single
directory and `scripts/hud/diff.mjs` reads it through one path, so if the repo ever has to be free of
it the move is a `.gitignore` line plus a checkout under `ASSETS_ROOT` (the same shape the packers
already take), not a rewrite. The frames themselves — `design/frames/*.json`, the text and geometry —
carry no image bytes and are unaffected either way.

## D51 - One compiler: the ESLint half is dropped, and the lint gate is Prettier under `tsc` *(decided)*

`[Task-28]` shipped a dormant `eslint.config.mjs` waiting for a `typescript-eslint` release
that peers with the repo's native `typescript@7.0.2`. None did: every release up to **8.72.0**
declares `typescript >=4.8.4 <6.1.0`, and TS 7 exposes no JavaScript API for a parser to
import.

**Decided (`2026-10-25`): the half is dropped, not deferred.** `eslint.config.mjs` is deleted,
`npm run lint` stays `prettier --check .`, and `tsc --noEmit` inside `npm run build` keeps the
type gate. The alternative — a second, non-native TypeScript installed only for linting — was
rejected because two compilers that disagree turn a green lint into a claim nobody can trust.

**The escape hatch.** If a lint net is wanted again it must be a linter that reads no TypeScript
API (an `oxlint`-shaped tool) and it takes its own task, so the deadlock is never rediscovered.

## D52 - The 61 DLC descriptions are Spanish authored in the repo, and `D43` keeps its official-text rule everywhere else *(decided)*

`[Task-113]` was blocked because PokeAPI's dump and the base-game Scarlet/Violet text carry no
`es` row for **18 moves and 43 abilities** (all DLC rows), and `D43` forbids a machine
translation. The English fallback already ships and renders, so the gap is visible but not
broken.

**Decided (`2026-10-25`): those 61 get Spanish written in the repo** (`[Task-149]`), from the
generated dex's own English `desc`/`shortDesc`, reviewed as content. The rule that matters —
**no machine translation, ever** — is untouched: the strings are authored and reviewed like any
other content, never emitted by a generator. Names stay the official Spanish ones; only the two
description fields are filled.

**Scope.** Exactly the ids `MISSING_ES` names. If a DLC Spanish dump appears later it corrects
those strings; nothing else in the content-localisation path changes.

## D53 - The loop's host surface shrinks: no smoke probe and no capacity wait *(decided)*

`agent-smoke.yml` probed a credential and a model id that the cycle itself exercises on every
run, and `oci-retry.yml` existed only to wait for an Always Free instance nobody has ever
provisioned. Both cost runs in the list that look like the loop working when it is not.

**Decided (`2026-10-25`): both workflows are deleted**, with `scripts/agent/vm/oci-launch.sh`,
its offline harness and the provisioning/wait chapters of `docs/agent-vm.md`. The VM host
survives as code and as documentation — the cycle, the driver, the brake and the prompt — and a
human provisions the box; the repository makes no provider-specific call. `ci.yml` loses its
VM-script step, `.github/workflows/README.md` and `docs/agent-ci.md` lose their rows, and the
`OCI_*` repository variables are left for a human to delete since only secrets can rot.

## D54 - The run's clock enters as an argument, and its end seam records once *(decided)*

`src/engine/run/history.ts` could build a `RunHistoryRecord` from the day it shipped, and
nothing called it: `save.history` stayed empty, so a player who had just finished a run
opened STATS and read "NO FINISHED RUNS YET". The chain also carried no start instant and
no battle tallies, so a record would have reported a playtime of zero and an empty species
table.

**Decided (`2026-10-27`): the scene owns the clock and the engine owns the arithmetic.**
`createRun` takes `startedAt` as a `RunInit` field and stores it on `RunState.startedAt`
(`''` = unknown, reported as a playtime of 0); the end seam (`endRun` over a `RunEndLog`)
is **pure and idempotent** — it appends one `makeHistoryRecord` row and flips `ended`, so a
second arrival writes nothing — and the scene is the only place that reads `Date.now()` /
`new Date()` (`D11`, the `dailySeed` precedent of a clock passed in). The battle reports
what it did on `BattleReturn.tallies`, read off its own log by `battleTallies`, which
credits an enemy `damage`/`faint` to the player fighter that was on the field and a
player-side `damage` to that fighter's `damageTaken`.

**`SAVE_VERSION` 25 → 26** adds the run's `startedAt` and `RunStats.faints`, plus the
optional per-member `kos`/`damage`/`damageTaken` that `withMemberTally` books. A v25 run
migrates to `startedAt: ''` and `faints: 0`, and its members carry no counter — the
decoder leaves an absent optional field out (the `14` nickname precedent) and the readers
treat an absent counter as 0.

**`RunStats.faints` is optional, where the twelve counters before it were required.** Six
test files outside this change's paths construct `RunStats` literals by hand
(`src/ui/runSummary.test.ts`, `src/ui/hud/state.test.ts`, `src/ui/hud/panels/party/view.test.ts`,
`src/ui/hud/panels/run-over/view.test.ts`, `src/engine/routes/staticSpecies.test.ts`,
`src/engine/run/items.test.ts`); a required field breaks `tsc` on all of them, and a task
may not edit paths it does not own. `runFaints`/`addFaints` keep the arithmetic total, and
`emptyRunStats()` writes the field, so every run this build creates carries a number.

## D55 — The main menu's preview route is decorative, and its seed is random on purpose *(decided)*

The main menu's 560×380 window (358×240 on a phone) was an empty frame: the menu drew a
route window's chrome and nothing inside it, so the landing screen read as a placeholder.
The screen has no run of its own — with no save there is no seed to draw a route from — and
borrowing the saved run's seed would make the menu show a room the player is not standing in.

**Decided (`2026-10-27`): the window draws a route that is decoration, from a seed of its own.**
`src/engine/routes/preview.ts` is the only seam — `previewRoute(seed, window)` (the window
sized room, the first map's biome, a quiet `corridor` off `` `${seed}:preview` ``),
`previewWalkers(route)` (two or three distinct species on its walkable floor) and
`stepPreviewWalkers(route, walkers, step)` (one tick of their wander, each on its own
`walker:<id>:<step>` stream, never straight back onto the tile it just left while another
card is open, so the window cannot metronome between two tiles). It reads no run state and
no save, and it never touches
`RunState.seed`; `previewRoomFor`, `previewTileBox`, `previewWalkerBox` and `tileBackground`
in `src/ui/hud/panels/main-menu/routeWindow.ts` are the renderer's geometry over that model.

`D11` makes the **run** reproducible; this screen is the one place allowed to differ per
visit, so the seed is `randomSeed()` once per boot and is never persisted, never enters
`save.run` and never reaches an encounter, an input or a write. The consequence: a fixture
frame and the live panel render the same model (the view carries `previewSeed`, the panel
paints `previewRoomFor`), so the two renderings cannot drift — and **no other screen may
adopt a random seed by citing this decision**.

## D56 - The monthly ranking is global, anonymous and discovered at deploy time *(decided)*

Until this decision every STATS figure came from `save.history`, so the ranking screen
(`09`) showed one `YOU` row per month and its blurb had to read `MONTHLY RECORD · THIS
DEVICE.`: the store is `window.localStorage`, and no finished run ever left the browser.
A monthly board that names nobody is impossible, and the game has no accounts, no login
and no player name — the save is a run, not an identity.

**Decided (`2026-10-28`): the ranking is a global monthly board fed by one endpoint, and
everything else stays local.** A finished run POSTs its payload to a Lambda behind a
function URL; the panel GETs the month's top and prints it, marking the device's own line.
Three seams, one each:

- **The endpoint is discovered, not built in.** The deploy writes `ranking.json`
  (`{ "endpoint": "…" }`) into the same `prune: true` bucket deployment as `dist/`, and
  the client reads that file (`src/net/ranking.ts`). A build-time variable would make
  `npm run build` depend on a deployed stack and break a plain build on a fresh clone;
  a file in the bucket costs one GET and keeps the build pure.
- **The identity is a rotating anonymous id.** `rankingDeviceId` mints `d-` + twelve hex
  under `RANKING_DEVICE_KEY` in `localStorage`, **outside** the save document, so this
  adds no `SAVE_VERSION` step and no run field — `src/engine/save.ts` is untouched. It
  survives a new run and is the only thing tying two runs together. Another player's row
  is labelled `#` + the last four characters of its id, because there is no name to print;
  `D5`'s "nothing carries over" is about the run's party and stays true.
- **The payload is client-authored, and both sides clamp it.** `buildRankingEntry` sends
  seven keys (`seed`, `mode`, `mapReached`, `won`, `playtimeMs`, `species` — the first six
  ids — and `deviceId`); the handler re-validates the seed, the mode, the id pattern and
  the species list, and re-applies the same two clamps (`99` floors, `86 400 000` ms of
  playtime). Those numbers exist in exactly two places, `RANKING_MAX_*` in the client and
  `MAX_*` in `infra/lambda/ranking.mjs`, and must move together. Beyond that the board is a
  ledger of claims: anti-cheat is out of scope, and `infra/README.md` says so.

The monthly ledger is one DynamoDB table (`month` partition key, `strike` sort key
`NNN#<endedAt>#<deviceId>`, per-request billing, a 400-day `expiresAt` TTL), so a future
per-run or per-species board is a second sort key, never a second table.

**The failure path is invisible by construction.** `src/net/**` never throws into a scene:
a missing `ranking.json`, an offline browser or an unreadable answer read as `null`/`false`,
the submit is fired `void` from the shipped `endRun` seam so a finished run never waits on
the network, and the ranking view falls back to the device's own record under
`stats.blurbRanking` — so the panel still draws, the offline copy still reads
`MONTHLY RECORD · THIS DEVICE.`, and no run can be lost to a request.

The next screen — the menu's two separate STATS and RANKING rows — must reuse
`statsMode = 'ranking'` plus `MainMenuScene.loadGlobalRanking()`, not add a second fetch.

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

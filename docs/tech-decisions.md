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
`D40`; 1291 entries).
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

The random ability (`src/engine/battle/randomAbility.ts`, `randomAbility`) draws
only from the abilities the effect registry implements (`D16`: an unported
ability would be a dead no-op) and drops the formes it cannot model. Downside
abilities are kept on purpose — a worse ability is part of the random run — and
the ones that would be dead on an arbitrary species are implemented generically
instead of excluded (Zero to Hero, Wonder Guard). **No Guard is never paired with
an OHKO move.** An evolution **re-rolls** the ability from the new species' pool
under the same run seed.

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
`route` and `cavern` were removed for now. The open field was replaced by
**carving the shape's lanes out of a solid interior** (openings punched in the
one-tile border), with wide, chamber-ended branches; water is decoration now, not
a terrain pass, the default map is 20x20, and the beyond-the-edge tree frame
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
**shop** near the entry, a **mini-boss** room (medium chance) whose strong
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
over a search field and a paged, full-width grid of everything the member may
equip — the learned level-up moves (from the run's randomized learnset, D17) that
are not already in one of its four slots, and the moves a TM **in the bag** can
teach it. A pool cell is dragged onto a slot to equip it, replacing what sat
there; this goes through the pure `equipMove`, so a move the member already holds
is never offered and the slots never duplicate. TM compatibility reads the
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
future dex - Judgment stays Normal without a Plate, and Hidden Power ships only
as a single Normal entry (its IV-based typing is not modelled).

## D38 — Every evolution is a level evolution and the player clicks it *(decided)*

The dex's stone, trade, friendship and move evolutions are resolved to a level
(`evolutionBranches`, `src/data/dex/evolutions.ts`): a canon level evolution
keeps its level, the rest take their species' own level evolution when it has
one and otherwise a stage default (base forms at 20, middle forms at 30), never
below the level the species was obtained at. All of a species' branches share
that level, so Eevee's eight forms unlock together. Evolution is **manual** — a
member never evolves on level-up (`levelUpPokemon`) or on a catch
(`adoptAtLevel`) — the STATS tab draws the whole family as a graph
(`src/ui/evolutionGraph.ts`) and a click on a ready branch evolves the member
(`evolvePokemon`/`evolveMember`), keeping the level, nature, IVs/EVs, moves, PP,
status and held item and carrying the missing HP across. The graph shows the
pre-evolutions too, so a final form still reads its line.

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
  formes) never appear in either pool; they only exist inside a fight.
- A **boss** (map boss and mini-boss) fields the **upper half** of its band's
  window (`bossBstWindow`), one step above the floor's regular trainers.
- Coverage is a test (`src/engine/run/pool.test.ts`): the wild union is every
  spawnable species minus the banned tags, the trainer union every spawnable
  species. Past the last band (an infinite run's deeper floors) the window stays
  `end`: its BST saturates at the top of the dex.

## D40 — The game ships the full National Dex *(decided)*

`build-dex.mjs` no longer keeps only the Gen 9 standard set: the playable
`species.json` is the **whole National Dex** — every numbered species, the
`Past` Dexit entries included — 1291 entries across all 1025 dex numbers, with
48 Megas generated beside it. Only non-species are dropped at generation time:
CAP/fan entries, `Custom` (MissingNo, Pokéstar), LGPE's partner starters (no
art), and the battle-only Gigantamax/Eternamax formes.

Two learnset rules keep a Dexit species playable: a species with no gen-8
source falls back to its own newest learnset, and a forme without one inherits
its base species'. A species that somehow ends up with no move at all falls back
to Tackle in `defaultMoveset` (Unown keeps Hidden Power, which ships as of
`D42`). This is what gives the generalised form-change abilities a real target:
forms like Wishiwashi-School, Darmanitan-Zen, Aegislash-Blade and Castform-Sunny
now exist in the dex. It changes what the wild, the trainers, the starters and
the battle art (`npm run data:anil`) can meet.

## D41 — Form-change abilities are generalised like Zero to Hero *(decided)*

Every forme- or species-change ability a run can meet is one generic rule: **any**
holder changes forme when the ability's own condition holds, from level 20 on,
through `changeBattleForm`/`restoreBattleForm` (`D34`'s battle-only backup, which
keeps the run snapshot on the base species). The set: Zero to Hero (Palafin-Hero
on switch-out), Schooling (Wishiwashi-School above 1/4 HP), Zen Mode and **Zen
Mode (Galar)** (Darmanitan-Zen / Galar-Zen at 1/2 HP — a synthetic dex ability,
since `@pkmn/dex` has one entry for two formes), Shields Down (Minior's
Meteor/Core), Tera Shift (Terastal Form on entry), Hunger Switch (the Hangry
forme alternating every turn), Forecast (Castform follows the weather), Flower
Gift (Cherrim's Sunshine Form in the sun), Stance Change (Blade Forme on a
damaging move) and Disguise (the first damaging hit is absorbed and leaves the
holder Busted).

`changeBattleForm` **keeps the holder's ability** so the rule keeps firing (a
Mega is the exception — its forme's ability wins). All of them are off
`randomAbility`'s ban list, so any species may roll them. Stance Change's Shield
revert needs King's Shield, which ships with the full move set (`D42`); Commander
stays excluded — it is a doubles mechanic with no single-battle forme to reach.

## D42 — The game ships the full move set *(decided)*

`build-dex.mjs` now generates every real move, the `Past` ones included, so a
Dexit species keeps its learnset: `moves.json` grows from 685 to **835**. Dropped
are the Dynamax (Max) and Z moves (the engine models neither) and the
CAP/Future/Unobtainable entries. Hidden Power's 17 typings all share the id
`hiddenpower`; the engine keys moves by id and does not model its IV-based type,
so only the Normal entry ships. A move with no ported effect still resolves its
base damage generically; an unported status move is a dev-warned no-op.

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

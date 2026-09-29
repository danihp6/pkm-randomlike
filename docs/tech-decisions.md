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
The donor's `fov.ts`, `vision.ts`, `pathfinding.ts` and the tileset autotiling
carry over unchanged; its BSP `dungeon.ts` stays as a candidate for cave-flavoured
routes.

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
and level, a Pokémon's learnset/moveset and ability, a trainer's team, and which
floor items spawn. One run seed drives all of it through `Rng` streams.

## D18 — Tile size is a property of the tileset *(decided)*

`TilesetConfig` declares its own `tileSize` instead of relying on a global
constant: the PMD-derived atlases stay at 24px, while FireRed/LeafGreen atlases
use their native 16px rather than an uneven 1.5x upscale. The scene positions
and follows the player from the active tileset's tile size; the route/map logic
is already tile-based and does not care. `TILE_SIZE = 24` survives only as the
default for the configs written before this change.

## Open questions

- **O1 — Trainer sprites.** Source resolved: the FRLG `npc-overworld.png` and
  `trainers.png` rips in `sprite-sources/frlg/` cover the archetypes; slicing
  them per `D18` is the remaining work. Blocks Phase 8 cosmetics, not logic.
- **O2 — Battle arena framing.** Single-screen per battle (GB style) vs a
  floating HUD over the route. Cosmetic, blocks Phase 5.
- **O3 — EVs/IVs.** The data has IVs and EVs exist in Gen 9; do we let a caught
  Pokémon keep the dex's random IVs (more roguelike variance) or normalise IVs to
  31 and drop EVs entirely (purer balance)? Lean: random IVs, zero EVs.
- **O4 — Public build.** If the game ever ships, the imported Nintendo art must be
  replaced by CC0/placeholder art. Does that change the plan for `src/assets`?

# Project: PokeRandomLike

Browser **Pokémon roguelike**. You walk a procedural **route** (our word for the
floors): a small top-down map of 24px tiles with tall grass, a route exit, items
and trainers. Trainers have a line of sight and open a **classic menu battle**
(fight / bag / switch / run) when they see you; tall grass rolls wild encounters.
You catch at most one Pokémon per route, the classic way. Every Pokémon you lose
is lost **forever** — 0 HP means gone, no Revive, no resurrection — and when the
last one falls the run ends and nothing carries over. A run is a chain of routes
with a mini-boss cadence, bosses and a final boss, plus an infinite mode.

Winning is where the roguelike lives: the only way to grow the party is to catch,
and the only way to keep it is not to lose it.

`docs/design-spec.md` is the gameplay source of truth. `docs/battle-spec.md`,
`docs/routes-spec.md`, `docs/tileset-spec.md`, `docs/showdown-reuse.md` and
`docs/data-spec.md` narrow it down by area. `docs/tech-decisions.md` holds the
`D##` decisions. `TODO.md` is the open backlog; `CHANGELOG.md` archives what
already shipped (read only when asked).

## Stack decisions
- **Engine**: Phaser 3 on **Vite + TypeScript**. Same scaffolding and versions as
  `slate-line`/`dustfall` in this workspace.
- **Game logic**: pure TypeScript under `src/engine/` with **no Phaser imports**,
  so the battle engine, the route generator, the dex accessors and the tileset
  frame selection are unit-testable headless.
- **Tests**: Vitest, co-located as `*.test.ts`. `npm test` must pass without a
  browser.
- **Data**: generated dex JSON in `src/data/dex/` (from `@pkmn/dex`, Gen 9) plus
  hand-authored tables; balancing must not require touching code.
- **Battle**: our own menu-battle engine (`src/engine/battle/`) that extends what
  we port from Showdown, **not** an embed of `@pkmn/sim` (D4). Effect handlers are
  ported on Showdown's hook names and tracked in a coverage table (D16).
- **Determinism**: one seed per run. Map layout, encounters, rosters, loot and
  battle rolls all come from `Rng` streams derived from it (D11).
- **Rendering**: Phaser scenes only; tiles are resolved from a swappable
  `TilesetConfig` so a route can change biome without code (D10).
- **Persistence**: `localStorage` for settings and the run in progress.
- **Target**: browser first (itch.io friendly), desktop-wrapped later.

## Directory layout
- `src/engine/` – pure logic: `rng.ts`, `grid.ts`, `map.ts`, `fov.ts`,
  `vision.ts`, `pathfinding.ts`, `tileset.ts`, `tileFrames.ts`, and later
  `routes/`, `battle/`, `dex/`.
- `src/data/` – `dex/` (generated), `tilesets/` (registry + palettes), later
  `biomes.ts`, `encounters.ts`, `trainers.ts`, `items.ts`, `run.ts`. Contract in
  `src/data/README.md`.
- `src/scenes/` – `BootScene.ts`, `RouteScene.ts`, `BattleScene.ts` (later:
  `PartyScene`, `BoxScene`, `MenuScene`).
- `src/render/`, `src/input/`, `src/audio/` – Phaser-side helpers, created as
  each phase needs them.
- `src/assets/` – atlas sheets, sprites and manifests. Contract in
  `src/assets/README.md`.
- `scripts/` – `build-dex.mjs` and `legacy-art/` (the imported art pipeline).
- `docs/` – the specs above, `balance/` for spreadsheets.
- `TODO.md`, `CHANGELOG.md`.

## Workflow
- Backlog and phases live in `TODO.md`. Pick the next open task and work it on its
  own branch off `main` (e.g. `feature/phase1-route-generator`). Completed items
  move to `CHANGELOG.md`, grouped by phase.
- New rules go in `src/engine/` as pure functions with tests; Phaser work stays in
  `src/scenes/` and `src/render/`.
- Run `npm test` and `npm run build` before committing.
- Any change to the RNG, the route generator or a battle-odds model must keep a
  given seed reproducible; add a regression test with a fixed seed.
- New content goes in `src/data/` with a line in the matching `docs/` spec.
- Regenerating the dex (`npm run data:dex`) is deliberate: rerun the tests and
  update `dex/meta.json` counts if they moved.

## Git workflow
- NEVER commit or push directly to `main`. Always create a feature branch first,
  unless the user explicitly says otherwise.
- Run `git init` before the first code task if the repo does not exist yet.

## Conventions
- All writing (docs, commit messages, changelog, TODO, code identifiers, game
  text) in **English** (D12).
- TypeScript style: 2-space indent, `camelCase` for functions/variables,
  `PascalCase` for types/classes, explicit types on exported APIs.
- No code comments unless asked, except where a non-obvious balance or
  rules decision needs a rationale (e.g. why a per-route level cap).
- No new deps/addons unless a few lines cannot do it.
- Art: respect licences. Preference order is procedural/CC0, then the imported
  game rips for local development only. `sprite-sources/` is gitignored and must
  never be redistributed.
- Performance: no per-frame allocations in hot paths (movement, fog, geometry);
  keep a route to a single screen unless a chapter explicitly needs scroll.

## Communication
- Reply to the user in the chat in Spanish.

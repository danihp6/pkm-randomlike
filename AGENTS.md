# Project: PokeRandomLike

Browser **Pokémon roguelike**. You walk a procedural **route** (our word for the
floors): a small top-down map of 24px tiles with tall grass, a route exit, items
and trainers. Trainers have a line of sight and open a **classic menu battle**
(fight / bag / switch / run) when they see you; tall grass rolls wild encounters.
You catch at most one Pokémon per route, the classic way. Every Pokémon you lose
is lost **forever** — 0 HP means gone, no Revive, no resurrection — and when the
last one falls the run ends and nothing carries over. A run is a chain of **maps**:
Binding of Isaac-style floors — a grid of routes of one biome, closed into a loop,
each with a level range and a boss on the farthest room that opens the portal to
the next map — plus an infinite mode.

Winning is where the roguelike lives: the only way to grow the party is to catch,
and the only way to keep it is not to lose it.

`docs/design-spec.md` is the gameplay source of truth. `docs/battle-spec.md`,
`docs/routes-spec.md`, `docs/maps-spec.md`, `docs/tileset-spec.md`,
`docs/showdown-reuse.md` and `docs/data-spec.md` narrow it down by area.
`docs/tech-decisions.md` holds the `D##` decisions. `TODO.md` is the open
backlog; `CHANGELOG.md` archives what already shipped (read only when asked).
`docs/agent-spec-template.md` is the per-task spec format the multi-agent
workflow uses.

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
- `src/engine/` – pure logic: `rng.ts`, `grid.ts`, `map.ts`,
  `pathfinding.ts`, `tileset.ts`, `tileFrames.ts`, `routes/`
  (`routeMap.ts`, `sketch.ts`, `validate.ts`, `encounters.ts`), `maps/`
  (`plan.ts`), `run/` (`state.ts`, `progression.ts`, `learnset.ts`, `resolve.ts`,
  `pool.ts`, `roster.ts`),
  and `battle/` (`fighter.ts`, `state.ts`, `order.ts`, `damage.ts`, `moveType.ts`,
  `accuracy.ts`, `status.ts`, `volatile.ts`, `turn.ts`, `commands.ts`,
  `runAway.ts`, `capture.ts`, `ai.ts`).
- `src/data/` – `dex/` (generated + typed accessors), `tilesets/` (registry +
  palettes), `biomes.ts`, `maps.ts`, `trainers.ts`, `run.ts`,
  `items.ts`, `tms.ts`. Contract in `src/data/README.md`.
- `src/scenes/` – `BootScene.ts`, `MainMenuScene.ts`, `StarterScene.ts`,
  `RouteScene.ts`, `BattleScene.ts`, `RunOverScene.ts`, `SettingsScene.ts` (later:
  `BoxScene`).
- `src/render/`, `src/input/`, `src/audio/` – Phaser-side helpers, created as
  each phase needs them.
- `src/assets/` – atlas sheets, sprites and manifests. Contract in
  `src/assets/README.md`.
- `scripts/` – `build-dex.mjs` and `legacy-art/` (the imported art pipeline).
- `docs/` – the specs above, `balance/` for spreadsheets.
- `TODO.md`, `CHANGELOG.md`.

## Multi-agent workflow

Work is cut into **batches** of parallel tasks and one seed stays reproducible.
Roles live in `.agent_roles/`, are wired in `opencode.json`, and are described in
full in that folder. The human talks only to the **Orchestrator**; the Orchestrator
drives the rest.

- **Roles.** `orchestrator` (primary), `architect` (read-only on the codebase),
  `dev` (TypeScript, launched once per task), `qa`. There is no artist role: art is
  either procedural or imported and both are ordinary `dev` tasks.
- **Batches.** The Architect cuts a batch out of the backlog so that no two tasks in
  it touch the same path and no task needs a file a batch-mate produces. Hot files
  are serial resources: `package.json`, `src/main.ts`, `vite.config.ts`, each
  `src/scenes/*.ts` a batch touches, `src/data/dex/**` and any generated data file —
  at most one task per batch claims each, and the plan names who holds it.
- **Worktrees.** One per task, outside the repo as siblings:
  `git worktree add ../wt-pkm-<ID> -b task-<ID>` (note `wt-pkm-`, `wt-task-` belongs
  to a sibling project). Agents work only inside their own worktree.
- **Specs.** The Architect writes `.agent_specs/task-<ID>.md` following
  `docs/agent-spec-template.md`. `.agent_specs/` is gitignored and local to the run;
  the Orchestrator copies the spec into the worktree before launching its agent. A
  subagent receives **only** its spec path plus `AGENTS.md` — never the parent
  conversation. The spec must be enough for someone who has read nothing else.
- **Task IDs** are bound to tasks only in `TODO.md`. Everywhere else a task is
  referenced by name.

## Workflow
- Backlog and phases live in `TODO.md`. Pick the next open task and work it on its
  own branch off `main` (e.g. `feature/phase1-route-generator`, or `task-<ID>` when
  it is part of an agent batch). Completed items move to `CHANGELOG.md`, grouped by
  phase.
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
- `main` moves only through the Orchestrator's batch merges, after QA approves the
  batch: one `git merge --no-ff task-<ID>` per task in ID order, with the full gate
  `npm test` + `npm run build` green after each merge. An authoring role (Architect,
  Dev, QA) never merges its own work and never commits to `main`.
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
  never be redistributed. Audio follows the same rule: the rip lives in the
  gitignored `sprite-sources/frlg-audio/`, only `src/assets/audio/*.wav` is
  committed (`node scripts/frlg/build-audio.mjs`), and every cue is named in
  `src/audio/cues.ts`, so a CC0 set can replace the assets without touching a
  call site.
- Performance: no per-frame allocations in hot paths (movement, fog, geometry);
  keep a route to a single screen unless a chapter explicitly needs scroll.

## Communication
- Reply to the user in the chat in Spanish.

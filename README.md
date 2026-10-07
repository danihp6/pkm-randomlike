# PokeRandomLike

A browser Pokémon roguelike: you walk procedural **routes** with a party you can
only replace by catching, trainers on the map see you and open a classic menu
battle, and every Pokémon you lose is lost **forever**.

- `docs/design-spec.md` — gameplay source of truth.
- `docs/battle-spec.md` — the menu battle (fight / bag / switch / run), capture, permadeath.
- `docs/routes-spec.md` — procedural routes, tall grass, trainer sight, run structure.
- `docs/tileset-spec.md` — the swappable-tileset contract and autotiling.
- `docs/showdown-reuse.md` — what we take from Showdown and what we extend.
- `docs/data-spec.md` — content layout and the dex pipeline.
- `docs/art-direction.md` — art tiers and the licence line.
- `docs/tech-decisions.md` — `D1`..`D18` and the open questions.
- `TODO.md` — what is open, by phase. `CHANGELOG.md` — what shipped.

## Run it

```
npm install
npm run dev        # http://localhost:5175
npm test           # pure-logic tests (Vitest)
npm run build      # tsc --noEmit && vite build
npm run data:dex   # regenerate src/data/dex from @pkmn/dex (rarely needed)
```

The current build generates a route procedurally from a dev seed: the arrow keys
(or WASD) step the grid (ledges jump down one-way), the camera follows, tall
grass rolls wild-encounter messages, and trainers trigger on their sight line.
`Esc` opens a pause menu with Settings and Reset; on a touch screen an on-screen
direction pad and A / B buttons appear along the bottom (A = confirm, B = cancel)
and the phone's own Back gesture opens that same menu. The battle scene is still
a placeholder (Phase 3).

## Status

Phases 0-2 (scaffold, dex accessors, route generation & exploration) are done
and archived in `CHANGELOG.md`. Next: Phase 3, the battle engine core (`TODO.md`).

## Licence note

Biome tilesets and Pokémon sprites under `src/assets/` are Pokémon game rips kept
for local development only and are **not redistributable**. The procedural
placeholder sheet is generated and safe. Details in `docs/art-direction.md`.

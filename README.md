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

## Layout

Every folder under `src/` carries a README as its contract.

- `src/engine/` — the pure rules (no Phaser, no DOM): generators, battle and run state.
  Contract in `src/engine/README.md`.
- `src/data/` — everything balanceable: the hand-authored tables here and the generated dex
  in `src/data/dex/` (`src/data/dex/README.md`). Contract in `src/data/README.md`.
- `src/scenes/` — one Phaser scene per file, registered in `src/main.ts`. Contract in
  `src/scenes/README.md`.
- `src/ui/` — the HUD, panels and windows and their pure models. Contract in
  `src/ui/README.md`.
- `src/render/` — Phaser-free animation and geometry registries over the committed atlases.
  Contract in `src/render/README.md`.
- `src/input/` — the keyboard layer that turns presses into actions. Contract in
  `src/input/README.md`.
- `src/dev/` — dev-only tooling behind the developer gate. Contract in
  `src/dev/README.md`.
- `src/assets/` — atlas sheets, sprites and their manifests. Contract in
  `src/assets/README.md`.
- `scripts/` — the dex/art build scripts and the imported art pipeline.
- `docs/` — the specs above, plus the balance spreadsheets in `docs/balance/`
  (`docs/balance/README.md`).

## Run it

```
npm install
npm run dev        # http://localhost:5175
npm test           # pure-logic tests (Vitest)
npm run lint       # Prettier format check
npm run build      # tsc --noEmit && vite build
npm run assets:pack  # optional: real art, from a local pkrl-assets/sprite-sources store
npm run data:dex   # regenerate src/data/dex from @pkmn/dex (rarely needed)
```

## Deploy

The site is hosted on S3 + CloudFront at https://pokerandomlike.herreteam.com,
with DNS in Cloudflare. See `infra/README.md`.

```
npm run infra:install   # once: installs infra/node_modules
npm run infra:deploy    # build + cdk deploy --all
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

## Art and licences

This repository ships **no ripped artwork**. The Pokémon sprites, tilesets and
audio cues the private build plays are Nintendo/GameFreak/Chunsoft art: their
source trees live in a private store, every packed output is listed in
`.gitignore`, and a clone without that store builds and runs against the
generated blanks in `src/assets/placeholders/` (`npm run assets:pack` restores
the real art). The procedural and drawn art that does ship is listed in
`src/assets/README.md`; details in `docs/art-direction.md`.

# PokeRandomLike — Roadmap (TODO)

Browser Pokémon roguelike: procedural routes, classic menu battles, permanent
death. Backlog source of truth. One branch per task off `main`.

Legend: `[ ]` open, `[~]` in progress. Only open work lives here; completed items
are archived in `CHANGELOG.md`, grouped by phase. Phases are ordered; a phase is
"playable" when every box in it is ticked.

**Vertical slice (decided, D8):** Phases 1-5 plus the party/economy half of Phase
6 — pick a starter, walk one generated route, fight one wild battle and one
trainer battle through the full menu (fight / bag / switch / run) with capture and
permadeath, take the exit and arrive at a second route. Everything after that is
run structure, presentation and polish.

**Framework established (D1-D18):** Phaser 3 + Vite + TS, pure logic in
`src/engine/`, dex generated from `@pkmn/dex`, own battle engine extending
Showdown's semantics, swappable tilesets, strict permadeath. Reuse of
`pkm-mystery-dungeon-like` is scoped in `docs/tech-decisions.md` (D14).

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Add ESLint + Prettier with a `npm run lint` script once the engine has more
      real code (deferred: TypeScript strict mode covers most of it for now).
- [ ] Add a debug menu skeleton (the `src/dev` gate reads `ENVIRONMENT` and
      `.env.development` is in place).
- [ ] Add a README per code folder as the folders appear (`src/scenes/README.md`,
      `src/render/README.md`, `src/input/README.md`).

## Phase 1 — Dex accessors & data contracts

> Completed work for this phase is archived in `CHANGELOG.md`.

The generated dex is in `src/data/dex/`; this phase wraps it in typed, tested
accessors so the engine never touches raw JSON.

## Phase 2 — Route generation & exploration

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 3 — Battle engine core (pure, headless, tested)

> Completed work for this phase is archived in `CHANGELOG.md`.

The whole menu battle minus per-effect behaviour. Contract in
`docs/battle-spec.md`.

## Phase 4 — Battle effects: abilities, items, weather, terrain

> Completed work for this phase is archived in `CHANGELOG.md`.

Ports of Showdown handlers, in batches, on the hook names in
`docs/showdown-reuse.md` §3.

- [ ] `src/engine/battle/effects/abilities.ts`: the remaining abilities (batch 7+),
      ported from Showdown's handler bodies and tracked as `no-op` in
      `docs/balance/effect-coverage.md`.

## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] `src/scenes/BattleScene.ts`: the real scene — two platforms, HP/XP bars,
      status icons, the message box.
- [ ] Menu: the four commands plus the move list (PP, type), the bag (filtered to
      usable items), the party list (HP, level, status), and the run confirm.
- [ ] Message queue that consumes the engine's event log at a readable pace, with
      a skip (hold a key to fast-forward).
- [ ] Faint, switch, capture and level-up animations; move FX from `moves.png`.
- [ ] Entry transitions: route → battle on trainer sight or a grass encounter,
      battle → route on win/run.
- [ ] Permadeath feedback: the "was released" beat for a fallen Pokémon, and the
      run-over screen when the last one falls.
- [ ] `src/ui/` helpers (bars, panels, text speed) shared with the route HUD.

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] `src/engine/run/state.ts`: the run — seed, route index, party, PC box,
      inventory, beaten trainers, capture counter, level cap.
- [ ] `src/engine/run/chain.ts`: route cadence from `src/data/run.ts` —
      mini-boss every N routes, a boss closing each block, the final boss, and
      the infinite mode branch.
- [ ] `src/engine/run/levelCap.ts`: the per-route cap that clamps XP and gates
      evolution (D9), with tests.
- [ ] `src/engine/run/perms.ts`: what leaves the run state when a Pokémon faints
      (party, box, caches) — the permadeath enforcement point, with tests.
- [ ] `src/engine/run/heal.ts`: the heal stop between routes (HP/PP, PC access,
      no resurrection).
- [ ] Starter pick scene, party/PC screens, and the route HUD (route number, bag,
      party quick view).
- [ ] `src/data/items.ts`: the run's item catalogue and prices.
- [ ] Between-route reward: a pick or a shop, deterministic per seed.
- [ ] Trainer rosters per band (archetypes in `src/data/trainers.ts`).

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] `src/engine/save.ts` + `localStorage`: settings and run-in-progress, with a
      versioned schema and a migration path.
- [ ] Run summary / score screen: routes cleared, catches, casualties, seed.
- [ ] Seed input and a share string for a run.
- [ ] Settings: text speed, volume, keybinds, tileset preference.
- [ ] Accessibility pass: colour-only information audited, HP bars readable
      without colour, full keyboard play, reduced-flash option.
- [ ] Balance pass using `docs/balance/` sheets and the scripted-battle harness.

## Phase 8 — Art, audio & release

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Trainer overworld sheets and battle sprites (see O1 in tech-decisions).
- [ ] `D18`: make `tileSize` a property of `TilesetConfig` and read it in the
      scene, so 16px FRLG atlases and the 24px PMD atlases coexist.
- [ ] Compose FRLG tilesets (outdoor first, then forest/cave/beach) from the
      sources in `sprite-sources/frlg/` and register the new biomes.
- [ ] Adapt the remaining biome tileset configs (desert, apple-woods,
      lush-prairie, beach-cave) and palettes into `src/data/tilesets/`.
- [ ] Route/dungeon generation in the FireRed/LeafGreen style per biome: a
      forest reads like Viridian Forest, a cave like Mt. Moon. The layout style
      follows the route's tileset, not a generic roguelike shape
      (`docs/routes-spec.md` §2, `docs/art-direction.md`).
- [ ] Tall-grass, ledge and route-prop art.
- [ ] Battle background per biome.
- [ ] Audio: route ambience, encounter, hit, faint, level-up, victory.
- [ ] Free-art fallback set so a public build can drop the game rips (O4).
- [ ] Build/publish pass for itch.io.

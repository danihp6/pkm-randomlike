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

**Framework established (D1-D19):** Phaser 3 + Vite + TS, pure logic in
`src/engine/`, dex generated from `@pkmn/dex`, own battle engine extending
Showdown's semantics, swappable tilesets, strict permadeath. Reuse of
`pkm-mystery-dungeon-like` is scoped in `docs/tech-decisions.md` (D14).

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Add ESLint + Prettier with a `npm run lint` script once the engine has more
      real code (deferred: TypeScript strict mode covers most of it for now).
- [ ] Add a README per code folder as the folders appear (`src/scenes/README.md`,
      `src/render/README.md`; `src/input/README.md` shipped with the keybind
      layer).

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


## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Accessibility pass: colour-only information audited, HP bars readable
      without colour, full keyboard play, reduced-flash option.
- [ ] Balance pass using `docs/balance/` sheets and the scripted-battle harness.

## Phase 8 — Art, audio & release

> Completed work for this phase is archived in `CHANGELOG.md`.

### Route generation & FRLG fields (`D26`) — in progress

Shipped: the three biome layouts (`route`, `forest`, `cavern`, `src/engine/routes/layout.ts`),
the whole-object wall motif (`wallPattern`, `src/engine/tileFrames.ts`), the FRLG
floor/pond/ledge atlas and the biome wiring. Open, most useful first:

- [ ] **FRLG ground vs path.** The base floor now matches the game's ground colour
      (`rgb(112,200,160)`, sheet tile `6,1`), but the lighter tiles (`2,3`, `1,3`,
      `1,4`, `2,4`) are a separate grass and the tan `2,0` is the route path.
      Decide which is ground, which is the path and which is decoration, and give
      the generator a real path to draw through a route (the current routes are
      all-ground with no path tile).
- [ ] **Tree wall holes.** `wallPattern` draws a three-wide tree that stacks
      vertically, but the tree bank's canopy-top row still leaks a little ground
      between stacked tops. Bake a solid canopy (or overlap the tops) so a wall
      reads without holes; verify against `map-route01.png` / `map-viridian.png`.
- [ ] **Tall grass.** No source sheet has a tall-grass tile, so `TALL_GRASS`
      still draws plain ground under the procedural overlay
      (`docs/tileset-spec.md` §6). Draw a real tile (the game's is `rgb(64,176,136)`).
- [ ] **Ledge and route props.** The ledge lip shipped (`FRAME_LEDGE`); signs,
      boulders, flowers and the rest of the FRLG props are still missing.
- [ ] **Beach field.** Compose the FRLG beach (open-water and sand tiles) and add
      it to the biome cycle.

### Remaining Phase 8

- [ ] FRLG portraits for the party/HUD/starter/release screens, drawn from the
      packed battle fronts/icons instead of the PMDCollab `portraits.png`.
- [ ] FRLG move and attack FX (`sprite-sources/frlg-ui/move-effects.png`,
      `attack-effects.png`) replacing the PMD `moves.png`.
- [ ] Remove the PMD art once the FRLG replacements land: the `wood.png` tileset
      and its biome, `portraits.png`, `moves.png`, the `pokemon/*.png` sheets and
      the PMD `scripts/legacy-art/` extractors.
- [ ] Adapt the remaining biome tileset configs (desert, apple-woods,
      lush-prairie, beach-cave) and palettes into `src/data/tilesets/`.
- [ ] Battle background per biome (FRLG `battle-backgrounds.png`).
- [ ] Audio: route ambience, encounter, hit, faint, level-up, victory.
- [ ] Free-art fallback set so a public build can drop the game rips (O4).
- [ ] Build/publish pass for itch.io.

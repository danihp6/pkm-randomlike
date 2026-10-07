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

The generator carves the shape's lanes out of a solid forest and has no population
(`docs/routes-spec.md` §2). The target algorithm, its guarantees and its open
questions are in `docs/route-generator.md`; these are the steps to get there, one
branch each, most useful first. The art counterparts (a real tall-grass tile, the
floor/path split, props) stay in Phase 8 "Route generation & FRLG fields".

- [ ] **Step 6 — Trainers (optional).** Restore the `RouteTrainer` type and the
      line-of-sight module (`src/engine/routes/trainers.ts`), place trainers off
      the spine with a facing, sight and archetype, and keep a trainer-free
      entry→every-exit path. Tests: every trainer is avoidable, `seesPlayer` works.
- [ ] **Step 8 — Validation hardening.** Grow `validateRoute` to the full
      checklist (every exit, trainer-free path, items, clean spine, pockets,
      border) and reroll within `BUILD_ATTEMPTS` before throwing. Fixed-seed tests
      per shape.
- [ ] **Step 9 — Scene wiring (trainers).** Draw trainers and restore the
      line-of-sight trigger in `src/scenes/RouteScene.ts`, make **any exit** end
      the route, and keep the tall-grass encounter roll. Ground items (draw,
      interact pickup, HUD hint) already ship.
- [ ] **Step 10 — Docs pass.** Update `docs/routes-spec.md` and `AGENTS.md` to the
      shipped algorithm, mark `docs/route-generator.md` implemented and archive
      these steps in `CHANGELOG.md`.

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

Shipped: the whole-object wall motif (`wallPattern`, `src/engine/tileFrames.ts`)
drawn with the real 3x4 FireRed tree (each crown stacks on the lower leaves of the
tree above, the body hides the trunk and only the foot shows the platform), the
FRLG floor/pond/ledge atlas, the biome wiring, a follow camera, and every route
built by **carving the shape's lanes out of a solid tree interior** — openings
punched in the one-tile border, wide, chamber-ended branches — with no fog of war.
The default map is 20x20 for now and the beyond-the-edge tree frame (`padMap`) is
parked while the generator is the focus. The `hedges`/`maze` carvers and the
terrain passes (tall grass, ledges) are kept but off; water is decoration. Open,
most useful first:

- [ ] **Route interiors.** Bring shape back per biome: re-enable the `hedges`
      (Route 1) and `maze` (Viridian Forest, Mt. Moon) carvers once the carved
      lanes have served their purpose; the biome terrain passes are on again
      (Phase 2 step 5). Generator logic tracked in Phase 2 steps 6-8.

- [ ] **FRLG ground vs path.** The outdoor base floor matches the game's ground
      colour (`rgb(112,200,160)`, sheet tile `6,1`) and the forest mixes its darker
      ground tiles with weights (`rgb(88,160,128)`: `0,34` base, `2,34`/`3,34`/`5,34`
      variety, the flowered `0,38` rare). The lighter tiles (`2,3`, `1,3`,
      `1,4`, `2,4`) are a separate grass and the tan `2,0` is the route path.
      Decide which is ground, which is the path and which is decoration, and give
      the generator a real path to draw through a route (the current routes are
      all-ground with no path tile).
- [ ] **Route exit art.** The exit is a plain floor **opening** punched in the tree
      border (no special tile, and it does not end the route yet). Give an outdoor
      route a real exit marker/opening and restore the end-of-route beat.
- [ ] **Ledge and route props.** The ledge lip shipped (`FRAME_LEDGE`); signs,
      boulders, flowers and the rest of the FRLG props are still missing.
- [ ] **Beach field.** Compose the FRLG beach (open-water and sand tiles) and add
      it to the biome cycle.

### Remaining Phase 8

- [ ] **Añil forme sprites.** The battle sheets name a forme `SPECIES_N.png` with
      the form's Spanish name in `PBS/pokemon_forms.txt`, so a forme whose file
      is not `<id>.png` currently draws its base species (`D27`). Build the
      Spanish→dex forme table in `scripts/anil/build-pokemon-sprites.mjs` so
      Alola/Galar/Hisui/Paldea forms, megas, Vivillon patterns, Oricorio, Minior,
      Alcremie and the rest use their own art. No run spawns a forme today, so
      this is art completeness, not a visible bug.
- [ ] **Battle mon size and ground line.** Añil's sheets are native-sized (30-248
      px) and the battle caps the scale, but the sprite is still centre-anchored
      on its platform: use Añil's `PBS/pokemon_metrics.txt` (front/back offsets,
      female/forms variants) so every mon's feet sit on the platform.
- [ ] Party/HUD/starter/release portraits drawn from the Anil battle icons
      (`public/anil/icons/`) instead of the PMDCollab `portraits.png`.
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

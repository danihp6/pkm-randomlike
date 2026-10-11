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

The generator carves the shape's lanes out of a solid forest; trainers and ground
items are placed by the population pass (`docs/routes-spec.md` §2). The target
algorithm, its guarantees and its open questions are in
`docs/route-generator.md`; these are the steps to get there, one branch each,
most useful first. The art counterparts (a real tall-grass tile, the
floor/path split, props) stay in Phase 8 "Route generation & FRLG fields".

- [ ] **Step 8 — Validation hardening.** Grow `validateRoute` to the full
      checklist (every exit, trainer-free path, items, clean spine, pockets,
      border) and reroll within `BUILD_ATTEMPTS` before throwing. Fixed-seed tests
      per shape.
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

- [ ] **Reachable-but-unported effects.** The full National Dex (`D40`) and the
      full move set (`D42`) make ~24 abilities and many `Past` moves meetable that
      are not ported yet — the `no-op` rows of `docs/balance/effect-coverage.md`
      plus any move the dev build warns about. A damaging move resolves its base
      damage generically, but a status move or listed ability without a handler is
      a silent no-op until ported. Port them so the develop-build warnings clear.


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

- [ ] **Battle mon size and ground line.** Añil's sheets are native-sized (30-248
      px) and the battle caps the scale, but the sprite is still centre-anchored
      on its platform: use Añil's `PBS/pokemon_metrics.txt` (front/back offsets,
      female/forms variants) so every mon's feet sit on the platform.
- [ ] **Animated portraits.** The party/HUD portraits are the icons' first frame;
      the icons ship two, so the HUD could breathe like the battle sprites.
- [ ] FRLG move and attack FX (`sprite-sources/frlg-ui/move-effects.png`,
      `attack-effects.png`) replacing the PMD `moves.png`.
- [ ] Remove the PMD art once the FRLG replacements land: the `wood.png` tileset
      and its biome, `moves.png`, the `pokemon/*.png` sheets and the PMD
      `scripts/legacy-art/` extractors.
- [ ] Adapt the remaining biome tileset configs (desert, apple-woods,
      lush-prairie, beach-cave) and palettes into `src/data/tilesets/`.
- [ ] Battle background per biome (FRLG `battle-backgrounds.png`).
- [ ] Audio: route ambience, encounter, hit, faint, level-up, victory.
- [ ] Free-art fallback set so a public build can drop the game rips (O4).
- [ ] Build/publish pass for itch.io.

## Phase 9 — Maps (route groups), biomes & progression

> Completed work for this phase is archived in `CHANGELOG.md`.

A **map** is a Binding of Isaac-style floor: a grid of routes (rooms) of one
random biome, closed into at least one cycle, with its own level range, special
rooms (shop, mini-boss, mega-stone) and a boss on the room farthest from the entry
that opens the portal to the next map. This phase reworks the flat route chain
into these floors and adds the Poké Dollar economy. Source of truth:
`docs/maps-spec.md`; decisions D28–D33. Steps are ordered — each is one branch off
`main`, most useful first.

- [x] **Step 1 — Map tuning tables (`src/data/maps.ts`).** The per-map level
      range, route-count range and route-size range, with `mapTuning`,
      `levelRangeForMap`, `levelCapForMap`, `routeCountRangeForMap`,
      `routeSizeRangeForMap` and the `MAP_TUNING_STEP` extrapolation an infinite
      run walks past the last row. Data only; balancing never touches the
      generator (`docs/maps-spec.md` §4). Tests in `src/data/maps.test.ts`.
- [x] **Step 2 — `MapPlan` floor generator (`src/engine/maps/plan.ts` +
      `streams`).** `Plan(seed, mapIndex)` rolls the biome (never the previous
      map's), the room count and each room's width/height, grows the floor on a
      grid from the entry, closes **one or more cycles** (random, at least one),
      derives each room's opening
      set and shape, and marks the boss as the room farthest from the entry. New
      `map` stream keyed `(seed, "map", mapIndex)`; fixed-seed determinism,
      connectivity, cycle and no-dangling-opening tests.
- [x] **Step 3 — Route shapes from the opening set.** Add the `dead-end`,
      `corridor` and `tee` shapes to `layout.ts` beside `straight` / `bend` /
      `cross`, and let the route builder take the opening set from the plan
      instead of rolling a shape: every opening is the grid neighbour's
      **opposite** edge, aligned to the same border band. Per-shape and
      connection regression tests.
- [x] **Step 4 — Plan-driven route size.** `buildRoute` takes its width/height
      from the plan (the map's size range, rolled independently) instead of the
      fixed 20x20; confirm the terrain/branch tiers, the camera bounds and the
      beyond-edge margin (`padMap`) still hold. Fixed-seed regression per size.
- [x] **Step 5 — Per-map levels & cap.** Wild encounters and trainer rosters read
      the map band (rooms ramp `minLevel → maxLevel`); `levelCap` becomes the map
      cap (`levelCapForMap`) and the XP/evolution clamps follow it. Migrate the
      `bandForRoute` / `levelCapForRoute` callers; fixed-seed roster tests.
- [x] **Step 6 — Run state: floors & discovery.** `RunState` gains `mapIndex`,
      `routeInMap` and the discovered-room set beside the global `routeIndex`;
      `advanceRoute` vs `advanceMap` (heal stop per map) and a save migration
      (`SAVE_VERSION`). Pure tests, including the discovery rule.
- [x] **Step 7 — Boss & portal.** The room farthest from the entry fields the map
      boss at `maxLevel`; the boss room has no onward opening, and when the boss
      falls a **new opening appears with the portal** that advances to the next
      map (final boss ends a finite run). Pure guard/portal logic + `RouteScene`
      wiring.
- [x] **Step 8 — Route HUD minimap.** A HUD panel drawing the floor as a BoI-style
      grid of rooms — a cell per discovered room from its size and shape, its
      openings on the matching walls, links between known neighbours, the current
      room highlighted and the boss/portal and each special room marked with its
      **own icon**. Pure layout in `src/ui/mapView.ts` + tests; the scene only
      draws it (`docs/maps-spec.md` §8).
- [x] **Step 9 — Mega Evolution in battle (`D34`).** The prerequisite for the
      Mega Stones: a Pokémon holding its stone may Mega Evolve **once per battle**
      from a command-menu control (player and AI), changing stats/type/ability to
      the Mega forme for the battle. All dex Megas (formes may be nonstandard);
      only bosses, mini-bosses and the `ace` archetype carry stones. Engine +
      data + battle UI, fixed-seed tests.
- [ ] **Step 14 — Docs & migration pass.** Finish `docs/maps-spec.md`, update
      `design-spec.md` / `routes-spec.md` / `battle-spec.md` / `AGENTS.md` and the
      tech decision addenda, and archive the steps in `CHANGELOG.md`.

## Phase 10 - Learnset, TMs & move typing

> The learnset panel, the TM catalogue and the effective-type rules shipped;
> these are the follow-ups (`D36`/`D37`).

- [ ] **TM acquisition breadth.** TMs only drop from route loot and mini-boss
      rewards today. A proper TM Machine (or a per-band TM slot in the shop) and a
      real machine icon � every TM borrows the sheet's question mark until then �
      are still open.
- [ ] **Remaining item-driven move retypes.** Judgment + the seventeen Plates
      shipped; Multi-Attack (Memories), Techno Blast (Drives) and Natural Gift
      (berries) have no move in the Gen 9 dex this build ships, so they wait on a
      future dex. All would hook the same `onModifyMoveType` path as the Plates.
      The Plates themselves are not obtainable until an Arceus-tier source lands.
- [ ] **Relearn UI for the bench.** The learnset panel covers the panel's four
      slots; a Move-Relearner style screen for the whole party is not planned yet.
- [ ] **Hidden Power's type.** `moves.json` ships Hidden Power as a single Normal
      entry (`D42`); model its type from the holder's IVs so the 17 typings mean
      something again.
- [ ] **Max and Z moves.** Dynamax and Z mechanics are not modelled, so their
      moves are left out of `moves.json` (`D42`). Nothing to do unless a Dynamax or
      Z-Move mechanic ever lands.

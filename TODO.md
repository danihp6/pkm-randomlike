# PokeRandomLike — Roadmap (TODO)

Browser Pokémon roguelike: procedural routes, classic menu battles, permanent
death. Backlog source of truth. One branch per task off `main` (`feature/...` or
`task-<ID>` for an agent batch).

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
- [ ] Add a README per code folder as the folders appear. Shipped: `src/input/`,
      `src/data/`, `src/data/dex/`, `src/assets/`. Missing: `src/engine/`,
      `src/scenes/`, `src/render/`, `src/ui/`, `src/dev/`.

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

- [ ] **Step 8 — Validation hardening.** The reroll already exists (`sketchRoute`
      iterates `MAX_ATTEMPTS` on fresh streams) and `validateRoute` already proves
      every exit reachable and a trainer-free entry→exit path. What is left is the
      rest of the checklist — items off grass and ledges, pockets reachable, border
      intact — plus fixed-seed tests per shape.
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
- [ ] **Move-effect coverage table.** `docs/balance/effect-coverage.md` tracks
      every ability and item (`D16`) but **not moves**, so the non-trivial move
      long tail (~160 utility/status moves that need a handler) is unaudited —
      the gap `docs/showdown-reuse.md` §3 flags. Extend
      `scripts/effect-coverage.mjs` to classify every move as `port | no-op |
      excluded`, deriving `port` from the effect registry, the ids the turn loop
      special-cases and the data-driven fields the engine reads, then emit the
      section and let a develop build warn when a battle meets an unported move
      (the registry warns for abilities and items only today, `registry.ts`).
- [ ] **The competitive held items, with Añil's icons.** The run's held-item
      catalogue is a slice of the competitive set (24 `kind: 'held'` entries in
      `src/data/items.ts`) and their icons all come from the FRLG sheet
      (`src/data/itemIcons.ts` → `src/assets/frlg/item-icons.png`), which has no art
      for the modern ones — the Mega Stones, valuables, TMs and Plates already
      borrow placeholders. Bring the whole held-item set over from Añil: its
      `sprite-sources/anil/PBS/items.txt` for the definitions and its 911
      `sprite-sources/anil/Graphics/Items/*.png` for the art. That is three pieces:
      the catalogue entries in `src/data/items.ts` with the fields the engine reads;
      the effect handlers in `src/engine/battle/effects/items.ts` with their row in
      `docs/balance/effect-coverage.md` (`D16` — `port`, `no-op` or `excluded`, and
      `no-op` is the honest answer for an item a run can meet that the engine does
      not model yet); and a packer script (`scripts/anil/build-item-icons.mjs`)
      writing `src/assets/anil/item-icons.png` plus its manifest, read by
      `src/data/itemIcons.ts`. Make them **obtainable** wherever the run hands out
      items — `src/data/loot.ts` (route loot by band), `src/data/shop.ts` (the Mart)
      and `src/ui/rewards.ts` (the mini-boss choice) — and keep the item tests
      green.


## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Accessibility pass: colour-only information audited, HP bars readable
      without colour, full keyboard play, reduced-flash option.
- [ ] Balance pass using `docs/balance/` sheets and the scripted-battle harness.
- [ ] **Floor trainer XP reaches the floor's cap.** Beating roughly **75 %** of a
      floor's trainers must award the XP the squad needs to reach that floor's
      **level cap** (`levelCapForMap`, `src/data/maps.ts`), so the party keeps pace
      with the band by fighting rather than grinding wild encounters. Today the
      award is level-driven only (`experienceAward`, `src/engine/run/progression.ts`:
      `level * 5`, ×1.5 for a trainer, split by participants), while the trainers a
      floor offers vary with its rooms and their sizes (the per-room placement in
      `placeTrainers`, `src/engine/routes/sketch.ts`, plus `trainerBonusForSize` in
      `src/data/mapSize.ts`). Decide where the rule lives — a per-band trainer XP
      multiplier in `src/data/run.ts`, a per-archetype yield in
      `src/data/trainers.ts`, or the band itself — and prove it with a pure,
      fixed-seed test that walks every map of a finite run and asserts the
      75 %-of-trainers total lands the squad at the cap, within a tolerance the
      test states. Write `docs/balance/route-curve.md` (level bands, caps, roster
      sizes, per-floor trainer counts and this rule): `docs/balance/README.md`
      lists it, but the file does not exist.
- [ ] **Audio: music and sound.** Route ambience and encounter, hit, faint,
      level-up and victory cues, plus the music. The `volume` setting exists in
      the save; `src/audio/` does not exist yet.
- [ ] **Ability info popup.** The STATS tab prints the ability as plain text
      (`MemberDetail.ability`, `src/ui/partyDetail.ts`) and there is no way to read
      what it does. Give the ability row the same ⓘ control the move cells have —
      `src/ui/moveGrid.ts`'s info button and floating popup over an FRLG window —
      so hovering or clicking it floats the ability's description. Reach every
      panel that prints an ability: the route HUD's detail panel
      (`src/scenes/RouteScene.ts`), the battle's SWITCH detail window and the
      capture screen (`src/scenes/BattleScene.ts`, `RouteScene`). The data is
      already generated — `src/data/dex/abilities.json` carries `desc` and
      `shortDesc`, but the accessor drops them (`src/data/dex/abilities.ts` exposes
      only `id` and `name`), so widen it and guard the two fields in
      `src/data/dex/abilities.test.ts`. Document in `docs/design-spec.md` §3/§4.
- [ ] **Nicknames, typed from the STATS tab.** The battle layer already renders one
      — `FighterInput.nickname` feeds `fighter.name` (`name: input.nickname ??
      species.name`, `src/engine/battle/fighter.ts`) — but nothing ever sets it, so
      every member shows its species name. Add a nickname the player types from the
      STATS tab (`src/ui/partyDetail.ts` and its detail panel in
      `src/scenes/RouteScene.ts`), shown wherever a member is named (party rows, HUD,
      battle, capture screen) and clearable back to the species name. It must
      survive Mega Evolution and every forme change: `changeBattleForm` rewrites
      `fighter.name` with the forme's name and restores it from `megaBackup.name`
      (`fighter.ts`), so the nickname needs **its own field, not `name`**. Persist
      it: `FighterSnapshot` carries no name at all today, so the save gains one (a
      `SAVE_VERSION` bump plus a migration that leaves it undefined) and
      `runPokemonFromSnapshot` / `adoptBattleParty` thread it through. Text entry
      follows the repo's DOM-overlay precedent (`src/ui/seedPrompt.ts`'s field, or
      the on-screen keyboard the touch build would need — decide it here). Docs:
      `docs/design-spec.md` §3, `docs/battle-spec.md` §7.

## Phase 8 — Biomes & art assets

> The FRLG art pass (route interiors, ground vs path, exit art, ledge and route
> props, beach, animated portraits, FRLG move/attack FX replacing the PMD art,
> per-biome battle backgrounds) and the release chores are out of the backlog; what
> shipped stays in `CHANGELOG.md`.

Only `forest` is in `BIOME_ORDER` even though `BIOMES` defines five, so the run
cycles one biome.

- [ ] **New biomes.** Decide which biomes join the cycle and add them: a tileset
      config and palette in `src/data/tilesets/`, a `BIOMES` entry with its `layout`
      and its `terrain` passes, and a slot in `BIOME_ORDER` (`D10`). Candidate list
      to decide: desert, prairie/plains, beach, autumn woods, marsh/rain, snow,
      volcano, ruins/power plant. Each new biome owes a fixed-seed generator
      regression.
- [ ] **Añil type and status badges.** The battle menu, the party panels and the
      starter cards draw the FRLG badges (`src/data/typeIcons.ts`,
      `src/data/statusIcons.ts`, packed from `scripts/frlg/build-type-icons.mjs`
      and `build-status-icons.mjs`), and the FRLG sheet predates Fairy, so a Fairy
      type falls back to a text chip. Repack from Añil's
      `Graphics/UI/types.png` / `statuses.png` (and
      `Graphics/UI/Battle/icon_types.png`, `icon_statuses.png`) so every type,
      Fairy included, has a badge, and update both accessors plus the badge note
      in `docs/art-direction.md`.
- [ ] **Modernise the panel and menu chrome.** Every window in the game is the
      FRLG frame: one `addFrlgWindow` (`src/ui/frlg.ts`) slicing
      `src/assets/frlg/window.png` and `textbox.png`, used by the main menu, the
      starter pick, the settings screen, the run-over screen, every route HUD panel
      (party, bag, PC box, detail, pause, capture, Mart, reward) and the battle
      menus and HP panels (`moveGrid` included). Redraw that chrome as a modern set
      that keeps the originals' shapes and bezel as its base, with a **baked
      translucency** so the route and the battle stay legible with the panels open
      — building on what the `hudTransparent` setting does today, which is an
      all-or-nothing alpha plus an outline on the route HUD only. Update
      `src/ui/frlg.ts` (frame, corner radius and paddings), the new assets under
      `src/assets/`, and the panel notes in `docs/art-direction.md`,
      `docs/design-spec.md` §3/§4 and `src/assets/README.md`. Take the **type as
      well**: every string is the FRLG bitmap face (`src/ui/frlgFont.ts` slicing
      `src/assets/frlg/font.png`, drawn by `addFrlgText`), so pick the modernised
      face and rework `FRLG_INK` with it. Lean on **deep black tones** rather than
      the current navy (`FRLG_INK` is `0x25243b`) — for the panel interior, the
      border and the text, on both the light windows and the light-on-map text the
      transparent HUD draws. Decide at the same time whether `hudTransparent`
      survives as a preference or becomes a degree (a transparent-HUD step) over the
      new art. If the new chrome is drawn rather than ripped it also gives the public
      build a UI, which `O4` wants.

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
- [ ] **Gigantamax, in the Mega Evolution mould.** Model Gigantamax the way the
      Megas work (`src/engine/battle/mega.ts`, `D34`): once per battle a holder may
      change to its G-Max forme, taking that forme's stats/types/ability **before
      any move**, and revert when the battle ends (`snapshotFighter` keeps the base
      species). The G-Max formes are **not in the build at all** today —
      `isBattleBossForm` in `scripts/build-dex.mjs` excludes every Gmax/Eternamax
      forme from the playable species — so they must be generated beside the
      playable set, a `gmaxes.json` next to `megas.json` (`src/data/dex/megas.ts`),
      with their art. **The stats are Añil's rule, not a
      G-Max stat table**: as in Sword/Shield, Gigantamax only **doubles HP** and
      leaves every other stat alone — which is what the dex's own G-Max formes
      encode (`charizardgmax` and `pikachugmax` carry `baseStats` identical to
      their base species; the ×2 lives in the Dynamax mechanic, never in the data).
      So a G-Max forme keeps the base species' stats, types and ability, and the
      doubling is applied by the mechanic the way Añil does it. Añil is also the
      source for the G-Max art and its sprite placement
      (`sprite-sources/anil/PBS/pokemon_metrics_gmax.txt` and the numbered form
      sprites `Graphics/Pokemon/Front/<SPECIES>_<n>.png`). Max moves stay unmodelled
      (`D42`): decide here whether a G-Max forme keeps its normal moves or the task
      also brings its G-Max move. Needs a decision entry, `docs/battle-spec.md`, and
      tests (fixed seed, once per battle, the HP doubling, the revert).
- [ ] **Legends Z-A and Champions Megas.** The build ships only the 48 classic
      Megas (`src/data/dex/megas.json`, `D40`); the ones Legends Z-A and Champions
      added are missing. They are **already in the dex**: `@pkmn/dex` 0.10.11 lists
      **49** further formes tagged `isNonstandard: "Future"` — Dragonite, Meganium,
      Feraligatr, Emboar, Excadrill, Skarmory, Chandelure, Chesnaught, Delphox,
      Greninja, Pyroar, Malamar, Hawlucha, Drampa, Falinks, Baxcalibur, Heatran,
      Darkrai, Zeraora, Zygarde, Magearna, the three Tatsugiri, Meowstic F,
      Raichu X/Y, Lucario Z, Garchomp Z, Absol Z and the rest — baseStats, types and
      abilities included. Our own filter drops them: `isMega` in
      `scripts/build-dex.mjs` only accepts `isNonstandard === 'Past'` and the general
      species pass excludes `Future`. Decide the rule (take every `Future` Mega, or a
      named whitelist) and regenerate: `npm run data:dex`, the battle art
      (`npm run data:anil`) and the Mega Stones `src/data/items.ts` builds one per
      forme. Check the new formes against `carriesMega` / `RosterOptions.allowMega`
      (`src/engine/run/roster.ts`) so bosses, mini-bosses and the `ace` can carry
      them, keep a fixed-seed roster test green, and say in the docs that `Future`
      is the dex's own "announced, not released" tag.
- [ ] **The Rotom appliances as evolutions.** Rotom's five appliance formes are in
      the dex as species of their own — `rotomheat`, `rotomwash`, `rotomfrost`,
      `rotomfan`, `rotommow` in `src/data/dex/species.json`, each with its own stats,
      type and `Levitate` — but they carry no `prevo` and no `evolutions`, so the
      family graph never shows them (`evolutionFamily`, `src/data/dex/evolutions.ts`)
      and there is no way to reach one from a Rotom. Make them an evolution the
      player takes by click, the way every other one works (`D38`; the STATS tab
      graph, `src/ui/evolutionGraph.ts`): Rotom gains a branch per appliance and the
      click applies the forme change, keeping the member's level, nature, IVs/EVs,
      moves, PP, status and held item. **One-way, Eevee-style**: Rotom picks one
      appliance and keeps it, like Eevee's eight branches — the base form offers all
      five, a forme offers none. The branches take the base form's stage level
      (`speciesEvolutionLevel` → 20) through `evolutionLevel`, so there is no level
      left to decide. The forme data is hand-authored — `evolutionOf` in
      `scripts/build-dex.mjs` only reads the dex's `evos`, which is empty here — so
      the task says where that override lives. Keep the fixed-seed evolution tests
      green.
- [ ] **The Megas as information in the STATS graph.** The family graph draws
      evolutions only (`evolutionGraph`, `src/ui/evolutionGraph.ts`), and a Mega is
      not one: it is battle-only (`D34`, `src/engine/battle/mega.ts`) and entered
      from a stone. So a member whose species has a Mega shows no trace of it in the
      STATS tab. Add the Mega as an **information row** hanging off its base species:
      the forme's sprite and name plus "Mega Evolves while holding <stone>", drawn at
      the same indent as an evolution — and **never clickable**, with no pointer
      cursor and no `ready` node, because nothing about the member changes here. The
      data already exists: `megaFormsForBase` (`src/data/dex/megas.ts`) returns every
      Mega of a species in dex order (Charizard's two included) and each carries
      `stoneName`, with the stone built per forme in `src/data/items.ts`. So the
      graph gains a node kind, not a new source. **Several Megas are several rows**,
      branching off the base species the way Eevee's eight evolutions do, so
      Charizard shows `Mega Charizard X` and `Mega Charizard Y` side by side, each
      with its own stone. One call left to make: how the row reads when the member
      does **not** hold the stone (dimmed with the same text, or hidden). A
      Gigantamax forme, if that task lands, is the same kind of row. Docs:
      `docs/design-spec.md` §3 and `docs/battle-spec.md` §9; graph tests for the new
      rows.

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

## Phase 11 — Localisation (i18n)

> English is the source table; a locale overlays it by key. New decision `D43`.

No player-facing string is translated today: every one is a literal in a scene or
a UI helper. The target is English plus Spanish.

- [ ] **i18n module and the Spanish locale.** A pure, headless-tested locale layer
      (`src/i18n/`: a typed key table, `en` as the source, `es` as an overlay, and a
      `t(key, params)` with named interpolation, no Phaser import), plus the sweep
      that moves every literal behind a key: the main menu, the starter pick, the
      settings screen, the run-over screen, the route HUD (party, bag, PC box,
      detail, pause, capture, Mart, reward), the battle menus and messages, and the
      dev panel. A `language` setting in `src/engine/save.ts` — defaulting from the
      browser locale and applied without a `SAVE_VERSION` bump, like `alwaysRun` —
      with its row in `src/ui/settingsScreen.ts`. Tests: `en`/`es` key parity both
      ways, no unresolved interpolation, and the settings round-trip. Scope call to
      take here: **the dex's own names stay English** (`@pkmn/dex` ships English
      only), so localising Pokémon, move, ability and item names is a separate and
      much larger job. Needs `D43` in `docs/tech-decisions.md` and a line in
      `docs/design-spec.md` §7; `AGENTS.md`'s "game text in English" convention
      becomes "English is the source table, a locale overlays by key".

---

## Bugs

Reported in play, awaiting triage. A bug becomes a task in the batch plan, and the
fix is archived in `CHANGELOG.md`. `[PENDING FIXES]` below is a different list: what
a finished batch still owes QA.

- [ ] **Catching a Pokémon stacks a duplicate on top of it.** Catching a wild Pokémon
      leaves a second copy of a member drawn over the caught one. Repro to confirm:
      catch with a **full party** (the capture screen opens) and take both choices —
      *swap* and *send to the PC* — then watch the party, the PC box and the HUD.
      Suspected: the capture placement seam — `resolveBattle`'s `placeCapture`
      (`src/engine/run/resolve.ts`), `addCaughtPokemon` / `swapCaughtIntoParty`
      (`src/engine/run/state.ts`), or `openCapturePrompt`/`refreshCapture` in
      `src/scenes/RouteScene.ts`.

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```


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

## Batch plan

Legend:
- **IDs.** `[Task-NN]` is bound to a task only in this file; everywhere else a task
  is referenced by name. Two digits, in backlog order.
- **Retired IDs.** `[Task-24]` (a Move-Relearner screen for the bench) was retired:
  the learnset panel already covers its four slots, so the screen is not wanted. A
  retired ID is **never reused** — new work takes the next unused number — so the
  sequence stays in backlog order but is no longer gapless.
- **Dependencies.** Every open item ends with `*Dependencies:*` — the authoritative
  graph. A dependency exists only when a task cannot be written without a file, type,
  generated asset or data table another task produces. Phase order is *not* a
  dependency.
- **Batches.** A batch is an antichain: no task in it depends on another task in it,
  and no two tasks in it create or modify the same path. A batch is a label on the
  open items, not a rewrite of the backlog. Batches run in order: a task's branch is
  cut from `main` once every earlier batch is merged, and the Orchestrator merges one
  task at a time, in ID order.
- **Hot files.** At most one task per batch claims `package.json`, `src/main.ts`,
  `vite.config.ts`, a given `src/scenes/*.ts`, `src/data/dex/**` or any other
  generated file (the packed atlases under `src/assets/`, `src/data/frlg/*.json`,
  `src/data/anil/*.json`, `docs/balance/effect-coverage.md`). Each batch names its
  holder below.
- **Unscheduled.** An ID that appears in no batch is blocked outside this backlog,
  so it cannot be scheduled however empty the plan looks. `[Task-28]` (activate the
  ESLint half of `npm run lint`) is the only one: it waits on an upstream
  `typescript-eslint` release, not on a decision here.

**Critical path.** Dependency depth is two: with Batch 1 merged, the only chain left
is `Task-07 → Task-23` beside `Task-25 → Task-23`. What serialises the tail is a
shared resource, not a dependency: `Task-18`, `Task-19` and `Task-20` all regenerate
`src/data/dex/**` through `scripts/build-dex.mjs`, `Task-20` and `Task-21` both extend
`src/ui/evolutionGraph.ts`, and `Task-23` writes paths earlier tasks already hold —
`src/data/items.ts` (`Task-07`, `Task-19` and `Task-22`'s TM entries),
`src/data/shop.ts` and `src/data/loot.ts` (`Task-07`, `Task-22`),
`src/engine/battle/effects/items.ts` (`Task-07`), `src/engine/battle/moveType.ts`
(`Task-25`), the `src/data/` numbers (`Task-09`) and the generated
`docs/balance/effect-coverage.md` (`Task-05`, `Task-07`, `Task-09`) — which is why it
sits in Batch 8 rather than beside the item tasks it belongs to. Those three dex tasks
are dependency-free, so the Orchestrator may pull any of them into an earlier batch
whose paths leave `scripts/build-dex.mjs` and `src/data/dex/**` free. `Task-29` (the
Prettier reformat pass, Batch 11) is the other serial resource: it claims every
`src/**` path `.prettierignore` still ledgers, so it runs alone, and last.

### Batch 1 — foundations *(shipped, archived)*
Task-01, Task-02, Task-03, Task-06, Task-10 and Task-11 merged in ID order behind the
green gate; the detail is in `CHANGELOG.md`'s `## Unreleased`. Two follow-ups it
parked are registered below: `[Task-28]` (activate the ESLint half, unscheduled) and
`[Task-29]` (the Prettier reformat pass, Batch 11).

### Batch 2 — docs pass, effect ports, Hidden Power
- **Task-04** Step 10 — docs pass.
- **Task-05** Reachable-but-unported effects.
- **Task-25** Hidden Power's type.
- **Hot files:** the generated `docs/balance/effect-coverage.md` **and** the generated
  `src/data/moveCoverage.json` → Task-05; `AGENTS.md` → Task-04; `src/scenes/RouteScene.ts`
  → Task-25. No task in the batch claims `package.json`, `package-lock.json`,
  `src/main.ts`, `vite.config.ts`, another `src/scenes/*.ts`, anything under
  `src/data/dex/**`, `src/data/anil/**` or `src/assets/**`, `.prettierignore`, or the
  docs a later docs pass owns (`docs/maps-spec.md`, `docs/design-spec.md`).
- **Shape:** prose, ported handlers and one move-typing rule — checked against the
  tree at `23ac1e5`, not assumed. The recorded pair Task-05/Task-25 **shared one path**
  and this batch separates them: both wanted `src/engine/battle/effects/moves.ts`,
  which is where a move's type registers, because Task-25 needs a `hiddenpower` move
  effect and Task-05 ports the move long tail. So **Task-05 owns `effects/moves.ts`**
  (and every other battle module its ports touch, `turn.ts`/`state.ts` included) and
  **Task-25 owns `src/engine/battle/moveType.ts` plus a new
  `src/engine/battle/effects/hiddenPower.ts`, which it registers through
  `src/engine/battle/index.ts`** — the barrel both scenes already import, so the effect
  is live in the app without either task editing the other's file. Task-04 reads the
  generator it documents and writes no code; Task-05 reads
  `src/data/moveCoverage.json` for its port list and regenerates it; Task-25 reads
  `moveType.ts` and the panel call sites. No two tasks in the batch write the same file.
  Paths that belong to no task here: `src/engine/battle/effects/items.ts` and
  `src/data/items.ts` (Task-07, Batch 3) stay untouched. `docs/battle-spec.md` →
  Task-05 only; `src/ui/partyDetail.ts` → Task-25 only.

### Batch 3 — held items, ability popup
- **Task-07** The competitive held items, with Añil's icons.
- **Task-12** Ability info popup.
- **Hot files:** `package.json` → Task-07; `src/scenes/RouteScene.ts` and
  `BattleScene.ts` → Task-12; the generated `src/assets/anil/item-icons.png`,
  `src/data/anil/item-icons.json` and `docs/balance/effect-coverage.md` → Task-07.
- **Shape:** a catalogue plus a panel. Task-07 owns the item icon sheet
  (`sprite-sources/anil/Graphics/Items/`, materialised into the local clone) and
  Task-12 owns the detail panels.

### Batch 4 — party data, badges, Legends Z-A Megas
- **Task-13** Nicknames, typed from the STATS tab.
- **Task-15** Añil type and status badges.
- **Task-19** Legends Z-A and Champions Megas.
- **Hot files:** `package.json` → Task-15; `src/data/dex/**` (regenerated
  `megas.json`, `meta.json`) and `src/data/anil/pokemon-sprites.json` → Task-19; the
  generated `src/data/frlg/type-icons.json`, `src/data/frlg/status-icons.json` and the
  two badge atlases → Task-15.
- **Shape:** Task-13 touches `src/engine/save.ts` with a `SAVE_VERSION` bump, so
  nothing else in the batch may; Task-19 owns the regenerated dex.

### Batch 5 — panel chrome, TM acquisition
- **Task-16** Modernise the panel and menu chrome.
- **Task-22** TM acquisition breadth.
- **Hot files:** `src/scenes/RouteScene.ts`, `SettingsScene.ts`, `BattleScene.ts` →
  Task-16; `package.json` and the packed item-icon sheet → Task-22.
- **Shape:** Task-16 restyles every window and settles the `hudTransparent`
  question, Task-22 adds a machine icon to the sheet Task-07 packed. Both are free to
  assume Batch 4 merged.

### Batch 6 — balance pass, Phase 9 docs, capture bug
- **Task-09** Balance pass.
- **Task-17** Step 14 — docs & migration pass.
- **Task-27** Catching a Pokémon stacks a duplicate on top of it.
- **Hot files:** `src/scenes/RouteScene.ts` → Task-27; the sheets under
  `docs/balance/` → Task-09.
- **Shape:** numbers, one harness, prose and one scene seam. Task-09 owns
  `src/engine/battle/golden.test.ts` and any harness module it extracts beside it —
  the only task allowed to restructure the golden log — over the numbers in
  `src/data/`, while Task-27 stays in the run save seams. Task-17 takes
  `docs/design-spec.md`, `docs/battle-spec.md`, `docs/routes-spec.md` and `AGENTS.md`,
  so nothing else in the batch may.

### Batch 7 — Gigantamax
- **Task-18** Gigantamax, in the Mega Evolution mould.
- **Hot files:** `scripts/build-dex.mjs`, `src/data/dex/**` (the new `gmaxes.json`),
  `src/data/anil/pokemon-sprites.json` and `src/scenes/BattleScene.ts` → Task-18.
- **Shape:** one task, because it holds the generated dex and the battle scene, and
  both are paths Task-08's accessibility sweep and Task-26's i18n sweep want.

### Batch 8 — accessibility, new biomes, Rotom appliances, item retypes
- **Task-08** Accessibility pass.
- **Task-14** New biomes.
- **Task-20** The Rotom appliances as evolutions.
- **Task-23** Item-driven move retypes: Multi-Attack, Techno Blast, Natural Gift.
  Needs Task-07 merged, and builds on the `moveType.ts` shape Task-25 leaves in
  Batch 2.
- **Hot files:** every `src/scenes/*.ts` → Task-08; `scripts/build-dex.mjs` and
  `src/data/dex/**` → Task-20; `package.json` and any new tileset atlas → Task-14; the
  generated `docs/balance/effect-coverage.md` → Task-23.
- **Shape:** Task-08 runs here so the contrast audit is done once, against the chrome
  Batch 5 shipped. Task-23 is late on purpose: Batch 5's Task-22 writes the same TM
  entries in `src/data/items.ts` and the shop rotation, and Batch 6's Task-09 balance
  pass owns the `src/data/` numbers and the `docs/balance/` sheets that Task-23 also
  touches — so this batch, whose tasks run over the scenes, the tilesets and the
  regenerated dex, is the first one that leaves Task-23's paths free.

### Batch 9 — Megas as information in the STATS graph
- **Task-21** The Megas as information in the STATS graph.
- **Hot files:** none of the serial resources (`src/ui/evolutionGraph.ts` is not one).
- **Shape:** a single task, because `src/ui/evolutionGraph.ts` is the file Task-20
  rewrote in Batch 8 and Task-18 extends in Batch 7.

### Batch 10 — localisation
- **Task-26** i18n module and the Spanish locale.
- **Hot files:** every `src/scenes/*.ts` → Task-26; `src/engine/save.ts` → Task-26.
- **Shape:** last on purpose. It moves every player-facing literal behind a key, so it
  must see the panels Task-12, Task-13 and Task-16 added and the strings Batch 8's
  accessibility pass introduced.

### Batch 11 — the Prettier reformat pass (last)
- **Task-29** Format the files `.prettierignore` still ledgers, and delete their lines.
- **Hot files:** none of the serial resources — but the task claims **every `src/**`
  path the ledger names**, so no other task may run beside it.
- **Shape:** one task, alone in its batch, and last on purpose. Task-01 shipped the
  format gate over a ledger rather than rewrite a file a batch-mate owned, so the
  `src/**` block it lists is debt, and `[Task-29]` pays it off: `npm run lint` stops
  depending on the ledger and becomes a gate a new file cannot quietly slip past.
  This is a **batch-composition** constraint, not a dependency — the reformat needs
  nothing another task produces, it just cannot share a batch with anything that owns
  one of the ~105 files it rewrites, and every earlier batch owns at least one. Last,
  because its formatting is then the final word on those files: every task's own gate
  keeps the ledger from growing in the meantime, so nothing after it can un-format
  what it cleared or re-add a line. Re-planned from the ledger as it stands then.

### Open questions for the human

None. Everything the first plan raised is decided: the Añil art was materialised
into the local clone, `Task-23` is unblocked (the three moves ship, `D42`),
`Task-24` is retired, the audio comes from the original games' audio rips under
`sprite-sources/frlg-audio/`, and the Plates are made obtainable by `Task-07`. A
question lands here only when the repository genuinely cannot answer it. The one ID
without a batch is not a question: `[Task-28]` waits on an upstream
`typescript-eslint` release.

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-28] Activate the ESLint half of `npm run lint`.** Task-01 shipped
      `eslint.config.mjs` committed and **dormant**: the flat config for `src/**/*.ts`
      and `vite.config.ts` (plus `vite`/`infra`/`public`/`sprite-sources`/`coverage`/
      `.agent_specs`/`scripts` ignores), written so that switching it on is a
      dependency install and one script edit, with its header comment as the record.
      It cannot run today: the repo pins native `typescript@7.0.2`, which exposes no
      JavaScript API, and every `typescript-eslint` release up to **8.71.2** declares
      `typescript >=4.8.4 <6.1.0`, so `@typescript-eslint/parser` throws at import and
      `npx eslint .` exits 2. **Blocked outside this backlog.** It becomes schedulable
      when a `typescript-eslint` release declares a TypeScript 7 peer — or when the
      human decides to run the ESLint half on a separate, non-native TypeScript
      toolchain — and only then does it take a batch. The activation itself is:
      install `eslint`, `@eslint/js`, `typescript-eslint` and `eslint-config-prettier`
      (`package.json`, `package-lock.json`), chain `eslint . &&` in front of the frozen
      `prettier --check .`, and make it green on the tree **as it stands** — switch
      rules off in `eslint.config.mjs`, never edit a file it reports. Linting
      `scripts/**` stays out of scope: the config ignores them on purpose.
      *Dependencies:* none inside this repo — it waits on the upstream release.
      **Unscheduled** (no batch).
- [ ] **[Task-29] The Prettier reformat pass.** Task-01 shipped the format gate over a
      **ledger** rather than rewrite a file a batch-mate owned: `.prettierignore` is a
      132-entry file, and its `src/**` block is **105 individual files** (plus the four
      generated-data globs, which stay) that Prettier would rewrite — each verified
      non-conforming, so the ledger hides no clean file. This task pays that off:
      format every ledgered `src/**` file with the shipped `.prettierrc.json`
      (`npx prettier --write <file>`, never a retune of the options), confirm the file
      now passes `prettier --check`, and delete its ledger line. What stays is exactly
      what has a reason to stay: the generated/binary globs, the `scripts/**` packers
      and the prose files the ledger names (`AGENTS.md`, `CHANGELOG.md`, `TODO.md` and
      the `docs/*.md` it lists), which belong to the docs tasks and to the
      Orchestrator, and get a clearer comment than today's. Owners: the ledgered `src/**` files and `.prettierignore`. Every task
      from here on keeps the ledger from growing — a new file conforms, and a task that
      edits a ledgered file never adds a line to hide it.
      *Dependencies:* none. *(Batch 11)*

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

- [ ] **[Task-04] Step 10 — Docs pass.** Update `docs/routes-spec.md` and
      `AGENTS.md` to the shipped algorithm, mark `docs/route-generator.md`
      implemented and archive these steps in `CHANGELOG.md`. **`§4` of
      `docs/route-generator.md` must be rewritten to what Step 8 actually
      validates**: the assert "every pocket has exactly one walkable neighbour"
      is false for this generator — a branch ends in a 2-4 tile lane or in a
      chamber (`carveBranches`), so the shipped invariant is that no **placed
      item** is stranded and that the spine, the fence, the items' terrain and
      the trainer poses hold; an unreachable pocket is reported but not gated,
      because `placeItems` is allowed to skip a pocket a hazard sealed.
      *Dependencies:* none — it documents the checks `src/engine/routes/validate.ts`
      ships (Step 8, archived with Batch 1), which it reads, not waits on.
      *(Batch 2)*

## Phase 3 — Battle engine core (pure, headless, tested)

> Completed work for this phase is archived in `CHANGELOG.md`.

The whole menu battle minus per-effect behaviour. Contract in
`docs/battle-spec.md`.

## Phase 4 — Battle effects: abilities, items, weather, terrain

> Completed work for this phase is archived in `CHANGELOG.md`.

Ports of Showdown handlers, in batches, on the hook names in
`docs/showdown-reuse.md` §3.

- [ ] **[Task-05] Reachable-but-unported effects.** The full National Dex (`D40`)
      and the full move set (`D42`) make **24 abilities and 86 moves** meetable that
      are not ported yet — the `no-op` rows of `docs/balance/effect-coverage.md` and
      the ids `unportedMoveIds()` returns from `src/data/moveCoverage.json` (Batch 1,
      Task-06). A damaging move resolves its base damage generically, but a status
      move or listed ability without a handler is a silent no-op until ported, and
      `src/dev/warnings.ts` already warns once per unported move in a develop build.
      Resolve every one of them: port it, or reclassify it `excluded` with a reason
      the table's own legend names (allies-only, out of battle, a mechanic the engine
      does not model). After this task neither section has a `no-op` row, and the
      develop-build move warnings clear.
      *Dependencies:* none — its port list is the classification Task-06 shipped
      (`src/data/moveCoverage.json`), which it reads and regenerates, not waits on.
      *(Batch 2)*
- [ ] **[Task-07] The competitive held items, with Añil's icons.** The run's
      held-item catalogue is a slice of the competitive set (24 `kind: 'held'`
      entries in `src/data/items.ts`) and their icons all come from the FRLG sheet
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
      green. **The seventeen Plates join that sweep**: they are catalogued and their
      Judgment retype already shipped, but `docs/balance/effect-coverage.md` still
      classifies every one of them `excluded` ("not in the run catalogue") and a run
      can never hold one. They need no Arceus to drop as loot, so this change moves
      those rows to `port` at the same time.
      *Dependencies:* none. *(Batch 3)*


## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

## Phase 7 — Persistence, meta & polish

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-08]** Accessibility pass: colour-only information audited, HP bars
      readable without colour, full keyboard play, reduced-flash option.
      *Dependencies:* none. Scheduled after Task-16 (Modernise the panel and menu
      chrome) so the contrast and colour audit runs once, against the final art.
      *(Batch 8)*
- [ ] **[Task-09]** Balance pass using `docs/balance/` sheets and the
      scripted-battle harness. The harness is `scriptedBattle()` inside
      `src/engine/battle/golden.test.ts` — the only one in the tree, called "the seed
      of the balance harness" in `CHANGELOG.md` — and this task may restructure that
      file into a **reusable harness** (export it, or lift it into a module beside the
      test, with the knobs the pass needs: seed, the two teams, a turn cap), keeping
      the fixed-seed golden log itself intact and green. It then tunes the numbers in
      `src/data/` against the sheets, with a fixed-seed regression for every rule it
      moves.
      *Dependencies:* none — it reads `docs/balance/route-curve.md` and the per-band
      `trainerXp` rule Task-10 shipped (archived with Batch 1). It is also the
      producer of the reusable harness: a later task that wants to run a scripted
      battle depends on Task-09. *(Batch 6)*
- [ ] **[Task-12] Ability info popup.** The STATS tab prints the ability as plain
      text (`MemberDetail.ability`, `src/ui/partyDetail.ts`) and there is no way to
      read what it does. Give the ability row the same ⓘ control the move cells
      have — `src/ui/moveGrid.ts`'s info button and floating popup over an FRLG
      window — so hovering or clicking it floats the ability's description. Reach
      every panel that prints an ability: the route HUD's detail panel
      (`src/scenes/RouteScene.ts`), the battle's SWITCH detail window and the
      capture screen (`src/scenes/BattleScene.ts`, `RouteScene`). The data is
      already generated — `src/data/dex/abilities.json` carries `desc` and
      `shortDesc`, but the accessor drops them (`src/data/dex/abilities.ts` exposes
      only `id` and `name`), so widen it and guard the two fields in
      `src/data/dex/abilities.test.ts`. Document in `docs/design-spec.md` §3/§4.
      *Dependencies:* none. *(Batch 3)*
- [ ] **[Task-13] Nicknames, typed from the STATS tab.** The battle layer already
      renders one — `FighterInput.nickname` feeds `fighter.name` (`name: input.nickname ??
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
      *Dependencies:* none. *(Batch 4)*

## Phase 8 — Biomes & art assets

> The FRLG art pass (route interiors, ground vs path, exit art, ledge and route
> props, beach, animated portraits, FRLG move/attack FX replacing the PMD art,
> per-biome battle backgrounds) and the release chores are out of the backlog; what
> shipped stays in `CHANGELOG.md`.

Only `forest` is in `BIOME_ORDER` even though `BIOMES` defines five, so the run
cycles one biome.

- [ ] **[Task-14] New biomes.** Decide which biomes join the cycle and add them: a
      tileset config and palette in `src/data/tilesets/`, a `BIOMES` entry with its
      `layout` and its `terrain` passes, and a slot in `BIOME_ORDER` (`D10`).
      Candidate list to decide: desert, prairie/plains, beach, autumn woods,
      marsh/rain, snow, volcano, ruins/power plant. Each new biome owes a fixed-seed
      generator regression.
      *Dependencies:* none. *(Batch 8)*
- [ ] **[Task-15] Añil type and status badges.** The battle menu, the party panels
      and the starter cards draw the FRLG badges (`src/data/typeIcons.ts`,
      `src/data/statusIcons.ts`, packed from `scripts/frlg/build-type-icons.mjs`
      and `build-status-icons.mjs`), and the FRLG sheet predates Fairy, so a Fairy
      type falls back to a text chip. Repack from Añil's
      `Graphics/UI/types.png` / `statuses.png` (and
      `Graphics/UI/Battle/icon_types.png`, `icon_statuses.png`) so every type,
      Fairy included, has a badge, and update both accessors plus the badge note
      in `docs/art-direction.md`.
      *Dependencies:* none. *(Batch 4)*
- [ ] **[Task-16] Modernise the panel and menu chrome.** Every window in the game
      is the FRLG frame: one `addFrlgWindow` (`src/ui/frlg.ts`) slicing
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
      *Dependencies:* none. *(Batch 5)*

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
- [ ] **[Task-17] Step 14 — Docs & migration pass.** Finish `docs/maps-spec.md`,
      update `design-spec.md` / `routes-spec.md` / `battle-spec.md` / `AGENTS.md`
      and the tech decision addenda, and archive the steps in `CHANGELOG.md`.
      **It also writes down the README convention the per-folder READMEs already
      follow (Task-02, Batch 1): a task that adds, renames or deletes a file updates
      that folder's `README.md` in the same task** — one role line per file, no
      exported names, so the folder's map never rots. `AGENTS.md` is where the
      convention belongs (a line in the Directory layout section), and Task-17 is the
      only task in the batch that owns it.
      *Dependencies:* none. *(Batch 6)*
- [ ] **[Task-18] Gigantamax, in the Mega Evolution mould.** Model Gigantamax the
      way the Megas work (`src/engine/battle/mega.ts`, `D34`): once per battle a
      holder may change to its G-Max forme, taking that forme's stats/types/ability
      **before any move**, and revert when the battle ends (`snapshotFighter` keeps
      the base species). The G-Max formes are **not in the build at all** today —
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
      *Dependencies:* none. *(Batch 7)*
- [ ] **[Task-19] Legends Z-A and Champions Megas.** The build ships only the 48
      classic Megas (`src/data/dex/megas.json`, `D40`); the ones Legends Z-A and
      Champions added are missing. They are **already in the dex**: `@pkmn/dex`
      0.10.11 lists **49** further formes tagged `isNonstandard: "Future"` —
      Dragonite, Meganium, Feraligatr, Emboar, Excadrill, Skarmory, Chandelure,
      Chesnaught, Delphox, Greninja, Pyroar, Malamar, Hawlucha, Drampa, Falinks,
      Baxcalibur, Heatran,
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
      *Dependencies:* none. *(Batch 4)*
- [ ] **[Task-20] The Rotom appliances as evolutions.** Rotom's five appliance
      formes are in the dex as species of their own — `rotomheat`, `rotomwash`,
      `rotomfrost`, `rotomfan`, `rotommow` in `src/data/dex/species.json`, each with
      its own stats,
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
      *Dependencies:* none. *(Batch 8)*
- [ ] **[Task-21] The Megas as information in the STATS graph.** The family graph
      draws evolutions only (`evolutionGraph`, `src/ui/evolutionGraph.ts`), and a
      Mega is not one: it is battle-only (`D34`, `src/engine/battle/mega.ts`) and
      entered from a stone. So a member whose species has a Mega shows no trace of
      it in the STATS tab. Add the Mega as an **information row** hanging off its
      base species:
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
      *Dependencies:* none. Task-20 (The Rotom appliances as evolutions) rewrites
      `src/ui/evolutionGraph.ts` first, and Task-18 (Gigantamax) adds a row of the
      same kind in Batch 7. *(Batch 9)*

## Phase 10 - Learnset, TMs & move typing

> The learnset panel, the TM catalogue and the effective-type rules shipped;
> these are the follow-ups (`D36`/`D37`).

- [ ] **[Task-22] TM acquisition breadth.** TMs only drop from route loot and
      mini-boss rewards today. A proper TM Machine (or a per-band TM slot in the
      shop) and a real machine icon � every TM borrows the sheet's question mark until then �
      are still open.
      *Dependencies:* none. *(Batch 5)*
- [ ] **[Task-23] Item-driven move retypes: Multi-Attack, Techno Blast, Natural
      Gift.** Judgment and the seventeen Plates already hook `onModifyMoveType`
      (`plateHandler`, `src/engine/battle/effects/items.ts`) and show the same type in
      the FIGHT menu and in the party panel (`effectiveMoveType` and its `judgeType`
      helper, `src/engine/battle/moveType.ts`); the other three item-driven retypes are
      still unmodelled. **Their moves do exist in this build**: `multiattack`,
      `technoblast` and `naturalgift` are all in `src/data/dex/moves.json`, each
      `isNonstandard: "Past"` — `D42` ships every real move, the `Past` ones included —
      so nothing here waits on a future dex. Implement them on the Plates' seam: the
      held-item data in `src/data/items.ts` (Multi-Attack's Memories, Techno Blast's
      Drives, and the berry each Natural Gift reads), the handlers in
      `src/engine/battle/effects/items.ts` (a move-scoped type, as `plateHandler` has,
      with Natural Gift consuming the berry it read), the panel rule in
      `src/engine/battle/moveType.ts` so the panel agrees with the battle, their rows
      in `docs/balance/effect-coverage.md` (`D16`), and the tests in
      `src/engine/battle/moveType.test.ts` and `src/engine/battle/effects/items.test.ts`.
      Make the new entries obtainable the way Task-07 made the rest
      (`src/data/loot.ts`, `src/data/shop.ts`, `src/ui/rewards.ts`). Two data facts to
      work from: the **berries already carry** their type and power in
      `src/data/dex/items.json` (`naturalGift: {basePower, type}`, 53 berries), while
      the **Memories and Drives do not** — `scripts/build-dex.mjs` drops every
      nonstandard item — so their type mapping is hand-authored in the catalogue, with
      the names and icons Task-07 brings over from Añil
      (`sprite-sources/anil/PBS/items.txt`).
      Out of scope: **the Plates' own obtainability** — `Task-07` makes them drop
      as loot; this item only wires the retype they already hook.
      *Dependencies:* Task-07 (The competitive held items, with Añil's icons) — it
      settles the `ItemDef` fields and the handler registration in the two files this
      task extends. Task-25 (Hidden Power's type) writes `src/engine/battle/moveType.ts`
      in Batch 2, so this task builds on the shape it leaves. The three moves' rows in
      `docs/balance/effect-coverage.md` are the generated table Task-06 shipped
      (Batch 1) — read, not waited on. *(Batch 8)*
- [ ] **[Task-25] Hidden Power's type.** `moves.json` ships Hidden Power as a single
      Normal entry (`D42`); model its type from the holder's IVs so the 17 typings
      mean something again: the battle, the FIGHT menu's preview and the party panel
      all read the same IV-derived type, and `docs/tech-decisions.md` /
      `docs/showdown-reuse.md` stop saying the engine does not model it.
      *Dependencies:* none. *(Batch 2)*

## Phase 11 — Localisation (i18n)

> English is the source table; a locale overlays it by key. New decision `D43`.

No player-facing string is translated today: every one is a literal in a scene or
a UI helper. The target is English plus Spanish.

- [ ] **[Task-26] i18n module and the Spanish locale.** A pure, headless-tested
      locale layer (`src/i18n/`: a typed key table, `en` as the source, `es` as an
      overlay, and a `t(key, params)` with named interpolation, no Phaser import),
      plus the sweep that moves every literal behind a key: the main menu, the
      starter pick, the settings screen, the run-over screen, the route HUD (party,
      bag, PC box, detail, pause, capture, Mart, reward), the battle menus and
      messages, and the dev panel. A `language` setting in `src/engine/save.ts` —
      defaulting from the browser locale and applied without a `SAVE_VERSION`
      bump, like `alwaysRun` —
      with its row in `src/ui/settingsScreen.ts`. Tests: `en`/`es` key parity both
      ways, no unresolved interpolation, and the settings round-trip. Scope call to
      take here: **the dex's own names stay English** (`@pkmn/dex` ships English
      only), so localising Pokémon, move, ability and item names is a separate and
      much larger job. Needs `D43` in `docs/tech-decisions.md` and a line in
      `docs/design-spec.md` §7; `AGENTS.md`'s "game text in English" convention
      becomes "English is the source table, a locale overlays by key".
      *Dependencies:* none. Scheduled last: it moves every player-facing literal
      behind a key, so it must see the panels Task-12, Task-13 and Task-16 add.
      *(Batch 10)*

---

## Bugs

Reported in play, awaiting triage. A bug becomes a task in the batch plan, and the
fix is archived in `CHANGELOG.md`. `[PENDING FIXES]` below is a different list: what
a finished batch still owes QA.

- [ ] **[Task-27] Catching a Pokémon stacks a duplicate on top of it.** Catching a
      wild Pokémon leaves a second copy of a member drawn over the caught one. Repro to confirm:
      catch with a **full party** (the capture screen opens) and take both choices —
      *swap* and *send to the PC* — then watch the party, the PC box and the HUD.
      Suspected: the capture placement seam — `resolveBattle`'s `placeCapture`
      (`src/engine/run/resolve.ts`), `addCaughtPokemon` / `swapCaughtIntoParty`
      (`src/engine/run/state.ts`), or `openCapturePrompt`/`refreshCapture` in
      `src/scenes/RouteScene.ts`.
      *Dependencies:* none. *(Batch 6)*

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```


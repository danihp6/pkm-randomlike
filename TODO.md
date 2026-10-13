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

**Batch 3b is shipped and archived.** **Batch 4** is the next to run: it is cut, its four
specs are written, and the Añil clone it needs is **back** (`sprite-sources/anil`,
materialised from the human's `POKEMON ANIL V4.13` download and verified by re-running both
packers, whose output is byte-identical to what is committed). Every batch from here follows
the Legend's **Asset trees** rule: the clone's absolute path goes to the packer, and no tree
under `sprite-sources/` is ever linked into a worktree. Nothing else below is in flight.

Legend:
- **IDs.** `[Task-NN]` is bound to a task only in this file; everywhere else a task
  is referenced by name. Two digits, in backlog order.
- **Retired IDs.** `[Task-24]` (a Move-Relearner screen for the bench) was retired:
  the learnset panel already covers its four slots, so the screen is not wanted, and
  `[Task-27]` (a catch that stacks a duplicate on top of itself) was retired into
  `[Task-31]`, which deletes the capture screen its repro needed and then owns the
  whole placement seam alone. A
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
- **Asset trees.** A gitignored asset tree (`sprite-sources/**`) is **never** junctioned
  or symlinked into a worktree: Windows' `git worktree remove` follows the link and
  empties the link's **target**, which is how Batch 3 lost the Añil clone. A task that
  needs the clone passes its **absolute path** to the packer, and every packer takes its
  source directory through argv or the environment — none of them reads a path inside a
  worktree. The permanent copy of this rule belongs in `AGENTS.md`; `Task-17` holds that
  file in Batch 6.
- **Unscheduled.** An ID that appears in no batch is blocked outside this backlog,
  so it cannot be scheduled however empty the plan looks. `[Task-28]` (activate the
  ESLint half of `npm run lint`) is the only one: it waits on an upstream
  `typescript-eslint` release, not on a decision here.

**Critical path.** Dependency depth is two: with Batches 1 and 2 merged, the only chain
left is `Task-07 → Task-23`. What serialises the tail is a shared resource, not a
dependency: `Task-18`, `Task-19` and `Task-20` all regenerate `src/data/dex/**` through
`scripts/build-dex.mjs`, `Task-20` and `Task-21` both extend `src/ui/evolutionGraph.ts`,
and `Task-23` writes paths earlier tasks already hold — `src/data/items.ts` (`Task-07`,
`Task-19` and `Task-22`'s TM entries), `src/data/shop.ts` and `src/data/loot.ts`
(`Task-07`, `Task-22`), `src/engine/battle/effects/items.ts` (`Task-07`),
`src/engine/battle/moveType.ts` (`Task-25`, shipped in Batch 2), the `src/data/` numbers
(`Task-09`) and the generated `docs/balance/effect-coverage.md` (`Task-07`, `Task-09`) —
which is why it sits in Batch 8 rather than beside the item tasks it belongs to. Those
three dex tasks are dependency-free, so the Orchestrator may pull any of them into an
earlier batch whose paths leave `scripts/build-dex.mjs` and `src/data/dex/**` free.
`Task-29` (the Prettier reformat pass, Batch 11) is the other serial resource: it claims
every `src/**` path `.prettierignore` still ledgers, so it runs alone, and last.

The items registered since the first plan add one link each, and one batch that is not a
link at all. `Task-35` (the enemy AI, Batch 8b) reads the reusable scripted-battle
harness `Task-09` extracts beside `src/engine/battle/golden.test.ts` (Batch 6), so its
batch sits behind Batch 6 and behind the mechanics whose options the AI weighs — Gigantamax
(Batch 7) and the item-driven retypes (Batch 8). `Task-34` (the battle SWITCH grid) is
dependency-free and only waits for the scene to be free, which Batch 6 is. `Task-33` is
the bug batch cut in front of Batch 4.

### Batch 1 — foundations *(shipped, archived)*
Task-01, Task-02, Task-03, Task-06, Task-10 and Task-11 merged in ID order behind the
green gate; the detail is in `CHANGELOG.md`'s `## Unreleased`. Two follow-ups it
parked are registered below: `[Task-28]` (activate the ESLint half, unscheduled) and
`[Task-29]` (the Prettier reformat pass, Batch 11).

### Batch 2 — docs pass, effect ports, Hidden Power *(shipped, archived)*
Task-04, Task-05 and Task-25 merged in ID order behind the green gate; the detail is in
`CHANGELOG.md`'s `## Unreleased`. The effect ports leave `unportedMoveIds()` empty, so
the coverage table names no `no-op` row, and the `moveType.ts` seam Task-25 shipped is
what Task-23 extends.

### Batch 3 — held items, ability popup *(shipped, archived)*
Task-07 and Task-12 merged in ID order behind the green gate; the detail is in
`CHANGELOG.md`'s `## Unreleased`. The run's held-item catalogue is now the whole
competitive set, with Añil's own 893-icon atlas packed at 24 px so no scene changed,
and every catalogue row is either a `port` or an honest `no-op`; the ability row reads
the dex's own text through the popup both tasks share. Task-07's paths — the one chain
left, `Task-07 → Task-23` — are free again for Batch 8. One casualty, recorded because
Batch 4 waits on it: the Orchestrator junctioned `sprite-sources/anil` into a worktree, and
Windows' `git worktree remove` followed the link and emptied the **clone**. No committed
output was lost — the packed atlas and every generated file are in the tree — but the
clone itself is empty and is being re-downloaded; the Legend's **Asset trees** rule is the
mitigation.

### Batch 3b — a catch's unique id *(shipped, archived)*
- **Task-33** The duplicate-Pokémon bug: every catch was minted with the same member id.
Task-33 merged alone behind the green gate; the detail is in `CHANGELOG.md`'s `## Unreleased`.
It took `src/engine/save.ts` **without** a version bump — repairing an old save is a
decode-time normalisation, like `parseDiscoveredRooms` — so Batch 4's Task-13 still takes the
14 → 15 step and Task-31's 15 → 16 in Batch 7 is unchanged. `docs/battle-spec.md` §7 is free
again for Task-13.

### Batch 4 — party data, badges, Legends Z-A Megas, the opening band
- **Task-13** Nicknames, typed from the STATS tab.
- **Task-15** Añil type and status badges.
- **Task-19** Legends Z-A and Champions Megas.
- **Task-32** An opening's border band is only partly a door.
- **Hot files:** `package.json` → Task-15; `src/scenes/RouteScene.ts`, and
  `src/engine/save.ts` + `save.test.ts` → Task-13; `src/data/dex/**` (the regenerated
  `megas.json`, `meta.json`), `src/data/anil/pokemon-sprites.json`, the two Añil
  portrait atlases, and the generated `docs/balance/effect-coverage.md` → Task-19; the
  generated `src/data/frlg/type-icons.json`, `status-icons.json` and the two badge
  atlases → Task-15. Task-32 holds no hot file: `src/engine/routes/**` is free here.
- **Shape:** four tasks that share no path. Task-13 is the only one on
  `src/scenes/RouteScene.ts` — it draws the STATS tab's name row the nickname is typed
  from — and the only one on `src/engine/save.ts`, which it bumps 14 → 15 (the
  migration adds no field: `nickname` stays `undefined`), so Task-31 (Batch 7) takes
  15 → 16 as its own entry already assumes; no other task in this batch may touch
  either file. Task-19 owns the regenerated dex and its counts; Task-15 repacks the
  two `frlg` badge atlases in place at their existing 32x14 / 32x8 frames, so no
  consumer scene or UI file changes and the batch's only scene stays Task-13's;
  Task-32 re-pins the route generator's fixed-seed expectations, which no other task
  reads. Nothing here depends on anything else here.
- **Blocked — resolved.** Task-15 and Task-19 both read the local Añil clone
  (`sprite-sources/anil`, the badge and sprite packers) and that clone was **empty**:
  Batch 3 junctioned it into a worktree, Windows' `git worktree remove` followed the
  link and emptied the target. The human re-downloaded the game
  (`POKEMON ANIL V4.13.zip`) and the clone is back — `Graphics/` (893 item icons,
  `Pokemon/`, `Icons/`, `UI/`) and `PBS/` — verified by re-running both packers:
  `npm run data:anil:items` and `npm run data:anil` reproduce the committed atlases,
  portraits and manifests **byte-identically**. Batch 3b runs first; this batch is cut
  from `main` once it merges. From here on the Legend's **Asset trees** rule applies to
  every batch: the clone's absolute path goes to the packer, and no tree under
  `sprite-sources/` is ever linked into a worktree.

### Batch 5 — panel chrome, TM acquisition
- **Task-16** Modernise the panel and menu chrome.
- **Task-22** TM acquisition breadth.
- **Hot files:** `src/scenes/RouteScene.ts`, `SettingsScene.ts`, `BattleScene.ts` →
  Task-16; `package.json` and the packed item-icon sheet → Task-22.
- **Shape:** Task-16 restyles every window and settles the `hudTransparent`
  question, Task-22 adds a machine icon to the sheet Task-07 packed. Both are free to
  assume Batch 4 merged.

### Batch 6 — balance pass, Phase 9 docs, the battle SWITCH grid
- **Task-09** Balance pass.
- **Task-17** Step 14 — docs & migration pass.
- **Task-34** The battle SWITCH grid: one sixth per row, a name that cannot stretch it,
  arrows that move the cursor.
- **Hot files:** the sheets under `docs/balance/` → Task-09; `src/scenes/BattleScene.ts`
  → Task-34.
- **Shape:** numbers, one harness and prose. Task-09 owns
  `src/engine/battle/golden.test.ts` and any harness module it extracts beside it —
  the only task allowed to restructure the golden log — over the numbers in
  `src/data/`. Task-17 takes `docs/design-spec.md`, `docs/battle-spec.md`,
  `docs/routes-spec.md` and `AGENTS.md`, so nothing else in the batch may — which is
  why the capture task registered as `[Task-31]` sits in Batch 7 instead of here: it
  must rewrite the PC rule in `docs/routes-spec.md` §6, and Task-17 holds that file
  in this batch. The bug it replaces, `[Task-27]` (Catching a Pokémon stacks a
  duplicate on top of it), was absorbed into `[Task-31]` and is retired — its live
  diagnosis is `[Task-33]`'s, which Batch 3b fixes before any of this.
  Task-34 is the third task and takes the one path the other two leave free: the
  party grid's geometry lives in `BattleScene` alone, and this is the first batch whose
  scene claims leave that file open — Batch 5's chrome pass owns it in the batch before,
  and Batch 7's Gigantamax and Batch 8's accessibility sweep own it after. It reads the
  long names Batch 4's nicknames (Task-13) make possible but produces nothing anyone in
  this batch reads, and it takes no `docs/` path: Task-17 holds every spec it could want
  a line in, and the row geometry changes no rule.

### Batch 7 — Gigantamax, route-scoped catch swap
- **Task-18** Gigantamax, in the Mega Evolution mould.
- **Task-31** A full party sends the catch to the PC, swappable only on that route.
- **Hot files:** `scripts/build-dex.mjs`, `src/data/dex/**` (the new `gmaxes.json`),
  `src/data/anil/pokemon-sprites.json` and `src/scenes/BattleScene.ts` → Task-18;
  `src/scenes/RouteScene.ts`, `src/engine/run/state.ts` + `state.test.ts`,
  `src/engine/run/resolve.ts` + `resolve.test.ts`, `src/engine/save.ts` +
  `save.test.ts`, `src/ui/partyScreen.ts`, the new `src/ui/notice.ts` +
  `notice.test.ts` and `docs/routes-spec.md` → Task-31.
- **Shape:** two tasks that share no path: the battle engine and the generated dex on
  one side, the run save, the route scene and the PC rule on the other. It is the
  first batch whose serial resources are all free for Task-31 — every earlier batch
  that touches `src/scenes/RouteScene.ts` (3, 5, 6, 8, 10) or `src/engine/save.ts`
  (3b, 4, 10) already claimed one, and Task-17 holds `docs/routes-spec.md` in Batch 6.
  Task-18 keeps `docs/tech-decisions.md` for its decision entry; Task-31 takes no
  `D##`, because its rule is a gameplay one and `docs/routes-spec.md` carries it.
  Running here also puts the new popup in front of Batch 8's accessibility sweep
  (Task-08 claims every `src/scenes/*.ts`) and Batch 10's i18n sweep.

### Batch 8 — accessibility, new biomes, Rotom appliances, item retypes
- **Task-08** Accessibility pass.
- **Task-14** New biomes.
- **Task-20** The Rotom appliances as evolutions.
- **Task-23** Item-driven move retypes: Multi-Attack, Techno Blast, Natural Gift.
  Needs Task-07 merged, and builds on the `moveType.ts` seam Batch 2 shipped.
- **Hot files:** every `src/scenes/*.ts` → Task-08; `scripts/build-dex.mjs` and
  `src/data/dex/**` → Task-20; `package.json` and any new tileset atlas → Task-14; the
  generated `docs/balance/effect-coverage.md` → Task-23.
- **Shape:** Task-08 runs here so the contrast audit is done once, against the chrome
  Batch 5 shipped. Task-23 is late on purpose: Batch 5's Task-22 writes the same TM
  entries in `src/data/items.ts` and the shop rotation, and Batch 6's Task-09 balance
  pass owns the `src/data/` numbers and the `docs/balance/` sheets that Task-23 also
  touches — so this batch, whose tasks run over the scenes, the tilesets and the
  regenerated dex, is the first one that leaves Task-23's paths free.

### Batch 8b — the enemy AI, and the difficulty parameter
- **Task-35** Enemy AI: the cartridge's AI scripts for a known roster, expected value and
  a bounded search for a random one, and the difficulty knob on top.
- **Hot files:** `src/engine/battle/ai.ts` + `ai.test.ts`, `src/data/trainers.ts`,
  `src/scenes/BattleScene.ts`, `src/scenes/RouteScene.ts`, `src/scenes/SettingsScene.ts`,
  `src/ui/settingsScreen.ts`, `src/engine/save.ts`, `docs/tech-decisions.md` and
  `docs/battle-spec.md` → Task-35.
- **Shape:** one task, alone, and it needs the batch to be that wide: the AI's own module
  is free, but its difficulty parameter reaches the launch (`RouteScene`), the call site
  (`BattleScene`), the settings row (`src/ui/settingsScreen.ts` + `SettingsScene`) and the
  save (`src/engine/save.ts`) — no earlier batch leaves all four of those plus
  `docs/battle-spec.md` and `docs/tech-decisions.md` free at once, and Batch 8's own
  Task-08 claims **every** `src/scenes/*.ts` in the batch before. Running here also puts
  the AI after every mechanic whose options it weighs — Mega Evolution (D34, shipped),
  Gigantamax (Batch 7) and the item-driven move retypes (Batch 8) — and after Task-09's
  reusable scripted-battle harness (Batch 6), which its fixed-seed AI regressions run on.
  It is **before** Batch 9 on purpose: Task-21 writes `docs/battle-spec.md` §9 there.

### Batch 9 — Megas as information in the STATS graph
- **Task-21** The Megas as information in the STATS graph.
- **Hot files:** none of the serial resources (`src/ui/evolutionGraph.ts` is not one).
- **Shape:** a single task, because `src/ui/evolutionGraph.ts` is the file Task-20
  rewrote in Batch 8 and Task-18 extends in Batch 7.

### Batch 10 — localisation
- **Task-26** i18n module and the Spanish locale.
- **Hot files:** every `src/scenes/*.ts` → Task-26; `src/engine/save.ts` → Task-26.
- **Shape:** last on purpose. It moves every player-facing literal behind a key, so it
  must see the panels Task-12, Task-13 and Task-16 added, Task-31's catch notice, and
  the strings Batch 8's
  accessibility pass introduced.

### Batch 11 — the Prettier reformat pass (last of the planned backlog)
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

### Batch 12 — a hit's sound, a cry (added after the audio pass)
- **Task-30** Per-move hit sounds and per-species cries.
- **Hot files:** `src/scenes/BattleScene.ts` and `RouteScene.ts` → Task-30; the packed
  `src/assets/audio/*.wav` and the two `scripts/frlg/` audio scripts → Task-30.
- **Shape:** one task, in its own batch, because it is the only open item that owns a
  scene once the plan above is merged: every batch that touches `BattleScene.ts` (3,
  5, 7, 8, 10) or `RouteScene.ts` (3, 5, 6, 7, 8, 10) has already claimed one. It runs
  **after** Batch 11's reformat and keeps the two ledgered scenes conforming, so it
  adds no ledger debt — which is why the reformat is still the last of the *planned*
  backlog rather than the last thing to land.

### Open questions for the human

One, and it has a written default rather than a guess. Everything the first plan raised
is decided: the Añil art was materialised into the local clone, `Task-23` is unblocked
(the three moves ship, `D42`), `Task-24` is retired, the audio comes from the original
games' audio rips under `sprite-sources/frlg-audio/`, and the Plates are made obtainable
by `Task-07`. A question lands here only when the repository genuinely cannot answer it.
The one ID without a batch is not a question: `[Task-28]` waits on an upstream
`typescript-eslint` release.

- **`[Task-34]` (the battle SWITCH grid, Batch 6): is "1/6" one row per member?** The
  request says the cells must occupy a sixth and that six party rows fill the panel, so
  the entry is written as **one row per member in a single column** — the classic party
  list — with the label clipped instead of wrapped and the arrow keys stepping member to
  member. The other reading is that the 3-column avatar grid (`PARTY_COLS`) stays and only
  its cell height is capped at a sixth of the window. The default is the first, because
  only that layout makes six rows fill the panel and makes a single-column cursor the
  right cursor; say so before Batch 6's branch is cut if the avatar grid is meant to stay.
  Nothing else in the plan changes either way.

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

## Phase 3 — Battle engine core (pure, headless, tested)

> Completed work for this phase is archived in `CHANGELOG.md`.

The whole menu battle minus per-effect behaviour. Contract in
`docs/battle-spec.md`.

- [ ] **[Task-35] Enemy AI: the cartridge's AI scripts, expected value, and the
      difficulty knob.** The enemies think with one shallow scorer today: `chooseAiCommand`
      (`src/engine/battle/ai.ts`) takes `estimateDamage × accuracy`, adds 1000 when the hit
      would KO, 60 for a status that can land, 40 for a favourable boost, 50 for healing at
      low HP and 25 for a volatile, switches only when nothing it has can hurt the foe and a
      reserve can (`bestOffense`), spends its Mega at the first chance and breaks ties to the
      **lowest index with no Rng draw at all**. It is deterministic and hidden-information
      honest — it never reads the foe's unrevealed moves — and it is also blind to the
      situation: no item use, no predicted switch, no two-turn plan, no speed or hazard
      reasoning, and a wild fights exactly as well as an Ace. An archetype
      (`src/data/trainers.ts`) carries presentation, sprites, money and `carriesMega` and
      **no AI setting**, while a roster is the closed, known BST-pool list
      (`RosterOptions`, `speciesPool`, D39) and a wild's moveset and ability are rolled per
      run seed (D17) — so the game has both cases the request names: a side whose moves it
      can know and a side whose moves are random.
      **What to build it from**, best first:
      1. **The cartridges' own AI scripts (FRLG/Emerald), the recommendation.** Each move
         starts at 100 and each of the trainer's AI settings adds or subtracts points:
         *check bad move* (skip what fails or does nothing), *try to faint* (prefer the KO,
         on the game's own damage formula), *check viability* (heal at low HP, set up when
         safe, and the rest of the situation scores), *setup first turn*, *risky* (Explosion
         and friends), *prefer Baton Pass*; the **highest score wins and a tie is broken at
         random**; switching follows Emerald's rules (about to faint to Perish Song; the
         player's last move was Electric/Water/Fire and a bench absorbs it; no
         super-effective move and the bench has something the player cannot hurt) and a
         trapped Pokémon never switches; carried items are used **without randomness**
         (Full Restore and Potions below ¼ HP, cures on the matching status, X items on turn
         one); **wild Pokémon pick a random move that has PP left**; *Hard Mode* is nothing
         but "every trainer also gets check bad move, try to faint and check viability". The
         sources are `pret/pokefirered`'s AI script commands
         (`src/battle_ai_script_commands.c`) and the pkmn wiki's Battle AI page, which
         documents the settings, the switching rules, the item rules and Hard Mode.
         **Cost: low to moderate** — it is a closed list of checks over data we already
         have (`estimateDamage`, `canApplyStatus`, `legalMoveIndices`, `canMegaEvolve`), a
         flags field on the archetype, and one Rng-drawn tie-break; the port is faithful to
         the game this project is styling itself on (`D19`) and it makes the archetype the
         difficulty knob instead of a number.
      2. **A real one-ply expected-value layer.** Today's score is a damage estimate with no
         switch evaluation and no risk term. Expected damage over accuracy, crit and the
         85–100 roll, a status/boost value that accounts for the target's state, and a switch
         score that compares the bench's best offence against the active's — all data the
         engine already exposes. **Cost: low.** It is the *check viability* half of 1, and
         the two are the same code.
      3. **A bounded search over our own engine** — determinized minimax/expectimax or MCTS
         on cloned states, which is what the Showdown-lineage bots do (Showdown's own
         `battle-ai` search/eval module set is **not** in `smogon/pokemon-showdown`'s tree
         today, so read it from an archived copy before porting it; `pmariglia/foul-play`
         carries a heuristic eval plus `fp/search/` with an external engine bridge), and
         `pkmn/engine` exists exactly to make it fast (a battle simulator "optimized for
         performance", Zig with Node/WASM bindings). **Cost: high.** It needs a pure
         clone/rollout seam on `BattleState` (`takeTurn` mutates in place), a per-turn node
         or time budget, and its own determinism rule — every rollout seeded from a derived
         stream, never the battle's ambient draws.
      4. **Learned agents** (poke-env, Metagrok, AlphaMon, *Laplace* — determinized MCTS,
         2231 Elo in Gen 9 Random Battle — and the 2025 "Human-Level Competitive Pokémon via
         Scalable Offline RL" line): the strongest play by far and the wrong shape here —
         training infrastructure, model weights, no determinism story, and nothing a
         browser roguelike can ship in its bundle.
      **The run's shape, as recommended:** trainers think with the cartridge flag set
      (Youngster gets few, Ace/boss/mini-boss get all of them, and the carried items the
      engine already models are used by the cartridge's own rules), wilds keep the
      cartridge's random-with-PP policy at normal difficulty and may use the flagged scorer
      at the top one — a policy switch, not a second AI.
      **The difficulty parameter: yes, and discrete and visible rather than adaptive.** The
      cartridge ships one (Hard Mode above) and the roguelike canon prefers explicit tiers
      (Slay the Spire's Ascension, Hades' Heat, Isaac's unlock ladder), while the DDA
      literature is the argument against the hidden alternative: a rubber band that keeps
      every fight at the same perceived difficulty ruins pacing and reads as cheating in a
      game whose whole promise is that a loss is the player's. So one setting — a small
      `aiLevel`/`hardMode` — chooses the archetypes' default flag set, the wild
      policy and the tie-break's noise; the per-archetype flags stay data. It reaches
      `src/engine/save.ts` as a **settings** field (defaulted in `parseSettings`, so **no**
      `SAVE_VERSION` bump — the `Task-26` precedent), a row in `src/ui/settingsScreen.ts`
      drawn by `src/scenes/SettingsScene.ts`, and the launch: `RouteScene.startBattle` puts
      it on `BattleLaunch` and `BattleScene.submit`'s `chooseAiCommand(this.state, 'enemy')`
      reads it. This task owns all of those paths in its batch.
      **Determinism (D11):** the AI draws its tie-break from the **battle's own Rng**
      (`state.rng`), so the same seed replays the same battle; that draw moves the stream,
      which re-pins the fixed-seed expectations in `src/engine/battle/golden.test.ts` (and
      `ai.test.ts`, `mega.test.ts`) — Task-09 owns the golden log and extracts the reusable
      scripted-battle harness in Batch 6, so this task re-pins it after and runs its
      AI regressions on that harness.
      **Honesty:** keep the AI on information the player also has. A set-predicting AI needs
      a per-battle **revealed** record and `BattleState` tracks none today; adding one is
      allowed only if it stays honest.
      Needs a `D##` in `docs/tech-decisions.md` (the next free number when it runs; `D43` is
      Task-26's) and a section in `docs/battle-spec.md`. Fixed-seed tests for the flags, the
      scoring and the tie-break. Out of scope: doubles (the game has none), reading the
      foe's unrevealed set, and coaching or telegraphing the choice in the UI.
      *Dependencies:* Task-09 (Balance pass) — the reusable scripted-battle harness it
      extracts beside `src/engine/battle/golden.test.ts`, on which this task's fixed-seed AI
      regressions run. Batch order covers the rest: Mega Evolution is merged (D34),
      Gigantamax lands in Batch 7 and the item-driven retypes in Batch 8, so the AI weighs
      every option the rules have by the time it is written. *(Batch 8b)*

## Phase 4 — Battle effects: abilities, items, weather, terrain

> Completed work for this phase is archived in `CHANGELOG.md`.

Ports of Showdown handlers, in batches, on the hook names in
`docs/showdown-reuse.md` §3.

## Phase 5 — Battle UI & presentation

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-34] The battle SWITCH grid: a sixth per row, a name that cannot stretch it,
      and arrows that move the cursor.** Reported in play, in the battle's SWITCH window.
      The builder is `renderPartyGrid` (`src/scenes/BattleScene.ts`) and the defect is its
      geometry. It lays the party out as `PARTY_COLS = 3` avatar cells and derives the cell
      height from the **member count**: `rows = Math.max(1, Math.ceil(count / PARTY_COLS))`,
      then `cellH = (bottom - top - (rows - 1) * MENU_GRID_GAP) / rows`. With one, two or
      three members `rows` is 1, so a single cell is the window's whole content height; the
      avatar, the label and the HP bar stay pinned at that box's top-left corner and the box
      grows around them, which is what "the cells must not grow their height" is about. The
      label is the second half: `openParty` builds one string for the cell (`name  LvN` plus
      the status abbreviation) and `renderPartyGrid` draws it with
      `setMaxWidth(cellW - avatarW - 22)`, so a long name **wraps** inside a cell that never
      accounted for a second line, while the HP bar is placed at a fixed `cellY + 30` under
      it and the label's own height is whatever the wrap made it. The third half is the
      cursor: `navigateMenu` sends every direction to `moveMenu(±1)` in `mode === 'party'` —
      linear previous/next — even though the cells sit in three columns, so `up`/`down`
      slides along the row and `left`/`right` skip the member that is actually beside the
      cursor.
      **Expected:** one row per member in a single column, each row exactly **1/6** of the
      window's content height (so a full party of six fills the panel and a party of two
      leaves the rest of the panel empty rather than two giant cells) — **confirmed by the
      human**, whose words for the bug are "with two Pokémon the two cells take the whole
      grid" — and the row's height
      **never** depends on what it draws: a name that overflows the row is clipped (an
      ellipsis is fine) and never wrapped or allowed to push the HP bar. The arrow keys move
      the selection **between party members** in the direction that matches that layout —
      `up`/`down` are previous/next, and `left`/`right` may do the same since a single column
      has no second axis — and the cursor still refuses to land on a fainted or already
      active member exactly as `moveMenu` does today. The ◀ back control, the per-cell HP
      bar (`PARTY_CELL_HPBAR_SCALE`, already scaled from the cell width so it never runs into
      a neighbour), `PARTY_AVATAR_SCALE` and the detail window `renderPartyDetail` keeps
      drawing above the grid all stay as they are. Six rows is `MAX_PARTY_SIZE`
      (`src/engine/run/state.ts`), not a new magic number; if the layout needs a pure helper
      (a row rect per index), it goes in `src/ui/` with a test, the way `moveGrid` and
      `mapView` do.
      Out of scope: the FIGHT/BAG/SWITCH/RUN command grid and the moves grid
      (`MENU_GRID_COLS`, `moveMenuGrid` — they are 2x2 and correct), the route HUD's
      party/PC list (`src/ui/partyScreen.ts`), and the detail window's own layout. Docs: none
      — the row geometry is presentation and changes no rule, and Task-17 holds
      `docs/battle-spec.md` in this batch.
      *Dependencies:* none. It reads the nicknames Task-13 (Batch 4) makes possible — a long
      name is what exposes the wrap — but needs nothing Task-13 produces. *(Batch 6)*

## Phase 6 — Run structure, party & economy

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] **[Task-31] A full party sends the catch to the PC, swappable only on that
      route.** Catching a wild Pokémon with the party full today **defers** the
      placement and opens a full-screen modal: `RouteScene.applyBattleResult` calls
      `resolveBattle` with `placeCapture: false`, reads the deferred
      `BattleResolution.captured` and hands it to `openCapturePrompt`
      (`captureDetailChildren`, `refreshCapture`, `handleCaptureAction`,
      `chooseCaptureSwap`, `chooseCapturePc`, `closeCapturePrompt`, the `CAPTURE_*`
      constants and the `captureRoot` input guards, all in
      `src/scenes/RouteScene.ts`), which offers "swap it in" or "send it to the PC".
      Delete that whole path and the seam that exists only to feed it: `placeCapture`
      and `captured` in `src/engine/run/resolve.ts`, the `askCapture` branch in
      `applyBattleResult`, and `swapCaughtIntoParty` in `src/engine/run/state.ts`. A
      catch is then placed by `resolveBattle` itself, the classic way — into the
      party while it has room, into the PC box when it is full (`addPokemon` /
      `MAX_PARTY_SIZE`) — with `addCaughtPokemon` as the single placement helper
      every catch goes through.
      **The new rule:** the swap window is no longer the whole floor. A catch that
      went to the box is swappable only **while the run is still in the room it was
      caught in**; the first exit closes it, a door (`advanceRoute`) and the portal
      (`advanceMap`) alike. So the floor-scoped `pcUnlocked` becomes a route-scoped
      `pcCatch: { roomInMap: number; memberId: string } | null`, set by the placement
      when the catch landed in the box and cleared by both advances; `pcMemberEditable`
      reads it beside `pcFullyEditable`, so the HUD's box cells — whose lock veil
      `src/scenes/RouteScene.ts` already draws from it — lock the catch the moment
      the player walks out. Nothing new to build: the party/PC panel already performs
      the swap (`canGrab` / `canSwapAcross` → `swapAcross`, `swapPartyBox`,
      `withdrawToParty`, `depositToBox`, `BOX_PAGE_SIZE` in `src/ui/partyScreen.ts`).
      **The popup** replaces the modal with a temporary notice at the **top of the
      screen**, in English (D12): "Your party is full — <name> went to the PC. You
      can swap it in before you leave this route." It is raised when the catch is
      placed (inside `playReleaseBeats`' callback, so a permadeath overlay and the
      notice never share the screen), drawn by the pinned HUD camera on the
      `learnPopup` / release-overlay seam, and **auto-dismissed**: it takes no key,
      blocks no movement and carries no stats, because the detail panel and the PC box
      panel already show the Pokémon. Its copy and its hold time live in one pure
      helper, `src/ui/notice.ts`, with a test — one string for Task-26 to key.
      **Save and state:** the run gains a field, so this task bumps `SAVE_VERSION` and
      adds its step to `SAVE_MIGRATIONS` the way Task-13 does it: an old run's
      floor-scoped `pcUnlocked` cannot be re-scoped, so the step drops it and the
      decoder defaults `pcCatch` to `null`, leaving the party, the box and every other
      field untouched. Tests: `src/engine/run/state.test.ts` (a full party lands the
      catch in the box, it is editable there, and `advanceRoute` / `advanceMap` close
      the window), `src/engine/run/resolve.test.ts` (the `placeCapture` cases fall
      away with the option), `src/engine/save.test.ts` (the migration round-trip) and
      `src/ui/notice.test.ts`. Docs: the capture bullet in `docs/routes-spec.md` §3
      and the PC windows in §6.
      **`[Task-27]` is absorbed here** and retired: its repro — catch with a full
      party, take both choices, watch the party, the PC box and the HUD — must be
      re-run and reported gone, because with one placement path and no second copy of
      the catch there is nothing left to stack.
      **The live diagnosis, recorded here because Task-27's ID points at it:** the stacking
      was never the placement seam. Every wild fighter is built with a **constant** id
      (`createFighter({ id: 'wild' })`, `src/scenes/BattleScene.ts:368`), the encounter key
      behind it (`grass:x,y`, `src/scenes/RouteScene.ts:4183`) is not unique per run, and
      `memberById` (`src/ui/partyDetail.ts:106`) resolves a member by **first match** — so
      the party row drew correctly while its detail panel showed an earlier catch. That is
      `[Task-33]` (Batch 3b), which lands **before** this task and mints a unique id at the
      fold; this task's replay must therefore re-run the repro with `[Task-33]` merged and
      report the panel showing the clicked member, then re-check it again after the deferred
      placement path is deleted — the id mint is upstream of the placement, so it survives
      the removal of `placeCapture` unchanged, and `pcCatch.memberId` is free to hold the id
      `[Task-33]` mints.
      Out of scope: the party/PC panel's own UI and page size, the battle's ball-shake
      presentation (`src/ui/capture.ts` is the battle's, not this modal's — leave it
      alone), the entry room's free PC window (`pcFullyEditable` / `entryDeparted`),
      and localising the notice (Task-26, Batch 10).
      *Dependencies:* none — it needs nothing another open task produces. Batch order
      covers three facts: Task-13 (Batch 4) takes the next `SAVE_VERSION` (15) first, so
      this migration is the step after it (15 → 16 as the plan stands); Task-33 (Batch 3b)
      lands even earlier and mints the unique member id at the fold this task keeps, so
      `pcCatch.memberId` and the `[Task-27]` replay below both build on it; and it
      **supersedes the capture-screen half of Task-12** (Batch 3): the ability ⓘ
      Task-12 adds to the route HUD's detail panel and to the battle's SWITCH window
      stays, while the one it adds to the capture screen is deleted here with the
      modal it lives on, so this task's diff removes a Batch-3 feature on purpose.
      *(Batch 7)*

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
      battle depends on Task-09 — `Task-35`'s fixed-seed AI regressions do. *(Batch 6)*
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
- [ ] **[Task-30] A hit plays the move's sound, and an encounter the Pokémon's
      cry.** Both moments were dropped from the cue table rather than faked with one
      shared sound, because the original varies them. The material is in
      `pret/pokefirered`: `sound/songs/midi/se_m_*.mid` carries one `SE_M_*` sound per
      move (`include/constants/songs.h`), and the 388 cries are
      `sound/direct_sound_samples/cries/<species>.wav`, with `gCryTable` in
      `sound/cry_tables.inc` mapping dex order to `Cry_<Species>` — the game plays a
      cry through a `PokemonCrySong` (`include/gba/m4a_internal.h`), not as a bare
      sample, so decide whether to reproduce that or ship the sample. The dex's own
      `species.json` carries no cry, so the species→cry map comes from that table or
      from the file names. `scripts/frlg/render-frlg-audio.mjs` already renders a MIDI
      through the m4a engine, so the move sounds extend it; the cries need their own
      seam. **The cue-table contract is the decision to take here**: a cue id is the
      only name a scene may use (`src/audio/cues.ts`, `D22` addendum), so either give
      every move and species its own cue id or add one parameterised call that
      resolves a generated table — pick one and say why. Wire the hit into
      `BattleScene`'s damage event and the cry into `RouteScene.startBattle` (and the
      battle's send-out), keep `cues.test.ts`'s placeholder guard over whatever ships,
      and note that the original also varies a hit by effectiveness
      (`Cmd_effectivenesssound`: `SE_EFFECTIVE`, `SE_SUPER_EFFECTIVE`,
      `SE_NOT_EFFECTIVE`) if that is wanted too.
      *Dependencies:* none. *(Batch 12)*

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
      shop) and a real machine icon — every TM borrows the sheet's question mark until then —
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
      task extends. The `src/engine/battle/moveType.ts` seam is merged (Task-25, Batch
      2), so this task extends it rather than waits on it. The three moves' rows in
      `docs/balance/effect-coverage.md` are the generated table Task-06 shipped
      (Batch 1) — read, not waited on. *(Batch 8)*

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

- [ ] **[Task-32] An opening's border band is only partly a door.** Reported in play:
      a route's opening shows **part of its band** as a door — some of the border
      tiles the opening occupies are still wall/fence, and the cells the wall tidy
      rewrites are the ones that misbehave. The door **rule** is sound and is not the
      suspect: `exitEdgeAt` (`src/engine/routes/doors.ts`) already counts **any**
      walkable border cell of an opening edge as a door, and the scene asks it with
      the **raw** map (`RouteScene.doorEdgeAt` passes `this.map = route.tiles`, not
      the movement copy), so a decorative tree tip is never mistaken for a door.
      The **geometry** it reads is what is wrong. `placeAccess`
      (`src/engine/routes/sketch.ts`) opens **one** ring cell per opening
      (`tiles[tile.y][tile.x] = FLOOR`) while `carveGuaranteedPath` carves the lane
      `pathWidth` (2) wide, so the band's remaining cell exists **only** where
      `cleanWalls` (`src/engine/routes/walls.ts`) happens to widen the ring — and the
      tidy's ring licence is motif-band shaped: its bitten-tree pass drops a ring cell
      only when the 3-wide band it belongs to (`bandStart[x] = x - x % cols`,
      anchored at the map's **left** edge) holds both wall and floor *in that row*.
      On the **east** column that band is clipped by the map edge: for a room whose
      `(width - 1) % cols === 0` the band it tests is the single cell `width - 1`, so
      it is never mixed, the widening never fires, and the east door stays one cell
      wide while its lane is two — this is the reading's prediction of the failing
      case, to be confirmed by the search below. The column un-stack pass cannot
      compensate: `onRing` is true for **every** cell of `column 0` and
      `column width - 1`, so `topRing && bottomRing` skips every run in those columns,
      and it trims an interior end on purpose. A second mechanism un-doors a band cell
      the tidy **does** open: the terrain passes guard only the anchors
      (`ends = [entry, ...exits]` in `openKeys`), so a band cell sits in the grass and
      ledge pools (`pocketTiles`) and can catch `TALL_GRASS` — walkable, but
      `exitEdgeAt` reads a raw `FLOOR`, so that cell silently stops being a door.
      **Expected:** every border cell of an opening's **band** is a door, on **every**
      edge, including the cells the tidy pass rewrites. The band is the lane's own
      cross-section at the ring: for a `W`/`E` opening the `pathWidth` cells
      `y … y + pathWidth - 1` on that edge column, for an `N`/`S` opening the
      `pathWidth` cells `x … x + pathWidth - 1` on that edge row. The generator owns
      the band; the tidy may widen a hole, never leave one half-open.
      **The fix** is engine-only, `src/engine/routes/**`: a pure `openingBandCells`
      helper in `doors.ts`, `placeAccess` opening the whole band, the band cells
      joining the terrain forbids in `attemptRoute`, and a `borderBandGaps` gate in
      `validateRoute` so `sketchRoute` re-rolls instead of shipping a half-band door.
      **The failing case is not frozen yet**: the dev finds it by search over
      `planMap`/`roomView` rooms (the reading says: an **east** opening in a room with
      `(width - 1) % 3 === 0`), then writes the seed, the map, the room, the edge and
      the exact coordinates into the regression test and reports them for the archive.
      The test gap that let this through: `src/engine/routes/doors.test.ts`'s real-room
      case asserts only that each declared edge has **at least one** walkable border
      cell (`openTiles.size` plus one cell per edge), never that the band is complete.
      *Dependencies:* none — it reads only `src/engine/routes/**`, whose fixed-seed
      expectations it re-pins. *(Batch 4)*
- `[Task-27]` (Catching a Pokémon stacks a duplicate on top of it) was absorbed into
      `[Task-31]` (Batch 7) and retired, and the live diagnosis of its repro now sits on
      `[Task-31]`'s own entry and on `[Task-33]`'s: the colliding id was never the capture
      placement, so `[Task-33]` (Batch 3b) fixes it first and `[Task-31]` re-runs the repro
      over the fixed seam and reports the result to QA.

---

## [PENDING FIXES]

Written by QA. The format is fixed — one entry per task. Empty means nothing is red.

```markdown
- [ ] **[TASK-<ID>]:** <one-line description>
  - **Expected:** ...
  - **Actual / error log:** ...
  - **Affected path:** ...
```


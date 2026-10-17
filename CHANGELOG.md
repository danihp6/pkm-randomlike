# PokeRandomLike — Changelog

Completed backlog items, kept out of `TODO.md` so the daily backlog stays small.
This file is *what shipped*, grouped by the roadmap phase it belonged to; the
rationale behind each rule (`D##` decisions) lives in
`docs/tech-decisions.md`. The commits carry the moment-by-moment history; this
file is the human-readable summary.

## Unreleased

- [x] **The enemy AI thinks with the cartridges' own script flags, and difficulty is one
      visible setting (`D46`).** `chooseAiCommand` stops scoring with one hard-coded
      function: `AiFlag` — `checkBadMove`, `tryToFaint`, `checkViability`,
      `setupFirstTurn`, `risky`, `preferBatonPass` — became **data** on the trainer
      archetype (`TrainerArchetype.aiFlags`; the union is declared in
      `src/data/trainers.ts` and the engine imports the **type** only), the six flags are
      a closed list of checks over `estimateDamage` / `canApplyStatus` /
      `legalMoveIndices` / `canMegaEvolve`, and **the highest score wins**, with an exact
      tie broken to the lowest index at the default level and from the battle's own
      `state.rng` at the top one. The flag ladder ships per class: a Youngster only skips
      a move that can do nothing and otherwise attacks, the middle classes heal and use
      their status moves, a Psychic and a Black Belt also go for the faint (the Black Belt
      gambles), and the **`ace`** archetype — which is also what the boss and the
      mini-boss are, so the plan's "Ace/boss/mini-boss get all of them" is one data row —
      carries all six. A wild no longer out-thinks an Ace: at the default level it picks a
      **random move that has PP left** (exactly one draw per turn) and only at the top one
      does it think with the flags. The run gains **`settings.aiLevel`** — `Normal` (the
      default) or `Hard` — as one `Difficulty` step row on the options screen (drawn by
      the data-driven screen, no scene change), a required `BattleLaunch.aiLevel` the
      route fills from the settings, and `Hard` is nothing but the cartridge's own Hard
      Mode: every trainer also gets *check bad move*, *try to faint* and *check
      viability*. It is defaulted per field in `parseSettings` (the `reducedFlash`
      shape), so **`SAVE_VERSION` stays 16** and the plan's chain stays
      14 → 15 → 16 → 17 → 18. The AI reads nothing but legal information — its own party
      and movesets, the **active** fighters' public facts, the field and `state.turn` —
      and never the opposing bench or its unrevealed moves, and it draws from `state.rng`
      alone. The enemy still gains **no Bag**: `validateBag` refuses every side but the
      player and the items the engine models on an enemy are held ones its own hooks
      apply, so the two levels differ in flag set, wild policy and tie-break, not in
      items. Every moved fixed-seed expectation carries its reason: the golden log — its
      snapshot **and** `harness.test.ts`'s line-for-line copy of it — moves because the
      golden battle is a wild one, so the new policy picks Vine Whip over the scored
      Tackle **and** spends one `Rng` draw per turn, while `mega.test.ts`, `gmax.test.ts`
      and `randomLearnsetBattle.test.ts` stayed byte-identical and `harness.ts` untouched.
      `docs/battle-spec.md` gained §11, `docs/tech-decisions.md` `D46`, `docs/data-spec.md`
      the archetype's new field and `src/data/README.md` a corrected role line. One
      `agent-review` issue carries the one `[live]` criterion (the options row on screen
      and the setting reaching a battle) this environment cannot measure.

- [x] **The accessibility pass: one reduced-flash knob, HP that reads without hue, the
      colour-only cues fixed, and the whole game playable from the keyboard (`D45`).**
      `Settings` gains `reducedFlash` (default off, `DEFAULT_REDUCED_FLASH`, read per field in
      `parseSettings`, so `SAVE_VERSION` stays **16** and `SAVE_MIGRATIONS` gains no step) with
      its `Reduce flashing` row in `src/ui/settingsScreen.ts`, and every full-frame effect in
      the tree obeys it: the two `cameras.main.flash` calls (`playMega`, `playGmax`), the route's
      hidden-item glint and the hold-to-reset scrim's release. HP survives the loss of hue: the
      new pure `src/ui/metrics.ts` exports (`LOW_HP_FRACTION`, `isLowHp`, `hpCueNotches`) cut the
      low-HP fill into ink notches in **both** battle panels while the player's panel keeps the
      `hp/maxHp` numbers it already printed. The hue-only readings are gone — a slash on a spent
      Poké Ball, `TOX` through the shipped abbreviation chip, the FRLG ▶ on the selected move
      cell, an underline on the active bag pocket, a 3-px stroke on a disabled cell — and the
      route HUD and every battle menu are operable from the keyboard alone (new pure
      `stepCursorWithHeader` / `boxPageForIndex` / `stepBagCursor` / `stepGridCursor` /
      `detailStops` / `stepStop` / `nextDetailTab`, plus a `hudKeyboardPane` focus that stops the
      walk and clears on pause; no keybind action, default or alias was added). `StarterScene`'s
      `typeBadges` loses the stale "no Fairy badge" claim and its provably dead text fallback.
      No panel geometry moved (the compact 0-px clearances and `FOE_PLATFORM_CLEAR` are
      untouched) and the contract is written down: `docs/design-spec.md` §10 with the audit
      table, `docs/tech-decisions.md` `D45`.
- [x] **Rotom's five appliances are a one-way, click-driven evolution (`D38`).**
      `src/data/dex/evolutions.ts` gains one module-private `FORM_EVOLUTIONS` override table —
      canon Rotom has no evolution at all, its appliances are a forme change from a key item, so
      the generated `evos` is honestly empty and the five branches are a **game rule** layered
      over the dex — read by `speciesEvolutionLevel`/`evolutionBranches` and walked **additively**
      by `evolutionFamily`/`evolutionDepth` (the only species whose answer moves is Rotom:
      family 1 → 6, depth 0 → 1, measured across all 1282 playable species). All five branches
      share the level the shipped BST-band rule resolves (**30** for Rotom's 440, asserted by
      identity rather than by a literal), the STATS tab's family graph draws the six rows and a
      click carries the member into the appliance keeping level, nickname, nature, gender, shiny,
      IVs/EVs, moves and PP, status and held item — only `speciesId` and the stats/ability derived
      from it move, with the missing HP carried onto the same maximum — and the change is
      **one-way, Eevee-style**: an appliance offers no branch and never leads back to Rotom or a
      sibling. No scene change was needed (the shipped click path carries it), the generated
      `species.json`/`meta.json` and `scripts/build-dex.mjs` are byte-identical (`npm run data:dex`
      was not run) and no fixed seed moved.
- [x] **The last three item-driven move retypes ship on the Plates' seam (`D37`).**
      Multi-Attack reads a **Memory**, Techno Blast a **Drive** — the 21 hand-authored rows gain
      `ItemDef.memory`/`ItemDef.drive`, the shape the `plate` field already froze, with their
      `shortDesc` finally true — and Natural Gift reads the berry's own dex pair
      (`getDexItem(id)?.naturalGift`, `{ type, basePower }`) through a new `onModifyMove` hook in
      the effect registry, spending the berry on `onAfterMove` so a missed or Protect-blocked
      move keeps it while the turn that used it still resolves with the berry's type and power.
      The panel rule moved to `itemMoveType` in `src/engine/battle/moveType.ts` (and
      `movePreview` now folds `runModifyMove`), so the FIGHT menu, the party panel and the battle
      can no longer disagree; the eleven unmodelled berries stay honest `no-op` rows. The 21 rows
      leave `COMPETITIVE_HELD` (**143 → 122**) and become `MEMORY_DRIVE_ITEMS`/`MEMORY_DRIVE_IDS`
      — ground-only `end`-band treasure exactly as the Plates are, with the Mart stocking none of
      them and no shelf moving — and the `D16` coverage table is regenerated
      (`npm run docs:coverage`: Items `290 total (138 port, 71 no-op, 81 excluded)`, the three
      move rows now reading `registry: effects/items.ts`), with `docs/balance/economy.md` following
      the split. No packer ran, no dex file changed and no fixed seed moved. One consequence is
      recorded rather than hidden: the route HUD's learnset-**pool** cells still classify with the
      ability-only `abilityMoveType`, so a pooled Multi-Attack, Techno Blast or Natural Gift row
      does not yet show the held item's type while the party panel and the FIGHT menu do — the way
      the pool has always read, and a follow-up rather than a regression.
- [x] **One biome ships: the never-wired entries are pruned (`D10`).** The backlog asked which
      biomes join the cycle; the human's answer was the inverse — *solo existe el bosque* — so
      nothing was added and everything unreachable was deleted. `src/data/biomes.ts` loses `wood`,
      `outdoor`, `cave` and the non-biome `placeholder` row: `BiomeId` is the singleton `'forest'`,
      `BIOMES` is `{ forest }` with its exact previous `name`/`tilesetId`/`layout`/`terrain`, and
      `BIOME_ORDER` stays `['forest']`, so `biomeForMap`/`biomeForRoute` answer exactly what they
      answered before for every seed — the frozen regression route in `sketch.test.ts` passes
      untouched. The registry follows: `TILESET_IDS`/`TILESET_NAMES`/`TILESETS` hold the forest field
      alone, `src/data/tilesets/palettes.ts` keeps only `FRLG_FOREST_PALETTE`, `wood.ts` is deleted
      (with its `.prettierignore` line) and `FRLG_TILESET` stays as the shared FRLG field layout that
      `FRLG_FOREST_TILESET` specialises. `PLACEHOLDER_TILESET` survives as a **test-only fixture** —
      exported from `placeholder.ts`, out of the registry, so `BootScene` no longer preloads the
      procedural sheet; the four parked atlas PNGs stay on disk, unreferenced, for a later art task.
      `RouteScene`'s pre-route `tilesetId` initialiser moves `'wood'` → `'forest'`, the only id boot
      preloads. Tests move with it (`exit.test.ts` and `tileFrames.test.ts` build against the fixture
      instead of `WOOD_TILESET`, the FRLG atlas sweep measures the shipped forest atlas only, the
      route fixtures stop labelling themselves `'wood'`), and `biomes.test.ts`/`ids.test.ts` now pin
      the singleton registries: 1484 tests, green.
- [x] **Gigantamax, in the Mega Evolution mould (`D44`).** A G-Max forme is a **battle state**: a holder
      whose own species has one may take it **before any move**, it **doubles HP** and leaves every
      other stat, its types and its ability alone (Añil's rule, not a G-Max stat table), and the battle
      end reverts it from the fighter's snapshot. The formes are generated, not hand-written:
      `scripts/build-dex.mjs` now emits `src/data/dex/gmaxes.json` beside `megas.json` (read through the
      new `src/data/dex/gmaxes.ts` + `gmaxes.test.ts`), and `scripts/anil/build-pokemon-sprites.mjs`
      regenerates the two portrait atlases (`public/anil/portraits{,-shiny}.png`) for the new cells.
      The mechanic is the new `src/engine/battle/gmax.ts` + `gmax.test.ts` — fixed seed, it fires **once
      per battle**, the doubling, the revert — threaded through
      `src/engine/battle/{turn,commands,fighter,state,ai}.ts`, with `src/scenes/BattleScene.ts` (+181)
      drawing the gate. **No Max moves**: a G-Max forme keeps its normal moves (`D42`, and the human's
      call when the batch was cut).
- [x] **A full party sends the catch to the PC, and only that route's boxed catch is swappable.** The
      capture screen is **gone**: the engine alone places the catch now (`addCaughtPokemon`), so
      `src/scenes/RouteScene.ts` lost **457 lines** net, `placeCapture` and the old `captured` field
      disappeared and `toPc` is derived from the resulting run. `createRun` seeds `pcCatch: null`, both
      `advanceRoute` and `advanceMap` clear it, and `pcMemberEditable(run, memberId)` is the single
      answer to whether the PC is editable on the current route, so a boxed catch is swapped there and
      nowhere else. The strip is the new `src/ui/notice.ts` (+ its test and the folder's role line, with
      a doc-comment-only touch in `src/ui/partyScreen.ts`), and `src/engine/save.ts` takes the
      **`SAVE_VERSION` step 15 → 16**: `SAVE_MIGRATIONS[15]` drops the old field and `parseRun` ignores
      `pcUnlocked` entirely.
- [x] **The main menu's Continue row shows where the run is.** `src/ui/runSummary.ts` gains
      `runPositionLabel(run)` — `Map <n> · <biome>` — and `src/scenes/MainMenuScene.ts` (+33) draws the
      label with the party's portraits beside the row, so Continue says which map and biome the run
      holds before loading it. `docs/design-spec.md` §2 records the row's third clause and
      `src/ui/runSummary.test.ts` (+46) pins the label. No run field, no `SAVE_VERSION` step.
- [x] **The learnset band scrolls instead of paging.** The band no longer pages: a new pure
      `src/ui/scroll.ts` (`maxScrollTop`, `clampScrollTop`, `scrollByRows`, `visibleRange`) owns
      the maths, and the **mouse wheel**, the `<` / `>` controls and a **drag on the band's own
      background** all move it one row at a time. The `<` / `>` pair stays as the keyboard/pad
      control (the search field keeps the ~78 px those glyphs occupy) and the old `1/3` counter and
      page-step are gone. The change is confined to `src/scenes/RouteScene.ts`, the new module and
      its test, one `src/ui/README.md` role line, and `docs/design-spec.md` §3 / `docs/tech-decisions.md`
      `D36` (which stop saying "paged"). One `[live]` criterion was **corrected in its spec**, not in
      the code: its first frozen press point fell inside the panel's 12 px move handle
      (`HUD_PANEL_BORDER`), so the drag moved the panel; the point now clears that ring. No run
      field, no RNG, no `SAVE_VERSION` step.
- [x] **A trainer's remaining team sits under its HP panel as Poké Balls.** In a **trainer** battle
      the foe's panel now carries a fixed row of balls — one per roster member with the fainted ones
      emptied, so it also shows how many the trainer started with — drawn from the packed Añil item
      atlas's own `itemIconFrame('pokeball')`, the same frame the capture throw already uses. A
      **wild** battle draws **no row**, and the active ball dims in the same repaint that empties its
      HP bar. `src/scenes/BattleScene.ts` alone (+50): no data, no `src/ui/**` module, no docs line,
      no packed asset, no run field.
- [x] **The party's lead walks behind the player on a route, idle and running.** A new
      `src/data/pokemonOverworld.ts` resolves a member's species id through Task-76's coverage
      manifest (`src/assets/pokemon/index.json`) to its `<fileId>` pair and the frame arithmetic
      `dirRow * cols + start + i`; a new `src/render/pokemonFollower.ts` registers one looping
      **idle** and one looping **walk** strip per facing (down / up / side, the right-facing side
      flipped), and `src/scenes/RouteScene.ts` trails the sprite exactly **one tile** behind the
      player, plays `walk` (faster while running) on each step and **loops `idle` while the player
      stands still** — a change the human asked for after the first QA, over the spec's parked rest
      frame — rebuilds it on a lead or room change, ignores it in the HUD camera and sorts it as a
      ground actor so a tree draws over it. A lead whose id is in the manifest's `missing` list
      draws nothing and never blocks the run. No run field and no rule, so no `SAVE_VERSION` step.
- [x] **The battle SWITCH window draws six fixed rows.** The party list is now **one row per
      member at a fixed cell size that does not stretch to fill the panel** — the new pure
      `src/ui/partyGrid.ts` owns the geometry (`partyGridLayout`, `fitPartyLabel`), the label is
      clipped with an ellipsis instead of wrapping, and the arrow keys step member to member.
      `PARTY_COLS` and the member-count-derived row height are gone from `BattleScene.ts`; a
      two-member party draws two rows and leaves the lower four sixths empty. `src/ui/README.md`
      gains its role line. No data, no rule, no run field.
- [x] **The Phase 9 docs close and `AGENTS.md` gains three standing rules.** `docs/maps-spec.md`'s
      open questions become resolved records and its §3 reads as the shipped algorithm; stale
      counts are corrected against the tree — **88** Megas (`D40`), eight maps to level 55, the
      fixed boss and mini-boss parties, the "from map 2 on" shop — and `docs/design-spec.md`,
      `docs/battle-spec.md`, `docs/routes-spec.md` and `docs/tech-decisions.md` are brought to the
      shipped state, with the Phase 9 steps archived in `CHANGELOG.md`. `AGENTS.md` records the
      per-folder README convention, the two-wave QA loop and the **Asset trees** rule. Docs only,
      no code.
- [x] **The balance pass, and the reusable scripted-battle harness.** The `docs/balance/` sheets
      are re-measured against the shipped numbers, and the seed-driven `scriptedBattle()` helper
      moves out of `src/engine/battle/golden.test.ts` into a shared
      `src/engine/battle/harness.ts` with its own test — the **golden log itself is
      byte-identical**, only its source moved, so the one task allowed to restructure it left it
      untouched. The harness fixes a seed, a turn cap, a player/enemy policy and the auto-replace
      path, and renders every `BattleEvent` kind. No engine rule changed, no run field.
- [x] **The overworld sprite set covers every species and form PMD Collab has — 1163 of the 1282
      playable ids — behind a coverage manifest the follower reads.** The three tools under
      `scripts/legacy-art/` were adapted from the sibling project's dependency-free pipeline
      (`fetch-pmdcollab.mjs`, `pmdcollab-species.mjs`, `extract-real-sprites.mjs`, reusing
      `zip-codec.mjs`/`png-codec.mjs`, **no new npm package**), taking their source tree through
      `--dest`/`--source` as an **absolute** path under the main checkout — never a tree under
      `sprite-sources/` linked into a worktree (the Legend's **Asset trees** rule, which is how
      Batch 3 lost the Añil clone). The work list is **derived** from our own dex, never
      hand-listed: a pair is covered only when its JSON carries `durationsMs`, so a
      `generate-pokemon.mjs` placeholder counts as uncovered. **526 new pairs** were packed from
      PMD Collab (the 652 that already carried real animation were left byte-identical — the diff
      is additions only, the three Castform pairs untouched), and the other **119** ids go into
      the new manifest's `missing` list: 15 nums below 650 whose committed pair is still a
      placeholder and which the server has no usable pack for, plus Gen 6+ formes with no upstream
      art. The new `src/assets/pokemon/index.json` is **generated** by
      `scripts/legacy-art/build-pokemon-index.mjs` (byte-reproducible, like `src/data/dex/**`) and
      is the frozen interface `[Task-41]` reads: `sprite` 32, `rows` 5, `dirRows`
      `down/downright/up/upright/left`, `files` (species id → `fileId`, where `fileId = num` or
      `num * 100 + formIndex`) and `missing`. `src/assets/README.md` and `docs/art-direction.md`
      record the PMD Collab tier's provenance, and its own headless `index.test.ts` asserts the
      coverage from the committed tree alone. No run field, so **no `SAVE_VERSION` step** — the
      chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The debug overlay can teleport between floors, rooms and tiles, and ignore wild encounters
      and trainer sight.** The Route tab gains a *Teleport* block — `Floor`, `Room` and `X`/`Y`
      inputs (blank means `auto`) with a `Go` button each, a `#debug-location` readout and its own
      `#debug-teleport-status` line — and the General tab the two checkboxes; `src/main.ts` wires
      the five new handlers, the pattern every handler in the tree already follows. The scene
      reuses the **shipped** transitions rather than inventing a second way to change rooms:
      `teleportToFloor` runs the real `advanceMap` (resetting the destination floor's per-floor
      bookkeeping exactly as a normal floor change does — fog, trainers, items, captures, boss,
      `pcUnlocked`, level cap) but deliberately **does not heal** (the menu has its own *Heal*, and
      a silent heal would hide the very bug the tool is used to chase), `teleportToRoom` runs
      `advanceRoute` + `transitionTo` so it lands on a real door with the opposite arrival edge,
      and `teleportToTile` stops any walk first and then calls `movePlayerTo`, so a mid-step
      teleport cannot let the tween drag the player back and fire `onTileEntered` at the old tile.
      All three clamp into range and refuse a solid tile or a missing floor plan
      (`teleport failed: no floor plan` / `solid tile`). `debugLocationLabel(context)` is the new
      pure, tested helper (four exact strings). The two toggles are dev-only and unsaved: the
      ignore-encounters flag gates the grass roll and the ignore-trainers flag gates **both** sight
      paths (`trainerSpotted` and the spinning trainer's `seesPlayer` branch), the **boss and
      mini-boss count as trainers** so their sight stops too and the portal stays sealed until the
      boss falls (D31), and because a skipped roll spends no draw a run with a toggle on no longer
      matches its seeded stream — stated plainly rather than hidden. It adds no run field, so **no
      `SAVE_VERSION` step**; the chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **A boss always fields six Pokémon and a mini-boss three — map 1 the exception, at three and
      two.** Both rosters used to be derived from the floor's band (`band.trainerSize + 1`), so a
      boss's team grew and shrank with the level curve and a map-1 boss met you with two. The rule
      is now a fact about the boss: `src/data/bosses.ts` is new and holds
      `BOSS_PARTY: Readonly<Record<BossPartyKind, { firstMap; size }>>` — **`boss { firstMap: 3,
      size: 6 }`**, **`miniboss { firstMap: 2, size: 3 }`** — plus the pure
      `bossPartySize(kind, mapIndex)` (map 1 and any degenerate index read the map-1 row; from the
      kind's `firstMap` on it reads its `size`). `RosterOptions` (`src/engine/run/roster.ts`) gains
      an optional **`count`**, resolved as `Math.max(1, options.count ?? band.trainerSize)`, so the
      band default and every ordinary roster are **untouched** — the new field is optional and
      `roster.test.ts`'s band-size pin is unmodified. `src/scenes/RouteScene.ts` passes
      `count: bossPartySize(kind, room.mapIndex)` for exactly the two fights (the boss and the
      mini-boss) and nothing else; the boss keeps its `minLevel: band.maxLevel` and the stream keys
      are unchanged, so the task drew **no RNG of its own** — it only changes how many draws the
      roster's existing stream spends. `docs/maps-spec.md` §6 and its §7 mini-boss row,
      `docs/battle-spec.md` §7, `docs/balance/route-curve.md`'s Exceptions bullet,
      `docs/data-spec.md` and `src/data/README.md` carry the rule. The boss's XP **award is left
      uncapped** (a six-Pokémon boss pays six times `experienceAward`) and that is recorded as a
      decision for the balance pass to weigh, not a defect. No run field and no `SAVE_VERSION`
      step, so the chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The early floors thin out: maps 1-2 place fewer trainers and less loot, and map 1 hangs
      no shop leaf.** A run's first steps were the heaviest in the game — floor 1 fielded **11.33
      trainers** in the sheet and up to 12 on a seed, near end-game density — and the geometry
      cannot shrink (a floor already sits on the guaranteed six rooms, `D30`), so the fix is the
      floor's *population pass* plus one special leaf. `src/data/population.ts` is new and holds
      `POPULATION: Record<BandId, BandPopulation>` (`BandPopulation = { trainerBonus; guardChance }`):
      **`early { -1, 0.5 }`**, **`low { -1, 0.75 }`**, and the four later bands `{ 0, 1 }`, which is
      *bit-identical* to a request that passes no population at all (no extra draw), so maps 3-8's
      routes are untouched by the default. `RouteRequest` gains an optional `population` and
      `placeTrainers` reads it: the tier bonus is `max(0, tier + trainerBonus)` and each pocket's
      guard exists only with `guardChance` (**one draw from the existing `populate` stream, and
      none at all when the chance is `>= 1` or `<= 0`**) — the spine guard is never thinned, so the
      lane-guard promise and the `wantsTrainers` gate keep their meaning. `ROUTE_LOOT`'s `early`
      and `low` `itemChance` fall to **0.5 / 0.6** (`pool` and `hiddenChance` byte-identical), and
      `src/engine/maps/plan.ts` gains `SHOP_FROM_MAP = 2` and `hangsShop(mapIndex)` so **map 1
      hangs no shop leaf** — a counter the run has no money for is dead weight and it already
      starts with its 10-ball pack — leaving floor 1 at **six rooms, seven when its mini-boss
      rolls**. `src/scenes/RouteScene.ts` passes `population: POPULATION[band.id]` in `buildRoute`
      (one line); `src/ui/mapView.ts` and `mapView.test.ts` closed **untouched**, because the
      minimap draws a leaf's marker from the plan and an absent leaf is simply a missing marker.
      **The re-measured eight-floor walk is the acceptance criterion**, and it moved more than the
      two floors the task set out to thin: dropping the shop leaf removes two `rng.int` draws from
      map 1's `map` stream (its special pass shifts), and `routeIndexForRoom`
      (`src/engine/run/floors.ts`, 48-53) sums the earlier maps' `rooms.length`, so a six-room map 1
      shifts **every route index from map 2 on** and re-rolls maps 2-8's routes. Floor 1 now measures
      **5.67 trainers** (was 12.00) and floor 2 **6.33** (was 12.33), every floor's
      `0.75 · T̄·A / needed` sits inside `1 – 1.5` (maps 1-2 inside `1.20 – 1.35`), and
      `LEVEL_BANDS.trainerXp` is re-solved **early 1.35 → 2.67**, **low 6.08 → 10.68** — numbers
      only, no other row moved. `docs/balance/route-curve.md` is rewritten to that measurement,
      `docs/maps-spec.md` §7 and `docs/design-spec.md` §7 and `docs/route-generator.md` carry the
      per-band population, the guard chance and the "from map 2 on" shop rule, and
      `src/data/README.md` lists `population.ts`. No run field and no `SAVE_VERSION` step, so the
      chain stays **14 → 15 → 16 → 17 → 18**.
- [x] **The forest's tall grass draws in the forest's own palette, and nothing it draws ever
      covers the player's upper body.** Two halves, both scene/data: the FRLG fields declare a
      per-field **`grassRustleTint`** on the tileset (`0xC1D7EF` for the forest, none for the
      outdoor and cave fields, which share one config) applied to the single rustle overlay
      sprite, because the decompilation's `tall_grass.png` is the **outdoor** palette's art and
      the packer stamps the same five cells for every field — so in the forest (the only biome
      `BIOME_ORDER` walks) the overlay painted light blades (78,148,81) over the field's dark
      tuft (59,125,76), a `+19/+23/+5` per-channel mismatch the player read as "the floor turns a
      lighter green when I step in"; the tint brings the parked overlay to (59,125,76), matching
      the neighbouring tuft within a unit. And that same sprite is **cropped to the cell's rows
      6-15**, so **no frame of the hit draws above cell row 6** — the closing frame used to be
      opaque over the whole cell (816 px over the character on the desktop, 864 on the compact
      layout) and, now carrying the ground's own colour, read as the background jumping on top
      of the player; every frame's band now starts at row 6 (world y 153) and the character's
      top ~15 px stays visible through the whole beat, on both layouts. The three atlases and
      the packer are untouched, no run field, no `SAVE_VERSION` step, no RNG.
- [x] **The level curve is re-planned: eight finite maps, levels 2 → 55, and an infinite floor
      that keeps climbing.** `MAP_TUNING` (`src/data/maps.ts`) carries eight rows — caps
      **9 / 16 / 23 / 30 / 37 / 43 / 49 / 55**, stepping 7/7/7/7/6/6/6 — so the first floor is
      worth **+4** to a fresh level-5 starter instead of the single level it used to be, and
      `FINITE_MAPS` is 8. `LEVEL_BANDS` (`src/data/run.ts`) is re-spanned over the same six ids
      with its `bst` windows and `trainerSize` chain untouched, and `trainerXp` is re-solved
      (1.35 / 6.08 / 3.04 / 5.82 / 4.65 / 2.61) so the repo's own rule still holds — *0.75 × a
      floor's trainers pays that floor's cap* — with the walk's fills landing inside **1.09-1.44**
      (maps 1-2 at 1.42/1.44, with slack for the floor-1 thinning task). The `mapTuning` defect is
      fixed on the way: an out-of-table (infinite) map used to pin its `minLevel` at the last row's
      `maxLevel` while only the max climbed — floors became 40-48, 40-56 … and settled at a 40-100
      range — and now **both** ends climb and saturate at `MAP_MAX_LEVEL` (map 9 is 55-63, map 10
      63-71, and 10 000 is 100-100). `docs/balance/route-curve.md` is rewritten over the eight-row
      walk with the measured `T̄/A/needed/fill`, and `docs/maps-spec.md` §4/§5/§10 resolve `O-M7` in
      eight. One line of `src/engine/run/progression.test.ts` is re-pinned (`bandForLevel(10)`:
      `mid` → `low`), and the band-boundary floating-point identity the solver must survive is
      recorded in the spec. No run field, so no `SAVE_VERSION` step.
- [x] **The battle panels' type badges are twice the size.** The row `[Task-53]` shipped now draws
      each badge at **×2** — a 32×14 atlas frame becomes **64×28** — with `PANEL_TYPES_H` 20 → 36,
      `FOE_PANEL.h` **150** and `PLAYER_PANEL_H` **184**, and the text-chip fallback scaled with
      them (72×36, a 24 px label clipped to the box) so the two can never disagree. Every other row
      keeps its offset from `barY`; the panels' extra height comes out of the battlers' size caps,
      and the compact layout is still measured at **0 px** of battler behind a panel (cross-checked
      at the `COMPACT_SIZE` threshold and on a 640-px-tall phone) with `FOE_PLATFORM_CLEAR`
      untouched. `src/scenes/BattleScene.ts` alone; no data, no docs line, no run field.
- [x] **The tall-grass rustle draws only its blades, at the player's feet, and the still pose
      covers half the character.** Three cuts' worth: the packer no longer re-grounds the
      decompilation's `tall_grass.png` frames onto each field's floor — they are stamped with their
      **own alpha**, so the overlay shows the tile and the player through its transparent pixels
      instead of painting a solid cell over them — and the parked cell is the rip's **settled**
      frame, so standing in grass covers **13.5 of the player's 28.5 visible px (47 %)** and leaves
      the cap, face, shoulders and upper torso clear, while the hit's closing frame still closes
      over the cell for its ~70 ms and the sprite settles on a cell **byte-identical to the hit's
      last frame**, so the settle has no jump. Cells **6 and 45-48** of the three FRLG atlases are
      the only art that moved, repacked from the two sheets by absolute path, and
      `docs/tileset-spec.md` §6 records the rule and the rows. The earlier cuts are why: the anchor
      was provably not the blocker (pixel-identical captures), and the one-sided criterion that let
      a 26 % band pass was replaced by a two-sided one measured on both layouts.
- [x] **The tall grass rustles on the tile the player walks through, with FireRed's own
      animation.** Walking into (or standing in) a grass patch now plays the cartridge's
      *hit* on the player's tile: `scripts/frlg/build-tilesets.mjs` stamps the five
      `graphics/field_effects/pics/tall_grass.png` frames of the pret/pokefirered
      decompilation — materialised in the gitignored `sprite-sources/frlg/` and passed to
      the packer as **command-line paths**, so no packer ever reads inside a worktree — into
      the unused cells `6, 45-48` of each of the three FRLG atlases (cell 6 is the field's
      own tuft, byte-identical to the tall-grass frame 5; the four hits are re-grounded on
      the field's floor), and `RouteScene` cycles them on a single sprite over the player's
      own tile once per step, parking on the rest frame, hiding the moment they step out,
      and covering their feet while the opaque frame plays. `TilesetConfig` gains exactly one
      optional field (`grassRustle`), read through the new pure `grassRustleFrames`
      accessor beside `isGrassStepTile`; no other cell of the map animates, no RNG is drawn
      and no `SAVE_VERSION` step is taken. `docs/tileset-spec.md` §2/§6 and
      `docs/art-direction.md` (the new rip's provenance) record it.
- [x] **A finished run returns to the main menu instead of the starter pick.** `RunOverScene`
      now sends **both** outcomes — a wipe and a win — to `MainMenu` through one
      `returnToMenu()`, so the route the player came from is where a new run is started; the
      summary still reports the victory, the save is still cleared (`clearRun`) and the input
      guards (`RUN_OVER_INPUT_DELAY_MS`, `armed`, `leaving`) are unchanged. `docs/design-spec.md`
      §6 states the destination.
- [x] **An evolution that is not a level-up takes a BST level: 20 / 30 / 40, at least +10
      above the evolution that produced it.** `evolutionLevelForBst` and its
      `EVOLUTION_BST_LEVELS` bands (`src/data/dex/evolutions.ts`) resolve every **non-level**
      branch from the species' own `bst`, anchored on the run's `LevelBand.bst` windows, with
      a `EVOLUTION_MIN_GAP = 10` floor over the resolved level of the pre-evolution; the 69
      canon level-up branches keep their own cartridge levels byte-for-byte, and 60 of the
      156 non-level branches move (Primeape 30 → 40, Seadra 33 → 42, Scyther 20 → 40 …). The
      rule is written for the **shipped** caps and hardcodes none, so a later level-curve
      change moves the numbers and not the rule. `docs/battle-spec.md` §7, the `D38` entry and
      the new `docs/balance/route-curve.md` section carry it.
- [x] **The battle's two HP panels show the active Pokémon's types under its name.** One
      loop in `drawSidePanel` (`src/scenes/BattleScene.ts`) draws up to two badges per side
      from the live fighter (`displayActive`, so a switch, a forme change and a Mega all
      repaint it), read from the Añil type atlas the move cells already use and falling back
      to a coloured text chip for a type the atlas lacks; the panels grew `PANEL_TYPES_H` and
      every other row keeps its offset from `barY`. The compact phone layout needed a
      correction round once QA measured it: the taller foe panel was leaving 33 px of the foe
      battler behind the player panel, so the compact platform is now pinned a platform's
      depth above that panel and the overlap is **0 px**, with the desktop layout, the type
      row and the mon-size caps untouched. No new module, no `src/data/**`, no docs line and
      no literal.
- [x] **The Mart always stocks four rows, and every band's machine beside them.** The stock
      is a **10× ball pack** at half the catalogue price rounded to the hundred (¥1,000 /
      3,000 / 6,000), the band's **Potion** rung, and **two held items** at their catalogue
      price, followed by the per-band TM Task-22 ships — so every `kind: 'status'` cure and
      every X-item has left the buy list and now reaches a run only from ground loot and the
      mini-boss reward. `ShopSlot`/`ShopRow` gained `count` (the pack adds ten units for one
      price, the sell side is byte-identical and still unit-by-unit, so no buy-and-sell loop
      exists) and `SHOP_CORE`/`SHOP_ROTATION_COUNT` are gone. `docs/maps-spec.md` §7 and
      `docs/balance/economy.md` record the stock; `src/scenes/RouteScene.ts` was not touched.
- [x] **Every window in the game is drawn now instead of ripped, and the chrome carries its
      own translucency.** `src/ui/frlg.ts` sliced the FRLG sheets for all six scenes; it now
      serves a committed, **drawn** set under `src/assets/ui/**` (`window.png` 96x96,
      `textbox.png` 128x128, `font.png`) described by `src/data/ui/chrome.json` /
      `src/data/ui/font.json` and produced deterministically by the new
      `scripts/ui/build-chrome.mjs` (`npm run data:ui`), which also derives the font atlas —
      same glyph metrics, shadow pixels' alpha 255 → 128, white ink kept — from the FRLG
      originals, which stay in the tree as the source. Every exported name survives: the
      paddings (20/16/8, 36/28/28), the corners (20/24) and `addFrlgWindow`'s signature are
      unchanged, so no scene's layout was re-cut, while `addFrlgWindow` now applies the set's
      own alpha (0.88 window / 0.94 textbox) so the map and the field stay legible through
      every panel. `FRLG_INK` moves to the deep black `0x0b0b10` and the light window's field
      stays `#f8f8f8` — a dark field would have made the frozen ink unreadable (1.05:1) —
      and `hudTransparent` keeps its id, labels, default and storage, re-read as a degree:
      `Off` is the chrome's own alpha, `On` is the route HUD's alpha 0 plus its outline and
      light text (`applyHudBackground`'s base is `FRLG_WINDOW_ALPHA`). `src/ui/frlgFont.ts`,
      `src/ui/frlgFont.test.ts` (the manifest import), `src/ui/README.md`,
      `src/scenes/RouteScene.ts`, `src/assets/README.md` (three superseded),
      `docs/art-direction.md`, `docs/design-spec.md` §3/§4, `.prettierignore` (one generated
      line), `package.json` (`data:ui`). No settings-model, `src/engine/**` or `SAVE_VERSION`
      change.
- [x] **A Mart always offers one machine, and every machine shows its own type's art.**
      `SHOP_TM` (`src/data/shop.ts`) is the new per-band TM table — six bands, eight catalogue
      ids each, every band's list inside its own TM-number range and strictly after the
      previous band's — and `buildShop` (`src/ui/shop.ts`) draws **one** id from it **last**,
      so every pre-existing pick keeps its fixed-seed sequence. The slot is priced at the
      catalogue's `buyPrice` (¥3,000), deliberately not discounted, because a price under
      `sellPrice` would be a buy-and-sell money loop. `itemIconFrame` (`src/data/itemIcons.ts`)
      now resolves a TM to the `machine<type>` frame of the move it `teaches` — all 171 of
      them, with `machinenormal` as the fallback for an unknown move — because Añil's own
      `machine_<TYPE>` set was already packed: **no repack, no new art, no npm script**, and
      `hasItemIcon` still answers `false` for a TM. The Mart panel already drew whatever
      `buyRows` returned, so no scene changed. `src/data/shop.test.ts`, `src/ui/shop.test.ts`,
      `src/data/itemIcons.test.ts`, `docs/maps-spec.md` §7.
- [x] **A caught Pokémon keeps the share of health it had in the wild.** Reported in play as a
      catch that arrived healed; the loss was the **fold**, not the battle.
      `adoptAtLevel` (`src/engine/run/progression.ts`) rebuilt the member through
      `createFighter`, which starts at full HP, so the level it adopts (`squadLevel`) healed it
      too. It now re-derives the wild's own maximum (`statAtLevel` at the snapshot's level) and
      carries the **fraction**, `Math.round`ed and clamped to `[1, newMax]` — the
      `evolvePokemon` shape one function below — so a wild caught at 30% arrives at 30%, a
      full-HP member (the dev-only `addDebugPokemon`) is unchanged and a 0-HP fixture lands on
      1 HP instead of being released as fainted. Species, level, nature, IVs, EVs, ability,
      gender, shiny and held item are carried as before and the moveset/PP/status rebuild is
      untouched. No `Rng` draw moved, so **no fixed-seed expectation changed** and no re-pin
      was owed; no `SAVE_VERSION` step. `src/engine/run/progression.test.ts`,
      `src/engine/run/resolve.test.ts` (additions only).
- [x] **Run Away's ⓘ stops quoting the dex's competitive blurb.** Measured on `main`, the
      ability was implemented and `port`ed all along — `runAway()` sets `onTryEscape`,
      `runTryEscape` is consulted by `rollRun` **before** the speed odds, and `canRun` refuses
      while trapped — so the defect was the copy: all three ⓘ homes drew
      `detail.abilityDesc`, which carried the dex's "No competitive use" text. The new
      hand-authored `src/data/abilityText.ts` (`abilityText(id)`, ids normalised like
      `getAbility`) holds the override table, and `abilityDescription` (`src/ui/partyDetail.ts`)
      reads **override → dex → null**, so the one change fixes the route HUD's detail panel,
      the capture screen and the battle's SWITCH window. The measurement the entry asked for is
      in the report: the class is `ballfetch honeygather runaway`, and only Run Away is
      `port`ed (the other two are `excluded`, so their blurb does not lie).
      `src/data/abilityText.test.ts`, `src/ui/partyDetail.test.ts`, `docs/data-spec.md` §2,
      `src/data/README.md`.
- [x] **Nine Mega formes are no longer playable species.** `@pkmn/dex` tags its future
      formes `isNonstandard: "Future"`, and 40 of the 49 set `isMega: true` — but nine
      name the forme instead (`absolmegaz`, `garchompmegaz`, `lucariomegaz`, the two
      Meowstic, `magearnaoriginalmega` and the three Tatsugiri), so `isMega` missed them
      and `isPlayable` shipped them as ordinary wild species with **no** stone: the
      playable set was wider than the Mega set by exactly those ids. The shipped rule is
      the named predicate `isUnflaggedMegaForme` — a `Future`, non-`Past` forme whose
      `forme` is a `Mega`-style name carrying no `isMega` flag — added to the
      `isPlayable` chain, so `species.json` and `megas.json` now agree about what a Mega
      is. The playable set falls **1291 → 1282** and `learnsets` **1290 → 1281** while
      `megas.json` stays at 88; the three files the batch had arbitrated for a re-pin
      needed none, because no fixed-seed expectation depended on the nine.
      `scripts/build-dex.mjs`, the regenerated `src/data/dex/{species,learnsets,meta}.json`,
      `src/data/dex/megas.test.ts` + `README.md`, `docs/data-spec.md` §1,
      `docs/tech-decisions.md` (`D3`/`D40` counts), `docs/showdown-reuse.md` §2.
- [x] **A route can no longer ship with no trainer guarding its main lane.** Reported
      against `docs/route-generator.md` §3.4's promise: `placeTrainers` commits a spine
      trainer through `tryFrom` and ignores a `false` return, so a seed whose candidates
      all failed (`candidateOk`: wall-hugging, off the entries and pockets, crowded,
      seeing the entry, or cutting the route) shipped a route with no main-lane fight,
      and `validateRoute` had no field to say so. `RouteValidation` gains
      `missingLaneGuard` (the `'no-trainers'` reason), `ok` gains its conjunct, and
      `sketchRoute`/`sketchRouteSteps` re-roll inside the unchanged `MAX_ATTEMPTS = 8` —
      the attempt index is already part of every stream key, so a re-roll still yields
      one deterministic `(seed, routeIndex)` and draws no extra `Rng` value. The gate is
      **conditional**: the new exported `wantsTrainers(request)` (non-quiet, non-empty
      archetype pool) decides, because a `RouteMap` alone cannot know a quiet room — the
      map's entry and boss rooms — legitimately shipped none. §3.4's promise is now true
      and §4 lists `missingLaneGuard` beside the `borderBandGaps` Task-32 added (nine
      gated lists). One fixed seed changed its shipped attempt (`sweep-b` in
      `validate.test.ts`: attempt 0 → 1, 0 → 4 trainers); a 4 059-request sweep found 42
      requests that now re-roll and none that exhausts the eight attempts, and QA
      re-measured that seed independently.
      `src/engine/routes/{validate,sketch}.ts` + tests, `docs/route-generator.md`.

- [x] **A Pokémon can be named, right in its own STATS panel.** The battle layer already
      rendered a `FighterInput.nickname` but nothing ever set it, so every member showed its
      species name — and the nickname could not simply be `fighter.name`, because Mega
      Evolution and every forme change rewrite that field and restore it from
      `megaBackup.name`. So the nickname is its **own field**: `createFighter`,
      `snapshotFighter` and `restoreFighter` carry it (a test proves it survives a Mega),
      `partyRow`/`fighterDetail` prefer it, and the learn popup and the evolution message name
      the member by it. Typing it happens **in place**: the STATS tab's name row *is* the field
      (`HUD_NICKNAME_*`, a rectangle inside the panel's own window with the `>` focus mark and
      a `click to name` hint), following the MOVES tab's learnset search instead of a modal —
      and while it has focus **every** route key is inert (`handleAction`, `heldDirection`,
      `updateReset` and the dev key), with Enter committing, Escape discarding, and a press
      outside, a tab switch, closing or collapsing the panel or a pause discarding too.
      `normalizeNickname` collapses whitespace, trims and truncates to 12 **code points**, and
      `renameMember` reads the species' own name as "clear it". The save gains the field with a
      `SAVE_VERSION` 14 → 15 step whose migration adds nothing. `src/engine/run/nickname.ts` +
      test, `src/engine/battle/fighter.ts` + tests, `src/engine/save.ts` + test,
      `src/ui/{partyDetail,partyScreen,permadeath}.ts` + tests, `src/scenes/RouteScene.ts`,
      `docs/design-spec.md` §3, `docs/battle-spec.md` §7.
- [x] **Every type has its badge, Fairy included, and the statuses come from Añil too.** The
      FRLG sheet predates Fairy, so a Fairy type fell back to a text chip. Both atlases are now
      packed from Añil's own UI art (`Graphics/UI/types.png`, `statuses.png`) by two packers
      that take their source as an argument and fail loudly when it is missing — the repo's
      answer to keeping a gitignored asset out of a worktree. Frames keep the old geometry
      (types **32x14**, status **32x8**, 4 columns), so no consumer changed. Types: 19 badges —
      the 18 types plus the sheet's `???` slot, a flat bar with no glyph kept for manifest
      parity — and `fairy` draws. Statuses: Añil ships seven (SLP/PSN/BRN/PAR/FRZ/FNT/PKRS) and
      **no badly-poisoned** one, so `tox` keeps the `psn` frame and the test asserts the
      fallback instead of inventing a badge. Both tests decode the committed PNGs and check the
      frames are not empty, so a packer that wrote a blank sheet cannot pass.
      `scripts/frlg/build-{type,status}-icons.mjs`, the two `src/data/frlg/*.json` + atlases,
      `src/data/{typeIcons,statusIcons}.ts` + tests, `package.json` (`data:frlg:icons`),
      `docs/art-direction.md`.
- [x] **The dex ships the Z-A and Champions Megas: 48 → 88 Mega formes.** `@pkmn/dex` already
      carried them, tagged `isNonstandard: "Future"`, and our own `isMega` filter accepted only
      `Past`, so 40 formes were missing. The rule as shipped is the dex's own tag: a `Future`
      row counts when it carries **`isMega: true`**, not when its name ends in Mega — because
      nine `Future` entries name the forme instead (`absolmegaz`, `lucariomegaz`,
      `garchompmegaz`, the two Meowstic, `magearnaoriginalmega` and the three Tatsugiri), they
      are already in `species.json` as *playable* species, and three of them would share a stone
      (`meowsticite`, `magearnite`, `tatsugirinite`), which the one-stone-per-forme guard
      rejects; fixing that is registered as its own task. Two dex rows carried an inconsistent
      HP (`floettemega` 74, `zygardemega` 216) and the generator now normalises the HP **and**
      the `bst`, while still throwing when the discrepancy belongs to a `Past` Mega. Every new
      forme maps to its own Añil sheet (no art fallback), all of them get a stone row through
      `MEGA_STONES`, and `roster.test.ts` needed no re-pin. `scripts/build-dex.mjs`, the
      regenerated `src/data/dex/{megas,meta}.json`, `src/data/dex/megas.test.ts` + `README.md`,
      `src/data/anil/pokemon-sprites.json`, `public/anil/portraits*.png`, `docs/data-spec.md`,
      `docs/showdown-reuse.md`.
- [x] **An opening now owns its whole border band.** Reported in play: a route's opening showed
      only part of its door, with border tiles the opening occupied still wall/fence.
      `exitEdgeAt` was never the problem — it already counts any walkable border cell of an
      opening edge as a door — the **geometry** was: `placeAccess` opened a single ring cell
      while `carveGuaranteedPath` carved a two-wide lane, so the band's second cell existed only
      where `cleanWalls` happened to widen the hole, and that pass's bite band is three columns
      anchored at the map's left edge, so it never reached the second cell of an **east**
      opening in a room whose side is ≡ 1 mod 3 (maps 4-6). The fix is engine-only: a pure
      `openingBandCells` in `doors.ts`, `placeAccess` opening the whole band, the band cells
      joining the terrain passes' forbids, and a new `borderBandGaps` gate (sorted row-major) in
      `validateRoute` so `sketchRoute` re-rolls instead of shipping a half-band door. The
      regression freezes the failing case — seed `doors-c`, map 4, room 3, edge `E`, the
      `(30,20)` cell that used to be a wall — and the sweep covers maps 1-6. **A pre-existing
      hole it exposed** is registered as its own task: `placeTrainers` may return zero trainers
      and nothing gates it, against `docs/route-generator.md` §3.4's promise.
      `src/engine/routes/{doors,sketch,validate}.ts` + tests, `docs/routes-spec.md`.
- [x] **Every catch now mints its own member id, so a party row and its detail panel finally
      agree.** Reported in play: catch a third Pokémon and clicking it showed the **second**
      one's stats. The wild fighter was built with a constant id (`createFighter({ id: 'wild'
      })`, `BattleScene`), the encounter key behind it (`grass:x,y`) is not unique per run
      either, and `memberById` resolves a member by **first match** — so every catch of a run
      entered the party and the box as `wild` and the panel answered with the earliest one,
      while the row (drawn by index) looked right. `resolveBattle` now mints the catch's id at
      the fold through a pure `nextMemberId(run)` — grammar `catch-<n>`, stepped past any id
      the party or the box already holds, deterministic and with **no** `Rng` draw (`D11`) —
      which is engine-only, so no scene changed. An old save whose members already collide is
      repaired by `dedupeMemberIds(run)` in the save decoder's `parseRun`, a decode-time
      normalisation like `parseDiscoveredRooms`, so **no** `SAVE_VERSION` bump and no
      migration step; `pcUnlocked` is remapped by the same repair, so a catch keeps the box
      lock it named. `src/engine/run/{state,resolve}.ts` + tests, `src/engine/save.ts` +
      `save.test.ts`, `src/ui/partyDetail.ts` + test, `docs/battle-spec.md` §7.
- [x] **The run's held-item catalogue is the whole competitive set, with Añil's own
      icons.** `src/data/items.ts` grows to 143 new rows (51 the engine can model,
      92 honest `no-op`, 21 hand-authored), `ItemDef` gains nine fields
      (`damageBoost`, `speedBoost`, `accuracyBoost`, `critStages`, `alwaysLast`,
      `resistBerry`, `recoil`, `selfStatus`, `survive`) and
      `src/engine/battle/effects/items.ts` gains the handlers that read them plus
      `UNMODELLED_ITEMS`, the by-name record `scripts/effect-coverage.mjs` reads to
      print an honest `no-op` row (`D16`; the Items table is now 117 `port` / 92
      `no-op` / 81 `excluded`). **The seventeen Plates are obtainable at last**: they
      are catalogued rows the coverage table can see and they drop as `late`/`end`
      loot, where before a run could never hold one. The Mart stocks only what works
      and the ground hands out what does not, so no player buys a dead item. The FRLG
      sheet had no art for the modern items, so `scripts/anil/build-item-icons.mjs`
      packs Añil's 893 item icons into one 24 px atlas
      (`src/assets/anil/item-icons.png` + `src/data/anil/item-icons.json`, keyed by
      the normalised file name, with `hasItemIcon`/`itemIconFrame` over it) — which is
      exactly why no scene changed. `src/data/dex/items.ts` is the typed accessor the
      catalogue reads instead of raw JSON. No new `Rng` stream: the two probabilistic
      handlers draw the battle's own, and the loot and shop tables keep a fixed-seed
      regression. `package.json` (`data:anil:items`), `src/data/{items,loot,shop}.ts`
      plus their tests, `scripts/anil/build-item-icons.mjs`,
      `scripts/effect-coverage.mjs`, `docs/{art-direction,data-spec}.md`,
      `src/assets/README.md`, `src/data/README.md`, `src/data/dex/README.md`.
- [x] **An ability explains itself: the ability row carries the ⓘ the move cells
      have.** Hovering it floats the dex's own description and a click pins it, in
      the route HUD's STATS tab, the battle's SWITCH detail window and the capture
      screen. The floating window moved out of `MoveGrid` into
      `src/ui/infoPopup.ts`, so the move cells and the ability rows draw one
      implementation instead of drifting apart, and `src/ui/abilityInfo.ts` owns the
      ability row's control and the text it floats. The data was already generated
      and thrown away: `src/data/dex/abilities.ts` now carries `desc` and `shortDesc`
      (both coerced to `''`, so a consumer concatenates without a guard) and
      `MemberDetail.abilityDesc` carries the one-line text. The smoke pass also found
      and fixed a real bug on the capture screen: a pinned popup no longer closes when
      the pointer leaves it. `src/ui/{infoPopup,abilityInfo,partyDetail,moveGrid}.ts`
      plus their tests, `src/scenes/{RouteScene,BattleScene}.ts`,
      `docs/design-spec.md` §3/§4, `src/ui/README.md`.
- [x] **The shipped cues are the real FRLG soundtrack, not sine placeholders.** The
      first cut of the audio table committed a generated 1.5 s sine per music bed
      and a 0.2 s sine per cue, because `sprite-sources/frlg-audio/` was never
      materialised — so the game only ever beeped. `pret/pokefirered` ships its
      soundtrack as MIDI plus the instrument bank and samples, never as audio, so
      `scripts/frlg/render-frlg-audio.mjs` now fetches a sparse checkout of that
      decomp plus the `huderlem/poryaaaa` m4a renderer and renders one file per cue
      (the title, Route 1 and vs.-trainer beds, faint, level-up and the
      trainer-victory fanfare), cutting a looping bed down to its loop body so the
      file Phaser loops is the song's own loop. One master gain lifts the lot — the
      decomp's own `-V` mix lands near a tenth of full scale — and the packer's
      caps are per-cue now, so a fanfare is never cut mid-phrase; `cues.test.ts`
      fails if a committed cue is still a placeholder sine. **The `hit` and
      `encounter` cues were dropped rather than faked**: the original varies a hit
      per move (`SE_M_*`) and an encounter is the appearing Pokémon's cry, so
      `se_bang` (the Cut-door bang) and `se_warp_in` (a warp) were never going to
      stand in for them; both moments now play nothing until `[Task-30]` lands.
      Every remaining cue is still one cue-id row in `src/audio/cues.ts`, so a CC0
      set replaces the rip without touching a call site.
      `scripts/frlg/render-frlg-audio.mjs`, `scripts/frlg/build-audio.mjs`,
      `src/assets/audio/*.wav`, `src/audio/{cues,cues.test}.ts`,
      `src/scenes/{RouteScene,BattleScene}.ts`, `src/audio/README.md`,
      `src/assets/README.md`, `docs/tech-decisions.md` (`D22` addendum).
- [x] **Every Pokémon opens with a full four-move set by level 5.** At or below
      level 5 `defaultMoveset` now tops an under-full moveset up from the
      species' own learnset — earliest level-up moves first, then its
      TM/tutor/egg moves — keeping at least one damaging move, so a level-1 catch
      (or a wild Pokémon at the bottom of its band) never fights with one or two
      moves. A species with fewer than four legal moves gets everything it has,
      never a duplicate; above level 5 the "newest four" rule is unchanged. Pure
      and seed-stable, no RNG added. `src/engine/battle/fighter.ts`,
      `docs/battle-spec.md` §7.1.
- [x] **The game ships the full move set (D42).** `build-dex.mjs` generates every
      real move, the `Past` ones included, so a Dexit species keeps its learnset:
      `moves.json` grows 685 → **835** (King's Shield, Aromatherapy, Linoone's
      Belly Drum...). Dynamax (Max) and Z moves are dropped — the engine models
      neither — as are CAP/Future/Unobtainable entries, and Hidden Power's 17
      typings collapse to the single Normal entry (its IV-based type is not
      modelled; this also fixed a duplicate-id bug that corrupted the random
      learnset). `scripts/build-dex.mjs`, `src/data/dex/*.json`.
- [x] **Form-change abilities are generalised like Zero to Hero (D41).** Any
      species may now roll and use **Schooling, Zen Mode, Zen Mode (Galar),
      Shields Down, Tera Shift, Hunger Switch, Forecast, Flower Gift, Stance
      Change and Disguise**: from level 20 on, each changes the holder's forme by
      its own rule (`changeBattleForm`/`restoreBattleForm`, battle-only, snapshot
      kept on the base species) and flips back when the condition ends.
      `randomAbility` no longer bans them; `changeBattleForm` keeps the holder's
      ability so the rule keeps firing. Stance Change's Shield revert needs
      King's Shield (a `Past` move not shipped yet) and Commander stays excluded
      (doubles-only). `src/engine/battle/effects/abilities.ts`,
      `src/engine/battle/fighter.ts`, `src/engine/battle/randomAbility.ts`,
      `scripts/build-dex.mjs`, `docs/balance/effect-coverage.md`.
- [x] **The game ships the full National Dex (Dexit included).** `build-dex.mjs`
      no longer filters to the Gen 9 standard set: `species.json` is now **1291
      entries across all 1025 dex numbers** (911 → 1291), with **48 Megas** beside
      it (`D40`). Only non-species are dropped — CAP/fan entries, `Custom`
      (MissingNo, Pokéstar), LGPE's partner starters (no art) and the battle-only
      Gigantamax/Eternamax formes. A Dexit species with no gen-8 learnset falls
      back to its newest one, a forme inherits its base species', and a species
      whose whole learnset left Gen 9 (Unown) gets Tackle, so nothing ships with
      an empty moveset. Battle art repacked (`npm run data:anil`, 1291 species +
      48 megas). This is the prerequisite for the generalised form abilities.
      `scripts/build-dex.mjs`, `scripts/anil/build-pokemon-sprites.mjs`,
      `src/engine/battle/fighter.ts`, `src/data/dex/*.json`.
- [x] **Encounters and rosters are BST windows per floor, derived from the dex.**
      The hand-authored `ENCOUNTER_TABLES` (per biome) and the archetype `pools`
      are gone: a pure `speciesPool(band, roster)` (`src/engine/run/pool.ts`,
      `D39`) filters the playable dex by the band's inclusive **BST window**
      (`LevelBand.bst`, `src/data/run.ts`) and by the roster's bans. The windows
      tile `0..800` (~120-150 species each), so every spawnable species now
      appears somewhere — the wild covers all but the legendary/mythical tags,
      and a trainer may field any species, legendaries included. The tall grass
      bans `Restricted Legendary`, `Sub-Legendary` and `Mythical`; battle-only
      formes never spawn in either. A **boss** (map boss and mini-boss) fields the
      **upper half** of its band's window. `src/engine/run/pool.ts`,
      `src/engine/run/roster.ts`, `src/engine/routes/encounters.ts`,
      `src/data/run.ts`, `src/data/trainers.ts`, `src/data/biomes.ts`.
- [x] **Abilities are rolled per run, and two once-unimplementable ones are
      reworked around the random pool.** Every wild, trainer and starter Pokémon
      — and each catch — now **rolls its ability** from the implemented set under
      the run seed (`randomAbility`), the way its moveset already was (`D17`);
      an explicit ability (the debug editor) still wins. The roll draws only from
      the effect registry, so an unported ability can never appear, and No Guard
      is dropped when the moveset holds an OHKO move so the pair never meets. Two
      abilities that would be dead on an arbitrary species are now **generic**
      instead of banned: **Zero to Hero** turns any holder into Palafin-Hero
      when it leaves the field (battle only, reverts at the end), and **Wonder
      Guard** absorbs the **first** non-super-effective hit on each switch-in —
      the next hit lands normally. An **evolution re-rolls** the ability from the
      new species under the same seed. `src/engine/battle/randomAbility.ts`,
      `src/engine/battle/fighter.ts`, `src/engine/battle/effects/abilities.ts`,
      `src/engine/run/progression.ts`, `src/scenes/BattleScene.ts`.
- [x] **The effect coverage table is regenerated.** `npm run docs:coverage`
      reports the abilities and items already in the code that the stale table
      still called `excluded` (Normalize, Aerilate, Refrigerate, Wonder Guard,
      Zero to Hero, the treasure items…). `docs/balance/effect-coverage.md`.

- [x] **The debug Party tab sets the squad level once, not per member.** The
      level moved out of the member editor into a **Squad level** control at the
      top of the tab: it parks the run's XP and re-levels the **whole party and
      the PC box** together (they share one level, `D35`), while the member
      editor keeps moves, ability and nature. The member dropdown also suffixes
      identical labels (`Eevee Lv20 (1)`, `(2)`) so two same-species members at
      the same level can be told apart. `src/dev/debugMenu.ts`,
      `src/scenes/RouteScene.ts`, `src/main.ts`.
- [x] **Dev-added Pokémon no longer collide on their id.** The debug panel's
      counter resets on a reload, so a re-added species reused `debug:<sp>:1` and
      `updatePokemon` (which matches by id) then edited or replaced several
      members at once. `nextDebugPokemonId` scans the live party and box for a
      free counter, so every drop stays unique. `src/dev/ids.ts`,
      `src/scenes/RouteScene.ts`.
- [x] **Level evolutions, drawn as a family graph and taken with a click.**
      Every dex evolution — level, stone, trade, friendship, move — is resolved
      to a level (`evolutionBranches`): a canon level evolution keeps its level,
      the rest take their species' own level evolution or a stage default (base
      forms at 20, middle forms at 30), never below the level the species was
      obtained at, and all of a species' branches share it. Evolution is now
      **manual** (`D38`): a member no longer evolves on level-up or on a catch;
      the STATS tab draws its whole family as a graph — one row per species
      indented by stage, each with its sprite and the level it evolves at, the
      pre-evolutions included — with the current species gold and a branch whose
      level is met green, a `click to evolve` hint and a pointer cursor, so
      Eevee's eight forms are a choice. A click evolves the member, keeping its
      level, nature, IVs/EVs, moves, PP, status and held item and carrying the
      missing HP across. The STATS tab also paints the stat a nature raises green
      and the one it lowers red (in the battle panel too).
      `src/data/dex/evolutions.ts`, `src/ui/evolutionGraph.ts`,
      `src/engine/run/progression.ts`, `src/ui/partyDetail.ts`,
      `src/scenes/RouteScene.ts`, `src/scenes/BattleScene.ts`.
- [x] **The MOVES tab gains a learnset band: search, learned moves and bag TMs,
      dragged onto the four slots.** Below the slotted moves the detail window
      shows a search field over a paged, full-width grid of every move the member
      may equip — the level-up moves it has already learned and does not hold, and
      the moves a **TM in the bag** can teach it — tagged `Lv##` or `TM###`. The
      grid spans the window; its paging arrows ride the search row and an empty
      pool reads `no moves to learn`. A pool cell
      drags onto a slot to equip it (replacing what sat there), so a move already
      in the four slots is never listed; teaching never spends the TM (`D36`). The
      panel grew to fit the band. `src/engine/run/learnset.ts`,
      `src/scenes/RouteScene.ts`.
- [x] **Technical Machines.** The full base-Gen-9 TM catalogue (TM001 … TM171)
      ships as **reusable** `machine`-pocket items, hand-authored from the dex's
      `9M` learnset flags (`src/data/tms.ts`), and drops from route loot and
      mini-boss rewards. `src/data/items.ts`, `src/data/loot.ts`.
- [x] **A level-up popup announces "X learned Y!".** When the squad's level ticks
      up (`playLevelUp`) a modal lists every move each member crossed; any key or
      click dismisses it. `src/scenes/RouteScene.ts`.
- [x] **A move's type badge reflects the ability and the battle context.** The
      `-ate` abilities (Aerilate, Galvanize, Pixilate, Refrigerate), Liquid Voice
      and Normalize retype a move, and the context moves Weather Ball, Terrain
      Pulse, Revelation Dance and Aura Wheel read the weather, terrain, user's
      primary type or form — in the FIGHT menu, the party panel and the damage
      calc alike. `src/engine/battle/moveType.ts`,
      `src/engine/battle/effects/moves.ts`.
- [x] **Plates give Judgment its type.** The seventeen Plates ship as held items
      (`plate` plus the canon 1.2x `typeBoost`); while one is held, Judgment takes
      its type in the FIGHT menu, the party panel and the damage calc. Arceus is
      not spawnable yet, so the Plates are catalogued but not obtainable.
      `src/data/items.ts`, `src/engine/battle/effects/items.ts`,
      `src/engine/battle/moveType.ts`.
- [x] **The HUD move cell's ⓘ floats the description again.** `MoveGrid.infoAt`
      compared a cell-local point against an absolute rect, so the HUD's ⓘ button
      never matched and neither hover nor click showed the info popup; it now
      tests the point in cell-local space, so hovering the ⓘ floats the move's
      type and description and clicking it pins the popup. The popup now anchors
      to the hovered cell (`popupAtCell`) instead of the panel top, so in the HUD
      it appears right over the move it belongs to. `src/ui/moveGrid.ts`.
- [x] **The member detail panel is wider and shorter, with the stats in two
      columns.** The detail window (the STATS / MOVES popup) is now 460px wide
      instead of a copy of the party/box window: the HP bar is gone (the HP row
      prints `current / max`) and the six stats read as two columns of three
      (`HUD_DETAIL_STATS`), with NATURE / ABILITY and HELD / CAUGHT in two columns
      too. The wider window also gives the shared move grid cells enough room for
      full move names — the HUD's `MOVES` tab no longer wraps "Thunder Shock" onto
      the PP line. `src/scenes/RouteScene.ts`.
- [x] **The HUD's MOVES tab is the battle's move grid.** The member detail panel's
      MOVES tab now draws the shared `MoveGrid` component the battle's FIGHT menu
      uses — the same type-tinted 2x2 cells with the type and category badges, PP
      and power/accuracy, an ⓘ button and the floating description popup — instead
      of a plain list. The type badge is now the same size as the category badge,
      so the two read as one stacked column. Hovering or clicking the ⓘ floats
      (and pins) the move's info while the cells stay draggable to reorder the
      member's moves. `src/ui/moveGrid.ts`.
- [x] **The battle menu window is taller and the move names sit higher.** The
      bottom menu box grew (desktop `160→192`, compact `204→236`) to give the
      move cells more room, keeping its bottom edge (and so the message box) in
      place. In the shared grid the content anchors higher (`CELL_TOP`), so the
      move name reads as the cell's title above the badges. The ◀ back control
      now sits centred in a wider left column (`MOVE_BACK_COL` 46→64), so the
      grid starts clear of it instead of touching it. Switching a battle menu
      also hides the FIGHT / BAG / SWITCH / RUN cells again (they had been left
      visible under the bag and switch screens after the grid split).
- [x] **Starters require two consecutive evolutions.** The starter pool now keeps
      the base form of a line only when two more evolutions follow in a **chain**
      (`evolutionDepth >= 2` in `src/data/dex/evolutions.ts`), so a split line
      whose children are all final (Eevee, Scyther) is no longer offered even
      though its family has three members. `docs/design-spec.md` §3.
- [x] **The mini-boss and mega-stone rooms hold their own content** (Phase 9
      step 13). A **mini-boss** leaf fields a strong `ace` trainer (a band-level
      party one size larger, allowed a Mega Stone) that stands while unbeaten;
      beating it opens a **reward choice** — three distinct items drawn from the
      map's reward pool (`rewardChoices` in `src/ui/rewards.ts`), taken with `E`
      or skipped with `Q`. A **mega-stone** leaf holds a random **Mega Stone** on
      its far tile, taken with the interact key like any ground item, off a
      per-floor stream (`MEGA_STONE_IDS`). Both use stable content ids
      (`miniBossTrainerId`, `mega-<map>`), so a revisit rebuilds them identically
      and a beaten mini-boss stays beaten. `docs/maps-spec.md` §7, `D33`.
- [x] **The shop room and its Mart panel** (Phase 9 step 12). A shop floor's
      counter (`E`) opens a Pokémon Mart-style HUD window that only exists in that
      room: a **BUY** tab (the band's core of Balls/Potions plus one or two
      rotating items, at catalogue prices) and a **SELL** tab (any item at
      `sellPrice`), showing the run's money, each row's icon and owned count, and
      a feedback line. The stock is a pure `(band, rng)` roll
      (`buildShop` in `src/ui/shop.ts` over `src/data/shop.ts`), so a floor always
      opens the same shelves; the trades, rows and sellability are pure and
      headless-tested. `RouteScene` places the counter on the shop room's farthest
      tile, blocks it and opens the panel with `E`. `docs/maps-spec.md` §7,
      `docs/design-spec.md` §7, `D33`.
- [x] **The floor's special rooms are hung in the plan** (Phase 9 step 11).
      `MapPlan` gains a `specials` list and every `MapRoom` a `special` kind: a
      guaranteed **shop** leaf near the entry, a **mini-boss** leaf at 50% and a
      **mega-stone** leaf at 15% **from map 3 on** (the two may coincide). They
      are extra dead-end leaves on the same `map` stream, hung off regular rooms
      only (never the entry or the boss, so both keep their single door).
      `roomView` carries the kind through, the route builder treats a special
      room as **quiet** (no tall grass, ledges, items or trainers) and the minimap
      now draws each special's own marker. `docs/maps-spec.md` §7,
      `docs/routes-spec.md` §2, `D33`; plan tests for placement, counts, odds,
      coincidence and determinism.
- [x] **The Poké Dollar economy lands: trainers pay, valuables bank.** `RunState`
      carries `money` (a run starts with none; `SAVE_VERSION` 14 +
      `SAVE_MIGRATIONS[13]`). A beaten trainer drops its archetype's **fixed base
      plus jitter**, scaled by the map's band and tripled for the floor boss, and
      only a **first** win pays (`src/engine/run/reward.ts`, `BattleReward.money`,
      `resolveBattle`). The route HUD's **bag panel** grows a MONEY footer. Nine
      **valuables** (Stardust, Pearl, Nugget, Star Piece, Rare Bone, Big Pearl,
      Pearl String, Big Nugget, Comet Shard) join the catalogue as a new
      `valuable` kind with its own bag pocket (`VALUE`); they sell for their whole
      price (other goods still half) and turn up in the route loot pools by band
      (`src/data/loot.ts`). `docs/maps-spec.md` §7, `docs/design-spec.md` §7,
      `D33`; pure tests for the reward roll, `addMoney`/`spendMoney`, the
      migration and the pockets.
- [x] **The battle moves menu reads the numbers and floats its info.** The moves
      grid always reserves its full **2x2**, so one or two moves keep the same cell
      size as a full set, and each cell shows the move's **effective power** (base
      power folded with **STAB** and the attacker's **ability / item** boosts) and
      its **hit chance** (the move's accuracy under the net accuracy / evasion
      stage and any ability), both tinted **green** when raised and **red** when
      lowered, with an ↑ / ↓ on the accuracy. The selection **arrow inside the
      cell** is gone. The move's type and description moved out of an always-on
      popup into a floating window opened by a **ⓘ button** on hover or click; it
      no longer shifts the Pokémon's data panel and now carries the FRLG **type
      badge** and, for a status move, its **status badge**. The status badges are
      packed from the same `type-status-icons.png` source by
      `scripts/frlg/build-status-icons.mjs` (`src/assets/frlg/status-icons.png`,
      `src/data/statusIcons.ts`) and replace the text abbreviation in the battle HP
      panels. New pure `movePreview` in `src/engine/battle/preview.ts`.
- [x] **The Pokevial holds three charges, earned by fighting.** It is no longer a
      single-charge, text-labelled button that refilled at each floor's heal stop:
      the party header draws a **single bar** whose fill climbs through three
      colour stages with **POKEVIAL** written inside (the `x/3` count is gone and
      the hand cursor only shows over a **full** bar), each **beaten trainer** adds
      one charge up to the cap of three, a floor's **boss** fills the bar to the
      top, and the meter **carries over** between floors — only a fresh run starts
      full. Drinking it still rests the whole party and box
      (`POKEVIAL_MAX_CHARGES`, `chargePokevial`/`fillPokevial` in
      `src/engine/run/heal.ts`; `markBossDefeated` and `resolveBattle`).
- [x] **The party and the PC share one level and one XP bar.** XP is run-wide now
      (`RunState.xp`, `squadLevel`): a battle fills the squad's single bar and the
      whole party **and box** level with it, learning moves and evolving as they
      go, and a catch joins at that level (its stats, moveset and any allowed
      evolution are rebuilt from the species there, whatever level the wild was).
      The party panel leads with the shared `Lv` and a general XP bar and drops
      the per-row level and HP numbers (portrait, name and bar only), with the
      Pokevial centred under the bar; the battle's player panel draws the same
      general bar. The per-map cap still clamps gain (D9/D29, `SAVE_VERSION` 13,
      `SAVE_MIGRATIONS[12]`).
- [x] **HUD panel quick keys, and the panel button prints its key.** `P` opens
      PARTY, `I` the bag, `M` the map and `O` the PC box (the settings key moves to
      `Tab`); a panel's corner button now sits flush in its top-left and, on a
      keyboard screen, grows into a small rectangle that prints the key under the
      icon (a touch screen shows only the icon). The four actions join the keybind
      map (`SAVE_VERSION` 12, `SAVE_MIGRATIONS[11]`), so they are rebindable and
      listed in the settings screen (`src/data/keybinds.ts`, `RouteScene`).
- [x] **The party panel drops its `PARTY` title, and its HP bar is smaller** (0.6
      of the FRLG bar instead of 0.75), so the row reads cleaner (`RouteScene`).
- [x] **Every route is at least 30x30, and the entry and boss rooms are always
      exactly 30x30.** `MAP_MIN_ROOM_SIZE` (`src/data/maps.ts`) floors every map's
      size range at 30 — the maxima keep their progression, so maps 1–3 become
      30x30 and later maps stay a range — and `planMap` pins the floor's two quiet
      leaves, the **entry room** and the **boss room**, to that size on every map
      (`docs/maps-spec.md` §1/§6, `docs/routes-spec.md` §2).
- [x] **The touch controls live only on the route.** The on-screen pad and A / B
      are gone from the main menu, the starter pick, the settings screen and the
      run-over screen (the battle never had them), so a phone only shows them while
      walking a route. The pad's arms are also slimmer, longer and drawn without
      their chevrons (`src/ui/touchLayout.ts`, `src/ui/touchControls.ts`).
- [x] **The route HUD is always on screen** — the `I` toggle (and its keybind row)
      is gone — and a fresh save opens **only PARTY**, every other panel collapsed
      to its icon (`defaultHudLayout`, `RouteScene`). With the HUD always up,
      interacting (`E`) and hold-to-reset (`R`) are no longer blocked by it.
- [x] **The starter pick adapts to a phone.** On a narrow or portrait stage the
      three candidates stack as full-width rows (portrait left, name and type
      badges beside it), the whole card taps to pick, the level line is gone and
      the selected Pokémon's portrait bobs gently. Types draw as the FRLG **badge
      icons** packed by `scripts/frlg/build-type-icons.mjs` into
      `src/assets/frlg/type-icons.png` (`src/data/typeIcons.ts`); the FRLG sheet
      predates Fairy, so a Fairy type falls back to its name. `docs/design-spec.md`
      §3, `docs/art-direction.md`.
- [x] **Battle battlers draw 25% smaller on the phone layout** (`COMPACT_MON_SCALE`
      in `BattleScene`), so they sit clear of the stacked panels; the desktop
      square is unchanged. `docs/design-spec.md` §4.

- [x] **A run starts with ten Poké Balls.** `STARTING_BAG` (`src/data/run.ts`) hands
      a fresh run a stack of ten, so the first catch never waits on the route
      economy; every other item is still earned along the way.
- [x] **One catch per route, tied to the first wild battle.** A room's capture is
      spent by its **first wild battle** whatever the outcome — catching the
      Pokémon, defeating it or running away all close the room's window — so only
      the first wild Pokémon that appears can ever be caught there. Once spent, the
      **minimap marks the room** with a Poké Ball and the BALL command is disabled
      for later encounters (`useCapture` in `RouteScene.startBattle`,
      `buildMapView`'s `captureSpent`).
- [x] **A caught Pokémon remembers where it was found.** Each catch stores its
      **biome and route** (`RunPokemon.caughtAt`, `CatchLocation`), shown as a
      `CAUGHT  <biome> · Map <n> · Route <n>` line in the STATS tab
      (`memberDetail`/`MemberDetail.caughtLabel`).
- [x] **Single-door entry and boss, quiet rooms, PC lock and the full-party
      capture screen.** The map's **entry room** is now a **single-door leaf** like
      the boss (its only opening is the one link into the floor; the outward entry
      edge is not carved), so a floor needs at least **six** rooms — the two leaves
      plus a four-room core closed into a cycle (`buildFloor`, `src/data/maps.ts`).
      The entry room and the boss room are **quiet**: no tall grass, no ledges, no
      ground items and no trainers (`RouteRequest.quiet`, `sketchRoute`).
      The HUD's **PC (BOX) window** is always viewable but its swaps are **locked**
      except on the **first visit to a floor's entry room** and for the **Pokémon
      caught on the current floor**; a new floor resets both (`pcFullyEditable` /
      `pcMemberEditable`, `RunState.entryDeparted` / `pcUnlocked`, `SAVE_VERSION`
      11). A catch that leaves the party **full** opens a **capture screen**: the
      caught Pokémon's stats beside the party, to **swap it for a member** (the
      replaced one goes to the PC) or **send it to the PC** (`resolveBattle`
      `placeCapture`, `RouteScene.openCapturePrompt`). `docs/maps-spec.md` §2/§3/§6,
      `docs/routes-spec.md` §3/§6.
- [x] **Mega Evolution in battle** (`D34`, Phase 9 step 9). A Pokémon holding its
      **Mega Stone** can Mega Evolve **once per battle**: the command menu grows a
      **MEGA** control that arms the evolution, and the next FIGHT spends it while
      still attacking that turn. The forme is applied **before any move**, so the
      turn reads the Mega's Speed, type and ability (an on-switch-in ability such
      as Drought fires then), and the engine swaps stats, types and ability while
      keeping the item, moves and HP. The AI spends its stone on its first fight
      command. `src/engine/battle/mega.ts` holds `canMegaEvolve`/`megaEvolve` and
      `FightCommand` carries a `mega` flag; `snapshotFighter` returns to the base
      species after the battle. The 34 Mega formes of playable Gen 9 species are
      generated into `src/data/dex/megas.json` (their own file, never spawned) and
      `src/data/items.ts` builds one unsold stone per forme. Bosses, mini-bosses
      and the `ace` archetype carry a stone (`carriesMega`/`RosterOptions.allowMega`
      in `src/engine/run/roster.ts`); the ace pools gained a few Mega-capable
      species so it triggers. Fixed-seed tests in `mega.test.ts`, `megas.test.ts`
      and `roster.test.ts`; `docs/battle-spec.md` §9 updated.
- [x] **The boss room is a quiet dead-end.** The boss is hung off the floor's
      farthest regular room as an extra **dead-end leaf**, so it has a single door
      while the floor keeps its cycles (maps now roll at least five rooms). It
      carries no tall grass and no regular trainers — just the boss. Its **portal**
      is carved from the start on a free wall and stays **sealed** until the boss
      falls, so the room looks identical before and after it opens.
      `docs/maps-spec.md` §2/§6.
- [x] **Maps start in the centre.** The entry room has no outward door: the run
      spawns the player at the **centre** of the map's first room (a fresh run or a
      portal step), and its only openings are its links, so there is no door that
      leads back off the map. The route builder carves a lane from the centre to the
      carved network so the spawn is always floor and connected; a room is carved
      the same whichever way it is approached. `docs/maps-spec.md` §2/§3.
- [x] **Trainers stay beaten.** A room's carved geometry and its spawn no longer
      depend on the door the player arrived through, so entering the entry room
      from outside and from a neighbour builds the **same** room — same openings,
      same trainers, same items — and its trainer/item ids stay stable (a beaten
      trainer cannot reappear). Openings are also a couple of tiles wide now: any
      cell of the gap leads out, but only when the step is taken **toward** the
      border (walking along the gap never bounces the player back) —
      `src/engine/routes/doors.ts`.
- [x] **A floor's marks persist while you explore it.** Beaten trainers, taken
      ground items and spent captures no longer reset on every room change;
      `RunState` keeps them for the whole floor and only `advanceMap` clears them,
      so walking back into a room cannot respawn its content. The capture stays
      **one per room** (`capturedRooms`, save v9 with a v8→v9 migration), so a room
      grants a single catch while a different room can still catch.
      `docs/maps-spec.md` §2/§7.
- [x] **Room transitions are coherent** (`D30`). Leaving a room by a door now
      spawns the player at the **opposite** door of the neighbour — leave East,
      arrive West — instead of the door the plan derived from the entry by BFS, so
      a room reads the same from every approach and you can always walk straight
      back. The door the run arrived through lives in `RunState.arrivalEdge` (with
      a v7→v8 save migration that recovers the plan-derived edge), and the room's
      geometry, trainers and loot seed off a **stable per-room index**
      (`routeIndexForRoom`), not the run's moving counter, so walking back into a
      room lays out the **same** room instead of rerolling it. `docs/maps-spec.md`
      §2/§9 updated.
- [x] **The floor minimap** (`D32`). The `I` overlay's route header becomes the
      **floor minimap**: the map name sits over a Binding of Isaac-style grid of
      the rooms **discovered** so far, each drawn from the room's own width/height
      with its openings on the matching walls, the current room highlighted, the
      boss marked and the open portal flagged. A link is drawn only once **both** its
      ends are known, and a room stays hidden until it is entered, so the floor
      reveals itself as the run advances. The layout is pure and Phaser-free in
      `src/ui/mapView.ts` (`buildMapView`, `MAP_VIEW_GAP`) with its own tests;
      `RouteScene` only scales and paints it on a `Graphics`, redrawn on every room
      change. Special rooms already carry their own marker (shop, mini-boss,
      mega-stone), ready for Phase 9 step 11. `docs/maps-spec.md` §8,
      `docs/design-spec.md` §3 updated.
- [x] **Randomized learnsets and movesets** (`D17`). Every Pokémon now learns a
      per-run random move set instead of the canon's: `src/engine/battle/
      randomLearnset.ts` rolls a learnset from the run seed keyed by species id,
      keeping the canon's shape (same level-up levels, same number of TM/tutor/egg
      slots) but a random move per slot. Damage moves are ordered **least power to
      most**; the **first level-up move is always damaging**; each learnset keeps
      at least **60% damage / 20% status** so no mon ends up all-status; **OHKO
      moves are never rolled** and **fixed-damage moves only appear from level
      20**. The moveset wild, trainer and player Pokémon enter battle with is the
      last four moves the randomized learnset knows (`defaultMoveset`), and
      level-ups learn from it (`addExperience` now carries the run seed), so the
      whole run uses one consistent reroll. Wild/trainer builds
      (`BattleScene`), the starter (`StarterScene`), the debug drop (`RouteScene`)
      and `resolveBattle` all thread the run seed through; the `Move` type gained
      its generated `ohko`/`damage` markers. `docs/battle-spec.md` §7.1/§8 added;
      fixed-seed regression tests in `randomLearnset.test.ts`.
- [x] **Each HUD panel collapses to its own icon**, and the whole layout is a
      **global preference**. Every panel of the `I` overlay — the route header,
      PARTY, the bag, the PC BOX and the member detail window — now shows a small
      line-art glyph at its top-left (route flag, Poke Ball, bag, PC box,
      magnifier; procedural textures from `BootScene`). Clicking the icon
      **collapses** the panel to just that icon; clicking again **expands** it and
      pushes the others (a collapsed icon included) clear, so a panel beside a
      collapsed one always opens. The icon doubles as a **drag handle**: a press
      that moves past the slop repositions the panel, a press released without
      moving is the collapse/expand click. Panel drags now also **let go when the
      pointer leaves the canvas** (or its button is released off-screen), via the
      input's `gameout`/`pointerupoutside` plus a "button no longer down" check, so
      a held panel never keeps following a pointer that is gone. The offsets and
      collapsed flags are saved with the settings as `hudLayout`
      (`src/data/hudLayout.ts`, validated per field, no version bump since a
      missing field defaults) and re-applied when the route rebuilds, so the
      layout survives a reload and carries into the next run (D22).
      `docs/design-spec.md` §3/§7 updated.
- [x] **The route HUD panels can be moved** (`I`). Each panel — the route header,
      PARTY, the bag, the PC BOX and the member detail window — is its own
      container and is grabbed by its **frame** (the interior stays live, so rows,
      tabs and cells still click). A dragged panel **pushes** the others out of
      its way so two panels never overlap, and a drag that would need a panel to
      leave the screen (the push chain hits the edge) stops instead of covering
      one. The drag runs in small steps, each one rolled back if it cannot be
      settled, and the hit tests read the pointer in the panel's own coordinates,
      so a moved panel's content keeps working. The detail window docks beside the
      PC box the first time it opens (`hudPanels`/`updatePanelDrag` in
      `RouteScene`). `docs/design-spec.md` §3 updated.
- [x] **The main menu** is the landing screen now (`src/scenes/MainMenuScene.ts`):
      **New run**, **Continue** and **Options**. The boot scene goes straight to
      it instead of resuming a run or jumping to the starter pick. **Continue**
      appears only when the save holds a run with a living party and shows the
      route it is on; it resumes the run where it left off. **New run** opens the
      starter pick with a fresh seed, and the old run is replaced only once the
      new one is written to the save, so picking it by mistake or cancelling at
      the starter pick (new **cancel** action, bound to `Q`) returns to the menu
      with the run in progress intact. **Options** opens the settings screen
      paused-on-top, which now also lists the main menu as an opener and refreshes
      the menu's key hints on close. The menu takes the mouse (hover highlights a
      row, a click picks it) beside the keyboard and the touch pad.
      `docs/design-spec.md` §2/§7 updated.
- [x] **Route trainers are back**, the classic way. The generator's population
      pass (`src/engine/routes/sketch.ts` `placeTrainers`) now places them: one
      guards the main lane and one more stands by every filled pocket's item, plus
      the map-size tier's `trainerBonus`, so the count follows the route's size.
      Each trainer stands on floor **hugging a solid wall** (never a walkable
      tree tip), looks down a passable lane with a `sight` of 5 (a straight
      cardinal line that stops at a wall, a ledge, water or another trainer, so it
      never stares across an obstacle it could not chase over), and some carry a
      `turns` cycle so their facing (and line) rotates on a timer, like a
      "spinning" trainer — including catching a player who stands still in the
      beam. Placement is safe: a candidate is kept only while the entry still
      reaches **every** tile it could before (ledges and water count as
      impassable), so a trainer never plugs a lane, a branch or a pocket; no two
      trainers stand in neighbouring tiles; and no trainer spawns already watching
      — or able to spin and watch — the tile the player arrives on. A main-lane
      trainer looks down the lane, but an optional-path guard looks **across** it,
      wall to wall (a vertical path is watched horizontally and vice versa), so
      the sight closes the branch. New pure module
      `src/engine/routes/trainers.ts` (`sightLine`, `seesPlayer`, `trainerAt`,
      `trainerBlockers`) plus `Facing`/`RouteTrainer` on `RouteMap`;
      `validateRoute` now also proves a **trainer-free** entry→exit path, so no
      placement forces a battle. `RouteScene` draws them off the FRLG overworld
      atlas (nine poses per class: the resting pose of its facing, the right side
      flipped, and a two-frame walk cycle it plays while chasing), blocks their
      tile, walks a spotter toward the player and opens the menu battle when they
      see or are talked to, and hides a beaten one. The player and the trainers
      sort by their foot row, so a character north of a trainer passes behind it.
      `D11`, `docs/routes-spec.md` §2/§5, `docs/route-generator.md` §3.4,
      `docs/design-spec.md` §5 updated.
- [x] **Ground items are a gamble and sit deep.** An optional path now holds an
      item only with the band's `itemChance` probability (`ROUTE_LOOT`, 75% for
      now) instead of always, and when it does the pocket is the **deepest** tile
      of the branch — the item sits as far down the path as it can (the wall-hug
      is only a tie-break). A walkable tree tip no longer cuts a trainer's line of
      sight, so a player walking along a row of tips is still seen.
- [x] **Battle sprites are sized by the Pokémon's real height**, so a titan reads
      big and a Scatterbug tiny. The Añil art compresses the true 0.1m–20m range
      (Regigigas is drawn barely taller than Scatterbug), so scaling by the sheet
      left legendaries small. `species.json` now carries a canonical `heightm`
      (PokeAPI, `scripts/fetch-heights.mjs` → `scripts/data/heights.json`, merged
      by `build-dex.mjs`) and `src/data/spriteSize.ts` turns it into a drawn height
      through a sqrt curve. `src/render/spriteBounds.ts` measures each sheet's
      drawn box to convert that height into a zoom and anchors the sprite's feet
      on the platform. The base and max sizes grew, the platform grew and now
      scales with its mon, and each layout caps the size so nothing clips or
      overlaps. `D27`, `docs/data-spec.md` updated.
- [x] The party/PC HUD can now **swap** a member across the two panels by
      **dragging one onto a member of the other**: the two trade places, so a
      **boxed Pokémon can replace a party member even when the party is full**
      (the member it replaces takes the box slot). `engine/run/state.ts` gained
      `swapPartyBox` (both indices kept, refused only on an empty slot) and
      `src/ui/partyScreen.ts` the pure `swapAcross` reducer the route's pointer
      drop calls; a drop on empty space still just deposits/withdraws.
      `docs/design-spec.md` §3 updated.
- [x] The **portraits** (party, route HUD, starter cards, release beat) are
      Pokémon Añil's icons now, packed into `public/anil/portraits.png` and
      `portraits-shiny.png` (one 64x64 cell per dex entry, 32 columns, under half
      a megabyte each) and read through `src/data/portraits.ts`. A member's
      **shiny** flag picks the shiny atlas, so a caught shiny keeps its alternate
      palette everywhere. The PMDCollab `src/assets/portraits.png` is gone.
- [x] **Añil formes** resolve to their own art: the packer maps a dex forme to
      `<SPECIES>_<n>.png` when the Añil set lists `1..n`, with an explicit table
      for the ones that do not line up (the Alcremie cream/sweet grid, Arceus by
      type, the cap Pikachu, Minior's cores, Ogerpon's masks, Kyurem's swap,
      Greninja, Basculin, Rockruff and Vivillon's official Spanish pattern
      names). An unmapped forme falls back to its base species. `D27`,
      `docs/art-direction.md` updated.
- [x] The **battle sprites are Pokémon Añil's** now (front, back and icon), with
      **animation**, **shiny** and **female** variants. The art comes from the
      RPG Maker XP / Pokémon Essentials fangame (EricLostie), copied verbatim by
      `scripts/anil/build-pokemon-sprites.mjs` into `public/anil/` (9,581 sheets,
      ~169 MB) with a frame manifest at `src/data/anil/pokemon-sprites.json`. The
      sheets are horizontal filmstrips — frame = the sheet's own height, count =
      `width / height`, exactly how Añil's own plugin reads them — so the battle
      loads only the sheets it draws, plays one looping idle animation each and
      drops them on shutdown. A **shiny** flag landed on the fighter (persisted
      in the save) and rolls on its own encounter stream at 1 in 4096, so a
      caught shiny stays shiny and no fixed seed shifted. The old FRLG battle
      sheets (`src/assets/frlg/pokemon-*.png` and
      `scripts/frlg/build-pokemon-sprites.mjs`) are gone. `D27`,
      `docs/art-direction.md` updated.
- [x] The battle **SWITCH** menu now shows a wide **detail window** above the avatar
      grid for the member under the cursor — no tabs: the five battle stats, HP,
      nature, ability and held item in a left column, and the member's four moves
      as a **2x2 grid** on the right, each tinted by its type with its PP. Every
      switch cell gained a small **HP bar** (the numbers live in the detail
      window), and the shared model that resolves a member's panel data
      (`src/ui/partyDetail.ts`) now serves a live battle fighter as well as a run
      member. `docs/design-spec.md` §4 updated.
- [x] The battle menus are **grids** now. **FIGHT / BAG / SWITCH / RUN** is a 2x2
      grid like the **moves** menu, so all four moves show at once with no
      scrolling: each move cell is tinted by the move's **type** and shows its
      name, the **official category badge** (physical / special / status, packed
      from `scripts/frlg/build-category-icons.mjs`) and its PP. A **popup** above
      the menu lists the move's type and its **description** for the move under the
      cursor and lifts the Pokémon's data panel clear of it. **SWITCH** shows the
      party as a grid of **avatar** cells (face, name, level, HP), and every
      submenu puts the ◀ **back** control centred on its left edge. The arrow keys
      move around the grids; the mouse still hovers and clicks.
      `docs/design-spec.md` §4 updated.
- [x] The route HUD's party/PC members open a **detail panel** on click instead
      of being grabbed: a new window beside the box with **STATS** (HP bar, the
      five battle stats, nature, ability and the held item) and **MOVES** tabs,
      where the moves can be **dragged to reorder** them (that order is the
      battle menu's). Dragging a member still reorders it or moves it between the
      party and the box; a drag is told from a click by the pointer travelling
      past a small slop. `docs/design-spec.md` §3 updated.
- [x] Battle polish: the command menu takes the **mouse** — hovering a row moves
      the ▶ cursor, a click picks it, and a click advances the text feed — the
      cursor sprite's white matte is now transparent, and the top-right key-hint
      line is gone. The bag opens as **pockets** like the route HUD: **CONSUM**
      everywhere and, while a wild can still be caught, **BALL** (trainer battles
      offer only consumables). **RUN** in a wild battle escapes at once, with no
      yes/no prompt. The default keys are now **E** confirm / **Q** cancel
      (`interact` shares `E`, so the same press both confirms a menu and picks up
      the item in front of the player): `SAVE_VERSION` 5 with
      `SAVE_MIGRATIONS[4]` resetting a v4 document's keys. `docs/design-spec.md`
      §4 and `docs/tech-decisions.md` (`D23`) updated.
- [x] Battle feed fix: the typewriter carried no time across frames, so at 60 Hz
      (a frame shorter than one character) a message never revealed and the battle
      sat on an empty box until the player pressed. The leftover milliseconds are
      now kept frame to frame, so text types itself out and advances on its own at
      a slower read pace (no confirm needed). A ◀ back control in the moves /
      switch / bag menus backs out with a click, and a **run** puts you straight
      back on the route instead of waiting for Z.
- [x] The battle screen adapts to a **portrait phone**: on a narrow canvas the
      panels span the width, the player's Pokémon sits above its own panel (no
      longer behind it) and the menu takes the bottom box, hiding the message
      window while it is open. `docs/design-spec.md` §4 updated.
- [x] **Hidden ground items are walkable.** Only a visible Poke Ball blocks its
      tile now; a hidden sparkle can be walked over and taken underfoot, so a
      player never gets stuck on something they cannot see.
- [x] Ground items spawn **against walls**: the loot spot is the tile of a
      branch's lane with the most wall neighbours (a corner where there is one),
      falling back to the wider branch network when the lane itself has none.
      `docs/routes-spec.md` updated.
- [x] A new **Always run** setting (on by default) walks the route at running
      speed without holding the run key; it lives with the other preferences and
      is added to a save without a version bump since a missing field defaults.
      `docs/design-spec.md` §7 updated.
- [x] The player's **battle backs are no longer shiny.** The expansion exports
      its `back.png` sheets with the shiny palette baked in, so the packed atlas
      was recoloured: `build-pokemon-sprites.mjs` now remaps each back sprite by
      palette index through the folder's `normal.pal`, and the committed
      `pokemon-back.png` was rebuilt from the source with normal colours.
- [x] The battle closes itself after a win or a loss too (not just a run), and
      the command menu and the message window now share the whole bottom box on
      desktop as on phone — the message hides while a choice is open and both are
      wider. `docs/design-spec.md` §4 updated.
- [x] The battle stage is a **square** on a wide screen: centred and capped at
      900 px a side, with the paused route hidden behind it so the letterbox stays
      clean. A tall screen keeps the full stacked phone layout.

- [x] Routes hold **ground items** again, one at the far end of each optional path
      (a `pocket`). The number follows the route's **size** (a bigger map carves
      more branches, `MAP_SIZE_TIERS`); the contents come from the level band's
      weighted pool (`ROUTE_LOOT` in the restored `src/data/loot.ts`) drawn on the
      `populate` stream, with a per-band `hiddenChance`. A hidden item shows a
      faint, shimmering sparkle instead of a Poke Ball. `RouteMap.items` carries
      stable ids (`item-<routeIndex>-<n>`); a pocket a hazard sealed is skipped and
      no pocket may hold tall grass or a ledge, so an item never spawns on grass.
      An item **blocks its tile** while it is there and is taken with the new
      **interact** key (`E`) facing it, adding it to the bag and marking it in
      `RunState.pickedItems` (reset on advance, so a reload does not respawn it).
      The visible sprite is the FRLG field Poke Ball (`frlg/ground-item.png`,
      cropped by `scripts/frlg/build-field-items.mjs` from the standalone ball on
      the Hoeloo compilation). `docs/routes-spec.md`, `docs/route-generator.md`,
      `docs/art-direction.md`, `src/assets/README.md` updated.
- [x] Keybinds: **P is gone** (the HUD key `I` already opens the same party/PC
      overlay) and two actions are new: **interact** (`E`, ground items) and
      **reset** (`R`, below). The dev debug menu moved from `E` to `F` so it no
      longer clashes with interact.
- [x] **Hold-to-reset**: holding the reset key (`R`) fades the whole screen out
      under a small ring that fills; releasing early fades it back in, and filling
      it clears the save and starts a fresh run with a new seed
      (`RouteScene.updateReset`).
- [x] The starter screen picks with the **mouse**: a card is a click target, so
      hovering highlights it and clicking chooses that starter (`StarterScene`),
      beside the existing keyboard selection.

- [x] **Equip held items by dragging**: the route HUD's bag lets you pick up an
      `equipment` stack and drop it on a party row or a PC box cell to give the
      member that item; whatever it already held returns to the bag, so an equip
      is a swap, never a loss (`equipHeldItem` / `unequipHeldItem` in
      `src/engine/run/state.ts`, unit-tested). The party avatars are enlarged and
      a held item shows as a badge on an avatar's lower-right corner, in both the
      party and the box. Grabbing **that badge** takes the item off the member
      instead of grabbing the Pokémon, so it can be dragged onto another member to
      pass it along or onto the bag to unequip it; a drop anywhere else puts it
      back. A stack picked up from the bag leaves the list while it is in hand, and
      a badge is taken off only on the drop, so a carried item never shows in the
      bag mid-drag. `docs/design-spec.md` §3 updated.
- [x] Generation **scales by map-size ranges** via the new `src/data/mapSize.ts`
      (`MAP_SIZE_TIERS`: `small` / `medium` / `large`, keyed by the map area in
      tiles). `grassPatches` and `ledges` in `src/data/biomes.ts` are now **base**
      counts the terrain pass multiplies (terrain ×1 / ×2 / ×3), and a shape's
      `branchCount` gains a bonus (`+0` / `+1` / `+2`) so a bigger route carves
      more **optional paths**. The default 20x20 route stays `small`, so its output
      is unchanged. `docs/routes-spec.md` §2, `docs/route-generator.md` and
      `src/data/README.md` updated.
- [x] Branches can grow **off branches, not only off the spine**: `carveBranches`
      now roots each new lane on the **network** (the spine plus every lane already
      carved) and measures free space to that growing network, so a later branch
      can attach to an earlier one. The per-cell distance is a cardinal
      `distanceField` (same values as the old Manhattan scan, computed once per
      branch). `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] The **spine** keeps the whole-object border margin too: its jittered
      waypoints and the hub are pulled in by `pathWidth - 1`, the lane width
      `carveSquare` grows down/right from the anchor, so a lane never reaches
      within `wallMargin` of the border and leaves a one-row stump (the seed
      `1yv0j1t#r4` bottom fence no longer shows a bitten tree). `carveBranches`
      already pulled its last cell in by `branchWidth - 1`; this is the spine's
      counterpart. `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] Tall grass can **share a tree tip**: a walkable tip cardinally adjacent to a
      `TALL_GRASS` cell is a **grass tip** (`grassTipKeys` in
      `src/engine/tileFrames.ts`), so a patch packed against a tree spills onto its
      crown. `RouteScene` draws the grass frame **under** the crown (the crown
      stays the frame over the player) and rolls a wild encounter on stepping
      there; the procedural tuft tilesets get the overlay on the tip too.
      `docs/tileset-spec.md` §3b and `docs/routes-spec.md` updated.
- [x] Weighted **floor variants**: a `variants` entry may now be
      `{ frame, weight }` instead of a bare frame, so a map value can mix several
      tiles and make some rarer (`VariantFrames` in `src/engine/tileset.ts`,
      `variantFrame` in `src/engine/tileFrames.ts`). The positional hash is mixed
      hard so a rare tile scatters instead of lining up into a diagonal run.
- [x] Forest uses its **own darker ground**: the FRLG forest floor is now the
      dark `0,34` family (`rgb(88,160,128)`, the tone the tree bank is drawn on)
      instead of the outdoor `6,1` (`rgb(112,200,160)`), so the tree border blends
      into the field with no lighter halo. `FRLG_FOREST_TILESET` mixes the forest
      ground tiles with weights (`0,34` base, `2,34`/`3,34`/`5,34` variety, the
      flowered `0,38` rare) and the tall grass is the dark-palette tuft `2,33`,
      stamped whole. The ledge lip has no dark variant, so it is re-grounded onto
      the field's floor (`overFill` in `scripts/frlg/build-tilesets.mjs`).
      `docs/tileset-spec.md` and the forest palette updated.
- [x] Tall grass stamps the **real blade tuft**: the FRLG frames use source `7,0` of
      `sprite-sources/frlg/tileset-2.png` whole, with its own ground (frame 5 was
      previously the plain `6,0` floor variant). `docs/tileset-spec.md` §2/§6
      updated.
- [x] Biome is **forest only**: `BIOME_ORDER = ['forest']`, so a route always uses
      the forest tileset and encounters whatever its index (the outdoor/cave
      entries stay defined but dormant). The route **shape** is now a first-class
      algorithm concept: `docs/route-generator.md` defines `straight` (2 opposite
      openings), `bend` (L, 2 adjacent) and `cross` (4, opposite pairs), each with
      `openings` (edge + entry/exit) and the `links` the spine joins, and `RouteMap`
      is specced as `entry` + `exits`. Phase 2 step 1 has landed: `layout.ts`
      exports `SHAPES`, `RouteMap` carries `entry`/`exits` (the validator requires
      every exit), and the debug panel's Route tab selects a **Shape**.
- [x] Phase 2 step 2: per-pass RNG streams. `src/engine/routes/streams.ts` derives
      one independent `Rng` per build pass (`layout`/`terrain`/`populate`) from
      `(seed, routeIndex, attempt)`; `sketchRoute` builds fresh streams per reroll
      instead of continuing one `Rng`, so a change in one pass cannot shift the
      path another already placed. `streams.test.ts` pins determinism, the attempt
      key and pass independence; the frozen route signature is re-frozen. The
      organic shape carve (step 3) remains.
- [x] Phase 2 step 3: shape carve. `sketchRoute` now places **every** opening of
      the shape on its edge and carves the guaranteed **spine** through each
      `links` pair: jittered waypoints joined by cardinal A* corridors that follow
      a deterministic per-cell cost field (`findPath` gained `PathOptions`:
      `cost` + cardinal-only), at the shape's path width. `RouteMap` exposes the
      `spine`; a `cross` yields three exits and a `bend` an L. Hazards stay off
      the spine (steps 5-7). Tests cover every opening's edge, spine connectivity
      (entry → every exit), border safety, and the new `findPath` modes.
- [x] Phase 2 step 4: branches and pockets. Shapes carry `branchCount` /
      `branchMin` / `branchMax`; `carveBranches` draws each secondary lane off the
      spine (a cardinal corridor that never runs along it) from a tile far enough
      away, and `RouteMap` exposes `branches` plus `pockets` — the branch dead
      ends (exactly one carved neighbour). Branches are optional: the spine alone
      still solves the route. Tests: branches are carved, every pocket is a
      structural dead end and reachable, and each pocket is a terminal.
- [x] Route `EXIT` no longer draws the common-sheet **staircase** (a dungeon
      leftover that read oddly on an outdoor field): no tileset maps `EXIT` in
      `frames`/`commonFrames` any more, so the tile renders as plain ground. The
      `EXIT` value and the end-of-route logic are unchanged; a real exit
      marker/opening is deferred to Phase 8 (`TODO.md`, "Route exit art").
- [x] Layout trimmed to a single style: `LayoutStyle` is now only `forest`
      (FireRed/LeafGreen, entered S / left N) and every biome uses it; `route`
      (Route 1) and `cavern` (Mt. Moon) are removed until their interiors return.
      It still carves an open field (`kind: 'open'`), so maps stay plain. The
      debug panel's "Randomize" and its Layout select follow (`forest` only), and
      the `grass`/`water`/`ledges` fields were **removed** from the panel — the
      terrain passes stay dormant and are no longer exposed, which stops the
      panel from silently re-adding them to a route.
- [x] Debug **route regenerate**: the dev panel (`src/dev/debugMenu.ts`) has a
      "Route" section that exposes the generator inputs (`seed`, `routeIndex`,
      `attempt`, `layout`, `width`, `height`) and shows the
      derived biome and band read-only. A blank field is `auto` (live value), a
      "Randomize" button fills every override and `attempt` increments per press,
      so one seed can be re-rolled reproducibly. Wired through `main.ts` to
      `RouteScene.regenerateRoute`, which rebuilds map, tiles, entities and the
      encounter stream and re-places the player with no run state change. Behind
      `IS_DEVELOP`.
- [x] Debug **noclip toggle** and panel polish: the debug menu now has "Battle"
      and "Route" tabs, starts **closed**, and `E` shows or hides it (was `F2`,
      now `DEBUG_MENU_TOGGLE_KEY`). A "Pass through obstacles" checkbox lets the
      route move onto `WALL`/`WATER`/`LEDGE` in bounds so a map can be inspected
      without walking it. Behind `IS_DEVELOP`; reset on scene create and never
      persisted into the run.
- [x] Removed route **trainers** and **ground items** for now: `RouteMap` only
      carries tiles, start and exit, `sketchRoute` no longer takes
      `trainerCount`/`itemCount`/`loot`, and `RouteScene` drops the trainer
      sprites, line-of-sight triggers, item pickup and the hint's trainer count.
      `src/engine/routes/trainers.ts` and `src/data/loot.ts` (`ROUTE_LOOT`) are
      deleted. The archetype tables (`src/data/trainers.ts`) and the roster
      builder (`src/engine/run/roster.ts`) stay, dormant, for when population
      returns.

- [x] Routes are **carved out of the solid forest** again, matching
      `docs/route-generator.md`: the `open` layout no longer clears the interior,
      so `sketchRoute` keeps the grid solid and `carveGuaranteedPath` /
      `carveBranches` carve the shape's lanes through it (`findPath` gained a
      `passable` override). The one-tile tree/rock border stays solid and the
      carved spine, branches and pockets are the walkable lanes. Fixed-seed
      snapshot re-frozen; `docs/routes-spec.md` updated.
- [x] Removed the tree frame drawn **past the map** for now: `RouteScene` no
      longer pads the map or grows a margin, and the camera is bounded to the
      generated map while the generator is the focus. The debug panel's route size
      follows the generator default (`DEBUG_ROUTE_WIDTH`/`DEBUG_ROUTE_HEIGHT`).
- [x] Routes no longer write an `EXIT` tile **and no longer end on an exit**: the
      openings are plain floor and `RouteScene` no longer advances or rests when
      the player reaches one, so a route can be walked and inspected without
      leaving it. The `EXIT` map value and its tileset contract stay for later art.
      Fixed-seed snapshot re-frozen.
- [x] Debug **generator stepper**: the Route tab has `◂` / `Step ▸` / `Live`
      controls that walk the build phases one at a time (`sketchRouteSteps`
      snapshots `walls → access → spine → branches → terrain → final`) and render
      each on the map, so the carver can be inspected phase by phase. Behind
      `IS_DEVELOP`. The temporary default map size is 20x20
      (`ROUTE_WIDTH`/`ROUTE_HEIGHT`).
- [x] Dropped the debug `R` tileset-swap shortcut in `RouteScene` (and its hint
      line); tilesets still swap from the settings screen.
- [x] Route openings moved onto the **map border**: `edgeTile` now returns the
      outer border tile (a gap in the tree ring) instead of one tile inside, and
      the spine treats the openings as its inner endpoints. Border checks and the
      fixed-seed snapshot updated.
- [x] Spine refinement: a multi-link shape (`cross`) now routes **every link
      through a shared central hub**, so the entry reaches every exit by
      construction instead of relying on the jittered lanes crossing. `carveBranches`
      also re-checks its pockets after all branches are carved, so a later lane
      running alongside an earlier dead end no longer leaves a false pocket.
- [x] `carveBranches` refinement: branch lanes never carve the one-tile border,
      and their distance band **scales with the map size** (`0.25`–`0.70` of how
      far the interior reaches from the spine), so a roomy map uses the space for
      longer branches instead of the fixed 4–14.
- [x] Branch lanes are now **at least two tiles wide** (`2..4`, scaled by the free
      space) and open into a small **chamber** at the far end on a roomy map,
      instead of a one-tile cul-de-sac. A branch's far end is the **pocket** (was a
      1-neighbour dead end). Fixed-seed snapshot re-frozen.
- [x] Water is no longer a generator terrain pass: `carveWater` and the
      `waterBodies` knob are gone (biome terrain is `grassPatches` + `ledges`).
      `WATER` stays a map/tileset value for **decoration** later.
- [x] Fixed `carveGrass`: it seeds from the **off-spine** floor and never stamps a
      patch over the **spine** or an opening, so the guaranteed lane stays a clean,
      encounter-free lane (before it only avoided the openings). Test added.
- [x] Phase 2 step 5: terrain passes **on**. The `biome.terrain` counts are live
      again (forest 4 grass patches / 1 ledge line; the other biomes restored
      too), so routes stamp tall grass and ledges on the carved floor off the
      spine and the openings - ledges also keep off the pockets. A ledge line grows
      one tile at a time and **stops rather than strand a branch**: any run that
      would cut the walkable map in two is reverted, and a lane too narrow for a
      full run still keeps a single jumpable tile. `terrain-defaults.test.ts` is
      replaced by `terrain.test.ts` (off spine/openings/pockets, every exit
      reachable, no stranding, counts honoured). `docs/routes-spec.md` and
      `docs/route-generator.md` updated.
- [x] Wall tidy: the wall motif only draws a whole object from a run at least the
      motif's width and a whole number of objects tall, so a lane that grazed the
      forest left a one/two-tile sliver and a bitten column left a stub. `cleanWalls`
      (`src/engine/routes/walls.ts`, renamed from `cleanTrees`) now runs after the
      carve and before the terrain pass and drops both, **only turning WALL into
      FLOOR**, so it can widen a lane but never block one - the entry, every exit and
      the spine keep working and the openings stay reachable. A run that touches the
      one-tile border ring is left alone, so the map stays fenced. Its whole-object
      size is a **`WallFootprint`** (`cols`, `minHeight`) taken from the tileset's
      `wallPattern`, so another biome or wall art passes its own. Optional branches
      also keep a **`TREE_MARGIN` of two tiles** from the border (bounded
      `carveSquare`), so the outer tree mass is not bitten at all; only the spine
      pierces it, at the openings. New `walls.test.ts` (run heights, unit maps, no
      cut-off walls, branch margin, reachability); the frozen route and the
      `sketchRouteSteps` phases (now `... branches → clean → terrain ...`) re-frozen.
      `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] Fixed the debug **generator stepper**: `RouteScene.drawEntities` drew the
      tall-grass overlay from the live map, so tall grass showed in every phase even
      before the terrain pass. It now reads the phase's own map, matching the tiles
      the stepper renders.
- [x] Fixed the wall motif re-anchoring when a lane bit a column: `patternFrame`
      picked the row phase and the pattern column from the **current row's own run**,
      so a lane that crossed a column (a door at `place openings`, a spine or branch
      lane) split it into two shorter trees that re-anchored, and a lane that carved
      the side below the top slid the lower rows one pattern column aside (a tree's
      crown and lower leaves landed on different thirds). The phase and the column are
      now anchored to the column's **first and last wall cell**: a lane that crosses
      the column is a hole in the stack, not a new tree, so the raw carve steps only
      bite and everything settles at `cleanWalls`. `RouteScene` also resolves the
      frames against the route map framed by one ring of wall (`padMap`,
      `FRAME_PAD`), so the border trees read as a stack that continues past the limit
      instead of a tree cut off at the edge; the ring is never drawn. `patternFrame`
      tests added; `docs/tileset-spec.md` updated. The run-based centring of a lone
      narrow wall is unchanged.
- [x] The route **HUD panel** (route header, party and bag) now starts **hidden**
      and is toggled with the new **`hud` action, default `I`** (rebindable next to
      the others in Settings). The hint line spells the bound key.
- [x] `cleanWalls` is now **object-aware**: a lane that bites the side of a tree
      leaves a `cols`-wide band that no longer draws as a whole object, so the tidy
      removes that **whole tree row** and then **un-stacks** the rest of the column
      (whole runs kept, stubs dropped) instead of leaving a cut tree or a bare
      trunk. The tree each cell belongs to is anchored to the raw carve and held
      **fixed** for the whole tidy, so deleting a bitten tree never re-bases - and
      eats into - the whole trees beside it. Only `WALL` becomes `FLOOR` (safe to
      widen a lane, never block one) and the border ring stays. `walls.test.ts`
      gains a side-bite and an un-stack case; the frozen route is re-frozen and
      `docs/routes-spec.md`, `docs/route-generator.md` and `docs/tileset-spec.md`
      are updated.
- [x] Fixed the wall motif **anchoring** that still left cut trees: the scene framed
      the motif against the map padded with a **solid** wall ring (`padMap`), which
      added a wall left of column 0 and pushed every motif band one column aside, so
      an interior mass drew with its trees' columns rotated (a body tile only on one
      side). It now uses **`extendMap`**: the **vertical** rings continue the edge row
      (so a border tree still reads as going on past the limit) and the **side** rings
      stay open, binding the motif to the playable grid. `cleanWalls` anchors its bands
      the same way (and counts off-map as open), so what it cleans is what the scene
      draws. `docs/tileset-spec.md` updated; `extendMap` unit-tested.
- [x] Dev **"Map" tool**: the debug panel (`src/dev/debugMenu.ts`) gains a Map tab
      that describes the route **cell by cell** — the raw tile value, the atlas frame
      it resolves to, and, for the wall motif, the pattern row/column, the connected
      wall **mass** and the whole-object **tree** (band + contiguous stack) each cell
      belongs to — and can **export/import** it as JSON. The summary lists the trees
      whose band is not solid ("bitten"), the exact artifacts a cut tree shows as.
      Backed by the pure, tested `buildFrameMap`/`serializeFrameMap`/
      `parseFrameMapExport` (`src/engine/frameMap.ts`); `patternCell` is factored out
      of `patternFrame` (`src/engine/tileFrames.ts`) so the tool and the renderer
      share one anchor.
- [x] No lane may **bite the border band**: the spine now carves a straight
      `OpeningApproach` of `cols` tiles in from each opening before it may turn, its
      A* cost penalises the outer `cols` band, its waypoints are clamped to it, and
      branches use the same margin (was a fixed two tiles, which still let a lane
      carve the third column). A route now has **zero bitten trees** (checked across
      shapes/index/seeds, border included). `cleanWalls` also drops a border-ring cell
      only when it merely **widens an opening** (a lane already reaches the ring next
      to it), so a dangling fence nub under an entry/exit is removed while a fence in
      the middle of a run never opens. `walls.test.ts` gains the nub and
      no-bitten-tree cases; the frozen route is re-frozen and `docs/routes-spec.md`,
      `docs/route-generator.md` updated.
- [x] No **one-tile lane** is left: `cleanWalls` now anchors its `cols`-wide bands to
      a fixed **global grid** (from the map's left edge) instead of per column, so a
      one-tile lane that fell inside a band is widened to the whole band (before, the
      wall beside it re-anchored to its own edge and the lane stayed one tile, the
      uncleaned bite). The spine is also carved **two tiles wide** (`pathWidth: 2`), so
      a lane is at least two tiles in both axes; the tidy trims a run that reaches a
      border ring from its interior end, so a lane next to the fence is un-stacked
      without opening the map. `walls.test.ts` gains a no-one-tile-lane sweep; the
      `carve` blocked-share floor is 0.35 (lanes are wider); the frozen route is
      re-frozen and docs updated.
- [x] **Walkable tree tips**: a wall cell that draws as the motif's pure top row
      (`rows[0]`, a crown over open ground) is now a **tip**. `treeTipKeys`
      (`src/engine/tileFrames.ts`) finds them on the scene's connected-padded map, so
      a mass that reaches the border (part of the stack above) is not a tip; the route
      scene walks on them (its movement map turns a tip into floor, so the player
      steps under the crown) and draws the crown over the player
      (`TREE_TIP_DEPTH`). `tileFrames.test.ts` covers detached vs border masses;
      `docs/tileset-spec.md` updated.
- [x] The wall motif redraws **per run**: `patternFrame` anchors the row phase to a
      wall cell's own contiguous run, so a run a lane detached from the stack above
      or below draws as a whole tree - its own crown (`rows[0]`, a walkable tip) on
      top and its own base at the foot - instead of a mid-stack slice that showed a
      crown over ground with no tree above and no trunk at its own foot. The pattern
      **column** stays anchored to the column's first wall cell, so a side bite still
      cannot slide a run's columns aside. A mass that reaches the map's top or bottom
      edge is a **window** into the forest continuing past the limit: the motif
      extends it two rows outward before reading the phase (via an explicit
      `patternCell`/`resolveTileFrame` `border` flag the scene and the dev frame map
      pass), so the edge is a mid-stack crown/body and the pattern is never cut into a
      crop there. An interior run is unchanged, so a detached tree still shows its own
      crown and trunk. The scene frames the motif against the map itself (the
      `extendMap`/`padMap` frame ring is gone), so the motif binds to the playable
      grid. `treeTipKeys` never marks a one-tile border-ring cell, and a tip is drawn
      **above** the player (`TREE_TIP_DEPTH` 20 > the player's 10), so the character
      passes behind the crown. `tileFrames.test.ts` covers run re-anchoring and the
      edge window; `walls.test.ts` sweeps generated routes for a tip on every detached
      tree; `map.test.ts` drops the `extendMap` case; `docs/tileset-spec.md` updated.
- [x] An opening keeps a **corner clearance** of the wall motif's footprint
      (`cornerClearance`, `2 * cols`) instead of the old hardcoded 3, so `place
      openings` never bites the tree in a map corner into a partial or one-tile
      piece (the seed `1yv0j1t#r1` bottom-right corner). The frozen regression route
      is re-frozen and a sweep asserts every opening clears each corner;
      `docs/routes-spec.md` and `docs/route-generator.md` updated.
- [x] A **short border piece** of wall reads as mid-stack, not a lone trunk: an
      opening's approach can leave a one-row stump at the map edge, and with the
      border window it drew the motif's base (`rows[last]`) because its foot fell on
      the visible cell. `patternCell` now extends such a piece (shorter than a whole
      object) at **both** ends before reading the phase, so it draws the crown/body
      a lane would see in the forest past the edge. `tileFrames.test.ts` covers it.
- [x] The lane keeps a **whole-object margin** from the map border: `wallMargin`
      is `max(cols, minHeight)` (not just `cols`), so the tree strip it leaves at
      the border is never shorter than a whole object - it draws its lower body and
      trunk instead of a stump (the seed `1yv0j1t#r1` top row no longer shows
      one-row stumps). The opening is also **aligned to its motif band**, so a
      `pathWidth`-wide approach never spills into the band beside it, and
      `carveBranches` pulls its last lane cell in by `branchWidth - 1` so a branch
      is never clamped into a one-tile stub at the bound. The frozen regression
      route is re-frozen; `docs/routes-spec.md` and `docs/route-generator.md`
      updated.
- [x] Ledges are **whole runs** now: a `LEDGE` line is at least three tiles and
      draws its own **ends** instead of repeating one centre tile. `carveLedges`
      lays the full run at once (three or four tiles) and drops it whole when it
      cannot reach three or would strand a branch, so no two-tile stub is left. A
      run must also touch a wall at one lateral end (the tile outside its left or
      right cap is wall), so a ledge hangs off the terrain instead of floating in
      open floor. The FRLG fields stamp a left cap, centre lip and right cap
      (`FRAME_LEDGE` plus frames 3/4), resolved per cell by `ledgeFrame`/
      `LedgeFrames` (`src/engine/tileFrames.ts`, `src/engine/tileset.ts`); the PMD
      sheets keep their single ground fallback. `docs/tileset-spec.md` and
      `docs/routes-spec.md` updated.
- [x] Tall grass is a **real field tile** now, not a procedural overlay: the FRLG
      atlases stamp the sheet's denser tufted grass at frame `5` (`FRLG_TALL_GRASS`,
      `docs/tileset-spec.md` §2/§6) and `RouteScene` only keeps the tuft overlay for
      the PMD tilesets that still fall back to plain ground. `carveGrass` now packs a
      patch **against the walls**: it stretches across a wall-to-wall corridor when
      that gap is at most `GRASS_SPAN_MAX` (5), so the patch touches a wall at both
      ends; when no corridor fits it falls back to a small block grown from a
      wall-adjacent seed through grassable cells only (never split by the spine), so
      a patch never floats free. `terrain.test.ts` covers the wall anchor and the
      size cap.
- [x] **`npm run lint` checks the formatting, with ESLint shipped dormant.** The
      script is `prettier --check .` over `printWidth: 105` and `endOfLine: "auto"`
      (the latter is what keeps the check green on a Windows checkout with
      `core.autocrlf=true`); `.prettierignore` is a 132-entry ledger naming every
      file Prettier would rewrite — the batch rule forbids reformatting a file a
      batch-mate owns — and each entry was verified non-conforming, so the ledger
      never hides a clean file. `eslint.config.mjs` ships as the dormant flat
      config the ESLint half activates: native `typescript@7.0.2` exposes no JS
      API and every `typescript-eslint` release up to 8.71.2 declares a peer below
      TypeScript 6.1, so no ESLint is installed. `package.json`,
      `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`.
- [x] **A contract README per code folder.** `src/engine/`, `src/scenes/`,
      `src/render/`, `src/ui/` and `src/dev/` gain one, and the root README gains a
      folder map. Each states the folder's invariant, one role line per file and
      its rules — deliberately no exported names, so a refactor cannot rot it.
      `README.md`, `src/{engine,scenes,render,ui,dev}/README.md`.
- [x] **The route validator checks the whole generator checklist (Step 8).**
      `validateRoute` now proves the spine walkable, no item stranded or lying on
      unwalkable terrain, the fence intact but for the openings, and every
      trainer's pose legal (backing wall, off the entry, the exit and the pockets,
      not crowded, no sight line into the entry). An unreachable pocket is
      reported but **not** gated, because `placeItems` is allowed to skip one a
      hazard sealed. Fixed-seed sweep per shape over every route shape.
      `src/engine/routes/validate.ts`.
- [x] **The coverage table classifies every move (the `D16` gap).**
      `scripts/effect-coverage.mjs` now derives `port | no-op | excluded` for all
      835 shipped moves (718 port, 86 no-op, 31 excluded) from the effect
      registry, the ids the turn loop special-cases and the data-driven fields the
      engine reads. The classification is written twice from one authority: the
      new Moves section of `docs/balance/effect-coverage.md` and a
      machine-readable `src/data/moveCoverage.json` behind `moveCoverage()`,
      `isUnportedMove()` and `unportedMoveIds()`. A develop build warns once per
      unported move it meets, which is now the port list.
      `scripts/effect-coverage.mjs`, `src/data/moveCoverage.{json,ts}`,
      `src/dev/warnings.ts`, `src/engine/battle/effects/registry.ts`.
- [x] **A floor's trainers pay that floor's level cap.** Beating 75 % of a floor's
      trainers must award the XP the squad needs to reach `levelCapForMap`:
      `experienceAward` now reads a per-band `LevelBand.trainerXp` multiplier off
      the **defeated** Pokémon's band, so the award keeps its signature and no
      caller changed. A fixed-seed test walks every finite map over three seeds
      and asserts the window `needed ≤ 0.75 · trainers · award ≤ 1.5 · needed`;
      `docs/balance/route-curve.md` is the sheet (bands, caps, trainer counts,
      the rule). `src/data/run.ts`, `src/engine/run/progression.ts`,
      `docs/balance/route-curve.md`.
- [x] **Audio: three music beds and five cues.** The cue vocabulary is one table
      in `src/audio/cues.ts` (pure, no Phaser) and the player in
      `src/audio/audio.ts`; the menu, route and battle beds and the encounter,
      hit, faint, level-up and victory cues are wired into Boot, MainMenu, Route
      and Battle, with the volume setting and the mute seam the accessibility pass
      will use. Assets are committed under `src/assets/audio/*.wav`, built by
      `scripts/frlg/build-audio.mjs` from the gitignored
      `sprite-sources/frlg-audio/`; that rip is not materialised in this clone, so
      the shipped cues are deterministic procedural placeholders that the rip
      replaces without touching a call site (`O4`). `D22` addendum, and the
      `AGENTS.md` Art convention now covers audio. `src/audio/`,
      `src/assets/audio/`, `scripts/frlg/build-audio.mjs`.
- [x] **The route generator and its validator are documented as they ship (Step
      10).** `docs/route-generator.md` stops being a blueprint: §4 transcribes
      `RouteValidation` field by field — the nine fields, `ok` gating the seven
      lists, `unreachablePockets` reported and never gated — §0's pseudocode uses
      the shipped names (`MAX_ATTEMPTS`, `attemptRoute`, `validateRoute`,
      `placeAccess`, `cleanWalls`, `carveBranches`, the six shapes), and the false
      "every pocket has exactly one walkable neighbour" assert is gone.
      `docs/routes-spec.md` step 5 and `AGENTS.md` follow: a route is a **room** of
      a floor, joined to its grid neighbours by their openings, and
      `src/engine/routes/` is its ten modules.
- [x] **Every reachable effect is ported — the coverage table has no `no-op` left
      (`D16`).** Task-06's 86 unported moves and 24 unported abilities are
      resolved: 68 moves and 23 abilities gained handlers (`effects/moves.ts`,
      `effects/abilities.ts`, `effects/weather.ts`, the side conditions in
      `state.ts` and the order/damage/accuracy seams) and the rest are `excluded`
      with the missing mechanic named — `reachable, not ported yet` is gone,
      `unportedMoveIds()` returns empty, and a develop build no longer warns.
      Abilities: 273 port / 38 excluded; moves: 786 port / 49 excluded. The
      **golden battle log is byte-identical** — no ability roll moved — and
      `docs/battle-spec.md` gained the screens, the new volatiles and the
      call-a-move determinism rule. `scripts/effect-coverage.mjs`,
      `src/engine/battle/effects/`, `docs/balance/effect-coverage.md`.
- [x] **Hidden Power's type comes from the holder's IVs again.** `moves.json`
      ships Hidden Power as a single Normal entry; `hiddenPowerType(ivs)` derives
      the 16 typings the cartridge way — the dex's own weights,
      `floor(value * 15 / 63)`, a missing IV counted as 31 — and a new
      `hiddenpower` move effect registers `onModifyMoveType` through
      `src/engine/battle/index.ts`, so the battle, the FIGHT preview and the STATS
      panel all show the same type. Precedence is base → Normalize → Liquid Voice
      → `-ate`. `D37` and `D42` no longer call the type unmodelled, and the shape
      is the seam Task-23's Multi-Attack, Techno Blast and Natural Gift build on.
      `src/engine/battle/moveType.ts`,
      `src/engine/battle/effects/hiddenPower.ts`, `src/ui/partyDetail.ts`.

## Phase 0 — Repo & scaffolding

- [x] `git init`; add `.gitignore` (`node_modules/`, `dist/`, `.vite/`, `*.local`,
      `sprite-sources/`).
- [x] Copy the workspace scaffolding from `slate-line`: `package.json` (Phaser
      `^3.90.0`, Vite `^8.3.0`, TypeScript `^7.0.2`, Vitest `^5.0.1`, scripts
      `dev/build/preview/test/test:watch/typecheck`), `vite.config.ts` (port
      `5175`), strict `tsconfig.json`, `index.html`, `opencode.json`,
      `.env.development`.
- [x] `src/main.ts` registers `BootScene`, `RouteScene` and a `BattleScene`
      placeholder; `npm run build` boots.
- [x] Pure engine foundations, ported from `pkm-mystery-dungeon-like` and adapted
      (`D14`, `D15`): `src/engine/rng.ts` (seeded RNG + text/daily seeds),
      `grid.ts`, `map.ts` (tile values, walkability, corner-cut rule, route-sketch
      parser), `fov.ts` (recursive shadowcasting), `vision.ts` (fog of war),
      `pathfinding.ts` (A* with corner-cut and custom blocking), `tileset.ts` (the
      atlas contract + shared wall/water shape sets), `tileFrames.ts` (the
      neighbour-aware frame resolver). 39 Vitest tests, co-located.
- [x] Swappable tilesets (`D10`): `src/data/tilesets/` with the placeholder and
      woods biome configs, the palette table and the registry
      (`TILESETS`, `tilesetTextureKey`); `RouteScene` renders a hardcoded route
      from the registry and proves the swap with `R`.
- [x] Dex pipeline (`D3`): `scripts/build-dex.mjs` (`npm run data:dex`) generates
      `src/data/dex/*.json` from `@pkmn/dex` (Gen 9): 911 playable species, 685
      moves, 310 abilities, 249 items, 819 learnsets, 25 natures, 19 types.
      `meta.json` records the counts; the package is a devDependency.
- [x] Imported art (`D14`): the 11 atlas/UI sheets and the 652 overworld sprite
      sheets (+ their manifests) from `pkm-mystery-dungeon-like`, plus its art
      pipeline scripts under `scripts/legacy-art/`.
- [x] Specs and decisions: `docs/design-spec.md`, `docs/battle-spec.md`,
      `docs/routes-spec.md`, `docs/tileset-spec.md`, `docs/showdown-reuse.md`,
      `docs/data-spec.md`, `docs/art-direction.md`,
      `docs/tech-decisions.md` (`D1`..`D16` + four open questions), folder
      contracts in `src/data/README.md`, `src/data/dex/README.md` and
      `src/assets/README.md`, and `README.md`.
- [x] Verified the slice: `npm test` (39 passing), `npm run build` clean, and the
      dev server renders the route with fog and the tileset swap.
- [x] Developer gate (`src/dev/env.ts`): reads `ENVIRONMENT` (set to `develop` by
      `.env.development`, undefined in a production build) and exposes
      `IS_DEVELOP` plus the `F2` debug-menu toggle key.
- [x] Debug menu (`src/dev/debugMenu.ts`): a dev-only DOM overlay (real text
      input + the browser's own `datalist` autocomplete, which the canvas cannot
      offer cheaply) that launches a wild battle from any of the 911 playable
      species at any level. `main.ts` imports it behind `IS_DEVELOP` with a
      dynamic import, so a production build never mounts it; the pure
      `matchSpecies` (exact id, exact name, then prefix/substring) and
      `clampLevel` are unit-tested. RouteScene's `B` key still rolls a random
      wild, and `F2` shows or hides the panel. `installDebugMenu` swallows keys
      only while the panel is open and blurs on close, so typing never drives the
      game and the game never goes deaf afterwards. 504 tests pass;
      `npm run build` clean.

## Phase 1 — Dex accessors & data contracts

- [x] `src/data/dex/species.ts`: `Species`/`Stats`/`Evolution` types plus
      `getSpecies(id)`, `speciesByNum(n)` (prefers the base forme) and
      `playableSpecies()` (the 911-row generated set).
- [x] `src/data/dex/moves.ts`: `Move` type and `getMove(id)`, `moveByType(type)`,
      `isDamaging(move)` (any non-`Status` move, so variable-power moves count).
- [x] `src/data/dex/learnsets.ts`: `learnsetOf`, `parseLearnSource`
      (`9L24`/`9M`/`9T`/`9E`, unknown codes → `other`), `levelUpMoves(id, level)`
      and `learnableBy(id, method)`.
- [x] `src/data/dex/types.ts`: `effectiveness(attackType, defenderTypes)` from the
      defensive chart (0/1/2/3 → 1x/2x/0.5x/0x, multiplied across dual types) plus
      `TYPE_NAMES`, the 18 battle types.
- [x] `src/data/dex/natures.ts`: `natureMultiplier(nature, stat)` and
      `statAtLevel(species, level, nature, ivs, evs)` (Gen 3+ stat formula, IVs
      default to 31, EVs to 0).
- [x] `src/data/dex/evolutions.ts`: `evolutionFor(speciesId, level)` and
      `isLevelEvolution(evolution)`.
- [x] `src/data/dex/index.ts` re-exports the six accessor modules.
- [x] Data-integrity tests (`src/data/dex/dex.test.ts`): row counts match
      `meta.json`, every learnset move exists in `moves.json`, every
      `evolutions[].into` exists in `species.json`, every species type is one of
      the 18, every move type is a known type. 65 tests pass.
- [x] Fixed the generator: `build-dex.mjs` now intersects learnsets with the
      retained move set, so a Gen 8 source naming a Gen 9-removed move no longer
      leaves a dangling id (regenerated `learnsets.json`, counts unchanged).

## Phase 2 — Route generation & exploration

- [x] `src/data/run.ts`: six `LEVEL_BANDS` with level ranges and trainer sizes,
      `ROUTES_PER_BAND`, `bandForRoute(routeIndex)`, `levelCapForRoute` and the
      `RUN_CHAIN` cadence (finite length, mini-boss every 4, boss block 8).
- [x] `src/data/encounters.ts`: per-biome, per-band weighted species pools for
      `wood` and `placeholder`; `src/data/biomes.ts` wires the biome → registered
      tileset + terrain counts + encounter tables and cycles them per route.
- [x] `src/data/trainers.ts`: ten archetypes (Youngster, Lass, Bug Catcher,
      Hiker, Camper, Picnicker, Fisher, Psychic, Black Belt, Ace Trainer) with a
      themed species pool and a placeholder marker colour (`spriteKey: null`, O1).
- [x] `src/engine/routes/routeMap.ts`: the `RouteMap` (seed, route index, biome,
      tiles, start, exit, trainers, items) plus `Facing`/`FACING_VECTORS`.
- [x] `src/engine/routes/validate.ts`: cardinal flood-fill and `validateRoute`,
      which requires the start to reach the exit and every trainer.
- [x] `src/engine/routes/trainers.ts`: `sightLine`/`seesPlayer` - a facing, a
      sight range, blocked by walls and by other trainers; re-evaluated per step.
- [x] `src/engine/routes/encounters.ts`: weighted roll + the `RouteEncounters`
      step counter, so the same grass walked in the same order rolls the same.
- [x] `src/engine/routes/sketch.ts`: the full pipeline (frame, rooms + terraces,
      grass/water/ledge terrain, trainer/item population) off one `Rng`, rerolled
      on validation failure; a frozen route signature guards the regression seed.
- [x] Ledges: `resolveMove` jumps south over a `LEDGE` to the tile beyond (and
      only south); other directions stay blocked.
- [x] `RouteScene` now consumes a generated `RouteMap`: procedural tall-grass,
      item and trainer-figure overlays that respect fog, item pickup, grass
      encounter messages, trainer line-of-sight messages and the exit beat. `R`
      still swaps tilesets.
- [x] Tests: band/trainer/dex existence checks for every authored species, route
      validity across seeds and indices, sight-line and ledge-movement rules, and
      a frozen generator signature. 99 tests pass; `npm run build` clean.

## Phase 3 — Battle engine core (pure, headless, tested)

- [x] `src/engine/battle/fighter.ts`: a battle fighter built from species + level
      + nature + IVs/EVs + moveset, with stat computation, stat stages (−6..+6),
      effective stats and Speed (paralysis halved), and HP/boost helpers.
- [x] `src/engine/battle/state.ts`: the battle state (two sides, parties, turn,
      weather/terrain fields, bag, seeded `Rng`) plus the structured event log
      the UI renders, and `finishBattle`.
- [x] `src/engine/battle/order.ts`: priority then effective Speed, ties on the
      battle RNG.
- [x] `src/engine/battle/damage.ts`: Gen 9 formula (STAB, effectiveness, crit,
      85-100% roll, sun/rain and burn modifiers), a deterministic `estimateDamage`
      for the AI and confusion self-hit damage.
- [x] `src/engine/battle/accuracy.ts`: accuracy/evasion stages and the hit roll.
- [x] `src/engine/battle/status.ts`: burn, poison, badly poisoned, paralysis,
      sleep, freeze with type immunities, wake/thaw counters and residuals.
- [x] `src/engine/battle/volatile.ts`: confusion, flinch, Leech Seed, Substitute,
      Taunt, Encore, trapped and perish count.
- [x] `src/engine/battle/turn.ts`: the turn loop (choices → bag/switch/run →
      moves → residuals → faint/replace) driven only by choices; a faint leaves
      `awaitingReplacement` for the owner's next choice.
- [x] `src/engine/battle/commands.ts`: `fight`, `bag`, `switch`, `run` with their
      validation, PP/Encore/Struggle handling and the battle items.
- [x] `src/engine/battle/runAway.ts`: the run odds (classic speed ratio + 30 per
      failed attempt); trainer battles and traps refuse.
- [x] `src/engine/battle/capture.ts`: Gen 9 catch value and four shake checks,
      ball and status bonuses, wild-only; one capture per route stays a run rule.
- [x] `src/engine/battle/ai.ts`: an expected-value trainer AI (damage,
      effectiveness, accuracy, status/boosts) that switches when the active
      Pokémon cannot hurt the foe and reads only legal state.
- [x] `src/data/items.ts`: the battle item catalogue (balls with catch
      multipliers, potions, status cures, X-items).
- [x] Catch rates: `@pkmn/dex` carries none, so `build-dex.mjs` now merges one
      into `species.json` from the committed PokeAPI table
      (`scripts/data/catch-rates.json`, fetched by `fetch-catch-rates.mjs`);
      `catchRateOf` exposes it and a dex test guards every species.
- [x] Golden test: a scripted fixed-seed battle frozen as an inline formatted log
      (the seed of the balance harness). 165 tests pass; `npm run build` clean.

## Phase 4 — Battle effects: abilities, items, weather, terrain

- [x] `src/engine/battle/effects/registry.ts`: declarative effect registry with
      Showdown's hook names (`onSwitchIn`, `onStart`, `onResidual`,
      `onModifyDamage`, `onTryHit`, `onAfterMove`, `onStatus`, `onBoost`),
      `registerEffect`/`getEffect`/`clearEffects` keyed by normalized id, and a
      dispatch that chains the source ability, the defender's ability and the
      move's own handlers (damage is threaded, boolean hooks stop on the first
      block). Wired into the turn loop: switch-in/start in `createBattle` and
      `performSwitch`, damage/status/boost/residual/after-move around the move
      resolution. No effects are registered yet, so the golden battle is byte for
      byte unchanged. 173 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/items.ts`: the held items, registered from the
      catalogue (`kind: 'held'`) — Leftovers (residual 1/16), Sitrus/Oran berries
      (heal below half, single use), Lum Berry (cures a status, single use) and the
      18 type-boost items (1.2x, only when the holder is the move's user). The
      registry now tells each handler which fighter owns the effect (`ctx.owner`),
      so a defender's item never boosts the attacker's move. Fighters gained a
      `heldItem` field. Potions, status cures and X-items already shipped as Bag
      items in Phase 3, so the Bag rejects `held` items. 183 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 1, the 24 abilities that
      show up before the mid routes — Intimidate (switch-in Attack drop, now run
      through the `onBoost` guards), Levitate (Ground immunity), Sturdy (survives
      a full-HP KO at 1 HP), the 30% contact punishes Static / Flame Body / Poison
      Point, the status immunities Immunity / Limber / Water Veil / Insomnia /
      Vital Spirit / Magma Armor, the starter pinch boosts Overgrow / Blaze /
      Torrent / Swarm, Guts (ignoring the burn Attack drop), Technician, the stat
      guards Clear Body / White Smoke / Hyper Cutter / Big Pecks / Keen Eye and
      Shed Skin. `effects/apply.ts` now owns the shared boost/status application
      so moves and abilities go through the same hooks, and `onBoost` learns
      whether a drop is self-inflicted. 199 tests pass; `npm run build` clean.
- [x] `docs/balance/effect-coverage.md` (D16): all 310 abilities and 262 items
      (the dex battle items plus the catalogue-only consumables) marked
      `port | no-op | excluded` — 63 ports, 227 abilities still `no-op`, and the
      exclusions spelled out (unreachable species, doubles-only, cut mechanics,
      items outside the run catalogue). `scripts/effect-coverage.mjs`
      (`npm run docs:coverage`) derives the `port` set from the registry and the
      catalogue so only the exclusions are hand-curated.
- [x] Dev coverage warning (`src/dev/warnings.ts`): behind the `IS_DEVELOP` gate,
      the registry warns once per effect when a battle meets an ability or held
      item with no ported handler, so a gap cannot hide during playtests (D16).
- [x] `src/engine/battle/effects/weather.ts` + `terrain.ts`: weather and terrain
      from moves (Sunny Day/Rain Dance/Sandstorm/Snowscape and the four terrain
      moves) and abilities (Drizzle/Drought/Sand Stream/Snow Warning and the four
      Surges), 5-turn counters with start/clear messages, the residual order
      (status → sandstorm chip → Grassy heal → ability/item residuals → Leech
      Seed → perish → decay/counters), sandstorm type/ability immunity, terrain
      status blocks (Electric sleep, Misty all) with `isGrounded`, and the
      terrain damage modifiers (Electric/Grassy/Psychic ×1.3, Misty Dragon and
      Grassy Earthquake/Bulldoze halved). 215 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 2, 24 more abilities — the
      absorb/redirect group (Water Absorb, Volt Absorb, Sap Sipper, Lightning Rod,
      Storm Drain, Motor Drive, Dry Skin), the defensive multipliers (Thick Fat,
      Heatproof, Ice Scales, Multiscale, Shadow Shield, Filter, Solid Rock, Prism
      Armor), the offensive ones (Tough Claws, Strong Jaw, Iron Fist, Sharpness,
      Huge Power, Pure Power), the switch-in boosts (Intrepid Sword, Dauntless
      Shield) and Moxie. `onModifyDamage` now carries effectiveness so Filter-style
      abilities can read a super-effective hit; the coverage table is at 95 ports
      (56 abilities). 222 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/moves.ts`: the Protect family (Protect, Detect,
      Spiky Shield, Baneful Bunker, Burning Bulwark, Silk Trap) with a protection
      volatile, diminishing consecutive-use odds and the contact punishments
      (damage/status/stat drop), plus Recycle (restores the last held item, which
      `effects/items.ts` now records). Fighters gained `volatiles.protect` /
      `protectStreak` and a `lastItemId`. 229 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 3, 25 more abilities — the
      weather/status Speed group (Chlorophyll, Swift Swim, Sand Rush, Quick Feet),
      the accuracy group (Compound Eyes, Hustle, Sand Veil, Snow Cloak), the
      damage group (Adaptability, Tinted Lens, Sheer Force, Reckless, Punk Rock,
      Water Bubble, Fluffy, Flash Fire), the weather healers (Ice Body, Rain Dish,
      Hydration) and the volatile/status blocks (Leaf Guard, Shield Dust, Own
      Tempo, Inner Focus, Oblivious, Aroma Veil). New hooks `onModifySpe`,
      `onModifyAccuracy`, `onTryVolatile` and `onTrySecondary`, wired in through
      `src/engine/battle/modifiers.ts` (Speed ordering and escape odds now read
      ability modifiers) and the turn loop (hit chance, volatile and secondary
      application; Sheer Force suppresses its secondaries, Shield Dust blocks
      them). Fighters gained `volatiles.flashFire`. The coverage table is at 120
      ports. 247 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 4, 24 more abilities — the
      switch group (Regenerator, Natural Cure, Frisk, Anticipation, Download), the
      priority group (Prankster, Gale Wings), the contact reactions (Rattled,
      Pickpocket, Effect Spore, Rough Skin), the crit/multihit/substitute group
      (Battle Armor, Shell Armor, Anger Point, Skill Link, Infiltrator), the
      stat-react group (Defiant, Competitive, Grass Pelt) and the move/status
      blocks (Damp, Bulletproof, Soundproof, Sweet Veil, Poison Heal). New hooks
      `onSwitchOut`, `onModifyPriority`, `onModifyCrit`, `onTrySubstitute` and
      `onModifyMultihit`; the crit roll moved out of `computeDamage` into the turn
      loop so crit blockers and Anger Point can hook it, and Poison Heal is
      skipped in the residual poison step. 266 tests pass; coverage at 144 ports;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 5, 18 more abilities — the
      contact group (Poison Touch, Gooey, Justified), the defensive multipliers
      (Marvel Scale, Sand Force), the absorbers (Earth Eater, Thermal Exchange),
      the stat shapers (Simple, Contrary, Moody), the reactions (Synchronize,
      Steadfast), Rock Head, Disguise, Overcoat, Run Away and the timing boosts
      (Analytic, Stakeout). New hooks `onModifyBoost`, `onModifyRecoil`,
      `onTryEscape` and `onAfterStatus`; the battle state tracks which sides have
      moved or switched this turn for Analytic/Stakeout, and fighters gained
      `volatiles.disguise`. 282 tests pass; coverage at 162 ports; `npm run build`
      clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 6, 27 more abilities — the
      type absorbers (Well-Baked Body, Wind Rider), the on-hit reactions (Stamina,
      Weak Armor, Steam Engine, Water Compaction), the offensive boosts (Dragon's
      Maw, Transistor, Rocky Payload, Mega Launcher), the crit group (Sniper,
      Super Luck, Merciless), the status-powered boosts (Solar Power, Flare Boost,
      Toxic Boost), the status/move blocks (Good as Gold, Purifying Salt,
      Comatose), No Guard, the Speed group (Slush Rush, Surge Surfer, Tangled
      Feet) and the on-hit punishers (Toxic Chain, Stench, Sand Spit, Seed Sower).
      New hook `onModifyCritRatio`; the damage payload carries `crit` for Sniper
      and the after-move payload carries `hit` so an immune or status move cannot
      trigger contact/on-hit abilities. Coverage at 189 ports (150 abilities);
      302 tests pass; `npm run build` clean.
- [x] Fixed the duplicated secondary effects: `build-dex.mjs` now drops the raw
      `secondary` field and keeps only the resolved `secondaries` array, and the
      engine applies that array once. A single-secondary move like Bulldoze no
      longer lowers Speed twice, and the self-boosting secondaries (Flame Charge,
      Ancient Power) land once. Regenerated the dex (moves.json only; content
      counts unchanged) and tightened the Sheer Force / Shield Dust tests to
      assert the exact stage. 305 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/moves.ts` + the turn loop: the odd move shapes.
      **Two-turn charge moves** (Solar Beam, Fly, Dig, Dive, Bounce, Phantom
      Force, Shadow Force, Meteor Beam, Electro Shot, Sky Attack, Freeze Shock,
      Ice Burn) lock the user and fire next turn regardless of the chosen
      command; Solar Beam/Blade skip the charge in sun. **Damage counters**
      (Counter, Mirror Coat 2x; Metal Burst, Comeuppance 1.5x) pay back the
      damage banked earlier in the turn and fail with nothing banked.
      **Yawn** puts the target to sleep after a turn; **Wish** heals half HP two
      turns later. **Self-switch moves** (U-turn, Volt Switch, Flip Turn, Parting
      Shot, Teleport, Baton Pass) deal their effect then ask for a replacement,
      and Baton Pass hands the user's stat stages to the incoming Pokémon (now
      carried on the side, applied in `performSwitch`). Fighters gained
      `volatiles.charging` and physical/special damage banks; sides gained
      `wishTurns` and `batonPassBoosts`. `autoReplace` no longer re-picks a
      healthy self-switched active. 314 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 7, 19 more abilities — the
      defensive/entry group (Fur Coat, Ice Face, Slow Start, Unburden, Forewarn,
      Supersweet Syrup, Pressure), the stat reactions (Speed Boost, Guard Dog
      intercepting Intimidate) and the item/contact group (Magician, Lingering
      Aroma, Harvest, Sticky Hold, Ripen, Cheek Pouch, Unnerve). Passive
      abilities whose behaviour sits at the call site are registered so the
      coverage table and the dev warning both see them: Early Bird and Corrosion
      in `status.ts`, Liquid Ooze in the drain path, Pressure in the PP cost and
      the berry abilities in `effects/items.ts`. Fighters gained
      `volatiles.slowStart`, `iceFace` and `supersweetSyrup`. Gluttony stays
      `no-op`: the run catalogue's berries all trigger at half HP, so it is not
      observable yet. Coverage at 208 ports (169 abilities); 333 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 8, 20 more abilities — the
      anti-priority trio (Armor Tail, Dazzling, Queenly Majesty, reading the
      *effective* priority so a Prankster status move is stopped too), Triage
      (+3 to healing moves), Serene Grace (a new `onModifySecondaryChance` hook
      doubles proc chances), Wonder Skin (status moves aimed at the holder,
      which needed the move passed into the accuracy check), Full Metal Body,
      Mirror Armor (a reflected drop carries its own reentrancy guard),
      Opportunist, Tangling Hair, Aftermath (a contact attacker is punished when
      the holder faints), Bad Dreams, Poison Puppeteer, Berserk and Anger Shell
      (one pinch trigger per drop below half, on the new `volatiles.pinchTriggered`),
      Chilling Neigh, Grim Neigh, Steely Spirit, Supreme Overlord and Klutz (the
      registry now skips a Klutz holder's held item entirely). Flower Veil moved
      to `excluded`: it only protects Grass-type *allies*, so it is dead in
      singles. Coverage at 228 ports (189 abilities); 351 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 9, 13 more abilities —
      Scrappy and Mind's Eye (a new `onModifyEffectiveness` hook pierces the
      Ghost immunity, and Mind's Eye also ignores the foe's evasion in
      `accuracy.ts`; Scrappy additionally blocks Intimidate), Magic Guard (a
      `takesIndirectDamage` guard in the turn loop and `volatile.ts` covers
      status, weather, Leech Seed, recoil, Liquid Ooze and confusion), Protean and
      Libero (type change once per switch-in), Truant (loaf turns), Trace (copies
      the foe's ability and replays its entry effects, with a ban list), 
      Electromorphosis and Wind Power (a shared Charge volatile that doubles the
      next Electric move), Soul-Heart (a new `onFaint` hook), Long Reach (the
      payloads now carry a resolved `contact` flag, so contact punishes and
      Tough Claws/Fluffy consult `moveContacts` instead of the raw move flag),
      Quick Draw and Stall (a new `onFractionalPriority` tie-break inside the
      priority bracket, honoured by `orderActions`). Coverage at 241 ports (202
      abilities); 364 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/registry.ts` + the turn loop: batch 10, the
      ability-suppression layer and stat auras — **Mold Breaker**, **Teravolt**
      and **Turboblaze** pierce the foe's ability for the duration of the move
      (a `state.abilityPierce` flag set in `useMove` and cleared before the
      contact reactions, so Static and friends still fire), **Mycelium Might**
      does the same for status moves and sends them last in the bracket,
      **Neutralizing Gas** switches off the opposing active's ability everywhere
      (`abilityActive` in `ownedEffects`), **Unaware** zeroes the attacker's or
      defender's relevant stages, and the **Ruin quartet** (Sword/Tablets/Beads/
      Vessel) applies its 0.75x aura to the right stat. The damage context gained
      `ignoreAttackBoosts`, `ignoreDefenseBoosts`, `attackMultiplier` and
      `defenseMultiplier`. Coverage at 251 ports (212 abilities); 370 tests pass;
      `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 11, 8 more abilities —
      **Air Lock** and **Cloud Nine** (`effectiveWeather` in `state.ts` nulls the
      weather for every effect while their holder is active, from damage and
      residual chip to Chlorophyll/Swift Swim/Weather Heal/Sand Veil, without
      stopping the weather timer), the **-ate** trio **Galvanize**, **Pixilate**
      and **Liquid Voice** (a new `onModifyMoveType` hook resolved before any
      immunity check, so the move is treated as its new type for the whole turn),
      **Unseen Fist** (contact moves break through Protect in `protectBlocks`),
      and the contact punishers **Cursed Body** (a `disabledMove` volatile that
      `legalMoveIndices`/`selectedMove`/`validateCommand` now honour, ticking down
      in `endOfTurnVolatile`) and **Cute Charm** (an `attract` volatile that adds a
      50% lost turn to `beforeMoveVolatile`). Coverage at 259 ports (220
      abilities); 377 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/abilities.ts`: batch 12 closes the ability
      coverage. Ported with real behaviour: **Arena Trap**, **Shadow Tag** and
      **Magnet Pull** (`trappedBy` in `fighter.ts`, `isTrapped` in `state.ts`, so
      `validateSwitch` and `canRun` share one rule, with the Ghost/grounded/Steel
      immunity and Neutralizing Gas off-switch); **Battle Bond** (one-time
      Attack/Sp. Atk/Speed boost after a KO); **Cud Chew** (a consumed berry gets
      one more bite from a factored-out `applyHeldItemEffect`, with the `cudChew`
      volatile); **Dancer** (a dance move the foe uses is replayed by a
      `dancerFollowUp` guard that stops a mirror loop); **Gluttony** (lifts the
      berry threshold to half); **Hadron Engine** (Electric Terrain plus 4/3 Special)
      and **Orichalcum Pulse** (sun plus 4/3 physical); **Protosynthesis** and
      **Quark Drive** (the highest stat boosted 1.3x, Speed 1.5x, in sun or
      Electric Terrain); **Magic Bounce** (a reflectable status move is bounced
      back in `applyMoveEffects`); **Rivalry** (1.25x/0.75x by gender, on a new
      `gender` fighter field the run assigns in Phase 6); and **Illuminate**'s
      v1.3.2 accuracy-drop immunity. The unreachable-in-singles leftovers moved to
      `excluded` in the coverage script with explicit reasons (forme change,
      doubles/ally, weight, hazards, forced switch, out-of-battle). Only **Illusion**
      and **Imposter** stay `no-op`, both blocked on Transform. Coverage at 273
      ports (234 abilities, 2 no-op, 74 excluded); 388 tests pass; `npm run build`
      clean.
- [x] `src/engine/battle/effects/moves.ts` + `abilities.ts`: Transform, which
      closes the last two abilities. `transformInto` in `fighter.ts` copies the
      target's types, stats (never HP), ability, gender, moves (5 PP each) and
      stat stages, keeping a `transformBackup` so `restoreOriginalForm` (run from
      `resetBattleState`) reverts on switch-out; the copied ability is not
      re-triggered, which keeps recursion-prone abilities inert. The `transform`
      move and the **Imposter** switch-in both call it. **Illusion** stores the
      last healthy party member as an `illusion` volatile and drops it on the
      first damaging hit. Coverage at 275 ports (236 abilities, 0 no-op, 74
      excluded); 392 tests pass; `npm run build` clean.

## Phase 5 — Battle UI & presentation

- [x] `src/ui/`: the first presentational helpers — `metrics.ts` (HP fraction and
      the green/yellow/red thresholds, status abbreviations), `panel.ts` (rounded
      panels and HP/XP gauges) and `feed.ts` (`battleFrames`, which splits the
      engine's event log into message beats so a line lands with the HP drop it
      describes). `metrics` and `feed` are Phaser-free and unit-tested.
- [x] `src/scenes/BattleScene.ts`: the real menu battle. A backdrop with two
      platforms and tintable placeholder sprites, both HP readouts with colour
      thresholds and status badges, and a message box. The four commands open the
      move list (PP), the bag (filtered to usable items) and the party list
      (HP/level/status), and RUN flees a wild battle; a turn goes through
      `takeTurn` with the trainer AI and the log plays back one frame at a time
      (auto-advance, press to step, hold Z to fast-forward). A fainted active is
      replaced through a forced switch menu. A fixed demo party stands in until
      the run (Phase 6) supplies a real one. `BootScene` gained the placeholder
      battle textures; `RouteScene` a `B` dev key to preview the scene. 398 tests
      pass; `npm run build` clean.
- [x] `BattleScene`: the move list now shows each move's type, and RUN asks for a
      YES/NO confirmation before fleeing. 398 tests pass; `npm run build` clean.
- [x] Entry transitions: route → battle on trainer sight or a grass encounter and
      battle → route on win, loss, flee or catch. `battle.snapshotFighter` /
      `restoreFighter` carry the party's HP, PP and status across the scene
      (`src/engine/battle/fighter.ts`); `src/engine/run/` adds the `BattleLaunch` /
      `BattleReturn` contract plus `battleSeed` and a baseline `trainerRoster`
      (band party size, themed pool, seeded levels; Phase 6 still layers held
      items on top). `RouteScene` owns the demo party and bag, pauses itself and
      launches `BattleScene` on top, and adopts the result: fainted Pokémon are
      dropped (permadeath), a catch joins the party and spends the route's single
      capture, a beaten trainer stays beaten, and an empty party ends the run.
      The dev `B` key is now gated by `IS_DEVELOP`. 405 tests pass; `npm run build`
      clean.

- [x] `BattleScene` XP bar: `BattleLaunch` now carries each party member's XP,
      and the player's HP panel grew a blue XP gauge plus an `XP n` label driven
      by `experienceFraction`. It reads the run's XP, so it fills as battles are
      won.
- [x] Move FX and the capture beat (D20): `src/render/moveFx.ts` registers the six
      animation strips packed from `moves.png` (`ember`, `cross_poison`,
      `poison_gas`, `fire_punch`, `rock_slide`, `ancient_power`) with a move →
      archetype map (`moveFxFor`, by the move's own id/type/flags, never per move)
      and the atlas frame maths; `moveFx.test.ts` measures the committed atlas so
      a re-extract that shifts a strip fails the build. `BootScene` creates one
      animation per strip and `BattleScene` plays it over the side a move hit.
      `src/ui/capture.ts` turns the engine's `shakes`/`success` into the classic
      beat (`captureBeat`: a failed ball breaks on the interrupted shake, a catch
      holds through four) that `BattleScene` plays as a thrown ball, wobble and
      result, reusing the ball's item icon. 497 tests pass; `npm run build` clean.
- [x] Faint, switch and level-up beats (Phase 5): `src/ui/beats.ts` holds the
      timings plus the pure `levelUpBeats(before, after)`, which diffs the run
      party against the party after `resolveBattle` and reports only the members
      that gained a level (with the species it evolved into and the moves learned
      and forgotten). `BattleScene` plays the faint drop when a `faint` event
      lands and the withdraw/send-out when a `switch` event does (a forced
      replacement has nothing to withdraw, so it only sends the incoming in); a
      running beat owns its sprite so the HUD cannot snap it back mid-tween.
      `RouteScene` counts each levelled HUD row up to its new level with a gold
      flash, then resyncs. `beats.test.ts` covers the diff. 503 tests pass;
      `npm run build` clean.
- [x] Permadeath feedback (Phase 5): `src/ui/permadeath.ts` (Phaser-free, tested)
      turns the resolution's fallen list into release beats and the run into the
      end-screen lines (`runOverSummary` / `runOverLines`: routes cleared, seed,
      loss or win). `RouteScene` plays a "was released" beat per fallen Pokémon —
      scrim, portrait, name and level, advance on Z or after 1.6 s, with a short
      guard so the press that closed the battle cannot skip the first beat — and
      then either resumes the route or hands over to the new `RunOverScene`. The
      route's final exit now ends on that same screen in win mode; `Z / Enter`
      starts a fresh run from `StarterScene`. Fixing this exposed that
      `resolveBattle` never adopted the party the battle returned, so HP, PP and
      status were discarded and **permadeath never fired from a real battle**:
      `adoptBattleParty` now swaps each member's snapshot by id (XP lives on the
      run member, so it survives) before `releaseFainted` runs, with tests for
      the adoption and for the real full-HP-to-`released` flow. Verified in the
      browser: a wild loss releases the party and lands on the run-over screen.
      521 tests pass; `npm run build` clean.

## Phase 6 — Run structure, party & economy

- [x] Random starter pool: `src/data/dex/evolutions.ts` gained
      `evolutionFamily(speciesId)` — it walks `prevo` up to the base form and then
      `evos` back down, so a branching line (Eevee) counts every child and formes
      are included, with a cycle guard. `src/data/run.ts` replaces the hardcoded
      three with `starterCandidates()` (the 109 base forms whose line has at least
      three members, so a starter always has room to grow, `design-spec` §3) and
      `STARTER_POOL_SIZE`; `src/engine/run/starters.ts` adds `rollStarterPool(rng,
      count)`, a draw without replacement mirroring `trainerRoster`. `StarterScene`
      draws a fresh run seed, rolls three candidates from it and hands that same
      seed to the run, so a seed always shows the same starters. 483 tests pass;
      `npm run build` clean.

- [x] `src/engine/run/state.ts`: the `RunState` — seed, mode, route index, cached
      level cap, party, PC box, bag, beaten trainers and the per-route capture
      flag — with pure transitions: `createRun`, `advanceRoute` (raises the cap,
      clears the capture and the trainer marks), `addPokemon` (party to six, then
      box), `updatePokemon`, `addItem`/`consumeItem`, `useCapture`/`canCapture`,
      `markTrainerDefeated` and `hasLivingParty`. `src/engine/run/levelCap.ts`
      wraps the band cap (`capForRoute`, `clampToCap`, `reachedCap`).
- [x] `src/engine/run/progression.ts`: `RunPokemon` (a battle snapshot plus its
      XP), the medium-fast `level^3` curve (`xpForLevel`, `levelForXp`,
      `experienceFraction` for the XP bar), `experienceAward` (band-scaled, split
      across participants, trainer bonus) and `awardExperience` — clamps gain at
      the route cap, levels up, learns the crossed level-up moves (forgetting the
      oldest past four) and evolves once the cap allows it (`evolveIfReady`, which
      the heal stop will re-run). No RNG anywhere, so a replay awards the same XP.
      425 tests pass; `npm run build` clean.
- [x] `src/engine/run/perms.ts`: the permadeath enforcement point — `releaseFainted`
      drops a 0-HP member from the party and the box and reports who fell (D5,
      battle-spec §5).
- [x] `src/engine/run/resolve.ts`: `resolveBattle` folds a `BattleReturn` into the
      run — adopts the bag, enforces permadeath, places a catch (party or box) and
      spends the route's capture, marks a beaten trainer and awards XP to the
      survivors (split across the whole party until the battle reports who took
      part). `RouteScene` now owns a real `RunState` seeded with the demo starter
      and bag, drives party/bag/capture/beaten-trainers from it, and shows the
      "was released" / "Level up!" / "It evolved!" beats from the resolution
      events. Verified end to end in the browser: a wild win raised the XP bar from
      125 to 137. 435 tests pass; `npm run build` clean.
- [x] `src/engine/run/heal.ts`: the between-route heal stop — `healParty` restores
      HP and PP across the party and the box but never resurrects a 0-HP member
      (D5), and `restAndAdvance` composes it with `advanceRoute`. `RouteScene`
      now generates the current route from the run (seed + route index) instead of
      a hardcoded route 1, and the EXIT tile runs the beat: heal, advance, rebuild
      the scene on the next route. Verified in the browser: stepping the exit on
      route 1 (Woods) lands on route 2 (Test Grounds) with the party at full HP/PP,
      the cap and the per-route capture reset. 439 tests pass; `npm run build`
      clean.
- [x] Starter pick + route HUD: `StarterScene` opens the run (arrow keys choose,
      Z/Enter confirms) and hands a seeded `RunState` to `RouteScene` via `init`,
      which now falls back to the dev run only when started directly. New data:
      `STARTER_POOL`/`STARTING_BAG` (`src/data/run.ts`) and `src/data/portraits.ts`
      (PMDCollab portrait atlas + `num-1` frame mapping). `BootScene` loads
      `portraits.png`; the route HUD shows the route/biome header, the party with
      each member's portrait, level and HP, and the bag. The atlas was re-laid from
      a 25960px column into a 40-column grid (`scripts/legacy-art/relayout-
      portraits.mjs`) because it exceeded the WebGL texture limit and rendered
      black. Verified in the browser: pick Charmander → route 1 with HUD. 445 tests
      pass; `npm run build` clean.
- [x] `src/engine/run/chain.ts`: the route cadence from `src/data/run.ts` —
      `routeStage(index, mode)` classifies each route as `route`, `miniboss`
      (every `minibossEvery`), `boss` (closing each `bossBlock`) or `final` (the
      last route of a finite run), with its `block`/`slot` and `isBoss`/`isFinal`
      flags; `chainLength` and `isFinalStage` cover the finite finish line and the
      infinite mode branch (no final boss). `RouteScene` now
      asks `isFinalStage` instead of comparing against `RUN_CHAIN.finiteLength`
      directly. 453 tests pass; `npm run build` clean.
- [x] `src/data/items.ts` prices: every `ItemDef` carries a Poké Dollar `price`
      (`0` = never sold, the Master Ball), with `isForSale`, `buyPrice` and
      `sellPrice` (half, rounded down) helpers, plus `src/data/items.test.ts`
      (unique ids, known kinds, integer prices, ball prices in step with their
      catch bonus, no Revive). `docs/balance/economy.md` records the sheet and
      `docs/data-spec.md` moves the file to phase 3/6. 461 tests pass;
      `npm run build` clean.
- [x] Between-route reward as **ground items**: `src/data/loot.ts` holds the
      per-band `count` + weighted pool (`ROUTE_LOOT`), `sketchRoute` accepts a
      weighted `loot` pool (falling back to the old uniform `itemIds`) and draws
      positions *and* contents from the same route `Rng`, and `RouteScene` now
      actually adds a picked item to the bag and says "You found X!". Tests cover
      the tables and the deterministic weighted draw. 467 tests pass.
- [x] FRLG item icons (interface art per the user's FireRed/LeafGreen reminder):
      `scripts/frlg/build-item-icons.mjs` packs the 24x24 FRLG item icons (named
      per the pret/pokefirered decomp, so the id → icon map is authoritative)
      into the committed `src/assets/frlg/item-icons.png` plus
      `src/data/frlg/item-icons.json`, read through `src/data/itemIcons.ts`.
      `png-codec.mjs` gained sub-byte palette support (the decomp icons are 4-bit
      indexed). `BootScene` loads the atlas; the route draws each floor item with
      its icon and the HUD bag row shows the stacks as icons + counts. The raw
      FRLG UI sheets (menus, HUD, effects) are staged in `sprite-sources/frlg-ui/`
      for the coming UI pass. 470 tests pass; `npm run build` clean.
- [x] FRLG window chrome (interface art): `scripts/frlg/build-battle-ui.mjs`
      crops and 4x-upscales the light menu window and the navy battle message box
      from the FRLG `hpbars-menu` sheet into `src/assets/frlg/window.png` /
      `textbox.png`, drawn as Phaser nine-slices by `src/ui/frlg.ts`. `BootScene`
      loads both; `BattleScene`'s two HP panels and its message/command box and
      `RouteScene`'s HUD panel now use them (dark text on the light window, the
      message box grew to fit the four command rows). Verified in the browser.
      470 tests pass; `npm run build` clean.
- [x] FRLG bitmap font: `scripts/frlg/build-font.mjs` reads the sheet's
      `latin_normal.png` + `charmap.txt`, keys the flat blue background and the
      white padding to transparent, keeps the letter white with a mid-grey shadow
      (one texture serves both tint directions) and packs `src/assets/frlg/font.png`
      (2x) plus per-glyph metrics in `src/data/frlg/font.json` — 146 glyphs, the
      Latin set up to the Japanese sections plus the four named arrows. The
      runtime registers it as a Phaser bitmap font without an XML file
      (`src/ui/frlgFont.ts`, `frlgFontData()` builds Phaser's `BitmapFontData` and
      `registerFrlgFont` caches it), and `addFrlgText` is the single entry point:
      `BattleScene`, `RouteScene`'s hint/HUD and `StarterScene` now draw FRLG
      glyphs instead of `Phaser.GameObjects.Text`, so the monospace placeholder is
      gone. Verified in the browser.
- [x] Baked HP-bar/command-menu art from the same sheet: `build-battle-ui.mjs`
      now also crops the HP readout (`src/assets/frlg/hpbar.png` — the "HP" chip
      plus a track whose green fill it clears) and the ▶ command cursor
      (`src/assets/frlg/cursor.png`), and writes the measured geometry to
      `src/data/frlg/battle-ui.json`. `src/ui/frlg.ts` exposes `FRLG_HPBAR` and
      `addFrlgHpBar`, so the battle scene paints the HP colour (green/yellow/red)
      behind the baked overlay instead of a drawn rounded gauge, and the four
      commands moved into their own light FRLG window with the cursor marking the
      selection (the message box shrank to the classic two-line band). The debug
      hint in `RouteScene` gained a backing bar since bitmap text has no
      background. `StarterScene` was restyled to the same windows (FRLG card
      frames, the ▶ glyph as the selector, FRLG text throughout). 483 tests pass;
      `npm run build` clean.
- [x] Premier Ball: `src/data/items.ts` adds the commemorative Ball (the same
      200/1x rate as the Poke Ball, listed next to it so the catalogue stays in
      ascending price order) and `build-item-icons.mjs` maps it to the Poke Ball
      icon, since Gen 3 ships no distinct one. Tests guard its price/rate and keep
      it out of the ground-loot pool. 497 tests pass; `npm run build` clean.
- [x] Party/PC screens (Phase 6): `state.ts` gained the party/box moves
      (`moveInParty`, `moveInBox`, `depositToBox` — the party is never emptied —
      and `withdrawToParty`, which refuses a full party) and `src/ui/partyScreen.ts`
      holds the Phaser-free model and input reducer: per-member rows (name, level,
      HP, status, held item), the row window, and a `partyInput` state machine
      where `Z` picks a member up, `up`/`down` reorders it live, `left`/`right`
      sends it to the other pane and `X` restores it to where the grab started.
      `src/scenes/PartyScene.ts` draws the two panes (portraits, FRLG windows and
      text, a ▶ cursor and a grab highlight). It opens from the route HUD with `P`
      and as the between-route healing stop: the EXIT tile now heals the party and
      hands over to the same screen (titled "REST STOP"), and continuing advances
      the route. `heal.ts` drops `restAndAdvance`: the stop is a screen now, so the
      route composes `healParty` + the screen + `advanceRoute`. Fixed two bugs the
      playtest found: `scene.restart()` reuses a scene's previous start data, so
      the route was re-initialised with the *old* run and every exit tile bounced
      back to route 1 (the restart now passes the advanced run explicitly), and
      `PartyScene` kept a reference to the footer text of a previous session, so
      reopening the screen crashed on the destroyed object. 539 tests pass;
      `npm run build` clean. Verified in the browser: `P` opens the screen, grab +
      reorder, deposit, withdraw, `X` closes with the run adopted, and the rest
      stop heals on open and lands on route 2 on continue.
- [x] Trainer rosters per band: `src/data/trainers.ts` now gives every archetype a
       `pools` record keyed by `BandId` instead of one flat `pool`, and
       `trainerRoster` draws from `archetype.pools[band.id]`, so a route's rosters
       field that band's species — base forms in `early`/`low`, evolved forms
       (`furret`, `greedent`, `vikavolt`, `garchomp`...) in `late`/`end` — while
       the party size still follows `band.trainerSize` (`docs/routes-spec.md` §6).
       Each band pool holds at least as many species as its party size, and the
       tests assert every band is non-empty, every listed species exists in the
       generated dex and the `end` pool differs from `early`. The roster RNG,
       seeds and battle snapshots are untouched, so a replay is unchanged.
       541 tests pass; `npm run build` clean.

## Phase 7 — Persistence, meta & polish

- [x] Saved runs and settings (`src/engine/save.ts` + `localStorage`): one
      versioned document (`SAVE_VERSION`, `SAVE_KEY = 'pokerandomlike.save'`) holds
      the `Settings` (text speed, master volume) and the `RunState` in progress,
      so the version lives inside the JSON and the key never has to move. The
      pure module does the whole job — `encodeSave`/`decodeSave` (migrate →
      validate → default, never throwing), a `migrations` table keyed by the
      version it reads with `migrateDocument` walking a document up one version at
      a time, per-field validation that repairs bad settings, drops malformed
      party/box members and recomputes the level cap from the route, and thin
      `loadSave`/`storeRun`/`clearRun`/`storeSettings` wrappers over a
      `StorageLike`, so the tests never touch a browser. `src/storage.ts` is the
      only browser-facing piece (`browserStorage()` returns null when the store is
      blocked). `BootScene` resumes a saved run with a living party and otherwise
      starts a fresh one (a run saved after its last Pokémon fell is cleared),
      `RouteScene.persistRun()` writes on every run change (route create, battle
      result, party close, item pickup, heal, route advance) and `RunOverScene`
      clears the run on both outcomes (D5). 25 save tests cover the round trip,
      the migration path, corrupt/newer documents and the storage wrappers.
      566 tests pass; `npm run build` clean.
- [x] Run summary / score screen: the run now keeps its own score in
      `RunState.stats` (`RunStats` = catches + casualties, in `src/engine/run/state.ts`).
      `recordCatch` bumps the catch beside the capture it spends (called from
      `resolveBattle`) and `releaseFainted` bumps the casualties where a Pokémon
      is actually lost, so a catch that later falls counts as both. The end-of-run
      screen was rewritten around `src/ui/runSummary.ts` (`runSummary` /
      `runSummaryLines`): a win clears its route, a loss does not, and the panel
      shows routes cleared, Pokémon caught, Pokémon lost and the seed, with the
      release beats still owned by `src/ui/permadeath.ts`. The counters are on
      disk, which is the first real use of the migration path: `SAVE_VERSION` is
      now 2 and `SAVE_MIGRATIONS[1]` adds `stats` to a v1 run. 572 tests pass;
      `npm run build` clean.
- [x] Seed input and a run share string (`D21`): `src/engine/run/share.ts` turns a
      run into the token that starts it again — `PKRL-1-<f|i>-<seed>` — without
      carrying any progress, so a shared run starts on route 1.
      `encodeRunShare` stamps the prefix, the version and the mode letter and
      percent-encodes the seed (escaping `-` so the fields stay separable);
      `decodeRunShare` reads a share string back into `{ seed, mode }`, treats a
      string with no prefix as the seed itself (falling back to the player's mode
      choice) and rejects a prefixed string that is malformed — an unknown
      version, an unknown mode, a missing or broken seed — instead of quietly
      starting a different run. Round-tripping is tested across spaces,
      non-ASCII, `%` and hyphens. The starter screen shows the run's share string
      and `S` opens `src/ui/seedPrompt.ts`, a DOM prompt (like the dev debug
      menu, and it swallows its own keys) that accepts a pasted share string —
      taking its mode with it — or a typed seed and rerolls the three starters;
      the end-of-run screen reports the share string beside the raw seed.
      584 tests pass; `npm run build` clean.
- [x] Settings screen (`D22`): `Settings` gained the tileset preference (`auto`
      follows the biome, D10; anything else forces one everywhere), which made
      `SAVE_VERSION` 3 with `SAVE_MIGRATIONS[2]` filling it into a v2 document.
      The tileset ids and their display names moved to the asset-free
      `src/data/tilesets/ids.ts` (`TILESET_IDS`, `TILESET_NAMES`,
      `isTilesetPreference`, `resolveTileset`, `tilesetLabel`) so the engine can
      validate a preference without importing a `.png`, and `index.ts` builds the
      registry on that list. `src/scenes/SettingsScene.ts` (a pure model in
      `src/ui/settingsScreen.ts`) opens paused-on-top from the starter screen or
      the route HUD with `O`: up/down picks a row, left/right steps its value and
      each change is stored at once through `src/settings.ts`, so there is nothing
      to confirm. Every setting is honoured: text speed drives the new battle
      message typewriter (`src/ui/typewriter.ts` + `TEXT_SPEED_MS`; a confirm tap
      or `Z` held skips the line, and the read hold shortened to 450 ms to pay for
      the typing), volume goes into Phaser's sound manager at boot and on change
      (the only audio knob until Phase 8 ships sounds) and the route re-renders
      with the forced tileset when it resumes. Keybinds stayed a separate backlog
      item. 612 tests pass; `npm run build` clean.
- [x] Shared keybinds and the rebinding UI (`D23`): every scene now reads its
      confirm / cancel / move / party / settings key from one map instead of
      hardcoding it. `src/data/keybinds.ts` is the pure vocabulary — one key per
      action, the defaults, display labels, `actionForKey` (explicit binding,
      then the always-on `Enter`/`Space` confirm and `Esc` cancel aliases, so a
      rebind cannot lock a player out), `withBinding` (a rebind swaps with
      whichever action held the key, so no key is ambiguous) and
      `sanitizeKeybinds`. `src/input/` is the Phaser half: `subscribeKeybinds`
      listens to the plugin's generic `keydown`, reading the map per press so a
      rebind applies immediately and skipping auto-repeat, with `actionKeys` for
      the two spots that poll held state (the route's walk, the battle's
      hold-to-skip) and `keyNameOf` for the native-event lookup. `Settings`
      gained `keybinds`, so `SAVE_VERSION` is 4 and `SAVE_MIGRATIONS[3]` fills
      the defaults into a v3 document. `SettingsScene` shows them as `keybind`
      rows beside the `step` rows: confirm on one captures the next raw key
      (bound or not), cancel keeps the old one, and the on-screen hints are
      written from the live bindings. The route, battle, party, starter and
      run-over screens all moved onto the layer; the fixed debug/utility keys
      (`R` tileset, dev `B`, `S` seed prompt) stay on Phaser directly. 634 tests
      pass; `npm run build` clean.

## Phase 8 — Art, audio & release

- [x] FRLG battle trainer sprites (O1): `scripts/frlg/build-trainer-sprites.mjs`
      crops the ten trainers the archetypes use from the "Regular Trainers" grid
      of `sprite-sources/frlg/trainers.png` (64px cells on a 65px pitch, the flat
      orange cell keyed transparent) into `src/assets/frlg/trainers.png` plus
      `src/data/frlg/trainers.json`, read through `src/data/trainerSprites.ts`.
      Every archetype in `src/data/trainers.ts` names its `battleSprite` and
      `BattleScene` draws it on the enemy platform for a trainer battle (the
      trigger carries `archetypeId`); a wild battle keeps the placeholder mon.
      `trainerSprites.test.ts` measures the atlas shape and that every frame
      carries art. Overworld trainer sheets are still open (O1). 497 tests pass;
      `npm run build` clean.
- [x] FRLG route fields (`D18`): `D18` landed — `TilesetConfig.atlas` carries
      `tileSize`, `BootScene` loads each sheet at its own cell size and
      `RouteScene` scales every cell back to the 24px world tile, so the 16px
      FRLG atlases and the 24px PMD sheets coexist. `scripts/frlg/build-tilesets.mjs`
      composes three 64x208 atlases (outdoor, forest, cave) from the gitignored
      `sprite-sources/frlg/tileset-2.png`: the floor and its five variants
      (frames `1`,`2`,`41`-`43`, beside the common stair/trap slots), the wall
      autotile shapes stamped as the field's single repeated border (composited
      over the floor so transparent pixels read as ground) and the sheet's shared
      rocky-banked pond with every concave/diagonal corner filled. The three are
      registered as tilesets (`frlg.ts` with one shared config, `index.ts`,
      `palettes.ts`) and as biomes with encounter tables (`biomes.ts`,
      `encounters.ts`), and the route chain now cycles only FRLG fields —
      outdoor → forest → cave — so the imported PMD `wood` sheet no longer shows
      up in a run (`wood`/`placeholder` stay as manual settings overrides).
      `frlg.test.ts` measures each committed atlas and asserts every wall/water
      shape and floor variant is stamped. 638 tests pass; `npm run build` clean.
- [x] FRLG-style Pokémon battle sprites for every generation (O1): the dex is
      Gen 9 but the battle art now comes from the pokeemerald-expansion checkout
      (`graphics/pokemon/<species>/`, gitignored, never redistributed).
      `scripts/frlg/build-pokemon-sprites.mjs` maps each playable species to its
      expansion folder (a forme without its own art falls back to its base
      species), keys out the palette's flat background and packs three atlases —
      `src/assets/frlg/pokemon-{front,back,icon}.png` — plus the frame manifest
      `src/data/frlg/pokemon-sprites.json`, read through `src/data/pokemonSprites.ts`.
      `BattleScene` draws the foe's front frame and the player's active mon's back
      frame, replacing the placeholder battle mon. The overworld player sprite,
      portraits, move FX and battle backgrounds are the remaining PMD pieces
      (`TODO.md`). 638 tests pass; `npm run build` clean.
- [x] FRLG trainer overworld sprites (`D24`): a trainer on the route draws its
      class's FRLG overworld sprite instead of the tinted placeholder. The ten
      archetypes' down-facing idle frames come from the pret/pokefirered decomp
      (`graphics/object_events/pics/people/*.png`, 160x32 sheets of ten 16x32
      walk frames) via `scripts/frlg/build-overworld-sprites.mjs`, packed into
      `src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json` and read
      through `src/data/overworldSprites.ts`; `psychic` borrows the Channeler and
      `ace` the male Cooltrainer, and `trainers.ts` sets each archetype's
      `spriteKey` to its manifest name. `RouteScene` draws the 16px frame at
      `TILE_SIZE / 16` with its feet on the tile bottom, beside the tinted facing
      arrow, and falls back to the placeholder only if a future archetype names a
      sprite the sheet lacks. `overworldSprites.test.ts` measures the atlas and
      that every archetype maps onto a non-empty frame. 641 tests pass;
      `npm run build` clean.
- [x] FRLG player overworld sprite with walk and run cycles (Phase 8, `D25`):
      the route's player is the FRLG protagonist instead of the PMD placeholder,
      and holding a direction now walks him. `red_normal.png` from the
      pret/pokefirered decomp (`graphics/object_events/pics/people/`, a 144x32
      strip of nine 16x32 frames: the resting pose plus a two-frame cycle of each
      direction) is packed by `scripts/frlg/build-player-sprite.mjs` into
      `src/assets/frlg/player.png` + `src/data/frlg/player.json`, read through
      `src/data/playerSprite.ts` (idle and walk frames per facing; the decomp
      side faces left, its right is the flipped frame). `src/render/playerAnim.ts`
      keys the three cycles and `BootScene` registers them.
      `RouteScene` moved from one tile per key press to hold-to-walk: a step
      slides between tiles over `WALK_STEP_MS` with the direction's animation
      playing, releasing shows the resting frame, and pushing into a wall turns
      in place. A new `run` keybind (`SHIFT` by default, rebindable, listed on the
      settings screen via `KEYBIND_ACTIONS`) cuts the step to `RUN_STEP_MS` and
      scales the cycle's `timeScale`, so running reuses the walking frames faster
      as the originals do. Encounters, fog and trainer sight are untouched — a
      step still lands on one tile and runs the same `onTileEntered` beat.
      `playerSprite.test.ts` and `playerAnim.test.ts` measure the atlas and the
      cycles. 646 tests pass; `npm run build` clean.
- [x] FireRed/LeafGreen-style route layouts and field tiles (`D26`): a route's
      shape now follows its biome instead of one generic blob. Calibrated against
      the real layouts in the pret/pokefirered decomp (`data/layouts/*/map.bin`),
      `src/engine/routes/layout.ts` carries three styles — `route` (Route 1: an
      open grass field, ~38% blocked, cut by one-tile tree hedges attached to the
      borders), `forest` (Viridian Forest: a one-tile-corridor labyrinth, ~57%
      blocked) and `cavern` (Mt. Moon: two-tile rock corridors and wide chambers,
      ~40% blocked). `sketch.ts` gained the two carvers (`carveHedges`,
      `carveMaze` with an optional braid) and a shortest-path guard that keeps
      solid terrain (water, ledges) off the way through, and `src/data/biomes.ts`
      names each biome's style. The FRLG atlases were recomposed
      (`scripts/frlg/build-tilesets.mjs`): the wall autotile now draws a tree in
      three layers — a canopy where the mass opens north, a trunk where it opens
      south and the leaf body elsewhere — so a tree border reads as trees instead
      of a flat repeated stamp; the forest field got real green grass (the old
      pick was a sand tile) and the sheet's last free cell became a rocky ledge
      lip (`FRAME_LEDGE`), which FRLG routes now draw on their one-way ledges
      instead of plain ground. `frlg.test.ts` measures the ledge frame, the new
      `layout.test.ts` covers the registry and the expanded `sketch.test.ts`
      asserts the per-style edge entries and density bands. 653 tests pass;
      `npm run build` clean.
- [x] FRLG walls are whole trees, not a per-shape stamp (`D26` follow-up): the
      tree bank draws a tree three tiles wide that stacks vertically, so one frame
      per autotile shape read as a flat hedge. `TilesetConfig` gained a
      `wallPattern` (a `cols` x `rows` motif) and `tileFrames.patternFrame`
      resolves it anchored to the wall mass's top-left: the first row is the
      mass's top, the last its base, the middle rows cycle as the wall rises and
      the columns repeat across x, centring the motif on a one-tile wall.
      `build-tilesets.mjs` stamps the FRLG fields' wall on frames `7`-`18` — a
      canopy against ground, a solid canopy (the tree bank's ground filled in so
      the tops stack without holes), the canopy body and the trunk. `frlg.test.ts`
      measures every pattern frame and `tileFrames.test.ts` covers the anchoring,
      the interior cycle and the centring. 657 tests pass; `npm run build` clean.
- [x] FRLG ground matched to the real field (`D26` follow-up): the outdoor field
      stamped its base floor from the sheet's lighter `2,3` tile, which does not
      match the game. Measured against a real FireRed/LeafGreen Route 1 capture,
      the plain ground is `rgb(112,200,160)` (sheet tile `6,1`), so the base floor
      now uses that and the lighter tiles stay as floor variants. 657 tests pass;
      `npm run build` clean.
- [x] FRLG walls use the real FireRed tree (`D26` follow-up): the wall motif
      stamped a canopy picked from higher up the sheet, so a border read as a
      generic hedge instead of the game's tree. It now takes the real 3x4 tree
      block in the bottom-left of `tileset-2.png`, above the pond (crown, two
      canopy rows and the trunk platform), three columns wide, and bakes the
      interior rows solid (`solidOver`) so a tall wall stacks without ground
      gaps. The four pattern frames still hold its twelve cells, so
      `frlg.test.ts` and `tileFrames.test.ts` are unchanged.
- [x] Routes larger than the camera, framed by trees (`D26` follow-up): a route is
      now 56x32 tiles instead of 24x16, so the camera follows the player and
      scrolls. The scene renders a four-tile tree/rock margin past the playable
      edge (`padMap`, `src/engine/map.ts`, `RouteScene.renderMap`) and bounds the
      camera to it, so the border reads as more forest and the empty background is
      never seen. The regression seed moved to the new size and the `route`
      layout's hedge count was retuned (15 -> 90) to keep Route 1's density band
      on the bigger field; `map.test.ts` covers `padMap`.
- [x] No fog of war on a route (`D6` follow-up): the route draws the whole map at
      full opacity, like the originals, so trainers and items are read off the map
      instead of a vision radius. `RouteScene` dropped its `Vision` recompute and
      the per-tile/entity alpha pass, and the now-unused `vision.ts` and `fov.ts`
      modules (and their barrel exports) were removed. 659 tests pass;
      `npm run build` clean.
- [x] Pixel-art filtering fixed dark seams between route tiles: the FRLG cells are
      16px art scaled to the 24px world tile, and the default linear filtering
      blended each cell with the neighbouring atlas frame at fractional camera
      scroll, leaving a dark line. `main.ts` now boots with `pixelArt: true` and
      `roundPixels: true`, so the 3x total scale (sheet cell x tileset scale x
      camera zoom) is nearest-neighbour and integer. 659 tests pass;
      `npm run build` clean.
- [x] FRLG tree crowns superimpose the trunk row above (`D26` follow-up): a tall
      tree wall showed one crown on a flat canopy run and a trunk only at the very
      foot. `patternFrame` now repeats the tree every three rows, so a wall shows a
      crown every three tiles and each trunk shows through underneath.
- [x] FRLG wall motif split into five frames so the bodies are right (`D26`
      follow-up): the wall had a single body frame, so the second visible row drew
      the lower body (row 36) instead of the wide one (row 35), and the baking
      sampled each tile's top-left pixel as "background", which is a leaf on the
      body rows and corrupted the right-hand tile. `fieldFrames` now keys the whole
      teal ground family (the grass and its darker shadow, detected by hue) so the
      body corners match the floor, and the motif holds five
      frames — crown over ground, crown over trunk, the two body rows and the
      trunk — so `patternFrame` runs body, lower, then the crown that overlaps the
      trunk. `frlg.ts` grows `FRLG_WALL_LOWER_FRAMES` and moves the base to
      19-21; `frlg.test.ts` checks every frame is stamped and `tileFrames.test.ts`
      pins the new interior cycle (`14, 17, 11`). 659 tests pass;
      `npm run build` clean.
- [x] FRLG walls draw the floor under them (`D26` follow-up): the tree carried a
      baked flat floor colour, but the floor tile next to a wall uses a lighter
      wall-edge variant, so the tree corners showed a darker green than the route.
      The crown and trunk frames now keep a transparent ground and `RouteScene`
      draws a floor frame under every cell (`resolveGroundFrame`,
      `src/engine/tileFrames.ts`), so a wall picks up the same floor variant as its
      neighbours and blends in. `frlg.test.ts` allows the transparent edge rows and
      `tileFrames.test.ts` covers `resolveGroundFrame`. 660 tests pass;
      `npm run build` clean.
- [x] FRLG tree crowns stack on the lower leaves (`D26` follow-up): the crown of
      the tree below lands on the lower-body row of the tree above and the body row
      covers that tree's trunk, so the interior hides the trunk and only the mass's
      foot shows the platform. The motif keeps six frames (top, body, crown, mid,
      lower, foot); `build-tilesets.mjs` composites `top` over `lower`, `body` over
      `lower` (mass top) and `body` over `base` (the row that hides the trunk),
      `patternFrame` alternates crown/body above the foot
      (`src/engine/tileFrames.ts`) and `frlg.ts` renames `CANOPY` to `CROWN` and adds
      `MID`. `frlg.test.ts` and `tileFrames.test.ts` updated; 661 tests pass;
      `npm run build` clean.
- [x] Routes are an open field with a one-tile tree frame: every route now carves
      `kind: 'open'` (interior plain ground, only the border wall), the scene pads
      the map with a single tree/rock ring (`MAP_MARGIN` 4 -> 1) and the biome
      terrain is zeroed (`grassPatches`/`waterBodies`/`ledges`), so routes are
      plain ground for now. The `hedges`/`maze` carvers stay in
      `src/engine/routes/sketch.ts` for when interiors return. `layout.ts`,
      `biomes.ts`, `sketch.test.ts` and `docs/routes-spec.md` updated. 661 tests
      pass; `npm run build` clean.
- [x] Open-field tree frame reads whole again (`D26` follow-up): the one-tile
      margin left a two-tile tree line, so a side showed only two of the motif's
      three columns (the right one cut off) and the top/bottom line had a crown and
      a trunk but no body. The frame is now three tiles wide on the sides
      (`MAP_MARGIN_X` 2) and four tiles deep top/bottom (`MAP_MARGIN_Y` 3, plus the
      route's own one-tile border), so a side shows the whole three-column tree and
      the top/bottom line carries both body rows between the crown and the trunk:
      the full 3x4 tree. `padMap` now takes an `{ x, y }` margin for it. Every
      sprite (`centerX`/`centerY`) shifts by the same per-axis margin, so the
      player, trainers and items line up with the ground `padMap` draws instead of
      drifting one tile up-left onto the tree ring. The FRLG field also drops the
      PMD-style wall-edge floor decal: the lighter `FLOOR_ALT_*` frames read as a
      path, so `FRLG_TILESET` now resolves the ground under and beside a wall to
      the plain floor frame and the field is uniform. `map.test.ts`,
      `tileFrames.test.ts` and `frlg.test.ts` pin the asymmetric margin, the border
      shape and the uniform ground; 665 tests pass; `npm run build` clean.
- [x] FRLG tree body row keeps its transparent ground (`D26` follow-up): the
      `BODY` frames (`10`-`12`) no longer bake the tree's lower leaves behind them
      (`overFill(body, lower)`) and key the ground out instead (`overNone(body)`),
      so the field's floor shows through the body row the same way it already comes
      through the mass's top and trunk foot, which reads lighter against the route.
      `scripts/frlg/build-tilesets.mjs` (comment) and `docs/tileset-spec.md` §3b
      updated; the three field atlases regenerated with `node
      scripts/frlg/build-tilesets.mjs` (reproducible: same hashes); 666 tests pass;
      `npm run build` clean.

## Phase 9 — Maps (route groups), biomes & progression

A **map** is a Binding of Isaac-style floor: a grid of routes (rooms) of one
biome, closed into at least one cycle, with its own level range, its special
rooms and a boss on the room farthest from the entry that opens the portal to the
next map. This phase reworked the flat route chain into those floors and added
the Poké Dollar economy. `[Task-17]` (Batch 6) is the docs/migration pass that
closed it.

### Step 1 — Map tuning tables (`src/data/maps.ts`)

- [x] **The per-map tuning tables land.** `MAP_TUNING` holds one row per map —
  its level range, its route-count range and the range each room rolls its width
  and height from — behind `mapTuning`, `levelRangeForMap`, `levelCapForMap`,
  `routeCountRangeForMap` and `routeSizeRangeForMap`, and `MAP_TUNING_STEP`
  extrapolates past the last row so an infinite run keeps climbing: the level
  range steps up at **both** ends and saturates at `MAP_MAX_LEVEL`, and the room
  count stops at `MAP_MAX_ROUTES` so a deep floor never becomes a maze. Data only
  — retuning never touches the generator. `docs/maps-spec.md` §4; tests in
  `src/data/maps.test.ts`.

### Step 2 — `MapPlan` floor generator (`src/engine/maps/plan.ts` + `streams.ts`)

- [x] **`planMap` rolls a whole floor off one `map` stream.** Everything a map is
  comes from `Rng(seed : "map" : mapIndex)`: the biome (never the previous map's),
  the room count and each room's width and height (rolled independently). The
  floor grows a **single-door entry leaf** into a 2x2 core closed into a 4-cycle,
  then expands onto adjacent free cells, closes **one or more** extra cycles, hangs
  the boss off the farthest room as an extra `dead-end` leaf and derives every
  room's opening set and shape. `MapPlan` is a pure function of `(seed, mapIndex)`
  with fixed-seed determinism, connectivity, cycle and no-dangling-opening tests.
  `docs/maps-spec.md` §2/§3; `D29`/`D30`.

### Step 3 — Route shapes from the opening set

- [x] **A route takes its shape from the plan, not a roll.** `dead-end`,
  `corridor` and `tee` join `straight`/`bend`/`cross` in
  `src/engine/routes/layout.ts`, and the route builder reads its opening set from
  the plan: every opening is the grid neighbour's **opposite** edge, aligned to
  the same border band, so leaving by one edge enters the neighbour by the other.
  Per-shape and connection regression tests.

### Step 4 — Plan-driven route size

- [x] **A room's size comes from the plan.** `routeForRoom`
  (`src/engine/maps/route.ts`) hands `sketchRoute` the room's own width and height
  — never the fixed 20x20 — with its opening set; the map-size tiers, the camera
  bounds and the beyond-edge margin (`padMap`) still hold at every plan size.
  Every room is at least **30x30** and the entry and boss rooms are pinned to it
  on every map. Fixed-seed regression per size; `docs/routes-spec.md` §2.

### Step 5 — Per-map levels & cap

- [x] **The map's level range is the band.** Wild encounters and trainer rosters
  read `levelRangeForMap` (rooms ramp `minLevel → maxLevel`), the player's cap is
  the map's `maxLevel` (`levelCapForMap`), and an evolution the cap blocks waits
  for the next map instead of being clamped. `bandForRoute`/`levelCapForRoute`
  are gone; the rosters stay RNG-free and their fixed-seed tests pin the band.

### Step 6 — Run state: floors & discovery

- [x] **`RunState` tracks the floor and its fog of discovery.** `mapIndex`,
  `routeInMap` and `discoveredRooms` sit beside the global `routeIndex`;
  `advanceRoute` moves a room while `advanceMap` changes floor and carries the
  heal stop (HP/PP only, never a resurrection), and a save migration lands the new
  fields. Pure tests, including the discovery rule; `docs/maps-spec.md` §2/§9.

### Step 7 — Boss & portal

- [x] **The boss seals the exit and opens the portal (`D31`).** The room farthest
  from the entry fields the map boss at the map's `maxLevel`; its portal is carved
  from the start on a free wall and stays **sealed** while the boss stands, so the
  room looks identical before and after, and stepping through it once it opens
  advances the run to the next map. A finite run's last map holds the **final
  boss** and no portal, so beating it wins the run; infinite mode reopens the
  portal forever. Pure guard/portal logic + `RouteScene` wiring.

### Step 8 — Route HUD minimap

- [x] **The route HUD header is the floor minimap (`src/ui/mapView.ts`, `D32`).**
  `buildMapView` lays out a Binding of Isaac-style grid of the **discovered**
  rooms — a cell per room from its own width/height with its openings on the
  matching walls, a link drawn only once **both** its ends are known, the current
  room highlighted, the boss marked and the open portal flagged — and `RouteScene`
  only scales and paints it. A room stays hidden until it is entered, so the floor
  reveals itself as the run advances. Pure layout + tests; `docs/maps-spec.md` §8.

### Step 9 — Mega Evolution in battle (`D34`)

- [x] **Mega Evolution is a battle mechanic (`src/engine/battle/mega.ts`).** A
  Pokémon holding its **Mega Stone** may Mega Evolve **once per battle** from the
  command menu's **MEGA** control: confirming it arms the evolution and the next
  FIGHT spends it while still attacking that turn, and the forme is applied
  **before any move**, so the turn reads the Mega's Speed, type and ability. Both
  the player and the AI can Mega Evolve, and only bosses, mini-bosses and the
  `ace` archetype carry stones. Every dex Mega ships — **88** formes in
  `src/data/dex/megas.json`, the nonstandard ones included — each with its own
  `held` stone in `src/data/items.ts`. `docs/battle-spec.md` §9; fixed-seed tests
  in `mega.test.ts`, `megas.test.ts` and `roster.test.ts`.

`[Task-17]` is the docs/migration pass that closes the phase: it finishes
`docs/maps-spec.md`, carries the shipped numbers into `docs/design-spec.md`,
`docs/routes-spec.md`, `docs/battle-spec.md` and `AGENTS.md`, fixes the stale
`D##` counts, and writes this archive.

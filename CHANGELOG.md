# PokeRandomLike — Changelog

Completed backlog items, kept out of `TODO.md` so the daily backlog stays small.
This file is *what shipped*, grouped by the roadmap phase it belonged to; the
rationale behind each rule (`D##` decisions) lives in
`docs/tech-decisions.md`. The commits carry the moment-by-moment history; this
file is the human-readable summary.

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

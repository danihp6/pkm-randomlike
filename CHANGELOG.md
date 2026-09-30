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
      `IS_DEVELOP`. The debug menu skeleton it gates is still open.

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

## Phase 6 — Run structure, party & economy

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

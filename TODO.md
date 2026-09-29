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

**Framework established (D1-D16):** Phaser 3 + Vite + TS, pure logic in
`src/engine/`, dex generated from `@pkmn/dex`, own battle engine extending
Showdown's semantics, swappable tilesets, strict permadeath. Reuse of
`pkm-mystery-dungeon-like` is scoped in `docs/tech-decisions.md` (D14).

---

## Phase 0 — Repo & scaffolding

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] Add ESLint + Prettier with a `npm run lint` script once the engine has more
      real code (deferred: TypeScript strict mode covers most of it for now).
- [ ] Add the developer gate (`src/dev/env.ts` reading `ENVIRONMENT`) and a debug
      menu skeleton; `.env.development` is already in place.
- [ ] Add a README per code folder as the folders appear (`src/scenes/README.md`,
      `src/render/README.md`, `src/input/README.md`).

## Phase 1 — Dex accessors & data contracts

> Completed work for this phase is archived in `CHANGELOG.md`.

The generated dex is in `src/data/dex/`; this phase wraps it in typed, tested
accessors so the engine never touches raw JSON.

## Phase 2 — Route generation & exploration

> Completed work for this phase is archived in `CHANGELOG.md`.

- [ ] `src/engine/routes/sketch.ts`: the generation pipeline from
      `docs/routes-spec.md` §2 — frame, terrain, population, validation, all off
      one `Rng`. Deterministic per `(seed, routeIndex)`; regression test.
- [ ] `src/engine/routes/routeMap.ts`: store the route as `RouteMap` (tiles +
      start + exit + trainers + items) so the scene never re-derives it.
- [ ] `src/engine/routes/trainers.ts`: trainer sight lines (facing + range,
      blocked by solids), "sees player" recomputed per step.
- [ ] `src/engine/routes/encounters.ts`: per-biome weighted encounter tables by
      level band, rolled from the route RNG with a deterministic step counter.
- [ ] `src/data/biomes.ts` + `src/data/encounters.ts` + `src/data/trainers.ts`:
      the authored side, wired to the imported biome tilesets.
- [ ] `src/engine/routes/validate.ts`: flood-fill guarantees start → exit and
      every trainer is reachable; reroll from the same stream otherwise.
- [ ] Ledges (`LEDGE`) and one-way jumps as a movement rule.
- [ ] Route scene reads a real `RouteMap` instead of `ROUTE_SKETCH`, with
      trainers, items and the exit; `R` stays as the tileset-swap debug key.
- [ ] Tall-grass overlay art and the encounter trigger on step.

## Phase 3 — Battle engine core (pure, headless, tested)

> Completed work for this phase is archived in `CHANGELOG.md`.

The whole menu battle minus per-effect behaviour. Contract in
`docs/battle-spec.md`.

- [ ] `src/engine/battle/fighter.ts`: a battle fighter built from species + level
      + nature + IVs + moveset, with stat computation and stat stages (−6..+6).
- [ ] `src/engine/battle/state.ts`: battle state (two sides, field, turn, weather,
      seeded `Rng`), plus the event log that the UI renders.
- [ ] `src/engine/battle/order.ts`: priority then effective speed, ties on the
      battle RNG.
- [ ] `src/engine/battle/damage.ts`: Gen 9 formula (STAB, effectiveness, crit,
      85-100% roll, weather/burn modifiers) using the Phase 1 accessors.
- [ ] `src/engine/battle/accuracy.ts`: accuracy/evasion stages and the hit roll.
- [ ] `src/engine/battle/status.ts`: burn, poison, badly poisoned, paralysis,
      sleep, freeze + residual ticking.
- [ ] `src/engine/battle/volatile.ts`: confusion, flinch, Leech Seed, Substitute,
      Taunt, Encore, trapped, perish count.
- [ ] `src/engine/battle/turn.ts`: the turn loop (choices → pre-move actions →
      moves → residuals → faint/replace) driven only by choices, no UI.
- [ ] `src/engine/battle/commands.ts`: `fight`, `bag`, `switch`, `run` as the four
      legal choices, each with its validation.
- [ ] `src/engine/battle/runAway.ts`: the run odds; trainer battles refuse.
- [ ] `src/engine/battle/capture.ts`: Gen 9 catch formula, ball bonuses, HP/status
      modifiers, one capture per route enforced by the run, not the battle.
- [ ] `src/engine/battle/ai.ts`: a trainer AI that picks moves by expected value
      and switches when badly matched (no cheating: it only reads legal state).
- [ ] Golden test: a scripted battle with a fixed seed, frozen as a formatted log
      (the seed of the balance harness).

## Phase 4 — Battle effects: abilities, items, weather, terrain

> Completed work for this phase is archived in `CHANGELOG.md`.

Ports of Showdown handlers, in batches, on the hook names in
`docs/showdown-reuse.md` §3.

- [ ] `src/engine/battle/effects/registry.ts`: hook registration
      (`onSwitchIn`, `onStart`, `onResidual`, `onModifyDamage`, `onTryHit`,
      `onAfterMove`, `onStatus`, `onBoost`, ...) + dispatch from the turn loop.
- [ ] `src/engine/battle/effects/items.ts`: the battle items actually obtainable
      in a run (potions, status cures, X-items, berries, Leftovers, type boosts).
- [ ] `src/engine/battle/effects/abilities.ts`: batch 1 — the abilities that show
      up before the mid routes (Intimidate, Levitate, Sturdy, Static, ...).
- [ ] `src/engine/battle/effects/abilities.ts`: batch 2 — the competitive long
      tail, ported straight from Showdown's handler bodies.
- [ ] `src/engine/battle/effects/weather.ts` + `terrain.ts`: weather and terrain
      from moves and abilities, with the residual order.
- [ ] `src/engine/battle/effects/moves.ts`: moves whose handlers are not plain
      damage/status (Protect, Substitute, Recycle, multi-turn, self-destruct...).
- [ ] `docs/balance/effect-coverage.md`: every ability and item marked
      `port | no-op | excluded` (D16).
- [ ] Dev warning (behind the `src/dev` gate) when a battle meets an unported
      effect, so no coverage gap hides during playtests.

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
- [ ] Adapt the remaining biome tileset configs (desert, apple-woods,
      lush-prairie, beach-cave) and palettes into `src/data/tilesets/`.
- [ ] Tall-grass, ledge and route-prop art.
- [ ] Battle background per biome.
- [ ] Audio: route ambience, encounter, hit, faint, level-up, victory.
- [ ] Free-art fallback set so a public build can drop the game rips (O4).
- [ ] Build/publish pass for itch.io.

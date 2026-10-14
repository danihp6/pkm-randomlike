# PokeRandomLike — Battle Spec

The menu battle. Everything here is pure logic in `src/engine/battle/`; the
Phaser scene only renders state and forwards choices.

## 1. Shape of a turn

1. The active Pokémon of each side receives a choice: `fight(move)`, `bag(item)`,
   `switch(index/box)`, `run`.
2. Bag, switch and run resolve **before** moves, in the classic order.
3. Moves resolve in order of: priority (descending), then effective Speed
   (stages, item and ability modifiers applied), ties broken by the seeded battle
   RNG.
4. End-of-turn effects tick in this order: burn/poison/badly-poisoned damage,
   weather chip (sandstorm), terrain healing (Grassy), ability/item residuals
   (Leftovers, berries), Yawn (sleep) and Wish (heal), Leech Seed, perish count,
   then Taunt/Encore decay and the weather/terrain turn counters.
5. A fainted Pokémon is replaced by its owner's next choice before the next
   turn; if a side has no Pokémon left, the battle is over.

## 2. The four commands

| Command | Rule |
| --- | --- |
| **Fight** | Pick one of the active Pokémon's moves. PP is spent. No PP = Struggle. |
| **Bag** | Use an item on the active Pokémon (or, where legal, a chosen one). Consumes the item. Trainer battles allow items. |
| **Pokémon** | Swap the active Pokémon for another in the party; costs the turn. |
| **Run** | Wild battles only. Seeded roll against the classic odds; trainer battles refuse. |

## 3. Damage and stats

- Stats at level with natures, IVs and EVs computed exactly once per Pokémon
  (Showdown's `Nature`/`Stat` data), cached on the battle fighter.
- Damage follows the Gen 9 formula, including STAB, type effectiveness, critical
  hits, the 85–100% roll on the seeded battle RNG, weather and burn modifiers.
- **Screens** halve damage while they last: Reflect the physical, Light Screen the
  special, Aurora Veil both (and only while it is snowing). **Wonder Room** swaps
  the defensive stat a hit reads; **Magic Room** switches held items off for its
  duration.
- Type effectiveness comes from the generated 18x18 chart, not a hand-written
  table.

## 4. Status and volatility

Primary status: burn, poison, badly poisoned, paralysis, sleep, freeze.
Volatiles: confusion, flinch, Leech Seed, Substitute, trapped, Taunt, Encore,
perish count, protection (Protect and friends), charge state (a two-turn move
waiting to fire), Yawn countdown, stat stages (−6..+6). Effects live in
`src/engine/battle/effects/` and follow Showdown's semantics, ported category by
category (see `docs/showdown-reuse.md` for the coverage table).

The later ports add volatiles a single battle can honour: Aqua Ring and Ingrain
(residual healing, Ingrain also rooting the holder), Curse, Destiny Bond, Grudge,
Focus Energy, Laser Focus, Dragon Cheer, Endure, Imprison, Magic Coat, Snatch,
Magnet Rise, Power Trick and the Stockpile counter (spent by Swallow).

Side and field conditions live on the battle state, not on a Pokémon:
**Reflect**, **Light Screen**, **Aurora Veil**, **Tailwind**, **Lucky Chant**,
**Mist** and **Safeguard** on a side; **Trick Room**, **Gravity**, **Magic
Room**, **Wonder Room**, **Fairy Lock**, **Mud Sport** and **Water Sport** on the
field. Each carries a turn count ticked in the residual pass
(`src/engine/battle/effects/conditions.ts`).

Special move shapes:

- **Two-turn charge moves** (Solar Beam, Fly, Dig...) lock the user for one
  turn; the next turn the move fires regardless of the chosen command. Solar
  Beam and Solar Blade skip the charge in harsh sunlight.
- **Damage counters** (Counter, Mirror Coat, Metal Burst, Comeuppance) pay back
  the damage taken earlier in the turn: 2x the physical/special damage for the
  first pair, 1.5x the total for the second. They fail with no damage banked.
- **Self-switch moves** (U-turn, Volt Switch, Flip Turn, Parting Shot, Teleport,
  Baton Pass) deal their effect and then require a replacement; Baton Pass copies
  the user's stat stages to the incoming Pokémon.

## 5. Permadeath

- Fainting removes the Pokémon from the run permanently: it leaves the party,
  the box entry is deleted, evolution and stat caches go with it.
- There is no Revive item and no way to restore a fainted Pokémon.
- A battle you lose wipes the whole party, so the run ends. There is no "black
  out and wake up in the last Center".
- The loss is shown, not just applied: each fallen Pokémon gets a "was released"
  beat on the route (portrait, name and level), and when the last one falls the
  run ends on a dedicated screen that reports the routes cleared and the run
  seed before offering a new run. The final route's exit ends on the same screen.
- Capture is allowed in wild battles only.

## 6. Capture

One capture attempt per route (a run-level counter, not a per-battle one).

1. Only wild battles can be captured, and only while the wild Pokémon is
   weakened.
2. The catch chance is the classic Gen 9 formula (ball bonus, catch rate, HP
   ratio, status bonus, level). The catch rate comes from the dex
   (`catchRateOf`, sourced from PokeAPI) and the ball bonus from
   `src/data/items.ts`.
3. A failed throw consumes the ball and the wild Pokémon keeps fighting; there is
   no re-throw penalty beyond the ball cost.
4. A successful catch adds the Pokémon to the party, or to the PC box if the
   party is full.

## 7. Progression inside the battle

- The **party and the PC share one level and one XP bar** (D35): the XP a battle
  awards fills the squad's single bar, and every member levels with it, learning
  the moves the learnset says at that level. Levelling never evolves a member.
- **Evolution is manual and level-only.** Every evolution in the dex — level-up,
  stone, trade, friendship, move — is resolved to a level (`evolutionBranches`,
  `src/data/dex/evolutions.ts`): a canon level evolution keeps its level, the
  rest read their species' **BST band** — 20, 30 or 40, on the same windows the
  run's own `LevelBand.bst` tiles (`EVOLUTION_BST_LEVELS`, `D39`) — and never
  before the level the species was obtained at, which is **`EVOLUTION_MIN_GAP`
  (10) levels over the resolved level of the evolution that produced it**, so a
  stone/trade branch waits out a late canon level-up in its line. All of a
  species' branches share that level, so a split line (Eevee's eight) shows every
  option at once and the player picks in the STATS tab's **evolution graph**: a
  branch the member's level already meets is green and a click applies it. The
  rule reads no RNG and no map cap: a branch whose level lands above the current
  map's cap simply stays grey — it **waits** for a deeper map (or, in a finite
  run, forever) instead of being clamped. Evolution keeps the level, nature,
  IVs/EVs, moves, PP, status and held item, rebuilds the stats and types from the
  new species and carries the **missing** HP across. It is unrelated to Mega
  Evolution (§9).
- A **catch joins the squad at that shared level**: its stats and moveset are
  rebuilt from the species at the squad's level, whatever level the wild was; it
  keeps the species it was caught as and evolves only by the player's click. It
  enters the run under an id minted by `nextMemberId` (`catch-<n>`,
  `src/engine/run/state.ts`), unique across the party and the box and kept for the
  member's life, so a panel that resolves a member by id always shows that member.
- A member may carry a **nickname** (`src/engine/run/nickname.ts`): up to twelve
  code points, typed in place in the STATS tab's own name row (the field the route
  HUD draws in the detail panel; Enter commits, Escape cancels). It rides
  in the battle snapshot as its own optional field `FighterSnapshot.nickname`,
  beside `fighter.name` — a creation name, then the battle-only forme's — so **no
  forme change and no Mega Evolution (`§9`) can rewrite it**. Every site that names
  a member draws the nickname when it has one and the species name when it does
  not: the party and PC rows, the detail panel, the level-up and evolution popups,
  the capture screen, the release beat and the battle. Typing the species name
  (case-insensitively) or an empty field clears it, and the clear **omits** the
  field rather than storing an empty string.
- A **per-map level cap** clamps gain: the squad can never exceed
  `levelCapForMap(map)`. The cap rises with the map chain so the next map is
  always a step up, and an evolution unlocks as soon as the member's level meets
  its branch (the member's level never exceeds the cap).
- The curve is medium-fast (`level^3`): the generated dex carries no
  base-experience yield, so `experienceAward` scales with the defeated Pokémon's
  level instead. The bar lives on the run (`RunState.xp`), not on a member, and
  the award is not split by party size (the squad is one unit). The whole
  progression is RNG-free (D11).
- Trainer rosters are generated at the route's level band, never above the cap.

### 7.1 Randomized learnsets and movesets (`D17`)

Every Pokémon's learnset is a pure function of the run seed and its species id
(`src/engine/battle/randomLearnset.ts`). It keeps the canon's shape — the same
level-up levels and the same number of TM/tutor/egg slots — but rolls which move
fills each slot, so a run plays a randomizer where each species learns different
moves. The rules:

- A damage move is ordered **least power to most**, so early levels give the weak
  moves and a high level gives the strong ones.
- The **first level-up move is always damaging**, and every learnset keeps at
  least **60% damage** and **20% status** moves so a Pokémon never ends up
  all-status.
- **OHKO moves are never rolled**; **fixed-damage moves** (Seismic Toss, Night
  Shade, Super Fang, Endeavor, Final Gambit...) only appear from **level 20**.
- The moveset a wild, trainer or player Pokémon enters battle with is the last
  four moves its randomized learnset knows at its level (`defaultMoveset`), so
  the menu battle reflects the same roll. The learnset is keyed by the run seed,
  so a Pokémon keeps the same learnset as it levels and a replay rebuilds it.
- Every Pokémon carries a **full four-move set by level 5**: at or below that
  level `defaultMoveset` tops an under-full set up from the species' own
  learnset — the earliest level-up moves first, then its TM/tutor/egg moves —
  keeping at least one damaging move, so a level-1 catch never fights with one
  or two moves. A species with fewer than four legal moves gets everything it
  has, never a duplicate.

## 8. Ordering and determinism

- The battle takes its randomness from one seeded `Rng` derived from the run
  seed, the route index and the encounter id, so a replay of the same inputs
  produces the same battle.
- Order is priority, then the per-bracket tie-break (Quick Draw, Stall), then
  effective Speed, with exact ties broken by the seeded RNG. **Trick Room**
  reverses the Speed order for the whole field; **Tailwind** doubles a side's
  Speed. Both are read in `order.ts` / `modifiers.ts` from the field and side
  conditions.
- A Pokémon's randomized learnset and moveset are derived from the run seed and
  its species id, so they are stable for the whole run and across a replay.
- Call-a-move effects (Metronome, Copycat, Mirror Move, Assist, Sleep Talk,
  Nature Power) draw their pick from the same seeded RNG, so a fixed seed
  reproduces the called move.
- The adapter in the scene never rolls: it only presents choices.

## 9. Mega Evolution

A Pokémon that holds its **Mega Stone** may Mega Evolve **once per battle**; this
is the mechanic the mega-stone room's stones feed (`D34`, `docs/maps-spec.md`
§7).

- The control is a **MEGA** button in the command menu, offered only while the
  active Pokémon holds the stone that matches its species and has not Mega
  Evolved yet. Confirming it **arms** the evolution and reopens the menu; the
  next FIGHT spends it (like the games, the Pokémon still attacks that turn).
  Picking BAG, SWITCH or RUN instead drops the armed evolution.
- The Mega forme is applied **at the top of the turn, before any move**, so the
  turn's order and damage read the Mega's Speed, type and ability. A Mega ability
  with an on-switch-in effect (Drought, Intimidate…) fires then. The engine half
  is `src/engine/battle/mega.ts`; the command carries a `mega` flag on
  `FightCommand`.
- Both the player and the AI can Mega Evolve. The AI spends its stone on the
  first fight command it can. Rival stones are data on the archetypes that may
  carry them — **bosses, mini-bosses and the `ace` archetype** (`carriesMega` and
  `RosterOptions.allowMega`); a stone is assigned to one Mega-capable member.
- The Mega forme swaps the fighter's **stats, types and ability** for the rest of
  the battle and never changes the held item, the moves, the HP fraction or the
  **nickname** (which lives beside `name`, §7). The
  formes come from `dex/megas.json` (generated beside `species.json`, D34); a
  snapshot after the battle stores the base species again.
- Evolution is not Mega Evolution: a run member's level evolution still happens
  outside battle (`docs/routes-spec.md` §5) and is unrelated to this.

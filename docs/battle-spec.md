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
- Type effectiveness comes from the generated 18x18 chart, not a hand-written
  table.

## 4. Status and volatility

Primary status: burn, poison, badly poisoned, paralysis, sleep, freeze.
Volatiles: confusion, flinch, Leech Seed, Substitute, trapped, Taunt, Encore,
perish count, protection (Protect and friends), charge state (a two-turn move
waiting to fire), Yawn countdown, stat stages (−6..+6). Effects live in
`src/engine/battle/effects/` and follow Showdown's semantics, ported category by
category (see `docs/showdown-reuse.md` for the coverage table).

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

- Winning awards XP to the participants (the classic split), levels up on
  threshold, learns moves at the level the learnset says, and evolves on level
  when the evolution method allows it.
- A **per-route level cap** clamps gain: a Pokémon can never exceed
  `routeLevelCap(route)`. The cap rises with the route chain so the next route
  is always a step up. Evolution blocked by the cap waits until the cap allows
  the level.
- Trainer rosters are generated at the route's level band, never above the cap.

## 8. Ordering and determinism

- The battle takes its randomness from one seeded `Rng` derived from the run
  seed, the route index and the encounter id, so a replay of the same inputs
  produces the same battle.
- The adapter in the scene never rolls: it only presents choices.

# `src/engine/run/` — the run, its books and its record

Everything a run carries from one route to the next and from one map to the next: the
run state, its members and their progression, the per-floor and run-long counters, the
post-battle resolve and the record of the runs that already ended. Pure by contract — no
Phaser, no DOM, no `localStorage`, no clock — and every random draw comes from the run
seed (`D11`).

## Layout

- `index.ts` — the barrel most of the engine and the scenes read the run through.
- `state.ts` — the run itself: party, box, rip, bag, money, the per-floor marks and the summary counters.
- `state.test.ts` — the run transitions, the catch window and the member-id repair, headless.
- `progression.ts` — the shared XP bar, levels, the member shape and the catches folded into the squad.
- `progression.test.ts` — the level curve, the awards and every evolution/level-up event.
- `levelCap.ts` — the per-map ceiling and its clamp.
- `levelCap.test.ts` — the clamp and the reached-cap predicate at the edges.
- `floors.ts` — where a global route index falls in the map chain: position, band and cap.
- `floors.test.ts` — the chain round trip over the finite and infinite modes.
- `chain.ts` — what a route index plays as: route, mini-boss, boss or final boss.
- `chain.test.ts` — the cadence in every mode and at every block boundary.
- `heal.ts` — the Pokevial charges, the heal stop and the party/box heal.
- `heal.test.ts` — the charge economy and what a heal never does (revive, D5).
- `perms.ts` — permadeath: the fallen leave the run for good (D5).
- `perms.test.ts` — the release order, the same-reference no-op and the RIP list.
- `battleLink.ts` — the contract a route hands a battle and the payload the battle hands back.
- `battleLink.test.ts` — the trigger shapes and the battle seeds they derive.
- `resolve.ts` — the post-battle resolve: XP, levels, the fallen, the money and the loot.
- `resolve.test.ts` — a won, a lost and a run-away battle folded back into the run.
- `roster.ts` — the rosters a trainer or boss fields.
- `roster.test.ts` — roster size, levels and the Mega Stones a roster carries.
- `pool.ts` — the species pool a wild, trainer or boss roster draws from, and the variant roll (`D38`/`D39`).
- `pool.test.ts` — the legendary exclusion, the BST windows and the variant formes.
- `starters.ts` — the starter pool the first screen rolls.
- `starters.test.ts` — the distinct base forms with two evolutions ahead.
- `share.ts` — the run share string: seed and mode, round-tripping totally (`D21`).
- `share.test.ts` — every encode/decode case, spaces and non-ASCII seeds included.
- `party.ts` — the party predicates a room asks: its types, moves and abilities (`D47`).
- `party.test.ts` — each predicate against a party that holds and one that does not.
- `reward.ts` — the Poké Dollars a beaten trainer or boss drops (`D33`).
- `reward.test.ts` — the band scale, the boss multiplier and the deterministic jitter.
- `items.ts` — the route consumable rule: whether an item applies and the use that spends it.
- `items.test.ts` — every item kind, the candy treats and the refused use.
- `learnset.ts` — the learnset panel's model: level-up moves, tutored moves and TMs in the bag.
- `learnset.test.ts` — the sources, the four slots and the equip that swaps.
- `memberEdits.ts` — the member-edit NPCs: the tutor, the four re-rolls and the sacrifice.
- `memberEdits.test.ts` — each transaction, its price and its draw off the run seed.
- `modifiers.ts` — the facts the special NPCs leave behind: the curse, the forced sky and the narrowed wild type.
- `modifiers.test.ts` — the empty record, the decay and every refusal.
- `missions.ts` — the floor mission, its progress and the table it is drawn from.
- `missions.test.ts` — the draw per floor, the met predicate and each mission's progress.
- `nickname.ts` — the names the player types: the sanitiser and the rename.
- `nickname.test.ts` — the length, the trim and the refused rename.
- `passives.ts` — the map passives a room's abilities pay.
- `passives.test.ts` — each trigger, its marks and the run it edits.
- `trade.ts` — the deliberate trade: one member out, one rolled member in at the squad's level.
- `trade.test.ts` — the eligibility, the roll and the member the trade leaves behind.
- `history.ts` — the record of the last finished runs: seed, mode, reach, catches, casualties, playtime and per-species KOs and damage (`Task-152`).
- `history.test.ts` — the 50-run cap, the pure record builder and its species rows.
- `dark.ts` — the dark Pokémon: the catch's own roll and the member it turns `Dark Matter`-first (`Task-154`).
- `dark.test.ts` — the roll's share over 10 000 catches, its pinned seeds and the member it rewrites.
- `curve.test.ts` — the route-curve regression: the XP a floor's award pays, checked against the floor chain.
- `README.md` — this map.

## Rules

1. No Phaser import, no DOM, no `localStorage` and no clock; a rule that needs any of them
   belongs in `src/scenes/` or `src/render/`.
2. Every random draw comes from a named stream off the run seed, minted inside the function
   that draws, so one seed and the same inputs replay the same run (`D11`).
3. A run carries the dead with it (D5): nothing here heals, revives or restores a lost member.
4. Adding a module means adding its line here.

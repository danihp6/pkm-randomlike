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
6. Every line the turn prints is a **keyed log event**, never a sentence:
   `{ kind: 'text'; key; params? }` names a `battle.log.*` key of the source table and
   the values it interpolates, and `src/ui/feed.ts` (`battleMessage`) resolves the key
   in the current locale when it builds the frame the scene prints. The engine stays
   language-free and a fixed seed logs the same keys in every language; the only params
   a table owns are `move`, `ability` and `item`, and every other one is inserted
   verbatim (`D43`, amended).

## 2. The four commands

| Command | Rule |
| --- | --- |
| **Fight** | Pick one of the active Pokémon's moves. PP is spent. No PP = Struggle. |
| **Bag** | Use an item on the active Pokémon (or, where legal, a chosen one). Consumes the item. Trainer battles allow items. The Bag carries balls, heals and status cures; there is no X-item and no `'boost'` item kind (the four commands and the route's drag path in `src/engine/run/items.ts` are the only ways an item is spent). |
| **Pokémon** | Swap the active Pokémon for another in the party; costs the turn. |
| **Run** | Wild battles only. Seeded roll against the classic odds; trainer battles refuse. A wild whose launch carries `noFlee` refuses too, and its row draws disabled. |

The **no-heal room** (`docs/maps-spec.md` §7) narrows the first two rows **for the
player only**: the **Bag** is refused (`No items can be used in this room.`, its row
drawn disabled) and the moves in `BARRED_HEALING_MOVES` (`src/data/noHeal.ts`) are
refused with `That move cannot be used in this room.` while at least one other move
is legal; when a barred move is the fighter's only PP-legal move the command
validates and resolves as **Struggle**, exactly the "No PP" fallback above. The
enemy's side, its AI, its own healing moves, the abilities, the held items, the
residual heals and every other command are untouched, and the gate rejects before
any roll, so the battle RNG does not move.

The **banned-species room** (`docs/maps-spec.md` §7) narrows the **Pokémon** row
**for the player only**: the launch carries `bannedSpecies` — the species of the
run's most-used party member, read by `bannedSpeciesOf` (`src/engine/routes/bannedRoom.ts`)
off each member's `battlesUsed` counter — into `BattleSetup` and `BattleState`. The
battle opens on the first **living** member the ban does not name (a barred lead is
replaced before the start hooks run, in a double battle the second active too), a
switch to the barred species is refused with `That Pokémon is barred in this room.`
and its party row is drawn disabled, and `switchablePartyIndices` omits it. Two clauses bend the rule: when the barred species is the **only** living off-field
member it is switchable again, because a battle must always have a legal send-out,
and the enemy side is never filtered. The rule ends with the battle — the run's
party, box and RIP are never touched — it draws **no RNG at all**, and the battle
books every fighter it fielded in `BattleState.usedFighterIds`, which the post-battle
fold reads to bump `battlesUsed`.

The berry tree's guardian rides the launch as `noFlee` (`BattleLaunch` →
`BattleSetup` → `BattleState`), `canRun`/`rollRun` refuse it, and the **only** two
exceptions are the `onTryEscape` hooks — the **Run Away** ability and a **`flee`**
held item (the Smoke Ball) — in which case the escape is certain and skips the odds
draw, so no existing seed moves and no attempt is recorded; a trainer battle is
refused before any hook.

A **route-only** item — a coloured candy or a route consumable (`routeEffect`,
`docs/data-spec.md` §3) — is refused from the Bag with `Only usable on the route.`
and its row is drawn disabled: those items are spent by the route's own drop path
(`useItemOn`), never in a battle, and the gate rejects before any roll, so no RNG
moves either.

## 3. Damage and stats

- Stats at level with natures, IVs and EVs computed exactly once per Pokémon
  (Showdown's `Nature`/`Stat` data), cached on the battle fighter.
- The stat formula also adds the member's permanent **treats** — a candy's ±1, read
  through `statAtLevel`'s sixth parameter and floored at 1 — so the party panel, the
  battle and a level-up all show the same treated number.
- Damage follows the Gen 9 formula, including STAB, type effectiveness, critical
  hits, the 85–100% roll on the seeded battle RNG, weather and burn modifiers.
- **Screens** halve damage while they last: Reflect the physical, Light Screen the
  special, Aurora Veil both (and only while it is snowing). **Wonder Room** swaps
  the defensive stat a hit reads; **Magic Room** switches held items off for its
  duration.
- Type effectiveness comes from the generated 18x18 chart, not a hand-written
  table.

### 3.1 The number the formula multiplies

The formula multiplies a **power**, and for most moves that power is the dex
`basePower`. A damaging move whose amount the dex cannot express is owned by
`src/engine/battle/damage.ts` instead: `DAMAGE_RESOLVERS` names every one of them,
and the two resolvers decide which half of the rule it is.

- `fixedDamage` returns the whole amount and the formula is bypassed: no weather,
  terrain, aura, screen, crit, 85–100% roll, STAB, type chart or burn term touches
  it. The hit still runs through Endure, Substitute, `applyDamage` and the faint
  path, so a fixed amount can be absorbed, survived at 1 HP or score a KO like any
  other. `computeDamage` reports such a hit as `effectiveness: 1`, `crit: false`
  and `stab: false`, and the turn loop skips the crit roll outright rather than
  rolling one it would throw away. `estimateDamage` and the FIGHT preview pass
  `rng: null` and read the same amount, drawing nothing.
- `resolveBasePower` computes the power the formula multiplies from scratch. It
  also carries the moves whose power still derives from the dex number but is
  **multiplied** by a condition — Eruption, Hex, Facade, the weight- and
  HP-relative powers and the rest of `3.3` — which is why their ledger note stays
  `data: basePower` while their real power comes from this resolver. Rage Fist is
  the one `3.3` member that does not derive from its dex number at all: the
  resolver computes the number outright, so the ledger records it as
  `damage: damage.ts`.

The fixed amounts (`'fixed'`):

| Move | Amount |
| --- | --- |
| Seismic Toss, Night Shade | the user's level |
| Dragon Rage | 40 |
| Sonic Boom | 20 |
| Super Fang, Nature's Madness, Ruination | `max(1, floor(target HP / 2))` |
| Endeavor | `max(0, target HP − user HP)`; at equal HP the move fails with `But it failed!` |
| Final Gambit | the user's whole HP; its user's faint still comes from the move's own `selfdestruct` data |
| Psywave | `max(1, floor(level × roll(5..15) / 10))` |
| Fissure, Guillotine, Horn Drill, Sheer Cold | the OHKO rule below |
| Sheer Cold against an Ice-type | 0 |

**The OHKO rule.** The accuracy roll comes first, like any other move. Then, if
the user is at a lower level than the target the move fails and nothing else is
rolled. Otherwise one `rng.int(1, 100)` decides it, and the move lands when the
roll is at most `min(100, 30 + user level − target level)`: a landed OHKO deals the
target's whole remaining HP. The deterministic estimate (`rng: null`) is a straight
KO for an equal-or-higher level user and 0 for a lower one.

The resolved powers (`'power'`):

| Move | Power |
| --- | --- |
| Beat Up | `10 + floor(base Attack / 10)` |
| Crush Grip, Wring Out | `max(1, floor(120 × target HP / target max HP))` |
| Hard Press | `max(1, floor(100 × target HP / target max HP))` |
| Flail, Reversal | the user's HP ratio: above 0.6875 → 20, 0.5417 → 40, 0.3542 → 80, 0.2083 → 100, else 150 |
| Electro Ball | user Speed against the target's: ≥4× → 150, ≥3× → 120, ≥2× → 80, greater → 60, else 40 |
| Gyro Ball | `min(150, floor(25 × target Speed / user Speed) + 1)` |
| Low Kick, Grass Knot | the target's weight: ≥200 kg → 120, 100 → 100, 50 → 80, 25 → 60, 10 → 40, else 20 |
| Heat Crash, Heavy Slam | the two weights' ratio: ≥5 → 120, ≥4 → 100, ≥3 → 80, ≥2 → 60, else 40 |
| Return, Frustration | 102 |
| Present | the dex power when the turn loop has rolled one, else 40 |
| Spit Up | `100 × stockpile charges` |
| Rage Fist | `min(350, 50 + 50 × hits taken)`; the count is capped at six, so 50 at none and 350 from the sixth |

**Triple Kick and Triple Axel ramp per hit.** Both keep their dex `basePower` and the
hit loop multiplies it by `hit + 1` on the 0-based hit index, so Triple Kick pays
10/20/30 and Triple Axel 20/40/60. The multiply lives in the loop rather than in
`resolveBasePower` because it depends on which hit of the sequence is being paid, so
the ledger keeps both moves' note at `data: multihit`.

A weight comes from `getSpecies(id).weightkg` and a missing species weighs 0.

### 3.2 Beat Up, Spit Up and Pain Split

- **Beat Up** hits once per healthy party member that carries no primary status,
  at least once. Every hit reads the **user's** base Attack: the reference reads
  each member's own base Attack, and the engine keeps no per-member attack seam
  for a move, so that one difference is deliberate.
- **Spit Up** with no Stockpile charge fails with `But it failed!` before any roll;
  after a landed hit it spends every charge. The Stockpile charges themselves are
  not modelled on Spit Up's behalf — the Defence and Sp. Def stages Stockpile also
  raises are the reference's other half and stay where they are.
- **Pain Split** moves both fighters to the average of the two HP pools, the user
  first: a `heal` for the one below it and a `damage` for the one above it.

### 3.3 The conditional multipliers and the stat swaps

These moves keep their dex `basePower` and have it multiplied instead of computed
from nothing: Eruption, Water Spout and Dragon Energy scale with the user's HP (a
150-power move at full HP); Stored Power and Power Trip add 20 for every positive
stage the user carries; Last Respects adds 50 per fainted party member; Hex,
Venoshock and Brine double against a status, a poison and a target at half HP or
less; Facade doubles while its user carries a status (the burn's ×0.5 still
applies, exactly as the formula does); Payback, Avalanche, Revenge, Bolt Beak and
Fishious Rend read whether the target has already moved this turn or the user has
already been hit; and Expanding Force, Rising Voltage, Grassy Glide and Psyblade
read the terrain. Their ledger note is `data: basePower` because their power still
comes from that number, and `damage.test.ts` is their evidence.

**Rage Fist** is the member whose power is not its dex number multiplied but
recomputed from it: `50 + 50 × hits`, where `hits` is how many hits its user has
taken since it last switched in, capped at six. So a clean switch-in hits at 50,
two hits make it 150, and from the sixth hit on it takes the 350 cap. A hit counts
once per **hit**, not per move — a ten-hit move is ten hits, capped the same — and
whatever the category; only a hit the fighter itself took raises the count, so a
hit a **Substitute** absorbs and a hit that deals 0 damage do not. The count lives
in `Volatiles.timesHit` (`src/engine/battle/fighter.ts`), which is why it survives
the whole stay on the field — it is not cleared at the start of a turn, unlike the
Counter/Mirror Coat pair — and resets on switch-out, because `clearVolatiles`
builds a fresh object. `resolveBasePower` owns the number, `DAMAGE_RESOLVERS` names
`ragefist`, and the ledger therefore records it as `damage: damage.ts`; the FIGHT
menu's `power` is the same number the hit will use, while its `basePower` stays the
dex 50.

Two moves swap the stat the hit reads, through one helper that the battle and the
AI share so they cannot disagree: **Body Press** is physical and reads the user's
Defense (with its own stage and the attack aura), and **Foul Play** is physical and
reads the **target's** Attack through the target's stages.

One move **fails** on its own terms rather than scaling: **Upper Hand** only lands
on a target that is already winding up. The turn loop hands both sides' commands to
the effect context (`EffectContext.commands`), and the conditional-fail table
(`CONDITIONAL_FAILS` in `src/engine/battle/effects/moves.ts`) reads the foe's own
pick: it must be a damaging move whose effective priority — after
`runModifyPriority`, so Prankster and Gale Wings count — is above zero. A foe on
Tackle, a Bag item, a switch or a run makes it `But it failed!` before anything is
aimed, with the PP already spent and no damage dealt; the 100% flinch stays the
move's own `secondaries` on a hit. The read is a command lookup, never a roll, so a
seed keeps its turn.

### 3.4 Determinism and the ledger

Three members draw and nothing else does: **Psywave** rolls its 5..15 multiplier
inside `fixedDamage`; **Present** rolls its heal-or-bullet once in the turn loop,
after the accuracy roll; and the four **OHKO** moves roll their success inside
`fixedDamage` after the accuracy roll. Every other fixed or resolved move draws
nothing, and `estimateDamage`/`movePreview` draw nothing because they pass
`rng: null`; the AI and the FIGHT menu therefore show the same number the battle
will multiply.

**Population Bomb, Triple Kick and Triple Axel roll accuracy on every hit.** The
aim-level roll covers the first hit, so the hit loop rolls `rollHitWith` again before
every hit **after** it and ends the move on the first miss with exactly one
`battle.log.missed` line: Population Bomb's ten hits are ten 90 % rolls and Triple
Kick's three are three, not one. Each of those rolls is one `Rng.next()`, and only
while the chance is below 1 — No Guard and the `sure` flag (Lock-On, Mind Reader,
Telekinesis) guarantee every hit of the sequence and draw nothing. A target that
faints or loses its Substitute stops the sequence without a further roll, and Skill
Link forces the **count** only, never the rolls. The reference's clause that
`multiaccuracy` ignores the accuracy/evasion stages is **not** modelled: the per-hit
roll is the same `rollHitWith` the first hit makes. The probe sees both halves
through `MoveProbe.damageAmounts`, so a flat sequence from a ramped move and a
single-hit sequence from a ten-hit move both fail a row.

`npm run docs:coverage` records these moves as `damage: damage.ts` — the engine's
own table is the evidence, since no dex field holds the amount. Three relatives
stay **excluded** rather than claiming a port they do not have: **Fling** needs the
held item's fling power, which `DexItem` does not expose; **Bide** needs a two-turn
damage accumulator no fighter carries; and **Spotlight** needs a redirection
mechanic the engine does not model at all (Follow Me and Rage Powder are out for
the same reason). Three more keep their plain dex power because the trigger they
would read is not recorded anywhere in the battle state: **Retaliate** (an ally
fainted last turn), **Round** (an ally's Round this turn) and **Echoed Voice** (a
consecutive-use streak). Each needs a new field in `fighter.ts`/`state.ts`, which
is a task of its own. Rage Fist has left that list: `Volatiles.timesHit` now records
the hits its user has taken, so the move is resolved rather than plain (§3.3).

## 4. Status and volatility

Primary status: burn, poison, badly poisoned, paralysis, sleep, freeze.
Volatiles: confusion, flinch, Leech Seed, Substitute, trapped, Taunt, Encore,
perish count, protection (Protect and friends), charge state (a two-turn move
waiting to fire) and the semi-invulnerable flag that charge hides behind, Yawn
countdown, stat stages (−6..+6). Effects live in
`src/engine/battle/effects/` and follow Showdown's semantics, ported category by
category (see `docs/showdown-reuse.md` for the coverage table).

The later ports add volatiles a single battle can honour: Aqua Ring and Ingrain
(residual healing, Ingrain also rooting the holder), Curse, Destiny Bond, Grudge,
Focus Energy, Laser Focus, Dragon Cheer, Endure, Imprison, Magic Coat, Snatch,
Magnet Rise, Power Trick and the Stockpile counter (spent by Swallow).

The **status half of the move audit** filled in every move whose effect is a
write to a field the battle already reads, so `X used Attract!` now changes
something. Infatuation (Attract, refused between two same-gender or genderless
fighters), the move lock (Disable's `disabledMove` for four turns, Torment's
repeat bar, Encore, Imprison), the residual volatiles (Nightmare's quarter while
the holder sleeps, Octolock's Defense and Sp. Def drop, Aqua Ring, Curse),
trapping and grounding (Spider Web, Octolock, No Retreat, Telekinesis floating
its target out of the ground, Smack Down's `grounded`), the accuracy locks
(Lock-On and Mind Reader, spent by the next damaging move), the type and
identity writes (Soak, Reflect Type, Magic Powder, Forest's Curse and
Trick-or-Treat — all undone when the holder leaves the field), the ability
writes (Simple Beam, Worry Seed, Gastro Acid, Entrainment, Skill Swap), the stat
and Speed exchanges (Heart Swap, Power Swap, Guard Swap, Speed Swap, Power
Split, Guard Split, Psych Up), the heals aimed at the foe (Heal Pulse, Floral
Healing, Purify, Strength Sap), Psycho Shift's status transfer, the turn and
priority control (Instruct repeats the target's last move, Quash pins it to the
back of the order, Electrify retypes its next move), the item writes (Trick,
Switcheroo, Embargo) and the move and PP writes (Mimic, Spite). Each rule is a
handler in `src/engine/battle/effects/moves.ts` or a case of
`applyVolatileEffect` in `src/engine/battle/turn.ts`, and every row is pinned in
`src/engine/battle/moveAudit.ts`.

The ten **binding moves** — Sand Tomb, Fire Spin, Whirlpool, Wrap, Bind,
Infestation, Magma Storm, Thunder Cage, Snap Trap and Clamp — write
`volatiles.partiallyTrapped`, a `{ turns, moveId }` record rather than a bare
`trapped`. The duration is **4-5** turns drawn from `state.rng` at the moment the
move lands — one draw, made after that move's accuracy roll and its damage
secondary rolls and before the rest of the turn draws anything — and a second
binding move replaces the record instead of stacking. From the following turn on,
each residual pass pays **1/8** of the victim's max HP, or **1/6** through a held
**Binding Band** (`onModifyTrapDamage`, `src/engine/battle/effects/registry.ts`);
the trap sits in the end-of-turn order **after** the ability and item residuals and
**before** Yawn, never on the landing turn. When the counter reaches zero it clears
and releases `trapped`, unless Octolock or No Retreat still holds the holder.
`trapped` is set for as long as the trap runs, so `isTrapped` and the AI's switch
rules keep working — except that a **Ghost** is immune to the binding's switch
block, though it still takes the damage, while the two self-inflicted traps keep
their Ghost. Because a write is not a behaviour, `MOVE_AUDIT_ROWS` carries a
`residual` expectation for every move that sets a volatile in
`RESIDUAL_VOLATILES` (`src/engine/battle/volatile.ts`): `probeResidual` runs the
audited move and then one full turn, so a handler that exists but does nothing on
the following turn can no longer pass as `port`, and the coverage table reads that
same list as `data: residual`.

An ally-aimed move never lands on the foe: a single battle fields no partner, so
Aromatic Mist, Coaching and Dragon Cheer fail, while Howl (whose target is "all
allies") raises the user's own Attack. Three of the writes above are still
write-only — Gastro Acid's and Embargo's suppression and Foresight's
identification need the readers in `effects/registry.ts` and `accuracy.ts`, which
a later port owns; the volatile itself is written, and ticked where the reference
times it, today.

Side and field conditions live on the battle state, not on a Pokémon:
**Reflect**, **Light Screen**, **Aurora Veil**, **Tailwind**, **Lucky Chant**,
**Mist** and **Safeguard** on a side; **Trick Room**, **Gravity**, **Magic
Room**, **Wonder Room**, **Fairy Lock**, **Mud Sport** and **Water Sport** on the
field. Each carries a turn count ticked in the residual pass
(`src/engine/battle/effects/conditions.ts`).

A battle can also **begin** under a condition the room it started in carries
(`docs/maps-spec.md` §6/§7, `ROOM_BATTLEFIELDS` in `src/data/battlefields.ts`).
`createBattle` seeds the weather, the terrain and the
field conditions (and fog, below) from its own setup, at each rule's canonical
duration — `WEATHER_TURNS`, `TERRAIN_TURNS`, `FIELD_CONDITION_TURNS` — so the
battle's own counters are the only writers afterwards. A setup that names **none**
of them produces exactly the pre-seeding state, so every other launch is untouched.
The **boss room** always begins under one of the two openings of `BOSS_OPENINGS`
(`docs/maps-spec.md` §6): its arena row seeds the condition like any other, and the
row's `boosts` land on the enemy's **lead** alone, through
`BattleSetup.enemyBoosts`.

**Dense fog** is one such condition, and a **field condition, never a weather**: it
never enters `weatherModifier` (`src/engine/battle/damage.ts`) or `weatherChip`
(`src/engine/battle/effects/weather.ts`). While `state.fog` is set, every move loses
**20** (`FOG_ACCURACY_PENALTY`) of its **own** accuracy, before the net
accuracy/evasion stage multiplier, clamped at 0 — so a move printed at 20 or less
cannot hit at all — and a move that **cannot miss** is unaffected. No move sets it
and it carries no turn count.

The room table's other six whole-field conditions seed `state.roomField` through
`createBattle`'s setup, last the **whole battle**, carry no turn count and draw
**no** RNG:

- **Radiant zone**: no ability handler runs for either side — the dispatcher
  (`abilityActive` in `src/engine/battle/effects/registry.ts`) answers false before
  the Neutralizing Gas check — while held items, moves and the weather/terrain
  handlers keep working.
- **Dark Aura** / **Fairy Aura**: Dark / Fairy moves deal **×1.33** on both sides,
  applied after the weather and terrain multipliers.
- **All-types change**: every fighter's types become one type
  (`ALL_TYPES_OVERRIDE`, today `Normal`); STAB and the type chart both read the
  override, and the run's member keeps its species types after the battle.
- **Endure**: the first lethal hit a fighter takes **at full HP** leaves it at
  exactly **1 HP**, once per stay on the field, on both sides. The fighter is then
  spent: the next lethal hit faints it (at 1 HP it is already below `maxHp`), and a
  switch out and back re-arms the spare. The move `Endure` and Sturdy keep their
  own rules.
- **+1 crit stage** (`ROOM_CRIT_STAGE`): added to every move's crit ratio before
  the roll, so the base 1/24 step becomes 1/8.

The room rules are deliberately outside `estimateDamage`, whose preview ignores
weather and terrain for the same reason: it is the AI's deterministic comparison,
never a roll.

Two facts a **special NPC** can leave on the run ride into the battle start
(`docs/maps-spec.md` §7). A **forced field** the run carries (`RunState.modifiers`)
replaces the room's rolled condition and spends one floor per `advanceMap`, so the
same sky covers the floors it still has. The **curse** is one Attack stage down on
the enemy's lead (`BattleSetup.enemyBoosts`, applied once after the fighters exist
and with no event logged) and is spent by the battle it starts.

Special move shapes:

- **Two-turn charge moves** (Solar Beam, Fly, Dig...) lock the user for one
  turn; the next turn the move fires regardless of the chosen command, so the
  screen never asks for that second command at all (`chargingCommand` in
  `src/engine/battle/commands.ts` answers the locked `fight` command itself, and
  a double battle keeps asking). Solar Beam and Solar Blade skip the charge in
  harsh sunlight.
- **Semi-invulnerability**: six of those charges take the user off the field for
  the charge turn — Dig, Dive, Fly, Bounce, Phantom Force and Shadow Force
  (`SEMI_INVULNERABLE_CHARGES`). `volatiles.semiInvulnerable` holds the same move
  id as `volatiles.charging`, written in the same two statements, and stays
  `null` for a charge that does not hide (Solar Beam, Solar Blade, Meteor Beam,
  Electro Shot, Sky Attack, Freeze Shock, Ice Burn, Razor Wind). A move aimed at
  a hiding fighter **misses before its accuracy roll** (`semiInvulnerableOutcome`
  in `src/engine/battle/volatile.ts`), so the dodge draws **no** RNG and cannot
  move a fixed-seed log, and it prints the shipped `battle.log.missed` line; a
  self-aimed move is never dodged by its own user. The four counters the
  cartridge gives it — Earthquake and Magnitude against Dig, Gust and Twister
  against Fly and Bounce (`SEMI_INVULNERABLE_COUNTERS`) — connect instead for
  **×2** damage (`SEMI_INVULNERABLE_COUNTER_MULTIPLIER`), every hit included;
  Dive, Phantom Force and Shadow Force have no counter, No Guard and Lock-On do
  not beat it, and the AI still scores a hiding target as reachable.
- **Damage counters** (Counter, Mirror Coat, Metal Burst, Comeuppance) pay back
  the damage taken earlier in the turn: 2x the physical/special damage for the
  first pair, 1.5x the total for the second. They fail with no damage banked.
- **Self-switch moves** (U-turn, Volt Switch, Flip Turn, Parting Shot, Teleport,
  Baton Pass) deal their effect and then require a replacement; Baton Pass copies
  the user's stat stages to the incoming Pokémon.
- **Item-driven retypes**: a held **Plate**, **Memory**, **Drive** or berry
  rewrites the one move that belongs to it — Judgment, Multi-Attack, Techno Blast
  and Natural Gift. Natural Gift takes its type and base power from the berry's
  dex `naturalGift` pair and spends the berry once the move has resolved
  (`src/engine/battle/effects/items.ts`); the party panel reads the same pair for
  the number through `effectiveMovePower` (`src/engine/battle/movePower.ts`), the
  power-side twin of `effectiveMoveType`, so a berry holder's MOVES row prints the
  berry's power instead of the dex `0`.

A replacement the player owes owns the screen's menus: while the lead has fainted
with a healthy reserve left, the **switch grid is the only menu a back press can
reach**. Esc and the ◀ control both route there, and `openMenu` returns to it
*before* it builds a command grid, so the FIGHT that `validateCommand` would refuse
("A replacement must be sent out first.") is never selectable in the first place.
The rule reads one predicate, `replacementOwed` in
`src/engine/battle/commands.ts`, over `state.sides.player.awaitingReplacement`.

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
- A held item the battle **consumed** comes back with the run member after the
  battle: the post-battle fold (`adoptBattleParty`) keeps the run member's
  `heldItem` when the returned snapshot carries none, so held items are **infinite
  across battles** while still firing once per battle (a berry is spent in the
  battle's own state, not in the run). Permadeath is untouched — a fainted member
  is still released, item and all.

## 6. Capture

One capture attempt per room: the room's window closes the moment its **first
wild battle** starts, whatever the outcome (the run tracks the rooms that spent
theirs, `RunState.capturedRooms`, not a per-battle counter).

1. Only wild battles can be captured, and only while the wild Pokémon is
   weakened.
2. The catch chance is the classic Gen 9 formula (ball bonus, catch rate, HP
   ratio, status bonus, level). The catch rate comes from the dex
   (`catchRateOf`, sourced from PokeAPI) and the ball bonus from
   `src/data/items.ts`. **The run's first catch is certain**: while the run has
   caught nothing (`RunState.stats.catches === 0`), the capture's catch **value**
   is the flat 255 that `attemptCapture` already treats as an outright success
   (`FIRST_CATCH_VALUE`, `catchValueFor`), so neither the species' rate, the
   target's HP, the ball nor the status can make the run's first catch fail. The
   moment it lands, the flag is false and the next wild is back to its own rate.
3. A failed throw consumes the ball and the wild Pokémon keeps fighting; there is
   no re-throw penalty beyond the ball cost.
4. A successful catch adds the Pokémon to the party, or to the PC box if the
   party is full.
5. The beat is **one clock**: `captureTimeline` in `src/ui/capture.ts` drives both
   the ball's tweens and the message box, so the ball wobbles exactly the number of
   times the roll produced — a zero-shake break plays none, and a failed attempt
   opens the ball at the break tick while a catch settles it on the field. The wait
   line (`battle.log.captureWait`, set rather than typed) gains one dot per completed
   wobble, capped at three, and the frame's dwell is the timeline's `totalMs` plus
   the shipped message hold, so no text ever outruns the ball.

## 7. Progression inside the battle

- The **party and the PC share one level and one XP bar** (D35): the XP a battle
  awards fills the squad's single bar, and every member levels with it, learning
  the moves the learnset says at that level. Levelling never evolves a member.
  A crossed move is **not equipped for you**: `levelUpPokemon` leaves the member's
  four slots exactly as they were, never forgets a move, and reports each crossed
  move as a `learn` event, so the move waits in the **learnset band** of the MOVES
  tab (`docs/design-spec.md` §5) until the player drags it onto a slot — the band is
  the only way into a slot. The level-up modal still announces it ("X learned Y!").
  A No Guard holder is never offered an OHKO move by the band either (D17).
- A **tutored** move is a pool entry like a level-up one: it sits in the band tagged
  `Tutor`, is equipped through the same drop, and an unequip puts it back. A member's
  **second ability** — the one a sacrifice grants — is what the run's ability readers
  see: `partyHasAbility`, `runPassives` and the band's No Guard guard all ask
  `memberAbilities`, which answers the primary first and the second one after it,
  while the battle's own dispatch reads both slots through `hasAbility` and
  `ownedEffects`, so the second ability works in battle too (D48).
- A **dark** member (`RunPokemon.dark`, `Task-154`) is born at the catch: one in twenty
  caught wilds (`DARK_CHANCE`, `src/data/run.ts`) comes back dark, its
  `fighter.ability` rewritten to **Dark Matter** and the ability the wild had rolled
  moved into the second slot (`fighter.secondAbility` on the snapshot and
  `secondAbility` on the run member alike), so `hasAbility`/`ownedEffects` field it
  beside the primary exactly like a sacrifice's grant. The roll is `isDarkCatch`'s own
  stream, minted from `(seed, mapIndex, routeInMap, catchId)` at the catch, so it
  advances no other draw and a replay answers the same; `asDark` reads no RNG and is
  applied **after** the catch is adopted at the squad's level, so the level rebuild
  cannot drop the slots it writes.
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
  level instead. A **trainer** award is also multiplied by the floor's own
  `trainerXpMultiplierForMap` (`src/data/run.ts`), so 75 % of a floor's trainers
  pays that floor's cap (`docs/balance/route-curve.md`); a wild award is not. The
  bar lives on the run (`RunState.xp`), not on a member, and
  the award is not split by party size (the squad is one unit). The whole
  progression is RNG-free (D11).
- Trainer rosters are generated at the route's level band, never above the cap,
  with two exceptions the floor injects on top of the route: the **boss** fields
  a fixed six (three on map 1) at the map's `maxLevel`, and the **mini-boss** a
  fixed three (two on map 1) at band levels (`src/data/bosses.ts`,
  `bossPartySize`; `docs/maps-spec.md` §6/§7), and the foe's HP card draws one
  ball per **fielded** member (a fainted one included), so the row counts the
  party the trainer fielded.

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
- An archetype's **`forcedAbility`** is the **starting** ability of every member
  of its roster and is decided **before** the run's `randomAbility` roll, which is
  then skipped: no draw moves anywhere else, because that roll is a per-species
  hash (`D17`), not a sequential stream. A Mega Evolution still replaces it,
  because `changeBattleForm` swaps the forme's own ability. None of the three
  set-piece trainers carries a Mega Stone (`carriesMega` stays absent), so
  `allowMega` remains with the bosses, the mini-bosses and the `ace` archetype.
- The Mega forme swaps the fighter's **stats, types and ability** for the rest of
  the battle and never changes the held item, the moves, the HP fraction or the
  **nickname** (which lives beside `name`, §7). The
  formes come from `dex/megas.json` (generated beside `species.json`, D34); a
  snapshot after the battle stores the base species again.
- Evolution is not Mega Evolution: a run member's level evolution still happens
  outside battle (`docs/routes-spec.md` §5) and is unrelated to this.
- The set is **every** dex Mega, nonstandard formes included: **89** formes in
  `src/data/dex/megas.json`, generated beside `species.json` (`D34`), each with
  its own stone in `src/data/items.ts`; the 89th is **hand-authored** — Greninja's
  **Ash** forme, which `@pkmn/dex` marks `battleOnly: "Greninja-Bond"` with
  `isMega` unset, so `scripts/build-dex.mjs` writes the row (and the
  `Greninjite Ash` stone it needs) itself, and `isPlayable` keeps the id out of
  `species.json`. **`Battle Bond`** was deleted (`D41`), so Ash is entered the way
  every other forme is: from its stone. Gigantamax is a **separate mechanic**
  (`D44`, §10): its formes have a **stone of their own**, one per forme, and no
  Mega Stone ever arms one.
- The STATS tab lists each Mega of a species of the member's family that has one
  as an **information row** under its family graph, hanging off that species' own
  row: the forme's sprite and name, dimmed and at the same indent as an evolution,
  plus the stone it needs (`Mega Charizard X · Mega Evolves with Charizardite X`).
  **One row per Mega**, so Charizard shows X and Y side by side. It is drawn
  whether or not the stone is held — it is information, not a readiness state —
  and it is **never clickable**: it carries no `ready` node, so neither a click
  nor the pointer cursor reaches it. The Gigantamax sibling row has the same shape
  and reads `Gigantamax Charizard · Charizardite G`, because a
  Gigantamax needs its own stone, one per forme (`D44`, §10).
- A held **Tera Crystal** (`teraType`, `docs/data-spec.md` §3) replaces the holder's
  types at battle start and on every switch-in (`onStart`), so the holder fights as
  that single type. Because a Mega re-runs the start hooks after the forme change,
  the crystal's type stands over the forme's own — the crystal wins,
  deterministically, and a switch-out/switch-in repeats it. The party detail reads
  the same item rule (`teraTypeOf`), so the STATS tab and the battle agree, and a
  type-gated room still opens on the **species** the run carries
  (`src/engine/run/party.ts` is untouched).

## 10. Gigantamax

A Pokémon **that holds the G-Max Stone of its own species** may Gigantamax **once
per battle** (`D44`); no archetype flag is involved, and the **stone is never
spent** on use, so the holder keeps it and may Gigantamax again next battle.

- The control is a **G-MAX** button in the moves window, in the slot immediately
  inside the MEGA one, offered only while the active Pokémon **holds the G-Max
  Stone of its own species** (`gmaxMatchesSpecies`, `src/engine/battle/gmax.ts`) and
  it has not Gigantamaxed yet. Confirming it **arms** the forme and
  the next FIGHT spends it (the Pokémon still attacks that turn); arming one forme
  disarms the other, and picking BAG, SWITCH or RUN drops the armed forme. The
  engine half is `src/engine/battle/gmax.ts`; the command carries a `gmax` flag on
  `FightCommand`.
- The held item is the **whole gate**: a G-Max Stone is a `held` catalogue row, so
  the Pokémon must keep it, and one item cannot arm both a Mega and a Gigantamax —
  the stone that forms a Mega is not the stone that forms the G-Max.
- It resolves **at the top of the turn, before any move**, beside the Mega loop, so
  the turn's order and damage read the Gigantamaxed fighter.
- The forme takes the G-Max **name and sprite** and keeps the fighter's **stats,
  types, ability, moves and held item** (the stone included); the **HP pool doubles**
  (`× 2`, the current HP included, so the HP fraction holds). The ability never
  changes, so unlike a Mega no on-switch-in effect fires.
- Both the player and the AI can Gigantamax. The AI spends its stone on the first
  fight command it can, exactly as it spends a Mega Stone.
- It lasts the whole battle (a **switch-out does not end it**) and **reverts at the
  battle's end**, before the run snapshot: the route HUD, the PC box and a captured
  wild keep the **base** species and the normal, undoubled HP maximum.
- Gigantamax and Mega Evolution are **mutually exclusive per Pokémon per battle**:
  a fighter that Gigantamaxed cannot Mega Evolve, and vice versa.
- The formes come from `src/data/dex/gmaxes.json` (generated beside `megas.json`,
  `D44`) — **34** today, `meta.json`'s `counts.gmaxes` being the authority, and one
  per species (`gmaxFormForBase(id)`); each row carries the `stoneId`/`stoneName` of
  its own stone, minted into the catalogue at 8 000 and reachable from the Mart
  (`late`/`end`) and the ground (`late` 4 / `end` 6). **Max / G-Max moves are not
  modelled** (`D42`): a Gigantamaxed Pokémon uses its normal moves, with no damage
  bonus and no Dynamax timer. `Eternatus-Eternamax` is **not** a Gigantamax forme, so
  Eternatus cannot Gigantamax.

## 11. The enemy AI

The enemy thinks with the cartridge's own **AI script flags**, read as data off the
trainer archetype (`TrainerArchetype.aiFlags`, `D46`), and scores each legal move by
expected value. The engine half is `src/engine/battle/ai.ts`
(`chooseAiCommand(state, side, options?)`).

- **The flags** are six, and they are data: `checkBadMove`, `tryToFaint`,
  `checkViability`, `setupFirstTurn`, `risky`, `preferBatonPass`. An archetype
  carries the set its class thinks with, and the ladder runs from the early
  `youngster` / `lass` / `bugcatcher` (a single `checkBadMove`) through the middle
  classes (`checkViability`: heal and use the status moves) to `psychic`
  (`tryToFaint`), `blackbelt` (`risky`) and `ace` (all six). A **wild Pokémon is not
  a trainer**: at the default difficulty it picks a random move that still has PP,
  the cartridge's own rule, so a wild never out-thinks an Ace.
- **What each flag buys:** `checkBadMove` refuses a move that could do nothing
  (a damage type the foe is immune to, a status it already has, a heal at full HP,
  a boost already at its cap); `tryToFaint` adds **+1000** to a move that would
  faint the foe; `checkViability` scores the status rows (60 for a status it can
  inflict, 40 for a favourable boost, 50 for a heal below a quarter of the pool, 25
  for a volatile), each times the move's accuracy; `setupFirstTurn` adds **+80** to
  a self-boost on turn 0; `risky` adds **+60** to a self-destructing or recoiling
  move; `preferBatonPass` makes a self-switch move worth **60** while the active
  Pokémon holds a positive stat stage. A damage move is worth its best-case damage
  times its accuracy; a move worth 0 stays a legal fallback, never a third rule.
- **The difficulty** is one setting, `settings.aiLevel` — `normal` (default) or
  `hard` — drawn as the Options screen's **Difficulty** row and carried into the
  battle on `BattleLaunch.aiLevel`, so a battle's AI is reproducible from the
  battle's inputs alone. `hard` is **strictly additive**: it hands every trainer the
  cartridge's *Hard Mode* trio (`HARD_MODE_FLAGS` = `checkBadMove`, `tryToFaint`,
  `checkViability`) on top of whatever the archetype carries, and it is the only
  level that draws an exact tie from the battle's `Rng` — `normal` keeps the lowest
  index and spends no draw. The two levels differ in **flag set, wild policy and
  tie-break, and in nothing else**: the enemy's *items* are not part of it.
- **The enemy has no Bag.** `validateBag` refuses every side but the player, so the
  cartridge's item AI (Full Restores and Potions below a quarter HP, a cure on the
  matching status, X items on turn one) is **not** built and never becomes a `bag`
  command. The items the engine does model on an enemy are **held** items
  (Leftovers, the berries, the resist berries), which the engine's own hooks apply
  with no decision. The one item the AI spends is a **stone**, through the shipped
  `canMegaEvolve` / `canGigantamax` arming (§9, §10): the first fight command the AI
  can send carries the `mega` flag, else the `gmax` one, else neither.
- **Switching** is the cartridge's four rules and no more: a fainted active is
  replaced by the best reserve (alive, non-active, highest `bestOffense + hp`); a
  Perish Song about to claim the active leaves while it can; an active that cannot
  hurt the foe at all (every legal move scores 0) switches to a reserve that can;
  and a **trapped** Pokémon (`isTrapped`: the volatile, Ingrain, Fairy Lock or the
  foe's own trapping ability) never switches, whatever the score. The Emerald rules
  that need a primitive this engine does not carry — "the player's last move was
  Electric / Water / Fire and a bench absorbs it" needs an ability-versus-type table
  over `effects/abilities.ts` — are **not** implemented. Nor is a bounded search
  (minimax / expectimax / MCTS), a learned agent, a predicted switch or a read of
  the foe's unrevealed set.
- **Honesty**: the AI reads only legal information — its own side's party, movesets
  and PP; both **active** fighters' public facts (species, types, stats, HP, status,
  boosts, volatiles); the field (weather, terrain, side and field conditions);
  `state.turn`, `state.isWild`, `state.lastMove` and `state.rng`. It never reads the
  opposing **bench** and never the opposing side's unrevealed moves.
- **Determinism (`D11`)**: the AI draws from `state.rng` and from nowhere else — a
  wild's pick, and an exact tie at `hard`. Those draws advance the battle's stream,
  which is why the fixed-seed battle logs move with this rule. Nothing else in the
  AI allocates per frame: it is one call per turn.

### 11.1 The out-of-battle abilities

Two abilities have **no battle effect at all** in the cartridge: **Pickup** and
**Honey Gather** find items outside a fight. `scripts/effect-coverage.mjs` used to
mark both `excluded`/`out of battle only`, which also kept them out of the random
ability pool — `randomAbilityPool` is derived from the **registered** effect set
(D16), so an unregistered ability is one a run can never hold. Both now carry an
**empty** registry row in `effects/abilities.ts` (`['pickup', {}]`,
`['honeygather', {}]`): the port is the empty handler, because nothing happens in
battle, and the row is what makes the ability reachable at all. A battle that meets
either fights exactly as if the fighter had no ability, and the develop coverage
warning stays silent for both. What they do is on the **map**
(`src/engine/run/passives.ts`, `docs/routes-spec.md` §2): a room entry pays Pickup and
a won battle pays Honey Gather, once per room per floor. Registering the two rows
widens `randomAbilityPool` by two ids, so the abilities a seed rolls are re-rolled
**once**; a run that already stored one keeps it, and no battle rule changes.

A registered row makes an ability **reachable**, not **rolled**. `darkmatter` is
registered (its `onModifyEffectiveness` row) and still banned from the pool
(`BANNED` in `src/engine/battle/randomAbility.ts`), because
`src/engine/run/dark.ts`'s `asDark` grants it on a dark catch and nothing else
may; a re-pin of the pool's fixed-seed draws follows a pool change of any size.

## 12. Double battles

The map boss's fight is a **double battle** on **25 %** of floors and the mini-boss's
on **10 %**, rolled from the run's own seed (`src/data/bosses.ts`): a double fight
puts **two active slots** at once on each side (`DOUBLE_ACTIVES = 2`), every other
hand-placed fight stays single. The engine half is the
`double` flag on `BattleSetup` (`src/engine/battle/state.ts`); it defaults to
`false`, so every single battle keeps slot 0 and its exact log.

- **Slots.** A side carries `activeIndex` (slot 0, unchanged) and
  `secondActiveIndex` (slot 1, `-1` when the battle is single or the slot is
  empty). `createBattle({ ..., double: true })` fields slot 1 when the party has a
  second member; a party of one still yields `-1`. `slotActiveIndex`,
  `activeFighter` (slot 0 by default), `activeFighters`, `liveSlots`, `opponent`
  (slot 0 by default) and `opposingSlots` are the accessors; reading slot 1 on a
  battle that does not field it throws. A fainted fighter stays its slot's
  occupant until it is replaced, and "live slot" means "the slot exists", not
  "its occupant is alive".
- **Commands and targets.** `FightCommand` and `SwitchCommand` carry a `slot`
  (`0` by default). A slot 1 command is refused with
  `There is no second active Pokémon.` when `double` is false or the slot is
  empty. A single-target move names its foe slot through
  `target: { side, slot }`; the target must be the opposing side and one of its
  live slots, and a spread move ignores it. A self-target move ignores it too.
  `takeDoubleTurn(state, playerCommands, enemyCommands)` is the two-active entry
  point and `takeTurn` is exactly `takeDoubleTurn(state, { 0: player }, { 0: enemy })`.
- **Order.** One entry per fighting slot (up to four) is sorted by priority, then
  the per-bracket fractional tie-break, then `modifiedSpeed(state, side, slot)`,
  Trick Room inverting the Speed comparison, with the seeded `rng.next()`
  tie-break last — so four entries sort the same way twice for one seed.
- **Moves and spread.** `useMove` resolves the attacker from `command.slot` and the
  target from `command.target` (the foe's slot 0 by default), and threads it
  through the hit roll, damage, status, boosts, volatiles, recoil, messages, the
  faint side and the Substitute/Endure/contact hooks. A move whose dex `target` is
  `allAdjacentFoes` applies once to every live opposing slot (slot 0 then slot 1),
  `allAdjacent` adds the user's own live partner, and `all` covers every other live
  fighter on both sides — spending PP **once** per use. Places that mean "the foe's
  side as a whole"
  (screens, Tailwind, field conditions) stay side-level, and ability contexts may
  keep the slot-0 foe.
- **Faints and switches.** `performSwitch(state, side, partyIndex, slot = 0)` writes
  the slot it is commanded for and clears `awaitingReplacement` only when no live
  slot is left without a usable occupant. `resolveFaints` raises
  `awaitingReplacement` for a side **iff** a live slot holds a fainted fighter and
  a healthy reserve that is not already active exists; a side with one live slot
  and no reserve keeps fighting. `autoReplace` fills each emptied live slot with
  the first such reserve, slot 0 first. A side is defeated only when it has no
  healthy Pokémon left (`hasHealthy`), and two faints on one turn on both sides is
  a `draw`.
- **Partner AI.** `chooseAiCommand(state, side, { slot })` commands the slot that
  chose. In a double battle it scores **(move, target)** pairs over the live
  opposing slots and picks the best expected value; a spread move is scored once
  with no target, and it never aims at a dead slot. A wild's random policy and the
  shipped flags/scoring, and the number of RNG draws a single battle makes, do not
  change; an emptied or fainted slot asks for a `switch` when a reserve exists.
  Mega Evolution and Gigantamax stay once per side per battle across both slots,
  never once per slot.
- **Data.** `BOSS_PARTY[kind]` carries `doubleChance`: a probability in `0..1` that
  this kind's fight fields two actives per side — **25 %** for the boss (`3/6`
  members) and **10 %** for the mini-boss (`2/3`). `bossIsDouble(kind, seed,
  mapIndex, routeKey)` answers the roll from its own stream,
  `${seed}:double:<kind>:<mapIndex>:<routeKey>`, created inside the call and never
  shared, so no existing draw moves and a replay rebuilds the same answer (D11);
  the caller passes the room's own key, `room:<roomId>`, so the same floor answers
  the same way on every visit and from a reload. `bossPartySize` is unchanged, and
  a `doubleChance` of `0` or `1` is legal and makes the roll constant. The battle
  screen that reads the flag is the screen task's, not this rule's.
- **Out of scope.** Full Showdown doubles: friend guard, Helping Hand, redirection,
  spread damage reduction, per-slot side conditions and two Megas or two
  Gigantamaxes.

The **screen** reads one flag and adds no rule: `BattleLaunch.double` (`true` when
the launch's fight rolled a double battle — the map boss on 25 % of floors, the
mini-boss on 10 %) rides into `createBattle({ ..., double })`,
and everything the battle draws follows the engine's own answers. Both actives of a
side are on screen — two enemy sprites on the foe platform, two enemy HP windows
side by side and two player windows stacked, the second of each pair mirroring the
shipped panel's construction — and slot 1's window and sprite are simply hidden when
`secondActiveIndex` is `-1`, so a one-member party on the same boss degrades to the
shipped single layout. The turn is collected in **slot order** (slot 1 first, its
menu offering FIGHT and SWITCH only, since the Bag and RUN are side-level), and a
single-target damaging move opens a **target step** that marks one live opposing
slot with the shipped cursor before `confirm` submits
`target: { side: 'enemy', slot }`; a spread, status or self move submits with no
target, as it always has. `takeDoubleTurn` resolves the two player commands and one
`chooseAiCommand(…, { slot })` per standing enemy slot in a double battle, and
`takeTurn` stays the single battle's own call, so no seed, stream or key moves and a
single battle's screen, log and return are unchanged. The target step is **visible**: a
single-target damaging move in a double battle with two live foes opens it, a prompt
names the marked foe (`battle.targetPrompt`), the arrows move the mark and the prompt
with it, and a press on a foe marks it or confirms the mark.


## 13. The four team-type bonuses

A battle carries the **player party's repeated types** on `BattleState.teamTypes`
(`src/engine/battle/state.ts`), seeded from `BattleSetup.teamTypes` and defaulting
to `[]`. A type is listed when **two living members** of the player's party share
it, and while it stays listed it buys two things: a move of that type deals
**+10 %** damage, and that type's status side-effect rolls **+20 percentage points**
of chance. The **enemy side never gets either bonus** — the rule is the party's, not
the field's. `state.teamTypes` is the battle's own copy, not the run's.

**The launch fills the list** from the party's **living** members: the route calls
`livingTeamTypes(run)` (`src/engine/run/party.ts`), which reads `run.party` only —
the box is never read and `run.rip` never either — and lists a type when **at least
two** members with `fighter.hp > 0` hold it, in the party order of its first holder,
deduped. A **fainted member contributes nothing**, so a party whose second Fire is
at 0 HP carries no `Fire` bonus at all; a single living Water member lists nothing.
The list rides `BattleLaunch.teamTypes` and reaches `createBattle` through
`launchTeamTypes(launch)` in `BattleScene.create`, beside `bannedSpecies`/`noHeal`.
That one launch literal is every real fight's only construction site, so wilds,
trainers, the boss, the mini-boss and the double battle all carry the same list, and
no path gives it to the enemy side.

**The damage half** multiplies inside `computeDamage`
(`src/engine/battle/damage.ts`), immediately **after STAB** and before the type
chart: `teamTypeDamageMultiplier(move.type, context.teamTypes ?? [])` returns
`TEAM_TYPE_DAMAGE` (`1.1`) for a listed type and `1` for every other, floored with
`Math.floor` like every other term. `teamTypes` rides in the `DamageContext`, so
`computeDamage` stays state-free; `turn.ts` sets it on the **player's** damage
context only, and `estimateDamage` — the AI's deterministic path — applies the same
multiplier from the same field, so a prediction and the real hit agree. **The status
half** is one helper, `teamTypeStatusChance(state, moveType, status, chance)`
(`src/engine/battle/turn.ts`), which wraps the shipped
`runModifySecondaryChance(...)` result at the secondary roll: it adds
`TEAM_TYPE_STATUS_BONUS` (`20`) when `moveType` is listed **and** `status` is that
type's own status, clamps the sum at 100, and returns the chance untouched otherwise
— so the two halves can never disagree and no call site picks its own number.

| repeated type | damage | status side-effect |
|---|---|---|
| Fire | Fire moves ×1.1 | `brn` +20 pp |
| Ice | Ice moves ×1.1 | `frz` +20 pp |
| Electric | Electric moves ×1.1 | `par` +20 pp |
| Poison | Poison moves ×1.1 | `psn` +20 pp |

The ids are dex types as the dex spells them (`'Fire'`, `'Ice'`, `'Electric'`,
`'Poison'` — the capitalisation `effectiveness()` uses), never lowercase keys. Both
halves are **pure and draw no RNG** (`D11`): the secondary's one `rng.int(1, 100)` is
unchanged and stays in the same order, only its threshold moves, so with
`teamTypes` absent or empty every number and every fixed-seed log is byte-identical
to before the rule existed. The two constants and the four-pair map live in engine
code today because this rule owns no `src/data/` path; a balance pass would move
them to `src/data/`.

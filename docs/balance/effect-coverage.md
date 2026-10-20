# Effect coverage

Tracks every battle ability and item so "Gen 9 complete" is a claim this table
backs up (`D16` in `docs/tech-decisions.md`). Notes only: nothing here is read
by the game. Regenerate with `npm run docs:coverage`.
The same classification is written to `src/data/moveCoverage.json`, which is what
the develop-build warning reads, so a move that goes off and does nothing cannot
hide during playtests.

## Legend

- `port` — behaviour implemented. Abilities live in
  `src/engine/battle/effects/abilities.ts`; battle items in the Bag
  (`commands.ts`) and held items in `effects/items.ts`.
- `no-op` — an effect a run can actually meet but that is not implemented yet.
  A develop build (the `src/dev` gate) warns once per effect when a battle
  meets one, so a gap cannot hide during playtests.
- `excluded` — deliberately out of scope: no playable species has it, it only
  works with allies, it needs a cut mechanic (Mega/Z/Dynamax/Terastal/forme
  change), or it needs a mechanic the engine does not model (weight, entry
  hazards, forced switching, out-of-battle effects). Excluded effects are never
  a coverage gap.
- `removed` — the engine no longer carries it because its mechanic became
  **data** (`D38`): the forme-changing abilities whose forme is now an evolution
  branch, a variant drawn at generation or a hand-authored Mega. The deletion is
  the change; the row records it so the table never claims a port for code that
  is gone. Removals are listed in `REMOVED_ABILITIES` in
  `scripts/effect-coverage.mjs`.
- For a move, `port` means a registered handler, an id the turn loop
  special-cases, or a data-driven field the engine reads; `no-op` means a run
  can meet the move and nothing happens.
- For an item, `port` means the held item registers a handler
  (`effects/items.ts`) or the Bag item is one `commands.ts` reads; `no-op`
  means a run can meet the item and nothing happens.

The run only ever hands out the items in `src/data/items.ts`, so a dex item that
is not in that catalogue is `excluded` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — 311 total (263 port, 0 no-op, 36 excluded, 12 removed)

| Effect | Status | Note |
| --- | --- | --- |
| Adaptability | `port` | ported in `effects/abilities.ts` |
| Aerilate | `port` | ported in `effects/abilities.ts` |
| Aftermath | `port` | ported in `effects/abilities.ts` |
| Air Lock | `port` | ported in `effects/abilities.ts` |
| Analytic | `port` | ported in `effects/abilities.ts` |
| Anger Point | `port` | ported in `effects/abilities.ts` |
| Anger Shell | `port` | ported in `effects/abilities.ts` |
| Anticipation | `port` | ported in `effects/abilities.ts` |
| Arena Trap | `port` | ported in `effects/abilities.ts` |
| Armor Tail | `port` | ported in `effects/abilities.ts` |
| Aroma Veil | `port` | ported in `effects/abilities.ts` |
| As One (Glastrier) | `excluded` | fused forme (cut) |
| As One (Spectrier) | `excluded` | fused forme (cut) |
| Aura Break | `port` | ported in `effects/abilities.ts` |
| Bad Dreams | `port` | ported in `effects/abilities.ts` |
| Ball Fetch | `excluded` | out of battle only |
| Battery | `excluded` | doubles/ally only |
| Battle Armor | `port` | ported in `effects/abilities.ts` |
| Battle Bond | `removed` | forme-changing ability removed (D38) |
| Beads of Ruin | `port` | ported in `effects/abilities.ts` |
| Beast Boost | `port` | ported in `effects/abilities.ts` |
| Berserk | `port` | ported in `effects/abilities.ts` |
| Big Pecks | `port` | ported in `effects/abilities.ts` |
| Blaze | `port` | ported in `effects/abilities.ts` |
| Bulletproof | `port` | ported in `effects/abilities.ts` |
| Cheek Pouch | `port` | ported in `effects/abilities.ts` |
| Chilling Neigh | `port` | ported in `effects/abilities.ts` |
| Chlorophyll | `port` | ported in `effects/abilities.ts` |
| Clear Body | `port` | ported in `effects/abilities.ts` |
| Cloud Nine | `port` | ported in `effects/abilities.ts` |
| Color Change | `port` | ported in `effects/abilities.ts` |
| Comatose | `port` | ported in `effects/abilities.ts` |
| Commander | `excluded` | doubles/ally only |
| Competitive | `port` | ported in `effects/abilities.ts` |
| Compound Eyes | `port` | ported in `effects/abilities.ts` |
| Contrary | `port` | ported in `effects/abilities.ts` |
| Corrosion | `port` | ported in `effects/abilities.ts` |
| Costar | `excluded` | doubles/ally only |
| Cotton Down | `port` | ported in `effects/abilities.ts` |
| Cud Chew | `port` | ported in `effects/abilities.ts` |
| Curious Medicine | `excluded` | doubles/ally only |
| Cursed Body | `port` | ported in `effects/abilities.ts` |
| Cute Charm | `port` | ported in `effects/abilities.ts` |
| Damp | `port` | ported in `effects/abilities.ts` |
| Dancer | `port` | ported in `effects/abilities.ts` |
| Dark Aura | `port` | ported in `effects/abilities.ts` |
| Dauntless Shield | `port` | ported in `effects/abilities.ts` |
| Dazzling | `port` | ported in `effects/abilities.ts` |
| Defeatist | `port` | ported in `effects/abilities.ts` |
| Defiant | `port` | ported in `effects/abilities.ts` |
| Delta Stream | `excluded` | no playable species has it |
| Desolate Land | `port` | ported in `effects/abilities.ts` |
| Disguise | `removed` | forme-changing ability removed (D38) |
| Download | `port` | ported in `effects/abilities.ts` |
| Dragon's Maw | `port` | ported in `effects/abilities.ts` |
| Drizzle | `port` | ported in `effects/abilities.ts` |
| Drought | `port` | ported in `effects/abilities.ts` |
| Dry Skin | `port` | ported in `effects/abilities.ts` |
| Early Bird | `port` | ported in `effects/abilities.ts` |
| Earth Eater | `port` | ported in `effects/abilities.ts` |
| Effect Spore | `port` | ported in `effects/abilities.ts` |
| Electric Surge | `port` | ported in `effects/abilities.ts` |
| Electromorphosis | `port` | ported in `effects/abilities.ts` |
| Embody Aspect (Cornerstone) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Hearthflame) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Teal) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Wellspring) | `excluded` | Terastal mechanic (cut) |
| Emergency Exit | `port` | ported in `effects/abilities.ts` |
| Fairy Aura | `port` | ported in `effects/abilities.ts` |
| Filter | `port` | ported in `effects/abilities.ts` |
| Flame Body | `port` | ported in `effects/abilities.ts` |
| Flare Boost | `port` | ported in `effects/abilities.ts` |
| Flash Fire | `port` | ported in `effects/abilities.ts` |
| Flower Gift | `removed` | forme-changing ability removed (D38) |
| Flower Veil | `excluded` | doubles/ally only |
| Fluffy | `port` | ported in `effects/abilities.ts` |
| Forecast | `removed` | forme-changing ability removed (D38) |
| Forewarn | `port` | ported in `effects/abilities.ts` |
| Friend Guard | `excluded` | doubles/ally only |
| Frisk | `port` | ported in `effects/abilities.ts` |
| Full Metal Body | `port` | ported in `effects/abilities.ts` |
| Fur Coat | `port` | ported in `effects/abilities.ts` |
| Gale Wings | `port` | ported in `effects/abilities.ts` |
| Galvanize | `port` | ported in `effects/abilities.ts` |
| Gluttony | `port` | ported in `effects/abilities.ts` |
| Good as Gold | `port` | ported in `effects/abilities.ts` |
| Gooey | `port` | ported in `effects/abilities.ts` |
| Gorilla Tactics | `port` | ported in `effects/abilities.ts` |
| Grass Pelt | `port` | ported in `effects/abilities.ts` |
| Grassy Surge | `port` | ported in `effects/abilities.ts` |
| Grim Neigh | `port` | ported in `effects/abilities.ts` |
| Guard Dog | `port` | ported in `effects/abilities.ts` |
| Gulp Missile | `excluded` | forme change (cut) |
| Guts | `port` | ported in `effects/abilities.ts` |
| Hadron Engine | `port` | ported in `effects/abilities.ts` |
| Harvest | `port` | ported in `effects/abilities.ts` |
| Healer | `excluded` | doubles/ally only |
| Heatproof | `port` | ported in `effects/abilities.ts` |
| Heavy Metal | `excluded` | weight is not modelled |
| Honey Gather | `port` | ported in `effects/abilities.ts` |
| Hospitality | `excluded` | doubles/ally only |
| Huge Power | `port` | ported in `effects/abilities.ts` |
| Hunger Switch | `removed` | forme-changing ability removed (D38) |
| Hustle | `port` | ported in `effects/abilities.ts` |
| Hydration | `port` | ported in `effects/abilities.ts` |
| Hyper Cutter | `port` | ported in `effects/abilities.ts` |
| Ice Body | `port` | ported in `effects/abilities.ts` |
| Ice Face | `port` | ported in `effects/abilities.ts` |
| Ice Scales | `port` | ported in `effects/abilities.ts` |
| Illuminate | `port` | ported in `effects/abilities.ts` |
| Illusion | `port` | ported in `effects/abilities.ts` |
| Immunity | `port` | ported in `effects/abilities.ts` |
| Imposter | `port` | ported in `effects/abilities.ts` |
| Infiltrator | `port` | ported in `effects/abilities.ts` |
| Innards Out | `port` | ported in `effects/abilities.ts` |
| Inner Focus | `port` | ported in `effects/abilities.ts` |
| Insomnia | `port` | ported in `effects/abilities.ts` |
| Intimidate | `port` | ported in `effects/abilities.ts` |
| Intrepid Sword | `port` | ported in `effects/abilities.ts` |
| Iron Barbs | `port` | ported in `effects/abilities.ts` |
| Iron Fist | `port` | ported in `effects/abilities.ts` |
| Justified | `port` | ported in `effects/abilities.ts` |
| Keen Eye | `port` | ported in `effects/abilities.ts` |
| Klutz | `port` | ported in `effects/abilities.ts` |
| Leaf Guard | `port` | ported in `effects/abilities.ts` |
| Levitate | `port` | ported in `effects/abilities.ts` |
| Libero | `port` | ported in `effects/abilities.ts` |
| Light Metal | `excluded` | weight is not modelled |
| Lightning Rod | `port` | ported in `effects/abilities.ts` |
| Limber | `port` | ported in `effects/abilities.ts` |
| Lingering Aroma | `port` | ported in `effects/abilities.ts` |
| Liquid Ooze | `port` | ported in `effects/abilities.ts` |
| Liquid Voice | `port` | ported in `effects/abilities.ts` |
| Long Reach | `port` | ported in `effects/abilities.ts` |
| Magic Bounce | `port` | ported in `effects/abilities.ts` |
| Magic Guard | `port` | ported in `effects/abilities.ts` |
| Magician | `port` | ported in `effects/abilities.ts` |
| Magma Armor | `port` | ported in `effects/abilities.ts` |
| Magnet Pull | `port` | ported in `effects/abilities.ts` |
| Marvel Scale | `port` | ported in `effects/abilities.ts` |
| Mega Launcher | `port` | ported in `effects/abilities.ts` |
| Merciless | `port` | ported in `effects/abilities.ts` |
| Mimicry | `port` | ported in `effects/abilities.ts` |
| Mind's Eye | `port` | ported in `effects/abilities.ts` |
| Minus | `excluded` | doubles/ally only |
| Mirror Armor | `port` | ported in `effects/abilities.ts` |
| Misty Surge | `port` | ported in `effects/abilities.ts` |
| Mold Breaker | `port` | ported in `effects/abilities.ts` |
| Moody | `port` | ported in `effects/abilities.ts` |
| Motor Drive | `port` | ported in `effects/abilities.ts` |
| Moxie | `port` | ported in `effects/abilities.ts` |
| Multiscale | `port` | ported in `effects/abilities.ts` |
| Multitype | `excluded` | forme change (cut) |
| Mummy | `port` | ported in `effects/abilities.ts` |
| Mycelium Might | `port` | ported in `effects/abilities.ts` |
| Natural Cure | `port` | ported in `effects/abilities.ts` |
| Neuroforce | `port` | ported in `effects/abilities.ts` |
| Neutralizing Gas | `port` | ported in `effects/abilities.ts` |
| No Guard | `port` | ported in `effects/abilities.ts` |
| Normalize | `port` | ported in `effects/abilities.ts` |
| Oblivious | `port` | ported in `effects/abilities.ts` |
| Opportunist | `port` | ported in `effects/abilities.ts` |
| Orichalcum Pulse | `port` | ported in `effects/abilities.ts` |
| Overcoat | `port` | ported in `effects/abilities.ts` |
| Overgrow | `port` | ported in `effects/abilities.ts` |
| Own Tempo | `port` | ported in `effects/abilities.ts` |
| Parental Bond | `excluded` | no playable species has it |
| Pastel Veil | `port` | ported in `effects/abilities.ts` |
| Perish Body | `port` | ported in `effects/abilities.ts` |
| Pickpocket | `port` | ported in `effects/abilities.ts` |
| Pickup | `port` | ported in `effects/abilities.ts` |
| Pixilate | `port` | ported in `effects/abilities.ts` |
| Plus | `excluded` | doubles/ally only |
| Poison Heal | `port` | ported in `effects/abilities.ts` |
| Poison Point | `port` | ported in `effects/abilities.ts` |
| Poison Puppeteer | `port` | ported in `effects/abilities.ts` |
| Poison Touch | `port` | ported in `effects/abilities.ts` |
| Power Construct | `excluded` | forme change (cut) |
| Power of Alchemy | `excluded` | doubles/ally only |
| Power Spot | `excluded` | doubles/ally only |
| Prankster | `port` | ported in `effects/abilities.ts` |
| Pressure | `port` | ported in `effects/abilities.ts` |
| Primordial Sea | `port` | ported in `effects/abilities.ts` |
| Prism Armor | `port` | ported in `effects/abilities.ts` |
| Propeller Tail | `excluded` | doubles/ally only |
| Protean | `port` | ported in `effects/abilities.ts` |
| Protosynthesis | `port` | ported in `effects/abilities.ts` |
| Psychic Surge | `port` | ported in `effects/abilities.ts` |
| Punk Rock | `port` | ported in `effects/abilities.ts` |
| Pure Power | `port` | ported in `effects/abilities.ts` |
| Purifying Salt | `port` | ported in `effects/abilities.ts` |
| Quark Drive | `port` | ported in `effects/abilities.ts` |
| Queenly Majesty | `port` | ported in `effects/abilities.ts` |
| Quick Draw | `port` | ported in `effects/abilities.ts` |
| Quick Feet | `port` | ported in `effects/abilities.ts` |
| Rain Dish | `port` | ported in `effects/abilities.ts` |
| Rattled | `port` | ported in `effects/abilities.ts` |
| Receiver | `excluded` | doubles/ally only |
| Reckless | `port` | ported in `effects/abilities.ts` |
| Refrigerate | `port` | ported in `effects/abilities.ts` |
| Regenerator | `port` | ported in `effects/abilities.ts` |
| Ripen | `port` | ported in `effects/abilities.ts` |
| Rivalry | `port` | ported in `effects/abilities.ts` |
| RKS System | `excluded` | forme change (cut) |
| Rock Head | `port` | ported in `effects/abilities.ts` |
| Rocky Payload | `port` | ported in `effects/abilities.ts` |
| Rough Skin | `port` | ported in `effects/abilities.ts` |
| Run Away | `port` | ported in `effects/abilities.ts` |
| Sand Force | `port` | ported in `effects/abilities.ts` |
| Sand Rush | `port` | ported in `effects/abilities.ts` |
| Sand Spit | `port` | ported in `effects/abilities.ts` |
| Sand Stream | `port` | ported in `effects/abilities.ts` |
| Sand Veil | `port` | ported in `effects/abilities.ts` |
| Sap Sipper | `port` | ported in `effects/abilities.ts` |
| Schooling | `removed` | forme-changing ability removed (D38) |
| Scrappy | `port` | ported in `effects/abilities.ts` |
| Screen Cleaner | `port` | ported in `effects/abilities.ts` |
| Seed Sower | `port` | ported in `effects/abilities.ts` |
| Serene Grace | `port` | ported in `effects/abilities.ts` |
| Shadow Shield | `port` | ported in `effects/abilities.ts` |
| Shadow Tag | `port` | ported in `effects/abilities.ts` |
| Sharpness | `port` | ported in `effects/abilities.ts` |
| Shed Skin | `port` | ported in `effects/abilities.ts` |
| Sheer Force | `port` | ported in `effects/abilities.ts` |
| Shell Armor | `port` | ported in `effects/abilities.ts` |
| Shield Dust | `port` | ported in `effects/abilities.ts` |
| Shields Down | `removed` | forme-changing ability removed (D38) |
| Simple | `port` | ported in `effects/abilities.ts` |
| Skill Link | `port` | ported in `effects/abilities.ts` |
| Slow Start | `port` | ported in `effects/abilities.ts` |
| Slush Rush | `port` | ported in `effects/abilities.ts` |
| Sniper | `port` | ported in `effects/abilities.ts` |
| Snow Cloak | `port` | ported in `effects/abilities.ts` |
| Snow Warning | `port` | ported in `effects/abilities.ts` |
| Solar Power | `port` | ported in `effects/abilities.ts` |
| Solid Rock | `port` | ported in `effects/abilities.ts` |
| Soul-Heart | `port` | ported in `effects/abilities.ts` |
| Soundproof | `port` | ported in `effects/abilities.ts` |
| Speed Boost | `port` | ported in `effects/abilities.ts` |
| Stakeout | `port` | ported in `effects/abilities.ts` |
| Stall | `port` | ported in `effects/abilities.ts` |
| Stalwart | `excluded` | doubles/ally only |
| Stamina | `port` | ported in `effects/abilities.ts` |
| Stance Change | `removed` | forme-changing ability removed (D38) |
| Static | `port` | ported in `effects/abilities.ts` |
| Steadfast | `port` | ported in `effects/abilities.ts` |
| Steam Engine | `port` | ported in `effects/abilities.ts` |
| Steelworker | `port` | ported in `effects/abilities.ts` |
| Steely Spirit | `port` | ported in `effects/abilities.ts` |
| Stench | `port` | ported in `effects/abilities.ts` |
| Sticky Hold | `port` | ported in `effects/abilities.ts` |
| Storm Drain | `port` | ported in `effects/abilities.ts` |
| Strong Jaw | `port` | ported in `effects/abilities.ts` |
| Sturdy | `port` | ported in `effects/abilities.ts` |
| Suction Cups | `excluded` | no forced-switch mechanic |
| Super Luck | `port` | ported in `effects/abilities.ts` |
| Supersweet Syrup | `port` | ported in `effects/abilities.ts` |
| Supreme Overlord | `port` | ported in `effects/abilities.ts` |
| Surge Surfer | `port` | ported in `effects/abilities.ts` |
| Swarm | `port` | ported in `effects/abilities.ts` |
| Sweet Veil | `port` | ported in `effects/abilities.ts` |
| Swift Swim | `port` | ported in `effects/abilities.ts` |
| Sword of Ruin | `port` | ported in `effects/abilities.ts` |
| Symbiosis | `excluded` | doubles/ally only |
| Synchronize | `port` | ported in `effects/abilities.ts` |
| Tablets of Ruin | `port` | ported in `effects/abilities.ts` |
| Tangled Feet | `port` | ported in `effects/abilities.ts` |
| Tangling Hair | `port` | ported in `effects/abilities.ts` |
| Technician | `port` | ported in `effects/abilities.ts` |
| Telepathy | `excluded` | doubles/ally only |
| Tera Shell | `excluded` | Terastal mechanic (cut) |
| Tera Shift | `removed` | forme-changing ability removed (D38) |
| Teraform Zero | `excluded` | Terastal mechanic (cut) |
| Teravolt | `port` | ported in `effects/abilities.ts` |
| Thermal Exchange | `port` | ported in `effects/abilities.ts` |
| Thick Fat | `port` | ported in `effects/abilities.ts` |
| Tinted Lens | `port` | ported in `effects/abilities.ts` |
| Torrent | `port` | ported in `effects/abilities.ts` |
| Tough Claws | `port` | ported in `effects/abilities.ts` |
| Toxic Boost | `port` | ported in `effects/abilities.ts` |
| Toxic Chain | `port` | ported in `effects/abilities.ts` |
| Toxic Debris | `excluded` | entry hazards are not modelled |
| Trace | `port` | ported in `effects/abilities.ts` |
| Transistor | `port` | ported in `effects/abilities.ts` |
| Triage | `port` | ported in `effects/abilities.ts` |
| Truant | `port` | ported in `effects/abilities.ts` |
| Turboblaze | `port` | ported in `effects/abilities.ts` |
| Unaware | `port` | ported in `effects/abilities.ts` |
| Unburden | `port` | ported in `effects/abilities.ts` |
| Unnerve | `port` | ported in `effects/abilities.ts` |
| Unseen Fist | `port` | ported in `effects/abilities.ts` |
| Vessel of Ruin | `port` | ported in `effects/abilities.ts` |
| Victory Star | `port` | ported in `effects/abilities.ts` |
| Vital Spirit | `port` | ported in `effects/abilities.ts` |
| Volt Absorb | `port` | ported in `effects/abilities.ts` |
| Wandering Spirit | `port` | ported in `effects/abilities.ts` |
| Water Absorb | `port` | ported in `effects/abilities.ts` |
| Water Bubble | `port` | ported in `effects/abilities.ts` |
| Water Compaction | `port` | ported in `effects/abilities.ts` |
| Water Veil | `port` | ported in `effects/abilities.ts` |
| Weak Armor | `port` | ported in `effects/abilities.ts` |
| Well-Baked Body | `port` | ported in `effects/abilities.ts` |
| White Smoke | `port` | ported in `effects/abilities.ts` |
| Wimp Out | `port` | ported in `effects/abilities.ts` |
| Wind Power | `port` | ported in `effects/abilities.ts` |
| Wind Rider | `port` | ported in `effects/abilities.ts` |
| Wonder Guard | `port` | ported in `effects/abilities.ts` |
| Wonder Skin | `port` | ported in `effects/abilities.ts` |
| Zen Mode | `removed` | forme-changing ability removed (D38) |
| Zen Mode (Galar) | `removed` | forme-changing ability removed (D38) |
| Zero to Hero | `removed` | forme-changing ability removed (D38) |

## Moves — 835 total (786 port, 0 no-op, 49 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Absorb | `port` | data: drain |
| Accelerock | `port` | data: basePower |
| Acid | `port` | data: secondaries |
| Acid Armor | `port` | data: boosts |
| Acid Spray | `port` | data: secondaries |
| Acrobatics | `port` | data: basePower |
| Acupressure | `port` | registry: effects/moves.ts |
| Aerial Ace | `port` | data: basePower |
| Aeroblast | `port` | data: basePower |
| After You | `excluded` | doubles/ally only |
| Agility | `port` | data: boosts |
| Air Cutter | `port` | data: basePower |
| Air Slash | `port` | data: secondaries |
| Alluring Voice | `port` | data: basePower |
| Ally Switch | `excluded` | doubles/ally only |
| Amnesia | `port` | data: boosts |
| Anchor Shot | `port` | data: basePower |
| Ancient Power | `port` | data: secondaries |
| Apple Acid | `port` | data: secondaries |
| Aqua Cutter | `port` | data: basePower |
| Aqua Jet | `port` | data: basePower |
| Aqua Ring | `port` | data: volatileStatus |
| Aqua Step | `port` | data: secondaries |
| Aqua Tail | `port` | data: basePower |
| Arm Thrust | `port` | data: multihit |
| Armor Cannon | `port` | data: self.boosts |
| Aromatherapy | `port` | registry: effects/moves.ts |
| Aromatic Mist | `port` | data: boosts |
| Assist | `port` | turn loop: turn.ts |
| Assurance | `port` | data: basePower |
| Astonish | `port` | data: secondaries |
| Astral Barrage | `port` | data: basePower |
| Attack Order | `port` | data: basePower |
| Attract | `port` | data: flags.protect |
| Aura Sphere | `port` | data: basePower |
| Aura Wheel | `port` | registry: effects/moves.ts |
| Aurora Beam | `port` | data: secondaries |
| Aurora Veil | `port` | registry: effects/moves.ts |
| Autotomize | `port` | data: boosts |
| Avalanche | `port` | data: basePower |
| Axe Kick | `port` | data: secondaries |
| Baby-Doll Eyes | `port` | data: boosts |
| Baddy Bad | `excluded` | no playable species has it |
| Baneful Bunker | `port` | registry: effects/moves.ts |
| Barb Barrage | `port` | data: secondaries |
| Barrage | `port` | data: multihit |
| Barrier | `port` | data: boosts |
| Baton Pass | `port` | data: selfSwitch |
| Beak Blast | `port` | data: basePower |
| Beat Up | `port` | data: flags.protect |
| Behemoth Bash | `port` | data: basePower |
| Behemoth Blade | `port` | data: basePower |
| Belch | `port` | data: basePower |
| Belly Drum | `port` | registry: effects/moves.ts |
| Bestow | `excluded` | no playable species has it |
| Bide | `port` | data: flags.protect |
| Bind | `port` | data: volatileStatus |
| Bite | `port` | data: secondaries |
| Bitter Blade | `port` | data: drain |
| Bitter Malice | `port` | data: secondaries |
| Blast Burn | `port` | data: basePower |
| Blaze Kick | `port` | data: secondaries |
| Bleakwind Storm | `port` | data: secondaries |
| Blizzard | `port` | data: secondaries |
| Block | `port` | registry: effects/moves.ts |
| Blood Moon | `port` | data: basePower |
| Blue Flare | `port` | data: secondaries |
| Body Press | `port` | data: basePower |
| Body Slam | `port` | data: secondaries |
| Bolt Beak | `port` | data: basePower |
| Bolt Strike | `port` | data: secondaries |
| Bone Club | `port` | data: secondaries |
| Bone Rush | `port` | data: multihit |
| Bonemerang | `port` | data: multihit |
| Boomburst | `port` | data: basePower |
| Bounce | `port` | data: secondaries |
| Bouncy Bubble | `excluded` | no playable species has it |
| Branch Poke | `port` | data: basePower |
| Brave Bird | `port` | data: recoil |
| Breaking Swipe | `port` | data: secondaries |
| Brick Break | `port` | data: basePower |
| Brine | `port` | data: basePower |
| Brutal Swing | `port` | data: basePower |
| Bubble | `port` | data: secondaries |
| Bubble Beam | `port` | data: secondaries |
| Bug Bite | `port` | data: basePower |
| Bug Buzz | `port` | data: secondaries |
| Bulk Up | `port` | data: boosts |
| Bulldoze | `port` | data: secondaries |
| Bullet Punch | `port` | data: basePower |
| Bullet Seed | `port` | data: multihit |
| Burning Bulwark | `port` | registry: effects/moves.ts |
| Burning Jealousy | `port` | data: basePower |
| Buzzy Buzz | `excluded` | no playable species has it |
| Calm Mind | `port` | data: boosts |
| Camouflage | `port` | registry: effects/moves.ts |
| Captivate | `port` | data: boosts |
| Ceaseless Edge | `port` | data: basePower |
| Celebrate | `port` | registry: effects/moves.ts |
| Charge | `port` | data: boosts |
| Charge Beam | `port` | data: secondaries |
| Charm | `port` | data: boosts |
| Chatter | `port` | data: secondaries |
| Chilling Water | `port` | data: secondaries |
| Chilly Reception | `port` | data: selfSwitch |
| Chip Away | `excluded` | no playable species has it |
| Chloroblast | `port` | data: basePower |
| Circle Throw | `port` | data: basePower |
| Clamp | `port` | data: volatileStatus |
| Clanging Scales | `port` | data: basePower |
| Clangorous Soul | `port` | data: boosts |
| Clear Smog | `port` | data: basePower |
| Close Combat | `port` | data: self.boosts |
| Coaching | `port` | data: boosts |
| Coil | `port` | data: boosts |
| Collision Course | `port` | data: basePower |
| Comet Punch | `port` | data: multihit |
| Comeuppance | `port` | turn loop: turn.ts |
| Confide | `port` | data: boosts |
| Confuse Ray | `port` | data: volatileStatus |
| Confusion | `port` | data: secondaries |
| Constrict | `port` | data: secondaries |
| Conversion | `port` | registry: effects/moves.ts |
| Conversion 2 | `port` | registry: effects/moves.ts |
| Copycat | `port` | turn loop: turn.ts |
| Core Enforcer | `port` | data: basePower |
| Cosmic Power | `port` | data: boosts |
| Cotton Guard | `port` | data: boosts |
| Cotton Spore | `port` | data: boosts |
| Counter | `port` | turn loop: turn.ts |
| Court Change | `excluded` | entry hazards are not modelled |
| Covet | `port` | data: basePower |
| Crabhammer | `port` | data: basePower |
| Crafty Shield | `excluded` | doubles/ally only |
| Cross Chop | `port` | data: basePower |
| Cross Poison | `port` | data: secondaries |
| Crunch | `port` | data: secondaries |
| Crush Claw | `port` | data: secondaries |
| Crush Grip | `port` | data: flags.protect |
| Curse | `port` | registry: effects/moves.ts |
| Dark Pulse | `port` | data: secondaries |
| Dark Void | `port` | data: status |
| Darkest Lariat | `port` | data: basePower |
| Dazzling Gleam | `port` | data: basePower |
| Decorate | `port` | data: boosts |
| Defend Order | `port` | data: boosts |
| Defense Curl | `port` | data: boosts |
| Defog | `port` | data: flags.protect |
| Destiny Bond | `port` | data: volatileStatus |
| Detect | `port` | registry: effects/moves.ts |
| Diamond Storm | `port` | data: self.boosts |
| Dig | `port` | data: flags.charge |
| Dire Claw | `port` | data: basePower |
| Disable | `port` | data: flags.protect |
| Disarming Voice | `port` | data: basePower |
| Discharge | `port` | data: secondaries |
| Dive | `port` | data: flags.charge |
| Dizzy Punch | `port` | data: secondaries |
| Doodle | `port` | registry: effects/moves.ts |
| Doom Desire | `port` | data: basePower |
| Double Hit | `port` | data: multihit |
| Double Iron Bash | `port` | data: secondaries |
| Double Kick | `port` | data: multihit |
| Double Shock | `port` | data: basePower |
| Double Slap | `port` | data: multihit |
| Double Team | `port` | data: boosts |
| Double-Edge | `port` | data: recoil |
| Draco Meteor | `port` | data: self.boosts |
| Dragon Ascent | `port` | data: self.boosts |
| Dragon Breath | `port` | data: secondaries |
| Dragon Cheer | `port` | data: volatileStatus |
| Dragon Claw | `port` | data: basePower |
| Dragon Dance | `port` | data: boosts |
| Dragon Darts | `port` | data: multihit |
| Dragon Energy | `port` | data: basePower |
| Dragon Hammer | `port` | data: basePower |
| Dragon Pulse | `port` | data: basePower |
| Dragon Rage | `port` | data: flags.protect |
| Dragon Rush | `port` | data: secondaries |
| Dragon Tail | `port` | data: basePower |
| Drain Punch | `port` | data: drain |
| Draining Kiss | `port` | data: drain |
| Dream Eater | `port` | data: drain |
| Drill Peck | `port` | data: basePower |
| Drill Run | `port` | data: basePower |
| Drum Beating | `port` | data: secondaries |
| Dual Chop | `port` | data: multihit |
| Dual Wingbeat | `port` | data: multihit |
| Dynamax Cannon | `port` | data: basePower |
| Dynamic Punch | `port` | data: secondaries |
| Earth Power | `port` | data: secondaries |
| Earthquake | `port` | data: basePower |
| Echoed Voice | `port` | data: basePower |
| Eerie Impulse | `port` | data: boosts |
| Eerie Spell | `port` | data: basePower |
| Egg Bomb | `port` | data: basePower |
| Electric Terrain | `port` | data: terrain |
| Electrify | `port` | data: flags.protect |
| Electro Ball | `port` | data: flags.protect |
| Electro Drift | `port` | data: basePower |
| Electro Shot | `port` | data: flags.charge |
| Electroweb | `port` | data: secondaries |
| Embargo | `port` | data: flags.protect |
| Ember | `port` | data: secondaries |
| Encore | `port` | data: volatileStatus |
| Endeavor | `port` | data: flags.protect |
| Endure | `port` | data: volatileStatus |
| Energy Ball | `port` | data: secondaries |
| Entrainment | `port` | data: flags.protect |
| Eruption | `port` | data: basePower |
| Esper Wing | `port` | data: secondaries |
| Eternabeam | `port` | data: basePower |
| Expanding Force | `port` | data: basePower |
| Explosion | `port` | data: selfdestruct |
| Extrasensory | `port` | data: secondaries |
| Extreme Speed | `port` | data: basePower |
| Facade | `port` | data: basePower |
| Fairy Lock | `port` | registry: effects/moves.ts |
| Fairy Wind | `port` | data: basePower |
| Fake Out | `port` | data: secondaries |
| Fake Tears | `port` | data: boosts |
| False Surrender | `port` | data: basePower |
| False Swipe | `port` | data: basePower |
| Feather Dance | `port` | data: boosts |
| Feint | `port` | data: basePower |
| Feint Attack | `port` | data: basePower |
| Fell Stinger | `port` | data: basePower |
| Fickle Beam | `port` | data: basePower |
| Fiery Dance | `port` | data: secondaries |
| Fiery Wrath | `port` | data: secondaries |
| Fillet Away | `port` | data: boosts |
| Final Gambit | `port` | data: selfdestruct |
| Fire Blast | `port` | data: secondaries |
| Fire Fang | `port` | data: secondaries |
| Fire Lash | `port` | data: secondaries |
| Fire Pledge | `port` | data: basePower |
| Fire Punch | `port` | data: secondaries |
| Fire Spin | `port` | data: volatileStatus |
| First Impression | `port` | data: basePower |
| Fishious Rend | `port` | data: basePower |
| Fissure | `port` | data: flags.protect |
| Flail | `port` | data: flags.protect |
| Flame Burst | `port` | data: basePower |
| Flame Charge | `port` | data: secondaries |
| Flame Wheel | `port` | data: secondaries |
| Flamethrower | `port` | data: secondaries |
| Flare Blitz | `port` | data: secondaries |
| Flash | `port` | data: boosts |
| Flash Cannon | `port` | data: secondaries |
| Flatter | `port` | data: volatileStatus |
| Fleur Cannon | `port` | data: self.boosts |
| Fling | `port` | data: flags.protect |
| Flip Turn | `port` | data: selfSwitch |
| Floaty Fall | `excluded` | no playable species has it |
| Floral Healing | `port` | data: flags.protect |
| Flower Shield | `port` | registry: effects/moves.ts |
| Flower Trick | `port` | data: basePower |
| Fly | `port` | data: flags.charge |
| Flying Press | `port` | data: basePower |
| Focus Blast | `port` | data: secondaries |
| Focus Energy | `port` | data: volatileStatus |
| Focus Punch | `port` | data: basePower |
| Follow Me | `excluded` | doubles/ally only |
| Force Palm | `port` | data: secondaries |
| Foresight | `port` | data: flags.protect |
| Forest's Curse | `port` | data: flags.protect |
| Foul Play | `port` | data: basePower |
| Freeze Shock | `port` | data: secondaries |
| Freeze-Dry | `port` | data: secondaries |
| Freezing Glare | `port` | data: secondaries |
| Freezy Frost | `excluded` | no playable species has it |
| Frenzy Plant | `port` | data: basePower |
| Frost Breath | `port` | data: basePower |
| Frustration | `port` | data: flags.protect |
| Fury Attack | `port` | data: multihit |
| Fury Cutter | `port` | data: basePower |
| Fury Swipes | `port` | data: multihit |
| Fusion Bolt | `port` | data: basePower |
| Fusion Flare | `port` | data: basePower |
| Future Sight | `port` | data: basePower |
| Gastro Acid | `port` | data: flags.protect |
| Gear Grind | `port` | data: multihit |
| Gear Up | `excluded` | doubles/ally only |
| Geomancy | `port` | data: boosts |
| Giga Drain | `port` | data: drain |
| Giga Impact | `port` | data: basePower |
| Gigaton Hammer | `port` | data: basePower |
| Glacial Lance | `port` | data: basePower |
| Glaciate | `port` | data: secondaries |
| Glaive Rush | `port` | data: basePower |
| Glare | `port` | data: status |
| Glitzy Glow | `excluded` | no playable species has it |
| Grass Knot | `port` | data: flags.protect |
| Grass Pledge | `port` | data: basePower |
| Grass Whistle | `port` | data: status |
| Grassy Glide | `port` | data: basePower |
| Grassy Terrain | `port` | data: terrain |
| Grav Apple | `port` | data: secondaries |
| Gravity | `port` | registry: effects/moves.ts |
| Growl | `port` | data: boosts |
| Growth | `port` | data: boosts |
| Grudge | `port` | data: volatileStatus |
| Guard Split | `port` | data: flags.protect |
| Guard Swap | `port` | data: flags.protect |
| Guillotine | `port` | data: flags.protect |
| Gunk Shot | `port` | data: secondaries |
| Gust | `port` | data: basePower |
| Gyro Ball | `port` | data: flags.protect |
| Hail | `port` | data: weather |
| Hammer Arm | `port` | data: self.boosts |
| Happy Hour | `excluded` | no playable species has it |
| Hard Press | `port` | data: flags.protect |
| Harden | `port` | data: boosts |
| Haze | `port` | registry: effects/moves.ts |
| Head Charge | `port` | data: recoil |
| Head Smash | `port` | data: recoil |
| Headbutt | `port` | data: secondaries |
| Headlong Rush | `port` | data: self.boosts |
| Heal Bell | `port` | registry: effects/moves.ts |
| Heal Block | `excluded` | no playable species has it |
| Heal Order | `excluded` | no playable species has it |
| Heal Pulse | `port` | data: flags.protect |
| Healing Wish | `port` | data: selfdestruct |
| Heart Stamp | `excluded` | no playable species has it |
| Heart Swap | `port` | data: flags.protect |
| Heat Crash | `port` | data: flags.protect |
| Heat Wave | `port` | data: secondaries |
| Heavy Slam | `port` | data: flags.protect |
| Helping Hand | `excluded` | doubles/ally only |
| Hex | `port` | data: basePower |
| Hidden Power | `port` | data: basePower |
| High Horsepower | `port` | data: basePower |
| High Jump Kick | `port` | data: basePower |
| Hone Claws | `port` | data: boosts |
| Horn Attack | `port` | data: basePower |
| Horn Drill | `port` | data: flags.protect |
| Horn Leech | `port` | data: drain |
| Howl | `port` | data: boosts |
| Hurricane | `port` | data: secondaries |
| Hydro Cannon | `port` | data: basePower |
| Hydro Pump | `port` | data: basePower |
| Hydro Steam | `port` | data: basePower |
| Hyper Beam | `port` | data: basePower |
| Hyper Drill | `port` | data: basePower |
| Hyper Fang | `port` | data: secondaries |
| Hyper Voice | `port` | data: basePower |
| Hyperspace Fury | `port` | data: self.boosts |
| Hyperspace Hole | `port` | data: basePower |
| Hypnosis | `port` | data: status |
| Ice Ball | `excluded` | no playable species has it |
| Ice Beam | `port` | data: secondaries |
| Ice Burn | `port` | data: secondaries |
| Ice Fang | `port` | data: secondaries |
| Ice Hammer | `port` | data: self.boosts |
| Ice Punch | `port` | data: secondaries |
| Ice Shard | `port` | data: basePower |
| Ice Spinner | `port` | data: basePower |
| Icicle Crash | `port` | data: secondaries |
| Icicle Spear | `port` | data: multihit |
| Icy Wind | `port` | data: secondaries |
| Imprison | `port` | data: volatileStatus |
| Incinerate | `port` | data: basePower |
| Infernal Parade | `port` | data: secondaries |
| Inferno | `port` | data: secondaries |
| Infestation | `port` | data: volatileStatus |
| Ingrain | `port` | data: volatileStatus |
| Instruct | `port` | data: flags.protect |
| Ion Deluge | `excluded` | no playable species has it |
| Iron Defense | `port` | data: boosts |
| Iron Head | `port` | data: secondaries |
| Iron Tail | `port` | data: secondaries |
| Ivy Cudgel | `port` | data: basePower |
| Jaw Lock | `port` | data: basePower |
| Jet Punch | `port` | data: basePower |
| Judgment | `port` | registry: effects/items.ts |
| Jump Kick | `port` | data: basePower |
| Jungle Healing | `port` | registry: effects/moves.ts |
| Karate Chop | `port` | data: basePower |
| Kinesis | `port` | data: boosts |
| King's Shield | `port` | registry: effects/moves.ts |
| Knock Off | `port` | data: basePower |
| Kowtow Cleave | `port` | data: basePower |
| Land's Wrath | `port` | data: basePower |
| Laser Focus | `port` | data: volatileStatus |
| Lash Out | `port` | data: basePower |
| Last Resort | `port` | data: basePower |
| Last Respects | `port` | data: basePower |
| Lava Plume | `port` | data: secondaries |
| Leaf Blade | `port` | data: basePower |
| Leaf Storm | `port` | data: self.boosts |
| Leaf Tornado | `port` | data: secondaries |
| Leafage | `port` | data: basePower |
| Leech Life | `port` | data: drain |
| Leech Seed | `port` | data: volatileStatus |
| Leer | `port` | data: boosts |
| Lick | `port` | data: secondaries |
| Life Dew | `port` | data: heal |
| Light of Ruin | `port` | data: recoil |
| Light Screen | `port` | registry: effects/moves.ts |
| Liquidation | `port` | data: secondaries |
| Lock-On | `port` | data: flags.protect |
| Lovely Kiss | `port` | data: status |
| Low Kick | `port` | data: flags.protect |
| Low Sweep | `port` | data: secondaries |
| Lucky Chant | `port` | registry: effects/moves.ts |
| Lumina Crash | `port` | data: secondaries |
| Lunar Blessing | `port` | registry: effects/moves.ts |
| Lunar Dance | `port` | data: selfdestruct |
| Lunge | `port` | data: secondaries |
| Luster Purge | `port` | data: secondaries |
| Mach Punch | `port` | data: basePower |
| Magic Coat | `port` | data: volatileStatus |
| Magic Powder | `port` | data: flags.protect |
| Magic Room | `port` | registry: effects/moves.ts |
| Magical Leaf | `port` | data: basePower |
| Magma Storm | `port` | data: volatileStatus |
| Magnet Bomb | `excluded` | no playable species has it |
| Magnet Rise | `port` | data: volatileStatus |
| Magnetic Flux | `excluded` | doubles/ally only |
| Magnitude | `excluded` | no playable species has it |
| Make It Rain | `port` | data: self.boosts |
| Malignant Chain | `port` | data: secondaries |
| Mat Block | `excluded` | no playable species has it |
| Matcha Gotcha | `port` | data: secondaries |
| Me First | `excluded` | no playable species has it |
| Mean Look | `port` | registry: effects/moves.ts |
| Meditate | `port` | data: boosts |
| Mega Drain | `port` | data: drain |
| Mega Kick | `port` | data: basePower |
| Mega Punch | `port` | data: basePower |
| Megahorn | `port` | data: basePower |
| Memento | `port` | data: boosts |
| Metal Burst | `port` | turn loop: turn.ts |
| Metal Claw | `port` | data: secondaries |
| Metal Sound | `port` | data: boosts |
| Meteor Assault | `port` | data: basePower |
| Meteor Beam | `port` | data: flags.charge |
| Meteor Mash | `port` | data: secondaries |
| Metronome | `port` | turn loop: turn.ts |
| Mighty Cleave | `port` | data: basePower |
| Milk Drink | `port` | data: heal |
| Mimic | `port` | data: flags.protect |
| Mind Blown | `port` | data: basePower |
| Mind Reader | `port` | data: flags.protect |
| Minimize | `port` | data: boosts |
| Miracle Eye | `excluded` | no playable species has it |
| Mirror Coat | `port` | turn loop: turn.ts |
| Mirror Move | `port` | turn loop: turn.ts |
| Mirror Shot | `port` | data: secondaries |
| Mist | `port` | registry: effects/moves.ts |
| Mist Ball | `port` | data: secondaries |
| Misty Explosion | `port` | data: selfdestruct |
| Misty Terrain | `port` | data: terrain |
| Moonblast | `port` | data: secondaries |
| Moongeist Beam | `port` | data: basePower |
| Moonlight | `port` | registry: effects/moves.ts |
| Morning Sun | `port` | registry: effects/moves.ts |
| Mortal Spin | `port` | data: secondaries |
| Mountain Gale | `port` | data: secondaries |
| Mud Bomb | `port` | data: secondaries |
| Mud Shot | `port` | data: secondaries |
| Mud Sport | `port` | registry: effects/moves.ts |
| Mud-Slap | `port` | data: secondaries |
| Muddy Water | `port` | data: secondaries |
| Multi-Attack | `port` | registry: effects/items.ts |
| Mystical Fire | `port` | data: secondaries |
| Mystical Power | `port` | data: secondaries |
| Nasty Plot | `port` | data: boosts |
| Natural Gift | `port` | registry: effects/items.ts |
| Nature Power | `port` | turn loop: turn.ts |
| Nature's Madness | `port` | data: flags.protect |
| Needle Arm | `excluded` | no playable species has it |
| Night Daze | `port` | data: secondaries |
| Night Shade | `port` | data: flags.protect |
| Night Slash | `port` | data: basePower |
| Nightmare | `port` | data: flags.protect |
| No Retreat | `port` | data: boosts |
| Noble Roar | `port` | data: boosts |
| Nuzzle | `port` | data: secondaries |
| Oblivion Wing | `port` | data: drain |
| Obstruct | `port` | registry: effects/moves.ts |
| Octazooka | `port` | data: secondaries |
| Octolock | `port` | data: flags.protect |
| Odor Sleuth | `port` | data: flags.protect |
| Ominous Wind | `port` | data: secondaries |
| Order Up | `port` | data: basePower |
| Origin Pulse | `port` | data: basePower |
| Outrage | `port` | data: basePower |
| Overdrive | `port` | data: basePower |
| Overheat | `port` | data: self.boosts |
| Pain Split | `port` | data: flags.protect |
| Parabolic Charge | `port` | data: drain |
| Parting Shot | `port` | data: selfSwitch |
| Pay Day | `port` | data: basePower |
| Payback | `port` | data: basePower |
| Peck | `port` | data: basePower |
| Perish Song | `port` | registry: effects/moves.ts |
| Petal Blizzard | `port` | data: basePower |
| Petal Dance | `port` | data: basePower |
| Phantom Force | `port` | data: flags.charge |
| Photon Geyser | `port` | data: basePower |
| Pika Papow | `excluded` | no playable species has it |
| Pin Missile | `port` | data: multihit |
| Plasma Fists | `port` | data: basePower |
| Play Nice | `port` | data: boosts |
| Play Rough | `port` | data: secondaries |
| Pluck | `port` | data: basePower |
| Poison Fang | `port` | data: secondaries |
| Poison Gas | `port` | data: status |
| Poison Jab | `port` | data: secondaries |
| Poison Powder | `port` | data: status |
| Poison Sting | `port` | data: secondaries |
| Poison Tail | `port` | data: secondaries |
| Pollen Puff | `port` | data: basePower |
| Poltergeist | `port` | data: basePower |
| Population Bomb | `port` | data: multihit |
| Pounce | `port` | data: secondaries |
| Pound | `port` | data: basePower |
| Powder | `excluded` | no playable species has it |
| Powder Snow | `port` | data: secondaries |
| Power Gem | `port` | data: basePower |
| Power Split | `port` | data: flags.protect |
| Power Swap | `port` | data: flags.protect |
| Power Trick | `port` | data: volatileStatus |
| Power Trip | `port` | data: basePower |
| Power Whip | `port` | data: basePower |
| Power-Up Punch | `port` | data: secondaries |
| Precipice Blades | `port` | data: basePower |
| Present | `port` | data: flags.protect |
| Prismatic Laser | `port` | data: basePower |
| Protect | `port` | registry: effects/moves.ts |
| Psybeam | `port` | data: secondaries |
| Psyblade | `port` | data: basePower |
| Psych Up | `port` | registry: effects/moves.ts |
| Psychic | `port` | data: secondaries |
| Psychic Fangs | `port` | data: basePower |
| Psychic Noise | `port` | data: basePower |
| Psychic Terrain | `port` | data: terrain |
| Psycho Boost | `port` | data: self.boosts |
| Psycho Cut | `port` | data: basePower |
| Psycho Shift | `port` | data: flags.protect |
| Psyshield Bash | `port` | data: secondaries |
| Psyshock | `port` | data: basePower |
| Psystrike | `port` | data: basePower |
| Psywave | `port` | data: flags.protect |
| Punishment | `excluded` | no playable species has it |
| Purify | `port` | data: flags.protect |
| Pursuit | `port` | data: basePower |
| Pyro Ball | `port` | data: secondaries |
| Quash | `port` | data: flags.protect |
| Quick Attack | `port` | data: basePower |
| Quick Guard | `excluded` | doubles/ally only |
| Quiver Dance | `port` | data: boosts |
| Rage | `port` | data: basePower |
| Rage Fist | `port` | data: basePower |
| Rage Powder | `excluded` | doubles/ally only |
| Raging Bull | `port` | data: basePower |
| Raging Fury | `port` | data: basePower |
| Rain Dance | `port` | data: weather |
| Rapid Spin | `port` | data: secondaries |
| Razor Leaf | `port` | data: basePower |
| Razor Shell | `port` | data: secondaries |
| Razor Wind | `port` | data: flags.charge |
| Recover | `port` | data: heal |
| Recycle | `port` | registry: effects/moves.ts |
| Reflect | `port` | registry: effects/moves.ts |
| Reflect Type | `port` | data: flags.protect |
| Refresh | `port` | registry: effects/moves.ts |
| Relic Song | `port` | data: secondaries |
| Rest | `port` | registry: effects/moves.ts |
| Retaliate | `port` | data: basePower |
| Return | `port` | data: flags.protect |
| Revelation Dance | `port` | registry: effects/moves.ts |
| Revenge | `port` | data: basePower |
| Reversal | `port` | data: flags.protect |
| Revival Blessing | `port` | data: selfSwitch |
| Rising Voltage | `port` | data: basePower |
| Roar | `excluded` | no forced-switch mechanic |
| Roar of Time | `port` | data: basePower |
| Rock Blast | `port` | data: multihit |
| Rock Climb | `port` | data: secondaries |
| Rock Polish | `port` | data: boosts |
| Rock Slide | `port` | data: secondaries |
| Rock Smash | `port` | data: secondaries |
| Rock Throw | `port` | data: basePower |
| Rock Tomb | `port` | data: secondaries |
| Rock Wrecker | `port` | data: basePower |
| Role Play | `port` | registry: effects/moves.ts |
| Rolling Kick | `port` | data: secondaries |
| Rollout | `port` | data: basePower |
| Roost | `port` | data: heal |
| Rototiller | `port` | registry: effects/moves.ts |
| Round | `port` | data: basePower |
| Ruination | `port` | data: flags.protect |
| Sacred Fire | `port` | data: secondaries |
| Sacred Sword | `port` | data: basePower |
| Safeguard | `port` | registry: effects/moves.ts |
| Salt Cure | `port` | data: basePower |
| Sand Attack | `port` | data: boosts |
| Sand Tomb | `port` | data: volatileStatus |
| Sandsear Storm | `port` | data: secondaries |
| Sandstorm | `port` | data: weather |
| Sappy Seed | `excluded` | no playable species has it |
| Scald | `port` | data: secondaries |
| Scale Shot | `port` | data: multihit |
| Scary Face | `port` | data: boosts |
| Scorching Sands | `port` | data: secondaries |
| Scratch | `port` | data: basePower |
| Screech | `port` | data: boosts |
| Searing Shot | `port` | data: secondaries |
| Secret Power | `port` | data: secondaries |
| Secret Sword | `port` | data: basePower |
| Seed Bomb | `port` | data: basePower |
| Seed Flare | `port` | data: secondaries |
| Seismic Toss | `port` | data: flags.protect |
| Self-Destruct | `port` | data: selfdestruct |
| Shadow Ball | `port` | data: secondaries |
| Shadow Bone | `port` | data: secondaries |
| Shadow Claw | `port` | data: basePower |
| Shadow Force | `port` | data: flags.charge |
| Shadow Punch | `port` | data: basePower |
| Shadow Sneak | `port` | data: basePower |
| Sharpen | `port` | data: boosts |
| Shed Tail | `port` | data: volatileStatus |
| Sheer Cold | `port` | data: flags.protect |
| Shell Side Arm | `port` | data: secondaries |
| Shell Smash | `port` | data: boosts |
| Shell Trap | `port` | data: basePower |
| Shelter | `port` | data: boosts |
| Shift Gear | `port` | data: boosts |
| Shock Wave | `port` | data: basePower |
| Shore Up | `port` | registry: effects/moves.ts |
| Signal Beam | `port` | data: secondaries |
| Silk Trap | `port` | registry: effects/moves.ts |
| Silver Wind | `port` | data: secondaries |
| Simple Beam | `port` | data: flags.protect |
| Sing | `port` | data: status |
| Sizzly Slide | `excluded` | no playable species has it |
| Sketch | `excluded` | needs a permanent move copy |
| Skill Swap | `port` | data: flags.protect |
| Skitter Smack | `port` | data: secondaries |
| Skull Bash | `port` | data: flags.charge |
| Sky Attack | `port` | data: secondaries |
| Sky Drop | `port` | data: flags.charge |
| Sky Uppercut | `port` | data: basePower |
| Slack Off | `port` | data: heal |
| Slam | `port` | data: basePower |
| Slash | `port` | data: basePower |
| Sleep Powder | `port` | data: status |
| Sleep Talk | `port` | turn loop: turn.ts |
| Sludge | `port` | data: secondaries |
| Sludge Bomb | `port` | data: secondaries |
| Sludge Wave | `port` | data: secondaries |
| Smack Down | `port` | data: basePower |
| Smart Strike | `port` | data: basePower |
| Smelling Salts | `port` | data: basePower |
| Smog | `port` | data: secondaries |
| Smokescreen | `port` | data: boosts |
| Snap Trap | `port` | data: volatileStatus |
| Snarl | `port` | data: secondaries |
| Snatch | `port` | data: volatileStatus |
| Snipe Shot | `port` | data: basePower |
| Snore | `port` | data: secondaries |
| Snowscape | `port` | data: weather |
| Soak | `port` | data: flags.protect |
| Soft-Boiled | `port` | data: heal |
| Solar Beam | `port` | data: flags.charge |
| Solar Blade | `port` | data: flags.charge |
| Sonic Boom | `port` | data: flags.protect |
| Spacial Rend | `port` | data: basePower |
| Spark | `port` | data: secondaries |
| Sparkling Aria | `port` | data: basePower |
| Sparkly Swirl | `excluded` | no playable species has it |
| Spectral Thief | `port` | data: basePower |
| Speed Swap | `port` | data: flags.protect |
| Spicy Extract | `port` | data: boosts |
| Spider Web | `port` | data: flags.protect |
| Spike Cannon | `port` | data: multihit |
| Spikes | `excluded` | entry hazards are not modelled |
| Spiky Shield | `port` | registry: effects/moves.ts |
| Spin Out | `port` | data: self.boosts |
| Spirit Break | `port` | data: secondaries |
| Spirit Shackle | `port` | data: basePower |
| Spit Up | `port` | data: flags.protect |
| Spite | `port` | data: flags.protect |
| Splash | `port` | registry: effects/moves.ts |
| Splishy Splash | `excluded` | no playable species has it |
| Spore | `port` | data: status |
| Spotlight | `port` | data: flags.protect |
| Springtide Storm | `port` | data: secondaries |
| Stealth Rock | `excluded` | entry hazards are not modelled |
| Steam Eruption | `port` | data: secondaries |
| Steamroller | `excluded` | no playable species has it |
| Steel Beam | `port` | data: basePower |
| Steel Roller | `port` | data: basePower |
| Steel Wing | `port` | data: secondaries |
| Sticky Web | `excluded` | entry hazards are not modelled |
| Stockpile | `port` | registry: effects/moves.ts |
| Stomp | `port` | data: secondaries |
| Stomping Tantrum | `port` | data: basePower |
| Stone Axe | `port` | data: basePower |
| Stone Edge | `port` | data: basePower |
| Stored Power | `port` | data: basePower |
| Storm Throw | `port` | data: basePower |
| Strange Steam | `port` | data: secondaries |
| Strength | `port` | data: basePower |
| Strength Sap | `port` | data: flags.protect |
| String Shot | `port` | data: boosts |
| Struggle | `port` | data: struggleRecoil |
| Struggle Bug | `port` | data: secondaries |
| Stuff Cheeks | `port` | registry: effects/moves.ts |
| Stun Spore | `port` | data: status |
| Submission | `port` | data: recoil |
| Substitute | `port` | data: volatileStatus |
| Sucker Punch | `port` | data: basePower |
| Sunny Day | `port` | data: weather |
| Sunsteel Strike | `port` | data: basePower |
| Super Fang | `port` | data: flags.protect |
| Supercell Slam | `port` | data: basePower |
| Superpower | `port` | data: self.boosts |
| Supersonic | `port` | data: volatileStatus |
| Surf | `port` | data: basePower |
| Surging Strikes | `port` | data: multihit |
| Swagger | `port` | data: volatileStatus |
| Swallow | `port` | registry: effects/moves.ts |
| Sweet Kiss | `port` | data: volatileStatus |
| Sweet Scent | `port` | data: boosts |
| Swift | `port` | data: basePower |
| Switcheroo | `port` | data: flags.protect |
| Swords Dance | `port` | data: boosts |
| Synchronoise | `port` | data: basePower |
| Synthesis | `port` | registry: effects/moves.ts |
| Syrup Bomb | `port` | data: basePower |
| Tachyon Cutter | `port` | data: multihit |
| Tackle | `port` | data: basePower |
| Tail Glow | `port` | data: boosts |
| Tail Slap | `port` | data: multihit |
| Tail Whip | `port` | data: boosts |
| Tailwind | `port` | registry: effects/moves.ts |
| Take Down | `port` | data: recoil |
| Take Heart | `port` | registry: effects/moves.ts |
| Tar Shot | `port` | data: boosts |
| Taunt | `port` | data: volatileStatus |
| Tearful Look | `port` | data: boosts |
| Teatime | `port` | registry: effects/moves.ts |
| Techno Blast | `port` | registry: effects/items.ts |
| Teeter Dance | `port` | data: volatileStatus |
| Telekinesis | `port` | data: flags.protect |
| Teleport | `port` | data: selfSwitch |
| Temper Flare | `port` | data: basePower |
| Tera Blast | `port` | data: basePower |
| Tera Starstorm | `port` | data: basePower |
| Terrain Pulse | `port` | registry: effects/moves.ts |
| Thief | `port` | data: basePower |
| Thousand Arrows | `port` | data: basePower |
| Thousand Waves | `port` | data: basePower |
| Thrash | `port` | data: basePower |
| Throat Chop | `port` | data: basePower |
| Thunder | `port` | data: secondaries |
| Thunder Cage | `port` | data: volatileStatus |
| Thunder Fang | `port` | data: secondaries |
| Thunder Punch | `port` | data: secondaries |
| Thunder Shock | `port` | data: secondaries |
| Thunder Wave | `port` | data: status |
| Thunderbolt | `port` | data: secondaries |
| Thunderclap | `port` | data: basePower |
| Thunderous Kick | `port` | data: secondaries |
| Tickle | `port` | data: boosts |
| Tidy Up | `port` | registry: effects/moves.ts |
| Topsy-Turvy | `port` | data: flags.protect |
| Torch Song | `port` | data: secondaries |
| Torment | `port` | data: flags.protect |
| Toxic | `port` | data: status |
| Toxic Spikes | `excluded` | entry hazards are not modelled |
| Toxic Thread | `port` | data: status |
| Trailblaze | `port` | data: secondaries |
| Transform | `port` | registry: effects/moves.ts |
| Tri Attack | `port` | data: basePower |
| Trick | `port` | data: flags.protect |
| Trick Room | `port` | registry: effects/moves.ts |
| Trick-or-Treat | `port` | data: flags.protect |
| Triple Arrows | `port` | data: secondaries |
| Triple Axel | `port` | data: multihit |
| Triple Dive | `port` | data: multihit |
| Triple Kick | `port` | data: multihit |
| Trop Kick | `port` | data: secondaries |
| Trump Card | `excluded` | no playable species has it |
| Twin Beam | `port` | data: multihit |
| Twineedle | `port` | data: secondaries |
| Twister | `port` | data: secondaries |
| U-turn | `port` | data: selfSwitch |
| Upper Hand | `port` | data: secondaries |
| Uproar | `port` | data: basePower |
| Vacuum Wave | `port` | data: basePower |
| Veevee Volley | `excluded` | no playable species has it |
| Venom Drench | `port` | data: flags.protect |
| Venoshock | `port` | data: basePower |
| Victory Dance | `port` | data: boosts |
| Vine Whip | `port` | data: basePower |
| Vise Grip | `port` | data: basePower |
| Vital Throw | `port` | data: basePower |
| Volt Switch | `port` | data: selfSwitch |
| Volt Tackle | `port` | data: secondaries |
| Wake-Up Slap | `port` | data: basePower |
| Water Gun | `port` | data: basePower |
| Water Pledge | `port` | data: basePower |
| Water Pulse | `port` | data: secondaries |
| Water Shuriken | `port` | data: multihit |
| Water Sport | `port` | registry: effects/moves.ts |
| Water Spout | `port` | data: basePower |
| Waterfall | `port` | data: secondaries |
| Wave Crash | `port` | data: recoil |
| Weather Ball | `port` | registry: effects/moves.ts |
| Whirlpool | `port` | data: volatileStatus |
| Whirlwind | `excluded` | no forced-switch mechanic |
| Wicked Blow | `port` | data: basePower |
| Wide Guard | `excluded` | doubles/ally only |
| Wild Charge | `port` | data: recoil |
| Wildbolt Storm | `port` | data: secondaries |
| Will-O-Wisp | `port` | data: status |
| Wing Attack | `port` | data: basePower |
| Wish | `port` | turn loop: turn.ts |
| Withdraw | `port` | data: boosts |
| Wonder Room | `port` | registry: effects/moves.ts |
| Wood Hammer | `port` | data: recoil |
| Work Up | `port` | data: boosts |
| Worry Seed | `port` | data: flags.protect |
| Wrap | `port` | data: volatileStatus |
| Wring Out | `port` | data: flags.protect |
| X-Scissor | `port` | data: basePower |
| Yawn | `port` | data: volatileStatus |
| Zap Cannon | `port` | data: secondaries |
| Zen Headbutt | `port` | data: secondaries |
| Zing Zap | `port` | data: secondaries |
| Zippy Zap | `excluded` | no playable species has it |

## Items — 290 total (138 port, 71 no-op, 81 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Ability Shield | `no-op` | reachable, not modelled yet |
| Absorb Bulb | `no-op` | reachable, not modelled yet |
| Adamant Crystal | `no-op` | reachable, not modelled yet |
| Adamant Orb | `no-op` | reachable, not modelled yet |
| Adrenaline Orb | `excluded` | not in the run catalogue |
| Aguav Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Air Balloon | `no-op` | reachable, not modelled yet |
| Antidote | `port` | in the run catalogue (`src/data/items.ts`) |
| Apicot Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Aspear Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Assault Vest | `no-op` | reachable, not modelled yet |
| Auspicious Armor | `excluded` | not in the run catalogue |
| Awakening | `port` | in the run catalogue (`src/data/items.ts`) |
| Babiri Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Beast Ball | `excluded` | not in the run catalogue |
| Berry Sweet | `excluded` | not in the run catalogue |
| Big Nugget | `port` | in the run catalogue (`src/data/items.ts`) |
| Big Pearl | `port` | in the run catalogue (`src/data/items.ts`) |
| Big Root | `no-op` | reachable, not modelled yet |
| Binding Band | `no-op` | reachable, not modelled yet |
| Black Belt | `port` | in the run catalogue (`src/data/items.ts`) |
| Black Glasses | `port` | in the run catalogue (`src/data/items.ts`) |
| Black Sludge | `no-op` | reachable, not modelled yet |
| Blunder Policy | `no-op` | reachable, not modelled yet |
| Booster Energy | `no-op` | reachable, not modelled yet |
| Bottle Cap | `excluded` | not in the run catalogue |
| Bright Powder | `no-op` | reachable, not modelled yet |
| Bug Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Burn Drive | `port` | in the run catalogue (`src/data/items.ts`) |
| Burn Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Cell Battery | `no-op` | reachable, not modelled yet |
| Charcoal | `port` | in the run catalogue (`src/data/items.ts`) |
| Charti Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Cheri Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Chesto Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Chilan Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Chill Drive | `port` | in the run catalogue (`src/data/items.ts`) |
| Chipped Pot | `excluded` | not in the run catalogue |
| Choice Band | `port` | in the run catalogue (`src/data/items.ts`) |
| Choice Scarf | `port` | in the run catalogue (`src/data/items.ts`) |
| Choice Specs | `port` | in the run catalogue (`src/data/items.ts`) |
| Chople Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Clear Amulet | `no-op` | reachable, not modelled yet |
| Clover Sweet | `excluded` | not in the run catalogue |
| Coba Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Colbur Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Comet Shard | `port` | in the run catalogue (`src/data/items.ts`) |
| Cornerstone Mask | `excluded` | not in the run catalogue |
| Covert Cloak | `no-op` | reachable, not modelled yet |
| Cracked Pot | `excluded` | not in the run catalogue |
| Custap Berry | `no-op` | reachable, not modelled yet |
| Damp Rock | `no-op` | reachable, not modelled yet |
| Dark Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Dawn Stone | `excluded` | not in the run catalogue |
| Destiny Knot | `excluded` | not in the run catalogue |
| Dive Ball | `excluded` | not in the run catalogue |
| Douse Drive | `port` | in the run catalogue (`src/data/items.ts`) |
| Draco Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Dragon Fang | `port` | in the run catalogue (`src/data/items.ts`) |
| Dragon Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Dragon Scale | `excluded` | not in the run catalogue |
| Dread Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Dream Ball | `excluded` | not in the run catalogue |
| Dubious Disc | `excluded` | not in the run catalogue |
| Dusk Ball | `excluded` | not in the run catalogue |
| Dusk Stone | `excluded` | not in the run catalogue |
| Earth Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Egg | `port` | in the run catalogue (`src/data/items.ts`) |
| Eject Button | `no-op` | reachable, not modelled yet |
| Eject Pack | `no-op` | reachable, not modelled yet |
| Electirizer | `excluded` | not in the run catalogue |
| Electric Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Electric Seed | `no-op` | reachable, not modelled yet |
| Enigma Berry | `no-op` | reachable, not modelled yet |
| Eviolite | `no-op` | reachable, not modelled yet |
| Expert Belt | `port` | in the run catalogue (`src/data/items.ts`) |
| Fairy Feather | `port` | in the run catalogue (`src/data/items.ts`) |
| Fairy Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Fast Ball | `excluded` | not in the run catalogue |
| Fighting Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Figy Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Fire Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Fire Stone | `excluded` | not in the run catalogue |
| Fist Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Flame Orb | `port` | in the run catalogue (`src/data/items.ts`) |
| Flame Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Float Stone | `no-op` | reachable, not modelled yet |
| Flower Sweet | `excluded` | not in the run catalogue |
| Flying Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Focus Band | `port` | in the run catalogue (`src/data/items.ts`) |
| Focus Sash | `port` | in the run catalogue (`src/data/items.ts`) |
| Friend Ball | `excluded` | not in the run catalogue |
| Full Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Full Restore | `port` | in the run catalogue (`src/data/items.ts`) |
| Galarica Cuff | `excluded` | not in the run catalogue |
| Galarica Wreath | `excluded` | not in the run catalogue |
| Ganlon Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Ghost Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Gold Bottle Cap | `excluded` | not in the run catalogue |
| Grass Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Grassy Seed | `no-op` | reachable, not modelled yet |
| Great Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Grepa Berry | `excluded` | not in the run catalogue |
| Grip Claw | `no-op` | reachable, not modelled yet |
| Griseous Core | `no-op` | reachable, not modelled yet |
| Griseous Orb | `no-op` | reachable, not modelled yet |
| Ground Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Haban Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Hard Stone | `port` | in the run catalogue (`src/data/items.ts`) |
| Heal Ball | `excluded` | not in the run catalogue |
| Hearthflame Mask | `excluded` | not in the run catalogue |
| Heat Rock | `no-op` | reachable, not modelled yet |
| Heavy Ball | `excluded` | not in the run catalogue |
| Heavy-Duty Boots | `no-op` | reachable, not modelled yet |
| Hondew Berry | `excluded` | not in the run catalogue |
| Hyper Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Iapapa Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Ice Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Ice Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Ice Stone | `excluded` | not in the run catalogue |
| Icicle Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Icy Rock | `no-op` | reachable, not modelled yet |
| Insect Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Iron Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Iron Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Jaboca Berry | `no-op` | reachable, not modelled yet |
| Kasib Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Kebia Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Kee Berry | `no-op` | reachable, not modelled yet |
| Kelpsy Berry | `excluded` | not in the run catalogue |
| King's Rock | `no-op` | reachable, not modelled yet |
| Lagging Tail | `port` | in the run catalogue (`src/data/items.ts`) |
| Lansat Berry | `no-op` | reachable, not modelled yet |
| Leaf Stone | `excluded` | not in the run catalogue |
| Leftovers | `port` | in the run catalogue (`src/data/items.ts`) |
| Leppa Berry | `no-op` | reachable, not modelled yet |
| Level Ball | `excluded` | not in the run catalogue |
| Liechi Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Life Orb | `port` | in the run catalogue (`src/data/items.ts`) |
| Light Ball | `no-op` | reachable, not modelled yet |
| Light Clay | `no-op` | reachable, not modelled yet |
| Loaded Dice | `no-op` | reachable, not modelled yet |
| Love Ball | `excluded` | not in the run catalogue |
| Love Sweet | `excluded` | not in the run catalogue |
| Lum Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Luminous Moss | `no-op` | reachable, not modelled yet |
| Lure Ball | `excluded` | not in the run catalogue |
| Lustrous Globe | `no-op` | reachable, not modelled yet |
| Lustrous Orb | `no-op` | reachable, not modelled yet |
| Luxury Ball | `excluded` | not in the run catalogue |
| Magmarizer | `excluded` | not in the run catalogue |
| Magnet | `port` | in the run catalogue (`src/data/items.ts`) |
| Mago Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Malicious Armor | `excluded` | not in the run catalogue |
| Maranga Berry | `no-op` | reachable, not modelled yet |
| Master Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Masterpiece Teacup | `excluded` | not in the run catalogue |
| Meadow Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Mental Herb | `no-op` | reachable, not modelled yet |
| Metal Alloy | `excluded` | not in the run catalogue |
| Metal Coat | `port` | in the run catalogue (`src/data/items.ts`) |
| Metronome | `no-op` | reachable, not modelled yet |
| Micle Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Mind Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Miracle Seed | `port` | in the run catalogue (`src/data/items.ts`) |
| Mirror Herb | `no-op` | reachable, not modelled yet |
| Misty Seed | `no-op` | reachable, not modelled yet |
| Moon Ball | `excluded` | not in the run catalogue |
| Moon Stone | `excluded` | not in the run catalogue |
| Muscle Band | `port` | in the run catalogue (`src/data/items.ts`) |
| Mystic Water | `port` | in the run catalogue (`src/data/items.ts`) |
| Nest Ball | `excluded` | not in the run catalogue |
| Net Ball | `excluded` | not in the run catalogue |
| Never-Melt Ice | `port` | in the run catalogue (`src/data/items.ts`) |
| Normal Gem | `port` | in the run catalogue (`src/data/items.ts`) |
| Nugget | `port` | in the run catalogue (`src/data/items.ts`) |
| Occa Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Oran Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Oval Stone | `excluded` | not in the run catalogue |
| Paralyze Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Passho Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Payapa Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Pearl | `port` | in the run catalogue (`src/data/items.ts`) |
| Pearl String | `port` | in the run catalogue (`src/data/items.ts`) |
| Pecha Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Persim Berry | `no-op` | reachable, not modelled yet |
| Petaya Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Pixie Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Poison Barb | `port` | in the run catalogue (`src/data/items.ts`) |
| Poison Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Poke Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Pomeg Berry | `excluded` | not in the run catalogue |
| Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Power Anklet | `excluded` | not in the run catalogue |
| Power Band | `excluded` | not in the run catalogue |
| Power Belt | `excluded` | not in the run catalogue |
| Power Bracer | `excluded` | not in the run catalogue |
| Power Herb | `no-op` | reachable, not modelled yet |
| Power Lens | `excluded` | not in the run catalogue |
| Power Weight | `excluded` | not in the run catalogue |
| Premier Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Pretty Feather | `excluded` | not in the run catalogue |
| Prism Scale | `excluded` | not in the run catalogue |
| Protective Pads | `no-op` | reachable, not modelled yet |
| Protector | `excluded` | not in the run catalogue |
| Psychic Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Psychic Seed | `no-op` | reachable, not modelled yet |
| Punching Glove | `no-op` | reachable, not modelled yet |
| Qualot Berry | `excluded` | not in the run catalogue |
| Quick Ball | `excluded` | not in the run catalogue |
| Quick Claw | `no-op` | reachable, not modelled yet |
| Rare Bone | `port` | in the run catalogue (`src/data/items.ts`) |
| Rawst Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Razor Claw | `port` | in the run catalogue (`src/data/items.ts`) |
| Razor Fang | `no-op` | reachable, not modelled yet |
| Reaper Cloth | `excluded` | not in the run catalogue |
| Red Card | `no-op` | reachable, not modelled yet |
| Repeat Ball | `excluded` | not in the run catalogue |
| Ribbon Sweet | `excluded` | not in the run catalogue |
| Rindo Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Ring Target | `no-op` | reachable, not modelled yet |
| Rock Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Rocky Helmet | `no-op` | reachable, not modelled yet |
| Room Service | `no-op` | reachable, not modelled yet |
| Roseli Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Rowap Berry | `no-op` | reachable, not modelled yet |
| Rusted Shield | `excluded` | not in the run catalogue |
| Rusted Sword | `excluded` | not in the run catalogue |
| Safari Ball | `excluded` | not in the run catalogue |
| Safety Goggles | `no-op` | reachable, not modelled yet |
| Salac Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Scope Lens | `port` | in the run catalogue (`src/data/items.ts`) |
| Sharp Beak | `port` | in the run catalogue (`src/data/items.ts`) |
| Shed Shell | `no-op` | reachable, not modelled yet |
| Shell Bell | `no-op` | reachable, not modelled yet |
| Shiny Stone | `excluded` | not in the run catalogue |
| Shock Drive | `port` | in the run catalogue (`src/data/items.ts`) |
| Shuca Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Silk Scarf | `port` | in the run catalogue (`src/data/items.ts`) |
| Silver Powder | `port` | in the run catalogue (`src/data/items.ts`) |
| Sitrus Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Sky Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Smoke Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Smooth Rock | `excluded` | not in the run catalogue |
| Snowball | `no-op` | reachable, not modelled yet |
| Soft Sand | `port` | in the run catalogue (`src/data/items.ts`) |
| Soul Dew | `no-op` | reachable, not modelled yet |
| Spell Tag | `port` | in the run catalogue (`src/data/items.ts`) |
| Spiced Stew | `port` | in the run catalogue (`src/data/items.ts`) |
| Splash Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Spooky Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Sport Ball | `excluded` | not in the run catalogue |
| Star Piece | `port` | in the run catalogue (`src/data/items.ts`) |
| Star Sweet | `excluded` | not in the run catalogue |
| Stardust | `port` | in the run catalogue (`src/data/items.ts`) |
| Starf Berry | `no-op` | reachable, not modelled yet |
| Steel Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Sticky Barb | `no-op` | reachable, not modelled yet |
| Stone Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Strawberry Sweet | `excluded` | not in the run catalogue |
| Sun Stone | `excluded` | not in the run catalogue |
| Super Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Sweet Apple | `excluded` | not in the run catalogue |
| Syrupy Apple | `excluded` | not in the run catalogue |
| Tamato Berry | `no-op` | reachable, not modelled yet |
| Tanga Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Tart Apple | `excluded` | not in the run catalogue |
| Terrain Extender | `no-op` | reachable, not modelled yet |
| Throat Spray | `no-op` | reachable, not modelled yet |
| Thunder Stone | `excluded` | not in the run catalogue |
| Timer Ball | `excluded` | not in the run catalogue |
| Toxic Orb | `port` | in the run catalogue (`src/data/items.ts`) |
| Toxic Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Twisted Spoon | `port` | in the run catalogue (`src/data/items.ts`) |
| Ultra Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Unremarkable Teacup | `excluded` | not in the run catalogue |
| Up-Grade | `excluded` | not in the run catalogue |
| Utility Umbrella | `no-op` | reachable, not modelled yet |
| Wacan Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Water Memory | `port` | in the run catalogue (`src/data/items.ts`) |
| Water Stone | `excluded` | not in the run catalogue |
| Weakness Policy | `no-op` | reachable, not modelled yet |
| Wellspring Mask | `excluded` | not in the run catalogue |
| White Herb | `no-op` | reachable, not modelled yet |
| Wide Lens | `port` | in the run catalogue (`src/data/items.ts`) |
| Wiki Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Wise Glasses | `port` | in the run catalogue (`src/data/items.ts`) |
| Yache Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Zap Plate | `port` | in the run catalogue (`src/data/items.ts`) |
| Zoom Lens | `excluded` | not in the run catalogue |

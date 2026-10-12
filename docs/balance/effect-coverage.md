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
- For a move, `port` means a registered handler, an id the turn loop
  special-cases, or a data-driven field the engine reads; `no-op` means a run
  can meet the move and nothing happens.

The run only ever hands out the items in `src/data/items.ts`, so a dex item that
is not in that catalogue is `excluded` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — 311 total (250 port, 24 no-op, 37 excluded)

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
| Aura Break | `no-op` | reachable, not ported yet |
| Bad Dreams | `port` | ported in `effects/abilities.ts` |
| Ball Fetch | `no-op` | reachable, not ported yet |
| Battery | `excluded` | doubles/ally only |
| Battle Armor | `port` | ported in `effects/abilities.ts` |
| Battle Bond | `port` | ported in `effects/abilities.ts` |
| Beads of Ruin | `port` | ported in `effects/abilities.ts` |
| Beast Boost | `no-op` | reachable, not ported yet |
| Berserk | `port` | ported in `effects/abilities.ts` |
| Big Pecks | `port` | ported in `effects/abilities.ts` |
| Blaze | `port` | ported in `effects/abilities.ts` |
| Bulletproof | `port` | ported in `effects/abilities.ts` |
| Cheek Pouch | `port` | ported in `effects/abilities.ts` |
| Chilling Neigh | `port` | ported in `effects/abilities.ts` |
| Chlorophyll | `port` | ported in `effects/abilities.ts` |
| Clear Body | `port` | ported in `effects/abilities.ts` |
| Cloud Nine | `port` | ported in `effects/abilities.ts` |
| Color Change | `no-op` | reachable, not ported yet |
| Comatose | `port` | ported in `effects/abilities.ts` |
| Commander | `excluded` | doubles/ally only |
| Competitive | `port` | ported in `effects/abilities.ts` |
| Compound Eyes | `port` | ported in `effects/abilities.ts` |
| Contrary | `port` | ported in `effects/abilities.ts` |
| Corrosion | `port` | ported in `effects/abilities.ts` |
| Costar | `excluded` | doubles/ally only |
| Cotton Down | `no-op` | reachable, not ported yet |
| Cud Chew | `port` | ported in `effects/abilities.ts` |
| Curious Medicine | `excluded` | doubles/ally only |
| Cursed Body | `port` | ported in `effects/abilities.ts` |
| Cute Charm | `port` | ported in `effects/abilities.ts` |
| Damp | `port` | ported in `effects/abilities.ts` |
| Dancer | `port` | ported in `effects/abilities.ts` |
| Dark Aura | `no-op` | reachable, not ported yet |
| Dauntless Shield | `port` | ported in `effects/abilities.ts` |
| Dazzling | `port` | ported in `effects/abilities.ts` |
| Defeatist | `no-op` | reachable, not ported yet |
| Defiant | `port` | ported in `effects/abilities.ts` |
| Delta Stream | `excluded` | no playable species has it |
| Desolate Land | `no-op` | reachable, not ported yet |
| Disguise | `port` | ported in `effects/abilities.ts` |
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
| Emergency Exit | `no-op` | reachable, not ported yet |
| Fairy Aura | `no-op` | reachable, not ported yet |
| Filter | `port` | ported in `effects/abilities.ts` |
| Flame Body | `port` | ported in `effects/abilities.ts` |
| Flare Boost | `port` | ported in `effects/abilities.ts` |
| Flash Fire | `port` | ported in `effects/abilities.ts` |
| Flower Gift | `port` | ported in `effects/abilities.ts` |
| Flower Veil | `excluded` | doubles/ally only |
| Fluffy | `port` | ported in `effects/abilities.ts` |
| Forecast | `port` | ported in `effects/abilities.ts` |
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
| Gorilla Tactics | `no-op` | reachable, not ported yet |
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
| Honey Gather | `excluded` | out of battle only |
| Hospitality | `excluded` | doubles/ally only |
| Huge Power | `port` | ported in `effects/abilities.ts` |
| Hunger Switch | `port` | ported in `effects/abilities.ts` |
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
| Innards Out | `no-op` | reachable, not ported yet |
| Inner Focus | `port` | ported in `effects/abilities.ts` |
| Insomnia | `port` | ported in `effects/abilities.ts` |
| Intimidate | `port` | ported in `effects/abilities.ts` |
| Intrepid Sword | `port` | ported in `effects/abilities.ts` |
| Iron Barbs | `no-op` | reachable, not ported yet |
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
| Mimicry | `no-op` | reachable, not ported yet |
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
| Mummy | `no-op` | reachable, not ported yet |
| Mycelium Might | `port` | ported in `effects/abilities.ts` |
| Natural Cure | `port` | ported in `effects/abilities.ts` |
| Neuroforce | `no-op` | reachable, not ported yet |
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
| Pastel Veil | `no-op` | reachable, not ported yet |
| Perish Body | `no-op` | reachable, not ported yet |
| Pickpocket | `port` | ported in `effects/abilities.ts` |
| Pickup | `excluded` | out of battle only |
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
| Primordial Sea | `no-op` | reachable, not ported yet |
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
| Schooling | `port` | ported in `effects/abilities.ts` |
| Scrappy | `port` | ported in `effects/abilities.ts` |
| Screen Cleaner | `no-op` | reachable, not ported yet |
| Seed Sower | `port` | ported in `effects/abilities.ts` |
| Serene Grace | `port` | ported in `effects/abilities.ts` |
| Shadow Shield | `port` | ported in `effects/abilities.ts` |
| Shadow Tag | `port` | ported in `effects/abilities.ts` |
| Sharpness | `port` | ported in `effects/abilities.ts` |
| Shed Skin | `port` | ported in `effects/abilities.ts` |
| Sheer Force | `port` | ported in `effects/abilities.ts` |
| Shell Armor | `port` | ported in `effects/abilities.ts` |
| Shield Dust | `port` | ported in `effects/abilities.ts` |
| Shields Down | `port` | ported in `effects/abilities.ts` |
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
| Stance Change | `port` | ported in `effects/abilities.ts` |
| Static | `port` | ported in `effects/abilities.ts` |
| Steadfast | `port` | ported in `effects/abilities.ts` |
| Steam Engine | `port` | ported in `effects/abilities.ts` |
| Steelworker | `no-op` | reachable, not ported yet |
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
| Tera Shift | `port` | ported in `effects/abilities.ts` |
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
| Victory Star | `no-op` | reachable, not ported yet |
| Vital Spirit | `port` | ported in `effects/abilities.ts` |
| Volt Absorb | `port` | ported in `effects/abilities.ts` |
| Wandering Spirit | `no-op` | reachable, not ported yet |
| Water Absorb | `port` | ported in `effects/abilities.ts` |
| Water Bubble | `port` | ported in `effects/abilities.ts` |
| Water Compaction | `port` | ported in `effects/abilities.ts` |
| Water Veil | `port` | ported in `effects/abilities.ts` |
| Weak Armor | `port` | ported in `effects/abilities.ts` |
| Well-Baked Body | `port` | ported in `effects/abilities.ts` |
| White Smoke | `port` | ported in `effects/abilities.ts` |
| Wimp Out | `no-op` | reachable, not ported yet |
| Wind Power | `port` | ported in `effects/abilities.ts` |
| Wind Rider | `port` | ported in `effects/abilities.ts` |
| Wonder Guard | `port` | ported in `effects/abilities.ts` |
| Wonder Skin | `port` | ported in `effects/abilities.ts` |
| Zen Mode | `port` | ported in `effects/abilities.ts` |
| Zen Mode (Galar) | `port` | ported in `effects/abilities.ts` |
| Zero to Hero | `port` | ported in `effects/abilities.ts` |

## Moves — 835 total (718 port, 86 no-op, 31 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Absorb | `port` | data: drain |
| Accelerock | `port` | data: basePower |
| Acid | `port` | data: secondaries |
| Acid Armor | `port` | data: boosts |
| Acid Spray | `port` | data: secondaries |
| Acrobatics | `port` | data: basePower |
| Acupressure | `no-op` | reachable, not ported yet |
| Aerial Ace | `port` | data: basePower |
| Aeroblast | `port` | data: basePower |
| After You | `no-op` | reachable, not ported yet |
| Agility | `port` | data: boosts |
| Air Cutter | `port` | data: basePower |
| Air Slash | `port` | data: secondaries |
| Alluring Voice | `port` | data: basePower |
| Ally Switch | `no-op` | reachable, not ported yet |
| Amnesia | `port` | data: boosts |
| Anchor Shot | `port` | data: basePower |
| Ancient Power | `port` | data: secondaries |
| Apple Acid | `port` | data: secondaries |
| Aqua Cutter | `port` | data: basePower |
| Aqua Jet | `port` | data: basePower |
| Aqua Ring | `no-op` | reachable, not ported yet |
| Aqua Step | `port` | data: secondaries |
| Aqua Tail | `port` | data: basePower |
| Arm Thrust | `port` | data: multihit |
| Armor Cannon | `port` | data: self.boosts |
| Aromatherapy | `no-op` | reachable, not ported yet |
| Aromatic Mist | `port` | data: boosts |
| Assist | `no-op` | reachable, not ported yet |
| Assurance | `port` | data: basePower |
| Astonish | `port` | data: secondaries |
| Astral Barrage | `port` | data: basePower |
| Attack Order | `port` | data: basePower |
| Attract | `port` | data: flags.protect |
| Aura Sphere | `port` | data: basePower |
| Aura Wheel | `port` | registry: effects/moves.ts |
| Aurora Beam | `port` | data: secondaries |
| Aurora Veil | `no-op` | reachable, not ported yet |
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
| Belly Drum | `no-op` | reachable, not ported yet |
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
| Block | `no-op` | reachable, not ported yet |
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
| Camouflage | `no-op` | reachable, not ported yet |
| Captivate | `port` | data: boosts |
| Ceaseless Edge | `port` | data: basePower |
| Celebrate | `no-op` | reachable, not ported yet |
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
| Conversion | `no-op` | reachable, not ported yet |
| Conversion 2 | `no-op` | reachable, not ported yet |
| Copycat | `no-op` | reachable, not ported yet |
| Core Enforcer | `port` | data: basePower |
| Cosmic Power | `port` | data: boosts |
| Cotton Guard | `port` | data: boosts |
| Cotton Spore | `port` | data: boosts |
| Counter | `port` | turn loop: turn.ts |
| Court Change | `no-op` | reachable, not ported yet |
| Covet | `port` | data: basePower |
| Crabhammer | `port` | data: basePower |
| Crafty Shield | `no-op` | reachable, not ported yet |
| Cross Chop | `port` | data: basePower |
| Cross Poison | `port` | data: secondaries |
| Crunch | `port` | data: secondaries |
| Crush Claw | `port` | data: secondaries |
| Crush Grip | `port` | data: flags.protect |
| Curse | `no-op` | reachable, not ported yet |
| Dark Pulse | `port` | data: secondaries |
| Dark Void | `port` | data: status |
| Darkest Lariat | `port` | data: basePower |
| Dazzling Gleam | `port` | data: basePower |
| Decorate | `port` | data: boosts |
| Defend Order | `port` | data: boosts |
| Defense Curl | `port` | data: boosts |
| Defog | `port` | data: flags.protect |
| Destiny Bond | `no-op` | reachable, not ported yet |
| Detect | `port` | registry: effects/moves.ts |
| Diamond Storm | `port` | data: self.boosts |
| Dig | `port` | data: flags.charge |
| Dire Claw | `port` | data: basePower |
| Disable | `port` | data: flags.protect |
| Disarming Voice | `port` | data: basePower |
| Discharge | `port` | data: secondaries |
| Dive | `port` | data: flags.charge |
| Dizzy Punch | `port` | data: secondaries |
| Doodle | `no-op` | reachable, not ported yet |
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
| Dragon Cheer | `no-op` | reachable, not ported yet |
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
| Endure | `no-op` | reachable, not ported yet |
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
| Fairy Lock | `no-op` | reachable, not ported yet |
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
| Flower Shield | `no-op` | reachable, not ported yet |
| Flower Trick | `port` | data: basePower |
| Fly | `port` | data: flags.charge |
| Flying Press | `port` | data: basePower |
| Focus Blast | `port` | data: secondaries |
| Focus Energy | `no-op` | reachable, not ported yet |
| Focus Punch | `port` | data: basePower |
| Follow Me | `no-op` | reachable, not ported yet |
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
| Gear Up | `no-op` | reachable, not ported yet |
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
| Gravity | `no-op` | reachable, not ported yet |
| Growl | `port` | data: boosts |
| Growth | `port` | data: boosts |
| Grudge | `no-op` | reachable, not ported yet |
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
| Haze | `no-op` | reachable, not ported yet |
| Head Charge | `port` | data: recoil |
| Head Smash | `port` | data: recoil |
| Headbutt | `port` | data: secondaries |
| Headlong Rush | `port` | data: self.boosts |
| Heal Bell | `no-op` | reachable, not ported yet |
| Heal Block | `excluded` | no playable species has it |
| Heal Order | `excluded` | no playable species has it |
| Heal Pulse | `port` | data: flags.protect |
| Healing Wish | `port` | data: selfdestruct |
| Heart Stamp | `excluded` | no playable species has it |
| Heart Swap | `port` | data: flags.protect |
| Heat Crash | `port` | data: flags.protect |
| Heat Wave | `port` | data: secondaries |
| Heavy Slam | `port` | data: flags.protect |
| Helping Hand | `no-op` | reachable, not ported yet |
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
| Imprison | `no-op` | reachable, not ported yet |
| Incinerate | `port` | data: basePower |
| Infernal Parade | `port` | data: secondaries |
| Inferno | `port` | data: secondaries |
| Infestation | `port` | data: volatileStatus |
| Ingrain | `no-op` | reachable, not ported yet |
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
| Jungle Healing | `no-op` | reachable, not ported yet |
| Karate Chop | `port` | data: basePower |
| Kinesis | `port` | data: boosts |
| King's Shield | `no-op` | reachable, not ported yet |
| Knock Off | `port` | data: basePower |
| Kowtow Cleave | `port` | data: basePower |
| Land's Wrath | `port` | data: basePower |
| Laser Focus | `no-op` | reachable, not ported yet |
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
| Light Screen | `no-op` | reachable, not ported yet |
| Liquidation | `port` | data: secondaries |
| Lock-On | `port` | data: flags.protect |
| Lovely Kiss | `port` | data: status |
| Low Kick | `port` | data: flags.protect |
| Low Sweep | `port` | data: secondaries |
| Lucky Chant | `no-op` | reachable, not ported yet |
| Lumina Crash | `port` | data: secondaries |
| Lunar Blessing | `no-op` | reachable, not ported yet |
| Lunar Dance | `port` | data: selfdestruct |
| Lunge | `port` | data: secondaries |
| Luster Purge | `port` | data: secondaries |
| Mach Punch | `port` | data: basePower |
| Magic Coat | `no-op` | reachable, not ported yet |
| Magic Powder | `port` | data: flags.protect |
| Magic Room | `no-op` | reachable, not ported yet |
| Magical Leaf | `port` | data: basePower |
| Magma Storm | `port` | data: volatileStatus |
| Magnet Bomb | `excluded` | no playable species has it |
| Magnet Rise | `no-op` | reachable, not ported yet |
| Magnetic Flux | `no-op` | reachable, not ported yet |
| Magnitude | `excluded` | no playable species has it |
| Make It Rain | `port` | data: self.boosts |
| Malignant Chain | `port` | data: secondaries |
| Mat Block | `excluded` | no playable species has it |
| Matcha Gotcha | `port` | data: secondaries |
| Me First | `excluded` | no playable species has it |
| Mean Look | `no-op` | reachable, not ported yet |
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
| Metronome | `no-op` | reachable, not ported yet |
| Mighty Cleave | `port` | data: basePower |
| Milk Drink | `port` | data: heal |
| Mimic | `port` | data: flags.protect |
| Mind Blown | `port` | data: basePower |
| Mind Reader | `port` | data: flags.protect |
| Minimize | `port` | data: boosts |
| Miracle Eye | `excluded` | no playable species has it |
| Mirror Coat | `port` | turn loop: turn.ts |
| Mirror Move | `no-op` | reachable, not ported yet |
| Mirror Shot | `port` | data: secondaries |
| Mist | `no-op` | reachable, not ported yet |
| Mist Ball | `port` | data: secondaries |
| Misty Explosion | `port` | data: selfdestruct |
| Misty Terrain | `port` | data: terrain |
| Moonblast | `port` | data: secondaries |
| Moongeist Beam | `port` | data: basePower |
| Moonlight | `no-op` | reachable, not ported yet |
| Morning Sun | `no-op` | reachable, not ported yet |
| Mortal Spin | `port` | data: secondaries |
| Mountain Gale | `port` | data: secondaries |
| Mud Bomb | `port` | data: secondaries |
| Mud Shot | `port` | data: secondaries |
| Mud Sport | `no-op` | reachable, not ported yet |
| Mud-Slap | `port` | data: secondaries |
| Muddy Water | `port` | data: secondaries |
| Multi-Attack | `port` | data: basePower |
| Mystical Fire | `port` | data: secondaries |
| Mystical Power | `port` | data: secondaries |
| Nasty Plot | `port` | data: boosts |
| Natural Gift | `port` | data: flags.protect |
| Nature Power | `no-op` | reachable, not ported yet |
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
| Obstruct | `no-op` | reachable, not ported yet |
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
| Perish Song | `no-op` | reachable, not ported yet |
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
| Power Trick | `no-op` | reachable, not ported yet |
| Power Trip | `port` | data: basePower |
| Power Whip | `port` | data: basePower |
| Power-Up Punch | `port` | data: secondaries |
| Precipice Blades | `port` | data: basePower |
| Present | `port` | data: flags.protect |
| Prismatic Laser | `port` | data: basePower |
| Protect | `port` | registry: effects/moves.ts |
| Psybeam | `port` | data: secondaries |
| Psyblade | `port` | data: basePower |
| Psych Up | `no-op` | reachable, not ported yet |
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
| Quick Guard | `no-op` | reachable, not ported yet |
| Quiver Dance | `port` | data: boosts |
| Rage | `port` | data: basePower |
| Rage Fist | `port` | data: basePower |
| Rage Powder | `no-op` | reachable, not ported yet |
| Raging Bull | `port` | data: basePower |
| Raging Fury | `port` | data: basePower |
| Rain Dance | `port` | data: weather |
| Rapid Spin | `port` | data: secondaries |
| Razor Leaf | `port` | data: basePower |
| Razor Shell | `port` | data: secondaries |
| Razor Wind | `port` | data: flags.charge |
| Recover | `port` | data: heal |
| Recycle | `port` | registry: effects/moves.ts |
| Reflect | `no-op` | reachable, not ported yet |
| Reflect Type | `port` | data: flags.protect |
| Refresh | `no-op` | reachable, not ported yet |
| Relic Song | `port` | data: secondaries |
| Rest | `no-op` | reachable, not ported yet |
| Retaliate | `port` | data: basePower |
| Return | `port` | data: flags.protect |
| Revelation Dance | `port` | registry: effects/moves.ts |
| Revenge | `port` | data: basePower |
| Reversal | `port` | data: flags.protect |
| Revival Blessing | `port` | data: selfSwitch |
| Rising Voltage | `port` | data: basePower |
| Roar | `no-op` | reachable, not ported yet |
| Roar of Time | `port` | data: basePower |
| Rock Blast | `port` | data: multihit |
| Rock Climb | `port` | data: secondaries |
| Rock Polish | `port` | data: boosts |
| Rock Slide | `port` | data: secondaries |
| Rock Smash | `port` | data: secondaries |
| Rock Throw | `port` | data: basePower |
| Rock Tomb | `port` | data: secondaries |
| Rock Wrecker | `port` | data: basePower |
| Role Play | `no-op` | reachable, not ported yet |
| Rolling Kick | `port` | data: secondaries |
| Rollout | `port` | data: basePower |
| Roost | `port` | data: heal |
| Rototiller | `no-op` | reachable, not ported yet |
| Round | `port` | data: basePower |
| Ruination | `port` | data: flags.protect |
| Sacred Fire | `port` | data: secondaries |
| Sacred Sword | `port` | data: basePower |
| Safeguard | `no-op` | reachable, not ported yet |
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
| Shore Up | `no-op` | reachable, not ported yet |
| Signal Beam | `port` | data: secondaries |
| Silk Trap | `port` | registry: effects/moves.ts |
| Silver Wind | `port` | data: secondaries |
| Simple Beam | `port` | data: flags.protect |
| Sing | `port` | data: status |
| Sizzly Slide | `excluded` | no playable species has it |
| Sketch | `no-op` | reachable, not ported yet |
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
| Sleep Talk | `no-op` | reachable, not ported yet |
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
| Snatch | `no-op` | reachable, not ported yet |
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
| Spikes | `no-op` | reachable, not ported yet |
| Spiky Shield | `port` | registry: effects/moves.ts |
| Spin Out | `port` | data: self.boosts |
| Spirit Break | `port` | data: secondaries |
| Spirit Shackle | `port` | data: basePower |
| Spit Up | `port` | data: flags.protect |
| Spite | `port` | data: flags.protect |
| Splash | `no-op` | reachable, not ported yet |
| Splishy Splash | `excluded` | no playable species has it |
| Spore | `port` | data: status |
| Spotlight | `port` | data: flags.protect |
| Springtide Storm | `port` | data: secondaries |
| Stealth Rock | `no-op` | reachable, not ported yet |
| Steam Eruption | `port` | data: secondaries |
| Steamroller | `excluded` | no playable species has it |
| Steel Beam | `port` | data: basePower |
| Steel Roller | `port` | data: basePower |
| Steel Wing | `port` | data: secondaries |
| Sticky Web | `no-op` | reachable, not ported yet |
| Stockpile | `no-op` | reachable, not ported yet |
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
| Stuff Cheeks | `no-op` | reachable, not ported yet |
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
| Swallow | `no-op` | reachable, not ported yet |
| Sweet Kiss | `port` | data: volatileStatus |
| Sweet Scent | `port` | data: boosts |
| Swift | `port` | data: basePower |
| Switcheroo | `port` | data: flags.protect |
| Swords Dance | `port` | data: boosts |
| Synchronoise | `port` | data: basePower |
| Synthesis | `no-op` | reachable, not ported yet |
| Syrup Bomb | `port` | data: basePower |
| Tachyon Cutter | `port` | data: multihit |
| Tackle | `port` | data: basePower |
| Tail Glow | `port` | data: boosts |
| Tail Slap | `port` | data: multihit |
| Tail Whip | `port` | data: boosts |
| Tailwind | `no-op` | reachable, not ported yet |
| Take Down | `port` | data: recoil |
| Take Heart | `no-op` | reachable, not ported yet |
| Tar Shot | `port` | data: boosts |
| Taunt | `port` | data: volatileStatus |
| Tearful Look | `port` | data: boosts |
| Teatime | `no-op` | reachable, not ported yet |
| Techno Blast | `port` | data: basePower |
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
| Tidy Up | `no-op` | reachable, not ported yet |
| Topsy-Turvy | `port` | data: flags.protect |
| Torch Song | `port` | data: secondaries |
| Torment | `port` | data: flags.protect |
| Toxic | `port` | data: status |
| Toxic Spikes | `no-op` | reachable, not ported yet |
| Toxic Thread | `port` | data: status |
| Trailblaze | `port` | data: secondaries |
| Transform | `port` | registry: effects/moves.ts |
| Tri Attack | `port` | data: basePower |
| Trick | `port` | data: flags.protect |
| Trick Room | `no-op` | reachable, not ported yet |
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
| Water Sport | `no-op` | reachable, not ported yet |
| Water Spout | `port` | data: basePower |
| Waterfall | `port` | data: secondaries |
| Wave Crash | `port` | data: recoil |
| Weather Ball | `port` | registry: effects/moves.ts |
| Whirlpool | `port` | data: volatileStatus |
| Whirlwind | `no-op` | reachable, not ported yet |
| Wicked Blow | `port` | data: basePower |
| Wide Guard | `no-op` | reachable, not ported yet |
| Wild Charge | `port` | data: recoil |
| Wildbolt Storm | `port` | data: secondaries |
| Will-O-Wisp | `port` | data: status |
| Wing Attack | `port` | data: basePower |
| Wish | `port` | turn loop: turn.ts |
| Withdraw | `port` | data: boosts |
| Wonder Room | `no-op` | reachable, not ported yet |
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

## Items — 269 total (49 port, 0 no-op, 220 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Ability Shield | `excluded` | not in the run catalogue |
| Absorb Bulb | `excluded` | not in the run catalogue |
| Adamant Crystal | `excluded` | not in the run catalogue |
| Adamant Orb | `excluded` | not in the run catalogue |
| Adrenaline Orb | `excluded` | not in the run catalogue |
| Aguav Berry | `excluded` | not in the run catalogue |
| Air Balloon | `excluded` | not in the run catalogue |
| Antidote | `port` | in the run catalogue (`src/data/items.ts`) |
| Apicot Berry | `excluded` | not in the run catalogue |
| Aspear Berry | `excluded` | not in the run catalogue |
| Assault Vest | `excluded` | not in the run catalogue |
| Auspicious Armor | `excluded` | not in the run catalogue |
| Awakening | `port` | in the run catalogue (`src/data/items.ts`) |
| Babiri Berry | `excluded` | not in the run catalogue |
| Beast Ball | `excluded` | not in the run catalogue |
| Berry Sweet | `excluded` | not in the run catalogue |
| Big Nugget | `port` | in the run catalogue (`src/data/items.ts`) |
| Big Pearl | `port` | in the run catalogue (`src/data/items.ts`) |
| Big Root | `excluded` | not in the run catalogue |
| Binding Band | `excluded` | not in the run catalogue |
| Black Belt | `port` | in the run catalogue (`src/data/items.ts`) |
| Black Glasses | `port` | in the run catalogue (`src/data/items.ts`) |
| Black Sludge | `excluded` | not in the run catalogue |
| Blunder Policy | `excluded` | not in the run catalogue |
| Booster Energy | `excluded` | not in the run catalogue |
| Bottle Cap | `excluded` | not in the run catalogue |
| Bright Powder | `excluded` | not in the run catalogue |
| Burn Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Cell Battery | `excluded` | not in the run catalogue |
| Charcoal | `port` | in the run catalogue (`src/data/items.ts`) |
| Charti Berry | `excluded` | not in the run catalogue |
| Cheri Berry | `excluded` | not in the run catalogue |
| Chesto Berry | `excluded` | not in the run catalogue |
| Chilan Berry | `excluded` | not in the run catalogue |
| Chipped Pot | `excluded` | not in the run catalogue |
| Choice Band | `excluded` | not in the run catalogue |
| Choice Scarf | `excluded` | not in the run catalogue |
| Choice Specs | `excluded` | not in the run catalogue |
| Chople Berry | `excluded` | not in the run catalogue |
| Clear Amulet | `excluded` | not in the run catalogue |
| Clover Sweet | `excluded` | not in the run catalogue |
| Coba Berry | `excluded` | not in the run catalogue |
| Colbur Berry | `excluded` | not in the run catalogue |
| Comet Shard | `port` | in the run catalogue (`src/data/items.ts`) |
| Cornerstone Mask | `excluded` | not in the run catalogue |
| Covert Cloak | `excluded` | not in the run catalogue |
| Cracked Pot | `excluded` | not in the run catalogue |
| Custap Berry | `excluded` | not in the run catalogue |
| Damp Rock | `excluded` | not in the run catalogue |
| Dawn Stone | `excluded` | not in the run catalogue |
| Destiny Knot | `excluded` | not in the run catalogue |
| Dive Ball | `excluded` | not in the run catalogue |
| Draco Plate | `excluded` | not in the run catalogue |
| Dragon Fang | `port` | in the run catalogue (`src/data/items.ts`) |
| Dragon Scale | `excluded` | not in the run catalogue |
| Dread Plate | `excluded` | not in the run catalogue |
| Dream Ball | `excluded` | not in the run catalogue |
| Dubious Disc | `excluded` | not in the run catalogue |
| Dusk Ball | `excluded` | not in the run catalogue |
| Dusk Stone | `excluded` | not in the run catalogue |
| Earth Plate | `excluded` | not in the run catalogue |
| Eject Button | `excluded` | not in the run catalogue |
| Eject Pack | `excluded` | not in the run catalogue |
| Electirizer | `excluded` | not in the run catalogue |
| Electric Seed | `excluded` | not in the run catalogue |
| Enigma Berry | `excluded` | not in the run catalogue |
| Eviolite | `excluded` | not in the run catalogue |
| Expert Belt | `excluded` | not in the run catalogue |
| Fairy Feather | `port` | in the run catalogue (`src/data/items.ts`) |
| Fast Ball | `excluded` | not in the run catalogue |
| Figy Berry | `excluded` | not in the run catalogue |
| Fire Stone | `excluded` | not in the run catalogue |
| Fist Plate | `excluded` | not in the run catalogue |
| Flame Orb | `excluded` | not in the run catalogue |
| Flame Plate | `excluded` | not in the run catalogue |
| Float Stone | `excluded` | not in the run catalogue |
| Flower Sweet | `excluded` | not in the run catalogue |
| Focus Band | `excluded` | not in the run catalogue |
| Focus Sash | `excluded` | not in the run catalogue |
| Friend Ball | `excluded` | not in the run catalogue |
| Full Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Full Restore | `port` | in the run catalogue (`src/data/items.ts`) |
| Galarica Cuff | `excluded` | not in the run catalogue |
| Galarica Wreath | `excluded` | not in the run catalogue |
| Ganlon Berry | `excluded` | not in the run catalogue |
| Gold Bottle Cap | `excluded` | not in the run catalogue |
| Grassy Seed | `excluded` | not in the run catalogue |
| Great Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Grepa Berry | `excluded` | not in the run catalogue |
| Grip Claw | `excluded` | not in the run catalogue |
| Griseous Core | `excluded` | not in the run catalogue |
| Griseous Orb | `excluded` | not in the run catalogue |
| Haban Berry | `excluded` | not in the run catalogue |
| Hard Stone | `port` | in the run catalogue (`src/data/items.ts`) |
| Heal Ball | `excluded` | not in the run catalogue |
| Hearthflame Mask | `excluded` | not in the run catalogue |
| Heat Rock | `excluded` | not in the run catalogue |
| Heavy Ball | `excluded` | not in the run catalogue |
| Heavy-Duty Boots | `excluded` | not in the run catalogue |
| Hondew Berry | `excluded` | not in the run catalogue |
| Hyper Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Iapapa Berry | `excluded` | not in the run catalogue |
| Ice Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Ice Stone | `excluded` | not in the run catalogue |
| Icicle Plate | `excluded` | not in the run catalogue |
| Icy Rock | `excluded` | not in the run catalogue |
| Insect Plate | `excluded` | not in the run catalogue |
| Iron Ball | `excluded` | not in the run catalogue |
| Iron Plate | `excluded` | not in the run catalogue |
| Jaboca Berry | `excluded` | not in the run catalogue |
| Kasib Berry | `excluded` | not in the run catalogue |
| Kebia Berry | `excluded` | not in the run catalogue |
| Kee Berry | `excluded` | not in the run catalogue |
| Kelpsy Berry | `excluded` | not in the run catalogue |
| King's Rock | `excluded` | not in the run catalogue |
| Lagging Tail | `excluded` | not in the run catalogue |
| Lansat Berry | `excluded` | not in the run catalogue |
| Leaf Stone | `excluded` | not in the run catalogue |
| Leftovers | `port` | in the run catalogue (`src/data/items.ts`) |
| Leppa Berry | `excluded` | not in the run catalogue |
| Level Ball | `excluded` | not in the run catalogue |
| Liechi Berry | `excluded` | not in the run catalogue |
| Life Orb | `excluded` | not in the run catalogue |
| Light Ball | `excluded` | not in the run catalogue |
| Light Clay | `excluded` | not in the run catalogue |
| Loaded Dice | `excluded` | not in the run catalogue |
| Love Ball | `excluded` | not in the run catalogue |
| Love Sweet | `excluded` | not in the run catalogue |
| Lum Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Luminous Moss | `excluded` | not in the run catalogue |
| Lure Ball | `excluded` | not in the run catalogue |
| Lustrous Globe | `excluded` | not in the run catalogue |
| Lustrous Orb | `excluded` | not in the run catalogue |
| Luxury Ball | `excluded` | not in the run catalogue |
| Magmarizer | `excluded` | not in the run catalogue |
| Magnet | `port` | in the run catalogue (`src/data/items.ts`) |
| Mago Berry | `excluded` | not in the run catalogue |
| Malicious Armor | `excluded` | not in the run catalogue |
| Maranga Berry | `excluded` | not in the run catalogue |
| Master Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Masterpiece Teacup | `excluded` | not in the run catalogue |
| Meadow Plate | `excluded` | not in the run catalogue |
| Mental Herb | `excluded` | not in the run catalogue |
| Metal Alloy | `excluded` | not in the run catalogue |
| Metal Coat | `port` | in the run catalogue (`src/data/items.ts`) |
| Metronome | `excluded` | not in the run catalogue |
| Micle Berry | `excluded` | not in the run catalogue |
| Mind Plate | `excluded` | not in the run catalogue |
| Miracle Seed | `port` | in the run catalogue (`src/data/items.ts`) |
| Mirror Herb | `excluded` | not in the run catalogue |
| Misty Seed | `excluded` | not in the run catalogue |
| Moon Ball | `excluded` | not in the run catalogue |
| Moon Stone | `excluded` | not in the run catalogue |
| Muscle Band | `excluded` | not in the run catalogue |
| Mystic Water | `port` | in the run catalogue (`src/data/items.ts`) |
| Nest Ball | `excluded` | not in the run catalogue |
| Net Ball | `excluded` | not in the run catalogue |
| Never-Melt Ice | `port` | in the run catalogue (`src/data/items.ts`) |
| Normal Gem | `excluded` | not in the run catalogue |
| Nugget | `port` | in the run catalogue (`src/data/items.ts`) |
| Occa Berry | `excluded` | not in the run catalogue |
| Oran Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Oval Stone | `excluded` | not in the run catalogue |
| Paralyze Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Passho Berry | `excluded` | not in the run catalogue |
| Payapa Berry | `excluded` | not in the run catalogue |
| Pearl | `port` | in the run catalogue (`src/data/items.ts`) |
| Pearl String | `port` | in the run catalogue (`src/data/items.ts`) |
| Pecha Berry | `excluded` | not in the run catalogue |
| Persim Berry | `excluded` | not in the run catalogue |
| Petaya Berry | `excluded` | not in the run catalogue |
| Pixie Plate | `excluded` | not in the run catalogue |
| Poison Barb | `port` | in the run catalogue (`src/data/items.ts`) |
| Poke Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Pomeg Berry | `excluded` | not in the run catalogue |
| Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Power Anklet | `excluded` | not in the run catalogue |
| Power Band | `excluded` | not in the run catalogue |
| Power Belt | `excluded` | not in the run catalogue |
| Power Bracer | `excluded` | not in the run catalogue |
| Power Herb | `excluded` | not in the run catalogue |
| Power Lens | `excluded` | not in the run catalogue |
| Power Weight | `excluded` | not in the run catalogue |
| Premier Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Pretty Feather | `excluded` | not in the run catalogue |
| Prism Scale | `excluded` | not in the run catalogue |
| Protective Pads | `excluded` | not in the run catalogue |
| Protector | `excluded` | not in the run catalogue |
| Psychic Seed | `excluded` | not in the run catalogue |
| Punching Glove | `excluded` | not in the run catalogue |
| Qualot Berry | `excluded` | not in the run catalogue |
| Quick Ball | `excluded` | not in the run catalogue |
| Quick Claw | `excluded` | not in the run catalogue |
| Rare Bone | `port` | in the run catalogue (`src/data/items.ts`) |
| Rawst Berry | `excluded` | not in the run catalogue |
| Razor Claw | `excluded` | not in the run catalogue |
| Razor Fang | `excluded` | not in the run catalogue |
| Reaper Cloth | `excluded` | not in the run catalogue |
| Red Card | `excluded` | not in the run catalogue |
| Repeat Ball | `excluded` | not in the run catalogue |
| Ribbon Sweet | `excluded` | not in the run catalogue |
| Rindo Berry | `excluded` | not in the run catalogue |
| Ring Target | `excluded` | not in the run catalogue |
| Rocky Helmet | `excluded` | not in the run catalogue |
| Room Service | `excluded` | not in the run catalogue |
| Roseli Berry | `excluded` | not in the run catalogue |
| Rowap Berry | `excluded` | not in the run catalogue |
| Rusted Shield | `excluded` | not in the run catalogue |
| Rusted Sword | `excluded` | not in the run catalogue |
| Safari Ball | `excluded` | not in the run catalogue |
| Safety Goggles | `excluded` | not in the run catalogue |
| Salac Berry | `excluded` | not in the run catalogue |
| Scope Lens | `excluded` | not in the run catalogue |
| Sharp Beak | `port` | in the run catalogue (`src/data/items.ts`) |
| Shed Shell | `excluded` | not in the run catalogue |
| Shell Bell | `excluded` | not in the run catalogue |
| Shiny Stone | `excluded` | not in the run catalogue |
| Shuca Berry | `excluded` | not in the run catalogue |
| Silk Scarf | `port` | in the run catalogue (`src/data/items.ts`) |
| Silver Powder | `port` | in the run catalogue (`src/data/items.ts`) |
| Sitrus Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Sky Plate | `excluded` | not in the run catalogue |
| Smooth Rock | `excluded` | not in the run catalogue |
| Snowball | `excluded` | not in the run catalogue |
| Soft Sand | `port` | in the run catalogue (`src/data/items.ts`) |
| Soul Dew | `excluded` | not in the run catalogue |
| Spell Tag | `port` | in the run catalogue (`src/data/items.ts`) |
| Splash Plate | `excluded` | not in the run catalogue |
| Spooky Plate | `excluded` | not in the run catalogue |
| Sport Ball | `excluded` | not in the run catalogue |
| Star Piece | `port` | in the run catalogue (`src/data/items.ts`) |
| Star Sweet | `excluded` | not in the run catalogue |
| Stardust | `port` | in the run catalogue (`src/data/items.ts`) |
| Starf Berry | `excluded` | not in the run catalogue |
| Sticky Barb | `excluded` | not in the run catalogue |
| Stone Plate | `excluded` | not in the run catalogue |
| Strawberry Sweet | `excluded` | not in the run catalogue |
| Sun Stone | `excluded` | not in the run catalogue |
| Super Potion | `port` | in the run catalogue (`src/data/items.ts`) |
| Sweet Apple | `excluded` | not in the run catalogue |
| Syrupy Apple | `excluded` | not in the run catalogue |
| Tamato Berry | `excluded` | not in the run catalogue |
| Tanga Berry | `excluded` | not in the run catalogue |
| Tart Apple | `excluded` | not in the run catalogue |
| Terrain Extender | `excluded` | not in the run catalogue |
| Throat Spray | `excluded` | not in the run catalogue |
| Thunder Stone | `excluded` | not in the run catalogue |
| Timer Ball | `excluded` | not in the run catalogue |
| Toxic Orb | `excluded` | not in the run catalogue |
| Toxic Plate | `excluded` | not in the run catalogue |
| Twisted Spoon | `port` | in the run catalogue (`src/data/items.ts`) |
| Ultra Ball | `port` | in the run catalogue (`src/data/items.ts`) |
| Unremarkable Teacup | `excluded` | not in the run catalogue |
| Up-Grade | `excluded` | not in the run catalogue |
| Utility Umbrella | `excluded` | not in the run catalogue |
| Wacan Berry | `excluded` | not in the run catalogue |
| Water Stone | `excluded` | not in the run catalogue |
| Weakness Policy | `excluded` | not in the run catalogue |
| Wellspring Mask | `excluded` | not in the run catalogue |
| White Herb | `excluded` | not in the run catalogue |
| Wide Lens | `excluded` | not in the run catalogue |
| Wiki Berry | `excluded` | not in the run catalogue |
| Wise Glasses | `excluded` | not in the run catalogue |
| X Attack | `port` | in the run catalogue (`src/data/items.ts`) |
| X Defense | `port` | in the run catalogue (`src/data/items.ts`) |
| X Speed | `port` | in the run catalogue (`src/data/items.ts`) |
| Yache Berry | `excluded` | not in the run catalogue |
| Zap Plate | `excluded` | not in the run catalogue |
| Zoom Lens | `excluded` | not in the run catalogue |

# Effect coverage

Tracks every battle ability and item so "Gen 9 complete" is a claim this table
backs up (`D16` in `docs/tech-decisions.md`). Notes only: nothing here is read
by the game. Regenerate with `npm run docs:coverage`.

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

The run only ever hands out the items in `src/data/items.ts`, so a dex item that
is not in that catalogue is `excluded` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — 310 total (236 port, 0 no-op, 74 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Adaptability | `port` | ported in `effects/abilities.ts` |
| Aerilate | `excluded` | no playable species has it |
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
| Aura Break | `excluded` | no playable species has it |
| Bad Dreams | `port` | ported in `effects/abilities.ts` |
| Ball Fetch | `excluded` | no playable species has it |
| Battery | `excluded` | doubles/ally only |
| Battle Armor | `port` | ported in `effects/abilities.ts` |
| Battle Bond | `port` | ported in `effects/abilities.ts` |
| Beads of Ruin | `port` | ported in `effects/abilities.ts` |
| Beast Boost | `excluded` | no playable species has it |
| Berserk | `port` | ported in `effects/abilities.ts` |
| Big Pecks | `port` | ported in `effects/abilities.ts` |
| Blaze | `port` | ported in `effects/abilities.ts` |
| Bulletproof | `port` | ported in `effects/abilities.ts` |
| Cheek Pouch | `port` | ported in `effects/abilities.ts` |
| Chilling Neigh | `port` | ported in `effects/abilities.ts` |
| Chlorophyll | `port` | ported in `effects/abilities.ts` |
| Clear Body | `port` | ported in `effects/abilities.ts` |
| Cloud Nine | `port` | ported in `effects/abilities.ts` |
| Color Change | `excluded` | no playable species has it |
| Comatose | `port` | ported in `effects/abilities.ts` |
| Commander | `excluded` | doubles/ally only |
| Competitive | `port` | ported in `effects/abilities.ts` |
| Compound Eyes | `port` | ported in `effects/abilities.ts` |
| Contrary | `port` | ported in `effects/abilities.ts` |
| Corrosion | `port` | ported in `effects/abilities.ts` |
| Costar | `excluded` | doubles/ally only |
| Cotton Down | `excluded` | no playable species has it |
| Cud Chew | `port` | ported in `effects/abilities.ts` |
| Curious Medicine | `excluded` | doubles/ally only |
| Cursed Body | `port` | ported in `effects/abilities.ts` |
| Cute Charm | `port` | ported in `effects/abilities.ts` |
| Damp | `port` | ported in `effects/abilities.ts` |
| Dancer | `port` | ported in `effects/abilities.ts` |
| Dark Aura | `excluded` | no playable species has it |
| Dauntless Shield | `port` | ported in `effects/abilities.ts` |
| Dazzling | `port` | ported in `effects/abilities.ts` |
| Defeatist | `excluded` | no playable species has it |
| Defiant | `port` | ported in `effects/abilities.ts` |
| Delta Stream | `excluded` | no playable species has it |
| Desolate Land | `excluded` | no playable species has it |
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
| Emergency Exit | `excluded` | no playable species has it |
| Fairy Aura | `excluded` | no playable species has it |
| Filter | `port` | ported in `effects/abilities.ts` |
| Flame Body | `port` | ported in `effects/abilities.ts` |
| Flare Boost | `port` | ported in `effects/abilities.ts` |
| Flash Fire | `port` | ported in `effects/abilities.ts` |
| Flower Gift | `excluded` | no playable species has it |
| Flower Veil | `excluded` | doubles/ally only |
| Fluffy | `port` | ported in `effects/abilities.ts` |
| Forecast | `excluded` | no playable species has it |
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
| Gorilla Tactics | `excluded` | no playable species has it |
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
| Hunger Switch | `excluded` | forme change (cut) |
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
| Innards Out | `excluded` | no playable species has it |
| Inner Focus | `port` | ported in `effects/abilities.ts` |
| Insomnia | `port` | ported in `effects/abilities.ts` |
| Intimidate | `port` | ported in `effects/abilities.ts` |
| Intrepid Sword | `port` | ported in `effects/abilities.ts` |
| Iron Barbs | `excluded` | no playable species has it |
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
| Mimicry | `excluded` | no playable species has it |
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
| Mummy | `excluded` | no playable species has it |
| Mycelium Might | `port` | ported in `effects/abilities.ts` |
| Natural Cure | `port` | ported in `effects/abilities.ts` |
| Neuroforce | `excluded` | no playable species has it |
| Neutralizing Gas | `port` | ported in `effects/abilities.ts` |
| No Guard | `port` | ported in `effects/abilities.ts` |
| Normalize | `excluded` | no playable species has it |
| Oblivious | `port` | ported in `effects/abilities.ts` |
| Opportunist | `port` | ported in `effects/abilities.ts` |
| Orichalcum Pulse | `port` | ported in `effects/abilities.ts` |
| Overcoat | `port` | ported in `effects/abilities.ts` |
| Overgrow | `port` | ported in `effects/abilities.ts` |
| Own Tempo | `port` | ported in `effects/abilities.ts` |
| Parental Bond | `excluded` | no playable species has it |
| Pastel Veil | `excluded` | no playable species has it |
| Perish Body | `excluded` | no playable species has it |
| Pickpocket | `port` | ported in `effects/abilities.ts` |
| Pickup | `excluded` | out of battle only |
| Pixilate | `port` | ported in `effects/abilities.ts` |
| Plus | `excluded` | doubles/ally only |
| Poison Heal | `port` | ported in `effects/abilities.ts` |
| Poison Point | `port` | ported in `effects/abilities.ts` |
| Poison Puppeteer | `port` | ported in `effects/abilities.ts` |
| Poison Touch | `port` | ported in `effects/abilities.ts` |
| Power Construct | `excluded` | no playable species has it |
| Power of Alchemy | `excluded` | doubles/ally only |
| Power Spot | `excluded` | doubles/ally only |
| Prankster | `port` | ported in `effects/abilities.ts` |
| Pressure | `port` | ported in `effects/abilities.ts` |
| Primordial Sea | `excluded` | no playable species has it |
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
| Refrigerate | `excluded` | no playable species has it |
| Regenerator | `port` | ported in `effects/abilities.ts` |
| Ripen | `port` | ported in `effects/abilities.ts` |
| Rivalry | `port` | ported in `effects/abilities.ts` |
| RKS System | `excluded` | no playable species has it |
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
| Schooling | `excluded` | no playable species has it |
| Scrappy | `port` | ported in `effects/abilities.ts` |
| Screen Cleaner | `excluded` | no playable species has it |
| Seed Sower | `port` | ported in `effects/abilities.ts` |
| Serene Grace | `port` | ported in `effects/abilities.ts` |
| Shadow Shield | `port` | ported in `effects/abilities.ts` |
| Shadow Tag | `port` | ported in `effects/abilities.ts` |
| Sharpness | `port` | ported in `effects/abilities.ts` |
| Shed Skin | `port` | ported in `effects/abilities.ts` |
| Sheer Force | `port` | ported in `effects/abilities.ts` |
| Shell Armor | `port` | ported in `effects/abilities.ts` |
| Shield Dust | `port` | ported in `effects/abilities.ts` |
| Shields Down | `excluded` | forme change (cut) |
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
| Stance Change | `excluded` | no playable species has it |
| Static | `port` | ported in `effects/abilities.ts` |
| Steadfast | `port` | ported in `effects/abilities.ts` |
| Steam Engine | `port` | ported in `effects/abilities.ts` |
| Steelworker | `excluded` | no playable species has it |
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
| Tera Shift | `excluded` | Terastal mechanic (cut) |
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
| Victory Star | `excluded` | no playable species has it |
| Vital Spirit | `port` | ported in `effects/abilities.ts` |
| Volt Absorb | `port` | ported in `effects/abilities.ts` |
| Wandering Spirit | `excluded` | no playable species has it |
| Water Absorb | `port` | ported in `effects/abilities.ts` |
| Water Bubble | `port` | ported in `effects/abilities.ts` |
| Water Compaction | `port` | ported in `effects/abilities.ts` |
| Water Veil | `port` | ported in `effects/abilities.ts` |
| Weak Armor | `port` | ported in `effects/abilities.ts` |
| Well-Baked Body | `port` | ported in `effects/abilities.ts` |
| White Smoke | `port` | ported in `effects/abilities.ts` |
| Wimp Out | `excluded` | no playable species has it |
| Wind Power | `port` | ported in `effects/abilities.ts` |
| Wind Rider | `port` | ported in `effects/abilities.ts` |
| Wonder Guard | `excluded` | no playable species has it |
| Wonder Skin | `port` | ported in `effects/abilities.ts` |
| Zen Mode | `excluded` | no playable species has it |
| Zero to Hero | `excluded` | forme change (cut) |

## Items — 262 total (39 port, 0 no-op, 223 excluded)

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
| Big Nugget | `excluded` | not in the run catalogue |
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
| Occa Berry | `excluded` | not in the run catalogue |
| Oran Berry | `port` | in the run catalogue (`src/data/items.ts`) |
| Oval Stone | `excluded` | not in the run catalogue |
| Paralyze Heal | `port` | in the run catalogue (`src/data/items.ts`) |
| Passho Berry | `excluded` | not in the run catalogue |
| Payapa Berry | `excluded` | not in the run catalogue |
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
| Premier Ball | `excluded` | not in the run catalogue |
| Pretty Feather | `excluded` | not in the run catalogue |
| Prism Scale | `excluded` | not in the run catalogue |
| Protective Pads | `excluded` | not in the run catalogue |
| Protector | `excluded` | not in the run catalogue |
| Psychic Seed | `excluded` | not in the run catalogue |
| Punching Glove | `excluded` | not in the run catalogue |
| Qualot Berry | `excluded` | not in the run catalogue |
| Quick Ball | `excluded` | not in the run catalogue |
| Quick Claw | `excluded` | not in the run catalogue |
| Rare Bone | `excluded` | not in the run catalogue |
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
| Star Sweet | `excluded` | not in the run catalogue |
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

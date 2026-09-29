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
  works with allies, or it needs a cut mechanic (Mega/Z/Dynamax/Terastal/forme
  change). Excluded effects are never a coverage gap.

The run only ever hands out the items in `src/data/items.ts`, so a dex item that
is not in that catalogue is `excluded` by definition: adding it later is a
catalogue row, not engine code.

## Abilities — 310 total (81 port, 170 no-op, 59 excluded)

| Effect | Status | Note |
| --- | --- | --- |
| Adaptability | `port` | ported in `effects/abilities.ts` |
| Aerilate | `excluded` | no playable species has it |
| Aftermath | `no-op` | reachable, not ported yet |
| Air Lock | `no-op` | reachable, not ported yet |
| Analytic | `no-op` | reachable, not ported yet |
| Anger Point | `no-op` | reachable, not ported yet |
| Anger Shell | `no-op` | reachable, not ported yet |
| Anticipation | `no-op` | reachable, not ported yet |
| Arena Trap | `no-op` | reachable, not ported yet |
| Armor Tail | `no-op` | reachable, not ported yet |
| Aroma Veil | `port` | ported in `effects/abilities.ts` |
| As One (Glastrier) | `excluded` | fused forme (cut) |
| As One (Spectrier) | `excluded` | fused forme (cut) |
| Aura Break | `excluded` | no playable species has it |
| Bad Dreams | `no-op` | reachable, not ported yet |
| Ball Fetch | `excluded` | no playable species has it |
| Battery | `excluded` | doubles/ally only |
| Battle Armor | `no-op` | reachable, not ported yet |
| Battle Bond | `no-op` | reachable, not ported yet |
| Beads of Ruin | `no-op` | reachable, not ported yet |
| Beast Boost | `excluded` | no playable species has it |
| Berserk | `no-op` | reachable, not ported yet |
| Big Pecks | `port` | ported in `effects/abilities.ts` |
| Blaze | `port` | ported in `effects/abilities.ts` |
| Bulletproof | `no-op` | reachable, not ported yet |
| Cheek Pouch | `no-op` | reachable, not ported yet |
| Chilling Neigh | `no-op` | reachable, not ported yet |
| Chlorophyll | `port` | ported in `effects/abilities.ts` |
| Clear Body | `port` | ported in `effects/abilities.ts` |
| Cloud Nine | `no-op` | reachable, not ported yet |
| Color Change | `excluded` | no playable species has it |
| Comatose | `no-op` | reachable, not ported yet |
| Commander | `excluded` | doubles/ally only |
| Competitive | `no-op` | reachable, not ported yet |
| Compound Eyes | `port` | ported in `effects/abilities.ts` |
| Contrary | `no-op` | reachable, not ported yet |
| Corrosion | `no-op` | reachable, not ported yet |
| Costar | `excluded` | doubles/ally only |
| Cotton Down | `excluded` | no playable species has it |
| Cud Chew | `no-op` | reachable, not ported yet |
| Curious Medicine | `no-op` | reachable, not ported yet |
| Cursed Body | `no-op` | reachable, not ported yet |
| Cute Charm | `no-op` | reachable, not ported yet |
| Damp | `no-op` | reachable, not ported yet |
| Dancer | `no-op` | reachable, not ported yet |
| Dark Aura | `excluded` | no playable species has it |
| Dauntless Shield | `port` | ported in `effects/abilities.ts` |
| Dazzling | `no-op` | reachable, not ported yet |
| Defeatist | `excluded` | no playable species has it |
| Defiant | `no-op` | reachable, not ported yet |
| Delta Stream | `excluded` | no playable species has it |
| Desolate Land | `excluded` | no playable species has it |
| Disguise | `no-op` | reachable, not ported yet |
| Download | `no-op` | reachable, not ported yet |
| Dragon's Maw | `no-op` | reachable, not ported yet |
| Drizzle | `port` | ported in `effects/abilities.ts` |
| Drought | `port` | ported in `effects/abilities.ts` |
| Dry Skin | `port` | ported in `effects/abilities.ts` |
| Early Bird | `no-op` | reachable, not ported yet |
| Earth Eater | `no-op` | reachable, not ported yet |
| Effect Spore | `no-op` | reachable, not ported yet |
| Electric Surge | `port` | ported in `effects/abilities.ts` |
| Electromorphosis | `no-op` | reachable, not ported yet |
| Embody Aspect (Cornerstone) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Hearthflame) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Teal) | `excluded` | Terastal mechanic (cut) |
| Embody Aspect (Wellspring) | `excluded` | Terastal mechanic (cut) |
| Emergency Exit | `excluded` | no playable species has it |
| Fairy Aura | `excluded` | no playable species has it |
| Filter | `port` | ported in `effects/abilities.ts` |
| Flame Body | `port` | ported in `effects/abilities.ts` |
| Flare Boost | `no-op` | reachable, not ported yet |
| Flash Fire | `port` | ported in `effects/abilities.ts` |
| Flower Gift | `excluded` | no playable species has it |
| Flower Veil | `no-op` | reachable, not ported yet |
| Fluffy | `port` | ported in `effects/abilities.ts` |
| Forecast | `excluded` | no playable species has it |
| Forewarn | `no-op` | reachable, not ported yet |
| Friend Guard | `excluded` | doubles/ally only |
| Frisk | `no-op` | reachable, not ported yet |
| Full Metal Body | `no-op` | reachable, not ported yet |
| Fur Coat | `no-op` | reachable, not ported yet |
| Gale Wings | `no-op` | reachable, not ported yet |
| Galvanize | `no-op` | reachable, not ported yet |
| Gluttony | `no-op` | reachable, not ported yet |
| Good as Gold | `no-op` | reachable, not ported yet |
| Gooey | `no-op` | reachable, not ported yet |
| Gorilla Tactics | `excluded` | no playable species has it |
| Grass Pelt | `no-op` | reachable, not ported yet |
| Grassy Surge | `port` | ported in `effects/abilities.ts` |
| Grim Neigh | `no-op` | reachable, not ported yet |
| Guard Dog | `no-op` | reachable, not ported yet |
| Gulp Missile | `no-op` | reachable, not ported yet |
| Guts | `port` | ported in `effects/abilities.ts` |
| Hadron Engine | `no-op` | reachable, not ported yet |
| Harvest | `no-op` | reachable, not ported yet |
| Healer | `excluded` | doubles/ally only |
| Heatproof | `port` | ported in `effects/abilities.ts` |
| Heavy Metal | `no-op` | reachable, not ported yet |
| Honey Gather | `no-op` | reachable, not ported yet |
| Hospitality | `excluded` | doubles/ally only |
| Huge Power | `port` | ported in `effects/abilities.ts` |
| Hunger Switch | `no-op` | reachable, not ported yet |
| Hustle | `port` | ported in `effects/abilities.ts` |
| Hydration | `port` | ported in `effects/abilities.ts` |
| Hyper Cutter | `port` | ported in `effects/abilities.ts` |
| Ice Body | `port` | ported in `effects/abilities.ts` |
| Ice Face | `no-op` | reachable, not ported yet |
| Ice Scales | `port` | ported in `effects/abilities.ts` |
| Illuminate | `no-op` | reachable, not ported yet |
| Illusion | `no-op` | reachable, not ported yet |
| Immunity | `port` | ported in `effects/abilities.ts` |
| Imposter | `no-op` | reachable, not ported yet |
| Infiltrator | `no-op` | reachable, not ported yet |
| Innards Out | `excluded` | no playable species has it |
| Inner Focus | `port` | ported in `effects/abilities.ts` |
| Insomnia | `port` | ported in `effects/abilities.ts` |
| Intimidate | `port` | ported in `effects/abilities.ts` |
| Intrepid Sword | `port` | ported in `effects/abilities.ts` |
| Iron Barbs | `excluded` | no playable species has it |
| Iron Fist | `port` | ported in `effects/abilities.ts` |
| Justified | `no-op` | reachable, not ported yet |
| Keen Eye | `port` | ported in `effects/abilities.ts` |
| Klutz | `no-op` | reachable, not ported yet |
| Leaf Guard | `port` | ported in `effects/abilities.ts` |
| Levitate | `port` | ported in `effects/abilities.ts` |
| Libero | `no-op` | reachable, not ported yet |
| Light Metal | `no-op` | reachable, not ported yet |
| Lightning Rod | `port` | ported in `effects/abilities.ts` |
| Limber | `port` | ported in `effects/abilities.ts` |
| Lingering Aroma | `no-op` | reachable, not ported yet |
| Liquid Ooze | `no-op` | reachable, not ported yet |
| Liquid Voice | `no-op` | reachable, not ported yet |
| Long Reach | `no-op` | reachable, not ported yet |
| Magic Bounce | `no-op` | reachable, not ported yet |
| Magic Guard | `no-op` | reachable, not ported yet |
| Magician | `no-op` | reachable, not ported yet |
| Magma Armor | `port` | ported in `effects/abilities.ts` |
| Magnet Pull | `no-op` | reachable, not ported yet |
| Marvel Scale | `no-op` | reachable, not ported yet |
| Mega Launcher | `no-op` | reachable, not ported yet |
| Merciless | `no-op` | reachable, not ported yet |
| Mimicry | `excluded` | no playable species has it |
| Mind's Eye | `no-op` | reachable, not ported yet |
| Minus | `excluded` | doubles/ally only |
| Mirror Armor | `no-op` | reachable, not ported yet |
| Misty Surge | `port` | ported in `effects/abilities.ts` |
| Mold Breaker | `no-op` | reachable, not ported yet |
| Moody | `no-op` | reachable, not ported yet |
| Motor Drive | `port` | ported in `effects/abilities.ts` |
| Moxie | `port` | ported in `effects/abilities.ts` |
| Multiscale | `port` | ported in `effects/abilities.ts` |
| Multitype | `no-op` | reachable, not ported yet |
| Mummy | `excluded` | no playable species has it |
| Mycelium Might | `no-op` | reachable, not ported yet |
| Natural Cure | `no-op` | reachable, not ported yet |
| Neuroforce | `excluded` | no playable species has it |
| Neutralizing Gas | `no-op` | reachable, not ported yet |
| No Guard | `no-op` | reachable, not ported yet |
| Normalize | `excluded` | no playable species has it |
| Oblivious | `port` | ported in `effects/abilities.ts` |
| Opportunist | `no-op` | reachable, not ported yet |
| Orichalcum Pulse | `no-op` | reachable, not ported yet |
| Overcoat | `no-op` | reachable, not ported yet |
| Overgrow | `port` | ported in `effects/abilities.ts` |
| Own Tempo | `port` | ported in `effects/abilities.ts` |
| Parental Bond | `excluded` | no playable species has it |
| Pastel Veil | `excluded` | no playable species has it |
| Perish Body | `excluded` | no playable species has it |
| Pickpocket | `no-op` | reachable, not ported yet |
| Pickup | `no-op` | reachable, not ported yet |
| Pixilate | `no-op` | reachable, not ported yet |
| Plus | `excluded` | doubles/ally only |
| Poison Heal | `no-op` | reachable, not ported yet |
| Poison Point | `port` | ported in `effects/abilities.ts` |
| Poison Puppeteer | `no-op` | reachable, not ported yet |
| Poison Touch | `no-op` | reachable, not ported yet |
| Power Construct | `excluded` | no playable species has it |
| Power of Alchemy | `excluded` | doubles/ally only |
| Power Spot | `excluded` | doubles/ally only |
| Prankster | `no-op` | reachable, not ported yet |
| Pressure | `no-op` | reachable, not ported yet |
| Primordial Sea | `excluded` | no playable species has it |
| Prism Armor | `port` | ported in `effects/abilities.ts` |
| Propeller Tail | `no-op` | reachable, not ported yet |
| Protean | `no-op` | reachable, not ported yet |
| Protosynthesis | `no-op` | reachable, not ported yet |
| Psychic Surge | `port` | ported in `effects/abilities.ts` |
| Punk Rock | `port` | ported in `effects/abilities.ts` |
| Pure Power | `port` | ported in `effects/abilities.ts` |
| Purifying Salt | `no-op` | reachable, not ported yet |
| Quark Drive | `no-op` | reachable, not ported yet |
| Queenly Majesty | `no-op` | reachable, not ported yet |
| Quick Draw | `no-op` | reachable, not ported yet |
| Quick Feet | `port` | ported in `effects/abilities.ts` |
| Rain Dish | `port` | ported in `effects/abilities.ts` |
| Rattled | `no-op` | reachable, not ported yet |
| Receiver | `excluded` | doubles/ally only |
| Reckless | `port` | ported in `effects/abilities.ts` |
| Refrigerate | `excluded` | no playable species has it |
| Regenerator | `no-op` | reachable, not ported yet |
| Ripen | `no-op` | reachable, not ported yet |
| Rivalry | `no-op` | reachable, not ported yet |
| RKS System | `excluded` | no playable species has it |
| Rock Head | `no-op` | reachable, not ported yet |
| Rocky Payload | `no-op` | reachable, not ported yet |
| Rough Skin | `no-op` | reachable, not ported yet |
| Run Away | `no-op` | reachable, not ported yet |
| Sand Force | `no-op` | reachable, not ported yet |
| Sand Rush | `port` | ported in `effects/abilities.ts` |
| Sand Spit | `no-op` | reachable, not ported yet |
| Sand Stream | `port` | ported in `effects/abilities.ts` |
| Sand Veil | `port` | ported in `effects/abilities.ts` |
| Sap Sipper | `port` | ported in `effects/abilities.ts` |
| Schooling | `excluded` | no playable species has it |
| Scrappy | `no-op` | reachable, not ported yet |
| Screen Cleaner | `excluded` | no playable species has it |
| Seed Sower | `no-op` | reachable, not ported yet |
| Serene Grace | `no-op` | reachable, not ported yet |
| Shadow Shield | `port` | ported in `effects/abilities.ts` |
| Shadow Tag | `no-op` | reachable, not ported yet |
| Sharpness | `port` | ported in `effects/abilities.ts` |
| Shed Skin | `port` | ported in `effects/abilities.ts` |
| Sheer Force | `port` | ported in `effects/abilities.ts` |
| Shell Armor | `no-op` | reachable, not ported yet |
| Shield Dust | `port` | ported in `effects/abilities.ts` |
| Shields Down | `no-op` | reachable, not ported yet |
| Simple | `no-op` | reachable, not ported yet |
| Skill Link | `no-op` | reachable, not ported yet |
| Slow Start | `no-op` | reachable, not ported yet |
| Slush Rush | `no-op` | reachable, not ported yet |
| Sniper | `no-op` | reachable, not ported yet |
| Snow Cloak | `port` | ported in `effects/abilities.ts` |
| Snow Warning | `port` | ported in `effects/abilities.ts` |
| Solar Power | `no-op` | reachable, not ported yet |
| Solid Rock | `port` | ported in `effects/abilities.ts` |
| Soul-Heart | `no-op` | reachable, not ported yet |
| Soundproof | `no-op` | reachable, not ported yet |
| Speed Boost | `no-op` | reachable, not ported yet |
| Stakeout | `no-op` | reachable, not ported yet |
| Stall | `no-op` | reachable, not ported yet |
| Stalwart | `no-op` | reachable, not ported yet |
| Stamina | `no-op` | reachable, not ported yet |
| Stance Change | `excluded` | no playable species has it |
| Static | `port` | ported in `effects/abilities.ts` |
| Steadfast | `no-op` | reachable, not ported yet |
| Steam Engine | `no-op` | reachable, not ported yet |
| Steelworker | `excluded` | no playable species has it |
| Steely Spirit | `no-op` | reachable, not ported yet |
| Stench | `no-op` | reachable, not ported yet |
| Sticky Hold | `no-op` | reachable, not ported yet |
| Storm Drain | `port` | ported in `effects/abilities.ts` |
| Strong Jaw | `port` | ported in `effects/abilities.ts` |
| Sturdy | `port` | ported in `effects/abilities.ts` |
| Suction Cups | `no-op` | reachable, not ported yet |
| Super Luck | `no-op` | reachable, not ported yet |
| Supersweet Syrup | `no-op` | reachable, not ported yet |
| Supreme Overlord | `no-op` | reachable, not ported yet |
| Surge Surfer | `no-op` | reachable, not ported yet |
| Swarm | `port` | ported in `effects/abilities.ts` |
| Sweet Veil | `no-op` | reachable, not ported yet |
| Swift Swim | `port` | ported in `effects/abilities.ts` |
| Sword of Ruin | `no-op` | reachable, not ported yet |
| Symbiosis | `excluded` | doubles/ally only |
| Synchronize | `no-op` | reachable, not ported yet |
| Tablets of Ruin | `no-op` | reachable, not ported yet |
| Tangled Feet | `no-op` | reachable, not ported yet |
| Tangling Hair | `no-op` | reachable, not ported yet |
| Technician | `port` | ported in `effects/abilities.ts` |
| Telepathy | `excluded` | doubles/ally only |
| Tera Shell | `excluded` | Terastal mechanic (cut) |
| Tera Shift | `excluded` | Terastal mechanic (cut) |
| Teraform Zero | `excluded` | Terastal mechanic (cut) |
| Teravolt | `no-op` | reachable, not ported yet |
| Thermal Exchange | `no-op` | reachable, not ported yet |
| Thick Fat | `port` | ported in `effects/abilities.ts` |
| Tinted Lens | `port` | ported in `effects/abilities.ts` |
| Torrent | `port` | ported in `effects/abilities.ts` |
| Tough Claws | `port` | ported in `effects/abilities.ts` |
| Toxic Boost | `no-op` | reachable, not ported yet |
| Toxic Chain | `no-op` | reachable, not ported yet |
| Toxic Debris | `no-op` | reachable, not ported yet |
| Trace | `no-op` | reachable, not ported yet |
| Transistor | `no-op` | reachable, not ported yet |
| Triage | `no-op` | reachable, not ported yet |
| Truant | `no-op` | reachable, not ported yet |
| Turboblaze | `no-op` | reachable, not ported yet |
| Unaware | `no-op` | reachable, not ported yet |
| Unburden | `no-op` | reachable, not ported yet |
| Unnerve | `no-op` | reachable, not ported yet |
| Unseen Fist | `no-op` | reachable, not ported yet |
| Vessel of Ruin | `no-op` | reachable, not ported yet |
| Victory Star | `excluded` | no playable species has it |
| Vital Spirit | `port` | ported in `effects/abilities.ts` |
| Volt Absorb | `port` | ported in `effects/abilities.ts` |
| Wandering Spirit | `excluded` | no playable species has it |
| Water Absorb | `port` | ported in `effects/abilities.ts` |
| Water Bubble | `port` | ported in `effects/abilities.ts` |
| Water Compaction | `no-op` | reachable, not ported yet |
| Water Veil | `port` | ported in `effects/abilities.ts` |
| Weak Armor | `no-op` | reachable, not ported yet |
| Well-Baked Body | `no-op` | reachable, not ported yet |
| White Smoke | `port` | ported in `effects/abilities.ts` |
| Wimp Out | `excluded` | no playable species has it |
| Wind Power | `no-op` | reachable, not ported yet |
| Wind Rider | `no-op` | reachable, not ported yet |
| Wonder Guard | `excluded` | no playable species has it |
| Wonder Skin | `no-op` | reachable, not ported yet |
| Zen Mode | `excluded` | no playable species has it |
| Zero to Hero | `no-op` | reachable, not ported yet |

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

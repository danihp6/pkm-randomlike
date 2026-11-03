import type { TranslationKey } from '../i18n';
import type { BoostId } from '../engine/battle/fighter';
import type { SacrificeReward } from '../engine/run/memberEdits';
import { normalizeId } from './dex/species';
import { TYPE_NAMES } from './dex/types';
import { MEGA_STONE_IDS } from './items';

/**
 * The NPC tables (`docs/maps-spec.md` §7, `docs/region-spec.md` §7.7): the sixteen
 * **special** rows a settlement can stand and the lines its **generic** people say.
 * Pure data — the legacy room roll lives in `src/engine/routes/npcs.ts`, the
 * settlement placement in `src/engine/region/npcs.ts`, the member edits in
 * `src/engine/run/memberEdits.ts` and the card the interact key opens in
 * `src/ui/npcPanel.ts`, so this file carries no function that reads a run and no
 * Phaser.
 *
 * `SPECIAL_NPCS` is the table: every row's id, keys, art, its legacy per-floor
 * `chance`/`floorStep`, its gate and its own `cityChance`, the odds it takes one of
 * a city's special slots. `NPC_ROWS` is the **same array** under the name
 * `src/engine/region/content.ts` and `src/engine/routes/npcs.ts` read, so the
 * legacy floor draw is unchanged.
 *
 * `GENERIC_LINES` is the other half: four passersby lines per city tier, printed by
 * the people a settlement's content pass stands beside its specials.
 */

/**
 * What a run must carry for an NPC row to be eligible (never the box). The first
 * three are **party** properties; `missionsCompleted` is the run's own count, so a
 * row may open on progress rather than on a Pokémon.
 */
export type NpcRequirement =
  | Readonly<{ kind: 'type'; types: readonly string[] }>
  | Readonly<{ kind: 'move'; moves: readonly string[] }>
  | Readonly<{ kind: 'ability'; abilities: readonly string[] }>
  | Readonly<{ kind: 'missionsCompleted'; min: number }>;

/** One choice the panel shell prints; `label` is an i18n key. */
export type NpcChoice = Readonly<{ id: string; label: TranslationKey }>;

/** What the type gate pays, and the party types that open it. */
export type NpcGrant = Readonly<{ types: readonly string[]; itemId: string }>;

/** The one trainer a row fields, and the ids a win pays one of. */
export type NpcBattle = Readonly<{
  /** A `TrainerArchetype` id (`src/data/trainers.ts`). */
  archetypeId: string;
  /** The ids a win pays one of, drawn on the row's own stream; `[]` pays nothing. */
  prizeIds: readonly string[];
}>;

/** One special NPC: identity, its art, its per-floor chance and its gate. */
export type NpcRow = Readonly<{
  id: string;
  /** The i18n key of the NPC's name, printed as the panel's title. */
  nameKey: TranslationKey;
  /** The i18n key of the one paragraph the panel opens with. */
  greetingKey: TranslationKey;
  /** A key of `OVERWORLD_SPRITE_KEYS` (`src/data/overworldSprites.ts`). */
  spriteKey: string;
  /** Base chance, 0..1, on map 1. */
  chance: number;
  /** Added to `chance` for every floor after the first. */
  floorStep: number;
  /**
   * When present, the floor places this row **itself** (no roll) in its first
   * `trainers` room as soon as `mapIndex >= guaranteedFromMap`. The row's
   * `chance` is `0` beside it, so the roll never picks it.
   */
  guaranteedFromMap?: number;
  /** When present, a run must satisfy it before the row is eligible. */
  requires?: NpcRequirement;
  /**
   * When `true`, a chosen row writes no `npcUseId` mark, so the card answers again
   * on the same floor (the merchant). Absent means one-shot.
   */
  repeatable?: boolean;
  /** The rows the panel prints, in order; `LEAVE` is the shell's own last row. */
  choices?: readonly NpcChoice[];
  /** A row that pays an item to a party holding one of these types (the type gate). */
  grant?: NpcGrant;
  /** When present, the row's choice starts this trainer battle instead of a card. */
  battle?: NpcBattle;
}>;

/** A special row with the chance it takes one of a city's special slots. */
export type CityNpcRow = NpcRow & Readonly<{ cityChance: number }>;

/**
 * What a row's `cityChance` reads when a caller hands in a plain `NpcRow`, so a row
 * added to the legacy table alone still takes a slot more often than not.
 */
export const CITY_SPECIAL_CHANCE_DEFAULT = 0.8;

/**
 * Every special NPC. The **merchant** is the floor's one guaranteed row: on every
 * floor, map 1 included, it stands in the floor's first trainer room and opens the
 * Mart, so the shop room could retire and the run still has its counter
 * (`docs/maps-spec.md` §7).
 * The **Team Rocket** grunt follows it in the table: it is the row that carries the
 * slot machine, so the casino room retired the way the shop room did. It is the only
 * choice-less row — the interact key opens the machine straight away, so no card is
 * ever raised for it — and its `greetingKey` is the machine's own paramless title,
 * never a key that needs `{confirm}`/`{cancel}`. The five member-edit rows and the
 * sacrifice share the roll after it, then the four run-modifier rows: the exorcist,
 * the weather man, the magician and the type gate. The last four rows pay in items or
 * in a battle: the **medic**, the **chef**, the **berry tree** and the **Mega Stone
 * keeper**.
 *
 * `cityChance` is the other roll: whether a city that offers the row stands it at all
 * (`src/engine/region/npcs.ts`). The merchant and the grunt are `1` because they are
 * the city's shop and its casino counter; the last four are likelier because a city
 * that offers them has nowhere else to get them.
 */
export const SPECIAL_NPCS: readonly CityNpcRow[] = [
  {
    id: 'merchant',
    nameKey: 'npc.merchant.name',
    greetingKey: 'npc.merchant.greeting',
    spriteKey: 'merchant',
    chance: 0,
    floorStep: 0,
    guaranteedFromMap: 1,
    repeatable: true,
    choices: [{ id: 'mart', label: 'npc.merchant.trade' }],
    cityChance: 1,
  },
  {
    id: 'rocket',
    nameKey: 'casino.title',
    greetingKey: 'casino.title',
    spriteKey: 'rocket',
    chance: 0,
    floorStep: 0.03,
    cityChance: 1,
    repeatable: true,
  },
  {
    id: 'tutor',
    nameKey: 'npc.tutor.name',
    greetingKey: 'npc.tutor.greeting',
    spriteKey: 'blackbelt',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'teach', label: 'npc.tutor.teach' }],
    cityChance: 0.8,
  },
  {
    id: 'nature',
    nameKey: 'npc.nature.name',
    greetingKey: 'npc.nature.greeting',
    spriteKey: 'psychic',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'reroll', label: 'npc.nature.reroll' }],
    cityChance: 0.8,
  },
  {
    id: 'ability',
    nameKey: 'npc.ability.name',
    greetingKey: 'npc.ability.greeting',
    spriteKey: 'ace',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'reroll', label: 'npc.ability.reroll' }],
    cityChance: 0.8,
  },
  {
    id: 'iv-judge',
    nameKey: 'npc.iv.name',
    greetingKey: 'npc.iv.greeting',
    spriteKey: 'iv-judge',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'reroll', label: 'npc.iv.reroll' }],
    cityChance: 0.8,
  },
  {
    id: 'species',
    nameKey: 'npc.species.name',
    greetingKey: 'npc.species.greeting',
    spriteKey: 'camper',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'swap', label: 'npc.species.swap' }],
    cityChance: 0.8,
  },
  {
    id: 'sacrifice',
    nameKey: 'npc.sacrifice.name',
    greetingKey: 'npc.sacrifice.greeting',
    spriteKey: 'sacrifice',
    chance: 0.04,
    floorStep: 0.005,
    requires: { kind: 'missionsCompleted', min: 1 },
    choices: [{ id: 'offer', label: 'npc.sacrifice.offer' }],
    cityChance: 0.8,
  },
  {
    id: 'exorcist',
    nameKey: 'npc.exorcist.name',
    greetingKey: 'npc.exorcist.greeting',
    spriteKey: 'exorcist',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'hex', label: 'npc.exorcist.cast' }],
    cityChance: 0.75,
  },
  {
    id: 'weather-man',
    nameKey: 'npc.weather.name',
    greetingKey: 'npc.weather.greeting',
    spriteKey: 'weather-man',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'sky', label: 'npc.weather.cast' }],
    cityChance: 0.75,
  },
  {
    id: 'magician',
    nameKey: 'npc.magician.name',
    greetingKey: 'npc.magician.greeting',
    spriteKey: 'magician',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'type', label: 'npc.magician.cast' }],
    cityChance: 0.75,
  },
  {
    id: 'type-gate',
    nameKey: 'npc.gate.name',
    greetingKey: 'npc.gate.greeting',
    spriteKey: 'bugcatcher',
    chance: 0.02,
    floorStep: 0.005,
    choices: [{ id: 'claim', label: 'npc.gate.claim' }],
    grant: { types: ['bug'], itemId: 'silverpowder' },
    cityChance: 0.75,
  },
  {
    id: 'medic',
    nameKey: 'npc.medic.name',
    greetingKey: 'npc.medic.greeting',
    spriteKey: 'medic',
    chance: 0.01,
    floorStep: 0.0025,
    choices: [{ id: 'heal', label: 'npc.medic.heal' }],
    cityChance: 0.9,
  },
  {
    id: 'chef',
    nameKey: 'npc.chef.name',
    greetingKey: 'npc.chef.greeting',
    spriteKey: 'chef',
    chance: 0.01,
    floorStep: 0.0025,
    choices: [{ id: 'trade', label: 'npc.chef.trade' }],
    cityChance: 0.9,
  },
  {
    id: 'berry-tree',
    nameKey: 'npc.berry-tree.name',
    greetingKey: 'npc.berry-tree.greeting',
    spriteKey: 'berry-tree',
    chance: 0.01,
    floorStep: 0.0025,
    choices: [{ id: 'shake', label: 'npc.berry-tree.shake' }],
    cityChance: 0.9,
  },
  {
    id: 'mega-stone',
    nameKey: 'npc.mega-stone.name',
    greetingKey: 'npc.mega-stone.greeting',
    spriteKey: 'ace',
    chance: 0.01,
    floorStep: 0.0025,
    choices: [{ id: 'battle', label: 'npc.mega-stone.battle' }],
    battle: { archetypeId: 'ace', prizeIds: MEGA_STONE_IDS },
    cityChance: 0.9,
  },
];

/** The same sixteen rows under the name `content.ts` and the legacy room roll read. */
export const NPC_ROWS: readonly NpcRow[] = SPECIAL_NPCS;

/** The berries the chef takes and the berry tree gives, in table order. */
export const BERRY_IDS: readonly string[] = [
  'cheriberry',
  'chestoberry',
  'pechaberry',
  'rawstberry',
  'aspearberry',
  'oranberry',
  'sitrusberry',
  'lumberry',
  'figyberry',
  'wikiberry',
  'magoberry',
  'aguavberry',
  'iapapaberry',
  'leppaberry',
];

/** How many berries the chef's trade costs. */
export const CHEF_BERRY_COUNT = 3;

/** The held dish the chef's trade pays. */
export const CHEF_DISH_ITEM_ID = 'chefstew';

/** The fewest/most berries one shake gives. */
export const BERRY_TREE_MIN = 1;
export const BERRY_TREE_CAP = 4;

/** What the berry tree's guardian starts with (the mirror of CURSE_ENEMY_BOOST). */
export const BERRY_TREE_ENEMY_BOOSTS: Readonly<Partial<Record<BoostId, number>>> = {
  def: 1,
  spd: 1,
};

/** The 18 battle type ids the magician draws from, in the dex's own order. */
export const MAGICIAN_TYPES: readonly string[] = TYPE_NAMES.map(normalizeId);

/** What the curse does to the enemy's lead (data, not code). */
export const CURSE_ENEMY_BOOST: Readonly<{ atk: number }> = { atk: -1 };

/**
 * The moves the tutor may teach, in the order its card prints them. The array is
 * the whole gate: a move outside it is never taught, whatever the dex knows.
 */
export const TUTOR_MOVES: readonly string[] = [
  'swordsdance',
  'earthquake',
  'icebeam',
  'thunderbolt',
  'shadowball',
  'roost',
];

/** What one member row of the sacrifice pays, in table order (the roll's tie-break). */
export const SACRIFICE_REWARDS: readonly SacrificeReward[] = [
  'nature',
  'second-ability',
  'ivs',
  'species',
];

export function getNpcRow(id: string): NpcRow | undefined {
  return NPC_ROWS.find((row) => row.id === id);
}

/** The special row `id` names, or undefined. */
export function specialNpcRow(id: string): CityNpcRow | undefined {
  return SPECIAL_NPCS.find((row) => row.id === id);
}

/**
 * The chance `row` takes one of a city's special slots, always a probability: a row
 * with no `cityChance` of its own reads `CITY_SPECIAL_CHANCE_DEFAULT`.
 */
export function cityChanceOf(row: NpcRow): number {
  const chance = (row as CityNpcRow).cityChance ?? CITY_SPECIAL_CHANCE_DEFAULT;
  return chance < 0 ? 0 : chance > 1 ? 1 : chance;
}

/** The three city bands the generic lines are written for. */
export type GenericTier = 1 | 2 | 3;

/**
 * What a settlement's passersby say, by the tier that stands them: badges 1-2 read
 * tier 1, badges 3-5 tier 2 and badges 6-8 tier 3, the bands `src/data/region.ts`'s
 * `CITY_TIERS` uses. The town reads tier 1, because it is the on-ramp.
 */
export const GENERIC_LINES: Readonly<Record<GenericTier, readonly TranslationKey[]>> = {
  1: ['npc.generic.tier1.1', 'npc.generic.tier1.2', 'npc.generic.tier1.3', 'npc.generic.tier1.4'],
  2: ['npc.generic.tier2.1', 'npc.generic.tier2.2', 'npc.generic.tier2.3', 'npc.generic.tier2.4'],
  3: ['npc.generic.tier3.1', 'npc.generic.tier3.2', 'npc.generic.tier3.3', 'npc.generic.tier3.4'],
};

/** The tier's own lines, the same array object (readonly). */
export function genericLines(tier: GenericTier): readonly TranslationKey[] {
  return GENERIC_LINES[tier];
}

import type { BandId } from './run';

/**
 * The Poké Dollars a beaten trainer of this archetype drops: a **fixed base**
 * plus a **jitter** rolled from `base` to `base + jitter` (`docs/maps-spec.md`
 * §7, D33). Both scale with the map's band through
 * `TRAINER_MONEY_BAND_SCALE`, so a late trainer pays more. Balance data (O-M5);
 * tuning never touches the code that rolls it.
 */
export type TrainerMoney = Readonly<{ base: number; jitter: number }>;

/**
 * How much a map's band multiplies a trainer's money. The base/jitter on each
 * archetype are the **early** values; a later band scales both, so the reward
 * tracks the level range the roster fields. Data, so retuning is an edit here.
 */
export const TRAINER_MONEY_BAND_SCALE: Readonly<Record<BandId, number>> = {
  early: 1,
  low: 1.25,
  mid: 1.75,
  high: 2.5,
  late: 3.5,
  end: 5,
};

/**
 * A trainer archetype is presentation and reward only: identity, sprites and
 * money. Its roster comes from the floor's BST pool (`speciesPool`, `D39`), so
 * the archetype no longer carries a themed species list.
 */
export type TrainerArchetype = Readonly<{
  id: string;
  name: string;
  className: string;
  /**
   * Frame in the overworld trainer atlas (`src/assets/frlg/overworld.png`,
   * Phase 8) drawn on the route tile, or null for a placeholder sprite. The
   * frame map lives in `src/data/frlg/overworld.json`.
   */
  spriteKey: string | null;
  /** Marker colour for the facing arrow. */
  colour: number;
  /**
   * Frame in the battle trainer sheet (`src/assets/frlg/trainers.png`, Phase 8
   * O1) shown on the enemy platform, or null for a placeholder sprite. The
   * frame map lives in `src/data/frlg/trainers.json`.
   */
  battleSprite: string | null;
  /** The Poké Dollars a beaten member of this archetype drops (`D33`). */
  money: TrainerMoney;
  /**
   * True for the `ace` archetype (and, at the call site, map bosses): its
   * roster may carry a Mega Stone, so its Pokémon can Mega Evolve (`D34`).
   */
  carriesMega?: boolean;
}>;

export const TRAINER_ARCHETYPES: readonly TrainerArchetype[] = [
  {
    id: 'youngster',
    money: { base: 60, jitter: 30 },
    name: 'Youngster',
    className: 'Youngster',
    spriteKey: 'youngster',
    colour: 0x60a5fa,
    battleSprite: 'youngster',
  },
  {
    id: 'lass',
    money: { base: 70, jitter: 30 },
    name: 'Lass',
    className: 'Lass',
    spriteKey: 'lass',
    colour: 0xf472b6,
    battleSprite: 'lass',
  },
  {
    id: 'bugcatcher',
    money: { base: 50, jitter: 25 },
    name: 'Bug Catcher',
    className: 'Bug Catcher',
    spriteKey: 'bugcatcher',
    colour: 0x84cc16,
    battleSprite: 'bugcatcher',
  },
  {
    id: 'hiker',
    money: { base: 90, jitter: 40 },
    name: 'Hiker',
    className: 'Hiker',
    spriteKey: 'hiker',
    colour: 0xf59e0b,
    battleSprite: 'hiker',
  },
  {
    id: 'camper',
    money: { base: 80, jitter: 35 },
    name: 'Camper',
    className: 'Camper',
    spriteKey: 'camper',
    colour: 0x22c55e,
    battleSprite: 'camper',
  },
  {
    id: 'picnicker',
    money: { base: 80, jitter: 35 },
    name: 'Picnicker',
    className: 'Picnicker',
    spriteKey: 'picnicker',
    colour: 0xfacc15,
    battleSprite: 'picnicker',
  },
  {
    id: 'fisher',
    money: { base: 100, jitter: 45 },
    name: 'Fisher',
    className: 'Fisher',
    spriteKey: 'fisher',
    colour: 0x38bdf8,
    battleSprite: 'fisher',
  },
  {
    id: 'psychic',
    money: { base: 120, jitter: 50 },
    name: 'Psychic',
    className: 'Psychic',
    spriteKey: 'psychic',
    colour: 0xa78bfa,
    battleSprite: 'psychic',
  },
  {
    id: 'blackbelt',
    money: { base: 130, jitter: 55 },
    name: 'Black Belt',
    className: 'Black Belt',
    spriteKey: 'blackbelt',
    colour: 0xef4444,
    battleSprite: 'blackbelt',
  },
  {
    id: 'ace',
    money: { base: 200, jitter: 80 },
    name: 'Ace Trainer',
    className: 'Ace Trainer',
    spriteKey: 'ace',
    colour: 0x94a3b8,
    battleSprite: 'ace',
    carriesMega: true,
  },
];

const BY_ID = new Map<string, TrainerArchetype>(
  TRAINER_ARCHETYPES.map((archetype) => [archetype.id, archetype]),
);

export const TRAINER_ARCHETYPE_IDS: readonly string[] = TRAINER_ARCHETYPES.map(
  (archetype) => archetype.id,
);

export function getTrainerArchetype(id: string): TrainerArchetype | undefined {
  return BY_ID.get(id);
}

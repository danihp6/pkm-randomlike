import { evolutionDepth } from './dex/evolutions';
import { playableSpecies } from './dex/species';

export type BandId = 'early' | 'low' | 'mid' | 'high' | 'late' | 'end';

export type LevelBand = Readonly<{
  id: BandId;
  name: string;
  minLevel: number;
  maxLevel: number;
  /** Typical trainer party size in this band. */
  trainerSize: number;
  /**
   * XP multiplier for a beaten **trainer's** Pokémon of this band, so 75 % of a
   * floor's trainers pays for that floor's level cap (`docs/balance/route-curve.md`).
   */
  trainerXp: number;
  /**
   * Inclusive base-stat-total window the band draws its species pools from
   * (`D39`). The windows tile 0..800 with a rough population split, so every
   * species falls in exactly one band and the pool climbs with the floor.
   */
  bst: Readonly<{ min: number; max: number }>;
}>;

export const LEVEL_BANDS: readonly LevelBand[] = [
  {
    id: 'early',
    name: 'Early',
    minLevel: 2,
    maxLevel: 5,
    trainerSize: 1,
    trainerXp: 0.3,
    bst: { min: 0, max: 305 },
  },
  {
    id: 'low',
    name: 'Low',
    minLevel: 5,
    maxLevel: 9,
    trainerSize: 1,
    trainerXp: 0.6,
    bst: { min: 306, max: 355 },
  },
  {
    id: 'mid',
    name: 'Mid',
    minLevel: 9,
    maxLevel: 14,
    trainerSize: 2,
    trainerXp: 3.9,
    bst: { min: 356, max: 440 },
  },
  {
    id: 'high',
    name: 'High',
    minLevel: 14,
    maxLevel: 20,
    trainerSize: 2,
    trainerXp: 1.7,
    bst: { min: 441, max: 490 },
  },
  {
    id: 'late',
    name: 'Late',
    minLevel: 20,
    maxLevel: 28,
    trainerSize: 3,
    trainerXp: 6,
    bst: { min: 491, max: 520 },
  },
  {
    id: 'end',
    name: 'End',
    minLevel: 28,
    maxLevel: 40,
    trainerSize: 4,
    trainerXp: 3.2,
    bst: { min: 521, max: 800 },
  },
];

/**
 * The **upper half** of a band's BST window, for a boss roster (`D39`): a boss
 * fields the strongest species the floor's band can hold, one step above the
 * regular trainers sharing the band.
 */
export function bossBstWindow(band: LevelBand): Readonly<{ min: number; max: number }> {
  return { min: Math.floor((band.bst.min + band.bst.max) / 2), max: band.bst.max };
}

/**
 * The band a level range reads as, so a **map's** own `minLevel`/`maxLevel`
 * (`levelsForMap`) still pick the archetype species pool and the roster size.
 * The last band whose floor the level reaches, clamped at both ends.
 */
export function bandForLevel(minLevel: number): LevelBand {
  let band = LEVEL_BANDS[0];
  for (const candidate of LEVEL_BANDS) {
    if (minLevel >= candidate.minLevel) band = candidate;
  }
  return band;
}

/** Route cadence from `docs/routes-spec.md` §4. Consumed by the run chain (Phase 6). */
export const RUN_CHAIN = {
  finiteLength: 40,
  minibossEvery: 4,
  bossBlock: 8,
} as const;

/**
 * Starter options a new run offers. A candidate is the base form of an
 * evolution line with two consecutive evolutions ahead (itself plus two more in
 * a chain), so every starter has somewhere to grow; a branching line whose
 * children are all final (Eevee, Scyther) is not a candidate. See
 * `docs/design-spec.md` §3.
 */
export const STARTER_POOL_SIZE = 3;

export function starterCandidates(): readonly string[] {
  const candidates: string[] = [];
  for (const species of playableSpecies()) {
    if (species.prevo !== '' || species.forme !== '') continue;
    if (evolutionDepth(species.id) >= 2) candidates.push(species.id);
  }
  return candidates;
}

export type StartingItem = Readonly<{ itemId: string; count: number }>;

/**
 * What a fresh run's bag holds before the first route: a stack of Poké Balls, so
 * the player can attempt catches from the very first route. Every other item is
 * still earned along the way.
 */
export const STARTING_BAG: readonly StartingItem[] = [{ itemId: 'pokeball', count: 10 }];

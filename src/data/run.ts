import { evolutionFamily } from './dex/evolutions';
import { playableSpecies } from './dex/species';

export type BandId = 'early' | 'low' | 'mid' | 'high' | 'late' | 'end';

export type LevelBand = Readonly<{
  id: BandId;
  name: string;
  minLevel: number;
  maxLevel: number;
  /** Typical trainer party size in this band. */
  trainerSize: number;
}>;

export const LEVEL_BANDS: readonly LevelBand[] = [
  { id: 'early', name: 'Early', minLevel: 2, maxLevel: 5, trainerSize: 1 },
  { id: 'low', name: 'Low', minLevel: 5, maxLevel: 9, trainerSize: 1 },
  { id: 'mid', name: 'Mid', minLevel: 9, maxLevel: 14, trainerSize: 2 },
  { id: 'high', name: 'High', minLevel: 14, maxLevel: 20, trainerSize: 2 },
  { id: 'late', name: 'Late', minLevel: 20, maxLevel: 28, trainerSize: 3 },
  { id: 'end', name: 'End', minLevel: 28, maxLevel: 40, trainerSize: 4 },
];

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
 * evolution line of at least three species (itself plus two others), so every
 * starter has somewhere to grow; see `docs/design-spec.md` §3.
 */
export const STARTER_POOL_SIZE = 3;

export function starterCandidates(): readonly string[] {
  const candidates: string[] = [];
  for (const species of playableSpecies()) {
    if (species.prevo !== '' || species.forme !== '') continue;
    if (evolutionFamily(species.id).length >= 3) candidates.push(species.id);
  }
  return candidates;
}

export type StartingItem = Readonly<{ itemId: string; count: number }>;

/**
 * What a fresh run's bag holds before the first route. Empty: items are earned
 * from the route economy, never handed out at the start.
 */
export const STARTING_BAG: readonly StartingItem[] = [];

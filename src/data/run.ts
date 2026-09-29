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

export const ROUTES_PER_BAND = 4;

export function bandForRoute(routeIndex: number): LevelBand {
  const index = Math.max(1, Math.floor(routeIndex));
  const bandIndex = Math.min(LEVEL_BANDS.length - 1, Math.floor((index - 1) / ROUTES_PER_BAND));
  return LEVEL_BANDS[bandIndex];
}

/** The XP/level ceiling for a route (D9). Clamping lives in the run logic (Phase 6). */
export function levelCapForRoute(routeIndex: number): number {
  return bandForRoute(routeIndex).maxLevel;
}

/** Route cadence from `docs/routes-spec.md` §5. Consumed by the run chain (Phase 6). */
export const RUN_CHAIN = {
  finiteLength: 40,
  minibossEvery: 4,
  bossBlock: 8,
} as const;

/** The starters a run can open with. The unlock pool is a later slice. */
export const STARTER_POOL: readonly string[] = ['bulbasaur', 'charmander', 'squirtle'];

export type StartingItem = Readonly<{ itemId: string; count: number }>;

/** What a fresh run's bag holds before the first route. */
export const STARTING_BAG: readonly StartingItem[] = [
  { itemId: 'pokeball', count: 5 },
  { itemId: 'potion', count: 3 },
];

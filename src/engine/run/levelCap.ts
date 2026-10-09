import { floorForRoute } from './floors';

/**
 * The per-map level ceiling (D9 moved to the map, D29). The cap is the map's
 * `maxLevel`, so the next map is always a step up and a player cannot grind past
 * it; evolution only fires while the level sits at or below the cap.
 */
export function capForRoute(seed: string, routeIndex: number): number {
  return floorForRoute(seed, routeIndex).maxLevel;
}

/** Clamps a level into `1..cap`. */
export function clampToCap(level: number, cap: number): number {
  return Math.max(1, Math.min(Math.floor(level), Math.floor(cap)));
}

export function reachedCap(level: number, cap: number): boolean {
  return Math.floor(level) >= Math.floor(cap);
}

import { levelCapForRoute } from '../../data/run';

/**
 * The per-route level ceiling (D9). The cap rises with the route chain, so the
 * next route is always a step up and a player cannot grind past it. Evolution
 * only fires while the level sits at or below the cap.
 */
export function capForRoute(routeIndex: number): number {
  return levelCapForRoute(routeIndex);
}

/** Clamps a level into `1..cap`. */
export function clampToCap(level: number, routeIndex: number): number {
  return Math.max(1, Math.min(Math.floor(level), capForRoute(routeIndex)));
}

export function reachedCap(level: number, routeIndex: number): boolean {
  return Math.floor(level) >= capForRoute(routeIndex);
}

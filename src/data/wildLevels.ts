import { MAP_MAX_LEVEL } from './maps';

/**
 * The share of the live squad level a wild encounter's level lands in
 * (`docs/routes-spec.md` §3/§5).
 */
export const WILD_LEVEL_FRACTION: Readonly<{ min: number; max: number }> = {
  min: 0.6,
  max: 0.75,
};

/**
 * A wild level: `floor(squadLevel × fraction)` clamped into `1..cap`. It floors,
 * never rounds up, so a wild stays under the squad while the share is below one;
 * `cap` is the floor's ceiling (`band.maxLevel`).
 */
export function wildLevel(fraction: number, squadLevel: number, cap: number): number {
  const share = Number.isFinite(fraction)
    ? Math.min(1, Math.max(0, fraction))
    : WILD_LEVEL_FRACTION.min;
  const base = Number.isFinite(squadLevel) ? Math.max(0, squadLevel) : 0;
  const ceiling = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : MAP_MAX_LEVEL;
  return Math.min(ceiling, Math.max(1, Math.floor(base * share)));
}

/**
 * Overworld sizing. The battle sizes a sprite from the canonical height through a
 * power curve (`src/data/spriteSize.ts`), and the overworld must agree about who is
 * big without leaving the 24 px tile the route and the main menu's window are built
 * on: a battle sprite's 68–260 px range does not fit a tile, so the same curve is
 * compressed into a frozen `0.8..1.6` band of the cell. The band is the whole
 * balance: the floor keeps a Diglett from vanishing, the cap keeps a 20 m species
 * inside its tile, and every overworld surface reads its size here rather than
 * doing `sheet.size` arithmetic of its own.
 *
 * Every number is here so the look is tuned without touching a scene.
 */

import { heightOf } from './dex';
import { SPRITE_SIZE_EXPONENT, SPRITE_SIZE_REF_HEIGHT } from './spriteSize';

/** The battle curve's exponent, reused verbatim: `height ** 0.5`. */
export const OVERWORLD_SCALE_EXPONENT: number = SPRITE_SIZE_EXPONENT;
/** The height (m) that maps to a scale of 1: the 1 m reference species. */
export const OVERWORLD_SCALE_REF_HEIGHT: number = SPRITE_SIZE_REF_HEIGHT;
/** The smallest a species draws against its cell. */
export const OVERWORLD_SCALE_MIN = 0.8;
/** The largest a species draws against its cell. */
export const OVERWORLD_SCALE_MAX = 1.6;

/**
 * A species' overworld scale: `clamp((max(0.1, heightOf(id)) / REF) ** EXPONENT,
 * MIN, MAX)`. Monotonic in canonical height, floored at 0.8, capped at 1.6, and
 * `1` for an unknown id (whose `heightOf` is 1).
 */
export function overworldScale(speciesId: string): number {
  const height = Math.max(0.1, heightOf(speciesId));
  const scaled = Math.pow(height / OVERWORLD_SCALE_REF_HEIGHT, OVERWORLD_SCALE_EXPONENT);
  return Math.min(OVERWORLD_SCALE_MAX, Math.max(OVERWORLD_SCALE_MIN, scaled));
}

/** The drawn height in px of a species' overworld sprite in a `cellPx` cell. */
export function overworldDrawHeight(speciesId: string, cellPx: number): number {
  return cellPx * overworldScale(speciesId);
}

/**
 * The height in px a species draws inside a `cellPx` cell so that even the tallest
 * (`OVERWORLD_SCALE_MAX`) fits it: `max(1, round(cellPx * overworldScale(id) /
 * OVERWORLD_SCALE_MAX))`. At `cellPx = 24` this is an integer 12…24, which keeps
 * pixel art crisp and the walker inside its tile.
 */
export function overworldCellHeight(speciesId: string, cellPx: number): number {
  return Math.max(1, Math.round(overworldDrawHeight(speciesId, cellPx) / OVERWORLD_SCALE_MAX));
}

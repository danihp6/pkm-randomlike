/**
 * Battle sprite sizing. Essentials renders every battler at one global zoom and
 * lets the art carry the relative size, but our Anil art compresses the real
 * 0.1m-20m range into a narrow band — Regigigas is drawn barely taller than
 * Scatterbug — so the art alone cannot say which Pokémon is big. We size from the
 * species' canonical height instead, through a power curve so the extremes stay
 * on stage: `height ** 0.5` turns the 200x range into roughly 4x, which is what a
 * battle screen can show.
 *
 * Every number is here so the look is tuned without touching the scene.
 */

/** The height (m) that maps to `SPRITE_SIZE_BASE` pixels. */
export const SPRITE_SIZE_REF_HEIGHT = 1;
/** Drawn height in pixels for a `SPRITE_SIZE_REF_HEIGHT` species. */
export const SPRITE_SIZE_BASE = 150;
/** Compresses the real height range; 1 would be linear (20m would be 3000px). */
export const SPRITE_SIZE_EXPONENT = 0.5;
/** Floor and ceiling for the drawn height in pixels. */
export const SPRITE_SIZE_MIN = 68;
export const SPRITE_SIZE_MAX = 260;

/** The height in pixels a species' battle sprite should be drawn at. */
export function battleSpriteHeight(heightm: number): number {
  const height = Math.max(0.1, heightm);
  const scaled = SPRITE_SIZE_BASE * Math.pow(height / SPRITE_SIZE_REF_HEIGHT, SPRITE_SIZE_EXPONENT);
  return Math.round(Math.min(SPRITE_SIZE_MAX, Math.max(SPRITE_SIZE_MIN, scaled)));
}

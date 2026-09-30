/**
 * The presentation pieces of a capture (Phase 5). The engine's `capture` event
 * only carries `shakes` (the interrupted shake check) and `success`; the
 * classic beat is "the ball fails on the shake that broke it, or holds through
 * four shakes". `CAPTURE_SHAKES` is still presented for every failed attempt so
 * the sequence always lasts the same length. Pure and deterministic, so
 * `BattleScene` can drive it from the engine's log without extra RNG.
 */
export const CAPTURE_SHAKES = 3;
export const CAPTURE_HELD_SHAKES = 4;

/** Shake pixels per second — the classic 2-3 shakes a second. */
export const CAPTURE_SHAKE_SPEED = 2.4;

/**
 * How many shakes and outcomes a capture beat plays after the ball is thrown:
 * the thrown ball, the shakes, then `held` (caught) or `broke` (it escaped).
 */
export type CaptureBeat = Readonly<{ shakes: number; held: boolean }>;

export function captureBeat(shakes: number, success: boolean): CaptureBeat {
  if (success) return { shakes: CAPTURE_HELD_SHAKES, held: true };
  return { shakes: Math.max(1, Math.min(CAPTURE_SHAKES, Math.floor(shakes))), held: false };
}

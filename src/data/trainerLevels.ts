import { MAP_MAX_LEVEL } from './maps';

/** A regular trainer's party size: the key of the level table. */
export type TrainerPartySize = 1 | 2 | 3 | 4;

/**
 * What share of the live squad level a regular trainer's members carry, by the
 * roster's own party size: a bigger party is individually weaker, so the fight's
 * total stays near the player's own level (`docs/maps-spec.md` §5, D35).
 */
export const TRAINER_LEVEL_PERCENT: Readonly<Record<TrainerPartySize, number>> = {
  1: 1,
  2: 0.9,
  3: 0.8,
  4: 0.7,
};

/** The percentage a party of `size` carries; an out-of-table size clamps to the nearest row. */
export function trainerLevelPercent(size: number): number {
  if (!Number.isFinite(size)) return TRAINER_LEVEL_PERCENT[1];
  const row = Math.min(4, Math.max(1, Math.floor(size))) as TrainerPartySize;
  return TRAINER_LEVEL_PERCENT[row];
}

/**
 * A regular trainer member's level: the live squad level times its party size's
 * percentage, **floored** (never rounded up) and clamped into `1..cap`, where `cap`
 * is the floor's ceiling (`MAP_TUNING.cap`, `levelCapForMap`).
 */
export function trainerLevel(squadLevel: number, size: number, cap: number): number {
  const base = Number.isFinite(squadLevel) ? Math.max(0, squadLevel) : 0;
  const ceiling = Number.isFinite(cap) ? Math.max(1, Math.floor(cap)) : MAP_MAX_LEVEL;
  return Math.min(ceiling, Math.max(1, Math.floor(base * trainerLevelPercent(size))));
}

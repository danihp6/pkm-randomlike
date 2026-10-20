/**
 * How many of a floor's regular rooms hold trainers, by map index
 * (`docs/maps-spec.md` §2). The human's pick: two on map 1, four on the late
 * floors.
 */
export const TRAINER_ROOMS_PER_MAP: readonly number[] = [2, 2, 3, 3, 3, 4, 4, 4];

/** The most trainer rooms any floor may hold, the deep maps included. */
export const TRAINER_ROOMS_MAX = 6;

/** How many trainers one `trainers` room fields, inclusive. */
export const TRAINERS_PER_ROOM: Readonly<{ min: number; max: number }> = { min: 1, max: 2 };

/** The last map the per-map table tunes; past it the count grows one every two maps. */
const LAST_TUNED_MAP = TRAINER_ROOMS_PER_MAP.length;

/**
 * The trainer rooms a floor holds: the table row, or, past the last row, one more
 * every two maps up to `TRAINER_ROOMS_MAX`. Never below `TRAINER_ROOMS_PER_MAP[0]`.
 */
export function trainerRoomsForMap(mapIndex: number): number {
  const index = Math.max(1, Math.floor(mapIndex));
  if (index <= LAST_TUNED_MAP) return TRAINER_ROOMS_PER_MAP[index - 1];
  return Math.min(
    TRAINER_ROOMS_MAX,
    TRAINER_ROOMS_PER_MAP[LAST_TUNED_MAP - 1] + Math.floor((index - LAST_TUNED_MAP) / 2),
  );
}

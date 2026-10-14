/**
 * The fixed party sizes a floor's two hand-placed fights field
 * (`docs/maps-spec.md` §6/§7). They live here rather than on `LevelBand.trainerSize`
 * (which is the *regular* trainer's party, `D39`) or on `MAP_TUNING`: how many
 * members a boss brings is a fact about the boss, not about a band or a map row.
 *
 * **Map 1** is the single exception, because the first floor is the run's on-ramp:
 * it fields each kind's smaller `firstMap` size, and every floor from map 2 on —
 * an infinite run included — fields `size`.
 */

/** Which of a floor's two hand-placed fights a party size belongs to. */
export type BossPartyKind = 'boss' | 'miniboss';

/**
 * A fixed party size per kind. `firstMap` is what **map 1** fields — the run's
 * on-ramp — and `size` is what every floor from map 2 on fields, an infinite run
 * included.
 */
export const BOSS_PARTY: Readonly<Record<BossPartyKind, Readonly<{ firstMap: number; size: number }>>> =
  {
    // The map boss: the floor's finale, at the map's cap.
    boss: { firstMap: 3, size: 6 },
    // The mini-boss: a fixed smaller fight at band levels.
    miniboss: { firstMap: 2, size: 3 },
  };

/**
 * The members `kind`'s trainer fields on `mapIndex`: `firstMap` on map 1 (and on
 * any degenerate index) and `size` from map 2 on.
 */
export function bossPartySize(kind: BossPartyKind, mapIndex: number): number {
  const row = BOSS_PARTY[kind];
  return Number.isFinite(mapIndex) && Math.floor(mapIndex) >= 2 ? row.size : row.firstMap;
}

import type { BoostId } from '../engine/battle/fighter';
import type { RoomConditionId } from './battlefields';

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

/** The two active slots a double battle fields per side. */
export const DOUBLE_ACTIVES = 2;

/** Which of a floor's two hand-placed fights a party size belongs to. */
export type BossPartyKind = 'boss' | 'miniboss';

/** One kind's fixed party: its sizes and whether it fights as a double battle. */
export type BossPartyRow = Readonly<{ firstMap: number; size: number; double: boolean }>;

/**
 * A fixed party size per kind. `firstMap` is what **map 1** fields — the run's
 * on-ramp — and `size` is what every floor from map 2 on fields, an infinite run
 * included. `double` fields two active slots at once: the map boss does, the
 * mini-boss stays a single battle.
 */
export const BOSS_PARTY: Readonly<Record<BossPartyKind, BossPartyRow>> = {
  // The map boss: the floor's finale, at the map's cap, fought as a double battle.
  boss: { firstMap: 3, size: 6, double: true },
  // The mini-boss: a fixed smaller fight at band levels, single.
  miniboss: { firstMap: 2, size: 3, double: false },
};

/**
 * The members `kind`'s trainer fields on `mapIndex`: `firstMap` on map 1 (and on
 * any degenerate index) and `size` from map 2 on.
 */
export function bossPartySize(kind: BossPartyKind, mapIndex: number): number {
  const row = BOSS_PARTY[kind];
  return Number.isFinite(mapIndex) && Math.floor(mapIndex) >= 2 ? row.size : row.firstMap;
}

/** True when `kind`'s fight is a double battle (the map boss). */
export function bossIsDouble(kind: BossPartyKind): boolean {
  return BOSS_PARTY[kind].double;
}

/** Which side a boss opening favours. */
export type BossOpeningSide = 'run' | 'boss';

/**
 * One of the boss room's two openings (`docs/maps-spec.md` §6). `battlefield` is the
 * arena's condition, a `ROOM_BATTLEFIELDS` id; `boosts` is the **one-sided** part:
 * the stat stages the boss's lead (`sides.enemy.party[0]`, the double battle's first
 * active) starts the battle with, through the shipped `BattleSetup.enemyBoosts`.
 */
export type BossOpening = Readonly<{
  side: BossOpeningSide;
  battlefield: RoomConditionId;
  boosts: Readonly<Partial<Record<BoostId, number>>>;
}>;

/**
 * The boss room's own opening, in draw order (the index space of its roll). The two
 * **rows' order is the index space** the boss roll draws from, so a third row
 * appends and never re-shuffles the opening a fixed seed already produced. The arena
 * row is symmetric by the engine's own rules (Endure and the crit stage apply to
 * both sides); the **side** is the stat stage, the only one-sided channel
 * `createBattle` has.
 */
export const BOSS_OPENINGS: readonly BossOpening[] = [
  // The run's opening: the boss's lead is one Speed stage down, so the run moves first.
  { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
  // The boss's opening: its lead is one Defence stage up.
  { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
];

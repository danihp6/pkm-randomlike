import { hashSeed, Rng } from '../engine/rng';
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

/** One kind's fixed party: its sizes and the chance its fight is a double battle. */
export type BossPartyRow = Readonly<{
  firstMap: number;
  size: number;
  /** Probability in `0..1` that this kind's fight fields two actives per side. */
  doubleChance: number;
}>;

/**
 * A fixed party size per kind. `firstMap` is what **map 1** fields — the run's
 * on-ramp — and `size` is what every floor from map 2 on fields, an infinite run
 * included. `doubleChance` is the balancing knob for the double-battle roll: the
 * map boss fields two actives on a quarter of its floors, the mini-boss on a tenth.
 */
export const BOSS_PARTY: Readonly<Record<BossPartyKind, BossPartyRow>> = {
  // The map boss: the floor's finale, at the map's cap.
  boss: { firstMap: 3, size: 6, doubleChance: 0.25 },
  // The mini-boss: a fixed smaller fight at band levels.
  miniboss: { firstMap: 2, size: 3, doubleChance: 0.1 },
};

/**
 * The members `kind`'s trainer fields on `mapIndex`: `firstMap` on map 1 (and on
 * any degenerate index) and `size` from map 2 on.
 */
export function bossPartySize(kind: BossPartyKind, mapIndex: number): number {
  const row = BOSS_PARTY[kind];
  return Number.isFinite(mapIndex) && Math.floor(mapIndex) >= 2 ? row.size : row.firstMap;
}

/**
 * True when `kind`'s fight on `mapIndex` in `routeKey` is a double battle. Draws from
 * its own stream — `hashSeed(`${seed}:double:${kind}:${mapIndex}:${routeKey}`)` — so no
 * existing draw moves and a replay rebuilds the same answer (D11).
 */
export function bossIsDouble(
  kind: BossPartyKind,
  seed: string,
  mapIndex: number,
  routeKey: string,
): boolean {
  return (
    new Rng(hashSeed(`${seed}:double:${kind}:${mapIndex}:${routeKey}`)).next() <
    BOSS_PARTY[kind].doubleChance
  );
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

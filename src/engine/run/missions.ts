import { getMission, MISSION_TABLE, type MissionRow } from '../../data/missions';
import type { FighterSnapshot } from '../battle/fighter';
import { hashSeed, Rng } from '../rng';
import type { RunState } from './state';

/** The run's record of the floor's mission: its row id, its progress and whether it is met. */
export type MissionProgress = Readonly<{ id: string; progress: number; completed: boolean }>;

/**
 * The mission a floor is given, chosen deterministically from the run seed alone:
 * one draw from `Rng(hashSeed(`${seed}:map:${mapIndex}:mission`))`, its own stream,
 * so no `map`/`layout`/`encounters`/roster draw moves (`D11`) and a revisit or a
 * reload picks the same row.
 */
export function missionForMap(seed: string, mapIndex: number): MissionProgress {
  const floor = Math.max(1, Math.floor(mapIndex));
  const rng = new Rng(hashSeed(`${seed}:map:${floor}:mission`));
  const row = MISSION_TABLE[rng.int(0, MISSION_TABLE.length - 1)];
  return { id: row.id, progress: 0, completed: false };
}

/** True when the floor the run stands on meets its mission. `flawless`: no HP lost, no casualty. */
export function missionMet(run: RunState): boolean {
  if (run.mission === null) return false;
  return run.hpLost === 0 && run.stats.casualties === run.floorCasualties;
}

/** Adds HP the squad lost on this floor; a non-positive amount is a no-op (same object). */
export function recordHpLost(run: RunState, amount: number): RunState {
  const loss = Math.floor(amount);
  if (!(loss > 0)) return run;
  return { ...run, hpLost: run.hpLost + loss };
}

/**
 * The HP a battle took out of the party, matched by member id: for every party member
 * that `player` reports, `max(0, before.hp - after.hp)`; a member the battle did not
 * report contributes nothing (the box never fights). Counts a faint as its whole
 * remaining bar, so a casualty always reads as a loss.
 */
export function battleHpLoss(run: RunState, player: readonly FighterSnapshot[]): number {
  const after = new Map(player.map((fighter) => [fighter.id, fighter.hp]));
  let loss = 0;
  for (const member of run.party) {
    const hp = after.get(member.fighter.id);
    if (hp === undefined) continue;
    const drop = member.fighter.hp - hp;
    if (drop > 0) loss += drop;
  }
  return loss;
}

/**
 * The mission the advance just met, or null: reads `missionsCompleted` across the two
 * runs and resolves `before.mission`'s row through `getMission`. The scene raises the
 * notice with it.
 */
export function missionCompletedBy(before: RunState, after: RunState): MissionRow | null {
  if (after.missionsCompleted <= before.missionsCompleted) return null;
  return getMission(before.mission?.id ?? '') ?? null;
}

import {
  cityMissionFor,
  randomMissions,
  STRETCH_MISSION,
  STRETCH_MISSION_ID,
  type StackMissionKind,
  type StackMissionRow,
} from '../../data/missions';
import type { TranslationKey } from '../../i18n';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../run/state';
import { nodeOf, type RegionPlan } from './plan';

/**
 * A node's mission **stack** (`docs/region-spec.md` §7.10): every node the run stands on
 * exposes, in a fixed order, its stretch's automatic mission, its city's fixed one (on a
 * city) and the random row one of that city's NPCs offers, drawn deterministically from
 * the run seed.
 *
 * Every status is **derived** from facts the run already persists — `completedMissions`,
 * `stats.casualties`, `floorCasualties` — so the stack adds no field to the save, no
 * `SAVE_VERSION` step and no write to the legacy floor path. Pure and total: no Phaser,
 * no DOM, no storage and no clock, and the one draw is `random:<nodeKey>`'s own stream,
 * so no `plan`/`layout`/`content`/battle draw moves (`D11`, `D60`).
 */

export type MissionStatus = 'active' | 'failed' | 'met';

export type ActiveMission = Readonly<{
  /** The catalogue row's id. */
  id: string;
  /** `stretch`, `city:<key>` or `random:<key>` — stable, and the card's DOM hook. */
  scopeKey: string;
  nameKey: TranslationKey;
  status: MissionStatus;
  /** 0-2 for the stretch row (casualties taken in this node), 0 for the others. */
  progress: number;
}>;

/** The stretch row's scope key: the same for every node and every badge. */
export const STRETCH_SCOPE_KEY = 'stretch';

/** The scope key of a city's fixed row, and of the random row an NPC of that city offers. */
export function missionScopeKey(kind: StackMissionKind, key: string): string {
  return kind === 'stretch' ? STRETCH_SCOPE_KEY : `${kind}:${key}`;
}

/** The casualties this node has taken: `stats.casualties` since the node was entered. */
export function missionProgress(run: RunState): number {
  return Math.max(0, run.stats.casualties - run.floorCasualties);
}

/** True when the run already recorded `id` as met in `badge`'s stretch. */
function isCompleted(run: RunState, id: string, badge: number): boolean {
  return run.completedMissions.some((entry) => entry.id === id && entry.mapIndex === badge);
}

/**
 * The random row a city's NPC offers at `key`: one draw over `randomMissions()`, off
 * `${seed}:mission:random:<nodeKey>` — keyed by the node, so a revisit reads the same row
 * and another seed reads another (`D11`).
 */
function randomMissionFor(seed: string, key: string): StackMissionRow {
  const pool = randomMissions();
  const rng = new Rng(hashSeed(`${seed}:mission:random:${key}`));
  return pool[rng.int(0, pool.length - 1)];
}

/** The stack of the node the run stands on, in the fixed order stretch → city → random. */
export function activeMissions(run: RunState, plan: RegionPlan): readonly ActiveMission[] {
  const node = nodeOf(plan, run.nodeKey);
  const badge = node?.badge ?? 1;
  const progress = missionProgress(run);
  const stretchStatus: MissionStatus = isCompleted(run, STRETCH_MISSION_ID, badge)
    ? 'met'
    : progress > 0
      ? 'failed'
      : 'active';
  const stretchRow: ActiveMission = {
    id: STRETCH_MISSION.id,
    scopeKey: STRETCH_SCOPE_KEY,
    nameKey: STRETCH_MISSION.nameKey,
    status: stretchStatus,
    progress,
  };
  // Every other kind — town, route, lateral, victory road, league, tower — shows only
  // the automatic row: the city rows are a city's own.
  if (node === undefined || node.kind !== 'city') return [stretchRow];

  const city = cityMissionFor(node.tier ?? 1);
  const offered = randomMissionFor(run.seed, node.key);
  const rowFor = (row: StackMissionRow, kind: StackMissionKind): ActiveMission => ({
    id: row.id,
    scopeKey: missionScopeKey(kind, node.key),
    nameKey: row.nameKey,
    status: isCompleted(run, row.id, node.badge) ? 'met' : 'active',
    progress: 0,
  });
  return [stretchRow, rowFor(city, 'city'), rowFor(offered, 'random')];
}

export type MissionEvent =
  | Readonly<{ kind: 'enter-node'; nodeKey: string }>
  | Readonly<{ kind: 'leader-fallen'; badge: number }>
  | Readonly<{ kind: 'mission-met'; id: string; badge: number }>;

/** Appends `{ id, mapIndex: badge }` and steps the counter, or returns the run it was given. */
function recordCompletion(run: RunState, id: string, badge: number): RunState {
  // A completion lives in a badge stretch, and the ladder starts at 1.
  if (!Number.isInteger(badge) || badge < 1 || isCompleted(run, id, badge)) return run;
  return {
    ...run,
    completedMissions: [...run.completedMissions, { id, mapIndex: badge }],
    missionsCompleted: run.missionsCompleted + 1,
  };
}

/**
 * The run after the event; a no-op returns the same object.
 *
 * `enter-node` opens the node's own stretch: no HP lost yet and `floorCasualties` pinned
 * to the run's count, so the stretch row reads this node's casualties. `leader-fallen` is
 * the stretch's completion and `mission-met` is any row's. A `plan` that does not hold the
 * node the run stands on records nothing: the stack is a stack over region nodes.
 */
export function advanceMissions(run: RunState, event: MissionEvent, plan?: RegionPlan): RunState {
  if (plan !== undefined && nodeOf(plan, run.nodeKey) === undefined) return run;
  if (event.kind === 'enter-node') {
    return { ...run, hpLost: 0, floorCasualties: run.stats.casualties };
  }
  if (event.kind === 'leader-fallen') {
    return recordCompletion(run, STRETCH_MISSION_ID, event.badge);
  }
  return recordCompletion(run, event.id, event.badge);
}

/**
 * The mission tables. Two of them, deliberately apart (`docs/region-spec.md` §7.10):
 *
 * - the **legacy floor** table (`MISSION_TABLE`), kept verbatim for the shipped floor
 *   path (`src/engine/run/missions.ts`, `RouteScene` and `src/ui/hud/state.ts` read it);
 * - the **node-scoped stack** catalogue (`STACK_MISSIONS`), the three rows a region node
 *   exposes: its stretch's automatic mission, its city's fixed one and the random row an
 *   NPC offers. `src/engine/region/missions.ts` derives the stack from it.
 *
 * Pure data — the draw and the status rule live in the engine, so a new mission is a row
 * here, never a branch in a scene.
 */
import type { TranslationKey } from '../i18n';

/** What a met mission pays. A later room task reads the row; nothing here applies it. */
export type MissionReward =
  | Readonly<{ kind: 'room' }>
  | Readonly<{ kind: 'item'; itemId: string; count: number }>
  | Readonly<{ kind: 'money'; amount: number }>;

/** What a mission asks for. One kind ships; a second one adds a row, not an engine branch. */
export type MissionKind = 'flawless';

export type MissionRow = Readonly<{
  id: string;
  kind: MissionKind;
  /** The mission's own display name, in the i18n table. */
  nameKey: TranslationKey;
  reward: MissionReward;
}>;

/**
 * The floor-mission table. `flawless` is the human's first row — «no perder vida» — and
 * its reward is a special room the later room tasks hang off a completed mission.
 */
export const MISSION_TABLE: readonly MissionRow[] = [
  { id: 'flawless', kind: 'flawless', nameKey: 'mission.flawless', reward: { kind: 'room' } },
];

/** The row an id names, or undefined; a plain lookup over the table. */
export function getMission(id: string): MissionRow | undefined {
  return MISSION_TABLE.find((row) => row.id === id);
}

/** Every row of one kind, in table order. */
export function missionsOfKind(kind: MissionKind): readonly MissionRow[] {
  return MISSION_TABLE.filter((row) => row.kind === kind);
}

/** The three scopes the region's stack uses. */
export type StackMissionKind = 'stretch' | 'city' | 'random';

export type StackMissionRow = Readonly<{
  id: string;
  kind: StackMissionKind;
  nameKey: TranslationKey;
  reward: MissionReward;
}>;

/**
 * The stretch's automatic row: the same for every badge, because each stretch asks the
 * same thing — lose nobody before its leader falls. It is the row `advanceMissions`
 * records on a `leader-fallen` event, so its id is the completion's `id`.
 */
export const STRETCH_MISSION_ID = 'stretch';

/** The stretch's automatic row, built once so the id and the row cannot disagree. */
export const STRETCH_MISSION: StackMissionRow = {
  id: STRETCH_MISSION_ID,
  kind: 'stretch',
  nameKey: 'mission.stretch',
  reward: { kind: 'room' },
};

const CITY_MISSION_1: StackMissionRow = {
  id: 'city-1',
  kind: 'city',
  nameKey: 'mission.city1',
  reward: { kind: 'money', amount: 300 },
};

const CITY_MISSION_2: StackMissionRow = {
  id: 'city-2',
  kind: 'city',
  nameKey: 'mission.city2',
  reward: { kind: 'money', amount: 700 },
};

const CITY_MISSION_3: StackMissionRow = {
  id: 'city-3',
  kind: 'city',
  nameKey: 'mission.city3',
  reward: { kind: 'money', amount: 1200 },
};

/** The NPC's pool: the rows a city's random offer is drawn from, in table order. */
const RANDOM_MISSIONS: readonly StackMissionRow[] = [
  {
    id: 'errand',
    kind: 'random',
    nameKey: 'mission.errand',
    reward: { kind: 'item', itemId: 'potion', count: 2 },
  },
  {
    id: 'delivery',
    kind: 'random',
    nameKey: 'mission.delivery',
    reward: { kind: 'item', itemId: 'greatball', count: 2 },
  },
  {
    id: 'tour',
    kind: 'random',
    nameKey: 'mission.tour',
    reward: { kind: 'money', amount: 400 },
  },
];

const STRETCH_MISSIONS: readonly StackMissionRow[] = [STRETCH_MISSION];

const CITY_MISSIONS: readonly StackMissionRow[] = [CITY_MISSION_1, CITY_MISSION_2, CITY_MISSION_3];

/** One row per kind at least; the stretch row is the automatic one. */
export const STACK_MISSIONS: readonly StackMissionRow[] = [
  ...STRETCH_MISSIONS,
  ...CITY_MISSIONS,
  ...RANDOM_MISSIONS,
];

/** The row a stack id names, or undefined; a plain lookup over the catalogue. */
export function getStackMission(id: string): StackMissionRow | undefined {
  return STACK_MISSIONS.find((row) => row.id === id);
}

/** Every row of one scope, in table order. */
export function stackMissionsOfKind(kind: StackMissionKind): readonly StackMissionRow[] {
  if (kind === 'city') return CITY_MISSIONS;
  if (kind === 'random') return RANDOM_MISSIONS;
  return STRETCH_MISSIONS;
}

/** The city's fixed row for a tier (1 | 2 | 3); a rung outside the ladder reads tier 1. */
export function cityMissionFor(tier: 1 | 2 | 3): StackMissionRow {
  if (tier === 2) return CITY_MISSION_2;
  if (tier === 3) return CITY_MISSION_3;
  return CITY_MISSION_1;
}

/** Every random row an NPC can offer, in table order. Never empty: the draw needs a pool. */
export function randomMissions(): readonly StackMissionRow[] {
  return RANDOM_MISSIONS;
}

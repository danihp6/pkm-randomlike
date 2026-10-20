/**
 * The floor-mission table (`docs/maps-spec.md` §7, `docs/routes-spec.md` §4): what
 * a floor can ask of the run and what meeting it pays. Pure data — the floor picks
 * a row off its own stream (`src/engine/run/missions.ts`) and the rule that decides
 * whether a row is met lives there too, so a second mission is a row and a kind,
 * never a branch in the scene.
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
 * The mission table. `flawless` is the human's first row — «no perder vida» — and
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

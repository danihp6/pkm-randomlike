import type { TerrainId, WeatherId } from '../engine/battle/state';

/** The kind of condition a row carries. */
export type RoomConditionKind = 'weather' | 'terrain' | 'field';

/** The whole-field conditions a room may name (they are not weathers and no move sets them). */
export type RoomFieldConditionId =
  | 'fog'
  | 'gravity'
  | 'trickroom'
  | 'radiant'
  | 'darkaura'
  | 'fairyaura'
  | 'alltypes'
  | 'endure'
  | 'crit';

/** The all-types row's one type: every fighter becomes this type for the battle. */
export const ALL_TYPES_OVERRIDE: string = 'Normal';

/** The crit row's stage bonus: +1 stage on the crit-ratio ladder (1/8). */
export const ROOM_CRIT_STAGE: number = 1;

/** Every condition a room's battle can begin under. */
export type RoomConditionId = WeatherId | TerrainId | RoomFieldConditionId;

/** One `ROOM_BATTLEFIELDS` row: what a room rolls, and the filter the route paints for it. */
export type RoomBattlefield = Readonly<{
  id: RoomConditionId;
  kind: RoomConditionKind;
  /** The overlay's colour, `0xRRGGBB`. */
  tint: number;
  /** The overlay's alpha, `0 < alpha <= 1`. */
  alpha: number;
}>;

/**
 * The conditions a room's battle can begin under (`docs/maps-spec.md` §7). The
 * **seventeen rows' order is the index space** the room roll draws from, so a new
 * row appends and never re-shuffles the ones a fixed seed already produced. The
 * tints sit far from the tile palette (greens, browns) so the filter reads as
 * weather and not as terrain, and the alphas are high enough to be seen: fog is
 * the densest.
 */
export const ROOM_BATTLEFIELDS: readonly RoomBattlefield[] = [
  { id: 'sun', kind: 'weather', tint: 0xf0a83c, alpha: 0.22 },
  { id: 'rain', kind: 'weather', tint: 0x3c6ea5, alpha: 0.22 },
  { id: 'sand', kind: 'weather', tint: 0xc7a26a, alpha: 0.22 },
  { id: 'snow', kind: 'weather', tint: 0xd8e6ef, alpha: 0.22 },
  { id: 'electric', kind: 'terrain', tint: 0xf0d23c, alpha: 0.2 },
  { id: 'grassy', kind: 'terrain', tint: 0x4fae52, alpha: 0.2 },
  { id: 'misty', kind: 'terrain', tint: 0xe08fc0, alpha: 0.2 },
  { id: 'psychic', kind: 'terrain', tint: 0xb45ad0, alpha: 0.2 },
  { id: 'fog', kind: 'field', tint: 0xb8c2cc, alpha: 0.3 },
  { id: 'gravity', kind: 'field', tint: 0x5a4a8a, alpha: 0.24 },
  { id: 'trickroom', kind: 'field', tint: 0x8a4ad0, alpha: 0.24 },
  { id: 'radiant', kind: 'field', tint: 0xf5f0d0, alpha: 0.26 },
  { id: 'darkaura', kind: 'field', tint: 0x4b2a6a, alpha: 0.26 },
  { id: 'fairyaura', kind: 'field', tint: 0xe48fc4, alpha: 0.24 },
  { id: 'alltypes', kind: 'field', tint: 0x9aa3ad, alpha: 0.2 },
  { id: 'endure', kind: 'field', tint: 0xb8a06a, alpha: 0.22 },
  { id: 'crit', kind: 'field', tint: 0xc0392b, alpha: 0.22 },
];

/**
 * The chance a room that fields regular trainers starts its battles under a
 * condition (about one such room in seven, so a floor usually holds one). The
 * same magnitude as the mega-stone leaf's 15% (`MEGA_STONE_CHANCE`,
 * `src/engine/maps/plan.ts`).
 */
export const ROOM_BATTLEFIELD_CHANCE: number = 0.15;

/**
 * The boss room's own chance (`docs/maps-spec.md` §6): the floor's headline fight
 * is likelier to carry a condition than a regular room.
 */
export const BOSS_BATTLEFIELD_CHANCE: number = 0.3;

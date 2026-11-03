import type { PoiKind } from '../engine/region/content';
import { BANNED_ROOM, type BannedRoomConfig } from './bannedRoom';
import { GATE_KINDS, type GateKind } from './gates';
import { BARRED_HEALING_MOVES, NO_HEAL_ROOM, type NoHealRoomConfig } from './noHeal';
import { PUZZLE_STACK, type PuzzleStackEntry } from './puzzles';
import { SECRET_SHOP, type SecretShopConfig } from './shop';
import {
  LEGENDARY_ROOM,
  LEGENDARY_SPECIES,
  STATIC_ROOM,
  STATIC_SPECIES,
  type StaticRoomConfig,
} from './staticSpecies';

/**
 * The nine points of interest a lateral's terminus can end on (`docs/region-spec.md`
 * §7.8), one row per `PoiKind`. A row that has a retired room table under it
 * **references** that table instead of copying it: the vault's seals, the no-heal
 * room's rule and barred moves, the banned-species row, the secret shop's shelf, the
 * static's and the legendary's species and the puzzle stack. The kind a terminus ends
 * on is `src/engine/region/content.ts`'s draw (§7.3), never this table's, and the
 * geometry is the two zone sizes the engine reads.
 */

/** How big a POI's zone is on the route, in tiles. One size for every kind. */
export const POI_ZONE_WIDTH = 7;
export const POI_ZONE_HEIGHT = 5;

export type PoiRow =
  | Readonly<{ kind: 'vault'; gateKinds: readonly GateKind[] }>
  | Readonly<{ kind: 'miniboss' }>
  | Readonly<{ kind: 'trade' }>
  | Readonly<{ kind: 'no-heal'; room: NoHealRoomConfig; barredMoves: readonly string[] }>
  | Readonly<{ kind: 'static'; room: StaticRoomConfig; species: readonly string[] }>
  | Readonly<{ kind: 'secret-shop'; shop: SecretShopConfig; shelf: readonly string[] }>
  | Readonly<{ kind: 'banned'; room: BannedRoomConfig }>
  | Readonly<{ kind: 'puzzle'; stack: readonly PuzzleStackEntry[] }>
  | Readonly<{ kind: 'legendary'; room: StaticRoomConfig; species: readonly string[] }>;

/** The one row a kind reads, so a caller narrows on `row.kind` and nothing else. */
type PoiRowOf<K extends PoiKind> = Extract<PoiRow, { kind: K }>;

export const POI_ROWS: Readonly<{ [K in PoiKind]: PoiRowOf<K> }> = {
  vault: { kind: 'vault', gateKinds: GATE_KINDS },
  miniboss: { kind: 'miniboss' },
  trade: { kind: 'trade' },
  'no-heal': { kind: 'no-heal', room: NO_HEAL_ROOM, barredMoves: BARRED_HEALING_MOVES },
  static: { kind: 'static', room: STATIC_ROOM, species: STATIC_SPECIES },
  'secret-shop': {
    kind: 'secret-shop',
    shop: SECRET_SHOP,
    shelf: [...SECRET_SHOP.held, ...SECRET_SHOP.tm],
  },
  banned: { kind: 'banned', room: BANNED_ROOM },
  puzzle: { kind: 'puzzle', stack: PUZZLE_STACK },
  legendary: { kind: 'legendary', room: LEGENDARY_ROOM, species: LEGENDARY_SPECIES },
};

/** The row a kind reads; total over `PoiKind`, so no caller needs a fallback. */
export function poiRow(kind: PoiKind): PoiRow {
  return POI_ROWS[kind];
}

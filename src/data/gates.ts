import { BUSH, ROCK, WATER } from '../engine/map';
import { FRAME_WATER_INTERIOR } from '../engine/tileset';
import { FRLG_OBSTACLE_BUSH, FRLG_OBSTACLE_ROCK } from './tilesets/frlg';

/**
 * The gated reward room's own content table (`docs/maps-spec.md` §7): the three
 * obstacles a room's vault can be sealed with, the **party types** that open each
 * one and the FRLG atlas cell it draws. Pure data: the generator picks a kind off
 * its own stream (`src/engine/routes/gate.ts`) and the run predicate that reads it
 * lives in `src/engine/run/party.ts`.
 */

/** The three obstacles a gated room can seal its vault with. Content vocabulary. */
export type GateKind = 'bush' | 'rock' | 'water';

/**
 * One obstacle: the party types that open it, the map value it is stamped as, and the
 * FRLG atlas cell it draws. A **type list** (not one type), so "Bug or Grass" is data.
 */
export type GateRow = Readonly<{
  /** Party types that open it; one member of any one of them is enough. */
  types: readonly string[];
  /** The map value the seal is stamped as (`src/engine/map.ts`). */
  tile: number;
  /** The FRLG atlas cell it draws (`FRLG_OBSTACLE_*` / `FRAME_WATER_INTERIOR`). */
  frame: number;
}>;

/** Every obstacle kind, in the generator's pick order (`src/engine/routes/gate.ts`). */
export const GATE_KINDS: readonly GateKind[] = ['bush', 'rock', 'water'];

export const GATES: Readonly<Record<GateKind, GateRow>> = {
  bush: { types: ['Bug', 'Grass'], tile: BUSH, frame: FRLG_OBSTACLE_BUSH },
  rock: { types: ['Rock', 'Fighting'], tile: ROCK, frame: FRLG_OBSTACLE_ROCK },
  water: { types: ['Water'], tile: WATER, frame: FRAME_WATER_INTERIOR },
};

/** The row a kind reads; total over `GateKind`, so no caller needs a fallback. */
export function gateRow(kind: GateKind): GateRow {
  return GATES[kind];
}

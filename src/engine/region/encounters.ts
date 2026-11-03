import type { Rng } from '../rng';
import { bandForNode, wildLevel } from '../run/levelCurve';
import { wildExclusions } from '../run/pool';
import { squadLevel, type RunState } from '../run/state';
import {
  DEFAULT_ENCOUNTER_CHANCE,
  encounterTableFor,
  rollEncounter,
  type Encounter,
  type EncounterTable,
} from '../routes/encounters';
import type { RegionNode } from './plan';

/**
 * A node's wild encounters (`docs/region-spec.md` §7.9): the table its own stretch
 * offers and the level a wild of it rolls. The two rules are the shipped ones — the
 * band's `wild` pool (`encounterTableFor`) and `wildLevel`'s share of the squad — and
 * the only thing this module adds is that both read the **node** rather than a floor's
 * band: the pool is the node's (`bandForNode`), the level is clamped to the node's own
 * cap, and the chance is the shipped `DEFAULT_ENCOUNTER_CHANCE`.
 *
 * Pure and total: the only randomness is the `Rng` the caller hands in (`D11`), so the
 * scene owns the stream and a fixed seed replays the same grass.
 */

/** The chance a step in a node's grass rolls a wild: the shipped `DEFAULT_ENCOUNTER_CHANCE`. */
export const NODE_ENCOUNTER_CHANCE: number = DEFAULT_ENCOUNTER_CHANCE;

/** The node's wild table: its band's pool (`bandForNode`) minus the run's exclusions. */
export function nodeEncounterTable(node: RegionNode, run: RunState): EncounterTable {
  return encounterTableFor(bandForNode(node), wildExclusions(run));
}

/** The level a wild of this node rolls: `wildLevel(squadLevel(run), rng)`, clamped to `node.cap`. */
export function nodeWildLevel(node: RegionNode, run: RunState, rng: Rng): number {
  const cap = Math.max(1, Math.floor(node.cap));
  return Math.min(cap, Math.max(1, wildLevel(squadLevel(run), rng)));
}

/** One step's roll: the table, the level rule and `NODE_ENCOUNTER_CHANCE`, in that order. */
export function rollNodeEncounter(
  node: RegionNode,
  run: RunState,
  rng: Rng,
  options?: Readonly<{ shinyRng?: Rng }>,
): Encounter | undefined {
  return rollEncounter(
    nodeEncounterTable(node, run),
    rng,
    (levelRng) => nodeWildLevel(node, run, levelRng),
    NODE_ENCOUNTER_CHANCE,
    options?.shinyRng,
    rng.split('variant'),
  );
}

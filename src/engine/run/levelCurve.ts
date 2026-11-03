import { badgeCap } from '../../data/region';
import { LEVEL_BANDS, bandForLevel, type LevelBand } from '../../data/run';
import { trainerSizeFactor } from '../../data/trainerLevels';
import { WILD_LEVEL_FRACTION } from '../../data/wildLevels';
import type { RegionNode } from '../region/plan';
import type { Rng } from '../rng';

/**
 * The region's level rules. A node stores no level range: its cap is the only
 * anchor (`D29`, `docs/region-spec.md` §3), and everything else is derived — a
 * regular trainer steps back from the gym that closes its stretch, a wild sits in
 * `WILD_LEVEL_FRACTION` of the squad, a gym leader sits on the cap itself. Pure and
 * total; `wildLevel` is the only rule that draws, one `Rng.next()` from the stream
 * its caller hands it (`D11`).
 */

/** A regular trainer member's level: `cap` less the distance's worth, floored, in `1..cap`. */
export function trainerLevel(cap: number, gymDistance: number, partySize: 1 | 2 | 3): number {
  const ceiling = Math.max(1, Math.floor(cap));
  const distance = Math.max(0, Math.floor(gymDistance));
  return Math.min(ceiling, Math.max(1, Math.floor(ceiling - distance * trainerSizeFactor(partySize))));
}

/** A wild encounter's level: 60-75 % of the squad's, floored, never below 2. */
export function wildLevel(squadLevel: number, rng: Rng): number {
  const share =
    WILD_LEVEL_FRACTION.min + rng.next() * (WILD_LEVEL_FRACTION.max - WILD_LEVEL_FRACTION.min);
  return Math.max(2, Math.floor(Math.max(0, squadLevel) * share));
}

/** A gym leader's level: the cap itself, floored, never below 1. */
export function leaderLevel(cap: number): number {
  return Math.max(1, Math.floor(cap));
}

/** The band a node reads: the previous stretch's cap up to this node's own cap. */
export function bandForNode(node: RegionNode): LevelBand {
  const minLevel = node.badge <= 1 ? LEVEL_BANDS[0].minLevel : badgeCap(node.badge - 1);
  const maxLevel = node.cap;
  return { ...bandForLevel(minLevel), minLevel, maxLevel };
}

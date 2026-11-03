import { BADGE_CAPS } from '../../data/region';
import { nodeOf } from '../region/plan';
import type { RegionPlan } from '../region/plan';

/**
 * The guard on the region's exits (`docs/region-spec.md` §4): leaving a city needs that
 * city's badge, walking back never does, and a locked exit names the badge it wants.
 *
 * Both predicates are pure and total — no throw for an unknown key, no RNG, no clock — and
 * they read the badge list, never a `RunState`, so a caller can ask about a walk it has not
 * committed to yet.
 */

/** One edge's answer: the badge it asks for, and whether the run holds it. */
export type ExitGate = Readonly<{ open: boolean; badge: number }>;

/**
 * The guard on `fromKey`'s forward edge, or null when the edge is not a gate.
 * It takes the badge list, never a `RunState`.
 */
export function exitGate(
  plan: RegionPlan,
  fromKey: string,
  toKey: string,
  badges: readonly number[],
): ExitGate | null {
  const from = nodeOf(plan, fromKey);
  const to = nodeOf(plan, toKey);
  if (!from || !to) return null;
  if (!from.edges.includes(toKey)) return null;
  if (from.kind !== 'city') return null;
  // Only the main-chain step forward is gated: an edge back and a lateral are never gates.
  if (plan.chain.indexOf(toKey) !== plan.chain.indexOf(fromKey) + 1) return null;
  return { badge: from.badge, open: badges.includes(from.badge) };
}

/** The gym badge a node's way forward asks for, or null when no gym is ahead. */
export function nextBadge(plan: RegionPlan, fromKey: string): number | null {
  const node = nodeOf(plan, fromKey);
  if (!node) return null;
  // Badge 9 is the Victory Road, the League and the tower: no gym is ahead of them.
  if (node.badge > BADGE_CAPS.length) return null;
  return node.badge;
}

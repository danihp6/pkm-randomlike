import { BADGE_CAPS } from '../data/region';
import type { RegionNodeKind, RegionPlan } from '../engine/region/plan';

/**
 * The region map's view (`docs/region-spec.md` §5, `D64`): the plan's node graph read
 * as markers and edges, with the run's three node facts over it — where the run stands,
 * where it has been, how many badges it holds. Pure and total: no Preact, no DOM, no
 * Phaser, no clock and no `Rng`, so the same plan and run always give the same map and
 * the card only ever paints what this returns.
 *
 * The card is a straight-line graph, so the only geometry here is the plan's own grid
 * cell per node, shifted by the graph's minima: the plan jitters `y` around zero and
 * puts a lateral three cells off its parent's row, so an unshifted map would draw half
 * its nodes above the band's top edge.
 */

/** The three run facts the region map reads. `RunState` satisfies this shape. */
export type RegionMapRun = Readonly<{
  /** The node the run stands on. */
  nodeKey: string;
  /** Every node the run has entered, in first-entry order. */
  visitedNodes: readonly string[];
  /** The badges held; only its length is drawn. */
  badges: readonly number[];
}>;

/** One node as the card draws it. */
export type RegionNodeMarker = Readonly<{
  /** `node.key` — the card's `data-hud-region-node` value. */
  key: string;
  kind: RegionNodeKind;
  /** `node.name` (`'Viridian Forest'`, `'Route 3'`, `'League'`). */
  name: string;
  /** The plan's own grid column/row, shifted so the whole graph starts at 0, 0. */
  x: number;
  y: number;
  visited: boolean;
  current: boolean;
}>;

/** One plan edge, each pair emitted once. */
export type RegionMapEdge = Readonly<{ from: string; to: string }>;

export type RegionMapView = Readonly<{
  /** The graph's extent in plan cells: `max(x) + 1`, `max(y) + 1`. */
  width: number;
  height: number;
  /** The current node's `name`, the card's title line; `''` when the plan holds no such node. */
  title: string;
  /** `run.badges.length`. */
  badges: number;
  /** `BADGE_CAPS.length` (8) — the ladder's own width, never a literal. */
  badgeTotal: number;
  /** One marker per plan node, in `plan.nodes` order. */
  markers: readonly RegionNodeMarker[];
  /** Every plan edge once, in `plan.nodes` order of its `from` end. */
  edges: readonly RegionMapEdge[];
}>;

/** The plan's smallest cell on each axis: the shift every marker takes. */
function minima(plan: RegionPlan): Readonly<{ x: number; y: number }> {
  let x = Number.POSITIVE_INFINITY;
  let y = Number.POSITIVE_INFINITY;
  for (const node of plan.nodes) {
    x = Math.min(x, node.position.x);
    y = Math.min(y, node.position.y);
  }
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

/**
 * The region as the card draws it. A node is `visited` when the run has entered it and
 * `current` when it is the one the run stands on; every edge is emitted once, from the
 * end that sits earlier in `plan.nodes`, and a neighbour the plan does not hold is
 * skipped so the function stays total over a hand-built plan.
 */
export function regionMapView(plan: RegionPlan, run: RegionMapRun): RegionMapView {
  const shift = minima(plan);
  const visited = new Set(run.visitedNodes);
  const at = new Map<string, number>();
  plan.nodes.forEach((node, index) => at.set(node.key, index));

  const markers: RegionNodeMarker[] = plan.nodes.map((node) => ({
    key: node.key,
    kind: node.kind,
    name: node.name,
    x: node.position.x - shift.x,
    y: node.position.y - shift.y,
    visited: visited.has(node.key),
    current: node.key === run.nodeKey,
  }));

  const edges: RegionMapEdge[] = [];
  plan.nodes.forEach((node, index) => {
    for (const neighbour of node.edges) {
      const other = at.get(neighbour);
      if (other === undefined || other <= index) continue;
      edges.push({ from: node.key, to: neighbour });
    }
  });

  let width = 0;
  let height = 0;
  for (const marker of markers) {
    width = Math.max(width, marker.x + 1);
    height = Math.max(height, marker.y + 1);
  }

  const current = plan.nodes.find((node) => node.key === run.nodeKey);

  return {
    width,
    height,
    title: current === undefined ? '' : current.name,
    badges: run.badges.length,
    badgeTotal: BADGE_CAPS.length,
    markers,
    edges,
  };
}

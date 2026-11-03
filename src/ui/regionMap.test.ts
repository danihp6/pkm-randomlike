import { describe, expect, it } from 'vitest';
import { BADGE_CAPS } from '../data/region';
import { planRegion, type RegionNode, type RegionPlan } from '../engine/region/plan';
import { regionMapView, type RegionMapRun } from './regionMap';

/**
 * The region map's view, headless: the plan's node graph read as markers and edges
 * (`docs/region-spec.md` §5). Every assertion below is pinned on a fixed seed, so a
 * generator change that moves a node or an edge shows up here and not only on screen.
 */

const SEED = 'task-281';
const PLAN = planRegion(SEED);
const RUN: RegionMapRun = { nodeKey: PLAN.townKey, visitedNodes: [PLAN.townKey], badges: [] };

const view = (run: RegionMapRun = RUN, plan: RegionPlan = PLAN) => regionMapView(plan, run);

const minX = (plan: RegionPlan): number => Math.min(...plan.nodes.map((node) => node.position.x));
const minY = (plan: RegionPlan): number => Math.min(...plan.nodes.map((node) => node.position.y));

/** A hand-built plan: one cell per node, the graph the view must stay total over. */
function node(key: string, x: number, y: number, edges: readonly string[]): RegionNode {
  return {
    key,
    kind: 'route',
    id: 1,
    name: key,
    badge: 1,
    cap: 9,
    gymDistance: 0,
    tier: null,
    gym: false,
    lateralOf: null,
    position: { x, y },
    edges,
  };
}

function plan(nodes: readonly RegionNode[]): RegionPlan {
  return {
    seed: 'synthetic',
    nodes,
    townKey: nodes[0]?.key ?? '',
    chain: nodes.map((entry) => entry.key),
    gymKeys: [],
  };
}

describe('regionMapView', () => {
  it('draws one marker per plan node, in plan order', () => {
    const region = view();
    expect(region.markers).toHaveLength(PLAN.nodes.length);
    expect(region.markers.map((marker) => marker.key)).toEqual(PLAN.nodes.map((entry) => entry.key));
    expect(region.markers.map((marker) => marker.kind)).toEqual(PLAN.nodes.map((entry) => entry.kind));
    expect(region.markers.map((marker) => marker.name)).toEqual(PLAN.nodes.map((entry) => entry.name));
  });

  it('shifts every cell by the graph minima, so the map starts at 0, 0', () => {
    const region = view();
    const x0 = minX(PLAN);
    const y0 = minY(PLAN);
    region.markers.forEach((marker, index) => {
      const node = PLAN.nodes[index]!;
      expect(marker.x, node.key).toBe(node.position.x - x0);
      expect(marker.y, node.key).toBe(node.position.y - y0);
    });
    expect(Math.min(...region.markers.map((marker) => marker.x))).toBe(0);
    expect(Math.min(...region.markers.map((marker) => marker.y))).toBe(0);
  });

  it('bounds the graph at the shifted maximum plus one', () => {
    const region = view();
    expect(region.width).toBe(Math.max(...region.markers.map((marker) => marker.x)) + 1);
    expect(region.height).toBe(Math.max(...region.markers.map((marker) => marker.y)) + 1);
    expect(region.width).toBeGreaterThan(0);
    expect(region.height).toBeGreaterThan(0);
  });

  it('flags the node the run stands on, and no other', () => {
    const region = view();
    const current = region.markers.filter((marker) => marker.current);
    expect(current.map((marker) => marker.key)).toEqual([PLAN.townKey]);
    const away = view({ nodeKey: 'city:4', visitedNodes: [PLAN.townKey, 'city:4'], badges: [] });
    expect(away.markers.filter((marker) => marker.current).map((marker) => marker.key)).toEqual([
      'city:4',
    ]);
  });

  it('flags exactly the nodes the run has entered', () => {
    const visitedNodes = [PLAN.townKey, 'route:1', 'city:1'];
    const region = view({ nodeKey: 'city:1', visitedNodes, badges: [] });
    const marked = region.markers.filter((marker) => marker.visited).map((marker) => marker.key);
    expect(marked).toEqual(visitedNodes);
    const keys = new Set(PLAN.nodes.map((entry) => entry.key));
    expect(marked.every((key) => keys.has(key))).toBe(true);
    expect(
      view({ nodeKey: PLAN.townKey, visitedNodes: [], badges: [] }).markers.some((m) => m.visited),
    ).toBe(false);
  });

  it('emits every plan edge exactly once, with both ends held by the plan', () => {
    const region = view();
    const keys = new Set(PLAN.nodes.map((entry) => entry.key));
    const pairs = region.edges.map((edge) => `${edge.from}|${edge.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const edge of region.edges) {
      expect(keys.has(edge.from), edge.from).toBe(true);
      expect(keys.has(edge.to), edge.to).toBe(true);
    }
    const undirected = PLAN.nodes.reduce((sum, entry) => sum + entry.edges.length, 0) / 2;
    expect(region.edges).toHaveLength(undirected);
    for (const entry of PLAN.nodes) {
      for (const neighbour of entry.edges) {
        const emitted = pairs.some(
          (pair) => pair === `${entry.key}|${neighbour}` || pair === `${neighbour}|${entry.key}`,
        );
        expect(emitted, `${entry.key} - ${neighbour}`).toBe(true);
      }
    }
  });

  it('titles the card with the current node name, and nothing off the plan', () => {
    const town = PLAN.nodes.find((entry) => entry.key === PLAN.townKey)!;
    expect(view().title).toBe(town.name);
    expect(view({ nodeKey: 'nowhere:9', visitedNodes: [], badges: [] }).title).toBe('');
  });

  it('counts the badges held against the ladder width', () => {
    expect(view().badges).toBe(0);
    expect(view({ nodeKey: PLAN.townKey, visitedNodes: [], badges: [1, 2, 3] }).badges).toBe(3);
    expect(view().badgeTotal).toBe(BADGE_CAPS.length);
    expect(view().badgeTotal).toBe(8);
  });

  it('is pure: the same arguments deep-equal, and neither one is mutated', () => {
    const run: RegionMapRun = { nodeKey: 'city:2', visitedNodes: [PLAN.townKey, 'city:2'], badges: [1] };
    const before = JSON.stringify({ plan: PLAN, run });
    const first = regionMapView(PLAN, run);
    const second = regionMapView(PLAN, run);
    expect(second).toEqual(first);
    expect(JSON.stringify({ plan: PLAN, run })).toBe(before);
  });
});

describe('a plan whose rows are negative', () => {
  const twoRows = plan([node('route:1', 4, -3, ['route:2']), node('route:2', 4, -5, ['route:1'])]);
  const region = regionMapView(twoRows, { nodeKey: 'route:1', visitedNodes: ['route:1'], badges: [] });

  it('starts the map at row 0 anyway', () => {
    expect(minY(twoRows)).toBeLessThan(0);
    expect(Math.min(...region.markers.map((marker) => marker.y))).toBe(0);
    expect(region.markers.map((marker) => marker.y)).toEqual([2, 0]);
    expect(region.markers.map((marker) => marker.x)).toEqual([0, 0]);
    expect(region.height).toBe(3);
    expect(region.width).toBe(1);
  });

  it('pins the real seed\u2019s own negative row', () => {
    expect(minY(PLAN)).toBeLessThan(0);
    expect(PLAN.nodes.filter((entry) => entry.position.y < 0).length).toBeGreaterThan(0);
    expect(Math.min(...view().markers.map((marker) => marker.y))).toBe(0);
  });

  it('skips an edge whose neighbour the plan does not hold', () => {
    const dangling = plan([node('route:1', 0, 0, ['route:2', 'ghost:7'])]);
    expect(regionMapView(dangling, { nodeKey: 'route:1', visitedNodes: [], badges: [] }).edges).toEqual(
      [],
    );
  });
});

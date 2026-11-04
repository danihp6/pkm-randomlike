import { describe, expect, it } from 'vitest';
import { biomeForRoute } from '../../../data/biomes';
import { ROUTE_HEIGHTS, ROUTE_WIDTH } from '../../../data/region';
import { nodeOf, planRegion, type RegionNode, type RegionPlan } from '../plan';
import { isRouteKind, planRouteLayout, routeScreens, SCREEN_HEIGHT, spineSegments } from './layout';
import { generateRoute } from './map';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const SCREEN_COUNTS = [2, 3, 4] as const;

function routeNodes(plan: RegionPlan): readonly RegionNode[] {
  return plan.nodes.filter((node) => node.kind === 'route' || node.kind === 'lateral');
}

function byRow(a: Readonly<{ x: number; y: number }>, b: Readonly<{ x: number; y: number }>): number {
  return a.y - b.y || a.x - b.x;
}

describe('region route layout', () => {
  it('stacks two, three and four 60x40 screens from the node', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of routeNodes(plan)) {
        const layout = planRouteLayout(plan, node.key);
        const label = `${seed} ${node.key}`;
        expect(SCREEN_COUNTS, label).toContain(layout.screens.length);
        expect(layout.seed, label).toBe(seed);
        expect(layout.key, label).toBe(node.key);
        expect(layout.width, label).toBe(ROUTE_WIDTH);
        expect(layout.height, label).toBe(ROUTE_HEIGHTS[layout.screens.length - 2]);
        expect(layout.biomeId, label).toBe(biomeForRoute(node.id).id);
        expect(layout.height / SCREEN_HEIGHT, label).toBeGreaterThan(layout.screens.length - 1);
        layout.screens.forEach((screen, index) => {
          expect(screen.index, label).toBe(index);
          expect(screen.top, label).toBe(index * SCREEN_HEIGHT);
          if (index > 0) expect(screen.top, label).toBe(layout.screens[index - 1].bottom + 1);
          expect(screen.bottom, label).toBeLessThan(layout.height);
        });
        expect(layout.screens[layout.screens.length - 1].bottom, label).toBe(layout.height - 1);
        const rows = layout.screens.reduce(
          (total, screen) => total + (screen.bottom - screen.top + 1),
          0,
        );
        expect(rows, label).toBe(layout.height);
      }
    }
  });

  it('names every neighbour exactly once, the entry band on N', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of routeNodes(plan)) {
        const openings = planRouteLayout(plan, node.key).openings;
        const label = `${seed} ${node.key}`;
        expect(openings.map((opening) => opening.neighbourKey).sort(), label).toEqual(
          [...node.edges].sort(),
        );
        const entries = openings.filter((opening) => opening.role === 'entry');
        expect(entries, label).toHaveLength(1);
        expect(entries[0].edge, label).toBe('N');
        for (const exit of openings.filter((opening) => opening.role === 'exit')) {
          expect(exit.edge, label).not.toBe('N');
        }
        expect(new Set(openings.map((opening) => opening.edge)).size, label).toBe(openings.length);
        if (node.edges.length === 1) {
          expect(openings, label).toHaveLength(1);
          expect(openings[0].role, label).toBe('entry');
        }
        if (node.kind === 'route') {
          const at = plan.chain.indexOf(node.key);
          expect(entries[0].neighbourKey, label).toBe(plan.chain[at - 1]);
          expect(
            openings.some((opening) => opening.edge === 'S'),
            label,
          ).toBe(true);
        } else {
          expect(node.lateralOf, label).toBe(entries[0].neighbourKey);
          expect(
            openings.some((opening) => opening.role === 'exit'),
            label,
          ).toBe(false);
        }
      }
    }
  });

  it('forces a screen count without moving the openings', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of routeNodes(plan)) {
        const rolled = planRouteLayout(plan, node.key);
        const label = `${seed} ${node.key}`;
        for (const count of SCREEN_COUNTS) {
          const forced = planRouteLayout(plan, node.key, count);
          expect(forced.openings, `${label} ${count}`).toEqual(rolled.openings);
          expect(forced.biomeId, `${label} ${count}`).toBe(rolled.biomeId);
          expect(forced.width, `${label} ${count}`).toBe(rolled.width);
          expect(forced.height, `${label} ${count}`).toBe(ROUTE_HEIGHTS[count - 2]);
          expect(forced.screens, `${label} ${count}`).toEqual(routeScreens(count));
        }
      }
    }
  });

  it('splits the spine per screen, one non-empty segment each', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const count of SCREEN_COUNTS) {
        const layout = planRouteLayout(plan, 'route:1', count);
        const map = generateRoute(plan, 'route:1', count);
        const segments = spineSegments(layout, map.spine);
        const label = `${seed} ${count}`;
        expect(segments, label).toHaveLength(layout.screens.length);
        for (const [index, segment] of segments.entries()) {
          expect(segment.length, `${label} #${index}`).toBeGreaterThan(0);
          const screen = layout.screens[index];
          expect(
            segment.every((tile) => tile.y >= screen.top && tile.y <= screen.bottom),
            `${label} #${index}`,
          ).toBe(true);
        }
        expect(segments.flat().sort(byRow), label).toEqual([...map.spine].sort(byRow));
      }
    }
  }, 60_000);

  it('carries the whole spine, from the entry band to the last exit band', () => {
    const plan = planRegion('alpha');
    const map = generateRoute(plan, 'route:1', 2);
    const rows = map.spine.map((tile) => tile.y);
    expect(Math.min(...rows)).toBe(0);
    expect(Math.max(...rows)).toBe(map.height - 1);
  });

  it('rejects a key that is not a route or a lateral', () => {
    const plan = planRegion('alpha');
    expect(() => planRouteLayout(plan, 'city:1')).toThrow(/^not a route node: city:1$/);
    expect(() => planRouteLayout(plan, 'nope:1')).toThrow(/^not a route node: nope:1$/);
    expect(() => planRouteLayout(plan, 'town:1')).toThrow(/^not a route node: town:1$/);
    expect(() => planRouteLayout(plan, 'route:1', 5 as unknown as 2)).toThrow(/^bad screen count: 5$/);
  });
});

describe('isRouteKind', () => {
  it('answers yes for the three kinds the route screen walks and no for every other', () => {
    expect(isRouteKind('route')).toBe(true);
    expect(isRouteKind('lateral')).toBe(true);
    expect(isRouteKind('victory-road')).toBe(true);
    for (const kind of ['town', 'city', 'league', 'tower', 'route ', '']) {
      expect(isRouteKind(kind), kind).toBe(false);
    }
  });
});

describe('the Victory Road layout', () => {
  const ROAD_SEEDS = ['alpha', 'task-303'];

  it('answers four contiguous screens of the forest, entered from the city and left east', () => {
    for (const seed of ROAD_SEEDS) {
      const plan = planRegion(seed);
      const node = nodeOf(plan, 'victory-road:1');
      expect(node, seed).toBeDefined();
      if (node === undefined) return;
      const layout = planRouteLayout(plan, node.key);
      expect(layout.key, seed).toBe('victory-road:1');
      expect(layout.seed, seed).toBe(seed);
      expect(layout.width, seed).toBe(ROUTE_WIDTH);
      expect(layout.height, seed).toBe(ROUTE_HEIGHTS[2]);
      expect(layout.screens.length, seed).toBe(4);
      expect(layout.biomeId, seed).toBe(biomeForRoute(node.id).id);
      expect(layout.biomeId, seed).toBe('forest');
      layout.screens.forEach((screen, index) => {
        expect(screen.index, seed).toBe(index);
        expect(screen.top, seed).toBe(index * SCREEN_HEIGHT);
        if (index > 0) expect(screen.top, seed).toBe(layout.screens[index - 1].bottom + 1);
      });
      expect(layout.screens[3].bottom, seed).toBe(199);
      expect(layout.openings, seed).toEqual([
        { edge: 'N', role: 'entry', neighbourKey: 'city:8' },
        { edge: 'E', role: 'exit', neighbourKey: 'league:1' },
      ]);
    }
  });

  it('takes the same two draws as any route, so its carve is a four-screen route’s', () => {
    const plan = planRegion('alpha');
    const rolled = planRouteLayout(plan, 'victory-road:1');
    expect(planRouteLayout(plan, 'victory-road:1', 3).screens).toEqual(routeScreens(3));
    expect(planRouteLayout(plan, 'victory-road:1', 4).screens).toEqual(rolled.screens);
    expect(generateRoute(plan, 'victory-road:1')).toEqual(generateRoute(plan, 'victory-road:1', 4));
  });

  it('leaves every other kind’s openings and height exactly where they were', () => {
    const plan = planRegion('task-303');
    const layout = (key: string) => planRouteLayout(plan, key);

    expect(layout('route:1').openings).toEqual([
      { edge: 'N', role: 'entry', neighbourKey: 'town:1' },
      { edge: 'S', role: 'exit', neighbourKey: 'city:1' },
      { edge: 'E', role: 'exit', neighbourKey: 'lateral:1' },
    ]);
    expect(layout('route:1').height).toBe(ROUTE_HEIGHTS[0]);
    expect(layout('route:3').openings).toEqual([
      { edge: 'N', role: 'entry', neighbourKey: 'city:2' },
      { edge: 'S', role: 'exit', neighbourKey: 'city:3' },
      { edge: 'E', role: 'exit', neighbourKey: 'lateral:3' },
      { edge: 'W', role: 'exit', neighbourKey: 'lateral:4' },
    ]);
    expect(layout('route:3').height).toBe(ROUTE_HEIGHTS[2]);
    expect(layout('lateral:1').openings).toEqual([
      { edge: 'N', role: 'entry', neighbourKey: 'route:1' },
    ]);
    expect(layout('lateral:1').height).toBe(ROUTE_HEIGHTS[2]);

    const bravo = planRegion('alpha');
    expect(planRouteLayout(bravo, 'route:8').openings).toEqual([
      { edge: 'N', role: 'entry', neighbourKey: 'city:7' },
      { edge: 'S', role: 'exit', neighbourKey: 'city:8' },
      { edge: 'E', role: 'exit', neighbourKey: 'lateral:14' },
    ]);
    expect(planRouteLayout(bravo, 'route:8').height).toBe(ROUTE_HEIGHTS[1]);
  });
});

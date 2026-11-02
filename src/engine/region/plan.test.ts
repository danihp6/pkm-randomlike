import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { badgeCap, cityTierForBadge } from '../../data/region';
import { routeName, settlementNames } from './names';
import {
  nodeKey,
  nodeOf,
  parseNodeKey,
  planRegion,
  type RegionNode,
  type RegionNodeKind,
  type RegionPlan,
} from './plan';
import { regionStream } from './streams';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const KINDS: readonly RegionNodeKind[] = [
  'town',
  'city',
  'route',
  'lateral',
  'victory-road',
  'league',
  'tower',
];

function ofKind(plan: RegionPlan, kind: RegionNodeKind): readonly RegionNode[] {
  return plan.nodes.filter((node) => node.kind === kind);
}

function settleNames(plan: RegionPlan): readonly string[] {
  return plan.nodes
    .filter((node) => node.kind === 'town' || node.kind === 'city')
    .map((node) => node.name);
}

function routes(plan: RegionPlan): readonly RegionNode[] {
  return plan.nodes.filter((node) => node.kind === 'route' || node.kind === 'lateral');
}

function digestOf(plan: RegionPlan): string {
  return plan.nodes
    .map(
      (node) =>
        `${node.kind}:${node.id}|${node.name}|b${node.badge}|c${node.cap}|d${node.gymDistance}|${node.position.x},${node.position.y}|${node.edges.join(',')}`,
    )
    .join('\n');
}

describe('region plan topology', () => {
  it('holds one town, eight gym cities in badge order, one victory road, one league and one tower', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      expect(ofKind(plan, 'town'), seed).toHaveLength(1);
      const cities = ofKind(plan, 'city');
      expect(cities, seed).toHaveLength(8);
      expect(
        cities.every((city) => city.gym),
        seed,
      ).toBe(true);
      expect(
        cities.map((city) => city.id),
        seed,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(
        cities.map((city) => city.badge),
        seed,
      ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(ofKind(plan, 'route'), seed).toHaveLength(8);
      expect(ofKind(plan, 'victory-road'), seed).toHaveLength(1);
      expect(ofKind(plan, 'league'), seed).toHaveLength(1);
      expect(ofKind(plan, 'tower'), seed).toHaveLength(1);
      expect(plan.townKey, seed).toBe('town:1');
      expect(plan.gymKeys, seed).toEqual(cities.map((city) => city.key));
    }
  });

  it('walks town, route, city eight times, then the victory road, the league and the tower', () => {
    const expected: RegionNodeKind[] = ['town'];
    for (let stretch = 0; stretch < 8; stretch++) expected.push('route', 'city');
    expected.push('victory-road', 'league', 'tower');
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      expect(
        plan.chain.map((key) => parseNodeKey(key)?.kind),
        seed,
      ).toEqual(expected);
      expect(plan.chain).not.toContain('lateral:1');
      expect(
        plan.chain.every((key) => parseNodeKey(key)?.kind !== 'lateral'),
        seed,
      ).toBe(true);
      expect(plan.chain.length, seed).toBe(20);
      expect(nodeOf(plan, plan.townKey)?.kind, seed).toBe('town');
      for (const key of plan.chain) expect(nodeOf(plan, key), `${seed} ${key}`).toBeDefined();
    }
  });

  it('is a connected undirected graph: every edge is mirrored and no neighbour repeats', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const keys = new Set(plan.nodes.map((node) => node.key));
      for (const node of plan.nodes) {
        expect(new Set(node.edges).size, `${seed} ${node.key}`).toBe(node.edges.length);
        expect(node.edges.length, `${seed} ${node.key}`).toBeGreaterThan(0);
        for (const edge of node.edges) {
          const other = nodeOf(plan, edge);
          expect(other, `${seed} ${node.key} -> ${edge}`).toBeDefined();
          expect(other?.edges, `${seed} ${edge} -> ${node.key}`).toContain(node.key);
        }
      }
      const reached = new Set<string>([plan.townKey]);
      const queue: string[] = [plan.townKey];
      for (let head = 0; head < queue.length; head++) {
        for (const next of nodeOf(plan, queue[head])?.edges ?? []) {
          if (reached.has(next)) continue;
          reached.add(next);
          queue.push(next);
        }
      }
      expect(reached, seed).toEqual(keys);
    }
  });

  it('gives every node its own seeded grid cell, with x growing along the spine', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const cells = plan.nodes.map((node) => `${node.position.x},${node.position.y}`);
      expect(new Set(cells).size, seed).toBe(plan.nodes.length);
      for (const node of plan.nodes) {
        expect(Number.isInteger(node.position.x), `${seed} ${node.key}`).toBe(true);
        expect(Number.isInteger(node.position.y), `${seed} ${node.key}`).toBe(true);
      }
      const xs = plan.chain.map((key) => nodeOf(plan, key)?.position.x ?? Number.NaN);
      for (let index = 1; index < xs.length; index++)
        expect(xs[index], seed).toBeGreaterThan(xs[index - 1]);
      for (const lateral of ofKind(plan, 'lateral')) {
        const parent = nodeOf(plan, lateral.lateralOf ?? '');
        expect(parent, `${seed} ${lateral.key}`).toBeDefined();
        expect(lateral.position.x, `${seed} ${lateral.key}`).toBeGreaterThan(parent?.position.x ?? 0);
        expect(lateral.position.y, `${seed} ${lateral.key}`).not.toBe(parent?.position.y);
      }
    }
  });
});

describe('region plan badges, caps and distances', () => {
  it('carries each stretch badge and its cap, with the league at badge 9', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of plan.nodes) {
        expect(node.cap, `${seed} ${node.key}`).toBe(badgeCap(node.badge));
      }
      for (const node of plan.nodes) {
        if (node.kind === 'victory-road' || node.kind === 'league' || node.kind === 'tower') {
          expect(node.badge, `${seed} ${node.key}`).toBe(9);
          expect(node.cap, `${seed} ${node.key}`).toBe(60);
        } else {
          expect(node.badge, `${seed} ${node.key}`).toBeGreaterThanOrEqual(1);
          expect(node.badge, `${seed} ${node.key}`).toBeLessThanOrEqual(8);
        }
      }
      for (const city of ofKind(plan, 'city')) {
        expect(city.tier, `${seed} ${city.key}`).toBe(cityTierForBadge(city.badge).tier);
      }
      for (const node of plan.nodes) {
        if (node.kind !== 'city') expect(node.tier, `${seed} ${node.key}`).toBeNull();
      }
    }
  });

  it('counts main-chain steps to the closing gym: 0 at a gym, one more per step back', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      expect(
        ofKind(plan, 'city').map((city) => city.gymDistance),
        seed,
      ).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      const lastGym = plan.chain.indexOf(plan.gymKeys[plan.gymKeys.length - 1]);
      for (let index = 0; index < lastGym; index++) {
        const node = nodeOf(plan, plan.chain[index]);
        const next = nodeOf(plan, plan.chain[index + 1]);
        if (node?.gym) {
          expect(node.gymDistance, `${seed} ${node.key}`).toBe(0);
        } else {
          expect(node?.gymDistance, `${seed} ${node?.key}`).toBe((next?.gymDistance ?? 0) + 1);
        }
      }
      for (let index = lastGym + 1; index < plan.chain.length; index++) {
        const node = nodeOf(plan, plan.chain[index]);
        const previous = nodeOf(plan, plan.chain[index - 1]);
        expect(node?.gymDistance, `${seed} ${node?.key}`).toBe((previous?.gymDistance ?? 0) + 1);
      }
      for (const lateral of ofKind(plan, 'lateral')) {
        const parent = nodeOf(plan, lateral.lateralOf ?? '');
        expect(lateral.gymDistance, `${seed} ${lateral.key}`).toBe((parent?.gymDistance ?? 0) + 1);
      }
    }
  });
});

describe('region plan routes', () => {
  it('gives every stretch one main route and one or two laterals, 16-24 routes overall', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const mains = ofKind(plan, 'route');
      const all = routes(plan);
      expect(all.length, seed).toBeGreaterThanOrEqual(16);
      expect(all.length, seed).toBeLessThanOrEqual(24);
      let attached = 0;
      for (const main of mains) {
        const laterals = ofKind(plan, 'lateral').filter((node) => node.lateralOf === main.key);
        expect(laterals.length, `${seed} ${main.key}`).toBeGreaterThanOrEqual(1);
        expect(laterals.length, `${seed} ${main.key}`).toBeLessThanOrEqual(2);
        attached += 1 + laterals.length;
        for (const lateral of laterals) {
          expect(lateral.edges, `${seed} ${lateral.key}`).toEqual([main.key]);
          expect(main.edges, `${seed} ${main.key}`).toContain(lateral.key);
          expect(lateral.badge, `${seed} ${lateral.key}`).toBe(main.badge);
          expect(lateral.gym, `${seed} ${lateral.key}`).toBe(false);
        }
      }
      expect(attached, seed).toBe(all.length);
      expect(mains.length + ofKind(plan, 'lateral').length, seed).toBe(all.length);
      for (const node of plan.nodes) {
        if (node.kind === 'lateral') expect(node.lateralOf, `${seed} ${node.key}`).not.toBeNull();
        else expect(node.lateralOf, `${seed} ${node.key}`).toBeNull();
        if (node.kind !== 'lateral' && node.kind !== 'route') {
          expect(node.name, `${seed} ${node.key}`).not.toMatch(/^Route \d+$/);
        }
      }
    }
  });

  it('numbers every route 1..N in chain order, mains and laterals together', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const all = routes(plan);
      expect(
        all.map((node) => node.name),
        seed,
      ).toEqual(all.map((_, index) => routeName(index + 1)));
      expect(
        plan.chain
          .filter((key) => parseNodeKey(key)?.kind === 'route')
          .map((key) => nodeOf(plan, key)?.name ?? ''),
        seed,
      ).toEqual(ofKind(plan, 'route').map((node) => node.name));
      for (const node of plan.nodes) {
        if (node.kind === 'victory-road') expect(node.name, seed).toBe('Victory Road');
        if (node.kind === 'league') expect(node.name, seed).toBe('League');
        if (node.kind === 'tower') expect(node.name, seed).toBe('Tower');
      }
    }
  });
});

describe('region node keys', () => {
  it('names a node `${kind}:${id}` and parses it back', () => {
    expect(nodeKey('city', 3)).toBe('city:3');
    for (const kind of KINDS) expect(parseNodeKey(nodeKey(kind, 7))).toEqual({ kind, id: 7 });
    for (const seed of SEEDS) {
      for (const node of planRegion(seed).nodes) {
        expect(parseNodeKey(node.key), `${seed} ${node.key}`).toEqual({ kind: node.kind, id: node.id });
      }
    }
  });

  it('rejects a malformed key instead of guessing', () => {
    expect(parseNodeKey('')).toBeNull();
    expect(parseNodeKey('city')).toBeNull();
    expect(parseNodeKey('city:x')).toBeNull();
    expect(parseNodeKey('nope:1')).toBeNull();
    expect(parseNodeKey('city:0')).toBeNull();
    expect(parseNodeKey('city:-1')).toBeNull();
    expect(parseNodeKey('city:1.5')).toBeNull();
    expect(parseNodeKey('City:1')).toBeNull();
  });
});

describe('region plan names', () => {
  it('names the nine settlements uniquely, in title case, and keeps them for the seed', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const names = settleNames(plan);
      expect(names, seed).toHaveLength(9);
      expect(new Set(names).size, seed).toBe(9);
      for (const name of names) expect(name, `${seed} ${name}`).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      expect(planRegion(seed), seed).toEqual(plan);
    }
  });

  it('changes at least one settlement name between two seeds', () => {
    const first = settleNames(planRegion('alpha'));
    const other = settleNames(planRegion('bravo'));
    expect(other.some((name, index) => name !== first[index])).toBe(true);
    expect(digestOf(planRegion('alpha'))).not.toBe(digestOf(planRegion('bravo')));
  });

  it('leaves the settlement names to the names stream, not the plan stream', () => {
    const names = settlementNames(regionStream('alpha').split('names'), 9);
    expect(settleNames(planRegion('alpha'))).toEqual(names);
  });
});

describe('region plan determinism', () => {
  it('pins a fixed seed whole plan', () => {
    expect(digestOf(planRegion('alpha'))).toBe(`town:1|Hollow Crest|b1|c9|d2|0,0|route:1
route:1|Route 1|b1|c9|d1|6,1|town:1,city:1,lateral:1
lateral:1|Route 2|b1|c9|d2|9,4|route:1
city:1|Verdant Field|b1|c9|d0|12,0|route:1,route:2
route:2|Route 3|b2|c16|d1|18,0|city:1,city:2,lateral:2,lateral:3
lateral:2|Route 4|b2|c16|d2|21,3|route:2
lateral:3|Route 5|b2|c16|d2|21,-2|route:2
city:2|Amber Falls|b2|c16|d0|24,0|route:2,route:3
route:3|Route 6|b3|c23|d1|30,1|city:2,city:3,lateral:4,lateral:5
lateral:4|Route 7|b3|c23|d2|33,5|route:3
lateral:5|Route 8|b3|c23|d2|33,-1|route:3
city:3|Hollow Bay|b3|c23|d0|36,1|route:3,route:4
route:4|Route 9|b4|c30|d1|42,-2|city:3,city:4,lateral:6,lateral:7
lateral:6|Route 10|b4|c30|d2|45,0|route:4
lateral:7|Route 11|b4|c30|d2|45,-5|route:4
city:4|Hollow Grove|b4|c30|d0|48,0|route:4,route:5
route:5|Route 12|b5|c37|d1|54,-2|city:4,city:5,lateral:8,lateral:9
lateral:8|Route 13|b5|c37|d2|57,0|route:5
lateral:9|Route 14|b5|c37|d2|57,-5|route:5
city:5|Mossy Brook|b5|c37|d0|60,-2|route:5,route:6
route:6|Route 15|b6|c43|d1|66,-2|city:5,city:6,lateral:10,lateral:11
lateral:10|Route 16|b6|c43|d2|69,0|route:6
lateral:11|Route 17|b6|c43|d2|69,-4|route:6
city:6|Iron Bridge|b6|c43|d0|72,1|route:6,route:7
route:7|Route 18|b7|c49|d1|78,1|city:6,city:7,lateral:12,lateral:13
lateral:12|Route 19|b7|c49|d2|81,5|route:7
lateral:13|Route 20|b7|c49|d2|81,-1|route:7
city:7|Misty Reach|b7|c49|d0|84,-2|route:7,route:8
route:8|Route 21|b8|c55|d1|90,-2|city:7,city:8,lateral:14
lateral:14|Route 22|b8|c55|d2|93,2|route:8
city:8|Cobalt Port|b8|c55|d0|96,2|route:8,victory-road:1
victory-road:1|Victory Road|b9|c60|d1|102,2|city:8,league:1
league:1|League|b9|c60|d2|108,1|victory-road:1,tower:1
tower:1|Tower|b9|c60|d3|114,0|league:1`);
  });
});

const REGION_DIR = dirname(fileURLToPath(import.meta.url));

function regionSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...regionSources(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

describe('region engine purity', () => {
  it('imports no Phaser, touches no DOM and draws nothing unseeded', () => {
    const files = regionSources(REGION_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/from ['"]phaser['"]/);
      expect(source, file).not.toMatch(/\bMath\.random\b/);
      expect(source, file).not.toMatch(/\bDate\.now\b/);
      expect(source, file).not.toMatch(/\b(document|window|localStorage)\b/);
    }
  });
});

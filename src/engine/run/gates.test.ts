import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nodeOf, planRegion } from '../region/plan';
import { exitGate, nextBadge } from './gates';

const SEEDS = ['alpha', 'bravo'];

const ALL_BADGES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** The key a gym city's forward edge names: badge 8 leaves for the Victory Road. */
function forwardOf(badge: number): string {
  return badge < 8 ? `route:${badge + 1}` : 'victory-road:1';
}

function badgesUpTo(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

describe('exitGate', () => {
  it('asks every gym city for exactly its own badge on the way forward', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const badge of ALL_BADGES) {
        const from = `city:${badge}`;
        const to = forwardOf(badge);
        expect(nodeOf(plan, from), `${seed} ${from}`).toBeDefined();
        expect(exitGate(plan, from, to, [badge]), `${seed} ${from} -> ${to}`).toEqual({
          open: true,
          badge,
        });
        expect(exitGate(plan, from, to, ALL_BADGES), `${seed} ${from} -> ${to}`).toEqual({
          open: true,
          badge,
        });
        expect(exitGate(plan, from, to, []), `${seed} ${from} -> ${to}`).toEqual({
          open: false,
          badge,
        });
        expect(exitGate(plan, from, to, badgesUpTo(badge - 1)), `${seed} ${from} -> ${to}`).toEqual({
          open: false,
          badge,
        });
        expect(exitGate(plan, from, to, [badge + 1]), `${seed} ${from} -> ${to}`).toEqual({
          open: false,
          badge,
        });
      }
    }
  });

  it("leaves the eighth city's victory road shut until the eighth badge is held", () => {
    const plan = planRegion('alpha');
    expect(exitGate(plan, 'city:8', 'victory-road:1', [8])).toEqual({ open: true, badge: 8 });
    expect(exitGate(plan, 'city:8', 'victory-road:1', [])).toEqual({ open: false, badge: 8 });
    expect(exitGate(plan, 'city:8', 'victory-road:1', badgesUpTo(7))).toEqual({
      open: false,
      badge: 8,
    });
  });

  it('never shuts the way back on the chain, whatever the badges say', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (let index = 1; index < plan.chain.length; index++) {
        const to = plan.chain[index - 1];
        const from = plan.chain[index];
        for (const badges of [[], ALL_BADGES]) {
          expect(exitGate(plan, from, to, badges), `${seed} ${from} -> ${to}`).toBeNull();
        }
      }
    }
  });

  it('never gates a lateral, in either direction', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const lateral of plan.nodes.filter((node) => node.kind === 'lateral')) {
        const parent = lateral.lateralOf ?? '';
        for (const badges of [[], ALL_BADGES]) {
          expect(
            exitGate(plan, lateral.key, parent, badges),
            `${seed} ${lateral.key} -> ${parent}`,
          ).toBeNull();
          expect(
            exitGate(plan, parent, lateral.key, badges),
            `${seed} ${parent} -> ${lateral.key}`,
          ).toBeNull();
        }
      }
    }
  });

  it('carries no guard off a city, the town included', () => {
    const plan = planRegion('alpha');
    const forwards: readonly (readonly [string, string])[] = [
      [plan.townKey, 'route:1'],
      ['route:1', 'city:1'],
      ['victory-road:1', 'league:1'],
      ['league:1', 'tower:1'],
    ];
    for (const [from, to] of forwards) {
      for (const badges of [[], ALL_BADGES]) {
        expect(exitGate(plan, from, to, badges), `${from} -> ${to}`).toBeNull();
      }
    }
  });

  it('answers null for an unknown key and for a non-neighbour, without throwing', () => {
    const plan = planRegion('alpha');
    const cases: readonly (readonly [string, string])[] = [
      ['city:99', 'route:1'],
      ['city:1', 'route:99'],
      ['', 'route:1'],
      ['city:1', ''],
      ['town:1', 'town:1'],
      ['city:1', 'city:2'],
      ['city:1', 'route:1'],
      ['city:2', 'route:1'],
      ['city:1', 'tower:1'],
    ];
    for (const [from, to] of cases) {
      expect(() => exitGate(plan, from, to, ALL_BADGES), `${from} -> ${to}`).not.toThrow();
      expect(exitGate(plan, from, to, ALL_BADGES), `${from} -> ${to}`).toBeNull();
    }
  });
});

describe('nextBadge', () => {
  it("names badge 1 for the town's way forward", () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      expect(nextBadge(plan, plan.townKey), seed).toBe(1);
    }
  });

  it('names the badge of every node in a gym stretch', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const badge of ALL_BADGES) {
        expect(nextBadge(plan, `city:${badge}`), `${seed} city:${badge}`).toBe(badge);
        expect(nextBadge(plan, `route:${badge}`), `${seed} route:${badge}`).toBe(badge);
      }
      for (const lateral of plan.nodes.filter((node) => node.kind === 'lateral')) {
        expect(nextBadge(plan, lateral.key), `${seed} ${lateral.key}`).toBe(lateral.badge);
      }
    }
  });

  it('names no badge past the eighth gym', () => {
    const plan = planRegion('alpha');
    for (const key of ['victory-road:1', 'league:1', 'tower:1']) {
      expect(nextBadge(plan, key), key).toBeNull();
    }
  });

  it('answers null for an unknown key, without throwing', () => {
    const plan = planRegion('alpha');
    for (const key of ['', 'city:99', 'route:0', 'nope:1', 'lateral:999']) {
      expect(() => nextBadge(plan, key), key).not.toThrow();
      expect(nextBadge(plan, key), key).toBeNull();
    }
  });
});

const RUN_DIR = dirname(fileURLToPath(import.meta.url));

describe('exit gate purity', () => {
  it('imports no Phaser and no DOM, and draws nothing unseeded', () => {
    const source = readFileSync(join(RUN_DIR, 'gates.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*scenes\//);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\b(document|window|localStorage)\b/);
  });
});

describe('exit gates across the whole plan', () => {
  it('gates exactly the eight steps out of a gym city, and no other edge', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      const gated: string[] = [];
      for (const node of plan.nodes) {
        for (const to of node.edges) {
          if (exitGate(plan, node.key, to, ALL_BADGES) !== null) gated.push(`${node.key} -> ${to}`);
        }
      }
      const expected = ALL_BADGES.map((badge) => `city:${badge} -> ${forwardOf(badge)}`);
      expect(gated, seed).toEqual(expected);
    }
  });
});

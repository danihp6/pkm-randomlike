import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BADGE_CAPS, badgeCap } from '../../data/region';
import { LEVEL_BANDS, bandForLevel } from '../../data/run';
import { TRAINER_SIZE_FACTOR } from '../../data/trainerLevels';
import { planRegion, type RegionNode } from '../region/plan';
import { Rng } from '../rng';
import { bandForNode, leaderLevel, trainerLevel, wildLevel } from './levelCurve';

const CAPS: readonly number[] = [...BADGE_CAPS, 60];
const SIZES: readonly (1 | 2 | 3)[] = [1, 2, 3];
const SEEDS = ['alpha', 'bravo', 'charlie', 'delta'];

describe('trainerLevel', () => {
  it('sits on the cap at the gym for every party size and every cap', () => {
    for (const cap of CAPS) {
      for (const size of SIZES) expect(trainerLevel(cap, 0, size), `cap ${cap} size ${size}`).toBe(cap);
    }
  });

  it('steps back from the gym, lowering the level with every extra step', () => {
    for (const cap of CAPS) {
      for (const size of SIZES) {
        expect(trainerLevel(cap, 3, size), `cap ${cap} size ${size}`).toBeLessThan(cap);
        let previous = Number.POSITIVE_INFINITY;
        for (let distance = 0; distance <= 10; distance++) {
          const level = trainerLevel(cap, distance, size);
          expect(level, `cap ${cap} size ${size} d${distance}`).toBeLessThanOrEqual(cap);
          expect(level, `cap ${cap} size ${size} d${distance}`).toBeGreaterThanOrEqual(1);
          expect(level, `cap ${cap} size ${size} d${distance}`).toBeLessThanOrEqual(previous);
          previous = level;
        }
      }
    }
  });

  it('is the cap less one step of that size factor, floored, at distance one', () => {
    for (const cap of CAPS) {
      for (const size of SIZES) {
        expect(trainerLevel(cap, 1, size), `cap ${cap} size ${size}`).toBe(
          Math.floor(cap - TRAINER_SIZE_FACTOR[size]),
        );
      }
    }
  });

  it('never drops below one, however far back the node sits', () => {
    expect(trainerLevel(1, 0, 1)).toBe(1);
    expect(trainerLevel(1, 5, 3)).toBe(1);
    expect(trainerLevel(9, 20, 1)).toBe(1);
  });

  it('floors a fractional cap and distance instead of rounding them', () => {
    expect(trainerLevel(30.9, 0, 1)).toBe(30);
    expect(trainerLevel(30, 1.9, 1)).toBe(29);
    expect(trainerLevel(30, -4, 1)).toBe(30);
  });
});

describe('wildLevel', () => {
  it('stays in the 60-75 % window of the squad over a thousand draws', () => {
    const rng = new Rng(2026);
    const values: number[] = [];
    for (let i = 0; i < 1000; i++) values.push(wildLevel(30, rng));
    expect(new Set(values).size).toBeGreaterThan(1);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeGreaterThanOrEqual(Math.floor(0.6 * 30));
      expect(value).toBeLessThanOrEqual(Math.floor(0.75 * 30));
    }
  });

  it('replays the same thousand levels from the same stream', () => {
    const draw = (): number[] => {
      const rng = new Rng(4242);
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) values.push(wildLevel(37, rng));
      return values;
    };
    expect(draw()).toEqual(draw());
  });

  it('never drops below two, even for an empty squad', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 50; i++) expect(wildLevel(0, rng)).toBe(2);
    expect(wildLevel(-9, new Rng(5))).toBe(2);
  });

  it('takes exactly one draw off the stream per level', () => {
    const a = new Rng(77);
    const b = new Rng(77);
    const fromRule: number[] = [];
    for (let i = 0; i < 20; i++) fromRule.push(wildLevel(40, a));
    for (let i = 0; i < 20; i++) {
      const share = 0.6 + b.next() * 0.15;
      expect(fromRule[i]).toBe(Math.max(2, Math.floor(40 * share)));
    }
  });
});

describe('leaderLevel', () => {
  it('is the cap itself on every badge cap and on the league level', () => {
    for (const cap of CAPS) expect(leaderLevel(cap)).toBe(cap);
    expect(leaderLevel(60)).toBe(60);
  });

  it('floors the cap and never drops below one', () => {
    expect(leaderLevel(23.9)).toBe(23);
    expect(leaderLevel(0)).toBe(1);
    expect(leaderLevel(-5)).toBe(1);
  });
});

describe('bandForNode', () => {
  it('reads the previous cap up to the node cap, on every node of a fixed plan', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const node of plan.nodes) {
        const band = bandForNode(node);
        const minLevel = node.badge <= 1 ? LEVEL_BANDS[0].minLevel : badgeCap(node.badge - 1);
        expect(band.maxLevel, `${seed} ${node.key}`).toBe(node.cap);
        expect(band.minLevel, `${seed} ${node.key}`).toBe(minLevel);
        expect(band.id, `${seed} ${node.key}`).toBe(bandForLevel(minLevel).id);
      }
    }
  });

  it('opens the first stretch at the first band floor and the league at the eighth cap', () => {
    const plan = planRegion('alpha');
    const town = plan.nodes.find((node) => node.kind === 'town') as RegionNode;
    expect(bandForNode(town).minLevel).toBe(LEVEL_BANDS[0].minLevel);
    const league = plan.nodes.find((node) => node.kind === 'league') as RegionNode;
    expect(bandForNode(league).minLevel).toBe(badgeCap(8));
    expect(bandForNode(league).maxLevel).toBe(60);
  });

  it('is total: no throw on any node of a region', () => {
    for (const seed of SEEDS) {
      for (const node of planRegion(seed).nodes) expect(() => bandForNode(node)).not.toThrow();
    }
  });
});

const ENGINE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function engineSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...engineSources(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(path);
  }
  return files;
}

describe('level curve purity', () => {
  it('imports no Phaser anywhere under src/engine', () => {
    const files = engineSources(ENGINE_DIR);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]phaser['"]/);
    }
  });

  it('keeps the new module off the DOM, the clock and Math.random', () => {
    const source = readFileSync(join(ENGINE_DIR, 'run', 'levelCurve.ts'), 'utf8');
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\b(document|window|localStorage)\b/);
    expect(source).not.toMatch(/from ['"]phaser['"]/);
  });
});

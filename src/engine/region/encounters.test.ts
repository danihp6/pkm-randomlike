import { describe, expect, it } from 'vitest';
import { hashSeed, Rng } from '../rng';
import { xpForLevel } from '../run/progression';
import { createRun, type RunState } from '../run/state';
import { DEFAULT_ENCOUNTER_CHANCE, type Encounter } from '../routes/encounters';
import {
  NODE_ENCOUNTER_CHANCE,
  nodeEncounterTable,
  nodeWildLevel,
  rollNodeEncounter,
} from './encounters';
import { nodeOf, planRegion, type RegionNode } from './plan';

const SEED = 'task-290';
const plan = planRegion(SEED);

/** A plan node by key; the plan holds it, so the bang is a test-time assertion. */
function routeNode(key: string): RegionNode {
  const node = nodeOf(plan, key);
  if (!node) throw new Error(`no node: ${key}`);
  return node;
}

/** A run whose squad stands on `level`, clamped by a cap of its own. */
function squadRun(level: number, cap = level): RunState {
  return { ...createRun({ seed: SEED }), xp: xpForLevel(level), levelCap: cap };
}

/** The stream a scene would hand the node's roll. */
function encounterStream(seed: string): Rng {
  return new Rng(hashSeed(`${seed}:node:${SEED}:encounters`));
}

/** Every encounter `rollNodeEncounter` hands out over `attempts` steps. */
function rollMany(node: RegionNode, run: RunState, rng: Rng, attempts: number): Encounter[] {
  const rolled: Encounter[] = [];
  for (let step = 0; step < attempts; step++) {
    const encounter = rollNodeEncounter(node, run, rng);
    if (encounter) rolled.push(encounter);
  }
  return rolled;
}

describe('NODE_ENCOUNTER_CHANCE', () => {
  it('is the shipped step chance, not a second literal', () => {
    expect(NODE_ENCOUNTER_CHANCE).toBe(DEFAULT_ENCOUNTER_CHANCE);
    expect(NODE_ENCOUNTER_CHANCE).toBe(0.15);
  });
});

describe('nodeEncounterTable', () => {
  it('offers the node band pool with nothing from the run excluded', () => {
    const node = routeNode('route:8');
    const table = nodeEncounterTable(node, squadRun(30));
    expect(table.length).toBeGreaterThan(0);
    expect(table.every((entry) => entry.weight === 1)).toBe(true);
  });

  it('drops the line of a species the run holds', () => {
    const node = routeNode('route:8');
    const base = nodeEncounterTable(node, squadRun(30));
    const held = base[0].speciesId;
    const run: RunState = { ...squadRun(30), caughtSpecies: [held] };
    const table = nodeEncounterTable(node, run);
    expect(table.some((entry) => entry.speciesId === held)).toBe(false);
    expect(table.length).toBeGreaterThan(0);
  });

  it('reads the node band, so an early node offers an earlier pool than a late one', () => {
    const run = squadRun(30);
    const early = nodeEncounterTable(routeNode('route:1'), run);
    const late = nodeEncounterTable(routeNode('route:8'), run);
    expect(early).not.toEqual(late);
  });
});

describe('nodeWildLevel', () => {
  it('rolls 60-75 % of the squad level 1 000 times', () => {
    const node = routeNode('route:8');
    const run = squadRun(30);
    const rng = encounterStream('levels');
    const levels: number[] = [];
    for (let step = 0; step < 1000; step++) levels.push(nodeWildLevel(node, run, rng));
    expect(levels).toHaveLength(1000);
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(18);
      expect(level).toBeLessThanOrEqual(23);
    }
    // `wildLevel` floors, so the top of the band is 22 here, and the share is live.
    expect(Math.max(...levels)).toBe(22);
    expect(Math.min(...levels)).toBe(18);
  });

  it('never exceeds a cap below that band', () => {
    const node = routeNode('route:8');
    const low: RegionNode = { ...node, cap: 20 };
    const run = squadRun(30);
    const rng = encounterStream('capped');
    for (let step = 0; step < 1000; step++) expect(nodeWildLevel(low, run, rng)).toBeLessThanOrEqual(20);
  });

  it('never rolls below one, even on a level-1 squad', () => {
    const node = routeNode('route:1');
    const run = squadRun(1);
    const rng = encounterStream('floor');
    for (let step = 0; step < 50; step++)
      expect(nodeWildLevel(node, run, rng)).toBeGreaterThanOrEqual(1);
  });
});

describe('rollNodeEncounter', () => {
  it('rolls the band of the squad level over 1 000 steps, and misses on most of them', () => {
    const node = routeNode('route:8');
    const run = squadRun(30);
    const rolled = rollMany(node, run, encounterStream('once'), 1000);
    expect(rolled.length).toBeGreaterThan(50);
    expect(rolled.length).toBeLessThan(1000);
    for (const encounter of rolled) {
      expect(encounter.speciesId).not.toBe('');
      expect(encounter.level).toBeGreaterThanOrEqual(18);
      expect(encounter.level).toBeLessThanOrEqual(23);
    }
  });

  it('never exceeds a cap below that band over 1 000 steps', () => {
    const low: RegionNode = { ...routeNode('route:8'), cap: 20 };
    const rolled = rollMany(low, squadRun(30), encounterStream('once-capped'), 1000);
    expect(rolled.length).toBeGreaterThan(50);
    for (const encounter of rolled) expect(encounter.level).toBeLessThanOrEqual(20);
  });

  it('replays the same sequence for the same seed and squad level', () => {
    const node = routeNode('route:4');
    const first = rollMany(node, squadRun(30), encounterStream('replay'), 200);
    const second = rollMany(node, squadRun(30), encounterStream('replay'), 200);
    expect(first).toEqual(second);
  });

  it('differs for another seed', () => {
    const node = routeNode('route:4');
    const first = rollMany(node, squadRun(30), encounterStream('seed-a'), 200);
    const other = rollMany(node, squadRun(30), encounterStream('seed-b'), 200);
    expect(first).not.toEqual(other);
  });

  it('pins the sequence a fixed stream produces', () => {
    const node = routeNode('route:4');
    const rolled = rollMany(node, squadRun(30), encounterStream('pin'), 60);
    expect(rolled.map((encounter) => `${encounter.speciesId}:${encounter.level}`).join(',')).toBe(
      'mimikyutotem:18,orthworm:19,runerigus:22,frosmoth:20,slowkinggalar:19,basculin:22,lokix:18,raichualola:21',
    );
  });

  it('takes its shiny roll off the stream it is handed, so cosmetics never shift the sequence', () => {
    const node = routeNode('route:8');
    const run = squadRun(30);
    const plain = rollMany(node, run, encounterStream('shiny'), 100);
    const rng = encounterStream('shiny');
    const shinyRng = new Rng(hashSeed('task-290:shiny'));
    const rolled: Encounter[] = [];
    for (let step = 0; step < 100; step++) {
      const encounter = rollNodeEncounter(node, run, rng, { shinyRng });
      if (encounter) rolled.push(encounter);
    }
    expect(rolled.map((encounter) => encounter.speciesId)).toEqual(
      plain.map((encounter) => encounter.speciesId),
    );
  });
});

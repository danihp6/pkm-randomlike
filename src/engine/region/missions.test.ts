import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cityMissionFor, randomMissions, STRETCH_MISSION_ID } from '../../data/missions';
import { createRunPokemon } from '../run/progression';
import { createRun, nodeEntry, type RunState } from '../run/state';
import { activeMissions, advanceMissions, missionProgress, type ActiveMission } from './missions';
import { nodeOf, planRegion, type RegionPlan } from './plan';

const SEED = 'task-291';
const OTHER_SEED = 'task-291-b';
const PLAN = planRegion(SEED);

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** A run standing on `key`: the window opens there, and no casualty has been taken yet. */
function runOn(key: string, seed = SEED): RunState {
  return {
    ...createRun({ seed, starter }),
    nodeKey: key,
    visitedNodes: [key],
    ...nodeEntry(seed, key),
    hpLost: 0,
    floorCasualties: 0,
  };
}

/** The stack of the run on `key`, computed against `seed`'s own plan. */
function stackOn(run: RunState, plan: RegionPlan = PLAN): readonly ActiveMission[] {
  return activeMissions(run, plan);
}

/** The row a scope key names, or a failure when the stack holds none. */
function row(stack: readonly ActiveMission[], scopeKey: string): ActiveMission {
  const found = stack.find((mission) => mission.scopeKey === scopeKey);
  if (found === undefined) throw new Error(`no mission row: ${scopeKey}`);
  return found;
}

describe('activeMissions', () => {
  it('shows only the stretch row on a node that is not a city', () => {
    for (const key of ['town:1', 'route:1', 'lateral:1', 'victory-road:1', 'league:1', 'tower:1']) {
      const stack = stackOn(runOn(key));
      expect(stack, key).toHaveLength(1);
      expect(stack[0].scopeKey, key).toBe('stretch');
      expect(stack[0].id, key).toBe(STRETCH_MISSION_ID);
      expect(stack[0].progress, key).toBe(0);
      expect(stack[0].status, key).toBe('active');
    }
  });

  it('orders a city node s stack exactly stretch, city, random', () => {
    const stack = stackOn(runOn('city:2'));
    expect(stack.map((mission) => mission.scopeKey)).toStrictEqual([
      'stretch',
      'city:city:2',
      'random:city:2',
    ]);
    expect(stack[0].status).toBe('active');
    expect(stack[1].id).toBe(cityMissionFor(nodeOf(PLAN, 'city:2')!.tier ?? 1).id);
    expect(randomMissions().map((entry) => entry.id)).toContain(stack[2].id);
    // The stretch row is the only one with progress of its own.
    expect(stack.map((mission) => mission.progress)).toStrictEqual([0, 0, 0]);
  });

  it('fails the stretch when the node has taken a casualty, and clears it on entry', () => {
    const entered = advanceMissions(runOn('route:1'), { kind: 'enter-node', nodeKey: 'route:1' });
    const hurt: RunState = { ...entered, stats: { ...entered.stats, casualties: 2 } };
    expect(stackOn(hurt)[0].status).toBe('failed');
    expect(missionProgress(hurt)).toBe(2);

    const back = advanceMissions(hurt, { kind: 'enter-node', nodeKey: 'route:1' });
    expect(missionProgress(back)).toBe(0);
    expect(stackOn(back)[0].status).toBe('active');
    expect(stackOn(back)[0].progress).toBe(0);
  });

  it('meets the stretch once the leader falls, and keeps it met', () => {
    const run = runOn('city:1');
    const won = advanceMissions(run, { kind: 'leader-fallen', badge: 1 });
    expect(won.completedMissions).toStrictEqual([{ id: STRETCH_MISSION_ID, mapIndex: 1 }]);
    expect(won.missionsCompleted).toBe(1);
    expect(stackOn(won)[0].status).toBe('met');
    // A casualty after the badge is met does not un-meet the stretch it closed.
    const hurt: RunState = { ...won, stats: { ...won.stats, casualties: 1 } };
    expect(stackOn(hurt)[0].status).toBe('met');
  });

  it('leaves the stretch failed on a later stretch s own casualties', () => {
    const first = advanceMissions(runOn('city:1'), { kind: 'leader-fallen', badge: 1 });
    const second: RunState = {
      ...runOn('route:2'),
      completedMissions: first.completedMissions,
      missionsCompleted: first.missionsCompleted,
      stats: { catches: 0, casualties: 1, faints: 0 },
    };
    const stretch = stackOn(second)[0];
    expect(stretch.status).toBe('failed');
    expect(stretch.progress).toBe(1);
  });

  it('answers the same city mission and the same random row on a revisit', () => {
    const visited = runOn('city:1');
    const away = runOn('route:2');
    const revisited: RunState = {
      ...visited,
      visitedNodes: ['town:1', 'route:1', 'city:1', 'route:2', 'city:1'],
      ...nodeEntry(SEED, 'city:1'),
    };
    expect(stackOn(away)[0].status).toBe('active');
    expect(stackOn(revisited)).toStrictEqual(stackOn(visited));
    expect(stackOn(runOn('city:1'), planRegion(SEED))).toStrictEqual(stackOn(visited));
  });

  it('draws the random row once per city and seed, off its own stream', () => {
    const first = row(stackOn(runOn('city:1')), 'random:city:1').id;
    expect(row(stackOn(runOn('city:1')), 'random:city:1').id).toBe(first);
    // A second seed reads another row at the same city.
    const other = row(stackOn(runOn('city:1', OTHER_SEED), planRegion(OTHER_SEED)), 'random:city:1').id;
    expect(other).not.toBe(first);
    expect(first).toBe('delivery');
    expect(other).toBe('errand');
  });

  it('meets a city row and the random row once they are recorded', () => {
    const run = runOn('city:1');
    const city = cityMissionFor(1);
    const offered = row(stackOn(run), 'random:city:1');
    const metCity = advanceMissions(run, { kind: 'mission-met', id: city.id, badge: 1 });
    expect(row(stackOn(metCity), 'city:city:1').status).toBe('met');
    expect(row(stackOn(metCity), 'random:city:1').status).toBe('active');
    const metBoth = advanceMissions(metCity, { kind: 'mission-met', id: offered.id, badge: 1 });
    expect(row(stackOn(metBoth), 'random:city:1').status).toBe('met');
    expect(metBoth.missionsCompleted).toBe(2);
  });
});

describe('advanceMissions', () => {
  it('opens the node s stretch: no HP lost, and the casualty count pinned', () => {
    const run: RunState = {
      ...runOn('route:1'),
      hpLost: 42,
      stats: { catches: 0, casualties: 3, faints: 0 },
    };
    const next = advanceMissions(run, { kind: 'enter-node', nodeKey: 'route:2' });
    expect(next.hpLost).toBe(0);
    expect(next.floorCasualties).toBe(3);
    expect(next.stats).toBe(run.stats);
    expect(next.party).toBe(run.party);
  });

  it('returns the same run when the completion is already recorded', () => {
    const run = advanceMissions(runOn('city:1'), { kind: 'leader-fallen', badge: 1 });
    expect(advanceMissions(run, { kind: 'leader-fallen', badge: 1 })).toBe(run);
    const met = advanceMissions(runOn('city:1'), { kind: 'mission-met', id: 'errand', badge: 2 });
    expect(advanceMissions(met, { kind: 'mission-met', id: 'errand', badge: 2 })).toBe(met);
    // The same id in another stretch is another completion.
    expect(advanceMissions(met, { kind: 'mission-met', id: 'errand', badge: 3 })).not.toBe(met);
  });

  it('records nothing for an unreadable badge', () => {
    const run = runOn('city:1');
    for (const badge of [Number.NaN, 1.5, -1]) {
      expect(advanceMissions(run, { kind: 'leader-fallen', badge })).toBe(run);
    }
  });

  it('records nothing when the plan does not hold the node the run stands on', () => {
    const lost: RunState = { ...runOn('city:1'), nodeKey: 'nowhere:9' };
    expect(advanceMissions(lost, { kind: 'leader-fallen', badge: 1 }, PLAN)).toBe(lost);
    expect(advanceMissions(lost, { kind: 'enter-node', nodeKey: 'nowhere:9' }, PLAN)).toBe(lost);
  });
});

const REGION_DIR = dirname(fileURLToPath(import.meta.url));

describe('mission purity', () => {
  it('imports no Phaser and no DOM, and draws nothing unseeded', () => {
    const source = readFileSync(join(REGION_DIR, 'missions.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*scenes\//);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\b(document|window|localStorage)\b/);
  });
});

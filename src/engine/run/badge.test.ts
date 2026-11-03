import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BADGE_CAPS, badgeCap } from '../../data/region';
import { planRegion } from '../region/plan';
import {
  grantBadge,
  gymBadge,
  gymLeaderFoe,
  gymLeaderId,
  gymReward,
  gymTrainerFoe,
  gymTrainerId,
  hasBadge,
} from './badge';
import type { BattleReturn } from './battleLink';
import { leaderLevel } from './levelCurve';
import { createRunPokemon } from './progression';
import { resolveBattle } from './resolve';
import { compatForNode, createRun, itemCount, type RunState } from './state';

const SEED = 'task-285';
const OTHER_SEED = 'task-285-b';
const PLAN = planRegion(SEED);
const OTHER_PLAN = planRegion(OTHER_SEED);

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** A run standing on `key`, with the compat fields that node implies. */
function runOn(key: string, seed = SEED): RunState {
  return {
    ...createRun({ seed, starter }),
    nodeKey: key,
    visitedNodes: [key],
    ...compatForNode(seed, key),
  };
}

/** A run that already holds `badges`, ascending. */
function holding(run: RunState, badges: readonly number[]): RunState {
  return { ...run, badges };
}

/** A win payload the real battle would hand back, from the run as it stands. */
function winFrom(run: RunState): BattleReturn {
  return {
    outcome: 'win',
    message: '',
    player: [...run.party.map((member) => member.fighter)],
    bag: [...run.bag],
    captured: null,
  };
}

describe('gymLeaderId / gymTrainerId', () => {
  it('names a leader and a room trainer by the gym city they belong to', () => {
    expect(gymLeaderId('city:1')).toBe('gym-leader:city:1');
    expect(gymTrainerId('city:1', 0)).toBe('gym-trainer:city:1:0');
  });

  it('never lets two cities share an id', () => {
    const leaders = new Set<string>();
    const trainers = new Set<string>();
    for (let badge = 1; badge <= BADGE_CAPS.length; badge++) {
      const key = `city:${badge}`;
      expect(gymLeaderId(key)).toBe(`gym-leader:${key}`);
      expect(gymTrainerId(key, 0)).toBe(`gym-trainer:${key}:0`);
      leaders.add(gymLeaderId(key));
      trainers.add(gymTrainerId(key, 0));
    }
    expect(leaders.size).toBe(BADGE_CAPS.length);
    expect(trainers.size).toBe(BADGE_CAPS.length);
    expect(gymTrainerId('city:1', 0)).not.toBe(gymTrainerId('city:1', 1));
    expect(gymLeaderId('city:1')).not.toBe(gymTrainerId('city:1', 0));
  });

  it('reads an unreadable room index as the first room', () => {
    expect(gymTrainerId('city:1', -3)).toBe('gym-trainer:city:1:0');
    expect(gymTrainerId('city:1', 2.7)).toBe('gym-trainer:city:1:2');
    expect(gymTrainerId('city:1', Number.NaN)).toBe('gym-trainer:city:1:0');
  });
});

describe('grantBadge', () => {
  it("appends the city's own badge, and only the ladder's next rung", () => {
    const run = runOn('city:1');
    const granted = grantBadge(run, 1);
    expect(granted).not.toBe(run);
    expect(granted.badges).toEqual([1]);
    expect(run.badges).toEqual([]);
    expect(hasBadge(granted, 1)).toBe(true);
    expect(hasBadge(run, 1)).toBe(false);
  });

  it('refuses a badge already held, without dirtying the run', () => {
    const run = holding(runOn('city:1'), [1]);
    expect(grantBadge(run, 1)).toBe(run);
    expect(grantBadge(run, 1).badges).toEqual([1]);
  });

  it('refuses a badge that would skip a rung, fill a gap or leave the ladder', () => {
    const run = runOn('city:1');
    for (const badge of [2, 3, 8, 0, -1, 9, 1.5, Number.NaN]) {
      expect(grantBadge(run, badge), String(badge)).toBe(run);
    }
    // A run holding badge 1 stands on city:2 legally, and still cannot take 3 first.
    const second = holding(runOn('city:2'), [1]);
    expect(grantBadge(second, 3)).toBe(second);
  });

  it("refuses a city's badge it has not reached on the ladder", () => {
    const run = runOn('city:2');
    expect(grantBadge(run, 2)).toBe(run);
  });

  it('refuses a badge the node does not own, and one asked of the town or a route', () => {
    // The next rung of a city that hands over another badge is still refused.
    const cityOne = holding(runOn('city:1'), [1]);
    expect(grantBadge(cityOne, 2)).toBe(cityOne);
    const town = runOn('town:1');
    const route = runOn('route:1');
    expect(grantBadge(town, 1)).toBe(town);
    expect(grantBadge(route, 1)).toBe(route);
    // A route of the second stretch is no gym either, even for the badge it sits in.
    const routeTwo = holding(runOn('route:2'), [1]);
    expect(grantBadge(routeTwo, 2)).toBe(routeTwo);
    const league = runOn('league:1');
    expect(grantBadge(league, 1)).toBe(league);
  });

  it('walks the ladder one city at a time', () => {
    let run = runOn('city:1');
    run = grantBadge(run, 1);
    run = {
      ...run,
      nodeKey: 'city:2',
      visitedNodes: [run.nodeKey, 'city:2'],
      ...compatForNode(SEED, 'city:2'),
    };
    run = grantBadge(run, 2);
    run = {
      ...run,
      nodeKey: 'city:3',
      visitedNodes: [run.nodeKey, 'city:3'],
      ...compatForNode(SEED, 'city:3'),
    };
    run = grantBadge(run, 3);
    expect(run.badges).toEqual([1, 2, 3]);
  });

  it('never grants badge 9 and never skips to the eighth city', () => {
    const run = holding(runOn('city:8'), [1, 2, 3, 4, 5, 6, 7]);
    expect(grantBadge(run, 9)).toBe(run);
    expect(grantBadge(run, 8).badges).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(grantBadge(grantBadge(run, 8), 9).badges).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('gymBadge', () => {
  it('is the badge a gym city hands over', () => {
    for (let badge = 1; badge <= BADGE_CAPS.length; badge++) {
      expect(gymBadge(PLAN, `city:${badge}`), `city:${badge}`).toBe(badge);
    }
  });

  it('is null for every key that is not a gym city', () => {
    for (const key of ['town:1', 'route:2', 'league:1', 'victory-road:1', 'tower:1', 'city:99', '']) {
      expect(gymBadge(PLAN, key), key).toBeNull();
    }
  });

  it('draws nothing and throws nothing', () => {
    expect(gymBadge(PLAN, 'city:1')).toBe(gymBadge(planRegion(SEED), 'city:1'));
  });
});

describe('gymLeaderFoe', () => {
  it("fields gym 1's fixed three at the cap, off no draw at all", () => {
    const run = runOn('city:1');
    const foe = gymLeaderFoe(PLAN, run, 'city:1');
    expect(foe.id).toBe('gym-leader:city:1');
    expect(foe.role).toBe('leader');
    expect(foe.index).toBe(-1);
    expect(foe.badge).toBe(1);
    expect(foe.archetypeId).toBe('blackbelt');
    expect(foe.name).toBe('Boulder');
    expect(foe.roster.map((entry) => entry.speciesId)).toEqual(['geodude', 'machop', 'onix']);
    expect(foe.roster).toHaveLength(3);
    for (const entry of foe.roster) {
      expect(entry.level).toBe(leaderLevel(badgeCap(1)));
      expect(entry.level).toBe(9);
    }
    // Gym 1 names its party, so its team is seed-independent.
    const other = gymLeaderFoe(OTHER_PLAN, runOn('city:1', OTHER_SEED), 'city:1');
    expect(other.roster.map((entry) => entry.speciesId)).toEqual(['geodude', 'machop', 'onix']);
  });

  it('fields a generated party at the second gym, deterministically for a seed', () => {
    const run = runOn('city:2');
    const foe = gymLeaderFoe(PLAN, run, 'city:2');
    expect(foe.id).toBe('gym-leader:city:2');
    expect(foe.role).toBe('leader');
    expect(foe.badge).toBe(2);
    expect(foe.roster).toHaveLength(6);
    for (const entry of foe.roster) expect(entry.level).toBe(badgeCap(2));
    expect(foe.roster.every((entry) => entry.level === 16)).toBe(true);
    expect(gymLeaderFoe(PLAN, run, 'city:2')).toEqual(foe);

    const other = gymLeaderFoe(PLAN, runOn('city:2', OTHER_SEED), 'city:2');
    expect(other.roster.map((entry) => entry.speciesId)).not.toEqual(
      foe.roster.map((entry) => entry.speciesId),
    );
    expect(other.roster).toHaveLength(6);
  });

  it('refuses a key that is not a gym city', () => {
    const run = runOn('town:1');
    for (const key of ['town:1', 'route:1', 'league:1', 'tower:1', 'city:99']) {
      expect(() => gymLeaderFoe(PLAN, run, key), key).toThrow(`not a gym: ${key}`);
    }
  });
});

describe('gymTrainerFoe', () => {
  it("fields the band's own party size at the node's distance", () => {
    const run = runOn('city:1');
    const foe = gymTrainerFoe(PLAN, run, 'city:1', 0);
    expect(foe.id).toBe('gym-trainer:city:1:0');
    expect(foe.role).toBe('trainer');
    expect(foe.index).toBe(0);
    expect(foe.badge).toBe(1);
    expect(foe.roster).toHaveLength(1);
    expect(foe.roster[0]?.level).toBe(leaderLevel(badgeCap(1)));
    expect(foe.name).toBe('Black Belt');
    expect(gymTrainerFoe(PLAN, run, 'city:1', 0)).toEqual(foe);
  });

  it('clamps a room index into the gym and names the scraped id', () => {
    const run = runOn('city:1');
    expect(gymTrainerFoe(PLAN, run, 'city:1', -2).id).toBe('gym-trainer:city:1:0');
    expect(gymTrainerFoe(PLAN, run, 'city:1', 1.7).id).toBe('gym-trainer:city:1:1');
  });

  it('refuses a key that is not a gym city', () => {
    const run = runOn('town:1');
    expect(() => gymTrainerFoe(PLAN, run, 'town:1', 0)).toThrow(/not a gym: town:1/);
  });
});

describe('gymReward', () => {
  it("pays the leader's TM and its money once", () => {
    const run = runOn('city:1');
    const foe = gymLeaderFoe(PLAN, run, 'city:1');
    const reward = gymReward(foe);
    expect(reward.enemyLevels).toEqual(foe.roster.map((entry) => entry.level));
    expect(reward.isTrainer).toBe(true);
    expect(reward.trainerId).toBe('gym-leader:city:1');
    expect(Number.isInteger(reward.money)).toBe(true);
    expect(reward.money).toBeGreaterThan(0);
    expect(reward.item).toEqual({ itemId: 'tm058', count: 1 });

    let next = run;
    for (let fold = 0; fold < 2; fold++) {
      next = grantBadge(resolveBattle(next, winFrom(next), gymReward(foe)).run, foe.badge);
    }
    expect(next.badges).toEqual([1]);
    expect(itemCount(next, 'tm058')).toBe(1);
    expect(next.money).toBe(run.money + reward.money);
  });

  it('pays a room trainer money and no machine', () => {
    const run = runOn('city:1');
    const foe = gymTrainerFoe(PLAN, run, 'city:1', 0);
    const reward = gymReward(foe);
    expect(reward.trainerId).toBe('gym-trainer:city:1:0');
    expect(reward.item).toBeUndefined();
    expect(reward.money).toBeGreaterThan(0);
    expect(reward.money).toBeLessThanOrEqual(gymReward(gymLeaderFoe(PLAN, run, 'city:1')).money);
  });

  it('scales the leader payout by the row multiplier', () => {
    const run = runOn('city:2');
    const leader = gymReward(gymLeaderFoe(PLAN, run, 'city:2'));
    const trainer = gymReward(gymTrainerFoe(PLAN, run, 'city:2', 0));
    expect(leader.money).toBeGreaterThan(trainer.money);
    expect(leader.item).toEqual({ itemId: 'tm011', count: 1 });
  });
});

const RUN_DIR = dirname(fileURLToPath(import.meta.url));

describe('badge purity', () => {
  it('imports no Phaser and no DOM, and draws nothing unseeded', () => {
    const source = readFileSync(join(RUN_DIR, 'badge.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*scenes\//);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\b(document|window|localStorage)\b/);
  });
});

import { describe, expect, it } from 'vitest';
import { LEAGUE } from '../../data/league';
import { LEAGUE_LEVEL } from '../../data/region';
import { createRunPokemon } from '../run/progression';
import { markTrainerDefeated } from '../run/state';
import { createRun, nodeEntry, type RunState } from '../run/state';
import {
  leagueCleared,
  leagueEnter,
  leagueFoe,
  leagueIds,
  leagueNext,
  leagueProgress,
  leagueReward,
  leagueTrainerId,
  leagueWin,
} from './league';
import { planRegion, type RegionPlan } from './plan';

const SEED = 'task-286';
const PLAN = planRegion(SEED);

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** A run standing on the League, with the compat fields that node implies. */
function leagueRun(seed = SEED): RunState {
  return {
    ...createRun({ seed, starter }),
    nodeKey: 'league:1',
    visitedNodes: ['league:1'],
    ...nodeEntry(seed, 'league:1'),
  };
}

/** The run after the first `count` rows are beaten the only way the rule allows. */
function afterRows(count: number, run: RunState = leagueRun()): RunState {
  let next = run;
  for (let row = 1; row <= count; row++) next = leagueWin(next, row);
  return next;
}

/** A party member with a short bar and spent PP. */
function hurt(hp: number, pp: number, status: 'psn' | null = null) {
  return {
    ...starter,
    fighter: {
      ...starter.fighter,
      hp,
      status,
      moves: starter.fighter.moves.map((slot) => ({ ...slot, pp })),
    },
  };
}

describe('leagueTrainerId / leagueIds', () => {
  it('names a row `league:<index>` and lists the five in order', () => {
    expect(leagueTrainerId(1)).toBe('league:1');
    expect(leagueTrainerId(5)).toBe('league:5');
    expect(leagueIds()).toStrictEqual(['league:1', 'league:2', 'league:3', 'league:4', 'league:5']);
    expect(leagueIds()).toHaveLength(LEAGUE.length);
  });
});

describe('leagueProgress / leagueNext / leagueCleared', () => {
  it('starts at no progress and points at the first row', () => {
    const run = leagueRun();
    expect(leagueProgress(run)).toBe(0);
    expect(leagueNext(run)).toBe(1);
    expect(leagueCleared(run)).toBe(false);
  });

  it('walks 1 to 5 and answers null once the Champion is beaten', () => {
    let run = leagueRun();
    for (let row = 1; row <= LEAGUE.length; row++) {
      expect(leagueNext(run)).toBe(row);
      expect(leagueCleared(run)).toBe(false);
      run = leagueWin(run, row);
      expect(leagueProgress(run)).toBe(row);
    }
    expect(leagueNext(run)).toBeNull();
    expect(leagueCleared(run)).toBe(true);
  });

  it('counts only the prefix: beating row 3 alone is progress 0', () => {
    const run = markTrainerDefeated(leagueRun(), leagueTrainerId(3));
    expect(leagueProgress(run)).toBe(0);
    expect(leagueNext(run)).toBe(1);
    const gap = markTrainerDefeated(
      markTrainerDefeated(leagueRun(), leagueTrainerId(1)),
      leagueTrainerId(3),
    );
    expect(leagueProgress(gap)).toBe(1);
    expect(leagueNext(gap)).toBe(2);
  });
});

describe('leagueFoe', () => {
  it('rebuilds the same roster on two calls', () => {
    const run = leagueRun();
    expect(leagueFoe(PLAN, run, 3)).toStrictEqual(leagueFoe(PLAN, run, 3));
  });

  it('fields the row party size, every member at the row level', () => {
    const run = leagueRun();
    for (const row of LEAGUE) {
      const foe = leagueFoe(PLAN, run, row.index);
      expect(foe.index).toBe(row.index);
      expect(foe.row).toBe(row);
      expect(foe.roster).toHaveLength(row.partySize);
      expect(foe.roster.every((entry) => entry.level === row.level)).toBe(true);
      expect(row.level).toBe(LEAGUE_LEVEL);
    }
  });

  it('gives every row its own ids, so no two rows share a stream', () => {
    const run = leagueRun();
    const ids = LEAGUE.map((row) => leagueFoe(PLAN, run, row.index).roster.map((entry) => entry.id));
    for (const rowIds of ids) {
      expect(new Set(rowIds).size).toBe(rowIds.length);
      expect(rowIds.every((id) => id.startsWith('league:'))).toBe(true);
    }
    const flat = ids.flat();
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('moves a row when the run seed changes, and only then', () => {
    const one = leagueFoe(PLAN, leagueRun('seed-a'), 1).roster;
    const same = leagueFoe(PLAN, leagueRun('seed-a'), 1).roster;
    const other = leagueFoe(PLAN, leagueRun('seed-b'), 1).roster;
    expect(same).toStrictEqual(one);
    expect(other.map((entry) => entry.speciesId)).not.toStrictEqual(one.map((entry) => entry.speciesId));
  });

  it('builds the band from LEAGUE_LEVEL when the plan holds no league node', () => {
    const run = leagueRun();
    const leagueless: RegionPlan = {
      ...PLAN,
      nodes: PLAN.nodes.filter((node) => node.kind !== 'league'),
    };
    expect(leagueFoe(leagueless, run, 2)).toStrictEqual(leagueFoe(PLAN, run, 2));
  });

  it('clamps an index outside 1..5 instead of throwing', () => {
    const run = leagueRun();
    expect(leagueFoe(PLAN, run, 0).index).toBe(1);
    expect(leagueFoe(PLAN, run, 9).index).toBe(LEAGUE.length);
  });

  it('keeps the fixed seed reproducible (D11)', () => {
    const run = leagueRun();
    const digest = LEAGUE.map((row) =>
      leagueFoe(PLAN, run, row.index)
        .roster.map((entry) => `${entry.speciesId}@${entry.level}`)
        .join(' '),
    );
    expect(digest).toStrictEqual([
      'entei@60 silvallyrock@60 stakataka@60 vanilluxe@60 cresselia@60',
      'leafeon@60 silvallyelectric@60 silvallywater@60 arceusground@60 meowscarada@60',
      'hoopaunbound@60 silvallyghost@60 ironmoth@60 walrein@60 regirock@60',
      'genesectshock@60 silvallyrock@60 aurorus@60 ironleaves@60 heatran@60',
      'tapufini@60 lugia@60 arceuselectric@60 meowscarada@60 ogerponwellspring@60 gyarados@60',
    ]);
  });
});

describe('leagueEnter', () => {
  it('restores HP and PP', () => {
    const run: RunState = { ...leagueRun(), party: [hurt(3, 0)] };
    const healed = leagueEnter(run).party[0].fighter;
    expect(healed.hp).toBeGreaterThan(3);
    expect(healed.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('never revives a fallen member', () => {
    const run: RunState = { ...leagueRun(), party: [hurt(0, 0)] };
    expect(leagueEnter(run).party[0].fighter.hp).toBe(0);
  });

  it('returns the same object when nothing is missing', () => {
    const run = leagueRun();
    expect(leagueEnter(run)).toBe(run);
  });

  it('leaves a primary status in place, as the heal stop does', () => {
    const run: RunState = { ...leagueRun(), party: [hurt(3, 5, 'psn')] };
    expect(leagueEnter(run).party[0].fighter.status).toBe('psn');
  });
});

describe('leagueWin', () => {
  it('refuses an out-of-order index', () => {
    const run = leagueRun();
    expect(leagueWin(run, 3)).toBe(run);
    expect(leagueProgress(leagueWin(run, 2))).toBe(0);
  });

  it('is idempotent on a repeat', () => {
    const once = leagueWin(leagueRun(), 1);
    expect(leagueWin(once, 1)).toBe(once);
    expect(leagueProgress(once)).toBe(1);
  });

  it('clears the League only after row 5', () => {
    expect(leagueCleared(afterRows(4))).toBe(false);
    expect(leagueCleared(afterRows(5))).toBe(true);
  });
});

describe('leagueReward', () => {
  it('carries the roster levels, the trainer mark and its money', () => {
    const foe = leagueFoe(PLAN, leagueRun(), 2);
    const reward = leagueReward(foe);
    expect(reward.enemyLevels).toStrictEqual(foe.roster.map((entry) => entry.level));
    expect(reward.isTrainer).toBe(true);
    expect(reward.trainerId).toBe('league:2');
    expect(Number.isInteger(reward.money)).toBe(true);
    expect(reward.money).toBeGreaterThan(0);
  });

  it('pays the Champion more than an Elite Four row', () => {
    const run = leagueRun();
    const champion = leagueReward(leagueFoe(PLAN, run, LEAGUE.length));
    const elite = leagueReward(leagueFoe(PLAN, run, 1));
    expect(champion.money).toBeGreaterThan(elite.money);
  });

  it('is the same on a replay', () => {
    const run = leagueRun();
    expect(leagueReward(leagueFoe(PLAN, run, 4))).toStrictEqual(leagueReward(leagueFoe(PLAN, run, 4)));
  });
});

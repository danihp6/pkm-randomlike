import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOWER } from '../../data/league';
import { LEAGUE_LEVEL } from '../../data/region';
import { releaseFainted } from '../run/perms';
import { createRunPokemon } from '../run/progression';
import {
  compatForNode,
  createRun,
  hasLivingParty,
  markTrainerDefeated,
  type RunState,
} from '../run/state';
import { nodeOf, planRegion } from './plan';
import {
  towerHeal,
  towerOpen,
  towerResolve,
  towerReward,
  towerStep,
  towerWin,
  TOWER_NODE_KEY,
} from './tower';

const SEED = 'task-294';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

/** Five at `LEAGUE_LEVEL` is the only party size the tower fields. */
const PARTY_SIZE = 5;

/** A run standing on the tower, with the compat fields that node implies. */
function towerRun(seed = SEED): RunState {
  return {
    ...createRun({ seed, starter }),
    nodeKey: TOWER_NODE_KEY,
    visitedNodes: [TOWER_NODE_KEY],
    ...compatForNode(seed, TOWER_NODE_KEY),
  };
}

/** The run after the five League rows fall: the only way the tower opens. */
function afterChampion(run: RunState = towerRun()): RunState {
  let next = run;
  for (let row = 1; row <= PARTY_SIZE; row++) next = markTrainerDefeated(next, `league:${row}`);
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

describe('towerOpen', () => {
  it('is shut on a fresh run and opens only on the League prefix', () => {
    expect(towerOpen(towerRun())).toBe(false);
    let run = towerRun();
    for (let row = 1; row <= PARTY_SIZE; row++) {
      expect(towerOpen(run), `before row ${row}`).toBe(false);
      run = markTrainerDefeated(run, `league:${row}`);
    }
    expect(towerOpen(run)).toBe(true);
  });

  it('is not opened by the streak, the badges or the node the run stands on', () => {
    const streakOnly: RunState = { ...towerRun(), towerStreak: 7 };
    expect(towerOpen(streakOnly)).toBe(false);
    expect(towerOpen({ ...streakOnly, badges: [1, 2, 3, 4, 5, 6, 7, 8] })).toBe(false);
    expect(towerOpen(towerRun())).toBe(false);
  });
});

describe('towerStep', () => {
  it('answers null before the Champion, whatever the streak says', () => {
    expect(towerStep(towerRun(), 0)).toBeNull();
    expect(towerStep({ ...towerRun(), towerStreak: 7 }, 7)).toBeNull();
  });

  it('asks for rung 1 the fight after the Champion', () => {
    const foe = towerStep(afterChampion(), 0);
    expect(foe).not.toBeNull();
    expect(foe?.rung).toBe(1);
    expect(foe?.trainerId).toBe('tower:1');
    expect(foe?.level).toBe(LEAGUE_LEVEL);
    expect(LEAGUE_LEVEL).toBe(60);
    expect(foe?.name).toBe('Tower');
    expect(foe?.name).toBe(nodeOf(planRegion(SEED), TOWER_NODE_KEY)?.name);
  });

  it('fields five members at 60 with the leaderless tower row', () => {
    const run = afterChampion();
    for (let streak = 0; streak < 20; streak++) {
      const foe = towerStep(run, streak);
      expect(foe, `streak ${streak}`).not.toBeNull();
      expect(foe?.rung).toBe(streak + 1);
      expect(foe?.trainerId).toBe(`tower:${streak + 1}`);
      expect(foe?.roster).toHaveLength(PARTY_SIZE);
      expect(foe?.roster.every((entry) => entry.level === LEAGUE_LEVEL)).toBe(true);
      expect(foe?.row).toBe(TOWER);
      expect(foe?.row.leaderId).toBeNull();
      expect(foe?.row.badge).toBeNull();
      expect(foe?.row.partySize).toBeNull();
      expect(foe?.roster.map((entry) => entry.id)).toStrictEqual(
        [0, 1, 2, 3, 4].map((index) => `tower:${streak + 1}:${index}`),
      );
    }
  });

  it('rebuilds the same party on two calls', () => {
    const run = afterChampion();
    expect(towerStep(run, 4)).toStrictEqual(towerStep(run, 4));
    expect(towerStep(run, 0)?.roster).toStrictEqual(towerStep(run, 0)?.roster);
  });

  it('never fields the same party twice across rungs or seeds', () => {
    const run = afterChampion();
    const rungs = [0, 1, 2, 3, 4, 5].map((streak) =>
      towerStep(run, streak)!
        .roster.map((entry) => entry.speciesId)
        .join(' '),
    );
    expect(new Set(rungs).size).toBe(rungs.length);
    const seeds = ['seed-a', 'seed-b', 'seed-c'].map((seed) =>
      towerStep(afterChampion(towerRun(seed)), 0)!
        .roster.map((entry) => entry.speciesId)
        .join(' '),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('keeps the fixed seed reproducible (D11): the first three rungs, pinned', () => {
    const run = afterChampion();
    const digest = [0, 1, 2].map((streak) =>
      towerStep(run, streak)!
        .roster.map((entry) => `${entry.speciesId}@${entry.level}`)
        .join(' '),
    );
    expect(digest).toStrictEqual([
      'ursalunabloodmoon@60 gyarados@60 ogerpon@60 arceus@60 silvallyfire@60',
      'hydrapple@60 celebi@60 greninjabond@60 diancie@60 baxcalibur@60',
      'regidrago@60 umbreon@60 slaking@60 leafeon@60 pecharunt@60',
    ]);
  });

  it('reads no clock and no Math.random in its own module', () => {
    const source = readFileSync(new URL('./tower.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Date\.now|new Date\(|Math\.random/);
  });

  it('reads no history field: the record cannot open the tower', () => {
    const source = readFileSync(new URL('./tower.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/history|RunHistoryRecord/);
  });
});

describe('towerWin', () => {
  it('steps the streak to the rung it just beat', () => {
    const run = afterChampion();
    expect(towerWin(run, 0).towerStreak).toBe(1);
    expect(towerWin(run, 4).towerStreak).toBe(5);
  });

  it('never steps backwards and answers the run by reference at or above', () => {
    const run: RunState = { ...afterChampion(), towerStreak: 3 };
    expect(towerWin(run, 1)).toBe(run);
    expect(towerWin(run, 2)).toBe(run);
    expect(towerWin(run, 3).towerStreak).toBe(4);
  });

  it('treats a streak that is not a number as none', () => {
    const run = afterChampion();
    expect(towerWin(run, Number.NaN).towerStreak).toBe(1);
  });
});

describe('towerHeal', () => {
  it('restores HP and PP across the party and the box', () => {
    const boxed = { ...hurt(2, 0), fighter: { ...hurt(2, 0).fighter, id: 'boxed' } };
    const run: RunState = { ...afterChampion(), party: [hurt(3, 0)], box: [boxed] };
    const healed = towerHeal(run);
    expect(healed.party[0].fighter.hp).toBeGreaterThan(3);
    expect(healed.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
    expect(healed.box[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('keeps a primary status and never revives a fallen member', () => {
    const run: RunState = { ...afterChampion(), party: [hurt(3, 5, 'psn'), hurt(0, 0)] };
    const healed = towerHeal(run);
    expect(healed.party[0].fighter.status).toBe('psn');
    expect(healed.party[1].fighter.hp).toBe(0);
  });

  it('returns the run by reference when nothing is missing', () => {
    const run = afterChampion();
    expect(towerHeal(run)).toBe(run);
  });
});

describe('towerResolve', () => {
  it('bumps the streak and rests the party on a win', () => {
    const run: RunState = { ...afterChampion(), party: [hurt(3, 0)] };
    const foe = towerStep(run, 0)!;
    const result = towerResolve(run, foe, true);
    expect(result.run.towerStreak).toBe(1);
    expect(result.over).toBe(false);
    expect(result.run.party[0].fighter.hp).toBeGreaterThan(3);
    expect(result.run.party[0].fighter.moves.every((slot) => slot.pp === slot.maxPp)).toBe(true);
  });

  it('keeps the run and its streak on a loss that still has a living member', () => {
    const run: RunState = {
      ...afterChampion(),
      party: [hurt(0, 0), { ...starter, fighter: { ...starter.fighter, id: 'other' } }],
    };
    const foe = towerStep(run, 2)!;
    const result = towerResolve(run, foe, false);
    expect(result.run).toBe(run);
    expect(result.over).toBe(false);
  });

  it('ends the run when the party has nobody living, folded the way the battle leaves it', () => {
    const run: RunState = { ...afterChampion(), party: [hurt(0, 0)] };
    const folded = releaseFainted(run).run;
    expect(folded.party).toHaveLength(0);
    const foe = towerStep(run, 0)!;
    const result = towerResolve(folded, foe, false);
    expect(result.over).toBe(true);
    expect(hasLivingParty(result.run)).toBe(false);
    expect(result.run.towerStreak).toBe(folded.towerStreak);
  });
});

describe('towerReward', () => {
  it('pays the roster levels and the rung mark, never money or an item', () => {
    const foe = towerStep(afterChampion(), 6)!;
    const reward = towerReward(foe);
    expect(reward.enemyLevels).toStrictEqual(foe.roster.map((entry) => entry.level));
    expect(reward.enemyLevels).toHaveLength(PARTY_SIZE);
    expect(reward.isTrainer).toBe(true);
    expect(reward.trainerId).toBe('tower:7');
    expect('money' in reward).toBe(false);
    expect('item' in reward).toBe(false);
  });
});

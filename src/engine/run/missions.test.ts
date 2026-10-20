import { describe, expect, it } from 'vitest';
import { getMission, MISSION_TABLE } from '../../data/missions';
import { hashSeed, Rng } from '../rng';
import { battleHpLoss, missionCompletedBy, missionForMap, missionMet, recordHpLost } from './missions';
import { createRunPokemon } from './progression';
import { createRun, type RunState } from './state';

const starter = createRunPokemon({
  id: 'starter',
  speciesId: 'charmander',
  level: 5,
  moves: ['scratch'],
});

function baseRun(): RunState {
  return createRun({ seed: 'pkm-111', starter });
}

/** Two party members standing at `firstHp` and `secondHp` bars. */
function twoParty(firstHp: number, secondHp: number): RunState {
  const run = baseRun();
  const extra = createRunPokemon({ id: 'second', speciesId: 'sentret', level: 3 });
  const lead = run.party[0];
  return {
    ...run,
    party: [
      { ...lead, fighter: { ...lead.fighter, hp: firstHp } },
      { ...extra, fighter: { ...extra.fighter, hp: secondHp } },
    ],
  };
}

describe('missionForMap', () => {
  it('is a pure function of the seed and the floor', () => {
    const first = missionForMap('pkm-111', 3);
    expect(missionForMap('pkm-111', 3)).toEqual(first);
    expect(missionForMap('pkm-111', 3)).not.toBe(first);
    expect(missionForMap('pkm-112', 3)).toBeDefined();
  });

  it('returns a table row with a fresh, unmet record', () => {
    const mission = missionForMap('run-a', 1);
    expect(getMission(mission.id)).toBeDefined();
    expect(mission.progress).toBe(0);
    expect(mission.completed).toBe(false);
  });

  it('clamps a zero or negative floor onto the first map', () => {
    expect(missionForMap('pkm-111', 0)).toEqual(missionForMap('pkm-111', 1));
    expect(missionForMap('pkm-111', -4)).toEqual(missionForMap('pkm-111', 1));
  });

  it('pins missionForMap("pkm-111", 1..8), so a stream change is a deliberate re-pin', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((floor) => missionForMap('pkm-111', floor).id)).toEqual([
      'flawless',
      'flawless',
      'flawless',
      'flawless',
      'flawless',
      'flawless',
      'flawless',
      'flawless',
    ]);
  });

  it('draws off its own stream, so two floors can differ once the table grows', () => {
    // The shipped table holds one row, so every floor must draw it; the stream under
    // the draw still varies, which is what a second mission reads.
    const ids = new Set(Array.from({ length: 8 }, (_, index) => missionForMap('pkm-111', index + 1).id));
    expect(ids.size).toBe(Math.min(MISSION_TABLE.length, 8));

    const rolls = new Set<number>();
    for (const seed of ['pkm-111', 'pkm-112', 'run-a', 'run-b']) {
      for (let floor = 1; floor <= 8; floor++) {
        rolls.add(new Rng(hashSeed(`${seed}:map:${floor}:mission`)).int(0, 1));
      }
    }
    expect([...rolls].sort()).toEqual([0, 1]);
  });
});

describe('battleHpLoss', () => {
  it('sums the drop both party members took', () => {
    const run = twoParty(20, 14);
    const [first, second] = run.party;
    const loss = battleHpLoss(run, [
      { ...first.fighter, hp: 17 },
      { ...second.fighter, hp: 9 },
    ]);
    expect(loss).toBe(8);
  });

  it('reads zero when nobody was hurt', () => {
    const run = twoParty(20, 14);
    expect(
      battleHpLoss(
        run,
        run.party.map((member) => member.fighter),
      ),
    ).toBe(0);
  });

  it('ignores a member the battle did not report', () => {
    const run = twoParty(20, 14);
    const [first] = run.party;
    expect(battleHpLoss(run, [{ ...first.fighter, hp: 15 }])).toBe(5);
  });

  it('counts a faint as the member whole remaining bar', () => {
    const run = twoParty(20, 14);
    const [first, second] = run.party;
    const loss = battleHpLoss(run, [
      { ...first.fighter, hp: 0 },
      { ...second.fighter, hp: second.fighter.hp },
    ]);
    expect(loss).toBe(20);
  });

  it('never reads a healed or unreported member as a loss', () => {
    const run = twoParty(10, 14);
    const [first] = run.party;
    expect(battleHpLoss(run, [{ ...first.fighter, hp: 25 }])).toBe(0);
    expect(battleHpLoss(run, [])).toBe(0);
  });
});

describe('recordHpLost', () => {
  it('accumulates across the floor battles', () => {
    let run = baseRun();
    expect(run.hpLost).toBe(0);
    run = recordHpLost(run, 3);
    run = recordHpLost(run, 5);
    expect(run.hpLost).toBe(8);
  });

  it('treats a non-positive amount as a no-op, same object', () => {
    const run = recordHpLost(baseRun(), 3);
    expect(recordHpLost(run, 0)).toBe(run);
    expect(recordHpLost(run, -5)).toBe(run);
    expect(recordHpLost(run, Number.NaN)).toBe(run);
  });
});

describe('missionMet', () => {
  it('is false with no mission at all', () => {
    expect(missionMet({ ...baseRun(), mission: null })).toBe(false);
  });

  it('is true on a floor that spent no HP and lost nobody', () => {
    expect(missionMet(baseRun())).toBe(true);
  });

  it('is false once the floor spent HP', () => {
    expect(missionMet(recordHpLost(baseRun(), 1))).toBe(false);
  });

  it('is false once a member fell on the floor', () => {
    const run = baseRun();
    expect(missionMet({ ...run, stats: { ...run.stats, casualties: run.floorCasualties + 1 } })).toBe(
      false,
    );
  });

  it('counts a casualty the floor was entered with as already paid', () => {
    const run = baseRun();
    expect(missionMet({ ...run, stats: { ...run.stats, casualties: 2 }, floorCasualties: 2 })).toBe(
      true,
    );
  });
});

describe('missionCompletedBy', () => {
  it('returns the row the advance just met', () => {
    const before = baseRun();
    const after: RunState = { ...before, missionsCompleted: before.missionsCompleted + 1 };
    expect(missionCompletedBy(before, after)).toEqual(getMission(before.mission?.id ?? ''));
    expect(missionCompletedBy(before, after)?.reward).toEqual({ kind: 'room' });
  });

  it('returns null when the counter did not move', () => {
    const before = baseRun();
    expect(missionCompletedBy(before, before)).toBeNull();
    expect(missionCompletedBy(before, { ...before, missionsCompleted: 0 })).toBeNull();
  });

  it('returns null when the floor it judged carried no mission', () => {
    const before: RunState = { ...baseRun(), mission: null };
    expect(missionCompletedBy(before, { ...before, missionsCompleted: 1 })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { planRegion } from '../region/plan';
import { xpForLevel } from './progression';
import { STARTER_LEVEL, canLeaveTown, emptyRun, isPrologue, takeStarter } from './prologue';
import { hasLivingParty, itemCount, nextMemberId } from './state';

describe('the prologue run (Task-287)', () => {
  it('starts with no party, alive, in the town and behind a shut door', () => {
    const run = emptyRun('seed');

    expect(run.party).toEqual([]);
    expect(run.starterTaken).toBe(false);
    expect(hasLivingParty(run)).toBe(true);
    expect(isPrologue(run)).toBe(true);
    expect(canLeaveTown(run)).toBe(false);
    expect(run.nodeKey).toBe(planRegion('seed').townKey);
    expect(run.badges).toEqual([]);
  });

  it('is a fresh object every call and deep-equal for one seed', () => {
    const first = emptyRun('seed');
    const second = emptyRun('seed');

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.party).not.toBe(first.party);
  });

  it('reads no clock: an absent instant is unknown, an instant it is handed stays', () => {
    expect(emptyRun('seed').startedAt).toBe('');
    expect(emptyRun('seed', '2026-11-03T09:00:00.000Z').startedAt).toBe('2026-11-03T09:00:00.000Z');
  });
});

describe('takeStarter (Task-287)', () => {
  it('grants the member and the starting bag once', () => {
    const run = takeStarter(emptyRun('seed'), 'charmander', STARTER_LEVEL);

    expect(run.party).toHaveLength(1);
    expect(run.party[0]!.fighter.speciesId).toBe('charmander');
    expect(run.party[0]!.fighter.level).toBe(STARTER_LEVEL);
    expect(run.party[0]!.fighter.hp).toBeGreaterThan(0);
    expect(run.bag).toEqual([
      { itemId: 'pokeball', count: 10 },
      { itemId: 'potion', count: 3 },
    ]);
    expect(itemCount(run, 'pokeball')).toBe(10);
    expect(itemCount(run, 'potion')).toBe(3);
    expect(run.xp).toBe(xpForLevel(STARTER_LEVEL));
    expect(run.starterTaken).toBe(true);
    expect(run.stats.catches).toBe(0);
    expect(run.caughtSpecies).toEqual([]);
    expect(isPrologue(run)).toBe(false);
    expect(canLeaveTown(run)).toBe(true);
    expect(hasLivingParty(run)).toBe(true);
  });

  it('refuses a second gift: the same run, the same party and the same bag', () => {
    const taken = takeStarter(emptyRun('seed'), 'charmander', STARTER_LEVEL);
    const again = takeStarter(taken, 'squirtle', STARTER_LEVEL);

    expect(again).toBe(taken);
    expect(again.party).toBe(taken.party);
    expect(itemCount(again, 'pokeball')).toBe(10);
    expect(itemCount(again, 'potion')).toBe(3);
    expect(again.bag).toHaveLength(2);
  });

  it('pins the starter: a fixed seed always mints the same member', () => {
    const first = takeStarter(emptyRun('prologue-starter'), 'charmander', STARTER_LEVEL);
    const second = takeStarter(emptyRun('prologue-starter'), 'charmander', STARTER_LEVEL);

    expect(second).toEqual(first);
    expect(first.party[0]!.fighter.id).toBe('catch-1');
    expect(nextMemberId(emptyRun('prologue-starter'))).toBe('catch-1');
  });

  it('increments a stack the prologue run already carried instead of duplicating it', () => {
    const carried = { ...emptyRun('seed'), bag: [{ itemId: 'pokeball', count: 2 }] };
    const run = takeStarter(carried, 'charmander', STARTER_LEVEL);

    expect(itemCount(run, 'pokeball')).toBe(12);
    expect(run.bag).toHaveLength(2);
  });
});

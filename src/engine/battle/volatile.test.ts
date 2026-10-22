import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import {
  absorbWithSubstitute,
  applyConfusion,
  applyDisable,
  applyEmbargo,
  applyFlinch,
  applyLeechSeed,
  applyNightmare,
  applyNoRetreat,
  applyOctolock,
  applyQuash,
  applyTaunt,
  applyTelekinesis,
  beforeMoveVolatile,
  endOfTurnVolatile,
  hasSubstitute,
  leechSeedDamage,
  makeSubstitute,
  nightmareDamage,
  tickPerish,
} from './volatile';

const make = (speciesId = 'charmander', level = 20) =>
  createFighter({ id: speciesId, speciesId, level });

describe('confusion', () => {
  it('lasts 2-5 turns and snaps out at zero', () => {
    const fighter = make();
    expect(applyConfusion(fighter, new Rng(3))).toBe(true);
    expect(fighter.volatiles.confusion).toBeGreaterThanOrEqual(2);
    expect(fighter.volatiles.confusion).toBeLessThanOrEqual(5);
    expect(applyConfusion(fighter, new Rng(3))).toBe(false);
    fighter.volatiles.confusion = 1;
    expect(beforeMoveVolatile(fighter, new Rng(1))).toEqual({ confusionEnded: true });
  });

  it('clears flinch once consumed', () => {
    const fighter = make();
    applyFlinch(fighter);
    expect(beforeMoveVolatile(fighter, new Rng(1))).toEqual({ flinched: true });
    expect(fighter.volatiles.flinched).toBe(false);
  });
});

describe('leech seed', () => {
  it('drains an eighth of max HP', () => {
    const fighter = make();
    expect(applyLeechSeed(fighter)).toBe(true);
    expect(applyLeechSeed(fighter)).toBe(false);
    expect(leechSeedDamage(fighter)).toBe(Math.max(1, Math.floor(fighter.maxHp / 8)));
  });
});

describe('substitute', () => {
  it('costs a quarter of max HP and absorbs damage', () => {
    const fighter = make();
    const cost = makeSubstitute(fighter);
    expect(cost).toBe(Math.max(1, Math.floor(fighter.maxHp / 4)));
    expect(fighter.hp).toBe(fighter.maxHp - cost);
    expect(hasSubstitute(fighter)).toBe(true);

    expect(absorbWithSubstitute(fighter, cost - 1)).toBe(true);
    expect(hasSubstitute(fighter)).toBe(true);
    absorbWithSubstitute(fighter, 2);
    expect(hasSubstitute(fighter)).toBe(false);
  });

  it('fails when too low to pay the cost', () => {
    const fighter = make();
    fighter.hp = 1;
    expect(makeSubstitute(fighter)).toBe(0);
  });
});

describe('timed volatiles', () => {
  it('counts perish down and clears taunt at end of turn', () => {
    const fighter = make();
    fighter.volatiles.perish = 1;
    expect(tickPerish(fighter)).toBe(true);
    applyTaunt(fighter);
    endOfTurnVolatile(fighter);
    expect(fighter.volatiles.taunt).toBe(2);
  });
});

describe('the status-half volatiles', () => {
  it('Disable locks a move for four turns and clears the lock at zero', () => {
    const fighter = make();
    expect(applyDisable(fighter, 'tackle')).toBe(true);
    expect(applyDisable(fighter, 'growl')).toBe(false);
    expect(fighter.volatiles.disabledMove).toBe('tackle');
    expect(fighter.volatiles.disableTurns).toBe(4);
    for (let pass = 0; pass < 4; pass++) endOfTurnVolatile(fighter);
    expect(fighter.volatiles.disabledMove).toBeNull();
  });

  it('Telekinesis and Embargo tick down each pass while Quash lasts one turn', () => {
    const fighter = make();
    applyTelekinesis(fighter);
    applyEmbargo(fighter);
    applyQuash(fighter);
    expect(fighter.volatiles.telekinesis).toBe(3);
    expect(fighter.volatiles.embargo).toBe(5);
    endOfTurnVolatile(fighter);
    expect(fighter.volatiles.telekinesis).toBe(2);
    expect(fighter.volatiles.embargo).toBe(4);
    expect(fighter.volatiles.quash).toBe(false);
  });

  it('Nightmare only chips a sleeping holder', () => {
    const fighter = make();
    applyNightmare(fighter);
    expect(nightmareDamage(fighter)).toBe(0);
    fighter.status = 'slp';
    expect(nightmareDamage(fighter)).toBe(Math.max(1, Math.floor(fighter.maxHp / 4)));
  });

  it('Octolock and No Retreat trap their holder', () => {
    const octolocked = make();
    expect(applyOctolock(octolocked)).toBe(true);
    expect(octolocked.volatiles.trapped).toBe(true);
    expect(applyOctolock(octolocked)).toBe(false);

    const vowed = make();
    expect(applyNoRetreat(vowed)).toBe(true);
    expect(vowed.volatiles.trapped).toBe(true);
  });
});

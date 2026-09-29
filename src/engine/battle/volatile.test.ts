import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import {
  absorbWithSubstitute,
  applyConfusion,
  applyFlinch,
  applyLeechSeed,
  applyTaunt,
  beforeMoveVolatile,
  endOfTurnVolatile,
  hasSubstitute,
  leechSeedDamage,
  makeSubstitute,
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

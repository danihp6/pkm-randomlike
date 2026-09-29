import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { accuracyChance, rollHit } from './accuracy';
import { createFighter } from './fighter';

const make = (speciesId: string) =>
  createFighter({ id: speciesId, speciesId, level: 20, nature: 'serious' });

describe('accuracyChance', () => {
  it('always hits when the move cannot miss', () => {
    expect(accuracyChance(true, make('charmander'), make('sentret'))).toBe(1);
  });

  it('multiplies by the net accuracy/evasion stage', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.6);

    attacker.boosts.accuracy = 1;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.8);

    attacker.boosts.accuracy = 0;
    defender.boosts.evasion = 1;
    expect(accuracyChance(60, attacker, defender)).toBeCloseTo(0.45);
  });

  it('caps a boosted chance at a guaranteed hit', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    attacker.boosts.accuracy = 6;
    expect(accuracyChance(95, attacker, defender)).toBe(1);
  });
});

describe('rollHit', () => {
  it('cannot miss an unlimited-accuracy move', () => {
    expect(rollHit(new Rng(1), true, make('charmander'), make('sentret'))).toBe(true);
  });

  it('is a pure function of the rng stream', () => {
    const attacker = make('charmander');
    const defender = make('sentret');
    const rolls = () =>
      Array.from({ length: 20 }, () => rollHit(new Rng(4), 75, attacker, defender));
    expect(rolls()).toEqual(rolls());
  });
});

import { describe, expect, it } from 'vitest';
import { getMove, type Move } from '../../data/dex';
import { Rng } from '../rng';
import { computeDamage, estimateDamage } from './damage';
import { createFighter, type BattleFighter } from './fighter';

const fighter = (speciesId: string, level = 20): BattleFighter =>
  createFighter({ id: speciesId, speciesId, level, nature: 'serious' });

const move = (id: string): Move => getMove(id)!;

const hit = (
  attacker: BattleFighter,
  defender: BattleFighter,
  moveId: string,
  seed = 1,
  critical = false,
) => computeDamage(attacker, defender, move(moveId), new Rng(seed), { critical });

describe('computeDamage', () => {
  it('deals nothing when the type is immune', () => {
    const result = hit(fighter('pikachu'), fighter('geodude'), 'thundershock');
    expect(result.effectiveness).toBe(0);
    expect(result.damage).toBe(0);
  });

  it('adds STAB on a matching attacker type', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    expect(hit(attacker, defender, 'ember').damage).toBeGreaterThan(
      hit(attacker, defender, 'watergun').damage,
    );
    expect(hit(attacker, defender, 'ember').stab).toBe(true);
    expect(hit(attacker, defender, 'watergun').stab).toBe(false);
  });

  it('scales with type effectiveness', () => {
    const attacker = fighter('charmander');
    const neutral = fighter('sentret');
    const weak = fighter('squirtle');
    const vsNeutral = hit(attacker, neutral, 'vinewhip', 5);
    const vsWeak = hit(attacker, weak, 'vinewhip', 5);
    expect(vsWeak.effectiveness).toBeGreaterThan(1);
    expect(vsWeak.damage).toBeGreaterThan(vsNeutral.damage);
  });

  it('hits harder on a critical hit', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    expect(hit(attacker, defender, 'ember', 9, true).damage).toBeGreaterThan(
      hit(attacker, defender, 'ember', 9, false).damage,
    );
  });

  it('never drops below 1 on a connecting hit', () => {
    const attacker = fighter('sentret', 1);
    const defender = fighter('magnemite', 50);
    expect(hit(attacker, defender, 'tackle').damage).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateDamage', () => {
  it('is deterministic and never rolls', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const first = estimateDamage(attacker, defender, move('ember'));
    const second = estimateDamage(attacker, defender, move('ember'));
    expect(first).toEqual(second);
    expect(first.crit).toBe(false);
  });
});

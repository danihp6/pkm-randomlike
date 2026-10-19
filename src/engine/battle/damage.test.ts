import { describe, expect, it } from 'vitest';
import { effectiveness, getMove, type Move } from '../../data/dex';
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

describe('the room’s whole-field damage rules', () => {
  // Seed 24's first draw (0.332) is no crit and its 85-100 roll is exactly 100,
  // so the control hit is the raw base damage and the ×1.33 term is exact.
  const AURA_SEED = 24;

  const hitWith = (
    attacker: BattleFighter,
    defender: BattleFighter,
    moveId: string,
    context: Parameters<typeof computeDamage>[4] = {},
  ) => computeDamage(attacker, defender, move(moveId), new Rng(AURA_SEED), context);

  it('boosts a Dark move by the ×1.33 floor under Dark Aura only', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const control = hitWith(attacker, defender, 'bite');
    const dark = hitWith(attacker, defender, 'bite', { darkAura: true });

    expect(control.crit).toBe(false);
    expect(control.stab).toBe(false);
    expect(control.effectiveness).toBe(1);
    expect(dark.damage).toBe(Math.floor(control.damage * 1.33));
    expect(hitWith(attacker, defender, 'bite', { fairyAura: true }).damage).toBe(control.damage);
  });

  it('boosts a Fairy move by the ×1.33 floor under Fairy Aura only', () => {
    const attacker = fighter('charmander');
    const defender = fighter('sentret');
    const control = hitWith(attacker, defender, 'moonblast');
    const fairy = hitWith(attacker, defender, 'moonblast', { fairyAura: true });

    expect(control.crit).toBe(false);
    expect(control.stab).toBe(false);
    expect(control.effectiveness).toBe(1);
    expect(fairy.damage).toBe(Math.floor(control.damage * 1.33));
    expect(hitWith(attacker, defender, 'moonblast', { darkAura: true }).damage).toBe(control.damage);
  });
});

describe('the room’s all-types change', () => {
  it('gives a Normal-type attacker STAB on a Fire move', () => {
    const attacker = fighter('sentret');
    const defender = fighter('bulbasaur');
    const plain = hit(attacker, defender, 'ember', 3);
    const overridden = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
    });

    expect(plain.stab).toBe(false);
    expect(overridden.stab).toBe(true);
  });

  it('reads both fighters as the one type for the chart', () => {
    const attacker = fighter('sentret');
    const defender = fighter('bulbasaur');
    const plain = hit(attacker, defender, 'ember', 3);
    const overridden = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
    });

    expect(plain.effectiveness).toBe(2);
    expect(overridden.effectiveness).toBe(effectiveness('Fire', ['Fire']));
    expect(overridden.effectiveness).toBe(0.5);
  });

  it('lets a caller pass the chart read against the overridden types', () => {
    const attacker = fighter('charmander');
    const defender = fighter('bulbasaur');
    const result = computeDamage(attacker, defender, move('ember'), new Rng(3), {
      critical: false,
      overrideType: 'Fire',
      effectiveness: effectiveness('Fire', ['Fire']),
    });
    expect(result.stab).toBe(true);
    expect(result.effectiveness).toBe(0.5);
  });
});

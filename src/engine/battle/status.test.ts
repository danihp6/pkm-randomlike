import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import {
  applyStatus,
  beforeMoveStatus,
  canApplyStatus,
  cureStatus,
  residualDamage,
  statusName,
} from './status';

const make = (speciesId: string, level = 20) => createFighter({ id: speciesId, speciesId, level });

describe('canApplyStatus', () => {
  it('respects type immunities', () => {
    expect(canApplyStatus(make('charmander'), 'brn')).toBe(false); // Fire cannot burn
    expect(canApplyStatus(make('pikachu'), 'par')).toBe(false); // Electric cannot paralyse
    expect(canApplyStatus(make('magnemite'), 'psn')).toBe(false); // Steel cannot poison
    expect(canApplyStatus(make('magnemite'), 'tox')).toBe(false);
    expect(canApplyStatus(make('charmander'), 'psn')).toBe(true);
  });

  it('refuses a second primary status', () => {
    const fighter = make('charmander');
    expect(applyStatus(fighter, 'brn', new Rng(1))).toBe(false);
    expect(applyStatus(fighter, 'psn', new Rng(1))).toBe(true);
    expect(applyStatus(fighter, 'par', new Rng(1))).toBe(false);
  });
});

describe('sleep', () => {
  it('sets a 1-3 turn counter and blocks until it expires', () => {
    const fighter = make('charmander');
    applyStatus(fighter, 'slp', new Rng(7));
    expect(fighter.statusCounter).toBeGreaterThanOrEqual(1);
    expect(fighter.statusCounter).toBeLessThanOrEqual(3);
    fighter.statusCounter = 2;
    expect(beforeMoveStatus(fighter, new Rng(1))).toEqual({ blocked: 'slp' });
    expect(fighter.statusCounter).toBe(1);
  });

  it('wakes up when the counter reaches zero', () => {
    const fighter = make('charmander');
    applyStatus(fighter, 'slp', new Rng(1));
    fighter.statusCounter = 1;
    expect(beforeMoveStatus(fighter, new Rng(1))).toEqual({ cured: 'slp' });
    expect(fighter.status).toBeNull();
  });

  it('names statuses for the log', () => {
    expect(statusName('tox')).toBe('bad poison');
    expect(cureStatus(make('charmander'))).toBeNull();
  });

  it('Early Bird halves the sleep counter', () => {
    const fighter = createFighter({ id: 'doduo', speciesId: 'doduo', level: 20, ability: 'Early Bird' });
    applyStatus(fighter, 'slp', new Rng(1));
    fighter.statusCounter = 2;
    expect(beforeMoveStatus(fighter, new Rng(1))).toEqual({ cured: 'slp' });
    expect(fighter.status).toBeNull();
  });
});

describe('Corrosion', () => {
  it('lets a Poison-type be poisoned', () => {
    const salandit = createFighter({
      id: 'salandit',
      speciesId: 'salandit',
      level: 20,
      ability: 'Corrosion',
    });
    expect(canApplyStatus(salandit, 'psn')).toBe(true);
    expect(canApplyStatus(salandit, 'tox')).toBe(true);
  });
});

describe('the second ability slot (Task-153)', () => {
  it('Corrosion in the second slot lets a Steel type be poisoned', () => {
    const magnemite = createFighter({
      id: 'm',
      speciesId: 'magnemite',
      level: 20,
      ability: 'Sturdy',
      secondAbility: 'Corrosion',
    });
    expect(canApplyStatus(magnemite, 'psn')).toBe(true);
    expect(canApplyStatus(magnemite, 'tox')).toBe(true);
  });

  it('Early Bird in the second slot halves the sleep counter', () => {
    const doduo = createFighter({
      id: 'd',
      speciesId: 'doduo',
      level: 20,
      ability: 'Run Away',
      secondAbility: 'Early Bird',
    });
    applyStatus(doduo, 'slp', new Rng(1));
    doduo.statusCounter = 2;
    expect(beforeMoveStatus(doduo, new Rng(1))).toEqual({ cured: 'slp' });
    expect(doduo.status).toBeNull();
  });
});

describe('residualDamage', () => {
  it('ticks burn and poison by max HP', () => {
    const burned = make('charmander');
    applyStatus(burned, 'psn', new Rng(1));
    expect(residualDamage(burned)).toEqual({
      status: 'psn',
      damage: Math.max(1, Math.floor(burned.maxHp / 8)),
    });
  });

  it('raises the toxic counter between ticks', () => {
    const fighter = make('charmander');
    applyStatus(fighter, 'tox', new Rng(1));
    const first = residualDamage(fighter);
    const second = residualDamage(fighter);
    expect(first!.damage).toBe(Math.max(1, Math.floor(fighter.maxHp / 16)));
    expect(second!.damage).toBe(Math.max(1, Math.floor((fighter.maxHp * 2) / 16)));
  });
});

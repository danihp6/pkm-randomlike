import { describe, expect, it } from 'vitest';
import { getAbility } from '../../data/dex/abilities';
import { getSpecies } from '../../data/dex/species';
import { createFighter } from './fighter';
import { randomAbility, randomAbilityPool } from './randomAbility';
// Importing the ability table registers every implemented ability, the pool a
// running game draws from (the battle index does this at boot).
import './effects/abilities';

describe('randomAbilityPool', () => {
  it('holds the implemented set and drops the forme-locked ids', () => {
    const ids = randomAbilityPool().map((ability) => ability.id);
    expect(ids).toContain('blaze');
    expect(ids).toContain('levitate');
    // Now implemented generically, so they are fair game.
    expect(ids).toContain('wonderguard');
    expect(ids).toContain('zerotohero');
    expect(ids).toContain('schooling');
    expect(ids).toContain('zenmode');
    expect(ids).toContain('zenmodegalar');
    expect(ids).toContain('stancechange');
    expect(ids).toContain('shieldsdown');
    expect(ids).toContain('terashift');
    expect(ids).toContain('forecast');
    expect(ids).toContain('flowergift');
    expect(ids).toContain('hungerswitch');
    expect(ids).toContain('disguise');
    // Still forme-locked: never handed out.
    expect(ids).not.toContain('powerconstruct');
    expect(ids).not.toContain('multitype');
    expect(ids).not.toContain('gulpmissile');
    expect(ids.length).toBeGreaterThan(200);
  });
});

describe('randomAbility', () => {
  it('is deterministic per (species, seed)', () => {
    expect(randomAbility('charmander', 'seed-1')).toEqual(randomAbility('charmander', 'seed-1'));
  });

  it('only ever hands out an ability from the pool', () => {
    const allowed = new Set(randomAbilityPool().map((ability) => ability.id));
    for (let i = 0; i < 200; i++) {
      const ability = randomAbility('charmander', `seed-${i}`);
      expect(ability).toBeDefined();
      expect(allowed.has(ability!.id)).toBe(true);
      expect(getAbility(ability!.id)).toBeDefined();
    }
  });

  it('varies across seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(randomAbility('charmander', `seed-${i}`)!.id);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('drops an excluded ability from the roll', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomAbility('charmander', `seed-${i}`, ['No Guard'])?.id).not.toBe('noguard');
    }
  });
});

describe('createFighter ability resolution', () => {
  it('rolls a deterministic ability from the pool when a seed is given', () => {
    const a = createFighter({ id: 'a', speciesId: 'charmander', level: 20, learnsetSeed: 'run-1' });
    const b = createFighter({ id: 'b', speciesId: 'charmander', level: 20, learnsetSeed: 'run-1' });
    expect(a.ability).toBe(b.ability);
    expect(a.ability).toBe(randomAbility('charmander', 'run-1')?.name);
  });

  it('falls back to the species first ability without a seed', () => {
    const fighter = createFighter({ id: 'a', speciesId: 'charmander', level: 20 });
    expect(fighter.ability).toBe(Object.values(getSpecies('charmander')!.abilities)[0]);
  });

  it('never pairs No Guard with an OHKO move', () => {
    for (let i = 0; i < 200; i++) {
      const fighter = createFighter({
        id: 'x',
        speciesId: 'charmander',
        level: 20,
        moves: ['fissure'],
        learnsetSeed: `run-${i}`,
      });
      expect(fighter.moves.some((slot) => slot.moveId === 'fissure')).toBe(true);
      expect(fighter.ability).not.toBe('No Guard');
    }
  });
});

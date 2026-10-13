import { describe, expect, it } from 'vitest';
import meta from './meta.json';
import { allAbilities, getAbility } from './abilities';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

describe('ability accessors', () => {
  it('finds an ability by id or name, punctuation ignored', () => {
    expect(getAbility('levitate')?.name).toBe('Levitate');
    expect(getAbility('Levitate')?.id).toBe('levitate');
    expect(getAbility('not-an-ability')).toBeUndefined();
  });

  it('carries both description fields, never undefined', () => {
    const levitate = getAbility('levitate');
    expect(levitate?.desc.length).toBeGreaterThan(0);
    expect(levitate?.shortDesc.length).toBeGreaterThan(0);
    expect(allAbilities().every((ability) => typeof ability.desc === 'string')).toBe(true);
    expect(allAbilities().every((ability) => typeof ability.shortDesc === 'string')).toBe(true);
  });

  it('exposes the whole generated ability set', () => {
    expect(allAbilities().length).toBe(counts.abilities);
    expect(allAbilities().every((ability) => ability.id !== '' && ability.name !== '')).toBe(true);
  });
});

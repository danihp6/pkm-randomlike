import { describe, expect, it } from 'vitest';
import { allAbilities, getAbility } from './abilities';

describe('ability accessors', () => {
  it('finds an ability by id or name, punctuation ignored', () => {
    expect(getAbility('levitate')?.name).toBe('Levitate');
    expect(getAbility('Levitate')?.id).toBe('levitate');
    expect(getAbility('not-an-ability')).toBeUndefined();
  });

  it('exposes the whole generated ability set', () => {
    expect(allAbilities().length).toBe(310);
    expect(allAbilities().every((ability) => ability.id !== '' && ability.name !== '')).toBe(true);
  });
});

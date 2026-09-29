import { describe, expect, it } from 'vitest';
import { TYPE_NAMES, effectiveness, isTypeName } from './types';

describe('type effectiveness', () => {
  it('multiplies the defensive chart across dual types', () => {
    expect(effectiveness('Fire', ['Grass'])).toBe(2);
    expect(effectiveness('Fire', ['Grass', 'Steel'])).toBe(4);
    expect(effectiveness('Fire', ['Water'])).toBe(0.5);
    expect(effectiveness('Normal', ['Ghost'])).toBe(0);
    expect(effectiveness('Electric', ['Ground'])).toBe(0);
    expect(effectiveness('Water', ['Fire', 'Flying'])).toBe(2);
    expect(effectiveness('Ice', ['Dragon', 'Flying'])).toBe(4);
  });

  it('is neutral for unknown or non-battle types', () => {
    expect(effectiveness('Fire', ['NotAType'])).toBe(1);
    expect(effectiveness('Stellar', ['Grass'])).toBe(1);
  });

  it('knows the 18 battle types', () => {
    expect(TYPE_NAMES).toHaveLength(18);
    expect(TYPE_NAMES).toContain('Fire');
    expect(TYPE_NAMES).not.toContain('Stellar');
    expect(isTypeName('fire')).toBe(true);
    expect(isTypeName('Stellar')).toBe(false);
  });
});

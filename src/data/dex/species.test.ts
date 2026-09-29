import { describe, expect, it } from 'vitest';
import { getSpecies, normalizeId, playableSpecies, speciesByNum } from './species';

describe('species accessors', () => {
  it('finds a species by id regardless of case or punctuation', () => {
    expect(getSpecies('pikachu')?.num).toBe(25);
    expect(getSpecies('Pikachu')?.id).toBe('pikachu');
    expect(getSpecies('Ho-Oh')?.id).toBe('hooh');
    expect(getSpecies('Porygon-Z')?.id).toBe('porygonz');
    expect(getSpecies('not-a-species')).toBeUndefined();
  });

  it('resolves a national dex number to the base forme', () => {
    expect(speciesByNum(25)?.name).toBe('Pikachu');
    expect(speciesByNum(6)?.name).toBe('Charizard');
    expect(speciesByNum(9999)).toBeUndefined();
  });

  it('exposes the whole generated playable set', () => {
    const all = playableSpecies();
    expect(all.length).toBe(911);
    expect(all.every((species) => species.num > 0)).toBe(true);
  });

  it('normalizes ids like Showdown does', () => {
    expect(normalizeId('Mr. Mime')).toBe('mrmime');
    expect(normalizeId('Ho-Oh')).toBe('hooh');
  });
});

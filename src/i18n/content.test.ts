import { afterEach, describe, expect, it } from 'vitest';
import { allAbilities } from '../data/dex/abilities';
import { allMoves } from '../data/dex/moves';
import meta from '../data/i18n/es/meta.json';
import {
  MISSING_ES,
  abilityDescription,
  abilityName,
  abilityNameFromEnglish,
  moveDescription,
  moveName,
  moveShortDescription,
} from './content';
import { DEFAULT_LOCALE, setLocale } from './index';

afterEach(() => setLocale(DEFAULT_LOCALE));

describe('the Spanish content table', () => {
  it('covers every move and all but one ability', () => {
    expect(meta.moves.named).toBe(allMoves().length);
    expect(meta.moves.named).toBe(835);
    expect(meta.abilities.named).toBe(310);
    expect(meta.abilities.total).toBe(allAbilities().length);
    expect(meta.moves.described).toBeGreaterThanOrEqual(748);
    expect(meta.abilities.described).toBeGreaterThanOrEqual(267);
    expect(meta.moves.missingNames).toEqual([]);
    expect(MISSING_ES).toContain('alluringvoice');
    expect(new Set(MISSING_ES).size).toBe(MISSING_ES.length);
  });

  it('prints the official Spanish names, not literal translations', () => {
    setLocale('es');
    expect(moveName('tackle')).toBe('Placaje');
    expect(moveName('ember')).toBe('Ascuas');
    expect(moveName('growl')).toBe('Gruñido');
    expect(abilityName('blaze')).toBe('Mar Llamas');
    expect(abilityName('torrent')).toBe('Torrente');
    expect(abilityName('overgrow')).toBe('Espesura');
    expect(abilityNameFromEnglish('Blaze')).toBe('Mar Llamas');
  });

  it('prints the official Spanish descriptions and keeps English intact', () => {
    setLocale('es');
    expect(moveDescription('tackle')).toBe('Embestida con todo el cuerpo.');
    expect(moveShortDescription('tackle')).toBe('Embestida con todo el cuerpo.');
    expect(moveDescription('ember')).toContain('quemaduras');
    expect(abilityDescription('blaze')).toContain('tipo Fuego');
    expect(abilityDescription('overgrow')).toContain('tipo Planta');

    setLocale('en');
    expect(moveName('tackle')).toBe('Tackle');
    expect(moveDescription('tackle')).toBe('No additional effect.');
    expect(abilityName('blaze')).toBe('Blaze');
    expect(abilityDescription('blaze')).toContain('1/3');
  });
});

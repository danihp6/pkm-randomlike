import { describe, expect, it } from 'vitest';
import type { Species } from '../data/dex';
import { RUN_CHAIN } from '../data/run';
import { ROUTE_SHAPES } from '../engine/routes/layout';
import {
  clampLevel,
  DEBUG_DEFAULT_LEVEL,
  DEBUG_MAX_LEVEL,
  DEBUG_MIN_LEVEL,
  DEBUG_ROUTE_HEIGHT,
  DEBUG_ROUTE_WIDTH,
  matchSpecies,
  parseOptionalInt,
  parseOptionalText,
  randomRouteInput,
} from './debugMenu';

function species(id: string, name: string, num: number): Species {
  return {
    id,
    name,
    num,
    types: ['Normal'],
    baseStats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
    abilities: {},
    prevo: '',
    evos: [],
    evolutions: [],
    weightkg: 1,
    genderRatio: { M: 1, F: 1 },
    nfe: false,
    forme: '',
    isCosmeticForme: false,
    catchRate: 255,
  };
}

const CATALOG: readonly Species[] = [
  species('charmander', 'Charmander', 4),
  species('charmeleon', 'Charmeleon', 5),
  species('charizard', 'Charizard', 6),
  species('mrmime', 'Mr. Mime', 122),
];

describe('matchSpecies', () => {
  it('matches an exact name regardless of case', () => {
    expect(matchSpecies('Charmander', CATALOG)?.id).toBe('charmander');
  });

  it('matches an exact id, punctuation ignored', () => {
    expect(matchSpecies('charizard', CATALOG)?.id).toBe('charizard');
    expect(matchSpecies('mr mime', CATALOG)?.id).toBe('mrmime');
  });

  it('falls back to a name prefix, then to a substring', () => {
    expect(matchSpecies('charm', CATALOG)?.id).toBe('charmander');
    expect(matchSpecies('izard', CATALOG)?.id).toBe('charizard');
  });

  it('returns null for a blank or unknown query', () => {
    expect(matchSpecies('   ', CATALOG)).toBeNull();
    expect(matchSpecies('mewtwo', CATALOG)).toBeNull();
  });
});

describe('clampLevel', () => {
  it('keeps a legal level', () => {
    expect(clampLevel(50)).toBe(50);
  });

  it('clamps out-of-range levels and truncates fractions', () => {
    expect(clampLevel(0)).toBe(DEBUG_MIN_LEVEL);
    expect(clampLevel(101)).toBe(DEBUG_MAX_LEVEL);
    expect(clampLevel(12.7)).toBe(12);
  });

  it('falls back to the default on a broken field', () => {
    expect(clampLevel(Number.NaN)).toBe(DEBUG_DEFAULT_LEVEL);
  });
});

describe('parseOptionalInt / parseOptionalText', () => {
  it('treats a blank field as auto', () => {
    expect(parseOptionalInt('')).toBeUndefined();
    expect(parseOptionalInt('   ')).toBeUndefined();
    expect(parseOptionalText('   ')).toBeUndefined();
  });

  it('reads a number, truncates fractions and trims text', () => {
    expect(parseOptionalInt(' 12 ')).toBe(12);
    expect(parseOptionalInt('12.9')).toBe(12);
    expect(parseOptionalText(' seed ')).toBe('seed');
  });

  it('treats a non-numeric field as auto', () => {
    expect(parseOptionalInt('abc')).toBeUndefined();
  });
});

describe('randomRouteInput', () => {
  it('draws the low end of every range', () => {
    const input = randomRouteInput(() => 0);
    expect(input.routeIndex).toBe(1);
    expect(input.width).toBe(DEBUG_ROUTE_WIDTH);
    expect(input.height).toBe(DEBUG_ROUTE_HEIGHT);
  });

  it('draws the high end of every range', () => {
    const input = randomRouteInput(() => 0.999999);
    expect(input.routeIndex).toBe(RUN_CHAIN.finiteLength);
    expect(input.width).toBe(DEBUG_ROUTE_WIDTH);
    expect(input.height).toBe(DEBUG_ROUTE_HEIGHT);
    expect(ROUTE_SHAPES).toContain(input.shape);
  });
});

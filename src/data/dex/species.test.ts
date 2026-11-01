import { describe, expect, it } from 'vitest';
import heightsJson from '../../../scripts/data/heights.json';
import meta from './meta.json';
import speciesJson from './species.json';
import {
  getSpecies,
  heightOf,
  normalizeId,
  playableSpecies,
  speciesByNum,
} from './species';

const counts = (meta as { counts: Readonly<Record<string, number>> }).counts;

/**
 * The table `scripts/fetch-heights.mjs` commits, read here so a generator run that
 * loses a row fails a test instead of shipping a species that sizes like a Pikachu.
 */
const heights = heightsJson as Readonly<Record<string, number>>;

type GeneratedRow = Readonly<{
  id: string;
  baseSpecies: string;
  forme?: string;
  heightm: number;
}>;

const rows = speciesJson as readonly GeneratedRow[];

/**
 * Base species whose `scripts/data/heights.json` row PokeAPI's own CSV does not
 * carry, so the table is right to leave them out. Every entry must be named in
 * `docs/data-spec.md` §1 with the reason it is absent. Empty today.
 */
const KNOWN_MISSING: readonly string[] = [];

const isBase = (row: GeneratedRow): boolean => normalizeId(row.baseSpecies) === row.id;

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
    expect(all.length).toBe(counts.species);
    expect(all.every((species) => species.num > 0)).toBe(true);
  });

  it('normalizes ids like Showdown does', () => {
    expect(normalizeId('Mr. Mime')).toBe('mrmime');
    expect(normalizeId('Ho-Oh')).toBe('hooh');
  });
});

describe('canonical heights', () => {
  it('gives every base species its own row in the committed table', () => {
    const base = rows.filter(isBase);
    const missingRows = base
      .filter((row) => heights[row.id] === undefined)
      .map((row) => row.id);
    const wrongHeight = base
      .filter((row) => heights[row.id] !== undefined && row.heightm !== heights[row.id])
      .map((row) => `${row.id}: ${row.heightm} != ${heights[row.id]}`);

    expect(
      missingRows,
      `base species with no heights.json row: ${missingRows.length} [${missingRows.join(', ')}]`,
    ).toEqual([...KNOWN_MISSING]);
    expect(wrongHeight, `base species with a height the table disagrees with: ${wrongHeight.join(', ')}`).toEqual(
      [],
    );
  });

  it('gives a forme its own row, its base species, or the 1 m default', () => {
    const formes = rows.filter((row) => !isBase(row));
    const wrongForme = formes
      .filter((row) => {
        const base = heights[normalizeId(row.baseSpecies)];
        const expected = heights[row.id] ?? base ?? 1;
        return row.heightm !== expected;
      })
      .map((row) => `${row.id}: ${row.heightm}`);

    expect(
      wrongForme,
      `formes whose height is not their row, their base's or 1: ${wrongForme.length} [${wrongForme.join(', ')}]`,
    ).toEqual([]);
  });

  it('sizes the species the reports named from that table', () => {
    expect(heightOf('wailord')).toBe(14.5);
    expect(heightOf('onix')).toBe(8.8);
    expect(heightOf('diglett')).toBe(0.2);
    expect(heightOf('caterpie')).toBe(0.3);
    expect(heightOf('eternatus')).toBe(20);
    expect(heightOf('charizardmegax')).toBe(1.7);
    expect(heightOf('not-a-species')).toBe(1);
  });
});

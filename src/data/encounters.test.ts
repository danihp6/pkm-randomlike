import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS } from './run';
import { ENCOUNTER_TABLES } from './encounters';
import { getSpecies } from './dex/species';

const bands = LEVEL_BANDS.map((band) => band.id);

describe('encounter tables', () => {
  it('defines a non-empty, positively weighted table for every band and biome', () => {
    for (const [biomeId, tables] of Object.entries(ENCOUNTER_TABLES)) {
      expect(Object.keys(tables).sort(), biomeId).toEqual([...bands].sort());
      for (const band of bands) {
        const table = tables[band];
        expect(table.length, `${biomeId}/${band}`).toBeGreaterThan(0);
        for (const entry of table) {
          expect(entry.weight, `${biomeId}/${band}/${entry.speciesId}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('only lists species that exist in the generated dex', () => {
    for (const [biomeId, tables] of Object.entries(ENCOUNTER_TABLES)) {
      for (const band of bands) {
        for (const entry of tables[band]) {
          expect(getSpecies(entry.speciesId), `${biomeId}/${band}/${entry.speciesId}`).toBeDefined();
        }
      }
    }
  });
});

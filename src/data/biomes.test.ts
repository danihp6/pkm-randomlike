import { describe, expect, it } from 'vitest';
import { BIOME_ORDER, BIOMES, biomeForRoute } from './biomes';
import { TILESET_IDS } from './tilesets';
import { LEVEL_BANDS } from './run';

describe('biomes', () => {
  it('cycles through the biome order that `biomeForRoute` defines', () => {
    expect(biomeForRoute(1).id).toBe(BIOME_ORDER[0]);
    expect(biomeForRoute(BIOME_ORDER.length + 1).id).toBe(BIOME_ORDER[0]);
    expect(biomeForRoute(2).id).toBe(BIOME_ORDER[1]);
    expect(biomeForRoute(0).id).toBe(BIOME_ORDER[0]);
  });

  it('points every biome at a registered tileset and a full encounter table', () => {
    for (const id of BIOME_ORDER) {
      const biome = BIOMES[id];
      expect(biome.id).toBe(id);
      expect(TILESET_IDS).toContain(biome.tilesetId);
      for (const band of LEVEL_BANDS) {
        expect(biome.encounters[band.id].length, `${id}/${band.id}`).toBeGreaterThan(0);
      }
    }
  });
});

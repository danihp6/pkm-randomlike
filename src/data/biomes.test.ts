import { describe, expect, it } from 'vitest';
import { BIOME_ORDER, BIOMES, biomeForRoute } from './biomes';
import { TILESET_IDS } from './tilesets';

describe('biomes', () => {
  it('maps every route to the biome order that `biomeForRoute` defines', () => {
    expect(BIOME_ORDER).toEqual(['forest']);
    for (const index of [0, 1, 2, 3, 8, 40]) {
      expect(biomeForRoute(index).id).toBe(BIOME_ORDER[0]);
    }
  });

  it('points every biome at a registered tileset', () => {
    for (const id of BIOME_ORDER) {
      const biome = BIOMES[id];
      expect(biome.id).toBe(id);
      expect(TILESET_IDS).toContain(biome.tilesetId);
    }
  });
});

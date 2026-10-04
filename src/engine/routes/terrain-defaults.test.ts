import { describe, expect, it } from 'vitest';
import { BIOMES, biomeForRoute } from '../../data/biomes';
import { LEDGE, TALL_GRASS, WATER } from '../map';
import { sketchRoute } from './sketch';

/**
 * Terrain flavour (tall grass, water, ledges) is **off** right now: every biome's
 * counts are 0 and the generator must honour them. Re-enabling a pass is a
 * deliberate `docs/routes-spec.md` §2 change, not an accident.
 */
describe('route terrain defaults', () => {
  it('leaves every biome with no terrain flavour for now', () => {
    for (const biome of Object.values(BIOMES)) {
      expect(biome.terrain, biome.id).toEqual({ grassPatches: 0, waterBodies: 0, ledges: 0 });
    }
  });

  it('places no grass, water or ledges when it follows the biome defaults', () => {
    for (const routeIndex of [1, 2, 3, 4, 5, 6, 7]) {
      const biome = biomeForRoute(routeIndex);
      const route = sketchRoute({
        seed: 'dev-seed',
        routeIndex,
        biomeId: biome.id,
        layout: biome.layout,
        grassPatches: biome.terrain.grassPatches,
        waterBodies: biome.terrain.waterBodies,
        ledges: biome.terrain.ledges,
      });
      const flat = route.tiles.flat();
      expect(flat.filter((value) => value === TALL_GRASS), `grass #${routeIndex}`).toHaveLength(0);
      expect(flat.filter((value) => value === WATER), `water #${routeIndex}`).toHaveLength(0);
      expect(flat.filter((value) => value === LEDGE), `ledge #${routeIndex}`).toHaveLength(0);
    }
  });
});

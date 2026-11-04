import { hashSeed, Rng } from '../engine/rng';
import type { LayoutStyle } from '../engine/routes/layout';
import type { TilesetId } from './tilesets';

export type BiomeId = 'forest';

export type Biome = Readonly<{
  id: BiomeId;
  name: string;
  tilesetId: TilesetId;
  /** Route shape (`src/engine/routes/layout.ts`): FRLG-style per biome. */
  layout: LayoutStyle;
  /** Passes the generator uses to flavour the terrain of this biome. */
  terrain: Readonly<{
    grassPatches: number;
    ledges: number;
  }>;
}>;

export const BIOMES: Readonly<Record<BiomeId, Biome>> = {
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    tilesetId: 'forest',
    layout: 'forest',
    terrain: { grassPatches: 4, ledges: 1 },
  },
};

/** The biomes a route cycles through. The forest is the only one that ships. */
export const BIOME_ORDER: readonly BiomeId[] = ['forest'];

/** A biome by id, falling back to the first of the cycle for an unknown one. */
export function getBiome(id: string): Biome {
  return BIOMES[id as BiomeId] ?? BIOMES[BIOME_ORDER[0]];
}

export function biomeForRoute(routeIndex: number): Biome {
  const index = Math.max(1, Math.floor(routeIndex)) - 1;
  return BIOMES[BIOME_ORDER[index % BIOME_ORDER.length]];
}

/**
 * Picks a biome from `pool`, never the previous map's when the pool holds an
 * alternative (`docs/maps-spec.md` §1, D28). A single-biome pool cannot avoid a
 * repeat, so it falls back to the whole pool.
 */
function pickBiome<T extends string>(rng: Rng, previous: T | undefined, pool: readonly T[]): T {
  if (pool.length === 0) throw new Error('biome pool is empty');
  const options = pool.filter((biome) => biome !== previous);
  const usable = options.length > 0 ? options : pool;
  return usable[rng.int(0, usable.length - 1)];
}

/**
 * The biome a map rolls. Walks the `map` stream from map 1, recovering each previous
 * map's biome, so it is a pure function of the seed and the map index without building
 * a whole map (D11/D29). The stream is keyed `(seed, "map", mapIndex)` exactly as the
 * retired floor plan keyed it, so a fixed seed still reads the same biome.
 */
export function biomeForMap(seed: string, mapIndex: number): BiomeId {
  const index = Math.max(1, Math.floor(mapIndex));
  let previous: BiomeId | undefined;
  for (let current = 1; current <= index; current++) {
    previous = pickBiome(new Rng(hashSeed(`${seed}:map:${current}`)), previous, BIOME_ORDER);
  }
  return previous ?? BIOME_ORDER[0];
}

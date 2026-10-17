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

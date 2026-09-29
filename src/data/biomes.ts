import type { TilesetId } from './tilesets';
import { ENCOUNTER_TABLES, type BiomeEncounterTables } from './encounters';

export type BiomeId = 'wood' | 'placeholder';

export type Biome = Readonly<{
  id: BiomeId;
  name: string;
  tilesetId: TilesetId;
  encounters: BiomeEncounterTables;
  /** Passes the generator uses to flavour the terrain of this biome. */
  terrain: Readonly<{
    grassPatches: number;
    waterBodies: number;
    ledges: number;
  }>;
}>;

export const BIOMES: Readonly<Record<BiomeId, Biome>> = {
  wood: {
    id: 'wood',
    name: 'Woods',
    tilesetId: 'wood',
    encounters: ENCOUNTER_TABLES.wood,
    terrain: { grassPatches: 3, waterBodies: 1, ledges: 2 },
  },
  placeholder: {
    id: 'placeholder',
    name: 'Test Grounds',
    tilesetId: 'placeholder',
    encounters: ENCOUNTER_TABLES.placeholder,
    terrain: { grassPatches: 2, waterBodies: 0, ledges: 1 },
  },
};

export const BIOME_ORDER: readonly BiomeId[] = ['wood', 'placeholder'];

export function biomeForRoute(routeIndex: number): Biome {
  const index = Math.max(1, Math.floor(routeIndex)) - 1;
  return BIOMES[BIOME_ORDER[index % BIOME_ORDER.length]];
}

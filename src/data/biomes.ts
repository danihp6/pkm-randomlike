import type { TilesetId } from './tilesets';
import { ENCOUNTER_TABLES, type BiomeEncounterTables } from './encounters';

export type BiomeId = 'wood' | 'outdoor' | 'forest' | 'cave' | 'placeholder';

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
  outdoor: {
    id: 'outdoor',
    name: 'Sunlit Route',
    tilesetId: 'outdoor',
    encounters: ENCOUNTER_TABLES.outdoor,
    terrain: { grassPatches: 3, waterBodies: 1, ledges: 2 },
  },
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    tilesetId: 'forest',
    encounters: ENCOUNTER_TABLES.forest,
    terrain: { grassPatches: 4, waterBodies: 1, ledges: 1 },
  },
  cave: {
    id: 'cave',
    name: 'Rocky Cave',
    tilesetId: 'cave',
    encounters: ENCOUNTER_TABLES.cave,
    terrain: { grassPatches: 0, waterBodies: 1, ledges: 2 },
  },
};

export const BIOME_ORDER: readonly BiomeId[] = ['outdoor', 'forest', 'cave'];

export function biomeForRoute(routeIndex: number): Biome {
  const index = Math.max(1, Math.floor(routeIndex)) - 1;
  return BIOMES[BIOME_ORDER[index % BIOME_ORDER.length]];
}

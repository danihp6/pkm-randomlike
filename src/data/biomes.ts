import type { LayoutStyle } from '../engine/routes/layout';
import type { TilesetId } from './tilesets';
import { ENCOUNTER_TABLES, type BiomeEncounterTables } from './encounters';

export type BiomeId = 'wood' | 'outdoor' | 'forest' | 'cave' | 'placeholder';

export type Biome = Readonly<{
  id: BiomeId;
  name: string;
  tilesetId: TilesetId;
  encounters: BiomeEncounterTables;
  /** Route shape (`src/engine/routes/layout.ts`): FRLG-style per biome. */
  layout: LayoutStyle;
  /** Passes the generator uses to flavour the terrain of this biome. */
  terrain: Readonly<{
    grassPatches: number;
    ledges: number;
  }>;
}>;

export const BIOMES: Readonly<Record<BiomeId, Biome>> = {
  wood: {
    id: 'wood',
    name: 'Woods',
    tilesetId: 'wood',
    encounters: ENCOUNTER_TABLES.wood,
    layout: 'forest',
    terrain: { grassPatches: 3, ledges: 2 },
  },
  placeholder: {
    id: 'placeholder',
    name: 'Test Grounds',
    tilesetId: 'placeholder',
    encounters: ENCOUNTER_TABLES.placeholder,
    layout: 'forest',
    terrain: { grassPatches: 2, ledges: 1 },
  },
  outdoor: {
    id: 'outdoor',
    name: 'Sunlit Route',
    tilesetId: 'outdoor',
    encounters: ENCOUNTER_TABLES.outdoor,
    layout: 'forest',
    terrain: { grassPatches: 3, ledges: 2 },
  },
  forest: {
    id: 'forest',
    name: 'Deep Forest',
    tilesetId: 'forest',
    encounters: ENCOUNTER_TABLES.forest,
    layout: 'forest',
    terrain: { grassPatches: 4, ledges: 1 },
  },
  cave: {
    id: 'cave',
    name: 'Rocky Cave',
    tilesetId: 'cave',
    encounters: ENCOUNTER_TABLES.cave,
    layout: 'forest',
    terrain: { grassPatches: 0, ledges: 2 },
  },
};

/** The biomes a route cycles through. Only the forest for now. */
export const BIOME_ORDER: readonly BiomeId[] = ['forest'];

export function biomeForRoute(routeIndex: number): Biome {
  const index = Math.max(1, Math.floor(routeIndex)) - 1;
  return BIOMES[BIOME_ORDER[index % BIOME_ORDER.length]];
}

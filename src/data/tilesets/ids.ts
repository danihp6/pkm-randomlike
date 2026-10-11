/**
 * The tileset vocabulary, kept apart from `index.ts` so it carries no asset
 * imports: the engine can read the ids without pulling in a `.png`. `index.ts`
 * builds the registry `Record<TilesetId, BiomeTileset>` off this list, which is
 * what keeps the two in step. A route always renders its biome's own tileset
 * (`D10`), so there is no player preference to read here.
 */

export const TILESET_IDS = ['placeholder', 'wood', 'outdoor', 'forest', 'cave'] as const;

export type TilesetId = (typeof TILESET_IDS)[number];

/** Display names, kept here so the registry and any UI agree. */
export const TILESET_NAMES: Readonly<Record<TilesetId, string>> = {
  placeholder: 'Procedural placeholder',
  wood: 'Woods',
  outdoor: 'FRLG Route',
  forest: 'FRLG Forest',
  cave: 'FRLG Cave',
};

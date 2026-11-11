/**
 * The tileset vocabulary, kept apart from `index.ts` so it carries no asset
 * imports: the engine can read the ids without pulling in a `.png`. `index.ts`
 * builds the registry `Record<TilesetId, BiomeTileset>` off this list, which is
 * what keeps the two in step. A route always renders its biome's own tileset
 * (`D10`), so there is no player preference to read here. `city` and `interior`
 * are the two region fields of a map — a city room and the buildings' insides —
 * and are not biomes: `BIOME_ORDER` stays the forest alone. The three
 * `interior-*` ids are the rooms the laboratory, the Pokémon Centre and the houses
 * draw from the decomp's own interior sets (`docs/tileset-spec.md` §2b).
 */

export const TILESET_IDS = [
  'forest',
  'city',
  'interior',
  'interior-lab',
  'interior-centre',
  'interior-house',
] as const;

export type TilesetId = (typeof TILESET_IDS)[number];

/** Display names, kept here so the registry and any UI agree. */
export const TILESET_NAMES: Readonly<Record<TilesetId, string>> = {
  forest: 'FRLG Forest',
  city: 'FRLG City',
  interior: 'FRLG Interior',
  'interior-lab': 'FRLG Lab',
  'interior-centre': 'FRLG Centre',
  'interior-house': 'FRLG House',
};

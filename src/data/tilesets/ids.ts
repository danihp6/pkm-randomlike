/**
 * The tileset vocabulary, kept apart from `index.ts` so it carries no asset
 * imports: the engine (the save schema and its validation) can read the ids
 * without pulling in a `.png`. `index.ts` builds the registry `Record<TilesetId,
 * BiomeTileset>` off this list, which is what keeps the two in step.
 */

export const TILESET_IDS = ['placeholder', 'wood'] as const;

export type TilesetId = (typeof TILESET_IDS)[number];

/**
 * The player's tileset preference. `auto` keeps the biome's own tileset (`D10`);
 * a concrete id forces that tileset on every route, which is how a player who
 * prefers one look (or a plainer one) overrides the per-biome art.
 */
export type TilesetPreference = 'auto' | TilesetId;

export const TILESET_PREFERENCES: readonly TilesetPreference[] = ['auto', ...TILESET_IDS];

/** Display names, kept here so the registry and the settings screen agree. */
export const TILESET_NAMES: Readonly<Record<TilesetId, string>> = {
  placeholder: 'Procedural placeholder',
  wood: 'Woods',
};

/** The name the settings screen shows for a preference. */
export function tilesetLabel(preference: TilesetPreference): string {
  return preference === 'auto' ? 'Auto (biome)' : TILESET_NAMES[preference];
}

export function isTilesetPreference(value: unknown): value is TilesetPreference {
  return value === 'auto' || TILESET_IDS.includes(value as TilesetId);
}

/** The tileset a route renders with: the biome's, unless a preference forces one. */
export function resolveTileset(preference: TilesetPreference, biomeTileset: TilesetId): TilesetId {
  return preference === 'auto' ? biomeTileset : preference;
}

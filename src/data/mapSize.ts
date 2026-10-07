/**
 * How a route's **map size** changes generation, in **tiers**. A bigger route
 * carries more terrain and more optional paths, but the amounts step by range
 * instead of growing continuously, so the same size always yields the same route
 * (D11).
 *
 * The ranges live here so retuning them never touches the generator
 * (`docs/routes-spec.md` §2). Tiers are keyed by map **area in tiles**: the
 * default 20x20 route stays in `small`, so it keeps its biome/shape counts as-is.
 */
export type MapSizeTierId = 'small' | 'medium' | 'large';

export type MapSizeTier = Readonly<{
  id: MapSizeTierId;
  /** Inclusive lower bound on the map area, in tiles, for this tier. */
  minArea: number;
  /** Multiplier applied to a biome's base `grassPatches` / `ledges`. */
  terrainScale: number;
  /** Optional paths added to each shape's base `branchCount`. */
  branchBonus: number;
  /** Extra trainers a route of this size places beyond the guards it derives. */
  trainerBonus: number;
}>;

export const MAP_SIZE_TIERS: readonly MapSizeTier[] = [
  { id: 'small', minArea: 0, terrainScale: 1, branchBonus: 0, trainerBonus: 0 },
  { id: 'medium', minArea: 24 * 24, terrainScale: 2, branchBonus: 1, trainerBonus: 1 },
  { id: 'large', minArea: 40 * 40, terrainScale: 3, branchBonus: 2, trainerBonus: 2 },
];

/** The tier a `width` x `height` map falls in. Never below the first tier. */
export function mapSizeTier(width: number, height: number): MapSizeTier {
  const area = Math.max(0, Math.floor(width)) * Math.max(0, Math.floor(height));
  let tier = MAP_SIZE_TIERS[0];
  for (const candidate of MAP_SIZE_TIERS) {
    if (area >= candidate.minArea) tier = candidate;
  }
  return tier;
}

/** The multiplier applied to a biome's base terrain counts for this map size. */
export function terrainScaleForSize(width: number, height: number): number {
  return mapSizeTier(width, height).terrainScale;
}

/**
 * How many optional paths a shape carves at this map size: its base
 * `branchCount` plus the tier bonus (a shape with no branches stays at zero).
 */
export function branchCountForSize(base: number, width: number, height: number): number {
  if (base <= 0) return 0;
  return base + mapSizeTier(width, height).branchBonus;
}

/** Extra trainers a map of this size places beyond its spine and pocket guards. */
export function trainerBonusForSize(width: number, height: number): number {
  return mapSizeTier(width, height).trainerBonus;
}

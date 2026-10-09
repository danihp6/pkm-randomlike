/**
 * How a **map** — a group of routes of one biome — is tuned: the Pokémon level
 * range it fields, how many routes it holds and how big each route may be. A map
 * is the unit of biome, level range and size (`docs/maps-spec.md`, D28/D29).
 *
 * The numbers live here so retuning a run never touches the generator: balancing
 * is data. Ranges are **inclusive** and every room rolls its own width and height
 * inside its map's range, so the floor stays inside the map's band while still
 * varying room to room. Past the last tuned map an **infinite** run keeps
 * stepping upward by `MAP_TUNING_STEP` so the difficulty never plateaus (D29),
 * but the room count stops at `MAP_MAX_ROUTES` so a deep floor never becomes a
 * huge maze.
 */
export type MapLevelRange = Readonly<{ minLevel: number; maxLevel: number }>;

/** An inclusive `min..max` range, for a room count or a tile width/height. */
export type MapRange = Readonly<{ min: number; max: number }>;

export type MapTuning = Readonly<{
  /** 1-based map this row applies from. */
  mapIndex: number;
  levels: MapLevelRange;
  /** How many rooms the map's graph holds (a random count inside the range). */
  routes: MapRange;
  /** The width and height (tiles) each room rolls inside the range, independently. */
  size: MapRange;
}>;

/** The mirror of the level ceiling in `src/engine/run/progression.ts` (data is engine-free). */
export const MAP_MAX_LEVEL = 100;

/** Rooms never grow past this, so a deep floor stays a floor, not a maze. */
export const MAP_MAX_ROUTES = 12;

/** A room never grows past this many tiles a side (a whole screen, not a field). */
export const MAP_MAX_ROOM_SIZE = 48;

/**
 * How many maps a finite run walks before its final boss. The last map holds
 * only the final boss and no portal (D31); an infinite run ignores it. Balance
 * data (O-M7), so a longer or shorter campaign never touches the generator.
 */
export const FINITE_MAPS = 6;

export const MAP_TUNING: readonly MapTuning[] = [
  // A floor needs at least four rooms: a four-neighbour grid can only close a loop
  // around a 2x2 block, so a smaller map could never satisfy the "closed into at
  // least one cycle" contract (`docs/maps-spec.md` §2-§3, D30).
  { mapIndex: 1, levels: { minLevel: 2, maxLevel: 6 }, routes: { min: 4, max: 5 }, size: { min: 16, max: 20 } },
  { mapIndex: 2, levels: { minLevel: 6, maxLevel: 11 }, routes: { min: 4, max: 6 }, size: { min: 18, max: 24 } },
  { mapIndex: 3, levels: { minLevel: 11, maxLevel: 17 }, routes: { min: 4, max: 6 }, size: { min: 22, max: 28 } },
  { mapIndex: 4, levels: { minLevel: 17, maxLevel: 24 }, routes: { min: 5, max: 7 }, size: { min: 26, max: 32 } },
  { mapIndex: 5, levels: { minLevel: 24, maxLevel: 32 }, routes: { min: 5, max: 7 }, size: { min: 30, max: 36 } },
  { mapIndex: 6, levels: { minLevel: 32, maxLevel: 40 }, routes: { min: 6, max: 8 }, size: { min: 34, max: 40 } },
];

/** How an out-of-table map steps past the last tuned row (infinite mode). */
export const MAP_TUNING_STEP = {
  levelStep: 8,
  sizeStep: 4,
  routeStep: 1,
} as const;

/** The row tuning a map index: the table row, or the last row grown for later maps. */
export function mapTuning(mapIndex: number): MapTuning {
  const index = Math.max(1, Math.floor(mapIndex));
  const row = MAP_TUNING[index - 1];
  if (row) return row;
  const last = MAP_TUNING[MAP_TUNING.length - 1];
  const extra = index - MAP_TUNING.length;
  const minLevel = Math.min(MAP_MAX_LEVEL, last.levels.maxLevel);
  const routeMin = Math.min(MAP_MAX_ROUTES, last.routes.min + extra * MAP_TUNING_STEP.routeStep);
  const routeMax = Math.min(MAP_MAX_ROUTES, last.routes.max + extra * MAP_TUNING_STEP.routeStep);
  return {
    mapIndex: index,
    levels: {
      minLevel,
      maxLevel: Math.min(MAP_MAX_LEVEL, minLevel + extra * MAP_TUNING_STEP.levelStep),
    },
    routes: { min: Math.min(routeMin, routeMax), max: routeMax },
    size: {
      min: Math.min(MAP_MAX_ROOM_SIZE, last.size.min + extra * MAP_TUNING_STEP.sizeStep),
      max: Math.min(MAP_MAX_ROOM_SIZE, last.size.max + extra * MAP_TUNING_STEP.sizeStep),
    },
  };
}

/**
 * The Pokémon level range a map fields. Wild encounters and trainer rosters read
 * it; within the map the routes ramp from `minLevel` to `maxLevel`.
 */
export function levelRangeForMap(mapIndex: number): MapLevelRange {
  return mapTuning(mapIndex).levels;
}

/** The player's XP/level ceiling on a map (D9 moved to a per-map cap): its `maxLevel`. */
export function levelCapForMap(mapIndex: number): number {
  return mapTuning(mapIndex).levels.maxLevel;
}

/** The inclusive route-count range a map rolls its number of routes from. */
export function routeCountRangeForMap(mapIndex: number): MapRange {
  return mapTuning(mapIndex).routes;
}

/** The inclusive range each room of the map rolls its width and height from. */
export function routeSizeRangeForMap(mapIndex: number): MapRange {
  return mapTuning(mapIndex).size;
}

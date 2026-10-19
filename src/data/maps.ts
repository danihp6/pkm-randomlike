/**
 * How a **map** — a group of routes of one biome — is tuned: the Pokémon level
 * range it fields, how many routes it holds and how big each route may be. A map
 * is the unit of biome, level range and size (`docs/maps-spec.md`, D28/D29).
 *
 * The numbers live here so retuning a run never touches the generator: balancing
 * is data. Ranges are **inclusive**, and a room's width and height follow from its
 * **shape**: the frozen `ROOM_SHAPE_SIZES` table is scaled by the map's own
 * `size.max / MAP_MAX_ROOM_SIZE`, so a later map gives a `corridor` its long side
 * while the quiet leaves stay 30x30 (`docs/maps-spec.md` §1/§4). Past the last
 * tuned map an **infinite** run keeps stepping upward by `MAP_TUNING_STEP` so the
 * difficulty never plateaus (D29), but the room count stops at `MAP_MAX_ROUTES`
 * so a deep floor never becomes a huge maze.
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
  /** The ceiling a room's shape-derived width and height stay inside. */
  size: MapRange;
}>;

/** The shapes a floor plan draws, as the size table names them. */
export type MapShapeSizeId = 'cross' | 'straight' | 'tee' | 'bend' | 'corridor' | 'dead-end';

/**
 * The frozen map-8 size of each shape, before the map-index scale: a `cross` is
 * square, a `corridor` long on its opening axis and a leaf the minimum 30x30
 * (`docs/maps-spec.md` §1). Every earlier map scales both sides by its own
 * `size.max / MAP_MAX_ROOM_SIZE`.
 */
export const ROOM_SHAPE_SIZES: Readonly<
  Record<MapShapeSizeId, Readonly<{ width: number; height: number }>>
> = {
  cross: { width: 40, height: 40 },
  straight: { width: 40, height: 40 },
  tee: { width: 40, height: 48 },
  bend: { width: 44, height: 44 },
  corridor: { width: 52, height: 30 },
  'dead-end': { width: 30, height: 30 },
};

/** The mirror of the level ceiling in `src/engine/run/progression.ts` (data is engine-free). */
export const MAP_MAX_LEVEL = 100;

/** Rooms never grow past this, so a deep floor stays a floor, not a maze. */
export const MAP_MAX_ROUTES = 12;

/** A room never grows past this many tiles a side (a whole screen, not a field). */
export const MAP_MAX_ROOM_SIZE = 56;

/**
 * No room is ever smaller than this many tiles a side. The entry room and the
 * boss room of every floor are pinned to exactly this size (`docs/maps-spec.md`
 * §1/§6), so the quiet leaves read the same on every map.
 */
export const MAP_MIN_ROOM_SIZE = 30;

/**
 * How many maps a finite run walks before its final boss. The last map holds
 * only the final boss and no portal (D31); an infinite run ignores it. Balance
 * data (O-M7), so a longer or shorter campaign never touches the generator.
 */
export const FINITE_MAPS = 8;

export const MAP_TUNING: readonly MapTuning[] = [
  // A floor needs at least six rooms: the entry is a **single-door leaf** and the
  // boss is another, so four more rooms are needed to close the floor's cycle
  // (the two leaves plus a 2x2 core, `docs/maps-spec.md` §2-§3/§6, D30).
  // The level step narrows with the run (7 levels, then 6) so the last floors stay
  // affordable on the `level³` curve: a constant step to the engine ceiling would
  // want more XP on its top floor than a whole run (`docs/balance/route-curve.md`).
  {
    mapIndex: 1,
    levels: { minLevel: 2, maxLevel: 9 },
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 2,
    levels: { minLevel: 9, maxLevel: 16 },
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 3,
    levels: { minLevel: 16, maxLevel: 23 },
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 4,
    levels: { minLevel: 23, maxLevel: 30 },
    routes: { min: 6, max: 7 },
    size: { min: 30, max: 32 },
  },
  {
    mapIndex: 5,
    levels: { minLevel: 30, maxLevel: 37 },
    routes: { min: 6, max: 7 },
    size: { min: 30, max: 36 },
  },
  {
    mapIndex: 6,
    levels: { minLevel: 37, maxLevel: 43 },
    routes: { min: 6, max: 8 },
    size: { min: 30, max: 40 },
  },
  {
    mapIndex: 7,
    levels: { minLevel: 43, maxLevel: 49 },
    routes: { min: 6, max: 8 },
    size: { min: 30, max: 44 },
  },
  {
    mapIndex: 8,
    levels: { minLevel: 49, maxLevel: 55 },
    routes: { min: 6, max: 9 },
    size: { min: 30, max: 56 },
  },
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
  // `extra` counts from 1, so the first out-of-table map continues at the last
  // row's cap and each further one steps up by `levelStep`; the **floor** has to
  // climb too, not just the ceiling, or a deep floor only widens.
  const extra = index - MAP_TUNING.length;
  const minLevel = Math.min(
    MAP_MAX_LEVEL,
    last.levels.maxLevel + (extra - 1) * MAP_TUNING_STEP.levelStep,
  );
  const routeMin = Math.min(MAP_MAX_ROUTES, last.routes.min + extra * MAP_TUNING_STEP.routeStep);
  const routeMax = Math.min(MAP_MAX_ROUTES, last.routes.max + extra * MAP_TUNING_STEP.routeStep);
  return {
    mapIndex: index,
    levels: {
      minLevel,
      maxLevel: Math.min(MAP_MAX_LEVEL, minLevel + MAP_TUNING_STEP.levelStep),
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

/** The inclusive range each room's shape-derived width and height stay inside. */
export function routeSizeRangeForMap(mapIndex: number): MapRange {
  return mapTuning(mapIndex).size;
}

/**
 * A room's size on `mapIndex`: the frozen table scaled by the map's own
 * `size.max / MAP_MAX_ROOM_SIZE`, rounded and clamped to
 * [MAP_MIN_ROOM_SIZE, MAP_MAX_ROOM_SIZE]. `longAxis: 'ns'` swaps the two sides
 * of a `corridor` (the only shape that reads differently by axis).
 */
export function roomSizeForShape(
  shape: MapShapeSizeId,
  mapIndex: number,
  longAxis: 'ew' | 'ns' = 'ew',
): Readonly<{ width: number; height: number }> {
  const frozen = ROOM_SHAPE_SIZES[shape];
  const ratio = mapTuning(mapIndex).size.max / MAP_MAX_ROOM_SIZE;
  const scale = (side: number): number =>
    Math.min(MAP_MAX_ROOM_SIZE, Math.max(MAP_MIN_ROOM_SIZE, Math.round(side * ratio)));
  const width = scale(frozen.width);
  const height = scale(frozen.height);
  if (shape === 'corridor' && longAxis === 'ns') return { width: height, height: width };
  return { width, height };
}

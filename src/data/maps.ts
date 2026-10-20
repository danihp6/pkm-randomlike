/**
 * How a **map** — a group of routes of one biome — is tuned: the level cap it
 * enforces, how many routes it holds and how big each route may be. A map is the
 * unit of biome, level cap and size (`docs/maps-spec.md`, D28/D29).
 *
 * The numbers live here so retuning a run never touches the generator: balancing
 * is data. The **cap** is a floor's only level anchor (D29): wild levels and a
 * regular trainer's level are player-relative (`wildLevel`, `trainerLevel`), and
 * the floor's level *window* is derived from the adjacent caps by
 * `levelWindowForMap` in `src/engine/run/floors.ts`, so no range is stored here.
 *
 * Ranges are **inclusive**, and a room's width and height follow from its
 * **shape**: the frozen `ROOM_SHAPE_SIZES` table is scaled by the map's own
 * `size.max / MAP_MAX_ROOM_SIZE`, so a later map gives a `corridor` its long side
 * while the quiet leaves stay 30x30 (`docs/maps-spec.md` §1/§4). Past the last
 * tuned map an **infinite** run keeps stepping upward by `MAP_TUNING_STEP` so the
 * difficulty never plateaus (D29), but the room count stops at `MAP_MAX_ROUTES`
 * so a deep floor never becomes a huge maze.
 */

/** An inclusive `min..max` range, for a room count or a tile width/height. */
export type MapRange = Readonly<{ min: number; max: number }>;

export type MapTuning = Readonly<{
  /** 1-based map this row applies from. */
  mapIndex: number;
  /** The player's XP/level ceiling on this map (D9 moved to the map, D29). */
  cap: number;
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
    cap: 9,
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 2,
    cap: 16,
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 3,
    cap: 23,
    routes: { min: 6, max: 6 },
    size: { min: 30, max: 30 },
  },
  {
    mapIndex: 4,
    cap: 30,
    routes: { min: 6, max: 7 },
    size: { min: 30, max: 32 },
  },
  {
    mapIndex: 5,
    cap: 37,
    routes: { min: 6, max: 7 },
    size: { min: 30, max: 36 },
  },
  {
    mapIndex: 6,
    cap: 43,
    routes: { min: 6, max: 8 },
    size: { min: 30, max: 40 },
  },
  {
    mapIndex: 7,
    cap: 49,
    routes: { min: 6, max: 8 },
    size: { min: 30, max: 44 },
  },
  {
    mapIndex: 8,
    cap: 55,
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
  // `extra` counts from 1, so an out-of-table map continues one step past the last
  // row's cap and each further one steps up by `levelStep`, saturating at the
  // engine ceiling. The window that follows is the previous map's cap, so it climbs
  // with the cap rather than widening on its own (D29).
  const extra = index - MAP_TUNING.length;
  const cap = Math.min(MAP_MAX_LEVEL, last.cap + extra * MAP_TUNING_STEP.levelStep);
  const routeMin = Math.min(MAP_MAX_ROUTES, last.routes.min + extra * MAP_TUNING_STEP.routeStep);
  const routeMax = Math.min(MAP_MAX_ROUTES, last.routes.max + extra * MAP_TUNING_STEP.routeStep);
  return {
    mapIndex: index,
    cap,
    routes: { min: Math.min(routeMin, routeMax), max: routeMax },
    size: {
      min: Math.min(MAP_MAX_ROOM_SIZE, last.size.min + extra * MAP_TUNING_STEP.sizeStep),
      max: Math.min(MAP_MAX_ROOM_SIZE, last.size.max + extra * MAP_TUNING_STEP.sizeStep),
    },
  };
}

/** The player's XP/level ceiling on a map: its one level anchor (D9 moved to the map, D29). */
export function levelCapForMap(mapIndex: number): number {
  return mapTuning(mapIndex).cap;
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

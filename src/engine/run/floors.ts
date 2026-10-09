import { levelRangeForMap } from '../../data/maps';
import { bandForLevel, type LevelBand } from '../../data/run';
import { planMap } from '../maps/plan';

/**
 * Where a global route index falls in the run's **map chain** (`docs/maps-spec.md`
 * §1/§5). A route is a room of a map; the map owns the biome and the level range,
 * and the rooms ramp across it. The chain is derived from the seed through the
 * plan, so a fixed seed always resolves a route to the same floor (D11/D29).
 */
export type FloorPosition = Readonly<{
  mapIndex: number;
  /** 0-based room inside the map, in discovery order. */
  roomInMap: number;
  roomCount: number;
  minLevel: number;
  maxLevel: number;
}>;

/**
 * The floor a route index lands on: walks the plan maps from 1, subtracting each
 * map's room count, until the route falls inside one. Pure and deterministic.
 */
export function floorForRoute(seed: string, routeIndex: number): FloorPosition {
  let remaining = Math.max(1, Math.floor(routeIndex)) - 1;
  for (let mapIndex = 1; ; mapIndex++) {
    const plan = planMap(seed, mapIndex);
    if (remaining < plan.rooms.length) {
      const levels = levelRangeForMap(mapIndex);
      return {
        mapIndex,
        roomInMap: remaining,
        roomCount: plan.rooms.length,
        minLevel: levels.minLevel,
        maxLevel: levels.maxLevel,
      };
    }
    remaining -= plan.rooms.length;
  }
}

/**
 * The working level of a room: the map's `minLevel` at the entry ramping to its
 * `maxLevel` at the boss (`docs/maps-spec.md` §5). A single-room floor sits at the
 * top.
 */
export function roomLevelForFloor(position: FloorPosition): number {
  if (position.roomCount <= 1) return position.maxLevel;
  const t = position.roomInMap / (position.roomCount - 1);
  return Math.round(position.minLevel + t * (position.maxLevel - position.minLevel));
}

/** The working level of a route's room, for the wild encounters it rolls. */
export function runRoomLevel(seed: string, routeIndex: number): number {
  return roomLevelForFloor(floorForRoute(seed, routeIndex));
}

/**
 * The **band** a route reads for its species pool and roster size: the map's level
 * range (`docs/maps-spec.md` §5) with the archetype pool the range falls in.
 */
export function runBand(seed: string, routeIndex: number): LevelBand {
  const position = floorForRoute(seed, routeIndex);
  return {
    ...bandForLevel(position.minLevel),
    minLevel: position.minLevel,
    maxLevel: position.maxLevel,
  };
}

/**
 * The band of a map by its index, for callers that hold the run's explicit
 * position (`RunState.mapIndex`) instead of a global route index.
 */
export function bandForMap(mapIndex: number): LevelBand {
  const levels = levelRangeForMap(mapIndex);
  return {
    ...bandForLevel(levels.minLevel),
    minLevel: levels.minLevel,
    maxLevel: levels.maxLevel,
  };
}

/** The working level of a room by its explicit map position, ramping to the boss. */
export function roomLevelForMap(mapIndex: number, roomInMap: number, roomCount: number): number {
  const levels = levelRangeForMap(mapIndex);
  return roomLevelForFloor({ mapIndex, roomInMap, roomCount, minLevel: levels.minLevel, maxLevel: levels.maxLevel });
}

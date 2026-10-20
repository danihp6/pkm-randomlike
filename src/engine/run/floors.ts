import { levelCapForMap } from '../../data/maps';
import { LEVEL_BANDS, bandForLevel, type LevelBand } from '../../data/run';
import { planMap, type MapPlan } from '../maps/plan';

/**
 * Where a global route index falls in the run's **map chain** (`docs/maps-spec.md`
 * §1/§5). A route is a room of a map; the map owns the biome and the level cap,
 * and the floor reads the window derived from the adjacent caps. The chain is
 * derived from the seed through the plan, so a fixed seed always resolves a route
 * to the same floor (D11/D29).
 */
export type FloorPosition = Readonly<{
  mapIndex: number;
  /** 0-based room inside the map, in discovery order. */
  roomInMap: number;
  roomCount: number;
  /** The window this floor's cap is reached from: the previous floor's cap. */
  minLevel: number;
  /** The floor's cap (`levelCapForMap`). */
  maxLevel: number;
}>;

/**
 * The level window a floor reads: it opens at the **previous floor's cap** and
 * closes at this floor's cap. Map 1 opens at the run's first band floor
 * (`LEVEL_BANDS[0].minLevel`), because there is no previous cap. The cap is a
 * floor's only level anchor, so the window is derived, never stored (D29).
 */
export function levelWindowForMap(
  mapIndex: number,
): Readonly<{ minLevel: number; maxLevel: number }> {
  const index = Math.max(1, Math.floor(mapIndex));
  const minLevel = index <= 1 ? LEVEL_BANDS[0].minLevel : levelCapForMap(index - 1);
  return { minLevel, maxLevel: levelCapForMap(index) };
}

/**
 * The floor a route index lands on: walks the plan maps from 1, subtracting each
 * map's room count, until the route falls inside one. Pure and deterministic.
 */
export function floorForRoute(seed: string, routeIndex: number): FloorPosition {
  let remaining = Math.max(1, Math.floor(routeIndex)) - 1;
  for (let mapIndex = 1; ; mapIndex++) {
    const plan = planMap(seed, mapIndex);
    if (remaining < plan.rooms.length) {
      const window = levelWindowForMap(mapIndex);
      return {
        mapIndex,
        roomInMap: remaining,
        roomCount: plan.rooms.length,
        minLevel: window.minLevel,
        maxLevel: window.maxLevel,
      };
    }
    remaining -= plan.rooms.length;
  }
}

/**
 * The stable global route index of a plan room: the room counts of the maps
 * before it plus its own id, so it is the same on every visit (`docs/maps-spec.md`
 * §9). Route geometry, trainers and loot seed off this, not the run's moving
 * `routeIndex` counter, so a room looks identical when walked back into.
 */
export function routeIndexForRoom(plan: MapPlan, roomId: number): number {
  const room = Math.max(0, Math.floor(roomId));
  let prefix = 0;
  for (let map = 1; map < plan.mapIndex; map++) prefix += planMap(plan.seed, map).rooms.length;
  return prefix + room + 1;
}

/**
 * The **band** a route reads for its species pool and roster size: the floor's
 * level window (`docs/maps-spec.md` §5) with the archetype pool its floor falls in.
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
  const window = levelWindowForMap(mapIndex);
  return {
    ...bandForLevel(window.minLevel),
    minLevel: window.minLevel,
    maxLevel: window.maxLevel,
  };
}

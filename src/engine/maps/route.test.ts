import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, mapPixelSize, padMap } from '../map';
import {
  MAP_MAX_ROOM_SIZE,
  MAP_MIN_ROOM_SIZE,
  mapTuning,
  routeSizeRangeForMap,
} from '../../data/maps';
import { mapSizeTier, terrainScaleForSize } from '../../data/mapSize';
import { sketchRoute } from '../routes/sketch';
import { validateRoute } from '../routes/validate';
import { planMap } from './plan';
import { routeForRoom } from './route';

const SEEDS = ['size-a', 'size-b', 'size-c'];

function buildRoom(seed: string, mapIndex: number, roomId: number) {
  const plan = planMap(seed, mapIndex);
  const route = routeForRoom(plan, roomId, roomId);
  return sketchRoute({
    seed,
    routeIndex: route.routeIndex,
    biomeId: route.biomeId,
    openings: route.openings,
    width: route.width,
    height: route.height,
  });
}

describe('routeForRoom', () => {
  it('mirrors the room size and opening set, marking one entry', () => {
    const plan = planMap('size-a', 1);
    for (const room of plan.rooms) {
      const route = routeForRoom(plan, room.id, room.id);
      expect(route.width).toBe(room.width);
      expect(route.height).toBe(room.height);
      expect(route.biomeId).toBe(plan.biomeId);
      expect(route.openings).toHaveLength(room.openings.length);
      expect(route.openings.filter((opening) => opening.role === 'entry')).toHaveLength(1);
      expect(route.openings.map((opening) => opening.edge)).toEqual(
        room.openings.map((opening) => opening.edge),
      );
    }
  });

  it('throws for a room the plan does not have', () => {
    const plan = planMap('size-a', 1);
    expect(() => routeForRoom(plan, plan.rooms.length, 0)).toThrow();
  });
});

describe('plan-driven route size', () => {
  it('builds a valid route for every room of every map', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          const route = buildRoom(seed, mapIndex, room.id);
          expect(route.width, `${seed} map ${mapIndex} room ${room.id}`).toBe(room.width);
          expect(route.height, `${seed} map ${mapIndex} room ${room.id}`).toBe(room.height);
          expect(validateRoute(route).ok, `${seed} map ${mapIndex} room ${room.id}`).toBe(true);
        }
      }
    }
  }, 60_000);

  it('is a pure function of the seed and input size', () => {
    for (const mapIndex of [1, 3, 6]) {
      const plan = planMap('size-a', mapIndex);
      const room = plan.rooms[plan.rooms.length - 1];
      const first = buildRoom('size-a', mapIndex, room.id);
      const second = buildRoom('size-a', mapIndex, room.id);
      expect(second).toEqual(first);
    }
  });

  it('spans the map-size tiers as the maps grow', () => {
    for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
      const size = routeSizeRangeForMap(mapIndex);
      expect(size.max).toBeLessThanOrEqual(MAP_MAX_ROOM_SIZE);
    }
    expect(mapSizeTier(mapTuning(1).size.max, mapTuning(1).size.max).id).toBe('medium');
    expect(mapSizeTier(mapTuning(6).size.max, mapTuning(6).size.max).id).toBe('large');
    expect(terrainScaleForSize(mapTuning(6).size.max, mapTuning(6).size.max)).toBeGreaterThan(
      terrainScaleForSize(mapTuning(1).size.max, mapTuning(1).size.max),
    );
  });

  it('still carries the beyond-edge margin at any plan size', () => {
    const large = Array.from({ length: MAP_MAX_ROOM_SIZE }, () => new Array<number>(MAP_MAX_ROOM_SIZE).fill(FLOOR));
    const padded = padMap(large, 3, WALL);
    expect(padded).toHaveLength(MAP_MAX_ROOM_SIZE + 6);
    expect(padded[0]).toHaveLength(MAP_MAX_ROOM_SIZE + 6);
    // Every plan room is at least the minimum route size.
    for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
      expect(routeSizeRangeForMap(mapIndex).min).toBeGreaterThanOrEqual(MAP_MIN_ROOM_SIZE);
    }
  });

  it('sizes the camera bounds from the map at any plan size', () => {
    const map = Array.from({ length: MAP_MAX_ROOM_SIZE }, () =>
      new Array<number>(MAP_MAX_ROOM_SIZE).fill(FLOOR),
    );
    expect(mapPixelSize(map, 24)).toEqual({
      width: MAP_MAX_ROOM_SIZE * 24,
      height: MAP_MAX_ROOM_SIZE * 24,
    });
  });
});

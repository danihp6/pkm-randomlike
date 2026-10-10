import { describe, expect, it } from 'vitest';
import { levelRangeForMap } from '../../data/maps';
import { planMap } from '../maps/plan';
import {
  floorForRoute,
  roomLevelForFloor,
  routeIndexForRoom,
  runBand,
  runRoomLevel,
} from './floors';
import { capForRoute } from './levelCap';

const SEEDS = ['floor-a', 'floor-b', 'floor-c'];

describe('floorForRoute', () => {
  it('is a pure function of the seed and route index', () => {
    expect(floorForRoute('floor-a', 7)).toEqual(floorForRoute('floor-a', 7));
    expect(floorForRoute('floor-a', 7)).not.toEqual(floorForRoute('floor-a', 8));
  });

  it('lays the global route chain over the map chain', () => {
    for (const seed of SEEDS) {
      let routeIndex = 1;
      for (let mapIndex = 1; mapIndex <= 6; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (let room = 0; room < plan.rooms.length; room++) {
          const position = floorForRoute(seed, routeIndex);
          expect(position.mapIndex).toBe(mapIndex);
          expect(position.roomInMap).toBe(room);
          expect(position.roomCount).toBe(plan.rooms.length);
          expect(position.minLevel).toBe(levelRangeForMap(mapIndex).minLevel);
          expect(position.maxLevel).toBe(levelRangeForMap(mapIndex).maxLevel);
          routeIndex += 1;
        }
      }
    }
  });

  it('clamps a degenerate route index to the first room', () => {
    expect(floorForRoute('floor-a', 0)).toEqual(floorForRoute('floor-a', 1));
    expect(floorForRoute('floor-a', -5)).toEqual(floorForRoute('floor-a', 1));
  });

  it('keeps walking deeper maps past the tuned table', () => {
    const deep = floorForRoute('floor-a', 500);
    expect(deep.mapIndex).toBeGreaterThan(6);
    expect(deep.minLevel).toBeGreaterThanOrEqual(levelRangeForMap(6).maxLevel);
  });
});

describe('routeIndexForRoom', () => {
  it('is the stable global index floorForRoute resolves back to the room', () => {
    for (const seed of SEEDS) {
      for (let mapIndex = 1; mapIndex <= 4; mapIndex++) {
        const plan = planMap(seed, mapIndex);
        for (const room of plan.rooms) {
          const index = routeIndexForRoom(plan, room.id);
          const position = floorForRoute(seed, index);
          expect(position.mapIndex).toBe(mapIndex);
          expect(position.roomInMap).toBe(room.id);
          // Stable across calls, so a revisited room keeps its geometry.
          expect(routeIndexForRoom(plan, room.id)).toBe(index);
        }
      }
    }
  });
});

describe('room levels and cap', () => {
  it('ramps a floor from its min to its max level', () => {
    for (const seed of SEEDS) {
      const position = floorForRoute(seed, 1);
      const levels = levelRangeForMap(position.mapIndex);
      const first = roomLevelForFloor({ ...position, roomInMap: 0 });
      const last = roomLevelForFloor({ ...position, roomInMap: position.roomCount - 1 });
      expect(first).toBe(levels.minLevel);
      expect(last).toBe(levels.maxLevel);
      expect(runRoomLevel(seed, 1)).toBe(first);
    }
  });

  it('caps a route at its map max level', () => {
    for (const seed of SEEDS) {
      expect(capForRoute(seed, 1)).toBe(floorForRoute(seed, 1).maxLevel);
    }
  });
});

describe('runBand', () => {
  it('carries the map range with the archetype band the range falls in', () => {
    const early = runBand('floor-a', 1);
    expect(early.id).toBe('early');
    expect(early.minLevel).toBe(levelRangeForMap(1).minLevel);
    expect(early.maxLevel).toBe(levelRangeForMap(1).maxLevel);

    expect(runBand('floor-a', 500).id).toBe('end');
  });
});

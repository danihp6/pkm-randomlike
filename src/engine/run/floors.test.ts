import { describe, expect, it } from 'vitest';
import { FINITE_MAPS } from '../../data/maps';
import { LEVEL_BANDS, bandForLevel } from '../../data/run';
import { planMap } from '../maps/plan';
import {
  bandForMap,
  floorForRoute,
  levelWindowForMap,
  routeIndexForRoom,
  runBand,
} from './floors';
import { capForRoute } from './levelCap';

const SEEDS = ['floor-a', 'floor-b', 'floor-c'];

describe('levelWindowForMap', () => {
  it('opens each finite floor at the previous cap and closes it at its own', () => {
    const windows: readonly (readonly [number, number])[] = [
      [2, 9],
      [9, 16],
      [16, 23],
      [23, 30],
      [30, 37],
      [37, 43],
      [43, 49],
      [49, 55],
    ];
    expect(windows).toHaveLength(FINITE_MAPS);
    for (const [index, [minLevel, maxLevel]] of windows.entries()) {
      expect(levelWindowForMap(index + 1), `map ${index + 1}`).toEqual({ minLevel, maxLevel });
    }
  });

  it('keeps the window derived from the adjacent caps past the tuned table', () => {
    expect(levelWindowForMap(9)).toEqual({ minLevel: 55, maxLevel: 63 });
    expect(levelWindowForMap(14)).toEqual({ minLevel: 95, maxLevel: 100 });
    expect(levelWindowForMap(15)).toEqual({ minLevel: 100, maxLevel: 100 });
  });

  it('clamps a degenerate map index to map 1', () => {
    expect(levelWindowForMap(0)).toEqual(levelWindowForMap(1));
    expect(levelWindowForMap(-4)).toEqual(levelWindowForMap(1));
    expect(levelWindowForMap(1.9)).toEqual(levelWindowForMap(1));
    expect(levelWindowForMap(1).minLevel).toBe(LEVEL_BANDS[0].minLevel);
  });
});

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
          expect(position.minLevel).toBe(levelWindowForMap(mapIndex).minLevel);
          expect(position.maxLevel).toBe(levelWindowForMap(mapIndex).maxLevel);
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
    expect(deep.mapIndex).toBeGreaterThan(FINITE_MAPS);
    expect(deep.minLevel).toBeGreaterThanOrEqual(levelWindowForMap(FINITE_MAPS).maxLevel);
    expect(deep.minLevel).toBe(levelWindowForMap(deep.mapIndex).minLevel);
    expect(deep.maxLevel).toBe(levelWindowForMap(deep.mapIndex).maxLevel);
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

describe('band and cap', () => {
  it('reads a band whose ends are the floor window', () => {
    const expectedIds = [
      'early',
      'low',
      'mid',
      'high',
      'late',
      'end',
      'end',
      'end',
      'end',
      'end',
      'end',
      'end',
      'end',
    ];
    const indices = [...Array.from({ length: 12 }, (_, index) => index + 1), 10_000];
    indices.forEach((mapIndex, at) => {
      const window = levelWindowForMap(mapIndex);
      expect(bandForMap(mapIndex), `map ${mapIndex}`).toEqual({
        ...bandForLevel(window.minLevel),
        ...window,
      });
      expect(bandForMap(mapIndex).id, `map ${mapIndex}`).toBe(expectedIds[at]);
    });
  });

  it('caps a route at its map cap', () => {
    for (const seed of SEEDS) {
      const position = floorForRoute(seed, 1);
      expect(capForRoute(seed, 1)).toBe(position.maxLevel);
      expect(capForRoute(seed, 1)).toBe(levelWindowForMap(position.mapIndex).maxLevel);
    }
  });
});

describe('runBand', () => {
  it('carries the floor window with the archetype band the floor falls in', () => {
    const early = runBand('floor-a', 1);
    expect(early.id).toBe('early');
    expect(early.minLevel).toBe(levelWindowForMap(1).minLevel);
    expect(early.maxLevel).toBe(levelWindowForMap(1).maxLevel);

    expect(runBand('floor-a', 500).id).toBe('end');
  });
});

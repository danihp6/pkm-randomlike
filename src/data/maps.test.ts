import { describe, expect, it } from 'vitest';
import {
  FINITE_MAPS,
  MAP_MAX_LEVEL,
  MAP_MAX_ROOM_SIZE,
  MAP_MAX_ROUTES,
  MAP_MIN_ROOM_SIZE,
  MAP_TUNING,
  MAP_TUNING_STEP,
  ROOM_SHAPE_SIZES,
  levelCapForMap,
  levelRangeForMap,
  mapTuning,
  roomSizeForShape,
  routeCountRangeForMap,
  routeSizeRangeForMap,
  type MapShapeSizeId,
} from './maps';

describe('map tuning tables', () => {
  it('exposes the first map and its cap', () => {
    expect(levelRangeForMap(1)).toEqual({ minLevel: 2, maxLevel: 9 });
    expect(levelCapForMap(1)).toBe(9);
    expect(routeCountRangeForMap(1)).toEqual({ min: 6, max: 6 });
    expect(routeSizeRangeForMap(1)).toEqual({ min: 30, max: 30 });
  });

  it('exposes the last finite map and the campaign length', () => {
    expect(MAP_TUNING).toHaveLength(FINITE_MAPS);
    expect(levelRangeForMap(FINITE_MAPS)).toEqual({ minLevel: 49, maxLevel: 55 });
    expect(levelCapForMap(FINITE_MAPS)).toBe(55);
    expect(routeCountRangeForMap(FINITE_MAPS)).toEqual({ min: 6, max: 9 });
    expect(routeSizeRangeForMap(FINITE_MAPS)).toEqual({ min: 30, max: 56 });
  });

  it('returns the configured row for every tuned map', () => {
    for (const row of MAP_TUNING) {
      expect(mapTuning(row.mapIndex)).toBe(row);
    }
  });

  it('clamps a degenerate index to map 1', () => {
    expect(mapTuning(0)).toBe(MAP_TUNING[0]);
    expect(mapTuning(-4)).toBe(MAP_TUNING[0]);
    expect(mapTuning(1.9)).toBe(MAP_TUNING[0]);
  });

  it('never lowers the level floor, cap or size as maps advance', () => {
    let previous = levelRangeForMap(1);
    let previousSize = routeSizeRangeForMap(1);
    for (let mapIndex = 2; mapIndex <= 12; mapIndex++) {
      const levels = levelRangeForMap(mapIndex);
      const size = routeSizeRangeForMap(mapIndex);
      expect(levels.minLevel).toBeGreaterThanOrEqual(previous.minLevel);
      expect(levels.maxLevel).toBeGreaterThanOrEqual(previous.maxLevel);
      expect(size.min).toBeGreaterThanOrEqual(previousSize.min);
      expect(size.max).toBeGreaterThanOrEqual(previousSize.max);
      previous = levels;
      previousSize = size;
    }
  });

  it('keeps each map range contiguous with the one before', () => {
    for (let mapIndex = 2; mapIndex <= FINITE_MAPS; mapIndex++) {
      expect(levelRangeForMap(mapIndex).minLevel).toBe(levelRangeForMap(mapIndex - 1).maxLevel);
    }
  });

  it('climbs past the last tuned map for infinite mode', () => {
    const last = MAP_TUNING[MAP_TUNING.length - 1];
    const first = mapTuning(FINITE_MAPS + 1);
    expect(first.levels.minLevel).toBe(last.levels.maxLevel);
    expect(first.levels.maxLevel).toBe(last.levels.maxLevel + MAP_TUNING_STEP.levelStep);
    expect(first.size.min).toBe(last.size.min + MAP_TUNING_STEP.sizeStep);
    expect(first.size.max).toBe(Math.min(MAP_MAX_ROOM_SIZE, last.size.max + MAP_TUNING_STEP.sizeStep));
    expect(first.routes.min).toBe(last.routes.min + MAP_TUNING_STEP.routeStep);
    expect(first.routes.max).toBe(last.routes.max + MAP_TUNING_STEP.routeStep);
  });

  it('keeps both ends of an out-of-table map climbing, then saturates at the ceiling', () => {
    const last = MAP_TUNING[MAP_TUNING.length - 1];
    expect(last.mapIndex).toBe(FINITE_MAPS);
    expect(mapTuning(FINITE_MAPS + 1).levels).toEqual({
      minLevel: last.levels.maxLevel,
      maxLevel: last.levels.maxLevel + MAP_TUNING_STEP.levelStep,
    });
    expect(mapTuning(FINITE_MAPS + 2).levels).toEqual({
      minLevel: last.levels.maxLevel + MAP_TUNING_STEP.levelStep,
      maxLevel: last.levels.maxLevel + 2 * MAP_TUNING_STEP.levelStep,
    });
    // The floor climbs instead of only widening, so a deep map is a narrow ramp.
    for (
      let mapIndex = FINITE_MAPS + 2;
      mapTuning(mapIndex).levels.maxLevel < MAP_MAX_LEVEL;
      mapIndex++
    ) {
      const levels = levelRangeForMap(mapIndex);
      expect(levels.minLevel).toBeGreaterThan(levelRangeForMap(mapIndex - 1).minLevel);
      expect(levels.maxLevel - levels.minLevel).toBe(MAP_TUNING_STEP.levelStep);
    }
    expect(mapTuning(10_000).levels).toEqual({ minLevel: MAP_MAX_LEVEL, maxLevel: MAP_MAX_LEVEL });
  });

  it('caps the level ceiling for a very deep map', () => {
    const deep = mapTuning(10_000);
    expect(deep.levels.maxLevel).toBe(MAP_MAX_LEVEL);
    expect(deep.levels.minLevel).toBeLessThanOrEqual(MAP_MAX_LEVEL);
  });

  it('caps the room size for a very deep map', () => {
    const deep = routeSizeRangeForMap(10_000);
    expect(deep.max).toBe(MAP_MAX_ROOM_SIZE);
    expect(deep.min).toBeLessThanOrEqual(deep.max);
  });

  it('grows the room count with the map and caps it', () => {
    let previous = routeCountRangeForMap(1);
    for (let mapIndex = 2; mapIndex <= 30; mapIndex++) {
      const count = routeCountRangeForMap(mapIndex);
      expect(count.min).toBeGreaterThanOrEqual(previous.min);
      expect(count.max).toBeGreaterThanOrEqual(previous.max);
      expect(count.max).toBeLessThanOrEqual(MAP_MAX_ROUTES);
      previous = count;
    }
    const deep = routeCountRangeForMap(10_000);
    expect(deep).toEqual({ min: MAP_MAX_ROUTES, max: MAP_MAX_ROUTES });
    expect(routeCountRangeForMap(30).max).toBeGreaterThan(routeCountRangeForMap(1).max);
  });

  it('rolls a size range wide enough to vary but ordered', () => {
    for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
      const size = routeSizeRangeForMap(mapIndex);
      expect(size.min).toBeGreaterThan(0);
      expect(size.max).toBeGreaterThanOrEqual(size.min);
      const count = routeCountRangeForMap(mapIndex);
      expect(count.max).toBeGreaterThanOrEqual(count.min);
      expect(count.min).toBeGreaterThanOrEqual(1);
    }
  });
});

const SHAPE_IDS: readonly MapShapeSizeId[] = [
  'cross',
  'straight',
  'tee',
  'bend',
  'corridor',
  'dead-end',
];

describe('room sizes follow the room shape', () => {
  it('pins the frozen map-8 table verbatim', () => {
    expect(ROOM_SHAPE_SIZES).toEqual({
      cross: { width: 40, height: 40 },
      straight: { width: 40, height: 40 },
      tee: { width: 40, height: 48 },
      bend: { width: 44, height: 44 },
      corridor: { width: 52, height: 30 },
      'dead-end': { width: 30, height: 30 },
    });
    expect(MAP_MAX_ROOM_SIZE).toBe(56);
    expect(MAP_MIN_ROOM_SIZE).toBe(30);
  });

  it('returns the frozen table verbatim on map 8', () => {
    for (const shape of SHAPE_IDS) {
      expect(roomSizeForShape(shape, FINITE_MAPS), shape).toEqual(ROOM_SHAPE_SIZES[shape]);
    }
  });

  it('keeps every shape at the minimum on map 1', () => {
    for (const shape of SHAPE_IDS) {
      expect(roomSizeForShape(shape, 1), shape).toEqual({
        width: MAP_MIN_ROOM_SIZE,
        height: MAP_MIN_ROOM_SIZE,
      });
    }
  });

  it('scales both sides by the map ceiling, rounded', () => {
    expect(roomSizeForShape('corridor', 6)).toEqual({ width: 37, height: 30 });
    expect(roomSizeForShape('bend', 7)).toEqual({ width: 35, height: 35 });
    expect(roomSizeForShape('corridor', 7)).toEqual({ width: 41, height: 30 });
    expect(roomSizeForShape('tee', 6)).toEqual({ width: 30, height: 34 });
    expect(roomSizeForShape('cross', 7)).toEqual({ width: 31, height: 31 });
  });

  it('swaps only a north-south corridor', () => {
    expect(roomSizeForShape('corridor', FINITE_MAPS, 'ns')).toEqual({ width: 30, height: 52 });
    expect(roomSizeForShape('corridor', FINITE_MAPS, 'ew')).toEqual({ width: 52, height: 30 });
    expect(roomSizeForShape('bend', FINITE_MAPS, 'ns')).toEqual({ width: 44, height: 44 });
    expect(roomSizeForShape('corridor', 6, 'ns')).toEqual({ width: 30, height: 37 });
  });

  it('never lets a side leave [30, 56], and never shrinks as maps advance', () => {
    let previous = SHAPE_IDS.map((shape) => roomSizeForShape(shape, 1));
    for (const shape of SHAPE_IDS) {
      expect(roomSizeForShape(shape, 1).width).toBe(MAP_MIN_ROOM_SIZE);
      expect(roomSizeForShape(shape, 1).height).toBe(MAP_MIN_ROOM_SIZE);
    }
    for (let mapIndex = 1; mapIndex <= 40; mapIndex++) {
      const sizes = SHAPE_IDS.map((shape) => roomSizeForShape(shape, mapIndex));
      for (const [index, size] of sizes.entries()) {
        const label = `${SHAPE_IDS[index]} map ${mapIndex}`;
        for (const side of [size.width, size.height]) {
          expect(side, label).toBeGreaterThanOrEqual(MAP_MIN_ROOM_SIZE);
          expect(side, label).toBeLessThanOrEqual(MAP_MAX_ROOM_SIZE);
        }
        expect(size.width, label).toBeGreaterThanOrEqual(previous[index].width);
        expect(size.height, label).toBeGreaterThanOrEqual(previous[index].height);
      }
      previous = sizes;
    }
    expect(roomSizeForShape('corridor', 10_000)).toEqual(ROOM_SHAPE_SIZES.corridor);
  });
});

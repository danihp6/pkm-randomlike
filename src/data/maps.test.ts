import { describe, expect, it } from 'vitest';
import {
  MAP_MAX_LEVEL,
  MAP_MAX_ROOM_SIZE,
  MAP_MAX_ROUTES,
  MAP_TUNING,
  MAP_TUNING_STEP,
  levelCapForMap,
  levelRangeForMap,
  mapTuning,
  routeCountRangeForMap,
  routeSizeRangeForMap,
} from './maps';

describe('map tuning tables', () => {
  it('exposes the first map and its cap', () => {
    expect(levelRangeForMap(1)).toEqual({ minLevel: 2, maxLevel: 6 });
    expect(levelCapForMap(1)).toBe(6);
    expect(routeCountRangeForMap(1)).toEqual({ min: 5, max: 5 });
    expect(routeSizeRangeForMap(1)).toEqual({ min: 16, max: 20 });
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
    for (let mapIndex = 2; mapIndex <= 6; mapIndex++) {
      expect(levelRangeForMap(mapIndex).minLevel).toBe(levelRangeForMap(mapIndex - 1).maxLevel);
    }
  });

  it('steps past the last tuned map for infinite mode', () => {
    const last = MAP_TUNING[MAP_TUNING.length - 1];
    const extra = mapTuning(MAP_TUNING.length + 1);
    expect(extra.levels.minLevel).toBe(last.levels.maxLevel);
    expect(extra.levels.maxLevel).toBe(last.levels.maxLevel + MAP_TUNING_STEP.levelStep);
    expect(extra.size.min).toBe(last.size.min + MAP_TUNING_STEP.sizeStep);
    expect(extra.size.max).toBe(last.size.max + MAP_TUNING_STEP.sizeStep);
    expect(extra.routes.min).toBe(last.routes.min + MAP_TUNING_STEP.routeStep);
    expect(extra.routes.max).toBe(last.routes.max + MAP_TUNING_STEP.routeStep);
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

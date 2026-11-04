import { describe, expect, it } from 'vitest';
import { FINITE_MAPS } from '../../data/maps';
import { LEVEL_BANDS, bandForLevel } from '../../data/run';
import { bandForMap, levelWindowForMap, runBand } from './floors';

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

describe('bandForMap', () => {
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

import { describe, expect, it } from 'vitest';
import { MAP_SIZE_TIERS, branchCountForSize, mapSizeTier, terrainScaleForSize } from './mapSize';

describe('map size tiers', () => {
  it('keeps the default route in the base tier', () => {
    expect(mapSizeTier(20, 20).id).toBe('small');
    expect(terrainScaleForSize(20, 20)).toBe(1);
    expect(branchCountForSize(2, 20, 20)).toBe(2);
  });

  it('steps up at the tier boundaries', () => {
    expect(mapSizeTier(23, 23).id).toBe('small');
    expect(mapSizeTier(24, 24).id).toBe('medium');
    expect(mapSizeTier(39, 39).id).toBe('medium');
    expect(mapSizeTier(40, 40).id).toBe('large');
  });

  it('adds optional paths as the map grows', () => {
    expect(branchCountForSize(2, 24, 24)).toBe(3);
    expect(branchCountForSize(2, 40, 40)).toBe(4);
    expect(branchCountForSize(3, 40, 40)).toBe(5);
    expect(branchCountForSize(0, 128, 96)).toBe(0);
  });

  it('never drops below the first tier for a tiny or degenerate map', () => {
    expect(terrainScaleForSize(0, 0)).toBe(MAP_SIZE_TIERS[0].terrainScale);
    expect(branchCountForSize(2, 1, 1)).toBe(2);
  });

  it('is monotonic: a bigger map never scales down', () => {
    let previous = terrainScaleForSize(1, 1);
    for (let side = 1; side <= 96; side++) {
      const scale = terrainScaleForSize(side, side);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  it('scales in ranges, not per pixel', () => {
    // Two sizes inside a tier share the scale, so the count never moves between them.
    expect(terrainScaleForSize(24, 24)).toBe(terrainScaleForSize(30, 30));
    expect(terrainScaleForSize(40, 40)).toBe(terrainScaleForSize(128, 96));
  });
});

import { describe, expect, it } from 'vitest';
import { WORLD_GROUND_DEPTH, WORLD_OVERLAY_DEPTH, tilemapData } from './tilemapLayer';

describe('tilemapData', () => {
  it('copies one row of indices per map row', () => {
    const mesh = { width: 3, height: 2, frames: Int32Array.from([0, 5, -1, 9, 2, 44]) };
    const data = tilemapData(mesh);
    expect(data).toEqual([
      [0, 5, -1],
      [9, 2, 44],
    ]);
    data[0][0] = 99;
    expect(mesh.frames[0]).toBe(0);
  });

  it('keeps -1 as the empty cell', () => {
    const data = tilemapData({ width: 2, height: 1, frames: Int32Array.from([-1, 7]) });
    expect(data).toEqual([[-1, 7]]);
  });

  it('reads every index from frames[y * width + x]', () => {
    const width = 4;
    const height = 3;
    const frames = Int32Array.from({ length: width * height }, (_value, index) => index + 1);
    const data = tilemapData({ width, height, frames });
    expect(data).toHaveLength(height);
    for (let y = 0; y < height; y++) {
      expect(data[y]).toHaveLength(width);
      for (let x = 0; x < width; x++) expect(data[y][x]).toBe(frames[y * width + x]);
    }
  });

  it('answers no rows for an empty mesh', () => {
    expect(tilemapData({ width: 0, height: 0, frames: new Int32Array(0) })).toEqual([]);
    expect(tilemapData({ width: 4, height: 0, frames: new Int32Array(0) })).toEqual([]);
    expect(tilemapData({ width: 0, height: 3, frames: new Int32Array(0) })).toEqual([]);
  });
});

describe('world depths', () => {
  it('draws the underlay below the tiles', () => {
    expect(WORLD_GROUND_DEPTH).toBeLessThan(WORLD_OVERLAY_DEPTH);
  });
});

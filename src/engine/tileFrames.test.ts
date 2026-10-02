import { describe, expect, it } from 'vitest';
import { CHEST, FLOOR, WALL, type TileMap } from './map';
import {
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_WALL_CORNER_NE,
  FRAME_WALL_EDGE_N,
  FRAME_WALL_EDGE_W,
  FRAME_WALL_INTERIOR,
  WALL_SHAPES,
  type TilesetConfig,
  type WallPattern,
} from './tileset';
import { autotileFrame, isNearWall, patternFrame, resolveTileFrame, variantFrame } from './tileFrames';

const tileset: TilesetConfig = {
  atlas: { tileSize: 24, cols: 4, rows: 13, width: 96, height: 312 },
  frames: { [FLOOR]: FRAME_FLOOR, [WALL]: FRAME_WALL_INTERIOR, [CHEST]: FRAME_FLOOR },
  autotile: [{ value: WALL, openValue: FLOOR, variants: WALL_SHAPES }],
  variants: { [FLOOR]: [FRAME_FLOOR, FRAME_FLOOR_ALT_1, FRAME_FLOOR_ALT_2] },
  wallAdjacentVariants: { [FLOOR]: [FRAME_FLOOR_ALT_1, FRAME_FLOOR_ALT_2] },
};

const corridor: TileMap = [
  [WALL, WALL, WALL],
  [WALL, FLOOR, WALL],
  [WALL, WALL, WALL],
];

describe('autotileFrame', () => {
  it('gives a wall buried in other walls the interior frame', () => {
    const map: TileMap = [
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
    ];
    expect(autotileFrame(map, 1, 1, tileset.autotile![0])).toBe(WALL_SHAPES.interior);
  });

  it('treats any non-wall neighbour as open', () => {
    const map: TileMap = [
      [CHEST, CHEST, CHEST],
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
    ];
    expect(autotileFrame(map, 1, 1, tileset.autotile![0])).toBe(FRAME_WALL_EDGE_N);
  });

  it('opens a wall on its top side when the neighbour above is floor', () => {
    const map: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
    ];
    expect(autotileFrame(map, 1, 1, tileset.autotile![0])).toBe(FRAME_WALL_EDGE_N);
  });

  it('draws an isolated pillar when all four sides are open', () => {
    const map: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, WALL, FLOOR],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(autotileFrame(map, 1, 1, tileset.autotile![0])).toBe(WALL_SHAPES.cross);
  });

  it('picks the convex corner when the diagonal is open too', () => {
    const map: TileMap = [
      [FLOOR, FLOOR, WALL],
      [FLOOR, WALL, WALL],
      [WALL, WALL, WALL],
    ];
    expect(autotileFrame(map, 1, 1, tileset.autotile![0])).toBe(WALL_SHAPES.cornerNW);
  });

  it('handles the top-left ring corner of a closed room as a diagonal corner', () => {
    const frame = autotileFrame(corridor, 0, 0, tileset.autotile![0]);
    expect(frame).toBe(WALL_SHAPES.diagonalCornerSE);
  });

  it('never returns undefined for an isolated wall ring', () => {
    for (let y = 0; y < corridor.length; y++) {
      for (let x = 0; x < corridor[y].length; x++) {
        if (corridor[y][x] === WALL) {
          expect(typeof autotileFrame(corridor, x, y, tileset.autotile![0])).toBe('number');
        }
      }
    }
  });
});

describe('patternFrame', () => {
  const pattern: WallPattern = {
    value: WALL,
    cols: 3,
    rows: [
      [7, 8, 9],
      [10, 11, 12],
      [13, 14, 15],
      [16, 17, 18],
      [19, 20, 21],
    ],
  };
  const column: TileMap = [[WALL], [WALL], [WALL], [WALL], [WALL]];

  it('anchors the top row to the mass top and the last row to its base', () => {
    expect(patternFrame(column, 0, 0, pattern)).toBe(8);
    expect(patternFrame(column, 0, 4, pattern)).toBe(20);
  });

  it('runs the two body rows, then a crown over the trunk every three tiles', () => {
    const interior = [
      patternFrame(column, 0, 1, pattern),
      patternFrame(column, 0, 2, pattern),
      patternFrame(column, 0, 3, pattern),
    ];
    expect(interior).toEqual([14, 17, 11]);
  });

  it('centres a one-tile wall on the pattern middle column', () => {
    expect(patternFrame([[FLOOR, WALL, FLOOR]], 1, 0, pattern)).toBe(8);
  });

  it('steps across columns on a wall wider than the pattern', () => {
    const wide: TileMap = [[WALL, WALL, WALL, WALL, WALL]];
    expect([0, 1, 2, 3, 4].map((x) => patternFrame(wide, x, 0, pattern))).toEqual([7, 8, 9, 7, 8]);
  });
});

describe('variantFrame', () => {
  it('is deterministic for a position and stays inside the option list', () => {
    const options = [1, 2, 3];
    const first = variantFrame(4, 9, options);
    expect(variantFrame(4, 9, options)).toBe(first);
    expect(options).toContain(first);
  });
});

describe('isNearWall', () => {
  it('detects a cardinal wall neighbour only', () => {
    expect(isNearWall(corridor, 1, 1)).toBe(true);
    expect(isNearWall([[FLOOR, FLOOR]], 0, 0)).toBe(false);
  });
});

describe('resolveTileFrame', () => {
  it('reads a common-atlas frame when the tileset declares one', () => {
    const withCommon: TilesetConfig = { ...tileset, commonFrames: { [CHEST]: 2 } };
    expect(resolveTileFrame([[CHEST]], 0, 0, withCommon)).toEqual({ source: 'common', frame: 2 });
  });

  it('prefers an autotile rule over the flat frame', () => {
    expect(resolveTileFrame(corridor, 0, 0, tileset)?.frame).toBe(WALL_SHAPES.diagonalCornerSE);
  });

  it('picks a variant from the tile list, and the wall-adjacent list next to a wall', () => {
    const open: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(tileset.variants![FLOOR]).toContain(resolveTileFrame(open, 1, 0, tileset)?.frame);
    expect(tileset.wallAdjacentVariants![FLOOR]).toContain(resolveTileFrame(corridor, 1, 1, tileset)?.frame);
  });

  it('returns null outside the map', () => {
    expect(resolveTileFrame(corridor, -1, 0, tileset)).toBeNull();
  });

  it('falls back to the flat frame for a value with no rule', () => {
    expect(resolveTileFrame([[WALL]], 0, 0, tileset)?.frame).toBe(FRAME_WALL_INTERIOR);
  });

  it('exposes FRAME_WALL_CORNER_NE through the shape set it belongs to', () => {
    expect(WALL_SHAPES.cornerNE).toBe(FRAME_WALL_CORNER_NE);
    expect(WALL_SHAPES.edgeW).toBe(FRAME_WALL_EDGE_W);
  });
});

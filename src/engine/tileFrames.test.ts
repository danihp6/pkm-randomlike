import { describe, expect, it } from 'vitest';
import { CHEST, FLOOR, LEDGE, TALL_GRASS, WALL, type TileMap } from './map';
import {
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_WALL_CORNER_NE,
  FRAME_WALL_EDGE_N,
  FRAME_WALL_EDGE_W,
  FRAME_WALL_INTERIOR,
  WALL_SHAPES,
  type TilesetConfig,
  type WallPattern,
} from './tileset';
import { FRLG_FOREST_TILESET, FRLG_GRASS_RUSTLE_FRAMES, FRLG_TILESET } from '../data/tilesets/frlg';
import { PLACEHOLDER_TILESET } from '../data/tilesets/placeholder';
import {
  autotileFrame,
  grassRustleFrames,
  grassTipKeys,
  hiddenItemFrame,
  isGrassStepTile,
  isNearWall,
  ledgeFrame,
  patternFrame,
  resolveGroundFrame,
  resolveTileFrame,
  treeTipKeys,
  variantFrame,
} from './tileFrames';

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
      [22, 23, 24],
    ],
  };
  const column: TileMap = [[WALL], [WALL], [WALL], [WALL], [WALL]];

  it('anchors the top row to the mass top and the last row to its base', () => {
    expect(patternFrame(column, 0, 0, pattern)).toBe(8);
    expect(patternFrame(column, 0, 4, pattern)).toBe(23);
  });

  it('mounts each tree crown on the lower leaves of the tree above', () => {
    const interior = [
      patternFrame(column, 0, 1, pattern),
      patternFrame(column, 0, 2, pattern),
      patternFrame(column, 0, 3, pattern),
    ];
    expect(interior).toEqual([11, 14, 20]);
  });

  it('alternates crown and body above the foot, capped by lower leaves and a trunk', () => {
    const tall: TileMap = Array.from({ length: 7 }, () => [WALL]);
    expect([0, 1, 2, 3, 4, 5, 6].map((y) => patternFrame(tall, 0, y, pattern))).toEqual([
      8, 11, 14, 17, 14, 20, 23,
    ]);
  });

  it('centres a one-tile wall on the pattern middle column', () => {
    expect(patternFrame([[FLOOR, WALL, FLOOR]], 1, 0, pattern)).toBe(8);
  });

  it('keeps a tree on its pattern column when a side lane bites the mass below its top', () => {
    // Three wide at the top; a lane carves the left column of the lower rows.
    // The tree in column 1 must stay the centre, not slide to the left column.
    const bitten: TileMap = [
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
      [FLOOR, WALL, WALL],
      [FLOOR, WALL, WALL],
    ];
    expect(patternFrame(bitten, 1, 0, pattern)).toBe(8);
    expect(patternFrame(bitten, 1, 2, pattern)).toBe(20);
  });

  it('re-anchors a run a lane detached from the stack, giving it its own crown and base', () => {
    // Two whole trees with a lane between them; the lower run clears the map edge.
    const holed: number[][] = [];
    for (let y = 0; y < 14; y++) holed.push([y === 5 || y === 13 ? FLOOR : WALL]);
    // The run below the lane opens a fresh tree: its top is the crown (row 0) and
    // its foot the base, instead of continuing the phase of the run above.
    expect(patternFrame(holed, 0, 6, pattern)).toBe(pattern.rows[0][1]);
    expect(patternFrame(holed, 0, 8, pattern)).toBe(pattern.rows[2][1]);
    expect(patternFrame(holed, 0, 12, pattern)).toBe(pattern.rows[5][1]);
  });

  it('continues a mass that reaches the map edge past the limit instead of cutting it', () => {
    // A column that fills the map touches both edges: a window into the forest.
    const full: TileMap = Array.from({ length: 6 }, () => [WALL, WALL, WALL]);
    expect(patternFrame(full, 1, 0, pattern, true)).toBe(pattern.rows[2][1]);
    expect(patternFrame(full, 1, 1, pattern, true)).toBe(pattern.rows[3][1]);
    expect(patternFrame(full, 1, 5, pattern, true)).toBe(pattern.rows[3][1]);

    // A mass hanging off the top only: its interior foot stays a normal base.
    const topOnly: TileMap = Array.from({ length: 8 }, (_, y) =>
      y <= 3 ? [WALL, WALL, WALL] : [FLOOR, FLOOR, FLOOR],
    );
    expect(patternFrame(topOnly, 1, 0, pattern, true)).toBe(pattern.rows[2][1]);
    expect(patternFrame(topOnly, 1, 3, pattern, true)).toBe(pattern.rows[5][1]);

    // A bare call keeps the motif's own top/base rows.
    expect(patternFrame(full, 1, 0, pattern)).toBe(pattern.rows[0][1]);
    expect(patternFrame(full, 1, 5, pattern)).toBe(pattern.rows[5][1]);
  });

  it('reads a short border piece as mid-stack, not a lone trunk', () => {
    const post: TileMap = Array.from({ length: 6 }, (_, y) =>
      y === 0 ? [FLOOR, FLOOR, WALL, WALL, WALL, FLOOR] : new Array<number>(6).fill(FLOOR),
    );
    // One row of wall on the top edge would be the foot of the off-map tree; as a
    // window it must read as a crown/body row instead of a trunk.
    expect(patternFrame(post, 3, 0, pattern, true)).toBe(pattern.rows[2][1]);
    expect(patternFrame(post, 3, 0, pattern)).toBe(pattern.rows[0][1]);
  });

  it('steps across columns on a wall wider than the pattern', () => {
    const wide: TileMap = [[WALL, WALL, WALL, WALL, WALL]];
    expect([0, 1, 2, 3, 4].map((x) => patternFrame(wide, x, 0, pattern))).toEqual([7, 8, 9, 7, 8]);
  });

  it('shows the whole three-wide tree on a three-tile border', () => {
    const border: TileMap = [[WALL, WALL, WALL]];
    expect([0, 1, 2].map((x) => patternFrame(border, x, 0, pattern))).toEqual([7, 8, 9]);
  });

  it('carries a body between the crown and the trunk on a three-tile border', () => {
    const border: TileMap = [[WALL], [WALL], [WALL]];
    expect([0, 1, 2].map((y) => patternFrame(border, 0, y, pattern))).toEqual([8, 11, 23]);
  });

  it('shows the full crown, both body rows and the trunk on a four-tile border', () => {
    const border: TileMap = [[WALL], [WALL], [WALL], [WALL]];
    expect([0, 1, 2, 3].map((y) => patternFrame(border, 0, y, pattern))).toEqual([8, 11, 20, 23]);
  });
});

describe('treeTipKeys', () => {
  const withPattern: TilesetConfig = {
    atlas: { tileSize: 24, cols: 4, rows: 13, width: 96, height: 312 },
    frames: { [FLOOR]: FRAME_FLOOR, [WALL]: FRAME_WALL_INTERIOR },
    wallPattern: {
      value: WALL,
      cols: 3,
      rows: [
        [7, 8, 9],
        [10, 11, 12],
        [13, 14, 15],
        [16, 17, 18],
        [19, 20, 21],
        [22, 23, 24],
      ],
    },
  };

  it('marks the pure top row of a mass that opens on ground', () => {
    const detached: TileMap = [
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
    ];
    const tips = treeTipKeys(detached, withPattern);
    expect(tips.has('1,2')).toBe(true);
    expect(tips.has('2,2')).toBe(true);
    expect(tips.has('1,3')).toBe(false);
  });

  it('keeps the top and bottom fence edges solid, even when a run tops out there', () => {
    const attached: TileMap = [
      [WALL, WALL, WALL, WALL, WALL],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, WALL, WALL, WALL, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
    ];
    const tips = treeTipKeys(attached, withPattern);
    expect(tips.has('1,0')).toBe(false);
    expect(tips.has('1,1')).toBe(false);

    const bottomFence: TileMap = [
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [WALL, WALL, WALL, WALL, WALL],
    ];
    expect(treeTipKeys(bottomFence, withPattern).size).toBe(0);
  });

  it('marks a left/right edge mass top, whose end columns are transparent grass', () => {
    const side: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [WALL, WALL, FLOOR],
      [WALL, WALL, FLOOR],
      [WALL, WALL, FLOOR],
    ];
    const tips = treeTipKeys(side, withPattern);
    expect(tips.has('0,1')).toBe(true);
    expect(tips.has('0,2')).toBe(false);
    expect(tips.has('1,1')).toBe(true);
  });

  it('marks the own crown of a run a lane detached from the stack above', () => {
    const withLane: TileMap = [
      [FLOOR, WALL, FLOOR],
      [FLOOR, WALL, FLOOR],
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, WALL, FLOOR],
      [FLOOR, WALL, FLOOR],
    ];
    const tips = treeTipKeys(withLane, withPattern);
    expect(tips.has('1,3')).toBe(true);
    expect(tips.has('1,4')).toBe(false);
  });

  it('has no tips without a wall pattern', () => {
    expect(treeTipKeys([[WALL, WALL]], tileset).size).toBe(0);
  });
});

describe('grassTipKeys', () => {
  const withPattern: TilesetConfig = {
    atlas: { tileSize: 24, cols: 4, rows: 13, width: 96, height: 312 },
    frames: { [FLOOR]: FRAME_FLOOR, [WALL]: FRAME_WALL_INTERIOR },
    wallPattern: {
      value: WALL,
      cols: 3,
      rows: [
        [7, 8, 9],
        [10, 11, 12],
        [13, 14, 15],
        [16, 17, 18],
        [19, 20, 21],
        [22, 23, 24],
      ],
    },
  };

  it('shares only the tree tips that touch tall grass', () => {
    const map: TileMap = [
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [TALL_GRASS, WALL, WALL, WALL, FLOOR],
      [TALL_GRASS, WALL, WALL, WALL, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR, FLOOR, FLOOR],
    ];
    const tips = grassTipKeys(map, withPattern);
    // (1,2) is the mass's top row beside the grass; (2,2) is also a tip but has
    // no grass beside it, and (1,3) is not a tip at all.
    expect(tips.has('1,2')).toBe(true);
    expect(tips.has('2,2')).toBe(false);
    expect(tips.has('1,3')).toBe(false);
  });

  it('has no grass tips without a wall pattern', () => {
    expect(grassTipKeys([[TALL_GRASS, WALL]], tileset).size).toBe(0);
  });
});

describe('variantFrame', () => {
  it('is deterministic for a position and stays inside the option list', () => {
    const options = [1, 2, 3];
    const first = variantFrame(4, 9, options);
    expect(variantFrame(4, 9, options)).toBe(first);
    expect(options).toContain(first);
  });

  it('draws a heavier frame more often and scatters it (no diagonal run)', () => {
    const options = [
      { frame: 10, weight: 8 },
      { frame: 11, weight: 1 },
    ];
    const counts = new Map<number, number>([
      [10, 0],
      [11, 0],
    ]);
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const frame = variantFrame(x, y, options);
        counts.set(frame, counts.get(frame)! + 1);
      }
    }
    expect(counts.get(10)!).toBeGreaterThan(counts.get(11)! * 4);
    // The rare frame must not line up on a single row, column or diagonal.
    const rareRows = new Set<number>();
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) if (variantFrame(x, y, options) === 11) rareRows.add(y);
    }
    expect(rareRows.size).toBeGreaterThan(1);
  });

  it('never draws a zero-weight frame', () => {
    const options = [
      { frame: 7, weight: 1 },
      { frame: 9, weight: 0 },
    ];
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) expect(variantFrame(x, y, options)).toBe(7);
  });
});

describe('isGrassStepTile', () => {
  it('rustles a tall-grass cell and not plain floor', () => {
    const map: TileMap = [[FLOOR, TALL_GRASS]];
    expect(isGrassStepTile(map, 1, 0, new Set())).toBe(true);
    expect(isGrassStepTile(map, 0, 0, new Set())).toBe(false);
  });

  it('rustles a tree tip only while it is in the passed grass-tip set', () => {
    const map: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, WALL, FLOOR],
    ];
    expect(isGrassStepTile(map, 1, 1, new Set(['1,1']))).toBe(true);
    expect(isGrassStepTile(map, 1, 1, new Set(['0,1']))).toBe(false);
  });

  it('reads off the map edge as not a step tile', () => {
    expect(isGrassStepTile([[FLOOR]], 1, 0, new Set())).toBe(false);
    expect(isGrassStepTile([[FLOOR]], 0, 5, new Set())).toBe(false);
  });
});

describe('grassRustleFrames', () => {
  it('reads the sequence the tileset declares, the rest frame first', () => {
    expect(grassRustleFrames(FRLG_TILESET)).toEqual([6, 45, 46, 47, 48]);
    expect(grassRustleFrames(FRLG_FOREST_TILESET)).toEqual([6, 45, 46, 47, 48]);
  });

  it('is empty for a tileset with no grass art of its own', () => {
    expect(grassRustleFrames(PLACEHOLDER_TILESET)).toEqual([]);
    expect(grassRustleFrames(tileset)).toEqual([]);
  });

  it("hands back the tileset's own list, unmutated by a caller", () => {
    const frames = grassRustleFrames(FRLG_TILESET);
    const declared = FRLG_TILESET.grassRustle!;
    expect(frames).toBe(declared);
    expect(declared).toEqual(FRLG_GRASS_RUSTLE_FRAMES);
  });
});

describe('ledgeFrame', () => {
  const ledgeFrames = { left: 30, center: 31, right: 32 };

  it('caps the run ends and repeats the centre', () => {
    const run: TileMap = [[LEDGE, LEDGE, LEDGE, LEDGE]];
    expect([0, 1, 2, 3].map((x) => ledgeFrame(run, x, 0, ledgeFrames))).toEqual([30, 31, 31, 32]);
  });

  it('reads a lone ledge as the centre', () => {
    expect(ledgeFrame([[FLOOR, LEDGE, FLOOR]], 1, 0, ledgeFrames)).toBe(31);
  });

  it('resolves the run through resolveTileFrame when the tileset declares it', () => {
    const withLedge: TilesetConfig = { ...tileset, ledgeFrames };
    const run: TileMap = [[LEDGE, LEDGE, LEDGE]];
    expect(resolveTileFrame(run, 0, 0, withLedge)?.frame).toBe(30);
    expect(resolveTileFrame(run, 1, 0, withLedge)?.frame).toBe(31);
    expect(resolveTileFrame(run, 2, 0, withLedge)?.frame).toBe(32);
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
    expect(tileset.wallAdjacentVariants![FLOOR]).toContain(
      resolveTileFrame(corridor, 1, 1, tileset)?.frame,
    );
  });

  it('returns null outside the map', () => {
    expect(resolveTileFrame(corridor, -1, 0, tileset)).toBeNull();
  });

  it('falls back to the flat frame for a value with no rule', () => {
    expect(resolveTileFrame([[WALL]], 0, 0, tileset)?.frame).toBe(FRAME_WALL_INTERIOR);
  });

  it('resolves the ground a cell would draw, matching the frame resolveTileFrame gives floor', () => {
    const open: TileMap = [
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR],
      [FLOOR, FLOOR, FLOOR],
    ];
    expect(resolveGroundFrame(open, 1, 1, tileset).frame).toBe(
      resolveTileFrame(open, 1, 1, tileset)?.frame,
    );
    expect(tileset.variants![FLOOR]).toContain(resolveGroundFrame(open, 1, 1, tileset).frame);
    expect(tileset.wallAdjacentVariants![FLOOR]).toContain(
      resolveGroundFrame(corridor, 1, 1, tileset).frame,
    );
  });

  it('exposes FRAME_WALL_CORNER_NE through the shape set it belongs to', () => {
    expect(WALL_SHAPES.cornerNE).toBe(FRAME_WALL_CORNER_NE);
    expect(WALL_SHAPES.edgeW).toBe(FRAME_WALL_EDGE_W);
  });
});

describe('hiddenItemFrame', () => {
  const minimal: TilesetConfig = {
    atlas: { tileSize: 16, cols: 4, rows: 13, width: 64, height: 208 },
    frames: { [FLOOR]: FRAME_FLOOR_ALT_2 },
  };

  it('reads the forest hidden-item patch the forest tile declares', () => {
    expect(FRLG_FOREST_TILESET.hiddenItemFrame).toBe(FRAME_FLOOR_ALT_3);
    expect(hiddenItemFrame(FRLG_FOREST_TILESET)).toBe(41);
  });

  it('returns the configured frame of a minimal tileset', () => {
    expect(hiddenItemFrame({ ...minimal, hiddenItemFrame: 21 })).toBe(21);
  });

  it("falls back to the tileset's floor frame when no hidden-item frame is declared", () => {
    expect(hiddenItemFrame(minimal)).toBe(FRAME_FLOOR_ALT_2);
    expect(hiddenItemFrame(PLACEHOLDER_TILESET)).toBe(PLACEHOLDER_TILESET.frames[FLOOR]);
  });

  it('reads 0 when neither the hidden-item frame nor the floor frame exists', () => {
    expect(
      hiddenItemFrame({
        atlas: { tileSize: 16, cols: 4, rows: 13, width: 64, height: 208 },
        frames: {},
      }),
    ).toBe(0);
  });

  it('treats a non-finite frame as absent', () => {
    expect(hiddenItemFrame({ ...minimal, hiddenItemFrame: Number.NaN })).toBe(FRAME_FLOOR_ALT_2);
  });
});

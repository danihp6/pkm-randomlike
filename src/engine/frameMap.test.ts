import { describe, expect, it } from 'vitest';
import { FLOOR, WALL } from './map';
import {
  buildFrameMap,
  frameMapTiles,
  parseFrameMapExport,
  routeFromFrameMapExport,
  serializeFrameMap,
  type FrameMapExport,
} from './frameMap';
import type { RouteMap } from './routes/routeMap';
import type { TilesetConfig, WallPattern } from './tileset';

const PATTERN: WallPattern = {
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

const TILESET: TilesetConfig = {
  atlas: { tileSize: 16, cols: 4, rows: 13, width: 64, height: 208 },
  frames: { [FLOOR]: 0, [WALL]: 11 },
  wallPattern: PATTERN,
};

function blank(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(FLOOR));
}

function fillRect(tiles: number[][], x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tiles[y + j][x + i] = WALL;
}

const cell = (frameMap: ReturnType<typeof buildFrameMap>, x: number, y: number) =>
  frameMap.cells[y * frameMap.width + x];

describe('buildFrameMap', () => {
  it('groups a whole wall mass into one tree and resolves its motif cells', () => {
    const tiles = blank(10, 10);
    fillRect(tiles, 2, 2, 3, 4); // one whole tree
    const frameMap = buildFrameMap(tiles, TILESET);
    expect(frameMap.cols).toBe(3);
    expect(frameMap.rows).toBe(6);
    expect(frameMap.cells).toHaveLength(100);

    const ids = new Set<string>();
    for (let y = 2; y <= 5; y++) {
      for (let x = 2; x <= 4; x++) {
        const info = cell(frameMap, x, y);
        expect(info.tile).toBe(WALL);
        expect(info.frame).not.toBeNull();
        expect(info.mass).toBe(0);
        expect(info.tree).not.toBeNull();
        expect(info.row).not.toBeNull();
        expect(info.col).not.toBeNull();
        ids.add(info.tree!);
      }
    }
    expect(ids.size).toBe(1);
    const tree = frameMap.trees.find((entry) => entry.id === [...ids][0])!;
    expect(tree.whole).toBe(true);
    expect(tree.solid).toBe(true);
    expect(tree.cells).toHaveLength(12);
    expect(tree.band).toBe(2);
  });

  it('flags a bitten tree and keeps its cells listed', () => {
    const tiles = blank(10, 10);
    fillRect(tiles, 2, 2, 3, 4);
    tiles[4][2] = FLOOR; // a lane bit the left column
    const frameMap = buildFrameMap(tiles, TILESET);
    const tree = frameMap.trees[0];
    expect(tree.whole).toBe(false);
    expect(tree.cells).toHaveLength(11);
    expect(tree.cells).not.toContainEqual([2, 4]);
  });

  it('leaves non-wall cells without pattern membership but with their frame', () => {
    const tiles = blank(6, 6);
    fillRect(tiles, 1, 1, 3, 4);
    const frameMap = buildFrameMap(tiles, TILESET);
    const floor = cell(frameMap, 5, 5);
    expect(floor.tile).toBe(FLOOR);
    expect(floor.frame).toBe(0);
    expect(floor.mass).toBeNull();
    expect(floor.tree).toBeNull();
    expect(floor.row).toBeNull();
    expect(floor.col).toBeNull();
  });
});

function routeWith(tiles: number[][]): RouteMap {
  return {
    seed: 'framemap-seed',
    routeIndex: 2,
    biomeId: 'forest',
    shape: 'straight',
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    entry: { x: 1, y: 1 },
    exits: [{ x: 8, y: 1 }],
    spine: [],
    branches: [],
    pockets: [],
    items: [],
    trainers: [],
  };
}

describe('frame map export', () => {
  it('round-trips a route through serialize and parse', () => {
    const tiles = blank(10, 10);
    fillRect(tiles, 2, 2, 3, 4);
    const route = routeWith(tiles);
    const exported = serializeFrameMap(route, TILESET);
    const parsed = parseFrameMapExport(JSON.stringify(exported));
    expect(parsed.kind).toBe('pkmr-framemap');
    expect(parsed.seed).toBe('framemap-seed');
    expect(parsed.shape).toBe('straight');
    const rebuilt = routeFromFrameMapExport(parsed);
    expect(rebuilt.tiles).toEqual(tiles);
    expect(rebuilt.entry).toEqual({ x: 1, y: 1 });
    expect(rebuilt.exits).toEqual([{ x: 8, y: 1 }]);
  });

  it('rebuilds the exact tile grid from the cells', () => {
    const tiles = blank(8, 8);
    fillRect(tiles, 0, 0, 8, 1);
    fillRect(tiles, 3, 1, 2, 5);
    const frameMap = buildFrameMap(tiles, TILESET);
    expect(frameMapTiles(frameMap)).toEqual(tiles);
  });

  it('rejects garbage, wrong versions and a mismatched cell count', () => {
    expect(() => parseFrameMapExport('not json')).toThrow('not valid JSON');
    expect(() => parseFrameMapExport('{"kind":"other"}')).toThrow('not a frame map export');
    const exported = serializeFrameMap(routeWith(blank(4, 4)), TILESET);
    const broken: FrameMapExport = {
      ...exported,
      frameMap: { ...exported.frameMap, cells: exported.frameMap.cells.slice(1) },
    };
    expect(() => parseFrameMapExport(JSON.stringify(broken))).toThrow(
      'cell count does not match the size',
    );
  });
});

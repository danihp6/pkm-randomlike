import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, isWalkable } from '../map';
import { buildFrameMap } from '../frameMap';
import { FRLG_TILESET } from '../../data/tilesets/frlg';
import { treeTipKeys } from '../tileFrames';
import { ROUTE_SHAPES } from './layout';
import { tileKey } from './routeMap';
import { sketchRoute, type RouteRequest } from './sketch';
import { DEFAULT_WALL_FOOTPRINT, wholeRunHeight, type WallFootprint } from './walls';
import { cleanWalls } from './walls';
import { validateRoute } from './validate';

function blank(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(FLOOR));
}

function fillRect(tiles: number[][], x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) tiles[y + j][x + i] = WALL;
}

/** Interior wall runs a motif would draw cut off: thinner than `cols` or not whole-tree tall. */
function wallViolations(tiles: readonly (readonly number[])[], footprint: WallFootprint): string[] {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  const ring = (x: number, y: number): boolean => x === 0 || x === width - 1 || y === 0 || y === height - 1;
  const bad: string[] = [];

  for (let y = 1; y < height - 1; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const wall = x < width && tiles[y][x] === WALL;
      if (wall && start < 0) start = x;
      else if (!wall && start >= 0) {
        if (!ring(start, y) && !ring(x - 1, y) && x - start < footprint.cols) {
          bad.push(`row ${y} ${start}-${x - 1} w${x - start}`);
        }
        start = -1;
      }
    }
  }
  for (let x = 1; x < width - 1; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const wall = y < height && tiles[y][x] === WALL;
      if (wall && start < 0) start = y;
      else if (!wall && start >= 0) {
        if (!ring(x, start) && !ring(x, y - 1)) {
          const h = y - start;
          if (wholeRunHeight(h, footprint.minHeight) !== h) bad.push(`col ${x} ${start}-${y - 1} h${h}`);
        }
        start = -1;
      }
    }
  }
  return bad;
}

const at = (tiles: readonly (readonly number[])[], x: number, y: number): number => tiles[y][x];
const FOOT: WallFootprint = { cols: 3, minHeight: 4 };

describe('wholeRunHeight', () => {
  it('keeps even runs of at least one object and rounds anything else down', () => {
    expect(wholeRunHeight(0, FOOT.minHeight)).toBe(0);
    expect(wholeRunHeight(3, FOOT.minHeight)).toBe(0);
    expect(wholeRunHeight(4, FOOT.minHeight)).toBe(4);
    expect(wholeRunHeight(5, FOOT.minHeight)).toBe(4);
    expect(wholeRunHeight(9, FOOT.minHeight)).toBe(8);
  });
});

describe('cleanWalls', () => {
  it('removes a one or two tile interior wall instead of drawing a cut-off object', () => {
    const thin = blank(8, 8);
    fillRect(thin, 3, 2, 1, 5); // one wide, interior
    fillRect(thin, 5, 2, 2, 5); // two wide, interior
    cleanWalls(thin, FOOT);
    expect(wallViolations(thin, FOOT)).toEqual([]);
    for (let y = 2; y <= 6; y++) {
      expect(at(thin, 3, y), `3,${y}`).toBe(FLOOR);
      expect(at(thin, 5, y), `5,${y}`).toBe(FLOOR);
      expect(at(thin, 6, y), `6,${y}`).toBe(FLOOR);
    }
  });

  it('trims an odd whole-width interior wall down to whole objects', () => {
    const tiles = blank(8, 8);
    fillRect(tiles, 3, 2, 3, 5); // three wide (a whole object wide), five tall
    cleanWalls(tiles, FOOT);
    expect(wallViolations(tiles, FOOT)).toEqual([]);
    expect(at(tiles, 3, 2)).toBe(WALL);
    expect(at(tiles, 4, 5)).toBe(WALL);
    expect(at(tiles, 4, 6)).toBe(FLOOR);
  });

  it('leaves the border ring alone while removing a thin notch against it', () => {
    const tiles = blank(8, 8);
    fillRect(tiles, 0, 0, 8, 1); // the top ring row
    fillRect(tiles, 3, 1, 1, 5); // a one-tile notch hanging off it
    cleanWalls(tiles, FOOT);
    for (let x = 0; x < 8; x++) expect(at(tiles, x, 0), `ring ${x}`).toBe(WALL);
    for (let y = 1; y <= 5; y++) expect(at(tiles, 3, y), `notch ${y}`).toBe(FLOOR);
  });

  it('removes a tree a lane bit on the side, and keeps the whole tree beside it', () => {
    const tiles = blank(12, 8);
    fillRect(tiles, 3, 2, 6, 4); // two whole trees side by side, cols 3-8
    tiles[4][3] = FLOOR; // a lane bites the left column of the left tree
    tiles[5][3] = FLOOR;
    cleanWalls(tiles, FOOT);
    expect(wallViolations(tiles, FOOT)).toEqual([]);
    for (let y = 2; y <= 5; y++) {
      for (let x = 3; x <= 5; x++) expect(at(tiles, x, y), `bitten ${x},${y}`).toBe(FLOOR);
      for (let x = 6; x <= 8; x++) expect(at(tiles, x, y), `whole ${x},${y}`).toBe(WALL);
    }
  });

  it('drops the stubs left above a bitten tree instead of half-stacking them', () => {
    const tiles = blank(8, 12);
    fillRect(tiles, 3, 2, 3, 8); // a three-tall stack of whole trees
    tiles[4][3] = FLOOR; // the middle tree loses a column, so it is bitten
    tiles[5][3] = FLOOR;
    cleanWalls(tiles, FOOT);
    expect(wallViolations(tiles, FOOT)).toEqual([]);
    for (let y = 2; y <= 5; y++) {
      for (let x = 3; x <= 5; x++) expect(at(tiles, x, y), `bitten ${x},${y}`).toBe(FLOOR);
    }
    for (let y = 6; y <= 9; y++) {
      for (let x = 3; x <= 5; x++) expect(at(tiles, x, y), `kept ${x},${y}`).toBe(WALL);
    }
  });

  it('extends an opening over a border nub but never opens a fence on its own', () => {
    // A solid ring, a wall band (cols 1-2) above the opening, an opening at
    // (0,2) with the lane beside it, and one bitten row (3) below.
    const build = (opening: boolean): number[][] => {
      const tiles = blank(8, 8);
      fillRect(tiles, 0, 0, 8, 1); // top ring
      fillRect(tiles, 0, 7, 8, 1); // bottom ring
      fillRect(tiles, 0, 0, 1, 8); // left ring
      fillRect(tiles, 7, 0, 1, 8); // right ring
      fillRect(tiles, 1, 0, 2, 7); // the wall band, cols 1-2
      tiles[2][1] = FLOOR; // the lane leaves the opening
      tiles[2][2] = FLOOR;
      tiles[3][1] = FLOOR; // the band is bitten at row 3
      tiles[3][2] = FLOOR;
      if (opening) tiles[2][0] = FLOOR; // the opening punches the ring at (0,2)
      return tiles;
    };

    const withOpening = build(true);
    cleanWalls(withOpening, FOOT);
    expect(at(withOpening, 0, 3), 'nub under the opening').toBe(FLOOR);
    expect(at(withOpening, 0, 4), 'fence below the nub').toBe(WALL);

    const noOpening = build(false);
    cleanWalls(noOpening, FOOT);
    expect(at(noOpening, 0, 3), 'bitten band away from an opening').toBe(WALL);
  });
});

function routeRequest(seed: string, routeIndex: number): RouteRequest {
  return { seed, routeIndex, biomeId: 'forest', layout: 'forest', wall: DEFAULT_WALL_FOOTPRINT };
}

describe('route wall cleanup (via sketchRoute)', () => {
  it('leaves no wall that would draw as a cut-off object', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['wall-a', 'wall-b', 'wall-c', 'wall-d']) {
        const route = sketchRoute({ ...routeRequest(seed, 2), shape });
        expect(wallViolations(route.tiles, DEFAULT_WALL_FOOTPRINT), `${shape} ${seed}`).toEqual([]);
      }
    }
  });

  it('never leaves a bitten tree, the border ring included', () => {
    for (const shape of ROUTE_SHAPES) {
      for (let index = 1; index <= 12; index++) {
        for (const seed of ['one', 'two']) {
          const route = sketchRoute({ ...routeRequest(seed, index), shape });
          const frameMap = buildFrameMap(route.tiles, FRLG_TILESET);
          for (const tree of frameMap.trees) {
            expect(tree.solid, `${shape} ${seed} #${index} tree ${tree.id}`).toBe(true);
          }
        }
      }
    }
  }, 30_000);

  it('gives every detached tree its own crown, a walkable tip', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['one', 'two']) {
        const route = sketchRoute({ ...routeRequest(seed, 2), shape });
        const frameMap = buildFrameMap(route.tiles, FRLG_TILESET);
        const tips = treeTipKeys(route.tiles, FRLG_TILESET);
        for (const tree of frameMap.trees) {
          if (tree.top === 0 || tree.bottom === route.height - 1) continue;
          for (const [x, y] of tree.cells) {
            if (y !== tree.top || x === 0 || x === route.width - 1) continue;
            expect(tips.has(`${x},${y}`), `${shape} ${seed} tree ${tree.id} ${x},${y}`).toBe(true);
          }
        }
      }
    }
  }, 30_000);

  it('leaves no one-tile-wide lane', () => {
    for (const shape of ROUTE_SHAPES) {
      for (let index = 1; index <= 12; index++) {
        for (const seed of ['one', 'two']) {
          const { tiles } = sketchRoute({ ...routeRequest(seed, index), shape });
          const height = tiles.length;
          const width = tiles[0].length;
          const isFloor = (x: number, y: number): boolean => tiles[y][x] === FLOOR;
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              if (!isFloor(x, y)) continue;
              const across = (isFloor(x - 1, y) ? 1 : 0) + (isFloor(x + 1, y) ? 1 : 0);
              const down = (isFloor(x, y - 1) ? 1 : 0) + (isFloor(x, y + 1) ? 1 : 0);
              expect(across > 0 && down > 0, `${shape} ${seed} #${index} thin lane at ${x},${y}`).toBe(true);
            }
          }
        }
      }
    }
  }, 30_000);

  it('keeps the entry and every exit reachable and walkable', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['wall-a', 'wall-b', 'wall-c']) {
        const route = sketchRoute({ ...routeRequest(seed, 3), shape });
        expect(validateRoute(route).ok, `${shape} ${seed}`).toBe(true);
        expect(isWalkable(route.tiles, route.entry), `${shape} ${seed} entry`).toBe(true);
        for (const exit of route.exits) {
          expect(isWalkable(route.tiles, exit), `${shape} ${seed} exit`).toBe(true);
        }
      }
    }
  });

  it('keeps every optional branch a margin away from the border', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['wall-a', 'wall-b', 'wall-c', 'wall-d']) {
        const route = sketchRoute({ ...routeRequest(seed, 4), shape });
        for (const cell of route.branches) {
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeGreaterThanOrEqual(3);
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeLessThanOrEqual(route.width - 4);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeGreaterThanOrEqual(3);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeLessThanOrEqual(route.height - 4);
        }
      }
    }
  });

  it('is a pure function of the seed and the route index', () => {
    const request = { ...routeRequest('wall-pure', 2), shape: 'cross' as const };
    expect(sketchRoute(request)).toEqual(sketchRoute(request));
  });
});

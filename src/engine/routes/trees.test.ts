import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, isWalkable } from '../map';
import { ROUTE_SHAPES } from './layout';
import { tileKey } from './routeMap';
import { sketchRoute, type RouteRequest } from './sketch';
import { MIN_WHOLE_RUN, cleanTrees, wholeRunHeight } from './trees';
import { validateRoute } from './validate';

function blank(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(FLOOR));
}

function fillColumn(tiles: number[][], x: number, from: number, to: number): void {
  for (let y = from; y <= to; y++) tiles[y][x] = WALL;
}

/**
 * Columns the renderer would draw as a broken tree: a run that is neither a whole
 * tree (even and >= `MIN_WHOLE_RUN`) nor a single edge cell on the border row.
 */
function invalidRuns(tiles: readonly (readonly number[])[]): string[] {
  const height = tiles.length;
  const width = height > 0 ? tiles[0].length : 0;
  const bad: string[] = [];
  for (let x = 0; x < width; x++) {
    let start = -1;
    for (let y = 0; y <= height; y++) {
      const wall = y < height && tiles[y][x] === WALL;
      if (wall && start < 0) start = y;
      else if (!wall && start >= 0) {
        const runHeight = y - start;
        const edge = start === 0 || y - 1 === height - 1;
        const whole = runHeight >= MIN_WHOLE_RUN && runHeight % 2 === 0;
        if (!whole && !(runHeight === 1 && edge)) bad.push(`${x}:${start}-${y - 1} h${runHeight}`);
        start = -1;
      }
    }
  }
  return bad;
}

const at = (tiles: readonly (readonly number[])[], x: number, y: number): number => tiles[y][x];

describe('wholeRunHeight', () => {
  it('keeps even runs of at least one tree and rounds anything else down', () => {
    expect(wholeRunHeight(0)).toBe(0);
    expect(wholeRunHeight(3)).toBe(0);
    expect(wholeRunHeight(MIN_WHOLE_RUN)).toBe(MIN_WHOLE_RUN);
    expect(wholeRunHeight(5)).toBe(4);
    expect(wholeRunHeight(6)).toBe(6);
    expect(wholeRunHeight(9)).toBe(8);
  });
});

describe('cleanTrees', () => {
  it('trims an odd interior run down to a whole number of trees', () => {
    const tiles = blank(5, 12);
    fillColumn(tiles, 2, 3, 7); // height 5 -> 4
    cleanTrees(tiles);
    expect(invalidRuns(tiles)).toEqual([]);
    expect(at(tiles, 2, 3)).toBe(WALL);
    expect(at(tiles, 2, 6)).toBe(WALL);
    expect(at(tiles, 2, 7)).toBe(FLOOR);
  });

  it('removes interior runs too short to be a tree', () => {
    const tiles = blank(5, 12);
    fillColumn(tiles, 2, 4, 6); // height 3
    fillColumn(tiles, 3, 7, 7); // height 1
    cleanTrees(tiles);
    for (let y = 0; y < 12; y++) {
      expect(at(tiles, 2, y), `2,${y}`).toBe(FLOOR);
      expect(at(tiles, 3, y), `3,${y}`).toBe(FLOOR);
    }
  });

  it('cleans a border column toward its opening and keeps a full ring column', () => {
    const tiles = blank(6, 12);
    fillColumn(tiles, 0, 0, 11); // full ring column, untouched
    fillColumn(tiles, 1, 0, 8); // ring column: top run height 9 -> 8
    tiles[9][1] = FLOOR; // the side opening
    fillColumn(tiles, 1, 10, 11); // bottom run height 2 -> 1 at the bottom row
    cleanTrees(tiles);
    for (let y = 0; y <= 11; y++) expect(at(tiles, 0, y), `ring ${y}`).toBe(WALL);
    expect(at(tiles, 1, 7)).toBe(WALL);
    expect(at(tiles, 1, 8)).toBe(FLOOR); // trimmed toward the opening
    expect(at(tiles, 1, 10)).toBe(FLOOR);
    expect(at(tiles, 1, 11)).toBe(WALL); // corner kept
    expect(invalidRuns(tiles)).toEqual([]);
  });
});

function routeRequest(seed: string, routeIndex: number): RouteRequest {
  return { seed, routeIndex, biomeId: 'forest', layout: 'forest' };
}

describe('route tree cleanup (via sketchRoute)', () => {
  it('leaves no column that reads as a broken tree', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tree-a', 'tree-b', 'tree-c', 'tree-d']) {
        const route = sketchRoute({ ...routeRequest(seed, 2), shape });
        expect(invalidRuns(route.tiles), `${shape} ${seed}`).toEqual([]);
      }
    }
  });

  it('keeps the entry and every exit reachable and walkable', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tree-a', 'tree-b', 'tree-c']) {
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
      for (const seed of ['tree-a', 'tree-b', 'tree-c', 'tree-d']) {
        const route = sketchRoute({ ...routeRequest(seed, 4), shape });
        for (const cell of route.branches) {
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeGreaterThanOrEqual(2);
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeLessThanOrEqual(route.width - 3);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeGreaterThanOrEqual(2);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeLessThanOrEqual(route.height - 3);
        }
      }
    }
  });

  it('is a pure function of the seed and the route index', () => {
    const request = { ...routeRequest('tree-pure', 2), shape: 'cross' as const };
    expect(sketchRoute(request)).toEqual(sketchRoute(request));
  });
});

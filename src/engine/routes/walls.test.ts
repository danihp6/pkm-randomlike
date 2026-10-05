import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, isWalkable } from '../map';
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
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeGreaterThanOrEqual(2);
          expect(cell.x, `${shape} ${seed} ${tileKey(cell)} x`).toBeLessThanOrEqual(route.width - 3);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeGreaterThanOrEqual(2);
          expect(cell.y, `${shape} ${seed} ${tileKey(cell)} y`).toBeLessThanOrEqual(route.height - 3);
        }
      }
    }
  });

  it('is a pure function of the seed and the route index', () => {
    const request = { ...routeRequest('wall-pure', 2), shape: 'cross' as const };
    expect(sketchRoute(request)).toEqual(sketchRoute(request));
  });
});

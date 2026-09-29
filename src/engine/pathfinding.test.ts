import { describe, expect, it } from 'vitest';
import { EXIT, FLOOR, WALL, type TileMap } from './map';
import { findPath } from './pathfinding';

const map: TileMap = [
  [WALL, WALL, WALL, WALL, WALL],
  [WALL, FLOOR, WALL, FLOOR, WALL],
  [WALL, FLOOR, FLOOR, FLOOR, WALL],
  [WALL, FLOOR, WALL, EXIT, WALL],
  [WALL, WALL, WALL, WALL, WALL],
];

describe('findPath', () => {
  it('routes around an obstacle and reaches the goal', () => {
    const path = findPath(map, { x: 1, y: 1 }, { x: 3, y: 3 });
    expect(path.length).toBeGreaterThan(0);
    expect(path.at(-1)).toEqual({ x: 3, y: 3 });
  });

  it('returns an empty path when start equals goal', () => {
    expect(findPath(map, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });

  it('returns an empty path when the goal is walled off', () => {
    const sealed: TileMap = [
      [WALL, WALL, WALL],
      [WALL, FLOOR, WALL],
      [WALL, WALL, WALL],
    ];
    expect(findPath(sealed, { x: 1, y: 1 }, { x: 0, y: 0 })).toEqual([]);
  });

  it('honours a custom blocking predicate', () => {
    const blocked = findPath(map, { x: 1, y: 1 }, { x: 3, y: 3 }, (tile) => tile.x === 2);
    expect(blocked).toEqual([]);
  });
});

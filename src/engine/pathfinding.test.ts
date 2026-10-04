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

  it('routes cardinal-only when diagonal steps are off', () => {
    const path = findPath(map, { x: 1, y: 1 }, { x: 3, y: 3 }, undefined, { diagonal: false });
    let previous = { x: 1, y: 1 };
    for (const step of path) {
      expect(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y)).toBe(1);
      previous = step;
    }
    expect(previous).toEqual({ x: 3, y: 3 });
  });

  it('prefers cheaper cells when a per-cell cost is given', () => {
    const open: TileMap = [
      [WALL, WALL, WALL, WALL, WALL],
      [WALL, FLOOR, FLOOR, FLOOR, WALL],
      [WALL, FLOOR, FLOOR, FLOOR, WALL],
      [WALL, FLOOR, FLOOR, FLOOR, WALL],
      [WALL, WALL, WALL, WALL, WALL],
    ];
    const expensive = (tile: { x: number; y: number }): boolean => tile.x === 1 && tile.y === 2;
    const path = findPath(open, { x: 1, y: 1 }, { x: 1, y: 3 }, undefined, {
      diagonal: false,
      cost: (tile) => (expensive(tile) ? 100 : 1),
    });
    expect(path).not.toContainEqual({ x: 1, y: 2 });
    expect(path.at(-1)).toEqual({ x: 1, y: 3 });
  });

  it('carves through solid terrain when a passable override is given', () => {
    const solid: TileMap = [
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
      [WALL, WALL, WALL],
    ];
    expect(findPath(solid, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
    const path = findPath(solid, { x: 0, y: 0 }, { x: 2, y: 2 }, undefined, {
      diagonal: false,
      passable: () => true,
    });
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
  });
});

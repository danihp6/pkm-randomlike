import { describe, expect, it } from 'vitest';
import { mapFromSketch, type TileMap } from '../map';
import { reachableTiles, validateRoute } from './validate';

function route(tiles: TileMap, start: { x: number; y: number }, exit: { x: number; y: number }) {
  return {
    seed: 'test',
    routeIndex: 1,
    biomeId: 'wood',
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    start,
    exit,
  };
}

describe('reachableTiles', () => {
  it('floods walkable tiles from the start', () => {
    const tiles = mapFromSketch(['#####', '#...#', '#####']);
    expect([...reachableTiles(tiles, { x: 1, y: 1 })].sort()).toEqual([
      '1,1',
      '2,1',
      '3,1',
    ]);
  });

  it('stops at walls', () => {
    const tiles = mapFromSketch(['#####', '#.#.#', '#####']);
    expect(reachableTiles(tiles, { x: 1, y: 1 }).has('3,1')).toBe(false);
  });
});

describe('validateRoute', () => {
  it('passes when the exit is reachable from the start', () => {
    const tiles = mapFromSketch(['#####', '#...#', '#.#.#', '#...#', '#####']);
    expect(validateRoute(route(tiles, { x: 1, y: 1 }, { x: 3, y: 3 })).ok).toBe(true);
  });

  it('reports an exit sealed off from the start', () => {
    const tiles = mapFromSketch(['#####', '#.#.#', '#####']);
    const validation = validateRoute(route(tiles, { x: 1, y: 1 }, { x: 3, y: 1 }));
    expect(validation.ok).toBe(false);
    expect(validation.unreachable).toContain('3,1');
  });
});

import { describe, expect, it } from 'vitest';
import type { Tile } from '../grid';
import { mapFromSketch, type TileMap } from '../map';
import { reachableTiles, validateRoute } from './validate';

function route(tiles: TileMap, entry: Tile, exits: readonly Tile[]) {
  return {
    seed: 'test',
    routeIndex: 1,
    biomeId: 'wood',
    shape: 'straight' as const,
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    entry,
    exits,
    spine: [],
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
    expect(validateRoute(route(tiles, { x: 1, y: 1 }, [{ x: 3, y: 3 }])).ok).toBe(true);
  });

  it('reports an exit sealed off from the start', () => {
    const tiles = mapFromSketch(['#####', '#.#.#', '#####']);
    const validation = validateRoute(route(tiles, { x: 1, y: 1 }, [{ x: 3, y: 1 }]));
    expect(validation.ok).toBe(false);
    expect(validation.unreachable).toContain('3,1');
  });

  it('requires every exit to be reachable, not just the first', () => {
    const tiles = mapFromSketch([
      '#######',
      '#...#.#',
      '#.#.#.#',
      '#...#.#',
      '#######',
    ]);
    const validation = validateRoute(route(tiles, { x: 1, y: 1 }, [
      { x: 3, y: 3 },
      { x: 5, y: 1 },
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.unreachable).toEqual(['5,1']);
  });
});

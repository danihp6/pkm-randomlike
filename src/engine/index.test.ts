import { describe, expect, it } from 'vitest';
import { Grid, Rng, TILE_SIZE, isWalkable } from './index';

describe('engine barrel', () => {
  it('exposes the foundations the game is built on', () => {
    expect(new Rng(1).int(1, 1)).toBe(1);
    expect(new Grid().tileSize).toBe(TILE_SIZE);
    expect(isWalkable([[0]], { x: 0, y: 0 })).toBe(true);
  });
});

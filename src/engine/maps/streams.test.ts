import { describe, expect, it } from 'vitest';
import type { Rng } from '../rng';
import { mapStreams } from './streams';

function draw(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe('mapStreams', () => {
  it('is a pure function of the seed and the map index', () => {
    expect(draw(mapStreams('seed', 3).map, 5)).toEqual(draw(mapStreams('seed', 3).map, 5));
  });

  it('changes with the seed and with the map index', () => {
    expect(draw(mapStreams('seed', 3).map, 3)).not.toEqual(draw(mapStreams('seed', 4).map, 3));
    expect(draw(mapStreams('seed', 3).map, 3)).not.toEqual(draw(mapStreams('other', 3).map, 3));
  });
});

import { describe, expect, it } from 'vitest';
import type { Rng } from '../rng';
import { routeStreams } from './streams';

function draw(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe('routeStreams', () => {
  it('is a pure function of seed, route index and attempt', () => {
    const first = routeStreams('seed', 3, 0);
    const second = routeStreams('seed', 3, 0);
    expect(draw(first.layout, 5)).toEqual(draw(second.layout, 5));
    expect(draw(first.terrain, 5)).toEqual(draw(second.terrain, 5));
    expect(draw(first.populate, 5)).toEqual(draw(second.populate, 5));
  });

  it('changes with the attempt, the route index and the seed', () => {
    expect(draw(routeStreams('seed', 3, 0).layout, 3)).not.toEqual(
      draw(routeStreams('seed', 3, 1).layout, 3),
    );
    expect(draw(routeStreams('seed', 3, 0).layout, 3)).not.toEqual(
      draw(routeStreams('seed', 4, 0).layout, 3),
    );
    expect(draw(routeStreams('seed', 3, 0).layout, 3)).not.toEqual(
      draw(routeStreams('other', 3, 0).layout, 3),
    );
  });

  it('gives every pass its own sequence', () => {
    const streams = routeStreams('seed', 3, 0);
    const layout = draw(streams.layout, 3);
    expect(layout).not.toEqual(draw(routeStreams('seed', 3, 0).terrain, 3));
    expect(layout).not.toEqual(draw(routeStreams('seed', 3, 0).populate, 3));
  });

  it('keeps the passes independent: draining one never shifts another', () => {
    const expectedLayout = draw(routeStreams('seed', 3, 0).layout, 3);
    const streams = routeStreams('seed', 3, 0);
    draw(streams.terrain, 10);
    draw(streams.populate, 10);
    expect(draw(streams.layout, 3)).toEqual(expectedLayout);
  });
});

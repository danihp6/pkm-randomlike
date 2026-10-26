import { describe, expect, it } from 'vitest';
import type { Rng } from '../rng';
import { routeStreams } from './streams';

function draw(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

/**
 * The first three draws the three shipped streams take for `('seed', 3, 0)`, read
 * off the engine **before** the chamber stream existed: minting a fourth `Rng`
 * beside them must not move a single value.
 */
const SHIPPED_HEAD = {
  layout: [0.7651477835606784, 0.22829415672458708, 0.527397554833442],
  terrain: [0.020259647397324443, 0.810493973782286, 0.35925877979025245],
  populate: [0.5601364532485604, 0.9246113372500986, 0.32293652719818056],
} as const;

describe('routeStreams', () => {
  it('is a pure function of seed, route index and attempt', () => {
    const first = routeStreams('seed', 3, 0);
    const second = routeStreams('seed', 3, 0);
    expect(draw(first.layout, 5)).toEqual(draw(second.layout, 5));
    expect(draw(first.terrain, 5)).toEqual(draw(second.terrain, 5));
    expect(draw(first.populate, 5)).toEqual(draw(second.populate, 5));
    expect(draw(first.chamber, 5)).toEqual(draw(second.chamber, 5));
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
    expect(draw(routeStreams('seed', 3, 0).chamber, 3)).not.toEqual(
      draw(routeStreams('seed', 3, 1).chamber, 3),
    );
    expect(draw(routeStreams('seed', 3, 0).chamber, 3)).not.toEqual(
      draw(routeStreams('seed', 4, 0).chamber, 3),
    );
    expect(draw(routeStreams('seed', 3, 0).chamber, 3)).not.toEqual(
      draw(routeStreams('other', 3, 0).chamber, 3),
    );
  });

  it('gives every pass its own sequence', () => {
    const streams = routeStreams('seed', 3, 0);
    const layout = draw(streams.layout, 3);
    expect(layout).not.toEqual(draw(routeStreams('seed', 3, 0).terrain, 3));
    expect(layout).not.toEqual(draw(routeStreams('seed', 3, 0).populate, 3));
    expect(layout).not.toEqual(draw(routeStreams('seed', 3, 0).chamber, 3));
    for (const pass of ['layout', 'terrain', 'populate'] as const) {
      expect(draw(routeStreams('seed', 3, 0)[pass], 3), pass).not.toEqual(
        draw(routeStreams('seed', 3, 0).chamber, 3),
      );
    }
  });

  it('keeps the passes independent: draining one never shifts another', () => {
    const expectedLayout = draw(routeStreams('seed', 3, 0).layout, 3);
    const expectedChamber = draw(routeStreams('seed', 3, 0).chamber, 3);
    const streams = routeStreams('seed', 3, 0);
    draw(streams.terrain, 10);
    draw(streams.populate, 10);
    expect(draw(streams.layout, 3)).toEqual(expectedLayout);
    expect(draw(streams.chamber, 3)).toEqual(expectedChamber);
  });

  it('mints the chamber beside the shipped three without moving them', () => {
    const streams = routeStreams('seed', 3, 0);
    expect(draw(streams.layout, 3)).toEqual(SHIPPED_HEAD.layout);
    expect(draw(streams.terrain, 3)).toEqual(SHIPPED_HEAD.terrain);
    expect(draw(streams.populate, 3)).toEqual(SHIPPED_HEAD.populate);
  });
});

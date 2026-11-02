import { describe, expect, it } from 'vitest';
import { hashSeed, Rng } from '../rng';
import { nodeStreams, regionStream, type NodeStreamPass } from './streams';

const PASSES: readonly NodeStreamPass[] = ['layout', 'content', 'encounters', 'loot'];

function draws(stream: { next: () => number }, count: number): number[] {
  return Array.from({ length: count }, () => stream.next());
}

describe('region stream', () => {
  it('is `${seed}:region`, and the same seed replays it', () => {
    for (const seed of ['alpha', 'bravo', 'daily-2026-11-02']) {
      const first = draws(regionStream(seed), 16);
      expect(draws(regionStream(seed), 16), seed).toEqual(first);
      expect(new Rng(hashSeed(`${seed}:region`)).next(), seed).toBe(first[0]);
    }
  });

  it('differs between seeds', () => {
    expect(draws(regionStream('alpha'), 8)).not.toEqual(draws(regionStream('bravo'), 8));
  });

  it('splits the plan and the names off one stream, independently of each other', () => {
    const plan = draws(regionStream('alpha').split('plan'), 8);
    const names = draws(regionStream('alpha').split('names'), 8);
    expect(plan).not.toEqual(names);
    expect(draws(regionStream('alpha').split('plan'), 8)).toEqual(plan);
  });
});

describe('node streams', () => {
  it('gives one stream per pass, keyed by the node key and the pass name', () => {
    const key = 'city:3';
    const streams = nodeStreams('alpha', key);
    expect(Object.keys(streams).sort()).toEqual(['content', 'encounters', 'layout', 'loot']);
    for (const pass of PASSES) {
      expect(streams[pass].next(), pass).toBe(new Rng(hashSeed(`alpha:node:${key}:${pass}`)).next());
    }
  });

  it('replays a node byte for byte on a second call, on all four passes', () => {
    const key = 'route:5';
    const first = nodeStreams('alpha', key);
    const second = nodeStreams('alpha', key);
    for (const pass of PASSES) {
      expect(draws(second[pass], 32), pass).toEqual(draws(first[pass], 32));
    }
  });

  it('moves every pass when the key changes', () => {
    const city = nodeStreams('alpha', 'city:3');
    const route = nodeStreams('alpha', 'route:3');
    for (const pass of PASSES) {
      expect(draws(route[pass], 16), pass).not.toEqual(draws(city[pass], 16));
    }
  });

  it('moves every pass when the seed changes', () => {
    const alpha = nodeStreams('alpha', 'city:3');
    const bravo = nodeStreams('bravo', 'city:3');
    for (const pass of PASSES) {
      expect(draws(bravo[pass], 16), pass).not.toEqual(draws(alpha[pass], 16));
    }
  });

  it('keeps the four passes of one node apart', () => {
    const streams = nodeStreams('alpha', 'town:1');
    for (const pass of PASSES) {
      for (const other of PASSES) {
        if (other === pass) continue;
        expect(draws(streams[pass], 16), `${pass} vs ${other}`).not.toEqual(draws(streams[other], 16));
      }
    }
  });

  it('never depends on a node that precedes it: a node joins or leaves without moving another', () => {
    const alone = draws(nodeStreams('alpha', 'lateral:9').layout, 16);
    for (const earlier of ['town:1', 'route:1', 'city:4', 'lateral:8']) {
      nodeStreams('alpha', earlier).layout.next();
    }
    expect(draws(nodeStreams('alpha', 'lateral:9').layout, 16)).toEqual(alone);
  });
});

import { describe, expect, it } from 'vitest';
import { NAME_ADJECTIVES, NAME_NOUNS } from '../../data/region';
import { routeName, settlementNames } from './names';
import { regionStream } from './streams';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta'];

describe('settlement names', () => {
  it('draws `count` unique Adjective Noun names', () => {
    for (const seed of SEEDS) {
      const names = settlementNames(regionStream(seed).split('names'), 9);
      expect(names, seed).toHaveLength(9);
      expect(new Set(names).size, seed).toBe(9);
      for (const name of names) {
        const [adjective, noun, extra] = name.split(' ');
        expect(extra, name).toBeUndefined();
        expect(NAME_ADJECTIVES, name).toContain(adjective);
        expect(NAME_NOUNS, name).toContain(noun);
      }
    }
  });

  it('is stable for a stream position and a count, and moves when the stream does', () => {
    const once = settlementNames(regionStream('alpha').split('names'), 9);
    const twice = settlementNames(regionStream('alpha').split('names'), 9);
    expect(twice).toEqual(once);
    const moved = regionStream('alpha').split('names');
    moved.next();
    expect(settlementNames(moved, 9)).not.toEqual(once);
  });

  it('reads the stream in draw order, one adjective then one noun per name', () => {
    const [name] = settlementNames(regionStream('alpha').split('names'), 1);
    const stream = regionStream('alpha').split('names');
    const adjective = NAME_ADJECTIVES[stream.int(0, NAME_ADJECTIVES.length - 1)];
    const noun = NAME_NOUNS[stream.int(0, NAME_NOUNS.length - 1)];
    expect(name).toBe(`${adjective} ${noun}`);
  });

  it('asks for nothing when the count is zero', () => {
    expect(settlementNames(regionStream('alpha').split('names'), 0)).toEqual([]);
    expect(settlementNames(regionStream('alpha').split('names'), -3)).toEqual([]);
  });

  it('refuses a count the two lists cannot fill', () => {
    const capacity = NAME_ADJECTIVES.length * NAME_NOUNS.length;
    const rng = regionStream('alpha').split('names');
    expect(() => settlementNames(rng, capacity + 1)).toThrow();
    expect(settlementNames(rng, capacity)).toHaveLength(capacity);
  });
});

describe('route names', () => {
  it('numbers a route in chain order', () => {
    expect(routeName(1)).toBe('Route 1');
    expect(routeName(9)).toBe('Route 9');
    expect(routeName(24)).toBe('Route 24');
  });
});

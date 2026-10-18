import { describe, expect, it } from 'vitest';
import { Rng, dailySeed, hashSeed, randomSeed, rngFromSeed } from './rng';

describe('hashSeed', () => {
  it('is stable for the same input', () => {
    expect(hashSeed('poke-randomlike')).toBe(hashSeed('poke-randomlike'));
  });

  it('differs for different inputs', () => {
    expect(hashSeed('route-1')).not.toBe(hashSeed('route-2'));
  });
});

describe('Rng', () => {
  it('replays the same stream for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('stays inside [0, 1)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 500; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns integers inside an inclusive range', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const value = rng.int(2, 5);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });
});

describe('Rng.split', () => {
  it('gives the same sequence for the same position and salt', () => {
    const parent = new Rng(11);
    parent.next();
    const first = parent.split('variant');
    const second = parent.split('variant');
    expect([first.next(), first.next(), first.next()]).toEqual([
      second.next(),
      second.next(),
      second.next(),
    ]);
  });

  it('gives a different sequence for a different salt', () => {
    const parent = new Rng(11);
    const variant = parent.split('variant');
    const other = parent.split('other');
    expect([variant.next(), variant.next()]).not.toEqual([other.next(), other.next()]);
  });

  it('never moves the parent: draining a sibling leaves its next draw alone', () => {
    const parent = new Rng(7);
    const expected = new Rng(7).next();
    const sibling = parent.split('variant');
    for (let i = 0; i < 100; i++) sibling.next();
    expect(parent.next()).toBe(expected);
  });

  it('reads the position: splitting after a draw is not splitting before it', () => {
    const before = new Rng(7).split('variant').next();
    const after = (() => {
      const parent = new Rng(7);
      parent.next();
      return parent.split('variant').next();
    })();
    expect(before).not.toBe(after);
  });
});

describe('seeds', () => {
  it('derives an rng from a text seed', () => {
    const a = rngFromSeed('aula-baja');
    const b = rngFromSeed('aula-baja');
    expect(a.next()).toBe(b.next());
  });

  it('formats a stable daily seed', () => {
    expect(dailySeed(new Date(Date.UTC(2026, 8, 29)))).toBe('daily-2026-09-29');
  });

  it('generates non-empty random seeds', () => {
    expect(randomSeed().length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { battleSeed } from './battleLink';

describe('battleSeed', () => {
  it('replays the same seed for the same run inputs', () => {
    expect(battleSeed('run-a', 3, 'grass:4,7:0')).toBe(battleSeed('run-a', 3, 'grass:4,7:0'));
  });

  it('separates the seed across run seed, route and key', () => {
    const base = battleSeed('run-a', 3, 'grass:4,7:0');
    expect(battleSeed('run-b', 3, 'grass:4,7:0')).not.toBe(base);
    expect(battleSeed('run-a', 4, 'grass:4,7:0')).not.toBe(base);
    expect(battleSeed('run-a', 3, 'grass:4,7:1')).not.toBe(base);
  });
});

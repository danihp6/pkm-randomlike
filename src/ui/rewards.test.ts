import { describe, expect, it } from 'vitest';
import type { LootEntry } from '../data/loot';
import { Rng } from '../engine/rng';
import { rewardChoices } from './rewards';

const pool: readonly LootEntry[] = [
  { itemId: 'potion', weight: 5 },
  { itemId: 'pokeball', weight: 4 },
  { itemId: 'antidote', weight: 1 },
];

describe('rewardChoices', () => {
  it('picks `count` distinct items from the pool', () => {
    const picks = rewardChoices(pool, 2, new Rng(1));
    expect(picks).toHaveLength(2);
    expect(new Set(picks).size).toBe(2);
    for (const id of picks) expect(pool.some((entry) => entry.itemId === id)).toBe(true);
  });

  it('is deterministic and caps at the pool size', () => {
    expect(rewardChoices(pool, 2, new Rng(7))).toEqual(rewardChoices(pool, 2, new Rng(7)));
    expect(rewardChoices(pool, 9, new Rng(3))).toHaveLength(pool.length);
  });

  it('never offers an empty or zero-weight entry', () => {
    const withZero = [...pool, { itemId: 'ghost', weight: 0 }];
    for (let seed = 0; seed < 40; seed++) {
      for (const id of rewardChoices(withZero, 3, new Rng(seed))) expect(id).not.toBe('ghost');
    }
  });
});

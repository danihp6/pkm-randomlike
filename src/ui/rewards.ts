import type { LootEntry } from '../data/loot';
import type { Rng } from '../engine/rng';

/**
 * The mini-boss's **item choice** (`docs/maps-spec.md` §7, D33): `count`
 * **distinct** item ids drawn by weight from the map's reward pool, so beating the
 * strong trainer offers real options rather than a fixed prize. Deterministic for
 * a fixed `rng`; a pool smaller than `count` simply offers what it has.
 */
export function rewardChoices(pool: readonly LootEntry[], count: number, rng: Rng): readonly string[] {
  const remaining = pool.filter((entry) => entry.weight > 0 && entry.itemId !== '');
  const picks: string[] = [];
  while (picks.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.int(0, total - 1);
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    picks.push(remaining[index].itemId);
    remaining.splice(index, 1);
  }
  return picks;
}

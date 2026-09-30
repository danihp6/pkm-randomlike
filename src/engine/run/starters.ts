import { STARTER_POOL_SIZE, starterCandidates } from '../../data/run';
import type { Rng } from '../rng';

/**
 * Draws `count` distinct starter candidates — the base forms of evolution lines
 * with at least three members — without replacement. The offer is rolled from a
 * seed so the same run seed always shows the same three starters; the player's
 * choice is what the run then records. See `docs/design-spec.md` §3.
 */
export function rollStarterPool(rng: Rng, count = STARTER_POOL_SIZE): readonly string[] {
  const pool = [...starterCandidates()];
  const picked: string[] = [];
  const take = Math.min(Math.max(1, count), pool.length);
  for (let i = 0; i < take; i++) {
    picked.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  return picked;
}

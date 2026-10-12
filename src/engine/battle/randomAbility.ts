import { getAbility, type Ability } from '../../data/dex/abilities';
import { hashSeed, Rng } from '../rng';
import { normalizeEffectId, registeredEffects } from './effects/registry';

/**
 * Abilities a random roll must never hand out. They are **not functional** for
 * an arbitrary species: their whole effect is a forme or species change the
 * engine does not model — they are absent from the effect registry today, so
 * this list is a guard for the day one is ported. Downside abilities (Truant,
 * Slow Start, Stall, Klutz, Moody, Normalize...) are deliberately **kept**: a
 * worse ability is part of the random run, and the ones that would be dead on an
 * arbitrary species are implemented generically instead (Zero to Hero, Schooling,
 * Zen Mode, Wonder Guard — see `effects/abilities.ts`).
 */
const BANNED: ReadonlySet<string> = new Set([
  'powerconstruct',
  'multitype',
  'rkssystem',
  'gulpmissile',
  'asoneglastrier',
  'asonespectrier',
]);

/**
 * The abilities a random roll may draw from: every ability the effect registry
 * knows (`D16` — an unported ability would be a dead no-op, so it never enters
 * the pool) minus `BANNED`, sorted by id so the pool order never depends on
 * module load order. The battle index registers the abilities on import, so a
 * call inside a running game sees the whole set.
 */
export function randomAbilityPool(): readonly Ability[] {
  const pool: Ability[] = [];
  for (const def of registeredEffects()) {
    if (def.kind !== 'ability' || BANNED.has(def.id)) continue;
    const ability = getAbility(def.id);
    if (ability) pool.push(ability);
  }
  pool.sort((a, b) => a.id.localeCompare(b.id));
  return pool;
}

/**
 * A deterministic ability for `speciesId` under `seed` (`D17`): every random
 * roll in a run derives from the run seed, so a replay rebuilds the same
 * ability. `exclude` drops ids from the pool — the No Guard / OHKO guard — and a
 * roll with nothing left yields `undefined` so the caller can fall back to the
 * species' own first ability.
 */
export function randomAbility(
  speciesId: string,
  seed: string,
  exclude: readonly string[] = [],
): Ability | undefined {
  const skip = new Set(exclude.map(normalizeEffectId));
  const pool = randomAbilityPool().filter((ability) => !skip.has(ability.id));
  if (pool.length === 0) return undefined;
  const rng = new Rng(hashSeed(`${seed}:ability:${speciesId}`));
  return pool[rng.int(0, pool.length - 1)];
}

import { DARK_CHANCE } from '../../data/run';
import { randomAbilityPool } from '../battle/randomAbility';
// The pool is the *registered* set, so the ability table has to be loaded for a
// pair to exist. Importing it here keeps this rule self-contained: a headless
// caller that never booted a battle still rolls the same two names.
import '../battle/effects/abilities';
import { hashSeed, Rng } from '../rng';
import type { RunPokemon } from './progression';

/**
 * True when the wild caught under `catchId` is dark. Draws **only** from its own
 * stream, `hashSeed(`${seed}:dark:${nodeKey}:${catchId}`)`, keyed on the node the
 * catch happened on, so no draw any other rule makes can move.
 */
export function isDarkCatch(seed: string, nodeKey: string, catchId: string): boolean {
  return new Rng(hashSeed(`${seed}:dark:${nodeKey}:${catchId}`)).next() < DARK_CHANCE;
}

/** The answer a pool too small to pair up gives; `asDark` reads it as "no grant". */
const NO_PAIR: readonly [string, string] = ['', ''];

/**
 * The two ability **names** a dark member carries, drawn from `randomAbilityPool()`
 * and never the same row twice: the pair comes off the one stream named by the
 * catch, so a fixed run seed rebuilds it (`D11`). The second draw is made over the
 * pool minus the first row (`raw >= first ? raw + 1 : raw`), the deletion that
 * makes a repeat impossible.
 */
export function darkAbilityNames(memberId: string, speciesId: string): readonly [string, string] {
  const pool = randomAbilityPool();
  if (pool.length < 2) return NO_PAIR;
  const rng = new Rng(hashSeed(`dark-abilities:${memberId}:${speciesId}`));
  const first = rng.int(0, pool.length - 1);
  const raw = rng.int(0, pool.length - 2);
  const second = raw >= first ? raw + 1 : raw;
  return [pool[first].name, pool[second].name];
}

/**
 * The catch made dark: both slots are the rolled pair — `fighter.ability` the
 * first, `fighter.secondAbility` and `secondAbility` the second — and `dark`
 * becomes `true`, so the engine fields both through `hasAbility`/`ownedEffects`.
 * A member that is already dark comes back as the same object, and a pool that
 * cannot supply two distinct rows leaves the member unchanged.
 */
export function asDark(member: RunPokemon): RunPokemon {
  if (member.dark === true) return member;
  const [first, second] = darkAbilityNames(member.fighter.id, member.fighter.speciesId);
  if (first === '' || second === '') return member;
  return {
    ...member,
    dark: true,
    fighter: { ...member.fighter, ability: first, secondAbility: second },
    secondAbility: second,
  };
}

import { DARK_CHANCE } from '../../data/run';
import { hashSeed, Rng } from '../rng';
import { normalizeAbilityId } from '../battle/fighter';
import type { RunPokemon } from './progression';

/** The hand-authored ability id a dark member always carries. */
export const DARK_ABILITY = 'darkmatter';

/** The row's English name — what a fighter's `ability` field holds (the dex convention). */
export const DARK_ABILITY_NAME = 'Dark Matter';

/**
 * True when the wild caught under `catchId` is dark. Draws **only** from its own
 * stream, `hashSeed(`${seed}:dark:${mapIndex}:${routeInMap}:${catchId}`)`, so no
 * draw any other rule makes can move.
 */
export function isDarkCatch(
  seed: string,
  mapIndex: number,
  routeInMap: number,
  catchId: string,
): boolean {
  return new Rng(hashSeed(`${seed}:dark:${mapIndex}:${routeInMap}:${catchId}`)).next() < DARK_CHANCE;
}

/**
 * The member made dark: `fighter.ability` becomes `DARK_ABILITY_NAME`, the ability it
 * already had becomes the second slot (on the member **and** on the snapshot), and
 * `dark` becomes `true`. A member that is already dark comes back as the same object.
 */
export function asDark(member: RunPokemon): RunPokemon {
  if (member.dark === true) return member;
  const primary = member.fighter.ability;
  const rolled = normalizeAbilityId(primary) === normalizeAbilityId(DARK_ABILITY_NAME) ? null : primary;
  const granted = rolled ?? member.secondAbility ?? null;
  return {
    ...member,
    dark: true,
    fighter: {
      ...member.fighter,
      ability: DARK_ABILITY_NAME,
      ...(granted !== null ? { secondAbility: granted } : {}),
    },
    ...(granted !== null ? { secondAbility: granted } : {}),
  };
}

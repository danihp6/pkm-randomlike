import { playableSpecies, type Species } from '../../data/dex/species';
import { evolutionFamily, formeFamily, variantFormes } from '../../data/dex/evolutions';
import { bossBstWindow, type LevelBand } from '../../data/run';
import type { Rng } from '../rng';
import type { RunState } from './state';

/** Who is drawing: the wild excludes legendary/mythical species, a trainer does not (`D39`). */
export type PoolRoster = 'wild' | 'trainer';

export type PoolOptions = Readonly<{
  /** A boss fields the upper half of its band's BST window (`D39`). */
  boss?: boolean;
}>;

/** Tags that keep a species out of the tall grass (`D39`). */
export const WILD_BANNED_TAGS: readonly string[] = ['Restricted Legendary', 'Sub-Legendary', 'Mythical'];

function inWindow(species: Species, window: Readonly<{ min: number; max: number }>): boolean {
  return species.bst >= window.min && species.bst <= window.max;
}

function isBanned(species: Species, roster: PoolRoster): boolean {
  if (roster === 'trainer') return false;
  return WILD_BANNED_TAGS.some((tag) => species.tags.includes(tag));
}

/**
 * The ids the wild table must not offer: every recorded species expanded to its line
 * (`evolutionFamily`) and its formes (`formeFamily`). Empty for a run that has caught
 * nothing; an unknown recorded id contributes nothing. Pure — draws no RNG (D11).
 */
export function wildExclusions(run: RunState): ReadonlySet<string> {
  const excluded = new Set<string>();
  for (const speciesId of run.caughtSpecies) {
    for (const id of evolutionFamily(speciesId)) excluded.add(id);
    for (const id of formeFamily(speciesId)) excluded.add(id);
  }
  return excluded;
}

/**
 * The species a band may field: every playable species whose BST falls inside the
 * band's window, minus the roster's bans (`D39`). The pool varies only by the BST
 * window and the bans — no biome or archetype theming — so the union of the bands
 * covers the whole dex and the pool climbs with the floor. Battle-only formes
 * never appear; they only exist inside a fight.
 */
export function speciesPool(
  band: LevelBand,
  roster: PoolRoster,
  options: PoolOptions = {},
): readonly string[] {
  const window = options.boss === true ? bossBstWindow(band) : band.bst;
  return playableSpecies()
    .filter((species) => species.battleOnly === undefined)
    .filter((species) => inWindow(species, window))
    .filter((species) => !isBanned(species, roster))
    .map((species) => species.id);
}

/**
 * The species an individual of `speciesId` is generated as: one of its variant
 * formes drawn on `rng`, or `speciesId` itself when it has none (`D38`). A pool
 * entry whose species has a variant family is one row of the band's table, and
 * the forme the individual carries is chosen here, at generation. Exactly one
 * `rng.int` per call for a variant species, and none for any other species.
 */
export function variantSpecies(speciesId: string, rng: Rng): string {
  const formes = variantFormes(speciesId);
  if (formes.length === 0) return speciesId;
  return formes[rng.int(0, formes.length - 1)];
}

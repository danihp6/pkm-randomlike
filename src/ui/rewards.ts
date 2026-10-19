import type { LootEntry } from '../data/loot';
import { allNatures, getNature, statAtLevel } from '../data/dex/natures';
import { getSpecies, type Species, type StatId } from '../data/dex/species';
import { createFighter } from '../engine/battle/fighter';
import type { Rng } from '../engine/rng';
import { MAX_LEVEL } from '../engine/run/progression';
import { t } from '../i18n';

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

/** The five battle stats a reward row may present (HP is never the headline). */
export type RewardStatId = Exclude<StatId, 'hp'>;

/** One unidentifiable reward option: everything the row prints and the member needs. */
export type PokemonRewardOption = Readonly<{
  speciesId: string;
  level: number;
  /** A **nature id** from `allNatures()`, e.g. `'adamant'`. */
  nature: string;
  /** The stat the row headlines: the first maximum of the five, in this order. */
  topStat: RewardStatId;
  ability: string;
  /** The four move ids the landed member carries, in slot order. */
  moves: readonly string[];
}>;

export type PokemonRewardRequest = Readonly<{
  /** Species ids, as `speciesPool(band, 'wild')` returns them. */
  pool: readonly string[];
  count: number;
  /** The squad's level at the moment the window opens. */
  level: number;
  /** The run seed, as `createFighter`/`adoptAtLevel` take it (D17). */
  learnsetSeed: string;
  rng: Rng;
}>;

/**
 * The order the headline stat is read in, so two equal stats always resolve to
 * the earlier one and the row is stable for a fixed seed.
 */
const TOP_STAT_ORDER: readonly RewardStatId[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** The pool's resolvable species, first occurrence only, in the pool's own order. */
function resolvableSpecies(pool: readonly string[]): readonly Species[] {
  const species: Species[] = [];
  const seen = new Set<string>();
  for (const id of pool) {
    const entry = getSpecies(id);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    species.push(entry);
  }
  return species;
}

/**
 * The stat the row headlines: the argmax of the five battle stats, ties going to
 * the earlier entry of `TOP_STAT_ORDER`. HP is deliberately never a candidate —
 * its flat `+ level + 10` would win at every level and the row would carry no
 * information at all.
 */
function headlineStat(species: Species, level: number, nature: string): RewardStatId {
  const stats = statAtLevel(species, level, nature);
  let top = TOP_STAT_ORDER[0];
  for (const stat of TOP_STAT_ORDER) {
    if (stats[stat] > stats[top]) top = stat;
  }
  return top;
}

/**
 * The mini-boss's **Pokémon choice** (`docs/maps-spec.md` §7): `count` distinct
 * species from the band's pool, each presented only by its highest stat and its
 * nature — never by name, sprite, type, ability or move. The member the row lands
 * is the same fighter this option describes: ability and moveset come from
 * `learnsetSeed` (`D17`), which both this and `createFighter` derive their own
 * `Rng` from, so the caller's stream advances exactly twice per option. Pure and
 * deterministic; the caller mints the `Rng`.
 */
export function pokemonRewardChoices(request: PokemonRewardRequest): readonly PokemonRewardOption[] {
  if (!(request.count > 0)) return [];
  const remaining = [...resolvableSpecies(request.pool)];
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.floor(request.level)));
  const natures = allNatures();
  const options: PokemonRewardOption[] = [];
  while (options.length < request.count && remaining.length > 0) {
    const index = request.rng.int(0, remaining.length - 1);
    const [species] = remaining.splice(index, 1);
    const nature = natures[request.rng.int(0, natures.length - 1)].id;
    const fighter = createFighter({
      id: 'reward',
      speciesId: species.id,
      level,
      nature,
      learnsetSeed: request.learnsetSeed,
    });
    options.push({
      speciesId: species.id,
      level,
      nature,
      topStat: headlineStat(species, level, nature),
      ability: fighter.ability,
      moves: fighter.moves.map((slot) => slot.moveId),
    });
  }
  return options;
}

/** The row's own copy: the highest stat's label, a ` · `, then the nature's name. */
export function pokemonRewardRowLabel(option: PokemonRewardOption): string {
  return `${t(`detail.stat.${option.topStat}`)} · ${getNature(option.nature)?.name ?? option.nature}`;
}

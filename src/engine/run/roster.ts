import { megaFormsForBase } from '../../data/dex/megas';
import type { LevelBand } from '../../data/run';
import type { Rng } from '../rng';
import { speciesPool, variantSpecies } from './pool';

export type RosterEntry = Readonly<{
  id: string;
  speciesId: string;
  level: number;
  /** A held item the member starts with; only Mega Stones so far (D34). */
  heldItem?: string;
}>;

export type RosterOptions = Readonly<{
  /**
   * Bosses, mini-bosses and the `ace` archetype may carry a Mega Stone: one
   * member whose species has a Mega forme holds its stone (`D34`).
   */
  allowMega?: boolean;
  /** A boss fields the upper half of the band's BST window (`D39`). */
  boss?: boolean;
  /**
   * Overrides the band's party size. A floor's boss and mini-boss field a fixed
   * count (`docs/maps-spec.md` §6/§7, `src/data/bosses.ts`); absent, the roster
   * keeps `band.trainerSize`, which is what every existing caller reads.
   */
  count?: number;
}>;

/**
 * A deterministic trainer roster: `options.count ?? band.trainerSize` species
 * drawn without replacement from the band's BST pool (repeats only if the pool is
 * smaller than the party), each level inside the band. The pool is shared by
 * every archetype — it varies only by the floor's BST window and the bans
 * (`D39`), and a trainer (unlike the wild) may field a legendary or mythical —
 * and a boss raises the window to its upper half. The run's battle seed feeds the
 * `rng`, so a replay rebuilds the same team. The forme each entry is generated as
 * comes from the `variant` sibling stream split off that same seed before the
 * first draw, so the picks, the levels and the Mega Stone stay where they were
 * (`D38`).
 */
export function trainerRoster(
  band: LevelBand,
  rng: Rng,
  idPrefix: string,
  options: RosterOptions = {},
): readonly RosterEntry[] {
  const variantRng = rng.split('variant');
  const source = speciesPool(band, 'trainer', { boss: options.boss === true });
  const pool = source.length > 0 ? [...source] : ['sentret'];
  const size = Math.max(1, options.count ?? band.trainerSize);
  const roster: RosterEntry[] = [];
  for (let i = 0; i < size; i++) {
    const speciesId =
      pool.length > 0 ? pool.splice(rng.int(0, pool.length - 1), 1)[0] : source[i % source.length];
    roster.push({
      id: `${idPrefix}:${i}`,
      speciesId: variantSpecies(speciesId, variantRng),
      level: rng.int(band.minLevel, band.maxLevel),
    });
  }
  if (options.allowMega) assignMegaStone(roster, rng);
  return roster;
}

/** Gives one Mega-capable member its stone, chosen from the eligible pool. */
export function assignMegaStone(roster: RosterEntry[], rng: Rng): void {
  const eligible = roster
    .map((entry, index) => ({ entry, index, forms: megaFormsForBase(entry.speciesId) }))
    .filter((candidate) => candidate.forms.length > 0);
  if (eligible.length === 0) return;
  const pick = eligible[rng.int(0, eligible.length - 1)];
  const form = pick.forms[rng.int(0, pick.forms.length - 1)];
  roster[pick.index] = { ...pick.entry, heldItem: form.stoneId };
}

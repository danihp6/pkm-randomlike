import { megaFormsForBase } from '../../data/dex/megas';
import type { LevelBand } from '../../data/run';
import type { TrainerArchetype } from '../../data/trainers';
import type { Rng } from '../rng';

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
}>;

/**
 * A deterministic trainer roster: `band.trainerSize` species drawn without
 * replacement from the archetype's pool for the route's band (repeats only if
 * the pool is smaller than the party), each level inside the band. The band's
 * pool is the archetype's progression: weak base forms early, evolved forms
 * late (`docs/routes-spec.md` §5). The run's battle seed feeds the `rng`, so a
 * replay rebuilds the same team. Phase 6 can layer held items and movesets on
 * top.
 */
export function trainerRoster(
  archetype: TrainerArchetype,
  band: LevelBand,
  rng: Rng,
  idPrefix: string,
  options: RosterOptions = {},
): readonly RosterEntry[] {
  const source = archetype.pools[band.id].length > 0 ? archetype.pools[band.id] : ['sentret'];
  const pool = [...source];
  const size = Math.max(1, band.trainerSize);
  const roster: RosterEntry[] = [];
  for (let i = 0; i < size; i++) {
    const speciesId =
      pool.length > 0 ? pool.splice(rng.int(0, pool.length - 1), 1)[0] : source[i % source.length];
    roster.push({
      id: `${idPrefix}:${i}`,
      speciesId,
      level: rng.int(band.minLevel, band.maxLevel),
    });
  }
  if (options.allowMega) assignMegaStone(roster, rng);
  return roster;
}

/** Gives one Mega-capable member its stone, chosen from the eligible pool. */
function assignMegaStone(roster: RosterEntry[], rng: Rng): void {
  const eligible = roster
    .map((entry, index) => ({ entry, index, forms: megaFormsForBase(entry.speciesId) }))
    .filter((candidate) => candidate.forms.length > 0);
  if (eligible.length === 0) return;
  const pick = eligible[rng.int(0, eligible.length - 1)];
  const form = pick.forms[rng.int(0, pick.forms.length - 1)];
  roster[pick.index] = { ...pick.entry, heldItem: form.stoneId };
}

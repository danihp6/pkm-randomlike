import type { LevelBand } from '../../data/run';
import type { TrainerArchetype } from '../../data/trainers';
import type { Rng } from '../rng';

export type RosterEntry = Readonly<{ id: string; speciesId: string; level: number }>;

/**
 * A deterministic trainer roster: `band.trainerSize` species drawn without
 * replacement from the archetype's themed pool (repeats only if the pool is
 * smaller than the party), each level inside the band. The run's battle seed
 * feeds the `rng`, so a replay rebuilds the same team. Phase 6 can layer held
 * items, movesets and evolved pre-evolutions on top.
 */
export function trainerRoster(
  archetype: TrainerArchetype,
  band: LevelBand,
  rng: Rng,
  idPrefix: string,
): readonly RosterEntry[] {
  const source = archetype.pool.length > 0 ? archetype.pool : ['sentret'];
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
  return roster;
}

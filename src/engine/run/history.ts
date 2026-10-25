import type { RunPokemon } from './progression';
import type { RunMode, RunStats } from './state';

/**
 * The run-history store: the last few finished runs, kept as a **record**, never
 * as something to restore (`D5`: a lost run carries over nothing). Nothing in this
 * module feeds a run — it is written when a run ends and read by a screen — so it
 * reads no clock and no RNG: the ending instant and the playtime arrive as
 * arguments, and the same arguments always build the same record (`D11`).
 */
export const MAX_HISTORY = 50;

/** One species' contribution to a finished run. */
export type RunSpeciesRecord = Readonly<{
  speciesId: string;
  /** Faints this member caused. */
  kos: number;
  /** Damage this member dealt, summed over the run. */
  damage: number;
}>;

/** One finished run. `endedAt` is an ISO-8601 instant; `playtimeMs` a wall clock. */
export type RunHistoryRecord = Readonly<{
  seed: string;
  mode: RunMode;
  /** The floor the run reached (1-based); 0 only for a run that never left map 1. */
  mapReached: number;
  catches: number;
  casualties: number;
  playtimeMs: number;
  /** True when the run beat the final map's boss (finite mode only). */
  won: boolean;
  endedAt: string;
  /** Newest member first is not required: sorted by `speciesId` for a stable order. */
  species: readonly RunSpeciesRecord[];
}>;

/** The run fields `makeHistoryRecord` reads. A structural subset of `RunState`. */
export type RunHistory = Readonly<{
  seed: string;
  mode: RunMode;
  mapIndex: number;
  stats: RunStats;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
}>;

/**
 * The per-member KO and damage counters, read only when the run state already
 * carries them: `RunState` has no tally yet, so today every member reads zero and
 * a record's `species` comes out empty. The counters are read structurally, so the
 * day `RunPokemon` grows them this record starts filling without a signature
 * change.
 */
type MemberTally = Readonly<{ kos?: number; damage?: number }>;

export function emptyHistory(): readonly RunHistoryRecord[] {
  return [];
}

/** Prepends `record` and keeps at most `MAX_HISTORY`, newest first. Pure. */
export function pushHistory(
  history: readonly RunHistoryRecord[],
  record: RunHistoryRecord,
): readonly RunHistoryRecord[] {
  const next = [record, ...history];
  return next.length > MAX_HISTORY ? next.slice(0, MAX_HISTORY) : next;
}

/** Builds a record from the run's own counters; the caller supplies the clock. */
export function makeHistoryRecord(
  run: RunHistory,
  ending: Readonly<{ endedAt: string; playtimeMs: number; won: boolean }>,
): RunHistoryRecord {
  return {
    seed: run.seed,
    mode: run.mode,
    mapReached: run.mapIndex,
    catches: run.stats.catches,
    casualties: run.stats.casualties,
    playtimeMs: ending.playtimeMs,
    won: ending.won,
    endedAt: ending.endedAt,
    species: speciesRecords(run),
  };
}

/** The species rows of a run: party **and** box summed per species, sorted by id. */
function speciesRecords(run: RunHistory): readonly RunSpeciesRecord[] {
  const tallies = new Map<string, { speciesId: string; kos: number; damage: number }>();
  for (const member of [...run.party, ...run.box]) {
    const tally = member as RunPokemon & MemberTally;
    const kos = countOf(tally.kos);
    const damage = countOf(tally.damage);
    if (kos === 0 && damage === 0) continue;
    const speciesId = member.fighter.speciesId;
    if (speciesId === '') continue;
    const existing = tallies.get(speciesId);
    if (existing) {
      existing.kos += kos;
      existing.damage += damage;
    } else {
      tallies.set(speciesId, { speciesId, kos, damage });
    }
  }
  return [...tallies.values()].sort((a, b) =>
    a.speciesId < b.speciesId ? -1 : a.speciesId > b.speciesId ? 1 : 0,
  );
}

/** A counter as a whole number of at least zero; anything unreadable counts as none. */
function countOf(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

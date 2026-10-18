import type { LevelBand } from '../../data/run';
import { speciesPool } from '../run/pool';
import type { Rng } from '../rng';

export type EncounterEntry = Readonly<{
  speciesId: string;
  weight: number;
}>;

export type EncounterTable = readonly EncounterEntry[];

/**
 * The wild table for a band: its `wild` pool (`D39`) with a flat weight. When
 * `excluded` is given, those ids are dropped — and a set that would empty the band
 * falls back to the unfiltered band, so the table is never empty and the chance draw
 * of `rollEncounter` never short-circuits.
 */
export function encounterTableFor(band: LevelBand, excluded?: ReadonlySet<string>): EncounterTable {
  const table = speciesPool(band, 'wild').map((speciesId) => ({ speciesId, weight: 1 }));
  if (excluded === undefined || excluded.size === 0) return table;
  const filtered = table.filter((entry) => !excluded.has(entry.speciesId));
  return filtered.length === 0 ? table : filtered;
}

/** The empty exclusion set, so a caller can pass "nothing caught" without allocating. */
export const NO_EXCLUSIONS: ReadonlySet<string> = new Set<string>();

export type Encounter = Readonly<{
  speciesId: string;
  level: number;
  /** A shiny rolled the alternate-palette art (cosmetic only). */
  shiny: boolean;
}>;

export const DEFAULT_ENCOUNTER_CHANCE = 0.15;

/** The classic 1-in-4096 shiny odds, rolled on its own stream. */
export const SHINY_CHANCE = 1 / 4096;

export function totalWeight(table: EncounterTable): number {
  return table.reduce((sum, item) => sum + item.weight, 0);
}

/** Picks one entry by weight. Assumes a non-empty table with positive weights. */
export function pickWeighted<T extends { weight: number }>(table: readonly T[], rng: Rng): T {
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let roll = rng.next() * total;
  for (const item of table) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return table[table.length - 1];
}

export function rollEncounter(
  table: EncounterTable,
  minLevel: number,
  maxLevel: number,
  rng: Rng,
  chance: number = DEFAULT_ENCOUNTER_CHANCE,
  shinyRng?: Rng,
): Encounter | undefined {
  if (table.length === 0 || rng.next() >= chance) return undefined;
  const entry = pickWeighted(table, rng);
  return {
    speciesId: entry.speciesId,
    level: rng.int(minLevel, maxLevel),
    shiny: shinyRng ? shinyRng.next() < SHINY_CHANCE : false,
  };
}

/**
 * Rolls wild encounters for one route. Call `step()` once per tall-grass step:
 * the same table and Rng seeded the same way always yields the same sequence,
 * so walking the same grass in the same order is reproducible (D11). The shiny
 * roll draws from its own stream, so it can never shift the encounter sequence
 * a fixed seed already produced.
 */
export class RouteEncounters {
  steps = 0;

  private exclusions: ReadonlySet<string>;

  constructor(
    private readonly table: EncounterTable,
    private readonly minLevel: number,
    private readonly maxLevel: number,
    private readonly rng: Rng,
    private readonly chance: number = DEFAULT_ENCOUNTER_CHANCE,
    private readonly shinyRng?: Rng,
    exclusions: ReadonlySet<string> = NO_EXCLUSIONS,
  ) {
    this.exclusions = exclusions;
  }

  /**
   * The table `step()` rolls against: the constructor's table minus the live
   * exclusions, or the constructor's own table when the exclusions would empty it.
   */
  currentTable(): EncounterTable {
    if (this.exclusions.size === 0) return this.table;
    const filtered = this.table.filter((entry) => !this.exclusions.has(entry.speciesId));
    return filtered.length === 0 ? this.table : filtered;
  }

  /** Replaces the live exclusion set: draws nothing, leaves `steps` and the Rng stream untouched. */
  setExclusions(excluded: ReadonlySet<string>): void {
    this.exclusions = excluded;
  }

  step(): Encounter | undefined {
    this.steps++;
    return rollEncounter(
      this.currentTable(),
      this.minLevel,
      this.maxLevel,
      this.rng,
      this.chance,
      this.shinyRng,
    );
  }
}

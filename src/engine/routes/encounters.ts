import type { EncounterEntry, EncounterTable } from '../../data/encounters';
import type { Rng } from '../rng';

export type Encounter = Readonly<{
  speciesId: string;
  level: number;
}>;

export const DEFAULT_ENCOUNTER_CHANCE = 0.15;

export function totalWeight(table: EncounterTable): number {
  return table.reduce((sum, item) => sum + item.weight, 0);
}

/** Picks one entry by weight. Assumes a non-empty table with positive weights. */
export function pickWeighted(table: EncounterTable, rng: Rng): EncounterEntry {
  const total = totalWeight(table);
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
): Encounter | undefined {
  if (table.length === 0 || rng.next() >= chance) return undefined;
  const entry = pickWeighted(table, rng);
  return { speciesId: entry.speciesId, level: rng.int(minLevel, maxLevel) };
}

/**
 * Rolls wild encounters for one route. Call `step()` once per tall-grass step:
 * the same table and Rng seeded the same way always yields the same sequence,
 * so walking the same grass in the same order is reproducible (D11).
 */
export class RouteEncounters {
  steps = 0;

  constructor(
    private readonly table: EncounterTable,
    private readonly minLevel: number,
    private readonly maxLevel: number,
    private readonly rng: Rng,
    private readonly chance: number = DEFAULT_ENCOUNTER_CHANCE,
  ) {}

  step(): Encounter | undefined {
    this.steps++;
    return rollEncounter(this.table, this.minLevel, this.maxLevel, this.rng, this.chance);
  }
}

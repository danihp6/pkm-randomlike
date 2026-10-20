import type { LevelBand } from '../../data/run';
import { WILD_LEVEL_FRACTION, wildLevel } from '../../data/wildLevels';
import { normalizeId } from '../../data/dex';
import { getSpecies } from '../../data/dex/species';
import { speciesPool, variantSpecies } from '../run/pool';
import type { Rng } from '../rng';

export type EncounterEntry = Readonly<{
  speciesId: string;
  weight: number;
}>;

export type EncounterTable = readonly EncounterEntry[];

/** True when `speciesId`'s dex types carry `typeId` (both normalized ids). */
function carriesType(speciesId: string, typeId: string): boolean {
  const types = getSpecies(speciesId)?.types ?? [];
  return types.some((type) => normalizeId(type) === typeId);
}

/**
 * Drops the excluded species, and falls back to `table` when that would empty it, so
 * the table is never empty and `rollEncounter`'s chance draw never short-circuits.
 */
function withoutExcluded(
  table: EncounterTable,
  excluded: ReadonlySet<string> | undefined,
): EncounterTable {
  if (excluded === undefined || excluded.size === 0) return table;
  const filtered = table.filter((entry) => !excluded.has(entry.speciesId));
  return filtered.length === 0 ? table : filtered;
}

/**
 * Narrows a table to one type (an empty id is no filter) and falls back to `table`
 * when no entry carries it, so a type the band lacks never empties the grass.
 */
function narrowToType(table: EncounterTable, typeId: string | null): EncounterTable {
  if (typeId === null) return table;
  const filtered = table.filter((entry) => carriesType(entry.speciesId, typeId));
  return filtered.length === 0 ? table : filtered;
}

/** `null` for an absent or empty type id, so the two filters compare one way. */
function typeFilterOf(typeId: string | null | undefined): string | null {
  return typeId === undefined || typeId === null || typeId === '' ? null : typeId;
}

/**
 * The wild table for a band: its `wild` pool (`D39`) with a flat weight. When
 * `excluded` is given those ids are dropped, and when `typeId` is given only the
 * species whose dex types carry it survive — exclusions first, then the type. Either
 * filter that would empty the band falls back to the table before it, so the table is
 * never empty and the chance draw of `rollEncounter` never short-circuits.
 */
export function encounterTableFor(
  band: LevelBand,
  excluded?: ReadonlySet<string>,
  typeId?: string | null,
): EncounterTable {
  const table = speciesPool(band, 'wild').map((speciesId) => ({ speciesId, weight: 1 }));
  return narrowToType(withoutExcluded(table, excluded), typeFilterOf(typeId));
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

/** The level a wild encounter gets: one draw on the encounter stream. */
export type EncounterLevelRoll = (rng: Rng) => number;

/** The shipped wild-level roll: `fraction ∈ [0.60, 0.75)`, floored and clamped. */
export function rollWildLevel(rng: Rng, squadLevel: number, cap: number): number {
  const span = WILD_LEVEL_FRACTION.max - WILD_LEVEL_FRACTION.min;
  return wildLevel(WILD_LEVEL_FRACTION.min + rng.next() * span, squadLevel, cap);
}

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
  rng: Rng,
  levelFor: EncounterLevelRoll,
  chance: number = DEFAULT_ENCOUNTER_CHANCE,
  shinyRng?: Rng,
  variantRng?: Rng,
): Encounter | undefined {
  if (table.length === 0 || rng.next() >= chance) return undefined;
  const entry = pickWeighted(table, rng);
  return {
    speciesId: variantRng ? variantSpecies(entry.speciesId, variantRng) : entry.speciesId,
    level: levelFor(rng),
    shiny: shinyRng ? shinyRng.next() < SHINY_CHANCE : false,
  };
}

/**
 * Rolls wild encounters for one route. Call `step()` once per tall-grass step:
 * the same table and Rng seeded the same way always yields the same sequence,
 * so walking the same grass in the same order is reproducible (D11). The shiny
 * roll and the variant roll each draw from their own stream, split off the
 * encounters stream in the constructor, so neither can shift the encounter
 * sequence a fixed seed already produced.
 *
 * `levelFor` is called **live on every step**, so a squad that levels up inside
 * the room rolls the new level without rebuilding the room (`docs/routes-spec.md`
 * §3/§5, D11/D17 amended).
 */
export class RouteEncounters {
  steps = 0;

  private exclusions: ReadonlySet<string>;

  private typeFilter: string | null;

  private readonly variantRng: Rng;

  constructor(
    private readonly table: EncounterTable,
    private readonly rng: Rng,
    private readonly levelFor: EncounterLevelRoll,
    private readonly chance: number = DEFAULT_ENCOUNTER_CHANCE,
    private readonly shinyRng?: Rng,
    exclusions: ReadonlySet<string> = NO_EXCLUSIONS,
    typeId: string | null = null,
  ) {
    this.exclusions = exclusions;
    this.typeFilter = typeFilterOf(typeId);
    this.variantRng = rng.split('variant');
  }

  /**
   * The table `step()` rolls against: the constructor's table minus the live
   * exclusions and narrowed to the live type, each falling back to the table before it
   * when it would empty the band — so the constructor's own table is the floor.
   */
  currentTable(): EncounterTable {
    return narrowToType(withoutExcluded(this.table, this.exclusions), this.typeFilter);
  }

  /** Replaces the live exclusion set: draws nothing, leaves `steps` and the Rng stream untouched. */
  setExclusions(excluded: ReadonlySet<string>): void {
    this.exclusions = excluded;
  }

  /** Replaces the live type filter: draws nothing, leaves `steps` and the stream. */
  setTypeFilter(typeId: string | null): void {
    this.typeFilter = typeFilterOf(typeId);
  }

  step(): Encounter | undefined {
    this.steps++;
    return rollEncounter(
      this.currentTable(),
      this.rng,
      this.levelFor,
      this.chance,
      this.shinyRng,
      this.variantRng,
    );
  }
}

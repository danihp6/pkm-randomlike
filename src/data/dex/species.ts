import speciesData from './species.json';
import megasData from './megas.json';

export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';

export const STAT_IDS: readonly StatId[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export type Stats = Readonly<Record<StatId, number>>;

export type Evolution = Readonly<{
  into: string;
  method: string;
  level: number | null;
  item: string | null;
  move: string | null;
  condition: string | null;
}>;

export type GenderRatio = Readonly<{ M: number; F: number }>;

export type Species = Readonly<{
  id: string;
  num: number;
  name: string;
  types: readonly string[];
  baseStats: Stats;
  abilities: Readonly<Record<string, string>>;
  /** Showdown tags, e.g. `Restricted Legendary`, `Sub-Legendary`, `Mythical`. */
  tags: readonly string[];
  /** Base stat total (`D39`): the encounter pools bucket species by it. */
  bst: number;
  /** Set when the forme only exists inside a battle (never spawns, `D39`). */
  battleOnly?: string | readonly string[];
  prevo: string;
  evos: readonly string[];
  evolutions: readonly Evolution[];
  weightkg: number;
  /** Canonical height in metres (PokeAPI); drives the battle sprite's size. */
  heightm: number;
  genderRatio: GenderRatio;
  nfe: boolean;
  forme: string;
  isCosmeticForme: boolean;
  catchRate: number;
}>;

// The generated JSON is the playable set (isNonstandard and num<=0 filtered at
// generation time). It is cast once here; `dex.test.ts` guards the shape.
const ALL_SPECIES = speciesData as unknown as readonly Species[];

// Mega formes live in their own generated file (`megas.json`, D34) so they never
// spawn as wild Pokémon or starters. They are still resolvable by id, because the
// battle builds a Fighter straight from the Mega entry when a stone is spent.
const MEGA_SPECIES = megasData as unknown as readonly Species[];

const BY_ID = new Map<string, Species>(
  [...ALL_SPECIES, ...MEGA_SPECIES].map((species) => [species.id, species]),
);

const BY_NUM = new Map<number, Species>();
for (const species of ALL_SPECIES) {
  const current = BY_NUM.get(species.num);
  if (!current || (current.forme && !species.forme)) BY_NUM.set(species.num, species);
}

export function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getSpecies(id: string): Species | undefined {
  return BY_ID.get(normalizeId(id));
}

export function speciesByNum(num: number): Species | undefined {
  return BY_NUM.get(num);
}

export function playableSpecies(): readonly Species[] {
  return ALL_SPECIES;
}

/** Canonical catch rate; 255 (as easy as it gets) if the table ever misses an id. */
export function catchRateOf(speciesId: string): number {
  return getSpecies(speciesId)?.catchRate ?? 255;
}

/** Canonical height in metres; 1.0 (the size reference) if the id is unknown. */
export function heightOf(speciesId: string): number {
  return getSpecies(speciesId)?.heightm ?? 1;
}

import naturesData from './natures.json';
import { STAT_IDS, type Species, type StatId, type Stats, normalizeId } from './species';

export type Nature = Readonly<{
  id: string;
  name: string;
  plus: StatId | null;
  minus: StatId | null;
}>;

const Natures = naturesData as unknown as readonly Readonly<{
  id: string;
  name: string;
  plus?: StatId;
  minus?: StatId;
}>[];

const BY_ID = new Map<string, Nature>();
const ALL_NATURES: readonly Nature[] = Natures.map((nature) => {
  const entry: Nature = {
    id: nature.id,
    name: nature.name,
    plus: nature.plus ?? null,
    minus: nature.minus ?? null,
  };
  BY_ID.set(entry.id, entry);
  return entry;
});

export const MAX_IV = 31;

export function getNature(nature: string): Nature | undefined {
  return BY_ID.get(normalizeId(nature));
}

export function allNatures(): readonly Nature[] {
  return ALL_NATURES;
}

export function natureMultiplier(nature: string, stat: StatId): number {
  const entry = getNature(nature);
  if (!entry) return 1;
  if (entry.plus === stat) return 1.1;
  if (entry.minus === stat) return 0.9;
  return 1;
}

function statAt(
  base: number,
  level: number,
  natureMultiplier_: number,
  iv: number,
  ev: number,
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  return Math.floor((core + 5) * natureMultiplier_);
}

/**
 * Stats at `level` with natures, IVs, EVs and — the sixth parameter — the
 * member's permanent treats (`Task-103`): each stat adds `treats[stat]` after the
 * formula and is floored at 1. An absent or empty record is exactly the shipped
 * formula.
 */
export function statAtLevel(
  species: Species,
  level: number,
  nature: string,
  ivs: Partial<Stats> = {},
  evs: Partial<Stats> = {},
  treats?: Readonly<Partial<Record<StatId, number>>>,
): Stats {
  const ivOf = (stat: StatId): number => ivs[stat] ?? MAX_IV;
  const evOf = (stat: StatId): number => evs[stat] ?? 0;
  const base = species.baseStats;

  const hp =
    Math.floor(((2 * base.hp + ivOf('hp') + Math.floor(evOf('hp') / 4)) * level) / 100) +
    level +
    10;

  const stats: Stats = {
    hp,
    atk: statAt(base.atk, level, natureMultiplier(nature, 'atk'), ivOf('atk'), evOf('atk')),
    def: statAt(base.def, level, natureMultiplier(nature, 'def'), ivOf('def'), evOf('def')),
    spa: statAt(base.spa, level, natureMultiplier(nature, 'spa'), ivOf('spa'), evOf('spa')),
    spd: statAt(base.spd, level, natureMultiplier(nature, 'spd'), ivOf('spd'), evOf('spd')),
    spe: statAt(base.spe, level, natureMultiplier(nature, 'spe'), ivOf('spe'), evOf('spe')),
  };
  if (!treats) return stats;

  const treated = {} as Record<StatId, number>;
  for (const stat of STAT_IDS) treated[stat] = Math.max(1, stats[stat] + (treats[stat] ?? 0));
  return treated;
}

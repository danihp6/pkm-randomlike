import { getSpecies, normalizeId, type Evolution, type Species } from './species';

export function isLevelEvolution(evolution: Evolution): boolean {
  return evolution.method === 'level' && evolution.level !== null;
}

/**
 * The canon level-up evolution a level triggers, if any. Kept as the raw dex
 * check; the game itself treats **every** evolution as a level evolution (see
 * `evolutionBranches`), so this is only used to read the canon data.
 */
export function evolutionFor(speciesId: string, level: number): Evolution | undefined {
  const species = getSpecies(speciesId);
  if (!species) return undefined;
  return species.evolutions.find(
    (evolution) =>
      isLevelEvolution(evolution) && evolution.level !== null && level >= evolution.level,
  );
}

/**
 * How many pre-evolutions lead to a species: 0 for a base form, 1 for a middle
 * form, 2 for a final one. Formes walk the same `prevo` chain as their base.
 */
export function evolutionStage(speciesId: string): number {
  let species = getSpecies(speciesId);
  if (!species) return 0;
  const seen = new Set<string>([normalizeId(species.id)]);
  let stage = 0;
  while (species.prevo) {
    const previous = getSpecies(species.prevo);
    if (!previous) break;
    const key = normalizeId(previous.id);
    if (seen.has(key)) break;
    seen.add(key);
    stage += 1;
    species = previous;
  }
  return stage;
}

/**
 * The level a non-level evolution happens at: base forms at 20, middle forms at
 * 30. A species that already evolves by level reuses that level instead, so all
 * of a species' branches (Eevee's eight, Kirlia's Gardevoir/Gallade) fire
 * together and the player picks. A species obtained by an evolution never
 * evolves before the level it arrived at (Seadra's Kingdra waits past 32).
 */
const STAGE_EVOLUTION_LEVEL = [20, 30] as const;

/** The level at which a pre-evolution hands over a canon level evolution, if any. */
function obtainedLevel(species: Species): number | null {
  if (!species.prevo) return null;
  const previous = getSpecies(species.prevo);
  if (!previous) return null;
  const levels = previous.evolutions
    .filter(isLevelEvolution)
    .map((evolution) => evolution.level)
    .filter((level): level is number => level !== null);
  return levels.length > 0 ? Math.min(...levels) : null;
}

function speciesEvolutionLevel(species: Species): number {
  const levelEvolution = species.evolutions.find(isLevelEvolution);
  if (levelEvolution?.level != null) return levelEvolution.level;
  const stage = evolutionStage(species.id);
  const base = STAGE_EVOLUTION_LEVEL[Math.min(stage, STAGE_EVOLUTION_LEVEL.length - 1)];
  const obtained = obtainedLevel(species);
  return obtained !== null ? Math.max(base, obtained + 1) : base;
}

/**
 * The level an evolution happens at. A canon level evolution keeps its level;
 * every other method (stone, trade, friendship, move) takes its species'
 * evolution level, so the game is level-only.
 */
export function evolutionLevel(speciesId: string, evolution: Evolution): number {
  if (isLevelEvolution(evolution) && evolution.level !== null) return evolution.level;
  const species = getSpecies(speciesId);
  return species ? speciesEvolutionLevel(species) : 0;
}

/** One evolution a species can take, with the level the game resolves for it. */
export type EvolutionBranch = Readonly<{
  into: string;
  level: number;
  method: string;
}>;

/** Every evolution a species can take, each with its resolved level. */
export function evolutionBranches(speciesId: string): readonly EvolutionBranch[] {
  const species = getSpecies(speciesId);
  if (!species) return [];
  return species.evolutions.map((evolution) => ({
    into: evolution.into,
    level: evolutionLevel(species.id, evolution),
    method: evolution.method,
  }));
}

/** The evolutions a species can take at `level` (all of them are level evolutions). */
export function availableEvolutions(speciesId: string, level: number): readonly EvolutionBranch[] {
  return evolutionBranches(speciesId).filter((branch) => branch.level <= level);
}

/**
 * Every species in the same evolution line as `speciesId`, including itself.
 * Walks `prevo` up to the base form and then `evos` back down, so a branching
 * line (Eevee) counts all of its children and a forme child (Raichu-Alola)
 * counts too. Unknown ids and cycles are skipped.
 */
export function evolutionFamily(speciesId: string): readonly string[] {
  const start = getSpecies(speciesId);
  if (!start) return [];

  let root = start;
  const walked = new Set<string>([root.id]);
  while (root.prevo) {
    const previous = getSpecies(root.prevo);
    if (!previous || walked.has(previous.id)) break;
    walked.add(previous.id);
    root = previous;
  }

  const family: string[] = [];
  const seen = new Set<string>();
  const stack = [root.id];
  while (stack.length > 0) {
    const id = normalizeId(stack.pop()!);
    if (seen.has(id)) continue;
    const species = getSpecies(id);
    if (!species) continue;
    seen.add(id);
    family.push(id);
    for (const next of species.evos) stack.push(next);
  }
  return family;
}

/**
 * The longest chain of evolution steps that starts at `speciesId`, so a base
 * form with two consecutive evolutions (Bulbasaur) scores 2, while a branching
 * line whose children are all final (Eevee, Scyther) scores 1. Unknown ids and
 * cycles score 0.
 */
export function evolutionDepth(speciesId: string): number {
  const walk = (id: string, path: ReadonlySet<string>): number => {
    const species = getSpecies(id);
    if (!species) return 0;
    const normalized = normalizeId(species.id);
    if (path.has(normalized)) return 0;
    const nextPath = new Set(path).add(normalized);
    let depth = 0;
    for (const child of species.evos) {
      depth = Math.max(depth, 1 + walk(child, nextPath));
    }
    return depth;
  };
  return walk(speciesId, new Set());
}

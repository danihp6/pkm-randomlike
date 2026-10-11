import { getSpecies, normalizeId, type Evolution } from './species';

export function isLevelEvolution(evolution: Evolution): boolean {
  return evolution.method === 'level' && evolution.level !== null;
}

export function evolutionFor(speciesId: string, level: number): Evolution | undefined {
  const species = getSpecies(speciesId);
  if (!species) return undefined;
  return species.evolutions.find(
    (evolution) =>
      isLevelEvolution(evolution) && evolution.level !== null && level >= evolution.level,
  );
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

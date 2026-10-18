import { getSpecies, normalizeId, playableSpecies, type Evolution, type Species } from './species';

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
 * The BST windows a non-level evolution's level reads, as `maxBst -> level`. The
 * windows mirror the run's `LEVEL_BANDS.bst` (`D39`) and are pinned equal by a
 * test in this task's own test file; the ceiling band stays 40 however deep the
 * dex goes. A mirrored table, not an import: `src/data/run.ts` already imports
 * this module, so a value import back would be a cycle.
 */
export const EVOLUTION_BST_LEVELS: readonly Readonly<{ maxBst: number; level: number }>[] = [
  { maxBst: 355, level: 20 },
  { maxBst: 440, level: 30 },
  { maxBst: Number.POSITIVE_INFINITY, level: 40 },
];

/** The floor a non-level evolution keeps above the evolution that produced it. */
export const EVOLUTION_MIN_GAP = 10;

/**
 * The branches the generated dex cannot carry: canon Rotom has no evolution at
 * all — its appliances are a forme change from a key item — so the dex's own
 * `evos` is empty for every one of the six entries and this is a game rule
 * (`D38`) layered over the dex, not dex data. One key per species that evolves;
 * `into` is the appliance's own species id, so the member's `speciesId` becomes
 * it and nothing else about the member moves. One-way, Eevee-style: the base
 * form offers all five and an appliance offers none, so the table has no second
 * key and every appliance is absent from its values.
 */
const FORM_EVOLUTIONS: Readonly<Record<string, readonly Evolution[]>> = {
  rotom: [
    { into: 'rotomheat', method: 'forme', level: null, item: null, move: null, condition: null },
    { into: 'rotomwash', method: 'forme', level: null, item: null, move: null, condition: null },
    { into: 'rotomfrost', method: 'forme', level: null, item: null, move: null, condition: null },
    { into: 'rotomfan', method: 'forme', level: null, item: null, move: null, condition: null },
    { into: 'rotommow', method: 'forme', level: null, item: null, move: null, condition: null },
  ],
};

/** The hand-authored branches of a species; empty for every other species. */
function formEvolutions(speciesId: string): readonly Evolution[] {
  return FORM_EVOLUTIONS[speciesId] ?? [];
}

/** A species' own branches plus its hand-authored ones, in that order. */
function evolutionsOf(species: Species): readonly Evolution[] {
  const extra = formEvolutions(species.id);
  return extra.length === 0 ? species.evolutions : [...species.evolutions, ...extra];
}

/** The level a species' BST band reads: 20, 30 or 40. */
export function evolutionLevelForBst(bst: number): number {
  if (!Number.isFinite(bst) || bst < 0) return EVOLUTION_BST_LEVELS[0].level;
  for (const window of EVOLUTION_BST_LEVELS) {
    if (window.maxBst >= bst) return window.level;
  }
  return EVOLUTION_BST_LEVELS[EVOLUTION_BST_LEVELS.length - 1].level;
}

const NO_ANCESTORS: ReadonlySet<string> = new Set<string>();

/**
 * The level a species' non-level branches resolve at: the species' BST band,
 * floored at `EVOLUTION_MIN_GAP` levels above the level the species was obtained
 * at — the **resolved** level of its pre-evolution, so a late canon level-up deep
 * in a line (Horsea 32) pushes the stone/trade branch above it (Seadra 42). All
 * of a species' branches share the level, so a split line (Eevee's eight,
 * Kirlia's Gardevoir/Gallade) fires together and the player picks. The walk is
 * one `prevo` per step and cycle-safe even though the dex's chains are acyclic.
 */
function speciesEvolutionLevel(species: Species, visited: ReadonlySet<string> = NO_ANCESTORS): number {
  const levelEvolution = evolutionsOf(species).find(isLevelEvolution);
  if (levelEvolution?.level != null) return levelEvolution.level;
  const base = evolutionLevelForBst(species.bst);
  if (!species.prevo) return base;
  const ancestors = new Set(visited).add(normalizeId(species.id));
  const previous = getSpecies(species.prevo);
  if (!previous || ancestors.has(normalizeId(previous.id))) return base;
  return Math.max(base, speciesEvolutionLevel(previous, ancestors) + EVOLUTION_MIN_GAP);
}

/**
 * The level an evolution happens at. A canon level evolution keeps its level;
 * every other method (stone, trade, friendship, move) takes its species' own
 * evolution level (BST band, +10 over the pre-evolution's resolved level), so
 * the game is level-only.
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
  return evolutionsOf(species).map((evolution) => ({
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
 * counts too. The hand-authored `FORM_EVOLUTIONS` branches join the walk
 * additively, so a base form reaches its appliances though an appliance never
 * walks back to it (one-way). Unknown ids and cycles are skipped.
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
    for (const evolution of formEvolutions(species.id)) stack.push(evolution.into);
  }
  return family;
}

/**
 * Every entry sharing `speciesId`'s national dex number, in `playableSpecies()` order:
 * the alternate and cosmetic formes the build carries as species of their own (an entry
 * that is nobody's `evos` child and has no `prevo` is reachable only this way). `[]` for
 * an unknown id. Battle-only Mega / G-Max formes live in their own generated files and are
 * not part of it.
 */
export function formeFamily(speciesId: string): readonly string[] {
  const species = getSpecies(speciesId);
  if (!species) return [];
  return playableSpecies()
    .filter((candidate) => candidate.num === species.num)
    .map((candidate) => candidate.id);
}

/**
 * The longest chain of evolution steps that starts at `speciesId`, so a base
 * form with two consecutive evolutions (Bulbasaur) scores 2, while a branching
 * line whose children are all final (Eevee, Scyther) scores 1. The
 * hand-authored `FORM_EVOLUTIONS` branches join the walk additively. Unknown
 * ids and cycles score 0.
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
    for (const evolution of formEvolutions(normalized)) {
      depth = Math.max(depth, 1 + walk(evolution.into, nextPath));
    }
    return depth;
  };
  return walk(speciesId, new Set());
}

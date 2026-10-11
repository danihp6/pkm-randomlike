import { evolutionBranches, getSpecies } from '../data/dex';

/**
 * The evolution graph the STATS tab draws under the stats: the whole family from
 * its base form, in pre-order, with each edge's resolved level. It shows the
 * pre-evolutions as well as the branches still ahead, so a final form still
 * reads its line. Pure, like `mapView`: the route scene only places what this
 * returns (`docs/design-spec.md` §5).
 */
export type FamilyNode = Readonly<{
  id: string;
  name: string;
  /** How many evolutions lead to it (0 = base form); the tree's indent level. */
  depth: number;
  /** The row it draws at (pre-order, 0-based). */
  row: number;
  /** The level its parent evolves into it; null for the base form. */
  level: number | null;
  /** The row of its parent, or null for the base form. */
  parent: number | null;
  /** True for the species the panel is showing. */
  current: boolean;
  /** True when a click on this branch evolves the current member into it. */
  ready: boolean;
}>;

/**
 * The family of `speciesId` as a node list rooted at its base form. A node is
 * `ready` when it is a direct child of the current species and the member's
 * level meets the edge, so the scene can make exactly those clickable.
 */
export function evolutionGraph(speciesId: string, level: number): readonly FamilyNode[] {
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

  const nodes: FamilyNode[] = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number, edgeLevel: number | null, parent: number | null): void => {
    const species = getSpecies(id);
    if (!species || seen.has(species.id)) return;
    seen.add(species.id);
    const index = nodes.length;
    const parentNode = parent === null ? undefined : nodes[parent];
    nodes.push({
      id: species.id,
      name: species.name,
      depth,
      row: index,
      level: edgeLevel,
      parent,
      current: species.id === start.id,
      ready: parentNode?.current === true && edgeLevel !== null && edgeLevel <= level,
    });
    for (const branch of evolutionBranches(species.id)) {
      visit(branch.into, depth + 1, branch.level, index);
    }
  };
  visit(root.id, 0, null, null);
  return nodes;
}

import {
  evolutionBranches,
  getSpecies,
  gmaxFormForBase,
  megaFormsForBase,
  type GmaxForm,
  type MegaForm,
} from '../data/dex';
import { t } from '../i18n';

/**
 * The evolution graph the STATS tab draws under the stats: the whole family from
 * its base form, in pre-order, with each edge's resolved level, plus one
 * **information row** per battle-only forme of every family species that owns
 * one — a Mega and a Gigantamax (`D34`, `D44`). Those rows are inert: they are
 * never `ready`, never `current` and never change a member, so the route scene
 * draws them with the code it already has and only a species row is clickable.
 * Pure, like `mapView`: the route scene only places what this returns
 * (`docs/design-spec.md` §5).
 */
export type FamilyNodeKind = 'species' | 'mega' | 'gmax';

export type FamilyNode = Readonly<{
  id: string;
  name: string;
  /** How many evolutions lead to it (0 = base form); the tree's indent level. */
  depth: number;
  /** The row it draws at (pre-order, 0-based). */
  row: number;
  /** The level its parent evolves into it; null for the base form and every information row. */
  level: number | null;
  /** The row of its parent, or null for the base form. */
  parent: number | null;
  /** True for the species the panel is showing. */
  current: boolean;
  /** True when a click on this branch evolves the current member into it. */
  ready: boolean;
  /** `species` for a family member; `mega` / `gmax` for a battle-only information row. */
  kind: FamilyNodeKind;
}>;

/**
 * The readable name a battle-only forme prints in its row, from its dex name:
 * `Charizard-Mega-X` -> `Mega Charizard X`, `Venusaur-Mega` -> `Mega Venusaur`,
 * `Charizard-Gmax` -> `Gigantamax Charizard`,
 * `Toxtricity-Low-Key-Gmax` -> `Gigantamax Toxtricity Low Key`.
 */
export function formeDisplayName(dexName: string): string {
  const [base, ...forme] = dexName.split('-');
  const rest = forme.slice(0, -1);
  const last = forme[forme.length - 1];
  if (forme[0] === 'Mega') return ['Mega', base, ...forme.slice(1)].join(' ');
  if (last === 'Gmax') return ['Gigantamax', base, ...rest].join(' ');
  return [base, ...forme].join(' ');
}

/** The copy a Mega's row carries: the stone it evolves with, and nothing else. */
function megaRowName(mega: MegaForm): string {
  return t('detail.megaEvolvesWith', { stone: mega.stoneName });
}

/** The copy a Gigantamax's row carries: the forme plus the stone it needs (D44). */
function gmaxRowName(gmax: GmaxForm): string {
  return t('detail.gmaxEvolvesWith', {
    forme: formeDisplayName(gmax.name),
    stone: gmax.stoneName,
  });
}

/**
 * The family of `speciesId` as a node list rooted at its base form. A node is
 * `ready` when it is a direct child of the current species and the member's
 * level meets the edge, so the scene can make exactly those clickable. Every
 * visited species that owns battle-only formes grows them as its **last**
 * children — after its whole evolution subtree — so a Charmander's panel lists
 * Mega Charizard X/Y and G-Max Charizard under the Charizard node exactly as a
 * Charizard's panel does.
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
      kind: 'species',
    });
    for (const branch of evolutionBranches(species.id)) {
      visit(branch.into, depth + 1, branch.level, index);
    }
    const pushForme = (kind: 'mega' | 'gmax', formeId: string, name: string): void => {
      nodes.push({
        id: formeId,
        name,
        depth: depth + 1,
        row: nodes.length,
        level: null,
        parent: index,
        current: false,
        ready: false,
        kind,
      });
    };
    for (const mega of megaFormsForBase(species.id)) pushForme('mega', mega.id, megaRowName(mega));
    const gmax = gmaxFormForBase(species.id);
    if (gmax) pushForme('gmax', gmax.id, gmaxRowName(gmax));
  };
  visit(root.id, 0, null, null);
  return nodes;
}

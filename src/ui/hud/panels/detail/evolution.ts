import { evolutionRowNote, type FamilyNode } from '../../../evolutionGraph';
import type { DetailEvolutionRowView } from './view';

/**
 * The STATS tab's evolution graph as SVG data (`D49`): one row per family node,
 * indented by stage, an elbow edge per non-root row, and each branch's level on the
 * right. Deterministic from `FamilyNode[]` and a width alone, so the DOM draws the
 * same graph the canvas draws and a fixed save paints the same picture twice.
 */

export type EvolutionEdge = Readonly<{ fromRow: number; toRow: number; d: string }>;

export const EVO_ROW_H = 28; // HUD_DETAIL_EVO_ROW_H
export const EVO_INDENT = 34; // HUD_DETAIL_EVO_INDENT
export const EVO_MAX_ROWS = 9; // HUD_DETAIL_EVO_MAX
export const EVO_PORTRAIT = 26; // 64 × HUD_DETAIL_EVO_PORTRAIT_SCALE 0.4, rounded
export const EVO_PAD_X = 8;

/** The vertical centre of row `row`, where an edge meets it. */
function rowMid(row: number): number {
  return row * EVO_ROW_H + EVO_ROW_H / 2;
}

/** The elbow from a parent row's portrait to its child row's indent. */
function edgePath(parentX: number, childX: number, parent: number, child: number): string {
  const spine = parentX + EVO_INDENT / 2;
  return `M ${parentX + EVO_PORTRAIT} ${rowMid(parent)} H ${spine} V ${rowMid(child)} H ${childX}`;
}

/**
 * The graph's rows and edges at `width`, truncated to `EVO_MAX_ROWS` (Eevee's eight
 * plus itself). `current` and `ready` are flags for the CSS to paint; they never move
 * a row and never change an edge.
 */
export function evolutionView(
  nodes: readonly FamilyNode[],
  _width: number,
): Readonly<{
  height: number;
  rows: readonly DetailEvolutionRowView[];
  edges: readonly EvolutionEdge[];
}> {
  const kept = nodes.slice(0, EVO_MAX_ROWS);
  const rows: DetailEvolutionRowView[] = kept.map((node, index) => ({
    id: node.id,
    name: node.name,
    row: index,
    depth: node.depth,
    parent: node.parent,
    level: evolutionRowNote(node) || null,
    current: node.current,
    ready: node.ready,
    kind: node.kind,
    x: EVO_PAD_X + EVO_INDENT * node.depth,
    y: index * EVO_ROW_H,
  }));
  const edges: EvolutionEdge[] = [];
  rows.forEach((row) => {
    if (row.parent === null) return;
    const parent = rows[row.parent];
    if (parent === undefined) return;
    edges.push({
      fromRow: parent.row,
      toRow: row.row,
      d: edgePath(parent.x, row.x, parent.row, row.row),
    });
  });
  return { height: rows.length * EVO_ROW_H, rows, edges };
}

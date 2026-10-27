import { evolutionRowNote, type FamilyNode } from '../../../evolutionGraph';
import { clampScrollTop, maxScrollTop, visibleRange } from '../../../scroll';
import type { DetailEvolutionRowView } from './view';

/**
 * The STATS tab's evolution graph as SVG data (`D49`): one row per family node,
 * indented by stage, an elbow edge per non-root row, and each branch's level on the
 * right. Deterministic from `FamilyNode[]`, a width and a row offset alone, so the
 * DOM draws the same graph the canvas draws and a fixed save paints the same picture
 * twice.
 */

export type EvolutionEdge = Readonly<{ fromRow: number; toRow: number; d: string }>;

export const EVO_ROW_H = 28; // HUD_DETAIL_EVO_ROW_H
export const EVO_INDENT = 34; // HUD_DETAIL_EVO_INDENT
/** The pool: the most rows the band will ever take from the model (the model's longest graph plus one row of headroom). */
export const EVO_MAX_ROWS = 11;
/** The window: the rows the 460 × 560 card can hold, drawn at once. */
export const EVO_WINDOW_ROWS = 10;

export const EVO_PORTRAIT = 26; // 64 × HUD_DETAIL_EVO_PORTRAIT_SCALE 0.4, rounded
export const EVO_PAD_X = 8;

/**
 * The HUD's meta-size advance of one right-column glyph, rounded up: at 10 px the
 * body font draws the Charizard stones at 5.87–5.95 px per character, so 6 is the
 * floor every reserve below clears.
 */
export const EVO_LEVEL_CHAR_W = 6;

/** The right column's inset from the band's edge plus the gap that keeps the two columns apart. */
export const EVO_LEVEL_INSET = 12;

/**
 * The width the right column reserves on a row, from its text alone: nothing when the
 * row draws no level and no stone, the stone's own width plus the band's inset otherwise.
 * The name lane is clamped by this so a long forme cannot run into the level or stone.
 */
export function levelColumnWidth(level: string | null): number {
  return level === null ? 0 : EVO_LEVEL_INSET + level.length * EVO_LEVEL_CHAR_W;
}

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
 * The graph's rows and edges at `width`, capped to `EVO_MAX_ROWS` (the pool) and then
 * windowed to the `EVO_WINDOW_ROWS` rows starting at `top` (an offset in rows, clamped
 * by this function). `row` and `y` are window-relative, so the first drawn row is
 * always `{ row: 0, y: 0 }`; `parent` stays the family-absolute row of its edge's
 * source. `current` and `ready` are flags for the CSS to paint; they never move a row
 * and never change an edge.
 */
export function evolutionView(
  nodes: readonly FamilyNode[],
  _width: number,
  top = 0,
): Readonly<{
  height: number;
  rows: readonly DetailEvolutionRowView[];
  edges: readonly EvolutionEdge[];
}> {
  const capped = nodes.slice(0, EVO_MAX_ROWS);
  const maxTop = maxScrollTop(capped.length, 1, EVO_WINDOW_ROWS);
  const { start, end } = visibleRange(clampScrollTop(top, maxTop), 1, EVO_WINDOW_ROWS, capped.length);
  const rows: DetailEvolutionRowView[] = capped.slice(start, end).map((node, index) => ({
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
    if (row.parent < start || row.parent >= end) return;
    const parent = rows[row.parent - start];
    if (parent === undefined) return;
    edges.push({
      fromRow: parent.row,
      toRow: row.row,
      d: edgePath(parent.x, row.x, parent.row, row.row),
    });
  });
  return { height: rows.length * EVO_ROW_H, rows, edges };
}

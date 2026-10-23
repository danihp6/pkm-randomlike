import { describe, expect, it } from 'vitest';
import type { FamilyNode } from '../../../evolutionGraph';
import {
  EVO_INDENT,
  EVO_MAX_ROWS,
  EVO_PAD_X,
  EVO_PORTRAIT,
  EVO_ROW_H,
  evolutionView,
} from './evolution';

function node(overrides: Partial<FamilyNode> & Readonly<{ id: string }>): FamilyNode {
  return {
    name: overrides.id.toUpperCase(),
    depth: 0,
    row: 0,
    level: null,
    parent: null,
    current: false,
    ready: false,
    kind: 'species',
    ...overrides,
  };
}

/** Charmander -> Charmeleon -> Charizard, the family the `03m` frame draws. */
const FAMILY: readonly FamilyNode[] = [
  node({ id: 'charmander', depth: 0, row: 0, current: false }),
  node({ id: 'charmeleon', depth: 1, row: 1, level: 16, parent: 0 }),
  node({ id: 'charizard', depth: 2, row: 2, level: 36, parent: 1, current: true }),
];

describe('the mirrored constants', () => {
  it('equal the Phaser values they copy', () => {
    expect(EVO_ROW_H).toBe(28);
    expect(EVO_INDENT).toBe(34);
    expect(EVO_MAX_ROWS).toBe(9);
    expect(EVO_PORTRAIT).toBe(26);
    expect(EVO_PAD_X).toBe(8);
  });
});

describe('evolutionView', () => {
  it('lays every row at the shipped indent and pitch', () => {
    const view = evolutionView(FAMILY, 420);
    expect(view.height).toBe(FAMILY.length * EVO_ROW_H);
    expect(view.rows.map((row) => ({ x: row.x, y: row.y }))).toEqual([
      { x: 8, y: 0 },
      { x: 8 + 34, y: 28 },
      { x: 8 + 68, y: 56 },
    ]);
    expect(view.rows.map((row) => row.level)).toEqual([null, 'Lv 16', 'Lv 36']);
    expect(view.rows.map((row) => row.current)).toEqual([false, false, true]);
    expect(view.rows.map((row) => row.parent)).toEqual([null, 0, 1]);
  });

  it('draws one elbow per non-root row, exactly as the panel does', () => {
    const view = evolutionView(FAMILY, 420);
    expect(view.edges).toEqual([
      { fromRow: 0, toRow: 1, d: 'M 34 14 H 25 V 42 H 42' },
      { fromRow: 1, toRow: 2, d: 'M 68 42 H 59 V 70 H 76' },
    ]);
  });

  it('keeps a Mega and a Gmax branch on the same elbow arithmetic', () => {
    const family = [
      ...FAMILY.slice(0, 3).map((entry) => ({ ...entry })),
      node({ id: 'charizardmegax', depth: 3, row: 3, parent: 2, kind: 'mega' }),
      node({ id: 'charizardmegay', depth: 3, row: 4, parent: 2, kind: 'mega' }),
      node({ id: 'charizardgmax', depth: 3, row: 5, parent: 2, kind: 'gmax' }),
    ];
    const view = evolutionView(family, 420);
    expect(view.rows).toHaveLength(6);
    expect(view.rows.slice(3).map((row) => row.x)).toEqual([110, 110, 110]);
    expect(view.rows.slice(3).map((row) => row.level)).toEqual([null, null, null]);
    expect(view.edges.slice(2)).toEqual([
      { fromRow: 2, toRow: 3, d: 'M 102 70 H 93 V 98 H 110' },
      { fromRow: 2, toRow: 4, d: 'M 102 70 H 93 V 126 H 110' },
      { fromRow: 2, toRow: 5, d: 'M 102 70 H 93 V 154 H 110' },
    ]);
  });

  it('truncates at EVO_MAX_ROWS and shortens the SVG to the rows it draws', () => {
    const wide = Array.from({ length: 12 }, (_, index) =>
      node({
        id: `n${index}`,
        depth: index,
        row: index,
        parent: index === 0 ? null : index - 1,
        level: index === 0 ? null : 10,
      }),
    );
    const view = evolutionView(wide, 420);
    expect(view.rows).toHaveLength(EVO_MAX_ROWS);
    expect(view.height).toBe(EVO_MAX_ROWS * EVO_ROW_H);
    expect(view.edges).toHaveLength(EVO_MAX_ROWS - 1);
    expect(view.rows[EVO_MAX_ROWS - 1].y).toBe((EVO_MAX_ROWS - 1) * EVO_ROW_H);
  });

  it('draws no edge for a root and keeps the flags off a plain node', () => {
    const view = evolutionView([node({ id: 'eevee', kind: 'species' })], 420);
    expect(view.edges).toEqual([]);
    expect(view.height).toBe(28);
    expect(view.rows[0].ready).toBe(false);
    expect(view.rows[0].current).toBe(false);
  });

  it('never mutates the family it is handed', () => {
    const family = Object.freeze(FAMILY.map((entry) => Object.freeze({ ...entry })));
    const view = evolutionView(family, 420);
    expect(family).toHaveLength(3);
    expect(view.rows).toHaveLength(3);
  });
});

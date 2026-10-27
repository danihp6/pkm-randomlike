import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playableSpecies } from '../../../../data/dex/species';
import { evolutionGraph, type FamilyNode } from '../../../evolutionGraph';
import { maxScrollTop, visibleRange } from '../../../scroll';
import {
  EVO_INDENT,
  EVO_LEVEL_CHAR_W,
  EVO_LEVEL_INSET,
  EVO_MAX_ROWS,
  EVO_PAD_X,
  EVO_PORTRAIT,
  EVO_ROW_H,
  EVO_WINDOW_ROWS,
  evolutionView,
  levelColumnWidth,
} from './evolution';

function node(overrides: Partial<FamilyNode> & Readonly<{ id: string }>): FamilyNode {
  return {
    name: overrides.id.toUpperCase(),
    note: null,
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

/** A straight chain of `count` nodes, one row each, rooted at `n0`. */
function chain(count: number): readonly FamilyNode[] {
  return Array.from({ length: count }, (_, index) =>
    node({
      id: `n${index}`,
      depth: index,
      row: index,
      parent: index === 0 ? null : index - 1,
      level: index === 0 ? null : 10,
    }),
  );
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
    expect(EVO_MAX_ROWS).toBe(11);
    expect(EVO_WINDOW_ROWS).toBe(10);
    expect(EVO_PORTRAIT).toBe(26);
    expect(EVO_PAD_X).toBe(8);
  });

  it('keeps the pool a real pool, one row over the window', () => {
    expect(EVO_MAX_ROWS).toBeGreaterThan(EVO_WINDOW_ROWS);
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
      node({
        id: 'charizardmegax',
        name: 'Mega Charizard X',
        note: 'Charizardite X',
        depth: 3,
        row: 3,
        parent: 2,
        kind: 'mega',
      }),
      node({
        id: 'charizardmegay',
        name: 'Mega Charizard Y',
        note: 'Charizardite Y',
        depth: 3,
        row: 4,
        parent: 2,
        kind: 'mega',
      }),
      node({
        id: 'charizardgmax',
        name: 'Gigantamax Charizard',
        note: 'Charizardite G',
        depth: 3,
        row: 5,
        parent: 2,
        kind: 'gmax',
      }),
    ];
    const view = evolutionView(family, 420);
    expect(view.rows).toHaveLength(6);
    expect(view.rows.slice(3).map((row) => row.x)).toEqual([110, 110, 110]);
    expect(view.rows.slice(3).map((row) => row.level)).toEqual([
      'Charizardite X',
      'Charizardite Y',
      'Charizardite G',
    ]);
    expect(view.edges.slice(2)).toEqual([
      { fromRow: 2, toRow: 3, d: 'M 102 70 H 93 V 98 H 110' },
      { fromRow: 2, toRow: 4, d: 'M 102 70 H 93 V 126 H 110' },
      { fromRow: 2, toRow: 5, d: 'M 102 70 H 93 V 154 H 110' },
    ]);
  });

  it('puts the stone in the right column of a real Charizard family', () => {
    const view = evolutionView(evolutionGraph('charizard', 36), 420);
    expect(view.rows.map((row) => row.name)).toEqual([
      'Charmander',
      'Charmeleon',
      'Charizard',
      'Mega Charizard X',
      'Mega Charizard Y',
      'Gigantamax Charizard',
    ]);
    expect(view.rows.map((row) => row.level)).toEqual([
      null,
      'Lv 16',
      'Lv 36',
      'Charizardite X',
      'Charizardite Y',
      'Charizardite G',
    ]);
  });

  it('draws only the window and shortens the SVG to the rows it draws', () => {
    const view = evolutionView(chain(12), 420);
    expect(view.rows).toHaveLength(EVO_WINDOW_ROWS);
    expect(view.height).toBe(EVO_WINDOW_ROWS * EVO_ROW_H);
    expect(view.edges).toHaveLength(EVO_WINDOW_ROWS - 1);
    expect(view.rows[EVO_WINDOW_ROWS - 1].y).toBe((EVO_WINDOW_ROWS - 1) * EVO_ROW_H);
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

  it('scrolls the window a row at a time and clamps any offset into range', () => {
    const nodes = chain(11);
    const first = evolutionView(nodes, 420);
    expect(first.rows).toHaveLength(EVO_WINDOW_ROWS);
    expect(first.rows[0].id).toBe('n0');
    expect(first.rows[9].id).toBe('n9');
    expect(first.rows[9].y).toBe(252);

    const scrolled = evolutionView(nodes, 420, 1);
    expect(scrolled.rows).toHaveLength(EVO_WINDOW_ROWS);
    expect(scrolled.rows[0].id).toBe('n1');
    expect(scrolled.rows[0].y).toBe(0);
    expect(scrolled.rows.at(-1)!.id).toBe('n10');
    expect(scrolled.height).toBe(EVO_WINDOW_ROWS * EVO_ROW_H);
    // n1's parent n0 has left the window, so its elbow is gone — while n10's own
    // appears, so a full window still draws `EVO_WINDOW_ROWS - 1` of them.
    expect(scrolled.edges).toHaveLength(EVO_WINDOW_ROWS - 1);
    expect(scrolled.edges[0]).toEqual({ fromRow: 0, toRow: 1, d: 'M 68 14 H 59 V 42 H 76' });

    expect(evolutionView(nodes, 420, 5)).toEqual(scrolled);
    expect(evolutionView(nodes, 420, -3)).toEqual(first);
    expect(maxScrollTop(11, 1, EVO_WINDOW_ROWS)).toBe(1);
    expect(visibleRange(1, 1, 10, 11)).toEqual({ start: 1, end: 11 });
  });

  it('caps the pool before it windows, so a thirteen-row chain still ends at n10', () => {
    const nodes = chain(13);
    expect(evolutionView(nodes, 420, 1).rows.at(-1)!.id).toBe('n10');
    expect(evolutionView(nodes, 420).rows).toHaveLength(EVO_WINDOW_ROWS);
    expect(maxScrollTop(Math.min(13, EVO_MAX_ROWS), 1, EVO_WINDOW_ROWS)).toBe(1);
  });
});

describe('the Eevee family', () => {
  it('fills the window exactly, with the G-Max information row last', () => {
    const family = evolutionGraph('eevee', 20);
    expect(family).toHaveLength(EVO_WINDOW_ROWS);

    const view = evolutionView(family, 420);
    expect(view.rows).toHaveLength(10);
    expect(view.height).toBe(280);
    expect(view.edges).toHaveLength(9);
    expect(view.rows[9]).toEqual({
      id: 'eeveegmax',
      name: 'Gigantamax Eevee',
      level: 'Eeveite G',
      kind: 'gmax',
      depth: 1,
      parent: 0,
      row: 9,
      y: 252,
      x: EVO_PAD_X + EVO_INDENT,
      current: false,
      ready: false,
    });
    expect(view.rows.filter((row) => row.ready)).toHaveLength(8);
  });

  it('is the longest graph the dex can produce, and the pool covers it', () => {
    let longest = 0;
    let longestId = '';
    for (const species of playableSpecies()) {
      const rows = evolutionGraph(species.id, 100).length;
      if (rows <= longest) continue;
      longest = rows;
      longestId = species.id;
    }
    expect(longest, `longest family: ${longestId}`).toBe(10);
    expect(EVO_MAX_ROWS).toBeGreaterThanOrEqual(longest);
  });
});

describe('the band against the card', () => {
  it('ends its window on the card inner bottom edge, and eleven would not fit', () => {
    // The card is 460 × 560 and `chrome.json` bakes an 8 px bottom border into the
    // window, so its inner bottom edge is 552; the band's own top is 272 (title 250 + 22).
    const CARD_H = 560;
    const INNER_BOTTOM = CARD_H - 8;
    const BAND_TOP = 272;
    expect(272 + EVO_WINDOW_ROWS * EVO_ROW_H).toBe(552);
    expect(552).toBe(INNER_BOTTOM);
    expect(552 <= CARD_H - 8).toBe(true);
    expect(272 + 11 * EVO_ROW_H).toBeGreaterThan(552);
    expect(BAND_TOP + EVO_WINDOW_ROWS * EVO_ROW_H).toBe(INNER_BOTTOM);
  });
});

describe('the band is pure', () => {
  it('reads no random source and imports only the graph, the scroll arithmetic and its view type', () => {
    const source = readFileSync(new URL('./evolution.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Rng|rng/);
    expect(source).not.toMatch(/Math\.random|\bDate\.\b|window\.|document\./);
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['../../../evolutionGraph', '../../../scroll', './view']);
  });

  it('shares its pool and window with the scene instead of a second copy', () => {
    const source = readFileSync(new URL('../../../../scenes/panels/detail.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/HUD_DETAIL_EVO_MAX/);
    expect(source).not.toMatch(/HUD_DETAIL_EVO_ROW_H/);
    const imported = source.match(
      /import\s*\{([^}]*)\}\s*from '\.\.\/\.\.\/ui\/hud\/panels\/detail\/evolution'/,
    );
    expect(imported).not.toBeNull();
    for (const name of ['EVO_MAX_ROWS', 'EVO_WINDOW_ROWS', 'EVO_ROW_H', 'levelColumnWidth']) {
      expect(imported![1], name).toContain(name);
    }
  });
});

describe('levelColumnWidth', () => {
  it('reserves nothing on a row with no right column', () => {
    expect(levelColumnWidth(null)).toBe(0);
  });

  it('pins the per-character floor and the band inset', () => {
    expect(EVO_LEVEL_CHAR_W).toBe(6);
    expect(EVO_LEVEL_INSET).toBe(12);
    expect(levelColumnWidth('Charizardite G')).toBe(96);
    expect(levelColumnWidth('Lv 36')).toBe(42);
  });

  it('clears every right column measured on the 390 x 844 card', () => {
    // The rendered widths of the live DOM card (390×844, `?hud=dom`), level `<text>`
    // right edge to left edge. The level ends `EVO_PAD_X` inside the band, so the
    // reserve has to hold the inset as well as the text for the columns to clear.
    const rendered: Readonly<Record<string, number>> = {
      'Charizardite X': 83.27,
      'Charizardite Y': 83.27,
      'Charizardite G': 82.14,
      'Lv 16': 30.39,
      'Lv 36': 31.52,
    };
    for (const [level, width] of Object.entries(rendered)) {
      expect(levelColumnWidth(level), level).toBeGreaterThanOrEqual(EVO_PAD_X + width);
    }
  });
});

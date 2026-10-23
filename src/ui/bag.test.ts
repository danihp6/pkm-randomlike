import { describe, expect, it } from 'vitest';
import {
  BAG_CATEGORIES,
  BAG_GRID_COLS,
  BAG_GRID_GAP,
  bagCategoryFor,
  bagDiscoveredCandy,
  bagForCategory,
  bagGridCell,
  bagGridIndexAt,
  bagGridLayout,
  bagGridRows,
  cycleBagCategory,
  filterBagStacks,
  stepBagCursor,
  stepBagGrid,
  type BagGridRect,
} from './bag';

describe('bagCategoryFor', () => {
  it('maps each item kind to its pocket', () => {
    expect(bagCategoryFor('pokeball')).toBe('ball');
    expect(bagCategoryFor('greatball')).toBe('ball');
    expect(bagCategoryFor('potion')).toBe('consumable');
    expect(bagCategoryFor('paralyzeheal')).toBe('consumable');
    expect(bagCategoryFor('burnheal')).toBe('consumable');
    expect(bagCategoryFor('leftovers')).toBe('equipment');
    expect(bagCategoryFor('charcoal')).toBe('equipment');
    expect(bagCategoryFor('sitrusberry')).toBe('equipment');
    expect(bagCategoryFor('nugget')).toBe('valuable');
    expect(bagCategoryFor('cometshard')).toBe('valuable');
  });

  it('returns null for an id the catalogue does not carry', () => {
    expect(bagCategoryFor('tm01')).toBeNull();
  });
});

describe('bagForCategory', () => {
  const bag = [
    { itemId: 'pokeball', count: 5 },
    { itemId: 'potion', count: 2 },
    { itemId: 'charcoal', count: 1 },
    { itemId: 'greatball', count: 1 },
  ];

  it('keeps only the pocket stacks, in the bag order', () => {
    expect(bagForCategory(bag, 'ball').map((slot) => slot.itemId)).toEqual(['pokeball', 'greatball']);
    expect(bagForCategory(bag, 'consumable').map((slot) => slot.itemId)).toEqual(['potion']);
    expect(bagForCategory(bag, 'equipment').map((slot) => slot.itemId)).toEqual(['charcoal']);
  });

  it('has nothing to show for the empty machine pocket', () => {
    expect(bagForCategory(bag, 'machine')).toEqual([]);
  });
});

describe('cycleBagCategory', () => {
  it('wraps in both directions', () => {
    expect(cycleBagCategory('equipment', -1)).toBe('valuable');
    expect(cycleBagCategory('valuable', 1)).toBe('equipment');
    expect(cycleBagCategory('consumable', 1)).toBe('machine');
  });

  it('lists every pocket in tab order', () => {
    expect(BAG_CATEGORIES).toEqual(['equipment', 'consumable', 'machine', 'ball', 'valuable']);
  });
});

describe('stepBagCursor', () => {
  it('wraps in both directions', () => {
    expect(stepBagCursor(0, 1, 3)).toBe(1);
    expect(stepBagCursor(2, 1, 3)).toBe(0);
    expect(stepBagCursor(0, -1, 3)).toBe(2);
    expect(stepBagCursor(1, 0, 3)).toBe(1);
  });

  it('reads the first row for an empty list', () => {
    expect(stepBagCursor(0, 1, 0)).toBe(0);
    expect(stepBagCursor(4, -1, 0)).toBe(0);
  });
});

describe('bagGridRows', () => {
  it('counts the rows a count needs at five wide', () => {
    expect(bagGridRows(0)).toBe(1);
    expect(bagGridRows(5)).toBe(1);
    expect(bagGridRows(6)).toBe(2);
    expect(bagGridRows(15)).toBe(3);
    expect(bagGridRows(16)).toBe(4);
  });

  it('honours another column count, and never drops below one row', () => {
    expect(bagGridRows(10, 2)).toBe(5);
    expect(bagGridRows(3, 10)).toBe(1);
    expect(bagGridRows(-4)).toBe(1);
    expect(bagGridRows(Number.NaN)).toBe(1);
  });
});

const BAND: BagGridRect = { x: 0, y: 0, w: 304, h: 180 };
const POCKET = [
  { itemId: 'potion', count: 3 },
  { itemId: 'superpotion', count: 2 },
  { itemId: 'antidote', count: 1 },
  { itemId: 'oranberry', count: 5 },
  { itemId: 'burnheal', count: 1 },
  { itemId: 'candyred', count: 2 },
];

describe('bagGridLayout', () => {
  it('is five columns by default, with square cells', () => {
    const metrics = bagGridLayout(BAND, POCKET.length);
    expect(metrics.columns).toBe(5);
    expect(metrics.gap).toBe(BAG_GRID_GAP);
    expect(metrics.cellW).toBe(metrics.cellH);
    expect(metrics.cells).toHaveLength(metrics.rows * metrics.columns);
  });

  it('gives the route band its 56px cells over two rows', () => {
    const metrics = bagGridLayout(BAND, POCKET.length);
    expect(metrics.rows).toBe(2);
    expect(metrics.cellW).toBe(56);
    expect(metrics.cells).toHaveLength(10);
  });

  it('lays the cells out row-major on a cell + gap pitch', () => {
    const metrics = bagGridLayout(BAND, POCKET.length);
    const pitch = metrics.cellW + metrics.gap;
    for (let i = 0; i < metrics.cells.length; i++) {
      const cell = metrics.cells[i];
      expect(cell.x).toBe(metrics.cells[0].x + (i % metrics.columns) * pitch);
      expect(cell.y).toBe(metrics.cells[0].y + Math.floor(i / metrics.columns) * pitch);
      expect(cell.w).toBe(metrics.cellW);
      expect(cell.h).toBe(metrics.cellW);
    }
  });

  it('sizes the cell from whichever axis binds first', () => {
    const wide = bagGridLayout({ x: 0, y: 0, w: 600, h: 180 }, POCKET.length);
    expect(wide.cellW).toBe(87);
    const tall = bagGridLayout({ x: 0, y: 0, w: 304, h: 600 }, POCKET.length);
    expect(tall.cellW).toBe(56);
  });

  it('never exceeds the bounds it was handed', () => {
    for (const band of [BAND, { x: 12, y: 40, w: 251, h: 97 }, { x: 0, y: 0, w: 51, h: 300 }]) {
      const metrics = bagGridLayout(band, POCKET.length);
      const last = metrics.cells[metrics.cells.length - 1];
      expect(last.x + metrics.cellW).toBeLessThanOrEqual(band.x + band.w);
      expect(last.y + metrics.cellW).toBeLessThanOrEqual(band.y + band.h);
    }
  });

  it('centres a grid narrower than its band', () => {
    const metrics = bagGridLayout({ x: 0, y: 0, w: 400, h: 100 }, 10);
    expect(metrics.cellW).toBe(47);
    expect(metrics.cells[0].x).toBe(70);
    expect(metrics.cells[0].y).toBe(0);
  });

  it('caps the cell at maxCell', () => {
    expect(bagGridLayout({ x: 0, y: 0, w: 900, h: 900 }, 10, { maxCell: 56 }).cellW).toBe(56);
  });

  it('lays out a full row of empty slots for an empty pocket', () => {
    const metrics = bagGridLayout(BAND, 0);
    expect(metrics.rows).toBe(1);
    expect(metrics.cells).toHaveLength(BAG_GRID_COLS);
    expect(metrics.cells).toHaveLength(5);
  });

  it('takes explicit rows and columns', () => {
    const metrics = bagGridLayout(BAND, 3, { rows: 2, columns: 2 });
    expect(metrics.columns).toBe(2);
    expect(metrics.rows).toBe(2);
    expect(metrics.cells).toHaveLength(4);
  });
});

describe('bagGridCell', () => {
  const metrics = bagGridLayout(BAND, POCKET.length);

  it('answers the slot in range', () => {
    expect(bagGridCell(metrics, 0)).toBe(metrics.cells[0]);
    expect(bagGridCell(metrics, 9)).toBe(metrics.cells[9]);
  });

  it('answers null outside the grid', () => {
    expect(bagGridCell(metrics, 10)).toBeNull();
    expect(bagGridCell(metrics, -1)).toBeNull();
    expect(bagGridCell(metrics, Number.NaN)).toBeNull();
  });
});

describe('bagGridIndexAt', () => {
  const metrics = bagGridLayout(BAND, POCKET.length);
  const stride = metrics.cellW + metrics.gap;

  it('answers the stack under a point inside a cell', () => {
    expect(bagGridIndexAt(metrics, 28, 28, POCKET.length)).toBe(0);
    expect(bagGridIndexAt(metrics, stride + 28, 28, POCKET.length)).toBe(1);
    expect(bagGridIndexAt(metrics, 2 * stride + 28, stride + 28, 10)).toBe(7);
  });

  it('counts a point on a cell edge as inside', () => {
    expect(bagGridIndexAt(metrics, metrics.cellW, 0, POCKET.length)).toBe(0);
    expect(bagGridIndexAt(metrics, 0, metrics.cellH, POCKET.length)).toBe(0);
  });

  it('answers null in a gap, in the margin and past the count', () => {
    expect(bagGridIndexAt(metrics, metrics.cellW + 2, 28, POCKET.length)).toBeNull();
    expect(bagGridIndexAt(metrics, -4, 28, POCKET.length)).toBeNull();
    expect(bagGridIndexAt(metrics, 28, -4, POCKET.length)).toBeNull();
    expect(bagGridIndexAt(metrics, 400, 28, POCKET.length)).toBeNull();
    expect(bagGridIndexAt(metrics, 2 * stride + 28, stride + 28, 5)).toBeNull();
  });

  it('answers null for an empty pocket', () => {
    expect(bagGridIndexAt(metrics, 28, 28, 0)).toBeNull();
  });
});

describe('stepBagGrid', () => {
  it('wraps inside a full row', () => {
    expect(stepBagGrid(4, 'right', 5)).toBe(0);
    expect(stepBagGrid(0, 'left', 5)).toBe(4);
  });

  it('wraps through the rows and clamps into a partial last row', () => {
    expect(stepBagGrid(0, 'down', 7)).toBe(5);
    expect(stepBagGrid(2, 'down', 7)).toBe(6);
    expect(stepBagGrid(0, 'up', 7)).toBe(5);
  });

  it('reads 0 for an empty list and for a non-finite index', () => {
    expect(stepBagGrid(3, 'down', 0)).toBe(0);
    expect(stepBagGrid(Number.NaN, 'down', 7)).toBe(0);
  });

  it('clamps an index past the list before stepping', () => {
    expect(stepBagGrid(12, 'left', 7)).toBe(5);
  });
});

describe('filterBagStacks', () => {
  it('returns the same array for a blank query', () => {
    expect(filterBagStacks(POCKET, '')).toBe(POCKET);
    expect(filterBagStacks(POCKET, '   ')).toBe(POCKET);
  });

  it('matches the catalogue name, case-insensitively and trimmed', () => {
    expect(filterBagStacks(POCKET, 'POT').map((stack) => stack.itemId)).toEqual([
      'potion',
      'superpotion',
    ]);
    expect(filterBagStacks(POCKET, '  super  ').map((stack) => stack.itemId)).toEqual(['superpotion']);
  });

  it('never matches an antidote on "potion" and preserves the bag order', () => {
    const found = filterBagStacks(POCKET, 'potion').map((stack) => stack.itemId);
    expect(found).toEqual(['potion', 'superpotion']);
    expect(found).not.toContain('antidote');
  });

  it('answers an empty list when nothing matches', () => {
    expect(filterBagStacks(POCKET, 'masterball')).toEqual([]);
  });
});

describe('bagDiscoveredCandy', () => {
  it('answers the colour only once the run has discovered it', () => {
    expect(bagDiscoveredCandy('candyred', [])).toBeNull();
    expect(bagDiscoveredCandy('candyred', ['red'])).toBe('red');
  });

  it('answers null for a non-candy and for an unknown id', () => {
    expect(bagDiscoveredCandy('potion', ['red'])).toBeNull();
    expect(bagDiscoveredCandy('notanitem', ['red'])).toBeNull();
  });
});

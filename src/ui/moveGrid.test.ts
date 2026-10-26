import { describe, expect, it } from 'vitest';
import {
  isEmptySlot,
  moveGridCellRects,
  moveGridIndexAt,
  moveGridInfoAt,
  padMoveGridCells,
  stepMoveGridCursor,
  type MoveGridCell,
  type MoveGridOptions,
  type MoveGridSlot,
} from './moveGrid';

/** The route HUD's own moves window, the rect every geometry case is measured in. */
const HUD_WINDOW = { x: 0, y: 0, w: 452, h: 188 } as const;

function moveCell(name: string): MoveGridCell {
  return {
    name,
    type: 'Fire',
    category: 'Special',
    pp: 25,
    maxPp: 25,
    desc: `${name} burns on contact.`,
    power: 40,
    basePower: 40,
    accuracy: 100,
    baseAccuracy: 100,
    status: null,
    enabled: true,
  };
}

function options(cells: readonly MoveGridSlot[]): MoveGridOptions {
  return { ...HUD_WINDOW, cells, selected: -1, info: null };
}

describe('isEmptySlot', () => {
  it('marks the empty container and the missing slot, and nothing else', () => {
    expect(isEmptySlot({ empty: true })).toBe(true);
    expect(isEmptySlot(undefined)).toBe(true);
    expect(isEmptySlot(moveCell('Ember'))).toBe(false);
  });
});

describe('padMoveGridCells', () => {
  it('keeps the cells it was given and fills the rest with empty containers', () => {
    const ember = moveCell('Ember');
    const padded = padMoveGridCells([ember], 4);
    expect(padded).toHaveLength(4);
    expect(padded[0]).toBe(ember);
    for (let i = 1; i < 4; i++) expect(padded[i]).toEqual({ empty: true });
  });

  it('pads an empty list to four and never grows past the four slots', () => {
    const empty = padMoveGridCells([], 4);
    expect(empty).toHaveLength(4);
    for (const slot of empty) expect(slot).toEqual({ empty: true });

    const five = ['A', 'B', 'C', 'D', 'E'].map(moveCell);
    expect(padMoveGridCells(five, 4)).toHaveLength(4);
  });
});

describe('moveGridCellRects', () => {
  const rects = moveGridCellRects(options(padMoveGridCells(['A', 'B', 'C'].map(moveCell), 4)));

  it('lays out one rect per slot, a full 2x2 whatever the list holds', () => {
    expect(rects).toHaveLength(4);
    for (const rect of rects) {
      expect(rect.w).toBe(rects[0].w);
      expect(rect.h).toBe(rects[0].h);
    }
    expect(rects[1].x).toBeGreaterThan(rects[0].x);
    expect(rects[1].y).toBeCloseTo(rects[0].y, 6);
    expect(rects[2].x).toBeCloseTo(rects[0].x, 6);
    expect(rects[3].y).toBeGreaterThan(rects[1].y);
  });

  it('keeps every rect inside the window it was given, and gives none for no cells', () => {
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(HUD_WINDOW.x);
      expect(rect.y).toBeGreaterThanOrEqual(HUD_WINDOW.y);
      expect(rect.x + rect.w).toBeLessThanOrEqual(HUD_WINDOW.x + HUD_WINDOW.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(HUD_WINDOW.y + HUD_WINDOW.h);
    }
    expect(moveGridCellRects(options([]))).toHaveLength(0);
  });
});

describe('stepMoveGridCursor', () => {
  it('lands on a disabled cell when the skip is off, and passes it when it is on', () => {
    const enabled = [true, false, true, true];
    expect(stepMoveGridCursor(0, 'right', enabled, 2, false)).toBe(1);
    expect(stepMoveGridCursor(0, 'right', enabled, 2, true)).toBe(2);
  });

  it('passes over a run of disabled cells to the next enabled one', () => {
    expect(stepMoveGridCursor(0, 'right', [true, false, false, true], 4, true)).toBe(3);
    expect(stepMoveGridCursor(3, 'left', [true, false, false, true], 4, true)).toBe(0);
  });

  it('answers the starting index when no cell would be accepted', () => {
    expect(stepMoveGridCursor(1, 'right', [false, false, false], 2, true)).toBe(1);
  });

  it('holds the row at the top and bottom edges of the grid', () => {
    expect(stepMoveGridCursor(0, 'up', [true, true, true, true], 2, false)).toBe(0);
    expect(stepMoveGridCursor(2, 'down', [true, true, true, true], 2, false)).toBe(2);
  });

  it('clamps a direction that would leave a partial last row back into it', () => {
    expect(stepMoveGridCursor(0, 'down', [true, true, true], 2, false)).toBe(2);
    expect(stepMoveGridCursor(1, 'down', [true, true, true], 2, false)).toBe(2);
    expect(stepMoveGridCursor(1, 'down', [true, true, true], 2, true)).toBe(2);
  });

  it('wraps a horizontal step round its own row', () => {
    expect(stepMoveGridCursor(1, 'right', [true, true, true, true], 2, false)).toBe(0);
    expect(stepMoveGridCursor(0, 'left', [true, true, true, true], 2, false)).toBe(1);
  });

  it('answers 0 for an empty grid and reads cols under 1 as one column', () => {
    expect(stepMoveGridCursor(0, 'down', [], 2, false)).toBe(0);
    expect(stepMoveGridCursor(0, 'down', [true, true, true], 0, false)).toBe(1);
  });

  it('clamps an index outside the grid before the first step', () => {
    expect(stepMoveGridCursor(Number.NaN, 'right', [true, true], 2, false)).toBe(1);
    expect(stepMoveGridCursor(9, 'left', [true, true, true, true], 2, false)).toBe(2);
  });
});

describe('moveGridIndexAt', () => {
  const padded = moveGridCellRects(options(padMoveGridCells(['A', 'B', 'C'].map(moveCell), 4)));

  it('answers for the empty container too', () => {
    const last = padded[3];
    expect(moveGridIndexAt(padded, last.x + last.w / 2, last.y + last.h / 2)).toBe(3);
  });

  it('is null outside every rect and in the gutter between two columns', () => {
    const first = padded[0];
    const second = padded[1];
    expect(moveGridIndexAt(padded, first.x - 1, first.y - 1)).toBeNull();
    expect(moveGridIndexAt(padded, (first.x + first.w + second.x) / 2, first.y + first.h / 2)).toBe(
      null,
    );
  });
});

describe('moveGridInfoAt', () => {
  const rects = moveGridCellRects(options(padMoveGridCells([moveCell('Ember')], 4)));
  const rect = rects[0];
  /** The middle of the ⓘ button's own corner of the cell. */
  const corner = { x: rect.w - 14 - 11, y: 8 + 11 };

  it('reads a move cell at its ⓘ corner', () => {
    expect(moveGridInfoAt(moveCell('Ember'), rect, corner.x, corner.y)).toBe(true);
    expect(moveGridInfoAt(moveCell('Ember'), rect, corner.x, corner.y + 22)).toBe(false);
  });

  it('reads nothing at an empty container, at the very same point', () => {
    const empty: MoveGridSlot = { empty: true };
    expect(moveGridInfoAt(empty, rect, corner.x, corner.y)).toBe(false);
    expect(moveGridInfoAt(undefined, rect, corner.x, corner.y)).toBe(false);
    expect(moveGridInfoAt(moveCell('Ember'), undefined, corner.x, corner.y)).toBe(false);
  });
});

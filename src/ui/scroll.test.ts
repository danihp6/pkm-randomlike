import { describe, expect, it } from 'vitest';
import { clampScrollTop, maxScrollTop, scrollByRows, stepGridCursor, visibleRange } from './scroll';

describe('maxScrollTop', () => {
  it('reads the last row that still fills the window, at the band’s 2x2 shape', () => {
    expect(maxScrollTop(0, 2, 2)).toBe(0);
    expect(maxScrollTop(4, 2, 2)).toBe(0);
    expect(maxScrollTop(5, 2, 2)).toBe(1);
    expect(maxScrollTop(6, 2, 2)).toBe(1);
    expect(maxScrollTop(7, 2, 2)).toBe(2);
  });

  it('reads 0 rather than Infinity or NaN for a non-positive column count', () => {
    expect(maxScrollTop(5, 0, 2)).toBe(0);
    expect(maxScrollTop(5, -1, 2)).toBe(0);
  });

  it('reads 0 for a non-positive row count', () => {
    expect(maxScrollTop(5, 2, 0)).toBe(0);
    expect(maxScrollTop(5, 2, -2)).toBe(0);
  });

  it('works at a non-2x2 shape (three columns, one row)', () => {
    expect(maxScrollTop(3, 3, 1)).toBe(0);
    expect(maxScrollTop(4, 3, 1)).toBe(1);
    expect(maxScrollTop(7, 3, 1)).toBe(2);
  });
});

describe('clampScrollTop', () => {
  it('clamps into [0, maxTop], truncating to whole rows', () => {
    expect(clampScrollTop(-3, 2)).toBe(0);
    expect(clampScrollTop(9, 2)).toBe(2);
    expect(clampScrollTop(1.6, 3)).toBe(1);
    expect(clampScrollTop(1, 0)).toBe(0);
    expect(clampScrollTop(3, 2.7)).toBe(2);
  });

  it('treats a non-finite argument as 0', () => {
    expect(clampScrollTop(Number.NaN, 2)).toBe(0);
    expect(clampScrollTop(2, Number.NaN)).toBe(0);
    expect(clampScrollTop(Number.POSITIVE_INFINITY, 2)).toBe(0);
    expect(clampScrollTop(2, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('works at a non-2x2 shape (three columns, one row)', () => {
    expect(clampScrollTop(-1, 2)).toBe(0);
    expect(clampScrollTop(5, 2)).toBe(2);
    expect(clampScrollTop(1.9, 2)).toBe(1);
  });
});

describe('scrollByRows', () => {
  it('steps one row and clamps at both ends', () => {
    expect(scrollByRows(0, 1, 2)).toBe(1);
    expect(scrollByRows(2, 1, 2)).toBe(2);
    expect(scrollByRows(0, -1, 2)).toBe(0);
    expect(scrollByRows(1, 0, 2)).toBe(1);
  });

  it('steps several rows at once', () => {
    expect(scrollByRows(0, 3, 5)).toBe(3);
    expect(scrollByRows(5, -3, 5)).toBe(2);
  });

  it('works at a non-2x2 shape (three columns, one row)', () => {
    expect(scrollByRows(0, 1, 2)).toBe(1);
    expect(scrollByRows(2, 1, 2)).toBe(2);
    expect(scrollByRows(0, -1, 2)).toBe(0);
  });
});

describe('visibleRange', () => {
  it('reads the half-open item range the window shows', () => {
    expect(visibleRange(0, 2, 2, 5)).toEqual({ start: 0, end: 4 });
    expect(visibleRange(1, 2, 2, 5)).toEqual({ start: 2, end: 5 });
  });

  it('clamps a top past the window’s end', () => {
    expect(visibleRange(4, 2, 2, 5)).toEqual({ start: 2, end: 5 });
  });

  it('reads an empty range for an empty pool', () => {
    expect(visibleRange(0, 2, 2, 0)).toEqual({ start: 0, end: 0 });
  });

  it('works at a non-2x2 shape (three columns, one row)', () => {
    expect(visibleRange(0, 3, 1, 7)).toEqual({ start: 0, end: 3 });
    expect(visibleRange(2, 3, 1, 7)).toEqual({ start: 6, end: 7 });
    expect(visibleRange(9, 3, 1, 7)).toEqual({ start: 6, end: 7 });
  });
});

describe('stepGridCursor', () => {
  it('scrolls the cursor row into the window', () => {
    expect(stepGridCursor(3, 1, 12, 2, 2, 0)).toEqual({ cursor: 4, top: 1 });
    expect(stepGridCursor(4, -1, 12, 2, 2, 1)).toEqual({ cursor: 3, top: 1 });
  });

  it('wraps the cursor and follows it to the far end', () => {
    expect(stepGridCursor(0, -1, 12, 2, 2, 0)).toEqual({ cursor: 11, top: 4 });
    expect(stepGridCursor(11, 1, 12, 2, 2, 4)).toEqual({ cursor: 0, top: 0 });
  });

  it('keeps a short list in one window', () => {
    expect(stepGridCursor(0, 1, 3, 2, 2, 0)).toEqual({ cursor: 1, top: 0 });
    expect(stepGridCursor(2, 1, 3, 2, 2, 0)).toEqual({ cursor: 0, top: 0 });
  });

  it('reads cursor 0 for an empty grid', () => {
    expect(stepGridCursor(0, 1, 0, 2, 2, 0)).toEqual({ cursor: 0, top: 0 });
  });
});

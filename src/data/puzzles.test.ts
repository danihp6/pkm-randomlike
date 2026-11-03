import { describe, expect, it } from 'vitest';
import { getItem } from './items';
import { PUZZLES, PUZZLE_ROOM, PUZZLE_STACK, puzzleRowsForMap } from './puzzles';

describe('the puzzle room table', () => {
  it('hangs the leaf from map 2 on, one floor in five', () => {
    expect(PUZZLE_ROOM).toEqual({ fromMap: 2, chance: 0.2 });
  });

  it('gives every row a switch count the room can draw', () => {
    for (const row of PUZZLES) {
      expect(row.switches, row.id).toBeGreaterThanOrEqual(2);
      expect(row.switches, row.id).toBeLessThanOrEqual(5);
      expect(Number.isInteger(row.switches), row.id).toBe(true);
    }
  });

  it('pays a catalogue item that exists and is a valuable', () => {
    for (const row of PUZZLES) {
      const item = getItem(row.reward);
      expect(item, row.id).toBeDefined();
      expect(item!.kind, row.id).toBe('valuable');
      expect(item!.price, row.id).toBeGreaterThan(0);
    }
  });

  it('orders the rows by their first floor, never backwards', () => {
    const floors = PUZZLES.map((row) => row.fromMap);
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
    expect(floors[0]).toBe(PUZZLE_ROOM.fromMap);
  });

  it('names each row once', () => {
    const ids = PUZZLES.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resets the sequence on a wrong press in every shipped row', () => {
    for (const row of PUZZLES) expect(row.wrongResets, row.id).toBe(true);
  });

  it('never answers an empty list from map 2 on', () => {
    for (let mapIndex = PUZZLE_ROOM.fromMap; mapIndex <= 9; mapIndex++) {
      expect(puzzleRowsForMap(mapIndex).length, `map ${mapIndex}`).toBeGreaterThan(0);
    }
  });

  it('filters the rows by their own first floor, in table order', () => {
    expect(puzzleRowsForMap(1)).toEqual([]);
    expect(puzzleRowsForMap(2).map((row) => row.id)).toEqual(['three']);
    expect(puzzleRowsForMap(4).map((row) => row.id)).toEqual(['three']);
    expect(puzzleRowsForMap(5).map((row) => row.id)).toEqual(['three', 'four']);
    expect(puzzleRowsForMap(99).map((row) => row.id)).toEqual(['three', 'four']);
  });
});

describe('the gym puzzle stack', () => {
  it('is never empty and starts on ice', () => {
    expect(PUZZLE_STACK.length).toBeGreaterThan(0);
    expect(PUZZLE_STACK[0].id).toBe('ice');
  });

  it('names each entry once, never empty', () => {
    for (const entry of PUZZLE_STACK) expect(entry.id.length, entry.id).toBeGreaterThan(0);
    const ids = PUZZLE_STACK.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fills the puzzle room of the gym and nothing else', () => {
    for (const entry of PUZZLE_STACK) expect(entry.room, entry.id).toBe('puzzle');
  });

  it('opens on a badge 1-8 and never walks backwards down the table', () => {
    let previous = 0;
    for (const entry of PUZZLE_STACK) {
      expect(Number.isInteger(entry.fromBadge), entry.id).toBe(true);
      expect(entry.fromBadge, entry.id).toBeGreaterThanOrEqual(1);
      expect(entry.fromBadge, entry.id).toBeLessThanOrEqual(8);
      expect(entry.fromBadge, entry.id).toBeGreaterThanOrEqual(previous);
      previous = entry.fromBadge;
    }
  });

  it('holds a positive whole number of holes and drops into one of the four rooms', () => {
    for (const entry of PUZZLE_STACK) {
      expect(Number.isInteger(entry.holes), entry.id).toBe(true);
      expect(entry.holes, entry.id).toBeGreaterThan(0);
      expect(Number.isInteger(entry.dropsInto), entry.id).toBe(true);
      expect(entry.dropsInto, entry.id).toBeGreaterThanOrEqual(0);
      expect(entry.dropsInto, entry.id).toBeLessThanOrEqual(3);
    }
  });
});

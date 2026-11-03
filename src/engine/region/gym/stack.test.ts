import { describe, expect, it } from 'vitest';
import { PUZZLE_STACK } from '../../../data/puzzles';
import { gymPuzzlesFor, puzzleStackIds } from './stack';

const BADGES = [1, 2, 3, 4, 5, 6, 7, 8];

describe("the gym's puzzle stack", () => {
  it('starts a badge-1 gym on the ice entry', () => {
    const eligible = gymPuzzlesFor(1);
    expect(eligible[0]).toBe(PUZZLE_STACK[0]);
    expect(eligible[0].id).toBe('ice');
  });

  it('answers no puzzle below the first badge the stack covers', () => {
    expect(gymPuzzlesFor(0)).toEqual([]);
    expect(gymPuzzlesFor(-1)).toEqual([]);
  });

  it('answers every badge a prefix of the table, in table order', () => {
    for (const badge of BADGES) {
      const eligible = gymPuzzlesFor(badge);
      expect(eligible, `badge ${badge}`).toEqual(PUZZLE_STACK.slice(0, eligible.length));
      for (const entry of eligible) expect(entry.fromBadge, entry.id).toBeLessThanOrEqual(badge);
    }
    expect(gymPuzzlesFor(8)).toEqual(PUZZLE_STACK);
  });

  it('never narrows as the badge climbs', () => {
    for (let badge = 1; badge < 8; badge++) {
      expect(gymPuzzlesFor(badge + 1).length).toBeGreaterThanOrEqual(gymPuzzlesFor(badge).length);
    }
  });

  it("lists the table's ids in stack order", () => {
    expect(puzzleStackIds()).toEqual(PUZZLE_STACK.map((entry) => entry.id));
    expect(puzzleStackIds()[0]).toBe('ice');
  });
});

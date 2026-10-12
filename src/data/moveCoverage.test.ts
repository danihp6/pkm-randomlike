import { describe, expect, it } from 'vitest';
import { allMoves } from './dex';
import meta from './dex/meta.json';
import { MOVE_COVERAGE, isUnportedMove, moveCoverage, unportedMoveIds } from './moveCoverage';

const STATUSES = ['port', 'no-op', 'excluded'];

describe('move coverage manifest', () => {
  it('classifies every shipped move exactly once, in name order', () => {
    expect(MOVE_COVERAGE).toHaveLength(meta.counts.moves);
    expect(new Set(MOVE_COVERAGE.map((entry) => entry.id)).size).toBe(MOVE_COVERAGE.length);

    for (const move of allMoves()) expect(moveCoverage(move.id)?.name).toBe(move.name);

    const names = MOVE_COVERAGE.map((entry) => entry.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('uses only the three statuses and always names the seam', () => {
    for (const entry of MOVE_COVERAGE) {
      expect(STATUSES).toContain(entry.status);
      expect(entry.note.length).toBeGreaterThan(0);
      expect(entry.id).toBe(entry.id.toLowerCase());
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('looks an id up the way `getMove` does', () => {
    expect(moveCoverage('Tackle')).toBe(moveCoverage('tackle'));
    expect(moveCoverage('tackle ')).toBe(moveCoverage('tackle'));
    expect(moveCoverage('Tackle')?.name).toBe('Tackle');
    expect(moveCoverage('will-o-wisp')?.id).toBe('willowisp');
  });

  it('reports an unknown id as unknown, not as unported', () => {
    expect(moveCoverage('notamove')).toBeUndefined();
    expect(moveCoverage('')).toBeUndefined();
    expect(isUnportedMove('notamove')).toBe(false);
  });

  it('has no unported move left, so the port list is empty', () => {
    const noOps = MOVE_COVERAGE.filter((entry) => entry.status === 'no-op').map((entry) => entry.id);
    expect(noOps).toEqual([]);
    expect(unportedMoveIds()).toEqual(noOps);
    for (const entry of MOVE_COVERAGE) expect(isUnportedMove(entry.id)).toBe(false);
  });
});

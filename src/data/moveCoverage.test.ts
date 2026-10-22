import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { allMoves } from './dex';
import meta from './dex/meta.json';
import { MOVE_COVERAGE, isUnportedMove, moveCoverage, unportedMoveIds } from './moveCoverage';

const STATUSES = ['port', 'no-op', 'excluded'];

const doc = readFileSync(
  fileURLToPath(new URL('../../docs/balance/effect-coverage.md', import.meta.url)),
  'utf8',
);

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

  it('lists the moves the engine does nothing for, and only those', () => {
    const noOps = MOVE_COVERAGE.filter((entry) => entry.status === 'no-op').map((entry) => entry.id);
    expect(noOps.length).toBeGreaterThan(0);
    expect(unportedMoveIds()).toEqual(noOps);
    for (const entry of MOVE_COVERAGE) {
      expect(isUnportedMove(entry.id), entry.id).toBe(entry.status === 'no-op');
    }
  });

  it('says so in the generated table: a real no-op count and no phantom row', () => {
    const header = /## Moves — \d+ total \(\d+ port, (\d+) no-op/.exec(doc);
    expect(header?.[1]).toBe(String(unportedMoveIds().length));
    expect(Number(header?.[1] ?? '0')).toBeGreaterThan(0);
    expect(doc).not.toContain('| <name> |');
  });

  it('reads a multi-line registry row as ported, whatever the checkout line end', () => {
    for (const name of ['Huge Power', 'Pure Power', 'Sand Veil', 'Snow Cloak', 'Thick Fat']) {
      expect(doc, name).toContain(`| ${name} | \`port\` |`);
    }
  });
});

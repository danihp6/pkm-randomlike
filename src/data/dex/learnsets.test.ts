import { describe, expect, it } from 'vitest';
import { learnableBy, learnsetOf, levelUpMoves, parseLearnSource } from './learnsets';

describe('learnset accessors', () => {
  it('parses Showdown source codes', () => {
    expect(parseLearnSource('9L24')).toEqual({ code: '9L24', gen: 9, method: 'level', level: 24 });
    expect(parseLearnSource('9M')).toEqual({ code: '9M', gen: 9, method: 'tm', level: null });
    expect(parseLearnSource('8T')).toEqual({ code: '8T', gen: 8, method: 'tutor', level: null });
    expect(parseLearnSource('9E')).toEqual({ code: '9E', gen: 9, method: 'egg', level: null });
    expect(parseLearnSource('8V')).toEqual({ code: '8V', gen: 8, method: 'other', level: null });
  });

  it('reads a species learnset, or undefined when it has none', () => {
    const bulbasaur = learnsetOf('bulbasaur');
    expect(bulbasaur).toBeDefined();
    expect(bulbasaur!.tackle!.some((source) => source.method === 'level')).toBe(true);
    expect(learnsetOf('not-a-species')).toBeUndefined();
  });

  it('returns the level-up moves available at a level, in learn order', () => {
    expect(levelUpMoves('bulbasaur', 1).map((move) => move.moveId)).toEqual([
      'growl',
      'tackle',
    ]);
    expect(levelUpMoves('bulbasaur', 12).map((move) => move.moveId)).toEqual([
      'growl',
      'tackle',
      'vinewhip',
      'growth',
      'leechseed',
      'razorleaf',
    ]);
    expect(levelUpMoves('not-a-species', 100)).toEqual([]);
  });

  it('lists every move a species can learn by a given method', () => {
    const level = learnableBy('bulbasaur', 'level');
    expect(level).toContain('tackle');
    expect(level).toContain('powerwhip');
    expect(learnableBy('bulbasaur', 'tm')).toContain('protect');
    expect(learnableBy('not-a-species', 'level')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { allMoves, getMove, isDamaging, moveByType } from './moves';

describe('move accessors', () => {
  it('finds a move by id', () => {
    expect(getMove('tackle')?.name).toBe('Tackle');
    expect(getMove('Thunderbolt')?.basePower).toBe(90);
    expect(getMove('not-a-move')).toBeUndefined();
  });

  it('lists moves by type, case-insensitively', () => {
    const fire = moveByType('Fire');
    expect(fire.length).toBeGreaterThan(0);
    expect(fire.every((move) => move.type === 'Fire')).toBe(true);
    expect(fire.some((move) => move.id === 'ember')).toBe(true);
    expect(moveByType('fire')).toHaveLength(fire.length);
    expect(moveByType('Stellar')).toEqual([]);
  });

  it('treats any non-status move as damaging, even with variable power', () => {
    expect(isDamaging(getMove('tackle')!)).toBe(true);
    expect(isDamaging(getMove('seismictoss')!)).toBe(true);
    expect(isDamaging(getMove('protect')!)).toBe(false);
    expect(isDamaging(getMove('swordsdance')!)).toBe(false);
  });

  it('exposes the whole generated move set', () => {
    expect(allMoves().length).toBe(685);
  });
});

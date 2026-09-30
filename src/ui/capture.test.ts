import { describe, expect, it } from 'vitest';
import { CAPTURE_HELD_SHAKES, CAPTURE_SHAKES, captureBeat } from './capture';

describe('captureBeat', () => {
  it('holds through four shakes on a catch', () => {
    expect(captureBeat(4, true)).toEqual({ shakes: CAPTURE_HELD_SHAKES, held: true });
    expect(captureBeat(0, true)).toEqual({ shakes: CAPTURE_HELD_SHAKES, held: true });
  });

  it('breaks on the interrupted shake after a failure', () => {
    expect(captureBeat(0, false)).toEqual({ shakes: 1, held: false });
    expect(captureBeat(2, false)).toEqual({ shakes: 2, held: false });
  });

  it('never plays fewer than one shake or more than the classic three', () => {
    expect(captureBeat(9, false)).toEqual({ shakes: CAPTURE_SHAKES, held: false });
    expect(captureBeat(-3, false)).toEqual({ shakes: 1, held: false });
  });
});

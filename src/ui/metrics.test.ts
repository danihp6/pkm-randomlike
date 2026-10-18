import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import {
  HP_CUE_BLOCKS,
  HP_CUE_GAP,
  LOW_HP_FRACTION,
  hpColorInt,
  hpCueNotches,
  hpFraction,
  isLowHp,
  statusAbbreviation,
} from './metrics';

describe('hp gauges', () => {
  it('clamps the HP fraction to 0..1', () => {
    expect(hpFraction(50, 100)).toBe(0.5);
    expect(hpFraction(-5, 100)).toBe(0);
    expect(hpFraction(150, 100)).toBe(1);
    expect(hpFraction(1, 0)).toBe(0);
  });

  it('moves green to yellow to red at the classic thresholds', () => {
    expect(hpColorInt(1)).toBe(0x4ad15c);
    expect(hpColorInt(0.51)).toBe(0x4ad15c);
    expect(hpColorInt(0.5)).toBe(0xf5c242);
    expect(hpColorInt(0.21)).toBe(0xf5c242);
    expect(hpColorInt(0.2)).toBe(0xef4444);
    expect(hpColorInt(0)).toBe(0xef4444);
  });

  it('reads the danger band as the living fifth', () => {
    expect(LOW_HP_FRACTION).toBe(0.2);
    expect(isLowHp(1)).toBe(false);
    expect(isLowHp(0.21)).toBe(false);
    expect(isLowHp(0.2)).toBe(true);
    expect(isLowHp(0.01)).toBe(true);
    expect(isLowHp(0)).toBe(false);
  });

  it('cuts a fill into four blocks, and leaves a narrow one whole', () => {
    expect(HP_CUE_BLOCKS).toBe(4);
    expect(HP_CUE_GAP).toBe(2);
    expect(hpCueNotches(192)).toEqual([48, 96, 144]);
    expect(hpCueNotches(38)).toEqual([10, 19, 29]);
    expect(hpCueNotches(16)).toEqual([4, 8, 12]);
    expect(hpCueNotches(15)).toEqual([]);
    expect(hpCueNotches(0)).toEqual([]);
    expect(hpCueNotches(Number.NaN)).toEqual([]);
  });
});

describe('status badges', () => {
  it('abbreviates a status and reads empty when healthy', () => {
    expect(statusAbbreviation('brn')).toBe('BRN');
    expect(statusAbbreviation('tox')).toBe('TOX');
    expect(statusAbbreviation(null)).toBeNull();
  });

  it('draws the chip from the table, three characters in either locale', () => {
    setLocale('es');
    expect(statusAbbreviation('brn')).toBe('QUE');
    expect(statusAbbreviation('slp')).toBe('DOR');
    expect(statusAbbreviation('frz')?.length).toBe(3);
    setLocale('en');
    expect(statusAbbreviation('brn')).toBe('BRN');
  });
});

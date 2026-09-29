import { describe, expect, it } from 'vitest';
import { hpColorInt, hpFraction, statusAbbreviation } from './metrics';

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
});

describe('status badges', () => {
  it('abbreviates a status and reads empty when healthy', () => {
    expect(statusAbbreviation('brn')).toBe('BRN');
    expect(statusAbbreviation('tox')).toBe('TOX');
    expect(statusAbbreviation(null)).toBeNull();
  });
});

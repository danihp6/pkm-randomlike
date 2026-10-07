import { describe, expect, it } from 'vitest';
import { battleSpriteHeight } from './spriteSize';

describe('battleSpriteHeight', () => {
  it('grows with height', () => {
    expect(battleSpriteHeight(3.7)).toBeGreaterThan(battleSpriteHeight(0.3));
    expect(battleSpriteHeight(20)).toBeGreaterThan(battleSpriteHeight(2));
  });

  it('keeps the real range on stage', () => {
    const scatterbug = battleSpriteHeight(0.3);
    const regigigas = battleSpriteHeight(3.7);
    expect(regigigas).toBeGreaterThan(scatterbug * 3);
    expect(regigigas).toBeLessThanOrEqual(260);
  });

  it('clamps the extremes', () => {
    expect(battleSpriteHeight(0.1)).toBe(68);
    expect(battleSpriteHeight(20)).toBe(260);
  });
});

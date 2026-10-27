import { describe, expect, it, vi } from 'vitest';
import { monIdleFrames } from './BattleScene';

vi.mock('phaser', () => {
  class Scene {}
  return { default: { Scene, Input: { Keyboard: { KeyCodes: {} } } } };
});

vi.mock('./BootScene', () => ({
  BATTLE_MON_TEXTURE_KEY: 'battle:mon',
  BATTLE_PLATFORM_TEXTURE_KEY: 'battle:platform',
}));

describe('monIdleFrames', () => {
  it('keeps the manifest row when the texture is whole', () => {
    expect(monIdleFrames(6, 6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('clamps to a one-frame texture', () => {
    expect(monIdleFrames(6, 1)).toEqual([0]);
  });

  it('answers nothing for a texture that never loaded', () => {
    expect(monIdleFrames(6, 0)).toEqual([]);
  });

  it('never grows past the manifest row', () => {
    expect(monIdleFrames(4, 9)).toEqual([0, 1, 2, 3]);
  });

  it('answers nothing for a broken input', () => {
    expect(monIdleFrames(0, 3)).toEqual([]);
    expect(monIdleFrames(Number.NaN, 3)).toEqual([]);
    expect(monIdleFrames(6, Number.POSITIVE_INFINITY)).toEqual([]);
  });
});

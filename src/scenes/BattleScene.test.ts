import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

/**
 * The scene draws with Phaser, so the one figure it owes the run cannot be played
 * headless: this reads the seam itself, the `src/ui/hud/panels/detail` precedent.
 * `battleTallies`' own arithmetic is covered by `src/engine/run/battleLink.test.ts`.
 */
const SOURCE = readFileSync(fileURLToPath(new URL('./BattleScene.ts', import.meta.url)), 'utf8');

describe('returnToRoute', () => {
  it('reads the tallies off the finished battle’s own log and player party', () => {
    const calls = SOURCE.match(
      /tallies: battleTallies\(this\.state\.log, this\.state\.sides\.player\.party\)/g,
    );
    expect(calls).toHaveLength(1);
  });

  it('imports the reader from the run engine, not from its own arithmetic', () => {
    expect(SOURCE).toContain('  battleTallies,\n');
    expect(SOURCE).not.toContain('function battleTallies');
  });

  it('keeps the fielded-id list beside the tallies, unchanged', () => {
    expect(SOURCE).toContain('used: [...this.state.usedFighterIds],');
  });
});

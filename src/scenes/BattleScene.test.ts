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

/**
 * The target step is scene wiring over an engine rule, so the seam is read from the
 * source: `targetStepFor`'s four cases are covered by `src/engine/battle/commands.test.ts`,
 * and the card's prompt row by the `battle-moves` panel's own tests.
 */
describe('the target step', () => {
  it('asks the engine s own predicate once and keeps no copy of it', () => {
    expect(SOURCE.match(/targetStepFor\(/g)).toHaveLength(1);
    expect(SOURCE).toContain('  targetStepFor,\n');
    expect(SOURCE).not.toContain('needsTargetStep');
    expect(SOURCE).not.toContain('const SPREAD_TARGETS');
  });

  it('keeps the card open through the step and names the marked foe', () => {
    expect(SOURCE).toContain("open: this.mode === 'moves' || this.mode === 'target',");
    expect(SOURCE).toContain("this.mode === 'target' && this.targetSlot !== null");
    expect(SOURCE).toContain("this.slotFighter('enemy', this.targetSlot)?.name ?? null");
  });
});

/**
 * The command window is scene wiring over the `battle-command` panel's pure view,
 * so the seam is read from the source: the grid arithmetic is that panel's own
 * `view.test.ts`, and the card is `battle-moves`' `battleMovesBox`.
 */
describe('the DOM command window', () => {
  it('is pushed once, from the emit point the other cards use', () => {
    const pushes = SOURCE.match(
      /this\.commandController\?\.update\(this\.battleCommandInput\(menu\)\);/g,
    );
    expect(pushes).toHaveLength(1);
    expect(SOURCE.match(/mountBattleCommand\(/g)).toHaveLength(1);
  });

  it('mounts and disposes with the other DOM panels', () => {
    expect(SOURCE).toContain('    this.mountBattleCommandPanel();\n');
    expect(SOURCE).toContain('      this.disposeCommandPanel();\n');
    expect(SOURCE).toContain(
      'this.commandController = mountBattleCommand(host, (intent) => this.onBattleCommandIntent(intent));',
    );
  });

  it('draws no canvas window at all: the card is the command window', () => {
    expect(SOURCE).not.toContain('renderCommandMenu');
    expect(SOURCE).not.toContain('menuPanel');
  });
});

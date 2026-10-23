import { h, render } from 'preact';
import type { HudState } from '../../state';
import { BattleHp } from './battleHp';
import { battleHpView, type BattleHpView, type Viewport } from './view';

export type BattleHpController = Readonly<{
  /** Pushes a snapshot; a changed `fraction` starts that box's fill transition. */
  update(state: HudState): void;
  dispose(): void;
}>;

/**
 * Mounts the boxes into `host` and returns the controller the scene feeds. The
 * layer paints empty until the first snapshot, so `[data-hud-battle-hp]` is there
 * from the moment the battle mounts. Preact reuses the cards between snapshots, so
 * a fill keeps its own width transition instead of restarting from zero.
 */
export function mountBattleHp(
  host: Element,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
  viewport: Viewport,
): BattleHpController {
  const container = document.createElement('div');
  container.className = 'battle-hp-mount';
  host.appendChild(container);

  let view: BattleHpView = { boxes: [] };
  const paint = (): void => {
    render(h(BattleHp, { view }), container);
  };
  paint();

  return {
    update: (state: HudState): void => {
      view = battleHpView(state, viewport, doubles);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

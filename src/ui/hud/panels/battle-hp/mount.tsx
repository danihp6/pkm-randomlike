import { h, render } from 'preact';
import type { HudState } from '../../state';
import { BattleHp } from './battleHp';
import { battleHpView, type BattleHpView, type Viewport } from './view';

export type BattleHpDoubles = Readonly<{ enemy: boolean; player: boolean }>;

export type BattleHpController = Readonly<{
  /** Pushes a snapshot and the viewport it must paint in; a changed `fraction` starts that box's fill transition. */
  update(state: HudState, viewport: Viewport, doubles: BattleHpDoubles): void;
  dispose(): void;
}>;

/** The empty layer the mount paints, so `[data-hud-battle-hp]` exists before the first push. */
const EMPTY_VIEW: BattleHpView = {
  boxes: [],
  foeBalls: [],
  foeBallsBox: null,
  stageChips: [],
  stageBox: null,
};

/**
 * Mounts the boxes into `host` and returns the controller the scene feeds. The layer
 * paints empty until the first push; every push carries its own viewport, so a window
 * that changes size mid-battle re-lays the boxes out instead of keeping the rects the
 * mount happened to see. Preact reuses the cards between pushes, so a fill keeps its
 * own width transition instead of restarting from zero.
 */
export function mountBattleHp(host: Element): BattleHpController {
  const container = document.createElement('div');
  container.className = 'battle-hp-mount';
  host.appendChild(container);

  const paint = (view: BattleHpView): void => {
    render(h(BattleHp, { view }), container);
  };
  paint(EMPTY_VIEW);

  return {
    update: (state: HudState, viewport: Viewport, doubles: BattleHpDoubles): void => {
      paint(battleHpView(state, viewport, doubles));
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

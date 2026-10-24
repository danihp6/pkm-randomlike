import { h, render } from 'preact';
import { BattleSwitchPanel } from './battleSwitchPanel';
import { battleSwitchView, type BattleSwitchInput, type BattleSwitchView } from './view';

/** The panel's own command channel: plain data, never a battle state. */
export type BattleSwitchIntent =
  Readonly<{ type: 'switch'; index: number }> | Readonly<{ type: 'back' }>;

export type BattleSwitchController = Readonly<{
  /** Pushes the grid's state; a closed grid hides the card but keeps it mounted. */
  update(input: BattleSwitchInput): void;
  dispose(): void;
}>;

/** The view painted on mount, so the layer's card exists before the first snapshot. */
const CLOSED: BattleSwitchInput = {
  open: false,
  card: { x: 0, y: 0, w: 0, h: 0 },
  rows: [],
  selected: 0,
};

/**
 * Mounts the battle's switch grid into `host` and returns the controller the scene feeds.
 * The empty card is painted on mount, so `[data-hud-panel="battle-switch"]` is there from
 * the moment the battle mounts. Preact reuses the rows between pushes, so a press keeps
 * its own pointer target instead of remounting under it.
 */
export function mountBattleSwitch(
  host: Element,
  onIntent?: (intent: BattleSwitchIntent) => void,
): BattleSwitchController {
  const container = document.createElement('div');
  container.className = 'battle-switch-mount';
  host.appendChild(container);

  let view: BattleSwitchView = battleSwitchView(CLOSED);
  const paint = (): void => {
    render(h(BattleSwitchPanel, { view, onIntent }), container);
  };
  paint();

  return {
    update: (input: BattleSwitchInput): void => {
      view = battleSwitchView(input);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

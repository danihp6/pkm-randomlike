import { h, render } from 'preact';
import { BattleCommandPanel } from './battleCommandPanel';
import { battleCommandView, type BattleCommandInput, type BattleCommandView } from './view';

/** The panel's own command channel: plain data, never a battle state. */
export type BattleCommandIntent =
  | Readonly<{ type: 'hover'; index: number }>
  | Readonly<{ type: 'press'; index: number }>
  | Readonly<{ type: 'info' }>;

export type BattleCommandController = Readonly<{
  /** Pushes the window's state; a closed window hides the card but keeps it mounted. */
  update(input: BattleCommandInput): void;
  dispose(): void;
}>;

/** The view painted on mount, so the layer's card exists before the first battle snapshot. */
const CLOSED: BattleCommandInput = {
  open: false,
  card: { x: 0, y: 0, w: 0, h: 0 },
  rows: [],
  selected: 0,
  infoSelected: false,
  infoLabel: '',
};

/**
 * Mounts the command window into `host` and returns the controller the scene feeds.
 * The closed card is painted on mount, so `[data-hud-panel="battle-command"]` is
 * there from the moment the battle mounts. Preact reuses the card between pushes,
 * so a press keeps its own focus instead of remounting under the pointer.
 */
export function mountBattleCommand(
  host: Element,
  onIntent?: (intent: BattleCommandIntent) => void,
): BattleCommandController {
  const container = document.createElement('div');
  container.className = 'battle-command-mount';
  host.appendChild(container);

  let view: BattleCommandView = battleCommandView(CLOSED);
  const paint = (): void => {
    render(h(BattleCommandPanel, { view, onIntent }), container);
  };
  paint();

  return {
    update: (input: BattleCommandInput): void => {
      view = battleCommandView(input);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

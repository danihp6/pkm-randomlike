import { h, render } from 'preact';
import { BattleMoves } from './battleMoves';
import { battleMovesView, type BattleMovesInput, type BattleMovesView } from './view';

/** The panel's own command channel: plain data, never a battle state. */
export type BattleMovesIntent =
  | Readonly<{ type: 'move'; moveIndex: number }>
  | Readonly<{ type: 'info'; moveIndex: number | null }>
  | Readonly<{ type: 'mega' }>
  | Readonly<{ type: 'gmax' }>
  | Readonly<{ type: 'back' }>;

export type BattleMovesController = Readonly<{
  /** Pushes the menu's state; a closed menu hides the card but keeps it mounted. */
  update(input: BattleMovesInput): void;
  dispose(): void;
}>;

/** The view painted on mount, so the layer's card exists before the first battle snapshot. */
const CLOSED: BattleMovesInput = {
  open: false,
  card: { x: 0, y: 0, w: 0, h: 0 },
  cells: [],
  selected: 0,
  info: null,
  mega: false,
  gmax: false,
  megaArmed: false,
  gmaxArmed: false,
  target: null,
};

/**
 * Mounts the move menu into `host` and returns the controller the scene feeds.
 * The empty card is painted on mount, so `[data-hud-panel="battle-moves"]` is there
 * from the moment the battle mounts. Preact reuses the cards between pushes, so a
 * press keeps its own focus instead of remounting under the pointer.
 */
export function mountBattleMoves(
  host: Element,
  onIntent?: (intent: BattleMovesIntent) => void,
): BattleMovesController {
  const container = document.createElement('div');
  container.className = 'battle-moves-mount';
  host.appendChild(container);

  let view: BattleMovesView = battleMovesView(CLOSED);
  const paint = (): void => {
    render(h(BattleMoves, { view, onIntent }), container);
  };
  paint();

  return {
    update: (input: BattleMovesInput): void => {
      view = battleMovesView(input);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

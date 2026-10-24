import { h, render } from 'preact';
import type { BagCategory } from '../../../bag';
import { BattleBagPanel } from './battleBagPanel';
import { battleBagView, type BattleBagInput, type BattleBagView } from './view';

/** The panel's own command channel: plain data, never a battle state. */
export type BattleBagIntent =
  | Readonly<{ type: 'tab'; category: BagCategory }>
  | Readonly<{ type: 'select'; index: number }>
  | Readonly<{ type: 'use'; itemId: string }>
  | Readonly<{ type: 'search'; query: string }>
  | Readonly<{ type: 'focus'; focused: boolean }>
  | Readonly<{ type: 'scroll'; delta: number }>
  | Readonly<{ type: 'back' }>;

export type BattleBagController = Readonly<{
  /** Pushes the bag's state; a closed bag hides the card but keeps it mounted. */
  update(input: BattleBagInput): void;
  dispose(): void;
}>;

/** The view painted on mount, so the layer's card exists before the first snapshot. */
const CLOSED: BattleBagInput = {
  open: false,
  card: { x: 0, y: 0, w: 0, h: 0 },
  tabs: [],
  query: '',
  focused: false,
  rows: [],
  selected: 0,
  detail: '',
  info: null,
  empty: null,
};

/**
 * Mounts the battle's bag into `host` and returns the controller the scene feeds.
 * The empty card is painted on mount, so `[data-hud-panel="battle-bag"]` is there
 * from the moment the battle mounts. Preact reuses the cards between pushes, so a
 * press keeps its own focus instead of remounting under the pointer.
 */
export function mountBattleBag(
  host: Element,
  onIntent?: (intent: BattleBagIntent) => void,
): BattleBagController {
  const container = document.createElement('div');
  container.className = 'battle-bag-mount';
  host.appendChild(container);

  let view: BattleBagView = battleBagView(CLOSED);
  const paint = (): void => {
    render(h(BattleBagPanel, { view, onIntent }), container);
  };
  paint();

  return {
    update: (input: BattleBagInput): void => {
      view = battleBagView(input);
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

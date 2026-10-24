import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import { TradePanel } from './tradePanel';
import type { TradePanelView } from './view';

/**
 * The trade card's own command channel: plain data, and the scene module owns every
 * write. A `pick` carries the party index the player chose (never a PC id: the rule
 * only ever trades a party member), `give` commits the current selection, and
 * `close` dismisses the card.
 */
export type TradeIntent =
  Readonly<{ type: 'pick'; index: number }> | Readonly<{ type: 'give' }> | Readonly<{ type: 'close' }>;

/**
 * Mounts the trade card into `host` and returns the disposer. The view is a signal,
 * so a refresh is one assignment and one render; the disposer unsubscribes, clears
 * the rendered tree and takes its own container out of the layer.
 */
export function mountTradePanel(
  host: Element,
  view: Signal<TradePanelView>,
  onIntent?: ((intent: TradeIntent) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'trade-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(TradePanel, { view: view.value, onIntent }), container);
  };
  paint();
  const stop = view.subscribe(paint);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    stop();
    render(null, container);
    container.remove();
  };
}

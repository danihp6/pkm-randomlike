import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import { ShopPanel } from './shopPanel';
import type { ShopMode, ShopPanelView } from './view';

/**
 * The Mart's own command channel: plain data; the scene module owns every trade.
 * A press carries the row's `itemId`, never a slot, so the card can buy or sell
 * without knowing the floor's stock.
 */
export type ShopIntent =
  | Readonly<{ type: 'mode'; mode: ShopMode }>
  | Readonly<{ type: 'select'; index: number }>
  | Readonly<{ type: 'buy'; itemId: string }>
  | Readonly<{ type: 'sell'; itemId: string }>
  | Readonly<{ type: 'scroll'; delta: number }>
  | Readonly<{ type: 'close' }>;

/**
 * Mounts the Mart card into `host` and returns the disposer. The view is a signal,
 * so a refresh is one assignment and one render; the disposer unsubscribes, clears
 * the rendered tree and takes its own container out of the layer.
 */
export function mountShopPanel(
  host: Element,
  view: Signal<ShopPanelView>,
  onIntent?: ((intent: ShopIntent) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'shop-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(ShopPanel, { view: view.value, onIntent }), container);
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

import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { BagPanel } from './bagPanel';
import type { BagPanelView } from './view';

/**
 * Mounts the bag panel into `host` and returns the disposer. The view is a signal,
 * so a refresh is one assignment and one render; the disposer unsubscribes, clears
 * the rendered tree and takes its own container out of the layer.
 */
export function mountBagPanel(
  host: Element,
  view: Signal<BagPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'bag-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(BagPanel, { view: view.value, onCommand }), container);
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

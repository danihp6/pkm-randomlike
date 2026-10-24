import type { Signal } from '@preact/signals';
import { h, render } from 'preact';
import { PausePanel } from './pausePanel';
import type { PausePanelView } from './view';

/** The card's whole command channel: plain data, and the scene owns every rule. */
export type PausePanelIntent = Readonly<{ type: 'row'; index: number }>;

/**
 * Mounts the card and its scrim into `host` and returns the disposer. The view is
 * a signal, so a repaint is one assignment; the paint before the subscription puts
 * the card in the tree from the moment the panel mounts, even while it is closed.
 * The mount takes no key: the menu's keys are the scene's, and a DOM key path would
 * double-fire them.
 */
export function mountPausePanel(
  host: Element,
  view: Signal<PausePanelView>,
  onIntent?: ((intent: PausePanelIntent) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'pause-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(PausePanel, { view: view.value, onIntent }), container);
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

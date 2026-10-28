import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { BagPanel } from './bagPanel';
import type { BagPanelView } from './view';

/**
 * Mounts the bag panel into `host` and returns the disposer. The view is a signal,
 * so a refresh is one assignment and one render; the disposer unsubscribes, clears
 * the rendered tree and takes its own container out of the layer. A frame turns the
 * card's own chip into the collapse button and the drag handle.
 */
export function mountBagPanel(
  host: Element,
  view: Signal<BagPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'bag-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(BagPanel, { view: view.value, onCommand });
    render(
      frame === undefined
        ? card
        : h(PanelFrame, { ...panelFrameProps(frame, view.value.open), children: card }),
      container,
    );
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

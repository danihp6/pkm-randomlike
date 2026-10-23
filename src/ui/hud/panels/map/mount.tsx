import type { Signal } from '@preact/signals';
import { h, render } from 'preact';
import type { HudCommand } from '../../commands';
import { MapPanel } from './mapPanel';
import type { MapPanelView } from './view';

/**
 * Mounts the route header into `host` and returns its disposer. The signal is the
 * one emit point: every `view.value = …` paints once, and nothing else re-renders.
 */
export function mountMapPanel(
  host: Element,
  view: Signal<MapPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'map-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(MapPanel, { view: view.value, onCommand }), container);
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

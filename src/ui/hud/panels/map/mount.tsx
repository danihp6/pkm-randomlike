import type { Signal } from '@preact/signals';
import { h, render } from 'preact';
import type { HudCommand } from '../../commands';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { MapPanel } from './mapPanel';
import type { MapPanelView } from './view';

/**
 * Mounts the route header into `host` and returns its disposer. The signal is the
 * one emit point: every `view.value = …` paints once, and nothing else re-renders.
 * A frame turns the card's own chip into the collapse button and the drag handle;
 * without one the card mounts unwrapped, exactly as before.
 */
export function mountMapPanel(
  host: Element,
  view: Signal<MapPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'map-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(MapPanel, { view: view.value, onCommand });
    render(
      frame === undefined
        ? card
        : h(PanelFrame, { ...panelFrameProps(frame, view.value.open), children: card }),
      container,
    );
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

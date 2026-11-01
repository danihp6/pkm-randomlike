import type { Signal } from '@preact/signals';
import { h, render } from 'preact';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { MissionsPanel } from './missionsPanel';
import type { MissionsPanelView } from './view';

/**
 * Mounts the mission card into `host` and returns its disposer. The card takes no input
 * of its own: the frame draws the chip, the drag and the saved slot, so the only way out
 * of the card is the chip the kit already paints. The signal is the one emit point.
 */
export function mountMissionsPanel(
  host: Element,
  view: Signal<MissionsPanelView>,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'missions-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(MissionsPanel, { view: view.value });
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

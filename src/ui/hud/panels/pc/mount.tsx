import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { PcPanel } from './pcPanel';
import type { PcPanelView } from './view';

/**
 * Mounts the PC box panel into `host` and returns the disposer. The scene owns the
 * view and pushes it through the signal; the panel paints once per set. A completed
 * drag arrives through `onReorder`, beside the commands a press sends, and a frame
 * turns the card's own chip into the collapse button and the drag handle.
 */
export function mountPcPanel(
  host: Element,
  view: Signal<PcPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  onReorder?: ((from: number, to: number) => void) | undefined,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'pc-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(PcPanel, { view: view.value, onCommand, onReorder });
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

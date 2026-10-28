import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { PartyPanel } from './partyPanel';
import type { PartyPanelView } from './view';

/**
 * Mounts the party card into `host` and returns its disposer. The signal is the one
 * emit point: every `view.value = …` paints once, and nothing else re-renders. A
 * completed drag arrives through `onReorder`, beside the commands a press sends, and
 * a frame turns the card's own chip into the collapse button and the drag handle.
 */
export function mountPartyPanel(
  host: Element,
  view: Signal<PartyPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  onReorder?: ((from: number, to: number) => void) | undefined,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'party-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(PartyPanel, { view: view.value, onCommand, onReorder });
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

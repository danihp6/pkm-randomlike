import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { PartyPanel } from './partyPanel';
import type { PartyPanelView } from './view';

/**
 * Mounts the party card into `host` and returns its disposer. The signal is the one
 * emit point: every `view.value = …` paints once, and nothing else re-renders. A
 * completed drag arrives through `onReorder`, beside the commands a press sends.
 */
export function mountPartyPanel(
  host: Element,
  view: Signal<PartyPanelView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
  onReorder?: ((from: number, to: number) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'party-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(PartyPanel, { view: view.value, onCommand, onReorder }), container);
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { HudCommand } from '../../commands';
import { HudStrip } from './strip';
import type { StripView } from './view';

/**
 * Mounts the route strip into `host` and returns its disposer. The signal is the one
 * emit point: every `view.value = …` paints once, and nothing else re-renders.
 */
export function mountHudStrip(
  host: Element,
  view: Signal<StripView>,
  onCommand?: ((command: HudCommand) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'hud-strip-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(HudStrip, { view: view.value, onCommand }), container);
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

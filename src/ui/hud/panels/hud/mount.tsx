import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import { HudStrip, type HudStripCallbacks } from './strip';
import type { StripView } from './view';

/**
 * Mounts the route strip into `host` and returns its disposer. The signal is the one
 * emit point: every `view.value = …` paints once, and nothing else re-renders. The
 * callbacks are the scene's: a chip's press and the layout a badge drag commits.
 */
export function mountHudStrip(
  host: Element,
  view: Signal<StripView>,
  callbacks: HudStripCallbacks = {},
): () => void {
  const container = document.createElement('div');
  container.className = 'hud-strip-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(HudStrip, { view: view.value, ...callbacks }), container);
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

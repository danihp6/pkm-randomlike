import type { Signal } from '@preact/signals';
import { h, render } from 'preact';
import { NoticesPanel } from './noticesPanel';
import type { NoticesPanelView } from './view';

/**
 * Mounts the route's three cards into `host` and returns the disposer. The signal is
 * the one emit point: every `view.value = …` paints once. The cards take no input, so
 * there is no command channel to hand back.
 */
export function mountNoticesPanel(host: Element, view: Signal<NoticesPanelView>): () => void {
  const container = document.createElement('div');
  container.className = 'notices-mount';
  host.appendChild(container);

  const paint = (): void => {
    render(h(NoticesPanel, { view: view.value }), container);
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

import { h, render } from 'preact';
import { RunOverPanel } from './runOverPanel';
import type { RunOverTab, RunOverView } from './view';

/** What a tab press or the one action asks the scene for. */
export type RunOverIntent = Readonly<{ type: 'tab'; tab: RunOverTab }> | Readonly<{ type: 'confirm' }>;

export type RunOverHandle = Readonly<{
  /** Repaints from a new view. Exactly one render per call. */
  update(view: RunOverView): void;
  /** Drops the container, clears the tree; idempotent. */
  dispose(): void;
}>;

/**
 * Mounts the score screen into `host` and returns its handle. The scene is the only
 * writer of the view, so `update` is one `render` per call and no signal is involved;
 * the tabs and the action are buttons, so Enter and Space are the browser's own
 * click and the scene's keybinds stay the only keyboard listener.
 */
export function mountRunOver(
  host: Element,
  view: RunOverView,
  onIntent?: ((intent: RunOverIntent) => void) | undefined,
): RunOverHandle {
  const container = document.createElement('div');
  container.className = 'run-over-mount';
  host.appendChild(container);

  let current = view;
  let disposed = false;

  const paint = (): void => {
    render(h(RunOverPanel, { view: current, onIntent }), container);
  };
  paint();

  return {
    update(next: RunOverView): void {
      if (disposed) return;
      current = next;
      paint();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      render(null, container);
      container.remove();
    },
  };
}

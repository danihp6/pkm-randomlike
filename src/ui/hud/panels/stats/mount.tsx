import { h, render } from 'preact';
import { StatsPanel } from './statsPanel';
import type { StatsActionId, StatsMode, StatsView } from './view';

/** What a tab press, an action or a month step asks the scene for. */
export type StatsIntent =
  | Readonly<{ type: 'tab'; mode: StatsMode }>
  | Readonly<{ type: 'action'; id: StatsActionId }>
  | Readonly<{ type: 'month'; delta: -1 | 1 }>;

export type StatsHandle = Readonly<{
  /** Repaints from a new view. Exactly one render per call. */
  update(view: StatsView): void;
  /** Drops the container, clears the tree; idempotent. */
  dispose(): void;
}>;

/**
 * Mounts the stats panel into `host` and returns its handle. The scene is the only
 * writer of the view, so `update` is one `render` per call and no signal is involved;
 * the tabs, the actions and the month steps are buttons, so Enter and Space are the
 * browser's own click and the scene's keybinds stay the only keyboard listener.
 */
export function mountStats(
  host: Element,
  view: StatsView,
  onIntent?: ((intent: StatsIntent) => void) | undefined,
): StatsHandle {
  const container = document.createElement('div');
  container.className = 'stats-mount';
  host.appendChild(container);

  let current = view;
  let disposed = false;

  const paint = (): void => {
    render(h(StatsPanel, { view: current, onIntent }), container);
  };
  paint();

  return {
    update(next: StatsView): void {
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

import { h, render } from 'preact';
import { MainMenuPanel } from './mainMenuPanel';
import type { MainMenuView } from './view';

/** What a press, a tap or Enter on a row asks the scene for. */
export type MainMenuIntent =
  | Readonly<{ type: 'continue' }>
  | Readonly<{ type: 'new-run' }>
  | Readonly<{ type: 'options' }>
  | Readonly<{ type: 'stats' }>;

export type MainMenuHandle = Readonly<{
  /** Repaints from a new view. Exactly one render per call. */
  update(view: MainMenuView): void;
  /** Drops the container, clears the tree; idempotent. */
  dispose(): void;
}>;

/**
 * Mounts the menu into `host` and returns its handle. The scene is the only writer
 * of the view, so `update` is one `render` per call and no signal is involved; the
 * rows are buttons, so Enter and Space are the browser's own click and the scene's
 * keybinds stay the only keyboard listener.
 */
export function mountMainMenu(
  host: Element,
  view: MainMenuView,
  onIntent?: ((intent: MainMenuIntent) => void) | undefined,
): MainMenuHandle {
  const container = document.createElement('div');
  container.className = 'main-menu-mount';
  host.appendChild(container);

  let current = view;
  let disposed = false;

  const paint = (): void => {
    render(h(MainMenuPanel, { view: current, onIntent }), container);
  };
  paint();

  return {
    update(next: MainMenuView): void {
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

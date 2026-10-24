import { h, render } from 'preact';
import { StarterPanel } from './starterPanel';
import type { StarterView } from './view';

/** What a press, a hover or a focus on a card asks the scene for. */
export type StarterIntent =
  | Readonly<{ type: 'select'; index: number }>
  | Readonly<{ type: 'choose'; index: number }>
  | Readonly<{ type: 'seed-prompt' }>
  | Readonly<{ type: 'cancel' }>
  | Readonly<{ type: 'settings' }>;

export type StarterHandle = Readonly<{
  /** Repaints from a new view. Exactly one render per call. */
  update(view: StarterView): void;
  /** Drops the container, clears the tree; idempotent. */
  dispose(): void;
}>;

/**
 * Mounts the starter pick into `host` and returns its handle. The scene is the
 * only writer of the view, so `update` is one `render` per call and no signal is
 * involved; the cards are buttons, so Enter and Space are the browser's click.
 */
export function mountStarter(
  host: Element,
  view: StarterView,
  onIntent?: ((intent: StarterIntent) => void) | undefined,
): StarterHandle {
  const container = document.createElement('div');
  container.className = 'starter-mount';
  host.appendChild(container);

  let current = view;
  let disposed = false;

  const paint = (): void => {
    render(h(StarterPanel, { view: current, onIntent }), container);
  };
  paint();

  return {
    update(next: StarterView): void {
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

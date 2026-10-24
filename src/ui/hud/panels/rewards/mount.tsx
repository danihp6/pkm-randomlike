import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import { RewardsPanel } from './rewardsPanel';
import type { RewardsPanelView } from './view';

/**
 * The reward card's own command channel: plain data, and the scene module owns
 * every rule. A press on a row sends `arm` with that row's index — the scene's
 * `rewardsPress` decides whether the press arms the row or commits the one already
 * armed — and `commit` is the keyboard's confirm, which does the same second press.
 */
export type RewardsIntent =
  Readonly<{ type: 'arm'; index: number }> | Readonly<{ type: 'commit' }> | Readonly<{ type: 'close' }>;

/** The row a step lands on: the first, or the armed one moved by `delta`. */
function stepIndex(rows: RewardsPanelView['rows'], armed: number, delta: number): number | null {
  if (rows.length === 0) return null;
  if (armed < 0) return rows[0].index;
  return rows[Math.min(rows.length - 1, Math.max(0, armed + delta))].index;
}

/**
 * Mounts the reward card into `host` and returns the disposer. The view is a
 * signal, so a refresh is one assignment and one render; the card also takes the
 * four keys a two-step pick needs (`up`/`down` arm, `confirm` commits, `cancel`
 * closes) in the document's capture phase, so a key reaches the same intents a
 * press does and never the route's own key path underneath. The disposer drops the
 * listener, clears the rendered tree and takes its own container out of the layer.
 */
export function mountRewardsPanel(
  host: Element,
  view: Signal<RewardsPanelView>,
  onIntent?: ((intent: RewardsIntent) => void) | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'rewards-mount';
  host.appendChild(container);

  const send = (intent: RewardsIntent): void => onIntent?.(intent);

  const paint = (): void => {
    render(h(RewardsPanel, { view: view.value, onIntent }), container);
    const armed = container.querySelector('[data-hud-reward-row][data-armed="true"]');
    armed?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const keydown = (event: KeyboardEvent): void => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!view.value.open) return;
    const rows = view.value.rows;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        const armed = rows.findIndex((row) => row.armed);
        const index = stepIndex(rows, armed, event.key === 'ArrowDown' ? 1 : -1);
        if (index !== null) send({ type: 'arm', index });
        break;
      }
      case 'Enter':
        send({ type: 'commit' });
        break;
      case 'Escape':
        send({ type: 'close' });
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  paint();
  const stop = view.subscribe(paint);
  document.addEventListener('keydown', keydown, true);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('keydown', keydown, true);
    stop();
    render(null, container);
    container.remove();
  };
}

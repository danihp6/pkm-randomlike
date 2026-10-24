import { h, render } from 'preact';
import { BATTLE_LOG_NARROW_QUERY, type BattleLogLineView, type BattleLogView } from './view';
import { BattleLogPanel } from './battleLogPanel';

export type BattleLogHandle = Readonly<{
  /** Repaints only when `visible` or a line's text/tone changed; one render per change. */
  update(view: BattleLogView): void;
  dispose(): void;
}>;

/** True when the viewport asks for the phone card (`m05b`). */
function narrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(BATTLE_LOG_NARROW_QUERY).matches;
}

function sameLines(a: readonly BattleLogLineView[], b: readonly BattleLogLineView[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].text !== b[i].text || a[i].tone !== b[i].tone) return false;
  }
  return true;
}

/**
 * Mounts the battle's message box into `host` and returns the handle the scene pushes
 * through. The card is painted on mount, so `[data-hud-battle-log]` is there from the
 * moment the battle mounts; a push that repeats the line already on screen is dropped.
 * The board follows the viewport, so a push after a resize repaints even when the text
 * did not move.
 */
export function mountBattleLog(host: Element, view: BattleLogView): BattleLogHandle {
  const container = document.createElement('div');
  container.className = 'battle-log-mount';
  host.appendChild(container);

  let current: BattleLogView = view;
  let narrow = narrowViewport();
  const paint = (): void => {
    render(h(BattleLogPanel, { view: current, narrow }), container);
  };
  paint();

  return {
    update: (next: BattleLogView): void => {
      const nextNarrow = narrowViewport();
      if (
        nextNarrow === narrow &&
        next.visible === current.visible &&
        sameLines(next.lines, current.lines)
      ) {
        return;
      }
      current = next;
      narrow = nextNarrow;
      paint();
    },
    dispose: (): void => {
      render(null, container);
      container.remove();
    },
  };
}

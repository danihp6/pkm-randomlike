import { h, render } from 'preact';
import type { Signal } from '@preact/signals';
import type { DetailTab } from '../../../partyDetail';
import { PanelFrame, panelFrameProps, type PanelFrameMount } from '../hud';
import { DetailPanel } from './detailPanel';
import type { DetailPanelView } from './view';

/**
 * The panel's own command channel: plain data, never a run, never a Phaser object.
 * It does not extend `HudCommand` — the route detail window's interaction set has no
 * equivalent in that union, and `src/ui/hud/commands.ts` is not this task's — so the
 * scene module `src/scenes/panels/detail.ts` is the only receiver and the only
 * writer of the run.
 */
export type DetailIntent =
  | Readonly<{ type: 'tab'; tab: DetailTab }>
  | Readonly<{ type: 'cursor'; index: number }>
  | Readonly<{ type: 'poolCursor'; index: number }>
  | Readonly<{ type: 'page'; delta: number }>
  | Readonly<{ type: 'search'; query: string }>
  | Readonly<{ type: 'info'; index: number | null }>
  | Readonly<{ type: 'abilityInfo'; open: boolean }>
  | Readonly<{ type: 'grab'; index: number }>
  | Readonly<{ type: 'drop'; slot: number }>
  | Readonly<{ type: 'equip'; moveId: string }>
  | Readonly<{ type: 'unequip'; slot: number }>
  | Readonly<{ type: 'evolve'; into: string }>
  | Readonly<
      | { type: 'nickname'; begin: true }
      | { type: 'nickname'; commit: string }
      | { type: 'nickname'; cancel: true }
    >;

/**
 * Mounts the detail card into `host` and returns its disposer. The signal is the one
 * emit point: every `view.value = …` paints once, and nothing else re-renders. Its
 * frame carries the saved offset only — the board draws no chip for this window, so
 * the frame draws none either and the card's own chip stays the way back.
 */
export function mountDetailPanel(
  host: Element,
  view: Signal<DetailPanelView>,
  onIntent?: ((intent: DetailIntent) => void) | undefined,
  frame?: PanelFrameMount | undefined,
): () => void {
  const container = document.createElement('div');
  container.className = 'detail-mount';
  host.appendChild(container);

  const paint = (): void => {
    const card = h(DetailPanel, { view: view.value, onIntent });
    render(
      frame === undefined
        ? card
        : h(PanelFrame, { ...panelFrameProps(frame, view.value.open), children: card }),
      container,
    );
  };
  paint();
  const stop = view.subscribe(paint);

  return () => {
    stop();
    render(null, container);
    container.remove();
  };
}

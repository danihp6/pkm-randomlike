import type { CSSProperties, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import { Bar } from '../../kit';
import type { PcCellView, PcPanelView, Rect } from './view';
import './pc.css';

/**
 * The card's pointer drag, one cell per mount: the cell the pointer picked up and
 * the click a drop owes. `swallowed` is a ref cell on purpose — the click after a
 * drop lands on a handler built by the *next* paint, so the flag must outlive a
 * render, and `setFrom` repaints so `data-dragging` can follow the pointer.
 */
export type PcDrag = Readonly<{
  /** The cell's flat slot the pointer went down on, or null. */
  from: number | null;
  /** True between a drop that reordered the box and the click that follows it. */
  swallowed: { current: boolean };
  setFrom: (from: number | null) => void;
}>;

export type PcPanelProps = Readonly<{
  view: PcPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
  /** A completed drag: the cell picked up and the cell it was dropped on. */
  onReorder?: ((from: number, to: number) => void) | undefined;
}>;

export type PcCardProps = Readonly<{
  view: PcPanelView;
  drag: PcDrag;
  onCommand?: ((command: HudCommand) => void) | undefined;
  onReorder?: ((from: number, to: number) => void) | undefined;
}>;

function rectStyle(box: Rect): CSSProperties {
  return {
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.w}px`,
    height: `${box.h}px`,
  };
}

/** A grid cell is drawn panel-relative; inside the band it starts at its offset. */
function cellStyle(cell: PcCellView, band: Rect): CSSProperties {
  return {
    left: `${cell.box.x - band.x}px`,
    top: `${cell.box.y - band.y}px`,
    width: `${cell.box.w}px`,
    height: `${cell.box.h}px`,
  };
}

/** True when a cell may be picked up: a member the run's rules will let you move. */
function draggable(cell: PcCellView, pane: 'box' | 'rip'): boolean {
  return pane === 'box' && cell.memberId !== null && !cell.locked;
}

export function PcCard(props: PcCardProps): JSX.Element {
  const { view, drag } = props;
  const handler = props.onCommand;
  const onReorder = props.onReorder;
  const pane: 'box' | 'rip' = view.rip.active ? 'rip' : 'box';
  const send = (command: HudCommand): void => {
    if (handler === undefined) return;
    handler(command);
  };

  const activePage = view.tabs.find((tab) => tab.active)?.page ?? 0;
  // The strip pages the box the way the wheel does: one step per tab crossed.
  const turnTo = (target: number): void => {
    const turned = Math.sign(target - activePage);
    for (let step = 0; step < Math.abs(target - activePage); step += 1) {
      send({ type: 'press', action: turned >= 0 ? 'right' : 'left' });
    }
  };

  const onWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    send({ type: 'press', action: event.deltaY > 0 ? 'right' : 'left' });
  };

  return (
    <div
      class="pc"
      data-hud-panel="box"
      data-pane={view.rip.active ? 'rip' : 'box'}
      hidden={!view.open}
      style={rectStyle(view.box)}
      onPointerUp={() => drag.setFrom(null)}
      onPointerCancel={() => drag.setFrom(null)}
    >
      <div class="pc__frame">
        <span class="pc__highlight" style={rectStyle(view.highlight)} aria-hidden="true" />
        <button
          type="button"
          class="pc__chip"
          data-hud-pc="chip"
          aria-label={t('keybind.box')}
          style={rectStyle(view.chip.box)}
          onClick={(event) => {
            event.stopPropagation();
            send({ type: 'panel', panel: 'box' });
          }}
        >
          {view.chip.letter}
        </button>
        <span class="pc__tabs" data-hud-pc="tabs">
          {view.tabs.map((tab) => (
            <button
              type="button"
              key={tab.page}
              class="pc__tab"
              data-hud-pc-tab={tab.page}
              data-active={tab.active ? 'true' : undefined}
              aria-label={`${t('keybind.box')} ${tab.label}`}
              style={rectStyle(tab.box)}
              onClick={(event) => {
                event.stopPropagation();
                turnTo(tab.page);
              }}
            >
              {tab.label}
            </button>
          ))}
        </span>
        <button
          type="button"
          class="pc__rip"
          data-hud-pc="rip"
          data-active={view.rip.active ? 'true' : undefined}
          data-locked={view.rip.locked ? 'true' : undefined}
          aria-label="RIP"
          style={rectStyle(view.rip.box)}
          onClick={(event) => {
            event.stopPropagation();
            send({ type: 'press', action: 'confirm' });
          }}
        >
          <span class="pc__rip-label">RIP</span>
        </button>
        <div
          class="pc__grid"
          data-hud-pc="grid"
          style={{
            left: `${view.grid.band.x}px`,
            top: `${view.grid.band.y}px`,
            width: `${view.grid.band.w}px`,
            height: `${view.grid.band.h}px`,
          }}
          onWheel={onWheel}
        >
          {view.cells.map((cell) => {
            const picked = draggable(cell, pane);
            return (
              <button
                type="button"
                key={cell.index}
                class="pc__cell"
                data-hud-pc-cell={cell.index}
                data-selected={cell.selected ? 'true' : undefined}
                data-locked={cell.locked ? 'true' : undefined}
                data-dragging={picked && drag.from === cell.index ? 'true' : undefined}
                disabled={cell.memberId === null}
                style={cellStyle(cell, view.grid.band)}
                onPointerDown={
                  picked
                    ? () => {
                        drag.swallowed.current = false;
                        drag.setFrom(cell.index);
                      }
                    : undefined
                }
                onPointerUp={
                  picked
                    ? () => {
                        const from = drag.from;
                        drag.setFrom(null);
                        if (from === null || from === cell.index) return;
                        drag.swallowed.current = true;
                        onReorder?.(from, cell.index);
                      }
                    : undefined
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (drag.swallowed.current) {
                    drag.swallowed.current = false;
                    return;
                  }
                  if (cell.memberId === null) return;
                  send({ type: 'member', memberId: cell.memberId });
                }}
              >
                {cell.memberId === null ? null : (
                  <>
                    <span class="pc__cell-name">{cell.name}</span>
                    <span class="pc__cell-level">{t('hud.level', { level: cell.level })}</span>
                    <Bar fraction={cell.hpFraction} label={`${cell.name} ${cell.hpText}`} />
                    <span class="pc__cell-hp">{cell.hpText}</span>
                    {cell.statusLabel === null ? null : (
                      <span class="pc__cell-status">{cell.statusLabel}</span>
                    )}
                    {cell.locked ? <span class="pc__cell-veil" aria-hidden="true" /> : null}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The PC box card (`D49`). It paints the view and answers in `HudCommand`s; the
 * scene owns the run, the cursor and the page. The drag cell lives here, one per
 * mount, and a completed drag is reported through `onReorder`. A pointer released
 * outside the card — the party card, the map — drops the carried cell, so a
 * crossing drag never leaves a mark behind.
 */
export function PcPanel(props: PcPanelProps): JSX.Element {
  const [from, setFrom] = useState<number | null>(null);
  const swallowed = useRef(false);
  const drag: PcDrag = { from, swallowed, setFrom };
  useEffect(() => {
    const clear = (): void => setFrom(null);
    document.addEventListener('pointerup', clear);
    document.addEventListener('pointercancel', clear);
    return () => {
      document.removeEventListener('pointerup', clear);
      document.removeEventListener('pointercancel', clear);
    };
  }, []);
  return (
    <PcCard view={props.view} drag={drag} onCommand={props.onCommand} onReorder={props.onReorder} />
  );
}

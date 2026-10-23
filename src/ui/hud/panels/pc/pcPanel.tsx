import type { CSSProperties, JSX } from 'preact';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import { Bar } from '../../kit';
import type { PcCellView, PcPanelView, Rect } from './view';
import './pc.css';

export type PcPanelProps = Readonly<{
  view: PcPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
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

export function PcPanel(props: PcPanelProps): JSX.Element {
  const { view } = props;
  const handler = props.onCommand;
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
      data-hud-panel="pc"
      data-pane={view.rip.active ? 'rip' : 'box'}
      hidden={!view.open}
      style={rectStyle(view.box)}
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
          {view.cells.map((cell) => (
            <button
              type="button"
              key={cell.index}
              class="pc__cell"
              data-hud-pc-cell={cell.index}
              data-selected={cell.selected ? 'true' : undefined}
              data-locked={cell.locked ? 'true' : undefined}
              disabled={cell.memberId === null}
              style={cellStyle(cell, view.grid.band)}
              onClick={(event) => {
                event.stopPropagation();
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
          ))}
        </div>
      </div>
    </div>
  );
}

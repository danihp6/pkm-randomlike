import type { CSSProperties, JSX } from 'preact';
import type { PausePanelIntent } from './mount';
import type { PausePanelView, PauseRowView, Rect } from './view';
import './pause.css';

export type PausePanelProps = Readonly<{
  view: PausePanelView;
  onIntent?: ((intent: PausePanelIntent) => void) | undefined;
}>;

function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

/**
 * One row: a hand-rolled button, so no real border shifts the label by a pixel.
 * The selected row is the card's accent wash and its accent 1 px edge, which is
 * not `kit/Row`'s 72 % fill and hairline. The label's box arrives card-relative
 * and the button is its containing block, so it is re-based on the row.
 */
function pauseRow(row: PauseRowView, send: (intent: PausePanelIntent) => void): JSX.Element {
  return (
    <button
      type="button"
      class="pause__row"
      data-hud-pause-row={String(row.index)}
      data-selected={row.selected ? 'true' : 'false'}
      data-armed={row.armed ? 'true' : 'false'}
      aria-current={row.selected ? 'true' : undefined}
      style={box(row.box)}
      onClick={() => send({ type: 'row', index: row.index })}
    >
      <span class="pause__label" style={box(row.labelBox, row.box)}>
        {row.label}
      </span>
    </button>
  );
}

/**
 * The pause card (`03n`): the 55 % scrim over the route, the card's highlight, its
 * title, its divider and the game's two rows. Only a row press answers; the scrim
 * is inert, and a closed card stays in the tree hidden so its rect is drawn, not
 * absent.
 */
export function PausePanel(props: PausePanelProps): JSX.Element {
  const { view } = props;
  const send = (intent: PausePanelIntent): void => props.onIntent?.(intent);

  return (
    <>
      <div class="pause__scrim" data-hud-pause="scrim" hidden={!view.open} style={box(view.scrim)} />
      <div
        class="pause"
        data-hud-panel="pause"
        data-open={view.open ? 'true' : 'false'}
        hidden={!view.open}
        style={box(view.box)}
      >
        <div class="pause__body">
          <span class="pause__highlight" data-hud-pause="highlight" style={box(view.highlight)} />
          <span class="pause__title" data-hud-pause="title" style={box(view.title.box)}>
            {view.title.text}
          </span>
          <span class="pause__divider" data-hud-pause="divider" style={box(view.divider)} />
          {view.rows.map((row) => pauseRow(row, send))}
        </div>
      </div>
    </>
  );
}

import type { CSSProperties, JSX } from 'preact';
import type { MissionRowView, MissionsPanelView, Rect } from './view';
import './missions.css';

export type MissionsPanelProps = Readonly<{
  view: MissionsPanelView;
}>;

function box(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

function cardStyle(view: MissionsPanelView): CSSProperties {
  return {
    left: `${view.box.x}px`,
    top: `${view.box.y}px`,
    width: `${view.box.w}px`,
    height: `${view.box.h}px`,
  };
}

/** One row: the mission's name, its `Map N` and, on the head row, its progress. */
function rowElement(row: MissionRowView, hook: string): JSX.Element {
  return (
    <div
      class="missions__row"
      data-hud-missions-row={hook}
      data-completed={row.completed ? 'true' : undefined}
      style={box(row.box)}
    >
      <span class="missions__name">{row.name}</span>
      <span class="missions__map" data-hud-missions-map>
        {row.map}
      </span>
      {row.progress === null ? null : <span class="missions__progress">{row.progress}</span>}
    </div>
  );
}

/**
 * The floor-mission card (`D58`): the run's head row, the floors it met newest first and
 * an empty state. The card is the frame's — the chip, the drag and the saved slot come
 * from `PanelFrame` — so nothing here takes a key of its own.
 */
export function MissionsPanel(props: MissionsPanelProps): JSX.Element {
  const { view } = props;
  return (
    <div class="missions" data-hud-panel="missions" style={cardStyle(view)}>
      <span class="missions__title" data-hud-missions-title>
        {view.title}
      </span>
      {view.current === null ? null : rowElement(view.current, 'current')}
      {view.rows.map((row, index) => rowElement(row, `completed-${index}`))}
      {view.empty === null ? null : (
        <span class="missions__empty" data-hud-missions-empty>
          {view.empty}
        </span>
      )}
    </div>
  );
}

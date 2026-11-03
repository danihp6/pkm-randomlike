import type { CSSProperties, JSX } from 'preact';
import { missionsPanelRows, type MissionRowView, type MissionsPanelView, type Rect } from './view';
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

/** One row: the mission's name, the badge it belongs to and, while it is not active, its state. */
function rowElement(row: MissionRowView): JSX.Element {
  return (
    <div
      class="missions__row"
      data-hud-missions-row={row.scopeKey}
      data-state={row.status}
      style={box(row.box)}
    >
      <span class="missions__name">{row.name}</span>
      <span class="missions__tag" data-hud-missions-tag>
        {row.tag}
      </span>
      {row.progress === null ? null : <span class="missions__progress">{row.progress}</span>}
    </div>
  );
}

/**
 * The mission card (`D58`): the node's whole stack — its stretch's automatic mission, its
 * city's own and the row an NPC offers — one row each, in the engine's order, plus an
 * empty state the stretch row means the card never actually reaches. The card is the
 * frame's — the chip, the drag and the saved slot come from `PanelFrame` — so nothing here
 * takes a key of its own.
 */
export function MissionsPanel(props: MissionsPanelProps): JSX.Element {
  const { view } = props;
  return (
    <div class="missions" data-hud-panel="missions" style={cardStyle(view)}>
      <span class="missions__title" data-hud-missions-title>
        {view.title}
      </span>
      {missionsPanelRows(view).map((row) => rowElement(row))}
      {view.empty === null ? null : (
        <span class="missions__empty" data-hud-missions-empty>
          {view.empty}
        </span>
      )}
    </div>
  );
}

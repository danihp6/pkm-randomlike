import type { JSX } from 'preact';
import { Panel } from '../../kit';
import type { StatsIntent } from './mount';
import type { StatsActionId, StatsMode, StatsRow, StatsView } from './view';
import './stats.css';

export type StatsPanelProps = Readonly<{
  view: StatsView;
  onIntent?: ((intent: StatsIntent) => void) | undefined;
}>;

function tableRows(rows: readonly StatsRow[]): JSX.Element[] {
  return rows.map((row) => (
    <div class="stats__row" key={row.id} data-hud-stats-row={row.id}>
      {row.cells.map((cell, index) => (
        <span class="stats__cell" key={index} data-hud-stats-cell={String(index)}>
          {cell}
        </span>
      ))}
    </div>
  ));
}

export function StatsPanel(props: StatsPanelProps): JSX.Element {
  const { view } = props;
  const handler = props.onIntent;
  const month = view.month;

  const openTab = (mode: StatsMode): void => {
    if (handler === undefined) return;
    handler({ type: 'tab', mode });
  };

  const pressAction = (id: StatsActionId): void => {
    if (handler === undefined) return;
    handler({ type: 'action', id });
  };

  const stepMonth = (delta: -1 | 1): void => {
    if (handler === undefined) return;
    handler({ type: 'month', delta });
  };

  // The frame's chip prints both arrows around the month; the two step buttons are
  // the click targets at its ends, so the arrows belong to the label, not to them.
  const monthLabel =
    month === null ? '' : month.canPrev || month.canNext ? `\u2039 ${month.label} \u203A` : month.label;

  return (
    <div class="stats" data-mode={view.mode}>
      <div class="stats__stage">
        <div class="stats__panel" data-hud-panel="stats">
          <Panel class="stats__skin" />
          <span class="stats__highlight" aria-hidden="true" />
          <span class="stats__accent" aria-hidden="true" />
          <h1 class="stats__title" data-hud-stats-title>
            {view.title}
          </h1>
          <p class="stats__blurb" data-hud-stats-blurb>
            {view.blurb}
          </p>
          {view.tabs.length === 0 ? null : (
            <div class="stats__tabs">
              {view.tabs.map((tab) => (
                <button
                  type="button"
                  class="stats__tab"
                  key={tab.id}
                  data-hud-stats-tab={tab.id}
                  data-selected={tab.id === view.mode ? 'true' : undefined}
                  aria-pressed={tab.id === view.mode}
                  onClick={() => openTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {month === null ? null : (
            <div class="stats__month" data-hud-stats-month>
              <button
                type="button"
                class="stats__month-step"
                data-hud-stats-month-prev
                disabled={!month.canPrev}
                aria-label="Previous month"
                onClick={() => stepMonth(-1)}
              />
              <span class="stats__month-label">{monthLabel}</span>
              <button
                type="button"
                class="stats__month-step"
                data-hud-stats-month-next
                disabled={!month.canNext}
                aria-label="Next month"
                onClick={() => stepMonth(1)}
              />
            </div>
          )}
          {view.figures.length === 0 ? null : (
            <div class="stats__figures">
              {view.figures.map((figure) => (
                <div class="stats__figure" key={figure.id} data-hud-stats-figure={figure.id}>
                  <span class="stats__figure-label" data-hud-stats-label>
                    {figure.label}
                  </span>
                  <span class="stats__figure-value" data-hud-stats-value>
                    {figure.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {view.columns.length === 0 && view.rows.length === 0 ? null : (
            <div class="stats__table" data-hud-stats-table>
              {view.columns.length === 0 ? null : (
                <div class="stats__columns">
                  {view.columns.map((column, index) => (
                    <span
                      class="stats__column"
                      key={`${index}-${column}`}
                      data-hud-stats-column={String(index)}
                    >
                      {column}
                    </span>
                  ))}
                </div>
              )}
              <div class="stats__rows">{tableRows(view.rows)}</div>
            </div>
          )}
          {view.empty === null ? null : (
            <p class="stats__empty" data-hud-stats-empty>
              {view.empty}
            </p>
          )}
          <div class="stats__actions">
            {view.actions.map((entry) => (
              <button
                type="button"
                class="kit kit-button stats__action"
                key={entry.id}
                data-hud-stats-action={entry.id}
                onClick={() => pressAction(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

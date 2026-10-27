import type { CSSProperties, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Panel } from '../../kit';
import type { StatsIntent } from './mount';
import {
  STATS_NARROW_QUERY,
  figureRuleLocal,
  statsBoard,
  type StatsActionId,
  type StatsBoard,
  type StatsMode,
  type StatsRow,
  type StatsView,
} from './view';
import './stats.css';

export type StatsPanelProps = Readonly<{
  view: StatsView;
  onIntent?: ((intent: StatsIntent) => void) | undefined;
}>;

function compactViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(STATS_NARROW_QUERY).matches;
}

/** Repaints when the panel crosses the breakpoint, so the rule follows the board it lays out. */
function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(compactViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(STATS_NARROW_QUERY);
    const sync = (): void => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return compact;
}

/** The figure block's own rule box, as the inline style the panel positions it with. */
function ruleStyleOf(board: StatsBoard): CSSProperties {
  const rule = figureRuleLocal(board);
  return {
    left: `${rule.x}px`,
    top: `${rule.y}px`,
    width: `${rule.w}px`,
    height: `${rule.h}px`,
  };
}

function tableRows(rows: readonly StatsRow[]): JSX.Element[] {
  return rows.map((row) => (
    <div class="stats__row" key={row.id} data-hud-stats-row={row.id}>
      {row.cells.map((cell, index) => (
        <span class="stats__cell" key={index} data-hud-stats-cell={String(index)}>
          {cell}
        </span>
      ))}
      <span class="stats__row-rule" data-hud-stats-rule aria-hidden="true" />
    </div>
  ));
}

/** The board as the panel paints it: the hook above picks which measured column it lays out. */
export function statsPanelTree(props: StatsPanelProps, compact: boolean): JSX.Element {
  const { view } = props;
  const handler = props.onIntent;
  const month = view.month;
  const board = statsBoard(compact ? 'narrow' : 'desktop');
  const ruleStyle = ruleStyleOf(board);

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
                  <span
                    class="stats__figure-rule"
                    data-hud-stats-rule
                    aria-hidden="true"
                    style={ruleStyle}
                  />
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

export function StatsPanel(props: StatsPanelProps): JSX.Element {
  const compact = useCompactViewport();
  return statsPanelTree(props, compact);
}

import type { JSX } from 'preact';
import { Panel, PrimaryButton, Row } from '../../kit';
import type { RunOverIntent } from './mount';
import {
  RUN_OVER_COLUMNS,
  RUN_OVER_COLUMN_LABELS,
  RUN_OVER_EM_DASH,
  RUN_OVER_ROW_STATE_LABELS,
  RUN_OVER_TAB_FALLBACK,
  type RunOverColumnId,
  type RunOverRowView,
  type RunOverTab,
  type RunOverView,
} from './view';
import './run-over.css';

export type RunOverPanelProps = Readonly<{
  view: RunOverView;
  onIntent?: ((intent: RunOverIntent) => void) | undefined;
}>;

function rowCell(row: RunOverRowView, column: Exclude<RunOverColumnId, 'pokemon'>): string {
  return row[column] ?? RUN_OVER_EM_DASH;
}

function tableRow(row: RunOverRowView): JSX.Element {
  return (
    <div class="run-over__row" key={row.memberId} data-hud-run-over-row data-state={row.state}>
      <Row class="run-over__row-skin">
        <span class="run-over__portrait" role="img" aria-label={row.name} />
        <span class="run-over__row-name">{row.name}</span>
        <span class="run-over__row-state">{RUN_OVER_ROW_STATE_LABELS[row.state]}</span>
        <span class="run-over__cell" data-hud-run-over-column="kos">
          {rowCell(row, 'kos')}
        </span>
        <span class="run-over__cell" data-hud-run-over-column="dealt">
          {rowCell(row, 'dealt')}
        </span>
        <span class="run-over__cell" data-hud-run-over-column="tanked">
          {rowCell(row, 'tanked')}
        </span>
      </Row>
    </div>
  );
}

export function RunOverPanel(props: RunOverPanelProps): JSX.Element {
  const { view } = props;
  const handler = props.onIntent;
  const secondary = view.secondary ?? null;
  const portraits = view.portraits ?? [];
  const tabs = view.tabLabels ?? RUN_OVER_TAB_FALLBACK;

  const openTab = (tab: RunOverTab): void => {
    if (handler === undefined) return;
    handler({ type: 'tab', tab });
  };

  const confirm = (): void => {
    if (handler === undefined) return;
    handler({ type: 'confirm' });
  };

  const tab = (id: RunOverTab): JSX.Element => {
    const selected = id === view.tab;
    return (
      <button
        type="button"
        class="run-over__tab"
        data-hud-run-over-tab={id}
        data-selected={selected ? 'true' : undefined}
        aria-label={tabs[id]}
        onClick={() => openTab(id)}
      >
        {tabs[id]}
      </button>
    );
  };

  return (
    <div
      class="run-over"
      data-hud-run-over
      data-won={view.won ? 'true' : 'false'}
      data-tab={view.tab}
      data-actions={secondary === null ? '1' : '2'}
    >
      <div class="run-over__stage">
        <div class="run-over__panel" data-hud-run-over-panel>
          <Panel class="run-over__skin" />
          <span class="run-over__highlight" aria-hidden="true" />
          <span class="run-over__accent" aria-hidden="true" />
          <h1 class="run-over__title" data-hud-run-over-title>
            {view.title}
          </h1>
          <p class="run-over__blurb">{view.blurb}</p>
          {portraits.length === 0 ? null : (
            <span class="run-over__portraits">
              {portraits.map((portrait) => (
                <span
                  key={portrait.memberId}
                  class="run-over__portrait-cell"
                  data-hud-run-over-portrait
                  role="img"
                  aria-label={portrait.name}
                />
              ))}
            </span>
          )}
          <div class="run-over__tabs" data-hud-run-over-tabs>
            {tab('totals')}
            {tab('pokemon')}
          </div>
          {view.tab === 'totals' ? (
            <>
              <div class="run-over__stats">
                {view.stats.map((stat) => (
                  <div class="run-over__stat" key={stat.id} data-hud-run-over-stat={stat.id}>
                    <span class="run-over__stat-label">{stat.label}</span>
                    <span class="run-over__stat-value">{stat.value}</span>
                    <span class="run-over__rule" aria-hidden="true" />
                  </div>
                ))}
              </div>
              <span class="run-over__share" data-hud-run-over-share>
                {view.share}
              </span>
            </>
          ) : (
            <div class="run-over__list" data-hud-run-over-list>
              {RUN_OVER_COLUMNS.map((column) => (
                <span class="run-over__header" key={column} data-hud-run-over-header={column}>
                  {RUN_OVER_COLUMN_LABELS[column]}
                </span>
              ))}
              <div class="run-over__rows">{view.rows.map(tableRow)}</div>
            </div>
          )}
          <div class="run-over__actions">
            <span class="run-over__button" data-hud-run-over-button>
              <PrimaryButton onPress={confirm}>{view.button.label}</PrimaryButton>
            </span>
            {secondary === null ? null : (
              <span class="run-over__secondary" data-hud-run-over-secondary aria-hidden="true">
                {secondary.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

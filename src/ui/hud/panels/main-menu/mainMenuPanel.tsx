import type { JSX } from 'preact';
import { Panel, Row } from '../../kit';
import type { MainMenuIntent } from './mount';
import type { MainMenuRowId, MainMenuView } from './view';
import './main-menu.css';

export type MainMenuPanelProps = Readonly<{
  view: MainMenuView;
  onIntent?: ((intent: MainMenuIntent) => void) | undefined;
}>;

/** The intent a row's press asks the scene for. */
const ROW_INTENTS: Readonly<Record<MainMenuRowId, MainMenuIntent['type']>> = {
  continue: 'continue',
  new: 'new-run',
  options: 'options',
  stats: 'stats',
};

function rowClass(selected: boolean): string {
  return selected ? 'main-menu__row-button main-menu__row-button--selected' : 'main-menu__row-button';
}

export function MainMenuPanel(props: MainMenuPanelProps): JSX.Element {
  const { view } = props;
  const handler = props.onIntent;

  const press = (id: MainMenuRowId): void => {
    if (handler === undefined) return;
    handler({ type: ROW_INTENTS[id] });
  };

  const portraits = (): JSX.Element[] =>
    view.portraits.map((portrait) => (
      <span
        key={portrait.memberId}
        class="main-menu__portrait"
        data-hud-main-menu-portrait
        role="img"
        aria-label={portrait.name}
      />
    ));

  return (
    <div class="main-menu" data-hud-panel="main-menu">
      <div class="main-menu__stage">
        <div class="main-menu__glow" />
        <div class="main-menu__window" data-hud-main-menu-window />
        <h1 class="main-menu__title" data-hud-main-menu-title>
          {view.title}
        </h1>
        <span class="main-menu__rule" data-hud-main-menu-rule />
        <div class="main-menu__card" data-hud-main-menu-card data-rows={String(view.rows.length)}>
          <Panel class="main-menu__skin" />
          {view.rows.map((row) => {
            const selected = row.id === view.selected;
            return (
              <div
                key={row.id}
                class="main-menu__row"
                data-hud-main-menu-row={row.id}
                data-selected={selected ? 'true' : undefined}
              >
                <Row
                  class={rowClass(selected)}
                  selected={selected}
                  disabled={!row.enabled}
                  onPress={() => press(row.id)}
                >
                  {selected ? (
                    <>
                      <span class="main-menu__bar" data-hud-main-menu-bar />
                      <span class="main-menu__cursor" data-hud-main-menu-cursor>
                        {'>'}
                      </span>
                    </>
                  ) : null}
                  <span class="main-menu__label">{row.label}</span>
                  {row.value === '' ? null : <span class="main-menu__value">{row.value}</span>}
                  {row.id === 'continue' && view.portraits.length > 0 ? (
                    <span class="main-menu__portraits">{portraits()}</span>
                  ) : null}
                </Row>
              </div>
            );
          })}
        </div>
        {view.stats.length === 0 ? null : (
          <div class="main-menu__footer" data-hud-main-menu-footer>
            <span class="main-menu__footer-rule" />
            {view.stats.map((stat) => (
              <div key={stat.id} class="main-menu__stat" data-hud-main-menu-stat={stat.id}>
                <span class="main-menu__stat-label">{stat.label}</span>
                <span class="main-menu__stat-value">{stat.value}</span>
                {stat.name === null ? null : <span class="main-menu__stat-name">{stat.name}</span>}
              </div>
            ))}
          </div>
        )}
        {view.version === null ? null : (
          <span class="main-menu__version" data-hud-main-menu-version>
            {view.version}
          </span>
        )}
      </div>
    </div>
  );
}

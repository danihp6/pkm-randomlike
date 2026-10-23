import type { CSSProperties, JSX } from 'preact';
import { t } from '../../../../i18n';
import type { HudCommand } from '../../commands';
import type { BagPanelView, BagTileView, Rect, SpriteCell } from './view';
import './bag.css';

export type BagPanelProps = Readonly<{
  view: BagPanelView;
  onCommand?: ((command: HudCommand) => void) | undefined;
}>;

function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

function sprite(icon: SpriteCell): CSSProperties {
  return {
    width: `${icon.size}px`,
    height: `${icon.size}px`,
    backgroundImage: `url("${icon.url}")`,
    backgroundPosition: `-${icon.x}px -${icon.y}px`,
  };
}

function tile(piece: BagTileView, band: Rect): JSX.Element {
  return (
    <button
      type="button"
      class="bag__tile"
      data-hud-bag-tile={String(piece.index)}
      data-selected={piece.selected ? 'true' : undefined}
      aria-pressed={piece.selected}
      aria-label={piece.itemId === null ? piece.name : `${piece.name} ${piece.count}`}
      style={box(piece.box, band)}
    >
      {piece.icon === null ? null : (
        <span class="bag__icon" data-hud-bag-icon style={sprite(piece.icon)} />
      )}
      <span class="bag__count" data-hud-bag-count>
        {piece.count}
      </span>
    </button>
  );
}

export function BagPanel(props: BagPanelProps): JSX.Element {
  const { view } = props;
  const band = view.grid.band;

  return (
    <>
      <div
        class="bag"
        data-hud-panel="bag"
        data-open={view.open ? 'true' : 'false'}
        hidden={!view.open}
        style={box(view.box)}
      >
        <div class="bag__body">
          <span class="bag__highlight" style={box(view.highlight)} />
          <button
            type="button"
            class="bag__chip"
            data-hud-bag="chip"
            aria-label={t('keybind.bag')}
            style={box(view.chip.box)}
            onClick={() => props.onCommand?.({ type: 'panel', panel: 'bag' })}
          >
            {view.chip.letter}
          </button>
          <div class="bag__tabs" data-hud-bag="tabs">
            {view.tabs.map((tab) => (
              <button
                key={tab.category}
                type="button"
                class="bag__tab"
                data-hud-bag-tab={tab.category}
                data-active={tab.active ? 'true' : undefined}
                aria-pressed={tab.active}
                style={box(tab.box)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            class="bag__search"
            data-hud-bag="search"
            aria-label={view.search.placeholder}
            placeholder={view.search.placeholder}
            value={view.search.value}
            spellcheck={false}
            autocomplete="off"
            style={box(view.search.box)}
          />
          <div class="bag__grid" data-hud-bag="grid" style={box(band)}>
            {view.tiles.length === 0 ? (
              <p class="bag__empty">{t('hud.noItems')}</p>
            ) : (
              view.tiles.map((piece) => tile(piece, band))
            )}
          </div>
          <div class="bag__footer" data-hud-bag="footer" style={box(view.footer.box)}>
            <span class="bag__rule" style={box(view.footer.rule, view.footer.box)} />
            <span class="bag__footer-label">{view.footer.label}</span>
            <span class="bag__footer-value">{view.footer.value}</span>
          </div>
        </div>
      </div>
      {view.info === null ? null : (
        <aside
          class="bag-info"
          data-hud-bag-info
          style={{
            left: `${view.info.box.x}px`,
            top: `${view.info.box.y}px`,
            width: `${view.info.box.w}px`,
            minHeight: `${view.info.box.h}px`,
          }}
        >
          <h2 class="bag-info__title">{view.info.title}</h2>
          {view.info.text === '' ? null : <p class="bag-info__text">{view.info.text}</p>}
        </aside>
      )}
    </>
  );
}

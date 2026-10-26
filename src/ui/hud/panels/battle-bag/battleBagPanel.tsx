import type { CSSProperties, JSX } from 'preact';
import itemAtlas from '../../../../data/anil/item-icons.json';
import { ITEM_ICON_ATLAS_URL } from '../../../../data/itemIcons';
import { joinClasses } from '../../kit';
import type { BattleBagIntent } from './mount';
import { cellPressIntent, type BattleBagCell, type BattleBagView, type Rect } from './view';
import './battleBag.css';

export { cellPressIntent };

export type BattleBagProps = Readonly<{
  view: BattleBagView;
  onIntent?: ((intent: BattleBagIntent) => void) | undefined;
}>;

/** The card in viewport coordinates: the layer is `fixed`, so the model's page rect is its own. */
function cardStyle(rect: Rect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.w}px`,
    height: `${rect.h}px`,
  };
}

/** A rect inside the card: the model measures in card coordinates, the card's children too. */
function insetStyle(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

/** The Añil atlas frame as a background position, the same 24 px cell the canvas draws. */
function iconStyle(frame: number): CSSProperties {
  const col = frame % itemAtlas.cols;
  const row = Math.floor(frame / itemAtlas.cols);
  return {
    width: `${itemAtlas.size}px`,
    height: `${itemAtlas.size}px`,
    backgroundImage: `url("${ITEM_ICON_ATLAS_URL}")`,
    backgroundPosition: `-${col * itemAtlas.size}px -${row * itemAtlas.size}px`,
  };
}

function flag(value: boolean): string {
  return value ? 'true' : 'false';
}

/** One grid box: a stack's button, or the dim outline past the pocket's last stack. */
function bagCell(cell: BattleBagCell, band: Rect, onPress: () => void): JSX.Element {
  if (cell.itemId === '') {
    return (
      <span
        key={cell.index}
        class="battle-bag__cell battle-bag__cell--empty"
        data-hud-bag-cell={String(cell.index)}
        data-empty="true"
        style={insetStyle(cell.box, band)}
      />
    );
  }
  return (
    <button
      key={cell.index}
      type="button"
      class={joinClasses('battle-bag__cell', cell.selected && 'battle-bag__cell--selected')}
      data-hud-bag-cell={String(cell.index)}
      data-selected={flag(cell.selected)}
      data-item={cell.itemId}
      data-empty="false"
      aria-pressed={cell.selected}
      aria-label={`${cell.name} \u00d7${cell.count}`}
      title={cell.name}
      style={insetStyle(cell.box, band)}
      onClick={onPress}
    >
      {cell.frame === null ? null : (
        <span class="battle-bag__icon" data-hud-bag-icon style={iconStyle(cell.frame)} />
      )}
      <span class="battle-bag__badge" data-hud-bag-count>
        {`\u00d7${cell.count}`}
      </span>
    </button>
  );
}

/**
 * The battle's bag over the canvas (`D49`, frame `05c Battle · bag`). Its card is the
 * menu box the scene already laid out, so the pocket chips, the filter field, the
 * 5×2 stack grid, the selected line, the floating item card and the ◀ control land
 * on the canvas's own rectangles. Each control answers with a `BattleBagIntent`; the
 * scene maps it onto the call the canvas already made. One press on a stack spends it,
 * exactly as the canvas's own click does; an empty cell only picks itself.
 */
export function BattleBagPanel(props: BattleBagProps): JSX.Element {
  const { view } = props;
  const emit = (intent: BattleBagIntent): void => props.onIntent?.(intent);

  return (
    <div
      class="battle-bag"
      data-hud-panel="battle-bag"
      data-open={flag(view.open)}
      hidden={!view.open}
      style={cardStyle(view.box)}
    >
      {view.tabs.map((tab) => (
        <button
          key={tab.category}
          type="button"
          class={joinClasses('battle-bag__tab', tab.active && 'battle-bag__tab--active')}
          data-hud-bag-tab={tab.category}
          data-active={flag(tab.active)}
          aria-pressed={tab.active}
          style={insetStyle(tab.box)}
          onClick={() => emit({ type: 'tab', category: tab.category })}
        >
          {tab.label}
        </button>
      ))}
      <input
        type="text"
        class="battle-bag__search"
        data-hud-bag-search
        data-focused={flag(view.search.focused)}
        aria-label={view.search.placeholder}
        placeholder={view.search.placeholder}
        value={view.search.text}
        spellcheck={false}
        autocomplete="off"
        style={insetStyle(view.search.box)}
        onInput={(event) => emit({ type: 'search', query: event.currentTarget.value })}
        onFocus={() => emit({ type: 'focus', focused: true })}
        onBlur={() => emit({ type: 'focus', focused: false })}
      />
      <div
        class="battle-bag__grid"
        data-hud-bag-grid
        style={insetStyle(view.grid.box)}
        onWheel={(event) => emit({ type: 'scroll', delta: event.deltaY < 0 ? -1 : 1 })}
      >
        {view.cells.map((cell) => bagCell(cell, view.grid.box, () => emit(cellPressIntent(cell))))}
      </div>
      {view.empty === null ? null : (
        <p class="battle-bag__empty" data-hud-bag-empty style={insetStyle(view.empty.box)}>
          {view.empty.text}
        </p>
      )}
      <p class="battle-bag__detail" data-hud-bag-detail style={insetStyle(view.detail.box)}>
        {view.detail.text}
      </p>
      {view.info === null ? null : (
        <aside class="battle-bag__info" data-hud-bag-info style={insetStyle(view.info.box)}>
          {view.info.text}
        </aside>
      )}
      <button
        type="button"
        class="battle-bag__back"
        data-hud-bag-back
        aria-label={view.back.label}
        style={insetStyle(view.back.box)}
        onClick={() => emit({ type: 'back' })}
      >
        {view.back.label}
      </button>
    </div>
  );
}

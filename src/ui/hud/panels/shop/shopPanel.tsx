import type { CSSProperties, JSX } from 'preact';
import type { ShopIntent } from './mount';
import { SHOP_HEADER_H, SHOP_PAD_X, type Rect, type ShopPanelView, type ShopRowView } from './view';
import './shop.css';

export type ShopPanelProps = Readonly<{
  view: ShopPanelView;
  onIntent?: ((intent: ShopIntent) => void) | undefined;
}>;

function box(rect: Rect, origin?: Rect): CSSProperties {
  const x = origin === undefined ? rect.x : rect.x - origin.x;
  const y = origin === undefined ? rect.y : rect.y - origin.y;
  return { left: `${x}px`, top: `${y}px`, width: `${rect.w}px`, height: `${rect.h}px` };
}

function anchor(rect: Rect): CSSProperties {
  return { left: `${rect.x}px`, top: `${rect.y}px` };
}

function sprite(icon: Readonly<{ url: string; size: number; x: number; y: number }>): CSSProperties {
  return {
    width: `${icon.size}px`,
    height: `${icon.size}px`,
    backgroundImage: `url("${icon.url}")`,
    backgroundPosition: `-${icon.x}px -${icon.y}px`,
  };
}

export function ShopPanel(props: ShopPanelProps): JSX.Element {
  const { view } = props;
  const mode = view.tabs.find((tab) => tab.active)?.mode ?? 'buy';
  // The contract's view carries no title rect (the shipped card's title sits in the
  // header band), so the band's own two constants position it.
  const header: CSSProperties = {
    left: `${SHOP_PAD_X}px`,
    top: '0px',
    height: `${SHOP_HEADER_H}px`,
  };

  const wheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    props.onIntent?.({ type: 'scroll', delta: event.deltaY > 0 ? 1 : -1 });
  };

  const press = (row: ShopRowView): void => {
    props.onIntent?.(
      mode === 'buy' ? { type: 'buy', itemId: row.itemId } : { type: 'sell', itemId: row.itemId },
    );
  };

  return (
    <div
      class="shop"
      data-hud-panel="shop"
      data-open={view.open ? 'true' : 'false'}
      hidden={!view.open}
      style={box(view.box)}
    >
      <div class="shop__body">
        <span class="shop__highlight" style={box(view.highlight)} />
        <span class="shop__header" style={header}>
          <span class="shop__title" data-hud-shop="title">
            {view.title}
          </span>
        </span>
        <button
          type="button"
          class="shop__close"
          data-hud-shop="close"
          aria-label={view.close.label}
          style={box(view.close.box)}
          onClick={() => props.onIntent?.({ type: 'close' })}
        >
          {view.close.label}
        </button>
        <span class="shop__anchor shop__money" data-hud-shop="money" style={anchor(view.money.box)}>
          {view.money.text}
        </span>
        <div class="shop__tabs" data-hud-shop="tabs">
          {view.tabs.map((tab) => (
            <button
              key={tab.mode}
              type="button"
              class="shop__tab"
              data-hud-shop-tab={tab.mode}
              data-active={tab.active ? 'true' : undefined}
              aria-pressed={tab.active}
              style={box(tab.box)}
              onClick={() => props.onIntent?.({ type: 'mode', mode: tab.mode })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ol class="shop__list" data-hud-shop="list" style={box(view.list.box)} onWheel={wheel}>
          {view.rows.map((row) => (
            <li key={row.index} class="shop__row-item">
              <button
                type="button"
                class="shop__row"
                data-hud-shop-row={String(row.index)}
                data-selected={row.selected ? 'true' : undefined}
                data-affordable={row.affordable ? 'true' : 'false'}
                aria-pressed={row.selected}
                style={box(row.box, view.list.box)}
                onClick={() => press(row)}
              >
                {row.icon === null ? null : (
                  <span class="shop__icon" data-hud-shop-icon style={sprite(row.icon)} />
                )}
                <span class="shop__name">{row.name}</span>
                <span class="shop__price">{row.price}</span>
                <span class="shop__owned">{row.owned}</span>
              </button>
            </li>
          ))}
        </ol>
        <span class="shop__message" data-hud-shop="message" style={box(view.message.box)}>
          {view.message.text}
        </span>
        <span class="shop__anchor shop__hint" data-hud-shop="hint" style={anchor(view.hint.box)}>
          {view.hint.text}
        </span>
        {view.empty === null ? null : (
          <span class="shop__empty" data-hud-shop="empty" style={anchor(view.empty.box)}>
            {view.empty.text}
          </span>
        )}
      </div>
    </div>
  );
}

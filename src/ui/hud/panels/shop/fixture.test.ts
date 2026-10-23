import { describe, expect, it } from 'vitest';
import fixture from '../../../../../design/fixtures/03d-route-shop-buy.json';
import { t } from '../../../../i18n';
import type { ShopRow } from '../../../shop';
import { isHudState } from '../../fixtures';
import { shopPanelView, type ShopIcon, type ShopInput, type ShopMode } from './index';

const VIEWPORT = { width: 1280, height: 800 };
const NO_ICON: (itemId: string) => ShopIcon | null = () => null;

/** The frame's own row block, as the `ShopRow`s the scene module hands the view. */
function rowsFrom(block: typeof fixture.buy, mode: ShopMode): readonly ShopRow[] {
  return block.rows.map((row) => ({
    itemId: row.itemId,
    name: row.name,
    price: row.price,
    count: row.count,
    owned: row.owned,
    affordable: row.affordable,
    draggable: mode === 'buy' && row.affordable,
  }));
}

function inputFrom(block: typeof fixture.buy, mode: ShopMode): ShopInput {
  return {
    title: block.title,
    mode,
    rows: rowsFrom(block, mode),
    scroll: block.scroll,
    selected: block.selected,
    money: block.money,
    message: block.message,
    empty: block.empty,
    open: true,
  };
}

describe('design/fixtures/03d-route-shop-buy.json', () => {
  it('carries a snapshot state that passes isHudState unchanged', () => {
    expect(isHudState(fixture.state)).toBe(true);
    expect(Object.keys(fixture.state)).toEqual(['party', 'bag', 'money', 'route', 'battle', 'notice']);
  });

  it('paints the BUY block: the title, the first row and the money line', () => {
    const view = shopPanelView(inputFrom(fixture.buy, 'buy'), VIEWPORT, NO_ICON);
    expect(view.title).toBe('MART');
    expect(view.rows[0]!.name).toBe('10x Poké Ball');
    expect(view.rows[0]!.price).toBe('¥300');
    expect(view.tabs[0]!.active).toBe(true);
    expect(view.money.text).toBe(t('mart.money', { amount: fixture.buy.money }));
    expect(view.hint.text).toBe(fixture.buy.hint);
  });

  it('paints the SELL block the same way', () => {
    const view = shopPanelView(inputFrom(fixture.sell, 'sell'), VIEWPORT, NO_ICON);
    expect(view.title).toBe('MART');
    expect(view.rows[0]!.name).toBe('Nugget');
    expect(view.rows[0]!.price).toBe('¥5000');
    expect(view.tabs[1]!.active).toBe(true);
    expect(view.money.text).toBe(t('mart.money', { amount: fixture.sell.money }));
    expect(view.hint.text).toBe(fixture.sell.hint);
  });
});

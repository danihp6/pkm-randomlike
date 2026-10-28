import { bandForMap } from '../../engine/run';
import { hashSeed, Rng } from '../../engine/rng';
import { t, type TranslationKey } from '../../i18n';
import { buildShop, buyRows, type ShopSlot } from '../../ui/shop';
import { closeShopCard, openShopCard } from '../panels/shop';
import type { RoomHost, RoomPanel } from './types';

/**
 * The **Mart** window (`docs/maps-spec.md` §7, D33, D45): the floor's stock and the
 * whole shop card. The **merchant** special NPC opens it from its own card
 * (`openMart`), and a room that owns its own counter may hand `openMart` that shelf
 * instead (the secret shop), so no room descriptor lives here: the registry collects
 * only modules that export a `descriptor`, and this file exports none. The card takes
 * no key and the route keeps walking behind it.
 *
 * This module keeps every stock rule and cache key; the card itself is the DOM one
 * of `src/scenes/panels/shop.ts`, which paints the same shelves and is the only
 * writer.
 */

/** The tab, the scroll and the selection the card opened on. */
let shopMode: 'buy' | 'sell' = 'buy';
let shopIndex = 0;
let shopScroll = 0;
let shopStock: readonly ShopSlot[] = [];
/**
 * The `seed:map` the stock was rolled for. Keyed on both, so a floor re-rolled on
 * a later run takes its own shelves while a revisit keeps the ones it opened with.
 */
let shopStockKey = '';
let shopMessage = '';

/**
 * A shelf the Mart shows instead of the floor's own stock: the secret shop's fixed
 * counter reuses this card through `openMart(host, stock)`. The key names the cache
 * the rows belong to, so two counters on one floor never trade rows.
 */
export type MartStock = Readonly<{
  /** The cache key the shelf belongs to; a different key re-rolls the rows. */
  key: string;
  /** The BUY tab's rows, in order. */
  slots: readonly ShopSlot[];
  /** The card's title key; undefined reads `mart.title`. */
  title?: TranslationKey;
}>;

/**
 * Opens the Mart for `host`, at the floor's band and stock
 * (`docs/maps-spec.md` §7, D33). The stock is rolled once per map on a dedicated
 * stream, so reopening the Mart shows the same shelves. The card is floating
 * (`D45`): it never takes the keyboard and the walker keeps running behind it.
 *
 * A caller that owns its own counter passes `stock`: the card then shows those rows
 * under that cache key and title, and draws no stream at all (the secret shop).
 */
export function openMart(host: RoomHost, stock?: MartStock): void {
  if (host.panelOpen()) return;
  let title: TranslationKey = 'mart.title';
  if (stock) {
    shopStockKey = stock.key;
    shopStock = stock.slots;
    title = stock.title ?? 'mart.title';
  } else {
    const key = `${host.run.seed}:${host.run.mapIndex}`;
    if (shopStockKey !== key) {
      const band = bandForMap(host.run.mapIndex);
      shopStock = buildShop(band.id, new Rng(hashSeed(`${host.run.seed}:shop:${host.run.mapIndex}`)));
      shopStockKey = key;
    }
  }
  shopMode = 'buy';
  shopIndex = 0;
  shopScroll = 0;
  shopMessage = t('mart.greeting');
  openShopCard(host, {
    title: t(title),
    mode: shopMode,
    rows: buyRows(host.run, shopStock, host.run.mapIndex),
    scroll: shopScroll,
    selected: shopIndex,
    money: host.run.money,
    message: shopMessage,
    empty: t('mart.emptyStock'),
    open: true,
  });
  host.openPanel(PANEL);
}

/** Tears down the Mart card (the scene calls it when the room changes). */
function closeShop(): void {
  closeShopCard();
  shopIndex = 0;
  shopScroll = 0;
}

/** The Mart as the scene holds it: one floating card, keyed by its own ✕. */
const PANEL: RoomPanel = {
  modal: false,
  close() {
    closeShop();
  },
};

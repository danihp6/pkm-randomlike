import { signal, type Signal } from '@preact/signals';
import itemIcons from '../../data/anil/item-icons.json';
import { ITEM_ICON_ATLAS_URL, ITEM_ICON_SIZE, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { t } from '../../i18n';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  SHOP_ROWS,
  mountShopPanel,
  shopPanelView,
  type ShopIcon,
  type ShopInput,
  type ShopIntent,
  type ShopMode,
  type ShopPanelView,
} from '../../ui/hud/panels/shop';
import { buyItem, buyRows, sellItem, sellRows, type ShopRow, type ShopSlot } from '../../ui/shop';
import type { RoomHost } from '../rooms/types';
import type { RoutePanelDescriptor } from './types';

/**
 * The scene-side owner of the Mart's DOM card (`?hud=dom`, `D49`). The stock rules,
 * the cache key and the room panel stay in `src/scenes/rooms/shop.ts`; this module
 * paints the card into the `#hud` layer from `src/ui/hud/panels/shop/` and is the
 * **only** writer: one press, one `ShopTrade`, one `commitRun`. It holds no `Rng`
 * and no clock, so the same floor opens the same shelf with the flag on or off.
 */

/**
 * `?hud=dom` read once, the way every scene module reads it. With the flag off this
 * module draws nothing: the Mart's card is the room's Phaser one.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/** The item atlas' columns (`src/data/anil/item-icons.json`), for the sprite offsets. */
const ITEM_ICON_COLS: number = itemIcons.cols;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this folder's modules
 * never import Phaser as a value. A paused route sits under the DOM root, which has
 * to hide itself; the resume brings the card back with its mode and its rows.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
/** The scene's own teardown: the DOM card is outside Phaser and must be unmounted. */
const SCENE_SHUTDOWN = 'shutdown';

/** The card's session: the host, the view signal and the mount's disposer. */
let cardHost: RoomHost | null = null;
let cardView: Signal<ShopPanelView> | null = null;
let cardDispose: (() => void) | null = null;
let cardUnsubscribe: (() => void) | null = null;
/** The tab, the scroll and the selection are this module's own state. */
let cardMode: ShopMode = 'buy';
let cardScroll = 0;
let cardSelected = 0;
let cardMessage = '';
/** The title and the shelf the room handed over, for this card's session only. */
let cardTitle = '';
let cardStock: readonly ShopSlot[] = [];
/** True while the route is paused behind a battle or the Settings screen. */
let cardPaused = false;
/** The shipped card's display-object count, reported by `rooms/shop.ts` (flag off). */
let shippedDrawnObjects = 0;

/**
 * The number of display objects the Mart draws in Phaser right now. Under the flag
 * the card is the DOM one and the answer is 0; with the flag off the drawing lives
 * in `src/scenes/rooms/shop.ts`, which reports its own count through
 * `noteShopDrawnObjects` — a panel module never imports a room.
 */
export function shopDrawnObjectCount(): number {
  return DOM_HUD ? 0 : shippedDrawnObjects;
}

/** The room's shipped card reports its display-object count (flag off only). */
export function noteShopDrawnObjects(count: number): void {
  shippedDrawnObjects = DOM_HUD ? 0 : Math.max(0, count);
}

/** The atlas cell for an item, as the panel's `background-position` pair. */
function shopIcon(itemId: string): ShopIcon | null {
  const frame = itemIconFrame(itemId);
  if (frame === null) return null;
  return {
    url: ITEM_ICON_ATLAS_URL,
    size: ITEM_ICON_SIZE,
    x: (frame % ITEM_ICON_COLS) * ITEM_ICON_SIZE,
    y: Math.floor(frame / ITEM_ICON_COLS) * ITEM_ICON_SIZE,
  };
}

/** The view's viewport: the scene's own window, which the card is centred in. */
function viewport(host: RoomHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/**
 * The shelf the card opened on: a BUY row carries its slot's own `(itemId, price,
 * count)`, so the rows the room rolled are the card's stock for its session. The
 * room's cache stays in `rooms/shop.ts`; this is the one read the card needs.
 */
function stockOf(rows: readonly ShopRow[]): readonly ShopSlot[] {
  return rows.map((row) => ({ itemId: row.itemId, price: row.price, count: row.count }));
}

/** The rows the current tab shows, from the live run. */
function rowsFor(host: RoomHost): readonly ShopRow[] {
  return cardMode === 'buy' ? buyRows(host.run, cardStock) : sellRows(host.run);
}

/** Builds the view from the live run and this module's own tab, scroll and message. */
function paintView(host: RoomHost, rows: readonly ShopRow[]): ShopPanelView {
  return shopPanelView(
    {
      title: cardTitle,
      mode: cardMode,
      rows,
      scroll: cardScroll,
      selected: cardSelected,
      money: host.run.money,
      message: cardMessage,
      empty: cardMode === 'buy' ? t('mart.emptyStock') : t('mart.emptySell'),
      open: !cardPaused,
    },
    viewport(host),
    shopIcon,
  );
}

function setShopPaused(paused: boolean): void {
  if (cardPaused === paused) return;
  cardPaused = paused;
  const host = cardHost;
  if (host !== null) pushShopCard(host);
}

/**
 * Opens the Mart's DOM card: the view comes from `rooms/shop.ts` (its stock, its
 * title and the greeting), the mount from the `#hud` layer. A missing layer mounts
 * nothing, exactly as the shipped DOM panels guard it.
 */
export function openShopCard(host: RoomHost, view: ShopInput): void {
  closeShopCard();
  cardHost = host;
  cardTitle = view.title;
  cardMode = view.mode;
  cardScroll = view.scroll;
  cardSelected = view.selected;
  cardMessage = view.message;
  cardStock = view.mode === 'buy' ? stockOf(view.rows) : [];
  cardPaused = host.scene.sys.isPaused();
  const painted = signal(shopPanelView({ ...view, open: !cardPaused }, viewport(host), shopIcon));
  cardView = painted;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    cardDispose = mountShopPanel(layer, painted, (intent) => handleShopIntent(host, intent));
  }
  const events = host.scene.events;
  const onPause = (): void => setShopPaused(true);
  const onResume = (): void => setShopPaused(false);
  const onShutdown = (): void => closeShopCard();
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  events.on(SCENE_SHUTDOWN, onShutdown);
  cardUnsubscribe = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
    events.off(SCENE_SHUTDOWN, onShutdown);
  };
}

/** Repaints the card from the live run; the tab, the scroll and the selection stay. */
export function pushShopCard(host: RoomHost): void {
  const view = cardView;
  if (view === null) return;
  cardHost = host;
  const rows = rowsFor(host);
  const total = rows.length;
  // The shipped `refreshShop` clamps before it paints: a sale can shorten the list
  // under the cursor, and a shorter BUY shelf can leave the window past its end.
  cardSelected = total === 0 ? -1 : Math.min(cardSelected, total - 1);
  cardScroll = Math.max(0, Math.min(cardScroll, Math.max(0, total - SHOP_ROWS)));
  view.value = paintView(host, rows);
}

/** Tears the card down: the scene subscription, the mount and the session state. */
export function closeShopCard(): void {
  cardUnsubscribe?.();
  cardUnsubscribe = null;
  cardDispose?.();
  cardDispose = null;
  cardView = null;
  cardHost = null;
  cardTitle = '';
  cardStock = [];
  cardMode = 'buy';
  cardScroll = 0;
  cardSelected = 0;
  cardMessage = '';
  cardPaused = false;
}

/** A BUY press: one slot, one `buyItem`, one `commitRun`, the shipped message. */
function buyPressed(host: RoomHost, itemId: string): void {
  const slot = cardStock.find((entry) => entry.itemId === itemId);
  if (slot === undefined) return;
  const row = buyRows(host.run, cardStock).findIndex((entry) => entry.itemId === itemId);
  if (row >= 0) cardSelected = row;
  const trade = buyItem(host.run, slot);
  if (!trade.ok) {
    cardMessage = t('mart.noMoney');
    return;
  }
  host.commitRun(trade.run);
  cardMessage = t('mart.bought', {
    name: getItem(slot.itemId)?.name ?? slot.itemId,
    amount: trade.amount,
  });
}

/** A SELL press: one unit, one `sellItem`, one `commitRun`, the shipped message. */
function sellPressed(host: RoomHost, itemId: string): void {
  const rows = sellRows(host.run);
  const index = rows.findIndex((entry) => entry.itemId === itemId);
  const trade = sellItem(host.run, itemId);
  if (!trade.ok) return;
  if (index >= 0) cardSelected = index;
  host.commitRun(trade.run);
  cardMessage = t('mart.sold', {
    name: rows[index]?.name ?? getItem(itemId)?.name ?? itemId,
    amount: trade.amount,
  });
}

/** The card's own command channel: the one place anything is written. */
function handleShopIntent(host: RoomHost, intent: ShopIntent): void {
  if (cardView === null) return;
  switch (intent.type) {
    case 'mode': {
      if (cardMode === intent.mode) return;
      cardMode = intent.mode;
      cardSelected = 0;
      cardScroll = 0;
      cardMessage = intent.mode === 'buy' ? t('mart.greeting') : t('mart.greetingSell');
      break;
    }
    case 'select': {
      cardSelected = Number.isFinite(intent.index) ? Math.trunc(intent.index) : 0;
      break;
    }
    case 'scroll': {
      const total = rowsFor(host).length;
      const next = Math.max(
        0,
        Math.min(Math.max(0, total - SHOP_ROWS), cardScroll + (intent.delta > 0 ? 1 : -1)),
      );
      if (next === cardScroll) return;
      cardScroll = next;
      cardSelected = -1;
      break;
    }
    case 'buy': {
      buyPressed(host, intent.itemId);
      break;
    }
    case 'sell': {
      sellPressed(host, intent.itemId);
      break;
    }
    case 'close': {
      host.closePanel();
      return;
    }
    default:
      return;
  }
  pushShopCard(host);
}

export const descriptor: RoutePanelDescriptor = {
  id: 'shop',
  order: 80,
  // The card belongs to the room (flag off) or to this module's DOM mount (flag on),
  // so the registry only names the panel: there is nothing to build here.
  build(): void {
    return;
  },
};

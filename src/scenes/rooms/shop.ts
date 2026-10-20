import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { bandForMap, equipHeldItem } from '../../engine/run';
import { useItemOn } from '../../engine/run/items';
import { hashSeed, Rng } from '../../engine/rng';
import { t, type TranslationKey } from '../../i18n';
import { addFloatingPanel, type FloatingPanel } from '../../ui/floatingPanel';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import {
  buildShop,
  buyItem,
  buyRows,
  sellItem,
  sellRows,
  sellableStacks,
  type ShopSlot,
} from '../../ui/shop';
import type { RoomDrop, RoomHost, RoomPanel } from './types';

/**
 * The **Mart** window (`docs/maps-spec.md` §7, D33, D45): the floor's stock and the
 * whole floating shop card. The **merchant** special NPC opens it from its own card
 * (`openMart`), so no room descriptor lives here: the registry collects only modules
 * that export a `descriptor`, and this file exports none. The card draws no scrim,
 * takes no key and the route keeps walking behind it. A BUY row is taken by dragging
 * it onto the bag or a member; a SELL row still sells with one click.
 */

/** The Mart window: BUY / SELL tabs over the floor's own stock. */
const SHOP_W = 640;
const SHOP_H = 540;
const SHOP_ROW_H = 44;
const SHOP_ROWS = 7;
const SHOP_TAB_W = 108;
const SHOP_TAB_H = 30;
const SHOP_TAB_GAP = 6;
const SHOP_MODES = ['buy', 'sell'] as const;

/** The content offset of the list window: below the money line and the tabs. */
const SHOP_LIST_TOP = 68;

type ShopMode = (typeof SHOP_MODES)[number];

/** The shop's two pockets; the key of the label printed on each tab. */
const SHOP_MODE_LABELS: Readonly<Record<ShopMode, TranslationKey>> = {
  buy: 'mart.buy',
  sell: 'mart.sell',
};

type ShopRowObjects = {
  highlight: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  price: Phaser.GameObjects.BitmapText;
  count: Phaser.GameObjects.BitmapText;
  zone: Phaser.GameObjects.Zone;
};

type ShopTabObjects = {
  mode: ShopMode;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
};

/** The host the open Mart belongs to, or null while no Mart is open. */
let panelHost: RoomHost | null = null;
/** The floating card the Mart draws on, or null while it is closed. */
let shopPanel: FloatingPanel | null = null;
let shopScene: Phaser.Scene | null = null;
let shopMode: ShopMode = 'buy';
/** The row under the pointer, painted as the hover highlight; `-1` for none. */
let shopIndex = 0;
let shopScroll = 0;
let shopStock: readonly ShopSlot[] = [];
/**
 * The `seed:map` the stock was rolled for. Keyed on both, so a floor re-rolled on
 * a later run takes its own shelves while a revisit keeps the ones it opened with.
 */
let shopStockKey = '';
let shopMessage = '';
let shopRows: ShopRowObjects[] = [];
let shopTabs: ShopTabObjects[] = [];
let shopMoneyText!: Phaser.GameObjects.BitmapText;
let shopMessageText!: Phaser.GameObjects.BitmapText;
let shopEmpty!: Phaser.GameObjects.BitmapText;

/** Paints a tab's own fill and 1px outline: the accent pair when it is active. */
function paintTab(bg: Phaser.GameObjects.Rectangle, active: boolean): void {
  const fill = active ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
  const stroke = active ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
  bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
}

/**
 * Opens the floating Mart for `host`, at the floor's band and stock
 * (`docs/maps-spec.md` §7, D33). The stock is rolled once per map on a dedicated
 * stream, so reopening the Mart shows the same shelves. The panel is floating
 * (`D45`): it never takes the keyboard and the walker keeps running behind it.
 */
export function openMart(host: RoomHost): void {
  if (host.panelOpen()) return;
  const key = `${host.run.seed}:${host.run.mapIndex}`;
  if (shopStockKey !== key) {
    const band = bandForMap(host.run.mapIndex);
    shopStock = buildShop(band.id, new Rng(hashSeed(`${host.run.seed}:shop:${host.run.mapIndex}`)));
    shopStockKey = key;
  }
  shopMode = 'buy';
  shopIndex = 0;
  shopScroll = 0;
  shopMessage = t('mart.greeting');
  panelHost = host;
  buildShopPanel(host);
  refreshShop();
  host.openPanel(PANEL);
}

/** Tears down the Mart panel (the scene calls it when the room changes). */
function closeShop(): void {
  if (!shopPanel) return;
  shopScene?.input.off('wheel', handleShopWheel);
  shopPanel.destroy();
  shopPanel = null;
  shopScene = null;
  shopRows = [];
  shopTabs = [];
  panelHost = null;
  shopIndex = 0;
  shopScroll = 0;
}

/** Builds the Mart's floating card and its row/tab objects once per open. */
function buildShopPanel(host: RoomHost): void {
  const scene = host.scene;
  shopScene = scene;
  const panel = addFloatingPanel(scene, {
    width: SHOP_W,
    height: SHOP_H,
    title: t('mart.title'),
    onClose: () => host.closePanel(),
  });
  shopPanel = panel;
  const content = panel.content;
  const left = content.x;
  const right = content.x + content.w;
  const children: Phaser.GameObjects.GameObject[] = [];

  shopMoneyText = addFrlgText(scene, right, content.y, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  children.push(shopMoneyText);

  // BUY / SELL tabs, FRLG style: the active one reads dark-on-light.
  shopTabs = [];
  SHOP_MODES.forEach((mode, i) => {
    const tabX = left + i * (SHOP_TAB_W + SHOP_TAB_GAP);
    const tabY = content.y + 26;
    const bg = scene.add
      .rectangle(tabX, tabY, SHOP_TAB_W, SHOP_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0);
    const label = addFrlgText(scene, tabX + SHOP_TAB_W / 2, tabY + 6, t(SHOP_MODE_LABELS[mode]), {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0],
    });
    const zone = scene.add
      .zone(tabX, tabY, SHOP_TAB_W, SHOP_TAB_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => switchShopMode(mode));
    shopTabs.push({ mode, bg, label });
    children.push(bg, label, zone);
  });

  // The list window: a fixed set of rows the pointer drives and the wheel scrolls.
  const listX = left;
  const listY = content.y + SHOP_LIST_TOP;
  const listW = content.w;
  const listH = SHOP_ROWS * SHOP_ROW_H + 12;
  children.push(addFrlgWindow(scene, listX, listY, listW, listH));

  shopRows = [];
  for (let i = 0; i < SHOP_ROWS; i++) {
    const rowY = listY + 6 + i * SHOP_ROW_H;
    const highlight = scene.add
      .rectangle(
        listX + 6,
        rowY,
        listW - 12,
        SHOP_ROW_H - 4,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const icon = scene.add
      .image(listX + 26, rowY + SHOP_ROW_H / 2 - 2, ITEM_ICON_TEXTURE_KEY, 0)
      .setScale(0.9)
      .setVisible(false);
    const name = addFrlgText(scene, listX + 52, rowY + 10, '', { size: 16, tint: FRLG_INK });
    const price = addFrlgText(scene, listX + listW - 92, rowY + 10, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    const count = addFrlgText(scene, listX + listW - 18, rowY + 10, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    });
    const zone = scene.add
      .zone(listX + 6, rowY, listW - 12, SHOP_ROW_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      const index = shopScroll + i;
      if (index === shopIndex || index >= shopTotal()) return;
      shopIndex = index;
      refreshShop();
    });
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const index = shopScroll + i;
      if (index >= shopTotal()) return;
      shopIndex = index;
      refreshShop();
      if (shopMode === 'sell') {
        activateShop();
        return;
      }
      const slot = shopStock[index];
      const row = buyRows(host.run, shopStock)[index];
      if (!slot || !row?.draggable) return;
      host.beginRowDrag?.({
        itemId: slot.itemId,
        label: row.name,
        pointer: { x: pointer.x, y: pointer.y },
        onDrop: (drop) => dropBuyRow(host, slot, drop),
      });
    });
    shopRows.push({ highlight, icon, name, price, count, zone });
    children.push(highlight, icon, name, price, count, zone);
  }

  const messageY = listY + listH + 12;
  shopEmpty = addFrlgText(scene, listX + listW / 2, listY + 20, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [0.5, 0],
  });
  shopMessageText = addFrlgText(scene, left, messageY, '', { size: 16, tint: FRLG_INK });
  children.push(
    shopEmpty,
    shopMessageText,
    addFrlgText(scene, right, messageY + 24, t('mart.controls'), {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    }),
  );

  panel.root.add(children);
  scene.input.on('wheel', handleShopWheel);
}

/** Repaints the Mart for the current tab, hover and the run's money and bag. */
function refreshShop(): void {
  const host = panelHost;
  if (!shopPanel || !host) return;
  const rows = shopMode === 'buy' ? buyRows(host.run, shopStock) : sellRows(host.run);
  const total = rows.length;
  shopIndex = total === 0 ? -1 : Math.min(shopIndex, total - 1);
  shopScroll = Math.max(0, Math.min(shopScroll, Math.max(0, total - SHOP_ROWS)));

  shopMoneyText.setText(t('mart.money', { amount: host.run.money }));
  shopMessageText.setText(shopMessage);
  shopTabs.forEach((tab) => {
    const active = tab.mode === shopMode;
    paintTab(tab.bg, active);
    tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
  });
  shopEmpty.setText(
    total === 0 ? (shopMode === 'buy' ? t('mart.emptyStock') : t('mart.emptySell')) : '',
  );

  shopRows.forEach((rowObject, i) => {
    const index = shopScroll + i;
    const row = rows[index];
    const visible = row !== undefined;
    const draggable = row?.draggable === true;
    rowObject.highlight.setVisible(visible && index === shopIndex && (shopMode === 'sell' || draggable));
    rowObject.icon.setVisible(visible);
    rowObject.name.setVisible(visible);
    rowObject.price.setVisible(visible);
    rowObject.count.setVisible(visible);
    if (!row) {
      rowObject.name.setText('');
      rowObject.price.setText('');
      rowObject.count.setText('');
      rowObject.zone.disableInteractive();
      return;
    }
    rowObject.icon.setFrame(itemIconFrame(row.itemId) ?? 0);
    rowObject.name.setText(row.name);
    rowObject.price.setText(`¥${row.price}`);
    rowObject.price.setTint(shopMode === 'buy' && !row.affordable ? 0xb0304a : FRLG_MUTED);
    rowObject.count.setText(row.owned > 0 ? `x${row.owned}` : '');
    // An unaffordable BUY row is not a drag source, so it takes no hand cursor.
    if (shopMode === 'buy' && !draggable) rowObject.zone.disableInteractive();
    else rowObject.zone.setInteractive({ useHandCursor: true });
  });
}

/** The wheel scrolls the row list, one row at a time, clamped to the rows. */
function handleShopWheel(
  pointer: Phaser.Input.Pointer,
  _objects: unknown,
  _dx: number,
  dy: number,
): void {
  const panel = shopPanel;
  const host = panelHost;
  if (!panel || !host) return;
  const rect = panel.rect();
  const pointX = pointer.x - rect.x;
  const pointY = pointer.y - rect.y;
  const listX = panel.content.x;
  const listY = panel.content.y + SHOP_LIST_TOP;
  const listW = panel.content.w;
  const listH = SHOP_ROWS * SHOP_ROW_H + 12;
  if (pointX < listX || pointX > listX + listW || pointY < listY || pointY > listY + listH) {
    return;
  }
  const total = shopMode === 'buy' ? shopStock.length : sellableStacks(host.run).length;
  if (total <= SHOP_ROWS) return;
  const next = Math.max(0, Math.min(total - SHOP_ROWS, shopScroll + (dy > 0 ? 1 : -1)));
  if (next === shopScroll) return;
  shopScroll = next;
  shopIndex = -1;
  refreshShop();
}

function switchShopMode(mode: ShopMode): void {
  if (shopMode === mode) return;
  shopMode = mode;
  shopIndex = 0;
  shopScroll = 0;
  shopMessage = mode === 'buy' ? t('mart.greeting') : t('mart.greetingSell');
  refreshShop();
}

/** How many rows the current tab holds: the stock, or the sellable stacks. */
function shopTotal(): number {
  const host = panelHost;
  if (!host) return 0;
  return shopMode === 'buy' ? shopStock.length : sellableStacks(host.run).length;
}

/** Sells the hovered row (the SELL tab's shipped click), then repaints the Mart. */
function activateShop(): void {
  const host = panelHost;
  if (!host || shopMode !== 'sell') return;
  const row = sellRows(host.run)[shopIndex];
  if (!row) return;
  const trade = sellItem(host.run, row.itemId);
  if (!trade.ok) return;
  host.commitRun(trade.run);
  shopMessage = t('mart.sold', { name: row.name, amount: trade.amount });
  refreshShop();
}

/**
 * The BUY row's drop (`D45`): the units are bought once and the bag owns them. A
 * drop on a member then spends or equips one as the HUD would; an item that does
 * not apply stays in the bag, never lost and never re-charged.
 */
function dropBuyRow(host: RoomHost, slot: ShopSlot, drop: RoomDrop): void {
  if (drop.onto !== 'bag' && drop.onto !== 'member') return;
  const trade = buyItem(host.run, slot);
  if (!trade.ok) {
    shopMessage = t('mart.noMoney');
    refreshShop();
    return;
  }
  let run = trade.run;
  if (drop.onto === 'member') {
    const kind = getItem(slot.itemId)?.kind;
    if (kind === 'heal' || kind === 'status') run = useItemOn(run, drop.memberId, slot.itemId);
    else if (kind === 'held') run = equipHeldItem(run, drop.memberId, slot.itemId);
  }
  host.commitRun(run);
  const name = getItem(slot.itemId)?.name ?? slot.itemId;
  shopMessage = t('mart.bought', { name, amount: trade.amount });
  refreshShop();
}

/** The Mart as the scene holds it: one floating panel, keyed by its own ✕. */
const PANEL: RoomPanel = {
  modal: false,
  close() {
    closeShop();
  },
};

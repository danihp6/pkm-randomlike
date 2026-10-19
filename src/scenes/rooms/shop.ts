import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { keyLabel, type KeybindAction } from '../../data/keybinds';
import { bandForMap } from '../../engine/run';
import { hashSeed, Rng } from '../../engine/rng';
import { TILE_SIZE } from '../../engine/tileset';
import { t, type TranslationKey } from '../../i18n';
import { loadSettings } from '../../settings';
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
import { SHOP_COUNTER_TEXTURE_KEY } from '../BootScene';
import type { RoomDescriptor, RoomHost, RoomPanel } from './types';

/**
 * The **shop** room (`docs/maps-spec.md` §7, D33, D47): its counter fixture and the
 * whole Mart window. The panel's shapes, prices and keys are exactly the ones the
 * scene drew before it became a descriptor module; only the objects' owner changed.
 * The scene keeps the keyboard slot it hands over through `RoomHost.openPanel` and
 * the counter tile it blocks movement on.
 */

/** The Mart window: BUY / SELL tabs over the floor's own stock. */
const SHOP_W = 640;
const SHOP_H = 540;
const SHOP_PAD = 24;
const SHOP_ROW_H = 44;
const SHOP_ROWS = 7;
const SHOP_TAB_W = 108;
const SHOP_TAB_H = 30;
const SHOP_TAB_GAP = 6;
const SHOP_MODES = ['buy', 'sell'] as const;

type ShopMode = (typeof SHOP_MODES)[number];

/** The shop's two pockets; the key of the label printed on each tab. */
const SHOP_MODE_LABELS: Readonly<Record<ShopMode, TranslationKey>> = {
  buy: 'mart.buy',
  sell: 'mart.sell',
};

/** The counter sprite's texture pixel size and the depth the ground items use. */
const SHOP_COUNTER_TEXTURE_SIZE = 22;
const SHOP_COUNTER_DEPTH = 5;

type ShopRowObjects = {
  highlight: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  price: Phaser.GameObjects.BitmapText;
  count: Phaser.GameObjects.BitmapText;
};

type ShopTabObjects = {
  mode: ShopMode;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
};

/** The host the open Mart belongs to, or null while no Mart is open. */
let panelHost: RoomHost | null = null;
/** The Mart panel: its root, stock, tab and the row objects it repaints. */
let shopRoot: Phaser.GameObjects.Container | null = null;
let shopMode: ShopMode = 'buy';
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

/** A route tile's centre in world pixels, the placement the scene draws entities at. */
const centerX = (tileX: number): number => tileX * TILE_SIZE + TILE_SIZE / 2;
const centerY = (tileY: number): number => tileY * TILE_SIZE + TILE_SIZE / 2;

/** Paints a tab's own fill and 1px outline: the accent pair when it is active. */
function paintTab(bg: Phaser.GameObjects.Rectangle, active: boolean): void {
  const fill = active ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
  const stroke = active ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
  bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
}

/**
 * Opens the Mart (`docs/maps-spec.md` §7, D33): only in a shop room, at the counter.
 * The stock is rolled once per map on a dedicated stream, so reopening the Mart
 * shows the same shelves. The panel owns the input until `Q`. The caller has
 * already refused the interact while a battle, a beat, the pause menu or the run
 * over owns the screen.
 */
function openShop(host: RoomHost): void {
  if (host.panelOpen()) return;
  // The Mart is modal: it takes the keyboard off whatever HUD pane held it.
  host.releaseHudKeyboard();
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
  if (!shopRoot) return;
  shopRoot.destroy(true);
  shopRoot = null;
  shopRows = [];
  shopTabs = [];
  panelHost = null;
}

/** Builds the Mart's static frame and its row/tab objects once per open. */
function buildShopPanel(host: RoomHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const x = (width - SHOP_W) / 2;
  const y = (height - SHOP_H) / 2;
  const left = x + SHOP_PAD;
  const right = x + SHOP_W - SHOP_PAD;
  const children: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, width, height, 0x05070c, 0.72).setOrigin(0, 0),
    addFrlgWindow(scene, x, y, SHOP_W, SHOP_H),
    addFrlgText(scene, left, y + 20, t('mart.title'), { size: 24, tint: FRLG_INK }),
  ];
  shopMoneyText = addFrlgText(scene, right, y + 24, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  children.push(shopMoneyText);

  // BUY / SELL tabs, FRLG style: the active one reads dark-on-light.
  shopTabs = [];
  SHOP_MODES.forEach((mode, i) => {
    const tabX = left + i * (SHOP_TAB_W + SHOP_TAB_GAP);
    const tabY = y + 58;
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

  // The list window: a fixed set of rows the pointer and the cursor drive.
  const listX = left;
  const listY = y + 100;
  const listW = SHOP_W - SHOP_PAD * 2;
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
    zone.on('pointerdown', () => {
      shopIndex = shopScroll + i;
      refreshShop();
      activateShop();
    });
    shopRows.push({ highlight, icon, name, price, count });
    children.push(highlight, icon, name, price, count, zone);
  }
  shopEmpty = addFrlgText(scene, listX + listW / 2, listY + 20, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [0.5, 0],
  });
  children.push(shopEmpty);

  shopMessageText = addFrlgText(scene, left, y + SHOP_H - 74, '', { size: 16, tint: FRLG_INK });
  children.push(
    shopMessageText,
    addFrlgText(
      scene,
      right,
      y + SHOP_H - 42,
      t('mart.controls', {
        confirm: keyLabel(loadSettings().keybinds.confirm),
        cancel: keyLabel(loadSettings().keybinds.cancel),
      }),
      { size: 16, tint: FRLG_MUTED, origin: [1, 0] },
    ),
  );

  shopRoot = scene.add.container(0, 0, children).setDepth(500);
  scene.cameras.main.ignore(shopRoot);
}

/** Repaints the Mart for the current tab, cursor and the run's money and bag. */
function refreshShop(): void {
  const host = panelHost;
  if (!shopRoot || !host) return;
  const rows = shopMode === 'buy' ? buyRows(host.run, shopStock) : sellRows(host.run);
  const total = rows.length;
  shopIndex = total === 0 ? 0 : Math.max(0, Math.min(shopIndex, total - 1));
  shopScroll = Math.max(0, Math.min(shopScroll, Math.max(0, total - SHOP_ROWS)));
  if (shopIndex < shopScroll) shopScroll = shopIndex;
  else if (shopIndex >= shopScroll + SHOP_ROWS) shopScroll = shopIndex - SHOP_ROWS + 1;

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
    rowObject.highlight.setVisible(visible && index === shopIndex);
    rowObject.icon.setVisible(visible);
    rowObject.name.setVisible(visible);
    rowObject.price.setVisible(visible);
    rowObject.count.setVisible(visible);
    if (!row) {
      rowObject.name.setText('');
      rowObject.price.setText('');
      rowObject.count.setText('');
      return;
    }
    rowObject.icon.setFrame(itemIconFrame(row.itemId) ?? 0);
    rowObject.name.setText(row.name);
    rowObject.price.setText(`¥${row.price}`);
    rowObject.price.setTint(shopMode === 'buy' && !row.affordable ? 0xb0304a : FRLG_MUTED);
    rowObject.count.setText(row.owned > 0 ? `x${row.owned}` : '');
  });
}

/** The Mart's keys: move, switch tab, trade on `E`, leave on `Q`. */
function handleShopAction(host: RoomHost, action: KeybindAction): void {
  switch (action) {
    case 'up':
      moveShop(-1);
      return;
    case 'down':
      moveShop(1);
      return;
    case 'left':
      cycleShopMode(-1);
      return;
    case 'right':
      cycleShopMode(1);
      return;
    case 'confirm':
    case 'interact':
      activateShop();
      return;
    case 'cancel':
      host.closePanel();
      return;
    default:
      return;
  }
}

function switchShopMode(mode: ShopMode): void {
  if (shopMode === mode) return;
  shopMode = mode;
  shopIndex = 0;
  shopScroll = 0;
  shopMessage = mode === 'buy' ? t('mart.greeting') : t('mart.greetingSell');
  refreshShop();
}

function cycleShopMode(delta: number): void {
  const index = SHOP_MODES.indexOf(shopMode);
  switchShopMode(SHOP_MODES[(index + delta + SHOP_MODES.length) % SHOP_MODES.length]);
}

function moveShop(delta: number): void {
  const total = shopTotal();
  if (total === 0) return;
  shopIndex = (shopIndex + delta + total) % total;
  refreshShop();
}

/** How many rows the current tab holds: the stock, or the sellable stacks. */
function shopTotal(): number {
  const host = panelHost;
  if (!host) return 0;
  return shopMode === 'buy' ? shopStock.length : sellableStacks(host.run).length;
}

/** Buys or sells the highlighted row, then repaints the Mart and the bag HUD. */
function activateShop(): void {
  const host = panelHost;
  if (!host) return;
  if (shopMode === 'buy') {
    const slot = shopStock[shopIndex];
    if (!slot) return;
    const trade = buyItem(host.run, slot);
    if (!trade.ok) {
      shopMessage = t('mart.noMoney');
      refreshShop();
      return;
    }
    host.commitRun(trade.run);
    const name = getItem(slot.itemId)?.name ?? slot.itemId;
    shopMessage = t('mart.bought', { name, amount: trade.amount });
  } else {
    const row = sellRows(host.run)[shopIndex];
    if (!row) return;
    const trade = sellItem(host.run, row.itemId);
    if (!trade.ok) return;
    host.commitRun(trade.run);
    shopMessage = t('mart.sold', { name: row.name, amount: trade.amount });
  }
  refreshShop();
}

/** The Mart as the scene holds it: one panel, keyed while it owns the keyboard. */
const PANEL: RoomPanel = {
  handle(action) {
    const host = panelHost;
    if (!host) return;
    handleShopAction(host, action);
  },
  close() {
    closeShop();
  },
};

export const descriptor: RoomDescriptor = {
  kind: 'shop',
  marker: 'shop',
  // A shop room's counter: the interact key opens the Mart when the player faces
  // it. It is a fixture, so it sits at the room's farthest walkable tile.
  fixture: (host) => ({ counter: host.farthestRoomTile() }),
  interact: (host, tile) => {
    const counter = host.counterTile();
    if (!counter || tile.x !== counter.x || tile.y !== counter.y) return false;
    openShop(host);
    return true;
  },
  drawFixture: (host) => {
    if (host.generatorStepActive()) return;
    const counter = host.counterTile();
    if (!counter) return;
    host.scene.add
      .image(centerX(counter.x), centerY(counter.y), SHOP_COUNTER_TEXTURE_KEY)
      .setScale(TILE_SIZE / SHOP_COUNTER_TEXTURE_SIZE)
      .setDepth(SHOP_COUNTER_DEPTH);
  },
  drawMarker: (graphics, cx, cy, radius) => {
    graphics.fillStyle(0xf2c14e, 1);
    graphics.fillCircle(cx, cy, radius);
    graphics.lineStyle(2, 0x8a6d1f, 1);
    graphics.strokeCircle(cx, cy, radius);
  },
};

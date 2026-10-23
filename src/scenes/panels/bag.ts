import type Phaser from 'phaser';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import type { BagCounts } from '../../engine/run';
import { candyTreat } from '../../engine/run/items';
import { t } from '../../i18n';
import {
  BAG_CATEGORIES,
  BAG_GRID_COLS,
  BAG_GRID_GAP,
  bagCategoryLabel,
  bagDiscoveredCandy,
  bagForCategory,
  bagGridIndexAt,
  bagGridLayout,
  filterBagStacks,
  stepBagCursor,
  type BagCategory,
  type BagGridDebugState,
  type BagGridMetrics,
  type BagGridRect,
} from '../../ui/bag';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { InfoPopup } from '../../ui/infoPopup';
import { statLabel } from '../../ui/partyDetail';
import { PANEL_ICON_KEYS } from '../BootScene';
import {
  HUD_CONTENT_LEFT,
  HUD_GAP,
  HUD_PAD_BOTTOM,
  HUD_PAD_TOP,
  HUD_PAD_X,
  HUD_PANEL_MARGIN,
  HUD_SEARCH_H,
  HUD_TAB_GAP,
  HUD_TAB_H,
  HUD_TAB_W,
  PANEL_KEY_ACTIONS,
  draggedItemFrom,
  draggedItemId,
  hudColumnLeft,
  makeHudPanel,
  panelById,
  panelExpanded,
  panelPoint,
  pointerPhase,
  registerHudOverlay,
} from './hud';
import { partyBottom } from './party';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The bag window: the pocket tabs over the filter field, the five-column grid of
 * item stacks and the footer that holds the run's Poké Dollars, plus the floating
 * card that describes the selected stack. A press only selects; the drag itself
 * belongs to the scene's drag path.
 */

const HUD_BAG_HEADER = HUD_PAD_TOP + HUD_TAB_H + 8;
/** The bag grid: three rows of the fixed five columns, square cells. */
const HUD_BAG_GRID_ROWS = 3;
const HUD_BAG_GRID_CELL = 56;
/** Filter field to grid, and grid to the footer rule. */
const HUD_BAG_SEARCH_GAP = 8;
const HUD_BAG_GRID_GAP = 8;
const HUD_BAG_INFO_W = 280;
const HUD_BAG_INFO_GAP = 8;
const HUD_BAG_GRID_H = HUD_BAG_GRID_ROWS * HUD_BAG_GRID_CELL + (HUD_BAG_GRID_ROWS - 1) * BAG_GRID_GAP;
const HUD_BAG_CAP = HUD_BAG_GRID_ROWS * BAG_GRID_COLS;
/** The bag panel's footer band: the Poké Dollar readout under the item grid. */
const HUD_BAG_FOOTER = 26;

/** The bag grid's cells, its filter field and the selection they paint. */
let hudBagCells: {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  badgeBg: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.BitmapText;
}[] = [];
/** The bag grid's geometry, laid out once in the build. */
let bagGrid!: BagGridMetrics;
/** The grid band itself, in the bag panel's own coordinates. */
let hudBagGridRect = { x: 0, y: 0, w: 0, h: 0 };
let hudBagCursor = 0;
let hudBagQuery = '';
let hudBagSearchFocus = false;
let hudBagSearchRect = { x: 0, y: 0, w: 0, h: 0 };
let hudBagSearchBg!: Phaser.GameObjects.Rectangle;
let hudBagSearchText!: Phaser.GameObjects.BitmapText;
/** The floating description card the selected cell shows, and its last text. */
let bagInfoPopup!: InfoPopup;
let bagInfoLayer!: Phaser.GameObjects.Container;
let bagInfoText = '';
/** The bag pocket tabs (FRLG strip) and which pocket is showing. */
let hudBagTabs: {
  category: BagCategory;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let hudBagCategory: BagCategory = 'equipment';
let hudBagEmpty!: Phaser.GameObjects.BitmapText;
/** The bag window's Poké Dollar readout, right-aligned in its footer band. */
let hudMoneyText!: Phaser.GameObjects.BitmapText;
/** The bag window's own top and height, kept for its hit test. */
let hudBagY = 0;
let hudBagH = 0;

/** The stacks the bag window draws, in draw order. */
export function hudBagStacks(host: RoutePanelHost): readonly BagCounts[] {
  const inHand = draggedItemFrom() === null ? draggedItemId() : null;
  const pocket = bagForCategory(host.run().bag, hudBagCategory).filter(
    (stack) => stack.itemId !== inHand,
  );
  return filterBagStacks(pocket, hudBagQuery).slice(0, HUD_BAG_CAP);
}

/** Paints a tab's own fill and 1px outline: the accent pair when it is active. */
export function paintTab(bg: Phaser.GameObjects.Rectangle, active: boolean): void {
  const fill = active ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
  const stroke = active ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
  bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
}

/** True when the pointer is on the bag window's frame. */
export function pointerInBagPanel(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'bag')) return false;
  const point = panelPoint(host, pointer, 'bag');
  const x = hudColumnLeft(host);
  return (
    point.x >= x &&
    point.x <= x + host.hud().panelW &&
    point.y >= hudBagY &&
    point.y <= hudBagY + hudBagH
  );
}

/** The bag cell under the pointer, as an index into the drawn stacks, or null. */
export function hudBagCellAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): number | null {
  if (!pointerInBagPanel(host, pointer)) return null;
  const point = panelPoint(host, pointer, 'bag');
  return bagGridIndexAt(bagGrid, point.x, point.y, hudBagStacks(host).length);
}

/** The bag stack under the pointer that can be dragged: a held item or a consumable. */
export function hudDraggableStackAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): string | null {
  const index = hudBagCellAt(host, pointer);
  if (index === null) return null;
  const itemId = hudBagStacks(host)[index]?.itemId ?? null;
  const kind = itemId === null ? null : (getItem(itemId)?.kind ?? null);
  return kind === 'held' || kind === 'heal' || kind === 'status' ? itemId : null;
}

/** A press on the bag's filter field: focus it and consume the press. */
function focusBagSearch(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!pointerInBagPanel(host, pointer)) return false;
  const point = panelPoint(host, pointer, 'bag');
  if (!pointInRect(point, hudBagSearchRect)) return false;
  hudBagSearchFocus = true;
  host.refreshHud();
  return true;
}

/** A press on a bag pocket tab selects it; true when it handled the press. */
function selectBagTab(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'bag')) return false;
  const point = panelPoint(host, pointer, 'bag');
  const tab = hudBagTabs.find(
    (entry) =>
      point.x >= entry.bg.x &&
      point.x <= entry.bg.x + entry.bg.width &&
      point.y >= entry.bg.y &&
      point.y <= entry.bg.y + entry.bg.height,
  );
  if (!tab) return false;
  hudBagCategory = tab.category;
  hudBagCursor = 0;
  hudBagQuery = '';
  hudBagSearchFocus = false;
  host.refreshHud();
  return true;
}

/** True while the bag's filter field owns the keyboard. */
export function bagTextFieldFocused(): boolean {
  return hudBagSearchFocus;
}

/**
 * Routes a key into the bag's filter field while it holds focus: letters,
 * digits and spaces narrow the grid, Backspace and Escape/Enter edit or leave
 * it. Every key is consumed, so nothing typed reaches the game underneath.
 */
export function typeInBagSearch(host: RoutePanelHost, event: KeyboardEvent): boolean {
  if (!hudBagSearchFocus) return false;
  if (event.key === 'Escape' || event.key === 'Enter') {
    hudBagSearchFocus = false;
  } else if (event.key === 'Backspace') {
    if (hudBagQuery.length === 0) return true;
    hudBagQuery = hudBagQuery.slice(0, -1);
  } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
    hudBagQuery += event.key;
  } else {
    return true;
  }
  event.preventDefault();
  host.refreshHud();
  return true;
}

/** The card's line for a bag item: the catalogue's, or the run's own candy treat. */
function bagInfoFor(host: RoutePanelHost, itemId: string): string {
  const run = host.run();
  const item = getItem(itemId);
  const name = item?.name ?? itemId;
  const colour = bagDiscoveredCandy(itemId, run.discoveredCandy);
  if (colour === null) return `${name}\n${item?.shortDesc ?? ''}`;
  const treat = candyTreat(run.seed, colour);
  const delta = treat.delta > 0 ? '+1' : '-1';
  return `${name}\n${t('hud.candyKnown', { stat: statLabel(treat.stat), delta })}`;
}

/**
 * Paints the bag grid's cells from the drawn stacks: the shipped row accent on
 * the cursor's cell, a dim outline on an empty slot, the count badge over every
 * occupied icon, and the floating card that describes the selection.
 */
function refreshBagGrid(host: RoutePanelHost, bag: readonly BagCounts[]): void {
  // A stack taken in hand leaves the drawn list until it is dropped, so the
  // cursor is only clamped when the list is whole: clamping against the held
  // list would slide the selection off the cell the press picked.
  const inHand = draggedItemFrom() === null && draggedItemId() !== null;
  if (!inHand) hudBagCursor = stepBagCursor(hudBagCursor, 0, bag.length);
  const placeholder = hudBagSearchFocus || hudBagQuery.length > 0 ? hudBagQuery : t('hud.searchItems');
  hudBagSearchText
    .setText(`${hudBagSearchFocus ? '>' : ' '} ${placeholder}`)
    .setTint(hudBagQuery.length === 0 && !hudBagSearchFocus ? FRLG_MUTED : FRLG_INK);
  hudBagEmpty.setVisible(bag.length === 0);

  hudBagCells.forEach((cell, i) => {
    const rect = bagGrid.cells[i];
    if (rect === undefined) return;
    const stack = bag[i];
    cell.bg.setPosition(rect.x, rect.y).setSize(rect.w, rect.h);
    if (stack === undefined) {
      cell.bg
        .setFillStyle(FRLG_ROW_FILL.colour, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha * 0.4);
      cell.icon.setVisible(false);
      cell.badgeBg.setVisible(false);
      cell.badge.setText('').setVisible(false);
      return;
    }
    const selected = i === hudBagCursor;
    const fill = selected ? FRLG_SELECTED_FILL : FRLG_ROW_FILL;
    const stroke = selected ? FRLG_SELECTED_STROKE : FRLG_ROW_STROKE;
    cell.bg.setFillStyle(fill.colour, fill.alpha).setStrokeStyle(1, stroke.colour, stroke.alpha);
    const frame = itemIconFrame(stack.itemId);
    cell.icon.setVisible(frame !== null).setPosition(rect.x + rect.w / 2, rect.y + rect.h / 2);
    if (frame !== null) cell.icon.setFrame(frame);
    const badgeW = cell.badge
      .setText(`x${stack.count}`)
      .setPosition(rect.x + rect.w - 4, rect.y + rect.h - 18)
      .setVisible(true)
      .getTextBounds().global.width;
    cell.badgeBg
      .setSize(badgeW + 6, 16)
      .setPosition(rect.x + rect.w - 4 - badgeW - 3, rect.y + rect.h - 18)
      .setFillStyle(FRLG_SURFACE, 0.85)
      .setVisible(true);
  });

  const stack = bag[hudBagCursor];
  const card = bagGrid.cells[hudBagCursor];
  if (stack === undefined || card === undefined || !panelExpanded(host, 'bag')) {
    bagInfoText = '';
    bagInfoPopup.hide();
    return;
  }
  // The card lives on the HUD root, so the bag panel's own drag offset is added
  // by hand to keep it beside the panel it describes.
  const panel = panelById(host, 'bag');
  const dx = panel?.dx ?? 0;
  const dy = panel?.dy ?? 0;
  bagInfoText = bagInfoFor(host, stack.itemId);
  bagInfoPopup.show(
    {
      x: Math.max(HUD_PANEL_MARGIN, hudColumnLeft(host) - HUD_BAG_INFO_W - HUD_BAG_INFO_GAP) + dx,
      width: HUD_BAG_INFO_W,
      above: card.y + card.h + dy,
      below: card.y + dy,
    },
    { text: bagInfoText },
  );
}

/**
 * Dev only: the bag grid as drawn, in canvas (pointer) coordinates. Null when
 * there is no live run.
 */
export function bagDebugState(host: RoutePanelHost): BagGridDebugState | null {
  if (!host.run() || !host.hudRoot()) return null;
  const bag = hudBagStacks(host);
  const panel = panelById(host, 'bag');
  const dx = panel?.dx ?? 0;
  const dy = panel?.dy ?? 0;
  const rectOf = (rect: Phaser.Geom.Rectangle): BagGridRect => ({
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
  });
  const cells = hudBagCells.map((cell, index) => {
    const stack = bag[index];
    const selected =
      stack !== undefined &&
      cell.bg.fillColor === FRLG_SELECTED_FILL.colour &&
      cell.bg.fillAlpha === FRLG_SELECTED_FILL.alpha;
    return {
      index,
      itemId: stack?.itemId ?? null,
      count: stack?.count ?? 0,
      badge: cell.badge.text,
      iconFrame: cell.icon.visible ? Number(cell.icon.frame.name) : null,
      selected,
      fill: cell.bg.fillColor,
      fillAlpha: cell.bg.fillAlpha,
      stroke: cell.bg.strokeColor,
      strokeAlpha: cell.bg.strokeAlpha,
      rect: rectOf(cell.bg.getBounds()),
    };
  });
  // `InfoPopup` builds its window first, so the layer's first child is the card
  // the panel handed `show`; reading its bounds measures what is on screen.
  const card = bagInfoLayer.list[0] as Phaser.GameObjects.NineSlice;
  const cardBounds = card.getBounds();
  return {
    category: hudBagCategory,
    query: hudBagQuery,
    focused: hudBagSearchFocus,
    columns: bagGrid.columns,
    rows: bagGrid.rows,
    cellW: bagGrid.cellW,
    cellH: bagGrid.cellH,
    gap: bagGrid.gap,
    search: rectOf(hudBagSearchBg.getBounds()),
    grid: {
      x: hudBagGridRect.x + dx,
      y: hudBagGridRect.y + dy,
      w: hudBagGridRect.w,
      h: hudBagGridRect.h,
    },
    tabs: hudBagTabs.map((tab) => ({ category: tab.category, rect: rectOf(tab.bg.getBounds()) })),
    cells,
    info: {
      visible: bagInfoPopup.visible,
      text: bagInfoText,
      x: cardBounds.x,
      width: cardBounds.width,
    },
    footer: hudMoneyText.text,
  };
}

/** True when a point falls inside a rect, for the bag's own hit tests. */
function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
  );
}

function refreshBag(host: RoutePanelHost): void {
  if (hudBagCells.length === 0) return;
  const run = host.run();
  // A collapsed window never holds the keyboard: the collapse repaint lands here.
  if (!panelExpanded(host, 'bag')) hudBagSearchFocus = false;
  // An item taken from the bag is not in the bag while it is being dragged.
  const bag = hudBagStacks(host);
  hudBagTabs.forEach((tab) => {
    const active = tab.category === hudBagCategory;
    paintTab(tab.bg, active);
    tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
  });
  hudMoneyText.setText(String(run.money));
  refreshBagGrid(host, bag);
}

function pointerDown(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (selectBagTab(host, pointer)) return true;
  // A press on the bag's filter field focuses it and is consumed; a press on a
  // cell selects it and still falls through to the item drag; any other press
  // leaves the field, as the detail panel's own rule does.
  if (focusBagSearch(host, pointer)) return true;
  const cell = hudBagCellAt(host, pointer);
  if (cell !== null) {
    hudBagCursor = cell;
    host.refreshHud();
  } else if (hudBagSearchFocus) {
    hudBagSearchFocus = false;
    host.refreshHud();
  }
  return false;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'bag',
  order: 40,
  hudPanel: 'bag',
  build(host: RoutePanelHost): void {
    const scene = host.scene;
    const x = hudColumnLeft(host);
    const { panelW } = host.hud();
    const left = x + HUD_PAD_X;
    hudBagCursor = 0;
    hudBagQuery = '';
    hudBagSearchFocus = false;
    bagInfoText = '';
    const bagY = partyBottom() + HUD_GAP;
    const bagH =
      HUD_BAG_HEADER +
      HUD_SEARCH_H +
      HUD_BAG_SEARCH_GAP +
      HUD_BAG_GRID_H +
      HUD_BAG_GRID_GAP +
      HUD_BAG_FOOTER +
      HUD_PAD_BOTTOM;
    hudBagY = bagY;
    hudBagH = bagH;
    const bagChildren: Phaser.GameObjects.GameObject[] = [];
    const bagWindow = addFrlgWindow(scene, x, bagY, panelW, bagH);
    bagChildren.push(bagWindow);

    // Pocket tabs across the window's head, FRLG style: the active one reads
    // dark-on-light, the rest stay a pale folder. Click to switch.
    hudBagTabs = [];
    BAG_CATEGORIES.forEach((category, i) => {
      const tabX = x + HUD_CONTENT_LEFT + i * (HUD_TAB_W + HUD_TAB_GAP);
      const tabY = bagY + HUD_PAD_TOP;
      const bg = scene.add
        .rectangle(tabX, tabY, HUD_TAB_W, HUD_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0);
      const label = addFrlgText(scene, tabX + HUD_TAB_W / 2, tabY + 5, bagCategoryLabel(category), {
        size: 16,
        tint: FRLG_INK,
        origin: [0.5, 0],
      });
      hudBagTabs.push({ category, bg, label });
      bagChildren.push(bg, label);
    });

    // The filter field between the tabs and the grid: the MOVES tab's own box and
    // height, so the two search fields read as one control.
    const searchX = left;
    const searchY = bagY + HUD_BAG_HEADER;
    const searchW = panelW - HUD_PAD_X * 2;
    hudBagSearchRect = { x: searchX, y: searchY, w: searchW, h: HUD_SEARCH_H };
    hudBagSearchBg = scene.add
      .rectangle(searchX, searchY, searchW, HUD_SEARCH_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
    hudBagSearchText = addFrlgText(scene, searchX + 6, searchY + 4, '', {
      size: 16,
      tint: FRLG_INK,
    }).setMaxWidth(searchW - 78);
    bagChildren.push(hudBagSearchBg, hudBagSearchText);

    // The grid: five fixed columns of square icon cells, laid out once here and
    // only repainted afterwards, so a pocket or filter change allocates nothing.
    const gridX = left;
    const gridY = searchY + HUD_SEARCH_H + HUD_BAG_SEARCH_GAP;
    const bagGridW = panelW - HUD_PAD_X * 2;
    hudBagGridRect = { x: gridX, y: gridY, w: bagGridW, h: HUD_BAG_GRID_H };
    bagGrid = bagGridLayout(hudBagGridRect, HUD_BAG_CAP);
    hudBagCells = [];
    for (const cell of bagGrid.cells) {
      const bg = scene.add.rectangle(cell.x, cell.y, cell.w, cell.h).setOrigin(0, 0);
      const icon = scene.add
        .image(cell.x + cell.w / 2, cell.y + cell.h / 2, ITEM_ICON_TEXTURE_KEY, 0)
        .setScale(1)
        .setOrigin(0.5)
        .setVisible(false);
      const badgeBg = scene.add
        .rectangle(cell.x, cell.y, 10, 16, FRLG_SURFACE, 0.85)
        .setOrigin(0, 0)
        .setVisible(false);
      const badge = addFrlgText(scene, cell.x, cell.y, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      }).setVisible(false);
      hudBagCells.push({ bg, icon, badgeBg, badge });
      bagChildren.push(bg, icon, badgeBg, badge);
    }

    hudBagEmpty = addFrlgText(
      scene,
      gridX + bagGridW / 2,
      gridY + HUD_BAG_GRID_H / 2 - 8,
      t('hud.noItems'),
      { size: 16, tint: FRLG_MUTED, origin: [0.5, 0] },
    );
    bagChildren.push(hudBagEmpty);

    // The footer holds the run's Poké Dollars: a hairline rule then the readout,
    // so the money sits with the bag it is spent from (`docs/maps-spec.md` §7).
    const footerY =
      bagY + HUD_BAG_HEADER + HUD_SEARCH_H + HUD_BAG_SEARCH_GAP + HUD_BAG_GRID_H + HUD_BAG_GRID_GAP;
    const footerRule = scene.add
      .rectangle(
        x + HUD_PAD_X,
        footerY + 4,
        panelW - HUD_PAD_X * 2,
        1,
        FRLG_ROW_STROKE.colour,
        FRLG_ROW_STROKE.alpha,
      )
      .setOrigin(0, 0);
    const moneyLabel = addFrlgText(scene, x + HUD_PAD_X, footerY + 12, t('hud.money'), {
      size: 16,
      tint: FRLG_MUTED,
    });
    hudMoneyText = addFrlgText(scene, x + panelW - HUD_PAD_X, footerY + 12, '', {
      size: 16,
      tint: FRLG_INK,
      origin: [1, 0],
    });
    bagChildren.push(footerRule, moneyLabel, hudMoneyText);

    makeHudPanel(
      host,
      'bag',
      x,
      bagY,
      panelW,
      bagH,
      scene.add.container(0, 0, bagChildren),
      bagWindow,
      PANEL_ICON_KEYS.bag,
      PANEL_KEY_ACTIONS.bag ?? null,
    );

    // The bag's description card rides on the root, not in the bag panel's body,
    // so `raisePanel` can keep it above every window it floats over.
    bagInfoLayer = scene.add.container(0, 0);
    registerHudOverlay(bagInfoLayer, 2);
    bagInfoPopup = new InfoPopup(scene, bagInfoLayer);
  },
  refresh: refreshBag,
  pointer(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
    return pointerPhase() === 'down' ? pointerDown(host, pointer) : false;
  },
};

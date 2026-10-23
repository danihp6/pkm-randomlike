import { t, type TranslationKey } from '../../../../i18n';
import type { HudState } from '../../state';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type BagPocket = 'equipment' | 'consumable' | 'machine' | 'ball' | 'valuable';

/** The panel's own cursor state; the scene module owns it, the panel paints it. */
export type BagPanelUi = Readonly<{ pocket: BagPocket; cursor: number; query: string }>;

/** A CSS-ready sprite cell: `background-position: -x px -y px`, `background-size: auto`. */
export type SpriteCell = Readonly<{ url: string; size: number; x: number; y: number }>;

/** Where a tile's icon comes from. The scene module builds it from the item atlas. */
export type BagIconResolver = (itemId: string) => SpriteCell | null;

export type BagTileView = Readonly<{
  index: number;
  itemId: string | null;
  name: string;
  /** `x<count>`, the string the board's `bag qty` prints. */
  count: string;
  selected: boolean;
  /** Panel-relative. */
  box: Rect;
  icon: SpriteCell | null;
}>;

export type BagPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `bagPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  tabs: readonly Readonly<{ category: BagPocket; label: string; active: boolean; box: Rect }>[];
  search: Readonly<{ value: string; placeholder: string; box: Rect }>;
  grid: Readonly<{ band: Rect; columns: number; gap: number; cell: number }>;
  tiles: readonly BagTileView[];
  footer: Readonly<{ rule: Rect; label: string; value: string; box: Rect }>;
  /** The floating description card, or null when no stack is selected. */
  info: Readonly<{ title: string; text: string; box: Rect }> | null;
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const BAG_PANEL_W = 344; // hudMetrics().panelW / HUD_PANEL_W
export const BAG_PANEL_H = 308; // bagH in src/scenes/panels/bag.ts
export const BAG_PAD_X = 20; // FRLG_WINDOW_PADDING.x / HUD_PAD_X
export const BAG_PAD_TOP = 16; // HUD_PAD_TOP
export const BAG_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const BAG_TAB_W = 55; // HUD_TAB_W
export const BAG_TAB_H = 26; // HUD_TAB_H
export const BAG_TAB_GAP = 4; // HUD_TAB_GAP
export const BAG_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const BAG_SEARCH_H = 24; // HUD_SEARCH_H
export const BAG_GRID_COLS = 5; // BAG_GRID_COLS
export const BAG_GRID_GAP = 6; // BAG_GRID_GAP
export const BAG_GRID_ROWS = 3;
export const BAG_GRID_CELL = 56; // bagGridLayout(...).cellW at 344×800
export const BAG_CAP = 15; // BAG_GRID_ROWS * BAG_GRID_COLS
export const BAG_FOOTER = 26;
export const BAG_INFO_W = 280; // HUD_BAG_INFO_W
export const BAG_INFO_GAP = 8; // HUD_BAG_INFO_GAP
export const BAG_TILE_ICON = 24; // ITEM_ICON_SIZE
export const BAG_TILE_COUNT_RIGHT = 11; // 64 − (42 + 11) in the board's tile
export const BAG_TILE_COUNT_BOTTOM = 6; // 60 − (44 + 10)

/** The pockets in the order the FRLG tab strip shows them (`BAG_CATEGORIES`). */
const POCKETS: readonly BagPocket[] = ['equipment', 'consumable', 'machine', 'ball', 'valuable'];

/**
 * The tab labels, copied from `src/ui/bag.ts`'s `BAG_CATEGORY_LABELS`: the panel
 * folder imports no scene-side model, so the five keys are declared here instead.
 */
const POCKET_LABELS: Readonly<Record<BagPocket, TranslationKey>> = {
  equipment: 'bag.equipment',
  consumable: 'bag.consumable',
  machine: 'bag.machine',
  ball: 'bag.ball',
  valuable: 'bag.valuable',
};

/** `partyBottom()` in `src/scenes/panels/party.ts`: what makes the bag's y 422. */
const BAG_PARTY_BOTTOM = 406;
const BAG_HEADER = BAG_PAD_TOP + BAG_TAB_H + 8; // HUD_BAG_HEADER
const BAG_SEARCH_GAP = 8; // HUD_BAG_SEARCH_GAP
const BAG_GRID_TO_FOOTER = 8; // HUD_BAG_GRID_GAP
const BAG_GRID_H = BAG_GRID_ROWS * BAG_GRID_CELL + (BAG_GRID_ROWS - 1) * BAG_GRID_GAP; // HUD_BAG_GRID_H
const BAG_GRID_TOP = BAG_HEADER + BAG_SEARCH_H + BAG_SEARCH_GAP;
/** The shipped `InfoPopup` floor and the line box each further wrapped line adds. */
const BAG_INFO_MIN_H = 56;
const BAG_INFO_LINE = 13;
const BAG_INFO_CHARS = 44;

/** The shipped rect: `x = width − panelW − 8`, `y = 8 + partyHeight(406) + 8`. */
export function bagPanelBox(viewport: Viewport): Rect {
  // An unmeasurable viewport draws the card at the shipped width, one margin in.
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : BAG_PANEL_W + 16;
  const panelW = Math.min(BAG_PANEL_W, Math.max(160, width - 16));
  return { x: width - panelW - 8, y: 8 + BAG_PARTY_BOTTOM + 8, w: panelW, h: BAG_PANEL_H };
}

export function initialBagPanelUi(): BagPanelUi {
  return { pocket: 'equipment', cursor: 0, query: '' };
}

function pocketRows(state: HudState, ui: BagPanelUi): HudState['bag'] {
  const needle = ui.query.trim().toLowerCase();
  const rows = state.bag.filter((row) => row.category === ui.pocket);
  if (needle.length === 0) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(needle));
}

function cursorOf(ui: BagPanelUi, count: number): number {
  if (count <= 0) return 0;
  const from = Number.isFinite(ui.cursor) ? Math.trunc(ui.cursor) : 0;
  return Math.min(Math.max(0, from), count - 1);
}

function linesOf(text: string): number {
  if (text.length === 0) return 0;
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    lines += Math.max(1, Math.ceil(paragraph.length / BAG_INFO_CHARS));
  }
  return lines;
}

/** `max(56, 48 + wrapped text)`, the shipped card's own height rule. */
function infoHeight(text: string): number {
  const lines = linesOf(text);
  return lines === 0 ? BAG_INFO_MIN_H : Math.max(BAG_INFO_MIN_H, 48 + (lines - 1) * BAG_INFO_LINE);
}

/** Pure: same `(state, ui, viewport, icon)` ⇒ deep-equal view. */
export function bagPanelView(
  state: HudState,
  ui: BagPanelUi,
  viewport: Viewport,
  icon: BagIconResolver,
): BagPanelView {
  const box = bagPanelBox(viewport);
  const bandW = box.w - BAG_PAD_X * 2;
  const band: Rect = { x: BAG_PAD_X, y: BAG_GRID_TOP, w: bandW, h: BAG_GRID_H };
  // `bagGridLayout`'s rule: the largest integer square that fits both axes.
  const fit = Math.min(
    (bandW - (BAG_GRID_COLS - 1) * BAG_GRID_GAP) / BAG_GRID_COLS,
    (BAG_GRID_H - (BAG_GRID_ROWS - 1) * BAG_GRID_GAP) / BAG_GRID_ROWS,
  );
  const cell = Math.max(1, Math.floor(fit));
  const gridW = BAG_GRID_COLS * cell + (BAG_GRID_COLS - 1) * BAG_GRID_GAP;
  const originX = BAG_PAD_X + Math.floor((bandW - gridW) / 2);

  const stacks = pocketRows(state, ui).slice(0, BAG_CAP);
  const cursor = cursorOf(ui, stacks.length);
  const tiles: BagTileView[] = stacks.map((row, index) => ({
    index,
    itemId: row.itemId,
    name: row.name,
    count: `x${row.count}`,
    selected: index === cursor,
    box: {
      x: originX + (index % BAG_GRID_COLS) * (cell + BAG_GRID_GAP),
      y: BAG_GRID_TOP + Math.floor(index / BAG_GRID_COLS) * (cell + BAG_GRID_GAP),
      w: cell,
      h: cell,
    },
    icon: icon(row.itemId),
  }));

  const footerTop = BAG_GRID_TOP + BAG_GRID_H + BAG_GRID_TO_FOOTER;
  const rule: Rect = { x: BAG_PAD_X, y: footerTop + 4, w: bandW, h: 1 };
  const footerBox: Rect = {
    x: BAG_PAD_X,
    y: rule.y,
    w: bandW,
    h: BAG_PANEL_H - BAG_PAD_BOTTOM - rule.y,
  };

  const selected = stacks.length === 0 ? undefined : tiles[cursor];
  const height = infoHeight('');
  const info =
    selected === undefined
      ? null
      : {
          title: selected.name,
          text: '',
          box: {
            x: Math.max(8, box.x - BAG_INFO_W - BAG_INFO_GAP),
            y:
              box.y + selected.box.y + selected.box.h - height >= 0
                ? box.y + selected.box.y + selected.box.h - height
                : box.y + selected.box.y,
            w: BAG_INFO_W,
            h: height,
          },
        };

  return {
    open: true,
    box,
    highlight: { x: 12, y: 12, w: box.w - 24, h: 1 },
    chip: { letter: 'I', box: { x: 0, y: 0, w: 24, h: 24 } },
    tabs: POCKETS.map((category, i) => ({
      category,
      label: t(POCKET_LABELS[category]),
      active: category === ui.pocket,
      box: {
        x: BAG_CONTENT_LEFT + i * (BAG_TAB_W + BAG_TAB_GAP),
        y: BAG_PAD_TOP,
        w: BAG_TAB_W,
        h: BAG_TAB_H,
      },
    })),
    search: {
      value: ui.query,
      placeholder: t('hud.searchItems'),
      box: { x: BAG_PAD_X, y: BAG_HEADER, w: bandW, h: BAG_SEARCH_H },
    },
    grid: { band, columns: BAG_GRID_COLS, gap: BAG_GRID_GAP, cell },
    tiles,
    footer: {
      rule,
      label: t('hud.money'),
      value: state.money === null ? '' : String(state.money),
      box: footerBox,
    },
    info,
  };
}

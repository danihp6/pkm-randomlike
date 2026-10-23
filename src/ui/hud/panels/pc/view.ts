/** The PC BOX panel's value model: the shipped Phaser box, as plain data (`D49`). */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type PcPane = 'box' | 'rip';

/** The panel's own state. The scene module keeps it in step with `PartyUiState`. */
export type PcPanelUi = Readonly<{ pane: PcPane; page: number; cursor: number }>;

/** One grid cell, as the shipped panel paints it. */
export type PcCellView = Readonly<{
  index: number;
  memberId: string | null;
  name: string;
  level: number;
  hpText: string;
  hpFraction: number;
  statusLabel: string | null;
  selected: boolean;
  /** The shipped dimming: a box member the run's rules will not let you move. */
  locked: boolean;
  /** Panel-relative. */
  box: Rect;
}>;

export type PcPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `pcPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  /** The visible page tabs, in page order: `label` is the printed page number. */
  tabs: readonly Readonly<{ page: number; label: string; active: boolean; box: Rect }>[];
  /** The RIP tab and whether its list is the one on screen (the shipped lock veil). */
  rip: Readonly<{ active: boolean; locked: boolean; box: Rect }>;
  grid: Readonly<{ band: Rect; columns: number; rows: number; gap: number; cell: number }>;
  cells: readonly PcCellView[];
}>;

/** One row of the box or the RIP list, as the scene hands it over. */
export type PcRow = Readonly<{
  memberId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  statusLabel: string | null;
  locked: boolean;
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const PC_PANEL_W = 344; // HUD_PANEL_W / hudMetrics().panelW
export const PC_PANEL_H = 378; // HUD_BOX_H in src/scenes/panels/pc.ts
export const PC_PAD = 12; // HUD_BOX_PAD
export const PC_PAD_X = 20; // HUD_PAD_X, used for the key chip and the RIP tab
export const PC_PAD_TOP = 16; // HUD_PAD_TOP
export const PC_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
export const PC_TAB_W = 32; // HUD_BOX_TAB_W
export const PC_TAB_H = 26; // HUD_TAB_H
export const PC_TAB_GAP = 4; // HUD_BOX_TAB_GAP
export const PC_TABS_H = 50; // HUD_BOX_TABS_H
export const PC_RIP_TAB_W = 32; // HUD_BOX_RIP_TAB_W
export const PC_MAX_PAGES = 7; // HUD_BOX_MAX_PAGES
export const PC_CELL = 76; // HUD_BOX_CELL
export const PC_CELL_GAP = 4; // HUD_BOX_CELL_GAP
export const PC_COLUMNS = 4; // BOX_COLS
export const PC_ROWS = 4; // BOX_ROWS
export const PC_PAGE_SIZE = 16; // BOX_PAGE_SIZE

/** `HUD_TOP` and `HUD_PANEL_MARGIN`: the shipped box sits 64 px under the HUD's top. */
const HUD_TOP = 8;
const HUD_PANEL_MARGIN = 8;
/** The offset from the HUD's top edge to the box window (`pc.ts`: `HUD_TOP + 64`). */
const PC_TOP = HUD_TOP + 64;
/** `HUD_ICON_INSET + HUD_ICON`: the shipped key chip is flush with the corner. */
const CHIP_SIZE = 24;
/** The board's `pc panel highlight`: 12 px inside the card's top edge. */
const HIGHLIGHT_INSET = 12;
/** The key the chip prints; the board's own keycap letter. */
const CHIP_LETTER = 'O';

const GRID_W = PC_COLUMNS * PC_CELL + (PC_COLUMNS - 1) * PC_CELL_GAP;
const GRID_H = PC_ROWS * PC_CELL + (PC_ROWS - 1) * PC_CELL_GAP;
/** Where `pc.ts` centres the grid: `HUD_BOX_PAD + (panelW - pad * 2 - gridW) / 2`. */
const GRID_X = PC_PAD + (PC_PANEL_W - PC_PAD * 2 - GRID_W) / 2;
/** The tab strip's height: the grid starts right under it. */
const GRID_Y = PC_TABS_H;
const CELL_PITCH = PC_CELL + PC_CELL_GAP;

/** The shipped rect: `x = max(8, width − 344 − 8 − 344 − 8)`, `y = 8 + 64`. */
export function pcPanelBox(viewport: Viewport): Rect {
  const x = Math.max(
    HUD_PANEL_MARGIN,
    viewport.width - PC_PANEL_W - HUD_PANEL_MARGIN - PC_PANEL_W - HUD_PANEL_MARGIN,
  );
  return { x, y: PC_TOP, w: PC_PANEL_W, h: PC_PANEL_H };
}

export function initialPcPanelUi(): PcPanelUi {
  return { pane: 'box', page: 0, cursor: 0 };
}

function fraction(hp: number, maxHp: number): number {
  if (!(maxHp > 0)) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function cell(rows: readonly PcRow[], ui: PcPanelUi, page: number, slot: number): PcCellView {
  const col = slot % PC_COLUMNS;
  const row = Math.floor(slot / PC_COLUMNS);
  const index = page * PC_PAGE_SIZE + slot;
  const member = rows[index];
  return {
    index,
    memberId: member?.memberId ?? null,
    name: member?.name ?? '',
    level: member?.level ?? 0,
    hpText: member === undefined ? '' : `${member.hp}/${member.maxHp}`,
    hpFraction: member === undefined ? 0 : fraction(member.hp, member.maxHp),
    statusLabel: member?.statusLabel ?? null,
    selected: member !== undefined && ui.cursor === index,
    locked: ui.pane === 'box' && member !== undefined && member.locked,
    box: {
      x: GRID_X + col * CELL_PITCH,
      y: GRID_Y + row * CELL_PITCH,
      w: PC_CELL,
      h: PC_CELL,
    },
  };
}

/** Pure: same `(rows, ui, pageCount, viewport)` ⇒ deep-equal view. */
export function pcPanelView(
  rows: readonly PcRow[],
  ui: PcPanelUi,
  pageCount: number,
  viewport: Viewport,
): PcPanelView {
  // A page the strip cannot draw (an older, longer box) falls back to the last one.
  const pages = Math.min(PC_MAX_PAGES, Math.max(1, Math.trunc(pageCount)));
  const page = Math.min(Math.max(0, Math.trunc(ui.page)), pages - 1);
  const cells: PcCellView[] = [];
  for (let slot = 0; slot < PC_PAGE_SIZE; slot += 1) cells.push(cell(rows, ui, page, slot));
  const tabs: PcPanelView['tabs'][number][] = [];
  for (let p = 0; p < pages; p += 1) {
    tabs.push({
      page: p,
      label: String(p + 1),
      active: p === page,
      box: {
        x: PC_CONTENT_LEFT + p * (PC_TAB_W + PC_TAB_GAP),
        y: PC_PAD_TOP,
        w: PC_TAB_W,
        h: PC_TAB_H,
      },
    });
  }
  return {
    open: true,
    box: pcPanelBox(viewport),
    highlight: { x: HIGHLIGHT_INSET, y: HIGHLIGHT_INSET, w: PC_PANEL_W - HIGHLIGHT_INSET * 2, h: 1 },
    chip: { letter: CHIP_LETTER, box: { x: 0, y: 0, w: CHIP_SIZE, h: CHIP_SIZE } },
    tabs,
    rip: {
      // The shipped RIP tab always wears its lock veil: the dead are read-only (D5).
      active: ui.pane === 'rip',
      locked: true,
      box: {
        x: PC_PANEL_W - PC_PAD_X - PC_RIP_TAB_W,
        y: PC_PAD_TOP,
        w: PC_RIP_TAB_W,
        h: PC_TAB_H,
      },
    },
    grid: {
      band: { x: GRID_X, y: GRID_Y, w: GRID_W, h: GRID_H },
      columns: PC_COLUMNS,
      rows: PC_ROWS,
      gap: PC_CELL_GAP,
      cell: PC_CELL,
    },
    cells,
  };
}

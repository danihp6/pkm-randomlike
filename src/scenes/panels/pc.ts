import type Phaser from 'phaser';
import { signal, type Signal } from '@preact/signals';
import { ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../../data/portraits';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../../data/statusIcons';
import { pcMemberEditable, withdrawToParty, type RunState } from '../../engine/run';
import {
  BOX_COLS,
  BOX_PAGE_SIZE,
  BOX_ROWS,
  boxCellIndex,
  boxPageCount,
  boxPageForIndex,
  boxRows,
  ripRows,
  type PartyRow,
} from '../../ui/partyScreen';
import {
  FRLG_ACCENT,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_SURFACE,
  addFrlgWindow,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import type { HudCommand } from '../../ui/hud/commands';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  initialPcPanelUi,
  mountPcPanel,
  pcPanelView,
  type PcPane,
  type PcPanelView,
  type PcRow,
} from '../../ui/hud/panels/pc';
import { PANEL_ICON_KEYS } from '../BootScene';
import { paintTab } from './bag';
import {
  HUD_CONTENT_LEFT,
  HUD_GAP,
  HUD_PAD_TOP,
  HUD_PAD_X,
  HUD_PANEL_MARGIN,
  HUD_TAB_H,
  HUD_TOP,
  PANEL_KEY_ACTIONS,
  draggedItemFrom,
  hudColumnLeft,
  makeHudPanel,
  panelExpanded,
  panelPoint,
  pointerPhase,
  toggleHudPanel,
} from './hud';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The PC BOX window: a page-tab strip over a grid of avatar cells, plus the RIP
 * tab that shows the fallen. The wheel and a click on a tab page it; a press on a
 * cell is the drag path's (it opens or moves the member), never this panel's.
 *
 * Under `?hud=dom` (`D49`) the box is the Preact panel in `src/ui/hud/panels/pc/`:
 * this module keeps the shipped layout arithmetic and the panel record (so the
 * quick key, the saved layout and the collapse still work) but draws no Phaser
 * object at all, and feeds the panel's view from its own state.
 */

/** The PC BOX window: a page tab strip over a grid of avatar cells. */
const HUD_BOX_PAD = 12;
const HUD_BOX_TAB_W = 32;
const HUD_BOX_TAB_GAP = 4;
const HUD_BOX_TABS_H = HUD_PAD_TOP + HUD_TAB_H + 8;
const HUD_BOX_CELL = 76;
const HUD_BOX_CELL_GAP = 4;
const HUD_BOX_GRID_H = BOX_ROWS * HUD_BOX_CELL + (BOX_ROWS - 1) * HUD_BOX_CELL_GAP;
const HUD_BOX_H = HUD_BOX_TABS_H + HUD_BOX_GRID_H + HUD_BOX_PAD;
const HUD_BOX_MAX_PAGES = 7;
const HUD_BOX_RIP_TAB_W = 32;
/** The cap the RIP tab carries: the abbreviation reads the same in both locales. */
const HUD_BOX_RIP_LABEL = 'RIP';
/** The held-item badge on a box cell, and the status badge in its corner. */
const HUD_BOX_HELD_ICON_SCALE = 1;
const HUD_BOX_STATUS_SCALE = 1.5;
/** The veil a locked box cell wears, shared by the cell and the RIP tab. */
const HUD_BOX_LOCK_FILL = FRLG_SURFACE;
const HUD_BOX_LOCK_ALPHA = 0.55;

/**
 * `?hud=dom` read once (`D49`): with it on, the box is the DOM panel and this
 * module draws no Phaser object. `parseHudFlags` reads the query string only.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;

/** The box's current page, its page tabs and its avatar cells. */
let hudBoxPage = 0;
let hudBoxTabs: {
  page: number;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let hudBoxRip!: {
  veil: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
};
let hudBoxCells: {
  highlight: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  held: Phaser.GameObjects.Image;
  status: Phaser.GameObjects.Image;
  /** A dim veil over a box member that is **locked** (the PC cannot be edited). */
  lock: Phaser.GameObjects.Rectangle;
}[] = [];
/** The box window's own left edge, top and height. */
let hudBoxX = 0;
let hudBoxY = 0;
let hudBoxH = 0;
/** The container the box's own objects live in: what the flag contract counts. */
let hudBoxBody: Phaser.GameObjects.Container | null = null;
/** The DOM panel's view (`?hud=dom`), and the mount's disposer. */
let pcView: Signal<PcPanelView> | null = null;
let pcDispose: (() => void) | null = null;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because a panel module never
 * imports Phaser as a value. The route pauses itself for a battle and for the
 * Settings screen; a DOM root sits above the canvas, so it has to hide itself.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';
/** True while the route scene is paused: the DOM root is hidden then. */
let pcPaused = false;
let pcUnsubscribeScene: (() => void) | null = null;

/** The box window's left edge, so the detail panel can dock beside it. */
export function boxLeft(): number {
  return hudBoxX;
}

/** The box window's top edge, so the detail panel can dock level with it. */
export function boxTop(): number {
  return hudBoxY;
}

/** The number of display objects the PC draws right now: 0 under `?hud=dom`. */
export function pcDrawnObjectCount(): number {
  return hudBoxBody === null ? 0 : hudBoxBody.list.length;
}

/** A box cell's held-item badge, so the drag path can take the item in hand. */
export function boxHeldBadge(index: number): Phaser.GameObjects.Image | undefined {
  return hudBoxCells[index - hudBoxPage * BOX_PAGE_SIZE]?.held;
}

/** True when the pointer is on the box window's frame. */
export function pointerInBoxPanel(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (DOM_HUD) return false;
  if (!panelExpanded(host, 'box')) return false;
  const point = panelPoint(host, pointer, 'box');
  return (
    point.x >= hudBoxX &&
    point.x <= hudBoxX + host.hud().panelW &&
    point.y >= hudBoxY &&
    point.y <= hudBoxY + hudBoxH
  );
}

/** The box index under the pointer, or null outside a filled cell. */
export function hudBoxCellAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): number | null {
  if (DOM_HUD) return null;
  const point = panelPoint(host, pointer, 'box');
  const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
  const gridLeft = hudBoxX + HUD_BOX_PAD + (host.hud().panelW - HUD_BOX_PAD * 2 - gridW) / 2;
  const stride = HUD_BOX_CELL + HUD_BOX_CELL_GAP;
  const col = Math.floor((point.x - gridLeft) / stride);
  const row = Math.floor((point.y - (hudBoxY + HUD_BOX_TABS_H)) / stride);
  if (col < 0 || col >= BOX_COLS || row < 0 || row >= BOX_ROWS) return null;
  const index = boxCellIndex(hudBoxPage, col, row);
  const run = host.run();
  const length = host.ui().pane === 'rip' ? run.rip.length : run.box.length;
  return index < length ? index : null;
}

/** Steps the PC BOX to another page and redraws. */
export function stepBoxPage(host: RoutePanelHost, delta: number): void {
  if (DOM_HUD) return;
  const run = host.run();
  const length = host.ui().pane === 'rip' ? run.rip.length : run.box.length;
  const pageCount = boxPageCount(length);
  hudBoxPage = Math.max(0, Math.min(pageCount - 1, hudBoxPage + delta));
  host.refreshHud();
}

/** Shows the box window's other list (`'rip'` or back to `'box'`). */
function setHudBoxPane(host: RoutePanelHost, pane: 'box' | 'rip'): void {
  if (host.ui().pane !== pane) host.setUi({ pane, index: 0, grabbed: null });
  hudBoxPage = 0;
  host.refreshHud();
}

/** A press on a PC box page tab selects it; true when it handled the press. */
function selectBoxTab(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'box')) return false;
  const point = panelPoint(host, pointer, 'box');
  const tab = hudBoxTabs.find(
    (entry) =>
      entry.bg.visible &&
      point.x >= entry.bg.x &&
      point.x <= entry.bg.x + entry.bg.width &&
      point.y >= entry.bg.y &&
      point.y <= entry.bg.y + entry.bg.height,
  );
  if (!tab) return false;
  hudBoxPage = tab.page;
  // The cursor follows the page the pointer picked, so a page tab can never leave
  // the cursor pointing past the list it just switched to.
  const ui = host.ui();
  if (!ui.grabbed) {
    const run = host.run();
    const length = ui.pane === 'rip' ? run.rip.length : run.box.length;
    host.setUi({ ...ui, index: Math.min(ui.index, length - 1) });
  }
  host.refreshHud();
  return true;
}

/** A press on the RIP tab shows the dead (or returns to the box); true when it handled it. */
function selectRipTab(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!panelExpanded(host, 'box')) return false;
  const point = panelPoint(host, pointer, 'box');
  const { bg } = hudBoxRip;
  if (point.x < bg.x || point.x > bg.x + bg.width || point.y < bg.y || point.y > bg.y + bg.height) {
    return false;
  }
  setHudBoxPane(host, host.ui().pane === 'rip' ? 'box' : 'rip');
  return true;
}

function refreshBox(host: RoutePanelHost): void {
  if (hudBoxCells.length === 0) return;
  const run = host.run();
  const ui = host.ui();
  const pane: 'box' | 'rip' = ui.pane === 'rip' ? 'rip' : 'box';
  const rows = pane === 'rip' ? ripRows(run) : boxRows(run);
  const pageCount = boxPageCount(rows.length);
  if (hudBoxPage >= pageCount) hudBoxPage = pageCount - 1;
  hudBoxTabs.forEach((tab, i) => {
    const visible = i < pageCount;
    tab.bg.setVisible(visible);
    tab.label.setVisible(visible);
    const active = i === hudBoxPage;
    paintTab(tab.bg, active);
    tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
  });
  const ripActive = ui.pane === 'rip';
  paintTab(hudBoxRip.bg, ripActive);
  hudBoxRip.label.setTint(ripActive ? FRLG_ACCENT : FRLG_INK);
  hudBoxCells.forEach((cell, i) => {
    const index = boxCellIndex(hudBoxPage, i % BOX_COLS, Math.floor(i / BOX_COLS));
    const member = rows[index];
    const portrait = member ? portraitFor(member.speciesId, member.shiny) : null;
    cell.portrait.setVisible(portrait !== null);
    if (portrait) cell.portrait.setTexture(portrait.key, portrait.frame);
    const heldFrame = pane === 'box' && member?.heldItem ? itemIconFrame(member.heldItem) : null;
    const inHand = pane === 'box' && member !== undefined && draggedItemFrom() === member.id;
    cell.held.setVisible(heldFrame !== null && !inHand);
    if (heldFrame !== null) cell.held.setFrame(heldFrame);
    const statusFrame = pane === 'box' && member?.status ? statusIconFrame(member.status) : null;
    cell.status.setVisible(statusFrame !== null);
    if (statusFrame !== null) cell.status.setFrame(statusFrame);
    // The dead wear the lock veil on every filled cell; a locked box cell keeps
    // the shipped rule.
    cell.lock.setVisible(
      pane === 'rip' ? member !== undefined : member !== undefined && !pcMemberEditable(run, member.id),
    );
    cell.highlight.setVisible(ui.grabbed?.pane === pane && ui.index === index);
  });
}

function pointerDown(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (selectRipTab(host, pointer)) return true;
  if (selectBoxTab(host, pointer)) return true;
  return false;
}

/** The view's viewport: the scene's own window, as the HUD metrics see it. */
function viewport(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** One box/RIP row as the panel draws it; the box's lock is the shipped dimming. */
function pcRow(run: RunState, pane: PcPane, row: PartyRow): PcRow {
  return {
    memberId: row.id,
    name: row.name,
    level: row.level,
    hp: row.hp,
    maxHp: row.maxHp,
    statusLabel: row.statusLabel,
    locked: pane === 'box' && !pcMemberEditable(run, row.id),
  };
}

/**
 * The one emit point of the DOM panel: the scene owns the run and the pane, the
 * panel paints them. `open` is the frame machinery's, not the box's own state, so
 * it is stamped here after the pure projection.
 */
function refreshDom(host: RoutePanelHost): void {
  const view = pcView;
  if (view === null) return;
  const run = host.run();
  const ui = host.ui();
  const pane: PcPane = ui.pane === 'rip' ? 'rip' : 'box';
  const rows = (pane === 'rip' ? ripRows(run) : boxRows(run)).map((row) => pcRow(run, pane, row));
  const pageCount = boxPageCount(rows.length);
  hudBoxPage = Math.min(boxPageForIndex(ui.index), pageCount - 1);
  view.value = {
    ...pcPanelView(rows, { pane, page: hudBoxPage, cursor: ui.index }, pageCount, viewport(host)),
    open: !pcPaused && panelExpanded(host, 'box'),
  };
}

/** The route paused (a battle over it, or the Settings screen): the panel follows. */
function setDomPaused(host: RoutePanelHost, paused: boolean): void {
  if (pcPaused === paused) return;
  pcPaused = paused;
  refreshDom(host);
}

/** Drops the scene's pause/resume subscription; the route is going away. */
function unsubscribeScene(): void {
  pcUnsubscribeScene?.();
  pcUnsubscribeScene = null;
  pcPaused = false;
}

/** Subscribes the panel to the route's own pause and resume beats. */
function subscribeScene(host: RoutePanelHost): void {
  unsubscribeScene();
  const events = host.scene.events;
  const onPause = (): void => setDomPaused(host, true);
  const onResume = (): void => setDomPaused(host, false);
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  pcUnsubscribeScene = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
  };
}

/** Turns the DOM's page tabs and wheel into a page step: the page follows the cursor. */
function stepDomPage(host: RoutePanelHost, delta: number): void {
  const run = host.run();
  const ui = host.ui();
  const rows = ui.pane === 'rip' ? ripRows(run) : boxRows(run);
  const pages = Math.max(1, Math.min(HUD_BOX_MAX_PAGES, boxPageCount(rows.length)));
  const from = Math.min(boxPageForIndex(ui.index), pages - 1);
  const to = Math.max(0, Math.min(pages - 1, from + delta));
  if (to === from) return;
  const index = Math.min(to * BOX_PAGE_SIZE, Math.max(0, rows.length - 1));
  host.setUi({ ...ui, index });
  host.refreshHud();
}

/**
 * A press on a box cell: the cursor follows the press, and a box member the run's
 * rules allow is withdrawn into the party — the shipped rule (`withdrawToParty`),
 * never a copy of it. The RIP list stays read-only.
 */
function pressDomCell(host: RoutePanelHost, memberId: string): void {
  const run = host.run();
  const ui = host.ui();
  const pane: PcPane = ui.pane === 'rip' ? 'rip' : 'box';
  const rows = pane === 'rip' ? ripRows(run) : boxRows(run);
  const index = rows.findIndex((row) => row.id === memberId);
  if (index < 0) return;
  if (ui.index !== index) host.setUi({ ...ui, index });
  if (pane !== 'box' || !pcMemberEditable(run, memberId)) {
    host.refreshHud();
    return;
  }
  const next = withdrawToParty(run, index);
  if (next !== run) host.commitRun(next);
  else host.refreshHud();
}

/**
 * The DOM panel's command vocabulary, resolved here and nowhere else: the key chip
 * asks for the panel toggle, a cell for a member, the page tabs and the wheel for a
 * left/right page step, and the RIP tab for a confirm (it selects that list).
 */
function handleDomCommand(host: RoutePanelHost, command: HudCommand): void {
  // A paused route takes no command from the DOM: the root is hidden and its own
  // key neither toggles now nor queues a toggle for the resume.
  if (!DOM_HUD || pcPaused) return;
  switch (command.type) {
    case 'panel':
      if (command.panel === 'box') toggleHudPanel(host, 'box');
      return;
    case 'member':
      pressDomCell(host, command.memberId);
      return;
    case 'press':
      if (command.action === 'left' || command.action === 'right') {
        stepDomPage(host, command.action === 'right' ? 1 : -1);
      } else if (command.action === 'confirm') {
        setHudBoxPane(host, host.ui().pane === 'rip' ? 'box' : 'rip');
      }
      return;
    default:
      return;
  }
}

function disposeDomPanel(): void {
  if (pcDispose === null) return;
  pcDispose();
  pcDispose = null;
}

/**
 * The flag-on build: the same layout arithmetic and the same panel record, so the
 * quick key, the saved layout and the collapse keep working — but no box content
 * and no visible Phaser object, the panel itself being the DOM one.
 */
function buildDom(host: RoutePanelHost): void {
  const scene = host.scene;
  const x = hudColumnLeft(host);
  const { panelW } = host.hud();
  const boxX = Math.max(HUD_PANEL_MARGIN, x - panelW - HUD_GAP);
  const boxY = HUD_TOP + 64;
  hudBoxX = boxX;
  hudBoxY = boxY;
  hudBoxH = HUD_BOX_H;
  hudBoxPage = 0;
  hudBoxTabs = [];
  hudBoxCells = [];
  const boxWindow = addFrlgWindow(scene, boxX, boxY, panelW, HUD_BOX_H).setVisible(false);
  const body = scene.add.container(0, 0);
  hudBoxBody = body;
  const panel = makeHudPanel(
    host,
    'box',
    boxX,
    boxY,
    panelW,
    HUD_BOX_H,
    body,
    boxWindow,
    PANEL_ICON_KEYS.box,
    PANEL_KEY_ACTIONS.box ?? null,
  );
  panel.container.setVisible(false);
  panel.icon.setVisible(false);
  // `makeHudPanel` hangs the Transparent-HUD outline in the body; the box draws
  // nothing at all under the flag, so the empty body stays empty and the flag
  // contract counts zero.
  body.remove(panel.border);
  disposeDomPanel();
  const view = signal(pcPanelView([], initialPcPanelUi(), 1, viewport(host)));
  pcView = view;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null)
    pcDispose = mountPcPanel(layer, view, (command) => handleDomCommand(host, command));
  subscribeScene(host);
  refreshDom(host);
}

function buildBox(host: RoutePanelHost): void {
  const scene = host.scene;
  const x = hudColumnLeft(host);
  const { panelW } = host.hud();
  // The PC BOX window sits in a second column to the left of the party/bag
  // stack. On a narrow screen there is no room to the left, so it is clamped
  // onto the screen and overlaps.
  const boxX = Math.max(HUD_PANEL_MARGIN, x - panelW - HUD_GAP);
  const boxY = HUD_TOP + 64;
  hudBoxX = boxX;
  hudBoxY = boxY;
  hudBoxH = HUD_BOX_H;
  hudBoxPage = 0;
  const boxChildren: Phaser.GameObjects.GameObject[] = [];
  const boxWindow = addFrlgWindow(scene, boxX, boxY, panelW, HUD_BOX_H);
  boxChildren.push(boxWindow);

  hudBoxTabs = [];
  for (let page = 0; page < HUD_BOX_MAX_PAGES; page++) {
    const tabX = boxX + HUD_CONTENT_LEFT + page * (HUD_BOX_TAB_W + HUD_BOX_TAB_GAP);
    const bg = scene.add
      .rectangle(
        tabX,
        boxY + HUD_PAD_TOP,
        HUD_BOX_TAB_W,
        HUD_TAB_H,
        FRLG_ROW_FILL.colour,
        FRLG_ROW_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setVisible(false);
    const label = addFrlgText(
      scene,
      tabX + HUD_BOX_TAB_W / 2,
      boxY + HUD_PAD_TOP + 5,
      String(page + 1),
      { size: 16, tint: FRLG_INK, origin: [0.5, 0] },
    ).setVisible(false);
    hudBoxTabs.push({ page, bg, label });
    boxChildren.push(bg, label);
  }

  const ripX = boxX + panelW - HUD_PAD_X - HUD_BOX_RIP_TAB_W;
  const ripY = boxY + HUD_PAD_TOP;
  const ripBg = scene.add
    .rectangle(ripX, ripY, HUD_BOX_RIP_TAB_W, HUD_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
    .setOrigin(0, 0);
  const ripVeil = scene.add
    .rectangle(ripX, ripY, HUD_BOX_RIP_TAB_W, HUD_TAB_H, HUD_BOX_LOCK_FILL, HUD_BOX_LOCK_ALPHA)
    .setOrigin(0, 0);
  const ripLabel = addFrlgText(scene, ripX + HUD_BOX_RIP_TAB_W / 2, ripY + 5, HUD_BOX_RIP_LABEL, {
    size: 16,
    tint: FRLG_INK,
    origin: [0.5, 0],
  });
  hudBoxRip = { veil: ripVeil, bg: ripBg, label: ripLabel };
  boxChildren.push(ripBg, ripVeil, ripLabel);

  const gridW = BOX_COLS * HUD_BOX_CELL + (BOX_COLS - 1) * HUD_BOX_CELL_GAP;
  const gridLeft = boxX + HUD_BOX_PAD + (panelW - HUD_BOX_PAD * 2 - gridW) / 2;
  hudBoxCells = [];
  for (let i = 0; i < BOX_PAGE_SIZE; i++) {
    const col = i % BOX_COLS;
    const row = Math.floor(i / BOX_COLS);
    const cellX = gridLeft + col * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
    const cellY = boxY + HUD_BOX_TABS_H + row * (HUD_BOX_CELL + HUD_BOX_CELL_GAP);
    const bg = scene.add
      .rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
    const highlight = scene.add
      .rectangle(
        cellX,
        cellY,
        HUD_BOX_CELL,
        HUD_BOX_CELL,
        FRLG_SELECTED_FILL.colour,
        FRLG_SELECTED_FILL.alpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha)
      .setVisible(false);
    const portrait = scene.add
      .image(cellX + HUD_BOX_CELL / 2, cellY + HUD_BOX_CELL / 2, PORTRAIT_TEXTURE_KEY, 0)
      .setScale(1)
      .setVisible(false);
    const held = scene.add
      .image(cellX + 62, cellY + 62, ITEM_ICON_TEXTURE_KEY, 0)
      .setScale(HUD_BOX_HELD_ICON_SCALE)
      .setVisible(false);
    const status = scene.add
      .image(cellX + HUD_BOX_CELL - 3, cellY + 2, STATUS_ICON_TEXTURE_KEY, 0)
      .setOrigin(1, 0)
      .setScale(HUD_BOX_STATUS_SCALE)
      .setVisible(false);
    const lock = scene.add
      .rectangle(cellX, cellY, HUD_BOX_CELL, HUD_BOX_CELL, HUD_BOX_LOCK_FILL, HUD_BOX_LOCK_ALPHA)
      .setOrigin(0, 0)
      .setVisible(false);
    hudBoxCells.push({ highlight, bg, portrait, held, status, lock });
    boxChildren.push(bg, highlight, portrait, held, status, lock);
  }

  const body = scene.add.container(0, 0, boxChildren);
  hudBoxBody = body;
  makeHudPanel(
    host,
    'box',
    boxX,
    boxY,
    panelW,
    HUD_BOX_H,
    body,
    boxWindow,
    PANEL_ICON_KEYS.box,
    PANEL_KEY_ACTIONS.box ?? null,
  );
}

/** Disposes the DOM panel and clears the box's module state. */
function closeDom(_host: RoutePanelHost): void {
  unsubscribeScene();
  disposeDomPanel();
  pcView = null;
  hudBoxBody = null;
  hudBoxTabs = [];
  hudBoxCells = [];
  hudBoxPage = 0;
  hudBoxX = 0;
  hudBoxY = 0;
  hudBoxH = 0;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'pc',
  order: 50,
  hudPanel: 'box',
  build(host: RoutePanelHost): void {
    if (DOM_HUD) buildDom(host);
    else buildBox(host);
  },
  refresh(host: RoutePanelHost): void {
    if (DOM_HUD) refreshDom(host);
    else refreshBox(host);
  },
  pointer(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
    if (DOM_HUD) return false;
    return pointerPhase() === 'down' ? pointerDown(host, pointer) : false;
  },
  close(host: RoutePanelHost): void {
    if (DOM_HUD) closeDom(host);
  },
};

import type Phaser from 'phaser';
import { signal, type Signal } from '@preact/signals';
import { getMove, getSpecies, type StatId, type Stats } from '../../data/dex';
import { tmNumber } from '../../data/tms';
import { PORTRAIT_TEXTURE_KEY, portraitFor } from '../../data/portraits';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../../data/statusIcons';
import { abilityMoveType } from '../../engine/battle/moveType';
import { MAX_MOVES, evolveMember, moveMoves, type RunPokemon, type RunState } from '../../engine/run';
import { equipMove, learnsetPool, unequipMove, type LearnEntry } from '../../engine/run/learnset';
import { NICKNAME_MAX_LENGTH, normalizeNickname, renameMember } from '../../engine/run/nickname';
import { t } from '../../i18n';
import { moveName, moveShortDescription } from '../../i18n/content';
import { AbilityInfoButton, abilityInfoContent, abilityInfoSpot } from '../../ui/abilityInfo';
import { evolutionRowNote, type FamilyNode } from '../../ui/evolutionGraph';
import { levelColumnWidth } from '../../ui/hud/panels/detail/evolution';
import {
  FRLG_ACCENT,
  FRLG_BADGE_INK,
  FRLG_MUTED,
  FRLG_POSITIVE,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_WINDOW_PADDING,
  addFrlgWindow,
  badgeInkFor,
} from '../../ui/frlg';
import { FRLG_INK, addFrlgText } from '../../ui/frlgFont';
import { parseHudFlags } from '../../ui/hud/fixtures';
import {
  DETAIL_POOL_COLS,
  detailPanelView,
  initialDetailPanelUi,
  mountDetailPanel,
  type DetailIntent,
  type DetailPanelUi,
  type DetailPanelView,
  type DetailPoolRow,
} from '../../ui/hud/panels/detail';
import { InfoPopup } from '../../ui/infoPopup';
import { MoveGrid, padMoveGridCells, type MoveGridCell } from '../../ui/moveGrid';
import {
  CLOSED_DETAIL,
  NATURE_DOWN_TINT,
  NATURE_UP_TINT,
  carriedDetailTab,
  closeDetail,
  dropMove,
  grabMove,
  memberDetail,
  natureEffect,
  openDetail,
  reorderMoves,
  setDetailTab,
  statLabel,
  typeColor,
  type DetailState,
  type DetailTab,
  type MemberDetail,
} from '../../ui/partyDetail';
import { clampScrollTop, maxScrollTop, scrollByRows, visibleRange } from '../../ui/scroll';
import type { LevelUpBeat } from '../../ui/beats';
import { PANEL_ICON_KEYS } from '../BootScene';
import { paintTab } from './bag';
import {
  HUD_CONTENT_LEFT,
  HUD_GAP,
  HUD_PAD_BOTTOM,
  HUD_PAD_TOP,
  HUD_PANEL_MARGIN,
  HUD_SEARCH_H,
  HUD_TAB_GAP,
  PANEL_KEY_ACTIONS,
  dockDetailPanelOnce,
  hudPanelAt,
  hudPanelIconAt,
  makeHudPanel,
  panelById,
  panelExpanded,
  panelPoint,
  pointerPhase,
  registerHudOverlay,
  setGrabMoved,
  vialButtonAt,
} from './hud';
import { HUD_PARTY_STATUS_SCALE } from './party';
import { boxLeft, boxTop } from './pc';
import type { RoutePanelDescriptor, RoutePanelHost } from './types';

/**
 * The member detail window: a header (name, level, types) over the STATS and MOVES
 * tabs, the nickname field, the evolution graph, the draggable move grid and the
 * learnset pool, plus the level-up/evolution popup those two tabs raise. A click on
 * a party or PC-box member opens it; nothing repaints per frame.
 */

/** Which of the detail panel's two move grids a hit or the floating popup belongs to. */
type DetailInfoGrid = 'moves' | 'learn';
/** The ⓘ the panel's info state names: the grid and the cell index in that grid's window. */
type DetailInfoTarget = { grid: DetailInfoGrid; index: number };
/** The cell under the pointer plus whether the point sits on its ⓘ button. */
type DetailInfoHit = DetailInfoTarget & { onInfo: boolean };

const HUD_DETAIL_TAB_H = 26;
const HUD_DETAIL_TABS_TOP = 72;
const HUD_DETAIL_CONTENT_TOP = HUD_DETAIL_TABS_TOP + HUD_DETAIL_TAB_H + 10;
/**
 * The STATS tab's nickname field: an editable box in the header's name row, the
 * same look and height as the MOVES tab's search field. It stops short of the
 * right-aligned level column, so the two share the row without touching.
 */
const HUD_NICKNAME_FIELD_H = 22;
const HUD_NICKNAME_FIELD_TOP = HUD_PAD_TOP - 1;
const HUD_NICKNAME_LEVEL_W = 72;
const HUD_NICKNAME_MIN_W = 48;
const HUD_DETAIL_STAT_ROW = 26;
const HUD_DETAIL_STAT_COLS = 2;
const HUD_DETAIL_STAT_ROWS = 3;
const HUD_DETAIL_INFO_ROW = 22;
const HUD_DETAIL_INFO_ROWS = 2;
/**
 * The MOVES tab stacks three bands: the 2x2 slotted moves grid, a search field
 * and the learnset pool (the moves already learned plus the bag TMs). The panel
 * is tall enough for all three with the pool showing two rows at a time.
 */
const HUD_DETAIL_MOVE_GRID_H = 188;
const HUD_DETAIL_LEARN_GAP = 8;
/** The learnset pool's window: two columns of two rows, scrolled one row at a time. */
const HUD_DETAIL_LEARN_COLS = 2;
const HUD_DETAIL_LEARN_ROWS = 2;
const HUD_DETAIL_MOVES_H = 560;
const HUD_DETAIL_H = Math.max(
  HUD_DETAIL_CONTENT_TOP +
    HUD_DETAIL_STAT_ROWS * HUD_DETAIL_STAT_ROW +
    8 +
    HUD_DETAIL_INFO_ROWS * HUD_DETAIL_INFO_ROW +
    HUD_PAD_BOTTOM,
  HUD_DETAIL_MOVES_H,
);
/**
 * The STATS tab: the six stats in two columns of three. HP leads the first
 * column; its bar is gone, so the row prints the current / max HP.
 */
const HUD_DETAIL_STATS: readonly (readonly StatId[])[] = [
  ['hp', 'atk', 'def'],
  ['spa', 'spd', 'spe'],
];
const HUD_DETAIL_TYPE_W = 74;
/**
 * The STATS tab's evolution band: a title over the family **graph** — one row
 * per species, indented by stage, joined by elbow edges with each branch's level
 * on the right. Nine rows cover the widest family (Eevee's eight plus itself);
 * a ready branch is green and clickable, the current species gold.
 */
const HUD_DETAIL_EVO_TITLE_TOP = 250;
const HUD_DETAIL_EVO_TOP = HUD_DETAIL_EVO_TITLE_TOP + 22;
const HUD_DETAIL_EVO_MAX = 9;
const HUD_DETAIL_EVO_ROW_H = 28;
const HUD_DETAIL_EVO_INDENT = 34;
const HUD_DETAIL_EVO_PORTRAIT_SCALE = 0.4;
const HUD_DETAIL_EVO_LINE = FRLG_MUTED;
const HUD_DETAIL_EVO_READY = FRLG_POSITIVE;
const HUD_DETAIL_EVO_CURRENT = FRLG_ACCENT;

/** The member detail panel (STATS / MOVES) and the state behind it. */
let hudDetail!: Phaser.GameObjects.Container;
/** The detail window's chrome, faded when its transparency toggle is on. */
let hudDetailWindow!: Phaser.GameObjects.NineSlice;
let hudDetailState: DetailState = CLOSED_DETAIL;
let hudDetailX = 0;
let hudDetailY = 0;
let hudDetailName!: Phaser.GameObjects.BitmapText;
/** The nickname field's box, drawn under the name text on the STATS tab. */
let hudNicknameBg!: Phaser.GameObjects.Rectangle;
/** The nickname field's hit rectangle, in the panel's layout coordinates. */
let hudNicknameRect = { x: 0, y: 0, w: 0, h: 0 };
/** True while the nickname field owns the keyboard. */
let hudNicknameFocus = false;
/** The in-progress text; null while the field is not being edited. */
let hudNicknameEdit: string | null = null;
/** "click to name" inside the field's rectangle while the STATS tab is up. */
let hudDetailNameHint!: Phaser.GameObjects.BitmapText;
let hudDetailLevel!: Phaser.GameObjects.BitmapText;
let hudDetailStatus!: Phaser.GameObjects.Image;
let hudDetailTypes: {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let hudDetailTabs: {
  tab: DetailTab;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}[] = [];
let hudDetailStats!: {
  rows: { stat: StatId; label: Phaser.GameObjects.BitmapText; value: Phaser.GameObjects.BitmapText }[];
  nature: Phaser.GameObjects.BitmapText;
  ability: Phaser.GameObjects.BitmapText;
  held: Phaser.GameObjects.BitmapText;
  caught: Phaser.GameObjects.BitmapText;
};
/**
 * The STATS tab's evolution band: an "EVOLUTIONS" title, an empty hint and a
 * fixed grid of branch cells repainted by `refreshDetail` from
 * `MemberDetail.evolutions`. The ready cells are green and clickable.
 */
let hudDetailEvoTitle!: Phaser.GameObjects.BitmapText;
let hudDetailEvoHint!: Phaser.GameObjects.BitmapText;
let hudDetailEvoEmpty!: Phaser.GameObjects.BitmapText;
let hudDetailEvoGraphics!: Phaser.GameObjects.Graphics;
let hudDetailEvoCells: {
  node: FamilyNode | null;
  rect: { x: number; y: number; w: number; h: number };
  bg: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.BitmapText;
  level: Phaser.GameObjects.BitmapText;
}[] = [];
let hudDetailEmpty!: Phaser.GameObjects.BitmapText;
/** The shared moves grid drawn in the MOVES tab, with its floating info popup. */
let hudMoveGrid!: MoveGrid;
/** The move whose ⓘ floats its info popup, or null; `pinned` keeps it up. */
let hudDetailInfo: DetailInfoTarget | null = null;
let hudDetailInfoPinned = false;
/** The ⓘ beside the STATS tab's ability row, and the window it floats. */
let hudAbilityPopup!: InfoPopup;
let hudAbilityInfoButton!: AbilityInfoButton;
let hudAbilityInfo = false;
let hudAbilityInfoPinned = false;
/** The learnset pool: its grid, scroll window, search field, focus and the move in hand. */
let hudLearnGrid!: MoveGrid;
/** The first visible row of the pool window. */
let hudLearnScrollTop = 0;
/** The entries the window shows at `hudLearnScrollTop`, for hit-testing the drag. */
let hudLearnWindow: readonly LearnEntry[] = [];
/** The band's own rect as laid out, for the wheel and the background drag. */
let hudLearnRect = { x: 0, y: 0, w: 0, h: 0 };
/** The band's background drag in progress, or null. */
let hudLearnScrollDrag: { startY: number; startTop: number; rowPitch: number } | null = null;
let hudLearnQuery = '';
let hudSearchFocus = false;
let hudSearchBg!: Phaser.GameObjects.Rectangle;
let hudSearchText!: Phaser.GameObjects.BitmapText;
/** The search field and pool grid rects, laid out by `refreshDetail`. */
let hudSearchRect = { x: 0, y: 0, w: 0, h: 0 };
let hudLearnPrev!: Phaser.GameObjects.BitmapText;
let hudLearnNext!: Phaser.GameObjects.BitmapText;
/** "no moves to learn" when the pool offers nothing to equip. */
let hudLearnEmpty!: Phaser.GameObjects.BitmapText;
/** The pool move held while dragging it onto a slot, and its ghost chip. */
let hudLearnDrag: string | null = null;
let hudLearnGhost!: Phaser.GameObjects.BitmapText;
/** The level-up / evolution popup and whether it is up. */
let learnPopup!: Phaser.GameObjects.Container;
let learnPopupTitle!: Phaser.GameObjects.BitmapText;
let learnPopupBody!: Phaser.GameObjects.BitmapText;
let learnPopupOpen = false;
/** Scene time the popup opened, so the click that opened it cannot dismiss it. */
let learnPopupAt = 0;

/**
 * `?hud=dom` read once (`D49`): with it on, the card is the Preact panel in
 * `src/ui/hud/panels/detail/` and this module draws no Phaser object for it.
 * `parseHudFlags` reads the query string only.
 */
const DOM_HUD = typeof window === 'undefined' ? false : parseHudFlags(window.location.search).dom;
/**
 * `Phaser.Scenes.Events.PAUSE` / `RESUME`, spelled out because this module imports
 * Phaser type-only. The route pauses itself for a battle and for the Settings screen;
 * a DOM card sits above the canvas, so it has to hide itself on the beat.
 */
const SCENE_PAUSE = 'pause';
const SCENE_RESUME = 'resume';

/** The mounted DOM card: the view it paints and the mount's disposer. */
let domView: Signal<DetailPanelView> | null = null;
let domDispose: (() => void) | null = null;
/** The delegated party-row press that opens the card under the flag, and its remover. */
let domOpener: (() => void) | null = null;
/** The scene's pause/resume subscription, dropped when the route goes away. */
let domUnsubscribeScene: (() => void) | null = null;
/** True while the route is paused under another screen: the card hides then. */
let domPaused = false;
/** The move slot and the pool row the DOM card's cursor sits on; -1 for none. */
let hudDetailCursor = -1;
let hudPoolCursor = -1;
/** The container the detail window's own objects live in: what the flag contract counts. */
let hudDetailBody: Phaser.GameObjects.Container | null = null;

/** The last row the pool window may start at, or 0 when it all fits. */
function maxLearnScrollTop(host: RoutePanelHost): number {
  return maxScrollTop(learnPool(host).length, HUD_DETAIL_LEARN_COLS, HUD_DETAIL_LEARN_ROWS);
}

/** The move grid's marked cell: the move grabbed with the pointer, or none. */
function detailSlotCursor(): number {
  return hudDetailState.grab ?? -1;
}

/** The pool grid's marked cell: the pool move in hand, or none. */
function learnWindowCursor(): number {
  if (hudLearnDrag === null) return -1;
  return hudLearnWindow.findIndex((entry) => entry.moveId === hudLearnDrag);
}

/** The party/box member the open detail panel shows, or undefined. */
function detailMember(host: RoutePanelHost): RunPokemon | undefined {
  const memberId = hudDetailState.memberId;
  if (memberId === null) return undefined;
  const run = host.run();
  return (
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId) ??
    run.rip.find((entry) => entry.fighter.id === memberId)
  );
}

/** True while the open detail panel is showing a member of `run.rip`. */
function deadDetail(host: RoutePanelHost): boolean {
  const memberId = hudDetailState.memberId;
  return memberId !== null && host.run().rip.some((member) => member.fighter.id === memberId);
}

/** The filtered learnset pool for the open member, in draw order. */
function learnPool(host: RoutePanelHost): LearnEntry[] {
  const member = detailMember(host);
  if (!member) return [];
  const run = host.run();
  const pool = learnsetPool(run, member, run.seed);
  const query = hudLearnQuery.trim().toLowerCase();
  if (query.length === 0) return pool;
  return pool.filter((entry) => {
    const move = getMove(entry.moveId);
    return (
      entry.moveId.includes(query) ||
      moveName(entry.moveId).toLowerCase().includes(query) ||
      (move?.type ?? '').toLowerCase().includes(query)
    );
  });
}

/** One learnset cell: the move's reading plus a Lv/Tutor/TM source tag in its name. */
function learnCell(
  entry: LearnEntry,
  ability: string,
  ivs: Partial<Stats> | null | undefined,
): MoveGridCell {
  const move = getMove(entry.moveId);
  const basePower = move?.basePower ?? 0;
  const accuracy = move && move.accuracy !== true ? move.accuracy : null;
  const tag =
    entry.source === 'tm'
      ? t('detail.learnTm', { tm: tmNumber(entry.tmId ?? '') ?? '?' })
      : entry.source === 'tutor'
        ? t('detail.learnTutor')
        : t('detail.learnLevel', { level: entry.level ?? '?' });
  return {
    name: `${moveName(entry.moveId)}  ${tag}`,
    type: move ? abilityMoveType(ability, move, ivs) : '',
    category: move?.category ?? 'Status',
    pp: move?.pp ?? 0,
    maxPp: move?.pp ?? 0,
    desc: moveShortDescription(entry.moveId),
    power: basePower,
    basePower,
    accuracy,
    baseAccuracy: accuracy,
    status: move?.status ?? null,
    enabled: true,
  };
}

/** Draws the search field and the scrolled learnset pool under the moves grid. */
function refreshLearnset(host: RoutePanelHost, ability: string, moves: boolean): void {
  const pad = FRLG_WINDOW_PADDING;
  const gridTop = hudDetailY + HUD_DETAIL_CONTENT_TOP - HUD_PAD_TOP;
  const searchX = hudDetailX + pad.x;
  const searchY = gridTop + HUD_DETAIL_MOVE_GRID_H + HUD_DETAIL_LEARN_GAP;
  const searchW = host.hud().detailW - pad.x * 2;
  hudSearchRect = { x: searchX, y: searchY, w: searchW, h: HUD_SEARCH_H };
  hudSearchBg.setPosition(searchX, searchY).setSize(searchW, HUD_SEARCH_H).setVisible(moves);
  const placeholder =
    hudSearchFocus || hudLearnQuery.length > 0 ? hudLearnQuery : t('detail.searchMoves');
  hudSearchText
    .setText(`${hudSearchFocus ? '>' : ' '} ${placeholder}`)
    .setTint(hudLearnQuery.length === 0 && !hudSearchFocus ? FRLG_MUTED : FRLG_INK)
    .setPosition(searchX + 6, searchY + 4)
    .setMaxWidth(searchW - 78)
    .setVisible(moves);

  const pool = moves ? learnPool(host) : [];
  const memberIvs = detailMember(host)?.fighter.ivs;
  const maxTop = maxScrollTop(pool.length, HUD_DETAIL_LEARN_COLS, HUD_DETAIL_LEARN_ROWS);
  hudLearnScrollTop = clampScrollTop(hudLearnScrollTop, maxTop);
  const { start, end } = visibleRange(
    hudLearnScrollTop,
    HUD_DETAIL_LEARN_COLS,
    HUD_DETAIL_LEARN_ROWS,
    pool.length,
  );
  hudLearnWindow = pool.slice(start, end);
  const learnTop = searchY + HUD_SEARCH_H + HUD_DETAIL_LEARN_GAP;
  const learnH = hudDetailY + HUD_DETAIL_H - learnTop;
  hudLearnRect = moves
    ? { x: hudDetailX, y: learnTop, w: host.hud().detailW, h: learnH }
    : { x: 0, y: 0, w: 0, h: 0 };
  hudLearnGrid.layout({
    x: hudDetailX,
    y: learnTop,
    w: host.hud().detailW,
    h: learnH,
    cells: hudLearnWindow.map((entry) => learnCell(entry, ability, memberIvs)),
    selected: moves ? learnWindowCursor() : -1,
    info: moves && hudDetailInfo?.grid === 'learn' ? hudDetailInfo.index : null,
    popupAtCell: true,
  });

  // The pool spans the full window; its scroll arrows ride the search row,
  // right-aligned, so the grid keeps the whole width.
  const navY = searchY + 4;
  const navRight = searchX + searchW - 10;
  const showNav = moves && maxTop > 0;
  hudLearnPrev
    .setPosition(navRight - 56, navY)
    .setAlpha(hudLearnScrollTop > 0 ? 1 : 0.35)
    .setVisible(showNav);
  hudLearnNext
    .setPosition(navRight, navY)
    .setAlpha(hudLearnScrollTop < maxTop ? 1 : 0.35)
    .setVisible(showNav);
  hudLearnEmpty
    .setPosition(hudDetailX + host.hud().detailW / 2, learnTop + Math.max(0, learnH / 2 - 8))
    .setVisible(moves && pool.length === 0);
}

/**
 * Lays the STATS tab's nickname field out for the open member and fills it from
 * the edit buffer: the box under the name text, the name row's own text (with a
 * `>` mark while it is being edited, like the learnset search field) and the
 * `click to name` hint at the box's right end. Drawing never ends an edit: the
 * buffer and the focus flag are read here, never written.
 */
function refreshNicknameField(host: RoutePanelHost, detail: MemberDetail | null, editable = true): void {
  const x = hudDetailX + HUD_CONTENT_LEFT - 4;
  hudNicknameRect = {
    x,
    y: hudDetailY + HUD_NICKNAME_FIELD_TOP,
    w: Math.max(
      HUD_NICKNAME_MIN_W,
      hudDetailX + host.hud().detailW - host.hud().detailPadX - HUD_NICKNAME_LEVEL_W - x,
    ),
    h: HUD_NICKNAME_FIELD_H,
  };
  const show = hudDetailState.tab === 'stats' && detail !== null && editable;
  hudNicknameBg
    .setPosition(hudNicknameRect.x, hudNicknameRect.y)
    .setSize(hudNicknameRect.w, hudNicknameRect.h)
    .setVisible(show);
  hudDetailName
    .setText(hudNicknameFocus ? `>${hudNicknameEdit ?? ''}` : (detail?.name ?? ''))
    .setMaxWidth(hudNicknameRect.w - 4);
  hudDetailNameHint
    .setPosition(hudNicknameRect.x + hudNicknameRect.w - 6, hudNicknameRect.y + 3)
    .setVisible(show && !hudNicknameFocus);
}

/**
 * True when the pointer is on the nickname field's rectangle (STATS tab only).
 */
function nicknameRowAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (hudDetailState.tab !== 'stats') return false;
  if (deadDetail(host)) return false;
  return pointInRect(panelPoint(host, pointer, 'detail'), hudNicknameRect);
}

/** Focuses the nickname field and seeds it with the name the row shows. */
function beginNicknameEdit(host: RoutePanelHost): void {
  const memberId = hudDetailState.memberId;
  if (memberId === null) return;
  if (deadDetail(host)) return;
  const detail = memberDetail(host.run(), memberId);
  if (!detail) return;
  unpinAbilityInfo(host);
  hudNicknameEdit = detail.nickname ?? detail.name;
  hudNicknameFocus = true;
  hudSearchFocus = false;
  refreshDetail(host);
}

/**
 * Enter: the pure `normalizeNickname` decides the stored text and `renameMember`
 * the run, so the panel never re-implements the rule. The save follows only when
 * the run object actually changed.
 */
function commitNicknameEdit(host: RoutePanelHost): void {
  const memberId = hudDetailState.memberId;
  const text = hudNicknameEdit;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  if (memberId !== null && text !== null) {
    const run = host.run();
    const next = renameMember(run, memberId, normalizeNickname(text));
    if (next !== run) host.commitRun(next);
  }
  refreshDetail(host);
  host.refreshHud();
}

/** Escape, a press elsewhere, a tab switch, closing the panel, a battle: no write. */
export function cancelNicknameEdit(host: RoutePanelHost): void {
  if (!hudNicknameFocus && hudNicknameEdit === null) return;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  refreshDetail(host);
}

/**
 * The nickname field's key router: it consumes **every** key while the field is
 * focused, so nothing typed reaches the game underneath. Characters and
 * Backspace work in code points, Enter commits and Escape cancels.
 */
export function typeInNickname(host: RoutePanelHost, event: KeyboardEvent): boolean {
  if (!hudNicknameFocus) return false;
  if (event.key === 'Enter') {
    event.preventDefault();
    commitNicknameEdit(host);
    return true;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelNicknameEdit(host);
    return true;
  }
  if (event.key === 'Backspace') {
    hudNicknameEdit = [...(hudNicknameEdit ?? '')].slice(0, -1).join('');
  } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
    const points = [...(hudNicknameEdit ?? ''), event.key];
    if (points.length <= NICKNAME_MAX_LENGTH) hudNicknameEdit = points.join('');
  }
  event.preventDefault();
  refreshDetail(host);
  return true;
}

/** True while the detail panel's nickname or learnset field owns the keyboard. */
export function detailTextFieldFocused(): boolean {
  return hudNicknameFocus || hudSearchFocus;
}

/**
 * Draws `value` in `text`, shortened with an ellipsis when it would pass `limit`: the
 * canvas has no text-overflow, and a name that runs under the row's level (or stone)
 * is unreadable, so it is cut to the space the right column leaves free.
 */
function clampDrawnName(text: Phaser.GameObjects.BitmapText, value: string, limit: number): void {
  text.setText(value);
  if (text.width <= limit) return;
  let end = value.length - 1;
  while (end > 0 && text.setText(`${value.slice(0, end)}…`).width > limit) end -= 1;
  text.setText(end > 0 ? `${value.slice(0, end)}…` : '');
}

/**
 * Paints the STATS tab's evolution graph from the member's family: the base
 * form down to every branch, indented by stage, with each edge's level. The
 * current species reads gold and a ready branch green and clickable; a branch
 * whose level is unmet stays grey until it is.
 */
function refreshDetailEvolutions(host: RoutePanelHost, stats: boolean, detail: MemberDetail): void {
  const graphics = hudDetailEvoGraphics;
  hudDetailEvoTitle.setVisible(stats);
  graphics.clear();
  const nodes = stats ? detail.evolutions.slice(0, HUD_DETAIL_EVO_MAX) : [];
  const show = stats && nodes.length > 0;
  hudDetailEvoEmpty.setVisible(stats && nodes.length === 0);
  hudDetailEvoHint.setVisible(stats && nodes.some((node) => node.ready));
  graphics.setVisible(show);

  const left = hudDetailX + host.hud().detailPadX;
  const right = hudDetailX + host.hud().detailW - host.hud().detailPadX;
  const top = hudDetailY + HUD_DETAIL_EVO_TOP;
  const rowY = (row: number): number => top + row * HUD_DETAIL_EVO_ROW_H;

  // Edges first, so the nodes' backgrounds paint over the seams.
  if (show) {
    graphics.lineStyle(2, HUD_DETAIL_EVO_LINE, 1);
    nodes.forEach((node) => {
      if (node.parent === null) return;
      const parent = nodes[node.parent];
      if (!parent) return;
      const spineX = left + parent.depth * HUD_DETAIL_EVO_INDENT + 13;
      const parentY = rowY(parent.row) + HUD_DETAIL_EVO_ROW_H / 2;
      const childY = rowY(node.row) + HUD_DETAIL_EVO_ROW_H / 2;
      const childX = left + node.depth * HUD_DETAIL_EVO_INDENT - 2;
      graphics.lineBetween(spineX, parentY, spineX, childY);
      graphics.lineBetween(spineX, childY, childX, childY);
    });
  }

  hudDetailEvoCells.forEach((cell, i) => {
    const node = nodes[i] ?? null;
    cell.node = node;
    cell.bg
      .setVisible(false)
      .setFillStyle(FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha);
    const visible = show && node !== null;
    cell.name.setVisible(visible);
    cell.level.setVisible(visible);
    cell.portrait.setVisible(visible);
    if (!node) return;
    const nodeX = left + node.depth * HUD_DETAIL_EVO_INDENT;
    const y = rowY(node.row);
    const width = right - nodeX;
    cell.rect = { x: nodeX, y, w: width, h: HUD_DETAIL_EVO_ROW_H - 2 };
    cell.bg.setPosition(nodeX, y).setSize(width, cell.rect.h);
    cell.portrait.setPosition(nodeX + 13, y + HUD_DETAIL_EVO_ROW_H / 2);
    const portrait = portraitFor(node.id);
    cell.portrait.setVisible(visible && portrait !== null);
    if (portrait) cell.portrait.setTexture(portrait.key, portrait.frame);
    cell.name.setPosition(nodeX + 30, y + 6);
    const note = evolutionRowNote(node);
    cell.level.setText(note);
    clampDrawnName(cell.name, node.name, width - 30 - levelColumnWidth(note));

    if (node.ready) {
      cell.bg.setVisible(true).setFillStyle(FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha);
      cell.name.setTint(HUD_DETAIL_EVO_READY);
      cell.level.setTint(HUD_DETAIL_EVO_READY);
    } else if (node.current) {
      cell.bg
        .setVisible(true)
        .setFillStyle(FRLG_SELECTED_FILL.colour, FRLG_SELECTED_FILL.alpha)
        .setStrokeStyle(1, FRLG_SELECTED_STROKE.colour, FRLG_SELECTED_STROKE.alpha);
      cell.name.setTint(HUD_DETAIL_EVO_CURRENT);
      cell.level.setTint(HUD_DETAIL_EVO_CURRENT);
    } else {
      cell.name.setTint(FRLG_INK);
      cell.level.setTint(FRLG_MUTED);
    }
  });
}

/**
 * Fills the detail panel from the run and shows the active tab, or hides it
 * when no member is open (or the member has left the run).
 */
export function refreshDetail(host: RoutePanelHost): void {
  if (DOM_HUD) {
    pushDomView(host);
    return;
  }
  if (!hudDetail) return;
  // A collapsed window never holds the keyboard: the collapse repaint lands here.
  if (!panelExpanded(host, 'detail')) {
    hudNicknameFocus = false;
    hudNicknameEdit = null;
  }
  const panel = panelById(host, 'detail');
  const memberId = hudDetailState.memberId;
  const detail = memberId === null ? null : memberDetail(host.run(), memberId);
  if (!detail) {
    // The member left the run: the panel hides and the field gives up its buffer.
    hudNicknameFocus = false;
    hudNicknameEdit = null;
    hudDetailState = CLOSED_DETAIL;
    if (panel) panel.container.setVisible(false);
    refreshNicknameField(host, null);
    return;
  }
  const dead = deadDetail(host);
  // The panel decides whether it is on screen; the body follows its state.
  hudDetail.setVisible(panel?.expanded ?? true);
  if (panel) panel.container.setVisible(true);
  hudDetailName.setText(detail.name);
  hudDetailLevel.setText(t('common.level', { level: detail.level }));
  const detailStatus = detail.status ? statusIconFrame(detail.status) : null;
  hudDetailStatus.setVisible(detailStatus !== null);
  if (detailStatus !== null) {
    hudDetailStatus
      .setFrame(detailStatus)
      .setPosition(hudDetailName.x + hudDetailName.width + 6, hudDetailName.y + 1);
  }
  hudDetailTypes.forEach((chip, i) => {
    const type = detail.types[i];
    chip.bg.setVisible(type !== undefined);
    chip.label.setVisible(type !== undefined);
    if (type === undefined) {
      chip.label.setText('');
      return;
    }
    const colour = typeColor(type);
    chip.bg.setFillStyle(colour);
    chip.label.setTint(badgeInkFor(colour));
    chip.label.setText(type.toUpperCase());
  });
  hudDetailTabs.forEach((tab) => {
    const active = tab.tab === hudDetailState.tab;
    paintTab(tab.bg, active);
    tab.label.setTint(active ? FRLG_ACCENT : FRLG_INK);
  });

  const stats = hudDetailState.tab === 'stats';
  const { rows, nature, ability, held, caught } = hudDetailStats;
  rows.forEach((row) => {
    row.label.setVisible(stats);
    row.value.setVisible(stats);
    row.value.setText(
      row.stat === 'hp' ? `${detail.hp}/${detail.maxHp}` : String(detail.stats[row.stat]),
    );
    // Paint the stat a nature raises green and the one it lowers red; HP and a
    // neutral stat keep the normal ink.
    const effect = natureEffect(detail.nature, row.stat);
    const tint = effect === 'up' ? NATURE_UP_TINT : effect === 'down' ? NATURE_DOWN_TINT : FRLG_INK;
    row.value.setTint(tint);
    if (effect !== 'neutral') row.label.setTint(tint);
  });
  nature.setText(t('detail.nature', { nature: capitalize(detail.nature) }));
  // The ABILITY row prints both slots joined by ` / ` (`Task-153`'s granted one, or a
  // dark member's rolled ability); the ⓘ beside it keeps explaining the primary.
  const second = detail.ability2 ?? null;
  ability.setText(
    t('detail.ability', {
      ability: second === null ? detail.ability : `${detail.ability} / ${second}`,
    }),
  );
  held.setText(t('detail.held', { held: detail.heldItemName ?? t('detail.none') }));
  caught.setText(t('detail.caughtLabel', { caught: detail.caughtLabel ?? t('detail.starter') }));
  nature.setVisible(stats);
  ability.setVisible(stats);
  held.setVisible(stats);
  caught.setVisible(stats);
  // The ABILITY row carries the same ⓘ a move cell does: the STATS tab shows it
  // and the window floats the ability's own text.
  if (stats && detail.abilityDesc !== null) {
    hudAbilityInfoButton.layout(
      abilityInfoSpot(ability.x + ability.width, ability.y),
      hudAbilityInfo,
      abilityInfoContent(detail.ability, detail.abilityDesc),
    );
  } else {
    hudAbilityInfoButton.hide();
  }
  refreshDetailEvolutions(host, stats && !dead, detail);

  const moves = hudDetailState.tab === 'moves';
  hudDetailEmpty.setVisible(moves && detail.moves.length === 0);
  // The MOVES tab is the shared battle move grid, drawn inside the panel's
  // container so it rides the panel when it is dragged. The info popup floats
  // over the grid for the hovered / pinned move.
  const gridTop = hudDetailY + HUD_DETAIL_CONTENT_TOP - HUD_PAD_TOP;
  const moveCells: MoveGridCell[] = moves
    ? detail.moves.map((move) => ({
        name: move.name,
        type: move.type,
        category: move.category,
        pp: move.pp,
        maxPp: move.maxPp,
        desc: move.desc,
        power: move.power,
        basePower: move.basePower,
        accuracy: move.accuracy,
        baseAccuracy: move.baseAccuracy,
        status: move.status,
        enabled: true,
      }))
    : [];
  hudMoveGrid.layout({
    x: hudDetailX,
    y: gridTop,
    w: host.hud().detailW,
    h: HUD_DETAIL_MOVE_GRID_H,
    cells: moves ? padMoveGridCells(moveCells, detail.moves.length === 0 ? 0 : MAX_MOVES) : [],
    selected: moves ? detailSlotCursor() : -1,
    info: moves && hudDetailInfo?.grid === 'moves' ? hudDetailInfo.index : null,
    popupAtCell: true,
  });

  refreshLearnset(host, detail.ability, moves && !dead);
  refreshNicknameField(host, detail, !dead);
}

/** "serious" -> "Serious", for the nature line. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/** True when a point falls inside a rect, for the detail panel's hit tests. */
function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
  );
}

/** True when the pointer is over the open detail panel. */
export function pointerInDetailPanel(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (DOM_HUD) return false;
  if (hudDetailState.memberId === null || !panelExpanded(host, 'detail')) return false;
  const point = panelPoint(host, pointer, 'detail');
  return (
    point.x >= hudDetailX &&
    point.x <= hudDetailX + host.hud().detailW &&
    point.y >= hudDetailY &&
    point.y <= hudDetailY + HUD_DETAIL_H
  );
}

/** The detail tab under the pointer, or null. */
function detailTabAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): DetailTab | null {
  if (!pointerInDetailPanel(host, pointer)) return null;
  const point = panelPoint(host, pointer, 'detail');
  const tab = hudDetailTabs.find(
    (entry) =>
      point.x >= entry.bg.x &&
      point.x <= entry.bg.x + entry.bg.width &&
      point.y >= entry.bg.y &&
      point.y <= entry.bg.y + entry.bg.height,
  );
  return tab?.tab ?? null;
}

/** The ready evolution branch under a panel-local point, or null. */
function evolutionAt(point: { x: number; y: number }): FamilyNode | null {
  for (const cell of hudDetailEvoCells) {
    if (cell.node?.ready && pointInRect(point, cell.rect)) return cell.node;
  }
  return null;
}

/**
 * Evolves the open member into the clicked branch (the STATS tab), saves and
 * redraws, then announces it on the popup. `evolveMember` re-checks the level,
 * so a stale click is a no-op.
 */
function evolveOpenMember(host: RoutePanelHost, into: string): void {
  const memberId = hudDetailState.memberId;
  if (memberId === null) return;
  const run = host.run();
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  if (!member) return;
  const name =
    member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId;
  const next = evolveMember(run, memberId, into);
  if (next === run) return;
  host.commitRun(next);
  showEvoPopup(host, name, getSpecies(into)?.name ?? into);
}

/** The move index under the pointer in the MOVES tab, or null outside a cell. */
function detailMoveIndexAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): number | null {
  if (!pointerInDetailPanel(host, pointer) || hudDetailState.tab !== 'moves') return null;
  const point = panelPoint(host, pointer, 'detail');
  return hudMoveGrid.indexAt(point.x, point.y);
}

/** The move cell under the pointer and whether it lands on that cell's ⓘ button. */
function detailInfoAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): DetailInfoHit | null {
  const index = detailMoveIndexAt(host, pointer);
  if (index === null) return null;
  const point = panelPoint(host, pointer, 'detail');
  const rect = hudMoveGrid.cellRect(index);
  const onInfo = rect !== null && hudMoveGrid.infoAt(index, point.x - rect.x, point.y - rect.y);
  return { grid: 'moves', index, onInfo };
}

/** The band's cell under the pointer and whether it lands on that cell's ⓘ button. */
function detailLearnInfoAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): DetailInfoHit | null {
  if (!pointerInDetailPanel(host, pointer) || hudDetailState.tab !== 'moves') return null;
  const point = panelPoint(host, pointer, 'detail');
  const index = hudLearnGrid.indexAt(point.x, point.y);
  if (index === null) return null;
  const rect = hudLearnGrid.cellRect(index);
  const onInfo = rect !== null && hudLearnGrid.infoAt(index, point.x - rect.x, point.y - rect.y);
  return { grid: 'learn', index, onInfo };
}

/**
 * True when the pointer is over the STATS tab's ability ⓘ. The panel container
 * sits at the origin with no scale, so its own point is the button's frame.
 */
function abilityInfoAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!pointerInDetailPanel(host, pointer)) return false;
  const point = panelPoint(host, pointer, 'detail');
  return hudAbilityInfoButton.contains(point.x, point.y);
}

/** Floats or hides the info popup as the pointer moves over a cell's ⓘ button. */
function updateDetailInfo(host: RoutePanelHost, cell: DetailInfoHit | null): void {
  if (hudDetailInfoPinned) return;
  const next: DetailInfoTarget | null =
    cell?.onInfo === true ? { grid: cell.grid, index: cell.index } : null;
  const current = hudDetailInfo;
  const same =
    next === null || current === null
      ? next === current
      : next.grid === current.grid && next.index === current.index;
  if (same) return;
  hudDetailInfo = next;
  refreshDetail(host);
}

/** Pins the popup of a move's ⓘ open, or closes it when it is already pinned. */
function toggleDetailInfo(host: RoutePanelHost, target: DetailInfoTarget): void {
  const current = hudDetailInfo;
  if (
    hudDetailInfoPinned &&
    current !== null &&
    current.grid === target.grid &&
    current.index === target.index
  ) {
    hudDetailInfoPinned = false;
    hudDetailInfo = null;
  } else {
    hudDetailInfoPinned = true;
    hudDetailInfo = target;
  }
  refreshDetail(host);
}

/** Floats or hides the ability ⓘ window as the pointer moves on and off it. */
function updateAbilityInfo(host: RoutePanelHost, over: boolean): void {
  if (hudAbilityInfoPinned) return;
  if (over === hudAbilityInfo) return;
  hudAbilityInfo = over;
  refreshDetail(host);
}

/** Pins the ability ⓘ window open, or closes it when it is already pinned. */
function toggleAbilityInfo(host: RoutePanelHost): void {
  if (hudAbilityInfoPinned) {
    hudAbilityInfoPinned = false;
    hudAbilityInfo = false;
  } else {
    hudAbilityInfoPinned = true;
    hudAbilityInfo = true;
  }
  refreshDetail(host);
}

/** Drops the ability window and its pin, e.g. when a press lands elsewhere. */
function unpinAbilityInfo(host: RoutePanelHost): void {
  if (!hudAbilityInfoPinned) return;
  hudAbilityInfoPinned = false;
  hudAbilityInfo = false;
  refreshDetail(host);
}

/** Drops the info popup and its pin, e.g. when the panel closes or changes tab. */
function resetDetailInfo(): void {
  hudDetailInfo = null;
  hudDetailInfoPinned = false;
  hudAbilityInfo = false;
  hudAbilityInfoPinned = false;
}

/** Hides an unpinned info popup when the pointer leaves the canvas. */
export function clearDetailInfo(host: RoutePanelHost): void {
  if (!hudDetailInfoPinned && hudDetailInfo !== null) {
    hudDetailInfo = null;
    refreshDetail(host);
  }
  if (!hudAbilityInfoPinned && hudAbilityInfo) {
    hudAbilityInfo = false;
    refreshDetail(host);
  }
}

/**
 * Drops the band's info state when the band's window is rebuilt with different
 * entries: the target is an index into `hudLearnWindow`, so an index that
 * survives a scroll would name another move. The caller redraws right after.
 */
function dropLearnInfo(): void {
  if (hudDetailInfo?.grid !== 'learn') return;
  hudDetailInfo = null;
  hudDetailInfoPinned = false;
}

/** The pool scroll arrow under a panel-local point, or null. */
function learnNavAt(point: { x: number; y: number }): 'prev' | 'next' | null {
  const hit = (text: Phaser.GameObjects.BitmapText): boolean =>
    text.visible && Math.abs(point.x - text.x) <= 16 && Math.abs(point.y - (text.y + 8)) <= 16;
  if (hit(hudLearnPrev)) return 'prev';
  if (hit(hudLearnNext)) return 'next';
  return null;
}

/** Moves the pool window `deltaRows` rows (clamped) and redraws when it moved. */
export function scrollLearnset(host: RoutePanelHost, deltaRows: number): void {
  const next = scrollByRows(hudLearnScrollTop, deltaRows, maxLearnScrollTop(host));
  if (next === hudLearnScrollTop) return;
  hudLearnScrollTop = next;
  dropLearnInfo();
  refreshDetail(host);
}

/** True when the pointer is over the MOVES tab's learnset band. */
export function pointerInLearnBand(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (DOM_HUD) return false;
  if (hudDetailState.tab !== 'moves' || !panelExpanded(host, 'detail')) return false;
  return pointInRect(panelPoint(host, pointer, 'detail'), hudLearnRect);
}

/** The drawn pitch between two pool rows, read off the laid-out grid. */
function learnRowPitch(): number {
  const first = hudLearnGrid.cellRect(0);
  const second = hudLearnGrid.cellRect(HUD_DETAIL_LEARN_COLS);
  if (!first || !second || second.y <= first.y) return 0;
  return second.y - first.y;
}

/** Starts a scroll drag from the band's background at a panel-local point. */
function startLearnScrollDrag(host: RoutePanelHost, point: { x: number; y: number }): void {
  hudLearnScrollDrag = {
    startY: point.y,
    startTop: hudLearnScrollTop,
    rowPitch: learnRowPitch(),
  };
  host.scene.input.setDefaultCursor('grabbing');
}

/**
 * Drags the pool window by whole rows: dragging down moves it towards the top
 * of the list and dragging up moves it down the list.
 */
function updateLearnScrollDrag(host: RoutePanelHost, pointer: Phaser.Input.Pointer): void {
  const drag = hudLearnScrollDrag;
  if (!drag || drag.rowPitch <= 0) return;
  const point = panelPoint(host, pointer, 'detail');
  const deltaRows = Math.round((point.y - drag.startY) / drag.rowPitch);
  const next = clampScrollTop(drag.startTop - deltaRows, maxLearnScrollTop(host));
  if (next === hudLearnScrollTop) return;
  hudLearnScrollTop = next;
  dropLearnInfo();
  refreshDetail(host);
}

/** Ends a scroll drag and restores the cursor. */
function endLearnScrollDrag(host: RoutePanelHost): void {
  if (!hudLearnScrollDrag) return;
  hudLearnScrollDrag = null;
  host.scene.input.setDefaultCursor('default');
}

/**
 * Picks a pool move up so it can be dropped onto a slot: its name chip rides the
 * pointer until the release lands on a slot.
 */
function startLearnDrag(host: RoutePanelHost, moveId: string, pointer: Phaser.Input.Pointer): void {
  hudLearnDrag = moveId;
  setGrabMoved(false);
  hudLearnGhost.setText(moveName(moveId)).setPosition(pointer.x, pointer.y).setVisible(true);
  host.scene.input.setDefaultCursor('grabbing');
  refreshDetail(host);
}

/** Clears the pool drag without equipping anything. */
function resetLearnDrag(): void {
  hudLearnDrag = null;
  hudLearnGhost.setVisible(false);
}

/** Ends a learnset drag: hides the ghost and restores the cursor. */
function endLearnDrag(host: RoutePanelHost): void {
  if (hudLearnDrag === null && hudLearnGhost?.visible !== true) return;
  resetLearnDrag();
  setGrabMoved(false);
  host.scene.input.setDefaultCursor('default');
}

/**
 * Routes a key into the learnset search field while it holds focus: letters and
 * digits filter the pool, Backspace and Escape edit or leave the field. Returns
 * true when the key was consumed, so it never drives the game underneath.
 */
export function typeInDetailSearch(host: RoutePanelHost, event: KeyboardEvent): boolean {
  if (!hudSearchFocus) return false;
  if (event.key === 'Escape' || event.key === 'Enter') {
    hudSearchFocus = false;
  } else if (event.key === 'Backspace') {
    if (hudLearnQuery.length === 0) return true;
    hudLearnQuery = hudLearnQuery.slice(0, -1);
    hudLearnScrollTop = 0;
    dropLearnInfo();
  } else if (event.key.length === 1 && /[a-z0-9 '-]/i.test(event.key)) {
    hudLearnQuery += event.key;
    hudLearnScrollTop = 0;
    dropLearnInfo();
  } else {
    return true;
  }
  event.preventDefault();
  refreshDetail(host);
  return true;
}

/**
 * Opens the detail panel on `memberId`, keeping the tab the panel already stands on
 * (STATS when it was closed), and draws it. Opening a member always shows the
 * window, even if it was left collapsed.
 */
export function openMemberDetail(host: RoutePanelHost, memberId: string): void {
  const panel = panelById(host, 'detail');
  if (panel && !panel.expanded) {
    panel.expanded = true;
    hudDetail?.setVisible(true);
  }
  hudDetailState = openDetail(memberId, carriedDetailTab(hudDetailState));
  resetDetailInfo();
  hudLearnScrollTop = 0;
  hudLearnQuery = '';
  hudSearchFocus = false;
  hudDetailCursor = -1;
  hudPoolCursor = -1;
  cancelNicknameEdit(host);
  endLearnDrag(host);
  refreshDetail(host);
  // The first open docks the panel beside the PC box; after that it stays
  // wherever the player dragged it.
  dockDetailPanelOnce(host);
}

/** Closes the detail panel and repaints the HUD behind it. */
export function closeMemberDetail(host: RoutePanelHost): void {
  if (hudDetailState.memberId === null) return;
  hudDetailState = closeDetail(hudDetailState);
  resetDetailInfo();
  cancelNicknameEdit(host);
  endLearnDrag(host);
  refreshDetail(host);
  host.refreshHud();
}

/**
 * A press inside the panel: focus the search field, scroll the learnset pool,
 * pick a pool move up to drag it onto a slot, switch tab, toggle a move's ⓘ
 * info popup, or pick a slot move up to reorder it. Returns false when the
 * press landed on an empty spot (no control), so the caller can move the panel.
 */
function handleDetailPointerDown(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  const point = panelPoint(host, pointer, 'detail');
  // The scroll arrows ride the search row, so they are tested before the field.
  const nav = learnNavAt(point);
  if (nav !== null) {
    hudSearchFocus = false;
    cancelNicknameEdit(host);
    scrollLearnset(host, nav === 'prev' ? -1 : 1);
    return true;
  }
  if (pointInRect(point, hudSearchRect)) {
    hudSearchFocus = true;
    refreshDetail(host);
    return true;
  }
  hudSearchFocus = false;
  // Any other press inside the panel leaves both text fields - except a press on
  // the nickname field itself, which keeps its edit (and its typed text) going.
  if (!nicknameRowAt(host, pointer)) cancelNicknameEdit(host);
  const tab = detailTabAt(host, pointer);
  if (tab !== null) {
    hudDetailState = setDetailTab(hudDetailState, tab);
    resetLearnDrag();
    resetDetailInfo();
    refreshDetail(host);
    return true;
  }
  if (hudDetailState.tab === 'stats') {
    // The ability ⓘ comes first: a press on it never starts the rename field and
    // never evolves the member.
    if (abilityInfoAt(host, pointer)) {
      toggleAbilityInfo(host);
      return true;
    }
    // The name row is the editable field: a press focuses it (or keeps it focused),
    // and never falls through to the panel drag or the evolution rows.
    if (nicknameRowAt(host, pointer)) {
      if (!hudNicknameFocus) beginNicknameEdit(host);
      return true;
    }
    // Any other press in the panel drops the ability window's pin.
    unpinAbilityInfo(host);
    const evolution = evolutionAt(point);
    if (evolution) {
      evolveOpenMember(host, evolution.id);
      return true;
    }
    return false;
  }
  if (hudDetailState.tab !== 'moves') return false;
  const learnCellHit = detailLearnInfoAt(host, pointer);
  if (learnCellHit?.onInfo === true) {
    toggleDetailInfo(host, learnCellHit);
    return true;
  }
  const poolIndex = hudLearnGrid.indexAt(point.x, point.y);
  if (poolIndex !== null) {
    const entry = hudLearnWindow[poolIndex];
    if (entry) startLearnDrag(host, entry.moveId, pointer);
    return true;
  }
  // A press on the band's own background (its inset or the gutter between its
  // rows) starts a scroll drag, so it never moves the panel instead.
  if (pointerInLearnBand(host, pointer)) {
    startLearnScrollDrag(host, point);
    return true;
  }
  const cell = detailInfoAt(host, pointer);
  if (!cell) return false;
  if (cell.onInfo) {
    toggleDetailInfo(host, cell);
    return true;
  }
  if (deadDetail(host)) return true;
  if (hudMoveGrid.isEmpty(cell.index)) return true;
  hudDetailState = grabMove(hudDetailState, cell.index);
  setGrabMoved(false);
  refreshDetail(host);
  return true;
}

/** Lands a released learnset move on a slot, or just puts it down. */
function releaseLearnDrag(host: RoutePanelHost, pointer: Phaser.Input.Pointer): void {
  const moveId = hudLearnDrag;
  const slot = detailMoveIndexAt(host, pointer);
  const memberId = hudDetailState.memberId;
  endLearnDrag(host);
  if (moveId !== null && slot !== null && memberId !== null) {
    const run = host.run();
    const next = equipMove(run, memberId, moveId, slot, run.seed);
    if (next !== run) host.commitRun(next);
  }
  refreshDetail(host);
  host.refreshHud();
}

/** Drops or unequips the held slot move on release. */
function releaseMoveGrab(host: RoutePanelHost, pointer: Phaser.Input.Pointer): void {
  const memberId = hudDetailState.memberId;
  const run = host.run();
  if (memberId !== null && pointerInLearnBand(host, pointer)) {
    const next = unequipMove(run, memberId, hudDetailState.grab ?? -1);
    if (next !== run) host.commitRun(next);
    hudDetailState = dropMove(hudDetailState);
    refreshDetail(host);
    host.refreshHud();
    return;
  }
  hudDetailState = dropMove(hudDetailState);
  host.persistRun();
  refreshDetail(host);
}

/**
 * Lets go of whatever the detail panel is dragging without acting on the drop.
 * True when there was a drag to cancel.
 */
export function cancelDetailDrags(host: RoutePanelHost): boolean {
  if (hudLearnScrollDrag) {
    endLearnScrollDrag(host);
    return true;
  }
  if (hudLearnDrag !== null) {
    endLearnDrag(host);
    refreshDetail(host);
    return true;
  }
  if (hudDetailState.grab !== null) {
    hudDetailState = dropMove(hudDetailState);
    host.persistRun();
    refreshDetail(host);
    return true;
  }
  return false;
}

/** What the pointer is over inside the detail panel, for the route's hover cursor. */
export type DetailHover = Readonly<{
  overMove: boolean;
  overInfo: boolean;
  overAbilityInfo: boolean;
  overEvolution: boolean;
  overDetailName: boolean;
}>;

/**
 * Updates the floating info windows for the cell under the pointer and reports
 * what the route's hover cursor should read from the panel.
 */
export function detailHover(host: RoutePanelHost, pointer: Phaser.Input.Pointer): DetailHover {
  if (DOM_HUD) {
    return {
      overMove: false,
      overInfo: false,
      overAbilityInfo: false,
      overEvolution: false,
      overDetailName: false,
    };
  }
  const cell = detailInfoAt(host, pointer) ?? detailLearnInfoAt(host, pointer);
  updateDetailInfo(host, cell);
  const overAbilityInfo = abilityInfoAt(host, pointer);
  updateAbilityInfo(host, overAbilityInfo);
  const inside = hudDetailState.memberId !== null && pointerInDetailPanel(host, pointer);
  const point = panelPoint(host, pointer, 'detail');
  return {
    overMove: cell !== null,
    overInfo: cell?.onInfo === true,
    overAbilityInfo,
    // A ready evolution branch in the STATS tab reads as a click target too.
    overEvolution: inside && evolutionAt(point) !== null,
    // The name row is the rename field, so it reads as a click target as well.
    overDetailName: inside && nicknameRowAt(host, pointer),
  };
}

/** True while the level-up/evolution popup is up. */
export function learnPopupOpenNow(): boolean {
  return learnPopupOpen;
}

/** Dismisses the learn/evolution popup, unless it was just opened. */
export function dismissLearnPopup(host: RoutePanelHost): void {
  if (host.scene.time.now - learnPopupAt < 250) return;
  closeLearnPopup();
}

/** Dismisses the learn/evolution popup; safe when it is not up. */
export function closeLearnPopup(): void {
  if (!learnPopupOpen) return;
  learnPopupOpen = false;
  learnPopup.setVisible(false);
}

/** True while a member's detail window is open. */
export function detailOpen(): boolean {
  return hudDetailState.memberId !== null;
}

/** Shows the learn popup for the level-up beats, or stays hidden if none learned. */
export function showLearnPopup(host: RoutePanelHost, beats: readonly LevelUpBeat[]): void {
  if (learnPopupOpen) return;
  const lines: string[] = [];
  for (const beat of beats) {
    const member = host.run().party.find((entry) => entry.fighter.id === beat.id);
    const species = getSpecies(member?.fighter.speciesId ?? '');
    const name = member?.fighter.nickname ?? species?.name ?? t('common.unknownPokemon');
    for (const moveId of beat.learned) {
      lines.push(t('route.learned', { name, move: moveName(moveId) }));
    }
  }
  if (lines.length === 0) return;
  learnPopupTitle.setText(t('hud.learnTitle'));
  learnPopupBody.setText(lines.join('\n'));
  learnPopupOpen = true;
  learnPopupAt = host.scene.time.now;
  learnPopup.setVisible(true);
}

/**
 * Shows the evolution popup ("X evolved into Y!") on the same window the level
 * up uses; any key or a click dismisses it like the learn popup.
 */
function showEvoPopup(host: RoutePanelHost, fromName: string, intoName: string): void {
  if (learnPopupOpen) return;
  learnPopupTitle.setText(t('hud.evolveTitle'));
  learnPopupBody.setText(t('route.evolved', { from: fromName, into: intoName }));
  learnPopupOpen = true;
  learnPopupAt = host.scene.time.now;
  learnPopup.setVisible(true);
}

/** The centred window the level-up / evolution popup draws its lines on. */
function buildLearnPopup(host: RoutePanelHost): void {
  const scene = host.scene;
  const { width, height } = scene.scale;
  const panelW = 560;
  const panelH = 220;
  const x = (width - panelW) / 2;
  const y = (height - panelH) / 2;
  const scrim = scene.add.rectangle(0, 0, width, height, 0x05070c, 0.55).setOrigin(0, 0);
  const panel = addFrlgWindow(scene, x, y, panelW, panelH);
  learnPopupTitle = addFrlgText(scene, x + 24, y + 18, t('hud.learnTitle'), {
    size: 32,
    tint: FRLG_INK,
  });
  learnPopupBody = addFrlgText(scene, x + 24, y + 76, '', {
    size: 16,
    tint: FRLG_INK,
    lineSpacing: 8,
  }).setMaxWidth(panelW - 48);
  const hint = addFrlgText(scene, x + panelW - 24, y + panelH - 30, t('hud.pressAnyKey'), {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  const zone = scene.add.zone(0, 0, width, height).setOrigin(0, 0);
  zone.setInteractive();
  zone.on('pointerdown', () => dismissLearnPopup(host));
  learnPopup = scene.add
    .container(0, 0, [scrim, panel, learnPopupTitle, learnPopupBody, hint, zone])
    .setDepth(460)
    .setVisible(false);
  scene.cameras.main.ignore(learnPopup);
}

/** The member detail window: header, tabs, stats, evolutions and move grids. */
function buildDetailPanel(host: RoutePanelHost): Phaser.GameObjects.Container {
  const scene = host.scene;
  const { detailW, detailPadX } = host.hud();
  const x = Math.max(HUD_PANEL_MARGIN, boxLeft() - detailW - HUD_GAP);
  const y = boxTop();
  hudDetailX = x;
  hudDetailY = y;
  const left = x + detailPadX;
  const right = x + detailW - detailPadX;
  const innerW = detailW - detailPadX * 2;
  hudDetailWindow = addFrlgWindow(scene, x, y, detailW, HUD_DETAIL_H);
  const children: Phaser.GameObjects.GameObject[] = [hudDetailWindow];
  // The nickname field's box, in the header's name row. It is pushed first, so
  // it sits under the name text and rides the panel with everything else.
  hudNicknameBg = scene.add
    .rectangle(0, 0, 10, HUD_NICKNAME_FIELD_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
    .setOrigin(0, 0)
    .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
    .setVisible(false);
  children.push(hudNicknameBg);

  hudDetailName = addFrlgText(scene, x + HUD_CONTENT_LEFT, y + HUD_PAD_TOP, '', {
    size: 16,
    tint: FRLG_INK,
  });
  hudDetailLevel = addFrlgText(scene, right, y + HUD_PAD_TOP, '', {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  });
  // The hint sits at the field's right end; `refreshNicknameField` places it.
  hudDetailNameHint = addFrlgText(scene, right, y + HUD_PAD_TOP + 3, t('detail.clickToName'), {
    size: 16,
    tint: FRLG_MUTED,
    origin: [1, 0],
  }).setVisible(false);
  hudDetailStatus = scene.add
    .image(x + HUD_CONTENT_LEFT, y + HUD_PAD_TOP + 1, STATUS_ICON_TEXTURE_KEY, 0)
    .setOrigin(0, 0)
    .setScale(HUD_PARTY_STATUS_SCALE)
    .setVisible(false);
  children.push(hudDetailName, hudDetailNameHint, hudDetailLevel, hudDetailStatus);

  const chipY = y + HUD_PAD_TOP + 22;
  hudDetailTypes = [];
  for (let i = 0; i < 2; i++) {
    const chipX = left + i * (HUD_DETAIL_TYPE_W + 6);
    const bg = scene.add
      .rectangle(chipX, chipY, HUD_DETAIL_TYPE_W, 20, FRLG_MUTED)
      .setOrigin(0, 0)
      .setVisible(false);
    const label = addFrlgText(scene, chipX + HUD_DETAIL_TYPE_W / 2, chipY + 2, '', {
      size: 16,
      tint: FRLG_BADGE_INK,
      origin: [0.5, 0],
    }).setVisible(false);
    hudDetailTypes.push({ bg, label });
    children.push(bg, label);
  }

  const tabY = y + HUD_DETAIL_TABS_TOP;
  const tabW = (innerW - HUD_TAB_GAP) / 2;
  hudDetailTabs = [];
  (['stats', 'moves'] as DetailTab[]).forEach((tab, i) => {
    const tabX = left + i * (tabW + HUD_TAB_GAP);
    const bg = scene.add
      .rectangle(tabX, tabY, tabW, HUD_DETAIL_TAB_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0);
    const label = addFrlgText(
      scene,
      tabX + tabW / 2,
      tabY + 5,
      t(tab === 'stats' ? 'detail.tabStats' : 'detail.tabMoves'),
      { size: 16, tint: FRLG_INK, origin: [0.5, 0] },
    );
    hudDetailTabs.push({ tab, bg, label });
    children.push(bg, label);
  });

  const contentTop = y + HUD_DETAIL_CONTENT_TOP;
  // The six stats in two columns of three; the HP row prints current / max.
  const colW = innerW / HUD_DETAIL_STAT_COLS;
  const rows: {
    stat: StatId;
    label: Phaser.GameObjects.BitmapText;
    value: Phaser.GameObjects.BitmapText;
  }[] = [];
  HUD_DETAIL_STATS.forEach((column, ci) => {
    const colLeft = left + ci * colW;
    const colRight = colLeft + colW - 12;
    column.forEach((stat, ri) => {
      const rowY = contentTop + ri * HUD_DETAIL_STAT_ROW;
      const label = addFrlgText(scene, colLeft, rowY, statLabel(stat), { size: 16, tint: FRLG_MUTED });
      const value = addFrlgText(scene, colRight, rowY, '', {
        size: 16,
        tint: FRLG_INK,
        origin: [1, 0],
      });
      children.push(label, value);
      rows.push({ stat, label, value });
    });
  });
  const infoTop = contentTop + HUD_DETAIL_STAT_ROWS * HUD_DETAIL_STAT_ROW + 8;
  // NATURE / ABILITY in the left column, HELD / CAUGHT in the right.
  const infoColW = innerW / 2;
  const nature = addFrlgText(scene, left, infoTop, '', { size: 16, tint: FRLG_MUTED });
  const ability = addFrlgText(scene, left, infoTop + HUD_DETAIL_INFO_ROW, '', {
    size: 16,
    tint: FRLG_MUTED,
  });
  const held = addFrlgText(scene, left + infoColW, infoTop, '', { size: 16, tint: FRLG_MUTED });
  const caught = addFrlgText(scene, left + infoColW, infoTop + HUD_DETAIL_INFO_ROW, '', {
    size: 16,
    tint: FRLG_MUTED,
  });
  children.push(nature, ability, held, caught);
  hudDetailStats = { rows, nature, ability, held, caught };

  // The evolution band: a title over a family graph. The nodes are a fixed row
  // pool the refresh repositions by depth; `refreshDetail` also redraws the
  // edges. A click on a ready branch evolves the member.
  hudDetailEvoTitle = addFrlgText(scene, left, y + HUD_DETAIL_EVO_TITLE_TOP, t('detail.evolution'), {
    size: 16,
    tint: FRLG_INK,
  });
  hudDetailEvoHint = addFrlgText(scene, right, y + HUD_DETAIL_EVO_TITLE_TOP, t('detail.clickToEvolve'), {
    size: 16,
    tint: HUD_DETAIL_EVO_READY,
    origin: [1, 0],
  }).setVisible(false);
  hudDetailEvoEmpty = addFrlgText(
    scene,
    x + detailW / 2,
    y + HUD_DETAIL_EVO_TOP + 24,
    t('detail.noEvolution'),
    { size: 16, tint: FRLG_MUTED, origin: [0.5, 0] },
  );
  children.push(hudDetailEvoTitle, hudDetailEvoHint, hudDetailEvoEmpty);
  hudDetailEvoGraphics = scene.add.graphics();
  children.push(hudDetailEvoGraphics);
  hudDetailEvoCells = [];
  for (let i = 0; i < HUD_DETAIL_EVO_MAX; i++) {
    const rowY = y + HUD_DETAIL_EVO_TOP + i * HUD_DETAIL_EVO_ROW_H;
    const bg = scene.add
      .rectangle(left, rowY, innerW, HUD_DETAIL_EVO_ROW_H - 2, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
      .setOrigin(0, 0)
      .setVisible(false);
    const portrait = scene.add
      .image(left + 13, rowY + HUD_DETAIL_EVO_ROW_H / 2, PORTRAIT_TEXTURE_KEY, 0)
      .setScale(HUD_DETAIL_EVO_PORTRAIT_SCALE)
      .setVisible(false);
    const name = addFrlgText(scene, left + 30, rowY + 6, '', { size: 16, tint: FRLG_INK })
      .setMaxWidth(innerW - 96)
      .setVisible(false);
    const level = addFrlgText(scene, right, rowY + 6, '', {
      size: 16,
      tint: FRLG_MUTED,
      origin: [1, 0],
    }).setVisible(false);
    hudDetailEvoCells.push({
      node: null,
      rect: { x: left, y: rowY, w: innerW, h: HUD_DETAIL_EVO_ROW_H - 2 },
      bg,
      portrait,
      name,
      level,
    });
    children.push(bg, portrait, name, level);
  }

  hudDetailEmpty = addFrlgText(scene, x + detailW / 2, contentTop + 60, t('detail.noMoves'), {
    size: 16,
    tint: FRLG_MUTED,
    origin: [0.5, 0],
  });
  children.push(hudDetailEmpty);

  // The learnset band: a search field over the pool of learned moves and bag
  // TMs, scrolled one row of the 2x2 grid at a time. Its grid shares the moves
  // grid's look; the `<` / `>` pair rides the search row as a one-row scroll.
  hudSearchBg = scene.add
    .rectangle(0, 0, 10, HUD_SEARCH_H, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
    .setOrigin(0, 0)
    .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
    .setVisible(false);
  hudSearchText = addFrlgText(scene, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false);
  hudLearnPrev = addFrlgText(scene, 0, 0, '<', {
    size: 16,
    tint: FRLG_INK,
    origin: [0.5, 0],
  }).setVisible(false);
  hudLearnNext = addFrlgText(scene, 0, 0, '>', {
    size: 16,
    tint: FRLG_INK,
    origin: [0.5, 0],
  }).setVisible(false);
  hudLearnEmpty = addFrlgText(scene, 0, 0, t('detail.noMovesToLearn'), {
    size: 16,
    tint: FRLG_MUTED,
    origin: [0.5, 0],
  }).setVisible(false);
  children.push(hudSearchBg, hudSearchText, hudLearnPrev, hudLearnNext, hudLearnEmpty);

  const container = scene.add.container(0, 0, children).setVisible(false);
  // The shared moves grid — the same component the battle's FIGHT menu draws —
  // fills the MOVES tab, with its own floating info popup. The learnset pool is
  // a second instance drawn below the search field.
  hudMoveGrid = new MoveGrid(scene, container);
  hudLearnGrid = new MoveGrid(scene, container);
  // The ability row's ⓘ and the window it floats, built after the grids so the
  // window rides over them like the move popup does.
  hudAbilityPopup = new InfoPopup(scene, container);
  hudAbilityInfoButton = new AbilityInfoButton(scene, hudAbilityPopup, container);
  return container;
}

/**
 * A press: a press outside the panel leaves its two text fields (nothing else is
 * taken), a press inside is the panel's own controls.
 */
function pointerDown(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (!pointerInDetailPanel(host, pointer)) {
    // A press the frame layer owns (a panel drag, a collapse icon, a Pokevial drink)
    // leaves the fields focused, the way the shipped order did; any other press
    // outside the window takes them off the keyboard.
    if (hudPanelAt(host, pointer) || hudPanelIconAt(host, pointer) || vialButtonAt(host, pointer)) {
      return false;
    }
    if (hudSearchFocus) {
      hudSearchFocus = false;
      refreshDetail(host);
    }
    // A press outside the panel likewise ends an in-progress nickname edit.
    if (hudNicknameFocus) cancelNicknameEdit(host);
    return false;
  }
  if (hudDetailState.memberId === null) return false;
  return handleDetailPointerDown(host, pointer);
}

/** A move over the panel keeps its own drag (scroll band, pool chip, held move). */
function pointerMove(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (hudLearnScrollDrag) {
    updateLearnScrollDrag(host, pointer);
    return true;
  }
  // A learnset move rides the pointer until it is dropped on a slot.
  if (hudLearnDrag !== null) {
    hudLearnGhost.setPosition(pointer.x, pointer.y);
    host.scene.input.setDefaultCursor('grabbing');
    return true;
  }
  // A held move reorders live as the pointer crosses another cell; over the
  // learnset band it leaves the grid so the release can unequip it.
  if (hudDetailState.grab !== null) {
    const row = pointerInLearnBand(host, pointer) ? null : detailMoveIndexAt(host, pointer);
    if (row !== null) {
      const run = host.run();
      const next = reorderMoves(run, hudDetailState, row);
      if (next.run !== run || next.state !== hudDetailState) {
        hudDetailState = next.state;
        host.commitRun(next.run);
        refreshDetail(host);
      }
    }
    host.scene.input.setDefaultCursor('grabbing');
    return true;
  }
  return false;
}

/** A release ends the panel's own drag, acting on where it landed. */
function pointerUp(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (hudLearnScrollDrag) {
    endLearnScrollDrag(host);
    return true;
  }
  // A released learnset move equips into the slot it was dropped on, if any.
  if (hudLearnDrag !== null) {
    releaseLearnDrag(host, pointer);
    return true;
  }
  // A held move released on the learnset band is unequipped; anywhere else it
  // just drops where it last landed.
  if (hudDetailState.grab !== null) {
    releaseMoveGrab(host, pointer);
    return true;
  }
  return false;
}

function pointerAt(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
  if (pointerPhase() === 'down') return pointerDown(host, pointer);
  if (pointerPhase() === 'move') return pointerMove(host, pointer);
  return pointerUp(host, pointer);
}

/** The DOM card's viewport: the scene's own window, as the HUD metrics see it. */
function viewportOf(host: RoutePanelHost): { width: number; height: number } {
  return { width: host.scene.scale.width, height: host.scene.scale.height };
}

/** The number of display objects the detail window draws right now: 0 under `?hud=dom`. */
export function detailDrawnObjectCount(): number {
  if (DOM_HUD) return 0;
  return hudDetailBody?.list.length ?? 0;
}

/** The panel's own state, as the DOM card's pure view reads it. */
function domUi(): DetailPanelUi {
  return {
    tab: hudDetailState.tab,
    cursor: hudDetailCursor,
    page: hudLearnScrollTop * DETAIL_POOL_COLS,
    poolCursor: hudPoolCursor,
    info: hudDetailInfoPinned && hudDetailInfo?.grid === 'moves' ? hudDetailInfo.index : null,
    abilityInfo: hudAbilityInfoPinned,
    grab: hudDetailState.grab,
    nickname: hudNicknameEdit,
  };
}

/** One learnset pool row as the DOM card paints it: the shipped name and source tag. */
function learnRow(
  entry: LearnEntry,
  ability: string,
  ivs: Partial<Stats> | null | undefined,
): DetailPoolRow {
  const move = getMove(entry.moveId);
  const source =
    entry.source === 'tm'
      ? t('detail.learnTm', { tm: tmNumber(entry.tmId ?? '') ?? '?' })
      : entry.source === 'tutor'
        ? t('detail.learnTutor')
        : t('detail.learnLevel', { level: entry.level ?? '?' });
  return {
    moveId: entry.moveId,
    name: moveName(entry.moveId),
    type: move ? abilityMoveType(ability, move, ivs) : '',
    source,
    enabled: true,
  };
}

/** The member's panel data for the DOM: a fallen member has no branch to evolve into. */
function domDetail(host: RoutePanelHost, memberId: string): MemberDetail | null {
  const detail = memberDetail(host.run(), memberId);
  if (detail === null) return null;
  return deadDetail(host) ? { ...detail, evolutions: [] } : detail;
}

/** The one emit point of the DOM card: the scene owns the run, the card paints it. */
function pushDomView(host: RoutePanelHost): void {
  const view = domView;
  if (view === null) return;
  const memberId = hudDetailState.memberId;
  const detail = memberId === null ? null : domDetail(host, memberId);
  const member = detailMember(host);
  const pool =
    detail === null || member === undefined
      ? []
      : learnPool(host).map((entry) => learnRow(entry, detail.ability, member.fighter.ivs));
  const projected = detailPanelView(detail, pool, domUi(), viewportOf(host));
  view.value = {
    ...projected,
    open: projected.open && !domPaused && panelExpanded(host, 'detail'),
    search: { ...projected.search, value: hudLearnQuery },
  };
}

/** The route paused (a battle over it, or the Settings screen): the card follows. */
function setDomPaused(host: RoutePanelHost, paused: boolean): void {
  if (domPaused === paused) return;
  domPaused = paused;
  pushDomView(host);
}

/** Drops the scene's pause/resume subscription; the route is going away. */
function unsubscribeScene(): void {
  domUnsubscribeScene?.();
  domUnsubscribeScene = null;
  domPaused = false;
}

/** Subscribes the card to the route's own pause and resume beats. */
function subscribeScene(host: RoutePanelHost): void {
  unsubscribeScene();
  const events = host.scene.events;
  const onPause = (): void => setDomPaused(host, true);
  const onResume = (): void => setDomPaused(host, false);
  events.on(SCENE_PAUSE, onPause);
  events.on(SCENE_RESUME, onResume);
  domUnsubscribeScene = () => {
    events.off(SCENE_PAUSE, onPause);
    events.off(SCENE_RESUME, onResume);
  };
}

/**
 * The opener. Under the flag the party rows are DOM buttons that answer `party.ts`,
 * so the route's canvas pointer path never reaches `openMemberDetail`: one delegated
 * press on the `#hud` layer opens the member whose row was pressed, and nothing else.
 */
function installPartyOpener(host: RoutePanelHost, layer: Element): () => void {
  const onClick = (event: Event): void => {
    if (domPaused) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest('[data-hud-party-member]');
    if (row === null) return;
    const memberId = row.getAttribute('data-hud-party-member');
    if (memberId === null || memberId.length === 0) return;
    const run = host.run();
    const known = [...run.party, ...run.box, ...run.rip].some((entry) => entry.fighter.id === memberId);
    if (!known) return;
    openMemberDetail(host, memberId);
  };
  layer.addEventListener('click', onClick);
  return () => layer.removeEventListener('click', onClick);
}

function removePartyOpener(): void {
  domOpener?.();
  domOpener = null;
}

function disposeDomPanel(): void {
  removePartyOpener();
  if (domDispose === null) return;
  domDispose();
  domDispose = null;
}

/** A member's first free move slot, or the slot under the cursor, or the tail. */
function equipSlot(run: RunState, memberId: string): number {
  const member =
    run.party.find((entry) => entry.fighter.id === memberId) ??
    run.box.find((entry) => entry.fighter.id === memberId);
  const count = member?.fighter.moves.length ?? MAX_MOVES;
  if (hudDetailCursor >= 0 && hudDetailCursor < count) return hudDetailCursor;
  return Math.min(count, MAX_MOVES - 1);
}

/** The rename field's confirm: the pure rules decide the text, the host persists it. */
function commitDomNickname(host: RoutePanelHost, text: string): void {
  const memberId = hudDetailState.memberId;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  if (memberId !== null) {
    const run = host.run();
    const next = renameMember(run, memberId, normalizeNickname(text));
    if (next !== run) {
      host.commitRun(next);
      return;
    }
  }
  pushDomView(host);
}

/**
 * The DOM card's command channel, resolved here and nowhere else. Every write goes
 * through the engine functions this module already imports and lands on the run only
 * through `commitRun`; everything else is the panel's own cursor state.
 */
function runDetailIntent(host: RoutePanelHost, intent: DetailIntent): void {
  if (!DOM_HUD || domPaused) return;
  const memberId = hudDetailState.memberId;
  switch (intent.type) {
    case 'tab':
      hudDetailState = setDetailTab(hudDetailState, intent.tab);
      hudDetailCursor = -1;
      hudPoolCursor = -1;
      resetDetailInfo();
      pushDomView(host);
      return;
    case 'cursor':
      hudDetailCursor = intent.index;
      pushDomView(host);
      return;
    case 'poolCursor':
      hudPoolCursor = intent.index;
      pushDomView(host);
      return;
    case 'page':
      scrollLearnset(host, intent.delta);
      return;
    case 'search':
      hudLearnQuery = intent.query;
      hudLearnScrollTop = 0;
      hudPoolCursor = -1;
      dropLearnInfo();
      pushDomView(host);
      return;
    case 'info':
      if (
        intent.index === null ||
        (hudDetailInfoPinned && hudDetailInfo?.grid === 'moves' && hudDetailInfo.index === intent.index)
      ) {
        hudDetailInfo = null;
        hudDetailInfoPinned = false;
      } else {
        hudDetailInfo = { grid: 'moves', index: intent.index };
        hudDetailInfoPinned = true;
      }
      pushDomView(host);
      return;
    case 'abilityInfo':
      hudAbilityInfoPinned = intent.open;
      hudAbilityInfo = intent.open;
      pushDomView(host);
      return;
    case 'grab': {
      if (hudDetailState.grab === null) {
        hudDetailState = grabMove(hudDetailState, intent.index);
      } else if (hudDetailState.grab === intent.index) {
        hudDetailState = dropMove(hudDetailState);
      } else if (memberId !== null) {
        const run = host.run();
        const next = moveMoves(run, memberId, hudDetailState.grab, intent.index);
        hudDetailState = dropMove(hudDetailState);
        if (next !== run) {
          host.commitRun(next);
          return;
        }
      }
      pushDomView(host);
      return;
    }
    case 'drop': {
      const from = hudDetailState.grab;
      hudDetailState = dropMove(hudDetailState);
      if (from !== null && memberId !== null && from !== intent.slot) {
        const run = host.run();
        const next = moveMoves(run, memberId, from, intent.slot);
        if (next !== run) {
          host.commitRun(next);
          return;
        }
      }
      pushDomView(host);
      return;
    }
    case 'equip': {
      if (memberId === null) return;
      const run = host.run();
      const next = equipMove(run, memberId, intent.moveId, equipSlot(run, memberId), run.seed);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'unequip': {
      if (memberId === null) return;
      const slot = intent.slot >= 0 ? intent.slot : (hudDetailState.grab ?? -1);
      const run = host.run();
      const next = unequipMove(run, memberId, slot);
      hudDetailState = dropMove(hudDetailState);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'evolve': {
      if (memberId === null) return;
      const run = host.run();
      const next = evolveMember(run, memberId, intent.into);
      if (next !== run) {
        host.commitRun(next);
        return;
      }
      pushDomView(host);
      return;
    }
    case 'nickname':
      if ('begin' in intent) beginNicknameEdit(host);
      else if ('cancel' in intent) cancelNicknameEdit(host);
      else commitDomNickname(host, intent.commit);
      return;
    default:
      return;
  }
}

/**
 * The flag-on build: the same layout arithmetic and the same panel record (so the
 * saved layout, the collapse and the pointer-outside rule keep working) but no
 * content and no visible Phaser object — the card is the DOM one.
 *
 * The level-up / evolution popup is **not** migrated by this task: it is the beat
 * `RouteScene` raises after a battle, it draws in its own screen-space container and
 * contributes nothing to the panel's body, so it is still built here.
 */
function buildDom(host: RoutePanelHost): void {
  const scene = host.scene;
  const { detailW } = host.hud();
  const x = Math.max(HUD_PANEL_MARGIN, boxLeft() - detailW - HUD_GAP);
  const y = boxTop();
  hudDetailX = x;
  hudDetailY = y;
  const body = scene.add.container(0, 0);
  hudDetailBody = body;
  const detailWindow = addFrlgWindow(scene, x, y, detailW, HUD_DETAIL_H).setVisible(false);
  const panel = makeHudPanel(
    host,
    'detail',
    x,
    y,
    detailW,
    HUD_DETAIL_H,
    body,
    detailWindow,
    PANEL_ICON_KEYS.detail,
    PANEL_KEY_ACTIONS.detail ?? null,
  );
  panel.container.setVisible(false);
  panel.icon.setVisible(false);
  // `makeHudPanel` hangs the Transparent-HUD outline in the body; the card draws
  // nothing at all under the flag, so the empty body stays empty and stays zero.
  body.remove(panel.border);
  buildLearnPopup(host);
  disposeDomPanel();
  const view = signal(detailPanelView(null, [], initialDetailPanelUi(), viewportOf(host)));
  domView = view;
  const layer = typeof document === 'undefined' ? null : document.getElementById('hud');
  if (layer !== null) {
    domDispose = mountDetailPanel(layer, view, (intent) => runDetailIntent(host, intent));
    domOpener = installPartyOpener(host, layer);
  }
  subscribeScene(host);
  pushDomView(host);
}

/** Disposes the card and clears the module state the DOM path owns. */
function closeDom(): void {
  unsubscribeScene();
  disposeDomPanel();
  domView = null;
  hudDetailBody = null;
  hudDetailState = CLOSED_DETAIL;
  hudDetailCursor = -1;
  hudPoolCursor = -1;
  hudLearnScrollTop = 0;
  hudLearnQuery = '';
  hudSearchFocus = false;
  hudNicknameFocus = false;
  hudNicknameEdit = null;
  hudLearnScrollDrag = null;
  hudLearnDrag = null;
  hudLearnWindow = [];
  hudLearnRect = { x: 0, y: 0, w: 0, h: 0 };
  hudSearchRect = { x: 0, y: 0, w: 0, h: 0 };
  hudNicknameRect = { x: 0, y: 0, w: 0, h: 0 };
  hudDetailX = 0;
  hudDetailY = 0;
  resetDetailInfo();
  learnPopupOpen = false;
}

export const descriptor: RoutePanelDescriptor = {
  id: 'detail',
  order: 110,
  hudPanel: 'detail',
  build(host: RoutePanelHost): void {
    hudDetailState = CLOSED_DETAIL;
    hudLearnScrollTop = 0;
    hudLearnQuery = '';
    hudSearchFocus = false;
    hudLearnScrollDrag = null;
    hudDetailInfo = null;
    hudDetailInfoPinned = false;
    hudAbilityInfo = false;
    hudAbilityInfoPinned = false;
    hudNicknameFocus = false;
    hudNicknameEdit = null;
    hudDetailCursor = -1;
    hudPoolCursor = -1;
    hudDetailBody = null;
    if (DOM_HUD) {
      buildDom(host);
      return;
    }
    hudDetail = buildDetailPanel(host);
    hudDetailBody = hudDetail;
    // The learnset chip follows the pointer over the HUD, above every window.
    hudLearnGhost = addFrlgText(host.scene, 0, 0, '', {
      size: 16,
      tint: FRLG_INK,
      origin: [0.5, 0.5],
    }).setVisible(false);
    makeHudPanel(
      host,
      'detail',
      hudDetailX,
      hudDetailY,
      host.hud().detailW,
      HUD_DETAIL_H,
      hudDetail,
      hudDetailWindow,
      PANEL_ICON_KEYS.detail,
      PANEL_KEY_ACTIONS.detail ?? null,
    );
    registerHudOverlay(hudLearnGhost, 1);
    buildLearnPopup(host);
  },
  refresh: refreshDetail,
  pointer(host: RoutePanelHost, pointer: Phaser.Input.Pointer): boolean {
    if (DOM_HUD) return false;
    return pointerAt(host, pointer);
  },
  key(): boolean {
    return false;
  },
  close(): void {
    if (!DOM_HUD) return;
    closeDom();
  },
};

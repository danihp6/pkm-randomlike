import { t } from '../../../../i18n';
import { portraitCrop, type PortraitCrop } from '../../portrait';
import type { HudState } from '../../state';

/**
 * The party window's layout model (`D49`): the shipped Phaser box — `HUD_PARTY_W`
 * wide and `HUD_PARTY_HEADER + 6 × HUD_PARTY_ROW + HUD_PAD_BOTTOM` tall, docked in
 * the right-hand column — rebuilt from `HudState` alone. Every constant below is
 * named after the Phaser constant it mirrors, so a drift between the canvas and
 * the DOM is a failing test rather than a diff nobody reads.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The panel's own cursor state; the scene module keeps it in step with `PartyUiState`. */
export type PartyPanelUi = Readonly<{ cursor: number }>;

export type PartyRowView = Readonly<{
  /** `HudState.party[i].id`. */
  memberId: string;
  name: string;
  level: number;
  hpText: string;
  /** 0…1, from `HudPartyRow.hpFraction`. */
  hpFraction: number;
  statusLabel: string | null;
  heldItemName: string | null;
  /** A dark Pokémon: the card marks its portrait cell. */
  dark: boolean;
  selected: boolean;
  /** Panel-relative: the whole row, the portrait cell and the HP bar. */
  row: Rect;
  portrait: Rect;
  hpBar: Rect;
  /** The member's portrait cell, or null when the atlas names none. */
  portraitImage: PortraitCrop | null;
}>;

export type PartyPanelView = Readonly<{
  /** False while the route HUD has the panel collapsed; the root is then hidden. */
  open: boolean;
  /** Viewport coordinates: the mounted panel's rect (see `partyPanelBox`). */
  box: Rect;
  /** Every rect below is panel-relative, i.e. measured from `box.x`/`box.y`. */
  highlight: Rect;
  chip: Readonly<{ letter: string; box: Rect }>;
  level: Readonly<{ text: string; box: Rect }>;
  xp: Readonly<{ text: string; fraction: number; box: Rect }>;
  vial: Readonly<{ text: string; charges: number; max: number; fill: number; box: Rect }>;
  rows: readonly PartyRowView[];
}>;

/** The Phaser constants this panel mirrors, declared here so a test can pin them. */
export const PARTY_PANEL_W = 250; // HUD_PARTY_W / hudMetrics().partyW
export const PARTY_PAD_X = 20; // HUD_PAD_X / FRLG_WINDOW_PADDING.x
export const PARTY_PAD_TOP = 16; // HUD_PAD_TOP
export const PARTY_PAD_BOTTOM = 12; // HUD_PAD_BOTTOM
export const PARTY_HEADER_H = 82; // HUD_PARTY_HEADER (HUD_VIAL_Y + HUD_VIAL_H + 8)
export const PARTY_ROW = 52; // HUD_PARTY_ROW
export const PARTY_ROWS = 6; // MAX_PARTY_SIZE
export const PARTY_COLUMN = 56; // HUD_PARTY_COLUMN
export const PARTY_PORTRAIT = 45; // PORTRAIT_SIZE 64 × HUD_PARTY_PORTRAIT_SCALE 0.7, rounded
export const PARTY_PORTRAIT_X = 44; // partyLeft 20 + 24, the cell's centre
export const PARTY_XP_INSET = 12; // HUD_XP_BAR_INSET
export const PARTY_XP_H = 8; // HUD_XP_BAR_H
export const PARTY_XP_Y = 38; // HUD_XP_BAR_Y
export const PARTY_VIAL_W = 100; // HUD_VIAL_W
export const PARTY_VIAL_H = 20; // HUD_VIAL_H
export const PARTY_VIAL_Y = 54; // HUD_VIAL_Y
export const PARTY_HP_BAR = PARTY_PANEL_W - PARTY_PAD_X * 2 - PARTY_COLUMN; // 154
export const PARTY_HP_BAR_H = 16; // FRLG_HPBAR.height 28 × 154/268, rounded
export const PARTY_PANEL_H = PARTY_HEADER_H + PARTY_ROWS * PARTY_ROW + PARTY_PAD_BOTTOM; // 406

/** The right-hand column the shipped HUD docks at: `HUD_PANEL_W` minus `HUD_PANEL_MARGIN`. */
const HUD_PANEL_W = 344;
const HUD_PANEL_MARGIN = 8;
const HUD_TOP = 8;
/** The header's level line and right-aligned XP readout: the type readout's own box. */
const PARTY_TEXT_H = 20;
/** The row's key chip: the board's 26 px badge, flush with the card's corner. */
const PARTY_CHIP = 26;
const PARTY_CHIP_LETTER = 'P';
/** The card's 1 px highlight, 12 px inside its top edge (`docs/hud-fidelity.md` §5). */
const PARTY_HIGHLIGHT_INSET = 12;
/** A row portrait's centre sits this far below its row's top. */
const PARTY_PORTRAIT_OFFSET_Y = 26;
/** The HP track starts this far below its row's top. */
const PARTY_HP_OFFSET_Y = 28;
/** A row's highlight keeps its band 4 px shorter than the row pitch. */
const PARTY_ROW_INSET_Y = 4;

const XP_BOX: Rect = {
  x: PARTY_PAD_X + PARTY_XP_INSET,
  y: PARTY_XP_Y,
  w: PARTY_PANEL_W - (PARTY_PAD_X + PARTY_XP_INSET) * 2,
  h: PARTY_XP_H,
};

const LEVEL_BOX: Rect = { x: XP_BOX.x, y: PARTY_PAD_TOP, w: XP_BOX.w, h: PARTY_TEXT_H };

const VIAL_BOX: Rect = {
  x: (PARTY_PANEL_W - PARTY_VIAL_W) / 2,
  y: PARTY_VIAL_Y,
  w: PARTY_VIAL_W,
  h: PARTY_VIAL_H,
};

const HIGHLIGHT_BOX: Rect = {
  x: PARTY_HIGHLIGHT_INSET,
  y: PARTY_HIGHLIGHT_INSET,
  w: PARTY_PANEL_W - PARTY_HIGHLIGHT_INSET * 2,
  h: 1,
};

const CHIP_BOX: Rect = { x: 0, y: 0, w: PARTY_CHIP, h: PARTY_CHIP };

function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

/** The cursor row, clamped to the members on screen; -1 when the party is empty. */
function clampCursor(cursor: number, rows: number): number {
  if (rows <= 0) return -1;
  const value = Number.isFinite(cursor) ? Math.trunc(cursor) : 0;
  return Math.min(Math.max(0, value), rows - 1);
}

function rowBox(index: number): Rect {
  return {
    x: PARTY_PAD_X,
    y: PARTY_HEADER_H + index * PARTY_ROW,
    w: PARTY_PANEL_W - PARTY_PAD_X * 2,
    h: PARTY_ROW - PARTY_ROW_INSET_Y,
  };
}

/** The shipped avatar cell: `PORTRAIT_SIZE 64 × 0.7` rounded, centred on the row. */
function portraitBox(row: Rect): Rect {
  return {
    x: Math.round(PARTY_PORTRAIT_X - PARTY_PORTRAIT / 2),
    y: Math.round(row.y + PARTY_PORTRAIT_OFFSET_Y - PARTY_PORTRAIT / 2),
    w: PARTY_PORTRAIT,
    h: PARTY_PORTRAIT,
  };
}

function hpBarBox(row: Rect): Rect {
  return {
    x: PARTY_PAD_X + PARTY_COLUMN,
    y: row.y + PARTY_HP_OFFSET_Y,
    w: PARTY_HP_BAR,
    h: PARTY_HP_BAR_H,
  };
}

function rowView(member: HudState['party'][number], index: number, selected: boolean): PartyRowView {
  const row = rowBox(index);
  return {
    memberId: member.id,
    name: member.name,
    level: member.level,
    hpText: t('detail.hp', { hp: member.hp, max: member.maxHp }),
    hpFraction: clampFraction(member.hpFraction),
    statusLabel: member.statusLabel,
    heldItemName: member.heldItemName,
    dark: member.dark === true,
    selected,
    row,
    portrait: portraitBox(row),
    hpBar: hpBarBox(row),
    portraitImage: portraitCrop(member.speciesId, member.shiny),
  };
}

/** The shipped rect: `x = width − HUD_PANEL_W 344 − 8`, `y = HUD_TOP 8`, `w = 250`. */
export function partyPanelBox(viewport: Viewport): Rect {
  return {
    x: viewport.width - HUD_PANEL_W - HUD_PANEL_MARGIN,
    y: HUD_TOP,
    w: PARTY_PANEL_W,
    h: PARTY_PANEL_H,
  };
}

export function initialPartyPanelUi(): PartyPanelUi {
  return { cursor: 0 };
}

/**
 * The panel as data. It lays out at most `PARTY_ROWS` members from
 * `PARTY_HEADER_H` at `PARTY_ROW` pitch and clamps the cursor to the party; a
 * missing `route` leaves the header empty, as the collapsed HUD does today.
 */
export function partyPanelView(state: HudState, ui: PartyPanelUi, viewport: Viewport): PartyPanelView {
  const members = state.party.slice(0, PARTY_ROWS);
  const cursor = clampCursor(ui.cursor, members.length);
  const route = state.route;
  const charges = route?.pokevialCharges ?? 0;
  const max = route?.pokevialMax ?? 0;
  return {
    open: true,
    box: partyPanelBox(viewport),
    highlight: HIGHLIGHT_BOX,
    chip: { letter: PARTY_CHIP_LETTER, box: CHIP_BOX },
    level: { text: route === null ? '' : t('hud.level', { level: route.squadLevel }), box: LEVEL_BOX },
    xp: {
      text: route === null ? '' : t('hud.xp', { xp: route.xp }),
      fraction: clampFraction(route?.xpFraction ?? 0),
      box: XP_BOX,
    },
    vial: {
      text: t('hud.vial'),
      charges,
      max,
      fill: max > 0 ? clampFraction(charges / max) : 0,
      box: VIAL_BOX,
    },
    rows: members.map((member, index) => rowView(member, index, index === cursor)),
  };
}

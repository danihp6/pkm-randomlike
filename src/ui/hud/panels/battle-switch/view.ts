import { PORTRAIT_SIZE } from '../../../../data/portraits';
import { t } from '../../../../i18n';
import { HP_COLORS, hpColor, hpFraction } from '../../../metrics';
import { FRLG_HPBAR, FRLG_WINDOW_PADDING } from '../../../frlg';
import { fitPartyLabel, partyGridLayout, type PartyGridRect } from '../../../partyGrid';
import { battleMovesBox } from '../battle-moves';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type HpTone = 'healthy' | 'caution' | 'danger';

/** The switch grid's card **is** the battle's menu box: the shipped `battleMovesBox`, re-exported. */
export const battleSwitchBox = battleMovesBox;

export const SWITCH_ROWS = 6;
export const SWITCH_ROW_GAP = 8;
export const SWITCH_BACK_COLUMN = 64;
export const SWITCH_INSET = 8;
export const SWITCH_AVATAR_CAP = 0.9;
export const SWITCH_HPBAR_CAP = 0.4;
export const SWITCH_LABEL_SIZE = 14;
export const SWITCH_ROW_LEAD = 8;
export const SWITCH_ROW_TRAIL = 8;
export const SWITCH_AVATAR_GAP = 6;
export const SWITCH_STATUS_W = 44;
export const SWITCH_STATUS_H = 16;
export const SWITCH_STATUS_GAP = 4;
export const SWITCH_BACK_W = 48;
export const SWITCH_BACK_H = 36;
export const SWITCH_BACK_INSET = 14;

/** The narrowest a fitted label may become, `partyGridLayout`'s own floor. */
const MIN_LABEL_WIDTH = 24;
/** The ◀ glyph's own offset inside its hit box, as `renderPartyGrid` arms it. */
const BACK_GLYPH_INSET = 12;

/** One party member, as the scene hands it. Plain data: never a `BattleFighter`. */
export type BattleSwitchRowInput = Readonly<{
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  /** `statusAbbreviation(fighter.status)`: 'BRN' | 'PSN' | 'TOX' | 'PAR' | 'SLP' | 'FRZ' | null. */
  statusLabel: string | null;
  /** `switchablePartyIndices(state, 'player').includes(index)`. */
  enabled: boolean;
  /** `partyGridFieldRows(activeIndex, secondActiveIndex).includes(index)` in a double, else false. */
  field: boolean;
}>;

export type BattleSwitchInput = Readonly<{
  /** True while `mode === 'party'`; a closed grid hides the card but keeps it mounted. */
  open: boolean;
  /** The card in **page** coordinates (see `battleSwitchBox`). */
  card: Rect;
  /** The members, in party order, at most `SWITCH_ROWS`. */
  rows: readonly BattleSwitchRowInput[];
  /** `menuIndex`. */
  selected: number;
}>;

export type SwitchRowView = Readonly<{
  index: number;
  name: string;
  level: number;
  /** The board's row line — `party.rowLabel` with the status left to the mark — fitted to the row. */
  label: Readonly<{ text: string; box: Rect }>;
  /** `hp + '/' + maxHp`: the row's accessible name, never painted. */
  hpText: string;
  /** 0…1, from `hpFraction`. */
  fraction: number;
  /** Null for a fainted member: the canvas hides the bar with the member. */
  hp: Readonly<{ track: Rect; area: Rect; fill: Rect; tone: HpTone }> | null;
  statusLabel: string | null;
  /** The 44×16 board mark, right-aligned in the row; null with no status. */
  status: Readonly<{ box: Rect }> | null;
  field: boolean;
  enabled: boolean;
  selected: boolean;
  /** Page coordinates. `row` is the same rect the canvas draws its cell at. */
  row: Rect;
  portrait: Rect;
}>;

export type BattleSwitchView = Readonly<{
  open: boolean;
  /** The card in page coordinates; the root is `position: fixed` at it. */
  card: Rect;
  rows: readonly SwitchRowView[];
  /** The six fixed row rects the grid always lays out, filled or not (`partyGridLayout`'s `rects`). */
  slots: readonly Rect[];
  back: Readonly<{ label: string; box: Rect }>;
}>;

/** A row index clamped into the members on screen; `NaN` lands on the first. */
function clampIndex(value: number, count: number): number {
  if (count <= 0 || !Number.isFinite(value)) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(value)));
}

/** The tone `hpColor` bands the fraction into, read off the colour it returns. */
function toneOf(fraction: number): HpTone {
  const colour = hpColor(fraction);
  if (colour === HP_COLORS.healthy) return 'healthy';
  if (colour === HP_COLORS.caution) return 'caution';
  return 'danger';
}

function rowView(
  row: BattleSwitchRowInput,
  index: number,
  slot: PartyGridRect,
  selected: number,
  avatarW: number,
  barW: number,
  barH: number,
  labelMaxWidth: number,
  hpBarScale: number,
): SwitchRowView {
  const portrait: Rect = {
    x: slot.x + SWITCH_ROW_LEAD,
    y: slot.y + (slot.h - avatarW) / 2,
    w: avatarW,
    h: avatarW,
  };
  const markW = row.statusLabel === null ? 0 : SWITCH_STATUS_W + SWITCH_STATUS_GAP;
  const labelW = Math.max(MIN_LABEL_WIDTH, labelMaxWidth - markW);
  const trackRight = slot.x + slot.w - SWITCH_ROW_TRAIL - markW;
  const track: Rect = {
    x: trackRight - barW,
    y: slot.y + (slot.h - barH) / 2,
    w: barW,
    h: barH,
  };
  const area: Rect = {
    x: track.x + FRLG_HPBAR.fill.x * hpBarScale,
    y: track.y + FRLG_HPBAR.fill.y * hpBarScale,
    w: FRLG_HPBAR.fill.width * hpBarScale,
    h: FRLG_HPBAR.fill.height * hpBarScale,
  };
  const fraction = hpFraction(row.hp, row.maxHp);
  return {
    index,
    name: row.name,
    level: row.level,
    label: {
      text: fitPartyLabel(
        t('party.rowLabel', { name: row.name, level: row.level, status: '' }),
        labelW,
        SWITCH_LABEL_SIZE,
      ),
      box: { x: portrait.x + avatarW + SWITCH_AVATAR_GAP, y: slot.y, w: labelW, h: slot.h },
    },
    hpText: `${row.hp}/${row.maxHp}`,
    fraction,
    hp:
      row.hp > 0
        ? { track, area, fill: { ...area, w: area.w * fraction }, tone: toneOf(fraction) }
        : null,
    statusLabel: row.statusLabel,
    status:
      row.statusLabel === null
        ? null
        : {
            box: {
              x: slot.x + slot.w - SWITCH_ROW_TRAIL - SWITCH_STATUS_W,
              y: slot.y + (slot.h - SWITCH_STATUS_H) / 2,
              w: SWITCH_STATUS_W,
              h: SWITCH_STATUS_H,
            },
          },
    field: row.field,
    enabled: row.enabled,
    selected: index === selected,
    row: { x: slot.x, y: slot.y, w: slot.w, h: slot.h },
    portrait,
  };
}

/**
 * The switch grid as plain data: the six row rects `partyGridLayout` lays out inside
 * the scene's own card, each member's portrait cell, fitted line, HP track and fill,
 * status mark, and the ◀ control at the spot the canvas arms. Pure and total:
 * out-of-range indices clamp, a short party paints fewer rows against the six slots,
 * and the same input always yields deep-equal output.
 */
export function battleSwitchView(input: BattleSwitchInput): BattleSwitchView {
  const card = input.card;
  // The identical call the canvas makes, so the two grids can never diverge.
  const layout = partyGridLayout(card, {
    padding: FRLG_WINDOW_PADDING,
    rows: SWITCH_ROWS,
    gap: SWITCH_ROW_GAP,
    backColumn: SWITCH_BACK_COLUMN,
    inset: SWITCH_INSET,
    avatarScaleCap: SWITCH_AVATAR_CAP,
    hpBarScaleCap: SWITCH_HPBAR_CAP,
    hpBarWidth: FRLG_HPBAR.width,
    hpBarHeight: FRLG_HPBAR.height,
  });
  const members = input.rows.slice(0, SWITCH_ROWS);
  const selected = clampIndex(input.selected, members.length);
  const avatarW = PORTRAIT_SIZE * layout.avatarScale;
  const barW = FRLG_HPBAR.width * layout.hpBarScale;
  const barH = FRLG_HPBAR.height * layout.hpBarScale;
  const rows = members.map((row, index) =>
    rowView(
      row,
      index,
      layout.rects[index],
      selected,
      avatarW,
      barW,
      barH,
      layout.labelMaxWidth,
      layout.hpBarScale,
    ),
  );
  const slots = layout.rects;
  const first = slots[0];
  const last = slots[slots.length - 1];
  return {
    open: input.open,
    card,
    rows,
    slots: slots.map((slot) => ({ x: slot.x, y: slot.y, w: slot.w, h: slot.h })),
    back: {
      label: '\u25c0',
      box: {
        x: card.x + FRLG_WINDOW_PADDING.x + SWITCH_BACK_INSET - BACK_GLYPH_INSET,
        y: (first.y + last.y + last.h) / 2 - SWITCH_BACK_H / 2,
        w: SWITCH_BACK_W,
        h: SWITCH_BACK_H,
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flagOf(value: unknown): boolean {
  return value === true;
}

function statusOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function rowInputOf(value: unknown): BattleSwitchRowInput {
  const row = isObject(value) ? value : {};
  return {
    name: textOf(row.name),
    level: numberOf(row.level, 0),
    hp: numberOf(row.hp, 0),
    maxHp: numberOf(row.maxHp, 0),
    statusLabel: statusOf(row.statusLabel),
    enabled: flagOf(row.enabled),
    field: flagOf(row.field),
  };
}

/**
 * The fixture payload (`design/fixtures/05d-battle-pokemon.json`) as an input. `null` when the
 * payload carries no `switch` object or no `rows` array. The card is always the viewport's own
 * `battleSwitchBox` — a payload's `card` is documentation, never the authority.
 */
export function fixtureSwitchInput(payload: unknown, viewport: Viewport): BattleSwitchInput | null {
  if (!isObject(payload)) return null;
  const block = payload['switch'];
  if (!isObject(block)) return null;
  const rows = block['rows'];
  if (!Array.isArray(rows)) return null;
  return {
    open: block['open'] !== false,
    card: battleSwitchBox(viewport),
    rows: rows.slice(0, SWITCH_ROWS).map(rowInputOf),
    selected: numberOf(block['selected'], 0),
  };
}

import type { TerrainId, WeatherId } from '../../../../engine/battle/state';
import {
  FIELD_ICONS,
  type FieldIconId,
  type FieldIconKind,
  type FieldIconShape,
} from '../../../../data/fieldIcons';
import { t } from '../../../../i18n';
import { BATTLE_HP_BREAKPOINT, battleHpBox, battleStage } from '../battle-hp/view';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The chip's cell side, in px. */
export const FIELD_CHIP = 32;
/** The gutter between two chips. */
export const FIELD_CHIP_GAP = 8;
/** The row's inset from the stage's top and right edges, in px. */
export const FIELD_CHIP_INSET = 16;
/** The clearance a narrow (phone) row keeps under the foe's lowest HP box, in px. */
export const FIELD_CHIP_CLEARANCE = 8;

export type FieldChipView = Readonly<{
  id: FieldIconId;
  kind: FieldIconKind;
  /** `t(row.labelKey, { turns })` — the chip's accessible name: `Sandstorm · 4`. */
  label: string;
  /** The numeral the chip paints: `String(turns)` of the clamped count. */
  turns: string;
  /** `FIELD_ICONS[id].path`, already resolved: the panel reads no data table. */
  path: string;
  /** `FIELD_ICONS[id].viewBox`. */
  viewBox: number;
  shape: FieldIconShape;
  /** Page coordinates: the chip's own `FIELD_CHIP` × `FIELD_CHIP` cell. */
  box: Rect;
}>;

export type BattleFieldInput = Readonly<{
  /** The window's own size — the same one `battleHpBox` and `battleStage` read. */
  viewport: Viewport;
  /** The sides that field a second active, as the HP boxes lay themselves out. Only `enemy` is read. */
  doubles: Readonly<{ enemy: boolean; player: boolean }>;
  weather: WeatherId | null;
  weatherTurns: number;
  terrain: TerrainId | null;
  terrainTurns: number;
}>;

export type BattleFieldView = Readonly<{
  /** Left to right in draw order; the weather, when up, is the last (the corner) chip. */
  chips: readonly FieldChipView[];
  /** The chips' union box in page coordinates, or `null` when nothing is up. */
  row: Rect | null;
}>;

/** The row's union box for `count` chips (clamped to 0…2), or `null` for none. */
export function fieldChipRow(
  viewport: Viewport,
  doubles: Readonly<{ enemy: boolean; player: boolean }>,
  count: number,
): Rect | null {
  const cells = Number.isFinite(count) ? Math.min(2, Math.max(0, Math.trunc(count))) : 0;
  if (cells === 0) return null;
  const stage = battleStage(viewport);
  const right = stage.x + stage.w - FIELD_CHIP_INSET;
  // On a phone the foe's card spans the width at the top, so the corner is taken:
  // the row drops under that side's lowest box and keeps the same right edge.
  const narrow =
    viewport.width < BATTLE_HP_BREAKPOINT ? battleHpBox(viewport, 'enemy', doubles.enemy ? 1 : 0) : null;
  const top = narrow === null ? stage.y + FIELD_CHIP_INSET : narrow.y + narrow.h + FIELD_CHIP_CLEARANCE;
  const w = cells * FIELD_CHIP + (cells - 1) * FIELD_CHIP_GAP;
  return { x: right - w, y: top, w, h: FIELD_CHIP };
}

/** The stored turns of a condition as the chip reads them: never below zero, never fractional. */
function turnCount(turns: number): number {
  return Number.isFinite(turns) ? Math.max(0, Math.trunc(turns)) : 0;
}

function chipOf(id: FieldIconId, slot: number, row: Rect, turns: number): FieldChipView {
  const icon = FIELD_ICONS[id];
  return {
    id,
    kind: icon.kind,
    label: t(icon.labelKey, { turns }),
    turns: String(turns),
    path: icon.path,
    viewBox: icon.viewBox,
    shape: icon.shape,
    box: {
      x: row.x + slot * (FIELD_CHIP + FIELD_CHIP_GAP),
      y: row.y,
      w: FIELD_CHIP,
      h: FIELD_CHIP,
    },
  };
}

/**
 * The field chips as plain data: one cell per live condition, the terrain first and
 * the weather last so the commoner condition holds the stage's corner. Pure and
 * total; reads no RNG, no clock and no i18n but `t`.
 */
export function battleFieldView(input: BattleFieldInput): BattleFieldView {
  const terrain = input.terrain;
  const weather = input.weather;
  const count = (terrain === null ? 0 : 1) + (weather === null ? 0 : 1);
  const row = fieldChipRow(input.viewport, input.doubles, count);
  if (row === null) return { chips: [], row: null };

  const chips: FieldChipView[] = [];
  if (terrain !== null) chips.push(chipOf(terrain, 0, row, turnCount(input.terrainTurns)));
  if (weather !== null) {
    chips.push(chipOf(weather, chips.length, row, turnCount(input.weatherTurns)));
  }
  return { chips, row };
}

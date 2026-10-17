import type { StatusId } from '../engine/battle/fighter';

export type Rgb = Readonly<{ r: number; g: number; b: number }>;

export const HP_COLORS: Readonly<{ healthy: Rgb; caution: Rgb; danger: Rgb }> = {
  healthy: { r: 0x4a, g: 0xd1, b: 0x5c },
  caution: { r: 0xf5, g: 0xc2, b: 0x42 },
  danger: { r: 0xef, g: 0x44, b: 0x44 },
};

/** Clamped HP fraction in 0..1; a fainted Pokémon reads as 0. */
export function hpFraction(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

/** Classic green / yellow / red thresholds at half and one fifth. */
export function hpColor(fraction: number): Rgb {
  if (fraction > 0.5) return HP_COLORS.healthy;
  if (fraction > 0.2) return HP_COLORS.caution;
  return HP_COLORS.danger;
}

export function rgbToInt(color: Rgb): number {
  return (color.r << 16) | (color.g << 8) | color.b;
}

/** Green / yellow / red as a 0xRRGGBB integer, for Phaser tints and fills. */
export function hpColorInt(fraction: number): number {
  return rgbToInt(hpColor(fraction));
}

/** HP fraction at or below which the danger cue shows: the classic one-fifth band. */
export const LOW_HP_FRACTION = 0.2;

/** The danger-band fill is cut into this many blocks, with a gap this many px wide. */
export const HP_CUE_BLOCKS = 4;
export const HP_CUE_GAP = 2;

/** True for a living Pokémon in the danger band; a fainted one (fraction 0) is not low. */
export function isLowHp(fraction: number): boolean {
  return fraction > 0 && fraction <= LOW_HP_FRACTION;
}

/**
 * The x offsets, measured from the fill's left edge, of the notches that cut a fill
 * `width` px wide into `HP_CUE_BLOCKS` blocks. Empty below `HP_CUE_BLOCKS * HP_CUE_GAP * 2`
 * px, where the notches would eat the fill whole. `Math.round(width * i / HP_CUE_BLOCKS)`
 * for i = 1..HP_CUE_BLOCKS-1 otherwise.
 */
export function hpCueNotches(width: number): readonly number[] {
  if (!(width >= HP_CUE_BLOCKS * HP_CUE_GAP * 2)) return [];
  const notches: number[] = [];
  for (let i = 1; i < HP_CUE_BLOCKS; i++) {
    notches.push(Math.round((width * i) / HP_CUE_BLOCKS));
  }
  return notches;
}

export const STATUS_ABBREVIATIONS: Readonly<Record<StatusId, string>> = {
  brn: 'BRN',
  psn: 'PSN',
  tox: 'TOX',
  par: 'PAR',
  slp: 'SLP',
  frz: 'FRZ',
};

export function statusAbbreviation(status: StatusId | null): string | null {
  return status ? STATUS_ABBREVIATIONS[status] : null;
}

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

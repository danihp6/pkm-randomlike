import type { TerrainId, WeatherId } from '../engine/battle/state';
import type { TranslationKey } from '../i18n';

/** The eight conditions the field chips can draw: the four weathers and the four terrains. */
export type FieldIconId = WeatherId | TerrainId;

/** The chip slot a condition takes. */
export type FieldIconKind = 'weather' | 'terrain';

/** The shape family of the drawn glyph, so a chip is never colour-only. */
export type FieldIconShape = 'sun' | 'drop' | 'swirl' | 'flake' | 'bolt' | 'blades' | 'mist' | 'rings';

export type FieldIconRow = Readonly<{
  id: FieldIconId;
  kind: FieldIconKind;
  /** The chip's label key, reused from the retired window's table. */
  labelKey: TranslationKey;
  shape: FieldIconShape;
  /** The glyph's viewBox side, in SVG units. Always 24. */
  viewBox: number;
  /** The glyph's SVG `d`, in `viewBox` units, drawn in `currentColor`. Non-empty. */
  path: string;
}>;

/** The eight ids, in the table's own order: weathers first, then terrains. */
export const FIELD_ICON_IDS: readonly FieldIconId[] = [
  'sun',
  'rain',
  'sand',
  'snow',
  'electric',
  'grassy',
  'misty',
  'psychic',
];

/**
 * The eight drawn glyphs: one inline SVG path each, on a 24-unit square, filled
 * with the chip's own ink. A packed atlas would need a `package.json` script and a
 * generated sheet, so the field takes `D49`'s escape hatch and the paths live here
 * as data.
 */
export const FIELD_ICONS: Readonly<Record<FieldIconId, FieldIconRow>> = {
  sun: {
    id: 'sun',
    kind: 'weather',
    labelKey: 'battle.info.weather.sun',
    shape: 'sun',
    viewBox: 24,
    path: 'M16.6 12A4.6 4.6 0 1 1 7.4 12A4.6 4.6 0 1 1 16.6 12ZM18.2 11.1L21.2 11.1L21.2 12.9L18.2 12.9ZM17.02 15.75L19.14 17.87L17.87 19.14L15.75 17.02ZM12.9 18.2L12.9 21.2L11.1 21.2L11.1 18.2ZM8.25 17.02L6.13 19.14L4.86 17.87L6.98 15.75ZM5.8 12.9L2.8 12.9L2.8 11.1L5.8 11.1ZM6.98 8.25L4.86 6.13L6.13 4.86L8.25 6.98ZM11.1 5.8L11.1 2.8L12.9 2.8L12.9 5.8ZM15.75 6.98L17.87 4.86L19.14 6.13L17.02 8.25Z',
  },
  rain: {
    id: 'rain',
    kind: 'weather',
    labelKey: 'battle.info.weather.rain',
    shape: 'drop',
    viewBox: 24,
    path: 'M5.2 7.88C7.29 10.3 7.4 11.73 7.4 13.6A2.2 2.2 0 0 1 3 13.6C3 11.73 3.11 10.3 5.2 7.88ZM12 7.88C14.09 10.3 14.2 11.73 14.2 13.6A2.2 2.2 0 0 1 9.8 13.6C9.8 11.73 9.91 10.3 12 7.88ZM18.8 7.88C20.89 10.3 21 11.73 21 13.6A2.2 2.2 0 0 1 16.6 13.6C16.6 11.73 16.71 10.3 18.8 7.88Z',
  },
  sand: {
    id: 'sand',
    kind: 'weather',
    labelKey: 'battle.info.weather.sand',
    shape: 'swirl',
    viewBox: 24,
    path: 'M9.4 14.15L8.81 14.37L8.11 14.41L7.37 14.24L6.64 13.84L6 13.21L5.52 12.37L5.26 11.37L5.27 10.27L5.58 9.14L6.21 8.07L7.14 7.15L8.33 6.46L9.73 6.08L11.25 6.06L12.79 6.44L14.25 7.23L15.52 8.4L16.49 9.92L17.07 11.7L17.2 13.63L16.83 15.61L15.95 17.5L14.49 16.27L15.12 14.78L15.34 13.24L15.17 11.77L14.66 10.45L13.88 9.37L12.9 8.56L11.8 8.06L10.68 7.87L9.62 7.97L8.69 8.33L7.94 8.87L7.41 9.55L7.1 10.28L7.02 11L7.14 11.66L7.41 12.19L7.79 12.57L8.22 12.78L8.64 12.83L9.01 12.73L9.27 12.52L9.4 12.25ZM14.6 9.85L15.19 9.63L15.89 9.59L16.63 9.76L17.36 10.16L18 10.79L18.48 11.63L18.74 12.63L18.73 13.73L18.42 14.86L17.79 15.93L16.86 16.85L15.67 17.54L14.27 17.92L12.75 17.94L11.21 17.56L9.75 16.77L8.48 15.6L7.51 14.08L6.93 12.3L6.8 10.37L7.17 8.39L8.05 6.5L9.51 7.73L8.88 9.22L8.66 10.76L8.83 12.23L9.34 13.55L10.12 14.63L11.1 15.44L12.2 15.94L13.32 16.13L14.38 16.03L15.31 15.67L16.06 15.13L16.59 14.45L16.9 13.72L16.98 13L16.86 12.34L16.59 11.81L16.21 11.43L15.78 11.22L15.36 11.17L14.99 11.27L14.73 11.48L14.6 11.75ZM9.2 14.75L8.45 14.91L7.62 14.85L6.78 14.54L6 13.99L5.36 13.19L4.93 12.2L4.76 11.07L4.91 9.87L5.39 8.7L6.2 7.64L7.3 6.78L8.65 6.22L10.16 6.02L11.73 6.22L13.26 6.84L14.63 7.87L15.73 9.27L16.46 10.96L16.74 12.84L16.52 14.8L15.79 16.7L14.57 18.4L13.09 16.63L13.92 15.36L14.38 13.98L14.45 12.59L14.18 11.28L13.61 10.15L12.8 9.26L11.84 8.64L10.81 8.32L9.79 8.29L8.87 8.51L8.09 8.95L7.5 9.53L7.13 10.21L6.97 10.9L7.02 11.54L7.22 12.09L7.55 12.51L7.95 12.77L8.36 12.88L8.73 12.84L9.02 12.68L9.2 12.45ZM14.8 9.25L15.55 9.09L16.38 9.15L17.22 9.46L18 10.01L18.64 10.81L19.07 11.8L19.24 12.93L19.09 14.13L18.61 15.3L17.8 16.36L16.7 17.22L15.35 17.78L13.84 17.98L12.27 17.78L10.74 17.16L9.37 16.13L8.27 14.73L7.54 13.04L7.26 11.16L7.48 9.2L8.21 7.3L9.43 5.6L10.91 7.37L10.08 8.64L9.62 10.02L9.55 11.41L9.82 12.72L10.39 13.85L11.2 14.74L12.16 15.36L13.19 15.68L14.21 15.71L15.13 15.49L15.91 15.05L16.5 14.47L16.87 13.79L17.03 13.1L16.98 12.46L16.78 11.91L16.45 11.49L16.05 11.23L15.64 11.12L15.27 11.16L14.98 11.32L14.8 11.55ZM15.12 16.63A7.2 7.2 0 1 1 13.2 5.76L12.05 7.76A4.9 4.9 0 1 0 13.35 15.15ZM8.88 7.37A7.2 7.2 0 1 1 10.8 18.24L11.95 16.24A4.9 4.9 0 1 0 10.65 8.85Z',
  },
  snow: {
    id: 'snow',
    kind: 'weather',
    labelKey: 'battle.info.weather.snow',
    shape: 'flake',
    viewBox: 24,
    path: 'M3.3 11.05L20.7 11.05L20.7 12.95L3.3 12.95ZM8.47 3.99L17.17 19.06L15.53 20.01L6.83 4.94ZM17.17 4.94L8.47 20.01L6.83 19.06L15.53 3.99Z',
  },
  electric: {
    id: 'electric',
    kind: 'terrain',
    labelKey: 'battle.info.terrain.electric',
    shape: 'bolt',
    viewBox: 24,
    path: 'M13.2 2L4 13.4h6.2L9.4 22L19 10.4h-6.4Z',
  },
  grassy: {
    id: 'grassy',
    kind: 'terrain',
    labelKey: 'battle.info.terrain.grassy',
    shape: 'blades',
    viewBox: 24,
    path: 'M5.3 22C4.9 15 3.2 9 4.4 4C7.8 10 8.3 16 7.5 22ZM10.9 22C10.5 15 9.8 9 12 2.6C14.4 10 13.9 16 13.1 22ZM16.5 22C16.1 15 16.4 9 19.6 4C21 10 19.5 16 18.7 22Z',
  },
  misty: {
    id: 'misty',
    kind: 'terrain',
    labelKey: 'battle.info.terrain.misty',
    shape: 'mist',
    viewBox: 24,
    path: 'M2.6 5.95L4.95 7.01L7.3 7.45L9.65 7.01L12 5.95L14.35 4.89L16.7 4.45L19.05 4.89L21.4 5.95L21.4 8.05L19.05 6.99L16.7 6.55L14.35 6.99L12 8.05L9.65 9.11L7.3 9.55L4.95 9.11L2.6 8.05ZM2.6 10.95L4.95 12.01L7.3 12.45L9.65 12.01L12 10.95L14.35 9.89L16.7 9.45L19.05 9.89L21.4 10.95L21.4 13.05L19.05 11.99L16.7 11.55L14.35 11.99L12 13.05L9.65 14.11L7.3 14.55L4.95 14.11L2.6 13.05ZM2.6 15.95L4.95 17.01L7.3 17.45L9.65 17.01L12 15.95L14.35 14.89L16.7 14.45L19.05 14.89L21.4 15.95L21.4 18.05L19.05 16.99L16.7 16.55L14.35 16.99L12 18.05L9.65 19.11L7.3 19.55L4.95 19.11L2.6 18.05Z',
  },
  psychic: {
    id: 'psychic',
    kind: 'terrain',
    labelKey: 'battle.info.terrain.psychic',
    shape: 'rings',
    viewBox: 24,
    path: 'M22.2 12A10.2 10.2 0 1 1 1.8 12A10.2 10.2 0 1 1 22.2 12ZM19.8 12A7.8 7.8 0 1 0 4.2 12A7.8 7.8 0 1 0 19.8 12ZM17.9 12A5.9 5.9 0 1 1 6.1 12A5.9 5.9 0 1 1 17.9 12ZM15.5 12A3.5 3.5 0 1 0 8.5 12A3.5 3.5 0 1 0 15.5 12Z',
  },
};

/** The row for `id`. Pure, total, no RNG, no i18n call. */
export function fieldIcon(id: FieldIconId): FieldIconRow {
  return FIELD_ICONS[id];
}

/** Fallback flat colours, one per map value, used when an atlas is unavailable. */
export type Palette = Readonly<Record<number, string>>;

export const DEFAULT_PALETTE: Palette = {
  0: '#0b1220',
  1: '#475569',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#3b82f6',
};

export const WOOD_PALETTE: Palette = {
  0: '#ca9000',
  1: '#468031',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#3b82f6',
};

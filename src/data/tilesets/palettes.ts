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

/** FRLG outdoor: mint grass, a tree-green border, the pond's blue. */
export const FRLG_OUTDOOR_PALETTE: Palette = {
  0: '#a0e0c0',
  1: '#4a8f3a',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#5aa0d8',
};

/** FRLG forest: light grass under a dense dark-canopy border. */
export const FRLG_FOREST_PALETTE: Palette = {
  0: '#bbd896',
  1: '#3f7a45',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#5aa0d8',
};

/** FRLG cave: grey rock under a dark boulder border. */
export const FRLG_CAVE_PALETTE: Palette = {
  0: '#8c8d88',
  1: '#4b5654',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#485772',
};

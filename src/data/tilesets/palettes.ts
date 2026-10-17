/** Fallback flat colours, one per map value, used when an atlas is unavailable. */
export type Palette = Readonly<Record<number, string>>;

/** FRLG forest: the darker forest ground under a dense dark-canopy border. */
export const FRLG_FOREST_PALETTE: Palette = {
  0: '#58a080',
  1: '#3f7a45',
  2: '#94a3b8',
  3: '#f87171',
  4: '#d97706',
  5: '#34d399',
  6: '#5aa0d8',
};

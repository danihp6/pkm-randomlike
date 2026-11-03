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

/**
 * FRLG city: grey pavement, tan streets and white plazas under a pale building
 * facade, a coral roof, a blue doorway, the pond and a wooden signpost.
 */
export const FRLG_CITY_PALETTE: Palette = {
  0: '#8f8c88',
  1: '#a7b3c2',
  6: '#5aa0d8',
  8: '#4f9a63',
  12: '#c6b486',
  13: '#ccd3d8',
  14: '#c85a4e',
  15: '#4a7fbb',
  16: '#a08a68',
};

/** FRLG interior (provisional art): plank floor, plaster wall and its four fixtures. */
export const FRLG_INTERIOR_PALETTE: Palette = {
  0: '#bcb193',
  1: '#cfd6dd',
  15: '#4a3a3a',
  17: '#a8905a',
  18: '#d8d4d2',
  19: '#8f97a6',
};

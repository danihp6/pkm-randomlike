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

/**
 * The laboratory: its grey diagonal floor and cream wall under the red door mat,
 * the wooden counter, the healing machine's screen and the grey PC.
 */
export const FRLG_LAB_PALETTE: Palette = {
  0: '#c2c6cc',
  1: '#dcd8b8',
  15: '#c8443c',
  17: '#cbbd8c',
  18: '#9fd06c',
  19: '#4a5568',
};

/**
 * The Pokémon Centre: its cream-yellow checkered floor, the red counter run, the
 * green healing screen and the blue storage PC.
 */
export const FRLG_CENTRE_PALETTE: Palette = {
  0: '#e2dcae',
  1: '#f0e6bc',
  15: '#c8503c',
  17: '#c8503c',
  18: '#68c840',
  19: '#4878c0',
};

/** A house: its wooden floor and white wall over the wooden furniture and a dark PC. */
export const FRLG_HOUSE_PALETTE: Palette = {
  0: '#c09a62',
  1: '#eceded',
  15: '#8c5a30',
  17: '#b08a52',
  18: '#8ec470',
  19: '#546074',
};

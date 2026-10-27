import {
  PORTRAIT_ATLAS_URL,
  PORTRAIT_COLS,
  PORTRAIT_SHINY_ATLAS_URL,
  PORTRAIT_SHINY_TEXTURE_KEY,
  PORTRAIT_SIZE,
  portraitFor,
} from '../../data/portraits';

/** One party/starter portrait as the DOM draws it: an atlas cell, not a texture read. */
export type PortraitCrop = Readonly<{
  /** The portrait atlas URL (`PORTRAIT_ATLAS_URL`, or the shiny sheet when the atlas has that cell). */
  url: string;
  /** The cell's column and row in the atlas. */
  col: number;
  row: number;
  /** The atlas's column count, so a renderer can size the whole sheet. */
  cols: number;
  /** The atlas's cell size in px (`PORTRAIT_SIZE`, 64). */
  cell: number;
}>;

/** The species' portrait cell, or null when the atlas has none (the box stays a box). */
export function portraitCrop(speciesId: string, shiny = false): PortraitCrop | null {
  if (speciesId.length === 0) return null;
  const portrait = portraitFor(speciesId, shiny);
  if (portrait === null) return null;
  return {
    url: portrait.key === PORTRAIT_SHINY_TEXTURE_KEY ? PORTRAIT_SHINY_ATLAS_URL : PORTRAIT_ATLAS_URL,
    col: portrait.frame % PORTRAIT_COLS,
    row: Math.floor(portrait.frame / PORTRAIT_COLS),
    cols: PORTRAIT_COLS,
    cell: PORTRAIT_SIZE,
  };
}

/** The inline style a `box`-px square needs to show exactly that cell. */
export function portraitBackground(
  crop: PortraitCrop,
  box: number,
): Readonly<{
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  backgroundRepeat: 'no-repeat';
  imageRendering: 'pixelated';
}> {
  const size = Number.isFinite(box) && box > 0 ? box : 0;
  return {
    backgroundImage: `url("${crop.url}")`,
    backgroundPosition: `${-crop.col * size}px ${-crop.row * size}px`,
    backgroundSize: `${crop.cols * size}px auto`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  };
}

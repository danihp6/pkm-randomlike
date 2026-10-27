import { describe, expect, it } from 'vitest';
import manifest from '../../data/anil/pokemon-sprites.json';
import {
  PORTRAIT_ATLAS_URL,
  PORTRAIT_COLS,
  PORTRAIT_SHINY_ATLAS_URL,
  PORTRAIT_SIZE,
  portraitFor,
} from '../../data/portraits';
import { portraitBackground, portraitCrop } from './portrait';

const NORMAL = manifest.portraits.normal as unknown as Readonly<Record<string, number>>;
const SHINY = manifest.portraits.shiny as unknown as Readonly<Record<string, number>>;

/** A species the manifest itself names, with a cell outside the atlas's first row. */
const ROWED = Object.entries(NORMAL).find(([, frame]) => frame >= PORTRAIT_COLS * 2)!;
const PLAIN = 'bulbasaur';
const CELLS = Object.keys(NORMAL);

describe('portraitCrop', () => {
  it('derives the cell from the manifest’s own frame, not from a guessed index', () => {
    const [speciesId, frame] = ROWED;
    const crop = portraitCrop(speciesId)!;

    expect(portraitFor(speciesId)?.frame).toBe(frame);
    expect(crop.col).toBe(frame % PORTRAIT_COLS);
    expect(crop.row).toBe(Math.floor(frame / PORTRAIT_COLS));
    expect(crop.row).toBeGreaterThanOrEqual(2);
    expect(crop.cols).toBe(PORTRAIT_COLS);
    expect(crop.cell).toBe(PORTRAIT_SIZE);
    expect(crop.url).toBe(PORTRAIT_ATLAS_URL);
  });

  it('names the atlas’s first cell for the first species of the manifest', () => {
    expect(portraitCrop(PLAIN)).toEqual({
      url: PORTRAIT_ATLAS_URL,
      col: NORMAL[PLAIN]! % PORTRAIT_COLS,
      row: Math.floor(NORMAL[PLAIN]! / PORTRAIT_COLS),
      cols: PORTRAIT_COLS,
      cell: PORTRAIT_SIZE,
    });
  });

  it('reads the shiny sheet where the atlas has that cell', () => {
    const plain = portraitCrop(PLAIN, false)!;
    const shiny = portraitCrop(PLAIN, true)!;

    expect(SHINY[PLAIN]).toBeDefined();
    expect(shiny).not.toEqual(plain);
    expect(shiny.url).toBe(PORTRAIT_SHINY_ATLAS_URL);
    expect(shiny.col).toBe(SHINY[PLAIN]! % PORTRAIT_COLS);
    expect(shiny.row).toBe(Math.floor(SHINY[PLAIN]! / PORTRAIT_COLS));
    expect(portraitCrop(PLAIN)).toEqual(plain);
  });

  it('answers null for an empty id, an unknown id and a Mega the atlas does not name', () => {
    expect(portraitCrop('')).toBeNull();
    expect(portraitCrop('missingno')).toBeNull();
    expect(CELLS).not.toContain('venusaur-mega-x');
    expect(portraitCrop('venusaur-mega-x')).toBeNull();
    expect(portraitCrop('Mega Venusaur')).toBeNull();
  });

  it('never throws on a nameless id and stays a pure function', () => {
    expect(() => portraitCrop('   ')).not.toThrow();
    expect(portraitCrop(PLAIN)).toEqual(portraitCrop(PLAIN));
  });
});

describe('portraitBackground', () => {
  it('scales the whole sheet so one cell fills the 26 px desk box', () => {
    const crop = portraitCrop(PLAIN)!;

    expect(portraitBackground(crop, 26)).toEqual({
      backgroundImage: `url("${PORTRAIT_ATLAS_URL}")`,
      backgroundPosition: `${-crop.col * 26}px ${-crop.row * 26}px`,
      backgroundSize: `${PORTRAIT_COLS * 26}px auto`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
    });
  });

  it('scales the same way into the 22 px compact box', () => {
    const [speciesId] = ROWED;
    const crop = portraitCrop(speciesId)!;
    const compact = portraitBackground(crop, 22);

    expect(compact.backgroundSize).toBe(`${PORTRAIT_COLS * 22}px auto`);
    expect(compact.backgroundPosition).toBe(`${-crop.col * 22}px ${-crop.row * 22}px`);
    expect(compact.backgroundImage).toBe(`url("${PORTRAIT_ATLAS_URL}")`);
  });

  it('scales the same way into the 45 px party card cell', () => {
    const [speciesId] = ROWED;
    const crop = portraitCrop(speciesId)!;
    const party = portraitBackground(crop, 45);

    expect(party.backgroundSize).toBe(`${PORTRAIT_COLS * 45}px auto`);
    expect(party.backgroundPosition).toBe(`${-crop.col * 45}px ${-crop.row * 45}px`);
    expect(party.backgroundImage).toBe(`url("${PORTRAIT_ATLAS_URL}")`);
    expect(party.backgroundRepeat).toBe('no-repeat');
    expect(party.imageRendering).toBe('pixelated');
  });

  it('keeps a broken box out of the style strings', () => {
    const crop = portraitCrop(PLAIN)!;

    for (const box of [Number.NaN, Number.POSITIVE_INFINITY, -4]) {
      const bag = portraitBackground(crop, box);
      expect(bag.backgroundPosition).toBe('0px 0px');
      expect(bag.backgroundSize).toBe('0px auto');
      expect(Object.values(bag).join(' ')).not.toContain('NaN');
    }
  });
});

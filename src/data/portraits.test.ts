import { describe, expect, it } from 'vitest';
import species from './dex/species.json';
import {
  PORTRAIT_COLS,
  PORTRAIT_SHINY_TEXTURE_KEY,
  PORTRAIT_SIZE,
  PORTRAIT_TEXTURE_KEY,
  portraitFor,
} from './portraits';

describe('portraitFor', () => {
  it('resolves a dex entry to its atlas cell', () => {
    const portrait = portraitFor('bulbasaur');
    expect(portrait).not.toBeNull();
    expect(portrait!.key).toBe(PORTRAIT_TEXTURE_KEY);
    expect(portrait!.frame).toBeGreaterThanOrEqual(0);
  });

  it('returns null for an id the atlas does not know', () => {
    expect(portraitFor('missingno')).toBeNull();
  });

  it('uses the shiny atlas when asked for it', () => {
    const shiny = portraitFor('pikachu', true);
    expect(shiny).not.toBeNull();
    expect(shiny!.key).toBe(PORTRAIT_SHINY_TEXTURE_KEY);
    expect(shiny!.frame).toBe(portraitFor('pikachu')!.frame);
  });

  it('covers every dex entry, so no member falls back to a placeholder', () => {
    const missing = species.filter((entry) => portraitFor(entry.id) === null).map((entry) => entry.id);
    expect(missing).toEqual([]);
  });

  it('is a 64px grid, 32 columns wide', () => {
    expect(PORTRAIT_SIZE).toBe(64);
    expect(PORTRAIT_COLS).toBe(32);
  });
});

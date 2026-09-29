import { describe, expect, it } from 'vitest';
import { PORTRAIT_FRAMES, PORTRAIT_SIZE, portraitFrameFor } from './portraits';

describe('portrait frames', () => {
  it('maps a species to its National Dex row', () => {
    expect(portraitFrameFor('bulbasaur')).toBe(0);
    expect(portraitFrameFor('charmander')).toBe(3);
    expect(portraitFrameFor('squirtle')).toBe(6);
    expect(portraitFrameFor('pikachu')).toBe(24);
  });

  it('covers the high dex numbers the atlas holds', () => {
    expect(portraitFrameFor('meloetta')).toBe(647);
  });

  it('returns null outside the atlas or for an unknown id', () => {
    expect(portraitFrameFor('not-a-pokemon')).toBeNull();
    expect(portraitFrameFor('sprigatito')).toBeNull();
  });

  it('declares the 40px atlas with its 649 rows', () => {
    expect(PORTRAIT_SIZE).toBe(40);
    expect(PORTRAIT_FRAMES).toBe(649);
  });
});

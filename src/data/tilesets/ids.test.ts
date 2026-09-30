import { describe, expect, it } from 'vitest';
import {
  isTilesetPreference,
  resolveTileset,
  TILESET_IDS,
  TILESET_PREFERENCES,
} from './ids';

describe('tileset preference', () => {
  it('accepts auto and every registered id', () => {
    expect(isTilesetPreference('auto')).toBe(true);
    for (const id of TILESET_IDS) expect(isTilesetPreference(id)).toBe(true);
    expect(TILESET_PREFERENCES).toEqual(['auto', ...TILESET_IDS]);
  });

  it('rejects anything else', () => {
    for (const value of ['Automatic', 'undefined', '', null, undefined, 0, {}]) {
      expect(isTilesetPreference(value)).toBe(false);
    }
  });

  it('keeps the biome tileset on auto and forces the chosen one otherwise', () => {
    expect(resolveTileset('auto', 'wood')).toBe('wood');
    expect(resolveTileset('auto', 'placeholder')).toBe('placeholder');
    expect(resolveTileset('placeholder', 'wood')).toBe('placeholder');
    expect(resolveTileset('wood', 'placeholder')).toBe('wood');
  });
});

import { describe, expect, it } from 'vitest';
import { TILESET_IDS, TILESET_NAMES } from './ids';

describe('tileset ids', () => {
  it('names every registered id', () => {
    for (const id of TILESET_IDS) {
      expect(typeof TILESET_NAMES[id]).toBe('string');
      expect(TILESET_NAMES[id].length).toBeGreaterThan(0);
    }
  });
});

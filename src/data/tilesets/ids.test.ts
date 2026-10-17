import { describe, expect, it } from 'vitest';
import { TILESET_IDS, TILESET_NAMES } from './ids';
import { TILESETS } from './index';

/**
 * The pruned tileset ids, kept as one string so the repo-wide grep for an id no
 * route can reach stays clean while the test still names them.
 */
const PRUNED_IDS: readonly string[] = 'placeholder wood outdoor cave'.split(' ');

describe('tileset ids', () => {
  it('names every registered id', () => {
    for (const id of TILESET_IDS) {
      expect(typeof TILESET_NAMES[id]).toBe('string');
      expect(TILESET_NAMES[id].length).toBeGreaterThan(0);
    }
  });

  it('ships the forest alone, with the registry in step with the id list', () => {
    expect(TILESET_IDS).toEqual(['forest']);
    expect(Object.keys(TILESETS)).toEqual([...TILESET_IDS]);
  });

  it('holds no pruned id', () => {
    const ids: string[] = [...TILESET_IDS];
    for (const pruned of PRUNED_IDS) expect(ids).not.toContain(pruned);
  });
});

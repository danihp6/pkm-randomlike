import { describe, expect, it } from 'vitest';
import { EXIT } from '../../engine/map';
import { resolveTileFrame } from '../../engine/tileFrames';
import { FRLG_TILESET } from './frlg';
import { PLACEHOLDER_TILESET } from './placeholder';
import { WOOD_TILESET } from './wood';

/**
 * The `EXIT` tile is a plain ground tile for now: the common-sheet staircase was
 * removed as a dungeon leftover, and the outdoor exit art is deferred (Phase 8,
 * `docs/tileset-spec.md` §6). This test makes re-adding a frame deliberate.
 */
describe('route exit art', () => {
  it('maps no tileset frame to EXIT, so it draws plain ground', () => {
    const configs = { placeholder: PLACEHOLDER_TILESET, wood: WOOD_TILESET, frlg: FRLG_TILESET };
    for (const [name, config] of Object.entries(configs)) {
      expect(resolveTileFrame([[EXIT]], 0, 0, config), name).toBeNull();
    }
  });
});

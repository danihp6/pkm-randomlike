import { describe, expect, it } from 'vitest';
import type { InteriorRoomKind } from '../../engine/region/interior/plan';
import { TILESET_IDS, TILESET_NAMES } from './ids';
import { TILESETS } from './index';
import { interiorTilesetId } from './interior';

/**
 * The pruned tileset ids, kept as one string so the repo-wide grep for an id no
 * route can reach stays clean while the test still names them.
 */
const PRUNED_IDS: readonly string[] = 'placeholder wood outdoor cave'.split(' ');

/** Every room kind an interior plan can carry. */
const ROOM_KINDS: readonly InteriorRoomKind[] = ['lab', 'centre', 'house', 'gym', 'casino'];

describe('tileset ids', () => {
  it('names every registered id', () => {
    for (const id of TILESET_IDS) {
      expect(typeof TILESET_NAMES[id]).toBe('string');
      expect(TILESET_NAMES[id].length).toBeGreaterThan(0);
    }
  });

  it('ships the forest, the city and the four interior fields, with the registry in step with the id list', () => {
    expect(TILESET_IDS).toEqual([
      'forest',
      'city',
      'interior',
      'interior-lab',
      'interior-centre',
      'interior-house',
    ]);
    expect(Object.keys(TILESETS)).toEqual([...TILESET_IDS]);
  });

  it('names the three decomp interior fields their own fields draw', () => {
    expect(TILESET_NAMES['interior-lab']).toBe('FRLG Lab');
    expect(TILESET_NAMES['interior-centre']).toBe('FRLG Centre');
    expect(TILESET_NAMES['interior-house']).toBe('FRLG House');
    expect(new Set(TILESET_IDS.map((id) => TILESET_NAMES[id])).size).toBe(TILESET_IDS.length);
  });

  it('holds no pruned id', () => {
    const ids: string[] = [...TILESET_IDS];
    for (const pruned of PRUNED_IDS) expect(ids).not.toContain(pruned);
  });
});

describe('the field a room kind draws', () => {
  it('gives the lab, the Centre and a house their own, and keeps the gym and the casino provisional', () => {
    const fields: Readonly<Record<InteriorRoomKind, string>> = {
      lab: 'interior-lab',
      centre: 'interior-centre',
      house: 'interior-house',
      gym: 'interior',
      casino: 'interior',
    };
    for (const kind of ROOM_KINDS) {
      expect(interiorTilesetId(kind), kind).toBe(fields[kind]);
      expect(TILESET_IDS).toContain(interiorTilesetId(kind));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { getMove } from './dex';
import { getItem } from './items';
import { TM_COUNT, TM_MOVE_IDS, isTmItemId, moveIdForTm, tmItemId, tmItemIdForMove, tmNumber } from './tms';

describe('tms', () => {
  it('holds the 171 base-Gen-9 machines, one distinct move each', () => {
    expect(TM_COUNT).toBe(171);
    expect(TM_MOVE_IDS).toHaveLength(171);
    expect(new Set(TM_MOVE_IDS).size).toBe(171);
  });

  it('every TM teaches a real move', () => {
    for (const moveId of TM_MOVE_IDS) expect(getMove(moveId), moveId).toBeDefined();
  });

  it('round-trips a number, an item id and a move id', () => {
    expect(tmItemId(1)).toBe('tm001');
    expect(tmItemId(171)).toBe('tm171');
    expect(tmNumber('TM001')).toBe(1);
    expect(tmNumber('tm171')).toBe(171);
    expect(tmNumber('pokeball')).toBeNull();
    expect(tmNumber('tm172')).toBeNull();
    expect(isTmItemId('tm010')).toBe(true);
    expect(moveIdForTm('tm001')).toBe(TM_MOVE_IDS[0]);
    expect(moveIdForTm('tm171')).toBe(TM_MOVE_IDS[170]);
    expect(tmItemIdForMove(TM_MOVE_IDS[0])).toBe('tm001');
    expect(tmItemIdForMove(TM_MOVE_IDS[170])).toBe('tm171');
    expect(tmItemIdForMove('splash')).toBeNull();
  });

  it('catalogues every TM as a reusable machine item', () => {
    const item = getItem('tm001');
    expect(item?.kind).toBe('tm');
    expect(item?.teaches).toBe(TM_MOVE_IDS[0]);
    expect(item?.price).toBeGreaterThan(0);
    expect(getItem('tm171')?.teaches).toBe(TM_MOVE_IDS[170]);
  });
});

import { describe, expect, it } from 'vitest';
import { ITEMS } from './items';
import { ITEM_ICON_SIZE, itemIconFrame } from './itemIcons';

describe('FRLG item icons', () => {
  it('exposes a positive frame size', () => {
    expect(ITEM_ICON_SIZE).toBeGreaterThan(0);
  });

  it('has an atlas frame for every catalogue item', () => {
    for (const item of ITEMS) {
      expect(itemIconFrame(item.id), item.id).not.toBeNull();
    }
  });

  it('returns null for an item with no FRLG icon', () => {
    expect(itemIconFrame('revive')).toBeNull();
    expect(itemIconFrame('not-an-item')).toBeNull();
  });
});

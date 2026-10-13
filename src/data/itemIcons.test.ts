import { describe, expect, it } from 'vitest';
import { ITEMS } from './items';
import { ITEM_ICON_SIZE, hasItemIcon, itemIconFrame } from './itemIcons';

/** The two fallback keys `itemIcons.ts` resolves through. */
const MEGA_FALLBACK = 'hardstone';
const TM_FALLBACK = 'machinenormal';

/**
 * Añil's `Graphics/Items/` ships seventeen typed Memories and no Normal Memory
 * (`PBS/items.txt` names seventeen `Disco <type>` and two unrelated discs), so
 * `normalmemory` is the one catalogue row the atlas cannot draw. It stays in the
 * catalogue because the Silvally retype maps all eighteen; the gap is named here
 * rather than papered over with a borrowed icon.
 */
const NO_ART = new Set(['normalmemory']);

describe('Añil item icons', () => {
  it('keeps a 24px frame, so every draw site keeps its geometry', () => {
    expect(ITEM_ICON_SIZE).toBe(24);
  });

  it('has an atlas frame for every catalogue item', () => {
    for (const item of ITEMS) {
      if (NO_ART.has(item.id)) continue;
      expect(itemIconFrame(item.id), item.id).not.toBeNull();
    }
  });

  it("carries the item's own icon for everything but the TMs, the Mega Stones and the Normal Memory", () => {
    for (const item of ITEMS) {
      if (item.kind === 'tm' || item.mega !== undefined) continue;
      expect(hasItemIcon(item.id), item.id).toBe(!NO_ART.has(item.id));
    }
  });

  it('falls back inside the same atlas for a Mega Stone and a TM', () => {
    expect(itemIconFrame('venusaurite')).toBe(itemIconFrame(MEGA_FALLBACK));
    expect(itemIconFrame('tm001')).toBe(itemIconFrame(TM_FALLBACK));
    expect(hasItemIcon('venusaurite')).toBe(false);
    expect(hasItemIcon('tm001')).toBe(false);
  });

  it('keeps a stone whose Añil spelling matches its own icon', () => {
    expect(hasItemIcon('abomasite')).toBe(true);
  });

  it('returns null for an id the Añil atlas does not carry', () => {
    expect(itemIconFrame('not-an-item')).toBeNull();
    expect(itemIconFrame('masterballx')).toBeNull();
    expect(hasItemIcon('not-an-item')).toBe(false);
  });

  it('resolves any Añil file name, catalogue row or not', () => {
    // The atlas is Añil's whole icon set, so an id with no catalogue row still
    // resolves when the file exists (the run never draws it).
    expect(itemIconFrame('revive')).toBe(itemIconFrame('REVIVE'));
    expect(itemIconFrame('revive')).not.toBeNull();
  });
});

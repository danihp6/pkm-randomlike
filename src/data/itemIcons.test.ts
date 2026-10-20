import { describe, expect, it } from 'vitest';
import { getMove, normalizeId } from './dex';
import { ITEMS, TM_ITEM_IDS, getItem } from './items';
import { ITEM_ICON_SIZE, hasItemIcon, itemIconFrame } from './itemIcons';
import { tmItemIdForMove } from './tms';

/** The three fallback keys `itemIcons.ts` resolves through. */
const MEGA_FALLBACK = 'hardstone';
const TM_FALLBACK = 'machinenormal';
const EGG_FALLBACK = 'luckyegg';

describe('Añil item icons', () => {
  it('keeps a 24px frame, so every draw site keeps its geometry', () => {
    expect(ITEM_ICON_SIZE).toBe(24);
  });

  it('has an atlas frame for every catalogue item', () => {
    for (const item of ITEMS) expect(itemIconFrame(item.id), item.id).not.toBeNull();
  });

  it("carries the item's own icon for everything but the TMs, the stones and the Egg", () => {
    for (const item of ITEMS) {
      if (item.kind === 'tm' || item.mega !== undefined || item.gmax !== undefined) continue;
      // The Añil atlas carries no `EGG.png`: the Egg resolves through `LUCKYEGG.png`.
      if (item.id === 'egg') continue;
      // A hand-authored row states the frame it borrows; it has no art of its own.
      if (item.iconFallback !== undefined) continue;
      expect(hasItemIcon(item.id), item.id).toBe(true);
    }
  });

  it('fell back inside the atlas for a Mega Stone, a G-Max Stone, a TM, the Egg and the dish', () => {
    expect(itemIconFrame('venusaurite')).toBe(itemIconFrame(MEGA_FALLBACK));
    expect(itemIconFrame('gengariteg')).toBe(itemIconFrame(MEGA_FALLBACK));
    expect(itemIconFrame('tm001')).toBe(itemIconFrame(TM_FALLBACK));
    expect(itemIconFrame('egg')).toBe(itemIconFrame(EGG_FALLBACK));
    expect(itemIconFrame('chefstew')).toBe(itemIconFrame('lavacookie'));
    expect(hasItemIcon('venusaurite')).toBe(false);
    expect(hasItemIcon('gengariteg')).toBe(false);
    expect(hasItemIcon('tm001')).toBe(false);
    expect(hasItemIcon('egg')).toBe(false);
    expect(hasItemIcon('chefstew')).toBe(false);
  });

  it('resolves every TM to the machine of the move it teaches', () => {
    // Take Down, a Normal move, so the shared boot frame is literally its own.
    expect(itemIconFrame('tm001')).toBe(itemIconFrame('machinenormal'));
    expect(itemIconFrame(tmItemIdForMove('flamethrower')!)).toBe(itemIconFrame('machinefire'));
    expect(itemIconFrame(tmItemIdForMove('thunderbolt')!)).toBe(itemIconFrame('machineelectric'));
    for (const id of TM_ITEM_IDS) {
      const move = getMove(getItem(id)!.teaches!)!;
      expect(itemIconFrame(id), id).toBe(itemIconFrame(`machine${normalizeId(move.type)}`));
    }
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

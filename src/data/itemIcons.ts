import itemIconsUrl from '../assets/anil/item-icons.png';
import manifest from './anil/item-icons.json';
import { getMove, normalizeId } from './dex';
import { getItem } from './items';

/**
 * The Añil item icon atlas (`src/assets/anil/item-icons.png`), packed by
 * `scripts/anil/build-item-icons.mjs` from the fangame's own `Graphics/Items/`
 * 48x48 icons into 24px frames (8 columns, nearest-neighbour). The manifest
 * (`src/data/anil/item-icons.json`) is keyed by the **normalised** Añil file name,
 * so a catalogue id that matches a file gets its own art with no table to keep.
 * Local-only art — see `docs/art-direction.md`.
 */
export const ITEM_ICON_ATLAS_URL = itemIconsUrl;
export const ITEM_ICON_TEXTURE_KEY = 'anil:item-icons';
export const ITEM_ICON_SIZE = manifest.size;

const FRAMES: Readonly<Record<string, number>> = manifest.frames;

// Añil ships no art for the Mega Stones or the G-Max Stones (the packer predates
// both families and `D34`/`D44` add one per forme), so a stone whose spelling does
// not match a file borrows the Hard Stone icon. The **TMs** (`D36` learnset)
// resolve to the machine of the move they teach — the atlas already carries Añil's
// whole `machine_<TYPE>` set, so every machine shows its own type. A TM whose move
// or type frame is missing still lands on the Normal machine.
const MEGA_STONE_FALLBACK = 'hardstone';
const TM_FALLBACK = 'machinenormal';

/** The atlas frame for a run item, or null when the atlas has no icon for it. */
export function itemIconFrame(itemId: string): number | null {
  const frame = FRAMES[normalizeId(itemId)];
  if (frame !== undefined) return frame;
  const item = getItem(itemId);
  if (item?.mega || item?.gmax) return FRAMES[MEGA_STONE_FALLBACK] ?? null;
  if (item?.kind === 'tm') {
    const type = normalizeId(getMove(item.teaches ?? '')?.type ?? '');
    return FRAMES[`machine${type}`] ?? FRAMES[TM_FALLBACK] ?? null;
  }
  return null;
}

/** True when the atlas itself carries the item's own icon (no fallback). */
export function hasItemIcon(itemId: string): boolean {
  return FRAMES[normalizeId(itemId)] !== undefined;
}

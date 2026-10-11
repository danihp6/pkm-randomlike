import itemIconsUrl from '../assets/frlg/item-icons.png';
import { getItem } from './items';
import manifest from './frlg/item-icons.json';

/**
 * The FireRed/LeafGreen item icon atlas (`src/assets/frlg/item-icons.png`),
 * packed by `scripts/frlg/build-item-icons.mjs` into 24px frames. The manifest
 * maps each id in `src/data/items.ts` to its frame, so several items share one
 * icon (Super/Hyper Potion, the status heals, the X items). Local-only art —
 * see `docs/art-direction.md`.
 */
export const ITEM_ICON_ATLAS_URL = itemIconsUrl;
export const ITEM_ICON_TEXTURE_KEY = 'frlg:item-icons';
export const ITEM_ICON_SIZE = manifest.size;

const FRAMES: Readonly<Record<string, number>> = manifest.items;

// No FRLG art exists for the Mega Stones; they borrow the Hard Stone icon until
// a real sprite lands (the packer in `scripts/frlg/build-item-icons.mjs` predates
// them, and `D34` adds one per Mega). The **valuables** the Poké Dollar economy
// adds (`D33`) borrow the same ore icon until treasure art lands (Phase 8). The
// **TMs** (Phase 9 learnset) share the sheet's question mark until a machine
// icon is sliced out of `sprite-sources/frlg-ui/items.png`.
const MEGA_STONE_FALLBACK = 'hardstone';
const VALUABLE_FALLBACK = 'hardstone';
const TM_FALLBACK = 'fairyfeather';
// The Plates (D37) borrow the same ore icon until plate art lands.
const PLATE_FALLBACK = 'hardstone';

/** The atlas frame for a run item, or null when it has no FRLG icon. */
export function itemIconFrame(itemId: string): number | null {
  const frame = FRAMES[itemId];
  if (frame !== undefined) return frame;
  const item = getItem(itemId);
  if (item?.mega) return FRAMES[MEGA_STONE_FALLBACK] ?? null;
  if (item?.kind === 'valuable') return FRAMES[VALUABLE_FALLBACK] ?? null;
  if (item?.kind === 'tm') return FRAMES[TM_FALLBACK] ?? null;
  if (item?.plate) return FRAMES[PLATE_FALLBACK] ?? null;
  return null;
}

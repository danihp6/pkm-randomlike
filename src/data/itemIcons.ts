import itemIconsUrl from '../assets/frlg/item-icons.png';
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

/** The atlas frame for a run item, or null when it has no FRLG icon. */
export function itemIconFrame(itemId: string): number | null {
  return FRAMES[itemId] ?? null;
}

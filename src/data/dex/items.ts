import itemsData from './items.json';
import { normalizeId } from './species';

/** The dex's own item row: what a run item's text and berry data come from. */
export type DexItem = Readonly<{
  id: string;
  num: number;
  name: string;
  desc: string;
  shortDesc: string;
  isBerry?: boolean;
  isNonstandard: string | null;
  /** A berry's Natural Gift type and power (`D37`; Task-23 reads it). */
  naturalGift?: Readonly<{ basePower: number; type: string }>;
}>;

// The generated JSON is cast once here; `items.test.ts` guards the shape. The
// generator only keeps `isNonstandard === null` rows, so every entry is playable.
const ALL_ITEMS = itemsData as unknown as readonly DexItem[];

const BY_ID = new Map<string, DexItem>(ALL_ITEMS.map((item) => [item.id, item]));

export function getDexItem(id: string): DexItem | undefined {
  return BY_ID.get(normalizeId(id));
}

export function allDexItems(): readonly DexItem[] {
  return ALL_ITEMS;
}

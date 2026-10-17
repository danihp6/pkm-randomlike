import { getItem, type ItemKind } from '../data/items';
import type { BagCounts } from '../engine/run';

/**
 * The bag's pockets, in the order the HUD's FRLG tab strip shows them. The run
 * catalogue produces `equipment` (held items), `consumable` (heals, status cures
 * and boosts), `machine` (the TMs in `src/data/tms.ts`), `ball` and `valuable`
 * (treasure to sell).
 */
export type BagCategory = 'equipment' | 'consumable' | 'machine' | 'ball' | 'valuable';

export const BAG_CATEGORIES: readonly BagCategory[] = [
  'equipment',
  'consumable',
  'machine',
  'ball',
  'valuable',
];

export const BAG_CATEGORY_LABELS: Readonly<Record<BagCategory, string>> = {
  equipment: 'EQUIP',
  consumable: 'CONSUM',
  machine: 'MT/MO',
  ball: 'BALL',
  valuable: 'VALUE',
};

/** The pocket an item kind belongs to; a kind never lands in two pockets. */
export function bagCategoryForKind(kind: ItemKind): BagCategory {
  switch (kind) {
    case 'ball':
      return 'ball';
    case 'held':
      return 'equipment';
    case 'valuable':
      return 'valuable';
    case 'tm':
      return 'machine';
    case 'heal':
    case 'status':
    case 'boost':
      return 'consumable';
  }
}

/** The pocket a run item belongs to, or null when the catalogue has no such id. */
export function bagCategoryFor(itemId: string): BagCategory | null {
  const item = getItem(itemId);
  return item ? bagCategoryForKind(item.kind) : null;
}

/** The bag stacks in `category`, preserving the bag's own order. */
export function bagForCategory(
  bag: readonly BagCounts[],
  category: BagCategory,
): readonly BagCounts[] {
  return bag.filter((stack) => bagCategoryFor(stack.itemId) === category);
}

/** The pocket `offset` steps from `category`, wrapping through the whole list. */
export function cycleBagCategory(category: BagCategory, offset: number): BagCategory {
  const index = BAG_CATEGORIES.indexOf(category);
  const next = (index + offset + BAG_CATEGORIES.length) % BAG_CATEGORIES.length;
  return BAG_CATEGORIES[next];
}

/** The bag row cursor after `delta`, wrapping; 0 for an empty list. */
export function stepBagCursor(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const from = Number.isFinite(index) ? Math.trunc(index) : 0;
  const current = Math.min(Math.max(0, from), count - 1);
  return (((current + delta) % count) + count) % count;
}

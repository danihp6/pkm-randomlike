import { describe, expect, it } from 'vitest';
import { BAG_CATEGORIES, bagCategoryFor, bagForCategory, cycleBagCategory, stepBagCursor } from './bag';

describe('bagCategoryFor', () => {
  it('maps each item kind to its pocket', () => {
    expect(bagCategoryFor('pokeball')).toBe('ball');
    expect(bagCategoryFor('greatball')).toBe('ball');
    expect(bagCategoryFor('potion')).toBe('consumable');
    expect(bagCategoryFor('paralyzeheal')).toBe('consumable');
    expect(bagCategoryFor('burnheal')).toBe('consumable');
    expect(bagCategoryFor('leftovers')).toBe('equipment');
    expect(bagCategoryFor('charcoal')).toBe('equipment');
    expect(bagCategoryFor('sitrusberry')).toBe('equipment');
    expect(bagCategoryFor('nugget')).toBe('valuable');
    expect(bagCategoryFor('cometshard')).toBe('valuable');
  });

  it('returns null for an id the catalogue does not carry', () => {
    expect(bagCategoryFor('tm01')).toBeNull();
  });
});

describe('bagForCategory', () => {
  const bag = [
    { itemId: 'pokeball', count: 5 },
    { itemId: 'potion', count: 2 },
    { itemId: 'charcoal', count: 1 },
    { itemId: 'greatball', count: 1 },
  ];

  it('keeps only the pocket stacks, in the bag order', () => {
    expect(bagForCategory(bag, 'ball').map((slot) => slot.itemId)).toEqual(['pokeball', 'greatball']);
    expect(bagForCategory(bag, 'consumable').map((slot) => slot.itemId)).toEqual(['potion']);
    expect(bagForCategory(bag, 'equipment').map((slot) => slot.itemId)).toEqual(['charcoal']);
  });

  it('has nothing to show for the empty machine pocket', () => {
    expect(bagForCategory(bag, 'machine')).toEqual([]);
  });
});

describe('cycleBagCategory', () => {
  it('wraps in both directions', () => {
    expect(cycleBagCategory('equipment', -1)).toBe('valuable');
    expect(cycleBagCategory('valuable', 1)).toBe('equipment');
    expect(cycleBagCategory('consumable', 1)).toBe('machine');
  });

  it('lists every pocket in tab order', () => {
    expect(BAG_CATEGORIES).toEqual(['equipment', 'consumable', 'machine', 'ball', 'valuable']);
  });
});

describe('stepBagCursor', () => {
  it('wraps in both directions', () => {
    expect(stepBagCursor(0, 1, 3)).toBe(1);
    expect(stepBagCursor(2, 1, 3)).toBe(0);
    expect(stepBagCursor(0, -1, 3)).toBe(2);
    expect(stepBagCursor(1, 0, 3)).toBe(1);
  });

  it('reads the first row for an empty list', () => {
    expect(stepBagCursor(0, 1, 0)).toBe(0);
    expect(stepBagCursor(4, -1, 0)).toBe(0);
  });
});

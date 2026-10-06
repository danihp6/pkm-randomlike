import { describe, expect, it } from 'vitest';
import { BAG_CATEGORIES, bagCategoryFor, bagForCategory, cycleBagCategory } from './bag';

describe('bagCategoryFor', () => {
  it('maps each item kind to its pocket', () => {
    expect(bagCategoryFor('pokeball')).toBe('ball');
    expect(bagCategoryFor('greatball')).toBe('ball');
    expect(bagCategoryFor('potion')).toBe('consumable');
    expect(bagCategoryFor('paralyzeheal')).toBe('consumable');
    expect(bagCategoryFor('xattack')).toBe('consumable');
    expect(bagCategoryFor('leftovers')).toBe('equipment');
    expect(bagCategoryFor('charcoal')).toBe('equipment');
    expect(bagCategoryFor('sitrusberry')).toBe('equipment');
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
    expect(cycleBagCategory('equipment', -1)).toBe('ball');
    expect(cycleBagCategory('ball', 1)).toBe('equipment');
    expect(cycleBagCategory('consumable', 1)).toBe('machine');
  });

  it('lists every pocket in tab order', () => {
    expect(BAG_CATEGORIES).toEqual(['equipment', 'consumable', 'machine', 'ball']);
  });
});

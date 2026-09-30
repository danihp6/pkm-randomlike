import type { BoostId, StatusId } from '../engine/battle/fighter';

export type ItemKind = 'ball' | 'heal' | 'status' | 'boost' | 'held';

export type ItemDef = Readonly<{
  id: string;
  name: string;
  kind: ItemKind;
  /**
   * Shop value in Poké Dollars. `0` marks an item the economy never sells
   * (the Master Ball); the between-route reward decides what is stocked.
   */
  price: number;
  /** Ball multiplier for the Gen 9 catch formula. */
  catchBonus?: number;
  /** Fixed HP restored. */
  healAmount?: number;
  /** Fraction of max HP restored, as `[numerator, denominator]`. */
  healFraction?: readonly [number, number];
  /** Primary statuses this cures; `'all'` clears whatever is there. */
  cures?: readonly StatusId[] | 'all';
  /** Stat stages granted to the active Pokémon. */
  boosts?: Partial<Record<BoostId, number>>;
  /** Held items: fire at the end of the turn only when HP is at or below this fraction. */
  below?: readonly [number, number];
  /** Held items: a single-use berry, removed from the holder once it fires. */
  consumed?: boolean;
  /** Held items: multiplies moves of `type` by `multiplier` (the 1.2x type items). */
  typeBoost?: Readonly<{ type: string; multiplier: number }>;
  shortDesc: string;
}>;

const item = (def: ItemDef): ItemDef => def;

/**
 * The run's item catalogue: balls, heal/status/boost consumables and `held`
 * items (Leftovers, berries, the 1.2x type items, registered by
 * `effects/items.ts`), each with the price the between-route reward spends.
 * There is no Revive anywhere (D5).
 */
export const ITEMS: readonly ItemDef[] = [
  item({ id: 'pokeball', name: 'Poke Ball', kind: 'ball', price: 200, catchBonus: 1, shortDesc: 'A device for catching wild Pokémon.' }),
  item({ id: 'premierball', name: 'Premier Ball', kind: 'ball', price: 200, catchBonus: 1, shortDesc: 'A commemorative Ball. The same catch rate as a Poke Ball.' }),
  item({ id: 'greatball', name: 'Great Ball', kind: 'ball', price: 600, catchBonus: 1.5, shortDesc: 'A good Ball with a higher catch rate than a Poke Ball.' }),
  item({ id: 'ultraball', name: 'Ultra Ball', kind: 'ball', price: 1200, catchBonus: 2, shortDesc: 'An ultra-performance Ball with a high catch rate.' }),
  item({ id: 'masterball', name: 'Master Ball', kind: 'ball', price: 0, catchBonus: 255, shortDesc: 'The best Ball. It never fails to catch.' }),

  item({ id: 'potion', name: 'Potion', kind: 'heal', price: 300, healAmount: 20, shortDesc: 'Restores 20 HP.' }),
  item({ id: 'superpotion', name: 'Super Potion', kind: 'heal', price: 700, healAmount: 60, shortDesc: 'Restores 60 HP.' }),
  item({ id: 'hyperpotion', name: 'Hyper Potion', kind: 'heal', price: 1200, healAmount: 120, shortDesc: 'Restores 120 HP.' }),
  item({ id: 'fullrestore', name: 'Full Restore', kind: 'heal', price: 3000, healFraction: [1, 1], cures: 'all', shortDesc: 'Fully restores HP and clears any status.' }),

  item({ id: 'antidote', name: 'Antidote', kind: 'status', price: 100, cures: ['psn', 'tox'], shortDesc: 'Cures poison.' }),
  item({ id: 'paralyzeheal', name: 'Paralyze Heal', kind: 'status', price: 200, cures: ['par'], shortDesc: 'Cures paralysis.' }),
  item({ id: 'awakening', name: 'Awakening', kind: 'status', price: 200, cures: ['slp'], shortDesc: 'Wakes a sleeping Pokémon.' }),
  item({ id: 'burnheal', name: 'Burn Heal', kind: 'status', price: 250, cures: ['brn'], shortDesc: 'Cures a burn.' }),
  item({ id: 'iceheal', name: 'Ice Heal', kind: 'status', price: 250, cures: ['frz'], shortDesc: 'Thaws a frozen Pokémon.' }),
  item({ id: 'fullheal', name: 'Full Heal', kind: 'status', price: 600, cures: 'all', shortDesc: 'Clears any status condition.' }),

  item({ id: 'xattack', name: 'X Attack', kind: 'boost', price: 500, boosts: { atk: 2 }, shortDesc: 'Raises Attack by 2 stages.' }),
  item({ id: 'xdefense', name: 'X Defense', kind: 'boost', price: 550, boosts: { def: 2 }, shortDesc: 'Raises Defense by 2 stages.' }),
  item({ id: 'xspeed', name: 'X Speed', kind: 'boost', price: 350, boosts: { spe: 2 }, shortDesc: 'Raises Speed by 2 stages.' }),

  item({ id: 'leftovers', name: 'Leftovers', kind: 'held', price: 4000, healFraction: [1, 16], shortDesc: 'Holder restores a little HP every turn.' }),
  item({ id: 'sitrusberry', name: 'Sitrus Berry', kind: 'held', price: 200, healFraction: [1, 4], below: [1, 2], consumed: true, shortDesc: 'Restores 1/4 max HP when HP is at or below half. Single use.' }),
  item({ id: 'oranberry', name: 'Oran Berry', kind: 'held', price: 100, healAmount: 10, below: [1, 2], consumed: true, shortDesc: 'Restores 10 HP when HP is at or below half. Single use.' }),
  item({ id: 'lumberry', name: 'Lum Berry', kind: 'held', price: 200, cures: 'all', consumed: true, shortDesc: 'Cures any status condition. Single use.' }),

  item({ id: 'silkscarf', name: 'Silk Scarf', kind: 'held', price: 1000, typeBoost: { type: 'Normal', multiplier: 1.2 }, shortDesc: 'Powers up Normal-type moves.' }),
  item({ id: 'charcoal', name: 'Charcoal', kind: 'held', price: 1000, typeBoost: { type: 'Fire', multiplier: 1.2 }, shortDesc: 'Powers up Fire-type moves.' }),
  item({ id: 'mysticwater', name: 'Mystic Water', kind: 'held', price: 1000, typeBoost: { type: 'Water', multiplier: 1.2 }, shortDesc: 'Powers up Water-type moves.' }),
  item({ id: 'miracleseed', name: 'Miracle Seed', kind: 'held', price: 1000, typeBoost: { type: 'Grass', multiplier: 1.2 }, shortDesc: 'Powers up Grass-type moves.' }),
  item({ id: 'magnet', name: 'Magnet', kind: 'held', price: 1000, typeBoost: { type: 'Electric', multiplier: 1.2 }, shortDesc: 'Powers up Electric-type moves.' }),
  item({ id: 'nevermeltice', name: 'Never-Melt Ice', kind: 'held', price: 1000, typeBoost: { type: 'Ice', multiplier: 1.2 }, shortDesc: 'Powers up Ice-type moves.' }),
  item({ id: 'blackbelt', name: 'Black Belt', kind: 'held', price: 1000, typeBoost: { type: 'Fighting', multiplier: 1.2 }, shortDesc: 'Powers up Fighting-type moves.' }),
  item({ id: 'poisonbarb', name: 'Poison Barb', kind: 'held', price: 1000, typeBoost: { type: 'Poison', multiplier: 1.2 }, shortDesc: 'Powers up Poison-type moves.' }),
  item({ id: 'softsand', name: 'Soft Sand', kind: 'held', price: 1000, typeBoost: { type: 'Ground', multiplier: 1.2 }, shortDesc: 'Powers up Ground-type moves.' }),
  item({ id: 'sharpbeak', name: 'Sharp Beak', kind: 'held', price: 1000, typeBoost: { type: 'Flying', multiplier: 1.2 }, shortDesc: 'Powers up Flying-type moves.' }),
  item({ id: 'twistedspoon', name: 'Twisted Spoon', kind: 'held', price: 1000, typeBoost: { type: 'Psychic', multiplier: 1.2 }, shortDesc: 'Powers up Psychic-type moves.' }),
  item({ id: 'silverpowder', name: 'Silver Powder', kind: 'held', price: 1000, typeBoost: { type: 'Bug', multiplier: 1.2 }, shortDesc: 'Powers up Bug-type moves.' }),
  item({ id: 'hardstone', name: 'Hard Stone', kind: 'held', price: 1000, typeBoost: { type: 'Rock', multiplier: 1.2 }, shortDesc: 'Powers up Rock-type moves.' }),
  item({ id: 'spelltag', name: 'Spell Tag', kind: 'held', price: 1000, typeBoost: { type: 'Ghost', multiplier: 1.2 }, shortDesc: 'Powers up Ghost-type moves.' }),
  item({ id: 'dragonfang', name: 'Dragon Fang', kind: 'held', price: 1000, typeBoost: { type: 'Dragon', multiplier: 1.2 }, shortDesc: 'Powers up Dragon-type moves.' }),
  item({ id: 'blackglasses', name: 'Black Glasses', kind: 'held', price: 1000, typeBoost: { type: 'Dark', multiplier: 1.2 }, shortDesc: 'Powers up Dark-type moves.' }),
  item({ id: 'metalcoat', name: 'Metal Coat', kind: 'held', price: 1000, typeBoost: { type: 'Steel', multiplier: 1.2 }, shortDesc: 'Powers up Steel-type moves.' }),
  item({ id: 'fairyfeather', name: 'Fairy Feather', kind: 'held', price: 1000, typeBoost: { type: 'Fairy', multiplier: 1.2 }, shortDesc: 'Powers up Fairy-type moves.' }),
];

const BY_ID = new Map<string, ItemDef>(ITEMS.map((entry) => [entry.id, entry]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

/** True when the run's economy may sell the item (`price > 0`; the Master Ball is not). */
export function isForSale(item: ItemDef): boolean {
  return item.price > 0;
}

/** The Poké Dollars a purchase costs. */
export function buyPrice(item: ItemDef): number {
  return item.price;
}

/** The Poké Dollars a sale returns: half the buy price, rounded down. */
export function sellPrice(item: ItemDef): number {
  return Math.floor(item.price / 2);
}

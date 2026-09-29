import type { BoostId, StatusId } from '../engine/battle/fighter';

export type ItemKind = 'ball' | 'heal' | 'status' | 'boost' | 'held';

export type ItemDef = Readonly<{
  id: string;
  name: string;
  kind: ItemKind;
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
 * The battle-relevant slice of the run's item catalogue. Balls feed capture,
 * heal/status/boost items feed the Bag command, and `held` items (Leftovers,
 * berries, the 1.2x type items) are registered by `effects/items.ts`. The run
 * economy (Phase 6) decides what a run actually hands out.
 */
export const ITEMS: readonly ItemDef[] = [
  item({ id: 'pokeball', name: 'Poke Ball', kind: 'ball', catchBonus: 1, shortDesc: 'A device for catching wild Pokémon.' }),
  item({ id: 'greatball', name: 'Great Ball', kind: 'ball', catchBonus: 1.5, shortDesc: 'A good Ball with a higher catch rate than a Poke Ball.' }),
  item({ id: 'ultraball', name: 'Ultra Ball', kind: 'ball', catchBonus: 2, shortDesc: 'An ultra-performance Ball with a high catch rate.' }),
  item({ id: 'masterball', name: 'Master Ball', kind: 'ball', catchBonus: 255, shortDesc: 'The best Ball. It never fails to catch.' }),

  item({ id: 'potion', name: 'Potion', kind: 'heal', healAmount: 20, shortDesc: 'Restores 20 HP.' }),
  item({ id: 'superpotion', name: 'Super Potion', kind: 'heal', healAmount: 60, shortDesc: 'Restores 60 HP.' }),
  item({ id: 'hyperpotion', name: 'Hyper Potion', kind: 'heal', healAmount: 120, shortDesc: 'Restores 120 HP.' }),
  item({ id: 'fullrestore', name: 'Full Restore', kind: 'heal', healFraction: [1, 1], cures: 'all', shortDesc: 'Fully restores HP and clears any status.' }),

  item({ id: 'antidote', name: 'Antidote', kind: 'status', cures: ['psn', 'tox'], shortDesc: 'Cures poison.' }),
  item({ id: 'paralyzeheal', name: 'Paralyze Heal', kind: 'status', cures: ['par'], shortDesc: 'Cures paralysis.' }),
  item({ id: 'awakening', name: 'Awakening', kind: 'status', cures: ['slp'], shortDesc: 'Wakes a sleeping Pokémon.' }),
  item({ id: 'burnheal', name: 'Burn Heal', kind: 'status', cures: ['brn'], shortDesc: 'Cures a burn.' }),
  item({ id: 'iceheal', name: 'Ice Heal', kind: 'status', cures: ['frz'], shortDesc: 'Thaws a frozen Pokémon.' }),
  item({ id: 'fullheal', name: 'Full Heal', kind: 'status', cures: 'all', shortDesc: 'Clears any status condition.' }),

  item({ id: 'xattack', name: 'X Attack', kind: 'boost', boosts: { atk: 2 }, shortDesc: 'Raises Attack by 2 stages.' }),
  item({ id: 'xdefense', name: 'X Defense', kind: 'boost', boosts: { def: 2 }, shortDesc: 'Raises Defense by 2 stages.' }),
  item({ id: 'xspeed', name: 'X Speed', kind: 'boost', boosts: { spe: 2 }, shortDesc: 'Raises Speed by 2 stages.' }),

  item({ id: 'leftovers', name: 'Leftovers', kind: 'held', healFraction: [1, 16], shortDesc: 'Holder restores a little HP every turn.' }),
  item({ id: 'sitrusberry', name: 'Sitrus Berry', kind: 'held', healFraction: [1, 4], below: [1, 2], consumed: true, shortDesc: 'Restores 1/4 max HP when HP is at or below half. Single use.' }),
  item({ id: 'oranberry', name: 'Oran Berry', kind: 'held', healAmount: 10, below: [1, 2], consumed: true, shortDesc: 'Restores 10 HP when HP is at or below half. Single use.' }),
  item({ id: 'lumberry', name: 'Lum Berry', kind: 'held', cures: 'all', consumed: true, shortDesc: 'Cures any status condition. Single use.' }),

  item({ id: 'silkscarf', name: 'Silk Scarf', kind: 'held', typeBoost: { type: 'Normal', multiplier: 1.2 }, shortDesc: 'Powers up Normal-type moves.' }),
  item({ id: 'charcoal', name: 'Charcoal', kind: 'held', typeBoost: { type: 'Fire', multiplier: 1.2 }, shortDesc: 'Powers up Fire-type moves.' }),
  item({ id: 'mysticwater', name: 'Mystic Water', kind: 'held', typeBoost: { type: 'Water', multiplier: 1.2 }, shortDesc: 'Powers up Water-type moves.' }),
  item({ id: 'miracleseed', name: 'Miracle Seed', kind: 'held', typeBoost: { type: 'Grass', multiplier: 1.2 }, shortDesc: 'Powers up Grass-type moves.' }),
  item({ id: 'magnet', name: 'Magnet', kind: 'held', typeBoost: { type: 'Electric', multiplier: 1.2 }, shortDesc: 'Powers up Electric-type moves.' }),
  item({ id: 'nevermeltice', name: 'Never-Melt Ice', kind: 'held', typeBoost: { type: 'Ice', multiplier: 1.2 }, shortDesc: 'Powers up Ice-type moves.' }),
  item({ id: 'blackbelt', name: 'Black Belt', kind: 'held', typeBoost: { type: 'Fighting', multiplier: 1.2 }, shortDesc: 'Powers up Fighting-type moves.' }),
  item({ id: 'poisonbarb', name: 'Poison Barb', kind: 'held', typeBoost: { type: 'Poison', multiplier: 1.2 }, shortDesc: 'Powers up Poison-type moves.' }),
  item({ id: 'softsand', name: 'Soft Sand', kind: 'held', typeBoost: { type: 'Ground', multiplier: 1.2 }, shortDesc: 'Powers up Ground-type moves.' }),
  item({ id: 'sharpbeak', name: 'Sharp Beak', kind: 'held', typeBoost: { type: 'Flying', multiplier: 1.2 }, shortDesc: 'Powers up Flying-type moves.' }),
  item({ id: 'twistedspoon', name: 'Twisted Spoon', kind: 'held', typeBoost: { type: 'Psychic', multiplier: 1.2 }, shortDesc: 'Powers up Psychic-type moves.' }),
  item({ id: 'silverpowder', name: 'Silver Powder', kind: 'held', typeBoost: { type: 'Bug', multiplier: 1.2 }, shortDesc: 'Powers up Bug-type moves.' }),
  item({ id: 'hardstone', name: 'Hard Stone', kind: 'held', typeBoost: { type: 'Rock', multiplier: 1.2 }, shortDesc: 'Powers up Rock-type moves.' }),
  item({ id: 'spelltag', name: 'Spell Tag', kind: 'held', typeBoost: { type: 'Ghost', multiplier: 1.2 }, shortDesc: 'Powers up Ghost-type moves.' }),
  item({ id: 'dragonfang', name: 'Dragon Fang', kind: 'held', typeBoost: { type: 'Dragon', multiplier: 1.2 }, shortDesc: 'Powers up Dragon-type moves.' }),
  item({ id: 'blackglasses', name: 'Black Glasses', kind: 'held', typeBoost: { type: 'Dark', multiplier: 1.2 }, shortDesc: 'Powers up Dark-type moves.' }),
  item({ id: 'metalcoat', name: 'Metal Coat', kind: 'held', typeBoost: { type: 'Steel', multiplier: 1.2 }, shortDesc: 'Powers up Steel-type moves.' }),
  item({ id: 'fairyfeather', name: 'Fairy Feather', kind: 'held', typeBoost: { type: 'Fairy', multiplier: 1.2 }, shortDesc: 'Powers up Fairy-type moves.' }),
];

const BY_ID = new Map<string, ItemDef>(ITEMS.map((entry) => [entry.id, entry]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

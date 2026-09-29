import type { BoostId, StatusId } from '../engine/battle/fighter';

export type ItemKind = 'ball' | 'heal' | 'status' | 'boost';

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
  shortDesc: string;
}>;

const item = (def: ItemDef): ItemDef => def;

/**
 * The battle-relevant slice of the run's item catalogue. Balls feed capture,
 * the rest feed the Bag command; held items and berries arrive with the effect
 * registry (Phase 4) and the run economy (Phase 6).
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
];

const BY_ID = new Map<string, ItemDef>(ITEMS.map((entry) => [entry.id, entry]));

export function getItem(id: string): ItemDef | undefined {
  return BY_ID.get(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}

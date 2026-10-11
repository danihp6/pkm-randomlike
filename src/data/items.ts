import type { BoostId, StatusId } from '../engine/battle/fighter';
import { getMove, getSpecies, MEGA_FORMES } from './dex';
import { TM_MOVE_IDS, tmItemId } from './tms';

export type ItemKind = 'ball' | 'heal' | 'status' | 'boost' | 'held' | 'valuable' | 'tm';

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
  /**
   * A Mega Stone: `base` is the species the holder must be, `form` the Mega id
   * it becomes once per battle (`src/engine/battle/mega.ts`, D34).
   */
  mega?: Readonly<{ base: string; form: string }>;
  /**
   * A TM's move id. A TM is **reusable**: it never leaves the bag, it only gates
   * the move in the learnset panel (`src/data/tms.ts`).
   */
  teaches?: string;
  /**
   * A Plate's type: while held, it gives Judgment its type (`moveType.ts`, D37).
   * Plates also carry a 1.2x `typeBoost`, like the canon.
   */
  plate?: string;
  shortDesc: string;
}>;

const item = (def: ItemDef): ItemDef => def;

/**
 * Every Mega Stone, one per generated Mega forme (`D34`). They are never sold:
 * the mega-stone room has yet to ship, and a stone is only ever held by a boss,
 * a mini-boss or an `ace`. All Mega formes in the dex are covered.
 */
const MEGA_STONES: readonly ItemDef[] = MEGA_FORMES.map((mega) =>
  item({
    id: mega.stoneId,
    name: mega.stoneName,
    kind: 'held',
    price: 0,
    mega: { base: mega.baseSpeciesId, form: mega.id },
    shortDesc: `Holder (${getSpecies(mega.baseSpeciesId)?.name ?? mega.baseSpeciesId}) can Mega Evolve once per battle.`,
  }),
);

/** Every Mega Stone id, for the mega-stone room's random draw (`docs/maps-spec.md` §7). */
export const MEGA_STONE_IDS: readonly string[] = MEGA_STONES.map((stone) => stone.id);

/**
 * Every base-Gen-9 Technical Machine (TM001 … TM171), one item per numbered
 * machine (`src/data/tms.ts`). They land in the bag's MT/MO pocket and are
 * **reusable**: the learnset panel offers a TM's move to a member whose
 * randomized learnset lists that move as a TM, and learning it never spends the
 * item. A single price keeps the shop's economy simple.
 */
const TM_PRICE = 3000;

const TM_ITEMS: readonly ItemDef[] = TM_MOVE_IDS.map((moveId, index) => {
  const move = getMove(moveId);
  const label = `TM${String(index + 1).padStart(3, '0')}`;
  return item({
    id: tmItemId(index + 1),
    name: move ? `${label} ${move.name}` : label,
    kind: 'tm',
    price: TM_PRICE,
    teaches: moveId,
    shortDesc: move
      ? `Teaches ${move.name} to a compatible Pokémon. Reusable.`
      : 'A Technical Machine.',
  });
});

/** Every TM id, for a shop or a loot roll that hands out a random machine. */
export const TM_ITEM_IDS: readonly string[] = TM_ITEMS.map((entry) => entry.id);

/**
 * The seventeen Plates (D37): a held Plate gives **Judgment** its type and
 * boosts that type's moves 1.2x, exactly like the canon. They are boss-tier
 * treasure — nothing spawns Arceus yet — so they are catalogued but not sold.
 */
const PLATES: readonly (readonly [string, string, string])[] = [
  ['flameplate', 'Flame Plate', 'Fire'],
  ['splashplate', 'Splash Plate', 'Water'],
  ['zapplate', 'Zap Plate', 'Electric'],
  ['meadowplate', 'Meadow Plate', 'Grass'],
  ['icicleplate', 'Icicle Plate', 'Ice'],
  ['fistplate', 'Fist Plate', 'Fighting'],
  ['toxicplate', 'Toxic Plate', 'Poison'],
  ['earthplate', 'Earth Plate', 'Ground'],
  ['skyplate', 'Sky Plate', 'Flying'],
  ['mindplate', 'Mind Plate', 'Psychic'],
  ['insectplate', 'Insect Plate', 'Bug'],
  ['stoneplate', 'Stone Plate', 'Rock'],
  ['spookyplate', 'Spooky Plate', 'Ghost'],
  ['dracoplate', 'Draco Plate', 'Dragon'],
  ['dreadplate', 'Dread Plate', 'Dark'],
  ['ironplate', 'Iron Plate', 'Steel'],
  ['pixieplate', 'Pixie Plate', 'Fairy'],
];

const PLATE_ITEMS: readonly ItemDef[] = PLATES.map(([id, name, type]) =>
  item({
    id,
    name,
    kind: 'held',
    price: 4000,
    plate: type,
    typeBoost: { type, multiplier: 1.2 },
    shortDesc: `Powers up ${type}-type moves. Holder's Judgment becomes ${type} type.`,
  }),
);

/**
 * The run's item catalogue: balls, heal/status/boost consumables, `held` items
 * (Leftovers, berries, the 1.2x type items, registered by `effects/items.ts`) and
 * `valuable` treasure, each with the price the shop spends. There is no Revive
 * anywhere (D5).
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

  // Valuables: pure treasure the ground-item loot turns up, worth real money at
  // the shop (`sellPrice`) and usable for nothing else, so they are the run's way
  // to cash out (`docs/maps-spec.md` §7, D33). They are never sold by the shop.
  item({ id: 'stardust', name: 'Stardust', kind: 'valuable', price: 1000, shortDesc: 'Red sand that shimmers like a star. Sell it for money.' }),
  item({ id: 'pearl', name: 'Pearl', kind: 'valuable', price: 1400, shortDesc: 'A pretty pearl. Sell it for money.' }),
  item({ id: 'nugget', name: 'Nugget', kind: 'valuable', price: 5000, shortDesc: 'A lump of pure gold. Sell it for money.' }),
  item({ id: 'starpiece', name: 'Star Piece', kind: 'valuable', price: 4900, shortDesc: 'A shard of a red star. Sell it for money.' }),
  item({ id: 'rarebone', name: 'Rare Bone', kind: 'valuable', price: 5000, shortDesc: 'A rare bone. Sell it for money.' }),
  item({ id: 'bigpearl', name: 'Big Pearl', kind: 'valuable', price: 7500, shortDesc: 'A large, lustrous pearl. Sell it for money.' }),
  item({ id: 'pearlstring', name: 'Pearl String', kind: 'valuable', price: 8000, shortDesc: 'A string of pearls. Sell it for money.' }),
  item({ id: 'bignugget', name: 'Big Nugget', kind: 'valuable', price: 10000, shortDesc: 'A big lump of pure gold. Sell it for money.' }),
  item({ id: 'cometshard', name: 'Comet Shard', kind: 'valuable', price: 12000, shortDesc: 'A shard of a comet. Sell it for money.' }),

  ...PLATE_ITEMS,
  ...MEGA_STONES,
  ...TM_ITEMS,
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

/**
 * The Poké Dollars a sale returns. A **valuable** is pure treasure, so it sells
 * for its whole listed price; anything else is a used good that recovers half,
 * rounded down, so the shop stays a sink (`docs/maps-spec.md` §7).
 */
export function sellPrice(item: ItemDef): number {
  return item.kind === 'valuable' ? item.price : Math.floor(item.price / 2);
}

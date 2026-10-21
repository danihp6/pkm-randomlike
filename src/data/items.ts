import type { BoostId, StatusId } from '../engine/battle/fighter';
import {
  GMAX_FORMES,
  MEGA_FORMES,
  getDexItem,
  getMove,
  getSpecies,
  normalizeId,
  type MoveCategory,
  type StatId,
} from './dex';
import type { BandId } from './run';
import { TM_MOVE_IDS, tmItemId } from './tms';

export type ItemKind = 'ball' | 'heal' | 'status' | 'held' | 'valuable' | 'tm';

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
  /**
   * Stat stages granted to the active Pokémon: the **pinch berries** read it
   * through the held-item residual branch (`effects/items.ts`).
   */
  boosts?: Partial<Record<BoostId, number>>;
  /** Held items: fire at the end of the turn only when HP is at or below this fraction. */
  below?: readonly [number, number];
  /**
   * Held items: removed from the holder once it fires — a berry, a gem or a
   * Focus Sash alike, not only a berry.
   */
  consumed?: boolean;
  /** Held items: multiplies moves of `type` by `multiplier` (the 1.2x type items). */
  typeBoost?: Readonly<{ type: string; multiplier: number }>;
  /**
   * Held items: multiplies the holder's move damage when the item's condition
   * holds. `typeBoost` and `damageBoost` are mutually exclusive: one item, one
   * damage handler.
   */
  damageBoost?: Readonly<{
    multiplier: number;
    /** Only moves of this category (Choice Band → Physical, Choice Specs → Special). */
    category?: MoveCategory;
    /** Only when the hit is super effective. */
    superEffective?: boolean;
  }>;
  /** Held items: multiplies the holder's Speed (Choice Scarf 1.5, Iron Ball 0.5). */
  speedBoost?: number;
  /** Held items: multiplies the holder's hit chance (Wide Lens 1.1). */
  accuracyBoost?: number;
  /** Held items: crit stages added while the holder attacks (Scope Lens, Razor Claw). */
  critStages?: number;
  /** Held items: the holder acts last inside its priority bracket (Lagging Tail). */
  alwaysLast?: boolean;
  /**
   * A held escape item: the holder always escapes a wild battle, even one whose
   * launch carries `noFlee`. Read through `onTryEscape` (`effects/items.ts`) and
   * therefore by `canRun`/`rollRun` (`battle/runAway.ts`).
   */
  flee?: boolean;
  /** Held items: halves a hit of `type` and is then spent (the resist berries). */
  resistBerry?: string;
  /** Held items: the holder's own damaging move costs this fraction of its max HP (Life Orb). */
  recoil?: readonly [number, number];
  /** Held items: inflicts `status` on the holder once, at the end of a turn (Flame Orb). */
  selfStatus?: StatusId;
  /** Held items: may leave the holder at 1 HP from a hit that would KO it, then is spent. */
  survive?: Readonly<{ chance: readonly [number, number]; fullHpOnly?: boolean }>;
  /**
   * A Mega Stone: `base` is the species the holder must be, `form` the Mega id
   * it becomes once per battle (`src/engine/battle/mega.ts`, D34).
   */
  mega?: Readonly<{ base: string; form: string }>;
  /**
   * A G-Max Stone (`D44`): `base` is the species the holder must be, `form` the
   * G-Max id it becomes once per battle (`src/engine/battle/gmax.ts`).
   */
  gmax?: Readonly<{ base: string; form: string }>;
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
  /**
   * A Memory's type: while held, it gives Multi-Attack its type (`moveType.ts`, D37).
   */
  memory?: string;
  /** A Drive's type: while held, it gives Techno Blast its type (`moveType.ts`, D37). */
  drive?: string;
  /**
   * A hand-authored row with no Añil icon of its own: the id whose atlas frame it
   * borrows (`src/data/itemIcons.ts`). Absent means the atlas must carry its own.
   */
  iconFallback?: string;
  /**
   * A Tera Crystal's type (`Task-103`): while **held**, the holder fights as this
   * single type from the moment it takes the field. Read only through
   * `teraTypeOf`, never off the item at a call site.
   */
  teraType?: string;
  /** A coloured candy (`Task-103`): the colour id the run's own table maps. */
  candy?: string;
  /**
   * A route consumable (`Task-103`): its effect, spent from the route bag on any
   * party member and refused in battle. Written through the shipped writers. Its
   * **kind** is the gesture the route bag routes (`'heal'`), not what it does;
   * `routeEffect` is what actually happens.
   */
  routeEffect?: Readonly<
    | { kind: 'curse' }
    | { kind: 'sky'; field: string }
    | { kind: 'heal' }
  >;
  shortDesc: string;
}>;

type ItemInput = Omit<ItemDef, 'shortDesc'> & Readonly<{ shortDesc?: string }>;

/** A catalogue row. A row that omits `shortDesc` reads the dex's own text for the id. */
const item = (def: ItemInput): ItemDef => ({
  ...def,
  shortDesc: def.shortDesc ?? getDexItem(def.id)?.shortDesc ?? def.name,
});

/**
 * Every Mega Stone, one per generated Mega forme (`D34`). They are never sold: the
 * mega-stone room has yet to ship, and a stone is only ever held by a boss, a
 * mini-boss or an `ace`. All Mega formes in the dex are covered.
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

/** The Poké Dollars a G-Max Stone costs at the Mart. */
export const GMAX_STONE_PRICE = 8000;

/**
 * Every G-Max Stone, one per generated G-Max forme (`D44`). A stone is **minted
 * beside the Mega Stones and sold at the Mart** (unlike them): it is the only way
 * to Gigantamax, and it is never spent on use, so one stone covers a whole run.
 */
const GMAX_STONES: readonly ItemDef[] = GMAX_FORMES.map((gmax) =>
  item({
    id: gmax.stoneId,
    name: gmax.stoneName,
    kind: 'held',
    price: GMAX_STONE_PRICE,
    gmax: { base: gmax.baseSpeciesId, form: gmax.id },
    shortDesc: `Holder (${getSpecies(gmax.baseSpeciesId)?.name ?? gmax.baseSpeciesId}) can Gigantamax once per battle.`,
  }),
);

/** Every G-Max Stone id, in dex order: the Mart's stone row draws from this. */
export const GMAX_STONE_IDS: readonly string[] = GMAX_STONES.map((stone) => stone.id);

/**
 * The G-Max Stones the **ground** can hand out, banded at the `D37`
 * Memories/Drives cadence: nothing before `late`, four ids at `late`, six at
 * `end`, sliced off the dex-ordered `GMAX_STONE_IDS`.
 */
export const GMAX_STONE_LOOT: Readonly<Record<BandId, readonly string[]>> = {
  early: [],
  low: [],
  mid: [],
  high: [],
  late: GMAX_STONE_IDS.slice(0, 4),
  end: GMAX_STONE_IDS.slice(4, 10),
};

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
    shortDesc: move ? `Teaches ${move.name} to a compatible Pokémon. Reusable.` : 'A Technical Machine.',
  });
});

/** Every TM id, for a shop or a loot roll that hands out a random machine. */
export const TM_ITEM_IDS: readonly string[] = TM_ITEMS.map((entry) => entry.id);

/**
 * The seventeen Plates (D37): a held Plate gives **Judgment** its type and
 * boosts that type's moves 1.2x, exactly like the canon. They are boss-tier
 * treasure — nothing spawns Arceus yet — so they are catalogued but not sold.
 */
const PLATE_ITEMS: readonly ItemDef[] = [
  item({
    id: 'flameplate',
    name: 'Flame Plate',
    kind: 'held',
    price: 4000,
    plate: 'Fire',
    typeBoost: { type: 'Fire', multiplier: 1.2 },
    shortDesc: "Powers up Fire-type moves. Holder's Judgment becomes Fire type.",
  }),
  item({
    id: 'splashplate',
    name: 'Splash Plate',
    kind: 'held',
    price: 4000,
    plate: 'Water',
    typeBoost: { type: 'Water', multiplier: 1.2 },
    shortDesc: "Powers up Water-type moves. Holder's Judgment becomes Water type.",
  }),
  item({
    id: 'zapplate',
    name: 'Zap Plate',
    kind: 'held',
    price: 4000,
    plate: 'Electric',
    typeBoost: { type: 'Electric', multiplier: 1.2 },
    shortDesc: "Powers up Electric-type moves. Holder's Judgment becomes Electric type.",
  }),
  item({
    id: 'meadowplate',
    name: 'Meadow Plate',
    kind: 'held',
    price: 4000,
    plate: 'Grass',
    typeBoost: { type: 'Grass', multiplier: 1.2 },
    shortDesc: "Powers up Grass-type moves. Holder's Judgment becomes Grass type.",
  }),
  item({
    id: 'icicleplate',
    name: 'Icicle Plate',
    kind: 'held',
    price: 4000,
    plate: 'Ice',
    typeBoost: { type: 'Ice', multiplier: 1.2 },
    shortDesc: "Powers up Ice-type moves. Holder's Judgment becomes Ice type.",
  }),
  item({
    id: 'fistplate',
    name: 'Fist Plate',
    kind: 'held',
    price: 4000,
    plate: 'Fighting',
    typeBoost: { type: 'Fighting', multiplier: 1.2 },
    shortDesc: "Powers up Fighting-type moves. Holder's Judgment becomes Fighting type.",
  }),
  item({
    id: 'toxicplate',
    name: 'Toxic Plate',
    kind: 'held',
    price: 4000,
    plate: 'Poison',
    typeBoost: { type: 'Poison', multiplier: 1.2 },
    shortDesc: "Powers up Poison-type moves. Holder's Judgment becomes Poison type.",
  }),
  item({
    id: 'earthplate',
    name: 'Earth Plate',
    kind: 'held',
    price: 4000,
    plate: 'Ground',
    typeBoost: { type: 'Ground', multiplier: 1.2 },
    shortDesc: "Powers up Ground-type moves. Holder's Judgment becomes Ground type.",
  }),
  item({
    id: 'skyplate',
    name: 'Sky Plate',
    kind: 'held',
    price: 4000,
    plate: 'Flying',
    typeBoost: { type: 'Flying', multiplier: 1.2 },
    shortDesc: "Powers up Flying-type moves. Holder's Judgment becomes Flying type.",
  }),
  item({
    id: 'mindplate',
    name: 'Mind Plate',
    kind: 'held',
    price: 4000,
    plate: 'Psychic',
    typeBoost: { type: 'Psychic', multiplier: 1.2 },
    shortDesc: "Powers up Psychic-type moves. Holder's Judgment becomes Psychic type.",
  }),
  item({
    id: 'insectplate',
    name: 'Insect Plate',
    kind: 'held',
    price: 4000,
    plate: 'Bug',
    typeBoost: { type: 'Bug', multiplier: 1.2 },
    shortDesc: "Powers up Bug-type moves. Holder's Judgment becomes Bug type.",
  }),
  item({
    id: 'stoneplate',
    name: 'Stone Plate',
    kind: 'held',
    price: 4000,
    plate: 'Rock',
    typeBoost: { type: 'Rock', multiplier: 1.2 },
    shortDesc: "Powers up Rock-type moves. Holder's Judgment becomes Rock type.",
  }),
  item({
    id: 'spookyplate',
    name: 'Spooky Plate',
    kind: 'held',
    price: 4000,
    plate: 'Ghost',
    typeBoost: { type: 'Ghost', multiplier: 1.2 },
    shortDesc: "Powers up Ghost-type moves. Holder's Judgment becomes Ghost type.",
  }),
  item({
    id: 'dracoplate',
    name: 'Draco Plate',
    kind: 'held',
    price: 4000,
    plate: 'Dragon',
    typeBoost: { type: 'Dragon', multiplier: 1.2 },
    shortDesc: "Powers up Dragon-type moves. Holder's Judgment becomes Dragon type.",
  }),
  item({
    id: 'dreadplate',
    name: 'Dread Plate',
    kind: 'held',
    price: 4000,
    plate: 'Dark',
    typeBoost: { type: 'Dark', multiplier: 1.2 },
    shortDesc: "Powers up Dark-type moves. Holder's Judgment becomes Dark type.",
  }),
  item({
    id: 'ironplate',
    name: 'Iron Plate',
    kind: 'held',
    price: 4000,
    plate: 'Steel',
    typeBoost: { type: 'Steel', multiplier: 1.2 },
    shortDesc: "Powers up Steel-type moves. Holder's Judgment becomes Steel type.",
  }),
  item({
    id: 'pixieplate',
    name: 'Pixie Plate',
    kind: 'held',
    price: 4000,
    plate: 'Fairy',
    typeBoost: { type: 'Fairy', multiplier: 1.2 },
    shortDesc: "Powers up Fairy-type moves. Holder's Judgment becomes Fairy type.",
  }),
];

/** Damage boosters: one `damageBoost` multiplier each, gated by category or effectiveness. */
const PORT_DAMAGE_ITEMS: readonly ItemDef[] = [
  item({
    id: 'choiceband',
    name: 'Choice Band',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.5, category: 'Physical' },
  }),
  item({
    id: 'choicespecs',
    name: 'Choice Specs',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.5, category: 'Special' },
  }),
  item({
    id: 'muscleband',
    name: 'Muscle Band',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.1, category: 'Physical' },
  }),
  item({
    id: 'wiseglasses',
    name: 'Wise Glasses',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.1, category: 'Special' },
  }),
  item({
    id: 'expertbelt',
    name: 'Expert Belt',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.2, superEffective: true },
  }),
  item({
    id: 'lifeorb',
    name: 'Life Orb',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.3 },
    recoil: [1, 10],
  }),
  item({
    id: 'normalgem',
    name: 'Normal Gem',
    kind: 'held',
    price: 4000,
    damageBoost: { multiplier: 1.3, superEffective: true },
    consumed: true,
  }),
];

const PORT_SPEED_ITEMS: readonly ItemDef[] = [
  item({ id: 'choicescarf', name: 'Choice Scarf', kind: 'held', price: 4000, speedBoost: 1.5 }),
  item({ id: 'ironball', name: 'Iron Ball', kind: 'held', price: 4000, speedBoost: 0.5 }),
];

const PORT_ACCURACY_ITEMS: readonly ItemDef[] = [
  item({ id: 'widelens', name: 'Wide Lens', kind: 'held', price: 4000, accuracyBoost: 1.1 }),
];

const PORT_CRIT_ITEMS: readonly ItemDef[] = [
  item({ id: 'scopelens', name: 'Scope Lens', kind: 'held', price: 4000, critStages: 1 }),
  item({ id: 'razorclaw', name: 'Razor Claw', kind: 'held', price: 4000, critStages: 1 }),
];

const PORT_LAST_ITEMS: readonly ItemDef[] = [
  item({ id: 'laggingtail', name: 'Lagging Tail', kind: 'held', price: 4000, alwaysLast: true }),
];

const PORT_SURVIVE_ITEMS: readonly ItemDef[] = [
  item({
    id: 'focussash',
    name: 'Focus Sash',
    kind: 'held',
    price: 4000,
    survive: { chance: [1, 1], fullHpOnly: true },
    consumed: true,
  }),
  item({ id: 'focusband', name: 'Focus Band', kind: 'held', price: 4000, survive: { chance: [1, 10] } }),
];

const PORT_RESIST_BERRY_ITEMS: readonly ItemDef[] = [
  item({
    id: 'occaberry',
    name: 'Occa Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Fire',
    consumed: true,
  }),
  item({
    id: 'passhoberry',
    name: 'Passho Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Water',
    consumed: true,
  }),
  item({
    id: 'wacanberry',
    name: 'Wacan Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Electric',
    consumed: true,
  }),
  item({
    id: 'rindoberry',
    name: 'Rindo Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Grass',
    consumed: true,
  }),
  item({
    id: 'yacheberry',
    name: 'Yache Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Ice',
    consumed: true,
  }),
  item({
    id: 'chopleberry',
    name: 'Chople Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Fighting',
    consumed: true,
  }),
  item({
    id: 'kebiaberry',
    name: 'Kebia Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Poison',
    consumed: true,
  }),
  item({
    id: 'shucaberry',
    name: 'Shuca Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Ground',
    consumed: true,
  }),
  item({
    id: 'cobaberry',
    name: 'Coba Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Flying',
    consumed: true,
  }),
  item({
    id: 'payapaberry',
    name: 'Payapa Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Psychic',
    consumed: true,
  }),
  item({
    id: 'tangaberry',
    name: 'Tanga Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Bug',
    consumed: true,
  }),
  item({
    id: 'chartiberry',
    name: 'Charti Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Rock',
    consumed: true,
  }),
  item({
    id: 'kasibberry',
    name: 'Kasib Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Ghost',
    consumed: true,
  }),
  item({
    id: 'habanberry',
    name: 'Haban Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Dragon',
    consumed: true,
  }),
  item({
    id: 'colburberry',
    name: 'Colbur Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Dark',
    consumed: true,
  }),
  item({
    id: 'babiriberry',
    name: 'Babiri Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Steel',
    consumed: true,
  }),
  item({
    id: 'roseliberry',
    name: 'Roseli Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Fairy',
    consumed: true,
  }),
  item({
    id: 'chilanberry',
    name: 'Chilan Berry',
    kind: 'held',
    price: 200,
    resistBerry: 'Normal',
    consumed: true,
  }),
];

/** The pinch berries: one stat stage at 1/4 HP or less, then spent. */
const PORT_PINCH_BERRY_ITEMS: readonly ItemDef[] = [
  item({
    id: 'liechiberry',
    name: 'Liechi Berry',
    kind: 'held',
    price: 200,
    boosts: { atk: 1 },
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'ganlonberry',
    name: 'Ganlon Berry',
    kind: 'held',
    price: 200,
    boosts: { def: 1 },
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'petayaberry',
    name: 'Petaya Berry',
    kind: 'held',
    price: 200,
    boosts: { spa: 1 },
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'apicotberry',
    name: 'Apicot Berry',
    kind: 'held',
    price: 200,
    boosts: { spd: 1 },
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'salacberry',
    name: 'Salac Berry',
    kind: 'held',
    price: 200,
    boosts: { spe: 1 },
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'micleberry',
    name: 'Micle Berry',
    kind: 'held',
    price: 200,
    boosts: { accuracy: 1 },
    below: [1, 4],
    consumed: true,
  }),
];

/** The status berries: cure one primary status (bad poison shares poison's). */
const PORT_STATUS_BERRY_ITEMS: readonly ItemDef[] = [
  item({
    id: 'cheriberry',
    name: 'Cheri Berry',
    kind: 'held',
    price: 200,
    cures: ['par'],
    consumed: true,
  }),
  item({
    id: 'chestoberry',
    name: 'Chesto Berry',
    kind: 'held',
    price: 200,
    cures: ['slp'],
    consumed: true,
  }),
  item({
    id: 'pechaberry',
    name: 'Pecha Berry',
    kind: 'held',
    price: 200,
    cures: ['psn', 'tox'],
    consumed: true,
  }),
  item({
    id: 'rawstberry',
    name: 'Rawst Berry',
    kind: 'held',
    price: 200,
    cures: ['brn'],
    consumed: true,
  }),
  item({
    id: 'aspearberry',
    name: 'Aspear Berry',
    kind: 'held',
    price: 200,
    cures: ['frz'],
    consumed: true,
  }),
];

/** The 1/3-HP berries: the Figy family, at 1/4 HP or less like the canon. */
const PORT_HEAL_BERRY_ITEMS: readonly ItemDef[] = [
  item({
    id: 'figyberry',
    name: 'Figy Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 3],
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'wikiberry',
    name: 'Wiki Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 3],
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'magoberry',
    name: 'Mago Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 3],
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'aguavberry',
    name: 'Aguav Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 3],
    below: [1, 4],
    consumed: true,
  }),
  item({
    id: 'iapapaberry',
    name: 'Iapapa Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 3],
    below: [1, 4],
    consumed: true,
  }),
];

const PORT_SELF_STATUS_ITEMS: readonly ItemDef[] = [
  item({ id: 'flameorb', name: 'Flame Orb', kind: 'held', price: 4000, selfStatus: 'brn' }),
  item({ id: 'toxicorb', name: 'Toxic Orb', kind: 'held', price: 4000, selfStatus: 'tox' }),
];

/** The berry-class `no-op`s: catalogued for the art and the `D16` record, modelled by nothing. */
const NOOP_BERRY_ITEMS: readonly ItemDef[] = [
  item({ id: 'custapberry', name: 'Custap Berry', kind: 'held', price: 200 }),
  item({ id: 'enigmaberry', name: 'Enigma Berry', kind: 'held', price: 200 }),
  item({ id: 'jabocaberry', name: 'Jaboca Berry', kind: 'held', price: 200 }),
  item({ id: 'keeberry', name: 'Kee Berry', kind: 'held', price: 200 }),
  item({ id: 'lansatberry', name: 'Lansat Berry', kind: 'held', price: 200 }),
  item({ id: 'leppaberry', name: 'Leppa Berry', kind: 'held', price: 200 }),
  item({ id: 'marangaberry', name: 'Maranga Berry', kind: 'held', price: 200 }),
  item({ id: 'persimberry', name: 'Persim Berry', kind: 'held', price: 200 }),
  item({ id: 'rowapberry', name: 'Rowap Berry', kind: 'held', price: 200 }),
  item({ id: 'starfberry', name: 'Starf Berry', kind: 'held', price: 200 }),
  item({ id: 'tamatoberry', name: 'Tamato Berry', kind: 'held', price: 200 }),
];

/** The competitive held items nothing models yet; each id is also named in `UNMODELLED_ITEMS`. */
const NOOP_ITEMS: readonly ItemDef[] = [
  item({ id: 'abilityshield', name: 'Ability Shield', kind: 'held', price: 4000 }),
  item({ id: 'absorbbulb', name: 'Absorb Bulb', kind: 'held', price: 4000 }),
  item({ id: 'adamantcrystal', name: 'Adamant Crystal', kind: 'held', price: 4000 }),
  item({ id: 'adamantorb', name: 'Adamant Orb', kind: 'held', price: 4000 }),
  item({ id: 'airballoon', name: 'Air Balloon', kind: 'held', price: 4000 }),
  item({ id: 'assaultvest', name: 'Assault Vest', kind: 'held', price: 4000 }),
  item({ id: 'bigroot', name: 'Big Root', kind: 'held', price: 4000 }),
  item({ id: 'bindingband', name: 'Binding Band', kind: 'held', price: 4000 }),
  item({ id: 'blacksludge', name: 'Black Sludge', kind: 'held', price: 4000 }),
  item({ id: 'blunderpolicy', name: 'Blunder Policy', kind: 'held', price: 4000 }),
  item({ id: 'boosterenergy', name: 'Booster Energy', kind: 'held', price: 4000 }),
  item({ id: 'brightpowder', name: 'Bright Powder', kind: 'held', price: 4000 }),
  item({ id: 'cellbattery', name: 'Cell Battery', kind: 'held', price: 4000 }),
  item({ id: 'clearamulet', name: 'Clear Amulet', kind: 'held', price: 4000 }),
  item({ id: 'covertcloak', name: 'Covert Cloak', kind: 'held', price: 4000 }),
  item({ id: 'damprock', name: 'Damp Rock', kind: 'held', price: 4000 }),
  item({ id: 'ejectbutton', name: 'Eject Button', kind: 'held', price: 4000 }),
  item({ id: 'ejectpack', name: 'Eject Pack', kind: 'held', price: 4000 }),
  item({ id: 'electricseed', name: 'Electric Seed', kind: 'held', price: 4000 }),
  item({ id: 'eviolite', name: 'Eviolite', kind: 'held', price: 4000 }),
  item({ id: 'floatstone', name: 'Float Stone', kind: 'held', price: 4000 }),
  item({ id: 'grassyseed', name: 'Grassy Seed', kind: 'held', price: 4000 }),
  item({ id: 'gripclaw', name: 'Grip Claw', kind: 'held', price: 4000 }),
  item({ id: 'griseouscore', name: 'Griseous Core', kind: 'held', price: 4000 }),
  item({ id: 'griseousorb', name: 'Griseous Orb', kind: 'held', price: 4000 }),
  item({ id: 'heatrock', name: 'Heat Rock', kind: 'held', price: 4000 }),
  item({ id: 'heavydutyboots', name: 'Heavy-Duty Boots', kind: 'held', price: 4000 }),
  item({ id: 'icyrock', name: 'Icy Rock', kind: 'held', price: 4000 }),
  item({ id: 'kingsrock', name: "King's Rock", kind: 'held', price: 4000 }),
  item({ id: 'lightball', name: 'Light Ball', kind: 'held', price: 4000 }),
  item({ id: 'lightclay', name: 'Light Clay', kind: 'held', price: 4000 }),
  item({ id: 'loadeddice', name: 'Loaded Dice', kind: 'held', price: 4000 }),
  item({ id: 'luminousmoss', name: 'Luminous Moss', kind: 'held', price: 4000 }),
  item({ id: 'lustrousglobe', name: 'Lustrous Globe', kind: 'held', price: 4000 }),
  item({ id: 'lustrousorb', name: 'Lustrous Orb', kind: 'held', price: 4000 }),
  item({ id: 'mentalherb', name: 'Mental Herb', kind: 'held', price: 4000 }),
  item({ id: 'metronome', name: 'Metronome', kind: 'held', price: 4000 }),
  item({ id: 'mirrorherb', name: 'Mirror Herb', kind: 'held', price: 4000 }),
  item({ id: 'mistyseed', name: 'Misty Seed', kind: 'held', price: 4000 }),
  item({ id: 'powerherb', name: 'Power Herb', kind: 'held', price: 4000 }),
  item({ id: 'protectivepads', name: 'Protective Pads', kind: 'held', price: 4000 }),
  item({ id: 'psychicseed', name: 'Psychic Seed', kind: 'held', price: 4000 }),
  item({ id: 'punchingglove', name: 'Punching Glove', kind: 'held', price: 4000 }),
  item({ id: 'quickclaw', name: 'Quick Claw', kind: 'held', price: 4000 }),
  item({ id: 'razorfang', name: 'Razor Fang', kind: 'held', price: 4000 }),
  item({ id: 'redcard', name: 'Red Card', kind: 'held', price: 4000 }),
  item({ id: 'ringtarget', name: 'Ring Target', kind: 'held', price: 4000 }),
  item({ id: 'rockyhelmet', name: 'Rocky Helmet', kind: 'held', price: 4000 }),
  item({ id: 'roomservice', name: 'Room Service', kind: 'held', price: 4000 }),
  item({ id: 'safetygoggles', name: 'Safety Goggles', kind: 'held', price: 4000 }),
  item({ id: 'shedshell', name: 'Shed Shell', kind: 'held', price: 4000 }),
  item({ id: 'shellbell', name: 'Shell Bell', kind: 'held', price: 4000 }),
  item({ id: 'snowball', name: 'Snowball', kind: 'held', price: 4000 }),
  item({ id: 'souldew', name: 'Soul Dew', kind: 'held', price: 4000 }),
  item({ id: 'stickybarb', name: 'Sticky Barb', kind: 'held', price: 4000 }),
  item({ id: 'terrainextender', name: 'Terrain Extender', kind: 'held', price: 4000 }),
  item({ id: 'throatspray', name: 'Throat Spray', kind: 'held', price: 4000 }),
  item({ id: 'utilityumbrella', name: 'Utility Umbrella', kind: 'held', price: 4000 }),
  item({ id: 'weaknesspolicy', name: 'Weakness Policy', kind: 'held', price: 4000 }),
  item({ id: 'whiteherb', name: 'White Herb', kind: 'held', price: 4000 }),
];

/**
 * The 21 hand-authored held items the dex drops as nonstandard: the seventeen
 * **Memories** and four **Drives** that retype Multi-Attack and Techno Blast
 * (`engine/battle/effects/items.ts`, D37). The dex has neither, so the name and
 * the text are literal (English, `D12`). There is no `normalmemory` row: the dex
 * has no such item, and a Silvally holding no Memory is already Normal, so
 * Multi-Attack's Normal case is the "no Memory held" case.
 */
export const MEMORY_DRIVE_ITEMS: readonly ItemDef[] = [
  item({
    id: 'bugmemory',
    name: 'Bug Memory',
    kind: 'held',
    price: 3000,
    memory: 'Bug',
    shortDesc: "Holder's Multi-Attack becomes Bug type.",
  }),
  item({
    id: 'darkmemory',
    name: 'Dark Memory',
    kind: 'held',
    price: 3000,
    memory: 'Dark',
    shortDesc: "Holder's Multi-Attack becomes Dark type.",
  }),
  item({
    id: 'dragonmemory',
    name: 'Dragon Memory',
    kind: 'held',
    price: 3000,
    memory: 'Dragon',
    shortDesc: "Holder's Multi-Attack becomes Dragon type.",
  }),
  item({
    id: 'electricmemory',
    name: 'Electric Memory',
    kind: 'held',
    price: 3000,
    memory: 'Electric',
    shortDesc: "Holder's Multi-Attack becomes Electric type.",
  }),
  item({
    id: 'fairymemory',
    name: 'Fairy Memory',
    kind: 'held',
    price: 3000,
    memory: 'Fairy',
    shortDesc: "Holder's Multi-Attack becomes Fairy type.",
  }),
  item({
    id: 'fightingmemory',
    name: 'Fighting Memory',
    kind: 'held',
    price: 3000,
    memory: 'Fighting',
    shortDesc: "Holder's Multi-Attack becomes Fighting type.",
  }),
  item({
    id: 'firememory',
    name: 'Fire Memory',
    kind: 'held',
    price: 3000,
    memory: 'Fire',
    shortDesc: "Holder's Multi-Attack becomes Fire type.",
  }),
  item({
    id: 'flyingmemory',
    name: 'Flying Memory',
    kind: 'held',
    price: 3000,
    memory: 'Flying',
    shortDesc: "Holder's Multi-Attack becomes Flying type.",
  }),
  item({
    id: 'ghostmemory',
    name: 'Ghost Memory',
    kind: 'held',
    price: 3000,
    memory: 'Ghost',
    shortDesc: "Holder's Multi-Attack becomes Ghost type.",
  }),
  item({
    id: 'grassmemory',
    name: 'Grass Memory',
    kind: 'held',
    price: 3000,
    memory: 'Grass',
    shortDesc: "Holder's Multi-Attack becomes Grass type.",
  }),
  item({
    id: 'groundmemory',
    name: 'Ground Memory',
    kind: 'held',
    price: 3000,
    memory: 'Ground',
    shortDesc: "Holder's Multi-Attack becomes Ground type.",
  }),
  item({
    id: 'icememory',
    name: 'Ice Memory',
    kind: 'held',
    price: 3000,
    memory: 'Ice',
    shortDesc: "Holder's Multi-Attack becomes Ice type.",
  }),
  item({
    id: 'poisonmemory',
    name: 'Poison Memory',
    kind: 'held',
    price: 3000,
    memory: 'Poison',
    shortDesc: "Holder's Multi-Attack becomes Poison type.",
  }),
  item({
    id: 'psychicmemory',
    name: 'Psychic Memory',
    kind: 'held',
    price: 3000,
    memory: 'Psychic',
    shortDesc: "Holder's Multi-Attack becomes Psychic type.",
  }),
  item({
    id: 'rockmemory',
    name: 'Rock Memory',
    kind: 'held',
    price: 3000,
    memory: 'Rock',
    shortDesc: "Holder's Multi-Attack becomes Rock type.",
  }),
  item({
    id: 'steelmemory',
    name: 'Steel Memory',
    kind: 'held',
    price: 3000,
    memory: 'Steel',
    shortDesc: "Holder's Multi-Attack becomes Steel type.",
  }),
  item({
    id: 'watermemory',
    name: 'Water Memory',
    kind: 'held',
    price: 3000,
    memory: 'Water',
    shortDesc: "Holder's Multi-Attack becomes Water type.",
  }),
  item({
    id: 'burndrive',
    name: 'Burn Drive',
    kind: 'held',
    price: 3000,
    drive: 'Fire',
    shortDesc: "Holder's Techno Blast becomes Fire type.",
  }),
  item({
    id: 'chilldrive',
    name: 'Chill Drive',
    kind: 'held',
    price: 3000,
    drive: 'Ice',
    shortDesc: "Holder's Techno Blast becomes Ice type.",
  }),
  item({
    id: 'dousedrive',
    name: 'Douse Drive',
    kind: 'held',
    price: 3000,
    drive: 'Water',
    shortDesc: "Holder's Techno Blast becomes Water type.",
  }),
  item({
    id: 'shockdrive',
    name: 'Shock Drive',
    kind: 'held',
    price: 3000,
    drive: 'Electric',
    shortDesc: "Holder's Techno Blast becomes Electric type.",
  }),
];

/**
 * A route consumable's three effects (`Task-103`), each written through the
 * writer the matching NPC's card already calls.
 */
export type RouteEffect = NonNullable<ItemDef['routeEffect']>;

/** The five candy colours, in catalogue order. */
export const CANDY_COLOURS: readonly string[] = ['red', 'blue', 'green', 'yellow', 'pink'];

/** The stats a candy can move, in the order the per-run draw reads them. */
export const CANDY_STATS: readonly Exclude<StatId, 'hp'>[] = ['atk', 'def', 'spa', 'spd', 'spe'];

/** Chance a candy's treat is +1; the rest are −1. */
export const CANDY_POSITIVE_CHANCE = 0.75;

/** The catalogue id of a colour's candy: `candy<colour>`. */
export function candyItemId(colour: string): string {
  return `candy${normalizeId(colour)}`;
}

/** The five coloured candies: one catalogue row per colour, its treat drawn per run. */
export const CANDY_ITEMS: readonly ItemDef[] = [
  item({
    id: 'candyred',
    name: 'Red Candy',
    kind: 'heal',
    price: 2400,
    candy: 'red',
    iconFallback: 'berrysweet',
    shortDesc: 'One stat goes up or down for good. Which one is this run’s secret.',
  }),
  item({
    id: 'candyblue',
    name: 'Blue Candy',
    kind: 'heal',
    price: 2400,
    candy: 'blue',
    iconFallback: 'berrysweet',
    shortDesc: 'One stat goes up or down for good. Which one is this run’s secret.',
  }),
  item({
    id: 'candygreen',
    name: 'Green Candy',
    kind: 'heal',
    price: 2400,
    candy: 'green',
    iconFallback: 'berrysweet',
    shortDesc: 'One stat goes up or down for good. Which one is this run’s secret.',
  }),
  item({
    id: 'candyyellow',
    name: 'Yellow Candy',
    kind: 'heal',
    price: 2400,
    candy: 'yellow',
    iconFallback: 'berrysweet',
    shortDesc: 'One stat goes up or down for good. Which one is this run’s secret.',
  }),
  item({
    id: 'candypink',
    name: 'Pink Candy',
    kind: 'heal',
    price: 2400,
    candy: 'pink',
    iconFallback: 'berrysweet',
    shortDesc: 'One stat goes up or down for good. Which one is this run’s secret.',
  }),
];

/** Every candy id, for a shop band or a debug grant that hands one out. */
export const CANDY_ITEM_IDS: readonly string[] = CANDY_ITEMS.map((row) => row.id);

/**
 * The three route consumables (`Task-103`): the exorcist's, the weather man's and
 * the medic's work in a bottle. `kind: 'heal'` is the **gesture** the route bag
 * routes (a drop on a party member reaches `useItemOn`); `routeEffect` is what
 * actually happens, written by `run/items.ts` through the shipped writers.
 */
export const ROUTE_CONSUMABLE_ITEMS: readonly ItemDef[] = [
  item({
    id: 'exorcistbottle',
    name: 'Hex Bottle',
    kind: 'heal',
    price: 2000,
    routeEffect: { kind: 'curse' },
    iconFallback: 'fullrestore',
    shortDesc: 'The next enemy battle starts with its lead a stage down.',
  }),
  item({
    id: 'weatherbottle',
    name: 'Sun Bottle',
    kind: 'heal',
    price: 2000,
    routeEffect: { kind: 'sky', field: 'sun' },
    iconFallback: 'fullrestore',
    shortDesc: 'Harsh sunlight covers the next floors you walk.',
  }),
  item({
    id: 'medicbottle',
    name: 'Medic Bottle',
    kind: 'heal',
    price: 2000,
    routeEffect: { kind: 'heal' },
    iconFallback: 'fullrestore',
    shortDesc: 'Rests the whole party and the PC, and never revives the fallen.',
  }),
];

/** Every route consumable id. */
export const ROUTE_CONSUMABLE_IDS: readonly string[] = ROUTE_CONSUMABLE_ITEMS.map((row) => row.id);

/**
 * The eighteen Tera Crystals (`Task-103`), one per battle type in `TYPE_NAMES`
 * order: a held crystal makes the holder fight as that single type from the
 * moment it takes the field (`effects/items.ts`'s `onStart`).
 *
 * Written as one literal row per type rather than a `map` because
 * `scripts/effect-coverage.mjs` derives the registry's catalogue from the
 * `item({ id: '<id>', name: '<name>'` text: a mapped row would be invisible to the
 * generated coverage table. The order and the coverage of `TYPE_NAMES` are pinned
 * by `items.test.ts`.
 */
export const TERA_CRYSTALS: readonly ItemDef[] = [
  item({
    id: 'teracrystalbug',
    name: 'Bug Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Bug',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Bug in battle.",
  }),
  item({
    id: 'teracrystaldark',
    name: 'Dark Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Dark',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Dark in battle.",
  }),
  item({
    id: 'teracrystaldragon',
    name: 'Dragon Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Dragon',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Dragon in battle.",
  }),
  item({
    id: 'teracrystalelectric',
    name: 'Electric Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Electric',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Electric in battle.",
  }),
  item({
    id: 'teracrystalfairy',
    name: 'Fairy Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Fairy',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Fairy in battle.",
  }),
  item({
    id: 'teracrystalfighting',
    name: 'Fighting Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Fighting',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Fighting in battle.",
  }),
  item({
    id: 'teracrystalfire',
    name: 'Fire Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Fire',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Fire in battle.",
  }),
  item({
    id: 'teracrystalflying',
    name: 'Flying Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Flying',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Flying in battle.",
  }),
  item({
    id: 'teracrystalghost',
    name: 'Ghost Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Ghost',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Ghost in battle.",
  }),
  item({
    id: 'teracrystalgrass',
    name: 'Grass Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Grass',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Grass in battle.",
  }),
  item({
    id: 'teracrystalground',
    name: 'Ground Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Ground',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Ground in battle.",
  }),
  item({
    id: 'teracrystalice',
    name: 'Ice Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Ice',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Ice in battle.",
  }),
  item({
    id: 'teracrystalnormal',
    name: 'Normal Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Normal',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Normal in battle.",
  }),
  item({
    id: 'teracrystalpoison',
    name: 'Poison Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Poison',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Poison in battle.",
  }),
  item({
    id: 'teracrystalpsychic',
    name: 'Psychic Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Psychic',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Psychic in battle.",
  }),
  item({
    id: 'teracrystalrock',
    name: 'Rock Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Rock',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Rock in battle.",
  }),
  item({
    id: 'teracrystalsteel',
    name: 'Steel Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Steel',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Steel in battle.",
  }),
  item({
    id: 'teracrystalwater',
    name: 'Water Tera Crystal',
    kind: 'held',
    price: 4000,
    teraType: 'Water',
    iconFallback: 'hardstone',
    shortDesc: "While held, the holder's types become Water in battle.",
  }),
];

/** Every Tera Crystal id, one per `TYPE_NAMES` entry. */
export const TERA_CRYSTAL_IDS: readonly string[] = TERA_CRYSTALS.map((row) => row.id);

/** The type a held item imposes on its holder, or null. The one reader. */
export function teraTypeOf(itemId: string | null): string | null {
  if (!itemId) return null;
  return getItem(itemId)?.teraType ?? null;
}

/**
 * The competitive held-item set this catalogue adds: every `Port` row (its effect
 * is modelled by `engine/battle/effects/items.ts`, so the Mart may sell it) and
 * every `No-op` row (art, price and the `D16` record only, so only the ground
 * hands it out). The pools in `loot.ts` and `shop.ts` read this authority.
 *
 * The seventeen Plates (above) and the 21 **Memories/Drives** stay out of it:
 * they are modelled, **ground-only** treasure, and the Mart only sells what it
 * may buy at a shelf that already knows.
 */
export const COMPETITIVE_HELD: readonly ItemDef[] = [
  ...PORT_DAMAGE_ITEMS,
  ...PORT_SPEED_ITEMS,
  ...PORT_ACCURACY_ITEMS,
  ...PORT_CRIT_ITEMS,
  ...PORT_LAST_ITEMS,
  ...PORT_SURVIVE_ITEMS,
  ...PORT_RESIST_BERRY_ITEMS,
  ...PORT_PINCH_BERRY_ITEMS,
  ...PORT_STATUS_BERRY_ITEMS,
  ...PORT_HEAL_BERRY_ITEMS,
  ...PORT_SELF_STATUS_ITEMS,
  ...NOOP_BERRY_ITEMS,
  ...NOOP_ITEMS,
];

/** The ids of `COMPETITIVE_HELD`, for the obtainability test. */
export const COMPETITIVE_HELD_IDS: readonly string[] = COMPETITIVE_HELD.map((row) => row.id);

/** The ids of `MEMORY_DRIVE_ITEMS`, the ground-only obtainability list. */
export const MEMORY_DRIVE_IDS: readonly string[] = MEMORY_DRIVE_ITEMS.map((row) => row.id);

/**
 * The run's item catalogue: balls, heal/status consumables, `held` items
 * (Leftovers, berries, the 1.2x type items, the competitive held set, registered
 * by `effects/items.ts`) and `valuable` treasure, each with the price the shop
 * spends. There is no Revive anywhere (D5).
 */
export const ITEMS: readonly ItemDef[] = [
  item({
    id: 'pokeball',
    name: 'Poke Ball',
    kind: 'ball',
    price: 200,
    catchBonus: 1,
    shortDesc: 'A device for catching wild Pokémon.',
  }),
  item({
    id: 'premierball',
    name: 'Premier Ball',
    kind: 'ball',
    price: 200,
    catchBonus: 1,
    shortDesc: 'A commemorative Ball. The same catch rate as a Poke Ball.',
  }),
  item({
    id: 'greatball',
    name: 'Great Ball',
    kind: 'ball',
    price: 600,
    catchBonus: 1.5,
    shortDesc: 'A good Ball with a higher catch rate than a Poke Ball.',
  }),
  item({
    id: 'ultraball',
    name: 'Ultra Ball',
    kind: 'ball',
    price: 1200,
    catchBonus: 2,
    shortDesc: 'An ultra-performance Ball with a high catch rate.',
  }),
  item({
    id: 'masterball',
    name: 'Master Ball',
    kind: 'ball',
    price: 0,
    catchBonus: 255,
    shortDesc: 'The best Ball. It never fails to catch.',
  }),

  item({
    id: 'potion',
    name: 'Potion',
    kind: 'heal',
    price: 300,
    healAmount: 20,
    shortDesc: 'Restores 20 HP.',
  }),
  item({
    id: 'superpotion',
    name: 'Super Potion',
    kind: 'heal',
    price: 700,
    healAmount: 60,
    shortDesc: 'Restores 60 HP.',
  }),
  item({
    id: 'hyperpotion',
    name: 'Hyper Potion',
    kind: 'heal',
    price: 1200,
    healAmount: 120,
    shortDesc: 'Restores 120 HP.',
  }),
  item({
    id: 'fullrestore',
    name: 'Full Restore',
    kind: 'heal',
    price: 3000,
    healFraction: [1, 1],
    cures: 'all',
    shortDesc: 'Fully restores HP and clears any status.',
  }),

  item({
    id: 'antidote',
    name: 'Antidote',
    kind: 'status',
    price: 100,
    cures: ['psn', 'tox'],
    shortDesc: 'Cures poison.',
  }),
  item({
    id: 'paralyzeheal',
    name: 'Paralyze Heal',
    kind: 'status',
    price: 200,
    cures: ['par'],
    shortDesc: 'Cures paralysis.',
  }),
  item({
    id: 'awakening',
    name: 'Awakening',
    kind: 'status',
    price: 200,
    cures: ['slp'],
    shortDesc: 'Wakes a sleeping Pokémon.',
  }),
  item({
    id: 'burnheal',
    name: 'Burn Heal',
    kind: 'status',
    price: 250,
    cures: ['brn'],
    shortDesc: 'Cures a burn.',
  }),
  item({
    id: 'iceheal',
    name: 'Ice Heal',
    kind: 'status',
    price: 250,
    cures: ['frz'],
    shortDesc: 'Thaws a frozen Pokémon.',
  }),
  item({
    id: 'fullheal',
    name: 'Full Heal',
    kind: 'status',
    price: 600,
    cures: 'all',
    shortDesc: 'Clears any status condition.',
  }),

  item({
    id: 'leftovers',
    name: 'Leftovers',
    kind: 'held',
    price: 4000,
    healFraction: [1, 16],
    shortDesc: 'Holder restores a little HP every turn.',
  }),
  item({
    id: 'sitrusberry',
    name: 'Sitrus Berry',
    kind: 'held',
    price: 200,
    healFraction: [1, 4],
    below: [1, 2],
    consumed: true,
    shortDesc: 'Restores 1/4 max HP when HP is at or below half. Single use.',
  }),
  item({
    id: 'oranberry',
    name: 'Oran Berry',
    kind: 'held',
    price: 100,
    healAmount: 10,
    below: [1, 2],
    consumed: true,
    shortDesc: 'Restores 10 HP when HP is at or below half. Single use.',
  }),
  item({
    id: 'lumberry',
    name: 'Lum Berry',
    kind: 'held',
    price: 200,
    cures: 'all',
    consumed: true,
    shortDesc: 'Cures any status condition. Single use.',
  }),

  item({
    id: 'silkscarf',
    name: 'Silk Scarf',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Normal', multiplier: 1.2 },
    shortDesc: 'Powers up Normal-type moves.',
  }),
  item({
    id: 'charcoal',
    name: 'Charcoal',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Fire', multiplier: 1.2 },
    shortDesc: 'Powers up Fire-type moves.',
  }),
  item({
    id: 'mysticwater',
    name: 'Mystic Water',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Water', multiplier: 1.2 },
    shortDesc: 'Powers up Water-type moves.',
  }),
  item({
    id: 'miracleseed',
    name: 'Miracle Seed',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Grass', multiplier: 1.2 },
    shortDesc: 'Powers up Grass-type moves.',
  }),
  item({
    id: 'magnet',
    name: 'Magnet',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Electric', multiplier: 1.2 },
    shortDesc: 'Powers up Electric-type moves.',
  }),
  item({
    id: 'nevermeltice',
    name: 'Never-Melt Ice',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Ice', multiplier: 1.2 },
    shortDesc: 'Powers up Ice-type moves.',
  }),
  item({
    id: 'blackbelt',
    name: 'Black Belt',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Fighting', multiplier: 1.2 },
    shortDesc: 'Powers up Fighting-type moves.',
  }),
  item({
    id: 'poisonbarb',
    name: 'Poison Barb',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Poison', multiplier: 1.2 },
    shortDesc: 'Powers up Poison-type moves.',
  }),
  item({
    id: 'softsand',
    name: 'Soft Sand',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Ground', multiplier: 1.2 },
    shortDesc: 'Powers up Ground-type moves.',
  }),
  item({
    id: 'sharpbeak',
    name: 'Sharp Beak',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Flying', multiplier: 1.2 },
    shortDesc: 'Powers up Flying-type moves.',
  }),
  item({
    id: 'twistedspoon',
    name: 'Twisted Spoon',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Psychic', multiplier: 1.2 },
    shortDesc: 'Powers up Psychic-type moves.',
  }),
  item({
    id: 'silverpowder',
    name: 'Silver Powder',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Bug', multiplier: 1.2 },
    shortDesc: 'Powers up Bug-type moves.',
  }),
  item({
    id: 'hardstone',
    name: 'Hard Stone',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Rock', multiplier: 1.2 },
    shortDesc: 'Powers up Rock-type moves.',
  }),
  item({
    id: 'spelltag',
    name: 'Spell Tag',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Ghost', multiplier: 1.2 },
    shortDesc: 'Powers up Ghost-type moves.',
  }),
  item({
    id: 'dragonfang',
    name: 'Dragon Fang',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Dragon', multiplier: 1.2 },
    shortDesc: 'Powers up Dragon-type moves.',
  }),
  item({
    id: 'blackglasses',
    name: 'Black Glasses',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Dark', multiplier: 1.2 },
    shortDesc: 'Powers up Dark-type moves.',
  }),
  item({
    id: 'metalcoat',
    name: 'Metal Coat',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Steel', multiplier: 1.2 },
    shortDesc: 'Powers up Steel-type moves.',
  }),
  item({
    id: 'fairyfeather',
    name: 'Fairy Feather',
    kind: 'held',
    price: 1000,
    typeBoost: { type: 'Fairy', multiplier: 1.2 },
    shortDesc: 'Powers up Fairy-type moves.',
  }),

  // Valuables: pure treasure the ground-item loot turns up, worth real money at
  // the shop (`sellPrice`) and usable for nothing else, so they are the run's way
  // to cash out (`docs/maps-spec.md` §7, D33). They are never sold by the shop.
  item({
    id: 'stardust',
    name: 'Stardust',
    kind: 'valuable',
    price: 1000,
    shortDesc: 'Red sand that shimmers like a star. Sell it for money.',
  }),
  item({
    id: 'pearl',
    name: 'Pearl',
    kind: 'valuable',
    price: 1400,
    shortDesc: 'A pretty pearl. Sell it for money.',
  }),
  item({
    id: 'nugget',
    name: 'Nugget',
    kind: 'valuable',
    price: 5000,
    shortDesc: 'A lump of pure gold. Sell it for money.',
  }),
  item({
    id: 'starpiece',
    name: 'Star Piece',
    kind: 'valuable',
    price: 4900,
    shortDesc: 'A shard of a red star. Sell it for money.',
  }),
  item({
    id: 'rarebone',
    name: 'Rare Bone',
    kind: 'valuable',
    price: 5000,
    shortDesc: 'A rare bone. Sell it for money.',
  }),
  item({
    id: 'bigpearl',
    name: 'Big Pearl',
    kind: 'valuable',
    price: 7500,
    shortDesc: 'A large, lustrous pearl. Sell it for money.',
  }),
  item({
    id: 'pearlstring',
    name: 'Pearl String',
    kind: 'valuable',
    price: 8000,
    shortDesc: 'A string of pearls. Sell it for money.',
  }),
  item({
    id: 'bignugget',
    name: 'Big Nugget',
    kind: 'valuable',
    price: 10000,
    shortDesc: 'A big lump of pure gold. Sell it for money.',
  }),
  item({
    id: 'cometshard',
    name: 'Comet Shard',
    kind: 'valuable',
    price: 12000,
    shortDesc: 'A shard of a comet. Sell it for money.',
  }),
  item({
    id: 'egg',
    name: 'Egg',
    kind: 'valuable',
    price: 0,
    shortDesc: 'A mystery Egg from the slot machine. It hatches on the next floor.',
  }),

  ...PLATE_ITEMS,
  ...MEMORY_DRIVE_ITEMS,
  item({
    id: 'chefstew',
    name: 'Spiced Stew',
    kind: 'held',
    price: 1200,
    boosts: { atk: 1, spa: 1 },
    below: [1, 1],
    consumed: true,
    iconFallback: 'lavacookie',
    shortDesc: "The holder's Attack and Sp. Atk each rise one stage at the end of its first turn.",
  }),
  item({
    id: 'smokeball',
    name: 'Smoke Ball',
    kind: 'held',
    price: 4000,
    flee: true,
    shortDesc: 'The holder always escapes a wild battle, even one that forbids fleeing.',
  }),
  ...COMPETITIVE_HELD,
  ...MEGA_STONES,
  ...GMAX_STONES,
  ...TERA_CRYSTALS,
  ...CANDY_ITEMS,
  ...ROUTE_CONSUMABLE_ITEMS,
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

import { buyPrice, getItem } from './items';
import type { BandId } from './run';
import { tmItemId } from './tms';

export type ShopEntry = Readonly<{ itemId: string; weight: number }>;

const e = (itemId: string, weight: number): ShopEntry => ({ itemId, weight });

/** One Mart stock row's unit count and price: a pack buys `count` units for `price`. */
export type ShopPack = Readonly<{ itemId: string; count: number; price: number }>;

/**
 * A pack priced at **half** the catalogue sum of its units, snapped to a round
 * hundred. `sellPrice` is half the catalogue price too, so a pack resold unit by
 * unit returns exactly what it cost and never a profit (`docs/balance/economy.md`).
 */
const ballPack = (itemId: string, count: number): ShopPack => {
  const item = getItem(itemId);
  const unitPrice = item ? buyPrice(item) : 0;
  return { itemId, count, price: Math.round((unitPrice * count) / 2 / 100) * 100 };
};

/** The band's own ball, in a pack of ten at a discount. Stock row 1. */
export const SHOP_BALL_PACK: Readonly<Record<BandId, ShopPack>> = {
  early: ballPack('pokeball', 10),
  low: ballPack('pokeball', 10),
  mid: ballPack('greatball', 10),
  high: ballPack('greatball', 10),
  late: ballPack('ultraball', 10),
  end: ballPack('ultraball', 10),
};

/** The band's own heal rung. Stock row 2. */
export const SHOP_POTION: Readonly<Record<BandId, string>> = {
  early: 'potion',
  low: 'superpotion',
  mid: 'superpotion',
  high: 'hyperpotion',
  late: 'hyperpotion',
  end: 'fullrestore',
};

/**
 * The weighted pool the shelf's **two held rows** are drawn from: the held items
 * and berries that turn a floor's stock around. It never holds a valuable (those
 * are what the player sells here), a Mega Stone, a **G-Max Stone** (the stone is
 * its own fixed row from `late` on, exactly like the machine, so the held pool
 * holds neither), an item the engine does not model
 * (`UNMODELLED_ITEMS`), a cure (`kind: 'status'`) or a heal (`kind: 'heal'`):
 * the Mart sells no cure and no consumable, so those reach a run from ground loot and
 * the mini-boss reward alone (`src/data/loot.ts`). Every band lists at least
 * `SHOP_HELD_ROWS` distinct rows, or its shelf could not fill.
 *
 * Every **Port** row of `COMPETITIVE_HELD` (`src/data/items.ts`) is here exactly
 * once, banded by power: the cheap berries at `early`, the status berries and the
 * 1/3-HP berries at `low`, the 1000-class utility and the 1/3-HP berries at `mid`,
 * the Expert Belt and the pinch berries at `high`, and the category boosters, the
 * Life Orb, the Sashes and the resist berries from `late` on. The weights are the
 * pre-existing ones; the banding is balance data (O-M5).
 */
export const SHOP_ROTATION: Readonly<Record<BandId, readonly ShopEntry[]>> = {
  early: [e('oranberry', 2), e('cheriberry', 2), e('chestoberry', 2)],
  low: [
    e('oranberry', 2),
    e('sitrusberry', 1),
    e('cheriberry', 1),
    e('chestoberry', 1),
    e('pechaberry', 1),
    e('rawstberry', 1),
    e('aspearberry', 1),
  ],
  mid: [
    e('sitrusberry', 1),
    e('charcoal', 1),
    e('mysticwater', 1),
    e('widelens', 1),
    e('muscleband', 1),
    e('wiseglasses', 1),
    e('normalgem', 1),
    e('ironball', 1),
    e('laggingtail', 1),
    e('figyberry', 1),
    e('wikiberry', 1),
    e('magoberry', 1),
    e('aguavberry', 1),
    e('iapapaberry', 1),
  ],
  high: [
    e('sitrusberry', 1),
    e('lumberry', 1),
    e('miracleseed', 1),
    e('magnet', 1),
    e('expertbelt', 1),
    e('scopelens', 1),
    e('razorclaw', 1),
    e('liechiberry', 1),
    e('ganlonberry', 1),
    e('petayaberry', 1),
    e('apicotberry', 1),
    e('salacberry', 1),
    e('micleberry', 1),
  ],
  late: [
    e('sitrusberry', 1),
    e('lumberry', 1),
    e('leftovers', 1),
    e('blackglasses', 1),
    e('spelltag', 1),
    e('choiceband', 1),
    e('choicespecs', 1),
    e('choicescarf', 1),
    e('lifeorb', 1),
    e('focussash', 1),
    e('focusband', 1),
    e('flameorb', 1),
    e('toxicorb', 1),
    e('occaberry', 1),
    e('passhoberry', 1),
    e('wacanberry', 1),
    e('rindoberry', 1),
    e('yacheberry', 1),
    e('chopleberry', 1),
    e('kebiaberry', 1),
    e('shucaberry', 1),
    e('cobaberry', 1),
    e('payapaberry', 1),
    e('tangaberry', 1),
    e('chartiberry', 1),
    e('kasibberry', 1),
    e('habanberry', 1),
    e('colburberry', 1),
    e('babiriberry', 1),
    e('roseliberry', 1),
    e('chilanberry', 1),
  ],
  end: [
    e('sitrusberry', 1),
    e('leftovers', 1),
    e('dragonfang', 1),
    e('metalcoat', 1),
    e('sharpbeak', 1),
    e('choiceband', 1),
    e('choicespecs', 1),
    e('choicescarf', 1),
    e('lifeorb', 1),
    e('focussash', 1),
    e('focusband', 1),
    e('flameorb', 1),
    e('toxicorb', 1),
  ],
};

/** How many held rows a shop stocks. Frozen at 2 (`docs/maps-spec.md` §7). */
export const SHOP_HELD_ROWS = 2;

/**
 * The Mart's **TM slot** (`docs/maps-spec.md` §7): the machines a band's counter
 * may offer after its four stock rows. A band's list is non-empty, holds at least
 * six ids, is written in TM-catalogue order, shares no id with any other band, and
 * every later band's list starts after the previous band's last id, so the
 * machines on sale follow the band's power. Within those invariants the picks are
 * balance data (O-M5): each band spans eight moves whose types its stock does not
 * cover, and no id duplicates a machine the ground loot already drops
 * (`src/data/loot.ts`).
 */
export const SHOP_TM: Readonly<Record<BandId, readonly string[]>> = {
  early: [
    tmItemId(1),
    tmItemId(8),
    tmItemId(9),
    tmItemId(10),
    tmItemId(11),
    tmItemId(12),
    tmItemId(15),
    tmItemId(16),
  ],
  low: [
    tmItemId(33),
    tmItemId(34),
    tmItemId(36),
    tmItemId(37),
    tmItemId(44),
    tmItemId(45),
    tmItemId(48),
    tmItemId(53),
  ],
  mid: [
    tmItemId(61),
    tmItemId(62),
    tmItemId(67),
    tmItemId(68),
    tmItemId(69),
    tmItemId(77),
    tmItemId(79),
    tmItemId(86),
  ],
  high: [
    tmItemId(93),
    tmItemId(95),
    tmItemId(97),
    tmItemId(101),
    tmItemId(107),
    tmItemId(110),
    tmItemId(112),
    tmItemId(119),
  ],
  late: [
    tmItemId(121),
    tmItemId(123),
    tmItemId(125),
    tmItemId(126),
    tmItemId(127),
    tmItemId(131),
    tmItemId(133),
    tmItemId(140),
  ],
  end: [
    tmItemId(153),
    tmItemId(154),
    tmItemId(155),
    tmItemId(156),
    tmItemId(158),
    tmItemId(160),
    tmItemId(162),
    tmItemId(170),
  ],
};

/**
 * The bands whose Mart shows the **G-Max Stone** row (`D44`): the same late/end
 * cadence the ground shelf follows. The row draws one stone from the whole
 * catalogue (`GMAX_STONE_IDS`) at `GMAX_STONE_PRICE`, exactly as the machine row
 * draws one TM from `SHOP_TM`.
 */
export const SHOP_GMAX_STONE_BANDS: readonly BandId[] = ['late', 'end'];

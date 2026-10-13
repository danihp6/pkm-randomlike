import { tmItemId } from './tms';
import type { BandId } from './run';

export type ShopEntry = Readonly<{ itemId: string; weight: number }>;

const e = (itemId: string, weight: number): ShopEntry => ({ itemId, weight });

/**
 * The **core** a shop always stocks for a band: the Balls and Potions that improve
 * with the map, plus a cure (`docs/maps-spec.md` §7, D33). Balance data (O-M5),
 * so retuning a shop never touches the model that builds it.
 */
export const SHOP_CORE: Readonly<Record<BandId, readonly string[]>> = {
  early: ['pokeball', 'potion'],
  low: ['pokeball', 'superpotion'],
  mid: ['greatball', 'superpotion', 'antidote'],
  high: ['greatball', 'hyperpotion', 'fullheal'],
  late: ['ultraball', 'hyperpotion', 'fullrestore'],
  end: ['ultraball', 'fullrestore', 'fullheal'],
};

/**
 * The weighted pool the shop's one or two **rotating** items are drawn from: the
 * held items, berries and X-items that turn a floor's stock around. It never holds
 * a valuable (those are what the player sells here), a Mega Stone or an item the
 * engine does not model (`UNMODELLED_ITEMS`): those reach a run from the ground
 * alone (`src/data/loot.ts`), so the player is never sold a dead ball.
 *
 * Every **Port** row of `COMPETITIVE_HELD` (`src/data/items.ts`) is here exactly
 * once, banded by power: the status berries at `low`, the cheap utility and the
 * 1/3-HP berries at `mid`, the Expert Belt and the pinch berries at `high`, and
 * the category boosters, the Life Orb, the Sashes and the resist berries from
 * `late` on. Every weight is 1; the banding is balance data (O-M5).
 */
export const SHOP_ROTATION: Readonly<Record<BandId, readonly ShopEntry[]>> = {
  early: [e('antidote', 2), e('oranberry', 2), e('xattack', 1)],
  low: [
    e('paralyzeheal', 2),
    e('oranberry', 2),
    e('xattack', 2),
    e('sitrusberry', 1),
    e('cheriberry', 1),
    e('chestoberry', 1),
    e('pechaberry', 1),
    e('rawstberry', 1),
    e('aspearberry', 1),
  ],
  mid: [
    e('fullheal', 2),
    e('xdefense', 2),
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
    e('xattack', 2),
    e('xdefense', 2),
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
    e('xattack', 1),
    e('xspeed', 2),
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
    e('xspeed', 2),
    e('fullheal', 1),
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

/**
 * The Mart's **TM slot** (`docs/maps-spec.md` §7): the machines a band's counter
 * may offer beside its core and its rotation. A band's list is non-empty, holds at
 * least six ids, is written in TM-catalogue order, shares no id with any other
 * band, and every later band's list starts after the previous band's last id, so
 * the machines on sale follow the band's power. Within those invariants the picks
 * are balance data (O-M5): each band spans eight moves whose types its core and
 * rotation do not cover, and no id duplicates a machine the ground loot already
 * drops (`src/data/loot.ts`).
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

/** How many rotating items a shop stocks: one or two (`docs/maps-spec.md` §7). */
export const SHOP_ROTATION_COUNT = { min: 1, max: 2 } as const;

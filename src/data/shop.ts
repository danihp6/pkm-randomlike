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

/** How many rotating items a shop stocks: one or two (`docs/maps-spec.md` §7). */
export const SHOP_ROTATION_COUNT = { min: 1, max: 2 } as const;

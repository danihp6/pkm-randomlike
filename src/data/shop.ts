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
 * a valuable (those are what the player sells here) or a Mega Stone, so the shop
 * cannot sell the run back its own treasure.
 */
export const SHOP_ROTATION: Readonly<Record<BandId, readonly ShopEntry[]>> = {
  early: [e('antidote', 2), e('oranberry', 2), e('xattack', 1)],
  low: [e('paralyzeheal', 2), e('oranberry', 2), e('xattack', 2), e('sitrusberry', 1)],
  mid: [
    e('fullheal', 2),
    e('xdefense', 2),
    e('sitrusberry', 1),
    e('charcoal', 1),
    e('mysticwater', 1),
  ],
  high: [
    e('xattack', 2),
    e('xdefense', 2),
    e('sitrusberry', 1),
    e('lumberry', 1),
    e('miracleseed', 1),
    e('magnet', 1),
  ],
  late: [
    e('xattack', 1),
    e('xspeed', 2),
    e('sitrusberry', 1),
    e('lumberry', 1),
    e('leftovers', 1),
    e('blackglasses', 1),
    e('spelltag', 1),
  ],
  end: [
    e('xspeed', 2),
    e('fullheal', 1),
    e('sitrusberry', 1),
    e('leftovers', 1),
    e('dragonfang', 1),
    e('metalcoat', 1),
    e('sharpbeak', 1),
  ],
};

/** How many rotating items a shop stocks: one or two (`docs/maps-spec.md` §7). */
export const SHOP_ROTATION_COUNT = { min: 1, max: 2 } as const;

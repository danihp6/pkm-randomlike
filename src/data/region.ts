/**
 * The region's balance tables: how big a settlement, an interior, a gym and a
 * route are, the eight badge caps, the League's level and the word lists a
 * settlement's name is drawn from. A run is one region (`docs/region-spec.md`),
 * so these numbers are the only place a generator or a scene reads a size or a
 * level from; retuning a region never touches the engine.
 */

/** A tile count a generated map is drawn on. */
export type RegionSize = Readonly<{ width: number; height: number }>;

/**
 * One rung of the city ladder: the badges it covers, the tile square it is drawn
 * on and how many buildings it holds. City 1-2 is the on-ramp, 6-8 the late band.
 */
export type CityTier = Readonly<{
  tier: 1 | 2 | 3;
  badges: readonly number[];
  size: RegionSize;
  buildings: number;
}>;

/** The starting town: one laboratory, one house and its patch of grass, no Centre. */
export const TOWN_SIZE: RegionSize = { width: 40, height: 40 };

export const CITY_TIERS: readonly CityTier[] = [
  { tier: 1, badges: [1, 2], size: { width: 50, height: 50 }, buildings: 6 },
  { tier: 2, badges: [3, 4, 5], size: { width: 70, height: 70 }, buildings: 10 },
  { tier: 3, badges: [6, 7, 8], size: { width: 90, height: 90 }, buildings: 14 },
];

/** A building's inside: one screen, a counter and a bench, never a corridor. */
export const INTERIOR_SIZE: RegionSize = { width: 24, height: 18 };

/** The gym's inside: a run of rooms with the leader's chamber at the end. */
export const GYM_SIZE: RegionSize = { width: 40, height: 40 };

/** Every route is this many tiles wide; its height is one of `ROUTE_HEIGHTS`. */
export const ROUTE_WIDTH = 60;

/** What a route is tall, in screens: two, three or four 60x40 screens (`docs/region-spec.md`). */
export const ROUTE_HEIGHTS: readonly [120, 160, 200] = [120, 160, 200];

/** The level cap each badge's stretch enforces, in badge order (D29: the cap is the anchor). */
export const BADGE_CAPS: readonly [9, 16, 23, 30, 37, 43, 49, 55] = [9, 16, 23, 30, 37, 43, 49, 55];

/** The four Elite Four members and the Champion all field this level (`docs/region-spec.md` §3). */
export const LEAGUE_LEVEL = 60;

/** Settlement names are procedural per seed: `Adjective Noun`, Fortnite style (D12: English). */
export const NAME_ADJECTIVES: readonly string[] = [
  'Crimson',
  'Silent',
  'Golden',
  'Frozen',
  'Verdant',
  'Hollow',
  'Amber',
  'Cobalt',
  'Misty',
  'Iron',
  'Lunar',
  'Mossy',
  'Scarlet',
  'Dusty',
  'Sacred',
  'Wandering',
];

export const NAME_NOUNS: readonly string[] = [
  'Vale',
  'Harbor',
  'Ridge',
  'Grove',
  'Falls',
  'Meadow',
  'Peak',
  'Brook',
  'Haven',
  'Crest',
  'Field',
  'Bay',
  'Bridge',
  'Port',
  'Point',
  'Reach',
];

/** The one badge that is not a gym: the Victory Road, the League and the tower share it. */
const LEAGUE_BADGE = BADGE_CAPS.length + 1;

/** The city tier a badge's city is built from. Throws outside badges 1-8: a caller never passes 9. */
export function cityTierForBadge(badge: number): CityTier {
  const tier = CITY_TIERS.find((row) => row.badges.includes(badge));
  if (!tier) throw new Error(`no city tier for badge ${badge}`);
  return tier;
}

/** The level cap a badge's stretch enforces: badges 1-8 off `BADGE_CAPS`, badge 9 the League's. */
export function badgeCap(badge: number): number {
  if (badge === LEAGUE_BADGE) return LEAGUE_LEVEL;
  const cap = BADGE_CAPS[badge - 1];
  if (cap === undefined) throw new Error(`no badge cap for badge ${badge}`);
  return cap;
}

/** The tile square a badge's city is drawn on. */
export function citySize(badge: number): RegionSize {
  return cityTierForBadge(badge).size;
}

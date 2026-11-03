import { describe, expect, it } from 'vitest';
import {
  BADGE_CAPS,
  CITY_TIERS,
  GYM_SIZE,
  INTERIOR_SIZE,
  LEAGUE_LEVEL,
  NAME_ADJECTIVES,
  NAME_NOUNS,
  REGION_COUNTS,
  ROUTE_HEIGHTS,
  ROUTE_WIDTH,
  TOWN_SIZE,
  badgeCap,
  citySize,
  cityTierForBadge,
} from './region';

describe('region counts', () => {
  it('pins the scale every region holds', () => {
    expect(REGION_COUNTS.towns).toBe(1);
    expect(REGION_COUNTS.cities).toBe(8);
    expect(REGION_COUNTS.mainRoutes).toBe(8);
    expect(REGION_COUNTS.lateralsPerStretch).toEqual({ min: 1, max: 2 });
    expect(REGION_COUNTS.victoryRoads).toBe(1);
    expect(REGION_COUNTS.leagues).toBe(1);
    expect(REGION_COUNTS.towers).toBe(1);
    expect(REGION_COUNTS.settlements).toBe(9);
    expect(REGION_COUNTS.settlements).toBe(REGION_COUNTS.towns + REGION_COUNTS.cities);
  });

  it('keeps every count a positive integer', () => {
    const counts: readonly (readonly [string, number])[] = [
      ['towns', REGION_COUNTS.towns],
      ['cities', REGION_COUNTS.cities],
      ['mainRoutes', REGION_COUNTS.mainRoutes],
      ['lateralsPerStretch.min', REGION_COUNTS.lateralsPerStretch.min],
      ['lateralsPerStretch.max', REGION_COUNTS.lateralsPerStretch.max],
      ['victoryRoads', REGION_COUNTS.victoryRoads],
      ['leagues', REGION_COUNTS.leagues],
      ['towers', REGION_COUNTS.towers],
      ['settlements', REGION_COUNTS.settlements],
    ];
    for (const [name, value] of counts) {
      expect(Number.isInteger(value), name).toBe(true);
      expect(value, name).toBeGreaterThan(0);
    }
  });

  it('ships one main route per city and an ordered detour range', () => {
    expect(REGION_COUNTS.mainRoutes).toBe(REGION_COUNTS.cities);
    expect(REGION_COUNTS.lateralsPerStretch.max).toBeGreaterThanOrEqual(
      REGION_COUNTS.lateralsPerStretch.min,
    );
  });
});

describe('region sizes', () => {
  it('pins the town, the interior, the gym and the route', () => {
    expect(TOWN_SIZE).toEqual({ width: 40, height: 40 });
    expect(INTERIOR_SIZE).toEqual({ width: 24, height: 18 });
    expect(GYM_SIZE).toEqual({ width: 40, height: 40 });
    expect(ROUTE_WIDTH).toBe(60);
    expect(ROUTE_HEIGHTS).toEqual([120, 160, 200]);
    expect([...ROUTE_HEIGHTS].sort((a, b) => a - b)).toEqual([...ROUTE_HEIGHTS]);
  });
});

describe('region city ladder', () => {
  it('ships three tiers with their badges, squares and building counts', () => {
    expect(CITY_TIERS.map((tier) => tier.tier)).toEqual([1, 2, 3]);
    expect(CITY_TIERS.map((tier) => tier.badges)).toEqual([
      [1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ]);
    expect(CITY_TIERS.map((tier) => tier.size)).toEqual([
      { width: 50, height: 50 },
      { width: 70, height: 70 },
      { width: 90, height: 90 },
    ]);
    expect(CITY_TIERS.map((tier) => tier.buildings)).toEqual([6, 10, 14]);
  });

  it('covers badges 1-8 exactly once and grows with the badge', () => {
    const badges = CITY_TIERS.flatMap((tier) => [...tier.badges]);
    expect(badges).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    let previous = citySize(1);
    for (let badge = 1; badge <= 8; badge++) {
      const size = citySize(badge);
      expect(size.width).toBeGreaterThanOrEqual(previous.width);
      expect(size.height).toBeGreaterThanOrEqual(previous.height);
      expect(cityTierForBadge(badge).badges).toContain(badge);
      previous = size;
    }
  });

  it('refuses a badge that names no city', () => {
    for (const badge of [0, 9, 10, -1, 2.5]) {
      expect(() => cityTierForBadge(badge), `${badge}`).toThrow();
      expect(() => citySize(badge), `${badge}`).toThrow();
    }
  });
});

describe('region badge caps', () => {
  it('pins the eight caps and the League level', () => {
    expect(BADGE_CAPS).toEqual([9, 16, 23, 30, 37, 43, 49, 55]);
    expect(LEAGUE_LEVEL).toBe(60);
    for (let badge = 1; badge <= 8; badge++) {
      expect(badgeCap(badge), `${badge}`).toBe(BADGE_CAPS[badge - 1]);
    }
    expect(badgeCap(9)).toBe(LEAGUE_LEVEL);
  });

  it('rises with the badge and closes the gap to the League', () => {
    let previous = badgeCap(1);
    for (let badge = 2; badge <= BADGE_CAPS.length; badge++) {
      expect(badgeCap(badge)).toBeGreaterThan(previous);
      previous = badgeCap(badge);
    }
    expect(badgeCap(9)).toBeGreaterThan(previous);
  });

  it('refuses a badge outside 1-9', () => {
    for (const badge of [0, 10, -1, 1.5]) {
      expect(() => badgeCap(badge), `${badge}`).toThrow();
    }
  });
});

describe('region name lists', () => {
  it('holds at least twelve title-cased single words on each list, none repeated', () => {
    for (const list of [NAME_ADJECTIVES, NAME_NOUNS]) {
      expect(list.length).toBeGreaterThanOrEqual(12);
      expect(new Set(list).size).toBe(list.length);
      for (const word of list) expect(word).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('can name every settlement of a region with words to spare', () => {
    expect(NAME_ADJECTIVES.length * NAME_NOUNS.length).toBeGreaterThanOrEqual(9);
  });
});

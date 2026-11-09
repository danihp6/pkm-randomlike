import { describe, expect, it } from 'vitest';
import { citySize, cityTierForBadge, TOWN_SIZE } from '../../../data/region';
import { FRLG_CITY_TILESET } from '../../../data/tilesets/city';
import { CITY_BUILDING_SPRITES } from '../../../data/tilesets/cityBuildings';
import type { Tile } from '../../grid';
import { DOOR, PATH, ROOF, TALL_GRASS, WALL, isWalkable, tileAt, type TileMap } from '../../map';
import { hashSeed } from '../../rng';
import { reachableTiles } from '../../routes/validate';
import { resolveTileFrame } from '../../tileFrames';
import { nodeOf, planRegion, type RegionPlan } from '../plan';
import { planCity, type CityPlan } from './plan';

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

const BADGES = [1, 2, 3, 4, 5, 6, 7, 8];

const SETTLEMENT_KEYS = ['town:1', ...BADGES.map((badge) => `city:${badge}`)];

function settlementsOf(seed: string): readonly CityPlan[] {
  const plan = planRegion(seed);
  return SETTLEMENT_KEYS.map((key) => planCity(plan, key));
}

function digest(city: CityPlan): string {
  return (
    `${city.width}x${city.height}|${city.tier}|${city.spawn.x},${city.spawn.y}|` +
    city.buildings
      .map(
        (building) => `${building.kind}@${building.door.x},${building.door.y}:${building.interiorKey}`,
      )
      .join('|') +
    '|exits:' +
    city.exits
      .map(
        (band) =>
          `${band.edge}:${band.neighbourKey}:${band.tiles.map((tile) => `${tile.x},${tile.y}`).join('.')}`,
      )
      .join('|') +
    '|grass:' +
    city.grass.length +
    '|' +
    hashSeed(city.tiles.map((row) => row.join('')).join('/')).toString(36)
  );
}

function south(tile: Tile): Tile {
  return { x: tile.x, y: tile.y + 1 };
}

function insideRect(
  tile: Tile,
  rect: Readonly<{ x: number; y: number; width: number; height: number }>,
): boolean {
  return (
    tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.width && tile.y < rect.y + rect.height
  );
}

function countKind(city: CityPlan, kind: string): number {
  return city.buildings.filter((building) => building.kind === kind).length;
}

function allCells(tiles: TileMap): readonly Tile[] {
  const cells: Tile[] = [];
  tiles.forEach((row, y) => row.forEach((_value, x) => cells.push({ x, y })));
  return cells;
}

describe('city plan', () => {
  it('gives every tier its own square and building count', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const badge of BADGES) {
        const city = planCity(plan, `city:${badge}`);
        const tier = cityTierForBadge(badge);
        const size = citySize(badge);
        expect(city.width, `${seed} city:${badge}`).toBe(size.width);
        expect(city.height, `${seed} city:${badge}`).toBe(size.height);
        expect(city.buildings.length, `${seed} city:${badge}`).toBe(tier.buildings);
        expect(city.tier, `${seed} city:${badge}`).toBe(tier.tier);
      }
    }
  });

  it('gives the Centre, the gym and the laboratory a door on the blockâ€™s street row', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const key of SETTLEMENT_KEYS) {
        const city = planCity(plan, key);
        const cityNode = nodeOf(plan, key);
        expect(cityNode, `${seed} ${key}`).toBeDefined();
        if (cityNode?.kind === 'city') {
          expect(countKind(city, 'centre'), `${seed} ${key}`).toBe(1);
          expect(countKind(city, 'gym'), `${seed} ${key}`).toBe(1);
        } else {
          expect(countKind(city, 'centre'), `${seed} ${key}`).toBe(0);
          expect(countKind(city, 'gym'), `${seed} ${key}`).toBe(0);
          expect(countKind(city, 'casino'), `${seed} ${key}`).toBe(0);
        }
        expect(countKind(city, 'lab'), `${seed} ${key}`).toBe(1);
        for (const building of city.buildings) {
          expect(tileAt(city.tiles, building.door), `${seed} ${key} ${building.kind}`).toBe(DOOR);
          const below = south(building.door);
          expect(tileAt(city.tiles, below), `${seed} ${key} ${building.kind}`).toBe(PATH);
          expect(isWalkable(city.tiles, below), `${seed} ${key} ${building.kind}`).toBe(true);
          expect(insideRect(building.door, building.rect), `${seed} ${key} ${building.kind}`).toBe(true);
        }
      }
    }
  });

  it('draws a whole-house sprite whose own door column is the mapâ€™s door', () => {
    for (const seed of SEEDS) {
      for (const city of settlementsOf(seed)) {
        for (const building of city.buildings) {
          const label = `${seed} ${city.key} ${building.kind}`;
          expect(building.sprite, label).toBeGreaterThanOrEqual(0);
          expect(building.sprite, label).toBeLessThan(CITY_BUILDING_SPRITES.length);
          const sprite = CITY_BUILDING_SPRITES[building.sprite];
          expect(building.rect.width, label).toBe(5);
          expect(building.rect.height, label).toBe(6);
          expect(building.door.x, label).toBe(building.rect.x + sprite.door);
          expect(building.door.y, label).toBe(building.rect.y + building.rect.height - 1);
          expect(tileAt(city.tiles, building.door), label).toBe(DOOR);
          for (let x = 0; x < building.rect.width; x++) {
            const front = { x: building.rect.x + x, y: building.door.y };
            const expected = x === sprite.door ? DOOR : WALL;
            expect(tileAt(city.tiles, front), `${label} front ${x}`).toBe(expected);
          }
          for (let y = 0; y < building.rect.height - 1; y++) {
            for (let x = 0; x < building.rect.width; x++) {
              const roof = { x: building.rect.x + x, y: building.rect.y + y };
              expect(tileAt(city.tiles, roof), `${label} roof ${x},${y}`).toBe(ROOF);
            }
          }
        }
      }
    }
  });

  it('sits every building on its blockâ€™s bottom row', () => {
    for (const seed of SEEDS) {
      for (const city of settlementsOf(seed)) {
        for (const building of city.buildings) {
          const bottom = building.rect.y + building.rect.height - 1;
          for (let x = 0; x < building.rect.width; x++) {
            const below = { x: building.rect.x + x, y: bottom + 1 };
            expect(tileAt(city.tiles, below), `${seed} ${city.key} ${building.kind}`).toBe(PATH);
          }
        }
      }
    }
  });

  it('reaches every exit band from the spawn', () => {
    for (const seed of SEEDS) {
      const plan = planRegion(seed);
      for (const key of SETTLEMENT_KEYS) {
        const city = planCity(plan, key);
        const cityNode = nodeOf(plan, key);
        expect(city.exits.map((band) => band.neighbourKey).sort(), `${seed} ${key}`).toEqual(
          [...(cityNode?.edges ?? [])].sort(),
        );
        expect(isWalkable(city.tiles, city.spawn), `${seed} ${key}`).toBe(true);
        const reached = reachableTiles(city.tiles, city.spawn);
        for (const band of city.exits) {
          for (const cell of band.tiles) {
            expect(isWalkable(city.tiles, cell), `${seed} ${key} ${band.edge}`).toBe(true);
            expect(reached.has(`${cell.x},${cell.y}`), `${seed} ${key} ${band.edge}`).toBe(true);
          }
        }
      }
    }
  });

  it('draws the grass corner on every settlement', () => {
    for (const seed of SEEDS) {
      for (const city of settlementsOf(seed)) {
        expect(city.grass.length, `${seed} ${city.key}`).toBeGreaterThanOrEqual(9);
        const reached = reachableTiles(city.tiles, city.spawn);
        const left = Math.min(...city.grass.map((cell) => cell.x));
        const right = Math.max(...city.grass.map((cell) => cell.x));
        const top = Math.min(...city.grass.map((cell) => cell.y));
        const bottom = Math.max(...city.grass.map((cell) => cell.y));
        for (const cell of city.grass) {
          expect(tileAt(city.tiles, cell), `${seed} ${city.key}`).toBe(TALL_GRASS);
          expect(reached.has(`${cell.x},${cell.y}`), `${seed} ${city.key}`).toBe(true);
          expect(
            insideRect(cell, { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }),
          ).toBe(true);
        }
      }
    }
  });

  it('makes the town the same generator with no Centre', () => {
    for (const seed of SEEDS) {
      const plan: RegionPlan = planRegion(seed);
      const town = planCity(plan, 'town:1');
      expect(town.tier, seed).toBeNull();
      expect(town.width, seed).toBe(TOWN_SIZE.width);
      expect(town.height, seed).toBe(TOWN_SIZE.height);
      expect(town.buildings.length, seed).toBe(2);
      expect(
        town.buildings.map((building) => building.kind),
        seed,
      ).toEqual(['lab', 'house']);
      expect(countKind(town, 'centre'), seed).toBe(0);
      expect(countKind(town, 'gym'), seed).toBe(0);
      expect(town.exits.length, seed).toBe(1);
      expect(town.exits[0].neighbourKey, seed).toBe('route:1');
    }
  });

  it('resolves every cell to a frame in the city tileset', () => {
    const unresolved: string[] = [];
    for (const seed of SEEDS) {
      for (const city of settlementsOf(seed)) {
        for (const cell of allCells(city.tiles)) {
          if (resolveTileFrame(city.tiles, cell.x, cell.y, FRLG_CITY_TILESET) === null) {
            unresolved.push(`${seed} ${city.key} ${cell.x},${cell.y}`);
          }
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("pins a fixed seed's settlement digests", () => {
    const plan = planRegion('alpha');
    expect(SETTLEMENT_KEYS.map((key) => digest(planCity(plan, key)))).toEqual([
      '40x40|null|19,19|lab@18,32:lab|house@9,22:house|exits:E:route:1:38,13.38,14.38,15.39,13.39,14.39,15|grass:49|1xgwfl0',
      '50x50|1|29,29|centre@18,12:centre|gym@27,12:gym|lab@28,42:lab|house@9,32:house:1|house@29,22:house:2|house@39,32:house:3|exits:W:route:1:0,23.0,24.0,25.1,23.1,24.1,25|E:route:2:48,23.48,24.48,25.49,23.49,24.49,25|grass:49|s58em',
      '50x50|1|29,29|centre@8,12:centre|gym@17,42:gym|lab@28,42:lab|house@9,22:house:1|house@39,22:house:2|house@9,32:house:3|exits:W:route:2:0,23.0,24.0,25.1,23.1,24.1,25|E:route:3:48,23.48,24.48,25.49,23.49,24.49,25|grass:49|1us91g7',
      '70x70|2|39,39|centre@58,52:centre|gym@7,12:gym|lab@28,22:lab|casino@59,12:casino|house@9,32:house:1|house@39,62:house:2|house@49,62:house:3|house@19,22:house:4|house@29,42:house:5|house@59,32:house:6|exits:W:route:3:0,33.0,34.0,35.1,33.1,34.1,35|E:route:4:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|1bgho5a',
      '70x70|2|39,39|centre@58,52:centre|gym@37,22:gym|lab@48,32:lab|casino@49,52:casino|house@59,32:house:1|house@29,12:house:2|house@49,62:house:3|house@9,52:house:4|house@29,32:house:5|house@49,12:house:6|exits:W:route:4:0,33.0,34.0,35.1,33.1,34.1,35|E:route:5:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|1gvnqa',
      '70x70|2|39,39|centre@58,12:centre|gym@37,12:gym|lab@38,62:lab|casino@59,22:casino|house@29,32:house:1|house@9,52:house:2|house@39,32:house:3|house@59,32:house:4|house@59,52:house:5|house@29,52:house:6|exits:W:route:5:0,33.0,34.0,35.1,33.1,34.1,35|E:route:6:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|6dphz5',
      '90x90|3|49,49|centre@8,52:centre|gym@37,82:gym|lab@18,82:lab|casino@59,12:casino|house@69,72:house:1|house@69,82:house:2|house@39,72:house:3|house@29,22:house:4|house@69,32:house:5|house@19,42:house:6|house@79,72:house:7|house@69,22:house:8|house@9,72:house:9|house@9,32:house:10|exits:W:route:6:0,43.0,44.0,45.1,43.1,44.1,45|E:route:7:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|13yfvrk',
      '90x90|3|49,49|centre@78,52:centre|gym@77,42:gym|lab@68,62:lab|casino@19,42:casino|house@9,52:house:1|house@49,22:house:2|house@69,72:house:3|house@29,32:house:4|house@29,42:house:5|house@29,82:house:6|house@59,12:house:7|house@29,12:house:8|house@9,12:house:9|house@49,42:house:10|exits:W:route:7:0,43.0,44.0,45.1,43.1,44.1,45|E:route:8:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|142tegv',
      '90x90|3|49,49|centre@78,32:centre|gym@27,32:gym|lab@8,52:lab|casino@59,32:casino|house@39,82:house:1|house@79,62:house:2|house@69,12:house:3|house@19,32:house:4|house@9,82:house:5|house@79,22:house:6|house@79,72:house:7|house@9,62:house:8|house@69,42:house:9|house@69,22:house:10|exits:W:route:8:0,43.0,44.0,45.1,43.1,44.1,45|E:victory-road:1:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|1a2hd52',
    ]);
  });

  it('rejects a key that is not a settlement', () => {
    const plan = planRegion('alpha');
    expect(() => planCity(plan, 'route:1')).toThrow('not a settlement: route:1');
    expect(() => planCity(plan, 'league:1')).toThrow('not a settlement: league:1');
    expect(() => planCity(plan, 'nope:1')).toThrow('not a settlement: nope:1');
  });
});


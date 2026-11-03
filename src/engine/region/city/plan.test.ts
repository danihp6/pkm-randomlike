import { describe, expect, it } from 'vitest';
import { citySize, cityTierForBadge, TOWN_SIZE } from '../../../data/region';
import { FRLG_CITY_TILESET } from '../../../data/tilesets/city';
import type { Tile } from '../../grid';
import { DOOR, PATH, TALL_GRASS, isWalkable, tileAt, type TileMap } from '../../map';
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

function north(tile: Tile): Tile {
  return { x: tile.x, y: tile.y - 1 };
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

  it('gives the Centre, the gym and the laboratory a door', () => {
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
          const above = north(building.door);
          expect(tileAt(city.tiles, above), `${seed} ${key} ${building.kind}`).toBe(PATH);
          expect(isWalkable(city.tiles, above), `${seed} ${key} ${building.kind}`).toBe(true);
          expect(insideRect(building.door, building.rect), `${seed} ${key} ${building.kind}`).toBe(true);
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
    for (const seed of SEEDS) {
      for (const city of settlementsOf(seed)) {
        for (const cell of allCells(city.tiles)) {
          expect(
            resolveTileFrame(city.tiles, cell.x, cell.y, FRLG_CITY_TILESET),
            `${seed} ${city.key} ${cell.x},${cell.y}`,
          ).not.toBeNull();
        }
      }
    }
  });

  it("pins a fixed seed's settlement digests", () => {
    const plan = planRegion('alpha');
    expect(SETTLEMENT_KEYS.map((key) => digest(planCity(plan, key)))).toEqual([
      '40x40|null|19,19|lab@19,26:lab|house@9,16:house|exits:E:route:1:38,13.38,14.38,15.39,13.39,14.39,15|grass:49|m8ta4c',
      '50x50|1|29,29|centre@18,6:centre|gym@27,6:gym|lab@30,36:lab|house@8,26:house:1|house@28,16:house:2|house@37,26:house:3|exits:W:route:1:0,23.0,24.0,25.1,23.1,24.1,25|E:route:2:48,23.48,24.48,25.49,23.49,24.49,25|grass:49|h67rp3',
      '50x50|1|29,29|centre@7,6:centre|gym@17,36:gym|lab@29,36:lab|house@9,16:house:1|house@37,16:house:2|house@9,26:house:3|exits:W:route:2:0,23.0,24.0,25.1,23.1,24.1,25|E:route:3:48,23.48,24.48,25.49,23.49,24.49,25|grass:49|eb63wy',
      '70x70|2|39,39|centre@60,46:centre|gym@6,6:gym|lab@27,16:lab|casino@57,6:casino|house@10,26:house:1|house@36,56:house:2|house@46,56:house:3|house@18,16:house:4|house@26,36:house:5|house@59,26:house:6|exits:W:route:3:0,33.0,34.0,35.1,33.1,34.1,35|E:route:4:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|11hwnmm',
      '70x70|2|39,39|centre@60,46:centre|gym@38,16:gym|lab@50,26:lab|casino@47,46:casino|house@60,26:house:1|house@29,6:house:2|house@47,56:house:3|house@8,46:house:4|house@27,26:house:5|house@46,6:house:6|exits:W:route:4:0,33.0,34.0,35.1,33.1,34.1,35|E:route:5:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|11erdve',
      '70x70|2|39,39|centre@57,6:centre|gym@40,6:gym|lab@39,56:lab|casino@57,16:casino|house@26,26:house:1|house@7,46:house:2|house@40,26:house:3|house@56,26:house:4|house@57,46:house:5|house@28,46:house:6|exits:W:route:5:0,33.0,34.0,35.1,33.1,34.1,35|E:route:6:68,33.68,34.68,35.69,33.69,34.69,35|grass:49|l2gpey',
      '90x90|3|49,49|centre@6,46:centre|gym@39,76:gym|lab@16,76:lab|casino@58,6:casino|house@67,66:house:1|house@66,76:house:2|house@39,66:house:3|house@26,16:house:4|house@67,26:house:5|house@18,36:house:6|house@77,66:house:7|house@66,16:house:8|house@8,66:house:9|house@9,26:house:10|exits:W:route:6:0,43.0,44.0,45.1,43.1,44.1,45|E:route:7:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|rcvonc',
      '90x90|3|49,49|centre@77,46:centre|gym@77,36:gym|lab@66,56:lab|casino@17,36:casino|house@10,46:house:1|house@47,16:house:2|house@70,66:house:3|house@30,26:house:4|house@28,36:house:5|house@30,76:house:6|house@58,6:house:7|house@29,6:house:8|house@8,6:house:9|house@50,36:house:10|exits:W:route:7:0,43.0,44.0,45.1,43.1,44.1,45|E:route:8:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|mn4n59',
      '90x90|3|49,49|centre@80,26:centre|gym@28,26:gym|lab@10,46:lab|casino@59,26:casino|house@39,76:house:1|house@78,56:house:2|house@69,6:house:3|house@19,26:house:4|house@6,76:house:5|house@80,16:house:6|house@79,66:house:7|house@8,56:house:8|house@68,36:house:9|house@67,16:house:10|exits:W:route:8:0,43.0,44.0,45.1,43.1,44.1,45|E:victory-road:1:88,43.88,44.88,45.89,43.89,44.89,45|grass:49|1120w7o',
    ]);
  });

  it('rejects a key that is not a settlement', () => {
    const plan = planRegion('alpha');
    expect(() => planCity(plan, 'route:1')).toThrow('not a settlement: route:1');
    expect(() => planCity(plan, 'league:1')).toThrow('not a settlement: league:1');
    expect(() => planCity(plan, 'nope:1')).toThrow('not a settlement: nope:1');
  });
});

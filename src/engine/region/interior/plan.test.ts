import { describe, expect, it } from 'vitest';
import { GYM_SIZE, INTERIOR_SIZE } from '../../../data/region';
import { FRLG_INTERIOR_TILESET } from '../../../data/tilesets/interior';
import { COUNTER, DOOR, FLOOR, isWalkable, tileAt } from '../../map';
import { hashSeed } from '../../rng';
import { reachableTiles } from '../../routes/validate';
import { resolveTileFrame } from '../../tileFrames';
import { planRegion, type RegionPlan } from '../plan';
import { interiorRoomKind, planInterior, type InteriorPlan } from './plan';

const KEYS: readonly string[] = ['centre', 'gym', 'lab', 'house:1', 'house:2', 'casino'];

const CITIES: readonly string[] = ['city:1', 'town:1'];

function room(key: string, city = 'city:1', seed = 'alpha'): InteriorPlan {
  return planInterior(planRegion(seed), key, city);
}

function everyKind(city: string, onRoom: (built: InteriorPlan) => void): void {
  for (const key of KEYS) onRoom(planInterior(planRegion('alpha'), key, city));
}

function cellsWhere(built: InteriorPlan, value: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < built.height; y++) {
    for (let x = 0; x < built.width; x++) if (built.tiles[y][x] === value) cells.push({ x, y });
  }
  return cells;
}

function cardinals(tile: { x: number; y: number }): { x: number; y: number }[] {
  return [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ];
}

function insideRect(
  rect: { x: number; y: number; width: number; height: number },
  tile: { x: number; y: number },
): boolean {
  return (
    tile.x >= rect.x && tile.x < rect.x + rect.width && tile.y >= rect.y && tile.y < rect.y + rect.height
  );
}

function digest(built: InteriorPlan): string {
  return (
    `${built.width}x${built.height}|${built.kind}|${built.entry.x},${built.entry.y}|${built.returnTo}|` +
    built.slots.map((slot) => `${slot.role}@${slot.tile.x},${slot.tile.y}`).join('|') +
    '|' +
    (built.rooms ?? [])
      .map((r) => `${r.name}:${r.rect.x},${r.rect.y}:${r.doorIn ? `${r.doorIn.x},${r.doorIn.y}` : '-'}`)
      .join('|') +
    '|' +
    hashSeed(built.tiles.map((row) => row.join('')).join('/')).toString(36)
  );
}

describe('interior plan rooms', () => {
  it('puts the return door on the entry tile, back to the city key', () => {
    for (const city of CITIES) {
      everyKind(city, (built) => {
        expect(built.returnTo, city).toBe(city);
        expect(built.cityKey, city).toBe(city);
        expect(built.entry.y, city).toBe(built.height - 1);
        expect(tileAt(built.tiles, built.entry), city).toBe(DOOR);
        if (built.kind !== 'gym') {
          expect(
            built.tiles.flat().filter((value) => value === DOOR),
            city,
          ).toHaveLength(1);
        }
      });
    }
  });

  it('places each kind its own furniture slots', () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      centre: ['heal', 'pc'],
      gym: ['trainer', 'leader'],
      lab: ['professor'],
      'house:1': ['npc'],
      'house:2': ['npc'],
      casino: ['cabinet'],
    };
    for (const [key, roles] of Object.entries(expected)) {
      const built = room(key);
      expect(
        built.slots.map((slot) => slot.role),
        key,
      ).toEqual(roles);
      for (const slot of built.slots) {
        expect(
          insideRect({ x: 0, y: 0, width: built.width, height: built.height }, slot.tile),
          key,
        ).toBe(true);
        const reachableFrom = cardinals(slot.tile).some((tile) => isWalkable(built.tiles, tile));
        expect(reachableFrom, `${key} ${slot.role}`).toBe(true);
      }
    }

    const centre = room('centre');
    const counters = cellsWhere(centre, COUNTER);
    expect(counters.length).toBeGreaterThanOrEqual(3);
    expect(new Set(counters.map((cell) => cell.y)).size).toBe(1);
    const heal = centre.slots.find((slot) => slot.role === 'heal')?.tile;
    expect(heal).toBeDefined();
    expect(heal?.y).toBe(counters[0].y);
    expect(heal?.x).toBeGreaterThan(Math.min(...counters.map((cell) => cell.x)));
    expect(heal?.x).toBeLessThan(Math.max(...counters.map((cell) => cell.x)));
    expect(tileAt(centre.tiles, heal ?? { x: -1, y: -1 })).not.toBe(FLOOR);
  });

  it("joins the gym's four rooms in order, one door between each pair", () => {
    const gym = room('gym');
    const rooms = gym.rooms ?? [];
    expect(rooms.map((r) => r.name)).toEqual(['entrance', 'trainer', 'puzzle', 'leader']);
    expect(rooms.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(rooms.filter((r) => r.doorIn !== undefined)).toHaveLength(3);
    expect(gym.tiles.flat().filter((value) => value === DOOR)).toHaveLength(4);

    for (let index = 1; index < rooms.length; index++) {
      const doorIn = rooms[index].doorIn;
      expect(doorIn, rooms[index].name).toBeDefined();
      if (doorIn === undefined) continue;
      expect(tileAt(gym.tiles, doorIn), rooms[index].name).toBe(DOOR);
      const neighbours = cardinals(doorIn);
      const ownFloor = neighbours.some(
        (tile) => insideRect(rooms[index].rect, tile) && tileAt(gym.tiles, tile) === FLOOR,
      );
      const previousFloor = neighbours.some(
        (tile) => insideRect(rooms[index - 1].rect, tile) && tileAt(gym.tiles, tile) === FLOOR,
      );
      expect(ownFloor, rooms[index].name).toBe(true);
      expect(previousFloor, rooms[index].name).toBe(true);
    }

    const trainer = gym.slots.find((slot) => slot.role === 'trainer')?.tile;
    const leader = gym.slots.find((slot) => slot.role === 'leader')?.tile;
    expect(trainer).toBeDefined();
    expect(leader).toBeDefined();
    expect(insideRect(rooms[1].rect, trainer ?? { x: -1, y: -1 })).toBe(true);
    expect(insideRect(rooms[3].rect, leader ?? { x: -1, y: -1 })).toBe(true);
  });

  it('sizes a room off INTERIOR_SIZE and a gym off GYM_SIZE', () => {
    for (const key of ['centre', 'lab', 'house:1', 'house:2', 'casino']) {
      const built = room(key);
      expect({ width: built.width, height: built.height }, key).toEqual(INTERIOR_SIZE);
      expect(built.rooms, key).toBeUndefined();
    }
    const gym = room('gym');
    expect({ width: gym.width, height: gym.height }).toEqual(GYM_SIZE);
    expect(gym.rooms).toHaveLength(4);
  });

  it('reaches every floor cell from the entry', () => {
    for (const city of CITIES) {
      everyKind(city, (built) => {
        const reached = reachableTiles(built.tiles, built.entry);
        const stranded: string[] = [];
        for (let y = 0; y < built.height; y++) {
          for (let x = 0; x < built.width; x++) {
            if (isWalkable(built.tiles, { x, y }) && !reached.has(`${x},${y}`))
              stranded.push(`${x},${y}`);
          }
        }
        expect(stranded, `${city} ${built.interiorKey}`).toEqual([]);
      });
    }
  });

  it('resolves every cell to a frame in the interior tileset', () => {
    for (const city of CITIES) {
      everyKind(city, (built) => {
        const unresolved: string[] = [];
        for (let y = 0; y < built.height; y++) {
          for (let x = 0; x < built.width; x++) {
            if (resolveTileFrame(built.tiles, x, y, FRLG_INTERIOR_TILESET) === null) {
              unresolved.push(`${x},${y}`);
            }
          }
        }
        expect(unresolved, `${city} ${built.interiorKey}`).toEqual([]);
      });
    }
  });

  it("pins a fixed seed's interior digests", () => {
    const plan = planRegion('alpha');
    expect(KEYS.map((key) => digest(planInterior(plan, key, 'city:3')))).toEqual([
      '24x18|centre|8,17|city:3|heal@12,4|pc@18,4||1bod26e',
      '40x40|gym|12,39|city:3|trainer@29,10|leader@10,29|entrance:0,0:-|trainer:19,0:19,10|puzzle:19,19:29,19|leader:0,19:19,29|12f4x1e',
      '24x18|lab|10,17|city:3|professor@12,4||196jblm',
      '24x18|house|20,17|city:3|npc@12,4||1toe53',
      '24x18|house|2,17|city:3|npc@12,4||1csnidy',
      '24x18|casino|15,17|city:3|cabinet@12,4||1bbdro5',
    ]);
  });

  it('rejects an interior key that names no room', () => {
    expect(interiorRoomKind('gym:1')).toBeNull();
    expect(interiorRoomKind('house:0')).toBeNull();
    expect(interiorRoomKind('House')).toBeNull();
    expect(interiorRoomKind('')).toBeNull();
    for (const key of ['centre', 'gym', 'lab', 'casino', 'house', 'house:1', 'house:42']) {
      expect(interiorRoomKind(key), key).not.toBeNull();
    }
    expect(() => planInterior(planRegion('alpha'), 'shop', 'city:1')).toThrow(
      'not an interior key: shop',
    );
  });
});

describe('interior plan streams', () => {
  it('draws only off its own city sub-key stream, and replays', () => {
    const plan = planRegion('alpha');
    const bare: RegionPlan = { ...plan, nodes: [], chain: [], gymKeys: [] };
    for (const key of KEYS) {
      const first = planInterior(plan, key, 'city:3');
      expect(digest(first), key).toBe(digest(planInterior(plan, key, 'city:3')));
      expect(digest(planInterior(bare, key, 'city:3')), key).toBe(digest(first));
    }
    const entries = KEYS.map((key) => planInterior(plan, key, 'city:3').entry.x);
    expect(new Set(entries).size).toBeGreaterThan(1);
    const elsewhere = KEYS.map((key) => planInterior(plan, key, 'city:4').entry.x);
    expect(elsewhere).not.toEqual(entries);
  });
});

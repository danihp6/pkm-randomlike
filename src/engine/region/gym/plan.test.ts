import { describe, expect, it } from 'vitest';
import { planNodeContent } from '../content';
import { planInterior } from '../interior';
import { nodeOf, planRegion } from '../plan';
import { gymSolved, gymSolvedKey, planGym, type GymPlan } from './plan';
import { gymPuzzlesFor, puzzleStackIds } from './stack';

const PLAN = planRegion('task-282');

const GYM_KEYS: readonly string[] = Array.from({ length: 8 }, (_, index) => `city:${index + 1}`);

function cellsWhere(gym: GymPlan, cell: string): { x: number; y: number }[] {
  const ice = gym.puzzle.ice;
  if (ice === null) return [];
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < ice.cells.length; y++) {
    for (let x = 0; x < ice.cells[y].length; x++) {
      if (ice.cells[y][x] === cell) cells.push({ x: ice.rect.x + x, y: ice.rect.y + y });
    }
  }
  return cells;
}

function digest(gym: GymPlan): string {
  const ice = gym.puzzle.ice;
  const holes = ice === null ? '' : Object.keys(ice.landings).sort().join('.');
  const rects = (gym.interior.rooms ?? []).map((room) => `${room.name}:${room.rect.x},${room.rect.y}`);
  return (
    `${gym.cityKey}|${gym.puzzle.entry.id}|${rects.join('|')}|` +
    (ice === null ? 'no-floor' : `${ice.rect.width}x${ice.rect.height}|holes:${holes}`) +
    `|${gym.solvedKey}`
  );
}

describe('the gym plan', () => {
  it('takes the gym four rooms from the interior generator', () => {
    const gym = planGym(PLAN, 'city:1');
    expect(gym.cityKey).toBe('city:1');
    expect((gym.interior.rooms ?? []).map((room) => room.name)).toEqual([
      'entrance',
      'trainer',
      'puzzle',
      'leader',
    ]);
    expect(gym.interior.kind).toBe('gym');
    expect(gym.interior).toEqual(planInterior(PLAN, 'gym', 'city:1'));
  });

  it("rolls a puzzle off the node badge's stack", () => {
    for (const key of GYM_KEYS) {
      const badge = nodeOf(PLAN, key)?.badge ?? 0;
      const gym = planGym(PLAN, key);
      expect(puzzleStackIds(), key).toContain(gym.puzzle.entry.id);
      expect(gymPuzzlesFor(badge), key).toContain(gym.puzzle.entry);
      expect(gym.puzzle.entry.id, key).toBe('ice');
    }
    expect(planGym(PLAN, 'city:1').puzzle.entry.id).toBe(puzzleStackIds()[0]);
  });

  it('lays the ice floor on the puzzle room its stack row names', () => {
    const gym = planGym(PLAN, 'city:1');
    const rooms = gym.interior.rooms ?? [];
    const ice = gym.puzzle.ice;
    expect(ice).not.toBeNull();
    if (ice === null) return;

    expect(ice.room).toBe('puzzle');
    expect(ice.rect).toEqual(rooms[2].rect);
    expect(cellsWhere(gym, 'hole')).toHaveLength(gym.puzzle.entry.holes);

    const landingRoom = rooms[gym.puzzle.entry.dropsInto];
    const centre = {
      x: landingRoom.rect.x + Math.floor(landingRoom.rect.width / 2),
      y: landingRoom.rect.y + Math.floor(landingRoom.rect.height / 2),
    };
    for (const [key, landing] of Object.entries(ice.landings)) {
      expect(landing, key).toEqual({ room: gym.puzzle.entry.dropsInto, tile: centre });
    }
  });

  it('refuses a key that is not a gym city', () => {
    expect(() => planGym(PLAN, 'town:1')).toThrow(/^not a gym: /);
    expect(() => planGym(PLAN, 'route:1')).toThrow(/^not a gym: /);
    expect(() => planGym(PLAN, 'city:99')).toThrow(/^not a gym: /);
    expect(() => planGym(PLAN, 'town:1')).toThrow('not a gym: town:1');
  });

  it('replays: two calls are deep-equal, room and holes included', () => {
    for (const key of GYM_KEYS) {
      const first = planGym(PLAN, key);
      expect(planGym(PLAN, key), key).toEqual(first);
      expect(digest(planGym(PLAN, key)), key).toBe(digest(first));
    }
    expect(new Set(GYM_KEYS.map((key) => digest(planGym(PLAN, key)))).size).toBe(GYM_KEYS.length);
  });

  it("pins a fixed seed's gym digest", () => {
    expect(digest(planGym(PLAN, 'city:3'))).toBe(
      'city:3|ice|entrance:0,0|trainer:19,0|puzzle:19,19|leader:0,19|21x21|' +
        'holes:20,32.26,21.26,35|gym-solved:city:3',
    );
  });
});

describe('the gym plan streams', () => {
  it("does not consume a draw off the city's content stream", () => {
    for (const tier of [1, 2, 3] as const) {
      const before = planNodeContent(PLAN, 'city:1', tier);
      planGym(PLAN, 'city:1');
      expect(planNodeContent(PLAN, 'city:1', tier), `tier ${tier}`).toEqual(before);
    }
  });

  it("keeps the interior the interior generator's own object, not a re-roll", () => {
    const gym = planGym(PLAN, 'city:1');
    expect(planInterior(PLAN, 'gym', 'city:1')).toEqual(gym.interior);
    expect(planGym(PLAN, 'city:1').interior).toEqual(gym.interior);
  });
});

describe('the solved flag', () => {
  it('names the mark after the city key', () => {
    expect(gymSolvedKey('city:1')).toBe('gym-solved:city:1');
    expect(planGym(PLAN, 'city:2').solvedKey).toBe('gym-solved:city:2');
  });

  it('reads the run and never re-rolls the room', () => {
    const gym = planGym(PLAN, 'city:1');
    expect(gymSolved({ pickedItems: [] }, gym)).toBe(false);
    expect(gymSolved({ pickedItems: ['gym-solved:city:1'] }, gym)).toBe(true);
    expect(gymSolved({ pickedItems: ['gym-solved:city:2'] }, gym)).toBe(false);

    const solved = planGym(PLAN, 'city:1');
    expect(solved).toEqual(gym);
    expect(gymSolved({ pickedItems: [solved.solvedKey] }, solved)).toBe(true);
    expect(gymSolved({ pickedItems: [solved.solvedKey] }, planGym(PLAN, 'city:1'))).toBe(true);
  });
});

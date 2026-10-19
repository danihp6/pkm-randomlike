import { describe, expect, it } from 'vitest';
import {
  BOSS_BATTLEFIELD_CHANCE,
  ROOM_BATTLEFIELDS,
  ROOM_BATTLEFIELD_CHANCE,
} from '../../data/battlefields';
import { FIELD_CONDITION_TURNS } from '../battle/effects/conditions';
import { TERRAIN_TURNS } from '../battle/effects/terrain';
import { WEATHER_TURNS } from '../battle/effects/weather';
import { createFighter } from '../battle/fighter';
import { createBattle, emptyFieldConditions, type BattleSetup } from '../battle/state';
import { planMap } from '../maps/plan';
import { roomView } from '../maps/progress';
import { Rng } from '../rng';
import {
  battlefieldSeeds,
  roomBattlefield,
  roomKindOf,
  type BattlefieldSeeds,
  type RoomKind,
} from './battlefield';

const SEEDS: readonly string[] = ['dev-seed', 'battlefield-a', 'battlefield-b'];
const PLAN_SEED = 'battlefield-test';
const KINDS: readonly RoomKind[] = ['trainer', 'boss', 'quiet'];

const INDICES = Array.from({ length: 200 }, (_, i) => i + 1);

function roll(seed: string, kind: RoomKind, indices: readonly number[] = INDICES) {
  return indices.map((index) => roomBattlefield(seed, index, kind));
}

function make(id: string, speciesId: string) {
  return createFighter({ id, speciesId, level: 20 });
}

function battle(overrides: Partial<BattleSetup> = {}) {
  return createBattle({
    player: [make('player', 'charmander')],
    enemy: [make('enemy', 'sentret')],
    rng: new Rng(3),
    isWild: true,
    ...overrides,
  });
}

describe('roomBattlefield', () => {
  it('is pure: the same seed, index and kind roll the same condition', () => {
    for (const seed of SEEDS) {
      for (const kind of KINDS) {
        expect(roll(seed, kind)).toEqual(roll(seed, kind));
      }
    }
  });

  it('always returns a row of the table, or null', () => {
    for (const seed of SEEDS) {
      for (const result of [...roll(seed, 'trainer'), ...roll(seed, 'boss')]) {
        if (result === null) continue;
        expect(ROOM_BATTLEFIELDS).toContainEqual(result);
      }
    }
  });

  it('rolls nothing in a quiet room', () => {
    const indices = Array.from({ length: 1000 }, (_, i) => i);
    for (const seed of SEEDS) {
      for (const result of roll(seed, 'quiet', indices)) {
        expect(result).toBeNull();
      }
    }
  });

  it('reads the two chances off the data over a thousand rooms', () => {
    const indices = Array.from({ length: 1000 }, (_, i) => i);
    const hits = (kind: RoomKind) => roll(SEEDS[0], kind, indices).filter((r) => r !== null).length;
    expect(hits('trainer')).toBeGreaterThanOrEqual(120);
    expect(hits('trainer')).toBeLessThanOrEqual(180);
    expect(hits('boss')).toBeGreaterThanOrEqual(260);
    expect(hits('boss')).toBeLessThanOrEqual(340);
    expect(ROOM_BATTLEFIELD_CHANCE).toBe(0.15);
    expect(BOSS_BATTLEFIELD_CHANCE).toBe(0.3);
  });

  it('keys the stream by the seed', () => {
    expect(roll(SEEDS[0], 'trainer')).not.toEqual(roll(SEEDS[1], 'trainer'));
  });
});

describe('roomKindOf', () => {
  it('gives the boss room its own roll', () => {
    expect(roomKindOf({ entry: false, boss: true, special: null })).toBe('boss');
  });

  it('leaves the entry room and every special leaf quiet', () => {
    expect(roomKindOf({ entry: true, boss: false, special: null })).toBe('quiet');
    for (const special of ['shop', 'mini-boss', 'mega-stone']) {
      expect(roomKindOf({ entry: false, boss: false, special })).toBe('quiet');
    }
  });

  it('rolls for every other regular room', () => {
    expect(roomKindOf({ entry: false, boss: false, special: null })).toBe('trainer');
  });

  it('reads a plan room exactly as the scene does', () => {
    const plan = planMap(PLAN_SEED, 1);
    const kindOf = (roomId: number) => roomKindOf(roomView(plan, roomId, false));
    expect(kindOf(plan.entryRoom)).toBe('quiet');
    expect(kindOf(plan.bossRoom)).toBe('boss');
    expect(plan.rooms.map((room) => kindOf(room.id))).toContain('trainer');
    for (const room of plan.rooms) {
      const expected: RoomKind =
        room.id === plan.bossRoom
          ? 'boss'
          : room.id === plan.entryRoom || room.special
            ? 'quiet'
            : 'trainer';
      expect(kindOf(room.id)).toBe(expected);
    }
  });
});

describe('battlefieldSeeds', () => {
  it('seeds each row at its own rule’s canonical duration', () => {
    expect(ROOM_BATTLEFIELDS).toHaveLength(11);
    for (const row of ROOM_BATTLEFIELDS) {
      const seeds = battlefieldSeeds(row);
      switch (row.kind) {
        case 'weather':
          expect(seeds).toEqual({ weather: { id: row.id, turns: WEATHER_TURNS } });
          break;
        case 'terrain':
          expect(seeds).toEqual({ terrain: { id: row.id, turns: TERRAIN_TURNS } });
          break;
        case 'field': {
          const expected: BattlefieldSeeds =
            row.id === 'fog'
              ? { fog: true }
              : row.id === 'gravity'
                ? { field: { gravity: FIELD_CONDITION_TURNS.gravity } }
                : { field: { trickroom: FIELD_CONDITION_TURNS.trickroom } };
          expect(seeds).toEqual(expected);
          break;
        }
      }
    }
  });

  it('names the two field conditions with the table’s own turns', () => {
    expect(battlefieldSeeds(ROOM_BATTLEFIELDS[9])).toEqual({
      field: { gravity: FIELD_CONDITION_TURNS.gravity },
    });
    expect(battlefieldSeeds(ROOM_BATTLEFIELDS[10])).toEqual({
      field: { trickroom: FIELD_CONDITION_TURNS.trickroom },
    });
  });

  it('carries no key of another kind', () => {
    for (const row of ROOM_BATTLEFIELDS) {
      const keys = Object.keys(battlefieldSeeds(row)).sort();
      expect(keys).toEqual([row.kind === 'field' ? (row.id === 'fog' ? 'fog' : 'field') : row.kind]);
    }
  });
});

describe('createBattle seeding', () => {
  it('starts under the weather the setup names', () => {
    const state = battle({ weather: { id: 'rain', turns: WEATHER_TURNS } });
    expect(state.weather).toBe('rain');
    expect(state.weatherTurns).toBe(WEATHER_TURNS);
    expect(state.terrain).toBeNull();
    expect(state.fog).toBe(false);
  });

  it('starts under the terrain the setup names', () => {
    const state = battle({ terrain: { id: 'grassy', turns: TERRAIN_TURNS } });
    expect(state.terrain).toBe('grassy');
    expect(state.terrainTurns).toBe(TERRAIN_TURNS);
    expect(state.weather).toBeNull();
    expect(state.fog).toBe(false);
  });

  it('starts under the field conditions the setup names and zeros the rest', () => {
    const state = battle({ field: { gravity: 5, trickroom: 5 } });
    expect(state.field.gravity).toBe(5);
    expect(state.field.trickroom).toBe(5);
    for (const [id, turns] of Object.entries(state.field)) {
      if (id === 'gravity' || id === 'trickroom') continue;
      expect(turns).toBe(0);
    }
  });

  it('starts under dense fog when the setup says so', () => {
    const state = battle({ fog: true });
    expect(state.fog).toBe(true);
    expect(state.weather).toBeNull();
  });

  it('reads exactly today’s defaults when the setup names no condition', () => {
    const state = battle();
    expect(state.weather).toBeNull();
    expect(state.weatherTurns).toBe(0);
    expect(state.terrain).toBeNull();
    expect(state.terrainTurns).toBe(0);
    expect(state.field).toEqual(emptyFieldConditions());
    expect(state.fog).toBe(false);
  });

  it('fills the state from a rolled row', () => {
    const state = battle(battlefieldSeeds(ROOM_BATTLEFIELDS[0]));
    expect(state.weather).toBe('sun');
    expect(state.weatherTurns).toBe(WEATHER_TURNS);
  });
});

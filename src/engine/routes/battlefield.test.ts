import { describe, expect, it } from 'vitest';
import {
  ALL_TYPES_OVERRIDE,
  ROOM_BATTLEFIELDS,
  ROOM_BATTLEFIELD_CHANCE,
  ROOM_CRIT_STAGE,
  type RoomConditionId,
} from '../../data/battlefields';
import { BOSS_OPENINGS } from '../../data/bosses';
import { FIELD_CONDITION_TURNS } from '../battle/effects/conditions';
import { TERRAIN_TURNS } from '../battle/effects/terrain';
import { WEATHER_TURNS } from '../battle/effects/weather';
import { createFighter } from '../battle/fighter';
import { createBattle, emptyFieldConditions, emptyRoomField, type BattleSetup } from '../battle/state';
import { planMap } from '../maps/plan';
import { roomView } from '../maps/progress';
import { Rng, hashSeed } from '../rng';
import { routeIndexForRoom } from '../run/floors';
import {
  battlefieldSeeds,
  bossOpeningRoll,
  roomBattlefield,
  roomKindOf,
  type BattlefieldSeeds,
  type BossOpeningRoll,
  type RoomKind,
} from './battlefield';

const SEEDS: readonly string[] = ['dev-seed', 'battlefield-a', 'battlefield-b'];
const PLAN_SEED = 'battlefield-test';
const KINDS: readonly RoomKind[] = ['trainer', 'boss', 'quiet'];

const INDICES = Array.from({ length: 200 }, (_, i) => i + 1);

/** The table rows the two boss openings name; a boss room must always return one of them. */
const BOSS_ROWS = BOSS_OPENINGS.map((row) =>
  ROOM_BATTLEFIELDS.find((entry) => entry.id === row.battlefield)!,
);

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

  it('draws exactly one chance roll and one row roll for a trainer room', () => {
    const replay = (seed: string, index: number) => {
      const rng = new Rng(hashSeed(`${seed}:battlefield:${index}`));
      if (rng.next() >= ROOM_BATTLEFIELD_CHANCE) return null;
      return ROOM_BATTLEFIELDS[rng.int(0, ROOM_BATTLEFIELDS.length - 1)];
    };
    for (const seed of SEEDS) {
      for (let index = 1; index <= 200; index++) {
        expect(roomBattlefield(seed, index, 'trainer'), `${seed} ${index}`).toEqual(replay(seed, index));
      }
    }
  });

  it('draws exactly one int and no chance roll for the boss room', () => {
    for (const seed of SEEDS) {
      for (let index = 1; index <= 200; index++) {
        const rng = new Rng(hashSeed(`${seed}:battlefield:${index}`));
        const drawn = BOSS_OPENINGS[rng.int(0, BOSS_OPENINGS.length - 1)];
        const expected = ROOM_BATTLEFIELDS.find((row) => row.id === drawn.battlefield);
        expect(roomBattlefield(seed, index, 'boss'), `${seed} ${index}`).toEqual(expected);
      }
    }
  });

  it('never leaves the boss room quiet, over 200 indices and three seeds', () => {
    for (const seed of SEEDS) {
      for (const index of INDICES) {
        const result = roomBattlefield(seed, index, 'boss');
        expect(result, `${seed} ${index}`).not.toBeNull();
        expect(BOSS_ROWS, `${seed} ${index}`).toContain(result);
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

  it('reads the regular chance off the data over a thousand rooms', () => {
    const indices = Array.from({ length: 1000 }, (_, i) => i);
    const hits = (kind: RoomKind) =>
      roll(SEEDS[0], kind, indices).filter((result) => result !== null).length;
    expect(hits('trainer')).toBeGreaterThanOrEqual(120);
    expect(hits('trainer')).toBeLessThanOrEqual(180);
    expect(hits('boss')).toBe(1000);
    expect(ROOM_BATTLEFIELD_CHANCE).toBe(0.15);
  });

  it('keys the stream by the seed', () => {
    expect(roll(SEEDS[0], 'trainer')).not.toEqual(roll(SEEDS[1], 'trainer'));
    expect(roll(SEEDS[0], 'boss')).not.toEqual(roll(SEEDS[1], 'boss'));
  });
});

/**
 * The regular rooms' conditions as `main` produced them, captured before the boss
 * room stopped rolling a chance: a stray edit to `ROOM_BATTLEFIELD_CHANCE` or to the
 * table's order moves one of these and fails the pin. The rows themselves are pinned
 * byte-for-byte by `src/data/battlefields.test.ts`.
 */
const TRAINER_PINS: Readonly<Record<string, readonly (string | null)[]>> = {
  'dev-seed': [
    null,
    null,
    null,
    'alltypes',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'psychic',
    'sun',
    null,
    null,
    null,
    'snow',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'crit',
    null,
    null,
    null,
    null,
  ],
  'battlefield-test': [
    null,
    null,
    null,
    null,
    null,
    'electric',
    null,
    null,
    null,
    null,
    null,
    'fairyaura',
    null,
    null,
    null,
    null,
    'trickroom',
    'electric',
    null,
    'fairyaura',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
};

describe('the regular rooms’ conditions', () => {
  it('replays exactly the rows main produced, indices 1 to 32', () => {
    for (const [seed, expected] of Object.entries(TRAINER_PINS)) {
      expect(expected).toHaveLength(32);
      const actual = expected.map((_, i) => roomBattlefield(seed, i + 1, 'trainer')?.id ?? null);
      expect(actual, seed).toEqual(expected);
    }
  });
});

/** Which opening each seed's boss room draws, floor by floor (`bossOpeningRoll`). */
type BossPin = Readonly<{
  side: BossOpeningRoll['side'];
  battlefield: RoomConditionId;
  boosts: BossOpeningRoll['boosts'];
}>;

const BOSS_PINS: Readonly<Record<string, readonly BossPin[]>> = {
  'dev-seed': [
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
  ],
  'pkm-64': [
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
    { side: 'run', battlefield: 'endure', boosts: { spe: -1 } },
    { side: 'boss', battlefield: 'crit', boosts: { def: 1 } },
  ],
};

describe('bossOpeningRoll', () => {
  it('resolves the opening to its arena row and copies its side and stages', () => {
    for (const seed of SEEDS) {
      for (const index of INDICES) {
        const opening = bossOpeningRoll(seed, index);
        const row = BOSS_OPENINGS.find((entry) => entry.side === opening.side)!;
        expect(opening.battlefield.id).toBe(row.battlefield);
        expect(opening.boosts).toEqual(row.boosts);
        expect(BOSS_ROWS).toContainEqual(opening.battlefield);
      }
    }
  });

  it('pins the boss opening of maps 1 to 8 for two fixed seeds', () => {
    for (const [seed, expected] of Object.entries(BOSS_PINS)) {
      const actual = expected.map((_, floor) => {
        const plan = planMap(seed, floor + 1);
        const opening = bossOpeningRoll(seed, routeIndexForRoom(plan, plan.bossRoom));
        return { side: opening.side, battlefield: opening.battlefield.id, boosts: opening.boosts };
      });
      expect(actual, seed).toEqual(expected);
    }
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

const SHIPPED_SEEDS: Readonly<Record<string, BattlefieldSeeds>> = {
  sun: { weather: { id: 'sun', turns: WEATHER_TURNS } },
  rain: { weather: { id: 'rain', turns: WEATHER_TURNS } },
  sand: { weather: { id: 'sand', turns: WEATHER_TURNS } },
  snow: { weather: { id: 'snow', turns: WEATHER_TURNS } },
  electric: { terrain: { id: 'electric', turns: TERRAIN_TURNS } },
  grassy: { terrain: { id: 'grassy', turns: TERRAIN_TURNS } },
  misty: { terrain: { id: 'misty', turns: TERRAIN_TURNS } },
  psychic: { terrain: { id: 'psychic', turns: TERRAIN_TURNS } },
  fog: { fog: true },
  gravity: { field: { gravity: FIELD_CONDITION_TURNS.gravity } },
  trickroom: { field: { trickroom: FIELD_CONDITION_TURNS.trickroom } },
};

const ROOM_FIELD_SEEDS: Readonly<Record<string, BattlefieldSeeds>> = {
  radiant: { roomField: { abilitiesOff: true } },
  darkaura: { roomField: { darkAura: true } },
  fairyaura: { roomField: { fairyAura: true } },
  alltypes: { roomField: { overrideType: ALL_TYPES_OVERRIDE } },
  endure: { roomField: { endure: true } },
  crit: { roomField: { critStage: ROOM_CRIT_STAGE } },
};

const ROOM_FIELD_IDS = new Set(Object.keys(ROOM_FIELD_SEEDS));

describe('battlefieldSeeds', () => {
  it('covers the seventeen rows of the table', () => {
    expect(ROOM_BATTLEFIELDS).toHaveLength(17);
    expect(Object.keys(SHIPPED_SEEDS)).toHaveLength(11);
    expect(Object.keys(ROOM_FIELD_SEEDS)).toHaveLength(6);
    expect(new Set([...Object.keys(SHIPPED_SEEDS), ...ROOM_FIELD_IDS]).size).toBe(17);
  });

  it('leaves the eleven shipped rows on their exact seeds', () => {
    for (const [id, expected] of Object.entries(SHIPPED_SEEDS)) {
      const row = ROOM_BATTLEFIELDS.find((entry) => entry.id === id)!;
      expect(battlefieldSeeds(row), id).toEqual(expected);
    }
  });

  it('seeds each of the six new rows with its exact roomField object', () => {
    for (const [id, expected] of Object.entries(ROOM_FIELD_SEEDS)) {
      const row = ROOM_BATTLEFIELDS.find((entry) => entry.id === id)!;
      expect(row.kind, id).toBe('field');
      expect(battlefieldSeeds(row), id).toEqual(expected);
      expect(Object.keys(battlefieldSeeds(row)), id).toEqual(['roomField']);
    }
  });

  it('carries no key of another kind', () => {
    for (const row of ROOM_BATTLEFIELDS) {
      const keys = Object.keys(battlefieldSeeds(row)).sort();
      const expected = ROOM_FIELD_IDS.has(row.id)
        ? ['roomField']
        : [
            row.kind === 'weather'
              ? 'weather'
              : row.kind === 'terrain'
                ? 'terrain'
                : row.id === 'fog'
                  ? 'fog'
                  : 'field',
          ];
      expect(keys, row.id).toEqual(expected);
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
    expect(state.roomField).toEqual(emptyRoomField());
  });

  it('fills the state from a rolled row', () => {
    const state = battle(battlefieldSeeds(ROOM_BATTLEFIELDS[0]));
    expect(state.weather).toBe('sun');
    expect(state.weatherTurns).toBe(WEATHER_TURNS);
  });

  it('fills the room field from a rolled row and merges it over the defaults', () => {
    const row = ROOM_BATTLEFIELDS.find((entry) => entry.id === 'radiant')!;
    const state = battle(battlefieldSeeds(row));
    expect(state.roomField).toEqual({ ...emptyRoomField(), abilitiesOff: true });
  });
});

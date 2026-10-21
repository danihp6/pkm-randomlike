import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import { bannedTrainerId, planMap, roomView } from '../../engine/maps';
import { createRun, createRunPokemon, markTrainerDefeated, type RunState } from '../../engine/run';
import { DEFAULT_TRAINER_SIGHT } from '../../engine/routes';
import { t } from '../../i18n';
import { buildMapView } from '../../ui/mapView';
import { NOTICE_HOLD_MS } from '../../ui/notice';
import { descriptor as banned } from './banned';
import type { RoomHost } from './types';

const SEED = 'pkm-101';
const MAP_INDEX = 5;
const ROOM_ID = 3;
const FARTHEST: Tile = { x: 7, y: 7 };
const ENTRY: Tile = { x: 7, y: 3 };

type RecordedCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** A graphics stand-in: it books every paint call the marker makes, in order. */
function recordingGraphics(): { graphics: Phaser.GameObjects.Graphics; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const graphics = new Proxy(
    {},
    {
      get:
        (_target, property) =>
        (...args: unknown[]): void => {
          if (typeof property === 'string') calls.push({ name: property, args });
        },
    },
  );
  return { graphics: graphics as unknown as Phaser.GameObjects.Graphics, calls };
}

/** The run every fixture below reads: one member on map 5, nothing beaten yet. */
function baseRun(seed = SEED): RunState {
  const starter = createRunPokemon({
    id: 'member-0',
    speciesId: 'caterpie',
    level: 10,
    moves: ['tackle'],
  });
  return { ...createRun({ seed, starter }), mapIndex: MAP_INDEX };
}

type HostOptions = Readonly<{
  farthest?: Tile | null;
  run?: RunState;
}>;

/** A recording `RoomHost`: it answers the two tiles the fixture asks for. */
function harness(options: HostOptions = {}): RoomHost {
  const run = options.run ?? baseRun();
  return {
    scene: {} as Phaser.Scene,
    get run(): RunState {
      return run;
    },
    view: roomView(planMap(SEED, MAP_INDEX), ROOM_ID, false),
    route: () => {
      throw new Error('the banned fixture reads no route');
    },
    rebuildRoom: () => undefined,
    entryTile: () => ENTRY,
    counterTile: () => null,
    farthestRoomTile: () => ('farthest' in options ? (options.farthest ?? null) : FARTHEST),
    facingFromTo: () => 'S',
    generatorStepActive: () => false,
    commitRun: () => undefined,
    releaseHudKeyboard: () => undefined,
    openPanel: () => undefined,
    closePanel: () => undefined,
    panelOpen: () => false,
    startTrainerBattle: () => undefined,
    showNotice: () => undefined,
  };
}

describe('the banned-species room descriptor', () => {
  it('claims the kind and its own marker', () => {
    expect(banned.kind).toBe('banned');
    expect(banned.marker).toBe('banned');
    expect(banned.interact).toBeUndefined();
    expect(banned.drawFixture).toBeUndefined();
  });

  it('places its trainer on the farthest tile and floats the barred species', () => {
    expect(banned.fixture?.(harness())).toEqual({
      notice: {
        text: t('notice.bannedRoom', { name: 'Caterpie' }),
        holdMs: NOTICE_HOLD_MS,
      },
      trainers: [
        {
          id: bannedTrainerId(MAP_INDEX),
          position: FARTHEST,
          facing: 'S',
          sight: DEFAULT_TRAINER_SIGHT,
          archetypeId: 'blackbelt',
        },
      ],
    });
  });

  it('carries the active locale’s own line', () => {
    expect(banned.fixture?.(harness())?.notice?.text).toBe(
      t('notice.bannedRoom', { name: 'Caterpie' }),
    );
  });

  it('keeps the notice alone once the room’s trainer is beaten', () => {
    const beaten = markTrainerDefeated(baseRun(), bannedTrainerId(MAP_INDEX));
    expect(banned.fixture?.(harness({ run: beaten }))).toEqual({
      notice: { text: t('notice.bannedRoom', { name: 'Caterpie' }), holdMs: NOTICE_HOLD_MS },
    });
  });

  it('keeps the notice alone when the room offers no free tile', () => {
    expect(banned.fixture?.(harness({ farthest: null }))).toEqual({
      notice: { text: t('notice.bannedRoom', { name: 'Caterpie' }), holdMs: NOTICE_HOLD_MS },
    });
  });

  it('is beaten by its own stable per-floor id', () => {
    const beaten = markTrainerDefeated(baseRun(), bannedTrainerId(MAP_INDEX));
    expect(banned.fixture?.(harness({ run: beaten }))?.trainers).toBeUndefined();
    const otherFloor = markTrainerDefeated(baseRun(), bannedTrainerId(MAP_INDEX + 1));
    expect(banned.fixture?.(harness({ run: otherFloor }))?.trainers).toHaveLength(1);
  });
});

describe('the banned-species room marker', () => {
  it('paints the red disc and the two dark bars in the frozen order', () => {
    const { graphics, calls } = recordingGraphics();
    banned.drawMarker?.(graphics, 10, 20, 5);
    expect(calls.map((call) => call.name)).toEqual([
      'fillStyle',
      'fillCircle',
      'fillStyle',
      'fillRect',
      'fillRect',
    ]);
    expect(calls[0].args).toEqual([0xef4444, 1]);
    expect(calls[1].args).toEqual([10, 20, 5 * 0.8]);
    expect(calls[2].args).toEqual([0x10161f, 1]);
    expect(calls[3].args).toEqual([10 - 5 * 0.75, 20 - 5 * 0.18, 5 * 1.5, 5 * 0.36]);
    expect(calls[4].args).toEqual([10 - 5 * 0.18, 20 - 5 * 0.75, 5 * 0.36, 5 * 1.5]);
  });

  it('surfaces its minimap marker only on its own room', () => {
    const plan = planMap('banned-markers', 3);
    const bannedRoom = plan.rooms[plan.rooms.length - 1].id;
    const view = buildMapView(plan, {
      discovered: plan.rooms.map((room) => room.id),
      currentRoom: plan.entryRoom,
      markers: { [bannedRoom]: 'banned' },
    });
    expect(view.rooms.find((room) => room.id === bannedRoom)!.marker).toBe('banned');
    for (const room of view.rooms) {
      if (room.id !== bannedRoom) expect(room.marker).toBeNull();
    }
  });
});

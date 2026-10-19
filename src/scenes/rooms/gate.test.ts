import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import { planMap, roomView } from '../../engine/maps';
import { createRun, createRunPokemon, type RunState } from '../../engine/run';
import { sketchRoute, type RouteMap } from '../../engine/routes';
import type { GateKind } from '../../data/gates';
import { gateLockedNotice, gateOpenedNotice, type Notice } from '../../ui/notice';
import { descriptor } from './gate';
import type { RoomHost } from './types';

const SEED = 'pkm-111';
const MAP_INDEX = 5;
const ROOM_ID = 0;

/** The floor's opening mark and the reward's id, as the run books them. */
const OPEN_ID = `gate-${MAP_INDEX}-${ROOM_ID}`;
const REWARD_ID = `gate-loot-${MAP_INDEX}-${ROOM_ID}`;

/** The seal the vault is closed with and the tile the reward sits on. */
const SEAL: Tile = { x: 6, y: 6 };
const POCKET: Tile = { x: 6, y: 8 };

/** A real build, so the descriptor reads a `RouteMap` and not a hand-made shape. */
const ROUTE: RouteMap = sketchRoute({ seed: SEED, routeIndex: MAP_INDEX, biomeId: 'forest' });

/** The plan room the stub hands over; only its map index and id are inputs. */
const VIEW = roomView(planMap(SEED, MAP_INDEX), ROOM_ID, false);

/** A run whose party is exactly the species the case needs. */
function runWith(party: readonly string[], pickedItems: readonly string[] = []): RunState {
  const members = party.map((speciesId, index) =>
    createRunPokemon({ id: `member-${index}`, speciesId, level: 5, moves: ['scratch'] }),
  );
  const base = createRun({ seed: SEED, starter: members[0] });
  return { ...base, mapIndex: MAP_INDEX, party: members, pickedItems };
}

type HarnessOptions = Readonly<{
  party?: readonly string[];
  pickedItems?: readonly string[];
  kind?: GateKind;
  /** `false` builds the room's route without a vault at all. */
  gate?: boolean;
}>;

/** A recording host: the gate descriptor reads the route and books what it asks for. */
function harness(options: HarnessOptions = {}) {
  const notices: Notice[] = [];
  const calls: string[] = [];
  let current = runWith(options.party ?? ['caterpie'], options.pickedItems ?? []);
  let committed: RunState | null = null;
  const route: RouteMap =
    options.gate === false
      ? ROUTE
      : { ...ROUTE, gate: { kind: options.kind ?? 'bush', tile: SEAL, pocket: POCKET } };
  const host: RoomHost = {
    scene: {} as Phaser.Scene,
    get run(): RunState {
      return current;
    },
    view: VIEW,
    route: () => route,
    rebuildRoom: () => calls.push('rebuildRoom'),
    entryTile: () => ({ x: 1, y: 1 }),
    counterTile: () => null,
    farthestRoomTile: () => null,
    facingFromTo: () => 'S',
    generatorStepActive: () => false,
    commitRun: (next) => {
      calls.push('commitRun');
      committed = next;
      current = next;
    },
    releaseHudKeyboard: () => undefined,
    openPanel: () => undefined,
    closePanel: () => undefined,
    panelOpen: () => false,
    startTrainerBattle: () => undefined,
    showNotice: (notice) => notices.push(notice),
  };
  return { host, notices, calls, committed: (): RunState | null => committed };
}

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

describe('the gated room fixture', () => {
  it('places one reward on the vault tile, off the room’s own stable id', () => {
    const fixture = descriptor.fixture?.(harness().host);
    expect(fixture).toEqual({
      items: [
        {
          id: REWARD_ID,
          position: POCKET,
          // Read off the build for `Rng(hashSeed('pkm-111:gate:5:0:reward'))`: the draw
          // is pinned, never re-derived, so a moved stream fails this test.
          itemId: 'butterfreiteg',
          hidden: false,
        },
      ],
    });
  });

  it('draws its reward off a seeded stream, so a fixed seed repeats it', () => {
    const first = descriptor.fixture?.(harness().host);
    const second = descriptor.fixture?.(harness().host);
    expect(first).toEqual(second);
  });

  it('places nothing once the run has taken that reward', () => {
    const host = harness({ pickedItems: [REWARD_ID] }).host;
    expect(descriptor.fixture?.(host)).toBeNull();
  });

  it('places nothing when the route holds no vault at all', () => {
    expect(descriptor.fixture?.(harness({ gate: false }).host)).toBeNull();
  });
});

describe('the gated room seal', () => {
  it('answers the interact key at the seal and nowhere else', () => {
    const { host, calls } = harness({ party: ['caterpie'] });
    expect(descriptor.interact?.(host, { x: SEAL.x - 1, y: SEAL.y })).toBe(false);
    expect(descriptor.interact?.(host, { x: SEAL.x, y: SEAL.y - 1 })).toBe(false);
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(calls).toEqual([]);
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
  });

  it('answers no seal when the route holds no vault', () => {
    const { host, calls } = harness({ gate: false });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('refuses a party without the obstacle’s own type, showing its line', () => {
    const { host, notices, calls, committed } = harness({ party: ['squirtle'] });
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
    expect(notices).toEqual([gateLockedNotice('bush')]);
    expect(calls).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('refuses each kind with its own line, never another kind’s', () => {
    const water = harness({ party: ['caterpie'], kind: 'water' });
    expect(descriptor.interact?.(water.host, SEAL)).toBe(true);
    expect(water.notices).toEqual([gateLockedNotice('water')]);

    const rock = harness({ party: ['caterpie'], kind: 'rock' });
    expect(descriptor.interact?.(rock.host, SEAL)).toBe(true);
    expect(rock.notices).toEqual([gateLockedNotice('rock')]);
  });

  it('opens for a party member of either listed type, and books the floor', () => {
    for (const speciesId of ['caterpie', 'chikorita']) {
      const { host, notices, calls, committed } = harness({ party: [speciesId] });
      expect(descriptor.interact?.(host, SEAL), speciesId).toBe(true);
      expect(calls, speciesId).toEqual(['commitRun', 'rebuildRoom']);
      expect(committed()?.pickedItems, speciesId).toContain(OPEN_ID);
      expect(notices, speciesId).toEqual([gateOpenedNotice()]);
    }
  });

  it('opens a rock only for a Rock or Fighting member', () => {
    for (const speciesId of ['nosepass', 'machop']) {
      const { host, calls } = harness({ party: [speciesId], kind: 'rock' });
      expect(descriptor.interact?.(host, SEAL), speciesId).toBe(true);
      expect(calls, speciesId).toEqual(['commitRun', 'rebuildRoom']);
    }
    const outsider = harness({ party: ['caterpie'], kind: 'rock' });
    expect(outsider.calls).toEqual([]);
  });

  it('lets the key fall through an already-opened seal', () => {
    const { host, notices, calls, committed } = harness({ pickedItems: [OPEN_ID] });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(calls).toEqual([]);
    expect(notices).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('agrees with itself across a reload: the open state is the run alone', () => {
    const first = harness({ party: ['caterpie'] });
    expect(descriptor.interact?.(first.host, SEAL)).toBe(true);
    const opened = first.committed();
    expect(opened).not.toBeNull();
    // The same run, in a brand-new host, reads the opening off `pickedItems`.
    const reloaded = harness({ party: ['caterpie'], pickedItems: opened!.pickedItems });
    expect(descriptor.interact?.(reloaded.host, SEAL)).toBe(false);
  });
});

describe('the gated room marker', () => {
  it('fills a circle then a rect, the room’s own keyhole', () => {
    const { graphics, calls } = recordingGraphics();
    descriptor.drawMarker?.(graphics, 10, 20, 4);
    expect(calls.map((call) => call.name)).toEqual(['fillStyle', 'fillCircle', 'fillRect']);
    expect(calls[0].args).toEqual([0x8a6d3b, 1]);
    expect(calls[1].args).toEqual([10, 19, 4 * 0.42]);
    expect(calls[2].args).toEqual([10 - 0.8, 20, 1.6, 3.4]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import { planMap, roomView } from '../../engine/maps';
import { createRun, createRunPokemon, type RunState } from '../../engine/run';
import { secretShopSealId, secretShopStock, sketchRoute, type RouteMap } from '../../engine/routes';
import { TILE_SIZE } from '../../engine/tileset';
import { gateLockedNotice, gateOpenedNotice, type Notice } from '../../ui/notice';
import type { GateKind } from '../../data/gates';
import { descriptor } from './secretShop';
import { openMart } from './shop';
import type { RoomHost } from './types';

/** The texture-key module builds textures with Phaser, which a headless test cannot load. */
vi.mock('../BootScene', () => ({ SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter' }));

/** The Mart card is the shipped floating window; the room only names its shelf. */
vi.mock('./shop', () => ({ openMart: vi.fn() }));

const openMartMock = vi.mocked(openMart);

const SEED = 'secret-shop-qa-3';
const MAP_INDEX = 3;
// Re-pinned by Task-117: the slot machine's room retired, so the leaf is room 9.
const ROOM_ID = 9;
const LEVEL = 5;

/** The seal and the vault tile the pinned room carves. */
const SEAL: Tile = { x: 10, y: 14 };
const POCKET: Tile = { x: 10, y: 15 };

/** A real build, so the descriptor reads a `RouteMap` and not a hand-made shape. */
const ROUTE: RouteMap = sketchRoute({ seed: SEED, routeIndex: 20, biomeId: 'forest' });

/** The plan room the stub hands over; only its map index and id are inputs. */
const VIEW = roomView(planMap(SEED, MAP_INDEX), ROOM_ID, false);

/** A run whose party is exactly the species the case needs. */
function runWith(party: readonly string[], pickedItems: readonly string[] = []): RunState {
  const members = party.map((speciesId, index) =>
    createRunPokemon({ id: `member-${index}`, speciesId, level: LEVEL, moves: ['tackle'] }),
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
  panelOpen?: boolean;
  generatorStepActive?: boolean;
}>;

/** A recording host: the room reads the route and books what it asks for. */
function harness(options: HarnessOptions = {}) {
  const notices: Notice[] = [];
  const calls: string[] = [];
  let current = runWith(options.party ?? ['caterpie'], options.pickedItems ?? []);
  let committed: RunState | null = null;
  const route: RouteMap =
    options.gate === false
      ? ROUTE
      : { ...ROUTE, gate: { kind: options.kind ?? 'rock', tile: SEAL, pocket: POCKET } };
  const host: RoomHost = {
    scene: {} as Phaser.Scene,
    get run(): RunState {
      return current;
    },
    view: VIEW,
    route: () => route,
    rebuildRoom: () => calls.push('rebuildRoom'),
    entryTile: () => ({ x: 1, y: 1 }),
    counterTile: () => POCKET,
    farthestRoomTile: () => null,
    facingFromTo: () => 'S',
    generatorStepActive: () => options.generatorStepActive === true,
    commitRun: (next) => {
      calls.push('commitRun');
      committed = next;
      current = next;
    },
    releaseHudKeyboard: () => undefined,
    openPanel: () => undefined,
    closePanel: () => undefined,
    panelOpen: () => options.panelOpen === true,
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

describe('the secret-shop fixture', () => {
  it('blocks the vault’s own pocket tile', () => {
    expect(descriptor.fixture?.(harness().host)).toEqual({ counter: POCKET });
  });

  it('places nothing when the route holds no vault at all', () => {
    expect(descriptor.fixture?.(harness({ gate: false }).host)).toBeNull();
  });

  it('keeps its counter after the seal opens', () => {
    const opened = secretShopSealId(MAP_INDEX, ROOM_ID);
    expect(descriptor.fixture?.(harness({ pickedItems: [opened] }).host)).toEqual({
      counter: POCKET,
    });
  });
});

describe('the secret-shop seal', () => {
  it('answers the interact key at its two tiles and nowhere else', () => {
    const { host, calls } = harness({ party: ['geodude'] });
    expect(descriptor.interact?.(host, { x: SEAL.x - 1, y: SEAL.y })).toBe(false);
    expect(descriptor.interact?.(host, { x: SEAL.x, y: SEAL.y - 1 })).toBe(false);
    expect(descriptor.interact?.(host, { x: POCKET.x + 1, y: POCKET.y })).toBe(false);
    expect(calls).toEqual([]);
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
  });

  it('answers nothing when the route holds no vault', () => {
    const { host, calls } = harness({ gate: false, party: ['geodude'] });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('refuses a party without the obstacle’s type, showing its line and booking nothing', () => {
    const { host, notices, calls, committed } = harness({ party: ['caterpie'], kind: 'rock' });
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
    expect(notices).toEqual([gateLockedNotice('rock')]);
    expect(calls).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('prints the obstacle’s own line for each kind', () => {
    for (const [kind, closed] of [
      ['bush', 'squirtle'],
      ['rock', 'caterpie'],
      ['water', 'caterpie'],
    ] as const) {
      const { host, notices } = harness({ party: [closed], kind });
      expect(descriptor.interact?.(host, SEAL), kind).toBe(true);
      expect(notices, kind).toEqual([gateLockedNotice(kind)]);
    }
  });

  it('opens for a party member of the obstacle’s type and books the floor', () => {
    const { host, notices, calls, committed } = harness({ party: ['geodude'] });
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
    expect(calls).toEqual(['commitRun', 'rebuildRoom']);
    expect(committed()?.pickedItems).toContain(secretShopSealId(MAP_INDEX, ROOM_ID));
    expect(notices).toEqual([gateOpenedNotice()]);
  });

  it('lets the key fall through an already-opened seal', () => {
    const opened = secretShopSealId(MAP_INDEX, ROOM_ID);
    const { host, notices, calls, committed } = harness({ pickedItems: [opened] });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(calls).toEqual([]);
    expect(notices).toEqual([]);
    expect(committed()).toBeNull();
  });
});

describe('the secret-shop counter', () => {
  beforeEach(() => {
    openMartMock.mockClear();
  });

  it('opens the Mart card on the room’s own six-row shelf', () => {
    const { host, calls } = harness();
    expect(descriptor.interact?.(host, POCKET)).toBe(true);
    expect(calls).toEqual([]);
    expect(openMartMock).toHaveBeenCalledTimes(1);
    expect(openMartMock.mock.calls[0][1]).toEqual({
      key: 'secret-shop',
      slots: secretShopStock(),
      title: 'mart.secretTitle',
    });
    expect(openMartMock.mock.calls[0][1]?.slots).toHaveLength(6);
  });

  it('does not reopen the card while it owns the key', () => {
    const { host } = harness({ panelOpen: true });
    expect(descriptor.interact?.(host, POCKET)).toBe(true);
    expect(openMartMock).not.toHaveBeenCalled();
  });

  it('leaves the counter alone when the route holds no vault', () => {
    const { host } = harness({ gate: false });
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(openMartMock).not.toHaveBeenCalled();
  });
});

describe('the secret-shop fixture sprite', () => {
  it('draws the shipped counter on the pocket tile at the trade depth', () => {
    const images: RecordedCall[] = [];
    const object = { setScale: () => object, setDepth: () => object };
    const scene = {
      add: {
        image: (...args: unknown[]): unknown => {
          images.push({ name: 'image', args });
          return object;
        },
      },
    };
    descriptor.drawFixture?.({ ...harness().host, scene: scene as unknown as Phaser.Scene });
    expect(images).toHaveLength(1);
    const [x, y, key] = images[0].args as [number, number, string];
    expect(x).toBe(POCKET.x * TILE_SIZE + TILE_SIZE / 2);
    expect(y).toBe(POCKET.y * TILE_SIZE + TILE_SIZE / 2);
    expect(key).toBe('route:shop-counter');
  });

  it('draws nothing without a vault or in the generator', () => {
    const images: RecordedCall[] = [];
    const scene = {
      add: {
        image: (...args: unknown[]): unknown => {
          images.push({ name: 'image', args });
          return { setScale: () => undefined, setDepth: () => undefined };
        },
      },
    };
    for (const host of [harness({ gate: false }).host, harness({ generatorStepActive: true }).host]) {
      descriptor.drawFixture?.({ ...host, scene: scene as unknown as Phaser.Scene });
    }
    expect(images).toEqual([]);
  });
});

describe('the secret-shop marker', () => {
  it('fills a teal ring: the outer disc, then the dark hole', () => {
    const { graphics, calls } = recordingGraphics();
    descriptor.drawMarker?.(graphics, 10, 20, 4);
    expect(calls.map((call) => call.name)).toEqual([
      'fillStyle',
      'fillCircle',
      'fillStyle',
      'fillCircle',
    ]);
    expect(calls[0].args).toEqual([0x14b8a6, 1]);
    expect(calls[1].args).toEqual([10, 20, 4 * 0.85]);
    expect(calls[2].args).toEqual([0x10161f, 1]);
    expect(calls[3].args).toEqual([10, 20, 4 * 0.34]);
  });
});

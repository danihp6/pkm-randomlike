import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import { miniBossTrainerId, planMap, roomView } from '../../engine/maps';
import { DEFAULT_TRAINER_SIGHT, sketchRoute } from '../../engine/routes';
import { createRun, createRunPokemon, type RunState } from '../../engine/run';
import { descriptor as megaStone } from './megaStone';
import { descriptor as miniBoss } from './miniBoss';
import { descriptor as shop } from './shop';
import type { RoomHost, RoomPanel } from './types';

/**
 * The scene's texture-key module builds textures with Phaser, which a headless test
 * cannot load; the room modules are driven without it.
 */
vi.mock('../BootScene', () => ({ SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter' }));

/** The floor the stub stands on: map 5, so the mega-stone leaf exists. */
const MAP_INDEX = 5;
/** The fixed seed every fixture below is pinned against (`D11`). */
const SEED = 'pkm-111';
/** The room's farthest walkable tile, and the entry it is placed to face. */
const FARTHEST: Tile = { x: 7, y: 7 };
const ENTRY: Tile = { x: 7, y: 3 };

/** The run the stub reads: the shipped `createRun`, standing on map 5. */
const RUN: RunState = {
  ...createRun({
    seed: SEED,
    starter: createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 5, moves: ['scratch'] }),
  }),
  mapIndex: MAP_INDEX,
};

/** The plan room the stub hands over; only its `mapIndex` is a fixture input. */
const VIEW = roomView(planMap(SEED, MAP_INDEX), 0, false);

/** The route the stub hands over: a real build the four shipped rooms never read. */
const ROUTE = sketchRoute({ seed: SEED, routeIndex: MAP_INDEX, biomeId: 'forest' });

type FakeObject = Record<string, unknown>;
/** One call the fake scene was asked to make, in order. */
type FakeCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** Every object the fake scene was asked to create, in order. */
const DRAWN: FakeCall[] = [];

/** A stand-in for one Phaser object: every call chains back to the same fake. */
function fakeObject(): FakeObject {
  const target: FakeObject = {};
  let proxy: FakeObject;
  const chain = (..._args: unknown[]): FakeObject => proxy;
  proxy = new Proxy(target, {
    get: (source, property) => {
      if (typeof property !== 'string') return undefined;
      if (property in source) return source[property];
      return chain;
    },
  });
  return proxy;
}

/** A stand-in for the scene a room's window or fixture draws into. */
function fakeScene(): Phaser.Scene {
  const add = new Proxy(
    {},
    {
      get:
        (_target, property) =>
        (...args: unknown[]): FakeObject => {
          if (typeof property === 'string') DRAWN.push({ name: property, args });
          return fakeObject();
        },
    },
  );
  const scene = {
    scale: { width: 1280, height: 800 },
    add,
    cameras: { main: { ignore: (): void => undefined } },
    input: { on: (): void => undefined, off: (): void => undefined },
  };
  return scene as unknown as Phaser.Scene;
}

type StubOptions = Readonly<{
  /** What `farthestRoomTile` answers; `null` means the stub offers no free tile. */
  farthest?: Tile | null;
  /** What `counterTile` answers; absent means the room placed no counter. */
  counter?: Tile | null;
  /** The run the fixture reads, when a test needs one further along. */
  run?: RunState;
  /** Whether the dev generator phases own the screen. */
  generator?: boolean;
}>;

/** A `RoomHost` answering with fixed tiles, holding the panel it is given. */
function stubHost(options: StubOptions = {}): RoomHost {
  let panel: RoomPanel | null = null;
  return {
    scene: fakeScene(),
    run: options.run ?? RUN,
    view: VIEW,
    route: () => ROUTE,
    rebuildRoom: () => undefined,
    entryTile: () => ENTRY,
    counterTile: () => ('counter' in options ? (options.counter ?? null) : FARTHEST),
    farthestRoomTile: () => ('farthest' in options ? (options.farthest ?? null) : FARTHEST),
    facingFromTo: (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (dx === 0 && dy === 0) return 'S';
      if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'E' : 'W';
      return dy > 0 ? 'S' : 'N';
    },
    generatorStepActive: () => options.generator === true,
    commitRun: () => undefined,
    releaseHudKeyboard: () => undefined,
    openPanel: (next) => {
      panel = next;
    },
    closePanel: () => {
      const open = panel;
      panel = null;
      open?.close();
    },
    panelOpen: () => panel !== null,
    startTrainerBattle: () => undefined,
    showNotice: () => undefined,
  };
}

describe('the mini-boss room', () => {
  it('places its trainer exactly where it stood before', () => {
    expect(miniBoss.fixture?.(stubHost())).toEqual({
      trainers: [
        {
          id: miniBossTrainerId(MAP_INDEX),
          position: FARTHEST,
          facing: 'N',
          sight: DEFAULT_TRAINER_SIGHT,
          archetypeId: 'ace',
        },
      ],
    });
  });

  it('stays beaten once the run has beaten it', () => {
    const run: RunState = { ...RUN, defeatedTrainers: [miniBossTrainerId(MAP_INDEX)] };
    expect(miniBoss.fixture?.(stubHost({ run }))).toBeNull();
  });

  it('places nothing when the room offers no free tile', () => {
    expect(miniBoss.fixture?.(stubHost({ farthest: null }))).toBeNull();
  });
});

describe('the mega-stone room', () => {
  it('places its stone exactly where it stood before', () => {
    expect(megaStone.fixture?.(stubHost())).toEqual({
      items: [
        {
          id: 'mega-5',
          position: FARTHEST,
          // Read off the pre-change build for `new Rng(hashSeed('pkm-111:mega:5'))`: the
          // draw is pinned, never re-derived, so a moved stream fails this test.
          itemId: 'dragoninite',
          hidden: false,
        },
      ],
    });
  });

  it('stays taken once the run has picked it up', () => {
    const run: RunState = { ...RUN, pickedItems: ['mega-5'] };
    expect(megaStone.fixture?.(stubHost({ run }))).toBeNull();
  });
});

describe('the shop room', () => {
  it('puts its counter on the room’s farthest tile', () => {
    expect(shop.fixture?.(stubHost())).toEqual({ counter: FARTHEST });
  });

  it('places no counter when the room offers no free tile', () => {
    expect(shop.fixture?.(stubHost({ farthest: null }))).toEqual({ counter: null });
  });

  it('answers the interact key at the counter and nowhere else', () => {
    const host = stubHost();
    expect(shop.interact?.(host, { x: 1, y: 2 })).toBe(false);
    expect(shop.interact?.(host, ENTRY)).toBe(false);
    expect(shop.interact?.(host, FARTHEST)).toBe(true);
    expect(host.panelOpen()).toBe(true);
    host.closePanel();
    expect(host.panelOpen()).toBe(false);
  });

  it('opens nothing when the room placed no counter', () => {
    const host = stubHost({ counter: null });
    expect(shop.interact?.(host, FARTHEST)).toBe(false);
    expect(host.panelOpen()).toBe(false);
  });

  it('draws the counter sprite once, at the counter tile’s centre', () => {
    DRAWN.length = 0;
    shop.drawFixture?.(stubHost());
    expect(DRAWN).toEqual([{ name: 'image', args: [180, 180, 'route:shop-counter'] }]);
  });

  it('draws no counter while the dev generator owns the screen', () => {
    DRAWN.length = 0;
    shop.drawFixture?.(stubHost({ generator: true }));
    expect(DRAWN).toEqual([]);
  });
});

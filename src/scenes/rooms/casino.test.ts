import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { planMap, roomView } from '../../engine/maps';
import { levelCapForMap } from '../../data/maps';
import type { Tile } from '../../engine/grid';
import type { RouteTrainer } from '../../engine/routes';
import { DEFAULT_TRAINER_SIGHT } from '../../engine/routes';
import { addMoney, createRun, createRunPokemon, type RunState } from '../../engine/run';
import { casinoGruntTrainerId, casinoLockId, casinoSpinId } from '../../ui/casino';
import { descriptor as casino } from './casino';
import type { RoomHost, RoomPanel } from './types';

/**
 * The scene's texture-key module builds textures with Phaser, which a headless test
 * cannot load; the descriptor is driven without it.
 */
vi.mock('../BootScene', () => ({
  CASINO_MACHINE_TEXTURE_KEY: 'route:casino-machine',
  TRAINER_TEXTURE_KEY: 'route:trainer',
}));

const MAP_INDEX = 5;
const SEED = 'pkm-64';
/** The seed whose first spin is the grunt fight, read off this build. */
const BATTLE_SEED = 'casino-a';
const FARTHEST: Tile = { x: 7, y: 7 };
const ENTRY: Tile = { x: 7, y: 3 };

type FakeObject = Record<string, unknown>;
/** One `scene.add` call, in order. */
type FakeCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** Every object the fake scene created, in order, and every string written to one. */
const DRAWN: FakeCall[] = [];
const TEXTS: string[] = [];

/** A stand-in for one Phaser object: every call chains, and `setText` is recorded. */
function fakeObject(): FakeObject {
  const target: FakeObject = {};
  let proxy: FakeObject;
  const chain =
    (property: string) =>
    (...args: unknown[]): FakeObject => {
      if (property === 'setText') TEXTS.push(String(args[0]));
      return proxy;
    };
  proxy = new Proxy(target, {
    get: (source, property) => {
      if (typeof property !== 'string') return undefined;
      if (property in source) return source[property];
      return chain(property);
    },
  });
  return proxy;
}

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
  return {
    scale: { width: 1280, height: 800 },
    add,
    cameras: { main: { ignore: (): void => undefined } },
  } as unknown as Phaser.Scene;
}

/** The run every window below reads: a starter on map 5 with plenty of money. */
function baseRun(seed = SEED, money = 100_000): RunState {
  const created = addMoney(
    createRun({
      seed,
      starter: createRunPokemon({
        id: 'starter',
        speciesId: 'charmander',
        level: 5,
        moves: ['scratch'],
      }),
    }),
    money,
  );
  return { ...created, mapIndex: MAP_INDEX, levelCap: levelCapForMap(MAP_INDEX) };
}

type HostOptions = Readonly<{
  farthest?: Tile | null;
  counter?: Tile | null;
  run?: RunState;
  generator?: boolean;
}>;

/** A recording `RoomHost`: it answers fixed tiles and books every call it is given. */
function harness(options: HostOptions = {}) {
  const calls: FakeCall[] = [];
  const record = (name: string, ...args: unknown[]): void => {
    calls.push({ name, args });
  };
  let run = options.run ?? baseRun();
  let panel: RoomPanel | null = null;
  let committed: RunState | null = null;
  let trainer: RouteTrainer | null = null;
  const host: RoomHost = {
    scene: fakeScene(),
    get run(): RunState {
      return run;
    },
    view: roomView(planMap(SEED, MAP_INDEX), 0, false),
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
    commitRun: (next) => {
      record('commitRun', next);
      committed = next;
      run = next;
    },
    releaseHudKeyboard: () => record('releaseHudKeyboard'),
    openPanel: (next) => {
      record('openPanel');
      panel = next;
    },
    closePanel: () => {
      record('closePanel');
      const open = panel;
      panel = null;
      open?.close();
    },
    panelOpen: () => panel !== null,
    startTrainerBattle: (next) => {
      record('startTrainerBattle', next);
      trainer = next;
    },
    showNotice: (notice) => record('showNotice', notice),
  };
  return {
    host,
    calls,
    panel: (): RoomPanel | null => panel,
    committed: (): RunState | null => committed,
    trainer: (): RouteTrainer | null => trainer,
  };
}

describe('the casino room', () => {
  it('puts its machine on the room’s farthest tile', () => {
    expect(casino.fixture?.(harness().host)).toEqual({ counter: FARTHEST });
  });

  it('places no machine when the room offers no free tile', () => {
    expect(casino.fixture?.(harness({ farthest: null }).host)).toEqual({ counter: null });
  });

  it('answers the interact key at the machine and nowhere else', () => {
    const test = harness();
    expect(casino.interact?.(test.host, { x: 1, y: 2 })).toBe(false);
    expect(casino.interact?.(test.host, ENTRY)).toBe(false);
    expect(test.host.panelOpen()).toBe(false);
    expect(casino.interact?.(test.host, FARTHEST)).toBe(true);
    expect(test.host.panelOpen()).toBe(true);
    test.host.closePanel();
    expect(test.host.panelOpen()).toBe(false);
  });

  it('opens nothing when the room placed no machine', () => {
    const test = harness({ counter: null });
    expect(casino.interact?.(test.host, FARTHEST)).toBe(false);
    expect(test.host.panelOpen()).toBe(false);
  });

  it('hands a second press to the open window, without rebuilding it', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    const built = DRAWN.length;
    expect(casino.interact?.(test.host, FARTHEST)).toBe(true);
    expect(test.host.panelOpen()).toBe(true);
    expect(DRAWN.length).toBe(built);
  });

  it('draws the cabinet and the grunt beside it', () => {
    DRAWN.length = 0;
    casino.drawFixture?.(harness().host);
    expect(DRAWN).toEqual([
      { name: 'image', args: [180, 180, 'route:casino-machine'] },
      // The grunt stands `-14` px off the cabinet's own x, its feet on the tile's
      // bottom edge (the shipped placeholder: the atlas carries no `rocket` row).
      { name: 'sprite', args: [166, 192, 'route:trainer'] },
    ]);
  });

  it('draws nothing while the dev generator owns the screen or there is no machine', () => {
    DRAWN.length = 0;
    casino.drawFixture?.(harness({ generator: true }).host);
    casino.drawFixture?.(harness({ counter: null }).host);
    expect(DRAWN).toEqual([]);
  });

  it('prints its own four strings when it opens', () => {
    TEXTS.length = 0;
    DRAWN.length = 0;
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    expect(TEXTS).toEqual(['MONEY  ¥100000', 'SPIN  ¥2000', 'LEAVE', '']);
    expect(DRAWN.filter((call) => call.name === 'bitmapText').map((call) => call.args[3])).toContain(
      'SLOT MACHINE',
    );
  });
});

describe('the casino window', () => {
  it('spins on the highlighted row, commits the run and names the prize', () => {
    TEXTS.length = 0;
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle('confirm');
    const committed = test.committed();
    expect(committed).not.toBeNull();
    expect(committed!.money).toBe(98_000);
    expect(committed!.pickedItems).toEqual([casinoSpinId(MAP_INDEX, 0)]);
    expect(committed!.bag).toEqual([{ itemId: 'nugget', count: 1 }]);
    expect(TEXTS).toContain('MONEY  ¥98000');
    expect(TEXTS).toContain('Obtained Nugget!');
    // The window stays open for the next spin, still on the machine's own tile.
    expect(test.host.panelOpen()).toBe(true);
    expect(test.trainer()).toBeNull();
  });

  it('closes the window and calls the grunt fight after the spin that lands it', () => {
    const test = harness({ run: baseRun(BATTLE_SEED) });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle('interact');
    const committed = test.committed();
    expect(committed).not.toBeNull();
    expect(committed!.pickedItems).toEqual([casinoSpinId(MAP_INDEX, 0), casinoLockId(MAP_INDEX)]);
    expect(committed!.money).toBe(98_000);
    expect(committed!.bag).toEqual([]);
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls.map((call) => call.name)).toEqual([
      'releaseHudKeyboard',
      'openPanel',
      'commitRun',
      'closePanel',
      'startTrainerBattle',
    ]);
    expect(test.trainer()).toEqual({
      id: casinoGruntTrainerId(MAP_INDEX),
      position: FARTHEST,
      facing: 'N',
      sight: DEFAULT_TRAINER_SIGHT,
      archetypeId: 'rocket',
    });
  });

  it('refuses a spin the run cannot afford, without committing anything', () => {
    TEXTS.length = 0;
    const test = harness({ run: baseRun(SEED, 100) });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle('confirm');
    expect(test.committed()).toBeNull();
    expect(test.host.panelOpen()).toBe(true);
    expect(TEXTS).toContain("You don't have enough money.");
    expect(TEXTS).toContain('MONEY  ¥100');
  });

  it('closes on cancel and on the leave row, and moves the cursor between the two', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle('down');
    test.panel()?.handle('up');
    test.panel()?.handle('cancel');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.committed()).toBeNull();

    const second = harness();
    casino.interact?.(second.host, FARTHEST);
    second.panel()?.handle('down');
    second.panel()?.handle('confirm');
    expect(second.host.panelOpen()).toBe(false);
    expect(second.committed()).toBeNull();
  });
});

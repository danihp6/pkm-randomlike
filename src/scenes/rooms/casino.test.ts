import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CASINO, EGG_ITEM_ID } from '../../data/casino';
import { ITEM_ICON_SIZE, ITEM_ICON_TEXTURE_KEY, itemIconFrame } from '../../data/itemIcons';
import { getItem } from '../../data/items';
import { levelCapForMap } from '../../data/maps';
import {
  OVERWORLD_SPRITE_HEIGHT,
  OVERWORLD_SPRITE_TEXTURE_KEY,
  overworldSpriteFrame,
} from '../../data/overworldSprites';
import { planMap, roomView } from '../../engine/maps';
import type { Tile } from '../../engine/grid';
import type { RouteTrainer } from '../../engine/routes';
import { DEFAULT_TRAINER_SIGHT, sketchRoute } from '../../engine/routes';
import { addMoney, bandForMap, createRun, createRunPokemon, type RunState } from '../../engine/run';
import { t } from '../../i18n';
import { casinoGruntTrainerId, casinoLockId, casinoSpinId } from '../../ui/casino';
import {
  REEL_COUNT,
  REEL_TICK_MS,
  REEL_W,
  reelFace,
  reelFaceIndex,
  reelRestFace,
  reelStrips,
  reelStopAt,
  type ReelFace,
} from '../../ui/casinoReels';
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
/** The seed whose third spin is the Egg, read off this build. */
const EGG_SEED = 'pkm-111';
const FARTHEST: Tile = { x: 7, y: 7 };
const ENTRY: Tile = { x: 7, y: 3 };

/** The SPIN and LEAVE row zones' tops on a 1280 × 800 canvas. */
const SPIN_ROW_Y = 386;
const LEAVE_ROW_Y = 430;

type FakeObject = Record<string, unknown>;
/** One `scene.add` (or fired timer) call, in order. */
type FakeCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** Every object the fake scene created, in order, and every string written to one. */
const DRAWN: FakeCall[] = [];
const TEXTS: string[] = [];
/** Every host a test opened, so the shared module state is closed between tests. */
const HOSTS: RoomHost[] = [];

afterEach(() => {
  for (const host of [...HOSTS].reverse()) {
    if (host.panelOpen()) host.closePanel();
  }
  HOSTS.length = 0;
  DRAWN.length = 0;
  TEXTS.length = 0;
});

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

/** The state a fake reel image carries: its texture, frame, scale and tint. */
type FakeImage = {
  textureKey: string;
  frame: number | string | undefined;
  scale: number;
  tint: number | null;
  mask: FakeObject | null;
};

/** A stand-in for one `scene.add.image`, recording the face it currently carries. */
function fakeImage(): FakeImage {
  const state: FakeImage = { textureKey: '', frame: undefined, scale: 1, tint: null, mask: null };
  let proxy: FakeObject;
  const chain =
    (property: string) =>
    (...args: unknown[]): FakeObject => {
      if (property === 'setTexture') {
        state.textureKey = String(args[0]);
        if (args[1] !== undefined) state.frame = args[1] as number;
      } else if (property === 'setFrame') {
        state.frame = args[0] as number;
      } else if (property === 'setScale') {
        state.scale = Number(args[0]);
      } else if (property === 'setTint') {
        state.tint = Number(args[0]);
      } else if (property === 'clearTint') {
        state.tint = null;
      } else if (property === 'setMask') {
        state.mask = args[0] as FakeObject;
      }
      return proxy;
    };
  proxy = new Proxy(state, {
    get: (source, property) => {
      if (typeof property !== 'string') return undefined;
      if (property in source) return (source as Record<string, unknown>)[property];
      return chain(property);
    },
  });
  return proxy as unknown as FakeImage;
}

/** A stand-in for one interactive `zone`, with the handlers the scene attaches. */
type FakeZone = {
  x: number;
  y: number;
  w: number;
  h: number;
  handlers: Map<string, () => void>;
};

function fakeZone(x: number, y: number, w: number, h: number): FakeZone {
  const zone: FakeZone = { x, y, w, h, handlers: new Map<string, () => void>() };
  let proxy: FakeObject;
  const chain =
    (property: string) =>
    (...args: unknown[]): FakeObject => {
      if (property === 'on') zone.handlers.set(String(args[0]), args[1] as () => void);
      return proxy;
    };
  proxy = new Proxy(zone, {
    get: (source, property) => {
      if (typeof property !== 'string') return undefined;
      if (property in source) return (source as Record<string, unknown>)[property];
      return chain(property);
    },
  });
  return proxy as unknown as FakeZone;
}

/** One timer the scene scheduled: its delay, loop flag, removal and callback. */
type FakeTimer = {
  delay: number;
  loop: boolean;
  removed: boolean;
  callback: () => void;
  remove(): void;
};

function fakeTimer(delay: number, callback: () => void, loop: boolean): FakeTimer {
  const timer: FakeTimer = {
    delay,
    loop,
    removed: false,
    callback,
    remove(): void {
      timer.removed = true;
    },
  };
  return timer;
}

type FakeScene = Readonly<{
  scene: Phaser.Scene;
  time: { now: number };
  timers: FakeTimer[];
  images: FakeImage[];
  zones: FakeZone[];
}>;

function fakeScene(): FakeScene {
  const timers: FakeTimer[] = [];
  const images: FakeImage[] = [];
  const zones: FakeZone[] = [];
  const time = {
    now: 0,
    delayedCall(delay: number, callback: () => void): FakeTimer {
      const timer = fakeTimer(delay, callback, false);
      timers.push(timer);
      return timer;
    },
    addEvent(config: Readonly<{ delay: number; loop?: boolean; callback: () => void }>): FakeTimer {
      const timer = fakeTimer(config.delay, config.callback, config.loop === true);
      timers.push(timer);
      return timer;
    },
  };
  const add = new Proxy(
    {},
    {
      get:
        (_target, property) =>
        (...args: unknown[]): FakeObject => {
          if (typeof property !== 'string') return fakeObject();
          DRAWN.push({ name: property, args });
          if (property === 'image') {
            const image = fakeImage();
            images.push(image);
            return image as unknown as FakeObject;
          }
          if (property === 'zone') {
            const zone = fakeZone(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]));
            zones.push(zone);
            return zone as unknown as FakeObject;
          }
          return fakeObject();
        },
    },
  );
  const scene = {
    scale: { width: 1280, height: 800 },
    add,
    make: { graphics: (): FakeObject => fakeObject() },
    time,
    cameras: { main: { ignore: (): void => undefined } },
  } as unknown as Phaser.Scene;
  return { scene, time, timers, images, zones };
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
  const fake = fakeScene();
  const host: RoomHost = {
    scene: fake.scene,
    get run(): RunState {
      return run;
    },
    view: roomView(planMap(SEED, MAP_INDEX), 0, false),
    // The widened port (`D47`): the casino reads neither, so it needs a stand-in.
    route: () => sketchRoute({ seed: SEED, routeIndex: MAP_INDEX, biomeId: 'forest' }),
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
  HOSTS.push(host);
  return {
    host,
    calls,
    fake,
    panel: (): RoomPanel | null => panel,
    committed: (): RunState | null => committed,
    trainer: (): RouteTrainer | null => trainer,
    /** The reel images the window created, in reel order. */
    reels: (): readonly FakeImage[] => fake.images,
    /** The zone whose top edge is `y`, if the window drew one. */
    zoneAt: (y: number): FakeZone | undefined => fake.zones.find((zone) => zone.y === y),
    /** Moves the fake clock, as a real frame would. */
    at: (ms: number): void => {
      fake.time.now = ms;
    },
    /** Fires the looping face tick and records that it ran. */
    fireTick: (): void => {
      const tick = fake.timers.find((timer) => timer.loop);
      if (!tick) return;
      calls.push({ name: 'timer', args: [tick.delay] });
      tick.callback();
    },
    /** Fires the stop at `ms` (800, 960 or 1 120) and records that it ran. */
    fireStop: (ms: number): void => {
      const stop = fake.timers.find((timer) => !timer.loop && timer.delay === ms);
      if (!stop) return;
      calls.push({ name: 'timer', args: [ms] });
      stop.callback();
    },
  };
}

/** Asserts a fake reel image carries `face`'s texture, frame and scale. */
function expectFace(image: FakeImage, face: ReelFace): void {
  if (face.kind === 'rocket') {
    expect(image.textureKey).toBe(OVERWORLD_SPRITE_TEXTURE_KEY);
    expect(image.frame).toBe(overworldSpriteFrame('rocket'));
    expect(image.scale).toBeCloseTo(48 / OVERWORLD_SPRITE_HEIGHT);
    return;
  }
  expect(image.textureKey).toBe(ITEM_ICON_TEXTURE_KEY);
  expect(image.frame).toBe(itemIconFrame(face.itemId));
  expect(image.scale).toBeCloseTo(REEL_W / ITEM_ICON_SIZE);
}

const BAND = bandForMap(MAP_INDEX).id;

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
      // bottom edge, drawn from the FRLG overworld atlas' `rocket` row (base 90).
      { name: 'sprite', args: [166, 192, 'frlg:overworld', 90] },
    ]);
  });

  it('draws nothing while the dev generator owns the screen or there is no machine', () => {
    DRAWN.length = 0;
    casino.drawFixture?.(harness({ generator: true }).host);
    casino.drawFixture?.(harness({ counter: null }).host);
    expect(DRAWN).toEqual([]);
  });
});

describe('the casino window', () => {
  it('opens on its own strings and its resting reels', () => {
    TEXTS.length = 0;
    DRAWN.length = 0;
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    const price = CASINO.price[BAND];
    expect(price).toBe(2000);
    expect(TEXTS).toEqual([`MONEY  ¥100000`, `SPIN  ¥${price}`, 'LEAVE', '']);
    expect(DRAWN.filter((call) => call.name === 'bitmapText').map((call) => call.args[3])).toContain(
      'SLOT MACHINE',
    );
    expect(test.reels()).toHaveLength(REEL_COUNT);
    test.reels().forEach((image, reel) => expectFace(image, reelRestFace(BAND, reel)));
    // The reel windows are 48 px squares 60 px apart, clipped by their own mask.
    const windows = DRAWN.filter(
      (call) => call.name === 'rectangle' && call.args[2] === 48 && call.args[3] === 48,
    );
    expect(windows.map((call) => call.args)).toEqual([
      [556, 322, 48, 48, expect.any(Number), expect.any(Number)],
      [616, 322, 48, 48, expect.any(Number), expect.any(Number)],
      [676, 322, 48, 48, expect.any(Number), expect.any(Number)],
    ]);
    test.reels().forEach((image) => expect(image.mask).not.toBeNull());
  });

  it('books the outcome before the first frame and commits it once per press', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    expect(test.calls.map((call) => call.name)).toEqual([
      'releaseHudKeyboard',
      'openPanel',
      'commitRun',
    ]);
    expect(test.calls.filter((call) => call.name === 'commitRun')).toHaveLength(1);
    const committed = test.committed();
    expect(committed).not.toBeNull();
    expect(committed!.money).toBe(98_000);
    expect(committed!.pickedItems).toEqual([casinoSpinId(MAP_INDEX, 0)]);
    expect(committed!.bag).toEqual([{ itemId: 'nugget', count: 1 }]);
    // The reveal owns four timers and none has run yet.
    expect(test.fake.timers.map((timer) => timer.delay)).toEqual([
      reelStopAt(0),
      reelStopAt(1),
      reelStopAt(2),
      REEL_TICK_MS,
    ]);
    // A second confirm is a skip: no second spin, no second commit.
    test.panel()?.handle?.('confirm');
    expect(test.calls.filter((call) => call.name === 'commitRun')).toHaveLength(1);
    expect(test.committed()!.money).toBe(98_000);
    expect(test.committed()!.pickedItems).toEqual([casinoSpinId(MAP_INDEX, 0)]);
  });

  it('reveals a booked item on the three reels, left to right', () => {
    TEXTS.length = 0;
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    const outcome = { kind: 'item', itemId: 'nugget' } as const;
    const strips = reelStrips(BAND, outcome);
    test.reels().forEach((image, reel) => expectFace(image, strips[reel][0]));

    test.at(400);
    test.fireTick();
    test.reels().forEach((image, reel) => {
      expectFace(image, strips[reel][reelFaceIndex(reel, 400)]);
    });

    test.at(reelStopAt(0));
    test.fireTick();
    test.fireStop(reelStopAt(0));
    expectFace(test.reels()[0], reelFace(outcome));
    expectFace(test.reels()[1], strips[1][reelFaceIndex(1, reelStopAt(0))]);

    test.at(reelStopAt(1));
    test.fireStop(reelStopAt(1));
    expectFace(test.reels()[1], reelFace(outcome));

    test.at(reelStopAt(2));
    test.fireStop(reelStopAt(2));
    test.reels().forEach((image) => expectFace(image, reelFace(outcome)));
    expect(TEXTS).toContain('MONEY  ¥98000');
    expect(TEXTS).toContain('Obtained Nugget!');
    // The window stays open for the next spin, still on the machine's own tile.
    expect(test.host.panelOpen()).toBe(true);
    expect(test.trainer()).toBeNull();
  });

  it('names the Egg an egg outcome pays', () => {
    TEXTS.length = 0;
    const test = harness({ run: baseRun(EGG_SEED) });
    casino.interact?.(test.host, FARTHEST);
    // `pkm-111` on map 5 pays ultraball, fullrestore, then the Egg.
    for (let i = 0; i < 3; i++) {
      test.panel()?.handle?.('confirm');
      test.panel()?.handle?.('confirm');
    }
    expect(test.committed()!.bag).toEqual([
      { itemId: 'ultraball', count: 1 },
      { itemId: 'fullrestore', count: 1 },
      { itemId: EGG_ITEM_ID, count: 1 },
    ]);
    test.reels().forEach((image) => expectFace(image, reelFace({ kind: 'egg' })));
    expect(TEXTS).toContain(t('notice.itemObtained', { name: getItem(EGG_ITEM_ID)!.name }));
    expect(test.host.panelOpen()).toBe(true);
  });

  it('closes the window for the grunt fight only after the last reel stops', () => {
    const test = harness({ run: baseRun(BATTLE_SEED) });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('interact');
    const committed = test.committed();
    expect(committed).not.toBeNull();
    expect(committed!.money).toBe(98_000);
    expect(committed!.pickedItems).toEqual([casinoSpinId(MAP_INDEX, 0), casinoLockId(MAP_INDEX)]);
    expect(committed!.bag).toEqual([]);
    expect(test.host.panelOpen()).toBe(true);

    test.at(reelStopAt(0));
    test.fireStop(reelStopAt(0));
    test.at(reelStopAt(1));
    test.fireStop(reelStopAt(1));
    // The last window has not stopped: the machine is still on screen.
    expect(test.host.panelOpen()).toBe(true);
    expect(test.trainer()).toBeNull();

    test.at(reelStopAt(2));
    test.fireStop(reelStopAt(2));
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls.map((call) => call.name)).toEqual([
      'releaseHudKeyboard',
      'openPanel',
      'commitRun',
      'timer',
      'timer',
      'timer',
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
    test.reels().forEach((image) => expectFace(image, reelFace({ kind: 'battle' })));
  });

  it('skips the reveal to the same end state on a press', () => {
    const test = harness({ run: baseRun(BATTLE_SEED) });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('interact');
    test.at(400);
    test.fireTick();
    test.panel()?.handle?.('confirm');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls.map((call) => call.name)).toEqual([
      'releaseHudKeyboard',
      'openPanel',
      'commitRun',
      'timer',
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
    test.reels().forEach((image) => expectFace(image, reelFace({ kind: 'battle' })));
  });

  it('locks the cursor and the leave row while the reels run', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    const commits = (): number => test.calls.filter((call) => call.name === 'commitRun').length;
    expect(commits()).toBe(1);

    test.panel()?.handle?.('up');
    test.panel()?.handle?.('down');
    test.panel()?.handle?.('cancel');
    expect(test.host.panelOpen()).toBe(true);
    expect(commits()).toBe(1);

    // The LEAVE row's own zone is a skip while spinning, never a close.
    test.zoneAt(LEAVE_ROW_Y)?.handlers.get('pointerdown')?.();
    expect(test.host.panelOpen()).toBe(true);
    expect(commits()).toBe(1);
    expect(TEXTS).toContain('Obtained Nugget!');
    test.reels().forEach((image) => expectFace(image, reelFace({ kind: 'item', itemId: 'nugget' })));
  });

  it('spins on a pointer press of SPIN and closes on a pointer press of LEAVE', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    expect(test.zoneAt(SPIN_ROW_Y)).toBeDefined();
    expect(test.zoneAt(LEAVE_ROW_Y)).toBeDefined();
    test.zoneAt(SPIN_ROW_Y)?.handlers.get('pointerdown')?.();
    expect(test.calls.filter((call) => call.name === 'commitRun')).toHaveLength(1);
    expect(test.committed()!.money).toBe(98_000);
    // Skip the item reveal, then take LEAVE with the pointer.
    test.panel()?.handle?.('confirm');
    expect(test.host.panelOpen()).toBe(true);
    test.zoneAt(LEAVE_ROW_Y)?.handlers.get('pointerdown')?.();
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls.filter((call) => call.name === 'commitRun')).toHaveLength(1);
  });

  it('selects a row on hover, so a confirm takes what the pointer marks', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.zoneAt(LEAVE_ROW_Y)?.handlers.get('pointerover')?.();
    test.panel()?.handle?.('confirm');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.committed()).toBeNull();
  });

  it('closes on cancel and on the leave row, and moves the cursor between the two', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('down');
    test.panel()?.handle?.('up');
    test.panel()?.handle?.('cancel');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.committed()).toBeNull();

    const second = harness();
    casino.interact?.(second.host, FARTHEST);
    second.panel()?.handle?.('down');
    second.panel()?.handle?.('confirm');
    expect(second.host.panelOpen()).toBe(false);
    expect(second.committed()).toBeNull();
  });

  it('refuses a spin the run cannot afford, without a timer or a commit', () => {
    TEXTS.length = 0;
    const test = harness({ run: baseRun(SEED, 100) });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    expect(test.committed()).toBeNull();
    expect(test.fake.timers).toHaveLength(0);
    expect(test.host.panelOpen()).toBe(true);
    expect(TEXTS).toContain("You don't have enough money.");
    expect(TEXTS).toContain('MONEY  ¥100');
  });

  it('refuses a locked machine without a timer or a commit', () => {
    TEXTS.length = 0;
    const test = harness({ run: { ...baseRun(), pickedItems: [casinoLockId(MAP_INDEX)] } });
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    expect(test.committed()).toBeNull();
    expect(test.fake.timers).toHaveLength(0);
    expect(test.host.panelOpen()).toBe(true);
    expect(TEXTS).toContain('The machine is out of order.');
  });

  it('removes every timer when the window closes, so a late callback paints nothing', () => {
    const test = harness();
    casino.interact?.(test.host, FARTHEST);
    test.panel()?.handle?.('confirm');
    expect(test.fake.timers).toHaveLength(4);
    test.host.closePanel();
    expect(test.host.panelOpen()).toBe(false);
    expect(test.fake.timers.every((timer) => timer.removed)).toBe(true);
    const texts = [...TEXTS];
    for (const timer of test.fake.timers) timer.callback();
    expect(TEXTS).toEqual(texts);
    expect(test.committed()!.money).toBe(98_000);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { levelCapForMap } from '../../data/maps';
import { getSpecies } from '../../data/dex/species';
import type { Tile } from '../../engine/grid';
import { planMap, roomView } from '../../engine/maps';
import { createRun, createRunPokemon, type RunState } from '../../engine/run';
import { tradeId } from '../../engine/run';
import { sketchRoute } from '../../engine/routes';
import { t } from '../../i18n';
import { descriptor as trade } from './trade';
import type { RoomHost, RoomPanel } from './types';

/**
 * The scene's texture-key module builds textures with Phaser, which a headless test
 * cannot load; the descriptor is driven without it.
 */
vi.mock('../BootScene', () => ({ SHOP_COUNTER_TEXTURE_KEY: 'route:shop-counter' }));

const SEED = 'pkm-111';
const MAP_INDEX = 5;
const ROOM_ID = 3;
const FARTHEST: Tile = { x: 7, y: 7 };
const ENTRY: Tile = { x: 7, y: 3 };

type FakeObject = Record<string, unknown>;
/** One `scene.add` call, in order. */
type FakeCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** Every object the fake scene created, in order, and every string written to one. */
const DRAWN: FakeCall[] = [];
const TEXTS: string[] = [];
/** The panel the last opened window handed to its host, so a test can tear it down. */
let lastPanel: RoomPanel | null = null;

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

/** The run every window below reads: a party on map 5 with the squad's shared XP. */
function baseRun(seed = SEED, partySize = 2, pickedItems: readonly string[] = []): RunState {
  const species = ['caterpie', 'metapod', 'butterfree', 'pidgey', 'rattata', 'spearow'];
  const party = species
    .slice(0, partySize)
    .map((speciesId, index) =>
      createRunPokemon({ id: `member-${index}`, speciesId, level: 10, moves: ['scratch'] }),
    );
  const created = createRun({ seed, starter: party[0] });
  return {
    ...created,
    mapIndex: MAP_INDEX,
    levelCap: levelCapForMap(MAP_INDEX),
    party,
    pickedItems: [...pickedItems],
  };
}

type HostOptions = Readonly<{
  farthest?: Tile | null;
  counter?: Tile | null;
  run?: RunState;
  generator?: boolean;
}>;

/** A recording `RoomHost`: it answers fixed tiles and books every call it is given. */
function harness(options: HostOptions = {}) {
  const calls: string[] = [];
  let run = options.run ?? baseRun();
  let panel: RoomPanel | null = null;
  let committed: RunState | null = null;
  const host: RoomHost = {
    scene: fakeScene(),
    get run(): RunState {
      return run;
    },
    view: roomView(planMap(SEED, MAP_INDEX), ROOM_ID, false),
    route: () => sketchRoute({ seed: SEED, routeIndex: MAP_INDEX, biomeId: 'forest' }),
    rebuildRoom: () => undefined,
    entryTile: () => ENTRY,
    counterTile: () => ('counter' in options ? (options.counter ?? null) : FARTHEST),
    farthestRoomTile: () => ('farthest' in options ? (options.farthest ?? null) : FARTHEST),
    facingFromTo: () => 'S',
    generatorStepActive: () => options.generator === true,
    commitRun: (next) => {
      calls.push('commitRun');
      committed = next;
      run = next;
    },
    releaseHudKeyboard: () => calls.push('releaseHudKeyboard'),
    openPanel: (next) => {
      calls.push('openPanel');
      panel = next;
      lastPanel = next;
    },
    closePanel: () => {
      calls.push('closePanel');
      const open = panel;
      panel = null;
      open?.close();
    },
    panelOpen: () => panel !== null,
    startTrainerBattle: () => undefined,
    showNotice: () => undefined,
  };
  return {
    host,
    calls,
    panel: (): RoomPanel | null => panel,
    committed: (): RunState | null => committed,
    run: (): RunState => run,
  };
}

afterEach(() => {
  lastPanel?.close();
  lastPanel = null;
  DRAWN.length = 0;
  TEXTS.length = 0;
});

/** The message plus the seven row labels the last repaint wrote, in order. */
function repaint(): readonly string[] {
  return TEXTS.slice(-8);
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

describe('the trade room fixture', () => {
  it('puts its counter on the room’s farthest tile', () => {
    expect(trade.fixture?.(harness().host)).toEqual({ counter: FARTHEST });
  });

  it('places no counter when the room offers no free tile', () => {
    expect(trade.fixture?.(harness({ farthest: null }).host)).toEqual({ counter: null });
  });

  it('draws the shop’s counter sprite once, at the counter tile’s centre', () => {
    DRAWN.length = 0;
    trade.drawFixture?.(harness().host);
    expect(DRAWN).toEqual([{ name: 'image', args: [180, 180, 'route:shop-counter'] }]);
  });

  it('draws nothing while the dev generator owns the screen or there is no counter', () => {
    DRAWN.length = 0;
    trade.drawFixture?.(harness({ generator: true }).host);
    trade.drawFixture?.(harness({ counter: null }).host);
    expect(DRAWN).toEqual([]);
  });
});

describe('the trade room counter', () => {
  it('answers the interact key at the counter and nowhere else', () => {
    const test = harness();
    expect(trade.interact?.(test.host, { x: 1, y: 2 })).toBe(false);
    expect(trade.interact?.(test.host, ENTRY)).toBe(false);
    expect(test.host.panelOpen()).toBe(false);
    expect(trade.interact?.(test.host, FARTHEST)).toBe(true);
    expect(test.host.panelOpen()).toBe(true);
  });

  it('opens nothing when the room placed no counter', () => {
    const test = harness({ counter: null });
    expect(trade.interact?.(test.host, FARTHEST)).toBe(false);
    expect(test.host.panelOpen()).toBe(false);
  });

  it('hands a second press to the open window, without rebuilding it', () => {
    const test = harness();
    trade.interact?.(test.host, FARTHEST);
    const built = DRAWN.length;
    expect(trade.interact?.(test.host, FARTHEST)).toBe(true);
    expect(test.host.panelOpen()).toBe(true);
    expect(DRAWN.length).toBe(built);
  });
});

describe('the trade window’s rows', () => {
  it('lists the live party in order, then LEAVE', () => {
    TEXTS.length = 0;
    const test = harness();
    trade.interact?.(test.host, FARTHEST);
    expect(repaint()).toEqual([
      t('trade.greeting'),
      'Caterpie  Lv10',
      'Metapod  Lv10',
      t('trade.leave'),
      '',
      '',
      '',
      '',
    ]);
  });

  it('collapses to LEAVE alone in a single-member party, with its line', () => {
    TEXTS.length = 0;
    const test = harness({ run: baseRun(SEED, 1) });
    trade.interact?.(test.host, FARTHEST);
    expect(repaint()).toEqual([t('trade.refused'), t('trade.leave'), '', '', '', '', '', '']);
  });

  it('collapses to LEAVE alone in a used room, with its line', () => {
    TEXTS.length = 0;
    const used = baseRun(SEED, 2, [tradeId(MAP_INDEX, ROOM_ID)]);
    const test = harness({ run: used });
    trade.interact?.(test.host, FARTHEST);
    expect(repaint()).toEqual([t('trade.used'), t('trade.leave'), '', '', '', '', '', '']);
  });

  it('keeps the cursor on the single row when the list holds only LEAVE', () => {
    const test = harness({ run: baseRun(SEED, 1) });
    trade.interact?.(test.host, FARTHEST);
    test.panel()?.handle('down');
    test.panel()?.handle('up');
    // Still open: the cursor wrapped over one row and never left it.
    expect(test.host.panelOpen()).toBe(true);
    test.panel()?.handle('confirm');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.committed()).toBeNull();
  });
});

describe('the trade window’s actions', () => {
  it('closes on cancel without committing a single run', () => {
    const test = harness();
    const before = test.run();
    trade.interact?.(test.host, FARTHEST);
    test.panel()?.handle('cancel');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls).not.toContain('commitRun');
    expect(test.committed()).toBeNull();
    expect(test.run()).toBe(before);
  });

  it('closes on the LEAVE row without committing', () => {
    const test = harness();
    trade.interact?.(test.host, FARTHEST);
    test.panel()?.handle('down');
    test.panel()?.handle('down');
    test.panel()?.handle('confirm');
    expect(test.host.panelOpen()).toBe(false);
    expect(test.calls).not.toContain('commitRun');
  });

  it('trades the highlighted member once, keeps the window and names the received one', () => {
    TEXTS.length = 0;
    const test = harness();
    const before = test.run();
    trade.interact?.(test.host, FARTHEST);
    test.panel()?.handle('confirm');

    expect(test.calls.filter((call) => call === 'commitRun')).toHaveLength(1);
    const committed = test.committed();
    expect(committed).not.toBeNull();
    expect(committed!.party.map((member) => member.fighter.id)).toEqual([
      'member-1',
      committed!.party[1].fighter.id,
    ]);
    expect(committed!.pickedItems).toEqual([tradeId(MAP_INDEX, ROOM_ID)]);
    expect(before.party.some((member) => member.fighter.id === 'member-0')).toBe(true);
    expect(committed!.party.some((member) => member.fighter.id === 'member-0')).toBe(false);

    // The window stays up and repaints to the used room's single LEAVE row.
    expect(test.host.panelOpen()).toBe(true);
    const received = committed!.party[1].fighter;
    const name = received.nickname ?? getSpecies(received.speciesId)?.name ?? received.speciesId;
    expect(repaint()).toEqual([t('trade.done', { name }), t('trade.leave'), '', '', '', '', '', '']);
  });

  it('reports the received member at the squad’s level through the committed run', () => {
    const test = harness();
    const before = test.run();
    trade.interact?.(test.host, FARTHEST);
    test.panel()?.handle('confirm');
    const committed = test.committed()!;
    expect(committed.party[1].fighter.level).toBe(10);
    expect(committed.xp).toBe(before.xp);
  });
});

describe('the trade room marker', () => {
  it('paints the two exchange fills in the frozen order', () => {
    const { graphics, calls } = recordingGraphics();
    trade.drawMarker?.(graphics, 10, 20, 4);
    expect(calls.map((call) => call.name)).toEqual([
      'fillStyle',
      'fillRect',
      'fillTriangle',
      'fillStyle',
      'fillRect',
      'fillTriangle',
    ]);
    expect(calls[0].args).toEqual([0x2f80ed, 1]);
    expect(calls[1].args).toEqual([10 - 4, 20 - 4 * 0.6, 4 * 2, 4 * 0.5]);
    expect(calls[2].args).toEqual([
      10 + 4 * 0.2,
      20 - 4,
      10 + 4,
      20 - 4 * 0.35,
      10 + 4 * 0.2,
      20 + 4 * 0.25,
    ]);
    expect(calls[3].args).toEqual([0x56ccf2, 1]);
    expect(calls[4].args).toEqual([10 - 4, 20 + 4 * 0.15, 4 * 2, 4 * 0.5]);
    expect(calls[5].args).toEqual([
      10 - 4 * 0.2,
      20 + 4,
      10 - 4,
      20 + 4 * 0.35,
      10 - 4 * 0.2,
      20 - 4 * 0.25,
    ]);
  });
});

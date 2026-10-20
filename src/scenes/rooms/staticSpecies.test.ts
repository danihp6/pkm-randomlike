import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import { planMap, roomView } from '../../engine/maps';
import { createRun, createRunPokemon, type RunState } from '../../engine/run';
import { sketchRoute, staticSpeciesId, type RouteMap } from '../../engine/routes';
import { TILE_SIZE } from '../../engine/tileset';
import { typeColor } from '../../ui/typeColors';
import type { GateKind } from '../../data/gates';
import {
  gateOpenedNotice,
  staticLegendaryNotice,
  staticSealLockedNotice,
  type Notice,
} from '../../ui/notice';
import { descriptor } from './staticSpecies';
import type { RoomHost, RoomWildBattle } from './types';

const SEED = 'pkm-111';
const MAP_INDEX = 5;
const ROOM_ID = 0;

/** The two records the room books, as the run keeps them. */
const OPEN_ID = `static-${MAP_INDEX}-${ROOM_ID}`;
const SPECIES_ID = `static-mon-${MAP_INDEX}-${ROOM_ID}`;

/** The seal the vault is closed with and the tile the species stands on. */
const SEAL: Tile = { x: 6, y: 6 };
const POCKET: Tile = { x: 6, y: 8 };

/** A real build, so the descriptor reads a `RouteMap` and not a hand-made shape. */
const ROUTE: RouteMap = sketchRoute({ seed: SEED, routeIndex: MAP_INDEX, biomeId: 'forest' });

/** The plan room the stub hands over; only its map index and id are inputs. */
const VIEW = roomView(planMap(SEED, MAP_INDEX), ROOM_ID, false);

/** The species the room fields for this seed, floor and room (pinned in the engine test). */
const SPECIES = 'frigibax';
const LEVEL = 5;

/** A run whose party is exactly the species the case needs. */
function runWith(
  party: readonly string[],
  pickedItems: readonly string[] = [],
  overrides: Partial<RunState> = {},
): RunState {
  const members = party.map((speciesId, index) =>
    createRunPokemon({ id: `member-${index}`, speciesId, level: LEVEL, moves: ['tackle'] }),
  );
  const base = createRun({ seed: SEED, starter: members[0] });
  return { ...base, mapIndex: MAP_INDEX, party: members, pickedItems, ...overrides };
}

type HarnessOptions = Readonly<{
  party?: readonly string[];
  pickedItems?: readonly string[];
  kind?: GateKind;
  /** `false` builds the room's route without a vault at all. */
  gate?: boolean;
  /** Omit the host's optional wild-battle hook. */
  wildHook?: boolean;
  run?: RunState;
}>;

/** A recording host: the room reads the route and books what it asks for. */
function harness(options: HarnessOptions = {}) {
  const notices: Notice[] = [];
  const calls: string[] = [];
  const battles: RoomWildBattle[] = [];
  let current = options.run ?? runWith(options.party ?? ['caterpie'], options.pickedItems ?? []);
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
    ...(options.wildHook === false
      ? {}
      : {
          startWildBattle: (encounter: RoomWildBattle) => {
            calls.push('startWildBattle');
            battles.push(encounter);
          },
        }),
    showNotice: (notice) => notices.push(notice),
  };
  return { host, notices, calls, battles, committed: (): RunState | null => committed };
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

/** A scene stand-in whose `add.circle` books every circle the fixture draws. */
function recordingScene(): { scene: Phaser.Scene; circles: RecordedCall[] } {
  const circles: RecordedCall[] = [];
  const object = {
    setDepth: (..._args: unknown[]): unknown => object,
  };
  const scene = {
    add: {
      circle: (...args: unknown[]): unknown => {
        circles.push({ name: 'circle', args });
        return object;
      },
    },
  };
  return { scene: scene as unknown as Phaser.Scene, circles };
}

describe('the static room fixture', () => {
  it('blocks the vault’s own tile and floats no line on an ordinary floor', () => {
    const fixture = descriptor.fixture?.(harness().host);
    expect(fixture).toEqual({ counter: POCKET });
    expect(descriptor.fixture?.(harness().host)).not.toHaveProperty('notice');
  });

  it('places nothing once the species has been fought', () => {
    const host = harness({ pickedItems: [SPECIES_ID] }).host;
    expect(descriptor.fixture?.(host)).toBeNull();
  });

  it('places nothing when the route holds no vault at all', () => {
    expect(descriptor.fixture?.(harness({ gate: false }).host)).toBeNull();
  });

  it('keeps its counter while only the seal is open', () => {
    const fixture = descriptor.fixture?.(harness({ pickedItems: [OPEN_ID] }).host);
    expect(fixture).toEqual({ counter: POCKET });
  });

  it('floats the legendary line, named from the dex, on the legendary variant', () => {
    const legendary = harness({
      run: runWith(['caterpie'], [], {
        seed: 'static-96-0',
        mapIndex: 4,
        missionsCompleted: 1,
        mission: { id: 'flawless', progress: 0, completed: false },
      }),
    });
    const host = { ...legendary.host, view: roomView(planMap('static-96-0', 4), 5, false) };
    expect(descriptor.fixture?.(host)).toEqual({
      counter: POCKET,
      notice: staticLegendaryNotice('Moltres'),
    });
  });
});

describe('the static room seal', () => {
  it('answers the interact key at its two tiles and nowhere else', () => {
    const { host, calls } = harness({ party: ['caterpie'] });
    expect(descriptor.interact?.(host, { x: SEAL.x - 1, y: SEAL.y })).toBe(false);
    expect(descriptor.interact?.(host, { x: SEAL.x, y: SEAL.y - 1 })).toBe(false);
    expect(descriptor.interact?.(host, { x: POCKET.x + 1, y: POCKET.y })).toBe(false);
    expect(calls).toEqual([]);
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
  });

  it('answers nothing when the route holds no vault', () => {
    const { host, calls } = harness({ gate: false });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('refuses a party without the seal’s property, showing its line and booking nothing', () => {
    const { host, notices, calls, committed } = harness({ party: ['squirtle'] });
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
    expect(notices).toEqual([staticSealLockedNotice('bush')]);
    expect(calls).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('refuses the pond with the feature line, never the type one', () => {
    const water = harness({ party: ['caterpie'], kind: 'water' });
    expect(descriptor.interact?.(water.host, SEAL)).toBe(true);
    expect(water.notices).toEqual([staticSealLockedNotice('water')]);
    expect(water.notices[0].text).not.toBe(staticSealLockedNotice('bush').text);

    const rock = harness({ party: ['caterpie'], kind: 'rock' });
    expect(descriptor.interact?.(rock.host, SEAL)).toBe(true);
    expect(rock.notices).toEqual([staticSealLockedNotice('rock')]);
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

  it('opens the pond for a party member holding one of its abilities', () => {
    const member = createRunPokemon({
      id: 'member-0',
      speciesId: 'vaporeon',
      level: LEVEL,
      moves: ['tackle'],
      ability: 'Water Absorb',
    });
    const run = { ...runWith(['caterpie']), party: [member] };
    const { host, calls, committed } = harness({ kind: 'water', run });
    expect(descriptor.interact?.(host, SEAL)).toBe(true);
    expect(calls).toEqual(['commitRun', 'rebuildRoom']);
    expect(committed()?.pickedItems).toContain(OPEN_ID);
  });

  it('lets the key fall through an already-opened seal', () => {
    const { host, notices, calls, committed } = harness({ pickedItems: [OPEN_ID] });
    expect(descriptor.interact?.(host, SEAL)).toBe(false);
    expect(calls).toEqual([]);
    expect(notices).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('agrees with itself across a reload: the opening is the run alone', () => {
    const first = harness({ party: ['caterpie'] });
    expect(descriptor.interact?.(first.host, SEAL)).toBe(true);
    const opened = first.committed();
    expect(opened).not.toBeNull();
    const reloaded = harness({ party: ['caterpie'], pickedItems: opened!.pickedItems });
    expect(descriptor.interact?.(reloaded.host, SEAL)).toBe(false);
  });
});

describe('the static room species', () => {
  it('books the record and starts the wild battle at the squad’s level', () => {
    const { host, notices, calls, battles, committed } = harness({ party: ['caterpie'] });
    expect(descriptor.interact?.(host, POCKET)).toBe(true);
    expect(calls).toEqual(['commitRun', 'rebuildRoom', 'startWildBattle']);
    expect(committed()?.pickedItems).toContain(SPECIES_ID);
    expect(notices).toEqual([]);
    expect(battles).toEqual([
      { speciesId: SPECIES, level: LEVEL, key: `static:${MAP_INDEX}:${ROOM_ID}` },
    ]);
  });

  it('books the species before the battle, so the glyph goes first', () => {
    const { host, calls } = harness();
    descriptor.interact?.(host, POCKET);
    expect(calls.indexOf('commitRun')).toBeLessThan(calls.indexOf('startWildBattle'));
    expect(calls.indexOf('rebuildRoom')).toBeLessThan(calls.indexOf('startWildBattle'));
  });

  it('lets the key fall through once the species is gone', () => {
    const { host, notices, calls, battles, committed } = harness({ pickedItems: [SPECIES_ID] });
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(calls).toEqual([]);
    expect(battles).toEqual([]);
    expect(notices).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('falls through when the host has no wild-battle hook', () => {
    const { host, calls, committed } = harness({ wildHook: false });
    expect(descriptor.interact?.(host, POCKET)).toBe(false);
    expect(calls).toEqual([]);
    expect(committed()).toBeNull();
  });

  it('fields the right species for each seed’s own content', () => {
    const legendary = harness({
      run: runWith(['caterpie'], [], {
        seed: 'static-96-0',
        mapIndex: 4,
        missionsCompleted: 1,
        mission: { id: 'flawless', progress: 0, completed: false },
      }),
    });
    const host = { ...legendary.host, view: roomView(planMap('static-96-0', 4), 5, false) };
    expect(descriptor.interact?.(host, POCKET)).toBe(true);
    expect(legendary.battles[0].speciesId).toBe('moltres');
    expect(legendary.committed()?.pickedItems).toContain(staticSpeciesId(4, 5));
  });
});

describe('the static room silhouette', () => {
  it('draws the species’ silhouette and its highlight on the vault tile', () => {
    const { host } = harness();
    const { scene, circles } = recordingScene();
    descriptor.drawFixture?.({ ...host, scene });
    const x = POCKET.x * TILE_SIZE + TILE_SIZE / 2;
    const y = POCKET.y * TILE_SIZE + TILE_SIZE / 2;
    expect(circles.map((call) => call.args)).toEqual([
      [x, y, TILE_SIZE * 0.3, typeColor('Dragon')],
      [x - TILE_SIZE * 0.08, y - TILE_SIZE * 0.1, TILE_SIZE * 0.12, 0xffffff, 0.7],
    ]);
  });

  it('draws nothing once the species has been fought, without a vault, or in the generator', () => {
    const cases = [
      harness({ pickedItems: [SPECIES_ID] }).host,
      harness({ gate: false }).host,
      {
        ...harness().host,
        generatorStepActive: () => true,
      },
    ];
    for (const host of cases) {
      const { scene, circles } = recordingScene();
      descriptor.drawFixture?.({ ...host, scene });
      expect(circles).toEqual([]);
    }
  });
});

describe('the static room marker', () => {
  it('fills a gold ring: the outer disc, then the dark hole', () => {
    const { graphics, calls } = recordingGraphics();
    descriptor.drawMarker?.(graphics, 10, 20, 4);
    expect(calls.map((call) => call.name)).toEqual([
      'fillStyle',
      'fillCircle',
      'fillStyle',
      'fillCircle',
    ]);
    expect(calls[0].args).toEqual([0xf2c94c, 1]);
    expect(calls[1].args).toEqual([10, 20, 4 * 0.85]);
    expect(calls[2].args).toEqual([0x10161f, 1]);
    expect(calls[3].args).toEqual([10, 20, 4 * 0.34]);
  });
});

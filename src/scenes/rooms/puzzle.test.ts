import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { Tile } from '../../engine/grid';
import type { RoomView } from '../../engine/maps';
import { mapFromSketch, type TileMap } from '../../engine/map';
import type { RouteMap } from '../../engine/routes/routeMap';
import { puzzleId, puzzleLayout, puzzleRewardId } from '../../engine/routes';
import { createRun, createRunPokemon, markItemPicked, type RunState } from '../../engine/run';
import { TILE_SIZE } from '../../engine/tileset';
import { t } from '../../i18n';
import { NOTICE_HOLD_MS, puzzleResetNotice, puzzleSolvedNotice } from '../../ui/notice';
import { PUZZLES } from '../../data/puzzles';
import { descriptor as puzzle } from './puzzle';
import type { RoomHost } from './types';

const SEED = 'pkm-102';
const MAP_INDEX = 5;
const ENTRY: Tile = { x: 7, y: 7 };

const SWITCH_RADIUS = TILE_SIZE * 0.22;
const FIXTURE_DEPTH = 5;
const PRESSED = 0xf2c94c;
const RESTING = 0x94a3b8;
const RING = 0x10161f;

/** An open room large enough for any row's switches and its reward. */
const ROOM: TileMap = mapFromSketch([
  '#################',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#...............#',
  '#################',
]);

type RecordedCall = Readonly<{ name: string; args: readonly unknown[] }>;

/** A stand-in for one drawn switch disc: it books every paint call, in order. */
type FakeDisc = Readonly<{
  x: number;
  y: number;
  radius: number;
  fill: number;
  depth: number | null;
  stroke: readonly [number, number] | null;
  fills: readonly (readonly [number, number])[];
}>;

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

/** The scene's `add.circle` port: one fake per disc, chainable like Phaser's. */
function fakeScene(): { scene: Phaser.Scene; discs: FakeDisc[] } {
  const discs: FakeDisc[] = [];
  const add = {
    circle: (x: number, y: number, radius: number, fill: number): unknown => {
      const disc = {
        x,
        y,
        radius,
        fill,
        depth: null as number | null,
        stroke: null as readonly [number, number] | null,
        fills: [] as (readonly [number, number])[],
        setDepth(value: number) {
          disc.depth = value;
          return disc;
        },
        setStrokeStyle(width: number, color: number) {
          disc.stroke = [width, color];
          return disc;
        },
        setFillStyle(color: number, alpha: number) {
          disc.fills = [...disc.fills, [color, alpha]];
          return disc;
        },
      };
      discs.push(disc as unknown as FakeDisc);
      return disc;
    },
  };
  return { scene: { add } as unknown as Phaser.Scene, discs };
}

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
  run?: RunState;
  roomId?: number;
  generatorActive?: boolean;
}>;

/** A recording `RoomHost` over the fake scene, with the run it hands over. */
function harness(options: HostOptions = {}) {
  const mapIndex = MAP_INDEX;
  const roomId = options.roomId ?? 3;
  // The descriptor reads only the view's two ids, so the harness names a room
  // without walking a whole plan (and a room id beyond this seed's floor is legal).
  const view = { mapIndex, roomId } as unknown as RoomView;
  const { scene, discs } = fakeScene();
  let run = options.run ?? baseRun();
  const notices: string[] = [];
  const events: string[] = [];
  const commits: RunState[] = [];
  const host: RoomHost = {
    scene,
    get run(): RunState {
      return run;
    },
    view,
    route: () => ({ tiles: ROOM, entry: ENTRY }) as unknown as RouteMap,
    rebuildRoom: () => {
      events.push('rebuild');
    },
    entryTile: () => ENTRY,
    counterTile: () => null,
    farthestRoomTile: () => null,
    facingFromTo: () => 'S',
    generatorStepActive: () => options.generatorActive === true,
    commitRun: (next) => {
      run = next;
      commits.push(next);
      events.push('commit');
    },
    releaseHudKeyboard: () => undefined,
    openPanel: () => undefined,
    closePanel: () => undefined,
    panelOpen: () => false,
    startTrainerBattle: () => undefined,
    showNotice: (notice) => {
      notices.push(notice.text);
      events.push('notice');
    },
  };
  const layout = puzzleLayout({ tiles: ROOM, entry: ENTRY }, { seed: run.seed, mapIndex, roomId });
  return { host, discs, layout: layout!, notices, events, commits, roomId, mapIndex };
}

function solvedRun(roomId: number): RunState {
  return markItemPicked(baseRun(), puzzleId(MAP_INDEX, roomId));
}

describe('the puzzle room descriptor', () => {
  it('claims the kind, its own marker and the four hooks', () => {
    expect(puzzle.kind).toBe('puzzle');
    expect(puzzle.marker).toBe('puzzle');
    expect(puzzle.fixture).toBeTypeOf('function');
    expect(puzzle.interact).toBeTypeOf('function');
    expect(puzzle.drawFixture).toBeTypeOf('function');
    expect(puzzle.drawMarker).toBeTypeOf('function');
  });

  it('floats the entry notice while the room is unsolved', () => {
    expect(puzzle.fixture?.(harness().host)).toEqual({
      notice: { text: t('notice.puzzleRoom'), holdMs: NOTICE_HOLD_MS },
    });
  });

  it('places one visible ground item once the solve mark is in the run', () => {
    const roomId = 2;
    const { host, layout } = harness({ roomId, run: solvedRun(roomId) });
    const row = PUZZLES.find((candidate) => candidate.id === layout.rowId)!;
    expect(puzzle.fixture?.(host)).toEqual({
      items: [
        {
          id: puzzleRewardId(MAP_INDEX, roomId),
          position: layout.reward,
          itemId: row.reward,
          hidden: false,
        },
      ],
    });
  });

  it('places nothing once the reward was taken', () => {
    const roomId = 4;
    const taken = markItemPicked(solvedRun(roomId), puzzleRewardId(MAP_INDEX, roomId));
    expect(puzzle.fixture?.(harness({ roomId, run: taken }).host)).toEqual({});
  });

  it('answers no press once the room is marked, so the key reaches the loot', () => {
    const roomId = 5;
    const { host, layout } = harness({ roomId, run: solvedRun(roomId) });
    for (const tile of layout.switches) {
      expect(puzzle.interact?.(host, tile), `${tile.x},${tile.y}`).toBe(false);
    }
    expect(puzzle.interact?.(host, layout.reward)).toBe(false);
  });

  it('falls through the key off the switches', () => {
    const { host } = harness({ roomId: 6 });
    expect(puzzle.interact?.(host, ENTRY)).toBe(false);
  });

  it('advances on a correct press and turns that switch gold', () => {
    const { host, discs, layout } = harness({ roomId: 7 });
    puzzle.drawFixture?.(host);
    expect(discs).toHaveLength(layout.switches.length);
    const first = layout.switches[layout.order[0]];
    expect(puzzle.interact?.(host, first)).toBe(true);
    const disc = discs[layout.order[0]];
    expect(disc.fills.at(-1)).toEqual([PRESSED, 1]);
  });

  it('resets a broken sequence and says so, only once the press breaks it', () => {
    const roomId = 8;
    const { host, discs, layout, notices } = harness({ roomId });
    puzzle.drawFixture?.(host);
    const [first, , third] = layout.order;
    expect(third).toBeDefined();
    expect(puzzle.interact?.(host, layout.switches[first])).toBe(true);
    expect(notices).toEqual([]);
    expect(puzzle.interact?.(host, layout.switches[third])).toBe(true);
    expect(notices).toEqual([t('notice.puzzleReset')]);
    // The discs of the broken sequence are back to their resting colour.
    for (const slot of layout.order) {
      expect(discs[slot].fills.at(-1) ?? [RESTING, 1]).toEqual([RESTING, 1]);
    }
    expect(puzzleResetNotice().text).toBe(t('notice.puzzleReset'));
  });
});

describe('the puzzle room’s solve', () => {
  it('writes the floor mark, rebuilds the room and floats the solved line', () => {
    const roomId = 9;
    const { host, layout, commits, events, notices } = harness({ roomId });
    puzzle.drawFixture?.(host);
    for (const slot of layout.order) {
      expect(puzzle.interact?.(host, layout.switches[slot]), `slot ${slot}`).toBe(true);
    }
    expect(commits).toHaveLength(1);
    expect(commits[0].pickedItems).toContain(puzzleId(MAP_INDEX, roomId));
    expect(events).toEqual(['commit', 'rebuild', 'notice']);
    expect(notices).toEqual([t('notice.puzzleSolved')]);
    expect(puzzleSolvedNotice().text).toBe(t('notice.puzzleSolved'));
    // And a later revisit finds the room solved and the loot on its tile.
    expect(host.run.pickedItems).toContain(puzzleId(MAP_INDEX, roomId));
  });
});

describe('the puzzle room’s drawing', () => {
  it('draws one disc per switch, centred, resting and under the actors', () => {
    const { host, discs, layout } = harness({ roomId: 10 });
    puzzle.drawFixture?.(host);
    expect(discs).toHaveLength(layout.switches.length);
    layout.switches.forEach((tile, slot) => {
      const disc = discs[slot];
      expect(disc.x).toBe(tile.x * TILE_SIZE + TILE_SIZE / 2);
      expect(disc.y).toBe(tile.y * TILE_SIZE + TILE_SIZE / 2);
      expect(disc.radius).toBe(SWITCH_RADIUS);
      expect(disc.fill).toBe(RESTING);
      expect(disc.depth).toBe(FIXTURE_DEPTH);
      expect(disc.stroke).toEqual([2, RING]);
    });
  });

  it('draws nothing on a solved room', () => {
    const roomId = 11;
    const { host, discs } = harness({ roomId, run: solvedRun(roomId) });
    puzzle.drawFixture?.(host);
    expect(discs).toHaveLength(0);
  });

  it('draws nothing while the dev generator owns the screen', () => {
    const { host, discs } = harness({ roomId: 12, generatorActive: true });
    puzzle.drawFixture?.(host);
    expect(discs).toHaveLength(0);
  });
});

describe('the puzzle room marker', () => {
  it('paints the blue disc and the three dark bars in the frozen order', () => {
    const { graphics, calls } = recordingGraphics();
    puzzle.drawMarker?.(graphics, 10, 20, 5);
    expect(calls.map((call) => call.name)).toEqual([
      'fillStyle',
      'fillCircle',
      'fillStyle',
      'fillRect',
      'fillRect',
      'fillRect',
    ]);
    expect(calls[0].args).toEqual([0x38bdf8, 1]);
    expect(calls[1].args).toEqual([10, 20, 5 * 0.8]);
    expect(calls[2].args).toEqual([0x10161f, 1]);
    expect(calls[3].args).toEqual([10 - 5 * 0.55, 20 - 5 * 0.45, 5 * 1.1, 5 * 0.22]);
    expect(calls[4].args).toEqual([10 - 5 * 0.55, 20 - 5 * 0.11, 5 * 1.1, 5 * 0.22]);
    expect(calls[5].args).toEqual([10 - 5 * 0.55, 20 + 5 * 0.23, 5 * 1.1, 5 * 0.22]);
  });
});

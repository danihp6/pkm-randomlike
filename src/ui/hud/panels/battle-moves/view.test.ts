import { describe, expect, it } from 'vitest';
import { t } from '../../../../i18n';
import {
  moveGridCellRects,
  padMoveGridCells,
  type MoveGridCell,
  type MoveGridSlot,
} from '../../../moveGrid';
import {
  BATTLE_COMPACT,
  BATTLE_STAGE_MAX,
  MOVE_BACK_COL,
  MOVE_GMAX_COL,
  MOVE_GRID_INSET,
  MOVE_INFO_SIZE,
  MOVE_MEGA_COL,
  battleMovesBox,
  battleMovesView,
  infoLineCount,
  type BattleMovesInput,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };

function moveCell(name: string, overrides: Partial<MoveGridCell> = {}): MoveGridCell {
  return {
    name,
    type: 'fire',
    category: 'Special',
    pp: 15,
    maxPp: 15,
    desc: 'A SHORT LINE.',
    power: 40,
    basePower: 40,
    accuracy: 100,
    baseAccuracy: 100,
    status: null,
    enabled: true,
    ...overrides,
  };
}

const FOUR: readonly MoveGridSlot[] = padMoveGridCells(
  [
    moveCell('FLAMETHROWER'),
    moveCell('AIR SLASH', { type: 'flying', accuracy: 95, baseAccuracy: 95 }),
    moveCell('DRAGON CLAW', { category: 'Physical' }),
    moveCell('EARTHQUAKE', { type: 'ground' }),
  ],
  4,
);

type Overrides = Readonly<{
  open?: boolean;
  card?: Rect;
  cells?: readonly MoveGridSlot[];
  selected?: number;
  info?: number | null;
  mega?: boolean;
  gmax?: boolean;
  megaArmed?: boolean;
  gmaxArmed?: boolean;
}>;

function inputOf(overrides: Overrides = {}): BattleMovesInput {
  return {
    open: overrides.open ?? true,
    card: overrides.card ?? CARD,
    cells: overrides.cells ?? FOUR,
    selected: overrides.selected ?? 0,
    info: overrides.info === undefined ? null : overrides.info,
    mega: overrides.mega ?? false,
    gmax: overrides.gmax ?? false,
    megaArmed: overrides.megaArmed ?? false,
    gmaxArmed: overrides.gmaxArmed ?? false,
  };
}

describe('the mirrored constants', () => {
  it('are the canvas layout s own numbers', () => {
    expect(MOVE_GRID_INSET).toBe(8);
    expect(MOVE_BACK_COL).toBe(64);
    expect(MOVE_MEGA_COL).toBe(62);
    expect(MOVE_GMAX_COL).toBe(62);
    expect(MOVE_INFO_SIZE).toBe(22);
    expect(BATTLE_STAGE_MAX).toBe(900);
    expect(BATTLE_COMPACT).toBe(700);
  });
});

describe('battleMovesBox', () => {
  it('derives the desktop card at 1280×800', () => {
    expect(battleMovesBox(DESKTOP)).toStrictEqual({ x: 276, y: 582, w: 728, h: 192 });
  });

  it('derives the phone card at 390×844', () => {
    expect(battleMovesBox(PHONE)).toStrictEqual({ x: 16, y: 592, w: 358, h: 236 });
  });

  it('switches at the compact breakpoint and centres a wide stage', () => {
    expect(battleMovesBox({ width: 700, height: 800 }).w).toBe(700 - 72);
    expect(battleMovesBox({ width: 699, height: 800 }).w).toBe(699 - 32);
    const square = battleMovesBox({ width: 1200, height: 900 });
    expect(square.w).toBe(BATTLE_STAGE_MAX - 72);
    expect(square.x).toBe(150 + 36);
  });
});

describe('battleMovesView geometry', () => {
  it('takes the four slot rects from moveGridCellRects with the same reserves', () => {
    const view = battleMovesView(inputOf({ mega: true, gmax: false }));
    const options = {
      x: CARD.x,
      y: CARD.y,
      w: CARD.w,
      h: CARD.h,
      cells: FOUR,
      selected: 0,
      info: null,
      leftReserve: 64,
      rightReserve: 62,
    };
    expect(view.slots.map((slot) => slot.box)).toStrictEqual(moveGridCellRects(options));
    expect(view.slots[0]!.box).toStrictEqual({ x: 360, y: 606, w: 273, h: 72 });
  });

  it('uses no right reserve when neither forme column is available', () => {
    const view = battleMovesView(inputOf());
    const options = {
      x: CARD.x,
      y: CARD.y,
      w: CARD.w,
      h: CARD.h,
      cells: FOUR,
      selected: 0,
      info: null,
      leftReserve: 64,
      rightReserve: 0,
    };
    expect(view.slots.map((slot) => slot.box)).toStrictEqual(moveGridCellRects(options));
    expect(view.slots[0]!.box).toStrictEqual({ x: 360, y: 606, w: 304, h: 72 });
  });

  it('puts the ⓘ 36 px inside the cell s right edge, 8 from its top', () => {
    const view = battleMovesView(inputOf({ mega: true }));
    const slot = view.slots[0]!;
    expect(slot.info).toStrictEqual({
      x: slot.box.w - 36 + slot.box.x,
      y: slot.box.y + 8,
      w: 22,
      h: 22,
    });
    expect(slot.info!.x).toBe(360 + 273 - 36);
  });

  it('centres the ◀ on the card s left padding', () => {
    const view = battleMovesView(inputOf());
    expect(view.back).toStrictEqual({ label: '\u25c0', box: { x: 296, y: 660, w: 64, h: 36 } });
  });

  it('draws the MEGA column off the grid s reserved edge, and G-MAX inside it', () => {
    const megaOnly = battleMovesView(inputOf({ mega: true }));
    expect(megaOnly.mega).not.toBeNull();
    expect(megaOnly.mega!.box.w).toBe(62);
    expect(megaOnly.mega!.box.x).toBe(852);
    expect(megaOnly.mega!.box.y).toBe(606);
    expect(megaOnly.mega!.box.h).toBe(758 - 606);
    expect(megaOnly.gmax).toBeNull();

    const both = battleMovesView(inputOf({ mega: true, gmax: true }));
    expect(both.mega!.box.x).toBe(852 - 62);
    expect(both.gmax!.box.x).toBe(852 - 62 - 62);
    expect(both.gmax!.box.w).toBe(62);

    const gmaxOnly = battleMovesView(inputOf({ gmax: true }));
    expect(gmaxOnly.mega).toBeNull();
    expect(gmaxOnly.gmax!.box.x).toBe(852);
  });

  it('labels the forme columns with the armed string when armed', () => {
    expect(battleMovesView(inputOf({ mega: true })).mega!.label).toBe(t('battle.mega'));
    const armed = battleMovesView(inputOf({ mega: true, megaArmed: true }));
    expect(armed.mega!.label).toBe(t('battle.megaIntent'));
    expect(armed.mega!.armed).toBe(true);
    const gmax = battleMovesView(inputOf({ gmax: true, gmaxArmed: true }));
    expect(gmax.gmax!.label).toBe(t('battle.gmaxIntent'));
    expect(gmax.gmax!.armed).toBe(true);
  });
});

describe('battleMovesView slots', () => {
  it('reads each move s own lines', () => {
    const view = battleMovesView(inputOf({ mega: true }));
    const airSlash = view.slots[1]!;
    expect(airSlash.name).toBe('AIR SLASH');
    expect(airSlash.type).toBe('flying');
    expect(airSlash.category).toBe('Special');
    expect(airSlash.pp).toBe(t('move.pp', { pp: 15, max: 15 }));
    expect(airSlash.power).toBe(t('move.pwr', { value: 40 }));
    expect(airSlash.accuracy).toBe(t('move.acc', { value: 95 }));
    expect(airSlash.empty).toBe(false);
    expect(airSlash.enabled).toBe(true);
  });

  it('marks the selected slot and only it', () => {
    const view = battleMovesView(inputOf({ selected: 2 }));
    expect(view.slots.map((slot) => slot.selected)).toStrictEqual([false, false, true, false]);
  });

  it('paints an empty slot with no name, no stats and no ⓘ', () => {
    const cells = padMoveGridCells([moveCell('TACKLE')], 4);
    const view = battleMovesView(inputOf({ cells, info: 1 }));
    const empty = view.slots[1]!;
    expect(empty).toStrictEqual({
      index: 1,
      empty: true,
      name: '',
      type: '',
      category: '',
      pp: '',
      power: '',
      accuracy: '',
      powerTone: 'level',
      accuracyTone: 'level',
      enabled: false,
      selected: false,
      box: view.slots[1]!.box,
      info: null,
    });
    expect(view.slots[3]!.info).toBeNull();
    expect(view.info).toBeNull();
  });

  it('shows the dash lines for a status move that never misses', () => {
    const cells = padMoveGridCells(
      [moveCell('GROWL', { power: 0, basePower: 0, accuracy: null, baseAccuracy: null })],
      4,
    );
    const slot = battleMovesView(inputOf({ cells })).slots[0]!;
    expect(slot.power).toBe(t('move.pwrNone'));
    expect(slot.accuracy).toBe(t('move.accNone'));
    expect(slot.powerTone).toBe('level');
    expect(slot.accuracyTone).toBe('level');
  });

  it('tones each stat line against its own base', () => {
    const cells = padMoveGridCells(
      [
        moveCell('UP', { power: 120, basePower: 90, accuracy: 100, baseAccuracy: 95 }),
        moveCell('DOWN', { power: 60, basePower: 90, accuracy: 90, baseAccuracy: 100 }),
        moveCell('LEVEL', { power: 90, basePower: 90, accuracy: 100, baseAccuracy: 100 }),
        moveCell('HALF', { power: 90, basePower: 90, accuracy: null, baseAccuracy: 100 }),
      ],
      4,
    );
    const view = battleMovesView(inputOf({ cells }));
    expect(view.slots.map((slot) => slot.powerTone)).toStrictEqual(['up', 'down', 'level', 'level']);
    expect(view.slots.map((slot) => slot.accuracyTone)).toStrictEqual(['up', 'down', 'level', 'level']);
  });

  it('draws the raised and lowered hit chance with the canvas s arrow', () => {
    const cells = padMoveGridCells(
      [
        moveCell('UP', { accuracy: 133, baseAccuracy: 100 }),
        moveCell('DOWN', { accuracy: 50, baseAccuracy: 100 }),
      ],
      4,
    );
    const view = battleMovesView(inputOf({ cells }));
    expect(view.slots[0]!.accuracy).toBe(t('move.acc', { value: '133 \u2191' }));
    expect(view.slots[1]!.accuracy).toBe(t('move.acc', { value: '50 \u2193' }));
  });
});

describe('battleMovesView purity', () => {
  it('clamps selected and info into the four slots', () => {
    const high = battleMovesView(inputOf({ selected: 9, info: 7 }));
    expect(high.slots[3]!.selected).toBe(true);
    expect(high.info!.title).toBe('EARTHQUAKE');
    const low = battleMovesView(inputOf({ selected: -4, info: -2 }));
    expect(low.slots[0]!.selected).toBe(true);
    expect(low.info!.title).toBe('FLAMETHROWER');
    const absurd = battleMovesView(inputOf({ selected: Number.NaN, info: Number.NaN }));
    expect(absurd.slots[0]!.selected).toBe(true);
    expect(absurd.info!.title).toBe('FLAMETHROWER');
  });

  it('returns deep-equal output for the same input, and mutates nothing', () => {
    const input = inputOf({ mega: true, info: 0 });
    const snapshot = JSON.stringify(input);
    const first = battleMovesView(input);
    const second = battleMovesView(input);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('passes the card and the open flag through untouched', () => {
    const closed = battleMovesView(inputOf({ open: false }));
    expect(closed.open).toBe(false);
    expect(closed.card).toStrictEqual(CARD);
  });
});

describe('the description card', () => {
  it('counts 44 characters a line, per paragraph', () => {
    expect(infoLineCount('')).toBe(0);
    expect(infoLineCount('HELLO')).toBe(1);
    expect(infoLineCount('x'.repeat(44))).toBe(1);
    expect(infoLineCount('x'.repeat(45))).toBe(2);
    expect(infoLineCount(`${'x'.repeat(44)}\n${'x'.repeat(45)}`)).toBe(3);
  });

  it('is 48 + 13 a line tall, 20 px in from the card s sides', () => {
    const short = battleMovesView(inputOf({ info: 0 }));
    expect(short.info!.box).toStrictEqual({ x: 296, y: 686, w: 688, h: 61 });
    const long = battleMovesView(
      inputOf({ cells: padMoveGridCells([moveCell('LONG', { desc: 'x'.repeat(45) })], 4), info: 0 }),
    );
    expect(long.info!.box.h).toBe(48 + 13 * 2);
  });

  it('floats above the cell when there is room, and below it otherwise', () => {
    const threeLines = `${'x'.repeat(44)}\n${'x'.repeat(45)}`;
    const cells = padMoveGridCells(
      [moveCell('ONE'), moveCell('TWO'), moveCell('LOWER', { desc: threeLines }), moveCell('FOUR')],
      4,
    );
    const above = battleMovesView(inputOf({ cells, info: 2 }));
    const slot = above.slots[2]!.box;
    expect(above.info!.box.y).toBe(slot.y - 8 - (48 + 13 * 3));
    expect(above.info!.box.y).toBeGreaterThanOrEqual(CARD.y);

    const below = battleMovesView(inputOf({ info: 0 }));
    const top = below.slots[0]!.box;
    expect(below.info!.box.y).toBe(top.y + top.h + 8);
  });

  it('is null when nothing is pinned', () => {
    expect(battleMovesView(inputOf()).info).toBeNull();
  });
});

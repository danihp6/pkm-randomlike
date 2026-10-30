import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { en, es, t, translationParams } from '../../../../i18n';
import {
  moveGridCellRects,
  padMoveGridCells,
  type MoveGridCell,
  type MoveGridSlot,
} from '../../../moveGrid';
import { FRLG_WINDOW_PADDING } from '../../../frlg';
import { MOVE_ICON_BOX } from '../../kit/moveIcons';
import { STAGE_CHIP, STAGE_CLEARANCE, STAGE_COLS, STAGE_GAP, battleHpBox } from '../battle-hp/view';
import {
  BATTLE_COMPACT,
  BATTLE_STAGE_MAX,
  CATEGORY_LABELS,
  COMPACT_CARD_CLEARANCE,
  COMPACT_CARD_RAIL_W,
  INFO_CARD_H,
  MOVE_BACK_COL,
  MOVE_CATEGORY_GAP,
  MOVE_GMAX_COL,
  MOVE_GRID_INSET,
  MOVE_INFO_SIZE,
  MOVE_MEGA_COL,
  MOVE_TARGET_H,
  MOVE_TARGET_TOP,
  battleMovesBox,
  battleMovesView,
  cellTextBoxes,
  compactCard,
  drawnTextWidth,
  elideToWidth,
  fitsInside,
  infoLineCount,
  type BattleMoveSlotView,
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
    moveCell('DRAGON CLAW', { category: 'Physical', type: 'dragon' }),
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
  target?: string | null;
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
    target: overrides.target === undefined ? null : overrides.target,
  };
}

describe('the mirrored constants', () => {
  it('are the canvas layout s own numbers', () => {
    expect(MOVE_GRID_INSET).toBe(8);
    expect(MOVE_BACK_COL).toBe(64);
    expect(MOVE_MEGA_COL).toBe(62);
    expect(MOVE_GMAX_COL).toBe(62);
    expect(MOVE_INFO_SIZE).toBe(22);
    expect(MOVE_CATEGORY_GAP).toBe(8);
    expect(BATTLE_STAGE_MAX).toBe(900);
    expect(BATTLE_COMPACT).toBe(700);
  });
});

/** One `--hud-*` size the stylesheet declares, in px. */
function cssSize(css: string, name: string): number {
  const match = new RegExp(`${name}\\s*:\\s*(-?[\\d.]+)px`).exec(css);
  expect(match, name).not.toBeNull();
  return Number(match![1]);
}

const ROOT_CSS = readFileSync(fileURLToPath(new URL('../../styles/root.css', import.meta.url)), 'utf8');
/** The cell's own side padding, from `.battle-moves__slot`'s `padding: 8px 14px`. */
const CELL_PAD_X = 14;

describe('drawnTextWidth', () => {
  it('measures the panel s own font, past the retired per-glyph constant', () => {
    expect(drawnTextWidth('')).toBe(0);
    expect(drawnTextWidth('PHYSICAL')).toBeGreaterThan(8 * 6);
    expect(drawnTextWidth('PHYSICAL')).toBe(60);
    expect(drawnTextWidth('STATUS')).toBeLessThan(drawnTextWidth('PHYSICAL'));
  });

  it('scales with the size it is asked for', () => {
    expect(drawnTextWidth('PHYSICAL', 20)).toBeCloseTo(drawnTextWidth('PHYSICAL', 10) * 2, 10);
    expect(drawnTextWidth('PHYSICAL', 10)).toBe(drawnTextWidth('PHYSICAL'));
  });

  it('draws at the body size the stylesheet declares', () => {
    const body = cssSize(ROOT_CSS, '--hud-type-body-size');
    expect(body).toBe(10);
    expect(drawnTextWidth('PHYSICAL')).toBe(drawnTextWidth('PHYSICAL', body));
  });

  it('charges the name for nothing but its own line', () => {
    const slot = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) })).slots[0]!;
    expect(slot.nameBox.x).toBe(slot.box.x + CELL_PAD_X);
    expect(slot.nameBox.y).toBe(slot.categoryBox.y);
    expect(slot.nameBox.w).toBe(162);
    // The badge's 24 px square never enters the name's column, for any type.
    const shortType = battleMovesView(
      inputOf({
        card: battleMovesBox(DESKTOP),
        cells: padMoveGridCells([moveCell('X', { type: 'ice' })], 4),
      }),
    ).slots[0]!;
    const longType = battleMovesView(
      inputOf({
        card: battleMovesBox(DESKTOP),
        cells: padMoveGridCells([moveCell('X', { type: 'electric' })], 4),
      }),
    ).slots[0]!;
    expect(longType.nameBox.w).toBe(shortType.nameBox.w);
  });
});

describe('elideToWidth', () => {
  const LONG = 'MOFLETE ESTÁTICO';

  it('leaves a string that already fits untouched', () => {
    expect(elideToWidth('TACKLE', 100)).toBe('TACKLE');
    expect(elideToWidth('TACKLE', drawnTextWidth('TACKLE'))).toBe('TACKLE');
    expect(elideToWidth('', 10)).toBe('');
  });

  it('cuts to the widest prefix that still fits with its own ellipsis', () => {
    expect(drawnTextWidth(LONG)).toBeGreaterThan(68);
    const cut = elideToWidth(LONG, 68);
    expect(cut).toBe('MOFLETE \u2026');
    expect(LONG.startsWith(cut.slice(0, -1))).toBe(true);
    expect(drawnTextWidth(cut)).toBeLessThanOrEqual(68 + 0.01);
    expect(drawnTextWidth('MOFLETE E\u2026')).toBeGreaterThan(68);
  });

  it('never returns a string wider than its box, and never leaves room for one more glyph', () => {
    for (const width of [20, 30, 45, 52, 60, 68, 90, 117]) {
      const cut = elideToWidth(LONG, width);
      expect(cut.length).toBeGreaterThan(0);
      expect(cut.endsWith('\u2026')).toBe(true);
      expect(drawnTextWidth(cut)).toBeLessThanOrEqual(width + 0.01);
      const head = cut.slice(0, -1);
      const next = LONG[head.length] ?? '';
      if (next !== '') expect(drawnTextWidth(`${head}${next}\u2026`)).toBeGreaterThan(width);
    }
  });

  it('is total: nothing fits a zero, a negative or a hairline box', () => {
    expect(elideToWidth('X', 0)).toBe('');
    expect(elideToWidth('X', -20)).toBe('');
    expect(elideToWidth('AB', 8)).toBe('');
  });
});

describe('battleMovesBox', () => {
  it('derives the desktop card at 1280×800, clear of the foe HP column', () => {
    expect(battleMovesBox(DESKTOP)).toStrictEqual({ x: 440, y: 582, w: 564, h: 192 });
    expect(battleMovesBox(DESKTOP).x + battleMovesBox(DESKTOP).w).toBe(1004);
  });

  it('never intersects the foe s lead box, which now holds the whole HP column', () => {
    const card = battleMovesBox(DESKTOP);
    const enemy = battleHpBox(DESKTOP, 'enemy', 0);
    const overlapX = Math.max(
      0,
      Math.min(card.x + card.w, enemy.x + enemy.w) - Math.max(card.x, enemy.x),
    );
    const overlapY = Math.max(
      0,
      Math.min(card.y + card.h, enemy.y + enemy.h) - Math.max(card.y, enemy.y),
    );
    expect(overlapX * overlapY).toBe(0);
    expect(card.x).toBe(enemy.x + enemy.w + 8);
  });

  it('starts at or right of the HP column at every wide viewport it sweeps', () => {
    for (const viewport of [
      { width: 700, height: 700 },
      { width: 800, height: 800 },
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
      { width: 1600, height: 900 },
    ]) {
      const card = battleMovesBox(viewport);
      const enemy = battleHpBox(viewport, 'enemy', 0);
      expect(card.x).toBeGreaterThanOrEqual(enemy.x + enemy.w + 8);
      expect(card.w).toBeGreaterThanOrEqual(240);
    }
  });

  it('sits below the player HP box at every phone viewport it sweeps', () => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 480, height: 800 },
    ]) {
      expect(battleMovesBox(viewport).y).toBeGreaterThanOrEqual(
        battleHpBox(viewport, 'player', 0).y + battleHpBox(viewport, 'player', 0).h,
      );
    }
  });

  it('derives the phone card at 390×844', () => {
    expect(battleMovesBox(PHONE)).toStrictEqual({ x: 16, y: 592, w: 358, h: 236 });
  });

  it('keeps the phone card inside the phone s own window', () => {
    const card = battleMovesBox(PHONE);
    expect(fitsInside(card, { x: 0, y: 0, w: PHONE.width, h: PHONE.height })).toBe(true);
    expect(card.y + card.h).toBeLessThan(PHONE.height);
  });

  it('keeps the shipped phone card in a wide viewport with a short stage', () => {
    // 800×600 centres a 600 px battle square the HP column runs past, and the compact
    // card is anchored to that square: it keeps its shipped rect rather than chasing
    // the viewport-wide boxes, so only a phone-shaped viewport clears both of them
    // (the 600–699 px residue, rule 6 of this folder's README).
    expect(battleMovesBox({ width: 800, height: 600 })).toStrictEqual({
      x: 116,
      y: 348,
      w: 568,
      h: 236,
    });
  });

  it('switches at the compact breakpoint and centres a wide stage', () => {
    const wide = battleMovesBox({ width: 700, height: 800 });
    expect(wide.w).toBe(240);
    expect(wide.x).toBe(440);
    const phone = battleMovesBox({ width: 699, height: 800 });
    expect(phone).toStrictEqual({ x: 16, y: 548, w: 699 - 32, h: 236 });
    const square = battleMovesBox({ width: 1200, height: 900 });
    expect(square.w).toBe(574);
    expect(square.x).toBe(440);
    expect(square.x + square.w).toBe(150 + BATTLE_STAGE_MAX - 36);
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

  it('keeps every label of the four cells in the cell s own boxes', () => {
    const view = battleMovesView(inputOf({ mega: true }));
    expect(view.slots[0]!.box).toStrictEqual({ x: 360, y: 606, w: 273, h: 72 });
    for (const slot of view.slots) expect(slot.empty).toBe(false);
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

  it('paints an empty slot with no name and no stats', () => {
    const cells = padMoveGridCells([moveCell('TACKLE')], 4);
    const view = battleMovesView(inputOf({ cells, selected: 1 }));
    const empty = view.slots[1]!;
    expect(empty).toStrictEqual({
      index: 1,
      empty: true,
      name: '',
      type: '',
      category: '',
      categoryLabel: '',
      pp: '',
      power: '',
      accuracy: '',
      powerTone: 'level',
      accuracyTone: 'level',
      enabled: false,
      selected: true,
      box: view.slots[1]!.box,
      nameBox: view.slots[1]!.nameBox,
      categoryBox: view.slots[1]!.categoryBox,
      boxes: view.slots[1]!.boxes,
      typeBox: view.slots[1]!.typeBox,
    });
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

describe('the category glyph s box', () => {
  it('ends on the cell s own right padding edge, inside its cell at both shipped cards', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleMovesView(inputOf({ card: battleMovesBox(viewport) }));
      for (const slot of view.slots) {
        expect(slot.categoryBox.x + slot.categoryBox.w).toBe(slot.box.x + slot.box.w - CELL_PAD_X);
        expect(slot.categoryBox.x).toBeGreaterThanOrEqual(slot.box.x);
        expect(slot.categoryBox.y).toBeGreaterThanOrEqual(slot.box.y);
        expect(slot.categoryBox.y + slot.categoryBox.h).toBeLessThanOrEqual(slot.box.y + slot.box.h);
      }
    }
  });

  it('is the board s 24 px square on the wide cell, ending on the padding edge', () => {
    const slot = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) })).slots[0]!;
    expect(slot.categoryBox.w).toBe(24);
    expect(slot.categoryBox.h).toBe(24);
    expect(slot.categoryBox.x).toBe(slot.box.x + slot.box.w - CELL_PAD_X - 24);
  });

  it('is one 13 px line on the compact cell, at the same right edge', () => {
    const slot = battleMovesView(inputOf({ card: battleMovesBox(PHONE) })).slots[0]!;
    expect(slot.categoryBox).toStrictEqual({ x: 181, y: 637, w: 24, h: 13 });
    expect(slot.categoryBox.x + slot.categoryBox.w).toBe(slot.box.x + slot.box.w - CELL_PAD_X);
  });

  it('gives an empty slot a zero-width mark at the cell s right pad', () => {
    const cells = padMoveGridCells([moveCell('TACKLE')], 4);
    const empty = battleMovesView(inputOf({ cells })).slots[1]!;
    expect(empty.categoryBox.w).toBe(0);
    expect(empty.categoryBox.x).toBe(empty.box.x + empty.box.w - 14);
    expect(empty.typeBox.w).toBe(0);
  });
});

describe('the freed column', () => {
  it('gives the ⓘ s 22 px and its gap back to the move s name', () => {
    const wide = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) }));
    for (const slot of wide.slots) {
      expect(slot.nameBox.w).toBe(slot.box.w - 60);
      expect(slot.nameBox.x + slot.nameBox.w).toBeLessThanOrEqual(slot.categoryBox.x);
    }
    // The phone cell already gave the name its whole content box: its six lines are
    // untouched, and the glyph moved out of the ⓘ column to that same edge.
    const phone = battleMovesView(inputOf({ card: battleMovesBox(PHONE) }));
    for (const slot of phone.slots) {
      expect(slot.boxes.name.w).toBe(slot.box.w - 28);
      expect(overlapArea(slot.boxes.name, slot.categoryBox)).toBe(0);
    }
  });

  it('is the 30 px the wide cell used to reserve for the button and its gap', () => {
    const slot = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) })).slots[0]!;
    expect(slot.box.w - 60).toBe(162);
    expect(slot.categoryBox.w + 8 + 14 + 14).toBe(60);
    expect(MOVE_INFO_SIZE).toBe(22);
    expect('info' in slot).toBe(false);
  });
});

/** The four invariants of a filled cell, measured on the strings the model paints. */
function expectCellFits(slot: BattleMoveSlotView, compact = false): void {
  expect(drawnTextWidth(slot.name)).toBeLessThanOrEqual(slot.nameBox.w + 0.01);
  expect(slot.nameBox.x).toBeGreaterThanOrEqual(slot.box.x + CELL_PAD_X);
  // The glyph ends on the cell's own right padding edge: no column is reserved for a
  // button, so the freed 30 px are the name's.
  expect(slot.categoryBox.x + slot.categoryBox.w).toBe(slot.box.x + slot.box.w - CELL_PAD_X);
  // The wide cell gives the name the line beside the glyph, one gap short of it; the
  // compact cell rows the two, so their area is what has to be empty there.
  if (compact) expect(overlapArea(slot.boxes.name, slot.categoryBox)).toBe(0);
  else expect(slot.nameBox.x + slot.nameBox.w).toBeLessThanOrEqual(slot.categoryBox.x);
  // The two atlas squares: inside the cell, the same 24 px wide for every move, and
  // clear of each other — the wide cell stacks them in the gutter, the compact one
  // rows them across two lines.
  for (const box of [slot.typeBox, slot.categoryBox]) {
    expect(fitsInside(box, slot.box)).toBe(true);
    expect(box.w).toBe(24);
  }
  expect(slot.categoryBox.h).toBe(compact ? 13 : 24);
  expect(slot.typeBox.h).toBe(24);
  expect(overlapArea(slot.typeBox, slot.categoryBox)).toBe(0);
}

const LONG_GRID: readonly MoveGridSlot[] = padMoveGridCells(
  [
    moveCell('MOFLETE ESTÁTICO', { category: 'Physical' }),
    moveCell('LANZALLAMAS', { type: 'flying' }),
    moveCell('TERREMOTO', { type: 'ground', category: 'Status' }),
    moveCell('PSÍQUICO'),
  ],
  4,
);

describe('a move cell s own text', () => {
  it('takes the cell s remaining width, and keeps every shipped name whole at 1280×800', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: LONG_GRID }));
    expect(view.slots).toHaveLength(4);
    // 222 px cell: 2×14 padding, the 24 px category glyph and its 8 px gap.
    for (const slot of view.slots) expect(slot.nameBox.w).toBe(222 - 28 - 24 - 8);
    for (const slot of view.slots) {
      expect(slot.empty).toBe(false);
      expect(slot.nameBox.w).toBe(162);
      expectCellFits(slot);
    }
    expect(view.slots.map((slot) => slot.name)).toStrictEqual([
      'MOFLETE ESTÁTICO',
      'LANZALLAMAS',
      'TERREMOTO',
      'PSÍQUICO',
    ]);
    expect(view.info!.title).toBe('MOFLETE ESTÁTICO');
  });

  it('cuts a name longer than its own line, and only that one', () => {
    // The freed column made the old 132 px overflow fit: `MOFLETE ESTÁTICO PLUS` is
    // 152.5 px, so it now keeps its whole string, and the longer one below is cut.
    const fits = padMoveGridCells([moveCell('MOFLETE ESTÁTICO PLUS')], 4);
    const whole = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: fits })).slots[0]!;
    expect(drawnTextWidth('MOFLETE ESTÁTICO PLUS')).toBeLessThan(162);
    expect(whole.name).toBe('MOFLETE ESTÁTICO PLUS');

    const cells = padMoveGridCells([moveCell('MOFLETE ESTÁTICO PLUS ONE')], 4);
    const slot = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells })).slots[0]!;
    expect(drawnTextWidth('MOFLETE ESTÁTICO PLUS ONE')).toBeGreaterThan(162);
    expect(slot.name.endsWith('\u2026')).toBe(true);
    expect(slot.name.length).toBeGreaterThan(9);
    expect('MOFLETE ESTÁTICO PLUS ONE'.startsWith(slot.name.slice(0, -1))).toBe(true);
    expect(drawnTextWidth(slot.name)).toBeLessThanOrEqual(162 + 0.01);
  });

  it('holds on the compact card and on the phone card', () => {
    for (const viewport of [{ width: 600, height: 600 }, PHONE]) {
      const card = battleMovesBox(viewport);
      expect(card.w).toBeLessThan(BATTLE_COMPACT);
      const view = battleMovesView(inputOf({ card, cells: LONG_GRID }));
      for (const slot of view.slots) expectCellFits(slot, true);
    }
  });

  it('stacks the phone card s labels in one column, one row each', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: LONG_GRID }));
    expect(view.compact).toBe(true);
    const first = view.slots[0]!;
    expect(first.box).toStrictEqual({ x: 100, y: 616, w: 119, h: 94 });
    expect(first.typeBox).toStrictEqual({ x: 114, y: 624, w: 24, h: 24 });
    expect(first.boxes.name).toStrictEqual({ x: 114, y: 650, w: 91, h: 13 });
    expect(first.boxes.category).toStrictEqual({ x: 181, y: 637, w: 24, h: 13 });
    expect(first.boxes.pp).toStrictEqual({ x: 114, y: 663, w: 91, h: 13 });
    expect(first.boxes.power).toStrictEqual({ x: 114, y: 676, w: 91, h: 13 });
    expect(first.boxes.accuracy).toStrictEqual({ x: 114, y: 689, w: 91, h: 13 });
    expect(first.name).toBe('MOFLETE EST\u2026');
    expect(view.slots.map((slot) => slot.name)).toStrictEqual([
      'MOFLETE EST\u2026',
      'LANZALLAMAS',
      'TERREMOTO',
      'PSÍQUICO',
    ]);
  });

  it('holds on a one-move party, whose three empty slots print nothing', () => {
    const cells = padMoveGridCells([moveCell('MOFLETE ESTÁTICO', { category: 'Physical' })], 4);
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells }));
    expectCellFits(view.slots[0]!);
    for (const slot of view.slots.slice(1)) {
      expect(slot.empty).toBe(true);
      expect(slot.name).toBe('');
      expect(slot.nameBox.w).toBe(0);
      expect(slot.nameBox.x).toBe(slot.box.x + slot.box.w - CELL_PAD_X);
    }
  });

  it('takes the name column from the cell it is in, and the glyph from the board s square', () => {
    const wide = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: LONG_GRID }));
    const phone = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: LONG_GRID }));
    expect(wide.slots[0]!.nameBox.w).toBe(162);
    expect(phone.slots[0]!.nameBox.w).toBe(91);
    expect(wide.slots[0]!.nameBox.y).toBe(wide.slots[0]!.categoryBox.y);
    // The glyph's box is the same 24 px square for every category: the frame is FIT
    // into it (32×14 becomes 24×10.5), so nothing can spill out of the box.
    for (const slot of wide.slots) {
      expect(slot.categoryBox.w).toBe(24);
      expect(slot.categoryBox.h).toBe(24);
    }
    expect(wide.slots.map((slot) => slot.category)).toStrictEqual([
      'Physical',
      'Special',
      'Status',
      'Special',
    ]);
  });

  it('paints the name in the case the slot paints it, and keeps the full one for the card', () => {
    const cells = padMoveGridCells([moveCell('Moflete Estático', { category: 'Physical' })], 4);
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells }));
    expect(view.slots[0]!.name).toBe('MOFLETE ESTÁTICO');
    expect(view.info!.title).toBe('Moflete Estático');
  });
});

/** The four cells of the phone battle: the longest shipped names and a status move. */
const COMPACT_GRID: readonly MoveGridSlot[] = padMoveGridCells(
  [
    moveCell('MOFLETE ESTÁTICO', { category: 'Physical' }),
    moveCell('LANZALLAMAS', { power: 90, basePower: 90 }),
    moveCell('GRITO', {
      power: 0,
      basePower: 0,
      category: 'Status',
      accuracy: null,
      baseAccuracy: null,
    }),
    moveCell('PSÍQUICO', { accuracy: 300, baseAccuracy: 100 }),
  ],
  4,
);

/** The area two rects share; touching edges share none. */
function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

/**
 * The stage grid's box for `chips` chips, the same arithmetic `battleHpStages` does:
 * three `STAGE_CHIP` columns `STAGE_GAP` apart, right-aligned to the player's column and
 * `STAGE_CLEARANCE` above it.
 */
function stageGridBox(column: Rect, chips: number): Rect {
  const cols = Math.min(STAGE_COLS, chips);
  const rows = Math.ceil(chips / STAGE_COLS);
  const w = cols * STAGE_CHIP + (cols - 1) * STAGE_GAP;
  const h = rows * STAGE_CHIP + (rows - 1) * STAGE_GAP;
  return { x: column.x + column.w - w, y: column.y - STAGE_CLEARANCE - h, w, h };
}

/** The four text labels of a cell, each with the string it paints. */
function labelsOf(slot: BattleMoveSlotView): readonly Readonly<{ box: Rect; text: string }>[] {
  return [
    { box: slot.boxes.name, text: slot.name },
    { box: slot.boxes.pp, text: slot.pp },
    { box: slot.boxes.power, text: slot.power },
    { box: slot.boxes.accuracy, text: slot.accuracy },
  ];
}

/**
 * Every label of a filled cell: inside the cell, wide enough for its own text, no
 * overlaps, and the two atlas squares clear of every one of them.
 */
function expectBoxesHold(slot: BattleMoveSlotView): void {
  const labels = labelsOf(slot);
  for (const label of labels) {
    expect(fitsInside(label.box, slot.box)).toBe(true);
    expect(drawnTextWidth(label.text)).toBeLessThanOrEqual(label.box.w + 0.01);
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      expect(overlapArea(labels[i]!.box, labels[j]!.box)).toBe(0);
    }
  }
  for (const icon of [slot.typeBox, slot.categoryBox]) {
    expect(fitsInside(icon, slot.box)).toBe(true);
    // The name is the one line a glyph sits beside in both width classes; the wider
    // stat boxes keep the cell's full remaining width, and their text ends well short
    // of the icon column (the glyph's square is over an empty end of the PP line).
    expect(overlapArea(icon, slot.boxes.name)).toBe(0);
  }
  expect(overlapArea(slot.typeBox, slot.categoryBox)).toBe(0);
  // The freed ⓘ column is the name's: the glyph ends on the cell's own right pad edge.
  const rightPad = slot.box.x + slot.box.w - CELL_PAD_X;
  expect(slot.boxes.category.x + slot.boxes.category.w).toBe(rightPad);
  expect(slot.boxes.category.x).toBeGreaterThanOrEqual(slot.box.x);
}

describe('the compact cell', () => {
  it('holds all four labels and both icons of the four phone cells inside their own cell', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: COMPACT_GRID }));
    expect(view.slots).toHaveLength(4);
    for (const slot of view.slots) {
      expect(slot.empty).toBe(false);
      expectBoxesHold(slot);
    }
    expect(view.slots[1]!.name).toBe('LANZALLAMAS');
    expect(view.slots[2]!.power).toBe(t('move.pwrNone'));
    expect(view.slots[2]!.accuracy).toBe(t('move.accNone'));
    expect(view.slots[3]!.accuracy).toBe(t('move.acc', { value: '300 \u2191' }));
    expect(drawnTextWidth(view.slots[3]!.accuracy)).toBeLessThanOrEqual(view.slots[3]!.boxes.accuracy.w);
    // The whole 91 px content box is the name's own: the longest shipped name keeps its head.
    expect(view.slots[0]!.name).toBe('MOFLETE EST\u2026');
    expect(view.slots[0]!.name.length).toBeGreaterThan(6);
  });

  it('keeps every slot and every label clear of both HP boxes at 390×844', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: COMPACT_GRID }));
    for (const side of ['player', 'enemy'] as const) {
      for (const slot of [0, 1] as const) {
        const hp = battleHpBox(PHONE, side, slot);
        for (const cell of view.slots) {
          expect(overlapArea(cell.box, hp)).toBe(0);
          for (const box of Object.values(cell.boxes)) expect(overlapArea(box, hp)).toBe(0);
        }
      }
    }
  });

  it('keeps the name a real column on the measured 119×94 phone cell, and no box over another', () => {
    const cell: Rect = { x: 100, y: 616, w: 119, h: 94 };
    const boxes = cellTextBoxes(cell, true);
    // 119 − 2 × 14 padding = 91 px of content, and the name has all of it.
    expect(boxes.name).toStrictEqual({ x: 114, y: 650, w: 91, h: 13 });
    expect(boxes.name.w).toBeGreaterThan(40);
    for (const box of Object.values(boxes)) {
      expect(fitsInside(box, cell)).toBe(true);
      expect(box.x).toBeGreaterThanOrEqual(cell.x + CELL_PAD_X);
      expect(box.x + box.w).toBeLessThanOrEqual(cell.x + cell.w - CELL_PAD_X + 0.01);
    }
    const five = [boxes.name, boxes.category, boxes.pp, boxes.power, boxes.accuracy];
    for (let i = 0; i < five.length; i++) {
      for (let j = i + 1; j < five.length; j++) {
        expect(overlapArea(five[i]!, five[j]!)).toBe(0);
      }
    }
    // Six 13 px rows, the glyph's one under the badge's, fill the 78 px box edge to edge.
    expect(five.map((box) => box.y)).toStrictEqual([650, 637, 663, 676, 689]);
    expect(boxes.accuracy.y + boxes.accuracy.h).toBe(cell.y + cell.h - 8);
  });

  it('keeps the type badge its own 24 px square on the cell s first row', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: COMPACT_GRID }));
    for (const slot of view.slots) {
      expect(slot.typeBox).toStrictEqual({
        x: slot.box.x + CELL_PAD_X,
        y: slot.box.y + 8,
        w: 24,
        h: 24,
      });
      expect(fitsInside(slot.typeBox, slot.box)).toBe(true);
      expect(overlapArea(slot.typeBox, slot.boxes.name)).toBe(0);
    }
  });

  it('paints a name whole while it fits and ends a cut one in an ellipsis, never both', () => {
    const fits = padMoveGridCells([moveCell('GRITO')], 4);
    const whole = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: fits })).slots[0]!;
    expect(drawnTextWidth('GRITO')).toBeLessThanOrEqual(whole.nameBox.w);
    expect(whole.name).toBe('GRITO');
    expect(whole.name).not.toContain('\u2026');

    const cut = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: LONG_GRID })).slots[0]!;
    expect(drawnTextWidth('MOFLETE ESTÁTICO')).toBeGreaterThan(cut.nameBox.w);
    expect(cut.name.endsWith('\u2026')).toBe(true);
    // A head the player can read, not just the wasted ellipsis, and never past the box.
    expect(cut.name.length).toBeGreaterThan(2);
    expect('MOFLETE ESTÁTICO'.startsWith(cut.name.slice(0, -1))).toBe(true);
    expect(drawnTextWidth(cut.name)).toBeLessThanOrEqual(cut.nameBox.w + 0.01);
  });

  it('holds on every compact card wide enough for its icon column', () => {
    // The glyph's 24 px column needs 52 px of cell (its 14 px side paddings twice and
    // the 24 px glyph), so a stage under 256 px is below what this panel draws:
    // 390×844, the board's phone, is the narrowest one it is asked for.
    for (const viewport of [
      { width: 699, height: 800 },
      { width: 600, height: 600 },
      { width: 800, height: 600 },
      { width: 480, height: 800 },
    ]) {
      const view = battleMovesView(inputOf({ card: battleMovesBox(viewport), cells: COMPACT_GRID }));
      expect(view.compact).toBe(true);
      for (const slot of view.slots) expectBoxesHold(slot);
    }
  });

  it('reads its width class off the card, and the phone card is the compact one', () => {
    expect(compactCard(battleMovesBox(PHONE))).toBe(true);
    expect(compactCard(battleMovesBox(DESKTOP))).toBe(false);
    expect(compactCard(CARD)).toBe(false);
    expect(battleMovesView(inputOf({ card: battleMovesBox(PHONE) })).compact).toBe(true);
    expect(battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) })).compact).toBe(false);
  });
});

describe('the category word of a slot', () => {
  it('pins the three words the wide cell reads', () => {
    expect(CATEGORY_LABELS).toStrictEqual({
      Physical: 'PHYSICAL',
      Special: 'SPECIAL',
      Status: 'STATUS',
    });
  });

  it('is the word on the wide cell and nothing at all on the compact one', () => {
    const wide = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: COMPACT_GRID }));
    expect(wide.compact).toBe(false);
    expect(wide.slots.map((slot) => slot.categoryLabel)).toStrictEqual([
      'PHYSICAL',
      'SPECIAL',
      'STATUS',
      'SPECIAL',
    ]);
    // The atlas key is untouched by the word: it is what the glyph reads.
    expect(wide.slots.map((slot) => slot.category)).toStrictEqual([
      'Physical',
      'Special',
      'Status',
      'Special',
    ]);

    const phone = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: COMPACT_GRID }));
    expect(phone.compact).toBe(true);
    for (const slot of phone.slots) {
      expect(slot.empty).toBe(false);
      expect(slot.categoryLabel).toBe('');
    }
    expect(phone.slots.map((slot) => slot.category)).toStrictEqual([
      'Physical',
      'Special',
      'Status',
      'Special',
    ]);
  });

  it('leaves the empty slot without one, whatever the width class', () => {
    const cells = padMoveGridCells([moveCell('TACKLE')], 4);
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleMovesView(inputOf({ card: battleMovesBox(viewport), cells }));
      expect(view.slots[1]!.empty).toBe(true);
      expect(view.slots[1]!.categoryLabel).toBe('');
    }
  });

  it('reads a category the table does not name as its own uppercase', () => {
    const cells = padMoveGridCells([moveCell('ODD', { category: '???' })], 4);
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells }));
    expect(view.slots[0]!.categoryLabel).toBe('???');
  });
});

describe('the wide cell', () => {
  it('keeps the shipped boxes at 1280×800, its stats past the type badge', () => {
    const view = battleMovesView(
      inputOf({ card: battleMovesBox(DESKTOP), cells: padMoveGridCells([moveCell('FLAMETHROWER')], 4) }),
    );
    expect(view.compact).toBe(false);
    const slot = view.slots[0]!;
    expect(slot.box).toStrictEqual({ x: 524, y: 606, w: 222, h: 72 });
    expect(slot.typeBox).toStrictEqual({ x: 538, y: 636.5, w: 24, h: 24 });
    expect(slot.boxes.name).toStrictEqual({ x: 538, y: 622.5, w: 162, h: 13 });
    expect(slot.boxes.category).toStrictEqual({ x: 708, y: 622.5, w: 24, h: 24 });
    expect(slot.boxes.pp).toStrictEqual({ x: 570, y: 635.5, w: 162, h: 13 });
    expect(slot.boxes.power).toStrictEqual({ x: 570, y: 648.5, w: 86, h: 13 });
    expect(slot.boxes.accuracy).toStrictEqual({ x: 664, y: 648.5, w: 68, h: 13 });
    expect(slot.nameBox).toBe(slot.boxes.name);
    expect(slot.categoryBox).toBe(slot.boxes.category);
    expect(slot.name).toBe('FLAMETHROWER');
    expectBoxesHold(slot);
  });

  it('holds its four cells clear of the HP column, as the card itself does', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: COMPACT_GRID }));
    for (const side of ['player', 'enemy'] as const) {
      const hp = battleHpBox(DESKTOP, side, 0);
      for (const slot of view.slots) {
        expect(overlapArea(slot.box, hp)).toBe(0);
        for (const box of Object.values(slot.boxes)) expect(overlapArea(box, hp)).toBe(0);
      }
    }
  });
});

describe('cellTextBoxes', () => {
  const phone: Rect = { x: 100, y: 616, w: 119, h: 94 };
  const wide: Rect = { x: 524, y: 606, w: 222, h: 72 };

  it('lays a cell out by its width class alone', () => {
    expect(cellTextBoxes(phone, true).name).toStrictEqual({ x: 114, y: 650, w: 91, h: 13 });
    expect(cellTextBoxes(wide, false, 'fire').name).toStrictEqual({ x: 538, y: 622.5, w: 162, h: 13 });
    for (const box of Object.values(cellTextBoxes(phone, true))) {
      expect(fitsInside(box, phone)).toBe(true);
    }
    for (const box of Object.values(cellTextBoxes(wide, false, 'fire'))) {
      expect(fitsInside(box, wide)).toBe(true);
    }
  });

  it('pins the measured 119×94 phone cell: the six rows, the 91 px name, the 24 px glyph', () => {
    expect(cellTextBoxes(phone, true)).toStrictEqual({
      name: { x: 114, y: 650, w: 91, h: 13 },
      category: { x: 181, y: 637, w: 24, h: 13 },
      pp: { x: 114, y: 663, w: 91, h: 13 },
      power: { x: 114, y: 676, w: 91, h: 13 },
      accuracy: { x: 114, y: 689, w: 91, h: 13 },
    });
  });

  it('pins the wide cell s five boxes, which this layout does not move', () => {
    expect(cellTextBoxes(wide, false, 'fire')).toStrictEqual({
      name: { x: 538, y: 622.5, w: 162, h: 13 },
      category: { x: 708, y: 622.5, w: 24, h: 24 },
      pp: { x: 570, y: 635.5, w: 162, h: 13 },
      power: { x: 570, y: 648.5, w: 86, h: 13 },
      accuracy: { x: 664, y: 648.5, w: 68, h: 13 },
    });
    expect(cellTextBoxes(wide, false, 'electric')).toStrictEqual(cellTextBoxes(wide, false, 'fire'));
    expect(cellTextBoxes(wide, false)).toStrictEqual(cellTextBoxes(wide, false, 'fire'));
  });

  it('starts the wide stat column one gap past the badge, whatever type it is told', () => {
    const fire = cellTextBoxes(wide, false, 'fire');
    const electric = cellTextBoxes(wide, false, 'electric');
    const unnamed = cellTextBoxes(wide, false);
    expect(fire.pp.x).toBe(fire.name.x + 24 + 8);
    expect(electric.pp.x).toBe(fire.pp.x);
    expect(unnamed.pp.x).toBe(fire.pp.x);
    expect(fire.power.x + fire.power.w).toBeLessThanOrEqual(fire.accuracy.x - 8 + 0.01);
  });
});

describe('fitsInside', () => {
  const outer: Rect = { x: 10, y: 20, w: 100, h: 50 };

  it('is true for a box inside, and for the box itself', () => {
    expect(fitsInside({ x: 20, y: 30, w: 10, h: 10 }, outer)).toBe(true);
    expect(fitsInside(outer, outer)).toBe(true);
    expect(fitsInside({ x: 10, y: 20, w: 100, h: 50 }, outer)).toBe(true);
  });

  it('allows half a pixel of rounding, and no more', () => {
    expect(fitsInside({ x: 9.5, y: 19.5, w: 101, h: 51 }, outer)).toBe(true);
    expect(fitsInside({ x: 9.4, y: 20, w: 100, h: 50 }, outer)).toBe(false);
    expect(fitsInside({ x: 10, y: 20, w: 100.6, h: 50 }, outer)).toBe(false);
    expect(fitsInside({ x: 9.4, y: 19.4, w: 101.2, h: 51.2 }, outer, 1)).toBe(true);
  });

  it('is false for a box that leaves on one edge', () => {
    expect(fitsInside({ x: 20, y: 30, w: 10, h: 41 }, outer)).toBe(false);
    expect(fitsInside({ x: 10, y: 20, w: 10, h: 10 }, { x: 10, y: 20, w: 0, h: 0 })).toBe(false);
  });
});

describe('battleMovesView purity', () => {
  it('clamps selected into the four slots, and never reads the scene s pin', () => {
    const high = battleMovesView(inputOf({ selected: 9, info: 0 }));
    expect(high.slots[3]!.selected).toBe(true);
    expect(high.info!.title).toBe('EARTHQUAKE');
    const low = battleMovesView(inputOf({ selected: -4, info: 3 }));
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

describe('the move card', () => {
  it('counts 44 characters a line, per paragraph', () => {
    expect(infoLineCount('')).toBe(0);
    expect(infoLineCount('HELLO')).toBe(1);
    expect(infoLineCount('x'.repeat(44))).toBe(1);
    expect(infoLineCount('x'.repeat(45))).toBe(2);
    expect(infoLineCount(`${'x'.repeat(44)}\n${'x'.repeat(45)}`)).toBe(3);
  });

  it('describes the cursor s cell, never the scene s ⓘ pin', () => {
    const selected = battleMovesView(inputOf({ selected: 2 }));
    expect(selected.info).not.toBeNull();
    expect(selected.info!.title).toBe('DRAGON CLAW');
    expect(selected.info!.type).toBe('dragon');
    expect(selected.info!.category).toBe('Physical');
    expect(selected.info!.pp).toBe(t('move.pp', { pp: 15, max: 15 }));
    expect(selected.info!.power).toBe(t('move.pwr', { value: 40 }));
    expect(selected.info!.accuracy).toBe(t('move.acc', { value: 100 }));
    expect(selected.info!.text).toBe('A SHORT LINE.');
    const pinned = battleMovesView(inputOf({ selected: 2, info: 0 }));
    expect(pinned.info).toStrictEqual(selected.info);
  });

  it('is null while the menu is closed, on an empty cell and past the grid', () => {
    expect(battleMovesView(inputOf({ open: false })).info).toBeNull();
    const one = padMoveGridCells([moveCell('TACKLE')], 4);
    expect(battleMovesView(inputOf({ cells: one, selected: 1 })).info).toBeNull();
    expect(battleMovesView(inputOf({ cells: [], selected: 0 })).info).toBeNull();
    expect(battleMovesView(inputOf({ cells: one, selected: 3 })).info).toBeNull();
  });

  it('answers a filled cell whose description is empty: the head alone, no text', () => {
    const cells = padMoveGridCells([moveCell('GROWL', { desc: '' })], 4);
    const info = battleMovesView(inputOf({ cells })).info!;
    expect(info.text).toBe('');
    expect(info.title).toBe('GROWL');
    expect(info.pp).toBe(t('move.pp', { pp: 15, max: 15 }));
    expect(info.power).toBe(t('move.pwr', { value: 40 }));
    expect(info.accuracy).toBe(t('move.acc', { value: 100 }));
  });

  it('is the board s 160 px card, 8 px above the menu s top edge at 1280×800', () => {
    const card = battleMovesBox(DESKTOP);
    const info = battleMovesView(inputOf({ card })).info!;
    expect(INFO_CARD_H).toBe(160);
    expect(info.box).toStrictEqual({ x: 460, y: 414, w: 524, h: 160 });
    expect(info.box.y + info.box.h).toBeLessThanOrEqual(card.y - 8);
  });

  it('clears the phone s own HP box: 8 px above it at 390×844', () => {
    const info = battleMovesView(inputOf({ card: battleMovesBox(PHONE) })).info!;
    expect(info.box).toStrictEqual({ x: 36, y: 336, w: 216, h: 160 });
    expect(info.box.x + info.box.w).toBe(252);
    expect(info.box.y + info.box.h).toBeLessThanOrEqual(battleHpBox(PHONE, 'player', 0).y - 8);
  });

  it('cedes its right rail to the stage grid at 390×844', () => {
    const info = battleMovesView(inputOf({ card: battleMovesBox(PHONE) })).info!;
    const column = battleHpBox(PHONE, 'player', 0);
    // The rail is what the widest grid can take beside the card, so the card's right
    // edge plus the grid's own clearance is that grid's left edge, for every count.
    expect(COMPACT_CARD_RAIL_W).toBe(
      STAGE_CHIP * STAGE_COLS + STAGE_GAP * (STAGE_COLS - 1) + STAGE_CLEARANCE,
    );
    expect(COMPACT_CARD_RAIL_W).toBe(122);
    expect(column.x + column.w).toBe(374);
    expect(info.box.x + info.box.w).toBe(column.x + column.w - COMPACT_CARD_RAIL_W);
    for (const chips of [1, 2, 3, 6, 7]) {
      const grid = stageGridBox(column, chips);
      expect(overlapArea(info.box, grid), `${chips} chips`).toBe(0);
      expect(info.box.x + info.box.w + STAGE_CLEARANCE, `${chips} chips`).toBeLessThanOrEqual(grid.x);
    }
    // The measured six-chip box and the one-chip box this clears, pinned by value.
    expect(stageGridBox(column, 6)).toStrictEqual({ x: 260, y: 422, w: 114, h: 74 });
    expect(stageGridBox(column, 1)).toStrictEqual({ x: 340, y: 462, w: 34, h: 34 });
  });

  it('never paints over the command window at either viewport', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const menu = battleMovesBox(viewport);
      const info = battleMovesView(inputOf({ card: menu })).info!;
      expect(overlapArea(info.box, menu), `${viewport.width}×${viewport.height}`).toBe(0);
    }
  });

  it('never paints over a side s lead HP box at either viewport', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const info = battleMovesView(inputOf({ card: battleMovesBox(viewport) })).info!;
      for (const side of ['player', 'enemy'] as const) {
        expect(overlapArea(info.box, battleHpBox(viewport, side, 0))).toBe(0);
      }
    }
  });

  it('keeps the phone s clearance between the menu s top and the player s HP box', () => {
    expect(COMPACT_CARD_CLEARANCE).toBe(88);
    expect(COMPACT_CARD_CLEARANCE).toBe(battleMovesBox(PHONE).y - battleHpBox(PHONE, 'player', 0).y);
  });

  it('holds its own content in the narrow phone card', () => {
    const info = battleMovesView(inputOf({ card: battleMovesBox(PHONE) })).info!;
    // 216 − 2 × 12 padding − 2 × 1 border, the same box the stylesheet gives.
    const content = info.box.w - 24 - 2;
    expect(content).toBe(190);
    // The head's first line is the card: two 24 px glyphs, their two 8 px gaps and the
    // 126 px the title keeps, and the title ellipsizes rather than grow it.
    const titleW = content - (MOVE_ICON_BOX + 8) * 2;
    expect(titleW).toBe(126);
    // The three readouts and their two 8 px gaps fit a line of their own inside it.
    const stats =
      drawnTextWidth(t('move.pp', { pp: 12, max: 15 })) +
      drawnTextWidth(t('move.pwr', { value: 90 })) +
      drawnTextWidth(t('move.acc', { value: 100 })) +
      8 * 2;
    expect(stats).toBeLessThanOrEqual(content);
    // The description is clipped inside the frozen card, never growing it.
    expect(info.box.h).toBe(INFO_CARD_H);
    expect(info.box.y + info.box.h).toBeLessThan(battleMovesBox(PHONE).y);
  });

  it('is the same 160 px whatever its description says', () => {
    const cells = padMoveGridCells([moveCell('LONG', { desc: 'x'.repeat(400) })], 4);
    const info = battleMovesView(inputOf({ cells })).info!;
    expect(info.box.h).toBe(INFO_CARD_H);
    expect(info.text).toBe('x'.repeat(400));
  });
});

describe('the target step s prompt row', () => {
  it('names the marked foe with the shipped question', () => {
    const view = battleMovesView(inputOf({ target: 'Pidgey' }));
    expect(view.target).not.toBeNull();
    expect(view.target!.label).toBe(t('battle.targetPrompt', { name: 'Pidgey' }));
    expect(view.target!.label).toBe('Which foe? Pidgey');
  });

  it('is null while the step is closed, and for a name that is not one', () => {
    expect(battleMovesView(inputOf({ target: null })).target).toBeNull();
    expect(battleMovesView(inputOf({ target: '' })).target).toBeNull();
    expect(battleMovesView(inputOf()).target).toBeNull();
  });

  it('pins the two numbers it is drawn at', () => {
    expect(MOVE_TARGET_TOP).toBe(1);
    expect(MOVE_TARGET_H).toBe(MOVE_INFO_SIZE);
    expect(MOVE_TARGET_H).toBe(22);
  });

  it('sits in the card s top band, one line above the first cell at both viewports', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const card = battleMovesBox(viewport);
      const view = battleMovesView(inputOf({ card, target: 'Pidgey' }));
      const box = view.target!.box;
      expect(box).toStrictEqual({
        x: card.x + FRLG_WINDOW_PADDING.x,
        y: card.y + MOVE_TARGET_TOP,
        w: card.w - FRLG_WINDOW_PADDING.x * 2,
        h: 22,
      });
      expect(view.slots).toHaveLength(4);
      for (const slot of view.slots) {
        expect(box.y + box.h).toBeLessThanOrEqual(slot.box.y);
        expect(box.x).toBeLessThanOrEqual(slot.box.x);
        expect(box.x + box.w).toBeGreaterThanOrEqual(slot.box.x + slot.box.w);
      }
    }
  });

  it('ends exactly one px above the first cell, on the card s own arithmetic', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), target: 'Pidgey' }));
    expect(view.target!.box).toStrictEqual({ x: 460, y: 583, w: 524, h: 22 });
    expect(view.slots[0]!.box.y - (view.target!.box.y + view.target!.box.h)).toBe(1);
    const phone = battleMovesView(inputOf({ card: battleMovesBox(PHONE), target: 'Pidgey' }));
    expect(phone.target!.box).toStrictEqual({ x: 36, y: 593, w: 318, h: 22 });
    expect(phone.slots[0]!.box.y - (phone.target!.box.y + phone.target!.box.h)).toBe(1);
  });

  it('leaves the four cells exactly as they were', () => {
    const closed = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) }));
    const open = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), target: 'Pidgey' }));
    expect(open.slots).toStrictEqual(closed.slots);
    expect({ ...open, target: null }).toStrictEqual(closed);
  });

  it('pins the wording of both tables, each with the one token the call site passes', () => {
    expect(en['battle.targetPrompt']).toBe('Which foe? {name}');
    expect(es['battle.targetPrompt']).toBe('¿A cuál? {name}');
    expect(translationParams(en['battle.targetPrompt'])).toStrictEqual(['name']);
    expect(translationParams(es['battle.targetPrompt'])).toStrictEqual(['name']);
    expect(es['battle.targetPrompt']).not.toContain('\u2014');
  });
});

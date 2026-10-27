import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { t } from '../../../../i18n';
import {
  moveGridCellRects,
  padMoveGridCells,
  type MoveGridCell,
  type MoveGridSlot,
} from '../../../moveGrid';
import { battleHpBox } from '../battle-hp/view';
import {
  BATTLE_COMPACT,
  BATTLE_STAGE_MAX,
  MOVE_BACK_COL,
  MOVE_CATEGORY_GAP,
  MOVE_GMAX_COL,
  MOVE_GRID_INSET,
  MOVE_INFO_SIZE,
  MOVE_MEGA_COL,
  battleMovesBox,
  battleMovesView,
  drawnTextWidth,
  elideToWidth,
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
    expect(slot.nameBox.w).toBe(96);
    // The type's own label (36–60 px, one per type) never enters the name's column.
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
      nameBox: view.slots[1]!.nameBox,
      categoryBox: view.slots[1]!.categoryBox,
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

describe('the category column', () => {
  it('ends a gap left of the ⓘ and stays inside its cell at both shipped cards', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleMovesView(inputOf({ card: battleMovesBox(viewport) }));
      for (const slot of view.slots) {
        expect(slot.categoryBox.x + slot.categoryBox.w).toBeLessThanOrEqual(
          slot.info!.x - MOVE_CATEGORY_GAP + 0.001,
        );
        expect(slot.categoryBox.x).toBeGreaterThanOrEqual(slot.box.x);
        expect(slot.categoryBox.y).toBeGreaterThanOrEqual(slot.box.y);
        expect(slot.categoryBox.x + slot.categoryBox.w).toBeLessThanOrEqual(slot.box.x + slot.box.w);
        expect(slot.categoryBox.y + slot.categoryBox.h).toBeLessThanOrEqual(slot.box.y + slot.box.h);
      }
    }
  });

  it('is the widest label s own width, right-aligned against the gap', () => {
    const slot = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP) })).slots[0]!;
    expect(slot.categoryBox.w).toBe(60);
    expect(slot.categoryBox.x + slot.categoryBox.w).toBe(slot.info!.x - MOVE_CATEGORY_GAP);
    expect(slot.categoryBox.h).toBe(13);
  });

  it('gives an empty slot a zero-width column at the cell s right pad, and no ⓘ', () => {
    const cells = padMoveGridCells([moveCell('TACKLE')], 4);
    const empty = battleMovesView(inputOf({ cells })).slots[1]!;
    expect(empty.info).toBeNull();
    expect(empty.categoryBox.w).toBe(0);
    expect(empty.categoryBox.x).toBe(empty.box.x + empty.box.w - 14);
  });
});

/** The four invariants of a filled cell, measured on the strings the model paints. */
function expectCellFits(slot: BattleMoveSlotView): void {
  expect(drawnTextWidth(slot.name)).toBeLessThanOrEqual(slot.nameBox.w + 0.01);
  expect(drawnTextWidth(slot.category)).toBeLessThanOrEqual(slot.categoryBox.w + 0.01);
  // The slot paints the category uppercased, so the column must hold that string too.
  expect(drawnTextWidth(slot.category.toUpperCase())).toBeLessThanOrEqual(slot.categoryBox.w + 0.01);
  expect(slot.nameBox.x).toBeGreaterThanOrEqual(slot.box.x + CELL_PAD_X);
  expect(slot.categoryBox.x + slot.categoryBox.w).toBeLessThanOrEqual(slot.info!.x);
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
  it('takes the cell s remaining width, and keeps all but the long name whole at 1280×800', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: LONG_GRID }));
    expect(view.slots).toHaveLength(4);
    // 222 px cell: 2×14 padding, the 60 px category column, its two 8 px gaps and the 22 px ⓘ.
    for (const slot of view.slots) expect(slot.nameBox.w).toBe(222 - 28 - 60 - 16 - 22);
    for (const slot of view.slots) {
      expect(slot.empty).toBe(false);
      expect(slot.nameBox.w).toBeGreaterThanOrEqual(54);
      expectCellFits(slot);
    }
    expect(view.slots.map((slot) => slot.name)).toStrictEqual([
      'MOFLETE ESTÁ\u2026',
      'LANZALLAMAS',
      'TERREMOTO',
      'PSÍQUICO',
    ]);
    // The one cut name loses only its last two glyphs to the ellipsis.
    const head = view.slots[0]!.name.slice(0, -1);
    expect(head.length).toBeGreaterThanOrEqual(9);
    expect('MOFLETE ESTÁTICO'.startsWith(head)).toBe(true);
    const pinned = battleMovesView(
      inputOf({ card: battleMovesBox(DESKTOP), cells: LONG_GRID, info: 0 }),
    );
    expect(pinned.info!.title).toBe('MOFLETE ESTÁTICO');
  });

  it('holds on the compact card and on the phone card', () => {
    for (const viewport of [{ width: 600, height: 600 }, PHONE]) {
      const card = battleMovesBox(viewport);
      expect(card.w).toBeLessThan(BATTLE_COMPACT);
      const view = battleMovesView(inputOf({ card, cells: LONG_GRID }));
      for (const slot of view.slots) expectCellFits(slot);
    }
  });

  it('reports the phone card s own budget: the category and the ⓘ take its whole content box', () => {
    const view = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: LONG_GRID }));
    for (const slot of view.slots) {
      const info = slot.info!;
      // 119 px cell: 2×14 padding leaves 91, and the 60 px category column, its 8 px
      // gap and the 22 px ⓘ take 90 of them — one pixel, so the name paints nothing
      // and the ⓘ card is where its whole text stays readable.
      expect(info.x + info.w).toBe(slot.box.x + slot.box.w - 14);
      expect(slot.categoryBox.w).toBe(60);
      expect(slot.categoryBox.x + slot.categoryBox.w).toBe(info.x - MOVE_CATEGORY_GAP);
      expect(slot.nameBox.x).toBe(slot.box.x + CELL_PAD_X);
      expect(slot.nameBox.w).toBeLessThanOrEqual(1);
      expect(slot.name).toBe('');
      expectCellFits(slot);
    }
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
      expect(slot.info).toBeNull();
    }
  });

  it('takes the name column from the cell it is in, and the category from its widest label', () => {
    const wide = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells: LONG_GRID }));
    const phone = battleMovesView(inputOf({ card: battleMovesBox(PHONE), cells: LONG_GRID }));
    expect(wide.slots[0]!.nameBox.w).toBeGreaterThan(phone.slots[0]!.nameBox.w);
    expect(wide.slots[0]!.nameBox.y).toBe(wide.slots[0]!.categoryBox.y);
    for (const label of ['PHYSICAL', 'SPECIAL', 'STATUS']) {
      expect(wide.slots[0]!.categoryBox.w).toBeGreaterThanOrEqual(Math.ceil(drawnTextWidth(label)));
    }
  });

  it('paints the name in the case the slot paints it, and keeps the full one for the ⓘ', () => {
    const cells = padMoveGridCells([moveCell('Moflete Estático', { category: 'Physical' })], 4);
    const view = battleMovesView(inputOf({ card: battleMovesBox(DESKTOP), cells, info: 0 }));
    expect(view.slots[0]!.name).toBe('MOFLETE ESTÁ\u2026');
    expect(view.info!.title).toBe('Moflete Estático');
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

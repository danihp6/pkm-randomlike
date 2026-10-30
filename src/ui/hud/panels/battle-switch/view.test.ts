import { describe, expect, it } from 'vitest';
import { PORTRAIT_SIZE } from '../../../../data/portraits';
import { t } from '../../../../i18n';
import { FRLG_HPBAR, FRLG_WINDOW_PADDING } from '../../../frlg';
import { fitPartyLabel, partyGridLayout } from '../../../partyGrid';
import { battleMovesBox } from '../battle-moves';
import {
  battleSwitchBox,
  battleSwitchView,
  fixtureSwitchInput,
  SWITCH_BACK_COLUMN,
  SWITCH_INSET,
  SWITCH_LABEL_SIZE,
  SWITCH_ROW_GAP,
  SWITCH_ROWS,
  type BattleSwitchInput,
  type BattleSwitchRowInput,
  type Rect,
  type Viewport,
} from './view';

const DESKTOP: Viewport = { width: 1280, height: 800 };
const PHONE: Viewport = { width: 390, height: 844 };
const CARD: Rect = { x: 276, y: 582, w: 728, h: 192 };
const PHONE_CARD: Rect = { x: 16, y: 592, w: 358, h: 236 };

const PARTY: readonly BattleSwitchRowInput[] = [
  { name: 'CHARIZARD', level: 36, hp: 98, maxHp: 112, statusLabel: null, enabled: false, field: true },
  { name: 'PIKACHU', level: 32, hp: 84, maxHp: 112, statusLabel: null, enabled: true, field: false },
  { name: 'BULBASAUR', level: 30, hp: 51, maxHp: 102, statusLabel: 'PAR', enabled: true, field: false },
  { name: 'GASTLY', level: 28, hp: 21, maxHp: 84, statusLabel: 'PSN', enabled: true, field: false },
  { name: 'CHARMANDER', level: 24, hp: 14, maxHp: 70, statusLabel: null, enabled: true, field: false },
  { name: 'SQUIRTLE', level: 22, hp: 0, maxHp: 78, statusLabel: null, enabled: false, field: false },
];

type Overrides = Readonly<{
  open?: boolean;
  card?: Rect;
  rows?: readonly BattleSwitchRowInput[];
  selected?: number;
}>;

function inputOf(overrides: Overrides = {}): BattleSwitchInput {
  return {
    open: overrides.open ?? true,
    card: overrides.card ?? CARD,
    rows: overrides.rows ?? PARTY,
    selected: overrides.selected ?? 0,
  };
}

function rowOf(overrides: Partial<BattleSwitchRowInput>): BattleSwitchRowInput {
  return {
    name: 'EEVEE',
    level: 10,
    hp: 10,
    maxHp: 10,
    statusLabel: null,
    enabled: true,
    field: false,
    ...overrides,
  };
}

function expectRect(actual: Rect, expected: Rect): void {
  expect(actual.x).toBeCloseTo(expected.x, 2);
  expect(actual.y).toBeCloseTo(expected.y, 2);
  expect(actual.w).toBeCloseTo(expected.w, 2);
  expect(actual.h).toBeCloseTo(expected.h, 2);
}

function expectTops(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((top, index) => {
    expect(actual[index]).toBeCloseTo(top, 2);
  });
}

/** The board's row line without its status, exactly as `openParty` builds its label. */
function rowLabel(name: string, level: number): string {
  return t('party.rowLabel', { name, level, status: '' });
}

describe('the mirrored constants', () => {
  it('are the canvas switch grid s own numbers', () => {
    expect(SWITCH_ROWS).toBe(6);
    expect(SWITCH_ROW_GAP).toBe(8);
    expect(SWITCH_BACK_COLUMN).toBe(64);
    expect(SWITCH_INSET).toBe(8);
    expect(SWITCH_LABEL_SIZE).toBe(14);
  });
});

describe('battleSwitchBox', () => {
  it('is the shipped battle menu box, not a copy of its arithmetic', () => {
    expect(battleSwitchBox).toBe(battleMovesBox);
    expect(battleSwitchBox(DESKTOP)).toStrictEqual({ x: 680, y: 582, w: 324, h: 192 });
    expect(battleSwitchBox(PHONE)).toStrictEqual({ x: 16, y: 592, w: 358, h: 236 });
  });
});

describe('battleSwitchView on the desktop card', () => {
  it('lays the six row rects out with partyGridLayout', () => {
    const view = battleSwitchView(inputOf());
    const layout = partyGridLayout(CARD, {
      padding: FRLG_WINDOW_PADDING,
      rows: SWITCH_ROWS,
      gap: SWITCH_ROW_GAP,
      backColumn: SWITCH_BACK_COLUMN,
      inset: SWITCH_INSET,
      avatarScaleCap: 0.9,
      hpBarScaleCap: 0.4,
      hpBarWidth: FRLG_HPBAR.width,
      hpBarHeight: FRLG_HPBAR.height,
    });
    expect(view.slots).toStrictEqual(layout.rects);
    expect(view.slots).toHaveLength(6);
  });

  it('puts the six rows at the pinned tops and the pinned 26.667 pitch', () => {
    const view = battleSwitchView(inputOf());
    expectTops(
      view.slots.map((slot) => slot.y),
      [606, 632.6667, 659.3333, 686, 712.6667, 739.3333],
    );
    expect(view.slots[1].y - view.slots[0].y).toBeCloseTo(26.6667, 2);
    expect(view.slots[0].h).toBeCloseTo(18.6667, 2);
    for (const slot of view.slots) {
      expect(slot.x).toBe(360);
      expect(slot.w).toBe(616);
    }
  });

  it('draws the portrait as the row s avatar-scaled tile, 8 px in and centred', () => {
    const view = battleSwitchView(inputOf());
    expectRect(view.rows[0].portrait, { x: 368, y: 608, w: 14.6667, h: 14.6667 });
    expect(view.rows[0].portrait.w).toBeCloseTo(view.slots[0].h - 4, 6);
    expect(view.rows[0].portrait.w).toBeLessThanOrEqual(PORTRAIT_SIZE);
  });

  it('draws the track at the row s right edge, the fill window inside it', () => {
    const view = battleSwitchView(inputOf());
    expectRect(view.rows[0].hp!.track, { x: 860.8, y: 609.7333, w: 107.2, h: 11.2 });
    expectRect(view.rows[0].hp!.area, { x: 884.8, y: 612.9333, w: 76.8, h: 4.8 });
    expect(view.rows[0].hp!.fill.w).toBeCloseTo(67.2, 2);
  });

  it('moves the track and the label left by the mark s 44 + 4 for the statused rows', () => {
    const view = battleSwitchView(inputOf());
    expectRect(view.rows[2].hp!.track, { x: 812.8, y: 663.0667, w: 107.2, h: 11.2 });
    expectRect(view.rows[2].hp!.area, { x: 836.8, y: 666.2667, w: 76.8, h: 4.8 });
    expectRect(view.rows[2].status!.box, { x: 924, y: 660.6667, w: 44, h: 16 });
    expectRect(view.rows[3].status!.box, { x: 924, y: 687.3333, w: 44, h: 16 });
  });

  it('fits the row line to the label box and leaves the status to the mark', () => {
    const view = battleSwitchView(inputOf());
    expectRect(view.rows[0].label.box, { x: 388.6667, y: 606, w: 472.1333, h: 18.6667 });
    expect(view.rows[0].label.text).toBe(rowLabel('CHARIZARD', 36));
    expect(view.rows[2].label.text).toBe(rowLabel('BULBASAUR', 30));
    expect(view.rows[2].label.text).not.toContain('PAR');
  });

  it('narrows a statused row s label box by exactly the mark and its gap', () => {
    const view = battleSwitchView(inputOf());
    expect(view.rows[0].label.box.w).toBeCloseTo(472.1333, 2);
    expect(view.rows[2].label.box.w).toBeCloseTo(472.1333 - 48, 2);
    expect(view.rows[0].label.box.w - view.rows[2].label.box.w).toBeCloseTo(48, 6);
    expect(view.rows[2].label.box.w).toBeCloseTo(view.rows[3].label.box.w, 6);
  });

  it('keeps the fitted text equal to the box it is drawn in', () => {
    for (const viewport of [DESKTOP, PHONE]) {
      const view = battleSwitchView(inputOf({ card: battleSwitchBox(viewport) }));
      for (const row of view.rows) {
        expect(row.label.text).toBe(
          fitPartyLabel(rowLabel(row.name, row.level), row.label.box.w, SWITCH_LABEL_SIZE),
        );
      }
    }
  });

  it('centres the ◀ at the canvas own arrow spot, 48×36', () => {
    const view = battleSwitchView(inputOf());
    expect(view.back.label).toBe('\u25c0');
    expectRect(view.back.box, { x: 298, y: 664, w: 48, h: 36 });
    expect(view.back.box.y).toBeCloseTo(
      (view.slots[0].y + view.slots[5].y + view.slots[5].h) / 2 - 18,
      6,
    );
  });
});

describe('battleSwitchView rows', () => {
  it('reads one member per row, in party order', () => {
    const view = battleSwitchView(inputOf());
    expect(view.rows.map((row) => row.index)).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(view.rows.map((row) => row.name)).toStrictEqual(PARTY.map((row) => row.name));
    expect(view.rows.map((row) => row.level)).toStrictEqual(PARTY.map((row) => row.level));
    expect(view.rows[0].hpText).toBe('98/112');
    expect(view.rows[5].hpText).toBe('0/78');
  });

  it('tones the three hpColor bands at their own boundaries', () => {
    expect(
      battleSwitchView(inputOf()).rows.map((row) => (row.hp === null ? null : row.hp.tone)),
    ).toStrictEqual(['healthy', 'healthy', 'caution', 'caution', 'danger', null]);
    const edges = [
      rowOf({ hp: 60, maxHp: 100 }),
      rowOf({ hp: 50, maxHp: 100 }),
      rowOf({ hp: 21, maxHp: 100 }),
      rowOf({ hp: 20, maxHp: 100 }),
      rowOf({ hp: 19, maxHp: 100 }),
    ];
    const banded = battleSwitchView(inputOf({ rows: edges }));
    expect(banded.rows.map((row) => row.hp!.tone)).toStrictEqual([
      'healthy',
      'caution',
      'caution',
      'danger',
      'danger',
    ]);
  });

  it('sizes every fill at the texture window times the member s fraction', () => {
    const view = battleSwitchView(inputOf());
    const fills = view.rows.map((row) => (row.hp === null ? null : row.hp.fill.w));
    [67.2, 57.6, 38.4, 19.2, 15.36].forEach((width, index) => {
      expect(fills[index]).toBeCloseTo(width, 2);
    });
    expect(fills[5]).toBeNull();
    for (const row of view.rows.slice(0, 5)) {
      expect(row.hp!.fill.w).toBeCloseTo(row.hp!.area.w * row.fraction, 6);
      expect(row.hp!.fill.h).toBeCloseTo(row.hp!.area.h, 6);
      expect(row.hp!.fill.x).toBeCloseTo(row.hp!.area.x, 6);
    }
    expect(view.rows.map((row) => row.fraction)).toStrictEqual([0.875, 0.75, 0.5, 0.25, 0.2, 0]);
  });

  it('drops the bar with the fainted member, exactly as the canvas hides it', () => {
    const view = battleSwitchView(inputOf());
    expect(view.rows[5].hp).toBeNull();
    expect(view.rows[5].status).toBeNull();
    expect(view.rows.slice(0, 5).every((row) => row.hp !== null)).toBe(true);
  });

  it('carries a mark for the statused rows only', () => {
    const view = battleSwitchView(inputOf());
    expect(view.rows.map((row) => row.statusLabel)).toStrictEqual([
      null,
      null,
      'PAR',
      'PSN',
      null,
      null,
    ]);
    expect(view.rows.map((row) => row.status !== null)).toStrictEqual([
      false,
      false,
      true,
      true,
      false,
      false,
    ]);
  });

  it('marks the selected row and only it, and passes the two flags through', () => {
    const view = battleSwitchView(inputOf({ selected: 2 }));
    expect(view.rows.map((row) => row.selected)).toStrictEqual([
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(view.rows.map((row) => row.field)).toStrictEqual([true, false, false, false, false, false]);
    expect(view.rows.map((row) => row.enabled)).toStrictEqual([false, true, true, true, true, false]);
  });

  it('paints a short party against the six slots, with nothing undefined', () => {
    const view = battleSwitchView(inputOf({ rows: PARTY.slice(0, 2), selected: 9 }));
    expect(view.rows).toHaveLength(2);
    expect(view.slots).toHaveLength(6);
    expect(view.slots.every((slot) => typeof slot.x === 'number')).toBe(true);
    expect(view.rows[1].selected).toBe(true);
    expect(view.rows[1].row).toStrictEqual(view.slots[1]);
  });
});

describe('battleSwitchView purity', () => {
  it('clamps the selected index into the members on screen', () => {
    expect(battleSwitchView(inputOf({ selected: -1 })).rows[0].selected).toBe(true);
    expect(battleSwitchView(inputOf({ selected: 99 })).rows[5].selected).toBe(true);
    expect(battleSwitchView(inputOf({ selected: Number.NaN })).rows[0].selected).toBe(true);
    const none = battleSwitchView(inputOf({ rows: [], selected: 3 }));
    expect(none.rows).toStrictEqual([]);
    expect(none.slots).toHaveLength(6);
  });

  it('caps the members at the six rows the grid reserves', () => {
    const many = Array.from({ length: 9 }, (_unused, index) => rowOf({ level: index + 1 }));
    const view = battleSwitchView(inputOf({ rows: many }));
    expect(view.rows).toHaveLength(6);
    expect(view.rows.map((row) => row.level)).toStrictEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns deep-equal output for the same input, and mutates nothing', () => {
    const input = inputOf({ selected: 3 });
    const snapshot = JSON.stringify(input);
    const first = battleSwitchView(input);
    const second = battleSwitchView(input);
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
    expect(second.rows[0]).not.toBe(first.rows[0]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('passes the card and the open flag through untouched', () => {
    const closed = battleSwitchView(inputOf({ open: false }));
    expect(closed.open).toBe(false);
    expect(closed.card).toStrictEqual(CARD);
  });
});

describe('battleSwitchView on the phone card', () => {
  it('re-derives every row from the compact card s own layout', () => {
    const view = battleSwitchView(inputOf({ card: PHONE_CARD }));
    expectTops(
      view.slots.map((slot) => slot.y),
      [616, 650, 684, 718, 752, 786],
    );
    expect(view.slots[1].y - view.slots[0].y).toBeCloseTo(34, 2);
    expect(view.slots[0].x).toBe(100);
    expect(view.slots[0].w).toBe(246);
    expect(view.rows[0].portrait.w).toBeCloseTo(22, 2);
    expectRect(view.rows[0].portrait, { x: 108, y: 618, w: 22, h: 22 });
    expectRect(view.rows[0].hp!.track, { x: 230.8, y: 623.4, w: 107.2, h: 11.2 });
    expectRect(view.rows[2].hp!.track, { x: 182.8, y: 691.4, w: 107.2, h: 11.2 });
    expectRect(view.rows[2].hp!.area, { x: 206.8, y: 694.6, w: 76.8, h: 4.8 });
    expectRect(view.rows[2].status!.box, { x: 294, y: 689, w: 44, h: 16 });
    expectRect(view.rows[0].label.box, { x: 136, y: 616, w: 94.8, h: 26 });
    expect(view.rows[0].label.box.w - view.rows[2].label.box.w).toBeCloseTo(48, 6);
    expect(view.back.label).toBe('\u25c0');
    expectRect(view.back.box, { x: 38, y: 696, w: 48, h: 36 });
  });

  it('keeps the HP texture at the same scale on both cards', () => {
    const desktop = battleSwitchView(inputOf());
    const phone = battleSwitchView(inputOf({ card: PHONE_CARD }));
    expect(phone.rows[0].hp!.track.w).toBeCloseTo(desktop.rows[0].hp!.track.w, 6);
    expect(phone.rows[0].hp!.track.h).toBeCloseTo(desktop.rows[0].hp!.track.h, 6);
    expect(phone.rows[0].hp!.area.w).toBeCloseTo(desktop.rows[0].hp!.area.w, 6);
    expect(phone.rows[0].hp!.fill.w).toBeCloseTo(desktop.rows[0].hp!.fill.w, 6);
  });
});

describe('fixtureSwitchInput', () => {
  const PAYLOAD = {
    slug: '05d-battle-pokemon',
    state: { party: [], bag: [], money: null, route: null, battle: null, notice: null },
    switch: { open: true, card: { x: 1, y: 2, w: 3, h: 4 }, selected: 1, rows: PARTY },
  };

  it('reads the payload s rows, selection and open flag', () => {
    const input = fixtureSwitchInput(PAYLOAD, DESKTOP);
    expect(input).not.toBeNull();
    expect(input!.open).toBe(true);
    expect(input!.selected).toBe(1);
    expect(input!.rows.map((row) => row.name)).toStrictEqual(PARTY.map((row) => row.name));
  });

  it('always takes the card from the viewport, never the payload', () => {
    expect(fixtureSwitchInput(PAYLOAD, DESKTOP)!.card).toStrictEqual(battleSwitchBox(DESKTOP));
    expect(fixtureSwitchInput(PAYLOAD, PHONE)!.card).toStrictEqual(battleSwitchBox(PHONE));
  });

  it('is null without a switch block, without rows, or without a payload', () => {
    expect(fixtureSwitchInput({}, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput({ switch: { open: true } }, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput({ switch: { rows: 'none' } }, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput(null, DESKTOP)).toBeNull();
    expect(fixtureSwitchInput('05d-battle-pokemon', DESKTOP)).toBeNull();
  });

  it('reads a member s own fields, and defaults a malformed one', () => {
    const input = fixtureSwitchInput(
      { switch: { rows: [{ name: 'EEVEE', level: 12, hp: 30, maxHp: 40, enabled: true }] } },
      DESKTOP,
    );
    expect(input!.rows).toStrictEqual([
      {
        name: 'EEVEE',
        level: 12,
        hp: 30,
        maxHp: 40,
        statusLabel: null,
        enabled: true,
        field: false,
      },
    ]);
    expect(fixtureSwitchInput({ switch: { rows: [null] } }, DESKTOP)!.rows).toStrictEqual([
      { name: '', level: 0, hp: 0, maxHp: 0, statusLabel: null, enabled: false, field: false },
    ]);
  });
});
